export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code) return res.status(400).send('No code provided');

  const clientId = process.env.DISCORD_CLIENT_ID || '1473139231848267896';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://valorant-scrims.vercel.app/api/auth-callback';
  const henrikApiKey = process.env.HENRIK_API_KEY;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    // 1. 토큰 교환
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).send('토큰 발급 실패: ' + JSON.stringify(tokenData));
    }

    // 2. 유저 정보 조회
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

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
      teamId: null,
      noShow: 0
    };

    // 3. 티어 인증 요청인 경우 (state=tierverify)
    let riotData = null;

    if (state === 'tierverify') {
      try {
        // connections API 서버에서 호출
        const connRes = await fetch('https://discord.com/api/users/@me/connections', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });

        if (connRes.ok) {
          const connections = await connRes.json();
          const riotConn = connections.find(c => c.type === 'riotgames');

          if (riotConn) {
            const [riotName, riotTag] = riotConn.name.split('#');

            if (riotName && riotTag) {
              // PUUID 조회
              const accountRes = await fetch(
                `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(riotName)}/${encodeURIComponent(riotTag)}`,
                { headers: { Authorization: henrikApiKey } }
              );

              if (accountRes.ok) {
                const accountData = await accountRes.json();
                const puuid = accountData.data?.puuid;

                if (puuid) {
                  // MMR 조회
                  const regions = ['kr', 'ap', 'na', 'eu'];
                  for (const region of regions) {
                    const mmrRes = await fetch(
                      `https://api.henrikdev.xyz/valorant/v2/by-puuid/mmr/${region}/${puuid}`,
                      { headers: { Authorization: henrikApiKey } }
                    );

                    if (mmrRes.ok) {
                      const mmrData = await mmrRes.json();
                      const currentData = mmrData.data?.current_data;

                      if (currentData && currentData.currenttier > 0) {
                        riotData = {
                          name: riotName,
                          tag: riotTag,
                          tier: currentData.currenttierpatched,
                          rr: currentData.ranking_in_tier || 0,
                          puuid,
                          region: region.toUpperCase()
                        };

                        // DB 저장
                        if (upstashUrl && upstashToken) {
                          await fetch(
                            `${upstashUrl}/set/${encodeURIComponent(`riot:${userData.id}`)}/${encodeURIComponent(JSON.stringify({ success: true, ...riotData }))}`,
                            { headers: { Authorization: `Bearer ${upstashToken}` } }
                          );
                        }
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('티어 인증 에러:', e);
      }
    }

    // 4. 클라이언트로 전달
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>로그인 중...</title></head>
      <body>
        <script>
          const user = ${JSON.stringify(user)};
          const token = '${tokenData.access_token}';
          const riotData = ${JSON.stringify(riotData)};

          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'DISCORD_LOGIN_SUCCESS', user, token, riotData }, '*');
            window.close();
          } else {
            localStorage.setItem('discordToken', token);
            localStorage.setItem('currentUser', JSON.stringify(user));
            if (riotData) {
              localStorage.setItem('pendingRiotData', JSON.stringify(riotData));
            }
            window.location.href = '/';
          }
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send('인증 실패: ' + error.message);
  }
}
