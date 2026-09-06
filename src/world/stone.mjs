// Cut limestone courses and fine grain; lighting remains dynamic.
export function limestone(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 stonePosition; varying vec3 stoneNormal;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 stoneVertex = vec4(position,1.);
        vec3 stoneFace = normal;
        #ifdef USE_INSTANCING
          stoneVertex = instanceMatrix * stoneVertex;
          stoneFace = mat3(instanceMatrix) * stoneFace;
        #endif
        stonePosition=(modelMatrix*stoneVertex).xyz;
        stoneNormal=normalize(mat3(modelMatrix)*stoneFace);`,
      );
    shader.fragmentShader =
      'varying vec3 stonePosition; varying vec3 stoneNormal;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  vec3 cell=floor(stonePosition*190.);
  float grain=fract(sin(dot(cell,vec3(12.9898,78.233,39.425)))*43758.5453);
  float fade=1.-smoothstep(.005,.04,length(fwidth(stonePosition)));
  diffuseColor.rgb*=1.+(grain-.5)*.065*fade;
  vec3 face=abs(normalize(stoneNormal));
  float along=face.x>face.z ? stonePosition.z : stonePosition.x;
  float course=floor(stonePosition.y/.24);
  vec2 blocks=vec2(along/.72+mod(course,2.)*.5,stonePosition.y/.24);
  vec2 edge=min(fract(blocks),1.-fract(blocks))*vec2(.72,.24);
  float seam=min(edge.x,edge.y);
  float aa=max(fwidth(seam),.0005);
  float joints=1.-smoothstep(.0015-aa,.0035+aa,seam);
  float jointFade=1.-smoothstep(.012,.05,max(fwidth(along),fwidth(stonePosition.y)));
  float wall=1.-smoothstep(.35,.65,face.y);
  float blockTone=fract(sin(dot(floor(blocks),vec2(127.1,311.7)))*43758.5453);
  diffuseColor.rgb*=1.+wall*((blockTone-.5)*.035-joints*jointFade*.18);`,
      );
  };
  material.customProgramCacheKey = () => 'limestone-courses-v2';
  return material;
}
