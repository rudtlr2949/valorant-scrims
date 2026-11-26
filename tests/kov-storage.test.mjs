import test from 'node:test';
import assert from 'node:assert/strict';
import { createTournamentRedis, storageFailure } from '../lib/kov-storage.mjs';

test('bandwidth suspension is distinguished from invalid credentials without exposing provider bodies', () => {
  const error = storageFailure(403, 'database suspended due to monthly bandwidth limit; secret-details');
  assert.equal(error.code, 'STORAGE_BANDWIDTH_LIMIT');
  assert.ok(error.message.includes('월 전송량')); assert.ok(!error.message.includes('secret-details'));
  assert.equal(storageFailure(401, 'Unauthorized').code, 'STORAGE_AUTH_FAILED');
  assert.equal(storageFailure(429, '').code, 'STORAGE_USAGE_LIMIT');
});

test('quota retries cool down for five minutes, resume after recovery, and do not write replacement state', async () => {
  let time = 1000, calls = [], limited = true;
  const redis = createTournamentRedis({ now: () => time, config: () => ({ url: 'https://store.test', token: 'fixture' }),
    fetcher: async (url, options) => {
      calls.push(JSON.parse(options.body));
      return limited ? new Response(JSON.stringify({ error: 'monthly bandwidth limit exceeded' }), { status: 403 })
        : new Response(JSON.stringify({ result: 'existing-state' }));
    } });
  await assert.rejects(redis(['GET', 'state']), { code: 'STORAGE_BANDWIDTH_LIMIT' });
  await assert.rejects(redis(['GET', 'state'])); assert.equal(calls.length, 1);
  time += 300001; limited = false;
  assert.equal(await redis(['GET', 'state']), 'existing-state');
  assert.ok(calls.every(command => command[0] === 'GET'));
});
