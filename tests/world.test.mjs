import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {parcels,batchArchitecture,boulevard} from '../src/world/urban.ts';
import {architecture} from '../src/world/architecture.ts';
import {contract,canService,completeService} from '../shared/operations.mjs';
import {streetRoute} from '../src/world/navigation.ts';
const snapshots=JSON.parse(readFileSync(new URL('../server/atlas.json',import.meta.url)));
test('every atlas snapshot builds real three-dimensional meshes, including snapshots without directory summaries',()=>{
  for(const data of snapshots){
    const layout=parcels(data),root=new T.Group();
    for(const p of layout.parcels){const kit=architecture(p.file,p.scale);kit.group.position.set(p.x,0,p.z);root.add(kit.group);}
    const mesh=batchArchitecture(root),bounds=new T.Box3().setFromObject(mesh);
    assert.equal(layout.parcels.length,data.files.length);
    assert.ok(bounds.max.y>1);assert.ok(mesh.children.length>0);
    mesh.traverse(o=>assert.equal(o instanceof T.Sprite,false));
    for(const group of [root,mesh])group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});
  }
});
test('adding source samples preserves existing parcel addresses',()=>{
  const data={files:Array.from({length:32},(_,i)=>({path:`src/file-${i}.ts`})),directories:[{name:'src',count:100}]};
  const addresses=new Map();const initial=parcels({...data,files:data.files.slice(0,8)},addresses);
  const expanded=parcels(data,addresses);
  for(const p of initial.parcels){const next=expanded.parcels.find(n=>n.file.path===p.file.path);assert.equal(p.x,next.x);assert.equal(p.z,next.z);}
});
test('dependency roads are flat ribbons, and walking routes follow street intersections',()=>{
  const road=boulevard([new T.Vector3(0,0,0),new T.Vector3(20,0,10),new T.Vector3(40,0,0)]);
  road.group.traverse(o=>{if(o instanceof T.Mesh){assert.notEqual(o.geometry.type,'TubeGeometry');const positions=o.geometry.attributes.position;for(let i=0;i<positions.count;i++)assert.ok(positions.getY(i)<=.05);}});
  const route=streetRoute(new T.Vector3(0,1.7,13),new T.Vector3(-12,0,4),new T.Vector3(),1,1);
  for(let i=1;i<route.length;i++)assert.ok(route[i].x===route[i-1].x || route[i].z===route[i-1].z);
});
test('services use real source paths, require proximity and award only repeat-safe personal standing',()=>{
  const repo={id:'org/repo',files:[{path:'src/a.ts'},{path:'src/b.ts'},{path:'src/c.ts'}]};
  const job=contract(repo,'courier');assert.equal(job.stops.length,4);assert.equal(job.stops.at(-1),'@depot');
  assert.equal(canService(10,true),false);assert.equal(canService(.5,false),false);assert.equal(canService(.5,true),true);
  const result=completeService({completed:[],reputation:0,rounds:{}},job,30);
  assert.equal(result.reputation,60);assert.equal(result.hard,undefined);assert.equal(result.soft,undefined);
  assert.deepEqual(completeService(result,job,30),result);
  assert.equal(contract(repo,'courier',1).round,1);
});

test('overview batching preserves distinct physical surface finishes', () => {
  const root = new T.Group();
  for (const surface of ['brick', 'concrete']) {
    const material = new T.MeshStandardMaterial({ color: '#aaaaaa', roughness: 0.8 });
    material.userData.surface = surface;
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), material));
  }
  const batch = batchArchitecture(root);
  assert.equal(batch.children.length, 2);
  assert.deepEqual(batch.children.map(m => m.material.userData.surface).sort(), ['brick', 'concrete']);
  for (const group of [root, batch]) group.traverse(o => {
    if (o instanceof T.Mesh) { o.geometry.dispose(); o.material.dispose(); }
  });
});
