import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { registryRedis, readChannel } from './core.mjs';
import { guildId, channelId, registryMessageIds } from './config.mjs';
import { RegistryGateway } from './gateway.mjs';
import { DiscordRegistryClient, RegistryLiveStore } from './live.mjs';
import { parseRegistryEvent } from './events.mjs';

const token = process.env.KOV_REGISTRY_BOT_TOKEN?.trim();
if (!token || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('KOV registry requires bot token and Redis environment variables');
}
const store = new RegistryLiveStore(token, registryRedis);
const discord = new DiscordRegistryClient(token);
const owner = randomUUID();
const leaseKey = store.prefix + ':worker';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let stopping = false, wake, gateway, lastProgress = Date.now(), lastError = null;
let auditRequested = true, inFlight = Promise.resolve();
const notify = () => { wake?.(); wake = null; };
const server = createServer((request, response) => {
  response.statusCode = request.url === '/health' && !stopping && !gateway?.stopped && Date.now() - lastProgress < 180000 ? 200 : 503;
  response.end(response.statusCode === 200 ? 'ok' : 'unavailable');
}).listen(1234, '0.0.0.0');

async function checkpoint() {
  const renewed = await registryRedis(['EVAL',
    "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],90) end;return 0", 1, leaseKey, owner]);
  if (!renewed) throw new Error('Registry worker lease lost');
  await registryRedis(['SET', store.prefix + ':status', JSON.stringify({ connected: Boolean(gateway?.connected && !lastError),
    at: Date.now(), error: lastError }), 'EX', 90]);
  if (gateway?.session) await registryRedis(['SET', store.prefix + ':session', JSON.stringify(gateway.session), 'EX', 86400]);
  lastProgress = Date.now();
}

async function catchUp() {
  // Resume handles normal reconnects. A fresh session additionally audits known
  // approvals and recent applications, including the active 30-day temporary window.
  await store.enqueue(await store.allEventIds(), false);
  const cutoff = Date.now() - 31 * 86400000;
  const historyKey = store.prefix + ':forms-history-enqueued:v3';
  const fullHistory = !await registryRedis(['EXISTS', historyKey]);
  const known = new Set(await store.allEventIds());
  let before;
  do {
    const messages = await discord.recentMessages(before);
    if (!messages.length) break;
    const candidates = messages.filter(message => parseRegistryEvent(message) && (!fullHistory || !known.has(message.id)));
    // Previously missed forms must not sit behind the entire known-message audit.
    await store.enqueue(candidates.map(message => message.id), fullHistory);
    if (candidates.length) notify();
    before = messages.at(-1).id;
    const oldest = Date.parse(messages.at(-1).timestamp);
    if (messages.length < 100 || (!fullHistory && oldest < cutoff)) break;
  } while (!stopping);
  if (fullHistory && !stopping) await registryRedis(['SET', historyKey, '1']);
  notify();
}

async function shutdown() {
  if (stopping) return;
  stopping = true; notify(); clearInterval(heartbeatTimer); clearInterval(probeTimer);
  await gateway?.stop();
  await Promise.race([inFlight, sleep(20000)]);
  if (gateway?.session) await registryRedis(['SET', store.prefix + ':session', JSON.stringify(gateway.session), 'EX', 86400]).catch(() => {});
  await registryRedis(['SET', store.prefix + ':status', JSON.stringify({ connected: false, at: Date.now() }), 'EX', 90]).catch(() => {});
  await registryRedis(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0", 1, leaseKey, owner]).catch(() => {});
  server.close();
}
let heartbeatTimer, probeTimer;
process.on('SIGTERM', () => { shutdown().then(() => process.exit(0)); });
process.on('SIGINT', () => { shutdown().then(() => process.exit(0)); });

async function main() {
  while (!await registryRedis(['SET', leaseKey, owner, 'NX', 'EX', 90])) {
    if (stopping) return;
    lastProgress = Date.now(); await sleep(5000);
  }
  const session = JSON.parse(await registryRedis(['GET', store.prefix + ':session']) || 'null');
  gateway = new RegistryGateway(token, { session,
    onError: error => { lastError = error.message; console.error('KOV registry gateway:', error.message); },
    onConnection: connected => { if (connected) lastError = null; console.info('KOV registry gateway:', connected ? 'connected' : 'reconnecting'); },
    onDispatch: async (type, data) => {
      const ids = registryMessageIds(type, data);
      if (ids.length && type.startsWith('MESSAGE_REACTION_') && data.user_id) discord.memberCache.delete(data.user_id);
      if (ids.length) { await store.enqueue(ids); notify(); }
      if (type === 'READY') { auditRequested = true; notify(); }
      if (type === 'GUILD_DELETE' && data.id === guildId) lastError = 'KOV Discord server unavailable';
      if (type === 'GUILD_CREATE' && data.id === guildId) { discord.invalidateRoles(); lastError = null; auditRequested = true; notify(); }
      if (type.startsWith('GUILD_ROLE_') && data.guild_id === guildId) {
        discord.invalidateRoles(); auditRequested = true; notify();
      }
    },
  });
  // Check the session-start quota before opening a fresh Gateway session.
  const gatewayInfo = await discord.request('/gateway/bot');
  if (!session && gatewayInfo.session_start_limit.remaining === 0) await sleep(gatewayInfo.session_start_limit.reset_after);
  gateway.connect(session?.url || gatewayInfo.url);
  let heartbeatBusy = false;
  heartbeatTimer = setInterval(() => {
    if (heartbeatBusy || stopping) return;
    heartbeatBusy = true;
    checkpoint().catch(error => { console.error(error.message); shutdown().then(() => process.exit(1)); })
      .finally(() => { heartbeatBusy = false; });
  }, 30000);
  await checkpoint();
  probeTimer = setInterval(() => {
    if (stopping) return;
    discord.request(`/channels/${channelId}/messages?limit=1`).then(() => { lastError = null; })
      .catch(error => { lastError = error.message; console.error('KOV registry channel access:', error.message); });
  }, 300000);
  while (!await store.initialize()) {
    if (stopping) return;
    const result = await readChannel(token, registryRedis);
    await sleep(Math.max(250, result.retryAfter * 1000));
  }
  await store.recover();
  // Catch-up runs separately so newly approved messages always take priority.
  let auditRunning = false;
  const audit = () => {
    if (auditRunning || stopping) return;
    auditRunning = true; auditRequested = false;
    catchUp().catch(error => console.error('KOV registry catch-up:', error.message)).finally(() => { auditRunning = false; notify(); });
  };
  audit();
  while (!stopping) {
    if (auditRequested && !auditRunning) audit();
    const id = await store.next();
    if (!id) {
      await new Promise(resolve => { wake = resolve; const timer = setTimeout(() => { if (wake === resolve) wake = null; resolve(); }, 30000); timer.unref(); });
      continue;
    }
    inFlight = (async () => { try {
      const event = await discord.inspectMessage(id);
      if (stopping) return; // Keep the job in processing; the new owner recovers it.
      const changed = await store.mutate(id, event);
      await store.acknowledge(id); lastError = null;
      if (changed) console.info('KOV registry applied:', event?.type || 'approval removed', 'active:', changed.teams.length);
    } catch (error) {
      lastError = error.message; console.error('KOV registry retry:', error.message);
      await store.enqueue([id], false); await store.acknowledge(id); await sleep(5000);
    } })();
    await inFlight;
    lastProgress = Date.now();
  }
}
main().catch(error => { console.error('KOV registry worker:', error.message); shutdown().then(() => process.exit(1)); });
