/* main.js v0.5 — Driver controls + Conductor AI (procedural detailed bus) */
/* Uses global THREE from CDN (no module imports) */

/* ----------------- UI helpers ----------------- */
const moneyEl = document.getElementById('money-amt');
const repEl = document.getElementById('rep-amt');
const roleNameEl = document.getElementById('role-name');
const logEl = document.getElementById('log');
const stageNameEl = document.getElementById('stage-name');
const startBtn = document.getElementById('start-trip');
const pauseBtn = document.getElementById('pause-trip');
const toggleCamBtn = document.getElementById('toggle-camera');

function log(msg){ const d=document.createElement('div'); d.textContent=msg; logEl.prepend(d); }

/* ----------------- Basic scene ----------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.FogExp2(0x071018, 0.0015);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / (window.innerHeight - 144), 0.1, 2000);
camera.position.set(0,6,10);

function resize(){ renderer.setSize(window.innerWidth, window.innerHeight - 144); camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);

/* lights */
const hemi = new THREE.HemisphereLight(0xffffff, 0x101820, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5d0, 0.7); sun.position.set(10,20,10); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);

/* ground & simple road */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), new THREE.MeshStandardMaterial({ color:0x081018 }));
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

/* quick road strip */
const roadMat = new THREE.MeshStandardMaterial({ color:0x11161e });
const road = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 800), roadMat);
road.position.set(0, 0.05, -350);
road.receiveShadow = true;
scene.add(road);

/* roadside markers / low poly buildings for feel */
for(let i=0;i<30;i++){
  const bw = 6 + Math.random()*18;
  const bh = 6 + Math.random()*40;
  const b = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bw), new THREE.MeshStandardMaterial({ color: 0x162a36 }));
  b.position.set((Math.random()>0.5?1:-1)*(15+Math.random()*40), bh/2 - 0.5, -40 - i*20 - Math.random()*10);
  scene.add(b);
}

/* ----------------- Route check points ----------------- */
const routeNames = ['Ambassadeur','Kencom','Afya Centre','Railways','Westlands'];
const routePoints = [
  new THREE.Vector3(0,0,0),
  new THREE.Vector3(0,0,-80),
  new THREE.Vector3(0,0,-180),
  new THREE.Vector3(0,0,-300),
  new THREE.Vector3(0,0,-420)
];
for(let i=0;i<routePoints.length;i++){
  const rp = routePoints[i];
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.2,12), new THREE.MeshStandardMaterial({ color:0xffb13b }));
  marker.position.copy(rp).add(new THREE.Vector3(0,0.1,-20));
  marker.rotation.x = Math.PI/2;
  scene.add(marker);
}

/* ----------------- Bus (procedural, slightly more detailed) ----------------- */
const bus = new THREE.Group();
bus.position.set(0,0,0);
scene.add(bus);

function buildDetailedBus(){
  // body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5500, metalness:0.2, roughness:0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4,1.6,10), bodyMat);
  body.position.set(0,1.0,0);
  body.castShadow=true; body.receiveShadow=true; bus.add(body);

  // cabin roof/curvature - small box
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.05,0.8,2.6), new THREE.MeshStandardMaterial({ color:0xff6a2b }));
  roof.position.set(0,1.6,-2.6);
  bus.add(roof);

  // windows - tinted
  const winMat = new THREE.MeshStandardMaterial({ color:0x06121a, transparent:true, opacity:0.6 });
  for(let i=0;i<3;i++){
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.6,2.2), winMat);
    w.position.set(1.95,1.1,-3 + i*2.2);
    w.rotation.y = Math.PI/2;
    bus.add(w);
    const w2 = w.clone();
    w2.position.x = -1.95;
    bus.add(w2);
  }

  // windshield
  const wf = new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.0), new THREE.MeshStandardMaterial({ color:0x06121a, transparent:true, opacity:0.55 }));
  wf.position.set(0,1.5,-5.1);
  wf.rotation.y = 0; wf.rotation.x = 0; bus.add(wf);

  // headlights & bumpers
  const headMat = new THREE.MeshStandardMaterial({ color:0xffffcc, emissive:0xfff4cc, emissiveIntensity:0.02 });
  const hl = new THREE.Mesh(new THREE.CircleGeometry(0.25,16), headMat); hl.position.set(-1.25,0.8,5.1); hl.rotation.y = Math.PI; bus.add(hl);
  const hr = hl.clone(); hr.position.x = 1.25; bus.add(hr);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(4.2,0.2,0.4), new THREE.MeshStandardMaterial({ color:0x0f1a22 })); bumper.position.set(0,0.5,5.5); bus.add(bumper);

  // wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color:0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.5,0.5,0.6,18);
  [[-1.7,0.5,3.3],[1.7,0.5,3.3],[-1.7,0.5,-3.3],[1.7,0.5,-3.3]].forEach(p=>{
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI/2; w.position.set(p[0],p[1],p[2]); bus.add(w);
  });

  // interior row seats (visible in cockpit)
  const seatMat = new THREE.MeshStandardMaterial({ color:0x223344 });
  for(let r=0;r<4;r++){
    const z = -2.8 + r*1.6;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.55,1.2), seatMat); left.position.set(-0.9,0.5,z); bus.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.55,1.2), seatMat); right.position.set(0.9,0.5,z); bus.add(right);
  }

  // driver seat and wheel
  const dseat = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.9,0.6), new THREE.MeshStandardMaterial({ color:0x2e393f }));
  dseat.position.set(-0.9,0.6,-4.0); bus.add(dseat);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.25,0.06,8,16), new THREE.MeshStandardMaterial({ color:0x2b2b2b }));
  wheel.position.set(-0.6,1.15,-3.6); wheel.rotation.x = Math.PI/2; bus.add(wheel);

  // small sign text (canvas texture) on back of bus
  const canvasTxt = document.createElement('canvas'); canvasTxt.width=512; canvasTxt.height=128;
  const ctx = canvasTxt.getContext('2d'); ctx.fillStyle="#FFFFFF"; ctx.font="36px sans-serif"; ctx.fillText("NGANYA",40,76);
  const txtTex = new THREE.CanvasTexture(canvasTxt);
  const txtMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.55), new THREE.MeshBasicMaterial({ map:txtTex }));
  txtMesh.position.set(0,1.05,3.9); txtMesh.rotation.y = Math.PI; bus.add(txtMesh);
}
buildDetailedBus();

/* ----------------- Bus physics & player driving ----------------- */
const driverState = {
  role: 'driver', // driver player
  speed: 0,       // units/sec
  maxSpeed: 18,
  accel: 10,
  brake: 18,
  turnSpeed: 1.8,
  steering: 0
};

let keys = {};
window.addEventListener('keydown', e=> { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e=> { keys[e.key.toLowerCase()] = false; });

function updateDriving(dt){
  // acceleration/brake
  if(keys['w'] || keys['arrowup']){ driverState.speed += driverState.accel * dt; }
  else if(keys['s'] || keys['arrowdown']){ driverState.speed -= driverState.brake * dt; }
  else { // natural friction
    driverState.speed -= Math.sign(driverState.speed) * 6 * dt;
  }
  driverState.speed = Math.max(-6, Math.min(driverState.maxSpeed, driverState.speed));

  // steering only effective when moving
  const steerEffect = Math.max(0, Math.min(1, Math.abs(driverState.speed)/driverState.maxSpeed));
  if(keys['a'] || keys['arrowleft']) driverState.steering = Math.min(1, driverState.steering + dt*4);
  else if(keys['d'] || keys['arrowright']) driverState.steering = Math.max(-1, driverState.steering - dt*4);
  else driverState.steering = driverState.steering * Math.pow(0.8, dt*60);

  // apply rotation
  const turnAngle = driverState.steering * driverState.turnSpeed * (driverState.speed/driverState.maxSpeed) * dt;
  bus.rotation.y += turnAngle;

  // move forward relative to bus orientation
  const forward = new THREE.Vector3(Math.sin(bus.rotation.y), 0, -Math.cos(bus.rotation.y));
  bus.position.addScaledVector(forward, driverState.speed * dt);
}

/* ----------------- Conductor AI (autocollect) ----------------- */
let money = 0;
let rep = 0;

function conductorCollectAtStop(){
  // when the bus is stopped near a route point, conductor collects fares from any unpaid passengers
  const unpaid = passengers.filter(p => !p.paid);
  let collected = 0;
  unpaid.forEach((p) => {
    const fare = 30 + Math.floor(Math.random()*40);
    collected += fare;
    p.paid = true;
  });
  if(collected>0){
    money += collected;
    rep += Math.floor(collected/100);
    moneyEl.textContent = Math.round(money);
    repEl.textContent = Math.round(rep);
    log(`Conductor collected KES ${collected} at stop`);
  } else {
    log('Conductor: nobody left to collect here');
  }
}

/* ----------------- Passengers (procedural) ----------------- */
const passengers = [];
(function populatePassengers(){
  const colors = [0xffc857, 0xff6b6b, 0x6bd4ff, 0xa0ff9b, 0xdab6ff];
  const seatPositions = [];
  for(let i=0;i<4;i++){ const z = -2.8 + i*1.6; seatPositions.push([-0.9,0.7,z]); seatPositions.push([0.9,0.7,z]); }
  const count = 6 + Math.floor(Math.random()*2);
  for(let i=0;i<count;i++){
    const pos = seatPositions[i];
    const pmesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18,0.35,4,8), new THREE.MeshStandardMaterial({ color: colors[i%colors.length] }));
    pmesh.position.set(pos[0], pos[1], pos[2]);
    passengers.push({ mesh: pmesh, paid:false });
    bus.add(pmesh);
  }
})();

/* ----------------- Checkpoint logic ----------------- */
let currentCheckpoint = 0;
let paused = false;
let autoRouteActive = false;

function checkArrival(){
  // if bus near routePoints[currentCheckpoint] and speed low -> trigger stop
  const cp = routePoints[currentCheckpoint];
  const dist = new THREE.Vector3(bus.position.x,0,bus.position.z).distanceTo(new THREE.Vector3(cp.x,0,cp.z));
  if(dist < 6 && Math.abs(driverState.speed) < 0.6){
    // arrived
    log(`Arrived at stop: ${routeNames[currentCheckpoint]}`);
    stageNameEl.textContent = routeNames[currentCheckpoint];
    conductorCollectAtStop();
    // pause for 2 seconds
    paused = true;
    setTimeout(()=>{ paused = false; currentCheckpoint = Math.min(routePoints.length-1, currentCheckpoint+1); if(currentCheckpoint === routePoints.length) { autoRouteActive = false; showTripEnd(); } }, 2000);
    // small rep gain
    rep += 0.1;
    repEl.textContent = Math.round(rep);
  }
}

function showTripEnd(){
  log("Trip complete — returning to idle");
}

/* ----------------- Camera system (chase vs cockpit) ----------------- */
let cameraMode = 'chase'; // 'chase' or 'cockpit'
function setCameraMode(m){
  cameraMode = m;
  toggleCamBtn.textContent = (cameraMode === 'chase') ? 'Switch: Cockpit' : 'Switch: Chase';
}
setCameraMode('chase');
toggleCamBtn.addEventListener('click', ()=> setCameraMode(cameraMode === 'chase' ? 'cockpit' : 'chase'));

/* chase camera */
const chaseOffset = new THREE.Vector3(0,3.0,10.0);
function updateCamera(dt){
  if(cameraMode === 'chase'){
    const desired = chaseOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), bus.rotation.y).add(bus.position);
    camera.position.lerp(desired, 0.08);
    camera.lookAt(bus.position.clone().add(new THREE.Vector3(0,1.2,0)));
  } else {
    // cockpit: place near driver seat inside bus
    const eyeLocal = new THREE.Vector3(-0.8,1.3,-3.4); // driver seat inside mesh coordinates
    const eyeWorld = eyeLocal.clone().applyMatrix4(bus.matrixWorld);
    camera.position.lerp(eyeWorld, 0.2);

    // look slightly forward out of windshield
    const lookLocal = new THREE.Vector3(0,1.2,-2.0);
    const lookWorld = lookLocal.clone().applyMatrix4(bus.matrixWorld);
    camera.lookAt(lookWorld);
  }
}

/* ----------------- UI wiring (start/pause) ----------------- */
startBtn.addEventListener('click', ()=>{
  autoRouteActive = true;
  currentCheckpoint = 0;
  log('Route started — you are the driver. Use W/A/S/D or arrows to drive.');
});
pauseBtn.addEventListener('click', ()=>{ autoRouteActive = !autoRouteActive; log('Toggled route run: ' + (autoRouteActive ? 'running' : 'paused')); });

/* ----------------- Helpers ----------------- */
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* ----------------- main loop ----------------- */
const clock = new THREE.Clock();
function animate(){
  const dt = clock.getDelta();

  if(autoRouteActive && !paused){
    // If driver is in control: updateDriving
    updateDriving(dt);

    // simple auto-route assist: if near next checkpoint and speed high, slowly brake
    if(currentCheckpoint < routePoints.length){
      const cp = routePoints[currentCheckpoint];
      const dist = new THREE.Vector3(bus.position.x,0,bus.position.z).distanceTo(new THREE.Vector3(cp.x,0,cp.z));
      if(dist < 18 && driverState.speed > 8){
        // gentle brake assist
        driverState.speed -= Math.min( (driverState.speed - 6) * dt * 1.5, driverState.brake * dt );
      }
    }

    // check arrival only when movement slow-ish
    if(Math.abs(driverState.speed) < 1.2){
      // find nearest checkpoint within threshold
      for(let i=0;i<routePoints.length;i++){
        const cp = routePoints[i];
        const d = new THREE.Vector3(bus.position.x,0,bus.position.z).distanceTo(new THREE.Vector3(cp.x,0,cp.z));
        if(d < 6 && i === currentCheckpoint){
          checkArrival();
          break;
        }
      }
    }
  } else {
    // autopilot paused; small idle bob for bus interior
    driverState.speed *= Math.pow(0.85, dt*60);
  }

  // animate passengers idle movement
  passengers.forEach((p, i)=>{
    p.mesh.rotation.y = Math.sin(performance.now()*0.001 + i) * 0.06;
  });

  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
resize(); animate();
