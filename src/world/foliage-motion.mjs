import * as T from 'three';

export const foliageClock = { value: 0 };
const deform = `
vec4 treeRoot = vec4(0.,0.,0.,1.);
#ifdef USE_INSTANCING
  treeRoot = instanceMatrix * treeRoot;
#endif
vec3 treeWorld = (modelMatrix * treeRoot).xyz;
float treePhase = dot(treeWorld.xz, vec2(.071,.053));
float treeWeight = pow(clamp((position.y-.6)/3.,0.,1.),2.);
float treeBreeze = sin(foliageTime*.85+treePhase) + .28*sin(foliageTime*1.7+treePhase*.61);
transformed.x += treeWeight*(.035*treeBreeze+.005*sin(foliageTime*3.1+position.y*4.));
transformed.z += treeWeight*.02*sin(foliageTime*.73+treePhase+.9);
`;
function wind(material, transmission = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.foliageTime = foliageClock;
    shader.vertexShader =
      'uniform float foliageTime;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + deform);
    if (transmission) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        // These normals describe the crown volume, not the card plane. Keep
        // their outward direction on both sides of each cutout spray.
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
          nonPerturbedNormal *= faceDirection;
        #endif`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
  // A modest forward-scattering lobe lets sunlit leaves read as thin tissue.
  float leafBacklight = pow(max(dot(normalize(vViewPosition), -directionalLights[0].direction), 0.), 3.);
  reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * leafBacklight * .12;
#endif
`,
      );
    }
  };
  material.customProgramCacheKey = () =>
    transmission ? 'foliage-crown-transmission-v2' : 'foliage-breeze-depth-v1';
  return material;
}

export function movingFoliage(mesh) {
  wind(mesh.material, true);
  mesh.customDepthMaterial = wind(
    new T.MeshDepthMaterial({
      depthPacking: T.RGBADepthPacking,
      map: mesh.material.map,
      alphaTest: mesh.material.alphaTest,
      side: T.DoubleSide,
    }),
  );
  mesh.customDistanceMaterial = wind(
    new T.MeshDistanceMaterial({
      map: mesh.material.map,
      alphaTest: mesh.material.alphaTest,
      side: T.DoubleSide,
    }),
  );
  mesh.material.addEventListener('dispose', () => {
    mesh.customDepthMaterial.dispose();
    mesh.customDistanceMaterial.dispose();
  });
  // Motion is below 0.06 local units; reserve it in the instance culling bound.
  let maxScale = 1;
  const matrix = new T.Matrix4();
  if (mesh.isInstancedMesh)
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      maxScale = Math.max(maxScale, matrix.getMaxScaleOnAxis());
    }
  if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.08 * maxScale;
  return mesh;
}
