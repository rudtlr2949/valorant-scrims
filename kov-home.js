/* 운영 데이터 입력 지점. 일정은 KST가 포함된 ISO 문자열을 사용합니다.
 * featured: {name,status:'recruiting'|'ongoing'|'closed',description,schedule,deadline,posterUrl,applyUrl,rules}
 * matches: [{startsAt,event,format:'BO3'|'BO5',state:'live'|'scheduled'|'finished',teamA,teamB,logoA,logoB,scoreA,scoreB,maps:[],broadcastUrl,bracketUrl}]
 * results: [{date,event,teamA,teamB,scoreA,scoreB,maps:[]}]
 * seasons: [{name,date,champion,mvp,summary,url}]
 * partners: [{name,logoUrl,url}] / discordUrl: 공식 커뮤니티 초대 링크
 * 비어 있는 항목은 준비 중으로 표시합니다. 로그인용 OAuth는 초대 링크와 별개입니다.
 */
window.KOV_HOME_DATA = window.KOV_HOME_DATA || {
  featured: null, matches: [], results: [], seasons: [], partners: [], discordUrl: ''
};

(function () {
  'use strict';
  var data = window.KOV_HOME_DATA;
  var home = document.getElementById('page-home');
  if (!home) return;
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var all = function (s, root) { return Array.from((root || document).querySelectorAll(s)); };
  var text = function (el) { return el ? el.textContent.trim() : ''; };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var safeUrl = function (url) { try { var u = new URL(url); return u.protocol === 'https:' ? u.href : ''; } catch (e) { return ''; } };
  var icon = function (id, cls) { return '<svg class="' + (cls || 'kov-empty-icon') + '" aria-hidden="true"><use href="#ic-' + id + '"/></svg>'; };
  var externalLink = function (url, label) { var safe = safeUrl(url); return safe ? '<a class="btn-red" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' ↗</a>' : ''; };
  var empty = function (title, description) { return '<div class="kov-empty"><strong>' + esc(title) + '</strong><p>' + esc(description) + '</p></div>'; };
  var seoulDate = function (value) { return new Date(value).toLocaleDateString('sv-SE', {timeZone:'Asia/Seoul'}); };
  var seoulTime = function (value) { return new Date(value).toLocaleTimeString('ko-KR', {timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}); };

  // 홈 아이콘을 기존 스프라이트에 추가합니다.
  var sprite = document.querySelector('svg[style*="display:none"]') || document.querySelector('svg symbol').parentElement;
  if (!document.getElementById('ic-home')) sprite.insertAdjacentHTML('beforeend', '<symbol id="ic-home" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11h3v10h5v-6h4v6h5V11h3L12 3z"/></symbol>');
  all('aside .nav-item').forEach(function (button) { button.title = button.textContent.trim(); button.setAttribute('aria-label', button.textContent.trim()); });

  function navigate(id) {
    var button = all('aside .nav-item').find(function (b) { return (b.getAttribute('onclick') || '').includes("goPage('" + id + "'"); });
    if (document.getElementById('page-' + id)) window.goPage(id, button);
  }
  var dialog = document.createElement('dialog');
  dialog.id = 'kov-detail-dialog';
  dialog.setAttribute('aria-labelledby', 'kov-dialog-title');
  dialog.innerHTML = '<div class="kov-dialog-head"><span class="kov-kicker">KOV COMMUNITY</span><button type="button" aria-label="닫기">×</button></div><h2 id="kov-dialog-title"></h2><div id="kov-dialog-body"></div>';
  document.body.appendChild(dialog);
  $('.kov-dialog-head button', dialog).addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) {
    var r = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
  });
  function show(title, body) { $('#kov-dialog-title').textContent = title; $('#kov-dialog-body').innerHTML = body; if (!dialog.open) dialog.showModal(); }
  function info(title, body) { show(title, '<p>' + esc(body) + '</p>'); }

  function renderFeatured() {
    var f = data.featured;
    if (!f) return;
    var states = {recruiting:'참가 모집 중',ongoing:'대회 진행 중',closed:'접수 마감'};
    $('#kov-tournament-status').textContent = states[f.status] || '대회 안내';
    $('#kov-hero-title').textContent = f.name;
    $('#kov-tournament-description').textContent = f.description || 'KOV 공식 대회 안내를 확인해 주세요.';
    $('#kov-tournament-meta').innerHTML = '<span>대회 일정<strong>' + esc(f.schedule || '추후 공개') + '</strong></span><span>접수 마감<strong>' + esc(f.deadline || '안내 예정') + '</strong></span>';
    var posterUrl = safeUrl(f.posterUrl);
    if (posterUrl) {
      var image = document.createElement('img'); image.src = posterUrl; image.alt = f.name + ' 대회 포스터'; image.className = 'kov-poster-image';
      image.addEventListener('error', function () { image.remove(); });
      $('#kov-poster').removeAttribute('role'); $('#kov-poster').removeAttribute('aria-label'); $('#kov-poster').appendChild(image);
    }
    $('.kov-poster-foot span').textContent = states[f.status] || 'TOURNAMENT';
  }
  function teamLogo(name, url) {
    var safe = safeUrl(url);
    return safe ? '<img class="kov-team-logo" src="' + esc(safe) + '" alt="' + esc(name) + ' 로고">' : '<span class="kov-team-logo" aria-hidden="true">' + esc((name || '?').slice(0,1)) + '</span>';
  }
  function renderMatches() {
    var now = new Date();
    $('#kov-today-date').textContent = now.toLocaleDateString('ko-KR', {timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short'}) + ' · KST';
    var today = (data.matches || []).map(function(m,i){return {match:m,index:i};}).filter(function(item){return !Number.isNaN(Date.parse(item.match.startsAt)) && seoulDate(item.match.startsAt) === seoulDate(now);});
    today.sort(function(a,b){return Date.parse(a.match.startsAt)-Date.parse(b.match.startsAt);});
    $('#kov-today-matches').innerHTML = today.length ? today.map(function (item) {
      var m = item.match; var state = m.state === 'live' ? '● LIVE' : m.state === 'finished' ? '경기 종료' : '경기 예정';
      var score = m.scoreA != null && m.scoreB != null ? esc(m.scoreA) + ' : ' + esc(m.scoreB) : 'VS';
      return '<article class="kov-match"><div class="kov-match-meta"><span class="' + (m.state === 'live' ? 'kov-live' : '') + '">' + state + '</span><span>' + esc(m.event) + ' · ' + esc(m.format || 'BO3') + '</span></div><div class="kov-match-teams"><div class="kov-team">' + teamLogo(m.teamA,m.logoA) + esc(m.teamA) + '</div><strong class="kov-match-score">' + score + '</strong><div class="kov-team">' + teamLogo(m.teamB,m.logoB) + esc(m.teamB) + '</div></div><div class="kov-match-footer"><button class="card-link" data-kov-match="' + item.index + '">대진표 ↗</button><span class="kov-muted">' + seoulTime(m.startsAt) + ' KST</span><button class="card-link" data-kov-broadcast="' + item.index + '">방송 보기 ↗</button></div></article>';
    }).join('') : '<div class="kov-empty kov-wide">' + icon('clock') + '<div><strong>오늘 등록된 KOV 경기가 없습니다.</strong><p>경기 일정이 공개되면 대진과 실시간 스코어를 이곳에서 확인할 수 있습니다.</p></div><button class="card-link" data-kov-page="notice">일정 공지 보기 ↗</button></div>';
  }
  function renderSummaries() {
    var scrims = all('#page-scrim .scrim-card').slice(0,4);
    $('#kov-scrim-summary').innerHTML = scrims.length ? scrims.map(function(c,i) {
      var name = text($('.scrim-team-name',c)), tier = text($('.scrim-team-tier',c)), meta = all('.scrim-meta span',c).map(text).join(' · ');
      return '<button class="kov-summary-row" data-kov-scrim="' + i + '"><span class="tag tag-' + ($('.tag-green',c)?'green':'blue') + '">' + esc(text($('.tag',c))) + '</span><span class="kov-row-copy"><strong>' + esc(name) + ' · ' + esc(tier) + '</strong><small>' + esc(meta) + '</small></span><span class="kov-row-arrow">↗</span></button>';
    }).join('') : empty('모집 중인 스크림이 없습니다.','첫 스크림을 만들어 보세요.');
    var teams = all('#page-findteam .team-card').filter(function(c){return !!$('.tag-green',c);}).slice(0,4);
    $('#kov-team-summary').innerHTML = teams.length ? teams.map(function(c) {
      return '<button class="kov-summary-row" data-kov-page="findteam"><span class="kov-row-mark">' + esc(text($('.team-avatar',c))) + '</span><span class="kov-row-copy"><strong>' + esc(text($('.team-card-name',c))) + ' · 멤버 모집</strong><small>' + esc(text($('.team-card-tier',c))) + ' · ' + esc(all('.team-card-tags .tag-gray',c).map(text).join(' / ')) + '</small></span><span class="kov-row-arrow">↗</span></button>';
    }).join('') : empty('모집 중인 팀이 없습니다.','함께 성장할 팀을 만들어 보세요.');
    var notices = all('#page-notice .notice-item').map(function(c,i){return {el:c,index:i,date:text($('.notice-meta span:nth-child(2)',c))};}).sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,3);
    $('#kov-news').innerHTML = notices.length ? notices.map(function(n) {
      return '<button class="kov-news-row" data-kov-notice="' + n.index + '"><span class="tag tag-red">' + esc(text($('.tag',n.el))) + '</span><strong>' + esc(text($('.notice-title',n.el))) + '</strong><small>' + esc(n.date) + ' · ' + esc(text($('.notice-meta span',n.el))) + '</small></button>';
    }).join('') : empty('등록된 공지가 없습니다.','새로운 KOV 소식을 준비하고 있습니다.');
  }
  function renderResults() {
    var results = (data.results || []).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date));}).slice(0,3);
    $('#kov-results').innerHTML = results.length ? results.map(function(r){return '<div class="kov-result-row"><span>' + esc(r.teamA) + '</span><strong class="kov-result-score">' + esc(r.scoreA) + ' : ' + esc(r.scoreB) + '</strong><span>' + esc(r.teamB) + '</span><small>' + esc(r.date) + ' · ' + esc((r.maps || []).join(' / ')) + '</small></div>';}).join('') : empty('아직 등록된 KOV 경기 결과가 없습니다.','경기 종료 후 승패·세트 스코어·맵 기록을 안내합니다.');
  }
  function renderHistory() {
    var latest = (data.seasons || [])[0];
    $('#kov-hall').innerHTML = '<article class="kov-hall-card"><span class="kov-kicker">HALL OF FAME / CHAMPIONS</span><div>' + icon('shield','kov-trophy') + '<h3>' + esc(latest ? latest.champion || '우승 팀 집계 중' : '다음 챔피언을 기다립니다.') + '</h3><p>' + esc(latest ? latest.name : 'KOV의 첫 우승 기록이 이곳에 새겨집니다.') + '</p></div></article><article class="kov-hall-card"><span class="kov-kicker">MOST VALUABLE PLAYER</span><div><h3>' + esc(latest ? latest.mvp || 'MVP 집계 중' : '대회 MVP') + '</h3><p>' + esc(latest ? latest.date : '무대를 빛낸 최고의 플레이어를 소개합니다.') + '</p></div></article><article class="kov-hall-card"><span class="kov-kicker">PREVIOUS TOURNAMENTS</span><div><h3>' + esc(latest ? latest.name : '지난 시즌 아카이브') + '</h3><p>' + esc(latest ? latest.summary || '대회 기록을 확인하세요.' : '지난 대회의 순간과 기록을 한눈에.') + '</p></div><button class="card-link" data-kov-action="history">지난 대회 보기 ↗</button></article>';
  }
  function renderPartners() {
    var partners = (data.partners || []).filter(function(p){return safeUrl(p.url);});
    $('#kov-partner-list').innerHTML = partners.length ? partners.map(function(p){return '<a href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener noreferrer">' + (safeUrl(p.logoUrl)?'<img src="' + esc(safeUrl(p.logoUrl)) + '" alt="' + esc(p.name) + ' 로고" loading="lazy">':'') + '<span>' + esc(p.name) + ' ↗</span></a>';}).join('') : '<span class="kov-muted">공식 후원·파트너 라인업을 준비하고 있습니다.</span>';
  }
  function openCreate(id,page) { navigate(page); document.getElementById(id).classList.add('open'); }
  function showTournament() {
    var f = data.featured;
    if (!f) return info('KOV 대회 안내','다음 대회를 준비하고 있습니다. 대회 일정과 참가 규정이 확정되면 공지사항에서 안내하겠습니다.');
    show(f.name, '<p>' + esc(f.description || '') + '</p><p>일정: ' + esc(f.schedule || '추후 공개') + '\n접수 마감: ' + esc(f.deadline || '안내 예정') + '</p><p>' + esc(f.rules || '참가 규정 안내 예정') + '</p>' + (f.status === 'recruiting' ? externalLink(f.applyUrl,'참가 신청') : ''));
  }
  var actions = {
    tournament: showTournament,
    apply: function () { var f = data.featured; if (f && f.status === 'recruiting' && safeUrl(f.applyUrl)) show(f.name + ' 참가 신청','<p>대회 규정을 확인한 뒤 공식 신청 페이지에서 접수해 주세요.</p>' + externalLink(f.applyUrl,'공식 신청 페이지')); else info('참가 신청 안내','현재 참가 신청을 받는 대회가 없습니다. 접수가 시작되면 공식 신청 링크를 안내하겠습니다.'); },
    discord: function () { if(safeUrl(data.discordUrl)) show('KOV Discord','<p>공식 커뮤니티에서 팀원과 경기 소식을 만나보세요.</p>' + externalLink(data.discordUrl,'Discord 입장')); else info('Discord 커뮤니티','공식 초대 링크를 준비하고 있습니다. 계정 연동은 기존 사이드바의 Discord 연동 버튼을 이용해 주세요.'); },
    'create-scrim': function () { openCreate('createScrimModal','scrim'); },
    'create-team': function () { openCreate('createTeamModal','findteam'); },
    records: function () { var rs = data.results || []; if(!rs.length) return info('KOV 경기 기록','아직 등록된 KOV 경기 기록이 없습니다. 대회가 진행되면 결과와 맵 정보를 안내합니다.'); show('KOV 경기 기록',rs.map(function(r){return '<p><strong>' + esc(r.teamA) + ' ' + esc(r.scoreA) + ' : ' + esc(r.scoreB) + ' ' + esc(r.teamB) + '</strong><br>' + esc(r.date) + ' · ' + esc(r.event) + '<br>맵: ' + esc((r.maps || []).join(' / ')) + '</p>';}).join('')); },
    history: function () { var seasons = data.seasons || []; if(!seasons.length) return info('지난 KOV 대회','등록된 지난 대회가 없습니다. 대회가 종료되면 우승 팀, MVP, 시즌 기록을 안내합니다.'); show('지난 KOV 대회',seasons.map(function(s){return '<p><strong>' + esc(s.name) + '</strong><br>' + esc(s.date) + '<br>우승: ' + esc(s.champion) + ' · MVP: ' + esc(s.mvp) + '<br>' + esc(s.summary || '') + '</p>' + externalLink(s.url,'대회 기록');}).join('')); },
    top: function () { $('#mainContent').scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); }
  };
  home.addEventListener('click', function(e) {
    var button = e.target.closest('button'); if(!button) return;
    if(button.dataset.kovPage) return navigate(button.dataset.kovPage);
    if(button.dataset.kovAction) { if(actions[button.dataset.kovAction]) actions[button.dataset.kovAction](); return; }
    if(button.dataset.kovScrim !== undefined) {
      var card = all('#page-scrim .scrim-card')[Number(button.dataset.kovScrim)];
      navigate('scrim'); card.scrollIntoView({block:'center'}); return;
    }
    if(button.dataset.kovNotice !== undefined) {
      var notice = all('#page-notice .notice-item')[Number(button.dataset.kovNotice)];
      navigate('notice'); notice.scrollIntoView({block:'center'}); return;
    }
    if(button.dataset.kovMatch !== undefined) {
      var m = data.matches[Number(button.dataset.kovMatch)];
      show(m.teamA + ' vs ' + m.teamB, '<p>' + esc(m.event) + ' · ' + esc(m.format || 'BO3') + '\n' + esc(seoulDate(m.startsAt)) + ' ' + esc(seoulTime(m.startsAt)) + ' KST\n맵: ' + esc((m.maps || []).join(' / ') || '밴픽 예정') + '</p>' + (externalLink(m.bracketUrl,'공식 대진표') || '<p>상세 대진표는 준비 중입니다.</p>')); return;
    }
    if(button.dataset.kovBroadcast !== undefined) {
      var broadcast = data.matches[Number(button.dataset.kovBroadcast)];
      show('경기 방송', externalLink(broadcast.broadcastUrl,'방송 보기') || '<p>방송 주소가 아직 등록되지 않았습니다.</p>');
    }
  });
  renderFeatured(); renderMatches(); renderSummaries(); renderResults(); renderHistory(); renderPartners();
  // 페이지를 열어 둔 채 KST 날짜가 바뀌거나 기존 모집 화면이 바뀌어도 갱신합니다.
  setInterval(renderMatches,60000);
  var refreshTimer;
  var observer = new MutationObserver(function(){clearTimeout(refreshTimer);refreshTimer=setTimeout(renderSummaries,80);});
  ['page-scrim','page-findteam','page-notice'].forEach(function(id){observer.observe(document.getElementById(id),{childList:true,subtree:true,characterData:true});});
})();
