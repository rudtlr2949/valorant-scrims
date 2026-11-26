import test from 'node:test';
import assert from 'node:assert/strict';
import { projectManagedThread, projectManagedPremier, projectManagedCollection, newestManagedTeams, normalizePremierAct, ManagedRegistry } from '../workers/registry/managed.mjs';

const users = [{ id: '11', username: 'Captain' }, { id: '12', username: 'Alpha' },
  { id: '13', username: 'Beta' }, { id: '14', username: 'Gamma' }];
const message = (id, content) => ({ id, content, mentions: users });
const thread = { id: '100', name: 'ARA(AURORA GC)' };

test('aggregate temporary records expire by their recorded date and foreign index projects the actual team name', () => {
  const now = Date.parse('2026-11-26T00:00:00Z');
  const result = projectManagedCollection({ id: '1059083325043638332' }, [
    message('101', '23.01.01\nExpired\n<@11> / old / 11'),
    message('102', '26.11.22\nNew Team\n<@12> / alpha / 12'),
  ], now);
  assert.deepEqual(result.temporaryTeams.map(team => team.name), ['New Team']);
  assert.deepEqual(result.teams, []);
  const foreign = projectManagedCollection({ id: '1163717383366651956' }, [message('103', 'Region: CN\nTeam name: Monarch Effect\nTeam leader: <@11>')], now);
  assert.equal(foreign.teams[0].name, 'Monarch Effect');
  assert.equal(foreign.teams[0].rosterIncomplete, true);
});

test('the latest managed record resolves duplicate names across re-registrations and category changes', () => {
  const result = newestManagedTeams([{ name: 'PC', kind: '팀', url: 'https://discord.com/channels/1/2/110' },
    { name: 'PC', kind: '클랜', url: 'https://discord.com/channels/1/3/100' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, '팀');
});

test('verified legacy member-label typo and vice-captain rows retain participants; per-person role withdrawal removes only that person', () => {
  const typo = projectManagedThread(thread, [message('101', '팀장: <@11>\n팀명: <@12> / alpha / 12\n팀명: <@13> / beta / 13')], '팀');
  assert.deepEqual(typo.team.members, ['Alpha', 'Beta']);
  const vice = projectManagedThread(thread, [message('101', '클랜장: <@11>\n부클랜장: <@12>\n<@13> / beta / 13'),
    message('102', '23.04.29 역할회수\n<@13> / beta / 13')], '클랜');
  assert.deepEqual(vice.team.members, ['Alpha']);
  assert.equal(vice.team.captain, 'Captain');
});

test('TP unlabeled legacy roster keeps the captain unassigned and applies a personal withdrawal', () => {
  const result = projectManagedThread({ id: '1086885182855970866', name: 'TP' }, [
    message('101', 'Trump\n23.03.19\n<@11> / captain / 11\n<@12> / alpha / 12\n<@13> / beta / 13'),
    message('102', '24.02.18 (개인 요청으로 인한 탈퇴)\n<@12> / alpha / 12'),
  ], '클랜');
  assert.equal(result.team.captain, '미지정');
  assert.deepEqual(result.team.members, ['Captain', 'Beta']);
  assert.equal(result.team.rosterIncomplete, true);
});

test('Premier management normalizes equivalent acts and preserves act history separately', () => {
  assert.equal(normalizePremierAct('V26A6'), 'V26 A6');
  assert.equal(normalizePremierAct('V26 Act6'), 'V26 A6');
  const result = projectManagedPremier([
    message('101', '26.10.26\n신청 액트: V26 A5\n신청 팀명: Before\n신청인: <@11>'),
    message('102', '26.10.26\n신청 액트: V26A6\n신청 팀명: Old\n신청인: <@11>'),
    message('103', '26.11.02\n신청 액트:V26 Act6\n팀명: New\n팀장:\n<@11>'),
    message('104', '내부 메모: 아무 팀도 추가하면 안 됨'),
  ]);
  assert.deepEqual(result.premierTeams.map(team => [team.name, team.act]), [['Before', 'V26 A5'], ['New', 'V26 A6']]);
  assert.equal(result.latestAct, 'V26 A6');
  assert.equal(result.premierTeams[1].discordRoster[0].id, '11');
  assert.ok(!JSON.stringify(result).includes('내부 메모'));
});

test('managed roster applies administrator-ledger additions and exclusions without exposing private notes', () => {
  const messages = [message('101', '26.10.29\n팀장: <@11> / 11\n팀원: <@12> / 12\n팀원: <@13> / 13'),
    message('102', '26.10.30 팀원 추가\n<@14> / 14'),
    message('103', '26.11.09 팀원 제외\n<@12> / 12'),
    message('104', '내부 메모: 공개하지 않을 운영 판단')];
  const result = projectManagedThread(thread, messages.reverse(), '팀');
  assert.deepEqual(result.team.members, ['Beta', 'Gamma']);
  assert.equal(result.team.captain, 'Captain');
  assert.ok(!JSON.stringify(result).includes('운영 판단'));
  assert.ok(result.team.url.endsWith('/103'));
});

test('managed clan snapshots, captain transfers, closure flags, and missing baselines stay distinct', () => {
  const messages = [message('101', '클랜장: <@11>\n클랜원: <@12>\n클랜원: <@13>'),
    message('102', '클랜장 변경\n<@11> → <@14>')];
  const result = projectManagedThread({ ...thread, name: 'Orbit' }, messages, '클랜');
  assert.equal(result.team.captain, 'Gamma');
  assert.deepEqual(result.team.members, ['Alpha', 'Beta', 'Captain']);
  for (const name of ['Orbit - 해체', 'Orbit - 역할회수', 'Orbit - 등급회수', 'Orbit (해체)', 'Orbit - 등급회수, 내부 메모', 'Orbit - 권한 회수']) {
    assert.equal(projectManagedThread({ ...thread, name }, messages, '클랜').closed, true);
  }
  const publicName = projectManagedThread({ ...thread, name: 'Orbit - 내부 운영 메모' }, messages, '클랜').team.name;
  assert.equal(publicName, 'Orbit');
  assert.ok(projectManagedThread(thread, [message('102', '팀원 추가\n<@14>')], '팀').review);
});

test('managed collector retains the last published roster if channel permissions fail', async () => {
  const values = new Map([['registry:managed:public', '{"teams":[{"name":"Retained"}]}']]);
  const redis = async ([command, key, value]) => command === 'SET' ? values.set(key, value) : values.get(key);
  const client = { request: async () => { throw new Error('Discord HTTP 403'); } };
  const collector = new ManagedRegistry(client, redis, 'registry');
  await assert.rejects(collector.sync(), /403/);
  assert.equal(JSON.parse(values.get('registry:managed:public')).teams[0].name, 'Retained');
  assert.equal(JSON.parse(values.get('registry:managed:status')).state, 'access-denied');
});

test('multiline legacy labels and generic clan exclusion follow the latest full snapshot', () => {
  const initial = message('101', '팀장\n<@11> / captain / 11\n\n팀원\n<@12> / alpha / 12\n<@13> / beta / 13\n내부 메모');
  const exclusion = message('102', '26.05.07 제외\n<@13> / 13');
  assert.deepEqual(projectManagedThread({ ...thread, name: '빵야단' }, [initial, exclusion], '클랜').team.members, ['Alpha']);
  const result = projectManagedThread({ ...thread, name: '빵야단' }, [
    message('101', '팀장\n<@11> / captain / 11\n\n팀원\n<@12> / alpha / 12\n<@13> / beta / 13\n내부 메모'),
    message('102', '26.05.07 제외\n<@13> / 13'),
    message('103', '26.07.03\n클랜장 : <@14>\n클랜원: <@12>\n클랜원: <@13>'),
  ], '클랜');
  assert.equal(result.team.captain, 'Gamma');
  assert.deepEqual(result.team.members, ['Alpha', 'Beta']);
});
