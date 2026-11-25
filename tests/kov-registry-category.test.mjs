import test from 'node:test';
import assert from 'node:assert/strict';
import { registryCategory } from '../kov-registry-category.js';

test('separates explicit GC, clan and Academy names without guessing abbreviations', () => {
  for (const name of ['Lunatics GC', 'ARA(AURORA GC)', 'GC팀', 'Team ＧＣ']) {
    assert.equal(registryCategory({ kind: '팀', name }), 'GC');
  }
  for (const name of ['BNK FearX Academy', 'Impact Game Academy (IGA)', 'KOV 아카데미']) {
    assert.equal(registryCategory({ kind: '팀', name }), 'Academy');
  }
  assert.equal(registryCategory({ kind: '클랜', name: 'Academy GC' }), 'CLAN');
  assert.equal(registryCategory({ kind: '팀', name: 'Academy GC' }), 'GC');
  for (const name of ['AGC', 'SGC guro', 'PGC', 'Ascend']) {
    assert.equal(registryCategory({ kind: '팀', name }), 'TEAM');
  }
});
