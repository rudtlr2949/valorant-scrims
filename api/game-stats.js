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
﻿
export default async function handler(req, res) {
  const { name, tag, puuid, region } = req.query;
  const henrikApiKey = process.env.HENRIK_API_KEY;

  if (!henrikApiKey) {
    return res.status(500).json({ success: false, error: 'Henrik API 키 없음' });
  }

  try {
    // 1. 맵 이미지 URL 로드
    const mapImageMap = {};
    try {
      const mapRes = await fetch('https://valorant-api.com/v1/maps');
      const mapJson = await mapRes.json();
      (mapJson.data || []).forEach(m => {
        if (m.displayName && m.splash) mapImageMap[m.displayName] = m.splash;
      });
    } catch (_) {}

    // 2. 계정 정보
    const accountRes = await fetch(
      'https://api.henrikdev.xyz/valorant/v1/account/' + encodeURIComponent(name) + '/' + encodeURIComponent(tag),
      { headers: { Authorization: henrikApiKey } }
    );
    if (!accountRes.ok) return res.status(200).json({ success: false, error: '계정 조회 실패' });
    const accountJson = await accountRes.json();
    if (!accountJson.data) return res.status(200).json({ success: false, error: '계정 데이터 없음' });
    const account = accountJson.data;

    // 3. 최근 경기 20개
    const fetchBatch = async (start) => {
      try {
        const r = await fetch(
          'https://api.henrikdev.xyz/valorant/v3/by-puuid/matches/' + region + '/' + puuid + '?size=10&start=' + start,
          { headers: { Authorization: henrikApiKey } }
        );
        if (!r.ok) return [];
        const d = await r.json();
        return d.data || [];
      } catch (_) { return []; }
    };
    const [batch1, batch2] = await Promise.all([fetchBatch(0), fetchBatch(10)]);
    const matches = [...batch1, ...batch2];

    // 4. 통계 계산
    const agentStats = {};
    const mapStats = {};
    let totalGames = 0, totalWins = 0;
    let totalKills = 0, totalDeaths = 0, totalAssists = 0;
    let totalHeadshots = 0, totalBodyshots = 0, totalLegshots = 0;
    let totalScore = 0, totalRounds = 0;
    const roleCount = { duelist: 0, controller: 0, sentinel: 0, initiator: 0 };
    const agentRoles = {
      Jett:'duelist', Raze:'duelist', Reyna:'duelist', Phoenix:'duelist',
      Yoru:'duelist', Neon:'duelist', Iso:'duelist',
      Brimstone:'controller', Omen:'controller', Viper:'controller',
      Astra:'controller', Harbor:'controller', Clove:'controller',
      Killjoy:'sentinel', Cypher:'sentinel', Sage:'sentinel',
      Chamber:'sentinel', Deadlock:'sentinel', Vyse:'sentinel',
      Sova:'initiator', Breach:'initiator', Skye:'initiator',
      'KAY/O':'initiator', Fade:'initiator', Gekko:'initiator',
      Tejo:'initiator', Waylay:'duelist'
    };
    const recentMatches = [];

    for (const match of matches) {
      const players = match.players && match.players.all_players ? match.players.all_players : [];
      const me = players.find(function(p) {
        return p.name && p.tag &&
          p.name.toLowerCase() === name.toLowerCase() &&
          p.tag.toLowerCase() === tag.toLowerCase();
      });
      if (!me) continue;

      const redWon  = match.teams && match.teams.red  ? match.teams.red.has_won  : false;
      const blueWon = match.teams && match.teams.blue ? match.teams.blue.has_won : false;
      const won = (me.team && me.team.toLowerCase() === 'red') ? redWon : blueWon;

      const kills   = (me.stats && me.stats.kills)     ? me.stats.kills     : 0;
      const deaths  = (me.stats && me.stats.deaths)    ? me.stats.deaths    : 0;
      const assists = (me.stats && me.stats.assists)   ? me.stats.assists   : 0;
      const hs      = (me.stats && me.stats.headshots) ? me.stats.headshots : 0;
      const bs      = (me.stats && me.stats.bodyshots) ? me.stats.bodyshots : 0;
      const ls      = (me.stats && me.stats.legshots)  ? me.stats.legshots  : 0;
      const score   = (me.stats && me.stats.score)     ? me.stats.score     : 0;

      const redR  = match.teams && match.teams.red  ? (match.teams.red.rounds_won  || 0) : 0;
      const blueR = match.teams && match.teams.blue ? (match.teams.blue.rounds_won || 0) : 0;
      const mRounds = redR + blueR;
      const acs = mRounds > 0 ? Math.round(score / mRounds) : 0;
      const shots = hs + bs + ls;
      const hsRate = shots > 0 ? Math.round((hs / shots) * 100) : 0;
      const myTeam = me.team ? me.team.toLowerCase() : 'blue';
      const myRounds = myTeam === 'red' ? redR : blueR;
      const enRounds = myTeam === 'red' ? blueR : redR;

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

      const agent = me.character || 'Unknown';
      if (!agentStats[agent]) agentStats[agent] = { games:0, wins:0, kills:0, deaths:0, assists:0, iconUrl:null };
      agentStats[agent].games++;
      if (won) agentStats[agent].wins++;
      agentStats[agent].kills   += kills;
      agentStats[agent].deaths  += deaths;
      agentStats[agent].assists += assists;
      if (!agentStats[agent].iconUrl && me.assets && me.assets.agent) {
        agentStats[agent].iconUrl = me.assets.agent.small || null;
      }
      if (agentRoles[agent]) roleCount[agentRoles[agent]]++;

      const mapName = (match.metadata && match.metadata.map) ? match.metadata.map : 'Unknown';
      if (!mapStats[mapName]) mapStats[mapName] = { games:0, wins:0, imageUrl: mapImageMap[mapName] || null };
      mapStats[mapName].games++;
      if (won) mapStats[mapName].wins++;

      const agentIconUrl = (me.assets && me.assets.agent) ? (me.assets.agent.small || null) : null;
      recentMatches.push({
        won, map: mapName, mapImageUrl: mapImageMap[mapName] || null,
        mode: (match.metadata && match.metadata.mode) ? match.metadata.mode : '',
        agent, agentIconUrl,
        kills, deaths, assists, acs, hsRate,
        kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2),
        plusMinus: kills - deaths,
        score: myRounds + ':' + enRounds,
        gameStart: (match.metadata && match.metadata.game_start) ? match.metadata.game_start : 0,
      });
    }

    // 5. 집계
    const topAgents = Object.entries(agentStats)
      .sort(function(a, b) { return b[1].games - a[1].games; })
      .slice(0, 3)
      .map(function(entry) {
        const agent = entry[0], s = entry[1];
        return {
          agent, iconUrl: s.iconUrl, games: s.games,
          winRate: Math.round((s.wins / s.games) * 100),
          kd: s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2),
          avgKills:   (s.kills   / s.games).toFixed(1),
          avgDeaths:  (s.deaths  / s.games).toFixed(1),
          avgAssists: (s.assists / s.games).toFixed(1),
        };
      });

    const mapData = Object.entries(mapStats)
      .map(function(entry) {
        const map = entry[0], s = entry[1];
        return { map, games: s.games, wins: s.wins, imageUrl: s.imageUrl,
          winRate: Math.round((s.wins / s.games) * 100) };
      })
      .sort(function(a, b) { return b.winRate - a.winRate; });

    const totalShots = totalHeadshots + totalBodyshots + totalLegshots;
    const headshotRate = totalShots > 0 ? Math.round((totalHeadshots / totalShots) * 100) : 0;
    const acs = totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0;
    const avgAssistRatio = totalKills > 0 ? totalAssists / totalKills : 0;
    const teamplayScore = Math.min(avgAssistRatio * 10, 10).toFixed(1);

    const totalRoleGames = Object.values(roleCount).reduce(function(a, b) { return a + b; }, 0);
    const roleProficiency = {
      duelist:    totalRoleGames > 0 ? Math.round(roleCount.duelist    / totalRoleGames * 100) : 0,
      controller: totalRoleGames > 0 ? Math.round(roleCount.controller / totalRoleGames * 100) : 0,
      sentinel:   totalRoleGames > 0 ? Math.round(roleCount.sentinel   / totalRoleGames * 100) : 0,
      initiator:  totalRoleGames > 0 ? Math.round(roleCount.initiator  / totalRoleGames * 100) : 0,
    };
    const mainRole = Object.entries(roleProficiency).sort(function(a, b) { return b[1] - a[1]; })[0];
    const roleNames = { duelist:'듀얼리스트', controller:'컨트롤러', sentinel:'센티넬', initiator:'이니시에이터' };

    return res.status(200).json({
      success: true,
      account: { level: account.account_level, card: account.card, name: account.name, tag: account.tag },
      stats: {
        overall: {
          games: totalGames, wins: totalWins, losses: totalGames - totalWins,
          winRate: totalGames > 0 ? Math.round(totalWins / totalGames * 100) : 0,
          avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2),
          avgKills:   totalGames > 0 ? (totalKills   / totalGames).toFixed(1) : '0',
          avgDeaths:  totalGames > 0 ? (totalDeaths  / totalGames).toFixed(1) : '0',
          avgAssists: totalGames > 0 ? (totalAssists / totalGames).toFixed(1) : '0',
          headshotRate, acs,
        },
        agents: topAgents, maps: mapData,
        teamplay: { score: teamplayScore, assistContribution: Math.round(avgAssistRatio * 100) },
        roles: { proficiency: roleProficiency, mainRole: roleNames[mainRole[0]], mainRolePercent: mainRole[1] },
      },
      recentMatches,
      matchCount: matches.length,
    });

  } catch (error) {
    console.error('game-stats error:', error.message, error.stack);
    return res.status(500).json({ success: false, error: error.message });
  }
}
game-stats.js
10KB
