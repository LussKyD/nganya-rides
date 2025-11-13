import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { DRIVER, CONDUCTOR, stopRoute } from './game.js';

// Traffic Light States
const LIGHT_RED = 'RED';
const LIGHT_YELLOW = 'YELLOW';
const LIGHT_GREEN = 'GREEN';
const TRAFFIC_LIGHT_CYCLE = [
    { color: LIGHT_GREEN, duration: 8000, hex: '#10b981' }, 
    { color: LIGHT_YELLOW, duration: 2000, hex: '#fcd34d' }, 
    { color: LIGHT_RED, duration: 5000, hex: '#ef4444' }     
];

export class MatatuCulture {
    constructor(gameState, matatuMesh, uiManager) {
        this.gameState = gameState;
        this.matatuMesh = matatuMesh;
        this.uiManager = uiManager;
        
        this.trafficLightDisplay = document.getElementById('trafficLightDisplay');
    }

    // ----------------------------------
    // --- TRAFFIC LIGHT SYSTEM ---
    // ----------------------------------

    startTrafficLightCycle() {
        if (this.gameState.lightTimerId) return;

        let cycleIndex = 0;
        
        const transitionLight = () => {
            const currentLight = TRAFFIC_LIGHT_CYCLE[cycleIndex];
            
            this.gameState.trafficLightState = currentLight.color;
            this.trafficLightDisplay.style.backgroundColor = currentLight.hex;

            cycleIndex = (cycleIndex + 1) % TRAFFIC_LIGHT_CYCLE.length;
            this.gameState.lightTimerId = setTimeout(transitionLight, currentLight.duration);
        }

        transitionLight();
    }

    checkTrafficViolation() {
        if (this.gameState.role !== DRIVER || this.gameState.isModalOpen) return; 

        // 1. Check for running a Red Light 
        if (this.gameState.trafficLightState === LIGHT_RED && Math.abs(this.gameState.speed) > 0.005) {
             if (Math.random() < 0.2) { 
                stopRoute();
                this.triggerPoliceInteraction("Running a RED light! The officer demands a 'chai' (tea).");
                return;
             }
             this.uiManager.showGameMessage("You jumped the red light! (Reckless Driver Bonus + KSh 20)", 1500);
             this.gameState.cash += 20; 
        }
        
        // 2. Check for Reckless Speeding
        if (this.gameState.speed > this.gameState.maxSpeed * 1.5) {
             if (Math.random() < 0.05) { 
                stopRoute();
                this.triggerPoliceInteraction("Excessive Speeding! You need to 'sort out' the officer before they call the tow truck.");
                return;
             }
        }
    }

    // ----------------------------------
    // --- POLICE INTERACTION (BRIBERY) ---
    // ----------------------------------

    triggerPoliceInteraction(reason) {
        if (this.gameState.isModalOpen) return;

        this.gameState.speed = 0;
        this.gameState.isModalOpen = true;
        
        const fine = Math.floor(Math.random() * 300) + 150; 
        
        this.uiManager.showPoliceModal(fine, reason, this.handlePoliceDecision.bind(this));
    }

    handlePoliceDecision(action, fine) {
        if (action === 'pay') {
            if (this.gameState.cash >= fine) {
                this.gameState.cash -= fine;
                this.uiManager.showGameMessage(`Paid KSh ${fine}. "Fanya haraka." - Officer. Proceeding...`);
            } else {
                this.uiManager.showGameMessage("Not enough cash! Officer is delayed while waiting for payment.", 5000);
            }
        } else if (action === 'deny') {
            if (Math.random() < 0.3) { 
                this.uiManager.showGameMessage("You successfully argued your case! The officer lets you go.", 3000);
            } else {
                this.uiManager.showGameMessage("Detained! The officer issues a severe warning and takes KSh 1000 from the day's earnings.", 5000);
                this.gameState.cash = Math.max(0, this.gameState.cash - 1000);
            }
        }
        this.gameState.isModalOpen = false;
        this.uiManager.updateUI(); 
    }
    
    // ----------------------------------
    // --- COLLISION HANDLING ---
    // ----------------------------------
    
    checkObstacleCollision(matatuMesh, obstacles) {
        const matatuBoundingBox = new THREE.Box3().setFromObject(matatuMesh);

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            
            if (!obstacle) continue;

            // Simple distance check first for performance
            if (matatuMesh.position.distanceTo(obstacle.position) > 4) {
                continue;
            }

            const obstacleBoundingBox = new THREE.Box3().setFromObject(obstacle);

            if (matatuBoundingBox.intersectsBox(obstacleBoundingBox)) {
                
                this.gameState.speed *= 0.5; 
                this.gameState.cash = Math.max(0, this.gameState.cash - 50);
                
                this.uiManager.showGameMessage("BUMP! You hit a traffic cone. KSh 50 deducted for minor damage.", 2000);

                // Simple 'bounce back' effect
                const angle = matatuMesh.rotation.y;
                matatuMesh.position.x += 1 * Math.sin(angle);
                matatuMesh.position.z -= 1 * Math.cos(angle);
                
                // Remove the cone 
                matatuMesh.parent.remove(obstacle); // Use parent to remove from scene
                obstacles.splice(i, 1); 
            }
        }
    }
}
