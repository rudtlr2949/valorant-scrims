import test from 'node:test';
import assert from 'node:assert/strict';
import {demoState,applyCommand,currentVeto,standings,metrics,eligibleForFinal,parseScoreboard,publicState,blankScoreboard} from '../lib/kov-core.mjs';

const now=Date.parse('2026-11-08T12:00:00Z');
const admin={id:'demo-admin',name:'운영진',isAdmin:true};
let n=0;const ctx={now,id:p=>`test-${p}-${++n}`};
const command=(s,type,payload,actor=admin)=>applyCommand(s,{type,payload},actor,ctx).state;
const captain=(s,mid,side)=>{const r=s.matches.find(m=>m.id===mid)[`roster${side}`];return {id:r.captainId,name:r.captainName,isAdmin:false};};
function completeMatch(source,mid,winner='A'){
  let s=source;s=command(s,'schedule',{matchId:mid,startsAt:new Date(now).toISOString()});
  for(const side of ['A','B']){s=command(s,'checkin',{matchId:mid},captain(s,mid,side));s=command(s,'ready',{matchId:mid},captain(s,mid,side));}
  s=command(s,'startVeto',{matchId:mid},captain(s,mid,'A'));
  while(s.matches.find(m=>m.id===mid).status==='veto'){
    const m=s.matches.find(m=>m.id===mid),step=currentVeto(m);const value=step.kind==='side'?'attack':m.pool.find(n=>!m.veto.history.some(h=>h.value===n));
    s=command(s,'veto',{matchId:mid,value},captain(s,mid,step.side));
  }
  let m=s.matches.find(m=>m.id===mid);
  while(m.status!=='finished'){
    const rows=blankScoreboard(m).map(p=>({...p,agent:'Jett',kills:20,deaths:12,assists:5,reviewed:true,confidence:91}));
    s=command(s,'submitResult',{matchId:mid,mapIndex:m.maps.filter(x=>x.result).length,roundA:winner==='A'?13:7,roundB:winner==='B'?13:7,rows,evidenceId:'fixture-evidence'},captain(s,mid,'A'));
    const sub=s.submissions.at(-1);s=command(s,'reviewResult',{id:sub.id,status:'confirmed'});m=s.matches.find(m=>m.id===mid);
  }
  return s;
}
test('registration snapshots remain immutable after current roster edits',()=>{
  let s=demoState(now);const team=s.teams[0],snapshot=structuredClone(s.applications[0].snapshot);const actor={id:team.captainId,name:'Changed',isAdmin:false};
  s=command(s,'saveTeam',{...team,name:'NEW NAME',players:team.players.map((p,i)=>({...p,riotId:i===1?'NewNickname#KOV':p.riotId}))},actor);
  assert.equal(s.teams[0].name,'NEW NAME');assert.deepEqual(s.applications[0].snapshot,snapshot);assert.equal(s.matches[0].rosterA.name,snapshot.name);
});
test('server rules reject unauthorized approval, draft actions and duplicate applications',()=>{
  const s=demoState(now),m=s.matches[0],a=s.applications.find(a=>a.status==='pending');
  assert.throws(()=>command(s,'reviewApplication',{id:a.id,status:'approved'},captain(s,m.id,'A')),/운영진/);
  assert.throws(()=>command(s,'apply',{teamId:m.teamA,tournamentId:m.tournamentId},captain(s,m.id,'A')),/이미 신청/);
  let v=command(s,'startVeto',{matchId:m.id},captain(s,m.id,'A'));
  assert.throws(()=>command(v,'veto',{matchId:m.id,value:'Ascent'},captain(v,m.id,'B')),/상대 팀/);
  assert.throws(()=>command(v,'vetoTimeout',{matchId:m.id},captain(v,m.id,'A')),/시간이 남아/);
  assert.equal(v.matches[0].veto.history.length,0);
});
test('complete Swiss → upper/lower playoffs → grand final reset → archive and FINAL seeds',()=>{
  let s=demoState(now);s.matches=[];s.hall=[];const tid=s.tournaments[0].id;
  for(const a of s.applications.filter(a=>a.status==='pending'))s=command(s,'reviewApplication',{id:a.id,status:'approved'});
  for(let round=0;round<6;round++){
    const active=standings(s,tid).filter(r=>r.wins<3&&r.losses<3);if(!active.length)break;
    s=command(s,'generateSwiss',{tournamentId:tid});
    for(const m of s.matches.filter(m=>m.status==='scheduled'))s=completeMatch(s,m.id);
  }
  const table=standings(s,tid);assert.equal(table.filter(r=>r.wins===3).length,4);assert.equal(table.filter(r=>r.losses===3).length,4);
  for(const row of table)assert.equal(row.opponents.length,new Set(row.opponents).size,'No Swiss rematches');
  s=command(s,'generatePlayoffs',{tournamentId:tid});
  for(const slot of ['U1','U2','U3','L1','L2','G1','G2']){const m=s.matches.find(m=>m.slot===slot);assert.equal(m.status,'scheduled',slot+' has two resolved entrants');s=completeMatch(s,m.id,slot==='G1'?'B':'A');}
  const g2=s.matches.find(m=>m.slot==='G2');assert.equal(g2.status,'finished');
  const before=metrics(s,{tournamentId:tid});assert.ok(before.players.length>=40);assert.ok(before.players.every(p=>p.kills>0&&p.kda>0));
  s=command(s,'finalizeTournament',{tournamentId:tid});assert.equal(s.hall[0].rankings[0].teamId,g2.winnerId);assert.equal(s.hall[0].rankings.length,4);assert.equal(s.tournaments[0].status,'finished');
  assert.equal(eligibleForFinal(s,{kind:'FINAL',year:2026},s.hall[0].rankings[0].teamId),true);assert.equal(eligibleForFinal(s,{kind:'FINAL',year:2027},s.hall[0].rankings[0].teamId),false);
  assert.throws(()=>command(s,'finalizeTournament',{tournamentId:tid}),/종료된/);
});
test('unconfirmed results do not enter statistics and uncertain OCR never fabricates numbers',()=>{
  const s=demoState(now);assert.equal(metrics(s).players.length,0);const players=s.teams[0].players;
  const parsed=parseScoreboard(players[0].riotId+' Jett 21 / 12 / 5\nunrelated 99 99 99',players);
  assert.equal(parsed[0].kills,21);assert.equal(parsed[0].reviewed,false);assert.equal(parsed[1].kills,'');assert.equal(parsed[1].confidence,0);
  const pub=publicState(s,null);assert.equal(pub.notifications.length,0);assert.equal(pub.audit.length,0);assert.ok(pub.applications.every(a=>a.status==='approved'));assert.equal(pub.teams[0].captainId,undefined);
});
