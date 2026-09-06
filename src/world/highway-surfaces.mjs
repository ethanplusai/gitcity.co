import { streetMarkings } from '../../shared/street-markings.mjs';
import { HIGHWAY } from '../../shared/highway-profile.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { corridorGraph } from '../../shared/road-network.mjs';
import { streetContours, pointInPolygon } from '../../shared/street-surfaces.mjs';
import { asphalt } from './road-finish.mjs';

// One continuous surface per finish, including shared branches and crossings.
export function highwaySurfaces(corridors) {
  const group = new T.Group(),
    graph = corridorGraph(corridors);
  for (const [extra, height, color] of [
    [HIGHWAY.shoulder, HIGHWAY.shoulderHeight, '#9b9b8c'],
    [0, HIGHWAY.asphaltHeight, '#343d40'],
  ]) {
    const contours = streetContours(graph, extra),
      parts = [];
    for (const outer of contours.filter((c) => !c.interior)) {
      const shape = new T.Shape(outer.points.map((p) => new T.Vector2(p.x, -p.z)));
      for (const hole of contours.filter(
        (c) => c.interior && pointInPolygon(c.points[0], outer.points),
      ))
        shape.holes.push(new T.Path(hole.points.map((p) => new T.Vector2(p.x, -p.z))));
      parts.push(new T.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, height, 0));
    }
    if (!parts.length) continue;
    const material = new T.MeshStandardMaterial({ color, roughness: 1 });
    if (!extra) asphalt(material);
    const mesh = new T.Mesh(mergeGeometries(parts), material);
    parts.forEach((part) => part.dispose());
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const { dashes } = streetMarkings(graph);
  if (dashes.length) {
    const paint = new T.InstancedMesh(
      new T.PlaneGeometry(0.035, 0.7).rotateX(-Math.PI / 2),
      new T.MeshStandardMaterial({ color: '#c8c9bc', roughness: 0.9 }),
      dashes.length,
    );
    const pose = new T.Object3D();
    dashes.forEach((dash, i) => {
      pose.position.set(dash.x, HIGHWAY.asphaltHeight + 0.004, dash.z);
      pose.rotation.y = dash.angle;
      pose.updateMatrix();
      paint.setMatrixAt(i, pose.matrix);
    });
    paint.receiveShadow = true;
    paint.computeBoundingSphere();
    group.add(paint);
  }
  return group;
}
