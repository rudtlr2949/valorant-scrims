import { randomUUID } from 'node:crypto';
import { get, put, list } from '@vercel/blob';
import { identity, validEvidence } from './kov.js';
import { readCachedDirectory } from '../workers/registry/core.mjs';

export const reportReasons = ['욕설·괴롭힘', '부정행위 의심', '사칭·허위 정보', '비매너·규정 위반', '기타'];
const fail = (message, status) => Object.assign(new Error(message), { status });
const options = () => ({ storeId: process.env.KOV_REPORTS_STORE_ID });
const readBlob = async path => {
  try {
    const result = await get(path, { ...options(), access: 'private', useCache: false });
    return result?.statusCode === 200 ? new Response(result.stream).json() : null;
  } catch (error) { if (error.name === 'BlobNotFoundError') return null; throw error; }
};
const existsError = error => /already.exists|precondition/i.test(error.name + ' ' + error.message);

// Dependencies are injected for tests; authorization is always checked server-side.
export function createReportsHandler({ authenticate = identity, directory = readCachedDirectory,
  storage = { read: readBlob, list: opts => list({ ...options(), ...opts }),
    write: (path, data, overwrite = false) => put(path, JSON.stringify(data), { ...options(), access: 'private',
      addRandomSuffix: false, allowOverwrite: overwrite, contentType: 'application/json', cacheControlMaxAge: 0 }) },
  configured = () => Boolean(process.env.KOV_REPORTS_STORE_ID), now = Date.now, uuid = randomUUID } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!['GET', 'POST', 'PATCH'].includes(req.method)) throw fail('지원하지 않는 요청입니다.', 405);
      const actor = await authenticate(req);
      if (!actor) throw fail('Discord 로그인 후 신고할 수 있습니다.', 401);
      if (req.method !== 'POST' && !actor.isAdmin) throw fail('운영진만 신고함을 확인할 수 있습니다.', 403);
      if (!configured()) throw fail('신고함 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.', 503);
      if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw fail('허용되지 않은 출처입니다.', 403);
      const query = req.query || {};
      if (req.method === 'GET') {
        if (query.evidence) {
          if (!/^reports\/\d{4}-\d{2}-\d{2}\/\d{5,25}\/\d{5,25}\.json$/.test(query.evidence)) throw fail('잘못된 증거 요청입니다.', 400);
          const report = await storage.read(query.evidence);
          if (!report?.attachment) throw fail('첨부된 증거가 없습니다.', 404);
          const attachment = await storage.read(report.attachment.path || query.evidence.replace('reports/', 'evidence/'));
          if (!attachment) throw fail('증거 파일을 불러오지 못했습니다.', 404);
          return res.status(200).json(attachment);
        }
        const day = /^\d{4}-\d{2}-\d{2}$/.test(query.day || '') ? query.day : new Date(now() + 9 * 3600000).toISOString().slice(0, 10);
        const page = await storage.list({ prefix: `reports/${day}/`, limit: 20, ...(query.cursor ? { cursor: String(query.cursor).slice(0, 2000) } : {}) });
        const reports = (await Promise.all(page.blobs.map(blob => storage.read(blob.pathname)))).filter(Boolean);
        reports.sort((a, b) => b.createdAt - a.createdAt);
        return res.status(200).json({ reports, day, cursor: page.hasMore ? page.cursor : null });
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || Buffer.byteLength(JSON.stringify(body)) > 900000) throw fail('신고 내용 또는 첨부 파일이 너무 큽니다.', 400);
      if (req.method === 'PATCH') {
        if (!/^reports\/\d{4}-\d{2}-\d{2}\/\d{5,25}\/[\w-]+\.json$/.test(body.id || '')
          || !['pending', 'handled', 'dismissed'].includes(body.status)) throw fail('잘못된 처리 요청입니다.', 400);
        const report = await storage.read(body.id);
        if (!report) throw fail('신고를 찾을 수 없습니다.', 404);
        await storage.write(body.id, { ...report, status: body.status, reviewedBy: actor.id, reviewedAt: now() }, true);
        return res.status(200).json({ ok: true });
      }
      const details = String(body.details || '').trim(), evidence = String(body.evidence || '').trim();
      let attachment;
      if (body.attachment) {
        validEvidence(body.attachment.image);
        attachment = { name: String(body.attachment.name || '증거 이미지').replace(/[\\/\u0000-\u001f]/g, '').slice(0, 120), image: body.attachment.image };
      }
      if (!reportReasons.includes(body.reason) || details.length < 10 || details.length > 1500) throw fail('신고 사유를 선택하고 내용을 10~1500자로 입력해 주세요.', 400);
      if (evidence && (evidence.length > 500 || !/^https:\/\//i.test(evidence))) throw fail('증거 링크는 https:// 주소로 입력해 주세요.', 400);
      const data = await directory();
      const team = [...(data?.teams || []), ...(data?.temporaryTeams || []), ...(data?.premierTeams || [])].find(t => t.url === body.source);
      const target = team?.discordRoster?.find(p => p.id === body.targetId);
      if (!target || !/^\d{5,25}$/.test(target.id)) throw fail('현재 명단에서 신고 대상을 확인할 수 없습니다. 명단을 새로고침해 주세요.', 400);
      if (target.id === actor.id) throw fail('본인은 신고할 수 없습니다.', 400);
      const prefix = `reports/${new Date(now() + 9 * 3600000).toISOString().slice(0, 10)}/${actor.id}/`;
      const recent = await storage.list({ prefix, limit: 6 });
      if (recent.blobs.length >= 5) throw fail('신고는 하루 최대 5건까지 접수할 수 있습니다.', 429);
      const id = prefix + target.id + '.json';
      if (await storage.read(id)) throw fail('오늘 이미 해당 유저를 신고했습니다.', 409);
      const receipt = uuid();
      // Atomic non-overwriting slots prevent parallel requests bypassing the daily limit.
      let reserved = false;
      for (let slot = 0; slot < 5; slot++) {
        try { await storage.write(prefix.replace('reports/', 'limits/') + slot + '.json', { at: now() }); reserved = true; break; }
        catch (error) { if (!existsError(error)) throw error; }
      }
      if (!reserved) throw fail('오늘 신고 가능 횟수를 모두 사용했습니다. 내일 다시 접수해 주세요.', 429);
      const attachmentPath = id.replace('reports/', 'evidence/').replace('.json', '-' + receipt + '.json');
      if (attachment) await storage.write(attachmentPath, attachment);
      await storage.write(id, { id, receipt, createdAt: now(), status: 'pending',
        reporter: { id: actor.id, name: actor.name }, target: { id: target.id, name: target.name },
        team: { name: team.name, source: team.url }, reason: body.reason, details, evidence,
        ...(attachment ? { attachment: { name: attachment.name, path: attachmentPath } } : {}) });
      return res.status(201).json({ ok: true, receipt });
    } catch (error) {
      if (existsError(error)) return res.status(409).json({ error: '오늘 이미 해당 유저를 신고했습니다.' });
      return res.status(error.status || 503).json({ error: error.status ? error.message : '신고함에 연결하지 못했습니다. 내용은 접수되지 않았으니 잠시 후 다시 시도해 주세요.' });
    }
  };
}
export default createReportsHandler();
