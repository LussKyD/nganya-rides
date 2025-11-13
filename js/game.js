import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { UIManager } from './uiManager.js';
import { Physics } from './physics.js';
import { MatatuCulture } from './matatuCulture.js';
// Note: ConductorRole imported later to break circular dependency

// --- GAME CONSTANTS ---
export const DRIVER = 'Driver';
export const CONDUCTOR = 'Conductor';
export const GROUND_LEVEL = 0; 
export const MATATU_HEIGHT = 1.8; 
const MATATU_BODY_COLOR = 0x8800ff; 
const MATATU_ACCENT_COLOR = 0xffd700; 
const OBSTACLE_COUNT = 15;
const CONE_SIZE = 0.5;

// --- GLOBAL SHARED OBJECTS ---
export const gameState = {
    role: DRIVER,
    cash: 1000, 
    fuel: 100,
    isDriving: false,
    speed: 0, 
    maxSpeed: 0.1,      
    acceleration: 0.003,
    friction: 0.001,     
    rotationSpeed: 0.015,
    autopilotInterval: null,
    
    // MatatuCulture State
    trafficLightState: 'GREEN',
    isModalOpen: false,

    // ConductorRole State
    passengers: 0,
    maxPassengers: 14,
    currentDestination: null,
    targetMarker: null,
    currentStop: null,
};

// --- THREE.JS VARIABLES ---
let scene, camera, renderer;
export let matatuMesh; 
export const keyState = {}; 
export const touchControl = { forward: false, left: false, right: false }; 

// --- MODULE INSTANCES ---
let uiManager;
let physics;
let matatuCulture;
let conductorRole; 

// --- OBSTACLES AND ENVIRONMENT ---
export const obstacles = [];

// ----------------------------------
// --- 3D SCENE INITIALIZATION ---
// ----------------------------------

function createMatatuPlaceholder() {
    //     const matatuGroup = new THREE.Group();
    
    // 1. Main Body
    const bodyGeometry = new THREE.BoxGeometry(2.5, 1.5, 6);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: MATATU_BODY_COLOR }); 
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0; 
    
    // 2. Windows/Graphics Stripe
    const windowGeometry = new THREE.BoxGeometry(2.52, 0.7, 5.9);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x1f2937, transparent: true, opacity: 0.8 }); 
    const windows = new THREE.Mesh(windowGeometry, windowMaterial);
    windows.position.y = 0.4;
    
    // 3. Roof Spoiler/Mod
    const spoilerGeometry = new THREE.BoxGeometry(2.6, 0.2, 0.5);
    const spoilerMaterial = new THREE.MeshLambertMaterial({ color: MATATU_ACCENT_COLOR });
    const spoiler = new THREE.Mesh(spoilerGeometry, spoilerMaterial);
    spoiler.position.z = -2.8;
    spoiler.position.y = 0.85;

    // 4. Custom Headlights 
    const lightGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    const lightLeft = new THREE.Mesh(lightGeometry, lightMaterial);
    lightLeft.rotation.x = Math.PI / 2;
    lightLeft.rotation.z = Math.PI / 2;
    lightLeft.position.set(0.8, -0.3, -3.1);

    const lightRight = lightLeft.clone();
    lightRight.position.x = -0.8;

    matatuGroup.add(body);
    matatuGroup.add(windows);
    matatuGroup.add(spoiler);
    matatuGroup.add(lightLeft);
    matatuGroup.add(lightRight);

    return matatuGroup;
}

function createEnvironment() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500); 
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 }); 
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; 
    ground.position.y = GROUND_LEVEL - 0.01; 
    scene.add(ground);
    
    // Road Markings
    const markerGeometry = new THREE.BoxGeometry(0.1, 0.05, 3);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); 
    const segmentLength = 10; 
    for (let i = -50 / 2; i < 50 / 2; i++) {
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.z = i * segmentLength;
        marker.position.y = GROUND_LEVEL + 0.01; 
        scene.add(marker);
    }
    
    // Lampposts
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 10, 8);
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (let i = 0; i < 10; i++) {
        const lamppost = new THREE.Mesh(poleGeometry, poleMaterial);
        lamppost.position.x = (Math.random() > 0.5 ? 15 : -15) + (Math.random() * 5 - 2.5);
        lamppost.position.z = (Math.random() - 0.5) * 150;
        lamppost.position.y = GROUND_LEVEL + 5; 
        scene.add(lamppost);
    }
}

function createObstacles(count) {
    const coneGeometry = new THREE.ConeGeometry(CONE_SIZE * 0.3, CONE_SIZE * 1.5, 32);
    const coneMaterial = new THREE.MeshLambertMaterial({ color: 0xff4500 }); 
    const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 }); 

    for (let i = 0; i < count; i++) {
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(CONE_SIZE * 0.5, CONE_SIZE * 0.5, 0.1, 32), baseMaterial);
        
        base.position.y = -CONE_SIZE * 0.75; 

        const obstacleGroup = new THREE.Group();
        obstacleGroup.add(cone);
        obstacleGroup.add(base);

        obstacleGroup.position.x = (Math.random() - 0.5) * 6; 
        obstacleGroup.position.z = (Math.random() - 0.5) * 80;
        obstacleGroup.position.y = GROUND_LEVEL + CONE_SIZE * 0.75; 

        scene.add(obstacleGroup);
        obstacles.push(obstacleGroup);
    }
}

// FIX: Initialize Three.js objects first.
export function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); 
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvasContainer').appendChild(renderer.domElement);
    renderer.domElement.id = 'gameCanvas'; 

    scene.add(new THREE.AmbientLight(0xffffff, 0.6)); 
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    createEnvironment();
    matatuMesh = createMatatuPlaceholder();
    matatuMesh.position.y = GROUND_LEVEL + (MATATU_HEIGHT / 2); 
    scene.add(matatuMesh);
    
    createObstacles(OBSTACLE_COUNT);

    window.addEventListener('resize', onWindowResize);
    
    // Call the module initialization helper function
    initModules();
}

// NEW: Helper function to initialize modules after Three.js scene is created
function initModules() {
    // Dynamically import ConductorRole here to break the final dependency cycle
    import('./conductorRole.js').then(({ ConductorRole }) => {
        
        // Initialize Modules
        uiManager = new UIManager(gameState, touchControl); 
        physics = new Physics(gameState, matatuMesh, keyState, touchControl);
        matatuCulture = new MatatuCulture(gameState, matatuMesh, uiManager);
        conductorRole = new ConductorRole(gameState, matatuMesh, scene, uiManager);
        
        // Link UIManager actions to core logic
        uiManager.linkActions({
            switchRole: switchRole,
            handleRefuel: handleRefuel,
            handleConductorAction: conductorRole.handleConductorAction.bind(conductorRole),
            startRoute: startRoute,
            stopRoute: stopRoute,
        });
        
        // Setup UI listeners ONLY AFTER actions are linked
        uiManager.setupUI(); 
        
        matatuCulture.startTrafficLightCycle();

        // Start the animation loop
        animate(); 
        uiManager.showGameMessage("V11: Final Fixes Applied. The Matatu is ready to hit the road!", 7000);
    });
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ----------------------------------
// --- CORE GAME CONTROL FUNCTIONS ---
// ----------------------------------

export function startRoute() {
    if (!conductorRole) {
        console.error("ConductorRole not initialized yet.");
        return;
    }
    
    if (gameState.fuel <= 0) {
        if (!gameState.isDriving) uiManager.showGameMessage("Cannot start route. Fuel is empty!");
        return;
    }
    if (gameState.autopilotInterval !== null) return; 

    conductorRole.initRoute(); 
    gameState.autopilotInterval = setInterval(gameLoop, 500); 
    gameState.isDriving = true;
    uiManager.showGameMessage("Route started!", 2000);
}

export function stopRoute() {
    if (gameState.autopilotInterval === null) return; 

    clearInterval(gameState.autopilotInterval);
    gameState.autopilotInterval = null;
    gameState.speed = 0; 
    uiManager.showGameMessage("Route STOPPED.", 2000);
}

function handleRefuel() {
    const REFUELL_COST = 500;
    const REFUELL_AMOUNT = 100;
    
    if (gameState.fuel === 100) {
        uiManager.showGameMessage("Fuel is already full!", 2000);
        return;
    }
    if (gameState.cash >= REFUELL_COST) {
        gameState.cash -= REFUELL_COST;
        gameState.fuel = REFUELL_AMOUNT;
        uiManager.showGameMessage("Refueled! Back to 100%. Keep the money flowing!", 2000);
        stopRoute(); 
    } else {
        uiManager.showGameMessage("Insufficient funds! KSh 500 needed to refuel.", 3000);
    }
    uiManager.updateUI();
}

function switchRole() {
    if (gameState.isModalOpen) return;

    gameState.role = gameState.role === DRIVER ? CONDUCTOR : DRIVER;
    
    if (gameState.role === CONDUCTOR && !gameState.isDriving) {
         startRoute(); 
    }
    
    // Immediately stop driving when switching to conductor if the autopilot logic can take over
    if (gameState.role === CONDUCTOR) {
        uiManager.showGameMessage("Driver taking the wheel (Autopilot Active)!", 2000);
    }

    uiManager.showGameMessage(`Role switched to ${gameState.role}!`, 2000);
    uiManager.updateUI();
}

// ----------------------------------
// --- PASSIVE GAME LOOP (500ms) ---
// ----------------------------------

function gameLoop() {
    if (!gameState.isDriving || gameState.isModalOpen) return;

    // Passive fuel consumption and conductor earnings
    physics.consumeFuel();
    conductorRole.passiveRoleUpdate();
    
    uiManager.updateUI();
}

// ----------------------------------
// --- 3D ANIMATION LOOP (Request Frame) ---
// ----------------------------------

function updateCamera() {
    const distance = 5; 
    const height = 3;   
    const angle = matatuMesh.rotation.y;
    
    const targetX = matatuMesh.position.x - distance * Math.sin(angle);
    const targetZ = matatuMesh.position.z + distance * Math.cos(angle);

    camera.position.x = targetX;
    camera.position.y = height; 
    camera.position.z = targetZ; 

    const targetPosition = matatuMesh.position.clone();
    targetPosition.y += 0.5; 
    camera.lookAt(targetPosition);
}

export function checkCollision() {
    // Check collisions with Cones
    matatuCulture.checkObstacleCollision(matatuMesh, obstacles);
    // Check arrival at a stop/destination
    conductorRole.checkDestinationArrival(matatuMesh, scene);
}

function animate() {
    try {
        requestAnimationFrame(animate);

        if (!gameState.isModalOpen) {
            physics.driveUpdate(gameState.role);
            matatuCulture.checkTrafficViolation();
            // Conductor Autopilot needs to run in the high-frequency animation loop
            if (gameState.role === CONDUCTOR && gameState.autopilotInterval) {
                 conductorRole.autopilotDrive(gameState.speed);
            }
            checkCollision();
        }
        
        updateCamera();
        uiManager.updateUI(); 

        renderer.render(scene, camera);
    } catch (e) {
        console.error("Critical error in animation loop, stopping game:", e);
        // Do not call stopRoute, let the error propagate if it's severe
    }
}

// ----------------------------------
// --- ENTRY POINT ---
// ----------------------------------

window.onload = function() {
    // Set up keyboard listeners globally
    document.addEventListener('keydown', (e) => {
        keyState[e.key] = true;
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
            startRoute();
        }
    });
    document.addEventListener('keyup', (e) => {
        keyState[e.key] = false;
    });

    initScene();
};
