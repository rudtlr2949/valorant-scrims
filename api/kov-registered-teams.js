const guildId = '683829152276938814';
const channelId = '701290347161976883';
const fields = {
  name: '팀\\s*(?:이름|명)|클랜\\s*(?:이름|명)|team(?:\\s*name)?|clan(?:\\s*name)?',
  captain: '팀\\s*장(?:\\s*닉네임)?|클랜\\s*장|주장|captain',
  members: '(?:팀원|클랜원|멤버|선수)(?:\\s*(?:명단|닉네임))?|roster|members?',
};

export function parseRegistration(message) {
  const source = [
    message.content,
    ...(message.embeds || []).flatMap(embed => [
      embed.description,
      ...(embed.fields || []).map(field => `${field.name}: ${field.value}`),
    ]),
  ].filter(Boolean).join('\n').replace(/\*\*|__/g, '');
  const labels = Object.values(fields).join('|');
  const entries = [...source.matchAll(new RegExp(
    `^\\s*(?:[-•]\\s*)?(${labels})\\s*[:：]([^\\n]*(?:\\n(?!\\s*(?:[-•]\\s*)?[^\\n:：]{1,30}[:：])[^\\n]*)*)`,
    'gim',
  ))];
  const mentions = new Map((message.mentions || []).map(user => [
    user.id, user.member?.nick || user.global_name || user.username,
  ]));
  const clean = value => value?.replace(/<@!?(\d+)>/g, (_, id) => mentions.get(id) || '')
    .replace(/^`|`$/g, '').trim().slice(0, 80) || '';
  const getField = key => entries.find(entry => new RegExp(`^(?:${fields[key]})$`, 'i').test(entry[1]))?.[2];
  const name = clean(getField('name')?.split('\n')[0]);
  const captain = clean(getField('captain')?.trim().split('\n')[0]);
  const members = [...new Set((getField('members') || '').split(/[,，、\n]/)
    .map(value => clean(value.replace(/^\s*(?:[-•]|\d+[.)])\s*/, ''))).filter(Boolean))];
  if (!name || !captain || !members.length || !/^\d+$/.test(message.id)) return null;
  return { name, captain, members, url: `https://discord.com/channels/${guildId}/${channelId}/${message.id}` };
}

async function readChannel(token) {
  const teams = new Map();
  const signal = AbortSignal.timeout(25000);
  let before;
  let hasMessages = false;
  let hasContent = false;
  for (let page = 0; page < 100; page++) {
    const url = new URL(`https://discord.com/api/v10/channels/${channelId}/messages`);
    url.searchParams.set('limit', '100');
    if (before) url.searchParams.set('before', before);
    const response = await fetch(url, { headers: { Authorization: `Bot ${token}` }, signal });
    if (!response.ok) throw new Error(`Discord HTTP ${response.status}`);
    const messages = await response.json();
    for (const message of messages) {
      hasMessages = true;
      hasContent ||= Boolean(message.content || message.embeds?.length || message.attachments?.length);
      const team = parseRegistration(message);
      if (!team) continue;
      const key = team.name.normalize('NFKC').toLowerCase();
      if (!teams.has(key)) teams.set(key, team);
    }
    if (messages.length < 100) {
      if (hasMessages && !hasContent) throw new Error('Discord message content unavailable');
      return [...teams.values()];
    }
    before = messages.at(-1).id;
  }
  throw new Error('Discord history exceeds scan limit');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }
  const token = process.env.KOV_REGISTRY_BOT_TOKEN?.trim();
  if (!token) return res.status(503).json({ error: 'Discord 등록 채널 연동을 준비 중입니다.' });
  try {
    const teams = await readChannel(token);
    res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=60');
    return res.status(200).json({ teams });
  } catch (error) {
    console.error('KOV registry:', error.message);
    return res.status(502).json({ error: 'Discord 등록 목록을 불러오지 못했습니다.' });
  }
}
