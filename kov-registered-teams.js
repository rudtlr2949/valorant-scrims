import { registryCategories, registryCategory } from './kov-registry-category.js';

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
  const category = document.createElement('span');
  category.className = 'kp-badge kov-registry-category';
  category.dataset.category = registryCategory(team);
  category.textContent = category.dataset.category;
  const captain = document.createElement('p');
  captain.textContent = `${team.kind === '클랜' ? '클랜장' : '팀장'} · ${team.captain}`;
  const members = document.createElement('p');
  members.textContent = `${team.kind === '클랜' ? '클랜원' : '팀원'} · ${team.members.join(', ')}`;
  const source = document.createElement('a');
  source.className = 'kp-button small';
  source.href = team.url;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.textContent = 'Discord 최신 내역 ↗';
  card.append(category, name, captain, members, source);
  return card;
}

class RegisteredTeams extends HTMLElement {
  selectedCategory = '전체';

  renderList() {
    const teams = this.registryData.teams;
    const filters = document.createElement('div');
    filters.className = 'kp-tabs kov-registry-filters';
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', '등록 유형 필터');
    const list = document.createElement('div');
    list.className = 'kp-grid three kp-section';
    list.id = 'kov-registry-list';
    for (const category of ['전체', ...registryCategories]) {
      const count = category === '전체' ? teams.length : teams.filter(team => registryCategory(team) === category).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${category} (${count})`;
      button.classList.toggle('active', this.selectedCategory === category);
      button.setAttribute('aria-pressed', String(this.selectedCategory === category));
      button.setAttribute('aria-controls', list.id);
      button.addEventListener('click', () => {
        this.selectedCategory = category;
        this.renderList();
        this.querySelector(`button[data-category="${category}"]`)?.focus();
      });
      button.dataset.category = category;
      filters.append(button);
    }
    const visible = teams.filter(team => this.selectedCategory === '전체' || registryCategory(team) === this.selectedCategory);
    list.append(...visible.map(renderTeam));
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'kp-empty';
      empty.textContent = this.registryData.syncing
        ? `${this.selectedCategory} 등록 목록을 확인하고 있습니다.`
        : `${this.selectedCategory} 유형에 관리자 승인이 확인된 등록이 없습니다.`;
      list.append(empty);
    }
    this.querySelector('.kov-registry-results')?.remove();
    const results = document.createElement('section');
    results.className = 'kov-registry-results';
    results.setAttribute('aria-label', '유형별 등록 목록');
    results.append(filters, list);
    if (!this.registryData.syncing && this.registryData.reviewChanges?.length) {
      const review = document.createElement('details');
      review.className = 'kp-panel kp-pad kp-section';
      const summary = document.createElement('summary');
      summary.textContent = `명단 확인이 필요한 변경 ${this.registryData.reviewChanges.length}건`;
      review.append(summary);
      for (const change of this.registryData.reviewChanges) {
        const item = document.createElement('p');
        const link = document.createElement('a');
        link.href = change.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${change.name} · ${change.reason} Discord 내역 ↗`;
        item.append(link); review.append(item);
      }
      results.append(review);
    }
    this.append(results);
  }

  disconnectedCallback() {
    clearTimeout(this.refreshTimer);
  }

  async connectedCallback() {
    clearTimeout(this.refreshTimer);
    const status = this.querySelector('[role="status"]') || document.createElement('p');
    status.className = 'kp-note';
    status.setAttribute('role', 'status');
    if (!status.isConnected) {
      status.textContent = 'Discord 등록 팀을 불러오는 중입니다…';
      this.replaceChildren(status);
    }
    try {
      const data = await lookupTeams();
      const teams = data.teams;
      if (!this.isConnected) return;
      status.textContent = data.syncing
        ? `변경 이력 확인 중 · 승인된 내역 ${data.checkedEvents || 0}건`
        : teams.length
        ? `관리자 O 확인 · 현재 등록 ${teams.length}건 · 명단 변경 ${data.appliedChanges || 0}건 반영`
        : '관리자의 O 반응이 확인된 등록 팀·클랜이 없습니다.';
      if (!data.syncing && data.unmatchedChanges) {
        status.textContent += ` · 팀명·이전 팀장 확인이 필요한 변경 ${data.unmatchedChanges}건`;
      }
      this.registryData = data;
      this.renderList();
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
