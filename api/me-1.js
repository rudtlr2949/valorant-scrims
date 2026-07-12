// /api/me.js
// Discord 토큰으로 유저 정보 조회 + Upstash에서 Riot 데이터 조회
// 사용법: /api/me?token=DISCORD_ACCESS_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'no token' });

  try {
    // 1) Discord 유저 정보 조회
    const discordRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!discordRes.ok) return res.status(401).json({ error: 'invalid token' });
    const discord = await discordRes.json();

    const avatarUrl = discord.avatar
      ? `https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}${discord.avatar.startsWith('a_') ? '.gif' : '.png'}?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discord.discriminator || 0) % 5}.png`;

    // 2) Upstash에서 Riot 데이터 조회
    let riotData = null;
    const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (upstashUrl && upstashToken) {
      try {
        const dbRes = await fetch(
          `${upstashUrl}/get/${encodeURIComponent(`riot:${discord.id}`)}`,
          { headers: { Authorization: `Bearer ${upstashToken}` } }
        );
        if (dbRes.ok) {
          const dbJson = await dbRes.json();
          if (dbJson.result) riotData = JSON.parse(dbJson.result);
        }
      } catch (e) {}
    }

    // 3) Riot 데이터 있으면 플레이어 카드도 가져오기
    let cardUrl = '';
    if (riotData?.name && riotData?.tag) {
      try {
        const henrikKey = process.env.HENRIK_API_KEY;
        const accountRes = await fetch(
          `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(riotData.name)}/${encodeURIComponent(riotData.tag)}`,
          { headers: henrikKey ? { Authorization: henrikKey } : {} }
        );
        if (accountRes.ok) {
          const accountJson = await accountRes.json();
          cardUrl = accountJson.data?.card?.small || '';
        }
      } catch (e) {}
    }

    return res.status(200).json({
      // Discord
      discordId:       discord.id,
      discordName:     discord.username,
      discordAvatar:   avatarUrl,
      // Riot (있을 경우)
      riotName:        riotData?.name  || null,
      riotTag:         riotData?.tag   || null,
      riotTier:        riotData?.tier  || null,
      riotRR:          riotData?.rr    || null,
      riotCard:        cardUrl         || null,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
