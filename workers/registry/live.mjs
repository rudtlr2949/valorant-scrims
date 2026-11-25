import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { guildId, channelId, reactionDecision, registryNamespace } from './config.mjs';
import { parseRegistryEvent, replayRegistryEvents } from './events.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const unlockScript = "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0";

export class DiscordRegistryClient {
  constructor(token, { fetcher = fetch, now = Date.now, sleep = pause } = {}) {
    this.token = token; this.fetcher = fetcher; this.now = now; this.sleep = sleep;
    this.nextAt = 0; this.memberCache = new Map(); this.roleExpiresAt = 0;
    this.requests = Promise.resolve();
  }
  request(path, allowMissing = false) {
    const result = this.requests.then(() => this.performRequest(path, allowMissing));
    this.requests = result.catch(() => {});
    return result;
  }
  async performRequest(path, allowMissing = false) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (this.nextAt > this.now()) await this.sleep(this.nextAt - this.now());
      const response = await this.fetcher('https://discord.com/api/v10' + path, {
        headers: { Authorization: `Bot ${this.token}` }, signal: AbortSignal.timeout(10000),
      });
      if (response.status === 429) {
        const body = await response.json().catch(() => ({}));
        this.nextAt = this.now() + Math.max(0.05, Number(body.retry_after || response.headers.get('retry-after')) || 5) * 1000;
        continue;
      }
      if (response.headers.get('x-ratelimit-remaining') === '0') this.nextAt = this.now()
        + Math.max(0.05, Number(response.headers.get('x-ratelimit-reset-after')) || 2) * 1000;
      if (allowMissing && response.status === 404) return null;
      if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
      return response.json();
    }
    throw new Error('Discord rate limit retry pending');
  }
  invalidateRoles() { this.roleExpiresAt = 0; this.memberCache.clear(); }
  async loadRoles() {
    if (this.roleExpiresAt > this.now()) return;
    const roles = await this.request(`/guilds/${guildId}/roles`);
    this.adminRoles = new Set(roles.filter(role => (BigInt(role.permissions || '0') & 8n) !== 0n).map(role => role.id));
    this.rolesById = new Map(roles.map(role => [role.id, role.name]));
    this.ownerId = (await this.request(`/guilds/${guildId}`)).owner_id;
    this.memberCache.clear(); this.roleExpiresAt = this.now() + 300000;
  }
  async isAdmin(user) {
    if (user.bot) return false;
    await this.loadRoles();
    const cached = this.memberCache.get(user.id);
    if (cached && cached.expiresAt > this.now()) return cached.admin;
    const member = await this.request(`/guilds/${guildId}/members/${user.id}`, true);
    const admin = Boolean(member && !member.user?.bot &&
      (user.id === this.ownerId || member.roles?.some(role => this.adminRoles.has(role))));
    this.memberCache.set(user.id, { admin, expiresAt: this.now() + 300000 });
    return admin;
  }
  async inspectMessage(id) {
    const message = await this.request(`/channels/${channelId}/messages/${id}`, true);
    if (!message) return null;
    await this.loadRoles();
    message.registryRoleNames = (message.mention_roles || []).map(role => this.rolesById.get(role)).filter(Boolean);
    const event = parseRegistryEvent(message);
    if (!event) return null;
    let approved = false;
    const reactions = (message.reactions || []).filter(reaction => reactionDecision(reaction.emoji))
      .sort((a, b) => Number(reactionDecision(b.emoji) === 'rejected') - Number(reactionDecision(a.emoji) === 'rejected'));
    for (const reaction of reactions) {
      const decision = reactionDecision(reaction.emoji);
      const emoji = encodeURIComponent(reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name);
      const types = reaction.count_details ? [0, 1].filter(type => reaction.count_details[type ? 'burst' : 'normal'] > 0) : [0];
      let adminFound = false;
      for (const type of types) {
        let after;
        do {
          const query = new URLSearchParams({ limit: '100', type: String(type) });
          if (after) query.set('after', after);
          const users = await this.request(`/channels/${channelId}/messages/${id}/reactions/${emoji}?${query}`);
          for (const user of users) if (await this.isAdmin(user)) { adminFound = true; break; }
          after = !adminFound && users.length === 100 ? users.at(-1).id : null;
        } while (after);
        if (adminFound) break;
      }
      if (adminFound && decision === 'rejected') return null;
      if (adminFound && decision === 'approved') approved = true;
    }
    return approved ? event : null;
  }
  async recentMessages(before) {
    const query = new URLSearchParams({ limit: '100' });
    if (before) query.set('before', before);
    return this.request(`/channels/${channelId}/messages?${query}`);
  }
}

export class RegistryLiveStore {
  constructor(token, redis, { now = Date.now, premierAct = process.env.KOV_PREMIER_ACT || '' } = {}) {
    this.token = token; this.redis = redis; this.now = now; this.premierAct = premierAct;
    this.prefix = registryNamespace(token);
  }
  async initialize() {
    if (await this.redis(['EXISTS', this.prefix + ':events'])) { await this.publish(); return true; }
    const hash = createHash('sha256').update(this.token).digest('hex').slice(0, 16);
    const raw = await this.redis(['GET', `kov:registry:v6:${channelId}:${hash}:snapshot`]);
    const snapshot = raw && JSON.parse(raw);
    if (!snapshot?.completedAt) return false;
    // SET NX keeps a concurrently started worker from overwriting live history.
    const seeded = (snapshot.events || []).map(event => ({ ...event,
      createdAt: event.createdAt ?? Number((BigInt(event.id) >> 22n) + 1420070400000n) }));
    await this.redis(['SET', this.prefix + ':events', JSON.stringify(seeded), 'NX']);
    await this.publish();
    return true;
  }
  async mutate(id, event) {
    if (event && event.id !== id) throw new Error('Registry event ID mismatch');
    event = event ? JSON.parse(JSON.stringify(event)) : null;
    const key = this.prefix + ':mutation';
    const owner = randomUUID();
    let locked = false;
    for (let i = 0; i < 20; i++) {
      if (await this.redis(['SET', key, owner, 'NX', 'EX', 30])) { locked = true; break; }
      await pause(100);
    }
    if (!locked) throw new Error('Registry update busy');
    try {
      const raw = await this.redis(['GET', this.prefix + ':events']);
      if (!raw) throw new Error('Registry history not initialized');
      const previous = JSON.parse(raw);
      const existing = previous.find(item => item.id === id) || null;
      if (isDeepStrictEqual(existing, event)) return null;
      const events = previous.filter(item => item.id !== id);
      if (event) events.push(event);
      await this.redis(['SET', this.prefix + ':events', JSON.stringify(events)]);
      return await this.publish(events);
    } finally { await this.redis(['EVAL', unlockScript, 1, key, owner]); }
  }
  async publish(events) {
    if (!events) events = JSON.parse(await this.redis(['GET', this.prefix + ':events']) || '[]');
    const result = { ...replayRegistryEvents(events, { now: this.now(), premierAct: this.premierAct }),
      approvalVerified: true, syncing: false, checkedEvents: events.length, updatedAt: this.now() };
    await this.redis(['SET', this.prefix + ':public', JSON.stringify(result)]);
    return result;
  }
  async enqueue(ids, urgent = true) {
    if (ids.length) await this.redis(['LPUSH', this.prefix + (urgent ? ':urgent' : ':dirty'), ...ids]);
  }
  async allEventIds() {
    return JSON.parse(await this.redis(['GET', this.prefix + ':events']) || '[]').map(event => event.id);
  }
  async recover() {
    while (await this.redis(['RPOPLPUSH', this.prefix + ':processing', this.prefix + ':dirty'])) { /* recover interrupted jobs */ }
  }
  async next() {
    return await this.redis(['RPOPLPUSH', this.prefix + ':urgent', this.prefix + ':processing'])
      || this.redis(['RPOPLPUSH', this.prefix + ':dirty', this.prefix + ':processing']);
  }
  async acknowledge(id) { await this.redis(['LREM', this.prefix + ':processing', 1, id]); }
}

export async function readLivePublic(token, redis, now = Date.now) {
  const prefix = registryNamespace(token);
  const raw = await redis(['GET', prefix + ':public']);
  if (!raw) return null;
  const data = JSON.parse(raw);
  const heartbeat = JSON.parse(await redis(['GET', prefix + ':status']) || 'null');
  data.temporaryTeams = (data.temporaryTeams || []).filter(team => team.expiresAt > now());
  data.liveConnected = Boolean(heartbeat?.connected && now() - heartbeat.at < 90000);
  data.liveUpdatedAt = heartbeat?.at || null;
  data.retryAfter = 15;
  return data;
}
