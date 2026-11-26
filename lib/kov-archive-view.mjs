const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>value==null?'공개 기록 없음':Number(value).toLocaleString('ko-KR')+'원';
const ratio=(numerator,denominator)=>denominator?(numerator/denominator).toFixed(2):'—';
const time=value=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const href=(event,tab='overview',detail='')=>'#kov/archive/'+encodeURIComponent(event.id)+'/'+tab+(detail?'/'+encodeURIComponent(detail):'');
const external=(label,url)=>{try{if(new URL(url).protocol!=='https:')return '';}catch{return '';}
 return `<a class="kp-button small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;};
const team=(event,id)=>event.teams.find(t=>t.id===id);
const heading=(title,description='')=>`<div class="kov-archive-heading"><h2>${esc(title)}</h2>${description?`<p class="kp-meta">${esc(description)}</p>`:''}</div>`;

export function aggregateArchive(event){
 const people=new Map();
 for(const match of event.matches)for(const player of match.players){
  const key=player.playerId;const entry=people.get(key)||{...player,kills:0,deaths:0,assists:0,fb:0,fd:0,maps:0,series:0,agents:[]};
  for(const stat of ['kills','deaths','assists','fb','fd'])entry[stat]+=player[stat]||0;
  entry.maps+=match.maps.length;entry.series++;entry.agents=[...new Set([...entry.agents,...player.agents])];people.set(key,entry);
 }
 return [...people.values()].map(p=>({...p,kd:p.deaths?p.kills/p.deaths:0,kda:p.deaths?(p.kills+p.assists)/p.deaths:0}));
}

function tile(event,match){
 const row=(id,score)=>`<div class="kov-archive-team-row ${match.winnerId===id?'is-winner':''}"><span>${esc(team(event,id)?.name)}</span><strong>${score??(match.winnerId===id?'승':'패')}</strong></div>`;
 return `<a class="kov-archive-match" href="${href(event,'match',match.id)}"><div class="kov-archive-match-label"><span>${esc(match.label)}</span><span>종료 · BO${match.bestOf}</span></div>${row(match.teamA,match.scoreA)}${row(match.teamB,match.scoreB)}<div class="kov-archive-match-time">${esc(match.startsAt?time(match.startsAt)+' KST':match.dateLabel)} <span>${match.players.length?'상세 통계':'진행 기록'} →</span></div></a>`;
}

function placements(event){
 return `<div class="kp-table-scroll"><table class="kov-archive-table"><thead><tr><th>최종 순위</th><th>팀</th><th>시리즈</th><th>맵</th><th>현금 상금</th></tr></thead><tbody>${event.teams.slice().sort((a,b)=>a.rank-b.rank).map(t=>{
  const ms=event.matches.filter(m=>[m.teamA,m.teamB].includes(t.id));const wins=ms.filter(m=>m.winnerId===t.id).length;
  const detailed=ms.filter(m=>m.scoreA!=null&&m.scoreB!=null);const mapWins=detailed.reduce((n,m)=>n+(m.teamA===t.id?m.scoreA:m.scoreB),0);const mapLosses=detailed.reduce((n,m)=>n+(m.teamA===t.id?m.scoreB:m.scoreA),0);
  return `<tr><td>${esc(t.rankLabel||(t.rank===1?'우승':t.rank===2?'준우승':t.rank+'위'))}</td><td><strong>${esc(t.name)}</strong>${t.alias?`<small>Discord · ${esc(t.alias)}</small>`:''}</td><td>${ms.length?`${wins}승 ${ms.length-wins}패`:'스위스 탈락'}</td><td>${detailed.length?`${mapWins}승 ${mapLosses}패 (${detailed.length}경기)`:'미대조'}</td><td>${money(t.prize)}</td></tr>`;
 }).join('')}</tbody></table></div><p class="kp-meta">시리즈는 플레이오프 전체 승패, 맵은 점수가 확인된 4경기만 집계합니다. 공동 순위는 탈락 라운드 기준이며 상금 지급 여부는 확인되지 않았습니다.</p>`;
}

function overview(event){
 const final=event.matches.find(m=>m.slot==='grand-final');const mapCount=event.matches.reduce((n,m)=>n+m.maps.length,0);
 return `<div class="kov-archive-summary"><article class="kp-panel"><small>우승</small><strong>${esc(team(event,event.championId)?.name)}</strong><span>그랜드 파이널 ${final.scoreB} : ${final.scoreA}</span></article><article class="kp-panel"><small>전체 대진</small><strong>${event.swiss.length+event.matches.length}경기 · ${event.teams.length}팀</strong><span>상세 통계 ${mapCount}맵 · ${aggregateArchive(event).length}명</span></article><article class="kp-panel"><small>현금 상금</small><strong>${money(event.cashPrize)}</strong><span>상품 포함 홍보 금액 약 450만원</span></article></div>
 ${heading('대회 진행',event.format)}<div class="kov-archive-timeline">${event.timeline.map(([date,title,body])=>`<article class="kp-panel"><small>${esc(date)}</small><h3>${esc(title)}</h3><p>${esc(body)}</p></article>`).join('')}</div><p class="kp-meta">후원 · ${event.sponsors.map(esc).join(' · ')}</p><div class="kp-actions">${external('대회 규정집',event.rulesUrl)}${event.broadcasts.map(s=>external(s.label,s.url)).join('')}</div>
 ${heading('최종 순위','대회 결과와 수록 경기 기준 성적')}${placements(event)}
 ${heading('마지막 경기','경기를 누르면 맵별 스코어와 선수 기록을 확인할 수 있습니다.')}<div class="kov-archive-match-grid">${event.matches.slice(-2).map(m=>tile(event,m)).join('')}</div>
 ${heading('기록 범위')}<div class="kp-panel kov-archive-note"><p>${esc(event.scope)}의 대진과 승패를 보관합니다. 상세 통계는 VLR의 4경기·13맵·20명이며 현재 등록 명단과 별도로 당시 출전자를 표시합니다.</p><p>초반 경기 점수는 미대조로 표시합니다. 공식 MVP와 운영진 판정은 추정하지 않습니다.</p><a href="${href(event,'sources')}">출처와 미확인 항목 보기 →</a></div>`;
}

function bracket(event){
 const column=(slot,title,note)=>`<section class="kov-archive-round"><h3>${esc(title)}</h3><div>${event.matches.filter(m=>m.slot===slot).map(m=>tile(event,m)).join('')}</div><p>${esc(note)}</p></section>`;
 return `${heading('스위스 스테이지','8팀 · 2승 진출 / 2패 탈락 · BO1. 승·패는 공식 진출 기록 기준이며 라운드 점수는 미대조입니다.')}<div class="kov-archive-swiss">${[1,2,3].map(r=>`<section><h3>ROUND ${r} · ${['바인드','어센트','서밋'][r-1]}</h3>${event.swiss.filter(m=>m.round===r).map(m=>tile(event,m)).join('')}</section>`).join('')}</div><div class="kp-panel kov-archive-note"><strong>플레이오프 진출</strong><p>스위스 진출 · ${event.swissQualified.map(id=>esc(team(event,id).name)).join(' · ')}</p><p>직행 · ${event.direct.map(id=>esc(team(event,id).name)).join(' · ')}</p></div>
 ${heading('8팀 플레이오프 대진표','승자조·패자조 전체 14경기. 좌우로 이동해 각 라운드와 경기 상세를 확인하세요.')}<h3>승자조</h3><div class="kov-archive-bracket-scroll"><div class="kov-archive-bracket upper">${column('r1','1라운드','승자 → 승자조 2라운드 · 패자 → 패자조 1라운드')}${column('u2','2라운드','승자 → 승자조 결승 · 패자 → 패자조 2라운드')}${column('upper-final','결승 직행전','HAIL MARY → 최종 결승 · Rio → 결승 진출전')}${column('grand-final','최종 결승','Rio Company 우승 · HAIL MARY 준우승')}</div></div><h3>패자조</h3><div class="kov-archive-bracket-scroll"><div class="kov-archive-bracket lower">${column('l1','1라운드','승자 → 패자조 2라운드 · 패자 → 공동 7–8위')}${column('l2','2라운드','승자 → 하위조 준결승 · 패자 → 공동 5–6위')}${column('lower-round','하위조 준결승','GGA Freak → 결승 진출전 · Blue Jeans 4위')}${column('lower-final','결승 진출전','Rio → 최종 결승 · GGA Freak 3위')}</div></div><p class="kp-meta">승리 팀은 녹색으로 표시합니다. 숫자 대신 승·패가 표시된 경기는 진출 경로를 확인했으며 세트 점수는 아직 대조하지 않은 경기입니다.</p>`;
}

function playerTable(event,players,advanced=false){
 return `<div class="kp-table-scroll"><table class="kov-archive-table"><thead><tr><th>선수 · 당시 소속</th><th>요원</th><th>K / D / A</th><th>K/D</th><th>KDA</th>${advanced?'<th>R</th><th>ACS</th><th>ADR</th><th>KAST</th><th>HS%</th>':'<th>맵 · 경기</th>'}<th>FK / FD</th></tr></thead><tbody>${players.map(p=>`<tr><td><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(p.name)}</strong></a><small>${esc(team(event,p.teamId)?.name)}</small></td><td class="kov-archive-agent-cell">${p.agents.map(esc).join(' · ')}</td><td>${p.kills} / ${p.deaths} / ${p.assists}</td><td>${ratio(p.kills,p.deaths)}</td><td>${ratio(p.kills+p.assists,p.deaths)}</td>${advanced?`<td>${p.rating2??'—'}</td><td>${p.acs??'—'}</td><td>${p.adr??'—'}</td><td>${p.kast==null?'—':p.kast+'%'}</td><td>${p.hsp==null?'—':p.hsp+'%'}</td>`:`<td>${p.maps}맵 · ${p.series}경기</td>`}<td>${p.fb} / ${p.fd}</td></tr>`).join('')}</tbody></table></div>`;
}

function matchDetail(event,id){
 const match=[...event.matches,...event.swiss].find(m=>m.id===id);if(!match)return '<div class="kp-empty">수록되지 않은 경기입니다.</div>';
 if(!match.players.length)return `<a class="kp-back" href="${href(event,'bracket')}">← 전체 대진표</a>${heading(match.label,(match.startsAt?time(match.startsAt)+' KST':match.dateLabel)+` · BO${match.bestOf}`)}<div class="kp-panel kov-archive-series"><span>${esc(team(event,match.teamA).name)}</span><strong>VS</strong><span>${esc(team(event,match.teamB).name)}</span></div><div class="kp-panel kov-archive-note"><h3>승리 · ${esc(team(event,match.winnerId).name)}</h3>${match.mapName?`<p>지정 맵 · ${esc(match.mapName)}</p>`:''}<p>${esc(match.evidence)}</p><p>이 경기의 점수와 선수 통계는 아직 원본 결과 이미지와 대조하지 않았습니다.</p>${external('Discord 공식 진행 기록',match.source)}</div>`;
 return `<a class="kp-back" href="${href(event,'matches')}">← 경기 목록</a>${heading(match.label,`${time(match.startsAt)} KST · BO${match.bestOf} · 패치 ${match.patch||'미확인'}`)}
 <div class="kp-panel kov-archive-series"><span class="${match.winnerId===match.teamA?'is-winner':''}">${esc(team(event,match.teamA)?.name)}</span><strong>${match.scoreA} : ${match.scoreB}</strong><span class="${match.winnerId===match.teamB?'is-winner':''}">${esc(team(event,match.teamB)?.name)}</span></div>
 <p class="kp-meta">종료 · 승리 ${esc(team(event,match.winnerId)?.name)} · ${external('VLR 경기 원문',match.source)}</p>
 ${heading('세트별 결과','스코어는 위 경기의 왼쪽 팀 : 오른쪽 팀 순서입니다. 세트를 펼치면 해당 맵의 선수 기록이 나옵니다.')}
 <div class="kov-archive-map-list">${match.maps.map((map,index)=>`<details class="kp-panel kov-archive-map"><summary><span>SET ${index+1} · <strong>${esc(map.name)}</strong></span><b>${map.scoreA} : ${map.scoreB}</b><span>${esc(map.duration)} · ${esc(team(event,map.scoreA>map.scoreB?match.teamA:match.teamB)?.name)} 승</span><span>선수 기록 ＋</span></summary><div class="kov-archive-map-body">${playerTable(event,map.players,true)}</div></details>`).join('')}</div>
 ${heading('경기 합산 선수 기록','VLR에 수록된 시리즈 합산값입니다. R은 VLR Rating이며 공식 MVP 선정과는 별개입니다.')}${playerTable(event,match.players,true)}
 <p class="kp-meta">KDA = (킬 + 어시스트) ÷ 데스 · FK 첫 킬 · FD 첫 데스 · ACS 평균 전투 점수 · ADR 라운드당 평균 피해량. 데스 0은 비율을 —로 표시합니다.</p>`;
}

function rosters(event){
 const people=aggregateArchive(event);
 return `${heading('참가 당시 출전 명단','수록 경기의 실제 선수 기록에서 확인한 명단입니다. 현재 사이트 등록 명단이나 Discord 닉네임으로 덮어쓰지 않습니다.')}
 <div class="kov-archive-rosters">${event.teams.map(t=>`<article class="kp-panel"><div class="kov-archive-roster-title"><h3>${esc(t.name)}</h3><span>${esc(t.rankLabel||t.rank+'위')} · ${people.filter(p=>p.teamId===t.id).length}명 상세 통계</span></div>${people.filter(p=>p.teamId===t.id).map(p=>`<div class="kov-archive-roster-person"><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.name)} ↗</a><span>${p.maps}맵 · ${p.series}경기</span></div>`).join('')||'<p class="kp-meta">이 팀의 당시 출전 명단은 추가 대조가 필요합니다.</p>'}</article>`).join('')}</div><p class="kp-meta">VLR 대회 소개의 등록 명단과 경기 출전자가 다를 수 있습니다. 예를 들어 Blue Jeans의 SHOCK7은 실제 경기 기록에 나타나는 이름을 보존했습니다. 주장·후보 여부와 Riot ID는 별도 원본 확인이 필요합니다.</p>`;
}

function stats(event,sort){
 const allowed=['kills','kd','kda'];const field=allowed.includes(sort)?sort:'kills';
 const people=aggregateArchive(event).sort((a,b)=>b[field]-a[field]||b.kills-a.kills||a.name.localeCompare(b.name));
 return `${heading('선수 기록','수록된 플레이오프 4경기만 합산합니다. 참가 경기 수가 다르므로 단순 총 킬 순위를 공식 MVP로 해석하지 않습니다.')}
 <nav class="kov-archive-sort" aria-label="선수 기록 정렬">${[['kills','총 킬순'],['kd','K/D순'],['kda','KDA순']].map(([key,label])=>`<a href="${href(event,'stats',key)}" ${field===key?'aria-current="true"':''}>${label}</a>`).join('')}</nav>
 ${playerTable(event,people)}<p class="kp-meta">K/D = 킬 ÷ 데스 · KDA = (킬 + 어시스트) ÷ 데스 · FK/FD는 첫 킬/첫 데스 합계입니다. 맵별 상세 ACS·ADR·KAST·HS%는 경기 상세에서 확인하세요.</p>`;
}

function sources(event){
 return `${heading('출처와 기록 범위')}<div class="kp-panel kov-archive-note"><p>자료 확인일 ${esc(event.verifiedAt)} · 경기 시간 한국시간(KST)</p><div class="kp-actions">${event.sources.map(s=>external(s.label,s.url)).join('')}${external('당시 포스터',event.posterUrl)}</div><h3>경기별 원문</h3><div class="kp-actions">${event.matches.map(m=>external(m.label,m.source)).join('')}</div><h3>추가 대조가 필요한 기록</h3><ul>${event.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul><p>이 페이지는 공개 경기 기록을 보관한 아카이브입니다. 사이트 운영진이 당시 결과를 직접 검수·확정했다는 의미는 아니며, 결과 제출이나 Discord 알림을 재실행하지 않습니다.</p></div>`;
}

export function renderArchive(event,id,tab='overview',detail=''){
 if(id!==event.id)return '<div class="kp-empty">등록된 과거 대회 기록이 없습니다.</div>';
 const tabs=[['overview','대회 개요'],['bracket','대진표'],['matches','경기 결과'],['teams','출전 명단'],['stats','선수 기록'],['sources','출처·기록 범위']];
 const selected=tab==='match'?'matches':tabs.some(([key])=>key===tab)?tab:'overview';
 let body=tab==='match'?matchDetail(event,detail):selected==='bracket'?bracket(event):selected==='matches'?heading('플레이오프 전체 경기 결과','14경기 승패 · 4경기 상세 통계 (13맵). 스위스 10경기는 대진표 탭에서 확인하세요.')+`<div class="kov-archive-match-grid">${event.matches.map(m=>tile(event,m)).join('')}</div>`:selected==='teams'?rosters(event):selected==='stats'?stats(event,detail):selected==='sources'?sources(event):overview(event);
 return `<section class="kov-archive"><a class="kp-back" href="#kov/tournaments">← 대회 목록</a><header class="kov-archive-hero"><img src="${esc(event.coverUrl)}" alt="" width="1672" height="941"><div><span class="kp-eyebrow">KOV ARCHIVE · 종료</span><h1>${esc(event.name)}</h1><p>${esc(event.range)} · ${esc(event.region)}</p><span>${esc(event.scope)} · 현금 상금 ${money(event.cashPrize)}</span></div></header><nav class="kov-archive-tabs" aria-label="지난 대회 상세">${tabs.map(([key,label])=>`<a href="${href(event,key)}" ${selected===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>${body}</section>`;
}
