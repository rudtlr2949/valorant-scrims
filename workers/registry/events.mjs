const channelUrl = 'https://discord.com/channels/683829152276938814/701290347161976883/';
const normalize = value => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const looseName = value => normalize(value).replace(/[\s()[\]{}._-]/g, '');
// Ignore presentation-only word order and the common e-sport(s) spelling.
// Keep all meaningful words: never match on a shared generic word alone.
const wordName = value => normalize(value).replace(/e[ -]?sports?\b/g, 'esport')
  .replace(/[()[\]{}._-]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
const aliases = name => [name, name.replace(/[([][^)\]]*[)\]]/g, '').trim(),
  ...[...name.matchAll(/[([]([^\])]+)[)\]]/g)].map(match => match[1])]
  .map(looseName).filter(value => value.length >= 2 && !['gc', 'team', 'clan', 'academy', '팀', '클랜', '아카데미'].includes(value));
const samePerson = (a, b) => Boolean(a && b && (a.id && b.id ? a.id === b.id : normalize(a.name) === normalize(b.name)));

export function parseRegistryEvent(message) {
  if (!/^\d+$/.test(message.id || '')) return null;
  const text = [message.content, ...(message.embeds || []).map(embed => embed.description),
    ...(message.embeds || []).flatMap(embed => (embed.fields || []).map(field => `${field.name}: ${field.value}`))]
    .filter(Boolean).join('\n').replace(/\*\*|__/g, '').trim();
  // Require the action footer; never interpret templates, discussion, or provisional applications.
  const temporary = /(?:^|\n)[ \t]*신규\s*등급\s*신청합니다[.!]?[ \t]*$/.exec(text);
  const premier = /(?:^|\n)[ \t]*프리미어\s*등급\s*신청합니다[.!]?[ \t]*$/.exec(text);
  const categoryChange = /(?:^|\n)[ \t]*(팀|GC팀)\s*(?:→|->|⇒)\s*(GC팀|팀)\s*변경\s*신청합니다[.!]?[ \t]*$/.exec(text);
  const footer = temporary || premier || categoryChange || /(?:^|\n)[ \t]*(팀|클랜)(?:원|장|명)?[ \t]*(등록|해체|추가(?:\s*(?:및|\/|,|·)\s*제외)?|제외|변경|이름\s*변경)\s*신청합니다[.!]?[ \t]*$/.exec(text);
  if (!footer) return null;
  const body = text.slice(0, footer.index);
  const entries = [...body.matchAll(/^\s*(?:[-•]\s*)?([^\n:：]{1,25})\s*[:：]([^\n]*(?:\n(?!\s*(?:[-•]\s*)?[^\n:：]{1,25}[:：])[^\n]*)*)/gm)]
    .map(match => ({ label: match[1].replace(/\s+/g, ''), value: match[2].trim() }));
  const values = label => entries.filter(entry => entry.label === label).map(entry => entry.value);
  const kind = temporary ? (values('클랜명').length ? '클랜' : '팀') : premier || categoryChange ? '팀' : footer[1];
  const nameFields = values(premier ? '신청팀명' : kind + '명');
  if (nameFields.length !== 1) return null;
  const name = nameFields[0].split('\n')[0].replace(/^`|`$/g, '').trim().slice(0, 80);
  if (!name) return null;
  const mentioned = new Map((message.mentions || []).map(user => [user.id, user.member?.nick || user.global_name || user.username]));
  const people = chunks => chunks.flatMap(chunk => chunk.split(/[,，、\n]/)).flatMap(chunk => {
    const ids = [...chunk.matchAll(/<@!?(\d+)>/g)].map(match => match[1]);
    if (ids.length) return ids.map(id => ({ id, name: mentioned.get(id) || '이름 확인 필요' }));
    const name = chunk.replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').replace(/^`|`$/g, '').trim().slice(0, 80);
    return name ? [{ name }] : [];
  });
  const unique = list => list.filter((person, i) => !list.slice(0, i).some(other => samePerson(person, other)));
  const createdAt = Number.isFinite(Date.parse(message.timestamp)) ? Date.parse(message.timestamp)
    : Number((BigInt(message.id) >> 22n) + 1420070400000n);
  const event = { id: message.id, kind, name, url: channelUrl + message.id, createdAt };
  if (categoryChange) {
    return categoryChange[1] !== categoryChange[2]
      ? { ...event, type: 'category', after: categoryChange[2] === 'GC팀' ? 'GC' : 'TEAM' } : null;
  }
  if (temporary || premier) {
    const captains = people(values(premier ? '신청인' : kind + '장'));
    if (captains.length !== 1 || !captains[0].id) return null;
    if (temporary && people(values(kind + '원')).length) return null;
    if (premier && message.author?.id && captains[0].id !== message.author.id) return null;
    if (premier) {
      const acts = values('신청액트');
      return acts.length === 1 && acts[0].trim()
        ? { ...event, type: 'premier', captain: captains[0], members: [], act: acts[0].trim().slice(0, 80) } : null;
    }
    const gc = (message.registryRoleNames || []).some(role => /신규.*GC/i.test(role)) || /신규\s*\(GC팀\)/i.test(body);
    return { ...event, type: 'temporary', captain: captains[0], members: [], category: kind === '클랜' ? 'CLAN' : gc ? 'GC' : undefined,
      expiresAt: createdAt + 30 * 86400000 };
  }
  const action = footer[2].replace(/\s+/g, '');
  if (action === '등록') {
    const captains = people(values(kind + '장'));
    const roster = unique(people(values(kind + '원'))).filter(person => !samePerson(person, captains[0]));
    return captains.length === 1 && roster.length >= 2
      ? { ...event, type: 'register', captain: captains[0], members: roster } : null;
  }
  if (action === '해체') return { ...event, type: 'disband' };
  if (action === '변경' && /장\s*변경/.test(footer[0])) {
    const changes = values(kind + '장변경');
    if (changes.length !== 1) return null;
    const parts = changes[0].split(/→|->|⇒/);
    if (parts.length !== 2) return null;
    const before = people([parts[0]]), after = people([parts[1]]);
    return before.length === 1 && after.length === 1
      ? { ...event, type: 'captain', before: before[0], after: after[0] } : null;
  }
  if (action === '변경' || action === '이름변경') {
    if (!/명\s*변경/.test(footer[0])) return null;
    const parts = name.split(/→|->|⇒/).map(part => part.trim());
    return parts.length === 2 && parts.every(Boolean)
      ? { ...event, name: parts[0], type: 'rename', after: parts[1] } : null;
  }
  if (/추가|제외/.test(action)) {
    const combined = /추가.*제외/.test(action);
    const add = unique(people(values(kind + '원추가').concat(!combined && action === '추가' ? values(kind + '원') : [])));
    const remove = unique(people(values(kind + '원제외').concat(!combined && action === '제외' ? values(kind + '원') : [])));
    if (add.some(person => remove.some(other => samePerson(person, other)))) return null;
    return add.length || remove.length ? { ...event, type: 'roster', add, remove } : null;
  }
  return null;
}

export function replayRegistryEvents(events, { now = Date.now(), premierAct = '' } = {}) {
  const active = new Map();
  const temporary = new Map(), premier = new Map();
  const closed = [];
  const namesMatch = (a, b) => looseName(a) === looseName(b)
    || wordName(a) === wordName(b)
    || aliases(a).includes(looseName(b)) || aliases(b).includes(looseName(a));
  const teamNames = team => team.knownNames || [team.name];
  const isClosed = event => closed.some(entry => entry.kind === event.kind && entry.names.some(name => namesMatch(name, event.name)));
  let appliedChanges = 0, unmatchedChanges = 0;
  const reviewChanges = [];
  const review = (event, reason) => {
    unmatchedChanges++;
    reviewChanges.push({ kind: event.kind, name: event.name, type: event.type, url: event.url, reason,
      ...(event.type === 'rename' ? { afterName: event.after } : {}),
      ...(event.type === 'roster' ? { action: event.add.length && event.remove.length ? '추가 및 제외'
        : event.add.length ? '추가' : '제외' } : {}) });
  };
  const resolvePrevious = (event, names) => {
    for (let i = reviewChanges.length - 1; i >= 0; i--) {
      const item = reviewChanges[i];
      if (item.kind === event.kind && names.some(name => namesMatch(name, item.name)
        || item.afterName && namesMatch(name, item.afterName))) {
        reviewChanges.splice(i, 1); unmatchedChanges--;
      }
    }
  };
  const key = event => event.kind + ':' + normalize(event.name);
  const sorted = [...new Map(events.map(event => [event.id, event])).values()]
    .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
  for (const event of sorted) {
    let id = key(event);
    if (event.type === 'temporary') {
      if (!active.has(id)) temporary.set(id, { ...event, registryType: 'temporary' });
      continue;
    }
    if (event.type === 'premier') {
      if (active.has(id)) { review(event, '정식 팀 등록과 프리미어 등급은 동시에 유지할 수 없습니다.'); continue; }
      premier.set(normalize(event.act) + ':' + id, { ...event, registryType: 'premier' });
      continue;
    }
    if (event.type === 'register') {
      // A later complete approved roster replaces older, unlinked partial edits.
      // Do not apply those old edits to the newer roster a second time.
      resolvePrevious(event, [event.name]);
      temporary.delete(id);
      for (const [premierKey, entry] of premier) if (key(entry) === id) premier.delete(premierKey);
      active.set(id, { ...event, knownNames: [event.name], members: event.members.map(person => ({ ...person })) });
      continue;
    }
    let ambiguous = false;
    if (!active.has(id) && !temporary.has(id)) {
      const entries = [...active.entries(), ...temporary.entries()].filter(([, team]) => team.kind === event.kind);
      const exact = entries.filter(([, team]) => looseName(team.name) === looseName(event.name));
      const candidates = exact.length ? exact : entries.filter(([, team]) =>
        teamNames(team).some(name => namesMatch(name, event.name)));
      if (candidates.length === 1) id = candidates[0][0];
      ambiguous = candidates.length > 1;
    }
    // Discord authors may have edited the original registration to its new name.
    // An approved explicit A → B request still links A to that unique B roster.
    if (!active.has(id) && !temporary.has(id) && !ambiguous && event.type === 'rename') {
      const renamed = [...active.entries(), ...temporary.entries()].filter(([, entry]) =>
        entry.kind === event.kind && looseName(entry.name) === looseName(event.after));
      if (renamed.length === 1) id = renamed[0][0];
      else if (renamed.length > 1) ambiguous = true;
    }
    const team = active.get(id) || temporary.get(id);
    if (event.type === 'disband') {
      if (ambiguous) { review(event, '해체 대상의 팀명·약자가 여러 활성 등록과 일치합니다.'); continue; }
      const names = [...new Set([event.name, ...(team ? teamNames(team) : [])])];
      active.delete(id); temporary.delete(id);
      for (const [premierKey, entry] of premier) {
        if (entry.kind === event.kind && names.some(name => looseName(name) === looseName(entry.name))) premier.delete(premierKey);
      }
      closed.push({ kind: event.kind, names });
      // A confirmed closure resolves earlier orphaned changes for that team too.
      for (let i = reviewChanges.length - 1; i >= 0; i--) {
        const item = reviewChanges[i];
        if (item.kind === event.kind && names.some(name => namesMatch(name, item.name))) {
          reviewChanges.splice(i, 1); unmatchedChanges--;
        }
      }
      appliedChanges++;
      continue;
    }
    // Roster edits never reopen a closed team; only a new approved registration does.
    if (!team && !ambiguous && isClosed(event)) continue;
    // An exclusion is already satisfied when no corresponding team exists.
    // Never create a team or alter an ambiguous match just to remove a member.
    if (!team && !ambiguous && event.type === 'roster' && !event.add.length) {
      appliedChanges++;
      continue;
    }
    if (!team) { review(event, '일치하는 활성 등록을 찾지 못했습니다.'); continue; }
    const container = active.has(id) ? active : temporary;
    if (event.type === 'disband') container.delete(id);
    else if (event.type === 'rename') {
      const nextKey = key({ ...event, name: event.after });
      if ((active.has(nextKey) || temporary.has(nextKey)) && nextKey !== id) { review(event, '변경할 이름에 다른 등록이 있습니다.'); continue; }
      team.knownNames = [...new Set([...teamNames(team), event.name, event.after])];
      resolvePrevious(event, team.knownNames);
      container.delete(id); team.name = event.after; container.set(nextKey, team);
    } else if (event.type === 'captain') {
      const former = team.captain;
      team.captain = event.after;
      team.members = team.members.filter(person => !samePerson(person, event.after));
      if (former && !samePerson(former, event.after) && !team.members.some(person => samePerson(person, former))) team.members.push(former);
    } else if (event.type === 'category') {
      if (team.kind !== '팀') { review(event, '클랜의 팀 속성 전환은 해체 후 새 등록이 필요합니다.'); continue; }
      team.category = event.after;
    } else if (event.type === 'roster') {
      team.members = team.members.filter(person => !event.remove.some(other => samePerson(person, other)));
      if (event.remove.some(person => samePerson(person, team.captain))) team.captain = null;
      for (const person of event.add) {
        if (samePerson(person, team.captain)) { team.captain = person; continue; }
        const index = team.members.findIndex(other => samePerson(person, other));
        if (index === -1) team.members.push(person); else team.members[index] = person;
      }
      if (container === temporary && team.captain && team.members.length >= 2) {
        temporary.delete(id); delete team.registryType; delete team.expiresAt;
        team.type = 'register'; active.set(id, team);
      }
    }
    team.url = event.url;
    appliedChanges++;
  }
  const display = team => ({ kind: team.kind, name: team.name,
    discordRoster: [team.captain && { ...team.captain, role: 'captain' }, ...team.members.map(person => ({ ...person, role: 'member' }))].filter(Boolean),
    captain: team.captain?.name || '미지정', members: team.members.map(person => person.name), url: team.url,
    ...(team.category ? { category: team.category } : {}),
    ...(team.registryType ? { registryType: team.registryType } : {}),
    ...(team.expiresAt ? { expiresAt: team.expiresAt } : {}),
    ...(team.act ? { act: team.act, actConfirmed: Boolean(premierAct) } : {}) });
  return { teams: [...active.values()].map(display),
    temporaryTeams: [...temporary.values()].filter(team => team.expiresAt > now).map(display),
    premierTeams: [...premier.values()].filter(team => !premierAct || normalize(team.act) === normalize(premierAct)).map(display),
    appliedChanges, unmatchedChanges, reviewChanges };
}
