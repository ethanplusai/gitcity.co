import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { architecture } from '../src/world/architecture.ts';
import { batchArchitecture } from '../src/world/urban.ts';

const panes = (root) => {
  const values = [];
  root.traverse((o) => {
    if (o.material?.customProgramCacheKey() !== 'gitcity-room-depth-v3') return;
    values.push(...o.geometry.attributes.uv.array);
  });
  return values.sort((a, b) => a - b);
};
const dispose = (root) =>
  root.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });

test('window variation is path-stable and survives neighborhood batching and translation', () => {
  const file = { path: 'src/render.ts', symbols: 40, lines: 400, complexity: 9 };
  const a = architecture(file).group,
    b = architecture(file).group;
  assert.deepEqual(panes(a), panes(b));
  assert.ok(new Set(panes(a)).size > 20, 'a facade should contain different room selections');
  const other = architecture({ ...file, path: 'src/routes.ts' }).group;
  assert.notDeepEqual(panes(a), panes(other));
  const root = new Group();
  root.add(a);
  a.position.set(420, 0, -810);
  a.rotation.y = 0.7;
  const merged = batchArchitecture(root);
  assert.deepEqual(panes(merged), panes(b));
  for (const group of [root, b, other, merged]) dispose(group);
});
