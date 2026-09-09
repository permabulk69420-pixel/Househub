import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Closed, smooth upholstery; folds are a few millimetres, not changes to the silhouette.
export function cushionGeometry(w,h,d,{radius=.07,bulge=.025,segments=6}={}) {
  let g=new RoundedBoxGeometry(w,h,d,segments,Math.min(radius,h*.47,w*.25,d*.25));
  const p=g.attributes.position,n=g.attributes.normal;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),ny=n.getY(i),fx=Math.max(0,1-(2*x/w)**2),fz=Math.max(0,1-(2*z/d)**2);
    const lift=bulge*fx*fz*Math.max(0,ny);
    p.setY(i,p.getY(i)+lift);
    if(ny>.1){const nn=new THREE.Vector3(n.getX(i)+bulge*8*x/(w*w)*fz,ny,n.getZ(i)+bulge*8*z/(d*d)*fx).normalize();n.setXYZ(i,nn.x,nn.y,nn.z);}
  }
  g=mergeVertices(g,1e-5);g.computeBoundingBox();return g;
}

// A solid curved backrest. Cross sections form a softly rounded panel with closed ends.
// It curves around the sitter, and reclines in the furniture's own local frame.
export function backrestGeometry({width=.85,height=.46,thickness=.12,wrap=.18,lean=.065,segments=64,rings=32}={}) {
  const positions=[],uv=[],indices=[];
  const power=(x,e)=>Math.sign(x)*Math.abs(x)**e;
  for(let i=0;i<=segments;i++) {
    const u=i/segments,t=u*2-1,a=Math.abs(t),cap=a>.86?Math.sqrt(Math.max(.000001,1-((a-.86)/.14)**2)):1;
    for(let j=0;j<rings;j++) {
      const phi=j/rings*Math.PI*2,y=height*.5*power(Math.sin(phi),.43)*cap,off=thickness*.5*power(Math.cos(phi),.5)*cap;
      const x=t*width*.5,curve=wrap*(1-t*t),slope=-4*wrap*t/width,nn=new THREE.Vector3(-slope,0,1).normalize();
      positions.push(x+off*nn.x,y,curve+lean*(y/height+.5)+off*nn.z);
      uv.push(u*width,j/rings*(2*height+2*thickness));
    }
  }
  for(let i=0;i<segments;i++)for(let j=0;j<rings;j++){const a=i*rings+j,b=i*rings+(j+1)%rings,c=(i+1)*rings+j,d=(i+1)*rings+(j+1)%rings;indices.push(a,c,b,b,c,d);}
  for(const end of [0,segments]) {
    const center=positions.length/3;positions.push(end===0?-width/2:width/2,0,lean*.5);uv.push(end===0?0:width,height);
    for(let j=0;j<rings;j++){const a=end*rings+j,b=end*rings+(j+1)%rings;indices.push(...(end===0?[center,b,a]:[center,a,b]));}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);
  orientOutwards(g);g.computeVertexNormals();return g;
}

export function orientOutwards(g) {
  const p=g.attributes.position,a=g.index.array;let volume=0;
  for(let i=0;i<a.length;i+=3){const x=a[i],y=a[i+1],z=a[i+2];volume+=p.getX(x)*(p.getY(y)*p.getZ(z)-p.getZ(y)*p.getY(z))+p.getY(x)*(p.getZ(y)*p.getX(z)-p.getX(y)*p.getZ(z))+p.getZ(x)*(p.getX(y)*p.getY(z)-p.getY(y)*p.getX(z));}
  if(volume<0)for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}
}

export function roundedRectanglePoints(w,d,r,y,steps=12) {
  const points=[];
  for(const [cx,cz,start] of [[w/2-r,d/2-r,0],[-w/2+r,d/2-r,Math.PI/2],[-w/2+r,-d/2+r,Math.PI],[w/2-r,-d/2+r,Math.PI*1.5]]) {
    for(let i=0;i<=steps;i++){const a=start+i/steps*Math.PI/2;points.push([cx+Math.cos(a)*r,y,cz+Math.sin(a)*r]);}
  }
  points.push(points[0]);return points;
}

// Thick cloth surface with a continuous draped skirt, used on the bed and sofa.
export function drapedClothGeometry(w,d,y,{drop=.27,folds=.014,segments=60}={}) {
  const p=[],uv=[],idx=[],n=segments;
  // A rounded square parameterisation gives a flat centre and a hanging perimeter.
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++) {
    const u=i/n*2-1,v=j/n*2-1,edge=Math.max(Math.abs(u),Math.abs(v)),skirt=THREE.MathUtils.smoothstep(edge,.79,1);
    const x=u*w/2,z=v*d/2,wrinkle=folds*(Math.sin(u*24+v*3)+.45*Math.sin(v*31-u*5))*(.25+.75*edge);
    p.push(x,y-drop*skirt+wrinkle,z);uv.push((u+1)*w/2,(v+1)*d/2);
  }
  const layer=p.length/3;for(let i=0;i<layer;i++){p.push(p[i*3],p[i*3+1]-.008,p[i*3+2]);uv.push(uv[i*2],uv[i*2+1]);}
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d,a+layer,b+layer,c+layer,b+layer,d+layer,c+layer);}
  const edge=[];for(let i=0;i<=n;i++)edge.push(i);for(let j=1;j<=n;j++)edge.push(j*(n+1)+n);for(let i=n-1;i>=0;i--)edge.push(n*(n+1)+i);for(let j=n-1;j>0;j--)edge.push(j*(n+1));
  for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];idx.push(a,b,a+layer,b,b+layer,a+layer);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);orientOutwards(g);g.computeVertexNormals();return g;
}

export function archLintelGeometry(width,depth,spring,rise,top,segments=80) {
  const p=[],uv=[],idx=[];
  for(let i=0;i<=segments;i++){const x=(i/segments-.5)*width,lo=spring+rise*Math.sqrt(Math.max(0,1-(2*x/width)**2));for(const [y,z] of [[lo,-depth/2],[top,-depth/2],[lo,depth/2],[top,depth/2]]){p.push(x,y,z);uv.push(x,y);}}
  for(let i=0;i<segments;i++){const a=i*4,b=a+4;idx.push(a,b,a+1,b,b+1,a+1,a+2,a+3,b+2,b+2,a+3,b+3,a,a+2,b,b,a+2,b+2,a+1,b+1,a+3,a+3,b+1,b+3);}
  idx.push(0,1,2,2,1,3);const e=segments*4;idx.push(e,e+2,e+1,e+1,e+2,e+3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);orientOutwards(g);g.computeVertexNormals();return g;
}

// A rounded plan with a small edge bevel: corner radius is independent of thickness.
export function slabGeometry(w,d,h,r=.2) {
  const s=new THREE.Shape(),x=w/2,y=d/2;
  r=Math.min(r,x-.001,y-.001);
  s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);
  s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);
  s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
  const bevel=Math.min(.012,h*.16),g=new THREE.ExtrudeGeometry(s,{depth:h-2*bevel,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:20});
  g.rotateX(-Math.PI/2);g.translate(0,-h/2+bevel,0);return g;
}
