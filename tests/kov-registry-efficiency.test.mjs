import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectoryCache, publicSnapshot } from '../workers/registry/snapshot.mjs';
import { createMeter, budgetPolicy } from '../workers/registry/budget.mjs';
import { ManagedRegistry, managedChannels, premierManagementChannel } from '../workers/registry/managed.mjs';
import { readLivePublic } from '../workers/registry/live.mjs';

test('shared cache coalesces concurrent reads, isolates caller mutation, expires and recovers', async () => {
  let time = 1000, calls = 0, failed = false;
  const cache = createDirectoryCache({ now: () => time, read: async () => {
    calls++; await Promise.resolve(); if (failed) throw Error('offline');
    return { teams: [{ name: 'Verified' }], updatedAt: time, liveConnected: true };
  } });
  const [a, b] = await Promise.all([cache(), cache()]);
  assert.equal(calls, 1); a.teams[0].name = 'Changed'; assert.equal(b.teams[0].name, 'Verified');
  failed = true; time += 60001;
  const stale = await cache(); assert.equal(stale.stale, true); assert.equal(stale.liveConnected, false);
  assert.equal(stale.snapshotAt, 1000); await cache(); assert.equal(calls, 2);
  failed = false; time += 300001; assert.equal((await cache()).stale, false);
});

test('cold API uses durable public backup without claiming live connection and expires temporary entries', async () => {
  const cache = createDirectoryCache({ now: () => 100, read: async () => { throw Error('quota'); },
    fallback: async () => ({ teams: [{ name: 'Retained' }], updatedAt: 50,
      temporaryTeams: [{ name: 'Expired', expiresAt: 99 }, { name: 'Active', expiresAt: 200 }] }) });
  const result = await cache(); assert.equal(result.stale, true); assert.equal(result.liveConnected, false);
  assert.deepEqual(result.temporaryTeams.map(t => t.name), ['Active']);
  const noBackup = createDirectoryCache({ read: async () => { throw Error('quota'); } });
  await assert.rejects(noBackup(), /quota/);
  assert.equal(publicSnapshot({ teams: [], token: 'secret', rawMessages: ['private'], events: ['private'] }).token, undefined);
});

test('public managed directory does not read large legacy history or accept application-only fallback', async () => {
  const reads = [];
  const data = await readLivePublic('test', async ([, key]) => {
    reads.push(key);
    return key.endsWith(':managed:public') ? JSON.stringify({ teams: [], reviewChanges: [], updatedAt: 1 }) : null;
  });
  assert.equal(data.directorySource, 'admin-management');
  assert.ok(!reads.some(key => key.endsWith(':live:public') || key.endsWith(':events')));
  let legacyRead = false;
  assert.equal(await readLivePublic('test', async ([, key]) => {
    if (key.endsWith(':public') && !key.endsWith(':managed:public')) legacyRead = true;
    return null;
  }, Date.now, { managedOnly: true }), null);
  assert.equal(legacyRead, false);
});

test('monthly traffic meter batches accounting, excludes failed requests, resets and crosses thresholds once', async () => {
  let time = Date.UTC(2026, 10, 26), total = 349999, alerts = [];
  const meter = createMeter(async ([command, ...args]) => {
    if (command === 'FAIL') throw Error('quota');
    if (command === 'EVAL') { total += Number(args.at(-2)); return [total, Number(args.at(-1))]; }
    return 'OK';
  }, { now: () => time, warn: text => alerts.push(text) });
  await assert.rejects(meter(['FAIL'])); await meter(['GET', 'small']);
  await meter.flush(); assert.equal(meter.policy().level, 70); assert.equal(alerts.length, 1);
  await meter(['GET', 'small']); assert.equal(await meter.flush(), undefined);
  time += 300001; await meter.flush(); assert.equal(alerts.length, 1);
  assert.equal(budgetPolicy({ bytes: 9000000000 }).debounceMs, 300000);
  time = Date.UTC(2026, 11, 1); assert.equal(meter.policy().level, 0);
});

test('incremental management sync rereads only dirty threads and persists individual cache fields', async () => {
  const parent = [...managedChannels.keys()][0], commands = [], read = [];
  const threads = [{ id: '101', name: 'One', parent_id: parent }, { id: '102', name: 'Two', parent_id: parent }];
  const client = { request: async path => threads.find(t => path === '/channels/' + t.id) };
  const redis = async command => { commands.push(command); return null; };
  const collector = new ManagedRegistry(client, redis, 'fixture');
  let inventory = 0;
  collector.inventory = async () => { inventory++; return threads; };
  collector.syncPremier = async () => { collector.premier = { premierTeams: [] }; };
  collector.readThread = async thread => { read.push(thread.id); return { team: {
    name: thread.name, kind: '팀', members: [], url: 'https://discord.com/channels/1/' + thread.id + '/100' } }; };
  await collector.sync(); read.length = 0; commands.length = 0;
  collector.invalidate('101'); await collector.sync({ full: false });
  assert.deepEqual(read, ['101']); assert.equal(inventory, 1);
  const write = commands.find(c => c[0] === 'HSET'); assert.equal(write[2], '101'); assert.equal(write.length, 4);
  assert.ok(!commands.some(c => c[1]?.endsWith(':managed:cache') && c[0] === 'SET'));
  collector.invalidate('102', true); await collector.sync({ full: false });
  assert.equal(collector.cache.has('102'), false); assert.ok(commands.some(c => c[0] === 'HDEL'));
  collector.invalidate(premierManagementChannel); assert.equal(collector.premierDirty, true);
});
