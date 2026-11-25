const channelUrl = 'https://discord.com/channels/683829152276938814/701290347161976883/';
const normalize = value => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const samePerson = (a, b) => Boolean(a && b && (a.id && b.id ? a.id === b.id : normalize(a.name) === normalize(b.name)));

export function parseRegistryEvent(message) {
  if (!/^\d+$/.test(message.id || '')) return null;
  const text = [message.content, ...(message.embeds || []).map(embed => embed.description),
    ...(message.embeds || []).flatMap(embed => (embed.fields || []).map(field => `${field.name}: ${field.value}`))]
    .filter(Boolean).join('\n').replace(/\*\*|__/g, '').trim();
  // Require the action footer; never interpret templates, discussion, or provisional applications.
  const footer = /(?:^|\n)[ \t]*(팀|클랜)(?:원|장|명)?[ \t]*(등록|해체|추가(?:\s*(?:및|\/|,|·)\s*제외)?|제외|변경|이름\s*변경)\s*신청합니다[.!]?[ \t]*$/.exec(text);
  if (!footer) return null;
  const kind = footer[1];
  const body = text.slice(0, footer.index);
  const entries = [...body.matchAll(/^\s*(?:[-•]\s*)?([^\n:：]{1,25})\s*[:：]([^\n]*(?:\n(?!\s*(?:[-•]\s*)?[^\n:：]{1,25}[:：])[^\n]*)*)/gm)]
    .map(match => ({ label: match[1].replace(/\s+/g, ''), value: match[2].trim() }));
  const values = label => entries.filter(entry => entry.label === label).map(entry => entry.value);
  const nameFields = values(kind + '명');
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
  const event = { id: message.id, kind, name, url: channelUrl + message.id };
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

export function replayRegistryEvents(events) {
  const active = new Map();
  let appliedChanges = 0, unmatchedChanges = 0;
  const key = event => event.kind + ':' + normalize(event.name);
  const sorted = [...new Map(events.map(event => [event.id, event])).values()]
    .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
  for (const event of sorted) {
    const id = key(event);
    if (event.type === 'register') {
      active.set(id, { ...event, members: event.members.map(person => ({ ...person })) });
      continue;
    }
    const team = active.get(id);
    if (!team) { unmatchedChanges++; continue; }
    if (event.type === 'disband') active.delete(id);
    else if (event.type === 'rename') {
      const nextKey = key({ ...event, name: event.after });
      if (active.has(nextKey) && nextKey !== id) { unmatchedChanges++; continue; }
      active.delete(id); team.name = event.after; active.set(nextKey, team);
    } else if (event.type === 'captain') {
      if (!samePerson(team.captain, event.before)) { unmatchedChanges++; continue; }
      const former = team.captain;
      team.captain = event.after;
      team.members = team.members.filter(person => !samePerson(person, event.after));
      if (!samePerson(former, event.after) && !team.members.some(person => samePerson(person, former))) team.members.push(former);
    } else if (event.type === 'roster') {
      team.members = team.members.filter(person => !event.remove.some(other => samePerson(person, other)));
      if (event.remove.some(person => samePerson(person, team.captain))) team.captain = null;
      for (const person of event.add) {
        if (samePerson(person, team.captain)) { team.captain = person; continue; }
        const index = team.members.findIndex(other => samePerson(person, other));
        if (index === -1) team.members.push(person); else team.members[index] = person;
      }
    }
    team.url = event.url;
    appliedChanges++;
  }
  return { teams: [...active.values()].map(team => ({ kind: team.kind, name: team.name,
    captain: team.captain?.name || '미지정', members: team.members.map(person => person.name), url: team.url })),
    appliedChanges, unmatchedChanges };
}
