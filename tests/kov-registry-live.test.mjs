import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistryEvent, replayRegistryEvents } from '../workers/registry/events.mjs';
import { DiscordRegistryClient, RegistryLiveStore, readLivePublic } from '../workers/registry/live.mjs';
import { RegistryGateway } from '../workers/registry/gateway.mjs';
import { guildId, channelId, reactionDecision, registryMessageIds, gatewayIntents } from '../workers/registry/config.mjs';

const users = [{ id: '11', username: 'Captain' }, { id: '12', username: 'Alpha' }, { id: '13', username: 'Beta' }];
const message = (id, content, extra = {}) => ({ id, content, mentions: users, timestamp: '2026-11-01T00:00:00Z', ...extra });
const registration = parseRegistryEvent(message('100', '팀명: Test GC\n팀장: <@11>\n팀원: <@12> <@13>\n팀 등록 신청합니다.'));

test('temporary expiry, formal promotion, GC property changes and Premier act filtering follow the supplied forms', () => {
  const temporary = parseRegistryEvent(message('90', '@신규(GC팀)\n팀명: Test GC\n팀장: <@11>\n신규 등급 신청합니다.'));
  assert.equal(temporary.type, 'temporary'); assert.equal(temporary.category, 'GC');
  assert.equal(replayRegistryEvents([temporary], { now: Date.parse('2026-11-30') }).temporaryTeams.length, 1);
  assert.equal(replayRegistryEvents([temporary], { now: Date.parse('2026-12-01') }).temporaryTeams.length, 0);
  const promote = replayRegistryEvents([temporary, registration], { now: Date.parse('2026-11-25') });
  assert.equal(promote.temporaryTeams.length, 0); assert.equal(promote.teams.length, 1);
  const join = parseRegistryEvent(message('95', '팀명: Test GC\n팀원: <@12> <@13>\n팀원 추가 신청합니다.', { timestamp: '2026-11-02T00:00:00Z' }));
  assert.equal(replayRegistryEvents([temporary, join], { now: Date.parse('2026-11-25') }).teams.length, 1);
  const change = parseRegistryEvent(message('110', '팀명: Test GC\n팀장: <@11>\nGC팀 → 팀 변경 신청합니다.'));
  assert.equal(replayRegistryEvents([registration, change]).teams[0].category, 'TEAM');
  const premier = parseRegistryEvent(message('120', '신청 액트: TEST-ACT\n신청 팀명: Premier Only\n신청인: <@11>\n프리미어 등급 신청합니다.', { author: { id: '11' } }));
  assert.equal(premier.type, 'premier');
  assert.equal(replayRegistryEvents([premier], { premierAct: 'NEXT-ACT' }).premierTeams.length, 0);
  assert.equal(replayRegistryEvents([premier], { premierAct: 'TEST-ACT' }).premierTeams[0].actConfirmed, true);
  assert.equal(replayRegistryEvents([premier]).premierTeams[0].actConfirmed, false);
  assert.equal(parseRegistryEvent(message('121', premier.name + '\n신청 액트: TEST\n신청 팀명: Other\n신청인: <@11>\n프리미어 등급 신청합니다.', { author: { id: '12' } })), null);
});

test('only the specified channel and official custom approval emojis trigger registry work', () => {
  assert.deepEqual(registryMessageIds('MESSAGE_REACTION_ADD', { channel_id: channelId, message_id: '123' }), ['123']);
  assert.deepEqual(registryMessageIds('MESSAGE_DELETE_BULK', { channel_id: channelId, ids: ['123', '124'] }), ['123', '124']);
  assert.deepEqual(registryMessageIds('MESSAGE_CREATE', { channel_id: 'other', id: '123' }), []);
  assert.equal(reactionDecision({ name: 'c_check', id: 'spoof' }), null);
  assert.equal(reactionDecision({ name: 'c_check', id: '1077983354001035294' }), 'approved');
  assert.equal(reactionDecision({ name: 'c_crossred', id: '1077983516144435360' }), 'rejected');
  assert.equal(gatewayIntents & 2, 0); // No extra privileged Guild Members intent.
});

test('Gateway identifies, acknowledges heartbeats, retains sequence and resumes its session', async () => {
  const frames = [], closes = [];
  const socket = { readyState: 1, send: text => frames.push(JSON.parse(text)), close: code => closes.push(code) };
  const gateway = new RegistryGateway('fixture-token'); gateway.socket = socket;
  gateway.handlePacket({ op: 10, d: { heartbeat_interval: 60000 } });
  assert.equal(frames[0].op, 2); assert.equal(frames[0].d.intents, gatewayIntents);
  gateway.handlePacket({ op: 0, s: 22, t: 'READY', d: { session_id: 'fixture-session', resume_gateway_url: 'wss://gateway.discord.gg' } });
  gateway.handlePacket({ op: 0, s: 23, t: 'MESSAGE_CREATE', d: { channel_id: channelId, id: '123' } });
  await gateway.dispatchChain;
  assert.equal(gateway.session.sequence, 23); assert.equal(gateway.connected, true);
  gateway.heartbeat(true); gateway.handlePacket({ op: 11 });
  assert.equal(gateway.acknowledged, true);
  await gateway.stop();
  const resumed = new RegistryGateway('fixture-token', { session: gateway.session }); resumed.socket = socket;
  resumed.handlePacket({ op: 10, d: { heartbeat_interval: 60000 } });
  assert.equal(frames.at(-1).op, 6); assert.equal(frames.at(-1).d.seq, 23);
  await resumed.stop(); assert.ok(closes.includes(4000));
});

test('Gateway never checkpoints past an event that failed to reach the durable queue', async () => {
  const closes = [];
  const gateway = new RegistryGateway('fixture-token', { session: { id: 'session', sequence: 4, url: 'wss://gateway.discord.gg' },
    onDispatch: async () => { throw Error('storage unavailable'); } });
  gateway.socket = { readyState: 1, close: code => closes.push(code) };
  gateway.handlePacket({ op: 0, s: 5, t: 'MESSAGE_REACTION_ADD', d: { channel_id: channelId, message_id: '123' } });
  gateway.handlePacket({ op: 0, s: 6, t: 'MESSAGE_REACTION_ADD', d: { channel_id: channelId, message_id: '124' } });
  await gateway.dispatchChain;
  assert.equal(gateway.session.sequence, 4);
  assert.ok(closes.includes(4000));
  await gateway.stop();
});

test('live inspection verifies the reactor administrator and follows Discord retry_after', async () => {
  let time = 1000, limited = false, admin = true;
  const client = new DiscordRegistryClient('fixture-token', {
    now: () => time, sleep: async ms => { time += ms; },
    fetcher: async input => {
      const url = new URL(input);
      if (url.pathname.endsWith('/roles')) return Response.json([{ id: 'admin-role', name: 'Admin', permissions: '8' }]);
      if (url.pathname.endsWith('/guilds/' + guildId)) return Response.json({ owner_id: 'owner' });
      if (url.pathname.includes('/members/')) return Response.json({ user: { id: 'reactor' }, roles: admin ? ['admin-role'] : [] });
      if (url.pathname.includes('/reactions/')) {
        if (!limited) { limited = true; return Response.json({ retry_after: 0.5 }, { status: 429 }); }
        return Response.json([{ id: 'reactor' }]);
      }
      return Response.json(message('100', '팀명: Live\n팀장: <@11>\n팀원: <@12> <@13>\n팀 등록 신청합니다.', {
        reactions: [{ emoji: { id: '1077983354001035294', name: 'c_check' } }],
      }));
    },
  });
  assert.equal((await client.inspectMessage('100')).name, 'Live'); assert.equal(time, 1500);
  admin = false; client.invalidateRoles();
  assert.equal(await client.inspectMessage('100'), null);
});

function mockRedis() {
  const data = new Map();
  return async ([command, key, value, ...args]) => {
    if (command === 'GET') return data.get(key) ?? null;
    if (command === 'EXISTS') return Number(data.has(key));
    if (command === 'SET') { if (args.includes('NX') && data.has(key)) return null; data.set(key, value); return 'OK'; }
    if (command === 'EVAL') { if (data.get(args[0]) === args[1]) data.delete(args[0]); return 1; }
    if (command === 'LPUSH') { const list = data.get(key) || []; for (const item of [value, ...args]) list.unshift(item); data.set(key, list); return list.length; }
    if (command === 'RPOPLPUSH') { const list = data.get(key) || []; const item = list.pop(); if (!item) return null; const dest = data.get(value) || []; dest.unshift(item); data.set(value, dest); return item; }
    if (command === 'LREM') { const list = data.get(key) || []; const index = list.indexOf(args[0]); if (index >= 0) list.splice(index, 1); return 1; }
    throw Error('Unexpected Redis command ' + command);
  };
}

test('approved updates publish persistently, approval removal rolls them back, and interrupted jobs recover', async () => {
  const redis = mockRedis(); const store = new RegistryLiveStore('fixture-token', redis);
  await redis(['SET', store.prefix + ':events', JSON.stringify([registration])]);
  await store.initialize();
  const change = parseRegistryEvent(message('110', '팀명: Test GC\n팀원: <@12>\n팀원 제외 신청합니다.'));
  await store.mutate('110', change);
  assert.deepEqual((await readLivePublic('fixture-token', redis)).teams[0].members, ['Beta']);
  await store.mutate('110', null);
  assert.deepEqual((await readLivePublic('fixture-token', redis)).teams[0].members, ['Alpha', 'Beta']);
  await store.enqueue(['100'], false); await store.enqueue(['110']);
  assert.equal(await store.next(), '110');
  await store.recover(); assert.equal(await store.next(), '100');
  await store.acknowledge('100'); assert.equal(await store.next(), '110');
  await redis(['SET', store.prefix + ':status', JSON.stringify({ connected: true, at: Date.now() })]);
  const visible = await readLivePublic('fixture-token', redis);
  assert.equal(visible.liveConnected, true);
  assert.equal('events' in visible, false);
  assert.equal(typeof visible.teams[0].captain, 'string');
});
