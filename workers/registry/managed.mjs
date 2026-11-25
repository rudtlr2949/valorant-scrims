import { guildId } from './config.mjs';

export const managedChannels = new Map([
  ['898738915085799464', '팀'], ['898738968638672906', '클랜'],
]);
export const premierManagementChannel = '1337304240229580851';
const ascending = (a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1;
const closedTitle = name => /(?:^|[-–—|/\s])(?:해체|역할\s*회수|등급\s*회수)(?:$|[\s)\]])/.test(name);

export function normalizePremierAct(value) {
  const match = value.trim().match(/^V(\d{2,4})\s*(?:A(?:CT)?|액트)\s*(\d+)$/i);
  return match ? `V${match[1]} A${Number(match[2])}` : value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function projectManagedPremier(messages) {
  const records = new Map(); let latestAct = '';
  for (const message of [...messages].sort(ascending)) {
    const text = (message.content || '').replace(/\*\*|__/g, '');
    const fields = [...text.matchAll(/^\s*(신청\s*액트|신청\s*팀명|팀명|신청인|팀장)\s*[:：]\s*([^\n]*)/gm)];
    const values = label => fields.filter(field => field[1].replace(/\s/g, '') === label);
    const acts = values('신청액트');
    const names = [...values('신청팀명'), ...values('팀명')];
    const applicants = [...values('신청인'), ...values('팀장')];
    if (acts.length !== 1 || names.length !== 1 || applicants.length !== 1) continue;
    const applicant = applicants[0];
    const next = fields.find(field => field.index > applicant.index)?.index ?? text.length;
    const ids = [...text.slice(applicant.index, next).matchAll(/<@!?(\d+)>/g)].map(match => match[1]);
    if (ids.length !== 1) continue;
    const act = normalizePremierAct(acts[0][2]), name = names[0][2].trim().slice(0, 80);
    if (!act || !name) continue;
    const user = (message.mentions || []).find(user => user.id === ids[0]);
    const captain = user?.member?.nick || user?.global_name || user?.username || '이름 확인 필요';
    // One applicant per act; a corrected team name replaces their older record.
    for (const [key, entry] of records) if (entry.act === act && (entry.discordRoster[0].id === ids[0]
      || entry.name.toLowerCase() === name.toLowerCase())) records.delete(key);
    if (/(?:프리미어|등급|역할)\s*(?:해체|회수|제외)/.test(text)) continue;
    records.set(act + ':' + name.toLowerCase(), { kind: '팀', name, captain, members: [],
      discordRoster: [{ id: ids[0], name: captain, role: 'captain' }], registryType: 'premier', act,
      source: 'admin-management', url: `https://discord.com/channels/${guildId}/${premierManagementChannel}/${message.id}` });
    latestAct = act;
  }
  return { premierTeams: [...records.values()], latestAct };
}

// Only directory fields are projected. Administrator notes, sanctions, and raw
// message content never enter the public snapshot or the public review list.
export function projectManagedThread(thread, messages, kind) {
  const title = thread.name.trim();
  const name = title.replace(/\s*[-–—]\s*(?:추가\s*등록\s*대기중?|보류).*$/, '').trim();
  if (closedTitle(title)) return { closed: true, name };
  let captain = null, members = new Map(), initialized = false, lastId = thread.id;
  const unique = people => [...new Map(people.map(person => [person.id, person])).values()];
  for (const message of [...messages].sort(ascending)) {
    const text = (message.content || '').replace(/\*\*|__/g, '');
    const names = new Map((message.mentions || []).map(person => [person.id,
      person.member?.nick || person.global_name || person.username || '이름 확인 필요']));
    const people = value => unique([...value.matchAll(/<@!?(\d+)>/g)].map(match => ({
      id: match[1], name: names.get(match[1]) || '이름 확인 필요',
    })));
    const role = kind === '클랜' ? '클랜' : '팀';
    const lines = text.split('\n');
    const snapshotCaptain = [], snapshotMembers = [];
    let section = null;
    for (const line of lines) {
      const heading = /^\s*(?:팀|클랜)(장|원)\s*[:：]?\s*(.*)$/.exec(line);
      let value = line;
      if (heading) {
        section = /^(추가|제외|변경)/.test(heading[2]) ? null : heading[1];
        value = heading[2];
      } else if (line.trim() && !/^\s*<@!?\d+>(?:\s*<@!?\d+>)*(?:\s*\/[^\n]*)?\s*$/.test(line)) section = null;
      if (!section) continue;
      for (const person of people(value)) {
        if (section === '장' && !snapshotCaptain.length) snapshotCaptain.push(person);
        else snapshotMembers.push(person);
      }
    }
    let changed = false;
    if (snapshotCaptain.length === 1 && snapshotMembers.length) {
      captain = snapshotCaptain[0];
      members = new Map(unique(snapshotMembers).filter(person => person.id !== captain.id).map(person => [person.id, person]));
      initialized = true; changed = true;
    } else if (initialized) {
      let operation = null;
      for (const line of lines) {
        const heading = new RegExp(`${role}(원|장)\\s*(추가|제외|변경)`).exec(line);
        if (heading) operation = { role: heading[1], action: heading[2] };
        else if (/^\s*(?:\d{2,4}[.\/-]\d{1,2}[.\/-]\d{1,2}\s*)?(추가|제외)(?=\s|[:：]|$)/.test(line)) {
          operation = { role: '원', action: /제외/.test(line) ? '제외' : '추가' };
        }
        // A new staff/other section stops a previous member operation.
        else if (/^\s*(?:코치|매니저|스탭|운영진|팀명|클랜명)/.test(line)) operation = null;
        if (!operation) continue;
        const list = people(line);
        if (!list.length) continue;
        if (operation.role === '장') {
          if (operation.action === '제외') {
            if (list.some(person => person.id === captain?.id)) captain = null;
          } else {
            const next = list.at(-1);
            if (captain && captain.id !== next.id) members.set(captain.id, captain);
            captain = next; members.delete(next.id);
          }
        } else for (const person of list) {
          if (operation.action === '제외') {
            members.delete(person.id);
            if (captain?.id === person.id) captain = null;
          } else if (operation.action === '추가' && captain?.id !== person.id) members.set(person.id, person);
        }
        changed = true;
      }
    }
    if (changed) lastId = message.id;
  }
  if (!initialized) return { review: { kind, name, type: 'managed', reason: '관리 기록의 최초 명단을 확인해야 합니다.',
    url: `https://discord.com/channels/${guildId}/${thread.id}` } };
  const roster = [captain && { ...captain, role: 'captain' }, ...[...members.values()].map(person => ({ ...person, role: 'member' }))].filter(Boolean);
  return { team: { kind, name, captain: captain?.name || '미지정', members: [...members.values()].map(person => person.name),
    ...(/추가\s*등록\s*대기|보류/.test(title) ? { managedStatus: 'pending' } : {}),
    discordRoster: roster, source: 'admin-management',
    url: `https://discord.com/channels/${guildId}/${thread.id}/${lastId}` } };
}

export class ManagedRegistry {
  constructor(discord, redis, prefix, { now = Date.now } = {}) {
    this.discord = discord; this.redis = redis; this.prefix = prefix; this.now = now;
    this.cache = new Map(); this.threadIds = new Set();
  }
  invalidate(id) { this.cache.delete(id); }
  async inventory() {
    // These explicit channel probes distinguish no permission from an empty list.
    for (const id of managedChannels.keys()) await this.discord.request(`/channels/${id}/messages?limit=1`);
    const active = await this.discord.request(`/guilds/${guildId}/threads/active`);
    const threads = new Map((active.threads || []).filter(thread => managedChannels.has(thread.parent_id)).map(thread => [thread.id, thread]));
    for (const parent of managedChannels.keys()) {
      let before;
      do {
        const query = new URLSearchParams({ limit: '100' });
        if (before) query.set('before', before);
        const page = await this.discord.request(`/channels/${parent}/threads/archived/public?${query}`);
        for (const thread of page.threads || []) threads.set(thread.id, thread);
        if (!page.has_more) break;
        const next = page.threads?.at(-1)?.thread_metadata?.archive_timestamp;
        if (!next || next === before) throw new Error('Incomplete managed thread inventory');
        before = next;
      } while (true);
    }
    return [...threads.values()];
  }
  async readThread(thread) {
    if (closedTitle(thread.name)) return { closed: true, name: thread.name };
    const messages = []; let before;
    do {
      const query = new URLSearchParams({ limit: '100' });
      if (before) query.set('before', before);
      const page = await this.discord.request(`/channels/${thread.id}/messages?${query}`);
      // The owner selected these restricted management channels as authoritative.
      // Keep historical human curator entries even if that admin later left staff.
      for (const message of page) if (message.author && !message.author.bot) messages.push(message);
      if (page.length < 100) break;
      const next = page.at(-1).id;
      if (next === before) throw new Error('Incomplete managed message history');
      before = next;
    } while (true);
    return projectManagedThread(thread, messages, managedChannels.get(thread.parent_id));
  }
  async syncPremier() {
    const messages = []; let before;
    do {
      const query = new URLSearchParams({ limit: '100' });
      if (before) query.set('before', before);
      const page = await this.discord.request(`/channels/${premierManagementChannel}/messages?${query}`);
      messages.push(...page.filter(message => message.author && !message.author.bot));
      if (page.length < 100) break;
      const next = page.at(-1).id;
      if (next === before) throw new Error('Incomplete Premier management history');
      before = next;
    } while (true);
    const result = { ...projectManagedPremier(messages), updatedAt: this.now() };
    await this.redis(['SET', this.prefix + ':managed:premier', JSON.stringify(result)]);
    return result;
  }
  async sync() {
    const statusKey = this.prefix + ':managed:status';
    const status = { state: 'syncing', at: this.now(), processed: 0, total: 0 };
    await this.redis(['SET', statusKey, JSON.stringify(status)]);
    try {
      await this.syncPremier();
      if (!this.cache.size) {
        const saved = await this.redis(['GET', this.prefix + ':managed:cache']);
        if (saved) this.cache = new Map(JSON.parse(saved));
      }
      const threads = await this.inventory();
      status.total = threads.length; this.threadIds = new Set(threads.map(thread => thread.id));
      const teams = [], reviewChanges = []; let closed = 0;
      for (const thread of threads) {
        const signature = `${thread.name}:${thread.last_message_id || ''}`;
        let cached = this.cache.get(thread.id);
        if (!cached || cached.signature !== signature || this.now() - cached.at > 1800000) {
          cached = { signature, at: this.now(), result: await this.readThread(thread) };
          this.cache.set(thread.id, cached);
        }
        if (cached.result.team) teams.push(cached.result.team);
        if (cached.result.review) reviewChanges.push(cached.result.review);
        if (cached.result.closed) closed++;
        status.processed++;
        if (status.processed % 10 === 0) {
          await this.redis(['SET', statusKey, JSON.stringify(status)]);
          await this.redis(['SET', this.prefix + ':managed:cache', JSON.stringify([...this.cache])]);
        }
      }
      if (!threads.length || !teams.length && !closed) throw new Error('No managed rosters verified');
      // Publish only a complete read. Partial/failed scans retain the previous snapshot.
      const snapshot = { teams, reviewChanges, closed, threadCount: threads.length, updatedAt: this.now() };
      await this.redis(['SET', this.prefix + ':managed:public', JSON.stringify(snapshot)]);
      await this.redis(['SET', statusKey, JSON.stringify({ ...status, state: 'ready', at: this.now() })]);
      console.info('KOV managed directory published:', teams.length, 'active;', closed, 'closed;', reviewChanges.length, 'review');
      return snapshot;
    } catch (error) {
      await this.redis(['SET', statusKey, JSON.stringify({ ...status, state: /HTTP 403|HTTP 404/.test(error.message) ? 'access-denied' : 'error', at: this.now() })]);
      throw error;
    }
  }
}
