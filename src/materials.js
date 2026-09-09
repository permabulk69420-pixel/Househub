import * as THREE from 'three';

const clamp = (x, a=0, b=255) => Math.max(a, Math.min(b,x));
const fract = x => x-Math.floor(x);
function noise(x,y) { return fract(Math.sin(x*127.1+y*311.7)*43758.5453); }
function smooth(x,y) {
  const a=Math.floor(x),b=Math.floor(y),u=fract(x),v=fract(y),s=u*u*(3-2*u),t=v*v*(3-2*v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(noise(a,b),noise(a+1,b),s),THREE.MathUtils.lerp(noise(a,b+1),noise(a+1,b+1),s),t);
}

function surface(kind,base,size=512) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'), pixels=context.createImageData(size,size);
  const roughCanvas=document.createElement('canvas');roughCanvas.width=roughCanvas.height=size;
  const roughContext=roughCanvas.getContext('2d'), rough=roughContext.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const u=x/size,v=y/size,i=(y*size+x)*4,n=noise(x,y)-.5;
    let d=0,r=220;
    if(kind==='oak'||kind==='walnut') {
      const plank=Math.floor(u*10),px=fract(u*10),offset=noise(plank,42)*8;
      const grain=Math.sin((u*210+Math.sin(v*6.283)*.65+smooth(u*18,v*4)*1.4)*6.283);
      d=grain*3+Math.sin((u*590+Math.sin(v*6.283)*1.1)*6.283)*1.8+n*4+(noise(plank,9)-.5)*18;
      d-=Math.pow(Math.abs(Math.sin((u*62+offset+Math.sin(v*6.283)*.3)*Math.PI)),24)*10;
      if(kind==='oak'&&(px<.013||px>.988||fract(v*3+noise(plank,5))<.006))d-=35;
      r=180+grain*8+n*14;
    } else if(kind==='travertine') {
      d=(smooth(u*18,v*75)-.5)*20+(smooth(u*7,v*22)-.5)*15+n*5;
      if(noise(Math.floor(x/2),Math.floor(y/2))>.978)d-=25;
      r=185+n*25;
    } else if(kind==='darkStone') {
      const vein=Math.sin((u*3+v*2+smooth(u*4,v*5)*1.4)*Math.PI*2);
      d=(smooth(u*30,v*30)-.5)*9+n*4+Math.pow(Math.abs(vein),60)*47;
      r=125+n*16;
    } else if(kind==='linen'||kind==='rug'||kind==='darkFabric') {
      const weave=(x%4===0?-7:2)+(y%4===0?-7:2);
      d=weave+n*16+(smooth(u*50,v*50)-.5)*11;
      if(kind==='rug')d+=Math.sin(u*Math.PI*64)*4;
      r=238+n*12;
    } else if(kind==='leather') { d=(smooth(u*130,v*130)-.5)*13+n*7;r=180+n*24; }
    else {d=n*5+(smooth(u*55,v*55)-.5)*5;r=224+n*14;}
    for(let c=0;c<3;c++){pixels.data[i+c]=clamp(base[c]+d);rough.data[i+c]=clamp(r);}
    pixels.data[i+3]=rough.data[i+3]=255;
  }
  context.putImageData(pixels,0,0);roughContext.putImageData(rough,0,0);
  const map=new THREE.CanvasTexture(canvas),roughnessMap=new THREE.CanvasTexture(roughCanvas);
  map.colorSpace=THREE.SRGBColorSpace;
  return {map,roughnessMap,bumpMap:roughnessMap};
}

export function createMaterials(renderer) {
  const materials={};
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  function add(name,params={}) {
    const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8,...params,vertexColors:true});
    m.name=name;m.userData.slot=name;materials[name]=m;return m;
  }
  const specs={
    oak:{base:[162,133,95],tile:[2.2,2.2],roughness:.78,bump:.018},
    walnut:{base:[91,65,43],tile:[1.2,2.4],roughness:.78,bump:.014},
    travertine:{base:[206,198,178],tile:[1.6,1.6],roughness:.68,bump:.022},
    plaster:{base:[226,224,215],tile:[1,1],roughness:1,bump:.008},
    linen:{base:[202,198,185],tile:[.42,.42],roughness:1,bump:.009},
    rug:{base:[157,151,136],tile:[.55,.55],roughness:1,bump:.009},
    leather:{base:[117,74,45],tile:[.5,.5],roughness:.82,bump:.01},
    darkStone:{base:[48,55,51],tile:[1.4,1.4],roughness:.65,bump:.009},
    darkFabric:{base:[57,67,61],tile:[.42,.42],roughness:1,bump:.008},
  };
  for(const [name,spec] of Object.entries(specs)) {
    const maps=surface(name,spec.base);
    for(const texture of new Set(Object.values(maps))){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/spec.tile[0],1/spec.tile[1]);texture.anisotropy=anisotropy;}
    add(name,{...maps,roughness:spec.roughness,bumpScale:spec.bump,envMapIntensity:.65});
    materials[name].userData.tileSizeMeters=spec.tile;
  }
  add('ceramic',{color:0xe8e5dc,roughness:.23,envMapIntensity:.8});
  add('brass',{color:0xbba579,metalness:.88,roughness:.3});
  add('blackMetal',{color:0x242824,metalness:.72,roughness:.35});
  add('whitePaint',{color:0xe4e2d9,roughness:.65});
  add('black',{color:0x111816,roughness:.6});
  add('screen',{color:0x10201e,metalness:.32,roughness:.22});
  add('mirror',{color:0xd9dedb,metalness:1,roughness:.075,envMapIntensity:1.05});
  add('paper',{color:0xcec7ae,roughness:1});
  add('bookRust',{color:0x7b4938,roughness:.92});
  add('bookOlive',{color:0x656b54,roughness:.9});
  add('leaf',{color:0x526047,roughness:.92,side:THREE.DoubleSide});
  add('soil',{color:0x2e271e,roughness:1});
  add('warmLight',{color:0xffe5b2,emissive:0xffd693,emissiveIntensity:2.3,roughness:1,toneMapped:false});
  add('dimLight',{color:0xf7dba8,emissive:0xffcb85,emissiveIntensity:.5,roughness:1});
  materials.glass=new THREE.MeshStandardMaterial({name:'glass',color:0xb4cecb,metalness:.25,roughness:.06,transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide});
  materials.glass.userData.slot='glass';
  return materials;
}

export async function loadMaterialOverrides(materials,renderer) {
  const root=new URL('assets/materials/',document.baseURI);
  const response=await fetch(new URL('manifest.json',root));
  if(!response.ok)throw new Error(`Material manifest: HTTP ${response.status}`);
  const manifest=await response.json(),loader=new THREE.TextureLoader();
  const channels={baseColor:'map',normal:'normalMap',roughness:'roughnessMap',metalness:'metalnessMap',ao:'aoMap'};
  for(const [slot,spec] of Object.entries(manifest.materials??{})) {
    const m=materials[slot];if(!m){console.warn(`Unknown material slot: ${slot}`);continue;}
    const tile=spec.tileSizeMeters??m.userData.tileSizeMeters??[1,1];
    if(!Array.isArray(tile)||tile.length!==2||tile.some(v=>!Number.isFinite(v)||v<=0)){console.warn(`Invalid tileSizeMeters for ${slot}`);continue;}
    for(const [key,target] of Object.entries(channels)) {
      if(!spec[key])continue;
      try {
        const texture=await loader.loadAsync(new URL(spec[key],root).href);
        texture.colorSpace=key==='baseColor'?THREE.SRGBColorSpace:THREE.NoColorSpace;
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/tile[0],1/tile[1]);texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
        texture.channel=0;m[target]=texture;
        if(key==='normal'){m.bumpMap=null;m.normalScale.setScalar(spec.normalScale??1);}
        if(key==='baseColor')m.color.set(0xffffff);
      } catch(error){console.warn(`Keeping fallback ${slot}/${key}: ${error.message}`);}
    }
    if(Number.isFinite(spec.roughnessFactor))m.roughness=THREE.MathUtils.clamp(spec.roughnessFactor,0,1);
    if(Number.isFinite(spec.metalnessFactor))m.metalness=THREE.MathUtils.clamp(spec.metalnessFactor,0,1);
    m.userData.tileSizeMeters=tile;m.needsUpdate=true;
  }
}
