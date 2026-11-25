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
  captain.textContent = `${team.registryType === 'premier' ? '신청인' : team.kind === '클랜' ? '클랜장' : '팀장'} · ${team.captain}`;
  const members = document.createElement('p');
  members.textContent = team.registryType === 'temporary'
    ? `임시 등록 · ${new Date(team.expiresAt).toLocaleDateString('ko-KR')} 만료`
    : team.registryType === 'premier'
    ? `신청 액트 · ${team.act}${team.actConfirmed ? '' : ' · 현재 액트 확인 필요'}`
    : `${team.kind === '클랜' ? '클랜원' : '팀원'} · ${team.members.join(', ')}`;
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
  selectedRegistryType = 'formal';

  renderList() {
    const groups = [
      { id: 'formal', label: '정식 등록', teams: this.registryData.teams },
      { id: 'temporary', label: '임시 등록', teams: this.registryData.temporaryTeams || [] },
      { id: 'premier', label: '프리미어', teams: this.registryData.premierTeams || [] },
    ];
    const teams = groups.find(group => group.id === this.selectedRegistryType).teams;
    const modes = document.createElement('div');
    modes.className = 'kp-tabs kov-registry-modes';
    modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', '등록 상태');
    for (const group of groups) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.registryType = group.id;
      button.textContent = `${group.label} (${group.teams.length})`;
      button.classList.toggle('active', this.selectedRegistryType === group.id);
      button.setAttribute('aria-pressed', String(this.selectedRegistryType === group.id));
      button.addEventListener('click', () => {
        this.selectedRegistryType = group.id; this.selectedCategory = '전체'; this.renderList();
        this.querySelector(`button[data-registry-type="${group.id}"]`)?.focus();
      });
      modes.append(button);
    }
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
    results.append(modes, filters, list);
    const rules = document.createElement('details');
    rules.className = 'kp-panel kp-pad kp-section';
    const ruleTitle = document.createElement('summary');
    ruleTitle.textContent = 'KOV 등록 규정과 반영 기준'; rules.append(ruleTitle);
    for (const text of [
      '정식 등록은 팀장·클랜장 포함 3명 이상이며, 팀명과 이니셜 중복 및 이중 등록을 금지합니다.',
      '팀닉 통일과 특수기호 제거, Discord 계정 생성·서버 입장 1주 이상 여부는 운영진이 확인합니다.',
      '팀 인원 변경은 1일 1회, 클랜 인원 변경은 3일 1회이며 개인의 제외 신청도 가능합니다.',
      '임시 등록은 대표 1명에게 30일간 부여됩니다. 정식 등록 또는 관리자 승인 인원 추가로 3명이 확인되면 정식 목록으로 이동합니다.',
      '해체 후 1개월, 등급 회수 후 3개월, 이중 등록·규정 위반 제재 시 6개월 등 재신청 제한은 운영진 판정을 따릅니다.',
      '임시 등급 만료 후 3개월간 재신청할 수 없으며, 기간 전 해체·회수 시 재부여할 수 없습니다.',
      '프리미어는 신청인 본인과 신청 액트를 기록하며, 현재 액트 설정이 확인된 경우에만 해당 액트로 필터링합니다.',
      '사이트는 관리자 O 승인 내역을 반영합니다. X·승인 취소·글 삭제는 다시 계산하며, 역할 부여나 제재는 임의로 실행하지 않습니다.',
    ]) {
      const item = document.createElement('p'); item.textContent = text; rules.append(item);
    }
    results.append(rules);
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
      if ('liveConnected' in data) status.textContent += data.liveConnected
        ? ' · Discord 실시간 연결됨' : ' · 실시간 봇 연결 대기';
      this.registryData = data;
      this.renderList();
      if (data.syncing || 'liveConnected' in data) {
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
