import * as T from 'three';
import { building } from '../../shared/model.mjs';
import { architecture } from './architecture.ts';
import { batchArchitecture } from './urban.ts';
import type { CodeFile } from './types';
import { roofProfile, pitchedRoof } from './roof-kit.ts';

export type BuildingRecipe = {
  file: CodeFile;
  scale: number;
  rotation: number;
  body: T.MeshStandardMaterial;
  glass: T.MeshStandardMaterial;
  roof?: T.MeshStandardMaterial;
};

// Material state is small and retained for live lighting/cosmetics. Detailed
// meshes and their typed arrays are released, then regenerated from source data.
export function unloadBuildingBlock(
  objects: T.Group[],
  remove: (group: T.Group, keep?: Set<T.Material>) => void,
) {
  const source = new T.Group();
  for (const object of objects) {
    const recipe = object.userData.buildingRecipe as BuildingRecipe;
    const b = building(recipe.file),
      roof = roofProfile(recipe.file),
      w = b.width * recipe.scale,
      d = b.depth * recipe.scale;
    const mass = new T.Group();
    mass.position.copy(object.position);
    mass.rotation.y = recipe.rotation;
    const add = (
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
      material: T.Material,
    ) => {
      const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth).translate(x, y, z), material);
      mesh.userData.file = recipe.file;
      mass.add(mesh);
    };
    add(w, roof.eave, d, 0, roof.eave / 2, 0, recipe.body);
    if (roof.kind !== 'terrace') {
      const mesh = new T.Mesh(
        pitchedRoof(w, d, roof.eave, roof.rise, roof.kind === 'hip'),
        recipe.roof || recipe.body,
      );
      mesh.userData.file = recipe.file;
      mass.add(mesh);
      if (roof.kind === 'gable') {
        const ends = new T.Mesh(pitchedRoof(w, d, roof.eave, roof.rise, false, true), recipe.body);
        ends.userData.file = recipe.file;
        mass.add(ends);
      }
    } else add(w, 0.02, d, 0, b.height, 0, recipe.roof || recipe.body);
    for (let y = 0.55; y < roof.eave - 0.2; y += 0.85) {
      for (const sign of [-1, 1]) {
        add(w * 0.76, 0.28, 0.012, 0, y, sign * (d / 2 + 0.009), recipe.glass);
        add(0.012, 0.28, d * 0.76, sign * (w / 2 + 0.009), y, 0, recipe.glass);
      }
    }
    source.add(mass);
    const keep = new Set<T.Material>([recipe.body, recipe.glass]);
    if (recipe.roof) keep.add(recipe.roof);
    for (const child of [...object.children]) remove(child as T.Group, keep);
  }
  const proxy = batchArchitecture(source);
  source.traverse((object) => {
    if (object instanceof T.Mesh) object.geometry.dispose();
  });
  source.clear();
  proxy.name = 'source-block-massing';
  return proxy;
}

export function reloadBuildingBlock(objects: T.Group[], onMesh: (mesh: T.Object3D) => void) {
  for (const object of objects) {
    const recipe = object.userData.buildingRecipe as BuildingRecipe;
    const kit = architecture(recipe.file, recipe.scale);
    kit.group.rotation.y = recipe.rotation;
    kit.group.traverse((mesh) => {
      if (!(mesh instanceof T.Mesh)) return;
      if (mesh.material === kit.body) mesh.material = recipe.body;
      if (mesh.material === kit.glass) mesh.material = recipe.glass;
      if (recipe.roof && mesh.material === kit.roof) mesh.material = recipe.roof;
    });
    kit.body.dispose();
    kit.glass.dispose();
    if (recipe.roof) kit.roof.dispose();
    object.add(kit.group);
    kit.group.children.forEach(onMesh);
  }
}
