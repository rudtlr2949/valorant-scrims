export default async function handler(req, res) {
  const { name, tag, discordId, cacheOnly } = req.query;
  const henrikApiKey = process.env.HENRIK_API_KEY;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!name || !tag) {
    return res.status(400).json({ success: false, error: '이름과 태그가 필요합니다' });
  }

  // ===== Redis 헬퍼 =====
  async function redisGet(key) {
    try {
      const r = await fetch(`${upstashUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${upstashToken}` }
      });
      const d = await r.json();
      return d.result ? JSON.parse(d.result) : null;
    } catch { return null; }
  }

  async function redisSet(key, value) {
    try {
      await fetch(`${upstashUrl}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, {
        headers: { Authorization: `Bearer ${upstashToken}` }
      });
    } catch (e) { console.error('Redis 저장 실패:', e); }
  }

  try {
    // 1. DB 캐시 확인 (discordId 있을 때)
    if (discordId && upstashUrl && upstashToken) {
      const cached = await redisGet(`riot:${discordId}`);
      if (cached) {
        console.log('✅ DB 캐시 반환:', cached.name);
        return res.status(200).json({ ...cached, fromCache: true });
      }
    }

    // cacheOnly 모드면 여기서 종료
    if (cacheOnly === 'true') {
      return res.status(200).json({ success: false, fromCache: false });
    }

    // 2. 계정 조회 (PUUID)
    const accountRes = await fetch(
      `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      { headers: { Authorization: henrikApiKey } }
    );

    if (!accountRes.ok) {
      return res.status(200).json({ success: false, error: '계정을 찾을 수 없습니다' });
    }

    const accountData = await accountRes.json();
    const puuid = accountData.data?.puuid;

    if (!puuid) {
      return res.status(200).json({ success: false, error: 'PUUID를 찾을 수 없습니다' });
    }

    // 3. MMR 조회 (지역 순서대로 시도)
    const regions = ['kr', 'ap', 'na', 'eu'];
    let mmrData = null;
    let successRegion = null;

    for (const region of regions) {
      const mmrRes = await fetch(
        `https://api.henrikdev.xyz/valorant/v2/by-puuid/mmr/${region}/${puuid}`,
        { headers: { Authorization: henrikApiKey } }
      );

      if (mmrRes.ok) {
        const data = await mmrRes.json();
        if (data.data?.current_data) {
          mmrData = data;
          successRegion = region;
          break;
        }
      }
    }

    if (!mmrData) {
      return res.status(200).json({ success: false, error: '티어 정보를 찾을 수 없습니다' });
    }

    const currentData = mmrData.data.current_data;
    const currentTier = currentData.currenttier || 0;

    if (currentTier === 0) {
      return res.status(200).json({ 
        success: false, 
        error: '언랭크 계정입니다. 배치고사를 완료해주세요' 
      });
    }

    const tierName = currentData.currenttierpatched;
    const rr = currentData.ranking_in_tier || 0;

    // 4. DB에 저장
    const riotData = {
      success: true,
      name,
      tag,
      tier: tierName,
      rr,
      puuid,
      region: successRegion.toUpperCase()
    };

    if (discordId && upstashUrl && upstashToken) {
      await redisSet(`riot:${discordId}`, riotData);
      console.log('✅ DB 저장 완료:', discordId);
    }

    return res.status(200).json(riotData);

  } catch (error) {
    console.error('❌ 에러:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
