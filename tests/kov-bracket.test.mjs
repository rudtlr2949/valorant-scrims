import test from 'node:test';
import assert from 'node:assert/strict';
import {demoState,applyCommand,bracketDescendants} from '../lib/kov-core.mjs';
import {renderManualBracket} from '../lib/kov-bracket-view.mjs';
const now=Date.parse('2026-11-09T00:00:00Z'),admin={id:'demo-admin',name:'staff',isAdmin:true};let seq=0;
const run=(s,type,payload,actor=admin)=>applyCommand(s,{type,payload},actor,{now,id:p=>`${p}-b${++seq}`}).state;
function fixture(size=32,seedTeams=false){let s=demoState(now);const tid=s.tournaments[0].id;for(const a of s.applications.filter(a=>a.status==='pending'))s=run(s,'reviewApplication',{id:a.id,status:'approved'});s=run(s,'createManualBracket',{tournamentId:tid,size,seedTeams});return {s,tid,teams:s.teams.map(t=>t.id)};}
const rounds=s=>s.matches.filter(m=>m.manualBracket);
test('32/64/128 brackets have the exact full tree and wired SVG geometry',()=>{
  for(const size of [32,64,128]){const {s,tid}=fixture(size);const ms=rounds(s);assert.equal(ms.length,size-1);assert.equal(ms.filter(m=>m.round===1).length,size/2);assert.equal(ms.filter(m=>m.roundSize===2).length,1);assert.ok(ms.every(m=>!m.teamA&&!m.teamB));for(const m of ms.filter(m=>m.sources))assert.ok(m.sources.every(src=>ms.some(p=>p.slot===src.slot&&p.round===m.round-1)));const html=renderManualBracket(s,tid,{isAdmin:true});assert.equal((html.match(/class="kp-ko-match /g)||[]).length,size-1);assert.equal((html.match(/<path d=/g)||[]).length,size/2-1);assert.ok(html.includes('대진표 보기 크기'));}
});
test('placement and winner changes clear only dependent paths, retain other entrants',()=>{
  let {s,teams}=fixture(32);const first=rounds(s).filter(m=>m.round===1);const parent=rounds(s).find(m=>m.round===2&&m.position===0);
  s=run(s,'assignBracketTeams',{matchId:first[0].id,teamA:teams[0],teamB:teams[1]});
  s=run(s,'assignBracketTeams',{matchId:first[1].id,teamA:teams[2],teamB:teams[3]});
  s=run(s,'setBracketResult',{matchId:first[0].id,winnerSide:'A',scoreA:2,scoreB:0});
  s=run(s,'setBracketResult',{matchId:first[1].id,winnerSide:'A',scoreA:2,scoreB:1});
  let p=s.matches.find(m=>m.id===parent.id);assert.equal(p.teamA,teams[0]);assert.equal(p.teamB,teams[2]);
  s=run(s,'setBracketResult',{matchId:p.id,winnerSide:'A',scoreA:2,scoreB:0});assert.ok(bracketDescendants(s,p.id).some(m=>m.teamA===teams[0]));
  s=run(s,'setBracketResult',{matchId:first[0].id,winnerSide:'B',scoreA:0,scoreB:2});p=s.matches.find(m=>m.id===parent.id);assert.equal(p.teamA,teams[1]);assert.equal(p.teamB,teams[2]);assert.equal(p.winnerId,null);assert.ok(bracketDescendants(s,p.id).every(m=>m.winnerId===null&&!m.teamA));
  s=run(s,'clearBracketResult',{matchId:first[0].id});p=s.matches.find(m=>m.id===parent.id);assert.equal(p.teamA,null);assert.equal(p.teamB,teams[2]);
});
test('admin-only operations, duplicate placement, byes and official records are enforced',()=>{
  let {s,tid,teams}=fixture(64);const first=rounds(s).filter(m=>m.round===1),viewer={id:'viewer',name:'viewer',isAdmin:false};
  for(const type of ['createManualBracket','assignBracketTeams','setBracketResult','clearBracketResult'])assert.throws(()=>run(s,type,{tournamentId:tid,matchId:first[0].id,size:32},viewer),/운영진/);
  s=run(s,'assignBracketTeams',{matchId:first[0].id,teamA:teams[0]});assert.throws(()=>run(s,'assignBracketTeams',{matchId:first[1].id,teamA:teams[0]}),/이미 배치/);
  assert.throws(()=>run(s,'setBracketResult',{matchId:first[0].id,winnerSide:'A',scoreA:0,scoreB:0}),/부전승/);
  s=run(s,'setBracketResult',{matchId:first[0].id,winnerSide:'A',scoreA:0,scoreB:0,bye:true});assert.equal(s.matches.find(m=>m.id===first[0].id).winnerId,teams[0]);
  s.submissions.push({id:'official',matchId:first[0].id,status:'confirmed',rows:[]});assert.throws(()=>run(s,'assignBracketTeams',{matchId:first[0].id,teamA:teams[1]}),/확정된 선수 기록/);assert.throws(()=>run(s,'createManualBracket',{tournamentId:tid,size:128,replace:true}),/확정된 선수 기록/);
});
test('pending evidence is rejected on revision and viewers get no editing controls',()=>{
  let {s,tid,teams}=fixture(32,true);const m=rounds(s)[0];s.submissions.push({id:'pending',matchId:m.id,status:'pending'});s=run(s,'assignBracketTeams',{matchId:m.id,teamA:teams[1],teamB:teams[0]});assert.equal(s.submissions[0].status,'rejected');assert.ok(!renderManualBracket(s,tid,{isAdmin:false}).includes('data-action="edit-bracket-match"'));
});
