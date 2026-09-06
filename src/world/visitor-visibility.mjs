// A pedestrian sharing the camera's personal space must not cover the view.
// Dithered alpha keeps opaque rendering and avoids transparent sorting issues.
export function visitorVisibility(material) {
  if (material.userData.visitorVisibility) return material;
  material.userData.visitorVisibility = true;
  const previous = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.alphaHash = true;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader =
      'varying float visitorVisibility;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      vec4 visitorOrigin=vec4(0.,0.,0.,1.);
      #ifdef USE_INSTANCING
        visitorOrigin=instanceMatrix*visitorOrigin;
      #endif
      visitorOrigin=modelMatrix*visitorOrigin;
      float visitorScale=max(length(modelMatrix[0].xyz),.0001);
      float visitorDistance=length(cameraPosition.xz-visitorOrigin.xz)/visitorScale;
      visitorVisibility=abs(cameraPosition.y-visitorOrigin.y)/visitorScale>2. ? 1. : smoothstep(.45,.95,visitorDistance);`,
      );
    shader.fragmentShader =
      'varying float visitorVisibility;\n' +
      shader.fragmentShader.replace(
        '#include <alphahash_fragment>',
        'diffuseColor.a*=visitorVisibility;\n#include <alphahash_fragment>',
      );
  };
  material.customProgramCacheKey = () => key + ':visitor-clearance-v1';
  material.needsUpdate = true;
  return material;
}
