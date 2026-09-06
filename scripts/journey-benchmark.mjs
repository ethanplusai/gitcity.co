import { directoryCandidates, directoryBlock } from '../shared/directory-block.mjs';
import { directoryNetwork } from '../shared/directory-network.mjs';
import { JourneyNetwork, CityJourneys } from '../shared/journeys.mjs';
const groups = directoryCandidates('test', { x: 0, z: 0 }, new Set(), 438).map((c) =>
  directoryBlock('test', c.column, c.row),
);
const graph = directoryNetwork('test', [], groups).graph;
const destinations = Array.from({ length: 64 }, (_, i) => ({
  id: String(i),
  point: groups[i * 6].lots[i % 64].front,
}));
const start = performance.now();
const network = new JourneyNetwork(graph, destinations);
const projected = performance.now();
const journeys = new CityJourneys(network, 80, 'benchmark');
console.log(
  JSON.stringify({
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    projectionMs: projected - start,
    routingMs: performance.now() - projected,
    actors: journeys.actors.length,
  }),
);
const saved = journeys.snapshot();
const oldNetwork = new JourneyNetwork(graph, destinations);
const directNetwork = new JourneyNetwork(graph, destinations);
let restoreStart = performance.now();
const reconstructed = new CityJourneys(oldNetwork, 80, 'benchmark');
reconstructed.restore(saved);
const reconstructMs = performance.now() - restoreStart;
restoreStart = performance.now();
new CityJourneys(directNetwork, 80, 'benchmark', false, saved);
console.log({
  reconstructThenRestoreMs: reconstructMs,
  restoreDirectlyMs: performance.now() - restoreStart,
});
