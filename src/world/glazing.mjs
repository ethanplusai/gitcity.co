// Analytic room intersections give each existing window depth without interior meshes.
export function interiorGlazing(material) {
  // Glass is dielectric; metallic glazing suppresses the transmitted room color.
  material.metalness = 0;
  material.onBeforeCompile = (shader) => {
    const varyings = 'varying vec2 roomUV; varying vec3 roomPosition; varying vec3 roomNormal;\n';
    shader.vertexShader =
      varyings +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      roomUV = uv; roomPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      roomNormal = normalize(mat3(modelMatrix) * normal);`,
      );
    shader.fragmentShader =
      varyings +
      `
float roomBoxHit(vec3 origin, vec3 ray, vec3 minimum, vec3 maximum) {
  vec3 first=(minimum-origin)/ray, second=(maximum-origin)/ray;
  vec3 nearTimes=min(first,second), farTimes=max(first,second);
  float nearHit=max(max(nearTimes.x,nearTimes.y),nearTimes.z);
  float farHit=min(min(farTimes.x,farTimes.y),farTimes.z);
  return farHit>=max(nearHit,0.) ? max(nearHit,0.) : 10000.;
}
` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      vec3 rn = normalize(roomNormal);
      vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.001), rn));
      vec3 vertical = normalize(cross(rn, tangent));
      vec3 eye = normalize(cameraPosition - roomPosition);
      vec3 ray = vec3(-dot(eye, tangent), -dot(eye, vertical), -max(abs(dot(eye,rn)),0.08));
      vec2 paneUV = fract(roomUV);
      vec2 roomCell = floor(roomUV);
      float roomChoice = fract(sin(dot(roomCell,vec2(127.1,311.7)))*43758.5453);
      float roomFinish = fract(sin(dot(roomCell,vec2(269.5,183.3)))*43758.5453);
      vec3 origin = vec3(paneUV * 2.0 - 1.0, 1.0);
      vec3 safeRay = sign(ray + vec3(0.00001)) * max(abs(ray),vec3(0.0001));
      vec3 hitTimes = (sign(safeRay) - origin) / safeRay;
      float distanceToWall = min(min(hitTimes.x,hitTimes.y),hitTimes.z);
      vec3 hit = origin + safeRay * max(distanceToWall,0.0);
      float floorFace = 1.0-smoothstep(-0.99,-0.96,hit.y);
      float ceilingFace = smoothstep(0.96,0.99,hit.y);
      float sideFace = smoothstep(0.96,0.99,abs(hit.x));
      vec3 wall = vec3(0.42,0.43,0.39) * mix(0.72,1.0,hit.y*.5+.5);
      vec3 roomTint = mix(wall,vec3(0.17,0.145,0.115),floorFace);
      roomTint = mix(roomTint,vec3(0.58,0.57,0.51),ceilingFace);
      roomTint *= 1.0-sideFace*0.24;
      roomTint *= mix(vec3(.92,.95,1.04),vec3(1.07,1.01,.88),roomFinish);
      // Contact darkening at room corners anchors the floor and walls.
      vec3 wallDistances = 1.-abs(hit);
      float cornerDistance = max(min(wallDistances.x,wallDistances.y),
        min(max(wallDistances.x,wallDistances.y),wallDistances.z));
      roomTint *= .64+.36*smoothstep(0.,.22,cornerDistance);
      // Solid furnishings intersect the viewing ray ahead of the back wall.
      float desk = roomBoxHit(origin,safeRay,vec3(-0.78,-0.58,-0.75),vec3(0.44,-0.48,0.05));
      float leftPedestal = roomBoxHit(origin,safeRay,vec3(-0.75,-1.,-0.72),vec3(-0.50,-0.58,-0.08));
      float rightPedestal = roomBoxHit(origin,safeRay,vec3(0.25,-1.,-0.72),vec3(0.43,-0.58,-0.08));
      desk = min(desk,min(leftPedestal,rightPedestal));
      float cabinet = roomBoxHit(origin,safeRay,vec3(0.57,-1.,-0.88),vec3(0.91,0.25,-0.48));
      float furnishing = min(desk,cabinet);
      if (furnishing < distanceToWall) {
        vec3 furnitureHit=origin+safeRay*furnishing;
        roomTint=desk<cabinet ? vec3(0.28,0.21,0.14) : vec3(0.24,0.28,0.27);
        roomTint*=0.8+0.2*smoothstep(-0.6,0.2,furnitureHit.y);
      }
      float ceilingLight = ceilingFace * (1.-smoothstep(.3,.34,abs(hit.x))) *
        (1.-smoothstep(.42,.48,abs(hit.z+.12)));
      float curtainWidth = mix(.72,.95,roomFinish);
      float curtain = smoothstep(curtainWidth,.99,abs(paneUV.x*2.-1.));
      float fold = .92+.08*cos(paneUV.x*110.);
      roomTint = mix(roomTint,vec3(.48,.46,.40)*fold,curtain*.8);
      // Some rooms have a partially lowered roller blind. Its lower edge
      // stays fixed to the window while the room behind moves in parallax.
      float blindBottom = .40+roomFinish*.48;
      float blindAA = max(fwidth(paneUV.y),.001);
      float blind = (1.-step(.38,roomChoice))*smoothstep(blindBottom-blindAA,blindBottom+blindAA,paneUV.y);
      vec3 blindColor = mix(vec3(.42,.40,.35),vec3(.58,.56,.49),roomFinish);
      blindColor *= .88+.12*smoothstep(blindBottom,blindBottom+.12,paneUV.y);
      roomTint = mix(roomTint,blindColor,blind);
      float grazing=pow(1.-abs(dot(eye,rn)),5.);
      diffuseColor.rgb=mix(roomTint*0.8,diffuseColor.rgb,0.16+grazing*.65);
      totalEmissiveRadiance *= roomTint * 1.65 + vec3(ceilingLight*0.6);

    `,
      );
  };
  material.customProgramCacheKey = () => 'gitcity-room-depth-v3';
  return material;
}
