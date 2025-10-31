/* main.js v0.5 Stable Responsive
   - Realistic constrained driving (no drift)
   - Chase <-> Cockpit camera toggle
   - Dynamic lighting mode (day / sunset) switch for testing
   - Conductor auto-collection and working route system
*/

import('./js/modules/traffic.js').catch(()=>{});
import('./js/modules/weather.js').catch(()=>{});
import('./js/modules/multiplayer.js').catch(()=>{});

const $ = s => document.querySelector(s);
const moneyEl = $('#money-amt'), repEl = $('#rep-amt'), stageEl = $('#stage-name');
const startBtn = $('#start-trip'), pauseBtn = $('#pause-trip'), toggleCamBtn = $('#toggle-camera');
const splash = $('#splash'), tipsEl = $('#tips'), logEl = $('#log');

function log(msg){ const d=document.createElement('div'); d.textContent=msg; logEl.prepend(d); }

// renderer and scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio); renderer.shadowMap.enabled=true;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x071018, 0.0015);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/(window.innerHeight-172), 0.1, 2000);
camera.position.set(0,2.4,6);

// lights (will support day <-> sunset)
const hemi = new THREE.HemisphereLight(0xffffff, 0x080a10, 0.7); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(40,60,20); sun.castShadow=true; scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000,4000), new THREE.MeshStandardMaterial({ color:0x0c1216 }));
ground.rotation.x = -Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const road = new THREE.Mesh(new THREE.BoxGeometry(12,0.2,2000), new THREE.MeshStandardMaterial({ color:0x101820 }));
road.position.set(0,0.1,-900); scene.add(road);

// horizon plane for skyline
const horizonGeo = new THREE.PlaneGeometry(5000,800);
const horizonMat = new THREE.MeshBasicMaterial({ color:0x000000 });
const horizon = new THREE.Mesh(horizonGeo, horizonMat);
horizon.position.set(0,150,-1400); horizon.rotation.x = -0.1; scene.add(horizon);

// try CDN skyline then fallback
const unsplash = 'https://images.unsplash.com/photo-1543702716-41d4b3f3a6b8?auto=format&fit=crop&w=1600&q=80';
const img = new Image(); img.crossOrigin='anonymous';
img.onload = ()=>{ const tex=new THREE.Texture(img); tex.needsUpdate=true; horizon.material.map=tex; horizon.material.needsUpdate=true; document.getElementById('splash-bg').src = unsplash; };
img.onerror = ()=>{ console.warn('CDN skyline failed; using local backup'); };
img.src = unsplash;

// build bus (stable interior)
const bus = new THREE.Group(); bus.position.set(0,0,0); scene.add(bus);
(function buildBus(){
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2,1.8,11.0), new THREE.MeshStandardMaterial({ color:0xff5a20, metalness:0.1, roughness:0.6 }));
  body.position.set(0,1,0); body.castShadow=true; bus.add(body);
  const seatMat = new THREE.MeshStandardMaterial({ color:0x203040 });
  for(let r=0;r<4;r++){ const z=-2.8 + r*1.8; const l=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.55,1.2), seatMat); l.position.set(-0.95,0.6,z); bus.add(l); const rgt = l.clone(); rgt.position.x = 0.95; bus.add(rgt); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.0,8), new THREE.MeshStandardMaterial({ color:0xcccccc }));
  pole.position.set(-0.1,1.0,-0.5); bus.add(pole);
})();

// passengers
const passengers = []; (function spawn(){ const colors=[0xffc857,0xff6b6b,0x6bd4ff,0xa0ff9b]; const seats=[]; for(let i=0;i<4;i++){ const z=-2.4+i*1.6; seats.push([-0.9,0.6,z]); seats.push([0.9,0.6,z]); } for(let i=0;i<6;i++){ const s=seats[i]; const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.18,0.35,4,8), new THREE.MeshStandardMaterial({ color:colors[i%colors.length] })); p.position.set(s[0],s[1],s[2]); passengers.push({mesh:p,paid:false}); bus.add(p);} })();

// driving state (no drift)
const state = { speed:0, steering:0, maxSpeed:14, accel:6.5, brake:12, drag:3.2 };
let keys={}; window.addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true); window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

function updateDriving(dt){
  const forward = keys['w']||keys['arrowup']; const back = keys['s']||keys['arrowdown'];
  if(forward) state.speed += state.accel*dt; else if(back) state.speed -= state.brake*dt; else state.speed -= Math.sign(state.speed)*Math.min(Math.abs(state.speed), state.drag*dt*10);
  state.speed = Math.max(-6, Math.min(state.maxSpeed, state.speed));
  const steerInput = (keys['a']||keys['arrowleft']?1:0) - (keys['d']||keys['arrowright']?1:0);
  state.steering += (steerInput - state.steering) * Math.min(1, dt*6);
  const turnRate = 1.1 * (Math.abs(state.speed)/Math.max(1,state.maxSpeed));
  bus.rotation.y += state.steering * turnRate * dt;
  const dir = new THREE.Vector3(Math.sin(bus.rotation.y),0,-Math.cos(bus.rotation.y));
  bus.position.addScaledVector(dir, state.speed*dt);
  bus.position.x = Math.max(-5.5, Math.min(5.5, bus.position.x));
}

// route & conductor
const routePoints = [ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-160), new THREE.Vector3(0,0,-360), new THREE.Vector3(0,0,-640) ];
const routeNames = ['Ambassadeur','Kencom','Afya Centre','Railways'];
let currentCheckpoint=0, routeActive=false, paused=false, money=0, rep=0;

function conductorCollect(){ let collected=0; passengers.forEach(p=>{ if(!p.paid){ const fare = 30 + Math.floor(Math.random()*30); collected += fare; p.paid = true; } }); if(collected){ money += collected; rep += Math.floor(collected/100); moneyEl.textContent=Math.round(money); repEl.textContent=Math.round(rep); log('Conductor collected KES ' + collected); } }

function checkStops(){ if(!routeActive||paused) return; const cp = routePoints[currentCheckpoint]; const dist = new THREE.Vector3(bus.position.x,0,bus.position.z).distanceTo(new THREE.Vector3(cp.x,0,cp.z)); if(dist < 8 && Math.abs(state.speed) < 1.0){ paused = true; log('Arrived at stop: '+routeNames[currentCheckpoint]); stageEl.textContent = routeNames[currentCheckpoint]; conductorCollect(); setTimeout(()=>{ paused=false; currentCheckpoint = Math.min(routePoints.length-1,currentCheckpoint+1); if(currentCheckpoint >= routePoints.length){ routeActive=false; log('Route finished'); } }, 1500); } }

// camera toggle
let cameraMode='chase'; function setCamera(mode){ cameraMode = mode; toggleCamBtn.textContent = (cameraMode==='chase'?'Switch: Cockpit':'Switch: Chase'); } setCamera('chase'); toggleCamBtn.addEventListener('click', ()=> setCamera(cameraMode==='chase'?'cockpit':'chase'));

function updateCamera(dt){
  if(cameraMode==='chase'){
    const chaseOffset = new THREE.Vector3(0,3,8).applyAxisAngle(new THREE.Vector3(0,1,0), bus.rotation.y).add(bus.position);
    camera.position.lerp(chaseOffset, 0.12);
    camera.lookAt(bus.position.clone().add(new THREE.Vector3(0,1.2,0)));
  } else {
    const eyeLocal = new THREE.Vector3(-0.8,1.35,-3.9); const eyeWorld = eyeLocal.clone().applyMatrix4(bus.matrixWorld); camera.position.lerp(eyeWorld, 0.25); const lookLocal = new THREE.Vector3(-0.2,1.25,-1.6); const lookWorld = lookLocal.clone().applyMatrix4(bus.matrixWorld); camera.lookAt(lookWorld);
  }
}

// UI
startBtn.addEventListener('click', ()=>{ bus.position.set(0,0,0); bus.rotation.y=0; state.speed=0; state.steering=0; currentCheckpoint=0; routeActive=true; paused=false; passengers.forEach(p=>p.paid=false); money=0; rep=0; moneyEl.textContent='0'; repEl.textContent='0'; log('Route started — drive with W/A/S/D'); });
pauseBtn.addEventListener('click', ()=>{ paused = !paused; pauseBtn.textContent = paused ? 'Continue' : 'Pause'; log(paused ? 'Route paused' : 'Route continued'); });

// tips bilingual
const tips = [ '💡 Tip: Press C to change view', '💡 Press C ndo ubadilishe view gathee', '💡 Tip: Press W to move forward, A/D to steer', '💡 Press W ku-move mbele A/D ku-turn', '💡 Tip: The conductor handles fares', '💡 Makanga anaokota fare.' ];
let tipIndex=0; function rotateTips(){ tipsEl.textContent = tips[tipIndex]; tipIndex=(tipIndex+1)%tips.length; } setInterval(rotateTips,6000); rotateTips();

// splash fade and glare (play once)
setTimeout(()=>{ if(splash){ splash.style.opacity='0'; setTimeout(()=>{ splash.style.display='none'; },1000); } },2200);

// day / sunset control (both supported; default dynamic based on bus z)
const dayMode = { hemiColor:0xffffff, sunColor:0xfff1d6, hemiIntensity:0.9, sunIntensity:1.0 };
const sunsetMode = { hemiColor:0xffe9d6, sunColor:0xffb13b, hemiIntensity:0.4, sunIntensity:0.6 };

// main loop
const clock = new THREE.Clock();
function animate(){ const dt = clock.getDelta(); if(routeActive && !paused) updateDriving(dt); else state.speed *= Math.pow(0.85, dt*60); checkStops(); passengers.forEach((p,i)=>{ p.mesh.rotation.y = Math.sin(performance.now()*0.001 + i)*0.05; }); const dayFactor = Math.max(0, Math.min(1, 1 - (Math.abs(bus.position.z) / 900))); // 1 near start (day), 0 far (sunset)
const hemiColor = new THREE.Color(dayMode.hemiColor).lerp(new THREE.Color(sunsetMode.hemiColor), 1-dayFactor); hemi.color = hemiColor; hemi.intensity = dayMode.hemiIntensity * dayFactor + sunsetMode.hemiIntensity*(1-dayFactor); sun.color = new THREE.Color(dayMode.sunColor).lerp(new THREE.Color(sunsetMode.sunColor), 1-dayFactor); sun.intensity = dayMode.sunIntensity*dayFactor + sunsetMode.sunIntensity*(1-dayFactor); updateCamera(dt); renderer.render(scene,camera); requestAnimationFrame(animate); }
window.addEventListener('resize', ()=>{ renderer.setSize(window.innerWidth, window.innerHeight-172); camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); });
renderer.setSize(window.innerWidth, window.innerHeight-172);
animate();


// ✅ v0.6 Autopilot Integration
import('./js/modules/autopilot.js').catch(()=>{});
