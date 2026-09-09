import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildApartment,isWalkable,SPAWN,BOUNDS,VIEWS,ApartmentBuilder } from '../src/apartment.js';
import { loungeChair,diningChair,sofa,bed } from '../src/furniture.js';
import { Navigation } from '../src/navigation.js';

// Build the actual scene; this checks geometry and navigation, not GPU or headset performance.
const keys=['oak','walnut','travertine','plaster','linen','rug','leather','darkStone','darkFabric','ceramic','brass','blackMetal','whitePaint','black','screen','mirror','paper','bookRust','bookOlive','leaf','soil','warmLight','dimLight','glass'];
const materials=Object.fromEntries(keys.map(name=>[name,Object.assign(new THREE.MeshStandardMaterial(),{name})]));
const apartment=buildApartment(materials);
assert(isWalkable(apartment.colliders,SPAWN.x,SPAWN.z),'Spawn must be clear');
for(const [name,x,z] of [['North glazing',0,-11.1],['Bed',9.65,-6.4],['Kitchen island',-9.3,3.1],['Dressing partition',11.12,-6.4],['Shower glass',12.56,7.17]])assert(!isWalkable(apartment.colliders,x,z),`${name} must block walking`);
for(const [name,x,z] of [['Suite arch',3,1.1],['Bedroom door',4.85,-2],['Bathroom door',4.85,4]])assert(isWalkable(apartment.colliders,x,z),`${name} must be open`);
for(const [name,v] of Object.entries(VIEWS))assert(isWalkable(apartment.colliders,v.position[0],v.position[2]),`${name} inspection camera must be in clear floor space`);
let triangles=0,meshes=0,bytes=0;
apartment.root.traverse(object=>{
  if(!object.isMesh)return;meshes++;const g=object.geometry;
  assert(g.index,`${object.name}: retain indexed geometry for vertex memory`);
  for(const attr of ['position','normal','uv','uv1','color'])assert(g.attributes[attr],`${object.name} needs ${attr}`);
  for(const attr of ['position','normal','uv'])for(const value of g.attributes[attr].array)assert(Number.isFinite(value),`${object.name} has invalid ${attr}`);
  const n=g.attributes.normal;for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));assert(length>.90&&length<1.10,`${object.name} has an invalid normal`);}
  triangles+=g.index.count/3;bytes+=g.index.array.byteLength+Object.values(g.attributes).reduce((sum,a)=>sum+a.array.byteLength,0);
});
// Regression ceilings, not a visual-quality target or a claim of measured Quest performance.
assert(triangles<1600000,`Unexpected geometry growth: ${triangles}`);
assert(meshes<180,`Unexpected static batch growth: ${meshes}`);
assert(bytes<70e6,`Unexpected geometry buffer growth: ${bytes}`);

// Flood-fill the complete 28 × 22 m floor at a 22 cm body radius.
const grid=.15,originX=BOUNDS.minX+.25,originZ=BOUNDS.minZ+.25;
const nx=Math.floor((BOUNDS.maxX-.25-originX)/grid)+1,nz=Math.floor((BOUNDS.maxZ-.25-originZ)/grid)+1;
const index=(x,z)=>z*nx+x,clear=new Uint8Array(nx*nz),seen=new Uint8Array(nx*nz);
for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)clear[index(x,z)]=isWalkable(apartment.colliders,originX+x*grid,originZ+z*grid)?1:0;
const sx=Math.round((SPAWN.x-originX)/grid),sz=Math.round((SPAWN.z-originZ)/grid),queue=[[sx,sz]];assert(clear[index(sx,sz)]);seen[index(sx,sz)]=1;
for(let i=0;i<queue.length;i++){
  const [x,z]=queue[i];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const n=index(xx,zz);
    if(clear[n]&&!seen[n]){seen[n]=1;queue.push([xx,zz]);}
  }
}
const destinations=[['Main lounge',-2.3,-4.4],['Window salon',-10.5,-4.9],['Kitchen work aisle',-9.3,5.5],['Dining',-.2,6.2],['Bedroom',4.85,-3.1],['Bedside',9.4,-8.4],['Dressing area',12.1,-6.4],['Bathroom',6.3,6.3],['Shower',12.2,6.1],['WC',12.2,9.4],['Private gallery',8.7,1.0],['Entry door',13.1,1]];
for(let i=1;i<=4;i++){
  const anchor=apartment.root.getObjectByName('HubDoor_0'+i);assert(anchor,`Hub door ${i} anchor is required`);
  destinations.push(['Hub door '+i,anchor.position.x,anchor.position.z-.55]);
}
for(const [name,x,z] of destinations)assert(seen[index(Math.round((x-originX)/grid),Math.round((z-originZ)/grid))],`${name} must be reachable without crossing furniture or walls`);
assert(apartment.root.getObjectByName('PlayerSpawn'),'Player spawn anchor is required');

// The earlier defect changed backrest pitch when a chair was turned in the room.
// Rotating a whole piece of furniture must preserve height and local texture coordinates.
for(const factory of [loungeChair,diningChair,sofa]){
  const a=new ApartmentBuilder(materials),b=new ApartmentBuilder(materials);
  factory(a,'Fixture',0,0,0);factory(b,'Fixture',2,3,Math.PI/2);
  assert.equal(a.parts.length,b.parts.length);
  for(let i=0;i<a.parts.length;i++){
    const ga=a.parts[i].geometry,gb=b.parts[i].geometry,pa=ga.attributes.position,pb=gb.attributes.position;
    assert.equal(pa.count,pb.count);
    for(let j=0;j<pa.count;j++)assert(Math.abs(pa.getY(j)-pb.getY(j))<1e-6,`${factory.name}: rotating the furniture must not skew its height`);
    assert.deepEqual(ga.attributes.uv.array,gb.attributes.uv.array,`${factory.name}: texture coordinates must follow local orientation`);
  }
}
for(const [name,build] of [['Sofa',b=>sofa(b,'Test',0,0,0)],['Bed',b=>bed(b,0,0)]]){
  const b=new ApartmentBuilder(materials);build(b);const bounds=new THREE.Box3().setFromObject(b.root);
  assert(bounds.min.y>=-.002&&bounds.min.y<=.012,`${name}: feet must reach the floor`);
}

// Off-centre physical tracking must not make snap turns orbit around the room origin.
const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);rig.position.set(SPAWN.x,0,SPAWN.z);camera.position.set(.83,1.72,-.37);
const nav=Object.assign(Object.create(Navigation.prototype),{rig,camera,colliders:apartment.colliders,head:new THREE.Vector3(),before:new THREE.Vector3(),after:new THREE.Vector3()});
const before=nav.headPosition().clone();nav.rotate(Math.PI/2);assert(before.distanceTo(nav.headPosition())<1e-6,'Turning must preserve tracked head position');
rig.rotation.y=0;rig.position.set(-8.2,0,-10.4);camera.position.set(0,1.72,0);nav.move(0,-2);
assert(isWalkable(apartment.colliders,nav.headPosition().x,nav.headPosition().z),'A large movement step must stop at glazing');
assert(!nav.teleportVisible(0,-5,5,-5),'Teleport must not pass through the suite divider');
assert(!nav.teleportVisible(-9,6.8,-9,9),'Teleport must not pass through the kitchen/gallery spine');
assert(!nav.teleportVisible(10.6,-6.4,12,-6.4),'Teleport must not pass through the dressing partition');
assert(nav.teleportVisible(2,1,4,1),'Teleport may pass through the open suite arch');
console.log(`Apartment verified: ${meshes} static batches, ${Math.round(triangles).toLocaleString()} triangles, ${(bytes/1e6).toFixed(1)} MB geometry, ${apartment.stats.sourceMeshes} authored pieces. All rooms and four hub doors reachable. Furniture orientation and XR pivot regressions passed.`);
