// /api/valo-assets.js
// valorant-api.com 서버사이드 프록시
// 브라우저에서 직접 fetch 시 막히는 문제를 우회
//
// 사용법:
//   /api/valo-assets?type=maps
//   /api/valo-assets?type=agents
//   /api/valo-assets?type=tiers

export default async function handler(req, res) {
  const { type } = req.query;

  const endpoints = {
    maps:   'https://valorant-api.com/v1/maps',
    agents: 'https://valorant-api.com/v1/agents?isPlayableCharacter=true',
    tiers:  'https://valorant-api.com/v1/competitivetiers',
  };

  if (!endpoints[type]) {
    return res.status(400).json({ error: 'type must be maps | agents | tiers' });
  }

  try {
    const upstream = await fetch(endpoints[type]);
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const data = await upstream.json();

    // 24시간 캐시 (Vercel Edge)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
