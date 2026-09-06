// Overlapping slate courses in city units. Derivative filtering removes the
// pattern before it becomes subpixel; no extra geometry or texture downloads.
export function slateRoof(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec2 slatePoint;\nvarying float slateSlope;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        slatePoint=abs(normal.x)>abs(normal.z)?position.zx:position.xz;
        slateSlope=1.-smoothstep(.97,.999,abs(normal.y));`,
      );
    shader.fragmentShader =
      `varying vec2 slatePoint;
varying float slateSlope;
float slateHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
` + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 slateCourses=slatePoint/vec2(.105,.065);
slateCourses.x+=mod(floor(slateCourses.y),2.)*.5;
vec2 slateCell=floor(slateCourses),slateLocal=fract(slateCourses);
vec2 slateAA=max(fwidth(slateCourses),vec2(.001));
float slateDetail=(1.-smoothstep(.35,1.2,max(slateAA.x,slateAA.y)))*slateSlope;
float slateSide=smoothstep(.022-slateAA.x,.022+slateAA.x,min(slateLocal.x,1.-slateLocal.x));
float slateCourse=smoothstep(.045-slateAA.y,.045+slateAA.y,slateLocal.y);
float slateTile=slateSide*slateCourse;
float slateTone=.87+.26*slateHash(slateCell);
float slateGrain=(slateHash(floor(slatePoint*420.))-.5)*.035;
diffuseColor.rgb*=mix(1.,mix(.55,slateTone+slateGrain,slateTile),slateDetail);
float slateRelief=(slateTile*.0009+slateLocal.y*.0008)*slateDetail;
`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
vec3 slateDX=dFdx(-vViewPosition),slateDY=dFdy(-vViewPosition);
vec3 slateR1=cross(slateDY,normal),slateR2=cross(normal,slateDX);
float slateDet=dot(slateDX,slateR1);
vec3 slateGradient=sign(slateDet)*(dFdx(slateRelief)*slateR1+dFdy(slateRelief)*slateR2);
normal=normalize(max(abs(slateDet),1.e-10)*normal-slateGradient);`,
    );
  };
  material.customProgramCacheKey = () => 'slate-courses-v1';
  return material;
}
