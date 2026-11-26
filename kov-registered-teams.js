import { registryCategories, registryCategory } from './kov-registry-category.js';
import { registryNewestFirst, registryPostDate, registryDateLabel } from './kov-registry-order.js';

let cachedLookup;
const rosterCache = new Map();

function lookupTeams() {
  if (cachedLookup && Date.now() < cachedLookup.expiresAt) return cachedLookup.request;
  const request = fetch('/api/kov-registered-teams').then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!data.stale && !data.syncing) {
      try { localStorage.setItem('kov:registry:last-good:v1', JSON.stringify(data)); } catch { /* Storage may be disabled. */ }
    }
    return data;
  }).catch(error => {
    let previous;
    try { previous = JSON.parse(localStorage.getItem('kov:registry:last-good:v1') || 'null'); } catch { /* No valid cache. */ }
    if (!Array.isArray(previous?.teams)) throw error;
    return { ...previous, temporaryTeams: (previous.temporaryTeams || []).filter(team => team.expiresAt > Date.now()),
      stale: true, liveConnected: false, snapshotAt: previous.updatedAt, retryAfter: 300 };
  });
  const entry = { request, expiresAt: Date.now() + 60_000 };
  cachedLookup = entry;
  request.then(data => {
    entry.expiresAt = Date.now() + (data.syncing || 'liveConnected' in data ? data.retryAfter * 1000 : 60_000);
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
  captain.className = 'kov-registry-captain';
  captain.textContent = `${team.registryType === 'premier' ? '신청인' : team.kind === '클랜' ? '클랜장' : '팀장'} ${team.captain} · 총 ${(team.members?.length || 0) + (team.captain && team.captain !== '미지정' ? 1 : 0)}명`;
  const members = document.createElement('p');
  members.textContent = team.registryType === 'temporary'
    ? `임시 등록 · ${Math.max(0, Math.ceil((team.expiresAt - Date.now()) / 86400000))}일 남음`
    : team.registryType === 'premier'
    ? `신청 액트 · ${team.act}${team.source === 'admin-management' ? ' · 운영진 기록' : team.actConfirmed ? '' : ' · 현재 액트 확인 필요'}`
    : team.managedStatus === 'pending' ? '운영진 확인 대기' : team.rosterIncomplete ? '명단 등록 대기' : '정식 등록';
  members.className = 'kp-badge kov-registry-state';
  const source = document.createElement('a');
  source.className = 'kp-button small';
  source.href = team.url;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.textContent = 'Discord 원문 보기 ↗';
  const date = document.createElement('p');
  date.className = 'kp-meta';
  date.textContent = '최근 변경 · ';
  date.append(renderDate(team));
  const details = document.createElement('details');
  details.dataset.rosterSource = team.url;
  const summary = document.createElement('summary');
  summary.className = 'kov-registry-summary';
  const monogram = document.createElement('span');
  monogram.className = 'kov-registry-monogram';
  monogram.setAttribute('aria-hidden', 'true');
  monogram.textContent = [...team.name].slice(0, 2).join('').toUpperCase();
  const heading = document.createElement('div');
  heading.className = 'kov-registry-heading';
  heading.append(name, captain, date);
  const badges = document.createElement('div');
  badges.className = 'kov-registry-badges';
  badges.append(category, members);
  const expand = document.createElement('span');
  expand.className = 'kov-registry-expand';
  expand.textContent = '명단 보기';
  summary.append(monogram, heading, badges, expand);
  const roster = document.createElement('div');
  roster.className = 'kov-registry-roster';
  roster.setAttribute('aria-live', 'polite');
  details.append(summary, roster);
  details.addEventListener('toggle', async () => {
    if (!details.open || details.dataset.loaded) return;
    details.dataset.loaded = 'true';
    roster.textContent = 'Discord 태그를 확인하고 있습니다…';
    try {
      let entry = rosterCache.get(team.url);
      if (!entry || entry.expiresAt < Date.now()) {
        const request = fetch('/api/kov-registry-roster?source=' + encodeURIComponent(team.url)).then(response => {
          if (!response.ok) throw new Error();
          return response.json();
        });
        entry = { request, expiresAt: Date.now() + 3_600_000 };
        rosterCache.set(team.url, entry);
        request.catch(() => rosterCache.delete(team.url));
      }
      const data = await entry.request;
      roster.replaceChildren();
      if (!data.people.length) roster.textContent = '팀장·팀원 명단은 확인 후 등록됩니다.';
      for (const person of data.people) {
        const row = document.createElement('div');
        row.className = 'kov-registry-person';
        const role = document.createElement('span');
        role.className = 'kov-registry-role';
        role.textContent = person.role === 'captain' ? (team.registryType === 'premier' ? '신청인' : team.kind === '클랜' ? '클랜장' : '팀장') : (team.kind === '클랜' ? '클랜원' : '팀원');
        const nickname = document.createElement('strong');
        nickname.textContent = person.name;
        row.append(role, nickname);
        if (person.id) {
          const link = document.createElement('a');
          link.href = 'https://discord.com/users/' + person.id;
          link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.className = 'kov-registry-tag';
          link.textContent = person.tag || 'Discord 프로필 ↗';
          row.append(link);
        } else {
          const missing = document.createElement('span');
          missing.className = 'kov-registry-tag'; missing.textContent = '태그 확인 불가'; row.append(missing);
        }
        roster.append(row);
      }
    } catch {
      roster.textContent = '태그를 불러오지 못했습니다. 다시 열어 재시도해 주세요.';
      delete details.dataset.loaded;
    }
  });
  if (team.source !== 'admin-management') details.append(source);
  card.append(details);
  return card;
}

function renderDate(item) {
  const time = document.createElement('time');
  const date = registryPostDate(item);
  if (date) time.dateTime = date.toISOString();
  time.textContent = registryDateLabel(item);
  time.title = 'Discord 글 작성일 · 한국시간';
  return time;
}

class RegisteredTeams extends HTMLElement {
  selectedCategory = '전체';
  selectedRegistryType = 'formal';
  searchQuery = '';
  sortOrder = 'recent';
  selectedPremierAct = null;

  renderList() {
    const focusedSearch = this.contains(document.activeElement) && document.activeElement.matches('[data-registry-search]');
    const searchPosition = focusedSearch ? document.activeElement.selectionStart : null;
    const openRosters = new Set([...this.querySelectorAll('details[data-roster-source][open]')].map(item => item.dataset.rosterSource));
    const rulesOpen = this.querySelector('.kov-registry-rules')?.open || false;
    const reviewOpen = this.querySelector('.kov-registry-review')?.open || false;
    const groups = [
      { id: 'formal', label: '정식 등록', teams: this.registryData.teams },
      { id: 'temporary', label: '임시 등록', teams: this.registryData.temporaryTeams || [] },
      { id: 'premier', label: '프리미어', teams: this.registryData.premierTeams || [] },
    ];
    let teams = registryNewestFirst(groups.find(group => group.id === this.selectedRegistryType).teams);
    const premierActs = [...new Set(teams.map(team => team.act).filter(Boolean))];
    if (this.selectedRegistryType === 'premier' && this.registryData.premierDirectorySource === 'admin-management') {
      const act = this.selectedPremierAct ?? this.registryData.premierLatestAct;
      if (act && act !== 'all') teams = teams.filter(team => team.act === act);
    }
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
    list.className = 'kp-grid three kov-registry-list';
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
    const query = this.searchQuery.normalize('NFKC').toLocaleLowerCase().trim();
    const visible = teams.filter(team => (this.selectedCategory === '전체' || registryCategory(team) === this.selectedCategory)
      && [team.name, team.captain].some(value => (value || '').normalize('NFKC').toLocaleLowerCase().includes(query)));
    if (this.sortOrder === 'name') visible.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true, sensitivity: 'base' }));
    list.append(...visible.map(team => {
      const card = renderTeam(team);
      if (openRosters.has(team.url)) card.querySelector('details').open = true;
      return card;
    }));
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'kp-empty';
      empty.textContent = query ? '검색 결과가 없습니다. 팀명·클랜명 또는 대표 이름을 확인해 주세요.' : this.registryData.syncing
        ? `${this.selectedCategory} 등록 목록을 확인하고 있습니다.`
        : `${this.selectedCategory} 유형에 관리자 승인이 확인된 등록이 없습니다.`;
      list.append(empty);
    }
    this.querySelector('.kov-registry-results')?.remove();
    const results = document.createElement('section');
    results.className = 'kov-registry-results';
    results.setAttribute('aria-label', '유형별 등록 목록');
    const order = document.createElement('p');
    order.className = 'kp-meta';
    order.textContent = `${visible.length}개 표시 · ${this.sortOrder === 'name' ? '가나다순' : '최근 변경순'} · 한국시간`;
    order.setAttribute('role', 'status');
    const toolbar = document.createElement('div');
    toolbar.className = 'kov-registry-toolbar';
    const searchLabel = document.createElement('label');
    searchLabel.className = 'kp-field'; searchLabel.textContent = '팀·클랜 검색';
    const search = document.createElement('input');
    search.type = 'search'; search.placeholder = '팀명, 클랜명 또는 팀장 이름'; search.value = this.searchQuery;
    search.dataset.registrySearch = 'true';
    search.addEventListener('input', () => {
      const position = search.selectionStart;
      this.searchQuery = search.value; this.renderList();
      const next = this.querySelector('[data-registry-search]');
      next.focus(); next.setSelectionRange(position, position);
    });
    searchLabel.append(search);
    const sortLabel = document.createElement('label');
    sortLabel.className = 'kp-field'; sortLabel.textContent = '정렬';
    const sort = document.createElement('select');
    for (const [value, label] of [['recent', '최근 변경순'], ['name', '가나다순']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; sort.append(option);
    }
    sort.value = this.sortOrder;
    sort.addEventListener('change', () => { this.sortOrder = sort.value; this.renderList(); this.querySelector('.kov-registry-toolbar select').focus(); });
    sortLabel.append(sort); toolbar.append(searchLabel, sortLabel);
    if (this.selectedRegistryType === 'premier' && this.registryData.premierDirectorySource === 'admin-management') {
      const actLabel = document.createElement('label');
      actLabel.className = 'kp-field'; actLabel.textContent = '프리미어 신청 액트';
      const actSelect = document.createElement('select');
      actSelect.dataset.premierAct = 'true';
      for (const act of ['all', ...premierActs]) {
        const option = document.createElement('option'); option.value = act;
        option.textContent = act === 'all' ? '전체 관리 기록' : act + (act === this.registryData.premierLatestAct ? ' · 최신 기록' : '');
        actSelect.append(option);
      }
      actSelect.value = this.selectedPremierAct ?? this.registryData.premierLatestAct ?? 'all';
      actSelect.addEventListener('change', () => { this.selectedPremierAct = actSelect.value; this.renderList(); this.querySelector('[data-premier-act]').focus(); });
      actLabel.append(actSelect); toolbar.append(actLabel);
    }
    results.append(modes, filters, toolbar, order, list);
    const rules = document.createElement('details');
    rules.className = 'kp-panel kp-pad kp-section kov-registry-rules';
    rules.open = rulesOpen;
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
      '정식·임시·프리미어 명단은 운영진 관리 기록을 기준으로 정리합니다. 사이트에서 역할 부여나 제재를 임의로 실행하지 않습니다.',
      '등록보다 최신인 해체 승인이 있으면 목록에서 제거합니다. 해체된 팀의 지난 변경 내역은 확인 필요 목록에서 정리하며, 새로운 정식 등록 승인 후 다시 표시합니다.',
    ]) {
      const item = document.createElement('p'); item.textContent = text; rules.append(item);
    }
    results.append(rules);
    if (!this.registryData.syncing && this.registryData.reviewChanges?.length) {
      const review = document.createElement('details');
      review.className = 'kp-panel kp-pad kp-section kov-registry-review';
      review.open = reviewOpen;
      const summary = document.createElement('summary');
      summary.textContent = `명단 확인이 필요한 변경 ${this.registryData.reviewChanges.length}건`;
      review.append(summary);
      for (const change of registryNewestFirst(this.registryData.reviewChanges)) {
        const item = document.createElement('p');
        const link = document.createElement('a');
        link.href = change.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${change.name}${change.afterName ? ` → ${change.afterName}` : ''}${change.action ? ` · ${change.action}` : ''} · ${change.reason} Discord 내역 ↗`;
        item.append(renderDate(change), ' · ', link); review.append(item);
      }
      results.append(review);
    }
    this.append(results);
    if (focusedSearch) {
      search.focus(); search.setSelectionRange(searchPosition, searchPosition);
    }
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
      status.textContent = data.directorySource === 'admin-management'
        ? `운영진 관리 명단 기준 · 현재 등록 ${teams.length}건 · 해체·회수 ${data.closedManagedTeams || 0}건 제외`
        : data.syncing
        ? `변경 이력 확인 중 · 승인된 내역 ${data.checkedEvents || 0}건`
        : teams.length
        ? `관리자 O 확인 · 현재 등록 ${teams.length}건 · 명단 변경 ${data.appliedChanges || 0}건 반영`
        : '관리자의 O 반응이 확인된 등록 팀·클랜이 없습니다.';
      if (!data.syncing && data.unmatchedChanges) {
        status.textContent += ` · 기존 명단 연결 확인이 필요한 변경 ${data.unmatchedChanges}건`;
      }
      if ('liveConnected' in data) status.textContent += data.liveConnected
        ? ' · Discord 실시간 연결됨' : ' · 실시간 봇 연결 대기';
      if (data.stale) status.textContent = `마지막 정상 명단 표시 · 저장소 연결 대기 · ${new Date(data.snapshotAt || data.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 기준`;
      if (data.managementSync?.state === 'syncing') status.textContent += ` · 관리자 기록 정리 중 (${data.managementSync.processed}/${data.managementSync.total})`;
      if (data.managementSync?.state === 'access-denied') status.textContent += ' · 봇의 관리자 관리 채널 읽기 권한이 필요합니다';
      this.registryData = data;
      this.renderList();
      if (data.syncing || 'liveConnected' in data) {
        this.refreshTimer = setTimeout(() => {
          if (this.isConnected) void this.connectedCallback();
        }, Math.max(2, data.retryAfter) * 1000);
      }
    } catch (error) {
      status.textContent = error.message || '등록 목록을 불러오지 못했습니다.';
      this.refreshTimer = setTimeout(() => { if (this.isConnected) void this.connectedCallback(); }, 300000);
    }
  }
}
customElements.define('kov-registered-teams', RegisteredTeams);
