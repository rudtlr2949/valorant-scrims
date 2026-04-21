갱식
igyeongsig_
🐹

갱식 — 26. 4. 19. 오후 2:42
KEYS *
첨부 파일 형식: archive
valorant-NO-LOOP-FINAL.zip
39.36 KB
갱식 — 26. 4. 19. 오후 2:52
The resource https://discord.com/assets/189422196a4f8b53.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate as value and it is preloaded intentionally.
sentry.71d62a4ae007c740.js:15 AnalyticsTrackImpressionContext function unimplemented
sentry.71d62a4ae007c740.js:15 AnalyticsTrackImpressionContext function unimplemented
갱식 — 26. 4. 19. 오후 2:59
첨부 파일 형식: archive
valorant-PENDING-FIX.zip
39.50 KB
(index):2772 Uncaught TypeError: Cannot read properties of null (reading 'classList')
    at switchTab ((index):2772:54)
    at (index):4662:17
switchTab    @    (index):2772
(anonymous)    @    (index):4662
setTimeout
(anonymous)    @    (index):4659
갱식 — 26. 4. 19. 오후 3:11
첨부 파일 형식: archive
valorant-FIXED-FINAL.zip
40.31 KB
갱식 — 26. 4. 19. 오후 3:22
첨부 파일 형식: archive
valorant-UI-IMPROVED.zip
39.40 KB
갱식 — 26. 4. 19. 오후 3:34
첨부 파일 형식: archive
valorant-HOME-TAB.zip
41.31 KB
갱식 — 26. 4. 19. 오후 3:54
첨부 파일 형식: archive
valorant-UI-V2.zip
42.78 KB
갱식 — 26. 4. 19. 오후 4:02
첨부 파일 형식: archive
valorant-BANNER-FIX.zip
42.78 KB
갱식 — 26. 4. 19. 오후 4:10
첨부 파일 형식: archive
valorant-BANNER-CONTAIN.zip
42.77 KB
갱식 — 26. 4. 19. 오후 4:34
첨부 파일 형식: archive
valorant-STATS-V3.zip
43.02 KB
갱식 — 26. 4. 19. 오후 4:48
첨부 파일 형식: archive
valorant-MATCH-HISTORY.zip
44.14 KB
갱식 — 26. 4. 19. 오후 4:56
첨부 파일 형식: archive
valorant-MATCH-DEBUG.zip
44.50 KB
(index):4133 홈 통계 로드 실패: TypeError: Cannot read properties of null (reading 'style')
    at loadHomeStats ((index):4067:50)
첨부 파일 형식: archive
valorant-NULL-FIX.zip
44.52 KB
갱식 — 26. 4. 19. 오후 5:11
첨부 파일 형식: archive
valorant-20GAMES.zip
44.60 KB
갱식 — 26. 4. 19. 오후 5:37
첨부 파일 형식: archive
valorant-DATE-GROUP.zip
44.99 KB
갱식 — 26. 4. 19. 오후 7:44
첨부 파일 형식: archive
valorant-MATCH-LAYOUT.zip
45.47 KB
첨부 파일 형식: archive
valorant-SYNTAX-FIX.zip
45.47 KB
갱식 — 26. 4. 19. 오후 7:56
첨부 파일 형식: archive
valorant-MATCH-CLEAN.zip
45.38 KB
갱식 — 26. 4. 19. 오후 8:04
첨부 파일 형식: archive
valorant-AGENT-ICON-FIX.zip
45.46 KB
갱식 — 26. 4. 19. 오후 8:20
첨부 파일 형식: archive
valorant-DEBUG-V2.zip
46.14 KB
첨부 파일 형식: archive
valorant-MAP-BG.zip
46.02 KB
갱식 — 26. 4. 19. 오후 8:31
첨부 파일 형식: archive
valorant-ICON-FIXED.zip
46.12 KB
첨부 파일 형식: archive
valorant-FINAL-CLEAN.zip
47.25 KB
갱식 — 26. 4. 19. 오후 8:39
Something went wrong
There was an issue displaying the content.
Please contact us if the error persists.
갱식 — 26. 4. 19. 오후 8:52
첨부 파일 형식: archive
valorant-MAPIMG-API.zip
46.35 KB
갱식 — 오전 10:22
첨부 파일 형식: archive
valorant-MAPIMG-API.zip
46.35 KB
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 404 ()
(색인):4894  ❌ 통계 불러오기 에러: SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON
loadGameStats @ (색인):4894
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 404 ()
(색인):4894  ❌ 통계 불러오기 에러: SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON
loadGameStats @ (색인):4894
(색인):4050 📊 게임 통계 로드: ArmyD9#lol puuid:346909be... region:kr
(색인):4055 📊 API 호출: name=ArmyD9 tag=lol region=kr puuid=346909be
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 404 ()
(색인):4132  홈 통계 로드 실패: Unexpected token 'T', "The page c"... is not valid JSON SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON
갱식 — 오전 10:31
첨부 파일 형식: archive
valorant-MAP-CLEAN.zip
45.78 KB
첨부 파일 형식: archive
valorant-MAPIMG-V2.zip
45.89 KB
갱식 — 오전 10:44
export default async function handler(req, res) {
  const { name, tag, puuid, region } = req.query;
  
  const henrikApiKey = process.env.HENRIK_API_KEY;

  if (!henrikApiKey) {

game-stats.js
12KB
Failed to load resource: the server responded with a status of 500 ()
(색인):4834  ❌ 통계 불러오기 실패: mapImageMap is not defined
loadGameStats @ (색인):4834
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 500 ()
(색인):4834  ❌ 통계 불러오기 실패: mapImageMap is not defined
loadGameStats @ (색인):4834
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 500 ()
(색인):4058 📦 API 응답: false 경기수: undefined 최근경기: undefined
(색인):4063  ❌ API 실패: mapImageMap is not defined
export default async function handler(req, res) {
  const { name, tag, puuid, region } = req.query;
  
  const henrikApiKey = process.env.HENRIK_API_KEY;

  if (!henrikApiKey) {

game-stats.js
12KB
갱식 — 오전 10:53
export default async function handler(req, res) {
  const { name, tag, puuid, region } = req.query;
  
  const henrikApiKey = process.env.HENRIK_API_KEY;

  if (!henrikApiKey) {

game-stats.js
12KB
export default async function handler(req, res) {
  const { name, tag, puuid, region } = req.query;
  const henrikApiKey = process.env.HENRIK_API_KEY;

  if (!henrikApiKey) {
    return res.status(500).json({ success: false, error: 'Henrik API 키 없음' });

game-stats.js
10KB
갱식 — 오전 11:01
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 500 ()
(색인):4875  ❌ 통계 불러오기 에러: SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON
loadGameStats @ (색인):4875
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 500 ()
(색인):4875  ❌ 통계 불러오기 에러: SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON
loadGameStats @ (색인):4875
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 500 ()
(색인):4132  홈 통계 로드 실패: Unexpected token 'A', "A server e"... is not valid JSON SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON
// 맵 이미지 하드코딩 (valorant-api.com UUID 기반)
const MAP_IMAGES = {
  'Ascent':   'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png',
  'Bind':     'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png',
  'Haven':    'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7825ad097fbf/splash.png',
  'Split':    'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png',

game-stats.js
11KB
Failed to load resource: the server responded with a status of 500 ()
(색인):4875  ❌ 통계 불러오기 에러: SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON
loadGameStats @ (색인):4875
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 500 ()
(색인):4875  ❌ 통계 불러오기 에러: SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON
loadGameStats @ (색인):4875
/api/game-stats?name=ArmyD9&tag=lol&puuid=346909be-2154-5e9f-88e4-bbab1ada512d&region=kr:1 


            Failed to load resource: the server responded with a status of 500 ()
(색인):4132  홈 통계 로드 실패: Unexpected token 'A', "A server e"... is not valid JSON SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON
갱식 — 오전 11:08
/var/task/api/game-stats.js:3
🐹
^

SyntaxError: Invalid or unexpected token
    at wrapSafe (node:internal/modules/cjs/loader:1692:18)
    at Module._compile (node:internal/modules/cjs/loader:1735:20)
    at Object..js (node:internal/modules/cjs/loader:1893:10)
    at Module.load (node:internal/modules/cjs/loader:1481:32)
    at Module.<anonymous> (node:internal/modules/cjs/loader:1300:12)
    at /opt/rust/nodejs.js:2:13531
    at Module.hn (/opt/rust/nodejs.js:2:13909)
    at Xe.e.<computed>.Ye._load (/opt/rust/nodejs.js:2:13501)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
Node.js process exited with exit status: 1. The logs above can help with debugging the issue.
export default async function handler(req, res) {
  var name = req.query.name;
  var tag = req.query.tag;
  var puuid = req.query.puuid;
  var region = req.query.region;
  var henrikApiKey = process.env.HENRIK_API_KEY;

game-stats.js
12KB
2026-04-21 02:13:52.768 [error] /var/task/api/game-stats.js:3
🐹
^

SyntaxError: Invalid or unexpected token
    at wrapSafe (node:internal/modules/cjs/loader:1692:18)
    at Module._compile (node:internal/modules/cjs/loader:1735:20)
    at Object..js (node:internal/modules/cjs/loader:1893:10)
    at Module.load (node:internal/modules/cjs/loader:1481:32)
    at Module.<anonymous> (node:internal/modules/cjs/loader:1300:12)
    at /opt/rust/nodejs.js:2:13531
    at Module.hn (/opt/rust/nodejs.js:2:13909)
    at Xe.e.<computed>.Ye._load (/opt/rust/nodejs.js:2:13501)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
Node.js process exited with exit status: 1. The logs above can help with debugging the issue.
갱식 — 오전 11:19
export default async function handler(req, res) {
  var name = req.query.name;
  var tag = req.query.tag;
  var puuid = req.query.puuid;
  var region = req.query.region;
  var henrikApiKey = process.env.HENRIK_API_KEY;

game-stats.js
12KB
﻿
export default async function handler(req, res) {
  var name = req.query.name;
  var tag = req.query.tag;
  var puuid = req.query.puuid;
  var region = req.query.region;
  var henrikApiKey = process.env.HENRIK_API_KEY;

  if (!henrikApiKey) {
    return res.status(500).json({ success: false, error: "Henrik API key missing" });
  }

  var MAP_IMAGES = {
    "Ascent":   "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png",
    "Bind":     "https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png",
    "Haven":    "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7825ad097fbf/splash.png",
    "Split":    "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png",
    "Icebox":   "https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png",
    "Breeze":   "https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png",
    "Fracture": "https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png",
    "Pearl":    "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png",
    "Lotus":    "https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png",
    "Sunset":   "https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39f2a00b33b1/splash.png",
    "Abyss":    "https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png",
    "Drift":    "https://media.valorant-api.com/maps/de28aa9b-4cbe-1003-320e-6cb3ec657ae1/splash.png",
    "District": "https://media.valorant-api.com/maps/690b81c8-4f7f-7046-9b9d-89e8f4ad9b25/splash.png",
    "Kasbah":   "https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png",
    "Piazza":   "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png",
    "Glitch":   "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png"
  };

  var AGENT_ROLES = {
    "Jett":"duelist","Raze":"duelist","Reyna":"duelist","Phoenix":"duelist",
    "Yoru":"duelist","Neon":"duelist","Iso":"duelist","Waylay":"duelist",
    "Brimstone":"controller","Omen":"controller","Viper":"controller",
    "Astra":"controller","Harbor":"controller","Clove":"controller",
    "Killjoy":"sentinel","Cypher":"sentinel","Sage":"sentinel",
    "Chamber":"sentinel","Deadlock":"sentinel","Vyse":"sentinel",
    "Sova":"initiator","Breach":"initiator","Skye":"initiator",
    "KAY/O":"initiator","Fade":"initiator","Gekko":"initiator","Tejo":"initiator"
  };

  var ROLE_NAMES = {
    "duelist":"duelist","controller":"controller","sentinel":"sentinel","initiator":"initiator"
  };

  try {
    var accountRes = await fetch(
      "https://api.henrikdev.xyz/valorant/v1/account/" +
        encodeURIComponent(name) + "/" + encodeURIComponent(tag),
      { headers: { "Authorization": henrikApiKey } }
    );
    if (!accountRes.ok) {
      return res.status(200).json({ success: false, error: "account fetch failed: " + accountRes.status });
    }
    var accountJson = await accountRes.json();
    if (!accountJson.data) {
      return res.status(200).json({ success: false, error: "no account data" });
    }
    var account = accountJson.data;

    var fetchBatch = async function(start) {
      try {
        var r = await fetch(
          "https://api.henrikdev.xyz/valorant/v3/by-puuid/matches/" +
            region + "/" + puuid + "?size=10&start=" + start,
          { headers: { "Authorization": henrikApiKey } }
        );
        if (!r.ok) return [];
        var d = await r.json();
        return Array.isArray(d.data) ? d.data : [];
      } catch(e) { return []; }
    };

    var batches = await Promise.all([fetchBatch(0), fetchBatch(10)]);
    var matches = batches[0].concat(batches[1]);

    var agentStats = {};
    var mapStats = {};
    var totalGames = 0, totalWins = 0;
    var totalKills = 0, totalDeaths = 0, totalAssists = 0;
    var totalHeadshots = 0, totalBodyshots = 0, totalLegshots = 0;
    var totalScore = 0, totalRounds = 0;
    var roleCount = { duelist:0, controller:0, sentinel:0, initiator:0 };
    var recentMatches = [];

    for (var i = 0; i < matches.length; i++) {
      var match = matches[i];
      var players = (match.players && match.players.all_players) ? match.players.all_players : [];
      var me = null;
      for (var j = 0; j < players.length; j++) {
        var p = players[j];
        if (p.name && p.tag &&
            p.name.toLowerCase() === name.toLowerCase() &&
            p.tag.toLowerCase() === tag.toLowerCase()) {
          me = p; break;
        }
      }
      if (!me) continue;

      var isRed = me.team && me.team.toLowerCase() === "red";
      var redWon  = (match.teams && match.teams.red)  ? !!match.teams.red.has_won  : false;
      var blueWon = (match.teams && match.teams.blue) ? !!match.teams.blue.has_won : false;
      var won = isRed ? redWon : blueWon;

      var kills   = (me.stats && me.stats.kills)     ? me.stats.kills     : 0;
      var deaths  = (me.stats && me.stats.deaths)    ? me.stats.deaths    : 0;
      var assists = (me.stats && me.stats.assists)   ? me.stats.assists   : 0;
      var hs      = (me.stats && me.stats.headshots) ? me.stats.headshots : 0;
      var bs      = (me.stats && me.stats.bodyshots) ? me.stats.bodyshots : 0;
      var ls      = (me.stats && me.stats.legshots)  ? me.stats.legshots  : 0;
      var score   = (me.stats && me.stats.score)     ? me.stats.score     : 0;

      var redR  = (match.teams && match.teams.red)  ? (match.teams.red.rounds_won  || 0) : 0;
      var blueR = (match.teams && match.teams.blue) ? (match.teams.blue.rounds_won || 0) : 0;
      var mRounds = redR + blueR;
      var acs = mRounds > 0 ? Math.round(score / mRounds) : 0;
      var shots = hs + bs + ls;
      var hsRate = shots > 0 ? Math.round((hs / shots) * 100) : 0;
      var myR = isRed ? redR : blueR;
      var enR = isRed ? blueR : redR;

      totalGames++;
      if (won) totalWins++;
      totalKills    += kills;
      totalDeaths   += deaths;
      totalAssists  += assists;
      totalHeadshots += hs;
      totalBodyshots += bs;
      totalLegshots  += ls;
      totalScore    += score;
      totalRounds   += mRounds;

      var agent = me.character || "Unknown";
      if (!agentStats[agent]) {
        agentStats[agent] = { games:0, wins:0, kills:0, deaths:0, assists:0, iconUrl:null };
      }
      agentStats[agent].games++;
      if (won) agentStats[agent].wins++;
      agentStats[agent].kills   += kills;
      agentStats[agent].deaths  += deaths;
      agentStats[agent].assists += assists;
      if (!agentStats[agent].iconUrl && me.assets && me.assets.agent) {
        agentStats[agent].iconUrl = me.assets.agent.small || null;
      }
      if (AGENT_ROLES[agent]) roleCount[AGENT_ROLES[agent]]++;

      var mapName = (match.metadata && match.metadata.map) ? match.metadata.map : "Unknown";
      if (!mapStats[mapName]) {
        mapStats[mapName] = { games:0, wins:0, imageUrl: MAP_IMAGES[mapName] || null };
      }
      mapStats[mapName].games++;
      if (won) mapStats[mapName].wins++;

      recentMatches.push({
        won: won,
        map: mapName,
        mapImageUrl: MAP_IMAGES[mapName] || null,
        mode: (match.metadata && match.metadata.mode) ? match.metadata.mode : "",
        agent: agent,
        agentIconUrl: (me.assets && me.assets.agent) ? (me.assets.agent.small || null) : null,
        kills: kills, deaths: deaths, assists: assists,
        acs: acs, hsRate: hsRate,
        kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2),
        plusMinus: kills - deaths,
        score: myR + ":" + enR,
        gameStart: (match.metadata && match.metadata.game_start) ? match.metadata.game_start : 0
      });
    }

    var agentEntries = Object.keys(agentStats).map(function(a) { return [a, agentStats[a]]; });
    agentEntries.sort(function(a,b){ return b[1].games - a[1].games; });
    var topAgents = agentEntries.slice(0,3).map(function(e){
      var a=e[0], s=e[1];
      return {
        agent:a, iconUrl:s.iconUrl, games:s.games,
        winRate: Math.round((s.wins/s.games)*100),
        kd: s.deaths>0 ? (s.kills/s.deaths).toFixed(2) : s.kills.toFixed(2),
        avgKills:   (s.kills/s.games).toFixed(1),
        avgDeaths:  (s.deaths/s.games).toFixed(1),
        avgAssists: (s.assists/s.games).toFixed(1)
      };
    });

    var mapEntries = Object.keys(mapStats).map(function(m){ return [m, mapStats[m]]; });
    mapEntries.sort(function(a,b){ return b[1].wins/b[1].games - a[1].wins/a[1].games; });
    var mapData = mapEntries.map(function(e){
      var m=e[0], s=e[1];
      return { map:m, games:s.games, wins:s.wins, imageUrl:s.imageUrl,
        winRate: Math.round((s.wins/s.games)*100) };
    });

    var totalShots = totalHeadshots + totalBodyshots + totalLegshots;
    var headshotRate = totalShots > 0 ? Math.round((totalHeadshots/totalShots)*100) : 0;
    var acs = totalRounds > 0 ? Math.round(totalScore/totalRounds) : 0;
    var avgAssistRatio = totalKills > 0 ? totalAssists/totalKills : 0;
    var teamplayScore = Math.min(avgAssistRatio*10, 10).toFixed(1);
    var totalRoleGames = roleCount.duelist + roleCount.controller + roleCount.sentinel + roleCount.initiator;
    var roleProficiency = {
      duelist:    totalRoleGames>0 ? Math.round(roleCount.duelist/totalRoleGames*100)    : 0,
      controller: totalRoleGames>0 ? Math.round(roleCount.controller/totalRoleGames*100) : 0,
      sentinel:   totalRoleGames>0 ? Math.round(roleCount.sentinel/totalRoleGames*100)   : 0,
      initiator:  totalRoleGames>0 ? Math.round(roleCount.initiator/totalRoleGames*100)  : 0
    };
    var roleKeys = Object.keys(roleProficiency);
    roleKeys.sort(function(a,b){ return roleProficiency[b]-roleProficiency[a]; });
    var mainRoleKey = roleKeys[0];
    var roleKorean = { duelist:"duelist", controller:"controller", sentinel:"sentinel", initiator:"initiator" };

    return res.status(200).json({
      success: true,
      account: { level:account.account_level, card:account.card, name:account.name, tag:account.tag },
      stats: {
        overall: {
          games:totalGames, wins:totalWins, losses:totalGames-totalWins,
          winRate: totalGames>0 ? Math.round(totalWins/totalGames*100) : 0,
          avgKD: totalDeaths>0 ? (totalKills/totalDeaths).toFixed(2) : totalKills.toFixed(2),
          avgKills:   totalGames>0 ? (totalKills/totalGames).toFixed(1)   : "0",
          avgDeaths:  totalGames>0 ? (totalDeaths/totalGames).toFixed(1)  : "0",
          avgAssists: totalGames>0 ? (totalAssists/totalGames).toFixed(1) : "0",
          headshotRate: headshotRate, acs: acs
        },
        agents: topAgents,
        maps: mapData,
        teamplay: { score:teamplayScore, assistContribution:Math.round(avgAssistRatio*100) },
        roles: {
          proficiency: roleProficiency,
          mainRole: mainRoleKey,
          mainRolePercent: roleProficiency[mainRoleKey]
        }
      },
      recentMatches: recentMatches,
      matchCount: matches.length
    });

  } catch(error) {
    console.error("game-stats error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
game-stats.js
12KB
