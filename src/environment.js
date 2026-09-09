import * as THREE from 'three';
import { ApartmentBuilder,BOUNDS } from './builder.js';
import { archLintelGeometry,slabGeometry } from './geometry.js';
import { sofa,loungeChair,diningChair,bed,bench,tableLamp,floorLamp,vase,books,plant } from './furniture.js';

export const SPAWN={x:-7.5,z:-1.05,yaw:-.956};
export const VIEWS={
  living:{position:[-7.5,1.68,-1.05],target:[.5,1.48,-6.7]},
  kitchen:{position:[-4.1,1.68,-.3],target:[-10.0,1.28,4.8]},
  dining:{position:[1.9,1.68,.0],target:[-.6,1.16,4.0]},
  bedroom:{position:[4.7,1.68,-3.3],target:[10.2,1.20,-6.6]},
  bathroom:{position:[5.2,1.68,5.2],target:[9.4,1.10,9.0]},
  gallery:{position:[1.1,1.68,8.45],target:[-8.4,1.55,10.7]},
  vanity:{position:[7.8,1.68,6.4],target:[3.5,1.45,8.3]},
  dressing:{position:[12.15,1.68,-3.1],target:[13.2,1.45,-8.3]},
  reading:{position:[-7.1,1.68,-3.3],target:[-11.6,1.12,-7.0]},
};
const PI=Math.PI;

function slab(b,name,w,d,h,r,pos,mat='travertine',yaw=0){b.mesh(name,slabGeometry(w,d,h,r),mat,pos,[0,yaw,0]);}
function rug(b,name,x,z,w,d,mat='rug'){
  slab(b,name+'_Bound_Edge',w,d,.016,.045,[x,.018,z],'linen');
  slab(b,name+'_Woven_Pile',w-.065,d-.065,.014,.035,[x,.028,z],mat);
}
function curtains(b,name,x,z,w,yaw=0){
  // Closed, two-sided fabric, with centimetre-scale gathered folds and a weighted hem.
  b.withFrame(name,[x,0,z],yaw,()=>{
    const height=3.96,segments=Math.ceil(w*80),g=new THREE.PlaneGeometry(w,height,segments,22),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const px=p.getX(i),v=(p.getY(i)+height/2)/height;p.setZ(i,.071*Math.sin(px*36)+.016*Math.sin(px*72));p.setY(i,p.getY(i)+.014*Math.cos(px*36)*(1-v));}
    g.computeVertexNormals();b.mesh('Front',g,'linen',[0,2.025,0]);
    const rear=new THREE.PlaneGeometry(w,height,segments,22),rp=rear.attributes.position;
    for(let i=0;i<rp.count;i++){const px=rp.getX(i),v=(rp.getY(i)+height/2)/height;rp.setZ(i,.071*Math.sin(-px*36)+.016*Math.sin(-px*72)+.005);rp.setY(i,rp.getY(i)+.014*Math.cos(px*36)*(1-v));}
    rear.computeVertexNormals();b.mesh('Rear',rear,'linen',[0,2.025,-.003],[0,PI,0]);
    b.box('Ceiling_Track',[w+.10,.028,.06],[0,4.075,0],'blackMetal',.01);
    for(let i=0;i<Math.ceil(w/.12);i++)b.torus('Hanger',.023,.004,[-w/2+.05+i*.12,4.013,0],'blackMetal',[0,PI/2,0]);
  });
}
function ceiling(b,name,x,z,w,d,y=4.0){
  b.box(name+'_Ceiling_Raft',[w,.10,d],[x,y,z],'plaster',.018);
  for(const dz of [-d/2+.06,d/2-.06])b.box(name+'_Cove_Long',[w-.16,.02,.036],[x,y+.06,z+dz],'warmLight');
  for(const dx of [-w/2+.06,w/2-.06])b.box(name+'_Cove_Return',[.036,.02,d-.16],[x+dx,y+.06,z],'warmLight');
}
function downlight(b,name,x,z,y=3.942){
  b.cylinder(name+'_Recess',.062,.062,.028,[x,y,z],'blackMetal',40);
  b.cylinder(name+'_Diffuser',.047,.047,.016,[x,y-.009,z],'dimLight',40);
}
function doorway(b,name,x,z,w,yaw=0){
  b.withFrame(name,[x,0,z],yaw,()=>{
    for(const dx of [-w/2,w/2])b.box('Walnut_Jamb',[.065,2.94,.31],[dx,1.47,0],'walnut',.008);
    b.box('Walnut_Head',[w+.065,.065,.31],[0,2.97,0],'walnut',.008);
    b.box('Lintel',[w+.1,1.15,.25],[0,3.575,0],'plaster');
  });
}
function door(b,name,x,z,yaw,index=null){
  b.withFrame(name,[x,0,z],yaw,()=>{
    b.box('Shadow_Reveal',[1.35,3.00,.032],[0,1.50,0],'black',.006);
    b.box('Solid_Walnut_Leaf',[1.23,2.89,.052],[0,1.46,-.04],'walnut',.013);
    for(const dx of [-.65,.65])b.box('Stone_Reveal',[.065,3.0,.12],[dx,1.50,-.008],'travertine',.006);
    b.box('Stone_Head',[1.365,.065,.12],[0,2.995,-.008],'travertine',.006);
    for(const y of [.94,1.35])b.rod('Pull_Standoff',[.47,y,-.07],[.47,y,-.14],.012,.012,'brass',20);
    b.rod('Brass_Pull',[.47,.91,-.14],[.47,1.38,-.14],.015,.015,'brass',32);
    b.cylinder('Lock',.022,.022,.006,[.47,.78,-.07],'brass',24,[PI/2,0,0]);
    // Four discreet brass marks identify reserved door bays without destination signage.
    if(index)for(let i=0;i<index;i++)b.box('Bay_Mark_'+i,[.008,.065,.01],[-.04+(i-(index-1)/2)*.027,2.38,-.071],'brass',.003);
  });
}
function architecture(b){
  b.zone='shell';
  b.box('Continuous_Oak_Floor',[28,.18,22],[0,-.09,0],'oak');
  b.box('Insulated_Roof',[28.4,.22,22.4],[0,4.26,0],'plaster');
  b.wall('South_Wall',0,11.1,28.4,.2);
  b.wall('East_Wall',14.1,0,.2,22.4);
  b.wall('West_Kitchen_Wall',-14.1,5.85,.2,10.3);
  const mullions=[-14,-10.6,-7.2,-3.8,-.4,3,6.6,10.2,14];
  for(const [i,x] of mullions.entries())b.box('North_Mullion_'+i,[.06,4.12,.14],[x,2.06,-10.99],'blackMetal',.009);
  for(const y of [.032,4.09])b.box('North_Window_Track',[28,.065,.18],[0,y,-10.99],'blackMetal',.008);
  for(let i=0;i<mullions.length-1;i++){const w=mullions[i+1]-mullions[i];b.box('North_Glass_'+i,[w-.045,4.04,.013],[(mullions[i]+mullions[i+1])/2,2.06,-11.02],'glass');}
  b.block('North_Glazing',0,-11.1,28.3,.2);
  for(const z of [-11,-7.15,-3.3,.55])b.box('West_Mullion',[.14,4.12,.06],[-13.99,2.06,z],'blackMetal',.009);
  for(const y of [.032,4.09])b.box('West_Window_Track',[.18,.065,11.55],[-13.99,y,-5.225],'blackMetal',.008);
  b.box('West_Glass',[.013,4.04,11.5],[-14.02,2.06,-5.225],'glass');b.block('West_Glazing',-14.1,-5.225,.2,11.65);
  b.wall('Living_Suite_Divider_North',3,-5.95,.24,10.1);
  b.wall('Living_Suite_Divider_South',3,7.05,.24,7.9);
  b.mesh('Suite_Elliptical_Arch',archLintelGeometry(4,.26,2.8,.95,4.15),'plaster',[3,0,1.1],[0,PI/2,0]);
  // Broad casings and a stone threshold give the suite its own architectural entrance.
  for(const z of [-.90,3.10])b.box('Suite_Arch_Reveal',[.34,2.8,.045],[3,1.4,z],'travertine',.006);
  b.box('Suite_Threshold',[.52,.010,4.0],[3,.006,1.1],'travertine');
  for(const [name,z] of [['Bedroom',-2],['Bath',4]]){
    b.wall(name+'_Wall_Left',3.48,z,.72,.24);
    b.wall(name+'_Wall_Right',9.92,z,8.16,.24);
    doorway(b,name+'_Doorway',4.85,z,1.9);
  }
  b.wall('Kitchen_Gallery_Spine',-9.30,7.6,9.4,.22,'plaster',3.65);
  ceiling(b,'Main_Lounge',-2.1,-6.35,9.9,8.8);
  ceiling(b,'Window_Salon',-10.65,-5.20,5.9,10.3);
  ceiling(b,'Kitchen',-9.35,3.6,8.85,7.2);
  ceiling(b,'Dining',-.5,4,6.15,6.5);
  ceiling(b,'Bedroom',8.5,-6.5,10.7,8.7);
  ceiling(b,'Private_Gallery',8.5,1,10.7,5.65);
  ceiling(b,'Bathroom',8.5,7.5,10.7,6.65);
  b.box('Hub_Gallery_Walnut_Ceiling',[16.72,.09,3.05],[-5.5,3.50,9.4],'walnut',.016);
  for(const x of [-13.6,2.6])b.box('Gallery_Cove',[.035,.018,2.8],[x,3.56,9.4],'warmLight');
  for(const [i,x,z] of [[0,-6.3,-1.5],[1,1.8,-1.5],[2,-12.5,6.6],[3,-5.6,6.6],[4,1.8,6.7],[5,4.5,1],[6,8.8,1],[7,12.4,1],[8,4.3,-9.7],[9,12.5,-3.0],[10,5.9,5.2],[11,12.7,9.8]])downlight(b,'Downlight_'+i,x,z);
  b.anchor('PlayerSpawn',[SPAWN.x,0,SPAWN.z],SPAWN.yaw);
  b.zone='hub_gallery';
  for(let i=0;i<4;i++){
    const x=[-11.5,-7.9,-4.3,0][i];
    door(b,'Hub_Bay_'+(i+1),x,10.97,0,i+1);b.anchor('HubDoor_0'+(i+1),[x,0,10.72],PI);
    downlight(b,'Door_Bay_Light_'+i,x,10.35,3.443);
  }
  // Retained names keep early portal integrations stable.
  b.anchor('HubDoor_Entry',[0,0,10.72],PI);
  b.zone='hallway';door(b,'Residence_Entry',13.97,1,PI/2);b.anchor('HubDoor_Hall',[13.72,0,1],PI/2);
}
function mediaWall(b){
  b.withFrame('Media_Wall',[2.78,0,-6.35],PI/2,()=>{
    b.box('Stone_Upper',[6.3,2.56,.18],[0,2.00,-.05],'travertine',.013);
    b.box('Stone_Lower_Plinth',[6.3,.25,.18],[0,.215,-.05],'travertine',.013);
    for(const x of [-2.35,2.35])b.box('Stone_Lower_Pier',[1.6,.51,.18],[x,.585,-.05],'travertine',.012);
    b.box('Firebox_Back',[3.09,.40,.022],[0,.57,.07],'black',.008);
    b.box('Firebox_Base',[3.09,.04,.27],[0,.356,-.035],'blackMetal',.008);
    b.box('Ember_Tray',[2.66,.024,.08],[0,.387,-.08],'dimLight',.009);
    for(let i=0;i<17;i++)b.sphere('Fireplace_Stone_'+i,[-1.27+i*.158,.409,-.062],[.06,.019,.028],'darkStone',12);
    slab(b,'Cantilevered_Stone_Hearth',6.45,.85,.135,.055,[0,.18,-.27]);
    for(const x of [-2.10,0,2.10])b.box('Bookmatched_Stone_Joint',[.005,2.42,.009],[x,2.02,-.145],'darkStone');
    b.box('Television_Frame',[2.84,1.63,.065],[0,1.82,-.177],'blackMetal',.022);
    b.box('Television_Glass',[2.77,1.557,.01],[0,1.82,-.214],'screen',.014);
    b.box('TV_Status_Light',[.014,.004,.004],[0,1.022,-.22],'dimLight');
    b.block('Stone_Hearth',0,-.27,6.5,.9);
    for(const px of [-3.69,3.69]){
      b.box('Open_Shelving_Back',[.88,3.23,.042],[px,1.66,.07],'walnut');
      for(const dx of [-.46,.46])b.box('Shelf_Upright',[.046,3.30,.39],[px+dx,1.68,-.10],'walnut',.005);
      for(const [i,y] of [.28,1.02,1.80,2.58,3.30].entries()){
        b.box('Shelf',[.90,.038,.40],[px,y,-.11],'walnut',.007);b.box('Shelf_Underlight',[.78,.012,.021],[px,y-.025,-.25],'dimLight');
        if(i===0||i===2)books(b,'Shelf_Books',px-.29,y+.02,-.13,true,6);
        if(i===1)vase(b,'Shelf_Vase',px,y+.02,-.12,.9);
        if(i===3)b.torus('Shelf_Sculpture',.17,.048,[px,y+.21,-.1],'darkStone',[0,.35,0]);
      }
      b.block('Shelving',px,-.10,1.0,.45);
    }
  });
}
function living(b){
  b.zone='living';
  curtains(b,'North_West_Drapes',-13.15,-10.80,1.4);curtains(b,'Main_North_Drapes',2.32,-10.80,1.04);
  curtains(b,'West_Drapes',-13.80,.05,1.0,PI/2);
  rug(b,'Main_Handwoven_Rug',-1.92,-6.3,7.3,8.25);
  sofa(b,'Main_Sofa',-4.25,-6.3);
  loungeChair(b,'Fireside_Chair_South',-.05,-3.38,.16);
  loungeChair(b,'Fireside_Chair_North',.08,-9.30,PI+.08,'linen');
  b.cylinder('Main_Coffee_Table_Pedestal',.38,.46,.37,[-1.12,.185,-6.28],'travertine',80);
  slab(b,'Main_Coffee_Table_Sculpted_Top',2.05,1.15,.105,.46,[-1.12,.415,-6.28]);b.block('Main_Coffee_Table',-1.12,-6.28,2.12,1.22);
  b.cylinder('Companion_Table_Stem',.14,.21,.34,[.19,.17,-7.0],'walnut',64);
  slab(b,'Companion_Table_Top',.84,.81,.055,.34,[.19,.368,-7.0],'walnut');b.block('Companion_Table',.19,-7,.88,.86);
  books(b,'Coffee_Art_Books',-1.45,.48,-6.27,false,3);vase(b,'Coffee_Bud_Vase',-.68,.48,-6.26,.43,'darkStone');
  b.cylinder('Sofa_Side_Table_Pedestal',.17,.24,.515,[-4.17,.2575,-3.44],'darkStone',64);
  slab(b,'Sofa_Side_Table_Top',.73,.70,.05,.24,[-4.17,.54,-3.44],'walnut');tableLamp(b,'Sofa_Side_Lamp',[-4.17,.568,-3.44]);b.block('Sofa_Side_Table',-4.17,-3.44,.78,.75);
  mediaWall(b);
  // A second, intimate conversation group makes the window wing a useful room in the hub.
  b.zone='reading';rug(b,'Window_Salon_Rug',-10.8,-6.55,4.6,4.95,'linen');
  loungeChair(b,'Window_Chair_North',-10.30,-8.05,PI+.32,'linen');
  loungeChair(b,'Window_Chair_West',-12.0,-5.85,-1.10);
  b.cylinder('Reading_Table_Base',.18,.28,.535,[-10.45,.2675,-6.42],'darkStone',64);
  slab(b,'Reading_Table_Top',1.00,.93,.065,.39,[-10.45,.565,-6.42]);books(b,'Reading_Books',-10.52,.603,-6.4,false,3);b.block('Reading_Table',-10.45,-6.42,1.05,.98);
  floorLamp(b,'Salon_Floor_Lamp',-12.9,-5.0);plant(b,'Window_Olive',-12.90,-9.6,3.1);
  b.withFrame('Low_Library',[-7.28,0,-7.0],-PI/2,()=>{
    b.box('Carcass',[4.05,.72,.46],[0,.43,0],'walnut',.012);b.box('Plinth',[3.84,.10,.36],[0,.09,.025],'blackMetal',.009);
    for(let i=0;i<6;i++){const px=-1.68+i*.67;b.box('Inset_Door',[.651,.63,.018],[px,.45,-.241],'walnut',.007);b.box('Finger_Recess',[.37,.008,.012],[px,.714,-.249],'black');}
    slab(b,'Stone_Top',4.12,.50,.045,.045,[0,.815,0]);books(b,'Books',-1.16,.84,0,false,4);vase(b,'Vase',1.25,.84,0,1.0,'darkStone');
    b.block('Body',0,0,4.14,.54);
  });
  // Sculptural console and art anchor the transition from living to kitchen.
  b.withFrame('Salon_Console',[-10.6,0,-2.1],0,()=>{
    for(const x of [-1.2,1.2])b.box('Stone_Slab_Leg',[.17,.79,.41],[x,.395,0],'travertine',.026);
    slab(b,'Top',3.18,.57,.065,.09,[0,.823,0],'walnut');vase(b,'Large_Vase',-.94,.86,0,1.1);books(b,'Books',.62,.86,0,false,4);b.block('Body',0,0,3.25,.63);
  });
}
function kitchen(b){
  b.zone='kitchen';
  b.withFrame('Back_Kitchen',[-9.25,0,7.12],0,()=>{
    b.box('Toe_Kick',[8.25,.15,.52],[0,.09,0],'blackMetal');
    b.box('Lower_Carcass',[8.3,.50,.67],[0,.41,0],'walnut');
    // The sink bowl occupies a real opening above the lower carcass.
    for(let i=0;i<12;i++){const x=-3.8+i*.69;b.box('Base_Front_'+i,[.672,.73,.028],[x,.52,-.35],'walnut',.006);b.box('Recessed_Pull',[.56,.02,.012],[x,.825,-.368],'black');if(i%3!==1)b.box('Drawer_Joint',[.672,.008,.007],[x,.61,-.369],'black');}
    const sinkX=1.15,sinkW=.84;
    const leftEdge=-4.22,rightEdge=4.22;
    b.box('Worktop_Left',[sinkX-sinkW/2-leftEdge,.07,.82],[(leftEdge+sinkX-sinkW/2)/2,.925,0],'travertine',.012);
    b.box('Worktop_Right',[rightEdge-sinkX-sinkW/2,.07,.82],[(rightEdge+sinkX+sinkW/2)/2,.925,0],'travertine',.012);
    for(const z of [-.326,.326])b.box('Sink_Edge',[sinkW,.07,.17],[sinkX,.925,z],'travertine',.009);
    b.box('Sink_Bottom',[.82,.014,.49],[sinkX,.717,0],'blackMetal',.008);
    for(const x of [sinkX-.405,sinkX+.405])b.box('Sink_Side',[.014,.18,.5],[x,.811,0],'blackMetal',.006);
    for(const z of [-.245,.245])b.box('Sink_End',[.82,.18,.014],[sinkX,.811,z],'blackMetal',.006);
    b.cylinder('Sink_Drain',.042,.042,.003,[sinkX,.727,0],'brass',32);
    b.tube('Mixer_Tap',[[sinkX,.96,.31],[sinkX,1.31,.31],[sinkX,1.39,.08],[sinkX,1.26,-.02]],.017,'brass',64,12);
    b.box('Bookmatched_Backsplash',[8.44,1.14,.032],[0,1.53,.357],'travertine');
    b.box('Display_Shelf',[8.18,.048,.26],[0,1.96,.235],'walnut',.01);b.box('Under_Shelf_Light',[8.08,.018,.026],[0,1.925,.108],'warmLight');
    for(const x of [-2.95,-2.42,2.98])vase(b,'Shelf_Pottery',x,1.987,.2,.58,x>0?'darkStone':'ceramic');
    books(b,'Cookbooks',-3.38,.972,-.05,true,6);b.box('Chopping_Board',[.38,.027,.28],[2.93,.974,-.10],'oak',.028,[0,.13,0]);
    b.block('Cabinets',0,0,8.5,.83);
  });
  b.withFrame('Appliance_Wall',[-13.51,0,4.48],-PI/2,()=>{
    b.box('Body',[4.66,3.06,.69],[0,1.59,0],'walnut',.016);
    for(let i=0;i<7;i++){const x=-1.99+i*.662;b.box('Tall_Front',[.647,2.94,.024],[x,1.62,-.36],'walnut',.008);b.box('Full_Height_Reveal',[.007,2.90,.012],[x-.325,1.62,-.374],'black');}
    for(const x of [-1.325,1.323])b.box('Appliance_Pull',[.015,.54,.05],[x+.24,1.23,-.40],'brass',.007);
    for(const y of [1.17,1.83]){
      b.box('Oven_Frame',[.60,.60,.045],[0,y,-.40],'blackMetal',.012);
      b.box('Oven_Glass',[.51,.43,.012],[0,y-.018,-.43],'screen',.008);
      b.box('Oven_Handle',[.47,.025,.055],[0,y+.195,-.469],'brass',.009);
      for(const x of [-.17,.17])b.cylinder('Oven_Dial',.021,.021,.017,[x,y+.246,-.44],'blackMetal',28,[PI/2,0,0]);
    }
    b.block('Tall_Cabinets',0,0,4.74,.75);
  });
  b.withFrame('Kitchen_Island',[-9.30,0,3.10],0,()=>{
    b.box('Recessed_Plinth',[4.48,.13,1.16],[0,.08,.10],'blackMetal');b.box('Oak_Core',[4.63,.75,1.29],[0,.49,.10],'walnut',.016);
    // Half-round joinery, with real flutes rather than a subdivided flat face.
    for(let i=0;i<74;i++)b.cylinder('Rounded_Oak_Flute',.023,.023,.70,[-2.20+i*.0603,.49,-.56],'walnut',14);
    slab(b,'Stone_Countertop',5.04,1.77,.095,.085,[0,.953,-.015]);
    for(const x of [-2.475,2.475])b.box('Stone_Waterfall',[.075,.895,1.73],[x,.475,-.015],'travertine',.02);
    b.box('Induction_Hob',[.85,.012,.55],[-.57,1.007,.17],'screen',.02);
    for(const [x,z,r] of [[-.8,.02,.093],[-.35,.02,.11],[-.77,.32,.11],[-.32,.32,.082]])b.torus('Induction_Zone',r,.002,[x,1.015,z],'blackMetal',[PI/2,0,0]);
    slab(b,'Serving_Tray',.58,.35,.024,.05,[1.50,1.018,.04],'walnut');vase(b,'Island_Vase',1.48,1.037,.04,.72);
    b.block('Body',0,-.015,5.13,1.85);
  });
  for(const [i,x] of [-11.1,-9.95,-8.8,-7.65].entries())diningChair(b,'Island_Stool_'+i,x,1.65,PI,{stool:true});
  for(const x of [-11.15,-7.45])b.cylinder('Island_Pendant_Cable',.004,.004,1.46,[x,3.27,3.10],'blackMetal',10);
  slab(b,'Island_Pendant_Body',4.48,.19,.058,.085,[-9.30,2.52,3.10],'brass');slab(b,'Island_Pendant_Diffuser',4.39,.135,.018,.055,[-9.30,2.482,3.10],'dimLight');
}
function dining(b){
  b.zone='dining';rug(b,'Dining_Rug',-.20,3.65,5.7,4.65,'linen');
  for(const x of [-1.30,.90])slab(b,'Dining_Sculpted_Pedestal',.61,.79,.74,.23,[x,.37,3.65],'walnut');
  slab(b,'Dining_Table_Eased_Stone_Top',3.55,1.26,.08,.34,[-.20,.78,3.65]);b.block('Dining_Table',-.2,3.65,3.65,1.36);
  for(const [i,x] of [-1.42,-.20,1.02].entries()){
    diningChair(b,'Dining_North_'+i,x,2.55,PI);diningChair(b,'Dining_South_'+i,x,4.75,0);
  }
  diningChair(b,'Dining_West',-2.51,3.65,-PI/2);diningChair(b,'Dining_East',2.11,3.65,PI/2);
  // Flattened closed ceramic profiles make the tableware readable at arm's length.
  for(const [i,x,z] of [[0,-1.38,3.32],[1,1.0,3.98]]){
    const profile=[[0,0],[.08,0],[.143,.012],[.148,.022],[.135,.030],[.095,.011],[0,.01]].map(p=>new THREE.Vector2(...p));b.mesh('Dinner_Plate_'+i,new THREE.LatheGeometry(profile,64),'ceramic',[x,.827,z]);
    b.rod('Cutlery_Handle',[x+.20,.842,z-.09],[x+.20,.842,z+.09],.007,.006,'brass',16);
    b.box('Folded_Napkin',[.13,.014,.17],[x,.858,z],'linen',.006);
    b.cylinder('Water_Glass_Base',.033,.035,.009,[x-.21,.834,z-.15],'glass',36);b.mesh('Water_Glass',new THREE.LatheGeometry([[.035,0],[.038,.12],[.034,.12],[.031,.01]].map(p=>new THREE.Vector2(...p)),40),'glass',[x-.21,.839,z-.15]);
  }
  vase(b,'Dining_Centre_Vase',-.19,.827,3.65,.70,'darkStone');
  for(const x of [-1.25,.85])b.cylinder('Dining_Pendant_Cable',.004,.004,1.36,[x,3.25,3.65],'blackMetal',10);
  b.torus('Dining_Oval_Pendant',.87,.023,[-.2,2.56,3.65],'brass',[PI/2,0,0],[1.82,.62,1]);
  b.torus('Dining_Oval_Diffuser',.87,.014,[-.2,2.546,3.65],'dimLight',[PI/2,0,0],[1.82,.62,1]);
}
function relief(b,name,x,y,z,w,h,yaw=0){
  b.withFrame(name,[x,y,z],yaw,()=>{
    b.box('Oak_Frame',[w+.065,h+.065,.045],[0,0,0],'walnut',.01);
    b.box('Linen_Ground',[w,h,.028],[0,0,-.028],'linen',.006);
    for(let i=0;i<3;i++)b.torus('Stone_Relief_Arc',.26+i*.18,.025,[0,.02,-.055-i*.008],'travertine',[0,0,.4],[1.15,.85,1]);
    b.box('Vertical_Relief',[.038,h*.75,.026],[w*.29,0,-.07],'darkStone',.009,[0,0,-.22]);
  });
}
function bedroom(b){
  b.zone='bedroom';curtains(b,'Suite_North_Drapes_Left',3.75,-10.8,1.14);curtains(b,'Suite_North_Drapes_Right',13.28,-10.8,1.1);
  rug(b,'Bedroom_Handwoven_Rug',8.95,-6.4,5.15,5.72,'rug');
  b.wall('Dressing_Headboard_Partition',11.12,-6.4,.20,5.50,'walnut',3.14);
  for(let i=0;i<8;i++)b.box('Headboard_Timber_Reveal',[.012,3.02,.01],[11.013,1.57,-8.8+i*.69],'black');
  b.box('Headboard_Concealed_Light',[.018,.022,5.35],[11.02,3.17,-6.4],'dimLight');
  bed(b,9.65,-6.40);bench(b,'Bedroom_Foot_Bench',7.56,-6.40,PI/2,1.82);
  b.withFrame('Dressing_Wardrobes',[13.55,0,-6.4],PI/2,()=>{
    b.box('Carcass',[7.8,3.12,.73],[0,1.63,0],'walnut',.011);
    for(let i=0;i<12;i++){const x=-3.57+i*.648;b.box('Tall_Door',[.632,3.0,.024],[x,1.65,-.38],'walnut',.007);b.box('Pull',[.012,.50,.044],[x+(i%2?.24:-.24),1.3,-.408],'brass',.005);}
    b.box('Toe_Kick',[7.68,.09,.56],[0,.075,.02],'blackMetal');b.block('Cabinets',0,0,7.85,.80);
  });
  loungeChair(b,'Bedroom_Reading_Chair',5.54,-5.28,-.40,'linen');floorLamp(b,'Bedroom_Reading_Lamp',4.34,-5.5);
  b.cylinder('Bedroom_Side_Table_Stem',.12,.20,.467,[6.0,.2335,-4.20],'walnut',48);slab(b,'Bedroom_Side_Table',.64,.63,.047,.24,[6.0,.485,-4.20]);books(b,'Bedroom_Reading_Books',6,.515,-4.2,false,3);b.block('Bedroom_Side_Table',6,-4.2,.69,.68);
  b.withFrame('Writing_Desk',[6.23,0,-9.94],PI,()=>{
    slab(b,'Desktop',2.30,.72,.065,.095,[0,.77,0],'walnut');for(const x of [-.94,.94])b.box('Leg',[.075,.738,.49],[x,.369,.01],'walnut',.022);
    b.box('Shallow_Drawer',[.85,.11,.56],[.49,.68,.01],'walnut',.012);b.box('Drawer_Joint',[.77,.007,.012],[.49,.675,-.28],'black');
    tableLamp(b,'Desk_Lamp',[-.79,.809,.10],.85);books(b,'Desk_Books',.65,.81,.06,false,3);b.block('Desk',0,0,2.4,.8);
  });
  diningChair(b,'Writing_Chair',6.23,-8.87,0);
  relief(b,'Bedroom_Textile_Art',8.0,1.85,-2.135,2.1,1.65,PI);
  plant(b,'Suite_Olive',10.3,-9.87,2.7);
}
function bathroom(b){
  b.zone='bathroom';b.box('Bath_Stone_Floor',[10.76,.032,6.75],[8.5,.016,7.5],'travertine');
  b.box('South_Stone_Wall',[10.75,3.82,.04],[8.5,1.93,10.967],'travertine');b.box('East_Stone_Wall',[.04,3.82,6.75],[13.967,1.93,7.5],'travertine');
  b.box('Vanity_Stone_Wall',[.04,3.82,6.74],[3.143,1.93,7.5],'travertine');
  for(let x=3.7;x<14;x+=1.4)b.box('Floor_Stone_Joint_X',[.003,.003,6.72],[x,.034,7.5],'plaster');
  for(let z=4.7;z<11;z+=1.4)b.box('Floor_Stone_Joint_Z',[10.72,.003,.003],[8.5,.034,z],'plaster');
  b.withFrame('Double_Vanity',[3.50,0,8.1],-PI/2,()=>{
    b.box('Floating_Cabinet',[3.72,.45,.64],[0,.53,0],'walnut',.025);slab(b,'Stone_Top',3.80,.74,.075,.055,[0,.795,0]);
    for(const x of [-1.38,-.46,.46,1.38])b.box('Drawer_Front',[.90,.39,.022],[x,.535,-.335],'walnut',.008);
    b.box('Underlight',[3.57,.013,.022],[0,.298,-.29],'dimLight');
    for(const px of [-.97,.97]){
      const profile=[[0,0],[.13,0],[.26,.07],[.29,.14],[.287,.17],[.266,.18],[.234,.08],[.09,.022],[0,.022]].map(p=>new THREE.Vector2(...p));b.mesh('Ceramic_Basin',new THREE.LatheGeometry(profile,80),'ceramic',[px,.836,-.035],[0,0,0],[1.11,1,.83]);
      b.cylinder('Basin_Drain',.022,.022,.004,[px,.861,-.035],'brass',32);
      b.tube('Wall_Mixer',[[px,1.08,.315],[px,1.17,.27],[px,1.17,.015],[px,1.13,-.02]],.012,'brass',44,12);
    }
    // Vertical, softly rounded mirrors. A static bathroom probe supplies their reflections.
    for(const px of [-.97,.97]){
      b.mesh('Mirror_Brass_Frame',slabGeometry(1.0,1.60,.026,.17),'brass',[px,1.94,.324],[PI/2,0,0]);
      b.mesh('Silvered_Mirror',slabGeometry(.952,1.55,.030,.15),'mirror',[px,1.94,.304],[PI/2,0,0]);
    }
    for(const px of [-1.69,0,1.69]){b.box('Sconce_Back',[.05,.54,.046],[px,1.94,.294],'brass',.014);b.cylinder('Sconce_Diffuser',.029,.029,.49,[px,1.94,.255],'dimLight',40);}
    vase(b,'Vanity_Vase',0,.837,-.10,.42,'darkStone');b.block('Vanity',0,0,3.88,.80);
  });
  // Closed outer shell, thick rim and open bowl; the tub is not a solid capped cylinder.
  const tubProfile=[[0,.08],[.37,.08],[.52,.13],[.68,.40],[.73,.63],[.722,.67],[.667,.675],[.654,.62],[.606,.36],[.46,.17],[0,.17]].map(([r,h])=>new THREE.Vector2(r,h-.08));
  b.mesh('Freestanding_Stone_Bath',new THREE.LatheGeometry(tubProfile,128),'ceramic',[8.23,.037,9.05],[0,.1,0],[1.53,1,.77]);
  b.cylinder('Tub_Drain',.044,.044,.003,[8.23,.130,9.05],'brass',40);
  b.tube('Floor_Mounted_Tub_Tap',[[9.43,.03,9.45],[9.43,.88,9.45],[9.28,1.06,9.45],[9.01,.97,9.45]],.020,'brass',64,12);
  b.block('Bathtub',8.23,9.05,2.30,1.28);b.block('Tub_Tap',9.43,9.45,.16,.16);
  slab(b,'Bath_Mat',1.48,.73,.018,.045,[8.10,.042,7.87],'linen');
  bench(b,'Bath_Bench',6.03,10.42,0,1.55);
  b.box('Shower_Stone_Base',[2.64,.032,2.98],[12.56,.05,5.64],'travertine',.014);
  b.box('Shower_Glass_South',[2.65,2.86,.014],[12.56,1.48,7.17],'glass');b.block('Shower_Glass_South',12.56,7.17,2.68,.065);
  b.box('Shower_Glass_West',[.014,2.86,1.35],[11.23,1.48,4.84],'glass');b.block('Shower_Glass_West',11.23,4.84,.065,1.38);
  for(const y of [.062,2.91])b.box('Shower_Glass_Channel',[2.67,.022,.026],[12.56,y,7.17],'brass',.006);
  b.tube('Rain_Shower_Arm',[[13.93,2.63,5.23],[13.28,2.63,5.23],[13.10,2.57,5.23]],.018,'brass',48,12);
  b.cylinder('Rain_Shower_Head',.235,.235,.024,[13.10,2.548,5.23],'brass',80);b.cylinder('Rain_Shower_Spray_Plate',.216,.216,.008,[13.10,2.531,5.23],'blackMetal',80);
  for(let i=0;i<40;i++){const a=i*2.399,r=.034*Math.sqrt(i);b.cylinder('Shower_Nozzle',.003,.003,.007,[13.10+Math.cos(a)*r,2.525,5.23+Math.sin(a)*r],'ceramic',6);}
  b.box('Shower_Control_Plate',[.022,.24,.14],[13.92,1.15,5.20],'brass',.022);
  for(const y of [1.08,1.22])b.cylinder('Shower_Control_Dial',.028,.028,.029,[13.895,y,5.20],'blackMetal',32,[0,0,PI/2]);
  b.box('Shower_Linear_Drain',[.052,.003,1.85],[13.34,.069,5.68],'blackMetal',.012);
  b.wall('WC_Privacy_Divider',11.08,9.75,.15,2.5,'travertine',2.4);
  b.box('WC_Cistern',[.17,1.2,.83],[13.86,.64,9.60],'travertine',.025);
  b.sphere('WC_Ceramic_Body',[13.48,.37,9.60],[.40,.245,.267],'ceramic',64);
  b.mesh('WC_Seat_Rim',new THREE.TorusGeometry(.218,.034,20,80),'ceramic',[13.40,.564,9.60],[PI/2,0,PI/2],[1.30,1,1]);
  b.mesh('WC_Seat_Inset',new THREE.CircleGeometry(.20,64),'black',[13.40,.556,9.60],[-PI/2,0,0],[1.32,1,1]);
  b.box('WC_Flush_Plate',[.014,.14,.24],[13.767,1.07,9.60],'brass',.012);b.block('Toilet',13.46,9.6,.86,.62);
  b.withFrame('Bath_Linen_Cabinet',[8.84,0,4.41],PI,()=>{b.box('Body',[2.55,2.65,.54],[0,1.36,0],'walnut',.016);for(const x of [-.85,0,.85]){b.box('Door',[.828,2.56,.023],[x,1.37,-.28],'walnut',.007);b.box('Pull',[.015,.32,.046],[x+.29,1.23,-.312],'brass',.006);}b.block('Cabinet',0,0,2.62,.60);});
  b.tube('Towel_Rail',[[5.75,1.30,10.91],[5.75,1.30,10.75],[6.42,1.30,10.75],[6.42,1.30,10.91]],.013,'brass',32,10);b.box('Hanging_Bath_Towel',[.46,.77,.039],[6.05,.96,10.73],'linen',.017);
}
function galleries(b){
  b.zone='hallway';
  rug(b,'Private_Gallery_Runner',8.75,1.0,6.3,2.6,'linen');
  relief(b,'Private_Gallery_Art',8.7,2.12,3.84,3.35,1.68);
  b.withFrame('Gallery_Console',[8.70,0,3.45],0,()=>{
    for(const px of [-1.55,1.55])b.box('Slab_Leg',[.14,.85,.44],[px,.425,0],'travertine',.022);
    slab(b,'Stone_Top',3.85,.60,.062,.06,[0,.88,0]);vase(b,'Vase',-1.31,.917,0,1.20);books(b,'Books',.85,.917,0,false,5);b.block('Console',0,0,3.92,.65);
  });
  bench(b,'Entry_Bench',10.80,-1.48,0,2.14);plant(b,'Entry_Olive',12.83,3.12,2.75);
  relief(b,'Entry_Art',9.4,2.06,-1.85,2.60,1.40,PI);
  b.zone='hub_gallery';
  // Panel rhythm, gallery seating and niches surround four full-size future portals.
  b.box('Gallery_Panel_Shadow_Background',[16.72,3.40,.012],[-5.5,1.70,11.0],'black');
  for(let i=0;i<15;i++){const x=-13.5+i*1.08;b.box('Gallery_Wall_Panel',[1.066,3.37,.022],[x,1.70,11.00],'walnut',.007);}
  // Door leaves project into the room, ahead of the continuous wall panels.
  rug(b,'Hub_Gallery_Runner',-5.5,9.31,15.9,1.39,'linen');
  b.box('Gallery_North_Cladding',[9.1,3.25,.034],[-9.30,1.66,7.736],'walnut',.012);
  bench(b,'Hub_Gallery_Bench',-9.30,8.16,0,2.8);
  relief(b,'Hub_Gallery_Relief',-9.3,2.04,7.78,3.30,1.42,PI);
  b.withFrame('Hub_Gallery_Plinth',[-3.90,0,8.22],0,()=>{
    slab(b,'Stone_Pedestal',.68,.68,.96,.065,[0,.48,0]);b.torus('Bronze_Sculpture',.285,.063,[0,1.302,0],'brass',[.1,.45,0]);b.block('Pedestal',0,0,.74,.74);
  });
}

export function buildApartment(materials,{batch=true}={}){
  const b=new ApartmentBuilder(materials);architecture(b);living(b);kitchen(b);dining(b);bedroom(b);bathroom(b);galleries(b);if(batch)b.finish();return b;
}
