import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { registryRedis } from './core.mjs';
import { registryNamespace, guildId } from './config.mjs';
import { RegistryGateway } from './gateway.mjs';
import { DiscordRegistryClient } from './live.mjs';
import { ManagedRegistry, managedChannels, premierManagementChannel } from './managed.mjs';
import { saveSnapshot } from './snapshot.mjs';
import { directoryProjection, rebuildPublicBackup } from './offline.mjs';

const token = process.env.KOV_REGISTRY_BOT_TOKEN?.trim();
if (!token || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('Registry environment missing');
const prefix = registryNamespace(token), owner = randomUUID(), leaseKey = prefix + ':worker';
const discord = new DiscordRegistryClient(token);
const managed = new ManagedRegistry(discord, registryRedis, prefix);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let stopping = false, gateway, heartbeatTimer, heartbeatBusy = false, leaseLost = false;
let fullRequested = true, requestedAt = 0, lastFull = 0, lastError = null, cooldownUntil = 0;
let lastProjection, backupAttemptAt = 0, backupCheckAt = 0;
const server = createServer((request, response) => {
  // Dependency outages use controlled retries, not container restart storms.
  response.statusCode = request.url === '/health' && !stopping ? 200 : 503;
  response.end(response.statusCode === 200 ? 'ok' : 'unavailable');
}).listen(1234, '0.0.0.0');
const requestSync = () => { if (!requestedAt) requestedAt = Date.now(); };
async function checkpoint() {
  const renewed = await registryRedis(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],180) end;return 0", 1, leaseKey, owner]);
  if (!renewed) throw new Error('Registry worker lease lost');
  await registryRedis(['SET', prefix + ':status', JSON.stringify({ connected: Boolean(gateway?.connected && !lastError), at: Date.now() }), 'EX', 180]);
  if (gateway?.session) await registryRedis(['SET', prefix + ':session', JSON.stringify(gateway.session), 'EX', 86400]);
  await registryRedis.flush();
}
async function disconnect() {
  clearInterval(heartbeatTimer); await gateway?.stop(); gateway = null;
  await registryRedis(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0", 1, leaseKey, owner]).catch(() => {});
}
async function shutdown() {
  stopping = true; clearInterval(heartbeatTimer); await disconnect(); server.close();
}
process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT', () => { void shutdown(); });
async function run() {
  if (!await registryRedis(['SET', leaseKey, owner, 'NX', 'EX', 180])) { await sleep(10000); return; }
  leaseLost = false; lastError = null; fullRequested = true; requestSync();
  const session = JSON.parse(await registryRedis(['GET', prefix + ':session']) || 'null');
  gateway = new RegistryGateway(token, { session,
    onError: error => { lastError = error.message; console.error('KOV gateway:', error.message); },
    onConnection: connected => { if (connected) lastError = null; },
    onDispatch: async (type, data) => {
      // Only owner-authorized management sources can alter the directory.
      if (data.channel_id === premierManagementChannel || managed.threadIds.has(data.channel_id)
        || managedChannels.has(data.parent_id) || type === 'THREAD_DELETE' && managed.threadIds.has(data.id)) {
        const id = type.startsWith('THREAD_') ? data.id : data.channel_id;
        managed.invalidate(id, type === 'THREAD_DELETE'); requestSync();
      }
      if (type === 'READY' || type === 'GUILD_CREATE' && data.id === guildId) { fullRequested = true; requestSync(); }
      if (type === 'GUILD_DELETE' && data.id === guildId) lastError = 'KOV server unavailable';
    },
  });
  const info = await discord.request('/gateway/bot');
  if (!session && info.session_start_limit.remaining === 0) {
    cooldownUntil = Date.now() + info.session_start_limit.reset_after; return;
  }
  gateway.connect(session?.url || info.url);
  await checkpoint();
  heartbeatTimer = setInterval(() => {
    if (heartbeatBusy || stopping) return;
    heartbeatBusy = true;
    checkpoint().catch(error => { lastError = error.message; leaseLost = true; })
      .finally(() => { heartbeatBusy = false; });
  }, 60000);
  while (!stopping && !leaseLost) {
    if (Date.now() - lastFull >= 86400000) { fullRequested = true; requestSync(); }
    const policy = registryRedis.policy();
    if (requestedAt && Date.now() - requestedAt >= policy.debounceMs) {
      const full = fullRequested; fullRequested = false; requestedAt = 0;
      try {
        const result = await managed.sync({ full });
        if (full) lastFull = Date.now();
        lastProjection = directoryProjection(result, managed.premier);
        await saveSnapshot(lastProjection);
        lastError = null;
      } catch (error) {
        lastError = error.message; console.error('KOV managed sync:', error.message);
        fullRequested ||= full; requestSync();
        cooldownUntil = Date.now() + 300000;
      }
    }
    if (cooldownUntil > Date.now()) {
      // Keep Gateway heartbeats and the singleton lease alive while reads cool down.
      while (!stopping && !leaseLost && Date.now() < cooldownUntil) await sleep(1000);
    } else {
      if (lastProjection && Date.now() - backupCheckAt >= 60000) {
        backupCheckAt = Date.now();
        await saveSnapshot(lastProjection).catch(error => console.error('KOV backup:', error.message));
      }
      await sleep(500);
    }
  }
  if (leaseLost) throw new Error(lastError || 'Worker lease unavailable');
}
while (!stopping) {
  if (Date.now() < cooldownUntil) { await sleep(1000); continue; }
  try {
    await run();
  } catch (error) {
    console.error('KOV registry worker:', error.message);
    // Preserve visitor access even when Redis refuses all commands. At most one
    // read-only management scan per hour; never retry the public application channel.
    if (/STORAGE_.*LIMIT|cooling down/.test(error.message) && process.env.BLOB_READ_WRITE_TOKEN
      && Date.now() - backupAttemptAt >= 3600000) {
      backupAttemptAt = Date.now();
      try {
        await rebuildPublicBackup(discord);
        console.info('KOV public backup rebuilt from management channels; Redis synchronization pending');
      } catch (backupError) { console.error('KOV backup rebuild:', backupError.message); }
    }
    cooldownUntil = Date.now() + 300000;
  } finally { if (!stopping) await disconnect(); }
}
