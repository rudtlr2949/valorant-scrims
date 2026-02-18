export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://your-vercel-app.vercel.app/api/auth-callback';
  
  const scope = 'identify guilds.members.read';
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=none`;
  
  res.redirect(302, discordAuthUrl);
}
