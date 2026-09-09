import * as THREE from 'three';
import { cushionGeometry,backrestGeometry,roundedRectanglePoints,drapedClothGeometry } from './geometry.js';

function cushion(b,name,size,pos,mat,rotation=[0,0,0],opts={}){return b.mesh(name,cushionGeometry(...size,opts),mat,pos,rotation);}
function piping(b,name,w,d,y,z=0,x=0,material='linen') {b.tube(name,roundedRectanglePoints(w,d,Math.min(.085,w*.15,d*.15),y,10).map(p=>[p[0]+x,p[1],p[2]+z]),.004,material,128,6);}

export function loungeChair(b,name,x,z,yaw=0,mat='leather') {
  b.withFrame(name,[x,0,z],yaw,()=>{
    for(const dx of [-.34,.34])for(const dz of [-.32,.31])b.rod('Tapered_Leg',[dx*1.13,.025,dz*1.13],[dx,.35,dz],.024,.016,'walnut',24);
    cushion(b,'Walnut_Seat_Shell',[.96,.11,.90],[0,.365,0],'walnut',[0,0,0],{radius:.045,bulge:0});
    cushion(b,'Seat_Cushion',[.79,.16,.75],[0,.48,-.045],mat,[0,0,0],{radius:.074,bulge:.024});
    piping(b,'Seat_Piping',.755,.715,.502,-.045,0,mat);
    b.mesh('Curved_Walnut_Back_Shell',backrestGeometry({width:1.01,height:.55,thickness:.07,wrap:.19,lean:.095}),'walnut',[0,.765,.135],[0,0,0],[1,1,1],{keepUV:true});
    b.mesh('Curved_Back_Upholstery',backrestGeometry({width:.90,height:.47,thickness:.145,wrap:.155,lean:.088}),mat,[0,.79,.076],[0,0,0],[1,1,1],{keepUV:true});
    for(const dx of [-.345,.345]) {
      b.tube('Back_Support',[[dx,.315,.24],[dx,.48,.33],[dx,.75,.38]],.026,'walnut',32,12);
      b.tube('Arm_Frame',[[dx*1.23,.38,-.28],[dx*1.25,.65,-.25],[dx*1.25,.69,.12],[dx,.83,.31]],.022,'walnut',48,12);
      cushion(b,'Armrest',[.13,.095,.57],[dx*1.27,.685,-.09],mat,[-.05,0,0],{radius:.042,bulge:.008,segments:5});
    }
    b.block('Body',0,0,1.05,1.08);
  });
}

export function diningChair(b,name,x,z,yaw=0,{stool=false}={}) {
  const seatY=stool?.755:.495,backY=seatY+.27,mat=stool?'leather':'linen';
  b.withFrame(name,[x,0,z],yaw,()=>{
    for(const dx of [-.215,.215]){
      b.rod('Front_Leg',[dx*1.13,.02,-.235],[dx,seatY-.055,-.185],.02,.013,'walnut',20);
      b.tube('Continuous_Rear_Leg_And_Back_Support',[[dx*1.08,.025,.24],[dx,seatY-.07,.2],[dx,seatY+.10,.22],[dx*.92,backY+.11,.275]],.020,'walnut',44,12);
      b.rod('Seat_Side_Rail',[dx,seatY-.08,-.19],[dx,seatY-.08,.21],.017,.017,'walnut',16);
    }
    b.rod('Seat_Front_Rail',[-.22,seatY-.08,-.19],[.22,seatY-.08,-.19],.018,.018,'walnut',20);
    cushion(b,'Contoured_Seat',[.535,.105,.525],[0,seatY,0],mat,[0,0,0],{radius:.05,bulge:.020});
    piping(b,'Seat_Seam',.51,.5,seatY+.015,0,0,mat);
    b.mesh('Supported_Curved_Backrest',backrestGeometry({width:.60,height:.29,thickness:.09,wrap:.095,lean:.035,segments:56,rings:24}),mat,[0,backY,.195],[0,0,0],[1,1,1],{keepUV:true});
    if(stool){b.rod('Footrest',[-.24,.29,-.22],[.24,.29,-.22],.012,.012,'brass',16);for(const dx of [-.23,.23])b.rod('Side_Stretcher',[dx,.29,-.22],[dx,.29,.23],.012,.012,'brass',16);}
    b.block('Body',0,0,.64,.64);
  });
}

export function sofa(b,name,x,z,yaw=-Math.PI/2) {
  b.withFrame(name,[x,0,z],yaw,()=>{
    for(const px of [-1.85,1.85])for(const pz of [-.31,.32])b.cylinder('Hidden_Foot',.045,.045,.052,[px,.026,pz],'blackMetal',20);
    for(const px of [-1.8,-.91])b.cylinder('Chaise_Hidden_Foot',.045,.045,.052,[px,.026,-1.26],'blackMetal',20);
    b.box('Oak_Plinth',[4.12,.14,.91],[0,.115,.04],'walnut',.024);
    b.box('Chaise_Plinth',[1.16,.14,1.93],[-1.365,.115,-.48],'walnut',.025);
    cushion(b,'Upholstered_Foundation',[4.40,.29,1.17],[0,.31,0],'linen',[0,0,0],{radius:.105,bulge:.006});
    cushion(b,'Chaise_Foundation',[1.47,.29,2.11],[-1.355,.31,-.48],'linen',[0,0,0],{radius:.09,bulge:.005});
    cushion(b,'Continuous_Supported_Back',[4.37,.70,.25],[0,.67,.49],'linen',[.035,0,0],{radius:.085,bulge:.01});
    for(const [i,px,depth,cz] of [[0,-1.36,1.93,-.49],[1,0,.91,-.075],[2,1.36,.91,-.075]]) {
      cushion(b,'Seat_Cushion_'+i,[1.325,.20,depth],[px,.545,cz],'linen',[0,0,0],{radius:.088,bulge:.030});
      piping(b,'Seat_Seam_'+i,1.275,depth-.05,.554,cz,px);
      cushion(b,'Back_Cushion_'+i,[1.32,.53,.25],[px,.825,.385],'linen',[.115,0,0],{radius:.10,bulge:.028});
    }
    for(const px of [-2.10,2.10])cushion(b,'Sculpted_Arm',[.245,.45,1.16],[px,.555,-.015],'linen',[0,0,0],{radius:.105,bulge:.012});
    cushion(b,'Olive_Loose_Pillow',[.52,.50,.18],[-1.83,.81,.11],'darkFabric',[.22,0,-.13],{radius:.086,bulge:.035});
    cushion(b,'Linen_Loose_Pillow',[.53,.49,.18],[1.69,.81,.1],'linen',[.24,0,.14],{radius:.087,bulge:.04});
    cushion(b,'Small_Leather_Pillow',[.43,.30,.15],[1.30,.745,-.03],'leather',[.20,.11,0],{radius:.065,bulge:.021});
    b.mesh('Draped_Throw',drapedClothGeometry(.75,1.05,.68,{drop:.26,folds:.009,segments:40}),'darkFabric',[.40,0,-.1],[0,.04,0],[1,1,1],{keepUV:true});
    b.block('Main',0,0,4.43,1.21);b.block('Chaise',-1.355,-.73,1.49,1.7);
  });
}

export function bed(b,x,z) {
  b.withFrame('Primary_Bed',[x,0,z],Math.PI/2,()=>{
    for(const px of [-.80,.80])for(const pz of [-.90,.9])b.cylinder('Concealed_Foot',.052,.052,.052,[px,.026,pz],'blackMetal',24);
    b.box('Recessed_Oak_Base',[1.95,.18,2.12],[0,.13,0],'walnut',.04);
    cushion(b,'Upholstered_Bed_Rail',[2.24,.22,2.39],[0,.315,0],'linen',[0,0,0],{radius:.065,bulge:.004});
    cushion(b,'Mattress',[2.06,.245,2.17],[0,.535,-.02],'linen',[0,0,0],{radius:.072,bulge:.008});
    cushion(b,'Duvet_Filling',[2.03,.075,1.60],[0,.686,-.32],'linen',[0,0,0],{radius:.033,bulge:.014});
    b.mesh('Duvet_With_Hanging_Edges',drapedClothGeometry(2.44,1.94,.767,{drop:.30,folds:.013,segments:80}),'linen',[0,0,-.28],[0,0,0],[1,1,1],{keepUV:true});
    b.mesh('Foot_Throw',drapedClothGeometry(2.45,.56,.79,{drop:.30,folds:.007,segments:52}),'darkFabric',[0,0,-.93],[0,0,0],[1,1,1],{keepUV:true});
    for(const px of [-.51,.51]){
      cushion(b,'Sleeping_Pillow',[.86,.15,.51],[px,.77,.70],'linen',[.10,0,px*.04],{radius:.072,bulge:.032});
      cushion(b,'Back_Pillow',[.80,.20,.54],[px,.90,.91],'linen',[.54,0,px*.035],{radius:.086,bulge:.035});
    }
    cushion(b,'Upholstered_Headboard',[3.46,1.35,.16],[0,.74,1.19],'linen',[0,0,0],{radius:.055,bulge:.006});
    for(const dx of [-.86,0,.86])b.box('Headboard_Recessed_Seam',[.006,1.18,.015],[dx,.75,1.101],'darkFabric',.002);
    for(const px of [-1.49,1.49]){
      b.box('Floating_Nightstand',[.60,.23,.50],[px,.485,.99],'walnut',.024);
      b.box('Drawer_Reveal',[.53,.008,.005],[px,.49,.733],'black');
      b.box('Nightstand_Stone_Inlay',[.55,.014,.45],[px,.607,.99],'travertine',.006);
      tableLamp(b,'Bedside_Lamp',[px,.623,.99],.7);
      b.block('Nightstand',px,.99,.64,.55);
    }
    b.block('Frame',0,0,2.30,2.45);b.block('Headboard',0,1.2,3.50,.21);
  });
}

export function bench(b,name,x,z,yaw=0,length=1.8) {
  b.withFrame(name,[x,0,z],yaw,()=>{for(const px of [-length*.35,length*.35]){b.box('Leg',[.075,.36,.34],[px,.21,0],'walnut',.018);b.box('Foot',[.18,.03,.38],[px,.015,0],'blackMetal',.008);}b.box('Frame',[length-.14,.08,.41],[0,.40,0],'walnut',.025);cushion(b,'Upholstered_Seat',[length,.14,.52],[0,.485,0],'leather',[0,0,0],{radius:.055,bulge:.024});piping(b,'Piping',length-.04,.48,.49,0,0,'leather');b.block('Body',0,0,length+.04,.56);});
}

export function tableLamp(b,name,position,scale=1) {
  b.withFrame(name,position,0,()=>{
    b.cylinder('Foot',.10*scale,.115*scale,.025*scale,[0,.013*scale,0],'brass',48);
    b.cylinder('Stem',.012*scale,.015*scale,.32*scale,[0,.18*scale,0],'brass',20);
    const pts=[[.185,.29],[.16,.53],[.145,.53],[.17,.29],[.185,.29]].map(([r,y])=>new THREE.Vector2(r*scale,y*scale));
    b.mesh('Thick_Linen_Shade',new THREE.LatheGeometry(pts,64),'linen');
    b.cylinder('Diffuser',.162*scale,.162*scale,.014,[0,.299*scale,0],'dimLight',48);
    b.torus('Shade_Bottom_Trim',.18*scale,.004,[0,.295*scale,0],'brass',[Math.PI/2,0,0]);
  });
}

export function floorLamp(b,name,x,z) {
  b.withFrame(name,[x,0,z],0,()=>{
    b.cylinder('Foot',.23,.26,.037,[0,.02,0],'darkStone',64);b.cylinder('Stem',.013,.016,1.38,[0,.73,0],'brass',24);
    const pts=[[.32,1.33],[.24,1.77],[.226,1.77],[.306,1.33],[.32,1.33]].map(p=>new THREE.Vector2(...p));b.mesh('Linen_Shade_With_Interior',new THREE.LatheGeometry(pts,80),'linen');
    b.cylinder('Diffuser',.30,.30,.012,[0,1.342,0],'dimLight',64);b.block('Base',0,0,.5,.5);
  });
}

export function vase(b,name,x,y,z,scale=1,mat='ceramic') {
  const p=[[0,0],[.105,0],[.15,.045],[.18,.22],[.137,.37],[.065,.43],[.065,.46],[.047,.46],[.047,.43],[.118,.35],[.15,.22],[.09,.025],[0,.025]].map(([r,h])=>new THREE.Vector2(r*scale,h*scale));
  b.mesh(name,new THREE.LatheGeometry(p,64),mat,[x,y,z]);
}

export function books(b,name,x,y,z,vertical=false,count=4) {
  for(let i=0;i<count;i++) {
    const mat=['bookRust','paper','bookOlive','darkFabric'][i%4];
    b.withFrame(name+'_'+i,[x+(vertical?i*.05:0),y+(vertical?0:i*.04),z],vertical?0:.06*i,()=>{
      if(vertical){b.box('Cover',[.043,.27+(i%3)*.025,.205],[0,.135+(i%3)*.0125,0],mat,.002);b.box('Pages',[.033,.251+(i%3)*.025,.188],[0,.135+(i%3)*.0125,-.003],'paper',.002);}
      else {b.box('Cover',[.34-i*.014,.037,.245],[0,.0185,0],mat,.003);b.box('Pages',[.323-i*.014,.027,.232],[0,.019,-.002],'paper',.002);}
    });
  }
}

export function plant(b,name,x,z,height=2.6) {
  b.withFrame(name,[x,0,z],0,()=>{
    const ph=height*.22,profile=[[.24,0],[.32,ph*.07],[.36,ph],[.32,ph],[.29,ph*.15]].map(p=>new THREE.Vector2(...p));b.mesh('Stone_Planter',new THREE.LatheGeometry(profile,80),'travertine');
    b.cylinder('Soil',.313,.313,.013,[0,ph-.025,0],'soil',48);
    for(let branch=0;branch<3;branch++){
      const a=branch*2.399,trunkEnd=[Math.cos(a)*.17,height*(.88+branch*.037),Math.sin(a)*.17];
      b.tube('Main_Branch_'+branch,[[0,ph-.05,0],[Math.cos(a)*.06,height*.52,Math.sin(a)*.07],trunkEnd],.015-branch*.002,'walnut',48,12);
      for(let k=0;k<17;k++) {
        const seed=k*2.399+branch*1.713,level=.44+(k/16)*.43+.036*Math.sin(seed*3),angle=seed+Math.sin(k*1.9)*.4;
        const y=height*level,reach=(.43+.23*Math.sin(seed*2.7)**2)*(1-.53*Math.max(0,(level-.65)/.25));
        const end=[Math.cos(angle)*reach,y+.13+.12*Math.sin(seed),Math.sin(angle)*reach];
        const base=[Math.cos(a)*.10,y-.09,Math.sin(a)*.10];
        b.tube('Twig_'+branch+'_'+k,[base,[end[0]*.63,y+.04,end[2]*.63],end],.004,'walnut',24,7);
        for(let j=0;j<9;j++) {
          const v=.20+j*.096,side=j%2?1:-1,leafYaw=angle+side*(.55+.25*Math.sin(j+seed));
          const px=base[0]*(1-v)+end[0]*v+Math.sin(angle)*side*.045;
          const pz=base[2]*(1-v)+end[2]*v-Math.cos(angle)*side*.045;
          const py=base[1]*(1-v)+end[1]*v+.05*Math.sin(j*1.8+seed);
          const g=new THREE.SphereGeometry(1,12,8);b.mesh('Lanceolate_Leaf',g,'leaf',[px,py,pz],[-.30-.65*Math.sin(j+seed),leafYaw,side*.3],[.037,.008,.125]);
        }
      }
    }
    b.block('Planter',0,0,.74,.74);
  });
}
