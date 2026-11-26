import { ManagedRegistry } from './managed.mjs';
import { saveSnapshot } from './snapshot.mjs';

export function directoryProjection(result, premier) {
  return { ...result, premierTeams: premier?.premierTeams || [],
    premierLatestAct: premier?.latestAct, directorySource: 'admin-management',
    premierDirectorySource: 'admin-management', managedThreadCount: result.threadCount,
    closedManagedTeams: result.closed, unmatchedChanges: result.reviewChanges.length,
    approvalVerified: true };
}
// Redis outages must not make an authoritative read depend on the failed store.
// This collector is read-only in Discord and publishes only a completed projection.
export async function rebuildPublicBackup(discord) {
  const values = new Map();
  const memory = async ([command, key, ...args]) => {
    if (command === 'GET' || command === 'HGETALL') return values.get(key) || null;
    if (command === 'SET') { values.set(key, args[0]); return 'OK'; }
    if (command === 'HSET') { values.set(key, args); return args.length / 2; }
    if (command === 'HDEL') return 0;
    throw new Error('Unsupported backup operation');
  };
  const collector = new ManagedRegistry(discord, memory, 'backup');
  const result = await collector.sync({ full: true });
  const data = directoryProjection(result, collector.premier);
  await saveSnapshot(data);
  return data;
}
