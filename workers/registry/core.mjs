import { parseRegistryEvent, replayRegistryEvents } from './events.mjs';
import { readLivePublic } from './live.mjs';
import { createMeter } from './budget.mjs';
import { createDirectoryCache, loadSnapshot } from './snapshot.mjs';
import { reactionDecision } from './config.mjs';
import { createHash, randomUUID } from 'node:crypto';

const guildId = '683829152276938814';
const channelId = '701290347161976883';
const fields = {
  name: '팀\\s*(?:이름|명)|클랜\\s*(?:이름|명)|team(?:\\s*name)?|clan(?:\\s*name)?',
  captain: '팀\\s*장(?:\\s*닉네임)?|클랜\\s*장|주장|captain',
  members: '(?:팀원|클랜원|멤버|선수)(?:\\s*(?:명단|닉네임))?|roster|members?',
};

export function parseRegistration(message) {
  const textParts = [
    message.content,
    ...(message.embeds || []).map(embed => embed.description),
  ].filter(Boolean).map(value => value.replace(/\*\*|__/g, '').trim());
  const footerPattern = /(?:^|\n)[ \t]*(팀|클랜)[ \t]+등록[ \t]+신청합니다[.!]?[ \t]*$/;
  const footer = textParts.map(part => footerPattern.exec(part)).find(Boolean);
  if (!footer) return null;
  const kind = footer[1];
  const source = [
    ...textParts.map(part => part.replace(footerPattern, '')),
    ...(message.embeds || []).flatMap(embed =>
      (embed.fields || []).map(field => `${field.name}: ${field.value}`)),
  ].join('\n').replace(/\*\*|__/g, '');
  const labels = Object.values(fields).join('|');
  const entries = [...source.matchAll(new RegExp(
    `^\\s*(?:[-•]\\s*)?(${labels})\\s*[:：]([^\\n]*(?:\\n(?!\\s*(?:[-•]\\s*)?[^\\n:：]{1,30}[:：])[^\\n]*)*)`,
    'gim',
  ))];
  const mentions = new Map((message.mentions || []).map(user => [
    user.id, user.member?.nick || user.global_name || user.username,
  ]));
  const clean = value => value?.replace(/<@!?(\d+)>/g, (_, id) => mentions.get(id) || '')
    .replace(/^`|`$/g, '').trim().slice(0, 80) || '';
  const getFields = key => entries.filter(entry => new RegExp(`^(?:${fields[key]})$`, 'i').test(entry[1]));
  const [nameField, ...otherNames] = getFields('name');
  const [captainField, ...otherCaptains] = getFields('captain');
  if (!nameField || otherNames.length || !captainField || otherCaptains.length) return null;
  if (!nameField[1].startsWith(kind)) return null;
  const name = clean(nameField[2].split('\n')[0]);
  const captain = clean(captainField[2].split('\n')[0]);
  const members = [...new Set(getFields('members')
    .flatMap(entry => entry[2].split(/[,，、\n]/))
    .map(value => clean(value.replace(/^\s*(?:[-•]|\d+[.)])\s*/, '')))
    .filter(member => member && member !== captain))];
  if (!name || !captain || members.length < 2 || !/^\d+$/.test(message.id)) return null;
  return { kind, name, captain, members, url: `https://discord.com/channels/${guildId}/${channelId}/${message.id}` };
}


export { reactionDecision } from './config.mjs';

export async function readChannel(token, redis, fetcher = fetch, now = Date.now) {
  const tokenId = createHash('sha256').update(token).digest('hex').slice(0, 16);
  // New namespace deliberately excludes the old, unverified application cache.
  const prefix = `kov:registry:v6:${channelId}:${tokenId}`;
  const snapshotKey = prefix + ':snapshot';
  const replayRevision = 6;
  const lockKey = prefix + ':lock';
  const publishedKey = prefix + ':published';
  const published = JSON.parse(await redis(['GET', publishedKey]) || 'null');
  const fresh = () => ({ teams: published?.teams || [], appliedChanges: published?.appliedChanges || 0,
    unmatchedChanges: published?.unmatchedChanges || 0, pages: 0, pending: [], members: {}, events: [] });
  let snapshot = JSON.parse(await redis(['GET', snapshotKey]) || 'null') || fresh();
  const result = () => ({
    teams: snapshot.teams, appliedChanges: snapshot.appliedChanges || 0, unmatchedChanges: snapshot.unmatchedChanges || 0,
    temporaryTeams: snapshot.temporaryTeams || [], premierTeams: snapshot.premierTeams || [],
    reviewChanges: snapshot.reviewChanges || [], checkedEvents: snapshot.events.length, syncing: !snapshot.completedAt, approvalVerified: true,
    retryAfter: Math.max(0.25, ((snapshot.nextAt || 0) - now()) / 1000),
  });
  if (snapshot.completedAt && snapshot.replayRevision === replayRevision) return result();
  if (snapshot.nextAt > now()) return result();
  const lock = randomUUID();
  if (!await redis(['SET', lockKey, lock, 'NX', 'EX', 60])) return result();
  const pause = Symbol('checkpoint');
  let calls = 0;
  const startedAt = now();
  const request = async (path, missingMember = false) => {
    if (calls >= 12 || now() - startedAt >= 8000 || snapshot.nextAt > now()) throw pause;
    calls++;
    const response = await fetcher(new URL('https://discord.com/api/v10' + path), {
      headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      const body = await response.json().catch(() => ({}));
      snapshot.nextAt = now() + Math.max(0.05, Number(body.retry_after || response.headers.get('retry-after')) || 5) * 1000;
      throw pause;
    }
    if (response.headers.get('x-ratelimit-remaining') === '0') {
      snapshot.nextAt = now() + Math.max(0.05, Number(response.headers.get('x-ratelimit-reset-after')) || 2) * 1000;
    }
    if (missingMember && response.status === 404) return null;
    if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
    return response.json();
  };
  try {
    snapshot = JSON.parse(await redis(['GET', snapshotKey]) || 'null') || fresh();
    if (snapshot.completedAt && snapshot.replayRevision !== replayRevision) {
      Object.assign(snapshot, replayRegistryEvents(snapshot.events), { replayRevision, completedAt: now() });
    }
    if (snapshot.completedAt) return result();
    if (snapshot.nextAt > now()) return result();
    if (snapshot.completedAt) snapshot = fresh();
    if (!snapshot.adminRoles) {
      const roles = await request(`/guilds/${guildId}/roles`);
      snapshot.adminRoles = roles.filter(role => (BigInt(role.permissions || '0') & 8n) !== 0n).map(role => role.id);
      snapshot.rolesById = Object.fromEntries(roles.map(role => [role.id, role.name]));
    }
    if (!snapshot.ownerId) snapshot.ownerId = (await request(`/guilds/${guildId}`)).owner_id;
    while (true) {
      if (!snapshot.pending.length) {
        if (snapshot.historyDone) {
          if (snapshot.hasMessages && !snapshot.hasContent) throw new Error('Discord message content unavailable');
          Object.assign(snapshot, replayRegistryEvents(snapshot.events));
          snapshot.replayRevision = replayRevision;
          snapshot.completedAt = now();
          break;
        }
        const query = new URLSearchParams({ limit: '100' });
        if (snapshot.before) query.set('before', snapshot.before);
        const messages = await request(`/channels/${channelId}/messages?${query}`);
        const reactionNames = new Set();
        for (const message of messages) {
          snapshot.hasMessages = true;
          snapshot.hasContent ||= Boolean(message.content || message.embeds?.length || message.attachments?.length);
          const event = parseRegistryEvent({ ...message, registryRoleNames: (message.mention_roles || [])
            .map(role => snapshot.rolesById?.[role]).filter(Boolean) });
          if (!event) continue;
          for (const reaction of message.reactions || []) reactionNames.add(reaction.emoji?.name);
          const reactions = (message.reactions || []).flatMap(reaction => {
            const decision = reactionDecision(reaction.emoji);
            if (!decision) return [];
            const emoji = reaction.emoji.id ? reaction.emoji.name + ':' + reaction.emoji.id : reaction.emoji.name;
            // Discord normal and burst reactions have separate user lists.
            const types = reaction.count_details
              ? [0, 1].filter(type => reaction.count_details[type ? 'burst' : 'normal'] > 0) : [0];
            return types.map(type => ({ emoji, decision, type }));
          }).sort((a, b) => Number(b.decision === 'rejected') - Number(a.decision === 'rejected'));
          if (reactions.length) snapshot.pending.push({ event, id: message.id, reactions });
        }
        if (reactionNames.size) console.info('KOV registry reaction formats:', JSON.stringify([...reactionNames]), 'admin roles:', snapshot.adminRoles.length);
        snapshot.pages++;
        snapshot.before = messages.at(-1)?.id || snapshot.before;
        snapshot.historyDone = messages.length < 100;
        continue;
      }
      const task = snapshot.pending[0];
      const reaction = task.reactions[0];
      if (!reaction) {
        if (task.approved && !task.rejected) snapshot.events.push(task.event);
        snapshot.pending.shift();
        continue;
      }
      if (!reaction.users) {
        const query = new URLSearchParams({ limit: '100', type: String(reaction.type) });
        if (reaction.after) query.set('after', reaction.after);
        const users = await request(`/channels/${channelId}/messages/${task.id}/reactions/${encodeURIComponent(reaction.emoji)}?${query}`);
        reaction.users = users.filter(user => !user.bot).map(user => user.id);
        reaction.more = users.length === 100;
        reaction.after = users.at(-1)?.id;
      }
      while (reaction.users.length) {
        const id = reaction.users[0];
        if (!(id in snapshot.members)) {
          const member = await request(`/guilds/${guildId}/members/${id}`, true);
          snapshot.members[id] = Boolean(member && !member.user?.bot &&
            (id === snapshot.ownerId || member.roles?.some(role => snapshot.adminRoles.includes(role))));
        }
        reaction.users.shift();
        if (snapshot.members[id]) {
          task[reaction.decision] = true;
          reaction.users = [];
          reaction.more = false;
          if (task.rejected) task.reactions = [];
          break;
        }
      }
      if (!task.reactions.length) continue;
      if (reaction.more) delete reaction.users;
      else task.reactions.shift();
    }
  } catch (error) {
    if (error !== pause) throw error;
  } finally {
    // Persist even on a rate-limit pause, including partially checked reaction pages.
    snapshot.nextAt = Math.max(snapshot.nextAt || 0, now() + 250);
    try {
      if (snapshot.completedAt) await redis(['SET', publishedKey, JSON.stringify({ teams: snapshot.teams,
        appliedChanges: snapshot.appliedChanges, unmatchedChanges: snapshot.unmatchedChanges,
        reviewChanges: snapshot.reviewChanges }), 'EX', 604800]);
      await redis(['SET', snapshotKey, JSON.stringify(snapshot), 'EX', 86400]);
    }
    finally {
      await redis(['EVAL',
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",
        1, lockKey, lock]);
    }
  }
  return result();
}
let storageBlockedUntil = 0;
async function sendRegistryCommand(command) {
  if (Date.now() < storageBlockedUntil) {
    const error = new Error('Registry storage cooling down'); error.code = 'STORAGE_USAGE_LIMIT'; throw error;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Registry storage unavailable');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    // Classify provider failures without logging URLs, tokens, or raw responses.
    const code = /bandwidth/i.test(body) ? 'STORAGE_BANDWIDTH_LIMIT'
      : /limit|quota|too many requests/i.test(body) ? 'STORAGE_USAGE_LIMIT'
      : response.status === 401 || response.status === 403 ? 'STORAGE_AUTH_FAILED' : 'STORAGE_UNAVAILABLE';
    const error = new Error(`Registry storage ${code} (HTTP ${response.status})`);
    error.code = code;
    if (/LIMIT/.test(code)) storageBlockedUntil = Date.now() + 300000;
    throw error;
  }
  const data = await response.json();
  if (data.error) {
    const error = new Error('Registry storage command failed');
    if (/limit|quota/i.test(data.error)) { error.code = 'STORAGE_USAGE_LIMIT'; storageBlockedUntil = Date.now() + 300000; }
    throw error;
  }
  return data.result;
}

export const registryRedis = createMeter(sendRegistryCommand);
const cachedDirectory = createDirectoryCache({
  read: async () => {
    const data = await readLivePublic(process.env.KOV_REGISTRY_BOT_TOKEN?.trim(), registryRedis, Date.now, { managedOnly: true });
    if (data) { await registryRedis.flush().catch(() => {}); data.budget = registryRedis.policy(); data.retryAfter = data.budget.retryAfter; }
    return data;
  }, fallback: loadSnapshot,
});
export const readCachedDirectory = () => cachedDirectory();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }
  const token = process.env.KOV_REGISTRY_BOT_TOKEN?.trim();
  if (!token) return res.status(503).json({ error: 'Discord 등록 채널 연동을 준비 중입니다.' });
  try {
    const live = await readCachedDirectory();
    if (live) {
      res.setHeader('Vercel-CDN-Cache-Control', `max-age=${live.stale ? 300 : live.retryAfter || 60}`);
      return res.status(200).json(live);
    }
    return res.status(503).json({ error: '운영진 명단 동기화를 준비 중입니다.', retryAfter: 300 });
  } catch (error) {
    console.error('KOV registry:', error.message);
    return res.status(502).json({ error: '등록 명단 저장소에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.', code: error.code || 'STORAGE_UNAVAILABLE' });
  }
}
