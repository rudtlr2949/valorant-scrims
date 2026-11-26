import { registryRedis, readCachedDirectory } from '../workers/registry/core.mjs';
import { DiscordRegistryClient } from '../workers/registry/live.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=3600');
  try {
    const token = process.env.KOV_REGISTRY_BOT_TOKEN?.trim();
    if (!token) return res.status(503).json({ error: 'Unavailable' });
    const data = await readCachedDirectory();
    const team = [...(data?.teams || []), ...(data?.temporaryTeams || []), ...(data?.premierTeams || [])]
      .find(team => team.url === req.query.source);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const client = new DiscordRegistryClient(token);
    const people = [];
    for (const person of team.discordRoster || []) {
      let tag = null;
      if (/^\d+$/.test(person.id || '')) {
        const key = 'kov:discord:public-tag:' + person.id;
        tag = await registryRedis(['GET', key]).catch(() => null);
        if (!tag) {
          const user = await client.request('/users/' + person.id, true).catch(() => null);
          if (user?.username) {
            tag = user.discriminator && user.discriminator !== '0' ? `${user.username}#${user.discriminator}` : '@' + user.username;
            await registryRedis(['SET', key, tag, 'EX', 86400]).catch(() => {});
          }
        }
      }
      people.push({ name: person.name, role: person.role, ...(person.id ? { id: person.id } : {}), tag });
    }
    await registryRedis.flush().catch(() => {});
    return res.status(200).json({ people, stale: Boolean(data.stale) });
  } catch { return res.status(503).json({ error: 'Discord temporarily unavailable' }); }
}
