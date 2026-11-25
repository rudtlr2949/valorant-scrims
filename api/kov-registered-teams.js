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


export function reactionDecision(emoji) {
  const name = (emoji?.name || '').normalize('NFKC').replace(/\uFE0F/g, '').toLowerCase();
  if (['⭕', 'o', '🅾', '🇴'].includes(name)) return 'approved';
  if (['❌', '❎', '✖', '×', 'x', '🇽'].includes(name)) return 'rejected';
  return null;
}

export async function readChannel(token, redis, fetcher = fetch, now = Date.now) {
  const tokenId = createHash('sha256').update(token).digest('hex').slice(0, 16);
  // New namespace deliberately excludes the old, unverified application cache.
  const prefix = `kov:registry:v3:${channelId}:${tokenId}`;
  const snapshotKey = prefix + ':snapshot';
  const lockKey = prefix + ':lock';
  const fresh = () => ({ teams: [], pages: 0, pending: [], members: {}, decided: [] });
  let snapshot = JSON.parse(await redis(['GET', snapshotKey]) || 'null') || fresh();
  const result = () => ({
    teams: snapshot.teams, syncing: !snapshot.completedAt, approvalVerified: true,
    retryAfter: Math.max(2, Math.ceil(((snapshot.nextAt || 0) - now()) / 1000)),
  });
  if (snapshot.completedAt && now() - snapshot.completedAt < 300000) return result();
  if (snapshot.nextAt > now()) return result();
  const lock = randomUUID();
  if (!await redis(['SET', lockKey, lock, 'NX', 'EX', 60])) return result();
  const pause = Symbol('checkpoint');
  let calls = 0;
  const request = async (path, missingMember = false) => {
    if (calls >= 4 || snapshot.nextAt > now()) throw pause;
    calls++;
    const response = await fetcher(new URL('https://discord.com/api/v10' + path), {
      headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      const body = await response.json().catch(() => ({}));
      snapshot.nextAt = now() + Math.max(1, Number(body.retry_after || response.headers.get('retry-after')) || 5) * 1000;
      throw pause;
    }
    if (response.headers.get('x-ratelimit-remaining') === '0') {
      snapshot.nextAt = now() + Math.max(1, Number(response.headers.get('x-ratelimit-reset-after')) || 2) * 1000;
    }
    if (missingMember && response.status === 404) return null;
    if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
    return response.json();
  };
  try {
    snapshot = JSON.parse(await redis(['GET', snapshotKey]) || 'null') || fresh();
    if (snapshot.completedAt && now() - snapshot.completedAt < 300000) return result();
    if (snapshot.nextAt > now()) return result();
    if (snapshot.completedAt) snapshot = fresh();
    if (!snapshot.adminRoles) {
      const roles = await request(`/guilds/${guildId}/roles`);
      snapshot.adminRoles = roles.filter(role => (BigInt(role.permissions || '0') & 8n) !== 0n).map(role => role.id);
    }
    if (!snapshot.ownerId) snapshot.ownerId = (await request(`/guilds/${guildId}`)).owner_id;
    while (true) {
      if (!snapshot.pending.length) {
        if (snapshot.historyDone) {
          if (snapshot.hasMessages && !snapshot.hasContent) throw new Error('Discord message content unavailable');
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
          const team = parseRegistration(message);
          if (!team) continue;
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
          if (reactions.length) snapshot.pending.push({ team, id: message.id, reactions });
        }
        if (reactionNames.size) console.info('KOV registry reaction formats:', JSON.stringify([...reactionNames]), 'admin roles:', snapshot.adminRoles.length);
        snapshot.pages++;
        snapshot.before = messages.at(-1)?.id || snapshot.before;
        snapshot.historyDone = messages.length < 100;
        continue;
      }
      const task = snapshot.pending[0];
      const key = task.team.kind + ':' + task.team.name.normalize('NFKC').toLowerCase();
      if (snapshot.decided.includes(key)) { snapshot.pending.shift(); continue; }
      const reaction = task.reactions[0];
      if (!reaction) {
        if (task.approved || task.rejected) {
          snapshot.decided.push(key);
          if (task.approved && !task.rejected) snapshot.teams.push(task.team);
        }
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
    snapshot.nextAt = Math.max(snapshot.nextAt || 0, now() + 2000);
    try { await redis(['SET', snapshotKey, JSON.stringify(snapshot), 'EX', 86400]); }
    finally {
      await redis(['EVAL',
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",
        1, lockKey, lock]);
    }
  }
  return result();
}
async function registryRedis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Registry storage unavailable');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Registry storage connection failed');
  const data = await response.json();
  if (data.error) throw new Error('Registry storage command failed');
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }
  const token = process.env.KOV_REGISTRY_BOT_TOKEN?.trim();
  if (!token) return res.status(503).json({ error: 'Discord 등록 채널 연동을 준비 중입니다.' });
  try {
    const result = await readChannel(token, registryRedis);
    if (!result.syncing) res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300');
    return res.status(200).json(result);
  } catch (error) {
    console.error('KOV registry:', error.message);
    return res.status(502).json({ error: 'Discord 등록 목록을 불러오지 못했습니다.' });
  }
}
