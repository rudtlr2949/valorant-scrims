export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || 'your_client_secret';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://valorant-scrims.vercel.app/api/auth-callback';

  console.log('🔍 OAuth Debug:');
  console.log('  - Client ID:', clientId);
  console.log('  - Client Secret exists:', !!clientSecret && clientSecret !== 'your_client_secret');
  console.log('  - Redirect URI:', redirectUri);
  console.log('  - Code received:', !!code);

  try {
    console.log('📡 Calling Discord token endpoint...');
    
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

    console.log('📡 Discord response status:', tokenResponse.status);
    console.log('📡 Discord response headers:', Object.fromEntries(tokenResponse.headers));
    
    const tokenData = await tokenResponse.json();

    console.log('📊 Token data:', tokenData);

    if (!tokenData.access_token) {
      console.error('❌ Failed to get access token:', tokenData);
      
      // 사용자에게 모든 디버깅 정보 표시
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Discord 로그인 디버깅</title>
          <style>
            body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
            h1 { color: #ff4658; }
            pre { background: #2a2a2a; padding: 15px; border-radius: 8px; overflow-x: auto; }
            button { padding: 10px 20px; background: #5865F2; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h1>❌ Discord OAuth 에러</h1>
          
          <h2>설정 정보:</h2>
          <pre>Client ID: ${clientId}
Client Secret exists: ${!!clientSecret && clientSecret !== 'your_client_secret'}
Redirect URI: ${redirectUri}
Code received: ${!!code}</pre>
          
          <h2>Discord 응답:</h2>
          <pre>${JSON.stringify(tokenData, null, 2)}</pre>
          
          <h2>해결 방법:</h2>
          <pre>${tokenData.error === 'invalid_client' ? 
            '→ Vercel 환경 변수에서 DISCORD_CLIENT_SECRET을 확인하세요\n→ Discord Developer Portal에서 Client Secret을 Reset하고 재설정하세요' :
            tokenData.error === 'redirect_uri_mismatch' ?
            '→ Discord Developer Portal의 Redirect URI를 확인하세요\n→ 정확히 등록: https://valorant-scrims.vercel.app/api/auth-callback' :
            tokenData.error === 'invalid_grant' ?
            '→ Authorization code가 만료되었습니다 (5분 제한)\n→ 다시 로그인을 시도하세요' :
            '→ 위 에러 메시지를 확인하세요'
          }</pre>
          
          <button onclick="window.close()">닫기</button>
          <button onclick="location.href='/'">메인으로</button>
        </body>
        </html>
      `);
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();
    
    // 올바른 형식으로 사용자 데이터 변환
    const user = {
      id: userData.id,
      discordId: userData.id,
      name: userData.username,
      avatar: userData.avatar 
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}${userData.avatar.startsWith('a_') ? '.gif' : '.png'}`
        : null,
      banner_color: userData.banner_color || null,
      public_flags: userData.public_flags || 0,
      premium_type: userData.premium_type || 0,
      avatar_decoration: userData.avatar_decoration || null,
      discordAccessToken: tokenData.access_token,
      hasConnectionsScope: (tokenData.scope || '').includes('connections'),
      teamId: null,
      noShow: 0
    };

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>로그인 중...</title>
      </head>
      <body>
        <script>
          const user = ${JSON.stringify(user)};
          const token = '${tokenData.access_token}';
          
          // 팝업 창인 경우
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({
              type: 'DISCORD_LOGIN_SUCCESS',
              user: user,
              token: token
            }, '*');
            window.close();
          } 
          // 같은 탭에서 열린 경우 (fallback)
          else {
            localStorage.setItem('discordToken', token);
            localStorage.setItem('currentUser', JSON.stringify(user));
            // 즉시 리다이렉트 (메시지 없음)
            window.location.href = '/';
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
}
