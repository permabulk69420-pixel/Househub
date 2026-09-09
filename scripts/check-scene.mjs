import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildApartment,isWalkable,SPAWN } from '../src/apartment.js';
import { Navigation } from '../src/navigation.js';

// Test the actual apartment geometry and navigation space, without a mock renderer.
const keys=['oak','walnut','travertine','plaster','linen','rug','leather','darkStone','darkFabric','ceramic','brass','blackMetal','whitePaint','black','screen','paper','bookRust','bookOlive','leaf','soil','warmLight','dimLight','glass'];
const materials=Object.fromEntries(keys.map(name=>[name,Object.assign(new THREE.MeshStandardMaterial(),{name})]));
const apartment=buildApartment(materials);
assert(isWalkable(apartment.colliders,SPAWN.x,SPAWN.z),'Spawn must be clear of furniture and walls');
assert(!isWalkable(apartment.colliders,0,-7.2),'North windows must block movement');
assert(!isWalkable(apartment.colliders,6.8,-3.5),'The bed must block movement');
assert(!isWalkable(apartment.colliders,-5.3,3.27),'The kitchen island must block movement');
assert(isWalkable(apartment.colliders,2.7,1.8),'Suite doorway must be open');
assert(isWalkable(apartment.colliders,3.83,.7),'Bedroom doorway must be open');
assert(isWalkable(apartment.colliders,3.90,3),'Bathroom doorway must be open');
let triangles=0,meshes=0;
apartment.root.traverse(object=>{
  if(!object.isMesh)return;meshes++;const g=object.geometry;
  for(const attr of ['position','normal','uv','uv1','color'])assert(g.attributes[attr],`${object.name} needs ${attr}`);
  for(const attr of ['position','normal','uv'])for(const value of g.attributes[attr].array)assert(Number.isFinite(value),`${object.name} has invalid ${attr}`);
  triangles+=(g.index?g.index.count:g.attributes.position.count)/3;
});
assert(triangles<350000,`Geometry budget exceeded: ${triangles}`);
assert(meshes<145,`Static batch budget exceeded: ${meshes}`);

// Flood-fill at body radius: each room must be reachable from the real spawn.
const grid=.15,originX=-8.7,originZ=-6.7,nx=117,nz=91;
const index=(x,z)=>z*nx+x,clear=new Uint8Array(nx*nz),seen=new Uint8Array(nx*nz);
for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)clear[index(x,z)]=isWalkable(apartment.colliders,originX+x*grid,originZ+z*grid)?1:0;
const sx=Math.round((SPAWN.x-originX)/grid),sz=Math.round((SPAWN.z-originZ)/grid),queue=[[sx,sz]];seen[index(sx,sz)]=1;
for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const n=index(xx,zz);if(clear[n]&&!seen[n]){seen[n]=1;queue.push([xx,zz]);}}}
for(const [name,x,z] of [['Living',-3,0],['Kitchen',-5,4.6],['Bedroom',3.83,-1.5],['Bathroom',4.9,3.9],['Shower',8.1,3.9],['Gallery',7.7,1.8]])assert(seen[index(Math.round((x-originX)/grid),Math.round((z-originZ)/grid))],`${name} must be reachable without walking through furniture`);
assert(apartment.root.getObjectByName('PlayerSpawn'),'Player spawn anchor is required');
// Turning a player standing away from the tracking origin must pivot at their head.
const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);
rig.position.set(-.6,0,2.3);camera.position.set(.83,1.72,-.37);
const nav=Object.assign(Object.create(Navigation.prototype),{rig,camera,colliders:apartment.colliders,head:new THREE.Vector3(),before:new THREE.Vector3(),after:new THREE.Vector3()});
const before=nav.headPosition().clone();nav.rotate(Math.PI/2);
assert(before.distanceTo(nav.headPosition())<1e-6,'Turning must preserve the off-center tracked head position');
rig.rotation.y=0;rig.position.set(0,0,-6.50);camera.position.set(0,1.72,0);
nav.move(0,-1);
assert(isWalkable(apartment.colliders,nav.headPosition().x,nav.headPosition().z),'Movement must stop at the window even for a large requested step');
console.log(`Apartment verified: ${meshes} static batches, ${Math.round(triangles).toLocaleString()} triangles, ${apartment.stats.sourceMeshes} authored pieces. All rooms reachable.`);
