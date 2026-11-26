// Only champions confirmed on VLR.gg; never infer wins from similar team names.
export const kovVlrChampions = Object.freeze([
  {name:'Rio Company', titles:[
    {name:'KOV Masters 2026: Summer', url:'https://www.vlr.gg/event/3101/kov-masters-2026-summer'},
    {name:'KOV Ascend League 2026: Final', url:'https://www.vlr.gg/event/3173/kov-ascend-league-2026-final'}
  ]}
]);
export function championFor(name) {
  const normalized = String(name || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
  return kovVlrChampions.find(team => team.name.toLowerCase() === normalized);
}
export function championBadge(name) {
  const team = championFor(name);
  if (!team) return '';
  return '<span class="kov-masters-champion" role="img" aria-label="KOV 대회 '+team.titles.length+'회 우승" title="'+team.titles.map(title=>title.name+' 우승').join(' · ')+'"><span class="kov-masters-champion-logo" aria-hidden="true"></span><span class="kov-masters-champion-count" aria-hidden="true">우승 '+team.titles.length+'회</span></span>';
}
