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
    // KR, AP, NA, EU 순서로 시도
    let mmrData = null;
    let successRegion = null;
    
    const regions = ['kr', 'ap', 'na', 'eu'];
    
    for (const region of regions) {
      const mmrUrl = `https://api.henrikdev.xyz/valorant/v2/by-puuid/mmr/${region}/${puuid}`;
      
      console.log(`📡 Henrik MMR 조회 시도 (${region.toUpperCase()})...`);
      
      const mmrRes = await fetch(mmrUrl, {
        headers: {
          'Authorization': henrikApiKey
        }
      });

      console.log(`📡 Henrik MMR 응답 (${region.toUpperCase()}):`, mmrRes.status);

      if (mmrRes.ok) {
        const data = await mmrRes.json();
        if (data.data && data.data.current_data) {
          mmrData = data;
          successRegion = region;
          console.log(`✅ ${region.toUpperCase()} 서버에서 조회 성공!`);
          break;
        }
      }
    }
    
    if (!mmrData) {
      console.error('❌ 모든 지역에서 MMR 조회 실패');
      return res.status(200).json({ 
        success: false,
        error: 'MMR 조회 실패 - 모든 지역 시도'
      });
    }
    
    if (!mmrData.data || !mmrData.data.current_data) {
      console.error('❌ MMR 데이터 없음:', mmrData);
      return res.status(200).json({ 
        success: false,
        error: 'MMR 데이터를 찾을 수 없습니다'
      });
    }

    const currentData = mmrData.data.current_data;
    const tierName = currentData.currenttierpatched || 'Unranked';
    const rr = currentData.ranking_in_tier || 0;
    const currentTier = currentData.currenttier || 0;
    
    console.log('✅ 조회 성공 - 티어:', tierName, '/ RR:', rr, '/ Tier#:', currentTier);

    // 3. Unranked 체크 (currenttier = 0)
    if (currentTier === 0 || tierName === 'Unranked') {
      return res.status(200).json({ 
        success: false, 
        error: '랭크 게임 기록이 없습니다. 최소 1회 이상 랭크 게임을 플레이해주세요.',
        tier: 'Unranked',
        rr: 0
      });
    }

    // 4. 인증 성공! (모든 랭크 티어 허용)
    return res.status(200).json({ 
      success: true, 
      tier: tierName, 
      rr: rr,
      riotName: `${name}#${tag}`,
      region: successRegion.toUpperCase()
    });

  } catch (error) {
    console.error('❌ Auto verify error:', error);
    return res.status(200).json({ 
      success: false, 
      error: error.message || '티어 조회 실패'
    });
  }
}
