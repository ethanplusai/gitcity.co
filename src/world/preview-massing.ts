import * as T from 'three';
import { architectureStyle } from './architecture.ts';
import { roofProfile, pitchedRoof } from './roof-kit.ts';
import type { CodeFile } from './types';

// Distant silhouettes retain source dimensions and roof form, without facade parts.
export function previewMassing(file: CodeFile, scale = 1) {
  const { b, materials } = architectureStyle(file);
  const roof = roofProfile(file),
    group = new T.Group();
  const width = b.width * scale,
    depth = b.depth * scale;
  const body = new T.Mesh(
    new T.BoxGeometry(width, roof.eave, depth).translate(0, roof.eave / 2, 0),
    materials[0],
  );
  group.add(body);
  if (roof.kind !== 'terrace') {
    group.add(
      new T.Mesh(
        pitchedRoof(width, depth, roof.eave, roof.rise, roof.kind === 'hip'),
        materials[4],
      ),
    );
    if (roof.kind === 'gable')
      group.add(
        new T.Mesh(pitchedRoof(width, depth, roof.eave, roof.rise, false, true), materials[0]),
      );
  } else
    group.add(
      new T.Mesh(new T.BoxGeometry(width, 0.02, depth).translate(0, b.height, 0), materials[4]),
    );
  for (const index of [1, 2, 3, 5]) materials[index].dispose();
  group.traverse((object) => {
    if (object instanceof T.Mesh) {
      object.userData.file = file;
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return { group };
}
