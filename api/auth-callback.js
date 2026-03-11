export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || 'your_client_secret';
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://your-vercel-app.vercel.app/api/auth-callback';

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
        redirect_uri: redirectUri,
        scope: 'identify guilds.members.read connections'
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

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>로그인 성공</title>
        <style>
          body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff; }
          .success { text-align: center; }
          .success h1 { color: #4ade80; }
          .success p { color: #aaa; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✅ 로그인 성공!</h1>
          <p>잠시만 기다려주세요...</p>
        </div>
        <script>
          const userData = ${JSON.stringify(userData)};
          const token = '${tokenData.access_token}';
          
          // 팝업 창인 경우
          if (window.opener && !window.opener.closed) {
            console.log('✅ Sending message to opener');
            window.opener.postMessage({
              type: 'DISCORD_LOGIN_SUCCESS',
              user: userData,
              token: token
            }, '*');
            setTimeout(() => window.close(), 500);
          } 
          // 같은 탭에서 열린 경우 (fallback)
          else {
            console.log('⚠️ No opener, using localStorage fallback');
            localStorage.setItem('discordToken', token);
            localStorage.setItem('currentUser', JSON.stringify(userData));
            // 메인 페이지로 리다이렉트
            setTimeout(() => {
              window.location.href = '/';
            }, 1000);
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
