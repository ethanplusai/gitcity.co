// Tourist discoveries are local keepsakes, never contribution currency.
export function discover(journal, city, kind, path = '') {
  const key = JSON.stringify([city, kind, path]);
  if (journal.includes(key)) return journal;
  return [...journal, key].slice(-3000);
}
export function expedition(journal, city) {
  const entries = journal.flatMap((key) => {
    try {
      const value = JSON.parse(key);
      return Array.isArray(value) ? [value] : [];
    } catch {
      return [];
    }
  });
  const local = entries.filter((e) => e[0] === city);
  const buildings = local.filter((e) => e[1] === 'file').length;
  const hall = local.some((e) => e[1] === 'hall');
  const cities = new Set(entries.map((e) => e[0])).size;
  return {
    buildings,
    hall,
    cities,
    xp: entries.reduce((sum, e) => sum + (e[1] === 'file' ? 15 : e[1] === 'hall' ? 25 : 10), 0),
    complete: buildings >= 3 && hall,
  };
}
