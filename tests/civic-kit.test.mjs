import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { civicHall } from '../src/world/civic.ts';
import { architecture } from '../src/world/architecture.ts';
import { building } from '../shared/model.mjs';
test('civic kit is bounded, batched and deterministically generated', () => {
  const a = civicHall(),
    b = civicHall();
  const box = new T.Box3().setFromObject(a);
  assert.ok(box.max.y < 3.3);
  assert.ok(a.children.length <= 9);
  assert.deepEqual(
    a.children[0].geometry.attributes.position.array,
    b.children[0].geometry.attributes.position.array,
  );
  for (const group of [a, b])
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
});
test('facade detailing preserves code-derived envelope and finite geometry', () => {
  for (const symbols of [0, 10, 70]) {
    const file = { path: 'src/sample.ts', symbols, complexity: 12, size: 2000 },
      source = building(file),
      kit = architecture(file);
    const bounds = new T.Box3().setFromObject(kit.group);
    assert.ok(bounds.max.y >= source.height);
    assert.ok(bounds.max.y < source.height + 0.3);
    assert.ok(bounds.max.x - bounds.min.x < source.width + 0.2);
    kit.group.traverse((o) => {
      if (o.isMesh) {
        assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
});

test('source building roof variants stay within the code envelope and regenerate exactly', () => {
  const forms = new Set();
  for (let i = 0; i < 18; i++) {
    const file = { path: `src/roof-${i}.ts`, symbols: 8, complexity: 3 };
    const a = architecture(file),
      b = architecture(file);
    forms.add(a.group.userData.roof);
    const bounds = new T.Box3().setFromObject(a.group);
    assert.ok(bounds.max.y >= building(file).height);
    assert.ok(bounds.max.y < building(file).height + 0.3);
    assert.ok(bounds.max.x - bounds.min.x < building(file).width + 0.2);
    a.group.children.forEach((mesh, index) => {
      assert.deepEqual(
        mesh.geometry.attributes.position.array,
        b.group.children[index].geometry.attributes.position.array,
      );
    });
    for (const kit of [a, b])
      kit.group.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
  }
  assert.deepEqual([...forms].sort(), ['gable', 'hip', 'terrace']);
});

test('civic side approach rises continuously to the landing without crossing a wing', () => {
  const hall = civicHall();
  hall.updateMatrixWorld(true);
  for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    const ray = new T.Raycaster(new T.Vector3(0.82, 1, -5.5 + 3.6 * t), new T.Vector3(0, -1, 0));
    const hit = ray.intersectObject(hall, true)[0];
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.y - (0.0525 + 0.3 * t)) < 1e-6);
  }
  for (const x of [-0.1, 0.82]) {
    const ray = new T.Raycaster(new T.Vector3(x, 1, -1.7), new T.Vector3(0, -1, 0));
    assert.ok(Math.abs(ray.intersectObject(hall, true)[0].point.y - 0.3525) < 1e-6);
  }
  hall.traverse((object) => {
    if (object.isMesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
});

test('civic windows occupy real recesses on front, rear and side elevations', () => {
  const hall = civicHall();
  hall.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    for (const face of [-1, 1]) {
      const ray = new T.Raycaster(
        new T.Vector3(side * 2.6 + 0.15, 0.73, face * 6),
        new T.Vector3(0, 0, -face),
      );
      const hit = ray.intersectObject(hall, true)[0];
      assert.equal(hit.object.material.userData.nightWindow, true);
      assert.ok(Math.abs(hit.point.z) < 2.14, 'glass sits behind the 2.2 masonry face');
    }
    const ray = new T.Raycaster(new T.Vector3(side * 6, 0.73, -1.25), new T.Vector3(-side, 0, 0));
    const hit = ray.intersectObject(hall, true)[0];
    assert.equal(hit.object.material.userData.nightWindow, true);
    assert.ok(Math.abs(hit.point.x) < 3.94, 'side glass sits behind the 4.0 masonry face');
  }
  hall.traverse((object) => {
    if (object.isMesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
});

test('source entrance glass remains unobstructed by facade piers and shop-window sills', () => {
  for (const symbols of [0, 10, 70]) {
    const file = { path: 'src/entrance.ts', symbols, complexity: 12, size: 2000 };
    const kit = architecture(file),
      model = building(file);
    kit.group.updateMatrixWorld(true);
    for (const x of [-0.04, 0.04])
      for (const y of [0.2, 0.32, 0.6]) {
        const ray = new T.Raycaster(
          new T.Vector3(x, y, model.depth / 2 + 1),
          new T.Vector3(0, 0, -1),
        );
        const hit = ray.intersectObject(kit.group, true)[0];
        assert.ok(hit);
        assert.equal(hit.object.material.customProgramCacheKey(), 'gitcity-room-depth-v3');
        assert.ok(Math.abs(hit.point.z - (model.depth / 2 - 0.0165)) < 1e-6);
      }
    kit.group.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
  }
});
