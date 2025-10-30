/* main.js v0.6 Integrated
   - Combined v0.5 stable core + integration
   - Low-poly bus visuals with windows, wheels, doors, seats, passengers
   - Looping route progression (Ambassadeur -> Kencom -> Afya Centre -> Railways -> loop)
   - Conductor autopilot (press 'R' to toggle Driver <-> Conductor)
   - Camera: Chase <-> Cockpit toggle (button + 'C' key)
   - Preserves original controls and UI hooks
*/

/* ===========================
   Safe backups (developer note)
   ===========================
   Make a manual backup before overwriting:
   cp main.js main.js.bak_v0.5
*/

/* Try to load optional modules (non-blocking) */
import('./js/modules/traffic.js').catch(()=>{});
import('./js/modules/weather.js').catch(()=>{});
import('./js/modules/multiplayer.js').catch(()=>{});

/* ---------------------------
   DOM helpers & UI elements
   --------------------------- */
const $ = s => document.querySelector(s);
const moneyEl = $('#money-amt'), repEl = $('#rep-amt'), stageEl = $('#stage-name');
const startBtn = $('#start-trip'), pauseBtn = $('#pause-trip'), toggleCamBtn = $('#toggle-camera');
const splash = $('#splash'), tipsEl = $('#tips'), logEl = $('#log');

function log(msg){ const d=document.createElement('div'); d.textContent=msg; logEl.prepend(d); }

/* ===========================
   THREE.js scene & renderer
   =========================== */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x071018, 0.0015);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/(window.innerHeight-172), 0.1, 2000);
camera.position.set(0,2.4,6);

/* Lights */
const hemi = new THREE.HemisphereLight(0xffffff, 0x080a10, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(40,60,20); sun.castShadow=true; scene.add(sun);

/* Ground & road */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000,4000), new THREE.MeshStandardMaterial({ color:0x0c1216 }));
ground.rotation.x = -Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const road = new THREE.Mesh(new THREE.BoxGeometry(12,0.2,2000), new THREE.MeshStandardMaterial({ color:0x101820 }));
road.position.set(0,0.1,-900); scene.add(road);

/* Horizon / skyline (CDN fallback) */
const horizonGeo = new THREE.PlaneGeometry(5000,800);
const horizonMat = new THREE.MeshBasicMaterial({ color:0x000000 });
const horizon = new THREE.Mesh(horizonGeo, horizonMat);
horizon.position.set(0,150,-1400); horizon.rotation.x = -0.1; scene.add(horizon);

const unsplash = 'https://images.unsplash.com/photo-1543702716-41d4b3f3a6b8?auto=format&fit=crop&w=1600&q=80';
const img = new Image(); img.crossOrigin='anonymous';
img.onload = ()=>{ const tex=new THREE.Texture(img); tex.needsUpdate=true; horizon.material.map=tex; horizon.material.needsUpdate=true; const sb=document.getElementById('splash-bg'); if(sb) sb.src = unsplash; };
img.onerror = ()=>{ console.warn('CDN skyline failed; using local backup'); };
img.src = unsplash;

/* ===========================
   Low-poly Bus Visual + simple kinematic controller
   (All kept inside this file for single-file deployment)
   =========================== */

class BusVisual {
  constructor(scene, opts={}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.castShadow = true;
    this.group.receiveShadow = true;
    scene.add(this.group);

    // State
    this.x = opts.x || 0;
    this.y = opts.y || 0;
    this.z = opts.z || 0;
    this.angle = opts.angle || 0; // radians, 0 facing -Z in your world? we keep same as previous (bus.rotation.y)
    this.speed = 0;
    this._throttle = 0; // -1..1
    this._steer = 0;    // -1..1

    // Build parts
    this._buildBody();
    this._buildWheels();
    this._buildWindows();
    this._buildDoors();
    this._buildSeatsAndPassengers();

    // Place initial position
    this.group.position.set(this.x,this.y,this.z);
  }

  _buildBody(){
    const bodyGeo = new THREE.BoxGeometry(4.2,1.8,11.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color:0xff5a20, metalness:0.05, roughness:0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0,1.0,0);
    body.castShadow = true;
    this.group.add(body);
    this.body = body;

    // simple headlights
    const headMat = new THREE.MeshStandardMaterial({ color:0xfff1cc, emissive:0x664400, emissiveIntensity:0.3 });
    const lh = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.05), headMat); lh.position.set(-0.8,0.9,-5.5); this.group.add(lh);
    const rh = lh.clone(); rh.position.x = 0.8; this.group.add(rh);
  }

  _buildWheels(){
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.6,0.6,0.5,12);
    const wheelMat = new THREE.MeshStandardMaterial({ color:0x111111, metalness:0.6, roughness:0.4 });
    const positions = [
      { x:-1.7, z:-4.0 }, { x:1.7, z:-4.0 }, { x:-1.7, z:3.8 }, { x:1.7, z:3.8 }
    ];
    for(const p of positions){
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI/2;
      w.position.set(p.x,0.45,p.z);
      w.castShadow=true;
      this.group.add(w);
      this.wheels.push(w);
    }
  }

  _buildWindows(){
    this.windows = [];
    const winMat = new THREE.MeshStandardMaterial({ color:0x000000, opacity:0.6, transparent:true });
    // 4 windows per side (low poly)
    const sideZStart = -4.5;
    for(let side of [-1,1]){
      for(let i=0;i<4;i++){
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.7), winMat.clone());
        const x = side * 1.9;
        const z = sideZStart + i * 2.4;
        w.position.set(x,1.85,z);
        w.rotation.y = Math.PI/2 * side;
        // store slide offset - we'll slide along X for visual when opening
        w.userData = { closedX: w.position.x, openOffset: 0.6 * side };
        this.group.add(w);
        this.windows.push(w);
      }
    }
  }

  _buildDoors(){
    // single door on the right side (positive x in this layout)
    this.doorGroup = new THREE.Group();
    const doorGeo = new THREE.BoxGeometry(0.12, 1.6, 1.8);
    const doorMat = new THREE.MeshStandardMaterial({ color:0x4a2b1a });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(2.1,1.0,-1.4);
    this.doorGroup.add(door);
    this.doorGroup.userData = { closedAngle:0, openAngle:-Math.PI/2.4, isOpen:false };
    this.group.add(this.doorGroup);
  }

  _buildSeatsAndPassengers(){
    this.seats = [];
    const seatGeo = new THREE.BoxGeometry(0.7,0.5,0.8);
    const seatMat = new THREE.MeshStandardMaterial({ color:0x203040 });
    const rows = 5;
    for(let r=0;r<rows;r++){
      const z = -4.0 + r * 1.6;
      const leftSeat = new THREE.Mesh(seatGeo, seatMat); leftSeat.position.set(-0.9,0.55,z); this.group.add(leftSeat); this.seats.push(leftSeat);
      const rightSeat = leftSeat.clone(); rightSeat.position.x = 0.9; this.group.add(rightSeat); this.seats.push(rightSeat);
    }

    // spawn simple passengers (capsule-like low-poly)
    this.passengers = [];
    const colors = [0xffc857,0xff6b6b,0x6bd4ff,0xa0ff9b,0xd2b4ff,0xffb6c1];
    for(let i=0;i<6;i++){
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16,6,6), new THREE.MeshStandardMaterial({ color: colors[i%colors.length] }));
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.5,0.28), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      const pg = new THREE.Group();
      head.position.set(0,0.42,0); body.position.set(0,0.02,0);
      pg.add(head); pg.add(body);
      const seat = this.seats[i % this.seats.length];
      pg.position.copy(seat.position).add(new THREE.Vector3(0,0.25,0));
      pg.userData = { paid:false };
      this.group.add(pg);
      this.passengers.push(pg);
    }
  }

  setPosition(x,y,z){
    this.x = x; this.y = y; this.z = z;
    this.group.position.set(this.x, this.y, this.z);
  }

  setRotation(angle){
    this.angle = angle;
    this.group.rotation.y = this.angle;
  }

  applySteer(s){ this._steer = Math.max(-1, Math.min(1,s)); }
  applyThrottle(t){ this._throttle = Math.max(-1, Math.min(1,t)); }

  setWindowOpen(val){
    for(const w of this.windows){
      w.position.x = w.userData.closedX + (w.userData.openOffset * val);
    }
  }

  toggleDoor(open){
    this.doorGroup.userData.isOpen = !!open;
  }

  playFareCollectAnim(){
    this.toggleDoor(true);
    setTimeout(()=> this.toggleDoor(false), 1400);
  }

  // simple kinematic update (keeps your original feel: constrained, no-drift)
  update(dt){
    // steering influences angle
    const steerAngle = this._steer * 0.04;
    const turnRate = 1.1 * (Math.abs(this.speed) / Math.max(1, 14));
    this.angle += steerAngle * turnRate * dt;

    // throttle accelerates
    const accel = this._throttle * 3.5;
    this.speed += accel * dt;

    // clamp speed similar to your old state
    this.speed = Math.max(-6, Math.min(14, this.speed));

    // move along local forward (-Z)
    const forward = new THREE.Vector3(Math.sin(this.angle), 0, -Math.cos(this.angle));
    this.x += forward.x * this.speed * dt;
    this.z += forward.z * this.speed * dt;

    // keep lane X bounds like before
    this.x = Math.max(-5.5, Math.min(5.5, this.x));

    // apply to group
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.angle;

    // rotate wheels visually
    for(const w of this.wheels){
      w.rotation.x += (this.speed / 0.8) * dt;
    }

    // door animation smoothing
    const targetAngle = this.doorGroup.userData.isOpen ? this.doorGroup.userData.openAngle : this.doorGroup.userData.closedAngle;
    this.doorGroup.rotation.y += (targetAngle - this.doorGroup.rotation.y) * Math.min(1, dt * 6);

    // passenger light bob
    this.passengers.forEach((p, i) => {
      p.position.y = 0.25 + Math.sin(performance.now()*0.002 + i)*0.01;
    });
  }

  // helper to mark passengers as paid (visual)
  setAllPassengersPaid(){
    this.passengers.forEach(p => p.userData.paid = true);
  }

  setPassengerPaid(index){
    if(this.passengers[index]) this.passengers[index].userData.paid = true;
  }
}

/* ===========================
   Route system (dense path + stops + loop)
   - If external RouteModule exists, prefer that; otherwise use internal.
   =========================== */

(function setupRouteFallback(){
  if(window.RouteModule) return; // keep external if loaded

  const RouteModule = {};
  // base anchor points (these are world coords similar to your earlier routePoints)
  const anchors = [
    new THREE.Vector3(0,0,0),       // Ambassadeur
    new THREE.Vector3(0,0,-160),    // Kencom
    new THREE.Vector3(0,0,-360),    // Afya Centre
    new THREE.Vector3(0,0,-640)     // Railways
  ];
  // build dense path between anchors, then loop back softly
  RouteModule.path = [];
  RouteModule.stageIndexForWaypoint = [];
  RouteModule.stages = [];
  RouteModule.stops = [];

  for(let s=0;s<anchors.length;s++){
    const a = anchors[s];
    const b = anchors[(s+1)%anchors.length]; // next (wrap)
    // build some intermediate waypoints between a and b
    const segments = Math.max(12, Math.floor(a.distanceTo(b) / 20));
    for(let i=0;i<segments;i++){
      const t = i / segments;
      // slight sinusoidal lateral variation
      const x = THREE.MathUtils.lerp(a.x, b.x, t);
      const z = THREE.MathUtils.lerp(a.z, b.z, t) + Math.sin((s + t) * 1.2) * 6;
      RouteModule.path.push({ x: x, y: 0, z: z });
      RouteModule.stageIndexForWaypoint.push(s);
    }
    // stage meta
    RouteModule.stages.push({ id: s+1, name: ['Ambassadeur','Kencom','Afya Centre','Railways'][s] || ('Stage '+(s+1)) });
  }
  // Add final anchor waypoint
  const lastAnchor = anchors[anchors.length-1];
  RouteModule.path.push({ x:lastAnchor.x, y:0, z:lastAnchor.z }); RouteModule.stageIndexForWaypoint.push(anchors.length-1);

  // stops at anchors
  for(let s=0;s<anchors.length;s++){
    const p = anchors[s];
    RouteModule.stops.push({ stageId: s+1, name: RouteModule.stages[s].name + ' Stop', pos: { x:p.x, y:0, z:p.z }, collected:false });
  }

  // event emitter
  const listeners = {};
  RouteModule.on = (ev, cb) => { listeners[ev] = listeners[ev] || []; listeners[ev].push(cb); };
  RouteModule.emit = (ev, payload) => { (listeners[ev] || []).forEach(cb => { try { cb(payload); } catch(e){ console.error(e) } }); };

  RouteModule.getNearestWaypointIndex = function(pos){
    let best = 0, bestDist = Infinity;
    for(let i=0;i<this.path.length;i++){
      const dx = pos.x - this.path[i].x, dz = pos.z - this.path[i].z;
      const d = dx*dx + dz*dz;
      if(d < bestDist){ best = i; bestDist = d; }
    }
    return best;
  };

  RouteModule.getLookaheadPoint = function(currentIndex, lookaheadDistance){
    lookaheadDistance = lookaheadDistance || 80;
    let distAccum = 0;
    for(let i=currentIndex;i< this.path.length -1; i++){
      const p1 = this.path[i], p2 = this.path[i+1];
      const seg = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      distAccum += seg;
      if(distAccum >= lookaheadDistance) return this.path[i+1];
    }
    // loop back to first for safety
    return this.path[0];
  };

  RouteModule.checkStageTransitions = function(currentWaypointIndex){
    const stageIdx = this.stageIndexForWaypoint[currentWaypointIndex] || 0;
    if(typeof this._lastStageIdx === 'undefined') this._lastStageIdx = stageIdx;
    if(stageIdx !== this._lastStageIdx){
      this._lastStageIdx = stageIdx;
      const stage = this.stages[stageIdx];
      this.emit('stageReached', stage);
    }
  };

  RouteModule.checkStopsProximity = function(pos, threshold){
    threshold = threshold || 60;
    for(const s of this.stops){
      if(s.collected) continue;
      const dx = pos.x - s.pos.x, dz = pos.z - s.pos.z;
      if(dx*dx + dz*dz <= threshold*threshold){
        s.collected = true;
        this.emit('stopReached', s);
        return s;
      }
    }
    return null;
  };

  RouteModule.reset = function(){
    this.stops.forEach(s => s.collected = false);
    this._lastStageIdx = undefined;
    this.emit('routeReset', this.stages);
  };

  window.RouteModule = RouteModule;
})();

/* ===========================
   Interaction Module fallback (conductor autopilot)
   - If a more advanced InteractionModule is present it will take precedence
   =========================== */

(function setupInteractionFallback(){
  if(window.InteractionModule) return; // prefer external

  const InteractionModule = {};
  InteractionModule.role = 'driver';
  InteractionModule.autopilot = false;

  const listeners = {};
  InteractionModule.on = (ev, cb) => { listeners[ev] = listeners[ev] || []; listeners[ev].push(cb); };
  InteractionModule.emit = (ev, payload) => { (listeners[ev]||[]).forEach(cb=>{ try{ cb(payload); }catch(e){ console.error(e); } }); };

  InteractionModule.switchRole = function(newRole){
    if(newRole !== 'driver' && newRole !== 'conductor') return;
    InteractionModule.role = newRole;
    InteractionModule.autopilot = (newRole === 'conductor');
    InteractionModule.emit('roleChanged', { role: InteractionModule.role, autopilot: InteractionModule.autopilot });
    console.log('[InteractionModule] switched role to', InteractionModule.role);
  };

  InteractionModule.getRole = () => InteractionModule.role;
  InteractionModule.isAutopilot = () => !!InteractionModule.autopilot;

  // small autopilot: pure pursuit + simple PID throttle (units tuned to visuals)
  function PID(kp, ki, kd){ this.kp=kp; this.ki=ki; this.kd=kd; this._prev=0; this._int=0; }
  PID.prototype.update = function(err, dt){ this._int += err*dt; const deriv = (err - this._prev)/(dt||1e-3); this._prev = err; return this.kp*err + this.ki*this._int + this.kd*deriv; };

  function computeSteer(vehicleX, vehicleZ, vehicleAngle, lx, lz){
    const dx = lx - vehicleX, dz = lz - vehicleZ;
    const localX = dx * Math.cos(-vehicleAngle) - dz * Math.sin(-vehicleAngle);
    const localZ = dx * Math.sin(-vehicleAngle) + dz * Math.cos(-vehicleAngle);
    const steerAng = Math.atan2(localZ, localX);
    const maxSteer = Math.PI/4;
    return Math.max(-1, Math.min(1, steerAng / maxSteer));
  }

  const state = { targetSpeed: 3.8, pid: new PID(1.6,0.02,0.12), lastWaypointIndex:0, lookaheadDistance: 80 };

  InteractionModule.updateAutopilot = function(vehicle){
    if(!InteractionModule.autopilot || typeof window.RouteModule === 'undefined') return null;
    const path = window.RouteModule.path;
    if(!path || path.length===0) return null;

    // nearest waypoint (search nearby window)
    let nearest = state.lastWaypointIndex;
    let bestDist = Infinity;
    const start = Math.max(0, state.lastWaypointIndex-20);
    const end = Math.min(path.length, state.lastWaypointIndex+120);
    for(let i=start;i<end;i++){
      const dx = vehicle.x - path[i].x, dz = vehicle.z - path[i].z;
      const d = dx*dx + dz*dz;
      if(d < bestDist){ bestDist = d; nearest = i; }
    }
    state.lastWaypointIndex = nearest;

    if(window.RouteModule && typeof window.RouteModule.checkStageTransitions === 'function'){
      window.RouteModule.checkStageTransitions(nearest);
    }

    const lookahead = window.RouteModule.getLookaheadPoint(nearest, state.lookaheadDistance);

    const steer = computeSteer(vehicle.x, vehicle.z, vehicle.angle || 0, lookahead.x, lookahead.z);

    const speedErr = state.targetSpeed - (vehicle.speed || 0);
    const throttleCmd = state.pid.update(speedErr, Math.max(vehicle.dt || 1/60, 1e-3));
    const throttle = Math.max(-0.2, Math.min(1, throttleCmd));

    // stops proximity triggers fareCollected
    if(window.RouteModule && typeof window.RouteModule.checkStopsProximity === 'function'){
      const stop = window.RouteModule.checkStopsProximity({ x: vehicle.x, y: 0, z: vehicle.z }, 80);
      if(stop){
        InteractionModule.emit('fareCollected', { stop, time: Date.now() });
      }
    }

    return { throttle, steer, nearestWaypointIndex: nearest, lookahead };
  };

  window.InteractionModule = InteractionModule;
})();

/* ===========================
   Driving state and controls (kept from your original v0.5)
   =========================== */

const state = { speed:0, steering:0, maxSpeed:14, accel:6.5, brake:12, drag:3.2 };
let keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function updateDrivingVisual(busVis, dt){
  const forward = keys['w'] || keys['arrowup'];
  const back = keys['s'] || keys['arrowdown'];
  if(forward) state.speed += state.accel * dt;
  else if(back) state.speed -= state.brake * dt;
  else state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), state.drag * dt * 10);

  state.speed = Math.max(-6, Math.min(state.maxSpeed, state.speed));

  const steerInput = (keys['a']||keys['arrowleft']?1:0) - (keys['d']||keys['arrowright']?1:0);
  state.steering += (steerInput - state.steering) * Math.min(1, dt * 6);

  const turnRate = 1.1 * (Math.abs(state.speed) / Math.max(1, state.maxSpeed));
  // update bus visual when driving manually
  busVis.applySteer(state.steering);
  // approximate throttle mapping
  const throttle = (state.speed / state.maxSpeed) * 1.0;
  busVis.applyThrottle(throttle);

  // update rotation & movement (busVis handles it in update())
}

/* ===========================
   Instantiate BusVisual & initial passengers (visuals)
   =========================== */

const busVis = new BusVisual(scene, { x: 0, y: 0, z: 0 });
window.bus = busVis; // expose

/* Keep original passenger list semantics (for conductor collect fallback)
   We also keep busVis.passengers to visually check payment state.
*/
const passengers = []; // minimal mapping to busVis passengers
for(let i=0;i<busVis.passengers.length;i++){
  passengers.push({ mesh: busVis.passengers[i], paid: false });
}

/* ===========================
   Route progression + conductor collection (preserve original behavior)
   - We will connect autopilot to drive busVis when conductor is active
   =========================== */

// We'll build routePoints from the RouteModule's stops (anchors)
const routePoints = (window.RouteModule && window.RouteModule.stops && window.RouteModule.stops.map(s => new THREE.Vector3(s.pos.x,0,s.pos.z))) || ([
  new THREE.Vector3(0,0,0),
  new THREE.Vector3(0,0,-160),
  new THREE.Vector3(0,0,-360),
  new THREE.Vector3(0,0,-640)
]);
const routeNames = (window.RouteModule && window.RouteModule.stages && window.RouteModule.stages.map(s=>s.name)) || ['Ambassadeur','Kencom','Afya Centre','Railways'];

let currentCheckpoint = 0, routeActive = false, paused = false, money = 0, rep = 0;

// conductorCollect updates both visual passengers and your money/rep
function conductorCollect(){
  let collected = 0;
  passengers.forEach((p, idx)=> {
    if(!p.paid){
      const fare = 30 + Math.floor(Math.random()*30);
      collected += fare; p.paid = true;
      // reflect in visual passenger group
      if(busVis.passengers[idx]) busVis.passengers[idx].userData.paid = true;
    }
  });
  if(collected){
    money += collected; rep += Math.floor(collected/100);
    if(moneyEl) moneyEl.textContent = Math.round(money);
    if(repEl) repEl.textContent = Math.round(rep);
    log('Conductor collected KES ' + collected);
  }
}

/* New helper: find nearest route waypoint index for looping progression (based on RouteModule.path if present) */
function getNearestGlobalWaypointIndexForBus(){
  if(window.RouteModule && window.RouteModule.getNearestWaypointIndex){
    const idx = window.RouteModule.getNearestWaypointIndex({ x: busVis.x, z: busVis.z });
    return idx;
  } else {
    // fallback: use routePoints list
    let best = 0, bestD = Infinity;
    for(let i=0;i<routePoints.length;i++){
      const d = busVis.group.position.distanceTo(routePoints[i]);
      if(d < bestD){ bestD = d; best = i; }
    }
    return best;
  }
}

/* checkStops: when manually stopping at a checkpoint (low speed) collect fares
   But since conductor autopilot will collect as it passes stops, this remains fallback
*/
function checkStopsManual(){
  if(!routeActive || paused) return;
  const cp = routePoints[currentCheckpoint];
  const dist = new THREE.Vector3(busVis.x,0,busVis.z).distanceTo(new THREE.Vector3(cp.x,0,cp.z));
  if(dist < 8 && Math.abs(busVis.speed) < 1.0){
    paused = true;
    log('Arrived at stop: ' + routeNames[currentCheckpoint]);
    if(stageEl) stageEl.textContent = routeNames[currentCheckpoint];
    conductorCollect();
    busVis.playFareCollectAnim();
    setTimeout(()=> {
      paused = false;
      currentCheckpoint = Math.min(routePoints.length-1, currentCheckpoint+1);
      if(currentCheckpoint >= routePoints.length){
        routeActive = false;
        log('Route finished');
      }
    }, 1500);
  }
}

/* ===========================
   Camera system (chase <-> cockpit)
   - Keep button and keyboard 'C' toggle
   =========================== */

let cameraMode = 'chase';
function setCamera(mode){
  cameraMode = mode;
  if(toggleCamBtn) toggleCamBtn.textContent = (cameraMode === 'chase' ? 'Switch: Cockpit' : 'Switch: Chase');
}
setCamera('chase');
if(toggleCamBtn) toggleCamBtn.addEventListener('click', ()=> setCamera(cameraMode === 'chase' ? 'cockpit' : 'chase'));

/* Keyboard toggles for role (R) and camera (C) */
window.addEventListener('keydown', (e) => {
  if(e.key === 'r' || e.key === 'R'){
    if(window.InteractionModule && window.InteractionModule.switchRole){
      const cur = window.InteractionModule.getRole ? window.InteractionModule.getRole() : 'driver';
      window.InteractionModule.switchRole(cur === 'driver' ? 'conductor' : 'driver');
    } else {
      // fallback: toggle internal
      const cur = window.InteractionModule.getRole ? window.InteractionModule.getRole() : 'driver';
      window.InteractionModule.switchRole(cur === 'driver' ? 'conductor' : 'driver');
    }
  }
  if(e.key === 'c' || e.key === 'C'){
    setCamera(cameraMode === 'chase' ? 'cockpit' : 'chase');
  }
});

/* ===========================
   Start / Pause UI wiring
   =========================== */

if(startBtn) startBtn.addEventListener('click', ()=> {
  busVis.setPosition(0,0,0); busVis.setRotation(0);
  state.speed = 0; state.steering = 0;
  currentCheckpoint = 0; routeActive = true; paused = false;
  // reset payments
  passengers.forEach(p => p.paid = false);
  busVis.passengers.forEach(p => p.userData.paid = false);
  money = 0; rep = 0; if(moneyEl) moneyEl.textContent='0'; if(repEl) repEl.textContent='0';
  log('Route started — drive with W/A/S/D');
  // reset RouteModule stops if present
  if(window.RouteModule && window.RouteModule.reset) window.RouteModule.reset();
});

if(pauseBtn) pauseBtn.addEventListener('click', ()=> {
  paused = !paused;
  pauseBtn.textContent = paused ? 'Continue' : 'Pause';
  log(paused ? 'Route paused' : 'Route continued');
});

/* tips bilingual rotation */
const tips = [ '💡 Tip: Press C to change view', '💡 Press C ndo ubadilishe view gathee', '💡 Tip: Press W to move forward, A/D to steer', '💡 Press W ku-move mbele A/D ku-turn', '💡 Tip: The conductor handles fares', '💡 Makanga anaokota fare.' ];
let tipIndex = 0;
function rotateTips(){ if(tipsEl) tipsEl.textContent = tips[tipIndex]; tipIndex = (tipIndex + 1) % tips.length; }
setInterval(rotateTips, 6000); rotateTips();

/* splash fade */
setTimeout(()=>{ if(splash){ splash.style.opacity='0'; setTimeout(()=>{ splash.style.display='none'; },1000); } },2200);

/* day <-> sunset transitions */
const dayMode = { hemiColor:0xffffff, sunColor:0xfff1d6, hemiIntensity:0.9, sunIntensity:1.0 };
const sunsetMode = { hemiColor:0xffe9d6, sunColor:0xffb13b, hemiIntensity:0.4, sunIntensity:0.6 };

/* ===========================
   Autopilot integration & fare events
   - prefer external InteractionModule.updateAutopilot
   - fallback to internal InteractionModule implemented above
   =========================== */

if(window.InteractionModule){
  window.InteractionModule.on('fareCollected', (payload) => {
    // Play bus animation & credit money
    busVis.playFareCollectAnim();
    // mark visual passengers as paid
    busVis.passengers.forEach(p => p.userData.paid = true);
    window._nganya_money = (window._nganya_money || 0) + 50;
    if(moneyEl) moneyEl.textContent = Math.round(window._nganya_money);
    // small toast
    const toast = document.createElement('div');
    toast.style.position='fixed'; toast.style.right='12px'; toast.style.bottom='12px';
    toast.style.background='rgba(0,0,0,0.7)'; toast.style.color='#fff'; toast.style.padding='8px 12px'; toast.style.borderRadius='6px';
    toast.innerText = `Conductor collected KES 50 — ${payload.stop.name}`;
    document.body.appendChild(toast); setTimeout(()=> document.body.removeChild(toast), 1700);
  });
}

/* ===========================
   Main loop
   =========================== */

const clock = new THREE.Clock();
function animate(){
  const dt = clock.getDelta();

  // driving: if conductor autopilot engaged, autopilot should control busVis;
  if(routeActive && !paused){
    if(window.InteractionModule && window.InteractionModule.isAutopilot && window.InteractionModule.isAutopilot()){
      // autopilot controls busVis
      const vehicle = { x: busVis.x, z: busVis.z, angle: busVis.angle || 0, speed: busVis.speed, dt };
      const ctrl = window.InteractionModule.updateAutopilot ? window.InteractionModule.updateAutopilot(vehicle) : null;
      if(ctrl){
        // apply autopilot outputs to busVisual
        busVis.applySteer(ctrl.steer);
        busVis.applyThrottle(ctrl.throttle);
      } else {
        // if no updateAutopilot available, keep current state (safe)
        busVis.applySteer(0); busVis.applyThrottle(0);
      }
    } else {
      // manual driving mapping (original)
      updateDrivingVisual(busVis, dt);
    }
  } else {
    // when route not active, slowly damp speed
    state.speed *= Math.pow(0.85, dt * 60);
    // map state speed into busVis for visual continuity
    busVis.applyThrottle(state.speed / state.maxSpeed);
    busVis.applySteer(state.steering);
  }

  // update bus visuals (kinematic)
  busVis.update(dt);

  // autopilot/fallback: check stops via RouteModule (if autopilot handles fare collection, it will emit events)
  if(window.RouteModule && window.InteractionModule && window.InteractionModule.isAutopilot && window.InteractionModule.isAutopilot()){
    // autopilot itself calls RouteModule.checkStopsProximity inside the InteractionModule fallback
    // nothing extra needed here
  } else {
    // fallback manual stop check
    checkStopsManual();
  }

  // passengers wiggle visuals (already handled in busVis.update)
  // day factor for lighting
  const dayFactor = Math.max(0, Math.min(1, 1 - (Math.abs(busVis.z) / 900)));
  const hemiColor = new THREE.Color(dayMode.hemiColor).lerp(new THREE.Color(sunsetMode.hemiColor), 1-dayFactor);
  hemi.color = hemiColor;
  hemi.intensity = dayMode.hemiIntensity * dayFactor + sunsetMode.hemiIntensity * (1-dayFactor);
  sun.color = new THREE.Color(dayMode.sunColor).lerp(new THREE.Color(sunsetMode.sunColor), 1-dayFactor);
  sun.intensity = dayMode.sunIntensity * dayFactor + sunsetMode.sunIntensity*(1-dayFactor);

  // camera update
  if(cameraMode === 'chase'){
    const chaseOffset = new THREE.Vector3(0,3,8).applyAxisAngle(new THREE.Vector3(0,1,0), busVis.angle).add(busVis.group.position);
    camera.position.lerp(chaseOffset, 0.12);
    camera.lookAt(busVis.group.position.clone().add(new THREE.Vector3(0,1.2,0)));
  } else {
    // cockpit: eye relative to bus inside
    const eyeLocal = new THREE.Vector3(-0.8,1.35,-3.9);
    const eyeWorld = eyeLocal.clone().applyMatrix4(busVis.group.matrixWorld);
    camera.position.lerp(eyeWorld, 0.25);
    const lookLocal = new THREE.Vector3(-0.2,1.25,-1.6);
    const lookWorld = lookLocal.clone().applyMatrix4(busVis.group.matrixWorld);
    camera.lookAt(lookWorld);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight-172);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
});
renderer.setSize(window.innerWidth, window.innerHeight-172);
animate();

/* ===========================
   End of main.js v0.6 Integrated
   =========================== */
