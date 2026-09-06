// World-space, filtered ground variation: no repeating photograph seams or distant shimmer.
export function groundCover(material, lawn = false) {
  if (!lawn) material.userData.surface = 'grass';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 coverPosition;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ncoverPosition=(modelMatrix*vec4(position,1.)).xyz;',
      );
    shader.fragmentShader =
      `varying vec3 coverPosition;
float coverHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float coverNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(coverHash(i),coverHash(i+vec2(1.,0.)),f.x),mix(coverHash(i+vec2(0.,1.)),coverHash(i+vec2(1.,1.)),f.x),f.y);}
` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 cover=coverPosition.xz;
float broad=coverNoise(cover*.045)*.6+coverNoise(cover*.17)*.4;
float grain=coverNoise(cover*90.);
float footprint=max(length(dFdx(cover)),length(dFdy(cover)))*90.;
float closeDetail=1.-smoothstep(.2,1.5,footprint);
diffuseColor.rgb*=${lawn ? '.94+broad*.12' : '.78+broad*.32'}+(grain-.5)*.16*closeDetail;
${lawn ? '' : 'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.12,.99,.82),smoothstep(.58,.8,broad)*.4);'}
`,
      );
    if (!lawn) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          `float groundRelief=0.;
        #ifdef USE_MAP
          // World coordinates keep the apron and independently rebuilt tiles
          // continuous. Fade high-frequency contrast before it aliases.
          vec2 groundUV=coverPosition.xz*.15;
          vec3 groundSample=texture2D(map,groundUV).rgb;
          float groundLuma=dot(groundSample,vec3(.2126,.7152,.0722));
          float groundPixel=max(length(dFdx(groundUV)),length(dFdy(groundUV)));
          float groundDetail=(1.-smoothstep(.025,.18,groundPixel))
            *(1.-smoothstep(20.,80.,length(vViewPosition)));
          vec3 groundTint=mix(vec3(1.),groundSample/max(groundLuma,.001),.22);
          vec3 groundFinish=groundTint*clamp(groundLuma*5.,.55,1.5);
          diffuseColor.rgb*=mix(vec3(1.),groundFinish,groundDetail);
          groundRelief=groundLuma*.025*groundDetail;
        #endif`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
        #ifdef USE_MAP
          vec3 groundDX=dFdx(-vViewPosition),groundDY=dFdy(-vViewPosition);
          vec3 groundR1=cross(groundDY,normal),groundR2=cross(normal,groundDX);
          float groundDet=dot(groundDX,groundR1);
          vec3 groundGradient=sign(groundDet)*(dFdx(groundRelief)*groundR1+dFdy(groundRelief)*groundR2);
          if(abs(groundDet)>1e-10) normal=normalize(abs(groundDet)*normal-groundGradient);
        #endif`,
        );
    }
  };
  material.customProgramCacheKey = () => `ground-cover-${lawn ? 'lawn' : 'meadow'}-v3`;
  return material;
}
