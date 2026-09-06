import * as T from 'three';
// Survey ground only: unknown code never acquires invented building heights.
export function arrivalGrid(id: string) {
  const group = new T.Group();
  group.name = 'arrival-grid';
  const ground = new T.Mesh(
    new T.BoxGeometry(24, 0.04, 24),
    new T.MeshStandardMaterial({
      color: '#525e59',
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  ground.position.y = 0.03;
  ground.receiveShadow = true;
  group.add(ground);
  const plots = new T.InstancedMesh(
    new T.BoxGeometry(4.25, 0.035, 4.25),
    new T.MeshStandardMaterial({
      color: '#a4b09b',
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
    25,
  );
  const matrix = new T.Matrix4();
  for (let i = 0; i < 25; i++) {
    matrix.makeTranslation(((i % 5) - 2) * 4.7, 0.068, (Math.floor(i / 5) - 2) * 4.7);
    plots.setMatrixAt(i, matrix);
  }
  plots.receiveShadow = true;
  ground.userData.city = id;
  plots.userData.city = id;
  group.add(plots);
  return group;
}
