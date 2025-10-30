import './js/modules/traffic.js';
import './js/modules/weather.js';
import './js/modules/multiplayer.js';

const moneyEl=document.getElementById('money-amt');
const repEl=document.getElementById('rep-amt');
const stageEl=document.getElementById('trip-stage');
const startBtn=document.getElementById('start-trip');
const pauseBtn=document.getElementById('pause-trip');
const splash=document.getElementById('splash');

const canvas=document.getElementById('scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(window.devicePixelRatio);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x071018,0.002);

const camera=new THREE.PerspectiveCamera(70,window.innerWidth/(window.innerHeight-172),0.1,2000);
camera.position.set(0,1.6,3);
const amb=new THREE.AmbientLight(0xffffff,0.6);scene.add(amb);
const dir=new THREE.DirectionalLight(0xfff0cc,0.7);dir.position.set(5,10,2);scene.add(dir);

const ground=new THREE.Mesh(new THREE.PlaneGeometry(800,800),
new THREE.MeshStandardMaterial({color:0x071217}));
ground.rotation.x=-Math.PI/2;scene.add(ground);

// bus placeholder
const bus=new THREE.Group();
const body=new THREE.Mesh(new THREE.BoxGeometry(2,2,6),
new THREE.MeshStandardMaterial({color:0x202833,metalness:0.3,roughness:0.6}));
bus.add(body);scene.add(bus);

const route=[new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-40),
new THREE.Vector3(30,0,-80),new THREE.Vector3(-20,0,-120)];
let routeIndex=0,routeT=0,autoDrive=false,paused=false,totalEarned=0;

function resize(){
renderer.setSize(window.innerWidth,window.innerHeight-172);
camera.aspect=canvas.clientWidth/canvas.clientHeight;
camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);

function lerpVec(a,b,t){return a.clone().lerp(b,t);}
function updateAutoDrive(dt){
if(!autoDrive||paused)return;
const speed=6;
const p0=route[routeIndex],p1=route[(routeIndex+1)%route.length];
routeT+=dt*(speed/p0.distanceTo(p1));
if(routeT>=1){routeT=0;routeIndex=(routeIndex+1)%route.length;arrive(routeIndex);}
const pos=lerpVec(p0,p1,routeT);
bus.position.x=pos.x;bus.position.z=pos.z;
const dirV=p1.clone().sub(p0).normalize();
bus.rotation.y=Math.atan2(dirV.x,-dirV.z);
stageEl.textContent='Stage: '+(['Ambassadeur','Kencom','Afya Centre','Railways'][routeIndex]||'-');
}
function arrive(idx){
paused=true;
const earn=50+Math.floor(Math.random()*50);
totalEarned+=earn;moneyEl.textContent=totalEarned;
repEl.textContent=Math.round(totalEarned/100);
setTimeout(()=>{paused=false;if(idx===route.length-1){autoDrive=false;}},1500);
}
startBtn.onclick=()=>{autoDrive=true;routeIndex=0;routeT=0;totalEarned=0;};
pauseBtn.onclick=()=>{paused=!paused;pauseBtn.textContent=paused?'Continue':'Pause';};

setTimeout(()=>{splash.style.opacity='0';setTimeout(()=>splash.style.display='none',1000);},2200);

const clock=new THREE.Clock();
function animate(){
const dt=clock.getDelta();
updateAutoDrive(dt);
camera.lookAt(bus.position);
renderer.render(scene,camera);
requestAnimationFrame(animate);
}
resize();animate();
