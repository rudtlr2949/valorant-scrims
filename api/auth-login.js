export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://your-vercel-app.vercel.app/api/auth-callback';
  
  const scope = 'identify guilds.members.read connections';
  // prompt=consent 제거 - 한 번만 권한 요청하고 이후엔 자동 로그인
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
  
  res.redirect(302, discordAuthUrl);
}
