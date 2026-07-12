export default function handler(req, res) {
  const clientId   = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://valorant-scrims.vercel.app/api/auth-callback';

  // state=tierverify 이면 connections 스코프 추가 (Riot 연동용)
  const state = req.query.state || 'login';
  const scope = state === 'tierverify'
    ? 'identify connections'
    : 'identify';

  const discordAuthUrl =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}` +
    `&prompt=consent`;

  res.redirect(302, discordAuthUrl);
}
