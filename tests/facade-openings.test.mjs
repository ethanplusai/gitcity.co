import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { architecture, architectureStyle } from '../src/world/architecture.ts';
import { roofProfile } from '../src/world/roof-kit.ts';

test('facade wall panels meet window openings without masking their lower panes', () => {
  for (const [symbols, complexity] of [
    [18, 4],
    [45, 4],
    [20, 18],
  ]) {
    const file = { path: 'src/facade.ts', symbols, complexity, lines: 300, analysis: 'AST' };
    const kit = architecture(file),
      style = architectureStyle(file),
      height = roofProfile(file).eave;
    const floors = Math.max(1, Math.floor(height / 0.83)),
      storey = height / floors;
    const span = style.b.width;
    const bays = Math.max(
      2,
      Math.round(span / (style.family === 'glass' ? 0.82 : style.family === 'brick' ? 0.88 : 0.78)),
    );
    const bay = span / bays;
    const pier = Math.min(
      style.family === 'glass' ? 0.055 : style.family === 'brick' ? 0.21 : 0.16,
      bay * 0.3,
    );
    const wh = storey * (style.family === 'glass' ? 0.86 : style.family === 'brick' ? 0.55 : 0.62);
    const wy = storey * 1.52;
    const x = (-(bays - 1) / 2) * bay + (bay - pier) * 0.23;
    kit.group.updateMatrixWorld(true);
    const hitAt = (y) =>
      new T.Raycaster(
        new T.Vector3(x, y, style.b.depth / 2 + 2),
        new T.Vector3(0, 0, -1),
      ).intersectObject(kit.group)[0];
    assert.ok(floors > 1);
    for (const fraction of [-0.35, 0.35]) {
      const hit = hitAt(wy + wh * fraction);
      assert.equal(hit.object.material.customProgramCacheKey(), 'gitcity-room-depth-v3');
    }
    const headWall = hitAt(wy + wh / 2 + 0.025);
    assert.notEqual(headWall.object.material.customProgramCacheKey(), 'gitcity-room-depth-v3');
    kit.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    style.materials.forEach((m) => m.dispose());
  }
});
