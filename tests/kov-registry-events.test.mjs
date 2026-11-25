import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegistryEvent, replayRegistryEvents } from '../kov-registry-events.js';

const mentions = [
  { id: '11', username: 'Captain' }, { id: '12', username: 'Alpha' },
  { id: '13', username: 'Beta' }, { id: '14', username: 'Gamma' },
];
const event = (id, content, users = mentions) => parseRegistryEvent({ id, content, mentions: users });
const register = id => event(id, '팀명: Test GC\n팀장: <@11>\n팀원: <@12> <@13>\n팀 등록 신청합니다.');

test('replays additions, removals and captain transfer chronologically using stable Discord IDs', () => {
  const events = [register('100'),
    event('110', '팀명: Test GC\n팀원 추가: <@14>\n팀원 제외: <@12>\n팀원 추가 및 제외 신청합니다.'),
    event('120', '팀명: Test GC\n팀장 변경: <@11> → <@14>\n팀장 변경 신청합니다.'),
    event('130', '팀명: Test GC\n팀원: <@13>\n팀원 제외 신청합니다.', mentions.map(user => user.id === '13' ? { ...user, username: 'Beta renamed' } : user)),
  ];
  const result = replayRegistryEvents(events.reverse());
  assert.equal(result.appliedChanges, 3);
  assert.deepEqual(result.teams.map(team => ({ name: team.name, captain: team.captain, members: team.members })),
    [{ name: 'Test GC', captain: 'Gamma', members: ['Captain'] }]);
  assert.ok(!JSON.stringify(result.teams).includes('"id"'));
});

test('renames route later updates to the correct team, disband removes it, and re-registration starts fresh', () => {
  const events = [register('100'),
    event('110', '팀명: Test GC → New GC\n팀장: <@11>\n팀명 변경 신청합니다.'),
    event('120', '팀명: New GC\n팀원: <@14>\n팀원 추가 신청합니다.'),
    event('130', '팀명: New GC\n팀 해체 신청합니다.'),
    event('140', '팀명: New GC\n팀원: <@12>\n팀원 추가 신청합니다.'),
  ];
  const result = replayRegistryEvents(events);
  assert.deepEqual(result.teams, []);
  assert.equal(result.unmatchedChanges, 1);
  events.push(event('150', '팀명: New GC\n팀장: <@14>\n팀원: <@12>, <@13>\n팀 등록 신청합니다.'));
  assert.deepEqual(replayRegistryEvents(events).teams[0].members, ['Alpha', 'Beta']);
});

test('clan changes use the same rules and ambiguous changes do not fabricate a roster', () => {
  const registration = event('100', '클랜명: Orbit\n클랜장: <@11>\n클랜원: <@12>\n클랜원: <@13>\n클랜 등록 신청합니다.');
  const change = event('110', '클랜명: Orbit\n클랜원: <@14>\n클랜원 추가 신청합니다.');
  assert.deepEqual(replayRegistryEvents([registration, change]).teams[0].members, ['Alpha', 'Beta', 'Gamma']);
  assert.equal(event('120', '팀명: Test GC\n팀장 변경: <@11>\n팀장 변경 신청합니다.'), null);
  assert.equal(event('120', '팀명: Test GC\n팀원 추가: <@12>\n팀원 제외: <@12>\n팀원 추가 및 제외 신청합니다.'), null);
  assert.equal(event('120', '팀명: Test GC\n팀원: <@12>\n신규 등급 신청합니다.'), null);
  const mismatch = event('110', '팀명: Test GC\n팀장 변경: <@12> → <@14>\n팀장 변경 신청합니다.');
  assert.equal(replayRegistryEvents([register('100'), mismatch]).unmatchedChanges, 1);
});

test('unique bracketed aliases resolve changes while colliding abbreviations remain for review', () => {
  const make = (id, name) => event(id, `팀명: ${name}\n팀장: <@11>\n팀원: <@12> <@13>\n팀 등록 신청합니다.`);
  const add = (id, name) => event(id, `팀명: ${name}\n팀원: <@14>\n팀원 추가 신청합니다.`);
  const result = replayRegistryEvents([make('100', 'Focus My Team(FMT)'), add('110', 'FMT'),
    make('120', 'Other Team(FMT)'), add('130', 'FMT')]);
  assert.equal(result.appliedChanges, 1);
  assert.equal(result.unmatchedChanges, 1);
  assert.deepEqual(result.teams[0].members, ['Alpha', 'Beta', 'Gamma']);
  assert.deepEqual(result.teams[1].members, ['Alpha', 'Beta']);
});
