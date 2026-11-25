export const registryCategories = ['TEAM', 'GC', 'CLAN', 'Academy'];

export function registryCategory(team) {
  if (team.kind === '클랜') return 'CLAN';
  const name = (team.name || '').normalize('NFKC');
  if (/(?:^|[^a-z0-9])gc(?=$|[^a-z0-9])/i.test(name)) return 'GC';
  if (/\bacademy\b|아카데미/i.test(name)) return 'Academy';
  return 'TEAM';
}
