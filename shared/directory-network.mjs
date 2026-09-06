import { connectedCityCells, connectedStreetGraph } from './city-plan.mjs';

// Replace a group's six survey cells with its actual perimeter and access
// streets. Keeping the survey-cell interior grid would drive roads through
// the file plots when an aggregate resolves.
export function directoryNetwork(owner, legacy, groups) {
  const covered = new Set(
    groups.flatMap((group) => group.cells.map((c) => `${c.column}:${c.row}`)),
  );
  const cells = connectedCityCells(owner, [...legacy, ...groups.flatMap((group) => group.cells)]);
  const streets = [...cells.filter((c) => !covered.has(`${c.column}:${c.row}`)), ...groups];
  const civic = streets.find((c) => c.column === 0 && c.row === 0);
  const access = groups.flatMap((group) =>
    group.streets.map((street) => ({
      points: [street.a, street.b],
      kind: 'local',
      mandatory: true,
    })),
  );
  return {
    streets,
    // Source buildings face the mandatory access streets, not the survey
    // boundary. Keep that boundary available for connections, but do not
    // require an empty ring road around every directory reservation.
    graph: connectedStreetGraph(streets, [...legacy, ...(civic ? [civic] : [])], access),
  };
}
