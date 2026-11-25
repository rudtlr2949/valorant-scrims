import test from 'node:test';
import assert from 'node:assert/strict';
import { registryNewestFirst, registryPostDate, registryDateLabel } from '../kov-registry-order.js';

test('teams and review entries sort newest-first without losing Snowflake precision or mutating source order', () => {
  const entries = ['1571894030315429988', '1571894030315429989', '1233664494321008642']
    .map(id => ({ url: 'https://discord.com/channels/1/2/' + id }));
  assert.deepEqual(registryNewestFirst(entries), [entries[1], entries[0], entries[2]]);
  assert.equal(entries[0].url.split('/').at(-1), '1571894030315429988');
  assert.equal(registryNewestFirst([{ url: 'invalid' }, ...entries]).at(-1).url, 'invalid');
});

test('date labels use Korea time and invalid sources have no invented date', () => {
  const expected = Date.parse('2026-11-25T15:30:00Z');
  const id = String((BigInt(expected) - 1420070400000n) << 22n);
  const entry = { url: 'https://discord.com/channels/1/2/' + id };
  assert.equal(registryPostDate(entry).getTime(), expected);
  assert.match(registryDateLabel(entry), /2026.*11.*26.*00:30/);
  assert.equal(registryPostDate({}), null);
});
