import test from 'node:test';
import assert from 'node:assert/strict';
import {ascend2026 as event} from '../lib/kov-ascend-2026.mjs';
import {aggregateArchive,renderArchive} from '../lib/kov-archive-view.mjs';

test('archive preserves complete Swiss and double elimination progression',()=>{
 assert.equal(event.swiss.length,10);assert.equal(event.matches.length,14);assert.equal(event.teams.length,12);
 const records=new Map(event.teams.map(t=>[t.id,{wins:0,losses:0}]));
 for(const match of event.swiss){records.get(match.winnerId).wins++;records.get(match.winnerId===match.teamA?match.teamB:match.teamA).losses++;}
 assert.deepEqual([...records].filter(([,r])=>r.wins===2).map(([id])=>id).sort(),event.swissQualified.slice().sort());
 const losses=new Map(event.teams.map(t=>[t.id,0]));
 for(const m of event.matches)losses.set(m.winnerId===m.teamA?m.teamB:m.teamA,losses.get(m.winnerId===m.teamA?m.teamB:m.teamA)+1);
 // The historical grand final was one BO5, with no bracket reset.
 for(const id of new Set(event.matches.flatMap(m=>[m.teamA,m.teamB])))assert.equal(losses.get(id),['rio','hail'].includes(id)?1:2,id);
 assert.equal(event.matches.find(m=>m.slot==='grand-final').winnerId,event.championId);
});

test('detailed series scores and cumulative statistics agree with source maps',()=>{
 const detailed=event.matches.filter(m=>m.players.length);
 assert.equal(detailed.length,4);assert.equal(detailed.flatMap(m=>m.maps).length,13);
 for(const m of detailed){
  assert.equal(m.maps.filter(map=>map.scoreA>map.scoreB).length,m.scoreA);
  assert.equal(m.maps.filter(map=>map.scoreA<map.scoreB).length,m.scoreB);
  assert.equal(m.players.length,10);
  for(const map of m.maps)assert.equal(map.players.length,10);
  for(const p of m.players)for(const stat of ['kills','deaths','assists'])assert.equal(m.maps.reduce((sum,map)=>sum+map.players.find(mp=>mp.playerId===p.playerId)[stat],0),p[stat],`${m.id} ${p.name} ${stat}`);
 }
 const stats=aggregateArchive(event);assert.equal(stats.length,20);
 const notrant=stats.find(p=>p.name==='notrant');assert.equal(notrant.kills,185);assert.equal(notrant.deaths,135);assert.equal(notrant.assists,92);
});

test('unknown scores remain unknown and all routes are usable and escaped',()=>{
 for(const m of event.matches.filter(m=>!m.players.length)){assert.equal(m.scoreA,null);assert.equal(m.scoreB,null);assert.match(renderArchive(event,event.id,'match',m.id),/점수.*대조/);}
 const bracket=renderArchive(event,event.id,'bracket');
 assert.equal((bracket.match(/class="kov-archive-match"/g)||[]).length,24);
 for(const tab of ['overview','bracket','matches','teams','stats','sources'])assert.doesNotThrow(()=>renderArchive(event,event.id,tab));
 assert.match(renderArchive(event,event.id,'match','780401'),/SET 5/);
 assert.doesNotMatch(bracket,/champion-badge|kov-masters-badge|data-action="(veto|finalize|review-result)"/);
 const escaped=structuredClone(event);escaped.teams[0].name='<img src=x onerror=alert(1)>';
 assert.doesNotMatch(renderArchive(escaped,event.id),/<img src=x/);
 assert.match(renderArchive(event,'missing'),/기록이 없습니다/);
});
