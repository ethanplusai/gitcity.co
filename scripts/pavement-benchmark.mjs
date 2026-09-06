import { directoryCandidates, directoryBlock } from '../shared/directory-block.mjs';
import { directoryNetwork } from '../shared/directory-network.mjs';
import { StreetPavementCache } from '../src/world/street-pavement.mjs';
const groups = directoryCandidates('test', { x: 0, z: 0 }, new Set(), 438).map((c) =>
  directoryBlock('test', c.column, c.row),
);
const graph = directoryNetwork('test', [], groups).graph;
const cache = new StreetPavementCache();
for (let run = 0; run < 3; run++) {
  const start = performance.now();
  const parts = cache.get(graph);
  console.log({
    run,
    ms: performance.now() - start,
    cacheBytes: cache.bytes,
    triangles: parts.reduce((n, [, g]) => n + g.index.count / 3, 0),
  });
  for (const [, geometry] of parts) geometry.dispose();
}
