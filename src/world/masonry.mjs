// Shared scanned brick surfaces, with running-bond fallback before maps arrive.
export function brickwork(material) {
  material.userData.surface = 'brick';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec2 masonryPoint;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nmasonryPoint=uv/3.9;',
      );
    shader.fragmentShader =
      `varying vec2 masonryPoint;
float brickHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float mortarRelief=0.;
#ifndef USE_MAP
vec2 courses=masonryPoint/vec2(.09,.03);
courses.x+=mod(floor(courses.y),2.)*.5;
vec2 cell=floor(courses),local=fract(courses),aa=max(fwidth(courses),vec2(.001));
vec2 edge=min(local,1.-local);
vec2 fill=smoothstep(vec2(.035,.055)-aa,vec2(.035,.055)+aa,edge);
float brick=fill.x*fill.y;
float variation=brickHash(cell);
float detail=1.-smoothstep(.3,1.1,max(aa.x,aa.y));
float grain=(brickHash(floor(masonryPoint*650.))-.5)*.035*detail;
vec3 face=diffuseColor.rgb*(.9+variation*.2+grain);
vec3 mortar=diffuseColor.rgb*vec3(1.08,1.14,1.19)*.75;
diffuseColor.rgb=mix(face*.94,mix(mortar,face,brick),detail);
mortarRelief=brick*detail*.0008;
#endif
`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec3 brickSample=texture2D(map,vMapUv).rgb;
        // Retain the seeded wall palette instead of multiplying two dark
        // brick colors. The scan supplies local mineral and mortar variation.
        diffuseColor.rgb*=mix(vec3(1.),clamp(brickSample/vec3(.19,.105,.068),vec3(.35),vec3(2.)),.45);
      #endif`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      #ifndef USE_NORMALMAP
      vec3 reliefX=dFdx(-vViewPosition), reliefY=dFdy(-vViewPosition);
      vec3 reliefR1=cross(reliefY,normal), reliefR2=cross(normal,reliefX);
      float reliefDet=dot(reliefX,reliefR1);
      vec3 reliefGradient=sign(reliefDet)*(dFdx(mortarRelief)*reliefR1+dFdy(mortarRelief)*reliefR2);
      normal=normalize(max(abs(reliefDet),1.e-10)*normal-reliefGradient);
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'scanned-masonry-v3';
  return material;
}
