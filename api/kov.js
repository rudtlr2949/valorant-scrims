import {createHash,randomUUID} from 'node:crypto';
import {initialState,applyCommand,publicState,getMatch,isParticipant,RuleError,ensure} from '../lib/kov-core.mjs';

const sessions=new Map();
const namespace=()=>process.env.KOV_DATA_NAMESPACE||(process.env.VERCEL_ENV==='preview'?`preview-${process.env.VERCEL_GIT_COMMIT_REF||'local'}`:'production');
const key=suffix=>`kov:{${namespace()}}:${suffix}`;
const configured=()=>!!(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
async function redis(command){
  ensure(configured(),'대회 저장소가 연결되지 않았습니다. Upstash 환경변수를 확인해 주세요.',503);
  const response=await fetch(process.env.UPSTASH_REDIS_REST_URL,{method:'POST',headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});
  ensure(response.ok,'대회 저장소에 연결할 수 없습니다.',503);const json=await response.json();ensure(!json.error,'대회 저장소 명령을 처리할 수 없습니다.',503);return json.result;
}
async function identity(req){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)return null;
  ensure(token.length<250,'유효하지 않은 로그인 토큰입니다.',401);
  const hash=createHash('sha256').update(token).digest('hex');let user=sessions.get(hash);
  if(!user||user.expires<Date.now()){
    const response=await fetch('https://discord.com/api/users/@me',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
    ensure(response.ok,'Discord 로그인이 만료되었습니다. 다시 로그인해 주세요.',401);const d=await response.json();ensure(d.id&&d.username,'Discord 계정을 확인할 수 없습니다.',401);
    const ids=(process.env.KOV_ADMIN_DISCORD_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
    const names=(process.env.KOV_ADMIN_DISCORD_NAMES||(ids.length?'':'igyeongsig_')).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    user={id:d.id,name:d.username,isAdmin:ids.includes(d.id)||names.includes(d.username.toLowerCase()),expires:Date.now()+30000};
    if(sessions.size>500)sessions.clear();sessions.set(hash,user);
  }
  return {id:user.id,name:user.name,isAdmin:user.isAdmin};
}
async function readState(){const raw=await redis(['GET',key('state')]);return {raw,state:raw?JSON.parse(raw):initialState()};}
async function saveState(raw,state){
  const json=JSON.stringify(state);ensure(Buffer.byteLength(json)<5*1024*1024,'데이터 보관 한도에 도달했습니다. 저장소를 확장해 주세요.',503);
  return Number(await redis(['EVAL',"local v=redis.call('GET',KEYS[1]); if (v or '')~=ARGV[1] then return 0 end;redis.call('SET',KEYS[1],ARGV[2]);return 1",1,key('state'),raw||'',json]))===1;
}
async function mutate(callback){for(let i=0;i<4;i++){const {raw,state}=await readState();const result=await callback(state);if(await saveState(raw,result.state))return result;}throw new RuleError('다른 사용자가 먼저 변경했습니다. 새로고침 후 다시 시도해 주세요.',409);}
function validEvidence(image){
  ensure(typeof image==='string'&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image),'PNG·JPEG·WebP 이미지를 첨부해 주세요.');
  const bytes=Buffer.from(image.split(',')[1],'base64');ensure(bytes.length>20&&bytes.length<=650000,'스크린샷은 압축 후 650KB 이하여야 합니다.');
  const valid=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)||(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
  ensure(valid,'지원하지 않는 이미지 형식입니다.');return image;
}
async function sendNotice(id,actor){
  ensure(actor?.isAdmin,'운영진만 알림을 전송할 수 있습니다.',403);const webhook=process.env.KOV_DISCORD_WEBHOOK_URL;
  ensure(webhook&&/^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\//.test(webhook),'Discord 웹훅 환경변수가 연결되지 않았습니다.',503);
  const claimed=await mutate(async s=>{const n=s.notifications.find(n=>n.id===id);ensure(n&&n.status!=='sent','이미 전송되었거나 없는 알림입니다.');ensure(n.status!=='sending','이미 전송 중인 알림입니다.',409);n.status='sending';n.attempts++;n.startedAt=Date.now();s.revision++;return {state:s,output:n};});
  const n=claimed.output;const m=claimed.state.matches.find(m=>m.id===n.matchId);
  const origin=process.env.KOV_PUBLIC_ORIGIN||'https://valorant-scrims.vercel.app';
  const link=`${origin}/#kov/match/${encodeURIComponent(m?.id||'')}`;
  let ok=false;
  try{const response=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:`**${n.title}**\n${m?.rosterA?.name||'TBD'} vs ${m?.rosterB?.name||'TBD'}\n${m?.startsAt||''} · BO${m?.bestOf||3}\n${m?.status==='finished'?`${m.scoreA} : ${m.scoreB}\n`:''}${link}`,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});ok=response.ok;}catch{}
  // Ambiguous timeouts are left for manual review, never blindly resent.
  await mutate(async s=>{const item=s.notifications.find(x=>x.id===id);item.status=ok?'sent':'failed';item.finishedAt=Date.now();s.revision++;return {state:s,output:{}};});
  ensure(ok,'Discord 전송이 실패했습니다. 중복 전송을 피하려면 채널에서 수신 여부를 먼저 확인해 주세요.',502);return {sent:true};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    ensure(['GET','POST'].includes(req.method),'지원하지 않는 요청입니다.',405);
    const query=req.query||Object.fromEntries(new URL(req.url||'/api/kov',`https://${req.headers.host||'localhost'}`).searchParams);
    const actor=await identity(req);
    if(req.method==='GET'){
      if(query.evidence){
        ensure(actor,'로그인이 필요합니다.',401);const {state}=await readState();const sub=state.submissions.find(x=>x.evidenceId===query.evidence);ensure(sub,'증빙 자료를 찾을 수 없습니다.',404);const m=getMatch(state,sub.matchId);ensure(actor.isAdmin||isParticipant(m,actor),'해당 경기 참가자와 운영진만 증빙을 볼 수 있습니다.',403);
        const item=await redis(['GET',key(`evidence:${query.evidence}`)]);ensure(item,'증빙 보관 기간이 만료되었습니다.',404);const evidence=JSON.parse(item);return res.status(200).json({image:evidence.image});
      }
      const state=configured()?(await readState()).state:initialState();
      return res.status(200).json({state:publicState(state,actor),actor,storageReady:configured(),webhookReady:!!process.env.KOV_DISCORD_WEBHOOK_URL});
    }
    ensure(actor,'Discord 로그인이 필요합니다.',401);ensure(configured(),'대회 저장소가 연결되지 않았습니다.',503);
    if(req.headers.origin)ensure(new URL(req.headers.origin).host===req.headers.host,'허용되지 않은 출처입니다.',403);
    const count=await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",1,key(`limit:${actor.id}`)]);ensure(Number(count)<=90,'요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',429);
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;ensure(body&&typeof body.type==='string','잘못된 요청입니다.');
    if(body.type==='sendNotification')return res.status(200).json(await sendNotice(body.payload?.id,actor));
    let evidenceId=null;
    if(body.type==='submitResult'){
      const {state}=await readState();const m=getMatch(state,body.payload?.matchId);ensure([m.rosterA?.captainId,m.rosterB?.captainId].includes(actor.id),'이 경기의 주장만 결과를 제출할 수 있습니다.',403);
      const image=validEvidence(body.payload.image);evidenceId=randomUUID();body.payload.evidenceId=evidenceId;delete body.payload.image;
      await redis(['SET',key(`evidence:${evidenceId}`),JSON.stringify({owner:actor.id,matchId:m.id,image}),'EX',365*86400]);
    }
    try{
      const result=await mutate(async s=>applyCommand(s,body,actor,{id:p=>`${p}-${randomUUID()}`,now:Date.now()}));
      return res.status(200).json({state:publicState(result.state,actor),output:result.output,actor,storageReady:true});
    }catch(error){if(evidenceId)await redis(['DEL',key(`evidence:${evidenceId}`)]).catch(()=>{});throw error;}
  }catch(error){
    const status=error.status||500;
    if(status===500)console.error('KOV request failed:',error.name,'location:',String(error.stack||'').split('\n').slice(1,4).join('\n'));
    return res.status(status).json({error:status===500?'처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.':error.message});
  }
}
