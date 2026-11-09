import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/kov.js';

const request=async(method,body,token,query)=>{
  const req={method,body,query,headers:{host:'kov.test',origin:'https://kov.test',...(token?{authorization:'Bearer '+token}:{})}};
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(body){this.body=body;return this;}};
  await handler(req,res);return res;
};
test('API fails closed without storage and never trusts client-side admin flags',async()=>{
  const original=global.fetch;const prev={...process.env};const db=new Map();let lastStateKey='';
  try{
    delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
    let response=await request('GET');assert.equal(response.code,200);assert.equal(response.body.storageReady,false);
    response=await request('POST',{type:'saveTournament',isAdmin:true});assert.equal(response.code,401);
    process.env.UPSTASH_REDIS_REST_URL='https://redis.test';process.env.UPSTASH_REDIS_REST_TOKEN='test-only';process.env.VERCEL_ENV='preview';process.env.VERCEL_GIT_COMMIT_REF='test-branch';process.env.KOV_ADMIN_DISCORD_IDS='123456789012345678';
    global.fetch=async(url,options)=>{
      if(url==='https://discord.com/api/users/@me')return new Response(JSON.stringify(options.headers.Authorization==='Bearer admin-test'?{id:'123456789012345678',username:'staff'}:{id:'999999999999999999',username:'viewer'}),{status:200});
      assert.equal(url,'https://redis.test');const cmd=JSON.parse(options.body);let result=null;
      if(cmd[0]==='GET'){lastStateKey=cmd[1];result=db.get(cmd[1])||null;}
      if(cmd[0]==='SET'){db.set(cmd[1],cmd[2]);result='OK';}
      if(cmd[0]==='DEL'){db.delete(cmd[1]);result=1;}
      if(cmd[0]==='EVAL'){if(cmd[1].includes('INCR'))result=1;else if((db.get(cmd[3])||'')===cmd[4]){db.set(cmd[3],cmd[5]);result=1;}else result=0;}
      return new Response(JSON.stringify({result}),{status:200});
    };
    response=await request('POST',{type:'generateSwiss',payload:{},actor:{isAdmin:true}},'viewer-test');assert.equal(response.code,403);
    response=await request('GET',undefined,'admin-test');assert.equal(response.body.actor.isAdmin,true);assert.ok(lastStateKey.includes('preview-test-branch'));
    const start=Date.now()+86400000;
    response=await request('POST',{type:'saveTournament',payload:{name:'API test',year:2026,kind:'WINTER',startAt:new Date(start).toISOString(),endAt:new Date(start+86400000).toISOString(),deadline:new Date(start-60000).toISOString(),bestOf:3,capacity:8,mapPool:['Ascent','Bind','Haven','Split','Icebox','Lotus','Sunset']}},'admin-test');
    assert.equal(response.code,200);assert.equal(response.body.state.tournaments.length,1);
    const saved=response.body.state.tournaments[0];response=await request('GET');assert.equal(response.body.state.tournaments[0].id,saved.id);assert.equal(response.body.state.audit.length,0);
    response=await request('POST',{type:'submitResult',payload:{matchId:'missing',image:'not-an-image'}},'viewer-test');assert.equal(response.code,404);
    global.fetch=async()=>{throw new TypeError('fetch failed');};
    response=await request('GET');assert.equal(response.code,200);assert.equal(response.body.storageReady,false);assert.ok(response.body.storageError.includes('Upstash'));
    response=await request('POST',{type:'generateSwiss',payload:{}},'admin-test');assert.equal(response.code,503);
  }finally{global.fetch=original;for(const k of Object.keys(process.env))if(!(k in prev))delete process.env[k];Object.assign(process.env,prev);}
});
