import test from 'node:test';
import assert from 'node:assert/strict';
import { projectManagedThread, ManagedRegistry } from '../workers/registry/managed.mjs';

const users = [{ id: '11', username: 'Captain' }, { id: '12', username: 'Alpha' },
  { id: '13', username: 'Beta' }, { id: '14', username: 'Gamma' }];
const message = (id, content) => ({ id, content, mentions: users });
const thread = { id: '100', name: 'ARA(AURORA GC)' };

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
  for (const name of ['Orbit - 해체', 'Orbit - 역할회수', 'Orbit - 등급회수']) {
    assert.equal(projectManagedThread({ ...thread, name }, messages, '클랜').closed, true);
  }
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
