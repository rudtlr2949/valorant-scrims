export default async function handler(req, res) {
  const { name, tag, puuid, region } = req.query;
  
  const henrikApiKey = process.env.HENRIK_API_KEY;

  if (!henrikApiKey) {
    return res.status(500).json({ 
      success: false, 
      error: 'Henrik API 키가 설정되지 않았습니다' 
    });
  }

  try {
    console.log(`📊 게임 통계 조회: ${name}#${tag} (${region})`);

    // 0. valorant-api.com에서 맵 이름→이미지URL 매핑 가져오기
    let mapImageMap = {};
    try {
      const mapRes = await fetch('https://valorant-api.com/v1/maps');
      const mapData = await mapRes.json();
      if (mapData.data) {
        mapData.data.forEach(m => {
          if (m.displayName && m.splash) {
            mapImageMap[m.displayName] = m.splash;
          }
        });
        console.log(`✅ 맵 이미지 ${Object.keys(mapImageMap).length}개 로드`);
      }
    } catch (e) {
      console.warn('⚠️ 맵 이미지 로드 실패:', e.message);
    }

    // 1. 계정 정보 (플레이어 카드, 레벨)
    const accountUrl = `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
    
    const accountRes = await fetch(accountUrl, {
      headers: { 'Authorization': henrikApiKey }
    });

    if (!accountRes.ok) {
      console.error('❌ 계정 조회 실패:', accountRes.status);
      return res.status(200).json({ 
        success: false, 
        error: '계정 정보를 가져올 수 없습니다' 
      });
    }

    const accountData = await accountRes.json();
    
    if (!accountData.data) {
      return res.status(200).json({ 
        success: false, 
        error: '계정 데이터가 없습니다' 
      });
    }

    const account = accountData.data;
    console.log('✅ 계정 정보:', account.name, '레벨:', account.account_level);

    // 2. 최근 경기 20개 조회 (10개씩 2번 호출)
    let matches = [];

    const fetchMatches = async (start = 0) => {
      const url = `https://api.henrikdev.xyz/valorant/v3/by-puuid/matches/${region}/${puuid}?size=10&start=${start}`;
      const matchRes = await fetch(url, { headers: { 'Authorization': henrikApiKey } });
      if (!matchRes.ok) return [];
      const data = await matchRes.json();
      return data.data || [];
    };

    const [batch1, batch2] = await Promise.all([
      fetchMatches(0),
      fetchMatches(10)
    ]);

    matches = [...batch1, ...batch2];
    console.log(`✅ 경기 조회: ${batch1.length}개 + ${batch2.length}개 = ${matches.length}개`);

    // 3. 통계 계산
    const stats = calculateStats(matches, name, tag);

    // 최근 경기 상세 데이터
    const recentMatches = matches.map(match => {
      const players = match.players?.all_players || [];
      const playerData = players.find(p =>
        p.name.toLowerCase() === name.toLowerCase() &&
        p.tag.toLowerCase() === tag.toLowerCase()
      );
      if (!playerData) {
        console.log('⚠️ 플레이어 못 찾음, 매치 플레이어들:', players.map(p => p.name + '#' + p.tag).join(', '));
        return null;
      }

      const won = playerData.team.toLowerCase() === 'red'
        ? match.teams.red.has_won
        : match.teams.blue.has_won;

      const kills = playerData.stats.kills || 0;
      const deaths = playerData.stats.deaths || 0;
      const assists = playerData.stats.assists || 0;
      const score = playerData.stats.score || 0;
      const headshots = playerData.stats.headshots || 0;
      const bodyshots = playerData.stats.bodyshots || 0;
      const legshots = playerData.stats.legshots || 0;

      const redRounds = match.teams.red.rounds_won || 0;
      const blueRounds = match.teams.blue.rounds_won || 0;
      const totalRounds = redRounds + blueRounds;
      const acs = totalRounds > 0 ? Math.round(score / totalRounds) : 0;

      const totalShots = headshots + bodyshots + legshots;
      const hsRate = totalShots > 0 ? Math.round((headshots / totalShots) * 100) : 0;

      // 팀 점수
      const myTeam = playerData.team.toLowerCase();
      const myRoundsWon = myTeam === 'red' ? redRounds : blueRounds;
      const enemyRoundsWon = myTeam === 'red' ? blueRounds : redRounds;

      return {
        won,
        map: match.metadata.map,
        mapImageUrl: mapImageMap[match.metadata.map] || null,
        mode: match.metadata.mode,
        agent: playerData.character,
        agentIconUrl: playerData.assets?.agent?.small || null,
        kills, deaths, assists,
        acs, hsRate,
        kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2),
        plusMinus: kills - deaths,
        score: `${myRoundsWon}:${enemyRoundsWon}`,
        gameStart: match.metadata.game_start,
        gameLength: match.metadata.game_length
      };
    }).filter(Boolean);

    return res.status(200).json({
      success: true,
      account: {
        level: account.account_level,
        card: account.card,
        name: account.name,
        tag: account.tag
      },
      stats: stats,
      recentMatches: recentMatches,
      matchCount: matches.length
    });

  } catch (error) {
    console.error('❌ 통계 조회 에러:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

function calculateStats(matches, playerName, playerTag) {
  const agentStats = {};
  const mapStats = {};
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let totalGames = 0;
  let totalWins = 0;
  let totalHeadshots = 0;
  let totalBodyshots = 0;
  let totalLegshots = 0;
  let totalScore = 0;
  let totalRounds = 0;

  const agentRoles = {
    'Jett': 'duelist', 'Raze': 'duelist', 'Reyna': 'duelist', 
    'Phoenix': 'duelist', 'Yoru': 'duelist', 'Neon': 'duelist', 'Iso': 'duelist',
    'Brimstone': 'controller', 'Omen': 'controller', 'Viper': 'controller', 
    'Astra': 'controller', 'Harbor': 'controller', 'Clove': 'controller',
    'Killjoy': 'sentinel', 'Cypher': 'sentinel', 'Sage': 'sentinel', 
    'Chamber': 'sentinel', 'Deadlock': 'sentinel', 'Vyse': 'sentinel',
    'Sova': 'initiator', 'Breach': 'initiator', 'Skye': 'initiator', 
    'KAY/O': 'initiator', 'Fade': 'initiator', 'Gekko': 'initiator'
  };

  const roleCount = { duelist: 0, controller: 0, sentinel: 0, initiator: 0 };

  matches.forEach(match => {
    const players = match.players?.all_players || [];
    const playerData = players.find(p => 
      p.name.toLowerCase() === playerName.toLowerCase() && 
      p.tag.toLowerCase() === playerTag.toLowerCase()
    );

    if (!playerData) return;

    totalGames++;
    
    const won = playerData.team.toLowerCase() === match.teams.red.has_won ? 
                match.teams.red.has_won : 
                match.teams.blue.has_won;
    
    if (won) totalWins++;

    const kills = playerData.stats.kills || 0;
    const deaths = playerData.stats.deaths || 0;
    const assists = playerData.stats.assists || 0;
    const headshots = playerData.stats.headshots || 0;
    const bodyshots = playerData.stats.bodyshots || 0;
    const legshots = playerData.stats.legshots || 0;
    const score = playerData.stats.score || 0;

    // 라운드 수 계산
    const redRounds = match.teams.red.rounds_won || 0;
    const blueRounds = match.teams.blue.rounds_won || 0;
    const matchRounds = redRounds + blueRounds;

    totalKills += kills;
    totalDeaths += deaths;
    totalAssists += assists;
    totalHeadshots += headshots;
    totalBodyshots += bodyshots;
    totalLegshots += legshots;
    totalScore += score;
    totalRounds += matchRounds;

    // 에이전트 통계
    const agent = playerData.character;
    if (!agentStats[agent]) {
      agentStats[agent] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, iconUrl: null };
    }
    agentStats[agent].games++;
    if (won) agentStats[agent].wins++;
    agentStats[agent].kills += kills;
    agentStats[agent].deaths += deaths;
    agentStats[agent].assists += assists;
    if (!agentStats[agent].iconUrl) {
      agentStats[agent].iconUrl = playerData.assets?.agent?.small || null;
    }

    const role = agentRoles[agent];
    if (role) roleCount[role]++;

    // 맵 통계
    const map = match.metadata.map;
    if (!mapStats[map]) mapStats[map] = { games: 0, wins: 0, imageUrl: mapImageMap[map] || null };
    mapStats[map].games++;
    if (won) mapStats[map].wins++;
  });

  // Top 3 에이전트
  const topAgents = Object.entries(agentStats)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .map(([agent, stats]) => ({
      agent,
      iconUrl: stats.iconUrl || null,
      games: stats.games,
      winRate: Math.round((stats.wins / stats.games) * 100),
      kd: stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2),
      avgKills: (stats.kills / stats.games).toFixed(1),
      avgDeaths: (stats.deaths / stats.games).toFixed(1),
      avgAssists: (stats.assists / stats.games).toFixed(1)
    }));

  // 맵 통계
  const mapData = Object.entries(mapStats)
    .map(([map, stats]) => ({
      map, games: stats.games, wins: stats.wins,
      imageUrl: stats.imageUrl || null,
      winRate: Math.round((stats.wins / stats.games) * 100)
    }))
    .sort((a, b) => b.winRate - a.winRate);

  // 팀플레이 점수
  const avgAssistRatio = totalKills > 0 ? totalAssists / totalKills : 0;
  const teamplayScore = Math.min(avgAssistRatio * 10, 10).toFixed(1);

  // 역할 적성도
  const totalRoleGames = Object.values(roleCount).reduce((a, b) => a + b, 0);
  const roleProficiency = {
    duelist: totalRoleGames > 0 ? Math.round((roleCount.duelist / totalRoleGames) * 100) : 0,
    controller: totalRoleGames > 0 ? Math.round((roleCount.controller / totalRoleGames) * 100) : 0,
    sentinel: totalRoleGames > 0 ? Math.round((roleCount.sentinel / totalRoleGames) * 100) : 0,
    initiator: totalRoleGames > 0 ? Math.round((roleCount.initiator / totalRoleGames) * 100) : 0
  };

  const mainRole = Object.entries(roleProficiency).sort((a, b) => b[1] - a[1])[0];
  const roleNames = {
    duelist: '듀얼리스트', controller: '컨트롤러',
    sentinel: '센티넬', initiator: '이니시에이터'
  };

  // 헤드샷률
  const totalShots = totalHeadshots + totalBodyshots + totalLegshots;
  const headshotRate = totalShots > 0 ? Math.round((totalHeadshots / totalShots) * 100) : 0;

  // ACS
  const acs = totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0;

  return {
    overall: {
      games: totalGames,
      wins: totalWins,
      losses: totalGames - totalWins,
      winRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
      avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2),
      avgKills: totalGames > 0 ? (totalKills / totalGames).toFixed(1) : 0,
      avgDeaths: totalGames > 0 ? (totalDeaths / totalGames).toFixed(1) : 0,
      avgAssists: totalGames > 0 ? (totalAssists / totalGames).toFixed(1) : 0,
      headshotRate,
      acs
    },
    agents: topAgents,
    maps: mapData,
    teamplay: {
      score: teamplayScore,
      assistContribution: Math.round(avgAssistRatio * 100)
    },
    roles: {
      proficiency: roleProficiency,
      mainRole: roleNames[mainRole[0]],
      mainRolePercent: mainRole[1]
    }
  };
}
