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


function memoryRedis() {
  const stored = new Map();
  return async ([command, key, value, ...args]) => {
    if (command === 'GET') return stored.get(key) || null;
    if (command === 'SET') {
      if (args.includes('NX') && stored.has(key)) return null;
      stored.set(key, value); return 'OK';
    }
    if (command === 'EVAL') {
      if (stored.get(args[0]) === args[1]) stored.delete(args[0]);
      return 1;
    }
    throw Error('unexpected command');
  };
}
const application = (id, name, reactions = []) => ({
  id, content: '팀명: '+name+'\n팀장: Captain\n팀원: A\n팀원: B\n팀 등록 신청합니다.',
  reactions: reactions.map(name => ({ emoji: { name }, count: 1 })),
});
async function finishScan(fetcher) {
  let time = 100000;
  const redis = memoryRedis();
  let result;
  for (let i = 0; i < 100; i++) {
    result = await readChannel('fixture-token', redis, fetcher, () => time);
    if (!result.syncing) {
      assert.deepEqual(await readChannel('fixture-token', redis, () => { throw Error('cached'); }, () => time), result);
      return result;
    }
    time += result.retryAfter * 1000;
  }
  throw Error('scan failed to finish');
}
function authorityResponse(url) {
  if (url.pathname.endsWith('/roles')) return Response.json([{ id: 'admin', permissions: '8' }, { id: 'member', permissions: '0' }]);
  if (url.pathname === '/api/v10/guilds/683829152276938814') return Response.json({ owner_id: 'owner' });
  if (url.pathname.includes('/members/')) {
    const id = url.pathname.split('/').at(-1);
    if (id === 'left') return Response.json({}, { status: 404 });
    return Response.json({ user: { id }, roles: id === 'adminUser' ? ['admin'] : ['member'] });
  }
}

test('only administrator O reactions approve, while administrator X vetoes and missing approvals stay hidden', async () => {
  const result = await finishScan(async url => {
    const authority = authorityResponse(url); if (authority) return authority;
    if (url.pathname.endsWith('/messages')) return Response.json([
      application('10', 'Approved', ['c_check']), application('9', 'MemberOnly', ['⭕']),
      application('8', 'Rejected', ['c_check', 'c_crossred']), application('7', 'Pending'),
      application('6', 'FormerMember', ['⭕']), application('5', 'Owner', ['⭕']),
      application('4', 'BotOnly', ['⭕']),
    ]);
    const id = url.pathname.split('/messages/')[1].split('/')[0];
    return Response.json([{ id: id === '9' ? 'regular' : id === '6' ? 'left' : id === '5' ? 'owner' : 'adminUser', bot: id === '4' }]);
  });
  assert.deepEqual(result.teams.map(team => team.name), ['Approved', 'Owner']);
  assert.equal(result.approvalVerified, true);
});

test('reaction user pagination and rate limits resume without treating counts as approval', async () => {
  let throttled = false, pages = 0;
  const result = await finishScan(async url => {
    const authority = authorityResponse(url); if (authority) return authority;
    if (url.pathname.endsWith('/messages')) return Response.json([application('12', 'Paged', ['⭕'])]);
    if (!throttled) { throttled = true; return Response.json({ retry_after: 5 }, { status: 429 }); }
    pages++;
    if (!url.searchParams.has('after')) return Response.json(Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1), bot: true })));
    assert.equal(url.searchParams.get('after'), '100');
    return Response.json([{ id: 'adminUser' }]);
  });
  assert.equal(pages, 2);
  assert.equal(result.teams[0].name, 'Paged');
});

test('message pagination continues past a full page and unapproved cache cannot leak', async () => {
  let pages = 0;
  const result = await finishScan(async url => {
    const authority = authorityResponse(url); if (authority) return authority;
    if (url.pathname.endsWith('/messages')) {
      pages++;
      if (pages === 1) return Response.json(Array.from({ length: 100 }, (_, i) => ({ id: String(200-i), content: '공지' })));
      assert.equal(url.searchParams.get('before'), '101');
      return Response.json([application('100', 'Last', ['⭕'])]);
    }
    return Response.json([{ id: 'adminUser' }]);
  });
  assert.equal(pages, 2);
  assert.deepEqual(result.teams.map(team => team.name), ['Last']);
});
