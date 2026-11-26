import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportsHandler } from '../api/kov-user-reports.js';

function fixture() {
  const saved = new Map(); let actor = { id: '123456789', name: 'Reporter', isAdmin: false };
  const handler = createReportsHandler({ authenticate: async () => actor, configured: () => true,
    now: () => Date.UTC(2026, 10, 26, 16), uuid: () => 'receipt', directory: async () => ({ teams: [{ name: 'Verified Team',
      url: 'https://discord.com/channels/1/2/3', discordRoster: [{ id: '987654321', name: 'Verified Player' }] }] }),
    storage: { read: async path => structuredClone(saved.get(path) || null),
      list: async ({ prefix, limit }) => ({ blobs: [...saved.keys()].filter(k => k.startsWith(prefix)).slice(0, limit).map(pathname => ({ pathname })), hasMore: false }),
      write: async (path, data, overwrite) => {
        if (saved.has(path) && !overwrite) throw Error('Blob already exists'); saved.set(path, structuredClone(data));
      } } });
  const request = async (method, body, query) => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method, body, query, headers: { host: 'kov.test', origin: 'https://kov.test' } }, res); return res;
  };
  const body = { source: 'https://discord.com/channels/1/2/3', targetId: '987654321', reason: '비매너·규정 위반', details: '경기 중 발생한 상황에 대한 구체적인 내용입니다.', evidence: '' };
  return { saved, request, body, actor: value => { actor = value; } };
}

test('reporter must log in; regular users cannot list or review private reports', async () => {
  const f = fixture(); assert.equal((await f.request('GET')).code, 403);
  assert.equal((await f.request('PATCH', { id: 'x', status: 'handled' })).code, 403);
  f.actor(null); assert.equal((await f.request('POST', f.body)).code, 401); assert.equal(f.saved.size, 0);
});

test('report stores source-verified identities privately, rejects duplicates, and uses Korea date', async () => {
  const f = fixture(); const result = await f.request('POST', { ...f.body, reporter: { isAdmin: true }, targetName: 'Forged' });
  assert.equal(result.code, 201); assert.equal(result.body.receipt, 'receipt');
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  const [report] = [...f.saved.values()].filter(r => r.target);
  assert.equal(report.target.name, 'Verified Player'); assert.equal(report.reporter.name, 'Reporter');
  assert.ok(report.id.startsWith('reports/2026-11-27/')); assert.equal(report.status, 'pending');
  assert.equal((await f.request('POST', f.body)).code, 409);
});

test('unknown targets, short reasons, unsafe evidence and self reports never save', async () => {
  const f = fixture();
  assert.equal((await f.request('POST', { ...f.body, targetId: '555555555' })).code, 400);
  assert.equal((await f.request('POST', { ...f.body, details: '짧음' })).code, 400);
  assert.equal((await f.request('POST', { ...f.body, evidence: 'javascript:alert(1)' })).code, 400);
  f.actor({ id: '987654321', name: 'Self' }); assert.equal((await f.request('POST', f.body)).code, 400);
  assert.equal(f.saved.size, 0);
});

test('only server-authorized admin can read the inbox and change processing status', async () => {
  const f = fixture(); await f.request('POST', f.body);
  f.actor({ id: '111111111', name: 'Staff', isAdmin: true });
  let response = await f.request('GET'); assert.equal(response.code, 200); assert.equal(response.body.reports.length, 1);
  const report = response.body.reports[0];
  response = await f.request('PATCH', { id: report.id, status: 'handled', details: 'Forged replacement' });
  assert.equal(response.code, 200); assert.equal(f.saved.get(report.id).details, f.body.details);
  assert.equal(f.saved.get(report.id).status, 'handled'); assert.equal(f.saved.get(report.id).reviewedBy, '111111111');
  assert.equal((await f.request('PATCH', { id: '../secret', status: 'handled' })).code, 400);
});

test('parallel submissions cannot overwrite the original report or bypass reserved daily slots', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.request('POST', f.body)));
  assert.equal(results.filter(r => r.code === 201).length, 1);
  assert.equal([...f.saved.keys()].filter(k => k.startsWith('reports/')).length, 1);
  assert.ok([...f.saved.keys()].filter(k => k.startsWith('limits/')).length <= 5);
});

test('local image evidence is stored separately and can only be fetched by an admin', async () => {
  const f = fixture();
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS8sAAAAASUVORK5CYII=';
  assert.equal((await f.request('POST', { ...f.body, attachment: { name: 'screenshot.png', image } })).code, 201);
  const report = [...f.saved.values()].find(x => x.target);
  assert.deepEqual(report.attachment, { name: 'screenshot.png' });
  assert.ok(!JSON.stringify(report).includes('base64'));
  assert.equal((await f.request('GET', null, { evidence: report.id })).code, 403);
  f.actor({ id: '111111111', name: 'Staff', isAdmin: true });
  const result = await f.request('GET', null, { evidence: report.id });
  assert.equal(result.code, 200); assert.equal(result.body.image, image);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.ok(!JSON.stringify((await f.request('GET')).body.reports).includes('base64'));
});

test('HTML/SVG masquerading as evidence and oversized images are rejected before saving', async () => {
  const f = fixture();
  for (const image of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64'),
    'data:image/png;base64,' + Buffer.alloc(650001).toString('base64')]) {
    assert.equal((await f.request('POST', { ...f.body, attachment: { name: 'evidence.png', image } })).code, 400);
  }
  assert.equal(f.saved.size, 0);
});
