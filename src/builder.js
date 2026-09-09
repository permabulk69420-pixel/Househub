import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries,mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const BOUNDS={minX:-14,maxX:14,minZ:-11,maxZ:11,height:4.15};

// Explicit scene omissions can be handled here without disturbing the source layout code.
const OMITTED_SCENE_PARTS=new Set(['Companion_Table_Stem','Companion_Table_Top','Companion_Table']);
const GLASS_SLOTS=new Set(['glass','windowGlass','showerGlass']);

export class ApartmentBuilder {
  constructor(materials) {
    this.materials=materials;this.root=new THREE.Group();this.root.name='Househub_Apartment';
    this.colliders=[];this.anchors=[];this.parts=[];this.zone='shell';this.frame=new THREE.Matrix4();this.prefix='';this.stats={sourceMeshes:0};
  }
  withFrame(name,position,yaw,fn) {
    const previous=this.frame,oldPrefix=this.prefix;
    this.frame=previous.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(1,1,1)));
    this.prefix+=name+'_';try{fn();}finally{this.frame=previous;this.prefix=oldPrefix;}
  }
  block(name,x,z,w,d,options={}) {
    const fullName=this.prefix+name;if(OMITTED_SCENE_PARTS.has(fullName))return;
    const corners=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,c])=>new THREE.Vector3(x+a*w/2,0,z+c*d/2).applyMatrix4(this.frame));
    this.colliders.push({name:fullName,blocksTeleport:/Wall|Divider|Glazing|Glass|Partition|Spine|Tall_Cabinets/.test(fullName),...options,minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minZ:Math.min(...corners.map(p=>p.z)),maxZ:Math.max(...corners.map(p=>p.z))});
  }
  mesh(name,g,slot,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],options={}) {
    const fullName=this.prefix+name;if(OMITTED_SCENE_PARTS.has(fullName)){g.dispose();return null;}
    if(slot==='plaster'&&(/_Ceiling_Raft$/.test(fullName)||fullName==='Insulated_Roof'))slot='ceilingPaint';
    if(slot==='glass'){
      if((/^North_Glass_\d+$/.test(fullName)||fullName==='West_Glass')&&this.materials.windowGlass)slot='windowGlass';
      else if(/^Shower_Glass_/.test(fullName)&&this.materials.showerGlass)slot='showerGlass';
    }
    if(!this.materials[slot])throw new Error('Missing material '+slot);
    g.scale(...scale);
    const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++) {
      const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
      if(options.keepUV&&g.attributes.uv){uv[i*2]=g.attributes.uv.getX(i);uv[i*2+1]=g.attributes.uv.getY(i);}
      else if(ay>=ax&&ay>=az){uv[i*2]=p.getX(i);uv[i*2+1]=p.getZ(i);}
      else if(ax>az){uv[i*2]=p.getZ(i);uv[i*2+1]=p.getY(i);}
      else {uv[i*2]=p.getX(i);uv[i*2+1]=p.getY(i);}
    }
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.BufferAttribute(uv.slice(),2));
    // Local pitch/roll is composed before the parent furniture's yaw.
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation,'XYZ'));
    const matrix=this.frame.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...position),q,new THREE.Vector3(1,1,1)));
    g.applyMatrix4(matrix);
    const color=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ny=n.getY(i);
      const wallDistance=Math.min(Math.abs(x-BOUNDS.minX),Math.abs(x-BOUNDS.maxX),Math.abs(z-BOUNDS.minZ),Math.abs(z-BOUNDS.maxZ));
      const contact=1-.13*Math.exp(-Math.max(y,0)*5),corner=ny>.4?1-.17*Math.exp(-wallDistance*3):1;
      let c=(.87+Math.max(ny,0)*.10-Math.max(-ny,0)*.20)*contact*corner*(y>3.5?.91:1)*(options.variation??1);
      if(slot==='warmLight'||slot==='dimLight')c=1;
      color[i*3]=c;color[i*3+1]=c*.99;color[i*3+2]=c*.97;
    }
    g.setAttribute('color',new THREE.BufferAttribute(color,3));
    for(const a of Object.keys(g.attributes))if(!['position','normal','uv','uv1','color'].includes(a))g.deleteAttribute(a);
    // Retain indexed geometry: richer curved meshes need not triple the vertex buffers.
    if(!g.index){const old=g;g=mergeVertices(old,1e-5);old.dispose();}
    const mesh=new THREE.Mesh(g,this.materials[slot]),isGlass=GLASS_SLOTS.has(slot);mesh.name=fullName;
    mesh.castShadow=options.castShadow!==false&&!isGlass&&!['warmLight','dimLight'].includes(slot);mesh.receiveShadow=options.receiveShadow!==false&&!isGlass;
    mesh.userData={zone:this.zone,materialSlot:slot,sourceName:mesh.name,uvUnits:'meters',...options};
    this.root.add(mesh);this.parts.push(mesh);this.stats.sourceMeshes++;return mesh;
  }
  box(name,size,position,slot,round=0,rotation=[0,0,0],options={}) {
    const segments=options.segments??(round>.04?5:round>.014?3:2);
    const g=round?new RoundedBoxGeometry(...size,segments,Math.min(round,...size.map(v=>v*.48))):new THREE.BoxGeometry(...size,Math.max(1,Math.ceil(size[0]/1.8)),Math.max(1,Math.ceil(size[1]/1.8)),Math.max(1,Math.ceil(size[2]/1.8)));
    return this.mesh(name,g,slot,position,rotation,[1,1,1],options);
  }
  cylinder(name,top,bottom,height,position,slot,segments=48,rotation=[0,0,0]){return this.mesh(name,new THREE.CylinderGeometry(top,bottom,height,segments),slot,position,rotation);}
  sphere(name,position,scale,slot,segments=32){return this.mesh(name,new THREE.SphereGeometry(1,segments,24),slot,position,[0,0,0],scale);}
  tube(name,points,radius,slot,segments=48,radial=10,closed=false){return this.mesh(name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal'),segments,radius,radial,closed),slot);}
  rod(name,a,c,top,bottom,slot,segments=20){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...c),dir=end.clone().sub(start),length=dir.length(),g=new THREE.CylinderGeometry(top,bottom,length,segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));return this.mesh(name,g,slot,start.add(end).multiplyScalar(.5).toArray());}
  torus(name,r,tube,position,slot,rotation=[0,0,0],scale=[1,1,1]){return this.mesh(name,new THREE.TorusGeometry(r,tube,12,72),slot,position,rotation,scale);}
  wall(name,x,z,w,d,slot='plaster',height=BOUNDS.height){this.box(name,[w,height,d],[x,height/2,z],slot);this.block(name,x,z,w,d,{blocksTeleport:true});this.box(name+'_Skirting',[w+.014,.08,d+.014],[x,.04,z],'whitePaint',.004);}
  anchor(name,position,rotation=0){const a=new THREE.Object3D();a.name=name;a.position.fromArray(position);a.rotation.y=rotation;this.root.add(a);this.anchors.push(a);return a;}
  finish() {
    const groups=new Map();for(const part of this.parts){const key=[part.userData.zone,part.material.uuid,part.castShadow,part.receiveShadow].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(part);}
    for(const parts of groups.values()){
      const g=mergeGeometries(parts.map(p=>p.geometry),false);g.computeBoundingBox();g.computeBoundingSphere();
      const m=new THREE.Mesh(g,parts[0].material);m.name=parts[0].userData.zone+'__'+parts[0].material.name;m.castShadow=parts[0].castShadow;m.receiveShadow=parts[0].receiveShadow;
      m.userData={materialSlot:m.material.name,zone:parts[0].userData.zone,uvUnits:'meters',parts:parts.map(p=>p.name)};
      for(const p of parts){this.root.remove(p);p.geometry.dispose();}this.root.add(m);
    }
    this.parts.length=0;return this;
  }
}
