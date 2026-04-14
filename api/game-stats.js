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

    // 2. 최근 경기 20개 조회
    const matchesUrl = `https://api.henrikdev.xyz/valorant/v3/by-puuid/matches/${region}/${puuid}?size=20`;
    
    const matchesRes = await fetch(matchesUrl, {
      headers: { 'Authorization': henrikApiKey }
    });

    if (!matchesRes.ok) {
      console.error('❌ 경기 조회 실패:', matchesRes.status);
      return res.status(200).json({
        success: true,
        account: {
          level: account.account_level,
          card: account.card
        },
        matches: []
      });
    }

    const matchesData = await matchesRes.json();
    const matches = matchesData.data || [];

    console.log(`✅ 경기 ${matches.length}개 조회 완료`);

    // 3. 통계 계산
    const stats = calculateStats(matches, name, tag);

    return res.status(200).json({
      success: true,
      account: {
        level: account.account_level,
        card: account.card,
        name: account.name,
        tag: account.tag
      },
      stats: stats,
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

  // 에이전트 역할 매핑
  const agentRoles = {
    // 듀얼리스트
    'Jett': 'duelist', 'Raze': 'duelist', 'Reyna': 'duelist', 
    'Phoenix': 'duelist', 'Yoru': 'duelist', 'Neon': 'duelist', 'Iso': 'duelist',
    
    // 컨트롤러
    'Brimstone': 'controller', 'Omen': 'controller', 'Viper': 'controller', 
    'Astra': 'controller', 'Harbor': 'controller', 'Clove': 'controller',
    
    // 센티넬
    'Killjoy': 'sentinel', 'Cypher': 'sentinel', 'Sage': 'sentinel', 
    'Chamber': 'sentinel', 'Deadlock': 'sentinel', 'Vyse': 'sentinel',
    
    // 이니시에이터
    'Sova': 'initiator', 'Breach': 'initiator', 'Skye': 'initiator', 
    'KAY/O': 'initiator', 'Fade': 'initiator', 'Gekko': 'initiator'
  };

  const roleCount = {
    duelist: 0,
    controller: 0,
    sentinel: 0,
    initiator: 0
  };

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

    totalKills += kills;
    totalDeaths += deaths;
    totalAssists += assists;

    // 에이전트 통계
    const agent = playerData.character;
    if (!agentStats[agent]) {
      agentStats[agent] = {
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0
      };
    }
    agentStats[agent].games++;
    if (won) agentStats[agent].wins++;
    agentStats[agent].kills += kills;
    agentStats[agent].deaths += deaths;
    agentStats[agent].assists += assists;

    // 역할 카운트
    const role = agentRoles[agent];
    if (role) {
      roleCount[role]++;
    }

    // 맵 통계
    const map = match.metadata.map;
    if (!mapStats[map]) {
      mapStats[map] = { games: 0, wins: 0 };
    }
    mapStats[map].games++;
    if (won) mapStats[map].wins++;
  });

  // Top 3 에이전트 (플레이 횟수순)
  const topAgents = Object.entries(agentStats)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .map(([agent, stats]) => ({
      agent,
      games: stats.games,
      winRate: Math.round((stats.wins / stats.games) * 100),
      kd: stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2),
      avgKills: (stats.kills / stats.games).toFixed(1),
      avgDeaths: (stats.deaths / stats.games).toFixed(1),
      avgAssists: (stats.assists / stats.games).toFixed(1)
    }));

  // 맵 통계 (승률순 정렬)
  const mapData = Object.entries(mapStats)
    .map(([map, stats]) => ({
      map,
      games: stats.games,
      wins: stats.wins,
      winRate: Math.round((stats.wins / stats.games) * 100)
    }))
    .sort((a, b) => b.winRate - a.winRate);

  // 팀플레이 점수 계산
  const avgAssistRatio = totalDeaths > 0 ? totalAssists / totalKills : 0;
  const assistScore = Math.min(avgAssistRatio * 10, 10); // 0-10점

  const teamplayScore = assistScore.toFixed(1);

  // 역할 적성도 계산 (%)
  const totalRoleGames = Object.values(roleCount).reduce((a, b) => a + b, 0);
  const roleProficiency = {
    duelist: totalRoleGames > 0 ? Math.round((roleCount.duelist / totalRoleGames) * 100) : 0,
    controller: totalRoleGames > 0 ? Math.round((roleCount.controller / totalRoleGames) * 100) : 0,
    sentinel: totalRoleGames > 0 ? Math.round((roleCount.sentinel / totalRoleGames) * 100) : 0,
    initiator: totalRoleGames > 0 ? Math.round((roleCount.initiator / totalRoleGames) * 100) : 0
  };

  // 주 역할 판정
  const mainRole = Object.entries(roleProficiency)
    .sort((a, b) => b[1] - a[1])[0];

  const roleNames = {
    duelist: '듀얼리스트',
    controller: '컨트롤러',
    sentinel: '센티넬',
    initiator: '이니시에이터'
  };

  return {
    overall: {
      games: totalGames,
      wins: totalWins,
      winRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
      avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2),
      avgKills: totalGames > 0 ? (totalKills / totalGames).toFixed(1) : 0,
      avgDeaths: totalGames > 0 ? (totalDeaths / totalGames).toFixed(1) : 0,
      avgAssists: totalGames > 0 ? (totalAssists / totalGames).toFixed(1) : 0
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
