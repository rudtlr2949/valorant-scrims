// This app's measured traffic is a lower bound, not the provider's billing total.
export function budgetPolicy(usage = {}) {
  const ratio = Math.max((usage.commands || 0) / 500000, (usage.bytes || 0) / 10000000000);
  return { level: ratio >= .9 ? 90 : ratio >= .7 ? 70 : 0,
    debounceMs: ratio >= .9 ? 300000 : ratio >= .7 ? 60000 : 2000,
    retryAfter: ratio >= .9 ? 300 : 60, measuredCommands: usage.commands || 0,
    measuredBytes: usage.bytes || 0, scope: 'application-measured-lower-bound' };
}
export function createMeter(send, { now = Date.now, warn = console.warn } = {}) {
  let commands = 0, bytes = 0, lastFlush = 0, currentMonth = '', usage = {}, busy;
  const month = () => new Date(now()).toISOString().slice(0, 7);
  const reset = () => { if (currentMonth !== month()) {
    currentMonth = month(); commands = 0; bytes = 0; usage = {}; lastFlush = 0;
  } };
  const redis = async command => {
    reset();
    const result = await send(command);
    commands++; bytes += Buffer.byteLength(JSON.stringify(command));
    bytes += Buffer.byteLength(JSON.stringify(result) || ''); return result;
  };
  redis.policy = () => { reset(); return budgetPolicy(usage); };
  redis.flush = async (force = false) => {
    reset();
    if (busy) return busy;
    if (!commands || !force && now() - lastFlush < 300000) return;
    const count = commands + 1, transferred = bytes; commands = 0; bytes = 0;
    const key = 'kov:registry:usage:' + currentMonth;
    busy = (async () => {
      try {
        const totals = await send(['EVAL', "local c=redis.call('HINCRBY',KEYS[1],'commands',ARGV[1]);local b=redis.call('HINCRBY',KEYS[1],'bytes',ARGV[2]);redis.call('EXPIRE',KEYS[1],6048000);return {c,b}", 1, key, count, transferred]);
        const previous = budgetPolicy(usage).level;
        usage = { commands: Number(totals[0]), bytes: Number(totals[1]) }; lastFlush = now();
        const next = budgetPolicy(usage);
        if (next.level > previous) warn('KOV_REGISTRY_BUDGET ' + JSON.stringify(next));
        return next;
      } catch (error) { commands += count - 1; bytes += transferred; throw error; }
    })();
    try { return await busy; } finally { busy = null; }
  };
  return redis;
}
