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

export default async function handler(req, res) {
  const { name, tag } = req.query;
  
  if (!name || !tag) {
    return res.status(200).json({ success: false, error: '닉네임과 태그를 입력해주세요' });
  }

  const apiKey = process.env.RIOT_API_KEY;
  
  if (!apiKey) {
    return res.status(200).json({ success: false, error: 'API 키가 설정되지 않았어요' });
  }

  try {
    const accountRes = await fetch(
      `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      { headers: { 'X-Riot-Token': apiKey } }
    );

    if (!accountRes.ok) {
      if (accountRes.status === 404) throw new Error('계정을 찾을 수 없어요');
      if (accountRes.status === 403) throw new Error('API 키가 만료됐어요');
      throw new Error('계정 조회 실패');
    }

    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    const rankedRes = await fetch(
      `https://ap.api.riotgames.com/val/ranked/v1/by-puuid/${puuid}`,
      { headers: { 'X-Riot-Token': apiKey } }
    );

    if (!rankedRes.ok) throw new Error('랭크 조회 실패');

    const rankedData = await rankedRes.json();
    const compRank = rankedData.queueSkills?.find(q => q.queueType === 'competitive');
    
    if (!compRank) {
      return res.status(200).json({ success: true, tier: 'Unranked', rr: 0 });
    }

    const currentTier = compRank.competitiveTier || 0;
    const rr = compRank.rankedRating || 0;
    const tierName = TIER_MAP[currentTier] || 'Unranked';

    if (currentTier < 18) {
      return res.status(200).json({ success: false, error: '다이아 이상만 인증 가능합니다' });
    }

    return res.status(200).json({ success: true, tier: tierName, rr: rr });

  } catch (error) {
    return res.status(200).json({ success: false, error: error.message || '조회 실패' });
  }
}
