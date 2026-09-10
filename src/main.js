import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMaterials,loadMaterialOverrides } from './materials.js';
import { buildApartment,addContactShadows,roomAt,VIEWS } from './apartment.js';
import { Navigation } from './navigation.js';
import './style.css';

const canvas=document.querySelector('#scene'),message=document.querySelector('#message');
function notify(text) {message.textContent=text;message.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>{message.hidden=true;},9000);}

async function start() {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(1);renderer.xr.setFoveation(.45);
  const scene=new THREE.Scene();scene.name='Househub';scene.background=new THREE.Color(0x3b4657);
  const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.065,160);camera.position.set(0,1.68,0);
  // Static golden-hour/twilight sky: cool upper sky, peach horizon and a warm north-west sunset glow.
  const sunsetDir=new THREE.Vector3(-.68,.05,-.73).normalize();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(100,24,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms:{
      top:{value:new THREE.Color(0x3b4b68)},horizon:{value:new THREE.Color(0xe6ad7b)},bottom:{value:new THREE.Color(0x69717d)},
      sunset:{value:new THREE.Color(0xffa05f)},sunsetDir:{value:sunsetDir},
    },
    vertexShader:'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec3 vPosition;uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;uniform vec3 sunset;uniform vec3 sunsetDir;void main(){vec3 d=normalize(vPosition);float h=d.y;vec3 c=h>0.0?mix(horizon,top,smoothstep(0.0,0.72,h)):mix(horizon,bottom,smoothstep(0.0,0.35,-h));float toward=max(dot(d,normalize(sunsetDir)),0.0);float band=1.0-smoothstep(0.04,0.32,abs(h));float glow=pow(toward,4.0)*band;float core=pow(toward,48.0)*band;c=mix(c,sunset,glow*.55);c+=sunset*core*.30;gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}',
  }));sky.name='Golden_Hour_Sky';scene.add(sky);
  scene.add(new THREE.HemisphereLight(0x71839f,0x6a5548,.82));
  scene.add(new THREE.AmbientLight(0xffd1ad,.14));
  // Low north-west sun pushes long warm light through the north/west glazing without adding any dynamic-light cost.
  const sun=new THREE.DirectionalLight(0xffaa72,4.0);sun.name='Low_Sunset';sun.position.set(-30,5.5,-24);sun.target.position.set(-2,1,-2);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;sun.shadow.camera.near=.1;sun.shadow.camera.far=75;sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;sun.shadow.radius=3;
  // Four static practical lights provide warm local falloff; the directional shadow is cached.
  for(const [name,x,y,z,power,reach] of [
    ['Kitchen_Pendant',-9.3,2.75,3.1,28,10],['Dining_Pendant',-.2,2.78,3.65,20,9],
    ['Suite_Cove',8.7,2.95,-6.4,18,9],['Bath_Cove',8.5,2.95,7.5,20,9],
  ]){const glow=new THREE.PointLight(0xffd5a0,power,reach,2);glow.name=name;glow.position.set(x,y,z);scene.add(glow);}
  const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
  const initialEnvironment=pmrem.fromScene(environment,.04);scene.environment=initialEnvironment.texture;scene.environmentIntensity=.64;environment.dispose();
  const materials=createMaterials(renderer);
  try{await loadMaterialOverrides(materials,renderer);}catch(error){console.warn(error.message);}
  const apartment=buildApartment(materials);scene.add(apartment.root);addContactShadows(apartment);
  const navigation=new Navigation({renderer,camera,scene,colliders:apartment.colliders,canvas});
  // Cache the directional shadow before any cube captures, so startup does not redraw it per face.
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  function captureEnvironment(position){
    const cubeTarget=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
    const probe=new THREE.CubeCamera(.1,110,cubeTarget);probe.position.fromArray(position);probe.update(renderer,scene);
    const result=pmrem.fromCubemap(cubeTarget.texture);cubeTarget.dispose();return result;
  }
  // Separate static probes keep the suite and bathroom reflections inside their own rooms.
  const reflectedEnvironment=captureEnvironment([-1.6,1.7,-5.1]);
  scene.environment=reflectedEnvironment.texture;scene.environmentIntensity=.76;initialEnvironment.dispose();
  for(const [zone,position] of [['bedroom',[8.4,1.7,-6.4]],['bathroom',[7.7,1.75,8.0]]]){
    const mirrors=apartment.root.children.filter(o=>o.isMesh&&o.userData.zone===zone&&o.userData.materialSlot==='mirror');
    mirrors.forEach(o=>{o.visible=false;});const local=captureEnvironment(position);mirrors.forEach(o=>{o.visible=true;});
    for(const mesh of apartment.root.children){if(!mesh.isMesh||mesh.userData.zone!==zone)continue;
      mesh.material=mesh.material.clone();mesh.material.envMap=local.texture;mesh.material.needsUpdate=true;
    }
  }
  pmrem.dispose();
  const url=new URL(location.href),view=VIEWS[url.searchParams.get('view')];
  if(view){navigation.rig.position.set(0,0,0);navigation.rig.rotation.y=0;camera.position.fromArray(view.position);camera.lookAt(...view.target);}
  if(url.searchParams.has('clean'))document.querySelector('#hud').hidden=true;
  if(url.searchParams.has('clean'))document.querySelector('#touch-controls').hidden=true;
  const statsElement=url.searchParams.has('stats')?document.createElement('div'):null;
  if(statsElement){statsElement.style.cssText='position:fixed;top:24px;right:24px;padding:8px 12px;color:#fff;background:#111b;font:12px monospace;pointer-events:none';document.body.append(statsElement);}
  let previous=performance.now(),lastInfo=0,frames=0;
  renderer.setAnimationLoop(now=>{
    const dt=(now-previous)/1000;previous=now;navigation.update(dt);renderer.render(scene,camera);frames++;
    if(now-lastInfo>1000){const position=navigation.headPosition();document.querySelector('#room-name').textContent=roomAt(position.x,position.z);
      if(statsElement&&!renderer.xr.isPresenting)statsElement.textContent=`${Math.round(frames*1000/(now-lastInfo))} fps · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles/1000).toFixed(0)}k triangles`;
      const state={ready:true,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,sourceMeshes:apartment.stats.sourceMeshes,room:roomAt(position.x,position.z),position:position.toArray(),xr:renderer.xr.isPresenting};
      // Expose diagnostics as inspectable DOM data, with no rendering objects on window.
      canvas.dataset.diagnostics=JSON.stringify(state);frames=0;lastInfo=now;
    }
  });
  const onResize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};window.addEventListener('resize',onResize);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();notify('The graphics session was interrupted. Reload to reopen the apartment.');renderer.setAnimationLoop(null);});
  document.querySelector('#loading').classList.add('done');setTimeout(()=>{document.querySelector('#loading').hidden=true;},800);
  const panel=document.querySelector('#settings'),toggle=document.querySelector('#settings-toggle');
  const close=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');};
  toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});document.querySelector('#settings-close').addEventListener('click',close);
  window.addEventListener('keydown',event=>{if(event.code==='Escape')close();});
  const vrButton=document.querySelector('#vr');let xrSession=null;
  try{
    const available=await navigator.xr?.isSessionSupported('immersive-vr');
    if(available){vrButton.disabled=false;vrButton.textContent='Enter VR';}
    else {vrButton.textContent='Open on Quest';vrButton.title='Open this page in Meta Quest Browser to enter VR.';}
  }catch{vrButton.textContent='Open on Quest';}
  vrButton.addEventListener('click',async()=>{
    if(xrSession){await xrSession.end();return;}
    try{
      close();xrSession=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor'],optionalFeatures:['bounded-floor']});
      xrSession.addEventListener('end',()=>{xrSession=null;vrButton.textContent='Enter VR';},{once:true});
      await renderer.xr.setSession(xrSession);renderer.xr.setFoveation(.45);vrButton.textContent='Exit VR';
    }catch(error){xrSession=null;notify(`VR could not start: ${error.message}`);}
  });
}

start().catch(error=>{console.error(error);document.querySelector('#loading p').textContent='The apartment could not open.';notify(`${error.message}. Try reloading this page.`);});
