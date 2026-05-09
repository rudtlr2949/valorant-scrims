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
    "Haven":    "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png",
    "Split":    "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png",
    "Icebox":   "https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png",
    "Breeze":   "https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png",
    "Fracture": "https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png",
    "Pearl":    "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png",
    "Lotus":    "https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png",
    "Sunset":   "https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png",
    "Abyss":    "https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png",
    "Drift":    "https://media.valorant-api.com/maps/2c09d728-42d5-30d8-43dc-96a05cc7ee9d/splash.png",
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

    // get tier image URL from MMR API
    var tierImageUrl = "";
    try {
      var mmrRes = await fetch(
        "https://api.henrikdev.xyz/valorant/v2/mmr/" + region + "/" + encodeURIComponent(name) + "/" + encodeURIComponent(tag),
        { headers: { "Authorization": henrikApiKey } }
      );
      if (mmrRes.ok) {
        var mmrJson = await mmrRes.json();
        if (mmrJson.data && mmrJson.data.current_data && mmrJson.data.current_data.images) {
          tierImageUrl = mmrJson.data.current_data.images.small || "";
        }
      }
    } catch(_) {}

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
      var damage  = me.damage_made || 0;

      var redR  = (match.teams && match.teams.red)  ? (match.teams.red.rounds_won  || 0) : 0;
      var blueR = (match.teams && match.teams.blue) ? (match.teams.blue.rounds_won || 0) : 0;
      var mRounds = redR + blueR;
      var acs = mRounds > 0 ? Math.round(score / mRounds) : 0;
      var adr = mRounds > 0 ? Math.round(damage / mRounds) : 0;
      var shots = hs + bs + ls;
      var hsRate = shots > 0 ? Math.round((hs / shots) * 100) : 0;
      var myR = isRed ? redR : blueR;
      var enR = isRed ? blueR : redR;
      var myTeamId = isRed ? "red" : "blue";

      // all players stats
      var allPlayers = players.map(function(p) {
        var pK  = (p.stats && p.stats.kills)     || 0;
        var pD  = (p.stats && p.stats.deaths)    || 0;
        var pA  = (p.stats && p.stats.assists)   || 0;
        var pH  = (p.stats && p.stats.headshots) || 0;
        var pB  = (p.stats && p.stats.bodyshots) || 0;
        var pL  = (p.stats && p.stats.legshots)  || 0;
        var pSc = (p.stats && p.stats.score)     || 0;
        var pDmg = p.damage_made || 0;
        var pSh = pH + pB + pL;
        return {
          name: p.name || '', tag: p.tag || '',
          agent: p.character || '',
          iconUrl: (p.assets && p.assets.agent) ? (p.assets.agent.small || '') : '',
          team: p.team ? p.team.toLowerCase() : 'blue',
          isMe: (p.name === name && p.tag === tag),
          kills: pK, deaths: pD, assists: pA,
          acs:    mRounds > 0 ? Math.round(pSc  / mRounds) : 0,
          adr:    mRounds > 0 ? Math.round(pDmg / mRounds) : 0,
          hsRate: pSh > 0     ? Math.round(pH / pSh * 100) : 0,
          kd:    pD > 0 ? (pK / pD).toFixed(2) : pK.toFixed(2),
        };
      });

      var myTeamPlayers    = allPlayers.filter(function(p) { return p.team === myTeamId; });
      var enemyTeamPlayers = allPlayers.filter(function(p) { return p.team !== myTeamId; });

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
        agentStats[agent] = { games:0, wins:0, kills:0, deaths:0, assists:0, hs:0, bs:0, ls:0, score:0, rounds:0, iconUrl:null };
      }
      agentStats[agent].games++;
      if (won) agentStats[agent].wins++;
      agentStats[agent].kills   += kills;
      agentStats[agent].deaths  += deaths;
      agentStats[agent].assists += assists;
      agentStats[agent].hs     += hs;
      agentStats[agent].bs     += bs;
      agentStats[agent].ls     += ls;
      agentStats[agent].score  += score;
      agentStats[agent].rounds += mRounds;
      if (!agentStats[agent].iconUrl && me.assets && me.assets.agent) {
        agentStats[agent].iconUrl = me.assets.agent.small || null;
      }
      if (AGENT_ROLES[agent]) roleCount[AGENT_ROLES[agent]]++;

      var mapName = (match.metadata && match.metadata.map) ? match.metadata.map : "Unknown";
      if (!mapStats[mapName]) {
        mapStats[mapName] = { games:0, wins:0, hs:0, bs:0, ls:0, kills:0, deaths:0, assists:0, score:0, rounds:0, imageUrl: MAP_IMAGES[mapName] || null };
      }
      mapStats[mapName].games++;
      if (won) mapStats[mapName].wins++;
      mapStats[mapName].hs      += hs;
      mapStats[mapName].bs      += bs;
      mapStats[mapName].ls      += ls;
      mapStats[mapName].kills   += kills;
      mapStats[mapName].deaths  += deaths;
      mapStats[mapName].assists += assists;
      mapStats[mapName].score   += score;
      mapStats[mapName].rounds  += mRounds;

      recentMatches.push({
        won: won,
        map: mapName,
        mapImageUrl: MAP_IMAGES[mapName] || null,
        mode: (match.metadata && match.metadata.mode) ? match.metadata.mode : "",
        agent: agent,
        agentIconUrl: (me.assets && me.assets.agent) ? (me.assets.agent.small || null) : null,
        kills: kills, deaths: deaths, assists: assists,
        acs: acs, hsRate: hsRate, adr: adr,
        kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2),
        plusMinus: kills - deaths,
        score: myR + ":" + enR,
        gameStart: (match.metadata && match.metadata.game_start) ? match.metadata.game_start : 0,
        myTeam:    myTeamPlayers,
        enemyTeam: enemyTeamPlayers,
      });
    }

    var agentEntries = Object.keys(agentStats).map(function(a) { return [a, agentStats[a]]; });
    agentEntries.sort(function(a,b){ return b[1].games - a[1].games; });
    var topAgents = agentEntries.map(function(e){
      var a=e[0], s=e[1];
      var aShots = s.hs + s.bs + s.ls;
      var aHsRate = aShots > 0 ? Math.round((s.hs/aShots)*100) : 0;
      var aAcs = s.rounds > 0 ? Math.round(s.score/s.rounds) : 0;
      return {
        agent:a, iconUrl:s.iconUrl, games:s.games,
        winRate: Math.round((s.wins/s.games)*100),
        kd: s.deaths>0 ? (s.kills/s.deaths).toFixed(2) : s.kills.toFixed(2),
        avgKills:   (s.kills/s.games).toFixed(1),
        avgDeaths:  (s.deaths/s.games).toFixed(1),
        avgAssists: (s.assists/s.games).toFixed(1),
        acs: aAcs, hsRate: aHsRate
      };
    });

    var mapEntries = Object.keys(mapStats).map(function(m){ return [m, mapStats[m]]; });
    mapEntries.sort(function(a,b){ return b[1].wins/b[1].games - a[1].wins/a[1].games; });
    var mapData = mapEntries.map(function(e){
      var m=e[0], s=e[1];
      var shots = s.hs + s.bs + s.ls;
      var mapHsRate = shots > 0 ? Math.round((s.hs / shots) * 100) : 0;
      var mapAcs = s.rounds > 0 ? Math.round(s.score / s.rounds) : 0;
      var mapKd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
      return { map:m, games:s.games, wins:s.wins, imageUrl:s.imageUrl,
        winRate: Math.round((s.wins/s.games)*100),
        hsRate: mapHsRate, acs: mapAcs, kd: mapKd };
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
      account: { level:account.account_level, card:account.card, name:account.name, tag:account.tag, tierImageUrl:tierImageUrl },
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
