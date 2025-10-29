/* main.js v0.4 — Global THREE.js (for GitHub Pages) */

// UI refs
const moneyEl = document.getElementById('money-amt');
const repEl = document.getElementById('rep-amt');
const logEl = document.getElementById('log');
const stageEl = document.getElementById('trip-stage');
const startBtn = document.getElementById('start-trip');
const pauseBtn = document.getElementById('pause-trip');
const splash = document.getElementById('splash');

function log(msg){ const d=document.createElement('div'); d.textContent=msg; logEl.prepend(d); }

// Scene setup
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x071018, 0.002);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth/(window.innerHeight-172), 0.1, 2000);
camera.position.set(0,1.6,0);

function resize(){
  renderer.setSize(window.innerWidth, window.innerHeight - 172);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xfff0cc, 0.6);
dir.position.set(5,10,2);
scene.add(dir);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(800,800),
  new THREE.MeshStandardMaterial({ color:0x071217 })
);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Bus interior (procedural)
const bus = new THREE.Group();
(function buildInterior(){ 
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.1,8.2), new THREE.MeshStandardMaterial({ color:0x0b1220 }));
  roof.position.y = 2.2; bus.add(roof);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.1,8.2), new THREE.MeshStandardMaterial({ color:0x161b20 }));
  floor.position.y = 0.0; bus.add(floor);
  const seatMat = new THREE.MeshStandardMaterial({ color:0x223344 });
  for(let i=0;i<4;i++){
    const z = -2.4 + i*1.6;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,1.4), seatMat); left.position.set(-0.9,0.6,z); bus.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,1.4), seatMat); right.position.set(0.9,0.6,z); bus.add(right);
  }
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(3.6,1.2,0.2),
    new THREE.MeshStandardMaterial({ color:0x08101a, transparent:true, opacity:0.6 }));
  windshield.position.set(0,1.3,-3.6); bus.add(windshield);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.0,8),
    new THREE.MeshStandardMaterial({ color:0xcccccc }));
  pole.position.set(-0.1,1.0,-0.5); bus.add(pole);
  scene.add(bus);
})();

// Passengers
const passengers = [];
(function spawnPassengers(){
  const colors = [0xffc857,0xff6b6b,0x6bd4ff,0xa0ff9b];
  const seats=[]; for(let i=0;i<4;i++){ const z=-2.4+i*1.6; seats.push([-0.9,0.6,z]); seats.push([0.9,0.6,z]); }
  const num=Math.floor(4+Math.random()*4);
  for(let i=0;i<num;i++){
    const s=seats[i];
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.18,0.35,4,8),
      new THREE.MeshStandardMaterial({ color:colors[i%colors.length] }));
    body.position.set(s[0],s[1],s[2]);
    passengers.push({mesh:body,paid:false});
    bus.add(body);
  }
})();

// Driver
const driver=new THREE.Mesh(new THREE.BoxGeometry(0.6,1.2,0.6),new THREE.MeshStandardMaterial({ color:0x445566 }));
driver.position.set(-0.9,0.6,-3.8);
bus.add(driver);

// Route logic
const route=[ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-40), new THREE.Vector3(30,0,-80), new THREE.Vector3(-20,0,-120) ];
let routeIndex=0, routeT=0, autoDrive=false, paused=false, totalEarned=0;

function lerpVec(a,b,t){return a.clone().lerp(b,t);}
function updateAutoDrive(dt){
  if(!autoDrive||paused) return;
  const speed=6;
  const p0=route[routeIndex]; const p1=route[(routeIndex+1)%route.length];
  routeT+=dt*(speed/p0.distanceTo(p1));
  if(routeT>=1){ routeT=0; routeIndex=(routeIndex+1)%route.length; onArrive(routeIndex); }
  const pos=lerpVec(p0,p1,routeT);
  bus.position.x=pos.x; bus.position.z=pos.z;
  const dir=p1.clone().sub(p0).normalize(); const angle=Math.atan2(dir.x,-dir.z); bus.rotation.y=angle;
  stageEl.textContent='Stage: '+(['Ambassadeur','Kencom','Afya Centre','Railways'][routeIndex]||'-');
}

function onArrive(idx){
  paused=true; let earned=0;
  passengers.forEach(p=>{ if(!p.paid){ const pay=20+Math.floor(Math.random()*40); earned+=pay; p.paid=true; } });
  totalEarned+=earned; moneyEl.textContent=Math.round(totalEarned); repEl.textContent=Math.round((totalEarned/100));
  log('Arrived at stop: '+(['Ambassadeur','Kencom','Afya Centre','Railways'][idx]||'')+' — Collected KES '+earned);
  setTimeout(()=>{ paused=false; if(idx===route.length-1){ autoDrive=false; showSummary(); } },1800);
}

function showSummary(){
  const overlay=document.getElementById('trip-summary');
  overlay.innerHTML='<div class="panel"><h2>Trip Complete</h2><p>Total earned: KES '+totalEarned+'</p><p>Passengers: '+passengers.length+'</p><button id="close-summary">Close</button></div>';
  overlay.classList.remove('hidden');
  document.getElementById('close-summary').addEventListener('click',()=>{ overlay.classList.add('hidden'); totalEarned=0; moneyEl.textContent='0'; repEl.textContent='0'; });
}

// Camera controls
let yaw=0,pitch=0,isPointerDown=false,last={x:0,y:0};
canvas.addEventListener('pointerdown',e=>{isPointerDown=true;canvas.setPointerCapture(e.pointerId);last.x=e.clientX;last.y=e.clientY;});
window.addEventListener('pointerup',()=>{isPointerDown=false;});
window.addEventListener('pointermove',e=>{if(!isPointerDown)return;const dx=e.clientX-last.x;const dy=e.clientY-last.y;last.x=e.clientX;last.y=e.clientY;yaw-=dx*0.002;pitch=Math.max(-0.4,Math.min(0.4,pitch-dy*0.002));});
function updateCamera(){
  const eyeLocal=new THREE.Vector3(0.9,1.2,2.8);
  const eyeWorld=eyeLocal.applyMatrix4(bus.matrixWorld);
  camera.position.lerp(eyeWorld,0.25);
  const look=new THREE.Vector3(Math.sin(yaw),pitch,-1).applyMatrix4(bus.matrixWorld);
  camera.lookAt(look);
}

// UI
startBtn.addEventListener('click',()=>{if(!autoDrive){autoDrive=true;routeIndex=0;routeT=0;totalEarned=0;}});
pauseBtn.addEventListener('click',()=>{paused=!paused;});

// Splash fade
setTimeout(()=>{if(splash){splash.style.opacity='0';setTimeout(()=>{splash.style.display='none';},1000);}},2000);

// Animation
const clock=new THREE.Clock();
function animate(){
  const dt=clock.getDelta();
  updateAutoDrive(dt);
  passengers.forEach((p,i)=>{p.mesh.rotation.y=Math.sin(performance.now()*0.001+i)*0.05;});
  updateCamera();
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
resize();
animate();
