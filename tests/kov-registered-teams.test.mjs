import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistration } from '../api/kov-registered-teams.js';

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
