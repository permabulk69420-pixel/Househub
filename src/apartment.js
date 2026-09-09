import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FLOOR_Y=0;
export const SPAWN={x:-.6,z:2.3,yaw:.32};
export const VIEWS={
  living:{position:[-7.8,1.68,1.45],target:[.25,1.28,-3.05]},
  kitchen:{position:[1.2,1.68,-.2],target:[-5.3,1.25,4.2]},
  bedroom:{position:[3.65,1.68,-.05],target:[6.9,1.2,-4.25]},
  bathroom:{position:[3.95,1.68,3.5],target:[7.45,1.1,5.8]},
};

// Metres. The same blockers serve desktop, thumbstick movement and teleport landing.
export class ApartmentBuilder {
  constructor(materials) {
    this.materials=materials;this.root=new THREE.Group();this.root.name='Househub_Apartment';
    this.colliders=[];this.anchors=[];this.zone='living';this.parts=[];
    this.stats={sourceMeshes:0};this.transform=new THREE.Matrix4();
    this.tempNormal=new THREE.Vector3();this.tempPosition=new THREE.Vector3();
  }
  block(name,x,z,w,d){this.colliders.push({name,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});}
  mesh(name,geometry,material,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],options={}) {
    const mesh=new THREE.Mesh(geometry,this.materials[material]);mesh.name=name;
    mesh.position.fromArray(position);mesh.rotation.set(...rotation);mesh.scale.fromArray(scale);mesh.updateMatrix();
    geometry.applyMatrix4(mesh.matrix);mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
    if(geometry.index)geometry=geometry.toNonIndexed();
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    // Explicit planar metric UVs, including bevels. UV0 is independent of mesh scale.
    const uv=new Float32Array(p.count*2),color=new Float32Array(p.count*3);
    const normal=this.tempNormal;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);normal.fromBufferAttribute(n,i);
      const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z);
      if(options.keepUV&&geometry.attributes.uv){uv[i*2]=geometry.attributes.uv.getX(i);uv[i*2+1]=geometry.attributes.uv.getY(i);}
      else if(ay>=ax&&ay>=az){uv[i*2]=x;uv[i*2+1]=z;}
      else if(ax>az){uv[i*2]=z;uv[i*2+1]=y;}
      else {uv[i*2]=x;uv[i*2+1]=y;}
      const floorContact=1-.12*Math.exp(-Math.max(y,0)*6);
      const orientation=.82+Math.max(0,normal.y)*.15-Math.max(0,-normal.y)*.22;
      const wallDistance=Math.min(Math.abs(x+9),Math.abs(x-9),Math.abs(z+7),Math.abs(z-7),Math.abs(x-2.7));
      const corner=normal.y>.5?1-.17*Math.exp(-wallDistance*3):1;
      const dimCeiling=y>3? .86:1;
      let intensity=orientation*floorContact*corner*dimCeiling;
      if(material==='warmLight'||material==='dimLight')intensity=1;
      const variation=options.variation??1;
      color[i*3]=intensity*variation;color[i*3+1]=intensity*variation*.985;color[i*3+2]=intensity*variation*.956;
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geometry.setAttribute('uv1',new THREE.BufferAttribute(uv.slice(),2));
    geometry.setAttribute('color',new THREE.BufferAttribute(color,3));
    // Keep batching attributes uniform; tangents are derived from the UV derivatives.
    for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv','uv1','color'].includes(key))geometry.deleteAttribute(key);
    mesh.geometry=geometry;mesh.castShadow=options.castShadow!==false&&material!=='glass'&&material!=='warmLight';
    mesh.receiveShadow=options.receiveShadow!==false;
    mesh.userData={zone:this.zone,materialSlot:material,sourceName:name,uvUnits:'meters',...options};
    this.root.add(mesh);this.parts.push(mesh);this.stats.sourceMeshes++;
    return mesh;
  }
  box(name,size,position,material,round=0,rotation=[0,0,0],options={}) {
    const g=round?new RoundedBoxGeometry(...size,2,Math.min(round,...size.map(v=>v*.48))):new THREE.BoxGeometry(...size,Math.max(1,Math.ceil(size[0]/1.25)),Math.max(1,Math.ceil(size[1]/1.25)),Math.max(1,Math.ceil(size[2]/1.25)));
    return this.mesh(name,g,material,position,rotation,[1,1,1],options);
  }
  cylinder(name,top,bottom,height,position,material,segments=32,rotation=[0,0,0]) {return this.mesh(name,new THREE.CylinderGeometry(top,bottom,height,segments),material,position,rotation);}
  sphere(name,position,scale,material,segments=20) {return this.mesh(name,new THREE.SphereGeometry(1,segments,12),material,position,[0,0,0],scale);}
  tube(name,points,radius,material,segments=24) {return this.mesh(name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,7,false),material);}
  torus(name,radius,tube,position,material,rotation=[0,0,0],scale=[1,1,1]) {return this.mesh(name,new THREE.TorusGeometry(radius,tube,8,48),material,position,rotation,scale);}
  wall(name,x,z,w,d,material='plaster') {
    this.box(name,[w,3.25,d],[x,1.625,z],material);this.block(name,x,z,w,d);
    this.box(name+'_Skirting',[w+.018,.085,d+.018],[x,.043,z],'whitePaint',.006);
  }
  anchor(name,position,rotation=0) {const a=new THREE.Object3D();a.name=name;a.position.fromArray(position);a.rotation.y=rotation;this.root.add(a);this.anchors.push(a);return a;}
  finish() {
    const groups=new Map();
    for(const part of this.parts) {
      const key=[part.userData.zone,part.material.uuid,part.castShadow,part.receiveShadow].join('|');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(part);
    }
    for(const parts of groups.values()) {
      const g=mergeGeometries(parts.map(p=>p.geometry),false);
      g.computeBoundingBox();g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,parts[0].material);mesh.name=parts[0].userData.zone+'__'+parts[0].material.name;
      mesh.castShadow=parts[0].castShadow;mesh.receiveShadow=parts[0].receiveShadow;
      mesh.userData={materialSlot:parts[0].material.name,zone:parts[0].userData.zone,uvUnits:'meters',parts:parts.map(p=>p.name)};
      for(const p of parts){this.root.remove(p);p.geometry.dispose();}
      this.root.add(mesh);
    }
    this.parts.length=0;return this;
  }
}

function architecture(b) {
  b.zone='shell';
  b.box('Continuous_Oak_Floor',[18,.16,14],[0,-.08,0],'oak');
  b.box('Ceiling',[18,.16,14],[0,3.33,0],'plaster');
  b.wall('South_Wall',0,7.1,18.3,.2);
  b.wall('East_Wall',9.1,0,.2,14.4);
  b.wall('West_Kitchen_Wall',-9.1,3.7,.2,6.6);
  // Two window walls with real frame geometry and closed floor / ceiling edges.
  for(const [i,x] of [-9,-6.7,-4.4,-2.1,.2,2.7,5.0,7.0,9].entries()) {
    b.box('North_Window_Mullion_'+i,[.055,3.2,.11],[x,1.6,-6.99],'blackMetal',.008);
  }
  b.box('North_Window_Head',[18,.11,.12],[0,3.15,-6.99],'blackMetal');
  b.box('North_Window_Track',[18,.055,.15],[0,.027,-6.99],'blackMetal');
  b.box('North_Window_Glass',[17.9,3.08,.012],[0,1.59,-7.01],'glass',0,[0,0,0],{castShadow:false});
  b.block('North_Glazing',0,-7.1,18.3,.2);
  for(const [i,z] of [-7,-4.6,-2.2,.4].entries())b.box('West_Window_Mullion_'+i,[.12,3.2,.055],[-8.99,1.6,z],'blackMetal',.008);
  b.box('West_Window_Head',[.12,.11,7.4],[-8.99,3.15,-3.3],'blackMetal');
  b.box('West_Window_Track',[.15,.055,7.4],[-8.99,.027,-3.3],'blackMetal');
  b.box('West_Window_Glass',[.012,3.08,7.32],[-9.01,1.59,-3.3],'glass',0,[0,0,0],{castShadow:false});
  b.block('West_Glazing',-9.1,-3.4,.2,7.6);
  b.wall('Living_Suite_Divider',2.7,-3.2,.22,7.6);
  b.wall('Kitchen_Bath_Divider',2.7,4.99,.22,4.02);
  b.box('Suite_Opening_Lintel',[.24,.6,2.38],[2.7,2.95,1.79],'plaster');
  // Bedroom and bath have generous open cased doorways, not impassable false doors.
  b.wall('Bedroom_South_Left',2.99,.7,.36,.18);
  b.wall('Bedroom_South_Right',6.75,.7,4.5,.18);
  b.box('Bedroom_Door_Lintel',[1.33,.62,.2],[3.835,2.94,.7],'plaster');
  b.wall('Bath_North_Left',3.0,3.0,.38,.2);
  b.wall('Bath_North_Right',6.8,3.0,4.4,.2);
  b.box('Bath_Door_Lintel',[1.43,.62,.22],[3.915,2.94,3.0],'plaster');
  for(const [name,x,z] of [['Bedroom',3.83,.7],['Bathroom',3.9,3]]) {
    for(const dx of [-.67,.67])b.box(name+'_Door_Jamb',[.055,2.64,.25],[x+dx,1.32,z],'walnut',.004);
    b.box(name+'_Door_Head',[1.4,.055,.25],[x,2.65,z],'walnut',.004);
  }
  // Floating ceiling rafts and shadow gaps make the warm coves read without bloom.
  for(const [name,x,z,w,d] of [['Living',-3.55,-3.2,10.35,7.0],['Kitchen',-3.55,3.8,10.35,5.25],['Bedroom',5.9,-3.2,5.65,6.9],['Bathroom',5.9,5,5.65,3.4]]) {
    b.box(name+'_Ceiling_Raft',[w,.12,d],[x,3.105,z],'plaster',.035);
    for(const dz of [-d/2+.045,d/2-.045])b.box(name+'_Cove_Long',[w-.13,.018,.032],[x,3.17,z+dz],'warmLight');
    for(const dx of [-w/2+.045,w/2-.045])b.box(name+'_Cove_Side',[.032,.018,d-.13],[x+dx,3.17,z],'warmLight');
  }
  for(const [i,x,z] of [[0,-7.9,1.1],[1,-3.2,1.1],[2,1.7,1.1],[3,-7.7,5.9],[4,1.6,5.9],[5,3.4,1.8],[6,7.5,1.8],[7,3.6,-5.4],[8,7.6,3.7]]) {
    b.cylinder('Recessed_Downlight_Trim_'+i,.07,.07,.02,[x,3.025,z],'blackMetal',20);
    b.cylinder('Recessed_Downlight_'+i,.049,.049,.022,[x,3.019,z],'dimLight',20);
  }
  // Flush oak entrance and an unlinked hall door leave stable future portal anchors.
  door(b,'Entry',.8,6.965,0);
  door(b,'Hall_End',8.97,1.82,Math.PI/2);
  b.anchor('PlayerSpawn',[SPAWN.x,0,SPAWN.z],SPAWN.yaw);
  b.anchor('HubDoor_Entry',[.8,0,6.82],Math.PI);
  b.anchor('HubDoor_Hall',[8.82,0,1.82],Math.PI/2);
}

function door(b,name,x,z,rotation) {
  const transform=(px,py,pz)=>[x+px*Math.cos(rotation)+pz*Math.sin(rotation),py,z-px*Math.sin(rotation)+pz*Math.cos(rotation)];
  b.box(name+'_Shadow_Reveal',[1.29,2.66,.025],transform(0,1.33,0),'black',0,[0,rotation,0]);
  b.box(name+'_Door_Leaf',[1.22,2.6,.036],transform(0,1.31,-.02),'walnut',.009,[0,rotation,0]);
  b.box(name+'_Brass_Pull',[.025,.34,.055],transform(.46,1.08,-.06),'brass',.012,[0,rotation,0]);
}

function curtains(b,name,x,z,width,rotation=0) {
  const height=3.08,segments=Math.ceil(width*52),g=new THREE.PlaneGeometry(width,height,segments,10),p=g.attributes.position;
  for(let i=0;i<p.count;i++) {const px=p.getX(i),py=p.getY(i);p.setZ(i,.065*Math.sin(px*43)+.018*Math.sin(px*86));p.setY(i,py+.018*Math.cos(px*43)*(1-(py+height/2)/height));}
  g.computeVertexNormals();b.mesh(name,g,'linen',[x,1.57,z],[0,rotation,0],[1,1,1],{castShadow:true});
  b.cylinder(name+'_Track',.016,.016,width+.1,[x,3.155,z],'blackMetal',10,[0,0,Math.PI/2]);
}

function rug(b,name,x,z,w,d,material='rug',rotation=0) {
  b.box(name+'_Bound_Edge',[w,.022,d],[x,.019,z],'linen',.01,[0,rotation,0]);
  b.box(name+'_Woven_Pile',[w-.07,.025,d-.07],[x,.022,z],material,.01,[0,rotation,0]);
}

function sofa(b) {
  // Local front is -Z; the sofa faces the fireplace on +X.
  const origin=[-5.48,0,-2.6],angle=-Math.PI/2;
  const t=(x,y,z)=>[origin[0]+x*Math.cos(angle)+z*Math.sin(angle),y,origin[2]-x*Math.sin(angle)+z*Math.cos(angle)];
  const box=(name,size,pos,mat,r=.05,tilt=0)=>b.box('Sofa_'+name,size,t(...pos),mat,r,[tilt,angle,0]);
  box('Recessed_Plinth',[3.32,.13,.86],[0,.14,.03],'walnut',.02);
  box('Upholstered_Base',[3.62,.25,1.06],[0,.31,0],'linen',.10);
  for(let i=0;i<3;i++) {
    box('Seat_'+i,[1.085,.19,.83],[(i-1)*1.105,.49,-.08],'linen',.085);
    box('Back_'+i,[1.11,.55,.25],[(i-1)*1.11,.765,.41],'linen',.09,-.11);
  }
  for(const x of [-1.73,1.73])box('Arm',[.23,.42,1.08],[x,.525,0],'linen',.09);
  box('Chaise_Base',[1.16,.25,1.28],[-1.14,.31,-.85],'linen',.09);
  box('Chaise_Cushion',[1.14,.19,1.25],[-1.14,.49,-.87],'linen',.075);
  for(const [i,x,y,z,mat,tilt] of [[0,-1.23,.77,.09,'darkFabric',.24],[1,1.16,.77,.09,'linen',.22],[2,.87,.7,-.05,'leather',-.08]]) {
    box('Loose_Cushion_'+i,[.48,.49,.16],[x,y,z],mat,.075,tilt);
  }
  // Fine piping along the seat's front edge.
  for(let i=0;i<3;i++)b.tube('Sofa_Seat_Piping_'+i,[t((i-1)*1.105-.48,.5,-.491),t((i-1)*1.105,.5,-.508),t((i-1)*1.105+.48,.5,-.491)],.0045,'linen',12);
  b.block('Sofa',origin[0],origin[2],1.09,3.64);b.block('Sofa_Chaise',-4.7,-3.74,1.55,1.2);
}

function loungeChair(b,name,x,z,angle,material='leather') {
  const t=(px,py,pz)=>[x+px*Math.cos(angle)+pz*Math.sin(angle),py,z-px*Math.sin(angle)+pz*Math.cos(angle)];
  for(const px of [-.33,.33])for(const pz of [-.3,.3])b.cylinder(name+'_Leg',.023,.018,.29,t(px,.2,pz),'walnut',12,[0,0,px*.18]);
  b.box(name+'_Shell',[.91,.23,.85],t(0,.38,0),'walnut',.10,[0,angle,0]);
  b.box(name+'_Seat',[.71,.14,.7],t(0,.5,-.05),material,.08,[0,angle,0]);
  b.box(name+'_Back',[.83,.5,.20],t(0,.76,.32),material,.10,[-.13,angle,0]);
  for(const px of [-.43,.43])b.box(name+'_Arm',[.115,.27,.77],t(px,.63,.015),material,.045,[0,angle,0]);
  b.block(name,x,z,.98,.98);
}

function vase(b,name,x,y,z,scale=1,material='ceramic') {
  const points=[[0,0],[.11,0],[.145,.035],[.17,.2],[.135,.33],[.067,.41],[.065,.44],[.05,.44],[.05,.41],[.1,.33]].map(([r,h])=>new THREE.Vector2(r*scale,h*scale));
  b.mesh(name,new THREE.LatheGeometry(points,32),material,[x,y,z]);
}

function books(b,name,x,y,z,vertical=false) {
  for(let i=0;i<3;i++) {
    const mat=['bookRust','paper','bookOlive'][i];
    if(vertical){b.box(name+'_Cover_'+i,[.035,.24+i*.02,.18],[x+i*.045,y+.12+i*.01,z],mat,.004);b.box(name+'_Pages_'+i,[.025,.223+i*.02,.17],[x+i*.045,y+.12+i*.01,z-.006],'paper');}
    else {b.box(name+'_Cover_'+i,[.32-i*.015,.035,.24-i*.006],[x,y+i*.037,z],mat,.005,[0,.08*i,0]);b.box(name+'_Pages_'+i,[.307-i*.015,.025,.226-i*.006],[x,y+i*.037,z],'paper',.002,[0,.08*i,0]);}
  }
}

function plant(b,name,x,z,height=2) {
  const potHeight=height*.25;
  b.cylinder(name+'_Pot',.28,.21,potHeight,[x,potHeight/2+.015,z],'travertine',32);
  b.cylinder(name+'_Soil',.253,.253,.012,[x,potHeight+.017,z],'soil',24);
  const trunkEnd=[x+.03,height*.87,z+.025];
  b.tube(name+'_Trunk',[[x,potHeight,z],[x-.04,height*.6,z+.02],trunkEnd],.019,'walnut',16);
  for(let k=0;k<10;k++) {
    const angle=k*2.399,level=height*(.5+.042*k),reach=.33+(k%3)*.07;
    const ex=x+Math.cos(angle)*reach,ez=z+Math.sin(angle)*reach;
    b.tube(name+'_Branch_'+k,[[x,level-.07,z],[x+Math.cos(angle)*reach*.55,level+.055,z+Math.sin(angle)*reach*.55],[ex,level+.085,ez]],.0055,'walnut',9);
    for(let j=0;j<4;j++) {
      const a=angle+(j-1.5)*.44,px=ex+Math.cos(a)*.13*(j%2+1),pz=ez+Math.sin(a)*.13*(j%2+1);
      const g=new THREE.SphereGeometry(1,8,5);b.mesh(name+'_Leaf_'+k+'_'+j,g,'leaf',[px,level+.07+(j%2)*.075,pz],[.1,a,.2],[.055,.012,.155]);
    }
  }
  b.block(name,x,z,.58,.58);
}

function living(b) {
  b.zone='living';
  curtains(b,'Living_North_Curtain_Left',-8.12,-6.82,1.45);
  curtains(b,'Living_North_Curtain_Right',1.97,-6.82,.83);
  rug(b,'Living_Rug',-3.45,-2.7,6.0,5.6);
  sofa(b);loungeChair(b,'Lounge_Chair',-.78,-.38,-.58);loungeChair(b,'Window_Chair',-1.10,-5.3,Math.PI*.8,'linen');
  // Two low, offset stone tables with rounded rims and hefty sculptural bases.
  b.cylinder('Coffee_Table_Base',.42,.50,.3,[-2.86,.20,-2.6],'travertine',48);
  b.mesh('Coffee_Table_Top',new THREE.CylinderGeometry(.8,.8,.10,64),'travertine',[-2.86,.4,-2.6],[0,0,0],[1.12,1,.85]);
  b.torus('Coffee_Table_Soft_Edge',.781,.02,[-2.86,.444,-2.6],'travertine',[Math.PI/2,0,0],[1.12,.85,1]);
  b.cylinder('Coffee_Companion_Base',.2,.25,.26,[-1.77,.15,-3.22],'walnut',32);
  b.cylinder('Coffee_Companion_Top',.46,.46,.055,[-1.77,.295,-3.22],'walnut',48);
  books(b,'Coffee_Table_Books',-3.02,.48,-2.56);
  b.cylinder('Coffee_Bowl',.16,.08,.055,[-2.6,.485,-2.77],'darkStone',32);
  b.block('Coffee_Table',-2.86,-2.6,1.75,1.37);b.block('Coffee_Companion',-1.77,-3.22,.94,.94);
  b.cylinder('Sofa_Side_Table_Base',.18,.22,.47,[-5.28,.245,-.40],'blackMetal');
  b.cylinder('Sofa_Side_Table_Top',.35,.35,.055,[-5.28,.51,-.40],'walnut',40);
  vase(b,'Side_Table_Vase',-5.29,.54,-.40,.48,'darkStone');
  // Fireplace wall: cut stone panels, book-matched joints, floating oak cabinetry.
  b.box('Fireplace_Stone_Surround',[.13,2.76,4.54],[2.515,1.39,-3.35],'travertine',.012);
  for(const z of [-5.61,-4.1,-2.59,-1.08])b.box('Stone_Panel_Joint',[.006,2.76,.008],[2.444,1.39,z],'darkStone');
  b.box('Fireplace_Recess',[.065,.40,2.02],[2.426,.55,-3.39],'black',.017);
  b.box('Fireplace_Ember_Tray',[.105,.023,1.65],[2.372,.37,-3.39],'dimLight',.008);
  b.box('Fireplace_Hearth',[.61,.13,4.5],[2.20,.15,-3.35],'travertine',.017);
  b.box('TV_Frame',[.055,1.07,1.90],[2.401,1.62,-3.39],'blackMetal',.024);
  b.box('TV_Glass',[.009,1.015,1.846],[2.367,1.62,-3.39],'screen',.015);
  b.box('TV_Status_Light',[.004,.007,.012],[2.36,1.10,-3.39],'dimLight');
  b.block('Hearth',2.2,-3.35,.7,4.6);
  // Oak open shelving on the north end of the media wall.
  b.box('Shelf_Back',[.055,2.70,1.09],[2.515,1.40,-6.25],'walnut');
  for(const y of [.25,.93,1.64,2.35]) {
    b.box('Floating_Shelf',[.35,.042,1.12],[2.31,y,-6.25],'walnut',.006);
    b.box('Shelf_Light',[.21,.015,.99],[2.31,y-.03,-6.25],'dimLight');
  }
  vase(b,'Shelf_Ceramic_Vase',2.25,.954,-6.18,.8);
  b.sphere('Shelf_Stone_Orb',[2.28,1.83,-6.22],[.15,.15,.15],'darkStone');
  b.torus('Shelf_Sculpture',.14,.035,[2.26,2.53,-6.21],'brass',[0,Math.PI/2,0]);
  plant(b,'Window_Olive',-7.75,-5.7,2.3);
  // A slender reading lamp, with a visibly open fabric shade.
  b.cylinder('Reading_Lamp_Foot',.23,.24,.04,[-6.85,.023,-.28],'blackMetal');
  b.cylinder('Reading_Lamp_Stem',.013,.016,1.50,[-6.85,.79,-.28],'brass',12);
  b.mesh('Reading_Lamp_Shade',new THREE.CylinderGeometry(.18,.27,.35,32,1,true),'linen',[-6.85,1.54,-.28]);
  b.cylinder('Reading_Lamp_Diffuser',.247,.247,.012,[-6.85,1.372,-.28],'dimLight',32);
}

function kitchen(b) {
  b.zone='kitchen';
  // Cabinet run on south wall. Recessed plinths and shadow lines remain legible in VR.
  b.box('Kitchen_Toe_Kick',[5.5,.13,.53],[-5.99,.08,6.51],'blackMetal');
  b.box('Kitchen_Cabinet_Carcass',[5.5,.59,.64],[-5.99,.425,6.48],'walnut');
  for(let i=0;i<9;i++) {
    const x=-8.45+i*.607;
    b.box('Base_Cabinet_'+i,[.594,.71,.024],[x,.485,6.147],'walnut',.004);
    b.box('Cabinet_Finger_Recess_'+i,[.49,.018,.012],[x,.788,6.13],'black');
    if(i%3===0)b.box('Drawer_Joint_'+i,[.59,.01,.008],[x,.595,6.13],'black');
  }
  // Countertop slabs surround an actual sink opening.
  b.box('Kitchen_Worktop_Left',[3.90,.065,.76],[-6.84,.88,6.44],'travertine',.015);
  b.box('Kitchen_Worktop_Right',[.96,.065,.76],[-3.68,.88,6.44],'travertine',.015);
  for(const z of [6.145,6.735])b.box('Kitchen_Worktop_Sink_Edge',[.74,.065,.17],[-4.52,.88,z],'travertine',.01);
  b.box('Kitchen_Stone_Backsplash',[5.63,.78,.04],[-5.99,1.28,6.91],'travertine');
  b.box('Kitchen_Long_Shelf',[5.35,.038,.24],[-5.94,1.70,6.78],'walnut',.007);
  b.box('Kitchen_Shelf_Light',[5.18,.016,.026],[-5.94,1.67,6.67],'warmLight');
  // Tall walnut appliance wall on the west return.
  b.box('Tall_Cabinet_Body',[.63,2.75,2.72],[-8.55,1.39,5.5],'walnut',.012);
  for(let i=0;i<4;i++)b.box('Tall_Cabinet_Door_'+i,[.03,2.69,.658],[-8.218,1.42,4.48+i*.68],'walnut',.006);
  b.box('Oven_Outer_Frame',[.065,.60,.59],[-8.18,1.11,5.15],'blackMetal',.012);
  b.box('Oven_Glass',[.014,.42,.49],[-8.139,1.08,5.15],'screen',.012);
  b.box('Oven_Handle',[.06,.025,.44],[-8.10,1.35,5.15],'brass',.01);
  b.box('Oven_Control',[.02,.032,.11],[-8.131,1.34,5.04],'black');
  // Island with slab waterfalls and a ribbed oak seating face.
  b.box('Island_Recessed_Plinth',[3.25,.12,.90],[-5.3,.08,3.35],'blackMetal');
  b.box('Island_Oak_Core',[3.42,.72,1.12],[-5.3,.49,3.35],'walnut',.009);
  for(let i=0;i<58;i++)b.box('Island_Flute_'+i,[.033,.68,.032],[-6.97+i*.058,.5,2.775],'walnut',.014);
  b.box('Island_Stone_Top',[3.70,.075,1.43],[-5.3,.916,3.27],'travertine',.018);
  for(const x of [-7.12,-3.48])b.box('Island_Waterfall',[.067,.87,1.43],[x,.473,3.27],'travertine',.014);
  b.box('Induction_Hob',[.67,.011,.51],[-5.68,.961,3.39],'screen',.014);
  for(const [x,z,r] of [[-5.85,3.28,.082],[-5.5,3.50,.10]])b.torus('Induction_Ring',r,.002,[x,.969,z],'blackMetal',[Math.PI/2,0,0]);
  // Sink is built as a genuinely recessed bowl above the cabinet, inset into back worktop.
  b.box('Sink_Bottom',[.72,.012,.42],[-4.52,.747,6.44],'blackMetal',.007);
  for(const x of [-4.884,-4.156])b.box('Sink_Side',[.012,.162,.43],[x,.828,6.44],'blackMetal',.005);
  for(const z of [6.229,6.651])b.box('Sink_End',[.738,.162,.012],[-4.52,.828,z],'blackMetal',.005);
  b.cylinder('Sink_Drain',.035,.035,.005,[-4.52,.758,6.44],'brass',20);
  b.tube('Kitchen_Tap',[[-4.52,.925,6.78],[-4.52,1.27,6.78],[-4.52,1.33,6.60],[-4.52,1.21,6.54]],.017,'brass',24);
  for(const x of [-4.73,-4.31])b.cylinder('Tap_Control',.023,.026,.045,[x,.943,6.76],'brass',16);
  for(const x of [-6.5,-5.3,-4.1])stool(b,x,2.19);
  // A thin linear pendant, with hanging cables at plausible scale.
  for(const x of [-6.6,-4.0])b.cylinder('Island_Pendant_Cable',.004,.004,.71,[x,2.68,3.27],'blackMetal',6);
  b.box('Island_Pendant',[3.05,.052,.054],[-5.3,2.30,3.27],'brass',.012);
  b.box('Island_Pendant_Diffuser',[2.94,.009,.03],[-5.3,2.268,3.27],'warmLight');
  vase(b,'Island_Vase',-4.00,.956,3.50,.6,'darkStone');
  b.box('Chopping_Board',[.39,.025,.28],[-6.9,.927,6.40],'oak',.045,[0,.18,0]);
  books(b,'Kitchen_Cookbooks',-3.84,1.734,6.77,true);
  vase(b,'Kitchen_Shelf_Vase',-5.05,1.73,6.79,.56);
  for(let i=0;i<3;i++)b.cylinder('Kitchen_Canister_'+i,.071,.073,.14+i*.035,[-6.5+i*.19,.99+i*.0175,6.58],'ceramic',24);
  b.block('Kitchen_Back_Cabinets',-5.99,6.48,5.65,.8);b.block('Kitchen_Tall_Cabinets',-8.55,5.5,.72,2.8);b.block('Kitchen_Island',-5.3,3.27,3.75,1.48);
  // Dining nook with four low, curved chairs.
  rug(b,'Dining_Rug',-.77,4.6,3.25,3.5,'rug');
  b.cylinder('Dining_Table_Pedestal',.29,.41,.71,[-.77,.37,4.6],'walnut',40);
  b.cylinder('Dining_Table_Top',.87,.87,.07,[-.77,.765,4.6],'walnut',64);
  b.torus('Dining_Table_Edge',.848,.025,[-.77,.775,4.6],'walnut',[Math.PI/2,0,0]);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.12;diningChair(b,'Dining_Chair_'+i,-.77+Math.sin(a)*1.18,4.6+Math.cos(a)*1.18,a);}
  vase(b,'Dining_Ceramic',-.7,.81,4.55,.66);
  b.cylinder('Dining_Pendant_Cable',.004,.004,.75,[-.77,2.73,4.6],'blackMetal',6);
  b.mesh('Dining_Pendant_Shade',new THREE.SphereGeometry(.36,36,16,0,Math.PI*2,0,Math.PI/2),'linen',[-.77,2.20,4.6],[0,0,0],[1,.55,1]);
  b.cylinder('Dining_Pendant_Diffuser',.335,.335,.014,[-.77,2.202,4.6],'dimLight',32);
  b.block('Dining_Table',-.77,4.6,1.78,1.78);
}

function stool(b,x,z) {
  for(const dx of [-.18,.18])for(const dz of [-.18,.18])b.cylinder('Stool_Leg',.017,.025,.69,[x+dx,.35,z+dz],'walnut',10);
  b.torus('Stool_Footrest',.20,.013,[x,.26,z],'brass',[Math.PI/2,0,0]);
  b.cylinder('Stool_Upholstered_Seat',.255,.25,.09,[x,.725,z],'leather',32);
  b.box('Stool_Low_Back',[.43,.21,.075],[x,.866,z-.21],'leather',.045);
  b.block('Island_Stool',x,z,.5,.5);
}

function diningChair(b,name,x,z,angle) {
  const t=(px,py,pz)=>[x+px*Math.cos(angle)+pz*Math.sin(angle),py,z-px*Math.sin(angle)+pz*Math.cos(angle)];
  for(const px of [-.20,.20])for(const pz of [-.20,.20])b.cylinder(name+'_Leg',.018,.021,.43,t(px,.23,pz),'walnut',10);
  b.box(name+'_Seat',[.49,.10,.48],t(0,.48,0),'linen',.045,[0,angle,0]);
  b.box(name+'_Back',[.51,.30,.09],t(0,.75,.215),'linen',.043,[-.1,angle,0]);
  b.block(name,x,z,.56,.56);
}

function bedroom(b) {
  b.zone='bedroom';
  curtains(b,'Bedroom_Curtain',8.46,-6.82,.88);
  curtains(b,'Bedroom_Curtain_Left',3.18,-6.82,.48);
  rug(b,'Bedroom_Rug',6.25,-3.44,4.65,4.65);
  // Bed points west, with its headboard set into the east wall.
  b.box('Bed_Plinth',[2.38,.2,2.02],[6.76,.14,-3.52],'walnut',.045);
  b.box('Bed_Upholstered_Frame',[2.51,.24,2.17],[6.76,.33,-3.52],'linen',.065);
  b.box('Bed_Mattress',[2.19,.25,1.96],[6.67,.57,-3.52],'linen',.095);
  b.box('Bed_Duvet',[1.76,.17,2.04],[6.41,.765,-3.52],'linen',.075);
  // Gently rumpled top surface instead of a featureless cuboid.
  const duvet=new THREE.PlaneGeometry(1.70,1.98,30,34);duvet.rotateX(-Math.PI/2);
  const pos=duvet.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,.012*Math.sin(x*16+z*2)+.009*Math.sin(z*19+x*4));}
  duvet.computeVertexNormals();b.mesh('Bed_Duvet_Folds',duvet,'linen',[6.4,.855,-3.52]);
  b.box('Bed_Throw',[.67,.045,2.10],[5.87,.881,-3.52],'darkFabric',.022);
  for(const z of [-4.05,-3.0])b.box('Bed_Pillow',[.59,.17,.78],[7.49,.77,z],'linen',.07,[0,0,.08]);
  b.box('Bed_Headboard',[.16,1.14,3.10],[8.33,.67,-3.52],'linen',.06);
  b.box('Bedroom_Accent_Wall',[.06,2.77,4.48],[8.968,1.40,-3.52],'walnut',.008);
  for(let i=0;i<60;i++)b.box('Bedroom_Wall_Flute_'+i,[.034,2.69,.021],[8.924,1.41,-5.71+i*.074],'walnut',.009);
  b.box('Headboard_Concealed_Light',[.024,.018,3.09],[8.43,1.23,-3.52],'warmLight');
  for(const z of [-5.0,-2.04]) {
    b.box('Nightstand',[.55,.17,.57],[8.20,.48,z],'walnut',.03);
    b.box('Nightstand_Drawer_Gap',[.008,.008,.49],[7.92,.48,z],'black');
    b.cylinder('Bedside_Lamp_Base',.09,.10,.02,[8.17,.578,z],'brass',24);
    b.cylinder('Bedside_Lamp_Stem',.012,.012,.16,[8.17,.668,z],'brass',12);
    b.mesh('Bedside_Lamp_Shade',new THREE.CylinderGeometry(.11,.15,.18,24,1,true),'linen',[8.17,.83,z]);
    b.cylinder('Bedside_Lamp_Diffuser',.133,.133,.014,[8.17,.745,z],'dimLight',24);
  }
  b.block('Bed',6.78,-3.52,2.63,2.20);b.block('Headboard',8.35,-3.52,.25,3.12);
  for(const z of [-5.0,-2.04])b.block('Nightstand',8.2,z,.63,.64);
  // Lounge bench at the foot, leaving a walkable aisle to the doorway.
  b.box('Bedroom_Bench_Seat',[.48,.15,1.58],[4.68,.44,-3.52],'leather',.062);
  for(const z of [-4.10,-2.94])b.box('Bedroom_Bench_Leg',[.33,.32,.055],[4.68,.225,z],'walnut',.012);
  b.block('Bedroom_Bench',4.68,-3.52,.52,1.65);
  // Low storage along south wall with small personal objects and sculptural relief.
  b.box('Bedroom_Credenza',[2.8,.61,.42],[6.68,.41,.35],'walnut',.017);
  for(let i=0;i<4;i++)b.box('Credenza_Door',[.68,.53,.024],[5.64+i*.7,.44,.125],'walnut',.005);
  vase(b,'Bedroom_Vase',7.63,.725,.33,.76);
  books(b,'Bedroom_Books',5.7,.755,.30);
  b.block('Bedroom_Credenza',6.68,.32,2.84,.52);
  b.box('Bedroom_Art_Back',[1.75,1.23,.035],[6.5,1.85,.567],'travertine',.012);
  b.torus('Bedroom_Art_Relief',.35,.027,[6.38,1.87,.538],'walnut',[0,0,-.3],[1.5,1,1]);
  b.box('Bedroom_Art_Relief_Line',[.03,.89,.022],[6.95,1.85,.532],'brass',.006,[0,0,-.3]);
  plant(b,'Bedroom_Plant',3.6,-5.94,1.8);
}

function bathroom(b) {
  b.zone='bathroom';
  b.box('Bath_Stone_Floor',[6.13,.026,3.91],[5.96,.012,5.03],'travertine');
  b.box('Bath_East_Stone_Wall',[.035,3.0,3.88],[8.976,1.53,5.04],'travertine');
  b.box('Bath_South_Stone_Wall',[6.16,3.0,.035],[5.96,1.53,6.981],'travertine');
  for(const x of [3.8,5.0,6.2,7.4,8.6])b.box('Stone_Floor_Grout_X',[.005,.002,3.88],[x,.027,5.04],'plaster');
  for(const z of [4.2,5.4,6.6])b.box('Stone_Floor_Grout_Z',[6.13,.002,.005],[5.96,.027,z],'plaster');
  b.box('Bath_Vanity_Cabinet',[.58,.41,1.73],[3.21,.48,5.43],'walnut',.02);
  b.box('Bath_Vanity_Top',[.66,.068,1.83],[3.21,.725,5.43],'travertine',.018);
  b.box('Vanity_Underlight',[.018,.012,1.5],[3.43,.26,5.43],'dimLight');
  const basinPoints=[[.10,0],[.24,.04],[.28,.11],[.285,.13],[.267,.14],[.23,.065],[.09,.025]].map(p=>new THREE.Vector2(...p));
  b.mesh('Vanity_Basin',new THREE.LatheGeometry(basinPoints,40),'ceramic',[3.27,.76,5.44],[0,0,0],[.81,1,1]);
  b.tube('Basin_Brass_Tap',[[2.985,.79,5.45],[2.985,1.12,5.45],[3.13,1.17,5.45],[3.2,1.08,5.45]],.012,'brass',20);
  b.cylinder('Vanity_Mirror_Frame',.58,.58,.035,[2.94,1.89,5.43],'brass',64,[0,0,Math.PI/2]);
  b.cylinder('Vanity_Smoked_Mirror',.551,.551,.039,[2.96,1.89,5.43],'screen',64,[0,0,Math.PI/2]);
  for(const z of [4.73,6.12]) {
    b.box('Vanity_Sconce_Back',[.06,.46,.065],[2.99,1.90,z],'brass',.015);
    b.cylinder('Vanity_Sconce_Diffuser',.033,.033,.38,[3.041,1.9,z],'dimLight',20);
  }
  b.block('Bath_Vanity',3.21,5.43,.7,1.91);
  // A single continuous ceramic bathtub shell with an open interior and thick rim.
  const tubProfile=[[0,.08],[.42,.08],[.56,.13],[.70,.37],[.74,.61],[.73,.66],[.675,.66],[.667,.61],[.63,.35],[.51,.16],[0,.16]].map(p=>new THREE.Vector2(...p));
  b.mesh('Freestanding_Bathtub',new THREE.LatheGeometry(tubProfile,64),'ceramic',[6.11,.02,6.05],[0,0,0],[1.40,1,.70]);
  b.cylinder('Tub_Drain',.042,.042,.003,[6.11,.184,6.05],'brass',20);
  b.tube('Tub_Floor_Tap',[[7.17,.025,6.26],[7.17,.87,6.26],[7.0,1.0,6.26],[6.83,.90,6.26]],.018,'brass',24);
  b.block('Bathtub',6.11,6.05,2.16,1.10);b.block('Tub_Tap',7.17,6.26,.18,.18);
  // Frameless shower enclosure with a clear walk-in opening on its west side.
  b.box('Shower_Tray',[1.54,.038,1.66],[8.16,.047,3.92],'travertine',.018);
  b.box('Shower_Glass',[1.49,2.45,.012],[8.19,1.25,4.76],'glass');
  b.box('Shower_Glass_Channel',[1.50,.024,.025],[8.19,.065,4.76],'brass');
  b.box('Shower_Glass_Cap',[1.50,.012,.015],[8.19,2.48,4.76],'brass');
  b.block('Shower_Glass',8.19,4.76,1.5,.07);
  b.tube('Rain_Shower_Arm',[[8.88,2.43,3.73],[8.57,2.43,3.73],[8.46,2.39,3.73]],.012,'brass',16);
  b.cylinder('Rain_Shower_Head',.18,.18,.018,[8.46,2.375,3.73],'brass',36);
  b.box('Shower_Controls',[.045,.18,.085],[8.926,1.1,3.74],'brass',.02);
  b.box('Shower_Drain',[.045,.004,.82],[8.61,.069,3.95],'blackMetal');
  // Wall-hung WC and cistern face, screened by the shower panel.
  b.box('Toilet_Cistern',[.14,1.10,.71],[8.89,.60,5.9],'travertine',.02);
  b.sphere('Toilet_Bowl',[8.51,.37,5.9],[.37,.24,.255],'ceramic',24);
  b.mesh('Toilet_Seat',new THREE.CylinderGeometry(.255,.255,.043,40),'ceramic',[8.46,.565,5.9],[0,0,0],[1.42,1,1]);
  b.box('Toilet_Flush_Plate',[.012,.12,.21],[8.806,1.03,5.9],'brass',.009);
  b.block('Toilet',8.5,5.9,.8,.6);
  b.tube('Towel_Rail',[[4.40,1.08,6.92],[4.40,1.08,6.80],[5.04,1.08,6.80],[5.04,1.08,6.92]],.013,'brass',16);
  b.box('Bath_Towel',[.40,.62,.035],[4.72,.79,6.79],'linen',.015);
  b.box('Bath_Mat',[1.0,.018,.55],[5.89,.039,5.08],'linen',.01);
  vase(b,'Bathroom_Bud_Vase',3.23,.766,6.11,.30,'darkStone');
}

function hallway(b) {
  b.zone='hallway';
  // A calm gallery leads to the private rooms and future door connections.
  b.box('Hall_Console_Top',[1.58,.045,.32],[6.51,.87,2.65],'travertine',.018);
  for(const x of [5.92,7.10])b.box('Hall_Console_Leg',[.028,.81,.26],[x,.44,2.65],'brass',.008);
  b.box('Hall_Art_Panel',[1.66,1.24,.035],[6.50,1.97,2.87],'plaster',.007);
  for(let i=0;i<3;i++)b.torus('Hall_Art_Stone_Relief_'+i,.20+i*.1,.025,[6.48,1.95,2.831-i*.009],'travertine',[0,0,0],[1.26,.88,1]);
  vase(b,'Hall_Vase',6.02,.899,2.65,.58);
  books(b,'Hall_Books',6.90,.923,2.65);
  b.block('Hall_Console',6.51,2.65,1.68,.39);
}

export function buildApartment(materials,{batch=true}={}) {
  const b=new ApartmentBuilder(materials);
  architecture(b);living(b);kitchen(b);bedroom(b);bathroom(b);hallway(b);
  if(batch)b.finish();
  return b;
}

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
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<-8.74||x>8.74||z<-6.74||z>6.74)return false;
  for(const c of colliders) {
    const nx=Math.max(c.minX,Math.min(x,c.maxX)),nz=Math.max(c.minZ,Math.min(z,c.maxZ));
    if((x-nx)**2+(z-nz)**2<radius**2)return false;
  }
  return true;
}

export function roomAt(x,z) {if(x>2.8)return z<.7?'Bedroom':z>3?'Bathroom':'Gallery';return z>1.4?'Kitchen & dining':'Living room';}
