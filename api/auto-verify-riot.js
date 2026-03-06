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
      throw new Error('Riot 계정 조회 실패');
    }

    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // 2. Ranked API: 티어 조회
    const rankedRes = await fetch(
      `https://ap.api.riotgames.com/val/ranked/v1/by-puuid/${puuid}`,{ headers: { 'X-Riot-Token': riotApiKey } }
    );

    if (!rankedRes.ok) {
      throw new Error('랭크 정보 조회 실패');
    }

    const rankedData = await rankedRes.json();
    const compRank = rankedData.queueSkills?.find(q => q.queueType === 'competitive');
    
    if (!compRank) {
      return res.status(200).json({ 
        success: true, 
        tier: 'Unranked', 
        rr: 0,
        riotName: riotName,
        autoVerified: true
      });
    }

    const TIER_MAP = {
      0: 'Unranked',
      3: 'Iron I', 4: 'Iron II', 5: 'Iron III',
      6: 'Bronze I', 7: 'Bronze II', 8: 'Bronze III',
      9: 'Silver I', 10: 'Silver II', 11: 'Silver III',
      12: 'Gold I', 13: 'Gold II', 14: 'Gold III',
      15: 'Platinum I', 16: 'Platinum II', 17: 'Platinum III',
      18: 'Diamond I', 19: 'Diamond II', 20: 'Diamond III',
      21: 'Ascendant I', 22: 'Ascendant II', 23: 'Ascendant III',
      24: 'Immortal I', 25: 'Immortal II', 26: 'Immortal III',
      27: 'Radiant'
    };

    const currentTier = compRank.competitiveTier || 0;
    const rr = compRank.rankedRating || 0;
    const tierName = TIER_MAP[currentTier] || 'Unranked';

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
