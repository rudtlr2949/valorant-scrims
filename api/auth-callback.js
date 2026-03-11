export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || 'your_client_secret';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://your-vercel-app.vercel.app/api/auth-callback';

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        scope: 'identify guilds.members.read connections'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(400).send('Failed to get access token');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>로그인 성공</title>
      </head>
      <body>
        <script>
          window.opener.postMessage({
            type: 'DISCORD_LOGIN_SUCCESS',
            user: ${JSON.stringify(userData)},
            token: '${tokenData.access_token}'
          }, '*');
          window.close();
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
}
