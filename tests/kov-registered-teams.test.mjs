import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistration, readChannel } from '../api/kov-registered-teams.js';

test('reads team, captain and multiline roster without exposing Discord user IDs', () => {
  const parsed = parseRegistration({
    id: '123',
    content: '**팀명:** Eclipse\n팀장: <@123>\n팀원: <@456>\n팀원: <@!789>\n연락처: private\n\n팀 등록 신청합니다.',
    mentions: [{ id: '123', global_name: 'Captain' }, { id: '456', username: 'Alpha' },
      { id: '789', username: 'Beta' }],
  });
  assert.deepEqual(parsed, {
    kind: '팀', name: 'Eclipse', captain: 'Captain', members: ['Alpha', 'Beta'],
    url: 'https://discord.com/channels/683829152276938814/701290347161976883/123',
  });
});

test('reads embed fields and skips messages without a complete registration', () => {
  assert.equal(parseRegistration({ id: '123', content: '팀명: 공지' }), null);
  const parsed = parseRegistration({ id: '124', embeds: [{ description: '클랜 등록 신청합니다.', fields: [
    { name: '클랜명', value: 'Orbit' },
    { name: '클랜장', value: 'Nova' },
    { name: '클랜원', value: 'One' },
    { name: '클랜원', value: 'Two, One' },
  ] }] });
  assert.deepEqual(parsed.members, ['One', 'Two']);
});

test('excludes provisional applications and roster, rename and disband requests', () => {
  const fields = '팀명 : Eclipse\n팀장 : Captain\n팀원 : Alpha\n팀원 : Beta\n';
  for (const request of ['신규 등급', '프리미어 등급', '팀원 추가 및 제외', '팀명 변경', '팀장 변경', '팀 해체', '팀 → GC팀 변경']) {
    assert.equal(parseRegistration({ id: '125', content: `${fields}${request} 신청합니다.` }), null);
  }
  assert.equal(parseRegistration({ id: '126', content: '팀명 : Eclipse\n팀장 : Captain\n팀원 : Alpha\n팀 등록 신청합니다.' }), null);
});

test('rate limits preserve pagination and completed snapshots avoid duplicate scans', async () => {
  const stored = new Map();
  const redis = async ([command, key, value, ...args]) => {
    if (command === 'GET') return stored.get(key) || null;
    if (command === 'SET') {
      if (args.includes('NX') && stored.has(key)) return null;
      stored.set(key, value);
      return 'OK';
    }
    if (command === 'EVAL') {
      const lockKey = args[0];
      const lockValue = args[1];
      if (stored.get(lockKey) === lockValue) stored.delete(lockKey);
      return 1;
    }
    throw Error('unexpected command');
  };
  let time = 100000;
  let calls = 0;
  const fetcher = async url => {
    calls++;
    if (calls === 1) return Response.json({ retry_after: 5 }, { status: 429 });
    if (calls === 2) return Response.json(Array.from({ length: 100 }, (_, i) => ({
      id: String(200 - i), content: '공지',
    })), { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '3' } });
    assert.equal(url.searchParams.get('before'), '101');
    return Response.json([{ id: '100', content:
      '팀명: Test\n팀장: Captain\n팀원: A\n팀원: B\n팀 등록 신청합니다.' }]);
  };
  const read = () => readChannel('fixture-token', redis, fetcher, () => time);
  assert.equal((await read()).retryAfter, 5);
  await read();
  assert.equal(calls, 1);
  time += 5000;
  assert.equal((await read()).retryAfter, 3);
  await read();
  assert.equal(calls, 2);
  time += 3000;
  const final = await read();
  assert.equal(final.syncing, false);
  assert.equal(final.teams[0].name, 'Test');
  assert.deepEqual(await read(), final);
  assert.equal(calls, 3);
});
