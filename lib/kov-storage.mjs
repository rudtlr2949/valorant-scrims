import { RuleError } from './kov-core.mjs';

export function storageFailure(status, body = '') {
  const limited = /limit|quota|suspend/i.test(body);
  const code = limited && /bandwidth/i.test(body) ? 'STORAGE_BANDWIDTH_LIMIT'
    : limited || status === 429 ? 'STORAGE_USAGE_LIMIT'
    : status === 401 || status === 403 ? 'STORAGE_AUTH_FAILED' : 'STORAGE_UNAVAILABLE';
  const message = code === 'STORAGE_BANDWIDTH_LIMIT'
    ? '대회 저장소의 월 전송량 한도를 초과해 Upstash가 일시 중지했습니다. 기존 데이터를 유지하며, 제한 해제 전에는 대회 조회·저장을 사용할 수 없습니다.'
    : code === 'STORAGE_USAGE_LIMIT'
    ? 'Upstash 사용량 한도로 대회 저장소가 일시 중지됐습니다. 기존 데이터를 유지하며 제한 해제를 기다리고 있습니다.'
    : code === 'STORAGE_AUTH_FAILED'
    ? '대회 저장소 인증에 실패했습니다. 운영진의 Upstash 연결 설정 확인이 필요합니다.'
    : '대회 저장소 Upstash에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  const error = new RuleError(message, 503); error.code = code;
  return error;
}

export function createTournamentRedis({ fetcher = (...args) => fetch(...args), now = Date.now,
  config = () => ({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }) } = {}) {
  let retryAt = 0, failure, configuration;
  return async command => {
    const { url, token } = config();
    if (!url || !token) throw new RuleError('대회 저장소가 연결되지 않았습니다. Upstash 환경변수를 확인해 주세요.', 503);
    const signature = url + token;
    if (configuration !== signature) { retryAt = 0; failure = null; configuration = signature; }
    if (now() < retryAt) throw failure;
    let response;
    try {
      response = await fetcher(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command), signal: AbortSignal.timeout(10000) });
    } catch { throw storageFailure(0); }
    const body = await response.text();
    let data; try { data = JSON.parse(body); } catch { throw storageFailure(response.status); }
    if (!response.ok || data.error) {
      const error = storageFailure(response.status, String(data.error || body));
      if (/LIMIT/.test(error.code)) { failure = error; retryAt = now() + 300000; }
      throw error;
    }
    return data.result;
  };
}
