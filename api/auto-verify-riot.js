// Tracker.gg를 통한 티어 조회
export default async function handler(req, res) {
  const { name, tag } = req.query;
  
  if (!name || !tag) {
    return res.status(200).json({ 
      success: false, 
      error: '계정 정보가 없습니다' 
    });
  }

  try {
    console.log('🔍 티어 조회:', name, '#', tag);
    
    // Tracker.gg API 호출
    const encodedName = encodeURIComponent(name);
    const encodedTag = encodeURIComponent(tag);
    const trackerUrl = `https://api.tracker.gg/api/v2/valorant/standard/profile/riot/${encodedName}%23${encodedTag}`;
    
    const trackerRes = await fetch(trackerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    console.log('📡 Tracker 응답:', trackerRes.status);

    if (!trackerRes.ok) {
      if (trackerRes.status === 404) {
        return res.status(200).json({ 
          success: false,
          error: 'Unranked - 랭크 게임 기록이 없습니다'
        });
      }
      
      return res.status(200).json({ 
        success: false,
        error: `Tracker API 에러 (${trackerRes.status})`
      });
    }

    const trackerData = await trackerRes.json();
    
    // 경쟁전 데이터 추출
    const compSegment = trackerData.data?.segments?.find(s => 
      s.type === 'playlist' && s.attributes?.playlist === 'competitive'
    );
    
    if (!compSegment || !compSegment.stats?.tier) {
      return res.status(200).json({ 
        success: false,
        error: 'Unranked - 랭크 정보를 찾을 수 없습니다'
      });
    }

    const tierName = compSegment.stats.tier.metadata?.tierName || 'Unranked';
    const rr = compSegment.stats.rankRating?.value || 0;
    
    console.log('✅ 조회 성공:', tierName, rr);

    // 성공!
    return res.status(200).json({ 
      success: true, 
      tier: tierName, 
      rr: rr,
      riotName: `${name}#${tag}`
    });

  } catch (error) {
    console.error('Auto verify error:', error);
    return res.status(200).json({ 
      success: false, 
      error: error.message || '티어 조회 실패'
    });
  }
}
