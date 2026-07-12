// /api/me.js
// 현재 로그인된 Discord 유저 정보 반환
// auth-callback.js에서 쿠키에 저장한 유저 정보를 읽어서 반환

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 쿠키에서 discord_user 파싱
  const raw = req.headers.cookie || '';
  const match = raw.match(/discord_user=([^;]+)/);

  if (!match) {
    return res.status(401).json({ error: 'not logged in' });
  }

  try {
    const user = JSON.parse(decodeURIComponent(match[1]));
    // avatar URL 생성
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || 0) % 5}.png`;

    return res.status(200).json({
      id:        user.id,
      username:  user.username,
      avatar:    avatarUrl,
    });
  } catch (e) {
    return res.status(400).json({ error: 'invalid session' });
  }
}
