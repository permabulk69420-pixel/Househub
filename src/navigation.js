import * as THREE from 'three';
import { SPAWN, isWalkable } from './apartment.js';

const up=new THREE.Vector3(0,1,0);
const deadzone=v=>Math.abs(v)<.18?0:Math.sign(v)*(Math.abs(v)-.18)/.82;

export class Navigation {
  constructor({renderer,camera,scene,colliders,canvas}) {
    this.renderer=renderer;this.camera=camera;this.colliders=colliders;this.canvas=canvas;
    this.rig=new THREE.Group();this.rig.name='Player_Floor_Rig';scene.add(this.rig);this.rig.add(camera);
    this.rig.position.set(SPAWN.x,0,SPAWN.z);this.rig.rotation.y=SPAWN.yaw;
    this.keys=new Set();this.speed=1.6;this.turnStyle='smooth';this.snapReady=true;
    this.touchMove=new THREE.Vector2();this.euler=new THREE.Euler(0,0,0,'YXZ');
    this.head=new THREE.Vector3();this.heading=new THREE.Vector3();this.right=new THREE.Vector3();this.q=new THREE.Quaternion();
    this.delta=new THREE.Vector3();this.before=new THREE.Vector3();this.after=new THREE.Vector3();
    this.xrEntryTarget=new THREE.Vector3();this.pendingXRRecenter=false;this.xrEntryYaw=SPAWN.yaw;
    this.controllers=[];this.bindDesktop();this.bindXR(scene);
  }
  headPosition() {this.rig.updateMatrixWorld(true);return this.camera.getWorldPosition(this.head);}
  move(dx,dz) {
    // Small collision steps stop tunnelling, including after a dropped frame.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));dx/=steps;dz/=steps;
    for(let i=0;i<steps;i++) {
      const p=this.headPosition();
      if(isWalkable(this.colliders,p.x+dx,p.z)){this.rig.position.x+=dx;p.x+=dx;}
      if(isWalkable(this.colliders,p.x,p.z+dz))this.rig.position.z+=dz;
    }
  }
  rotate(angle) {
    this.before.copy(this.headPosition());this.rig.rotation.y+=angle;
    this.after.copy(this.headPosition());this.rig.position.x+=this.before.x-this.after.x;this.rig.position.z+=this.before.z-this.after.z;
  }
  reset() {
    if(this.renderer.xr.isPresenting){const yaw=this.euler.setFromQuaternion(this.camera.getWorldQuaternion(this.q)).y;this.rotate(SPAWN.yaw-yaw);const p=this.headPosition();this.rig.position.x+=SPAWN.x-p.x;this.rig.position.z+=SPAWN.z-p.z;}
    else {this.rig.rotation.y=SPAWN.yaw;this.rig.position.set(SPAWN.x,0,SPAWN.z);this.camera.position.set(0,1.68,0);this.camera.rotation.set(0,0,0);}
  }
  look(dx,dy) {
    if(this.renderer.xr.isPresenting)return;
    this.euler.setFromQuaternion(this.camera.quaternion);this.euler.y-=dx*.0024;this.euler.x=THREE.MathUtils.clamp(this.euler.x-dy*.0024,-1.25,1.25);this.camera.quaternion.setFromEuler(this.euler);
  }
  bindDesktop() {
    window.addEventListener('keydown',event=>{
      if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft'].includes(event.code)){this.keys.add(event.code);event.preventDefault();}
    });
    window.addEventListener('keyup',event=>this.keys.delete(event.code));
    window.addEventListener('blur',()=>{this.keys.clear();this.touchMove.set(0,0);});
    document.addEventListener('pointerlockchange',()=>{
      const locked=document.pointerLockElement===this.canvas;document.body.classList.toggle('walking',locked);document.querySelector('#crosshair').hidden=!locked;
      if(!locked)this.keys.clear();
    });
    document.addEventListener('mousemove',event=>{if(document.pointerLockElement===this.canvas)this.look(event.movementX,event.movementY);});
    let pointer=null,lastX=0,lastY=0;
    this.canvas.addEventListener('pointerdown',event=>{if(this.renderer.xr.isPresenting)return;pointer=event.pointerId;lastX=event.clientX;lastY=event.clientY;this.canvas.setPointerCapture(pointer);});
    this.canvas.addEventListener('pointermove',event=>{if(event.pointerId!==pointer||document.pointerLockElement===this.canvas)return;this.look(event.clientX-lastX,event.clientY-lastY);lastX=event.clientX;lastY=event.clientY;});
    const release=()=>{pointer=null;};this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);
    const touch=matchMedia('(pointer:coarse)').matches,pad=document.querySelector('#move-pad');
    document.querySelector('#touch-controls').hidden=!touch;
    let movePointer=null,centerX=0,centerY=0;
    const setTouch=event=>{const x=THREE.MathUtils.clamp((event.clientX-centerX)/36,-1,1),y=THREE.MathUtils.clamp((event.clientY-centerY)/36,-1,1);this.touchMove.set(x,y).clampLength(0,1);pad.firstElementChild.style.transform=`translate(${this.touchMove.x*28}px, ${this.touchMove.y*28}px)`;};
    pad.addEventListener('pointerdown',event=>{movePointer=event.pointerId;const rect=pad.getBoundingClientRect();centerX=rect.left+rect.width/2;centerY=rect.top+rect.height/2;pad.setPointerCapture(movePointer);setTouch(event);});
    pad.addEventListener('pointermove',event=>{if(event.pointerId===movePointer)setTouch(event);});
    const endTouch=()=>{movePointer=null;this.touchMove.set(0,0);pad.firstElementChild.style.transform='';};pad.addEventListener('pointerup',endTouch);pad.addEventListener('pointercancel',endTouch);
    document.querySelector('#walk').addEventListener('click',()=>{
      if(touch){document.querySelector('#touch-controls').hidden=false;document.querySelector('#hint').textContent='Left pad to walk · Drag the room to look';return;}
      const request=this.canvas.requestPointerLock?.();if(request?.catch)request.catch(()=>{});
    });
    document.querySelector('#turn-style').addEventListener('change',event=>{this.turnStyle=event.target.value;});
    document.querySelector('#move-speed').addEventListener('change',event=>{this.speed=Number(event.target.value);});
    document.querySelector('#reset-position').addEventListener('click',()=>this.reset());
  }
  bindXR(scene) {
    this.renderer.xr.addEventListener('sessionstart',()=>{
      this.xrEntryTarget.copy(this.headPosition());this.xrEntryYaw=this.euler.setFromQuaternion(this.camera.getWorldQuaternion(this.q)).y;this.pendingXRRecenter=true;
      document.exitPointerLock?.();this.keys.clear();this.touchMove.set(0,0);
      // local-floor supplies real eye height. Never add the desktop's 1.68 m twice.
      this.camera.position.set(0,0,0);this.camera.rotation.set(0,0,0);document.body.classList.add('vr');
    });
    this.renderer.xr.addEventListener('sessionend',()=>{
      this.before.copy(this.headPosition());this.rig.position.x=this.before.x;this.rig.position.z=this.before.z;
      this.camera.position.set(0,1.68,0);this.camera.rotation.set(0,0,0);document.body.classList.remove('vr');
      this.pendingXRRecenter=false;
      this.camera.fov=68;this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
      for(const c of this.controllers){c.aiming=false;c.line.visible=false;c.ring.visible=false;}
    });
    for(let i=0;i<2;i++) {
      const ray=this.renderer.xr.getController(i),grip=this.renderer.xr.getControllerGrip(i);this.rig.add(ray);this.rig.add(grip);
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.022,.075,4,10),new THREE.MeshStandardMaterial({color:0x2c342f,roughness:.65}));
      body.rotation.x=-.25;body.position.set(0,-.026,.015);grip.add(body);grip.visible=false;
      ray.addEventListener('connected',()=>{grip.visible=true;});ray.addEventListener('disconnected',()=>{grip.visible=false;state.aiming=false;});
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(40*3),3));
      const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xe3d3ac,transparent:true,opacity:.8,depthTest:true}));line.frustumCulled=false;line.visible=false;scene.add(line);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.16,.009,6,36),new THREE.MeshBasicMaterial({color:0xe3d3ac}));ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
      const state={ray,grip,line,ring,aiming:false,valid:false,target:new THREE.Vector3(),origin:new THREE.Vector3(),direction:new THREE.Vector3(),point:new THREE.Vector3(),previous:new THREE.Vector3()};
      this.controllers.push(state);
      ray.addEventListener('selectstart',()=>{state.aiming=true;});
      ray.addEventListener('selectend',()=>{
        if(state.aiming&&state.valid){const p=this.headPosition();this.rig.position.x+=state.target.x-p.x;this.rig.position.z+=state.target.z-p.z;}
        state.aiming=false;state.valid=false;state.line.visible=false;state.ring.visible=false;
      });
    }
  }
  teleportVisible(x0,z0,x1,z1) {
    const steps=Math.ceil(Math.hypot(x1-x0,z1-z0)/.07);
    for(let i=1;i<=steps;i++) {
      const x=x0+(x1-x0)*i/steps,z=z0+(z1-z0)*i/steps;
      for(const c of this.colliders){if(!/Wall|Divider|Glazing|Glass/.test(c.name))continue;if(x>c.minX-.025&&x<c.maxX+.025&&z>c.minZ-.025&&z<c.maxZ+.025)return false;}
    }
    return true;
  }
  updateTeleport(state) {
    if(!state.aiming){state.line.visible=false;state.ring.visible=false;return;}
    state.ray.getWorldPosition(state.origin);state.ray.getWorldQuaternion(this.q);state.direction.set(0,0,-1).applyQuaternion(this.q).multiplyScalar(5.8);
    const positions=state.line.geometry.attributes.position;let landed=false,count=0;state.previous.copy(state.origin);
    for(let i=0;i<40;i++) {
      const t=i*.045;state.point.copy(state.origin).addScaledVector(state.direction,t);state.point.y-=4.9*t*t;
      if(state.point.y<=.055&&i>0) {
        const alpha=(state.previous.y-.055)/(state.previous.y-state.point.y);state.point.lerpVectors(state.previous,state.point,alpha);landed=true;
      }
      positions.setXYZ(i,state.point.x,state.point.y,state.point.z);count=i+1;
      if(landed)break;state.previous.copy(state.point);
    }
    const head=this.headPosition();
    state.valid=landed&&isWalkable(this.colliders,state.point.x,state.point.z)&&this.teleportVisible(head.x,head.z,state.point.x,state.point.z);
    state.target.copy(state.point);state.line.geometry.setDrawRange(0,count);positions.needsUpdate=true;state.line.visible=true;
    state.line.material.color.setHex(state.valid?0xe3d3ac:0xb87766);state.ring.visible=state.valid;state.ring.position.copy(state.target);state.ring.position.y=.060;
  }
  update(dt) {
    dt=Math.min(dt,.05);let x=0,z=0,turn=0;
    if(this.renderer.xr.isPresenting) {
      // Resolve this frame's tracked pose before collision and pivot-turn calculations.
      // The user camera remains a child of the rig, so subsequent rig changes are live.
      this.rig.updateMatrixWorld(true);this.renderer.xr.updateCamera(this.camera);
      if(this.pendingXRRecenter){
        const yaw=this.euler.setFromQuaternion(this.camera.getWorldQuaternion(this.q)).y;this.rotate(this.xrEntryYaw-yaw);
        const p=this.headPosition();this.rig.position.x+=this.xrEntryTarget.x-p.x;this.rig.position.z+=this.xrEntryTarget.z-p.z;this.pendingXRRecenter=false;
      }
      const session=this.renderer.xr.getSession();
      for(const source of session.inputSources) {
        if(!source.gamepad)continue;const axes=source.gamepad.axes,index=axes.length>=4?2:0;
        if(source.handedness==='left'){x=deadzone(axes[index]??0);z=deadzone(axes[index+1]??0);}
        if(source.handedness==='right')turn=deadzone(axes[index]??0);
      }
      if(this.turnStyle==='smooth'){if(turn)this.rotate(-turn*1.7*dt);}
      else {if(Math.abs(turn)>.65&&this.snapReady){this.rotate(-Math.sign(turn)*Math.PI/6);this.snapReady=false;}if(Math.abs(turn)<.25)this.snapReady=true;}
      this.camera.getWorldQuaternion(this.q);
    } else {
      x=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.touchMove.x;
      z=(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)+this.touchMove.y;
      this.camera.getWorldQuaternion(this.q);
    }
    const length=Math.hypot(x,z);if(length>1){x/=length;z/=length;}
    if(x||z) {
      this.heading.set(0,0,-1).applyQuaternion(this.q);this.heading.y=0;this.heading.normalize();this.right.crossVectors(this.heading,up).normalize();
      const speed=this.speed*(!this.renderer.xr.isPresenting&&this.keys.has('ShiftLeft')?1.5:1);
      this.delta.copy(this.right).multiplyScalar(x).addScaledVector(this.heading,-z).multiplyScalar(speed*dt);this.move(this.delta.x,this.delta.z);
    }
    if(this.renderer.xr.isPresenting)for(const state of this.controllers)this.updateTeleport(state);
  }
}
