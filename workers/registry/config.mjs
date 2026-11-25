import { createHash } from 'node:crypto';
export const guildId = '683829152276938814';
export const channelId = '701290347161976883';
export const gatewayIntents = 1 | 512 | 1024 | 32768;
export const registryNamespace = token => `kov:registry:live:${channelId}:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
export function reactionDecision(emoji) {
  if (emoji?.id) return emoji.id === '1077983354001035294' ? 'approved'
    : emoji.id === '1077983516144435360' ? 'rejected' : null;
  const name = (emoji?.name || '').normalize('NFKC').replace(/\uFE0F/g, '').toLowerCase();
  if (['c_check', '✅', '☑', '✔', '⭕', 'o', '🅾', '🇴'].includes(name)) return 'approved';
  if (['c_crossred', '❌', '❎', '✖', '×', 'x', '🇽'].includes(name)) return 'rejected';
  return null;
}
export function registryMessageIds(type, data) {
  if (data.channel_id !== channelId) return [];
  if (type === 'MESSAGE_DELETE_BULK') return (data.ids || []).filter(id => /^\d+$/.test(id));
  if (!['MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE', 'MESSAGE_REACTION_ADD',
    'MESSAGE_REACTION_REMOVE', 'MESSAGE_REACTION_REMOVE_ALL', 'MESSAGE_REACTION_REMOVE_EMOJI'].includes(type)) return [];
  const id = data.message_id || data.id;
  return /^\d+$/.test(id || '') ? [id] : [];
}
