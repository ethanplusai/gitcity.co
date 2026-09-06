// Recolor the authored blue clothing only; preserve skin, hair and trousers.
export function citizenFinish(material) {
  const previous = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader =
      'attribute vec3 citizenTint; varying vec3 citizenClothing;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ncitizenClothing=citizenTint;',
      );
    shader.fragmentShader =
      'varying vec3 citizenClothing;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      float clothing=smoothstep(.008,.035,diffuseColor.b-diffuseColor.r);
      float fabricValue=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
      vec3 fabric=citizenClothing*(.7+fabricValue*1.4);
      diffuseColor.rgb=mix(diffuseColor.rgb,fabric,clothing);`,
      );
  };
  material.customProgramCacheKey = () => key + ':citizen-clothing-v1';
  material.needsUpdate = true;
  return material;
}
