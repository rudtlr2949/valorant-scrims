const page = document.querySelector('#page-findteam');
const status = document.querySelector('#kov-registered-status');
const list = document.querySelector('#kov-registered-list');
let loading = false;

function renderTeam(team) {
  const card = document.createElement('article');
  card.className = 'team-card';
  const name = document.createElement('h3');
  name.className = 'team-card-name';
  name.textContent = team.name;
  const captain = document.createElement('p');
  captain.textContent = `${team.kind === '클랜' ? '클랜장' : '팀장'} · ${team.captain}`;
  const members = document.createElement('p');
  members.textContent = `${team.kind === '클랜' ? '클랜원' : '팀원'} · ${team.members.join(', ')}`;
  const source = document.createElement('a');
  source.href = team.url;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.textContent = 'Discord 등록글 ↗';
  card.append(name, captain, members, source);
  return card;
}

async function loadTeams() {
  if (!page.classList.contains('active') || loading) return;
  loading = true;
  status.textContent = 'Discord 등록 팀을 불러오는 중입니다…';
  try {
    const response = await fetch('/api/kov-registered-teams');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    list.replaceChildren(...data.teams.map(renderTeam));
    status.textContent = data.teams.length
      ? `신청 ${data.teams.length}건 · 승인 여부 미확인`
      : '인식된 정식 등록 신청이 없습니다.';
  } catch (error) {
    status.textContent = error.message || '등록 목록을 불러오지 못했습니다.';
  } finally {
    loading = false;
  }
}

const observer = new MutationObserver(records => {
  if (records.some(record => !record.oldValue?.split(/\s+/).includes('active'))) void loadTeams();
});
observer.observe(page, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
void loadTeams();
