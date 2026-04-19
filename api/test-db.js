export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(200).json({
      success: false,
      error: '환경변수 없음',
      url: !!url,
      token: !!token
    });
  }

  try {
    // 테스트 데이터 저장
    const setRes = await fetch(`${url}/set/test/hello`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const setData = await setRes.json();

    // 테스트 데이터 조회
    const getRes = await fetch(`${url}/get/test`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const getData = await getRes.json();

    return res.status(200).json({
      success: true,
      message: '✅ Upstash 연결 성공!',
      set: setData,
      get: getData
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}
