import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistration } from '../api/kov-registered-teams.js';

test('reads team, captain and multiline roster without exposing Discord user IDs', () => {
  const parsed = parseRegistration({
    id: '123',
    content: '**팀명:** Eclipse\n팀장: <@123>\n팀원 명단:\n- Alpha#KR1\n- Beta#KR1\n연락처: private',
    mentions: [{ id: '123', global_name: 'Captain' }],
  });
  assert.deepEqual(parsed, {
    name: 'Eclipse', captain: 'Captain', members: ['Alpha#KR1', 'Beta#KR1'],
    url: 'https://discord.com/channels/683829152276938814/701290347161976883/123',
  });
});

test('reads embed fields and skips messages without a complete registration', () => {
  assert.equal(parseRegistration({ id: '123', content: '팀명: 공지' }), null);
  const parsed = parseRegistration({ id: '124', embeds: [{ fields: [
    { name: '클랜명', value: 'Orbit' },
    { name: '주장', value: 'Nova' },
    { name: '멤버', value: 'One, Two, One' },
  ] }] });
  assert.deepEqual(parsed.members, ['One', 'Two']);
});
