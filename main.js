/* main.js v0.6 — Driveable Matatu Edition (realistic acceleration, chase default, sunset) */
/* Uses global THREE (CDN) */

/* UI refs */
const moneyEl = document.getElementById('money-amt');
const repEl = document.getElementById('rep-amt');
const roleNameEl = document.getElementById('role-name');
const logEl = document.getElementById('log');
const stageNameEl = document.getElementById('stage-name');
const startBtn = document.getElementById('start-trip');
const pauseBtn = document.getElementById('pause-trip');
const toggleCamBtn = document.getElementById('toggle-camera');
const splash = document.getElementById('splash');

function log(msg){ const d=document.createElement('div'); d.textContent=msg; logEl.prepend(d); }

/* Scene */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio); renderer.shadowMap.enabled=true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x271833); // sunset mood
scene.fog = new THREE.FogExp2(0x271833, 0.0012);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth/(window.innerHeight-160), 0.1, 2000);
camera.position.set(0,6,12);

function resize(){ renderer.setSize(window.innerWidth, window.innerHeight-160); camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);

/* lighting - sunset */
const hemi = new THREE.HemisphereLight(0xffe9d6, 0x08101a, 0.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffcfa3, 0.8); sun.position.set(40,80,20); sun.castShadow=true; scene.add(sun);

/* ground and road */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000,4000), new THREE.MeshStandardMaterial({ color:0x0c1216 }));
ground.rotation.x = -Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const road = new THREE.Mesh(new THREE.BoxGeometry(12,0.2,2000), new THREE.MeshStandardMaterial({ color:0x101820 }));
road.position.set(0,0.1,-900); road.receiveShadow=true; scene.add(road);

/* roadside simple geometry */
for(let i=0;i<40;i++){
  const b = new THREE.Mesh(new THREE.BoxGeometry(6,6+Math.random()*30,6), new THREE.MeshStandardMaterial({ color:0x0f2230 }));
  b.position.set((Math.random()>0.5?1:-1)*(18+Math.random()*40), (b.geometry.parameters.height/2)-1, -40 - i*40 - Math.random()*20);
  scene.add(b);
}

/* route points and names */
const routeNames = ['Ambassadeur','Kencom','Afya Centre','Railways','Westlands'];
const routePoints = [ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-160), new THREE.Vector3(0,0,-360), new THREE.Vector3(0,0,-640), new THREE.Vector3(0,0,-900) ];
for(let i=0;i<routePoints.length;i++){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.2,12), new THREE.MeshStandardMaterial({ color:0xffb13b }));
  m.position.copy(routePoints[i]).add(new THREE.Vector3(0,0.2,-10));
  m.rotation.x = Math.PI/2; scene.add(m);
}

/* build bus - more detailed procedural */
const bus = new THREE.Group(); bus.position.set(0,0,0); scene.add(bus);
function buildBus(){
  const bodyMat = new THREE.MeshStandardMaterial({ color:0xff5a20, metalness:0.15, roughness:0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2,1.8,11.0), bodyMat); body.position.set(0,1.0,0); body.castShadow=true; bus.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.3,0.8,3.0), new THREE.MeshStandardMaterial({ color:0xff6a2b }));
  roof.position.set(0,1.7,-2.9); bus.add(roof);

  const winMat = new THREE.MeshStandardMaterial({ color:0x07141b, transparent:true, opacity:0.6 });
  for(let i=0;i<3;i++){
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.6,2.4), winMat);
    w.position.set(2.05,1.15,-2.6 + i*2.6); w.rotation.y = Math.PI/2; w.name = 'window'+i; bus.add(w);
    const w2 = w.clone(); w2.position.x = -2.05; bus.add(w2);
  }
  const wf = new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.0), new THREE.MeshStandardMaterial({ color:0x07121a, transparent:true, opacity:0.56 }));
  wf.position.set(0,1.55,-5.2); bus.add(wf);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(4.4,0.26,0.45), new THREE.MeshStandardMaterial({ color:0x0d1b21 }));
  bumper.position.set(0,0.55,5.6); bus.add(bumper);
  const hl = new THREE.Mesh(new THREE.CircleGeometry(0.26,16), new THREE.MeshStandardMaterial({ color:0xffffe0, emissive:0xfff0c0, emissiveIntensity:0.03 }));
  hl.position.set(-1.25,0.85,5.1); hl.rotation.y = Math.PI; bus.add(hl); const hr = hl.clone(); hr.position.x = 1.25; bus.add(hr);
  const wheelGeo = new THREE.CylinderGeometry(0.52,0.52,0.7,20);
  const wheelMat = new THREE.MeshStandardMaterial({ color:0x0b0b0b });
  [[-1.8,0.5,3.9],[1.8,0.5,3.9],[-1.8,0.5,-3.9],[1.8,0.5,-3.9]].forEach(p=>{ const w = new THREE.Mesh(wheelGeo, wheelMat); w.rotation.z = Math.PI/2; w.position.set(p[0],p[1],p[2]); bus.add(w); });
  const seatMat = new THREE.MeshStandardMaterial({ color:0x203040 });
  for(let r=0;r<4;r++){ const z=-2.8 + r*1.8; const l = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.55,1.2), seatMat); l.position.set(-0.95,0.6,z); bus.add(l); const rgt = l.clone(); rgt.position.x = 0.95; bus.add(rgt); }
  const dseat = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.9,0.6), new THREE.MeshStandardMaterial({ color:0x2f373b })); dseat.position.set(-0.9,0.6,-4.4); bus.add(dseat);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26,0.06,8,24), new THREE.MeshStandardMaterial({ color:0x2b2b2b })); wheel.position.set(-0.6,1.12,-3.9); wheel.rotation.x = Math.PI/2; bus.add(wheel);
}
buildBus();

/* window sliding state */
const windowState = { offset:0, dir:1 };

/* passengers */
const passengers = [];
(function populate(){
  const colors = [0xffc857,0xff6b6b,0x6bd4ff,0xa0ff9b,0xdab6ff];
  const seats=[]; for(let i=0;i<4;i++){ const z=-2.8 + i*1.8; seats.push([-0.95,0.65,z]); seats.push([0.95,0.65,z]); }
  const count = 6 + Math.floor(Math.random()*2);
  for(let i=0;i<count;i++){ const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.18,0.36,4,8), new THREE.MeshStandardMaterial({ color: colors[i%colors.length] })); p.position.set(seats[i][0], seats[i][1], seats[i][2]); passengers.push({mesh:p, paid:false}); bus.add(p); }
})();

/* conductor collect */
let money = 0, rep = 0;
function conductorCollect(){ let collected = 0; passengers.forEach(p => { if(!p.paid){ const fare = 30 + Math.floor(Math.random()*30); collected += fare; p.paid = true; } }); if(collected>0){ money += collected; rep += Math.floor(collected/100); moneyEl.textContent = Math.round(money); repEl.textContent = Math.round(rep); log('Conductor collected KES '+collected); } }

/* driving physics - realistic */
const state = { speed:0, heading:0, steering:0, maxSpeed:14, accel:6.5, brake:14, drag:3.0 };
let keys = {}; window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true); window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function updateDriving(dt){
  const forward = (keys['w']||keys['arrowup']) ? 1 : 0;
  const back = (keys['s']||keys['arrowdown']) ? 1 : 0;
  if(forward) state.speed += state.accel * dt;
  if(back) state.speed -= state.brake * dt;
  const dragForce = state.drag * dt * Math.sign(state.speed);
  state.speed -= dragForce;
  state.speed = Math.max(-6, Math.min(state.maxSpeed, state.speed));
  const steerLeft = keys['a'] || keys['arrowleft'];
  const steerRight = keys['d'] || keys['arrowright'];
  const steerInput = (steerLeft ? 1:0) - (steerRight ? 1:0);
  state.steering += (steerInput - state.steering) * Math.min(1, dt * 6);
  const steerEffect = (0.6 + 0.4 * Math.min(1, Math.abs(state.speed)/state.maxSpeed));
  const turn = state.steering * 1.8 * steerEffect * (state.speed / Math.max(1, state.maxSpeed)) * dt;
  bus.rotation.y += turn;
  const dir = new THREE.Vector3(Math.sin(bus.rotation.y), 0, -Math.cos(bus.rotation.y));
  bus.position.addScaledVector(dir, state.speed * dt);
  bus.position.x = Math.max(-6, Math.min(6, bus.position.x));
  bus.traverse(obj => { if(obj.geometry && obj.geometry.type === 'CylinderGeometry'){ obj.rotation.x += state.speed * dt * 4; } });
}

/* checkpoint and camera omitted for brevity in this cell; full code written to file below */