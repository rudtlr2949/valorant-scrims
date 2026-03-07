// Discord 계정에 연동된 Riot 계정 조회
export default async function handler(req, res) {
  const { accessToken } = req.query;
  
  if (!accessToken) {
    return res.status(200).json({ 
      success: false, 
      error: '액세스 토큰이 없습니다' 
    });
  }

  try {
    // Discord API: 연결된 계정 목록 조회
    const connectionsRes = await fetch('https://discord.com/api/users/@me/connections', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!connectionsRes.ok) {
      throw new Error('Discord connections 조회 실패');
    }

    const connections = await connectionsRes.json();
    
    // Riot Games 연결 찾기
    const riotConnection = connections.find(conn => conn.type === 'riotgames');
    
    if (!riotConnection) {
      return res.status(200).json({ 
        success: false, 
        error: 'Discord에 Riot 계정이 연동되어 있지 않습니다',
        needManualInput: true 
      });
    }

    // Riot 계정 정보 추출
    const riotName = riotConnection.name;  // "Player#KR1" 형식
    
    // 닉네임과 태그 분리
    const [name, tag] = riotName.split('#');
    
    if (!name || !tag) {
      throw new Error('Riot 계정 형식이 올바르지 않습니다');
    }

    // 이제 기존 verify-riot API 호출
    const riotApiKey = process.env.RIOT_API_KEY;
    
    if (!riotApiKey) {
      throw new Error('Riot API 키가 설정되지 않았습니다');
    }

    // 1. Account API: PUUID 조회
    const accountRes = await fetch(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      { headers: { 'X-Riot-Token': riotApiKey } }
    );

    if (!accountRes.ok) {
      if (accountRes.status === 403) {
        throw new Error('Riot API 키가 만료되었습니다');
      }
      const errorText = await accountRes.text();
      console.error('Account API 에러:', accountRes.status, errorText);
      throw new Error(`Riot 계정 조회 실패 (${accountRes.status})`);
    }

    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // Henrik API v1 (인증 불필요) - 이름/태그로 조회
    const henrikRes = await fetch(
      `https://api.henrikdev.xyz/valorant/v1/mmr/ap/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    );

    if (!henrikRes.ok) {
      const errorText = await henrikRes.text();
      console.error('Henrik API v1 에러:', henrikRes.status, errorText);
      
      if (henrikRes.status === 404) {
        return res.status(200).json({ 
          success: true, 
          tier: 'Unranked', 
          rr: 0,
          riotName: riotName,
          autoVerified: true
        });
      }
      
      throw new Error(`랭크 정보 조회 실패 (${henrikRes.status})`);
    }

    const henrikData = await henrikRes.json();
    
    if (!henrikData.data || !henrikData.data.currenttierpatched) {
      return res.status(200).json({ 
        success: true, 
        tier: 'Unranked', 
        rr: 0,
        riotName: riotName,
        autoVerified: true
      });
    }

    const tierName = henrikData.data.currenttierpatched || 'Unranked';
    const rr = henrikData.data.ranking_in_tier || 0;
    
    // 티어를 숫자로 변환 (다이아 = 18+)
    const TIER_TO_NUM = {
      'Unranked': 0,
      'Iron 1': 3, 'Iron 2': 4, 'Iron 3': 5,
      'Bronze 1': 6, 'Bronze 2': 7, 'Bronze 3': 8,
      'Silver 1': 9, 'Silver 2': 10, 'Silver 3': 11,
      'Gold 1': 12, 'Gold 2': 13, 'Gold 3': 14,
      'Platinum 1': 15, 'Platinum 2': 16, 'Platinum 3': 17,
      'Diamond 1': 18, 'Diamond 2': 19, 'Diamond 3': 20,
      'Ascendant 1': 21, 'Ascendant 2': 22, 'Ascendant 3': 23,
      'Immortal 1': 24, 'Immortal 2': 25, 'Immortal 3': 26,
      'Radiant': 27
    };
    
    const currentTier = TIER_TO_NUM[tierName] || 0;

    // 다이아 이상만 인증
    if (currentTier < 18) {
      return res.status(200).json({ 
        success: false, 
        error: '다이아 이상만 인증 가능합니다',
        tier: tierName,
        rr: rr,
        riotName: riotName
      });
    }

    // 성공!
    return res.status(200).json({ 
      success: true, 
      tier: tierName, 
      rr: rr,
      riotName: riotName,
      autoVerified: true  // 자동 인증 표시
    });

  } catch (error) {
    console.error('Auto verify error:', error);
    return res.status(200).json({ 
      success: false, 
      error: error.message || '자동 인증 실패',
      needManualInput: true  // 수동 입력 폴백
    });
  }
}
