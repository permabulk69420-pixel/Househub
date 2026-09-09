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
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(1);renderer.xr.setFoveation(.65);
  const scene=new THREE.Scene();scene.name='Househub';scene.background=new THREE.Color(0xbbc9cc);
  const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.065,160);camera.position.set(0,1.68,0);
  // A quiet, bright sky keeps the first pass focused on the interior.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(100,24,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x849eae)},horizon:{value:new THREE.Color(0xe9e5d8)},bottom:{value:new THREE.Color(0xaebcbb)}},
    vertexShader:'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec3 vPosition;uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;void main(){float h=normalize(vPosition).y;vec3 c=h>0.0?mix(horizon,top,smoothstep(0.0,0.7,h)):mix(horizon,bottom,smoothstep(0.0,0.4,-h));gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}',
  }));sky.name='Quiet_Sky';scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xcbd7dd,0xa89b83,1.52));
  scene.add(new THREE.AmbientLight(0xffe5c5,.23));
  const sun=new THREE.DirectionalLight(0xffedcf,3.4);sun.name='Window_Daylight';sun.position.set(-12,9,-11);sun.target.position.set(-2,0,0);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.camera.near=.1;sun.shadow.camera.far=45;sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;sun.shadow.radius=3;
  // Two shadowless local lights add practical-light warmth. All shadows are cached.
  const kitchenGlow=new THREE.PointLight(0xffd5a0,15,7,2);kitchenGlow.position.set(-4.8,2.35,4.5);scene.add(kitchenGlow);
  const suiteGlow=new THREE.PointLight(0xffd5a0,9,7,2);suiteGlow.position.set(6.0,2.6,-2.6);scene.add(suiteGlow);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=new RoomEnvironment();
  const initialEnvironment=pmrem.fromScene(environment,.04);scene.environment=initialEnvironment.texture;scene.environmentIntensity=.64;environment.dispose();
  const materials=createMaterials(renderer);
  try{await loadMaterialOverrides(materials,renderer);}catch(error){console.warn(error.message);}
  const apartment=buildApartment(materials);scene.add(apartment.root);addContactShadows(apartment);
  const navigation=new Navigation({renderer,camera,scene,colliders:apartment.colliders,canvas});
  // A static reflection probe captures the finished apartment once, before entering VR.
  const cubeTarget=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const probe=new THREE.CubeCamera(.1,110,cubeTarget);probe.position.set(-2.2,1.55,-1.5);probe.update(renderer,scene);
  const reflectedEnvironment=pmrem.fromCubemap(cubeTarget.texture);scene.environment=reflectedEnvironment.texture;scene.environmentIntensity=.76;
  initialEnvironment.dispose();cubeTarget.dispose();pmrem.dispose();
  // Updating map content never requires rendering the static scene's shadows again.
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
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
      await renderer.xr.setSession(xrSession);renderer.xr.setFoveation(.65);vrButton.textContent='Exit VR';
    }catch(error){xrSession=null;notify(`VR could not start: ${error.message}`);}
  });
}

start().catch(error=>{console.error(error);document.querySelector('#loading p').textContent='The apartment could not open.';notify(`${error.message}. Try reloading this page.`);});
