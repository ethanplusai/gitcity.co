// One fixture list shared by visible lamp geometry and the bounded light pool.
/** @param {{ streets: { column: number, row: number }[], lamps: { x: number, z: number }[], civic: { x: number, z: number } }} plan */
export function planFixtures(plan) {
  if (!plan.streets.some((cell) => cell.column === 0 && cell.row === 0)) return plan.lamps;
  const civic = [];
  for (const side of [-1, 1])
    for (const z of [-5.26, 4.96])
      civic.push({ x: plan.civic.x + side * 5.16, z: plan.civic.z + z });
  return [...plan.lamps, ...civic];
}
