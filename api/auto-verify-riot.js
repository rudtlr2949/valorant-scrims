// Henrik API를 사용한 티어 인증
export default async function handler(req, res) {
  const { name, tag } = req.query;
  
  if (!name || !tag) {
    return res.status(200).json({ 
      success: false, 
      error: '계정 정보가 없습니다' 
    });
  }

  const henrikApiKey = process.env.HENRIK_API_KEY;
  
  if (!henrikApiKey) {
    console.error('❌ HENRIK_API_KEY 환경 변수가 설정되지 않았습니다');
    return res.status(200).json({ 
      success: false, 
      error: 'API 키가 설정되지 않았습니다' 
    });
  }

  try {
    console.log('🔍 티어 조회:', name, '#', tag);
    
    // 1. Henrik API로 계정 조회 (PUUID 획득)
    const accountUrl = `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
    
    const accountRes = await fetch(accountUrl, {
      headers: {
        'Authorization': henrikApiKey
      }
    });

    console.log('📡 Henrik 계정 응답:', accountRes.status);

    if (!accountRes.ok) {
      if (accountRes.status === 404) {
        return res.status(200).json({ 
          success: false,
          error: '계정을 찾을 수 없습니다'
        });
      }
      
      const errorText = await accountRes.text();
      console.error('❌ Henrik 계정 조회 에러:', errorText);
      
      return res.status(200).json({ 
        success: false,
        error: `계정 조회 실패 (${accountRes.status})`
      });
    }

    const accountData = await accountRes.json();
    const puuid = accountData.data?.puuid;
    
    if (!puuid) {
      console.error('❌ PUUID 없음:', accountData);
      return res.status(200).json({ 
        success: false,
        error: 'PUUID를 찾을 수 없습니다'
      });
    }

    console.log('✅ PUUID 조회 성공:', puuid);

    // 2. Henrik API로 MMR 조회 (티어 정보)
    const mmrUrl = `https://api.henrikdev.xyz/valorant/v2/by-puuid/mmr/ap/${puuid}`;
    
    const mmrRes = await fetch(mmrUrl, {
      headers: {
        'Authorization': henrikApiKey
      }
    });

    console.log('📡 Henrik MMR 응답:', mmrRes.status);

    if (!mmrRes.ok) {
      if (mmrRes.status === 404) {
        return res.status(200).json({ 
          success: false,
          error: 'Unranked - 랭크 정보가 없습니다'
        });
      }
      
      const errorText = await mmrRes.text();
      console.error('❌ Henrik MMR 조회 에러:', errorText);
      
      return res.status(200).json({ 
        success: false,
        error: `MMR 조회 실패 (${mmrRes.status})`
      });
    }

    const mmrData = await mmrRes.json();
    
    if (!mmrData.data) {
      console.error('❌ MMR 데이터 없음:', mmrData);
      return res.status(200).json({ 
        success: false,
        error: 'MMR 데이터를 찾을 수 없습니다'
      });
    }

    const tierName = mmrData.data.currenttierpatched || 'Unranked';
    const rr = mmrData.data.ranking_in_tier || 0;
    
    console.log('✅ 조회 성공 - 티어:', tierName, '/ RR:', rr);

    // 3. 티어 검증 (다이아 이상만 허용)
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
    
    if (currentTier < 18) {
      return res.status(200).json({ 
        success: false, 
        error: `다이아 이상만 인증 가능합니다 (현재: ${tierName})`,
        tier: tierName,
        rr: rr
      });
    }

    // 4. 인증 성공!
    return res.status(200).json({ 
      success: true, 
      tier: tierName, 
      rr: rr,
      riotName: `${name}#${tag}`
    });

  } catch (error) {
    console.error('❌ Auto verify error:', error);
    return res.status(200).json({ 
      success: false, 
      error: error.message || '티어 조회 실패'
    });
  }
}
