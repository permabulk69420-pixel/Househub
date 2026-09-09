import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOUNDS } from './builder.js';
export { ApartmentBuilder,BOUNDS } from './builder.js';
export { buildApartment,SPAWN,VIEWS } from './environment.js';
export const FLOOR_Y=0;

// Soft, static contact decals. No depth-buffer AO pass or expensive screen effects.
export function addContactShadows(apartment) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,12,64,64,64);
  g.addColorStop(0,'rgba(32,24,16,0.37)');g.addColorStop(.40,'rgba(32,24,16,0.20)');g.addColorStop(1,'rgba(32,24,16,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({name:'Contact_Shadow',map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const geometries=[];
  for(const c of apartment.colliders) {
    if(/Wall|Glazing|Divider|Glass|Cabinet|Headboard/.test(c.name))continue;
    const w=c.maxX-c.minX,d=c.maxZ-c.minZ;if(w>6||d>6)continue;
    const geo=new THREE.PlaneGeometry(w+.52,d+.52);geo.rotateX(-Math.PI/2);
    geo.translate((c.minX+c.maxX)/2,.052,(c.minZ+c.maxZ)/2);geometries.push(geo);
  }
  const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(merged,material);mesh.name='Static_Contact_Shadows';mesh.renderOrder=2;apartment.root.add(mesh);
}

export function isWalkable(colliders,x,z,radius=.22) {
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<BOUNDS.minX+radius||x>BOUNDS.maxX-radius||z<BOUNDS.minZ+radius||z>BOUNDS.maxZ-radius)return false;
  for(const c of colliders) {
    const nx=Math.max(c.minX,Math.min(x,c.maxX)),nz=Math.max(c.minZ,Math.min(z,c.maxZ));
    if((x-nx)**2+(z-nz)**2<radius**2)return false;
  }
  return true;
}

export function roomAt(x,z) {if(x>3.12)return z<-2?'Primary suite':z>4?'Spa bathroom':'Private gallery';if(z>7.6)return 'Hub gallery';if(z>.5)return x<-4.6?'Kitchen':'Dining room';return x<-7?'Window salon':'Living room';}
