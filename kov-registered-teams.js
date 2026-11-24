let cachedLookup;

function lookupTeams() {
  if (cachedLookup && Date.now() < cachedLookup.expiresAt) return cachedLookup.request;
  const request = fetch('/api/kov-registered-teams').then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  });
  const entry = { request, expiresAt: Date.now() + 60_000 };
  cachedLookup = entry;
  request.then(data => {
    entry.expiresAt = Date.now() + (data.syncing ? data.retryAfter * 1000 : 60_000);
  }, () => { if (cachedLookup === entry) cachedLookup = null; });
  return request;
}

function renderTeam(team) {
  const card = document.createElement('article');
  card.className = 'kp-panel kov-registry-card';
  const name = document.createElement('h3');
  name.textContent = team.name;
  const captain = document.createElement('p');
  captain.textContent = `${team.kind === '클랜' ? '클랜장' : '팀장'} · ${team.captain}`;
  const members = document.createElement('p');
  members.textContent = `${team.kind === '클랜' ? '클랜원' : '팀원'} · ${team.members.join(', ')}`;
  const source = document.createElement('a');
  source.className = 'kp-button small';
  source.href = team.url;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.textContent = 'Discord 등록글 ↗';
  card.append(name, captain, members, source);
  return card;
}

class RegisteredTeams extends HTMLElement {
  disconnectedCallback() {
    clearTimeout(this.refreshTimer);
  }

  async connectedCallback() {
    clearTimeout(this.refreshTimer);
    const status = document.createElement('p');
    status.className = 'kp-note';
    status.setAttribute('role', 'status');
    status.textContent = 'Discord 등록 팀을 불러오는 중입니다…';
    this.replaceChildren(status);
    try {
      const data = await lookupTeams();
      const teams = data.teams;
      if (!this.isConnected) return;
      const list = document.createElement('div');
      list.className = 'kp-grid three kp-section';
      list.append(...teams.map(renderTeam));
      status.textContent = data.syncing
        ? `Discord 목록 동기화 중 · 현재 신청 ${teams.length}건`
        : teams.length
        ? `신청 ${teams.length}건 · 승인 여부 미확인`
        : '인식된 정식 등록 신청이 없습니다.';
      this.append(list);
      if (data.syncing) {
        this.refreshTimer = setTimeout(() => {
          if (this.isConnected) void this.connectedCallback();
        }, Math.max(2, data.retryAfter) * 1000);
      }
    } catch (error) {
      status.textContent = error.message || '등록 목록을 불러오지 못했습니다.';
    }
  }
}
customElements.define('kov-registered-teams', RegisteredTeams);
