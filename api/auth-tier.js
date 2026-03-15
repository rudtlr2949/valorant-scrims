export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://valorant-scrims.vercel.app/api/auth-callback';
  
  // 티어 인증용: connections 권한 추가
  const scope = 'identify guilds.members.read connections';
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
  
  res.redirect(302, discordAuthUrl);
}
