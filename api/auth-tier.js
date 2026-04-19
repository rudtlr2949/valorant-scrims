export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://valorant-scrims.vercel.app/api/auth-callback';
  
  const scope = 'identify connections';
  // state=tierverify로 티어 인증 요청임을 표시
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=consent&state=tierverify`;
  
  res.redirect(302, discordAuthUrl);
}
