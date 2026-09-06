import * as T from 'three';
import { batchArchitecture } from './urban.ts';

type Stream = {
  unload: (objects: T.Group[], batch: T.Group | null) => T.Group;
  reload: (objects: T.Group[]) => void;
  remove: (group: T.Group) => void;
};

// Identical meshes and finishes, grouped by physical block for distant draws.
// Build at most one block per frame, after construction, to avoid arrival stalls.
export class BlockBatches {
  chunks: {
    objects: T.Group[];
    batch: T.Group | null;
    proxy: T.Group | null;
    bounds: T.Box3;
    detailed: boolean;
  }[] = [];
  private parent: T.Group;
  private wasConstructing = true;
  private stream?: Stream;
  private onBatch: (batch: T.Group) => void;
  constructor(
    parent: T.Group,
    groups: Map<string, T.Group[]>,
    onBatch: (batch: T.Group) => void = () => {},
    stream?: Stream,
  ) {
    this.stream = stream;
    this.parent = parent;
    this.onBatch = onBatch;
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert();
    for (const objects of groups.values()) {
      const empty = objects.filter((object) => object.children.length === 0);
      let proxy: T.Group | null = null;
      if (stream && empty.length === objects.length) {
        proxy = stream.unload(objects, null);
        parent.add(proxy);
        proxy.updateWorldMatrix(true, true);
        onBatch(proxy);
      } else if (stream && empty.length) stream.reload(empty);
      const bounds = new T.Box3();
      for (const object of proxy ? [proxy] : objects)
        bounds.union(new T.Box3().setFromObject(object));
      bounds.applyMatrix4(inverse);
      this.chunks.push({ objects, batch: null, proxy, bounds, detailed: !proxy });
    }
  }
  update(camera: T.Vector3, inside: T.Group | null, constructing: boolean) {
    let distant = 0,
      built = false;
    if (this.wasConstructing && !constructing) {
      this.parent.updateWorldMatrix(true, true);
      const inverse = this.parent.matrixWorld.clone().invert();
      for (const chunk of this.chunks) {
        const bounds = new T.Box3();
        for (const object of chunk.proxy ? [chunk.proxy] : chunk.objects)
          bounds.union(new T.Box3().setFromObject(object));
        chunk.bounds.copy(bounds.applyMatrix4(inverse));
      }
    }
    this.wasConstructing = constructing;
    const chunks = this.stream
      ? [...this.chunks].sort((a, b) => {
          const priority = (chunk: typeof a) =>
            inside && chunk.objects.includes(inside) ? -1 : chunk.bounds.distanceToPoint(camera);
          return priority(a) - priority(b);
        })
      : this.chunks;
    for (const chunk of chunks) {
      const distance = chunk.bounds.distanceToPoint(camera);
      const chunkConstructing = this.stream
        ? constructing && chunk.objects.some((object) => object.scale.y < 0.9999)
        : constructing;
      const occupied = inside !== null && chunk.objects.includes(inside);
      if (
        this.stream &&
        !chunkConstructing &&
        !occupied &&
        distance > 80 &&
        !chunk.proxy &&
        !built
      ) {
        chunk.proxy = this.stream.unload(chunk.objects, chunk.batch);
        chunk.batch = null;
        this.parent.add(chunk.proxy);
        this.onBatch(chunk.proxy);
        built = true;
      }
      if (chunk.proxy) {
        if (this.stream && (chunkConstructing || occupied || distance < 60) && !built) {
          this.stream.remove(chunk.proxy);
          chunk.proxy = null;
          this.stream.reload(chunk.objects);
          built = true;
        } else {
          for (const object of chunk.objects) object.visible = false;
          chunk.detailed = false;
          for (const object of chunk.proxy.children) {
            const material = (object as T.Mesh).material as T.MeshStandardMaterial;
            const source = material.userData.sourceMaterial as T.MeshStandardMaterial;
            material.color.copy(source.color);
            material.emissive.copy(source.emissive);
            material.emissiveIntensity = source.emissiveIntensity;
          }
          distant++;
          continue;
        }
      }
      chunk.detailed =
        chunkConstructing ||
        (inside !== null && chunk.objects.includes(inside)) ||
        distance < (chunk.detailed ? 24 : 18);
      if (!chunk.detailed && !chunk.batch && !built) {
        const source = new T.Group();
        const originals = new Map<T.BufferGeometry, T.Mesh>();
        for (const object of chunk.objects) {
          object.traverse((child) => {
            if (child instanceof T.Mesh) originals.set(child.geometry, child);
          });
          const copy = new T.Group();
          copy.position.copy(object.position);
          copy.quaternion.copy(object.quaternion);
          copy.scale.copy(object.scale);
          copy.add(...object.children.map((child) => child.clone(true)));
          copy.visible = true;
          copy.scale.y = 1;
          source.add(copy);
        }
        chunk.batch = batchArchitecture(source, true);
        for (const object of chunk.batch.children) {
          const mesh = object as T.Mesh;
          for (const slice of mesh.userData.sourceSlices as {
            geometry: T.BufferGeometry;
            start: number;
            count: number;
            matrix: T.Matrix4;
          }[]) {
            const original = originals.get(slice.geometry)!;
            const view = new T.BufferGeometry();
            for (const [name, attribute] of Object.entries(mesh.geometry.attributes))
              view.setAttribute(name, attribute);
            view.setIndex(mesh.geometry.index);
            view.setDrawRange(slice.start, slice.count);
            // The shared vertices are already in district coordinates. Cancel
            // the original mesh's parent transforms without moving file anchors.
            original.matrixAutoUpdate = false;
            original.matrix.copy(slice.matrix);
            original.matrixWorldNeedsUpdate = true;
            original.geometry = view;
            slice.geometry.dispose();
          }
          // Do not keep the old typed arrays alive through bookkeeping.
          delete mesh.userData.sourceSlices;
        }
        chunk.batch.name = 'source-block-batch';
        chunk.bounds.setFromObject(chunk.batch);
        this.parent.add(chunk.batch);
        this.onBatch(chunk.batch);
        built = true;
      }
      if (!chunk.batch) chunk.detailed = true;
      else chunk.batch.visible = !chunk.detailed;
      for (const object of chunk.objects) object.visible = chunk.detailed && object !== inside;
      if (!chunk.detailed) distant++;
      for (const object of chunk.batch?.children || []) {
        const material = (object as T.Mesh).material as T.MeshStandardMaterial;
        const source = material.userData.sourceMaterial as T.MeshStandardMaterial;
        material.color.copy(source.color);
        material.emissive.copy(source.emissive);
        material.emissiveIntensity = source.emissiveIntensity;
      }
    }
    return distant;
  }
}
