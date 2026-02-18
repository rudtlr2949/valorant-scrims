const KOV_SERVER_ID = '683829152276938814';

const TIER_ROLE_MAP = {
  'Diamond I': 'Diamond I', 'Diamond II': 'Diamond II', 'Diamond III': 'Diamond III',
  'Ascendant I': 'Ascendant I', 'Ascendant II': 'Ascendant II', 'Ascendant III': 'Ascendant III',
  'Immortal I': 'Immortal I', 'Immortal II': 'Immortal II', 'Immortal III': 'Immortal III',
  'Radiant': 'Radiant',
  '다이아 1': 'Diamond I', '다이아 2': 'Diamond II', '다이아 3': 'Diamond III',
  '초월자 1': 'Ascendant I', '초월자 2': 'Ascendant II', '초월자 3': 'Ascendant III',
  '불멸 1': 'Immortal I', '불멸 2': 'Immortal II', '불멸 3': 'Immortal III',
  '레디언트': 'Radiant',
};

export default async function handler(req, res) {
  const { code, error } = req.query;
  
  if (error === 'access_denied') {
    const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
    const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://your-vercel-app.vercel.app/api/auth-callback';
    const scope = 'identify guilds.members.read';
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=consent`;
    return res.redirect(302, discordAuthUrl);
  }
  
  if (!code) {
    return res.redirect(302, '/?error=no_code');
  }
  
  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || '42k9x8Igm7fd3hgX3PVB9j_qmMgKfakM';
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
        redirect_uri: redirectUri
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.redirect(302, '/?error=no_token');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

    let kovTier = null;
    try {
      const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${KOV_SERVER_ID}/member`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        const nick = memberData.nick || '';
        
        if (memberData.roles_names) {
          for (const roleName of memberData.roles_names) {
            if (TIER_ROLE_MAP[roleName]) {
              kovTier = TIER_ROLE_MAP[roleName];
              break;
            }
          }
        }
        
        if (!kovTier) {
          for (const tierName of Object.keys(TIER_ROLE_MAP)) {
            if (nick.includes(tierName)) {
              kovTier = TIER_ROLE_MAP[tierName];
              break;
            }
          }
        }

        userData.kov_role_ids = memberData.roles || [];
        userData.kov_nick = nick;
        userData.kov_member = true;
      }
    } catch (e) {
      userData.kov_member = false;
    }

    const html = `<!DOCTYPE html>
<html>
<head><title>로그인 완료</title></head>
<body>
<script>
  const user = ${JSON.stringify({
    id: userData.id,
    username: userData.username,
    avatar: userData.avatar,
    banner_color: userData.banner_color,
    public_flags: userData.public_flags || 0,
    premium_type: userData.premium_type || 0,
    avatar_decoration: userData.avatar_decoration_data || null,
    kov_member: userData.kov_member || false,
    kov_nick: userData.kov_nick || '',
    kov_role_ids: userData.kov_role_ids || [],
    kov_tier: kovTier,
  })};
  
  localStorage.setItem('discordUser', JSON.stringify(user));
  localStorage.setItem('discordToken', '${tokenData.access_token}');
  window.location.href = '/';
</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    res.redirect(302, '/?error=' + encodeURIComponent(error.message));
  }
}
