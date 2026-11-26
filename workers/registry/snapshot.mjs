import { get, put } from '@vercel/blob';

const path = 'kov-directory/public-v1.json';
let savedFingerprint, lastWrite = 0;
// Only projections intended for visitors are backed up; never Discord message bodies.
export function publicSnapshot(data) {
  const fields = ['teams', 'temporaryTeams', 'premierTeams', 'reviewChanges', 'unmatchedChanges',
    'directorySource', 'premierDirectorySource', 'premierLatestAct', 'managedThreadCount',
    'closedManagedTeams', 'updatedAt', 'approvalVerified'];
  return Object.fromEntries(fields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
}
export async function saveSnapshot(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN || data.directorySource !== 'admin-management') return;
  if (Date.now() - lastWrite < 3600000) return;
  const snapshot = publicSnapshot(data);
  const fingerprint = JSON.stringify({ ...snapshot, updatedAt: undefined });
  if (fingerprint === savedFingerprint) return;
  await put(path, JSON.stringify(snapshot), { access: 'public', addRandomSuffix: false,
    allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
  savedFingerprint = fingerprint; lastWrite = Date.now();
}
export async function loadSnapshot() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const result = await get(path, { access: 'public', useCache: true });
  if (result?.statusCode !== 200) return null;
  const data = await new Response(result.stream).json();
  if (!Array.isArray(data.teams) || data.directorySource !== 'admin-management') return null;
  return { ...data, syncing: false, stale: true, liveConnected: false,
    snapshotAt: data.updatedAt, retryAfter: 300, fallbackSource: 'public-backup' };
}

export function createDirectoryCache({ read, fallback = async () => null, now = Date.now }) {
  let cached, expires = 0, pending;
  const visible = data => ({ ...structuredClone(data),
    temporaryTeams: (data.temporaryTeams || []).filter(team => team.expiresAt > now()) });
  return async () => {
    if (cached && now() < expires) return visible(cached);
    if (pending) return visible(await pending);
    pending = (async () => {
      try {
        const data = await read();
        if (!data) throw new Error('Directory not initialized');
        cached = { ...data, stale: false }; expires = now() + Math.max(60, data.retryAfter || 60) * 1000;
      } catch (error) {
        const previous = cached || await fallback().catch(() => null);
        if (!previous) throw error;
        cached = { ...previous, stale: true, liveConnected: false, retryAfter: 300,
          snapshotAt: previous.snapshotAt || previous.updatedAt };
        expires = now() + 300000;
      }
      return cached;
    })();
    try { return visible(await pending); } finally { pending = null; }
  };
}
