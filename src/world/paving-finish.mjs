// Concrete panels and fine aggregate on the existing sidewalk surface. Filter
// joints by pixel footprint so detail fades at altitude instead of shimmering.
export function pavingFinish(material) {
  material.userData.surface = 'concrete';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 pavingPoint;\n' +
      shader.vertexShader
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\npavingPoint=(modelMatrix*vec4(position,1.)).xyz;',
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
        vec2 pavingUV=(modelMatrix*vec4(position,1.)).xz/2.4;
        #ifdef USE_MAP
          vMapUv=pavingUV;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv=pavingUV;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv=pavingUV;
        #endif
      `,
        );
    shader.fragmentShader =
      'varying vec3 pavingPoint;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      #ifndef USE_MAP
      vec2 slab = pavingPoint.xz / 1.2;
      vec2 pixel = max(fwidth(slab),vec2(.0001));
      vec2 edge = min(fract(slab),1.-fract(slab));
      vec2 seam = 1.-smoothstep(vec2(.0035),vec2(.0035)+pixel,edge);
      float detail = 1.-smoothstep(.12,.55,max(pixel.x,pixel.y));
      float joint = max(seam.x,seam.y)*detail;
      float panel = fract(sin(dot(floor(slab),vec2(127.1,311.7)))*43758.5453);
      float grain = fract(sin(dot(floor(pavingPoint.xz*145.),vec2(12.9898,78.233)))*43758.5453);
      float closeGrain=1.-smoothstep(.3,1.2,max(length(dFdx(pavingPoint.xz)),length(dFdy(pavingPoint.xz)))*145.);
      diffuseColor.rgb *= (.97 + (panel-.5)*.055*detail + (grain-.5)*.08*closeGrain) * (1.-joint*.3);
      #endif
    `,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        vec3 pavementColor=texture2D(map,vMapUv).rgb;
        float pavementLuma=dot(pavementColor,vec3(.2126,.7152,.0722));
        float pavementDistance=1.-smoothstep(25.,90.,length(vViewPosition));
        vec3 pavementFinish=mix(vec3(1.),pavementColor/max(pavementLuma,.001),.12)
          *clamp(pavementLuma*3.2,.4,1.55);
        diffuseColor.rgb*=mix(vec3(.94),pavementFinish,pavementDistance);
      #endif
    `,
    );
  };
  material.customProgramCacheKey = () => 'scanned-concrete-paving-v2';
  return material;
}
