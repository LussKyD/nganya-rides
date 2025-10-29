/* main.js - GitHub Pages build (uses Three.js r170 from unpkg) */
import * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js';

const locales = {
  en: { driver:'Driver', conductor:'Conductor', welcome:'Welcome to Nganya Rides!', switched:'Switched role', custom_applied:'Customization applied', police_stop:'Police checkpoint!', got_fined:'You were fined', bribed:'Bribe paid', collected:'Collected fares', bumped:'Bumped another vehicle!', camera_mode:'Camera', traffic_spawned:'Traffic spawned', lang_switched:'Language changed' },
  sw: { driver:'Dereva', conductor:'Makanga', welcome:'Karibu Nganya Rides!', switched:'Umebadilisha jukumu', custom_applied:'Urembo umewekwa', police_stop:'Kizuizi cha polisi!', got_fined:'Umelipa faini', bribed:'Umelipa hongo', collected:'Pesa zimekusanywa', bumped:'Umegonga gari jingine!', camera_mode:'Kamera', traffic_spawned:'Magari zaidi', lang_switched:'Lugha imebadilishwa' },
  sheng: { driver:'Driver', conductor:'Makanga', welcome:'Sasa tuko ndani ya Nganya Rides!', switched:"Swap'd role", custom_applied:'Swag updated', police_stop:'Police checkpoint, walem!', got_fined:'Fined!', bribed:'Bribe paid', collected:'Cash in hand', bumped:'You hit someone bruu!', camera_mode:'Cam', traffic_spawned:'Traffic incoming', lang_switched:'Lang switched' }
};
let lang = localStorage.getItem('nganya_lang') || 'en';

const state = { role:'driver', money:0, rep:0, cameraMode:'third', busColor:0xff5500, leds:false, decal:'none', passengers:8 };

// UI refs
const roleName = document.getElementById('role-name');
const moneyAmt = document.getElementById('money-amt');
const repAmt = document.getElementById('rep-amt');
const logEl = document.getElementById('log');
const langSelect = document.getElementById('lang'); langSelect.value = lang;
function t(k){ return (locales[lang] && locales[lang][k]) || locales.en[k] || k; }
function log(msg){ const d = document.createElement('div'); d.textContent = msg; logEl.prepend(d); }

// Renderer + scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio);
function resize(){ renderer.setSize(window.innerWidth, window.innerHeight - 172); camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.FogExp2(0x071018, 0.002);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/(window.innerHeight-172), 0.1, 1000);
camera.position.set(0,6,14);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.07; controls.target.set(0,1,0);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.6); dir.position.set(10,20,10); scene.add(dir);

// Ground + buildings
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400), new THREE.MeshStandardMaterial({ color:0x0f1620 }));
ground.rotation.x = -Math.PI/2; scene.add(ground);
function makeBuilding(x,z,h,c){ const g = new THREE.BoxGeometry(6,h,6); const m = new THREE.MeshStandardMaterial({color:c}); const mesh = new THREE.Mesh(g,m); mesh.position.set(x,h/2,z); scene.add(mesh); }
makeBuilding(-20,-40,14,0x263344); makeBuilding(18,-60,18,0x334455); makeBuilding(40,-12,10,0x443322);

// Textured colorful matatu (cube)
const loader = new THREE.TextureLoader();
const matTex = loader.load('assets/textures/matatu_texture.jpg');
matTex.flipY = false;
const busGroup = new THREE.Group();
const busBody = new THREE.Mesh(new THREE.BoxGeometry(3.6,1.6,8), new THREE.MeshStandardMaterial({ map: matTex, metalness:0.2, roughness:0.5 }));
busBody.position.y = 1; busGroup.add(busBody);
// small details
const windshield = new THREE.Mesh(new THREE.BoxGeometry(3.3,0.6,1.2), new THREE.MeshStandardMaterial({ color:0x08101a, transparent:true, opacity:0.6 }));
windshield.position.set(0,1.25,-3.1); busGroup.add(windshield);
const wheelGeo = new THREE.CylinderGeometry(0.45,0.45,0.6,16); const wheelMat = new THREE.MeshStandardMaterial({ color:0x111111 });
[[-1.4,0.45,3],[1.4,0.45,3],[-1.4,0.45,-3],[1.4,0.45,-3]].forEach(p=>{ const w=new THREE.Mesh(wheelGeo,wheelMat); w.rotation.z = Math.PI/2; w.position.set(p[0],p[1],p[2]); busGroup.add(w); });
scene.add(busGroup);

// rotate slowly on idle
let idleRotation = 0.002;

// decal + leds
let decalSprite = null, ledMesh = null;
function updateDecal(){ if(decalSprite) busGroup.remove(decalSprite); if(state.decal==='none') return; const cx=document.createElement('canvas'); cx.width=256; cx.height=128; const ctx=cx.getContext('2d'); ctx.fillStyle='rgba(255,255,255,0)'; ctx.fillRect(0,0,256,128); ctx.fillStyle='#fff'; ctx.font='48px sans-serif'; ctx.textAlign='center'; ctx.fillText(state.decal.toUpperCase(),128,78); const tex=new THREE.CanvasTexture(cx); const mat=new THREE.SpriteMaterial({ map:tex, transparent:true }); decalSprite=new THREE.Sprite(mat); decalSprite.scale.set(4,1.6,1); decalSprite.position.set(0,1.1,4.05); busGroup.add(decalSprite); }
function updateLEDs(){ if(ledMesh) busGroup.remove(ledMesh); if(!state.leds) return; const geom=new THREE.BoxGeometry(3.6,0.06,0.2); const mat=new THREE.MeshBasicMaterial({ color:0x66ffcc, emissive:0x66ffcc }); ledMesh=new THREE.Mesh(geom,mat); ledMesh.position.set(0,0.45,4.2); busGroup.add(ledMesh); }

// traffic (looping)
const traffic = new THREE.Group(); scene.add(traffic);
const paths = [
  (t)=>{ const a = t * Math.PI * 2; return new THREE.Vector3(Math.cos(a)*30,0,Math.sin(a)*30); },
  (t)=>{ if(t<0.25) return new THREE.Vector3(-40 + 320*t,0,-40); if(t<0.5) return new THREE.Vector3(40,0,-40 + 320*(t-0.25)); if(t<0.75) return new THREE.Vector3(40 - 320*(t-0.5),0,40); return new THREE.Vector3(-40,0,40 - 320*(t-0.75)); }
];
function spawnTraffic(n=8){ for(let i=0;i<n;i++){ const car = new THREE.Mesh(new THREE.BoxGeometry(2,1,4), new THREE.MeshStandardMaterial({ color: Math.random()*0xffffff })); car.userData = { pathIdx: i % paths.length, t: Math.random() }; traffic.add(car); } log(t('traffic_spawned')); }

// police event
let policeTimer = 0;
function triggerPolice(){ log(t('police_stop')); if(Math.random()<0.45){ const fine = 200 + Math.floor(Math.random()*800); state.money = Math.max(0, state.money - fine); state.rep = Math.max(0, state.rep - 1); log(t('got_fined') + ' KES ' + fine); } else { const bribe = 100 + Math.floor(Math.random()*400); state.money = Math.max(0, state.money - bribe); log(t('bribed') + ' KES ' + bribe); state.rep += 1; } updateUI(); }

// controls
const keys = {}; window.addEventListener('keydown', e=> keys[e.key.toLowerCase()] = true); window.addEventListener('keyup', e=> keys[e.key.toLowerCase()] = false);
let speed = 0; let rotation = 0;

function conductorCollect(){ if(state.role !== 'conductor') return; const fare = 50; const collected = fare * Math.max(0, Math.floor(state.passengers * (0.6 + Math.random()*0.6))); state.money += collected; state.rep += 0.2; log(t('collected') + ' KES ' + collected); updateUI(); }

// UI wiring
document.getElementById('switch-role').addEventListener('click', ()=>{ state.role = (state.role === 'driver') ? 'conductor' : 'driver'; roleName.textContent = t(state.role); log(t('switched') + ' → ' + t(state.role)); });
document.getElementById('toggle-camera').addEventListener('click', ()=>{ state.cameraMode = (state.cameraMode === 'third') ? 'first' : 'third'; log(t('camera_mode') + ' ' + state.cameraMode); });
document.getElementById('spawn-traffic').addEventListener('click', ()=> spawnTraffic(10));
document.getElementById('apply-custom').addEventListener('click', ()=>{ const color = document.getElementById('bus-color').value; state.busColor = parseInt(color.replace('#','0x')); state.leds = document.getElementById('leds').checked; state.decal = document.getElementById('decal').value; busBody.material.color.setHex(state.busColor); updateLEDs(); updateDecal(); log(t('custom_applied')); });
document.getElementById('lang').addEventListener('change', (e)=>{ lang = e.target.value; localStorage.setItem('nganya_lang', lang); roleName.textContent = t(state.role); log(t('lang_switched')); });

function t(k){ return (locales[lang] && locales[lang][k]) || locales.en[k] || k; }
function log(msg){ const d = document.createElement('div'); d.textContent = msg; logEl.prepend(d); }
function updateUI(){ moneyAmt.textContent = Math.round(state.money); repAmt.textContent = Math.round(state.rep); }

// animate
const clock = new THREE.Clock();
function animate(){ const dt = clock.getDelta();
  if(state.role === 'driver' && speed === 0){ busGroup.rotation.y += idleRotation; }
  traffic.children.forEach(c=>{ c.userData.t += dt * 0.03; if(c.userData.t > 1) c.userData.t -= 1; const pos = paths[c.userData.pathIdx](c.userData.t); c.position.copy(pos); const next = paths[c.userData.pathIdx]((c.userData.t + 0.01)%1); c.lookAt(next); });
  policeTimer += dt; if(policeTimer > 12 + Math.random()*30){ policeTimer = 0; triggerPolice(); }
  if(state.role === 'driver'){ if(keys['w']||keys['arrowup']) speed += dt * 6; if(keys['s']||keys['arrowdown']) speed -= dt * 6; speed = Math.max(0, Math.min(25, speed)); rotation = 0; if(keys['a']||keys['arrowleft']) rotation = 0.04; if(keys['d']||keys['arrowright']) rotation = -0.04; busGroup.rotation.y += rotation * speed * 0.02; busGroup.position.x += Math.sin(busGroup.rotation.y) * speed * dt; busGroup.position.z += Math.cos(busGroup.rotation.y) * speed * dt * -1; traffic.children.forEach(c=>{ const dist = c.position.distanceTo(busGroup.position); if(dist < 3.5){ log(t('bumped')); state.rep = Math.max(0, state.rep - 1); speed *= 0.6; } }); } else { if(keys['c']){ conductorCollect(); keys['c'] = false; } }
  const target = new THREE.Vector3(busGroup.position.x, busGroup.position.y + 1.2, busGroup.position.z);
  const camPos = new THREE.Vector3(target.x + 12*Math.sin(busGroup.rotation.y), target.y + 6, target.z + 12*Math.cos(busGroup.rotation.y));
  camera.position.lerp(camPos, 0.12); camera.lookAt(target); renderer.render(scene, camera); requestAnimationFrame(animate); }
updateUI(); roleName.textContent = t(state.role); setTimeout(function(){ var s=document.getElementById('splash'); if(s) s.style.display='none'; }, 1600); animate();
