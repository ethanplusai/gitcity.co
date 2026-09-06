import * as T from 'three';
import type { InventoryRegion } from './inventory-layout.ts';

// Unanalyzed sources have a neutral survey envelope, not an invented source
// height, commit age or occupancy. Exact reserved plots resolve independently.
export function directoryMassing(regions: InventoryRegion[]) {
  const slots = regions.flatMap((region) =>
    region.unresolved.map((slot) => ({ region, lot: region.lots[slot] })),
  );
  const group = new T.Group();
  group.name = 'directory-massing';
  if (!slots.length) return group;
  const material = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96 });
  const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), material, slots.length);
  const palette = ['#aaa99b', '#a5a393', '#aeaea1', '#a6a698'].map((color) => new T.Color(color));
  const matrix = new T.Matrix4();
  const near = new Map(regions.map((region) => [region, true]));
  const rebuild = () => {
    const displayed: {
      region: InventoryRegion;
      slot: number;
      x: number;
      z: number;
      width: number;
      depth: number;
      rotation: number;
    }[] = [];
    for (const region of regions) {
      const indices = [...region.unresolved].sort((a, b) => a - b);
      for (let i = 0; i < indices.length; i++) {
        const first = indices[i],
          lot = region.lots[first];
        let last = first;
        if (!near.get(region)) {
          while (
            i + 1 < indices.length &&
            indices[i + 1] === last + 1 &&
            Math.floor(indices[i + 1] / 11) === Math.floor(first / 11)
          )
            last = indices[++i];
        }
        const end = region.lots[last];
        displayed.push({
          region,
          slot: first,
          x: (lot.x + end.x) / 2,
          z: (lot.z + end.z) / 2,
          width: Math.hypot(end.x - lot.x, end.z - lot.z) + lot.width * 0.88,
          depth: lot.depth * 0.88,
          rotation: lot.rotation || 0,
        });
      }
    }
    mesh.count = displayed.length;
    displayed.forEach(({ region, slot, x, z, width, depth, rotation }, index) => {
      // A survey marks reserved ground; it must not fabricate a skyline
      // before code analysis supplies the actual building dimensions.
      matrix.makeRotationY(rotation).scale(new T.Vector3(width, 0.08, depth));
      matrix.setPosition(x, 0.15, z);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(
        index,
        palette[Math.abs(region.column + region.row * 3 + Math.floor(slot / 11)) % palette.length],
      );
    });
    mesh.userData.directorySlots = displayed.map(({ region, slot }) => ({
      repo: region.repo,
      directory: region.directory,
      block: region.index,
      slot,
    }));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  };
  group.userData.updateSurvey = (camera: T.Vector3) => {
    let changed = false;
    for (const region of regions) {
      const dx = Math.max(0, Math.abs(camera.x - region.center.x) - region.width / 2);
      const dz = Math.max(0, Math.abs(camera.z - region.center.z) - region.depth / 2);
      const distance = Math.hypot(dx, dz, camera.y);
      const detailed = near.get(region)!;
      if ((detailed && distance > 100) || (!detailed && distance < 75)) {
        near.set(region, !detailed);
        changed = true;
      }
    }
    if (changed) rebuild();
  };
  rebuild();
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  group.add(mesh);
  return group;
}

export function directoryHit(hit: T.Intersection) {
  return hit.instanceId === undefined
    ? undefined
    : (hit.object.userData.directorySlots?.[hit.instanceId] as
        { repo: string; directory: string; block: number; slot: number } | undefined);
}
