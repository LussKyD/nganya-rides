/* main.js v0.7 - Stage Loop, roadside props, HUD fixes */

import('./js/modules/routes.js').catch(()=>{});
import('./js/modules/interactions.js').catch(()=>{});

let scene, renderer, chaseCam, cockpitCam, activeCam;
let bus;
let money = 0, rep = 0;
let running = false;
let lastTime = performance.now();
let routeStages = [];
let currentStageIdx = 0;
let returning = false;
let routeSpeed = 12;

function $id(id){ return document.getElementById(id); }

function createScene() {
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  ( $id('game-container') || document.body ).appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1b2b);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(40,100,50);
  dir.castShadow = true;
  scene.add(dir);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), new THREE.MeshStandardMaterial({color:0x1a1a1a}));
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(400,2000), new THREE.MeshStandardMaterial({color:0x222222}));
  road.rotation.x = -Math.PI/2;
  road.position.y = 0.01;
  scene.add(road);

  const busGeo = new THREE.BoxGeometry(4,2,10);
  const busMat = new THREE.MeshStandardMaterial({color:0xcc4400});
  bus = new THREE.Mesh(busGeo, busMat);
  bus.castShadow = true;
  bus.position.set(0,1,100);
  scene.add(bus);

  chaseCam = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 2000);
  chaseCam.position.set(0,6,bus.position.z + 18);
  chaseCam.lookAt(bus.position);
  cockpitCam = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 2000);
  cockpitCam.position.set(0,2,5);
  bus.add(cockpitCam);
  activeCam = chaseCam;

  if (window.RouteStages && Array.isArray(window.RouteStages) && window.RouteStages.length>0) {
    routeStages = window.RouteStages.map((s)=> {
      if (s.position && s.position.isVector3) return s.position.clone();
      if (s.x !== undefined) return new THREE.Vector3(s.x, s.y||0, s.z);
      if (s.position && typeof s.position.x === 'number') return new THREE.Vector3(s.position.x, s.position.y||0, s.position.z);
      return new THREE.Vector3(0,0,0);
    });
  } else {
    routeStages = [
      new THREE.Vector3(0,0,80),
      new THREE.Vector3(0,0,40),
      new THREE.Vector3(0,0,0),
      new THREE.Vector3(0,0,-40),
      new THREE.Vector3(0,0,-80)
    ];
  }

  routeStages.forEach((p, i)=>{
    const marker = new THREE.Mesh(new THREE.ConeGeometry(1,2,8), new THREE.MeshStandardMaterial({color:0xffaa00}));
    marker.position.set(p.x, 1, p.z);
    marker.rotation.x = Math.PI;
    scene.add(marker);
  });

  addRoadsideProps();

  window.addEventListener('resize', onResize);
}

function addRoadsideProps(){
  const poleGeo = new THREE.CylinderGeometry(0.08,0.08,8,6);
  const poleMat = new THREE.MeshStandardMaterial({color:0x999999});
  const treeGeo = new THREE.ConeGeometry(1.2,4,8);
  const treeMat = new THREE.MeshStandardMaterial({color:0x116611});
  for (let z = -200; z <= 200; z += 15){
    const p1 = new THREE.Mesh(poleGeo, poleMat);
    p1.position.set(-7,4,z);
    scene.add(p1);
    const p2 = new THREE.Mesh(poleGeo, poleMat);
    p2.position.set(7,4,z+5);
    scene.add(p2);
    if (z % 45 === 0){
      const t = new THREE.Mesh(treeGeo, treeMat);
      t.position.set(-12,2,z+3);
      scene.add(t);
      const t2 = new THREE.Mesh(treeGeo, treeMat);
      t2.position.set(12,2,z-3);
      scene.add(t2);
    }
  }
}

function startRoute(){
  running = true;
  $id('route-status').textContent = 'Status: En Route';
}

function pauseRoute(){
  running = false;
  $id('route-status').textContent = 'Status: Paused';
}

function updateHUD(){
  $id('money-amt').textContent = money;
  $id('rep-amt').textContent = rep;
  $id('stage-name').textContent = 'Stage: ' + (currentStageIdx+1) + (returning ? ' (Return)' : '');
}

function animate(){
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;

  if (running){
    const target = routeStages[currentStageIdx];
    if (target){
      const dir = new THREE.Vector3().subVectors(target, bus.position);
      const dist = dir.length();
      if (dist < 2.5){
        money += 50;
        rep += 1;
        if (!returning){
          currentStageIdx++;
          if (currentStageIdx >= routeStages.length){
            currentStageIdx = routeStages.length - 2;
            returning = true;
            $id('route-status').textContent = 'Status: Arrived — Returning';
            running = false;
            setTimeout(()=>{ running=true; $id('route-status').textContent='Status: Return Trip'; }, 1400);
          }
        } else {
          currentStageIdx--;
          if (currentStageIdx < 0){
            money += 100;
            returning = false;
            currentStageIdx = 1;
            running = false;
            $id('route-status').textContent = 'Status: Round Complete';
            setTimeout(()=>{ running=true; $id('route-status').textContent='Status: En Route'; }, 1600);
          }
        }
      } else {
        dir.normalize();
        bus.position.addScaledVector(dir, routeSpeed * dt);
        const lookAtPos = new THREE.Vector3().copy(bus.position).add(dir);
        bus.lookAt(lookAtPos);
      }
    }
  }

  if (chaseCam){
    const ideal = new THREE.Vector3(bus.position.x, bus.position.y + 6, bus.position.z + 18);
    chaseCam.position.lerp(ideal, 0.12);
    chaseCam.lookAt(bus.position);
    activeCam = chaseCam;
  }

  updateHUD();
  renderer.render(scene, activeCam);
  requestAnimationFrame(animate);
}

function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  if (chaseCam){ chaseCam.aspect = w/h; chaseCam.updateProjectionMatrix(); }
  if (cockpitCam){ cockpitCam.aspect = w/h; cockpitCam.updateProjectionMatrix(); }
  renderer.setSize(w,h);
}

document.addEventListener('DOMContentLoaded', ()=>{
  createScene();
  $id('start-trip')?.addEventListener('click', startRoute);
  $id('pause-trip')?.addEventListener('click', pauseRoute);
  updateHUD();
  lastTime = performance.now();
  requestAnimationFrame(animate);
});
