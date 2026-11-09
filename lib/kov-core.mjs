// Shared domain rules. The server is the authority; the browser uses this only in isolated demo mode.
export const MAPS = [
  ['Ascent','7eaecc1b-4337-bbf6-6ab9-04b8f06b3319'],['Bind','2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba'],
  ['Haven','2bee0dc9-4ffe-519b-1cbd-7fbe763a6047'],['Split','d960549e-485c-e861-8d71-aa9d1aed12a2'],
  ['Icebox','e2ad5c54-4114-a870-9641-8ea21279579a'],['Lotus','2fe4ed3a-450a-948b-6d6b-e89a78e680a9'],['Sunset','92584fbe-486a-b1b2-9faa-39b0f486b498']
].map(([name,id])=>({name,image:`https://media.valorant-api.com/maps/${id}/splash.png`}));
export const AGENTS=['Jett','Raze','Reyna','Phoenix','Yoru','Neon','Iso','Sova','Breach','Skye','KAY/O','Fade','Gekko','Brimstone','Omen','Viper','Astra','Harbor','Clove','Killjoy','Cypher','Sage','Chamber','Deadlock','Vyse','기타'];
export class RuleError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const ensure=(condition,message,status=400)=>{if(!condition)throw new RuleError(message,status);};
export const clone=v=>JSON.parse(JSON.stringify(v));
const clean=(v,max=100)=>String(v??'').trim().slice(0,max);
const integer=(v,min=0,max=999)=>Number.isInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export const https=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export const initialState=()=>({schema:2,revision:0,tournaments:[],teams:[],applications:[],matches:[],submissions:[],hall:[],notifications:[],audit:[]});
export function getTournament(s,id){const t=s.tournaments.find(x=>x.id===id);ensure(t,'대회를 찾을 수 없습니다.',404);return t;}
export function getMatch(s,id){const m=s.matches.find(x=>x.id===id);ensure(m,'경기를 찾을 수 없습니다.',404);return m;}
export function application(s,tid,teamId){return s.applications.find(x=>x.tournamentId===tid&&x.teamId===teamId&&x.status==='approved');}
export function matchSide(m,user){if(!user)return null;if(m.rosterA?.captainId===user.id)return 'A';if(m.rosterB?.captainId===user.id)return 'B';return null;}
export function rosterMembers(roster){return roster?.players||[];}
export function activePlayers(m,side){const r=side==='A'?m.rosterA:m.rosterB;const chosen=m.lineups?.[side];return rosterMembers(r).filter(p=>chosen?chosen.includes(p.id):p.slot==='starter');}
export function blankScoreboard(m){return ['A','B'].flatMap(side=>activePlayers(m,side).map(p=>({...p,playerId:p.id,teamId:side==='A'?m.teamA:m.teamB,kills:'',deaths:'',assists:'',agent:'기타',confidence:0,reviewed:false})));}
export function isParticipant(m,user){return !!user&&[m.rosterA,m.rosterB].some(r=>r?.captainId===user.id||rosterMembers(r).some(p=>p.discordId===user.id));}
export function metrics(s,{tournamentId='',season='',teamId='',agent='',map=''}={}){
  const players=new Map();const teams=new Map();
  for(const sub of s.submissions.filter(x=>x.status==='confirmed')){
    const match=s.matches.find(m=>m.id===sub.matchId);const t=match&&s.tournaments.find(x=>x.id===match.tournamentId);
    if(!t||(tournamentId&&t.id!==tournamentId)||(season&&t.season!==season)||(map&&sub.map!==map))continue;
    for(const row of sub.rows){if((teamId&&row.teamId!==teamId)||(agent&&row.agent!==agent))continue;
      const key=row.playerId;const p=players.get(key)||{id:key,riotId:row.riotId,teamId:row.teamId,kills:0,deaths:0,assists:0,games:0,agents:{},maps:{}};
      p.kills+=row.kills;p.deaths+=row.deaths;p.assists+=row.assists;p.games++;p.agents[row.agent]=(p.agents[row.agent]||0)+1;p.maps[sub.map]=(p.maps[sub.map]||0)+1;players.set(key,p);
    }
  }
  for(const m of s.matches.filter(x=>x.status==='finished'&&x.teamB)){
    const t=s.tournaments.find(x=>x.id===m.tournamentId);if(!t||(tournamentId&&t.id!==tournamentId)||(season&&t.season!==season))continue;
    for(const id of [m.teamA,m.teamB]){if(teamId&&teamId!==id)continue;const p=teams.get(id)||{id,wins:0,losses:0,matches:[]};p[id===m.winnerId?'wins':'losses']++;p.matches.push(m.id);teams.set(id,p);}
  }
  return {players:[...players.values()].map(p=>({...p,kd:p.deaths?p.kills/p.deaths:p.kills,kda:p.deaths?(p.kills+p.assists)/p.deaths:p.kills+p.assists})).sort((a,b)=>b.kd-a.kd||b.kills-a.kills),teams:[...teams.values()].sort((a,b)=>b.wins-a.wins||a.losses-b.losses)};
}
export function standings(s,tid){
  const rows=s.applications.filter(a=>a.tournamentId===tid&&a.status==='approved').map((a,i)=>({teamId:a.teamId,name:a.snapshot.name,wins:0,losses:0,opponents:[],bye:false,seed:a.seed||i+1}));
  const byId=new Map(rows.map(r=>[r.teamId,r]));
  for(const m of s.matches.filter(x=>x.tournamentId===tid&&x.stage==='swiss'&&x.status==='finished'))for(const [id,op] of [[m.teamA,m.teamB],[m.teamB,m.teamA]]){const r=byId.get(id);if(!r)continue;r[id===m.winnerId?'wins':'losses']++;if(op)r.opponents.push(op);else r.bye=true;}
  for(const r of rows)r.buchholz=r.opponents.reduce((sum,id)=>sum+(byId.get(id)?.wins||0),0);
  return rows.sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.buchholz-a.buchholz||a.seed-b.seed);
}
export function eligibleForFinal(s,t,teamId){return t.kind!=='FINAL'||s.hall.some(h=>h.year===t.year&&['WINTER','SUMMER'].includes(h.kind)&&h.rankings.slice(0,h.seedSlots||2).some(r=>r.teamId===teamId));}
function validateRoster(input,actor,existing){
  const name=clean(input.name,40);ensure(name.length>=2,'팀 이름은 2자 이상 입력해 주세요.');
  const logo=https(input.logoUrl);ensure(!input.logoUrl||logo,'로고는 HTTPS 이미지 주소를 입력해 주세요.');
  ensure(Array.isArray(input.players)&&input.players.length>=5&&input.players.length<=7,'주전 5명과 후보 최대 2명을 등록해 주세요.');
  const players=input.players.map((p,i)=>({id:existing?.players.find(x=>x.id===p.id)?.id||`${existing?.id||input.teamId||'new'}-p${i+1}`,name:clean(p.name,30),riotId:clean(p.riotId,48),discordId:clean(p.discordId,25),slot:p.slot==='sub'?'sub':'starter'}));
  ensure(players.filter(p=>p.slot==='starter').length===5,'주전은 정확히 5명이어야 합니다.');
  ensure(players.every(p=>p.name&&/^.{2,32}#[\p{L}\p{N}]{2,10}$/u.test(p.riotId)),'선수 이름과 Riot ID(이름#태그)를 확인해 주세요.');
  ensure(new Set(players.map(p=>p.riotId.toLocaleLowerCase())).size===players.length,'Riot ID가 중복되었습니다.');
  ensure(players.every(p=>!p.discordId||/^\d{15,25}$/.test(p.discordId)||p.discordId.startsWith('demo-')),'Discord 사용자 ID는 숫자 ID를 입력해 주세요.');
  const captainId=existing?.captainId||actor.id;
  ensure(players.some(p=>p.discordId===captainId),'주장을 선수 명단에 포함하고 주장 선수의 Discord 사용자 ID를 입력해 주세요.');
  return {name,logoUrl:logo,captainId,captainName:actor.name,players};
}
export function vetoPlan(bestOf,poolSize=7){
  ensure([1,3,5].includes(bestOf)&&poolSize>=bestOf&&poolSize%2===1,'맵 풀과 BO 형식이 올바르지 않습니다.');
  const plan=[];const bans=poolSize-bestOf;const firstBans=bestOf===1?bans:Math.min(2,bans);
  for(let i=0;i<firstBans;i++)plan.push({kind:'ban',side:i%2?'B':'A'});
  for(let i=0;i<bestOf-1;i++){const side=i%2?'B':'A';plan.push({kind:'pick',side});plan.push({kind:'side',side:side==='A'?'B':'A',mapIndex:i});}
  for(let i=firstBans;i<bans;i++)plan.push({kind:'ban',side:(i-firstBans)%2?'B':'A'});
  plan.push({kind:'side',side:'A',mapIndex:bestOf-1,decider:true});return plan;
}
export function currentVeto(m){if(!m.veto||m.veto.complete)return null;return vetoPlan(m.bestOf,m.pool.length)[m.veto.history.length]||null;}
function performVeto(m,value,now){
  const step=currentVeto(m);ensure(step,'완료된 밴픽입니다.');
  if(step.kind==='side'){
    ensure(['attack','defense'].includes(value),'공격 또는 수비를 선택해 주세요.');
    if(step.decider){const available=m.pool.filter(n=>!m.veto.history.some(h=>h.value===n&&['ban','pick'].includes(h.kind)));ensure(available.length===1,'마지막 맵 결정에 실패했습니다.');m.maps.push({name:available[0],pickedBy:'decider'});}
    m.maps[step.mapIndex].startSide={team:step.side,side:value};
  }else{
    ensure(m.pool.includes(value)&&!m.veto.history.some(h=>h.value===value&&['ban','pick'].includes(h.kind)),'이미 선택되었거나 밴된 맵입니다.');
    if(step.kind==='pick')m.maps.push({name:value,pickedBy:step.side});
  }
  m.veto.history.push({...step,value,at:now});m.veto.deadline=now+60000;
  if(m.veto.history.length===vetoPlan(m.bestOf,m.pool.length).length){m.veto.complete=true;m.status='playing';m.veto.deadline=null;}
}
function newMatch(s,t,{teamA=null,teamB=null,stage='swiss',round=1,group='',sources=null,slot='',startsAt=null,bestOf=null},ctx){
  const m={id:ctx.id('match'),tournamentId:t.id,teamA,teamB,rosterA:teamA?clone(application(s,t.id,teamA).snapshot):null,rosterB:teamB?clone(application(s,t.id,teamB).snapshot):null,stage,round,group,slot,sources,startsAt:startsAt||new Date(ctx.now+3600000).toISOString(),bestOf:bestOf||(stage==='grand'?5:t.bestOf),pool:clone(t.mapPool),status:teamA&&teamB?'scheduled':'waiting',checkin:{A:false,B:false},ready:{A:false,B:false},maps:[],veto:null,scoreA:0,scoreB:0,winnerId:null,broadcastUrl:'',history:[]};s.matches.push(m);return m;
}
function advanceBracket(s,tid,ctx){
  const matches=s.matches.filter(m=>m.tournamentId===tid);const t=getTournament(s,tid);
  for(const m of matches.filter(m=>m.sources&&!m.manualBracket&&m.status==='waiting')){
    const sourceMatches=m.sources.map(src=>matches.find(x=>x.slot===src.slot));
    if(sourceMatches.some(x=>!x||x.status!=='finished'))continue;
    if(m.slot==='G2'&&sourceMatches[0].winnerId===sourceMatches[0].teamA){m.status='cancelled';continue;}
    const resolve=(src,match)=>src.result==='winner'?match.winnerId:match.teamA===match.winnerId?match.teamB:match.teamA;
    m.teamA=resolve(m.sources[0],sourceMatches[0]);m.teamB=resolve(m.sources[1],sourceMatches[1]);
    m.rosterA=clone(application(s,t.id,m.teamA).snapshot);m.rosterB=clone(application(s,t.id,m.teamB).snapshot);m.status='scheduled';
  }
}
function enqueue(s,type,title,match,ctx){s.notifications.push({id:ctx.id('notice'),type,title,matchId:match?.id||null,at:ctx.now,status:'pending',attempts:0});}
export const BRACKET_SIZES=[8,16,32,64,128,256];
export function bracketDescendants(s,matchId){
  const first=getMatch(s,matchId);const found=[];const queue=[first.slot];const seen=new Set([first.id]);
  while(queue.length){const slot=queue.shift();for(const m of s.matches.filter(m=>m.manualBracket&&m.bracketId===first.bracketId&&m.sources?.some(x=>x.slot===slot))){if(!seen.has(m.id)){seen.add(m.id);found.push(m);queue.push(m.slot);}}}return found;
}
function assertBracketEditable(s,m){ensure(m.manualBracket,'관리자 편집형 토너먼트 경기가 아닙니다.');ensure(getTournament(s,m.tournamentId).status!=='finished','종료된 대회는 수정할 수 없습니다.',409);}
function resetBracketMatch(s,m,ctx){
  for(const sub of s.submissions.filter(x=>x.matchId===m.id&&x.status==='pending')){sub.status='rejected';sub.note='관리자가 대진 또는 결과를 수정했습니다.';sub.reviewedBy='bracket-admin';sub.reviewedAt=ctx.now;}
  m.scoreA=0;m.scoreB=0;m.winnerId=null;m.manualResult=null;m.checkin={A:false,B:false};m.ready={A:false,B:false};m.maps=[];m.veto=null;delete m.lineups;
  m.status=m.teamA&&m.teamB?'scheduled':'waiting';
}
function invalidateBracket(s,m,ctx,includeSelf=true){
  const descendants=bracketDescendants(s,m.id);const affected=includeSelf?[m,...descendants]:descendants;
  ensure(!s.submissions.some(x=>x.status==='confirmed'&&affected.some(m=>m.id===x.matchId)),'연결된 경기에 이미 확정된 선수 기록이 있습니다. 해당 기록을 먼저 검토해야 대진을 바꿀 수 있습니다.',409);
  const ids=new Set([m.slot]);
  for(const next of descendants){for(let i=0;i<2;i++){if(ids.has(next.sources?.[i]?.slot)){next[i===0?'teamA':'teamB']=null;next[i===0?'rosterA':'rosterB']=null;}}ids.add(next.slot);resetBracketMatch(s,next,ctx);}
  if(includeSelf)resetBracketMatch(s,m,ctx);
}
function bracketRoster(s,m,teamId){if(!teamId)return null;const a=application(s,m.tournamentId,teamId);ensure(a,'이 대회에서 참가 승인된 팀만 배치할 수 있습니다.');return clone(a.snapshot);}
export function applyCommand(source,command,actor,context={}){
  const ctx={now:Date.now(),id:prefix=>`${prefix}-${globalThis.crypto.randomUUID()}`,...context};
  const s=clone(source);const p=command.payload||{};const type=command.type;
  ensure(actor?.id,'Discord 로그인이 필요합니다.',401);
  const admin=()=>ensure(actor.isAdmin,'운영진만 실행할 수 있습니다.',403);
  const captain=m=>{const side=matchSide(m,actor);ensure(side,'이 경기의 주장만 실행할 수 있습니다.',403);return side;};
  const activeTournament=t=>ensure(t.status!=='finished','종료된 대회는 변경할 수 없습니다.',409);
  let output={};
  switch(type){
    case 'saveTeam':{
      const existing=p.id?s.teams.find(t=>t.id===p.id):null;ensure(!p.id||existing,'팀을 찾을 수 없습니다.');ensure(!existing||existing.captainId===actor.id,'팀 주장만 명단을 수정할 수 있습니다.',403);
      const id=existing?.id||ctx.id('team');const team={...validateRoster({...p,teamId:id},actor,existing),id,updatedAt:ctx.now};
      ensure(!s.teams.some(t=>t.id!==id&&t.name.toLowerCase()===team.name.toLowerCase()),'이미 사용 중인 팀 이름입니다.');
      if(existing)s.teams[s.teams.indexOf(existing)]=team;else s.teams.push(team);output.teamId=id;break;
    }
    case 'saveTournament':{
      admin();const old=p.id?s.tournaments.find(t=>t.id===p.id):null;ensure(!p.id||old,'대회를 찾을 수 없습니다.');if(old)activeTournament(old);
      const t={...old,id:old?.id||ctx.id('tournament'),name:clean(p.name,80),year:Number(p.year),kind:p.kind,season:`${p.year} ${p.kind}`,description:clean(p.description,3000),prize:clean(p.prize,100),rules:clean(p.rules,5000),startAt:p.startAt,endAt:p.endAt,deadline:p.deadline,bestOf:Number(p.bestOf),capacity:Number(p.capacity),mapPool:p.mapPool,posterUrl:https(p.posterUrl),broadcastUrl:https(p.broadcastUrl),status:p.status||old?.status||'registration',swissWins:3,swissLosses:3,seedSlots:Number(p.seedSlots)||2};
      ensure(t.name&&integer(t.year,2020,2100)&&['WINTER','SUMMER','FINAL'].includes(t.kind),'대회 이름·연도·시즌을 확인해 주세요.');
      ensure(validDate(t.startAt)&&validDate(t.endAt)&&validDate(t.deadline)&&Date.parse(t.deadline)<=Date.parse(t.startAt)&&Date.parse(t.startAt)<Date.parse(t.endAt),'접수 마감·시작·종료 일정을 확인해 주세요.');
      ensure([1,3,5].includes(t.bestOf)&&BRACKET_SIZES.includes(t.capacity),'BO 형식과 참가 규모(8·16·32·64·128·256팀)를 확인해 주세요.');
      ensure(integer(t.seedSlots,1,4),'시드권은 상위 1~4팀으로 지정해 주세요.');
      ensure(s.applications.filter(a=>a.tournamentId===t.id&&a.status!=='rejected').length<=t.capacity,'현재 참가 신청 수보다 규모를 줄일 수 없습니다.');
      ensure(Array.isArray(t.mapPool)&&t.mapPool.length===7&&new Set(t.mapPool).size===7&&t.mapPool.every(n=>MAPS.some(m=>m.name===n)),'서로 다른 맵 7개를 등록해 주세요.');
      ensure(['draft','registration','ongoing'].includes(t.status),'잘못된 대회 상태입니다.');
      if(old&&s.matches.some(m=>m.tournamentId===old.id))ensure(old.bestOf===t.bestOf&&JSON.stringify(old.mapPool)===JSON.stringify(t.mapPool),'경기 생성 후에는 BO와 맵 풀을 변경할 수 없습니다.');
      if(old)s.tournaments[s.tournaments.indexOf(old)]=t;else s.tournaments.push(t);output.tournamentId=t.id;break;
    }
    case 'apply':{
      const t=getTournament(s,p.tournamentId);ensure(t.status==='registration'&&ctx.now<=Date.parse(t.deadline),'현재 참가 접수 기간이 아닙니다.');
      const team=s.teams.find(x=>x.id===p.teamId);ensure(team&&team.captainId===actor.id,'본인이 주장인 팀만 신청할 수 있습니다.',403);
      ensure(eligibleForFinal(s,t,team.id),'FINAL 참가 시드권이 없는 팀입니다.');
      ensure(!s.applications.some(a=>a.tournamentId===t.id&&a.teamId===team.id&&a.status!=='rejected'),'이미 신청한 팀입니다.');
      const active=s.applications.filter(a=>a.tournamentId===t.id&&a.status!=='rejected');ensure(active.length<t.capacity,'참가 신청이 마감되었습니다.');
      const riotIds=team.players.map(x=>x.riotId.toLowerCase());ensure(!active.some(a=>a.snapshot.players.some(x=>riotIds.includes(x.riotId.toLowerCase()))),'다른 참가 팀 명단과 중복된 선수가 있습니다.');
      const a={id:ctx.id('application'),teamId:team.id,tournamentId:t.id,snapshot:clone(team),status:'pending',submittedAt:ctx.now,seed:active.length+1,note:''};s.applications.push(a);output.applicationId=a.id;break;
    }
    case 'reviewApplication':{
      admin();const a=s.applications.find(a=>a.id===p.id);ensure(a&&a.status==='pending','대기 중인 신청이 아닙니다.');activeTournament(getTournament(s,a.tournamentId));ensure(['approved','rejected'].includes(p.status),'승인 상태를 확인해 주세요.');a.status=p.status;a.note=clean(p.note,300);a.reviewedAt=ctx.now;a.reviewedBy=actor.id;break;
    }
    case 'createManualBracket':{
      admin();const t=getTournament(s,p.tournamentId);activeTournament(t);const size=Number(p.size);ensure(BRACKET_SIZES.includes(size),'8·16·32·64·128·256강 중 선택해 주세요.');
      const old=s.matches.filter(m=>m.tournamentId===t.id&&m.manualBracket);ensure(!old.length||p.replace===true,'이미 생성된 대진표가 있습니다. 재생성을 확인해 주세요.',409);
      ensure(!s.submissions.some(x=>x.status==='confirmed'&&old.some(m=>m.id===x.matchId)),'확정된 선수 기록이 있는 대진표는 재생성할 수 없습니다.',409);
      const approved=s.applications.filter(a=>a.tournamentId===t.id&&a.status==='approved');ensure(approved.length<=size,'승인된 참가 팀보다 큰 대진 규모를 선택해 주세요.');
      const oldIds=new Set(old.map(m=>m.id));s.matches=s.matches.filter(m=>!oldIds.has(m.id));s.submissions=s.submissions.filter(x=>!oldIds.has(x.matchId));
      s.notifications=s.notifications.filter(x=>!oldIds.has(x.matchId));
      const bracketId=ctx.id('bracket');let previous=[];let round=1;
      for(let slots=size;slots>=2;slots/=2,round++){
        const current=[];for(let i=0;i<slots/2;i++){
          const m=newMatch(s,t,{stage:'elimination',round,slot:`${bracketId}-R${round}-M${i+1}`,sources:round===1?null:[{slot:previous[i*2].slot,result:'winner'},{slot:previous[i*2+1].slot,result:'winner'}]},ctx);
          Object.assign(m,{manualBracket:true,bracketId,bracketSize:size,roundSize:slots,position:i});
          if(round===1&&p.seedTeams===true){m.teamA=approved[i*2]?.teamId||null;m.teamB=approved[i*2+1]?.teamId||null;m.rosterA=bracketRoster(s,m,m.teamA);m.rosterB=bracketRoster(s,m,m.teamB);m.status=m.teamA&&m.teamB?'scheduled':'waiting';}
          current.push(m);
        }previous=current;
      }
      t.manualBracket={id:bracketId,size,createdAt:ctx.now};t.bracketMode='manual';t.capacity=Math.max(t.capacity,size);output.bracketId=bracketId;break;
    }
    case 'assignBracketTeams':{
      admin();const m=getMatch(s,p.matchId);assertBracketEditable(s,m);const a=p.teamA||null,b=p.teamB||null;ensure(!a||a!==b,'한 경기에 같은 팀을 두 번 배치할 수 없습니다.');
      const rosterA=bracketRoster(s,m,a),rosterB=bracketRoster(s,m,b);
      ensure(!s.matches.some(x=>x.bracketId===m.bracketId&&x.round===m.round&&x.id!==m.id&&[a,b].filter(Boolean).some(id=>[x.teamA,x.teamB].includes(id))),'같은 라운드의 다른 경기에 이미 배치된 팀입니다.');
      if(m.teamA!==a||m.teamB!==b){invalidateBracket(s,m,ctx);m.teamA=a;m.teamB=b;m.rosterA=rosterA;m.rosterB=rosterB;m.status=a&&b?'scheduled':'waiting';m.history.push({type:'admin-placement',by:actor.id,at:ctx.now});}
      if(p.startsAt){ensure(validDate(p.startsAt),'경기 시간을 확인해 주세요.');m.startsAt=p.startsAt;}break;
    }
    case 'setBracketResult':{
      admin();const m=getMatch(s,p.matchId);assertBracketEditable(s,m);ensure(['A','B'].includes(p.winnerSide),'승리 팀을 선택해 주세요.');const winner=p.winnerSide==='A'?m.teamA:m.teamB;ensure(winner,'승리시킬 팀을 먼저 배치해 주세요.');
      const bye=!(m.teamA&&m.teamB);ensure(!bye||p.bye===true,'상대가 비어 있습니다. 부전승을 명시적으로 선택해 주세요.');
      const scoreA=Number(p.scoreA),scoreB=Number(p.scoreB);ensure(integer(p.scoreA,0,m.bestOf)&&integer(p.scoreB,0,m.bestOf),'세트 스코어를 확인해 주세요.');
      ensure(bye||(p.winnerSide==='A'?scoreA>scoreB:scoreB>scoreA),'승리 팀의 스코어가 더 높아야 합니다.');
      ensure(bye||p.forfeit===true||Math.max(scoreA,scoreB)===Math.ceil(m.bestOf/2),'BO 형식에 맞는 승리 세트 수를 입력하거나 기권승을 선택해 주세요.');
      const sameWinner=m.status==='finished'&&m.winnerId===winner;
      if(!sameWinner)invalidateBracket(s,m,ctx);
      else if(s.submissions.some(x=>x.matchId===m.id&&x.status==='confirmed'))ensure(m.scoreA===scoreA&&m.scoreB===scoreB,'확정된 선수 기록과 다른 스코어로 바꿀 수 없습니다.',409);
      Object.assign(m,{scoreA,scoreB,winnerId:winner,status:'finished',bye,manualResult:{winnerSide:p.winnerSide,loserId:p.winnerSide==='A'?m.teamB:m.teamA,forfeit:p.forfeit===true,note:clean(p.note,500),by:actor.id,at:ctx.now}});
      const next=s.matches.find(x=>x.bracketId===m.bracketId&&x.sources?.some(src=>src.slot===m.slot));
      if(next){const side=next.sources[0].slot===m.slot?'A':'B';ensure(![next[side==='A'?'teamB':'teamA']].includes(winner),'다음 경기의 상대 팀과 중복됩니다. 다음 경기 배치를 먼저 수정해 주세요.');
        ensure(!s.matches.some(x=>x.bracketId===m.bracketId&&x.round===next.round&&x.id!==next.id&&[x.teamA,x.teamB].includes(winner)),'진출시킬 팀이 다음 라운드의 다른 경기에 이미 배치되어 있습니다.');
        if(next[`team${side}`]!==winner){if(sameWinner)invalidateBracket(s,next,ctx);next[`team${side}`]=winner;next[`roster${side}`]=clone(p.winnerSide==='A'?m.rosterA:m.rosterB);next.status=next.teamA&&next.teamB?'scheduled':'waiting';}
      }
      m.history.push({type:'admin-result',winnerId:winner,by:actor.id,at:ctx.now});output.nextMatchId=next?.id||null;enqueue(s,'result','관리자 경기 결과 확정',m,ctx);break;
    }
    case 'clearBracketResult':{
      admin();const m=getMatch(s,p.matchId);assertBracketEditable(s,m);invalidateBracket(s,m,ctx);m.history.push({type:'admin-result-reset',by:actor.id,at:ctx.now});break;
    }
    case 'generateSwiss':{
      admin();const t=getTournament(s,p.tournamentId);activeTournament(t);
      ensure(!s.applications.some(a=>a.tournamentId===t.id&&a.status==='pending'),'대기 중인 참가 신청을 먼저 검토해 주세요.');
      const matches=s.matches.filter(m=>m.tournamentId===t.id&&m.stage==='swiss');ensure(matches.every(m=>m.status==='finished'),'진행 중인 스위스 라운드를 먼저 종료해 주세요.');ensure(!s.matches.some(m=>m.tournamentId===t.id&&m.stage!=='swiss'),'플레이오프가 이미 생성되었습니다.');
      if(!matches.length)ensure([8,16,32].includes(s.applications.filter(a=>a.tournamentId===t.id&&a.status==='approved').length),'첫 라운드는 승인된 8·16·32팀으로 시작할 수 있습니다.');
      let rows=standings(s,t.id).filter(r=>r.wins<t.swissWins&&r.losses<t.swissLosses);ensure(rows.length>=2,'추가 스위스 라운드를 생성할 팀이 없습니다.');
      const round=matches.length?Math.max(...matches.map(m=>m.round))+1:1;
      let bye=null;if(rows.length%2){bye=rows.slice().reverse().find(r=>!r.bye);ensure(bye,'부전승이 중복되지 않도록 수동 편성이 필요합니다.');rows=rows.filter(r=>r!==bye);}
      let attempts=0;function pair(rest){if(!rest.length)return [];if(attempts++>20000)return null;const a=rest[0];const candidates=rest.slice(1).filter(b=>!a.opponents.includes(b.teamId)).sort((a1,b1)=>Math.abs(a1.wins-a.wins)-Math.abs(b1.wins-a.wins));for(const b of candidates){const result=pair(rest.filter(x=>x!==a&&x!==b));if(result)return [[a,b],...result];}return null;}
      const pairs=pair(rows);ensure(pairs,'재대결 없는 조합을 찾을 수 없습니다. 참가 팀 구성을 확인해 주세요.');
      for(const [a,b] of pairs)newMatch(s,t,{teamA:a.teamId,teamB:b.teamId,round,group:`${a.wins}-${a.losses}${a.wins!==b.wins?' · 플로트':''}`},ctx);
      if(bye){const m=newMatch(s,t,{teamA:bye.teamId,round,group:`${bye.wins}-${bye.losses}`},ctx);m.status='finished';m.winnerId=bye.teamId;m.scoreA=1;m.bye=true;}
      t.status='ongoing';break;
    }
    case 'generatePlayoffs':{
      admin();const t=getTournament(s,p.tournamentId);activeTournament(t);ensure(!s.matches.some(m=>m.tournamentId===t.id&&m.stage!=='swiss'),'플레이오프가 이미 생성되었습니다.');
      const sm=s.matches.filter(m=>m.tournamentId===t.id&&m.stage==='swiss');ensure(sm.length&&sm.every(m=>m.status==='finished'),'스위스 경기를 먼저 완료해 주세요.');
      const table=standings(s,t.id);ensure(table.every(r=>r.wins>=t.swissWins||r.losses>=t.swissLosses),'모든 팀의 스위스 일정을 먼저 완료해 주세요.');const qualified=table.filter(r=>r.wins>=t.swissWins).slice(0,4);ensure(qualified.length===4,'스위스를 통과한 상위 4팀이 필요합니다.');
      newMatch(s,t,{teamA:qualified[0].teamId,teamB:qualified[3].teamId,stage:'upper',slot:'U1'},ctx);newMatch(s,t,{teamA:qualified[1].teamId,teamB:qualified[2].teamId,stage:'upper',slot:'U2'},ctx);
      for(const [slot,stage,sources] of [['U3','upper',[['U1','winner'],['U2','winner']]],['L1','lower',[['U1','loser'],['U2','loser']]],['L2','lower',[['L1','winner'],['U3','loser']]],['G1','grand',[['U3','winner'],['L2','winner']]],['G2','grand',[['G1','loser'],['G1','winner']]]])newMatch(s,t,{stage,slot,sources:sources.map(([slot,result])=>({slot,result})),round:slot==='U3'||slot==='L2'?2:1},ctx);
      break;
    }
    case 'schedule':{
      admin();const m=getMatch(s,p.matchId);ensure(!['finished','cancelled'].includes(m.status),'종료된 경기는 일정을 변경할 수 없습니다.');ensure(validDate(p.startsAt),'유효한 시간을 입력해 주세요.');m.startsAt=p.startsAt;m.broadcastUrl=https(p.broadcastUrl);m.history.push({type:'schedule',at:ctx.now,by:actor.id});enqueue(s,'schedule','경기 일정 안내',m,ctx);break;
    }
    case 'setLineup':{
      const m=getMatch(s,p.matchId);const side=captain(m);ensure(m.status==='scheduled'&&!m.ready[side],'경기 준비 완료 전에만 출전 명단을 바꿀 수 있습니다.');
      const r=side==='A'?m.rosterA:m.rosterB;ensure(Array.isArray(p.playerIds)&&p.playerIds.length===5&&new Set(p.playerIds).size===5&&p.playerIds.every(id=>r.players.some(x=>x.id===id)),'참가 당시 주전·후보 명단에서 출전 선수 5명을 선택해 주세요.');
      m.lineups||={};m.lineups[side]=p.playerIds;break;
    }
    case 'checkin':case 'ready':{
      const m=getMatch(s,p.matchId);const side=captain(m);ensure(m.status==='scheduled','경기 준비 단계에서만 변경할 수 있습니다.');
      const start=Date.parse(m.startsAt);ensure(ctx.now>=start-30*60000&&ctx.now<=start+30*60000,'체크인은 경기 시작 30분 전부터 30분 후까지 가능합니다.');
      if(type==='checkin')m.checkin[side]=true;else {ensure(m.checkin[side],'먼저 체크인해 주세요.');m.ready[side]=!m.ready[side];}break;
    }
    case 'startVeto':{
      const m=getMatch(s,p.matchId);captain(m);ensure(m.status==='scheduled'&&m.ready.A&&m.ready.B,'양 팀 체크인과 준비 완료가 필요합니다.');m.status='veto';m.veto={history:[],deadline:ctx.now+60000,complete:false};enqueue(s,'veto','맵 밴픽 시작',m,ctx);break;
    }
    case 'veto':case 'vetoTimeout':{
      const m=getMatch(s,p.matchId);ensure(m.status==='veto','밴픽 진행 중인 경기가 아닙니다.');const side=captain(m);const step=currentVeto(m);
      if(type==='vetoTimeout'){ensure(ctx.now>=m.veto.deadline,'아직 선택 시간이 남아 있습니다.');const value=step.kind==='side'?'attack':m.pool.find(n=>!m.veto.history.some(h=>h.value===n));performVeto(m,value,ctx.now);m.veto.history.at(-1).timeout=true;}
      else {ensure(side===step.side,'상대 팀의 차례입니다.',403);ensure(ctx.now<m.veto.deadline,'선택 시간이 만료되었습니다. 시간 초과 처리를 눌러 주세요.');performVeto(m,p.value,ctx.now);}break;
    }
    case 'submitResult':{
      const m=getMatch(s,p.matchId);captain(m);ensure(['playing','review'].includes(m.status),'밴픽 완료 후 결과를 제출할 수 있습니다.');
      ensure(integer(p.mapIndex,0,m.bestOf-1)&&m.maps[p.mapIndex],'해당 세트의 맵이 없습니다.');const mapIndex=Number(p.mapIndex);
      ensure(!s.submissions.some(x=>x.matchId===m.id&&x.mapIndex===mapIndex&&x.status!=='rejected'),'이미 제출된 세트입니다.');
      ensure(mapIndex===m.maps.filter(x=>x.result).length,'앞 세트 결과가 확정된 후 다음 세트를 제출해 주세요.');
      ensure(integer(p.roundA,0,60)&&integer(p.roundB,0,60),'라운드 스코어를 확인해 주세요.');const a=Number(p.roundA),b=Number(p.roundB),hi=Math.max(a,b),lo=Math.min(a,b);ensure((hi===13&&lo<=11)||(hi>=14&&hi-lo===2),'13라운드 선승 또는 연장전 2라운드 차 승리 스코어를 입력해 주세요.');
      const starters=[...activePlayers(m,'A').map(x=>({...x,teamId:m.teamA})),...activePlayers(m,'B').map(x=>({...x,teamId:m.teamB}))];
      ensure(Array.isArray(p.rows)&&p.rows.length===10&&new Set(p.rows.map(x=>x.playerId)).size===10,'양 팀 주전 10명의 기록이 필요합니다.');
      const rows=p.rows.map(r=>{const player=starters.find(x=>x.id===r.playerId);ensure(player,'대회 참가 명단에 없는 선수입니다.');ensure(['kills','deaths','assists'].every(k=>r[k]!==''&&integer(r[k],0,99)),'K/D/A는 0~99 정수로 입력해 주세요.');ensure(AGENTS.includes(r.agent),'요원을 선택해 주세요.');ensure(r.reviewed===true,'모든 선수의 인식 결과를 직접 확인해 주세요.');return {playerId:player.id,riotId:player.riotId,teamId:player.teamId,agent:r.agent,kills:Number(r.kills),deaths:Number(r.deaths),assists:Number(r.assists),reviewed:true,confidence:Number(r.confidence)||0};});
      ensure(p.evidenceId,'결과 스크린샷을 첨부해 주세요.');
      s.submissions.push({id:ctx.id('result'),matchId:m.id,mapIndex,map:m.maps[mapIndex].name,roundA:a,roundB:b,rows,evidenceId:clean(p.evidenceId,100),submittedBy:actor.id,submittedAt:ctx.now,status:'pending',note:''});m.status='review';break;
    }
    case 'reviewResult':{
      admin();const sub=s.submissions.find(x=>x.id===p.id);ensure(sub&&sub.status==='pending','검수 대기 중인 결과가 아닙니다.');const m=getMatch(s,sub.matchId);ensure(['confirmed','rejected'].includes(p.status),'검수 상태를 확인해 주세요.');sub.status=p.status;sub.note=clean(p.note,500);sub.reviewedBy=actor.id;sub.reviewedAt=ctx.now;
      if(p.status==='rejected'){m.status='playing';break;}
      ensure(!m.maps[sub.mapIndex].result,'이미 확정된 세트입니다.');m.maps[sub.mapIndex].result={roundA:sub.roundA,roundB:sub.roundB,submissionId:sub.id};m[sub.roundA>sub.roundB?'scoreA':'scoreB']++;
      if(Math.max(m.scoreA,m.scoreB)>=Math.ceil(m.bestOf/2)){m.status='finished';m.winnerId=m.scoreA>m.scoreB?m.teamA:m.teamB;advanceBracket(s,m.tournamentId,ctx);enqueue(s,'result','경기 결과 확정',m,ctx);}else m.status='playing';break;
    }
    case 'finalizeTournament':{
      admin();const t=getTournament(s,p.tournamentId);activeTournament(t);const matches=s.matches.filter(m=>m.tournamentId===t.id);const g2=matches.find(m=>m.slot==='G2');const grand=g2?.status==='finished'?g2:matches.find(m=>m.slot==='G1');ensure(grand?.status==='finished'&&g2&&['finished','cancelled'].includes(g2.status),'그랜드 파이널(필요 시 리셋 경기)까지 완료해야 합니다.');
      const loser=m=>m.teamA===m.winnerId?m.teamB:m.teamA;const l2=matches.find(m=>m.slot==='L2'),l1=matches.find(m=>m.slot==='L1');
      const ranked=[grand.winnerId,loser(grand),loser(l2),loser(l1)];const stats=metrics(s,{tournamentId:t.id}).players;const mvp=stats.find(x=>x.id===p.mvpId)||stats.slice().sort((a,b)=>b.kda-a.kda||b.kills-a.kills)[0];ensure(mvp,'확정된 선수 기록이 필요합니다.');
      s.hall.push({id:ctx.id('hall'),tournamentId:t.id,name:t.name,year:t.year,kind:t.kind,season:t.season,seedSlots:t.seedSlots,at:ctx.now,mvp:clone(mvp),rankings:ranked.map((teamId,i)=>({rank:i+1,teamId,teamName:application(s,t.id,teamId).snapshot.name}))});t.status='finished';break;
    }
    default:throw new RuleError('지원하지 않는 동작입니다.');
  }
  s.revision++;s.audit.push({id:ctx.id('audit'),type,by:actor.id,name:actor.name,at:ctx.now,matchId:p.matchId||null,tournamentId:p.tournamentId||null});
  ensure(s.audit.length<50000,'감사 로그 보관 한도를 초과했습니다. 저장소 확장이 필요합니다.');return {state:s,output};
}
export function publicState(source,actor){
  const s=clone(source);const admin=!!actor?.isAdmin;
  s.applications=s.applications.filter(a=>a.status==='approved'||admin||a.snapshot.captainId===actor?.id);
  s.submissions=s.submissions.filter(sub=>sub.status==='confirmed'||admin||isParticipant(s.matches.find(m=>m.id===sub.matchId),actor));
  if(!admin){s.notifications=[];s.audit=[];}
  // Public roster snapshots retain Riot IDs, not account identifiers.
  if(!actor){for(const t of [...s.teams,...s.applications.map(a=>a.snapshot),...s.matches.flatMap(m=>[m.rosterA,m.rosterB]).filter(Boolean)]){delete t.captainId;for(const p of t.players)delete p.discordId;}}
  return s;
}
export function demoState(now=Date.now()){
  let s=initialState();let counter=0;const ctx={now,id:p=>`demo-${p}-${++counter}`};const admin={id:'demo-admin',name:'운영진 체험',isAdmin:true};
  s=applyCommand(s,{type:'saveTournament',payload:{name:'KOV 2026 WINTER INVITATIONAL',year:2026,kind:'WINTER',description:'새로운 챔피언이 탄생하는 무대. 스위스 스테이지를 통과한 4개 팀이 더블 엘리미네이션에서 최종 우승에 도전합니다.',prize:'총 상금 1,000,000원 · 체험용 예시',rules:'5인 팀, 후보 최대 2명 / 스위스 3승 진출·3패 탈락 / 4강 더블 엘리미네이션 / BO3, 결승 BO5 / 그랜드 파이널 브래킷 리셋 적용 / 경기 30분 전 체크인',startAt:new Date(now+86400000).toISOString(),endAt:new Date(now+8*86400000).toISOString(),deadline:new Date(now+3600000).toISOString(),bestOf:3,capacity:8,mapPool:MAPS.map(m=>m.name),status:'registration'}},admin,ctx).state;
  const tid=s.tournaments[0].id;const names=['ECLIPSE','PHANTOM','ORBIT','NOVA','APEX','RE:BORN','THUNDER','IRON WALL'];
  for(let i=0;i<8;i++){
    const user={id:`demo-captain-${i}`,name:`${names[i]} 주장`,isAdmin:false};
    const players=Array.from({length:5},(_,j)=>({name:['NOVA','LUCID','ZERO','REX','ACE'][j],riotId:`${names[i].replace(/[^A-Z]/g,'')}${j+1}#KOV`,discordId:j===0?user.id:`demo-player-${i}-${j}`,slot:'starter'}));
    const saved=applyCommand(s,{type:'saveTeam',payload:{name:names[i],players}},user,ctx);s=saved.state;
    const applied=applyCommand(s,{type:'apply',payload:{tournamentId:tid,teamId:saved.output.teamId}},user,ctx);s=applied.state;
    if(i<6)s=applyCommand(s,{type:'reviewApplication',payload:{id:applied.output.applicationId,status:'approved'}},admin,ctx).state;
  }
  // First round is a separate fixture so the demo still includes approval-pending teams.
  const t=s.tournaments[0];for(let i=0;i<3;i++){const a=s.applications[i*2],b=s.applications[i*2+1];newMatch(s,t,{teamA:a.teamId,teamB:b.teamId,round:1,group:'0-0',startsAt:new Date(now+10*60000+i*60000).toISOString()},ctx);}
  s.matches[0].checkin={A:true,B:true};s.matches[0].ready={A:true,B:true};
  s.hall.push({id:'demo-hall',tournamentId:'demo-summer',name:'KOV 2026 SUMMER',year:2026,kind:'SUMMER',season:'2026 SUMMER',seedSlots:2,at:now-90*86400000,mvp:{riotId:'ECLIPSE1#KOV',id:s.teams[0].players[0].id},rankings:s.teams.slice(0,4).map((team,i)=>({rank:i+1,teamId:team.id,teamName:team.name}))});return s;
}
// Match a scoreboard line conservatively. Every row still requires human confirmation.
export function parseScoreboard(text,players){
  const lines=String(text).split(/\r?\n/);return players.map(p=>{
    const name=p.riotId.split('#')[0].toLowerCase().replace(/\s/g,'');
    const line=lines.find(l=>l.toLowerCase().replace(/\s/g,'').includes(name));
    if(!line)return {...p,kills:'',deaths:'',assists:'',agent:'기타',confidence:0,reviewed:false};
    const triple=line.match(/\b(\d{1,2})\s*[/|]\s*(\d{1,2})\s*[/|]\s*(\d{1,2})\b/);
    const agent=AGENTS.find(a=>a!=='기타'&&line.toLowerCase().includes(a.toLowerCase()))||'기타';
    return {...p,kills:triple?Number(triple[1]):'',deaths:triple?Number(triple[2]):'',assists:triple?Number(triple[3]):'',agent,confidence:triple?80:25,reviewed:false};
  });
}
