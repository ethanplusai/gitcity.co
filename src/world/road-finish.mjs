// Shared world-space aggregate and weathering, with pixel-filtered relief.
// No cracks or potholes: actual road damage continues to come from issues.
export function asphalt(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 roadPoint;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nroadPoint=(modelMatrix*vec4(position,1.)).xyz;',
      );
    shader.fragmentShader =
      `varying vec3 roadPoint;
float roadHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float roadNoise(vec2 p){vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(roadHash(cell),roadHash(cell+vec2(1.,0.)),f.x),
mix(roadHash(cell+vec2(0.,1.)),roadHash(cell+vec2(1.,1.)),f.x),f.y);}
` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
      float roadPixel=max(length(dFdx(roadPoint.xz)),length(dFdy(roadPoint.xz)));
      float roadFine=1.-smoothstep(.25,1.1,roadPixel*180.);
      float roadAggregate=1.-smoothstep(.2,1.2,roadPixel*45.);
      float roadMiddle=1.-smoothstep(.2,1.2,roadPixel*4.);
      float roadGrit=roadNoise(roadPoint.xz*180.);
      float roadStone=roadNoise(roadPoint.xz*45.);
      float roadWear=roadNoise(roadPoint.xz*.23)*.6+roadNoise(roadPoint.xz*1.7)*.4;
      float roadFinish=.96+(roadWear-.5)*.16
        +(roadNoise(roadPoint.xz*4.)-.5)*.07*roadMiddle
        +(roadStone-.5)*.2*roadAggregate+(roadGrit-.5)*.1*roadFine;
      diffuseColor.rgb*=roadFinish;
      float roadRelief=(roadStone-.5)*.0015*roadAggregate+(roadGrit-.5)*.0003*roadFine;
      `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+(roadWear-.5)*.1+(roadStone-.5)*.12*roadAggregate,.72,1.);
      `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
      vec3 roadDX=dFdx(-vViewPosition),roadDY=dFdy(-vViewPosition);
      vec3 roadR1=cross(roadDY,normal),roadR2=cross(normal,roadDX);
      float roadDet=dot(roadDX,roadR1);
      vec3 roadGradient=sign(roadDet)*(dFdx(roadRelief)*roadR1+dFdy(roadRelief)*roadR2);
      if(abs(roadDet)>1e-10)normal=normalize(abs(roadDet)*normal-roadGradient);
      `,
        );
  };
  material.customProgramCacheKey = () => 'asphalt-aggregate-v3';
  return material;
}
