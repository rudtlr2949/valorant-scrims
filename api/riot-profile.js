// /api/riot-profile.js
// Riot 플레이어 카드 이미지 조회 (Henrik API 프록시)
// 사용법: /api/riot-profile?name=닉네임&tag=태그

export default async function handler(req, res) {
  const { name, tag } = req.query;
  if (!name || !tag) return res.status(400).json({ error: 'name and tag required' });

  const apiKey = process.env.HENRIK_API_KEY;

  try {
    const r = await fetch(
      `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      { headers: apiKey ? { Authorization: apiKey } : {} }
    );
    if (!r.ok) throw new Error('Henrik API ' + r.status);
    const json = await r.json();
    const data = json.data;

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      name:       data.name,
      tag:        data.tag,
      cardSmall:  data.card?.small  || '',
      cardLarge:  data.card?.large  || '',
      level:      data.account_level || 0,
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
