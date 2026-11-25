const discordEpoch = 1420070400000n;

function postId(item) {
  const match = /\/(\d+)(?:[?#].*)?$/.exec(item.url || '');
  return match ? BigInt(match[1]) : null;
}

export function registryNewestFirst(items) {
  return [...items].sort((a, b) => {
    const left = postId(a), right = postId(b);
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left > right ? -1 : 1;
  });
}

export function registryPostDate(item) {
  const id = postId(item);
  if (id === null) return null;
  const date = new Date(Number((id >> 22n) + discordEpoch));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function registryDateLabel(item) {
  const date = registryPostDate(item);
  return date ? new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date) : '날짜 확인 필요';
}
