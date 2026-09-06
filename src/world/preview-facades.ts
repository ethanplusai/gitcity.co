import * as T from 'three';
import { architecture } from './architecture.ts';
import { previewMassing } from './preview-massing.ts';
import { batchArchitecture } from './urban.ts';
import { yieldFrame } from './frame-yield.mjs';
import type { CodeFile } from './types';
export function disposePreviewFacades(group: T.Group) {
  const materials = new Set<T.Material>();
  group.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
    }
  });
  materials.forEach((material) => material.dispose());
  group.clear();
}
export async function preparePreviewFacades(
  parcels: { file: CodeFile; scale: number; x: number; z: number; rotation?: number }[],
  detail: boolean,
  canceled: () => boolean,
) {
  const source = new T.Group();
  let started = performance.now();
  try {
    for (const parcel of parcels) {
      if (canceled()) return null;
      const kit = detail
        ? architecture(parcel.file, parcel.scale)
        : previewMassing(parcel.file, parcel.scale);
      kit.group.position.set(parcel.x, 0, parcel.z);
      kit.group.rotation.y = parcel.rotation || 0;
      source.add(kit.group);
      if (performance.now() - started >= 8) {
        await yieldFrame();
        started = performance.now();
      }
    }
    if (canceled()) return null;
    return batchArchitecture(source);
  } finally {
    disposePreviewFacades(source);
  }
}
