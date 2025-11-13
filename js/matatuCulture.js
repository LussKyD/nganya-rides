// import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; // REMOVED
import { DRIVER } from './game.js';

const TRAFFIC_LIGHT_CYCLE = 10000; // 10 seconds per cycle segment (Green, Yellow, Red)
const VIOLATION_CHANCE = 0.4; 
const BASE_FINE = 200;

export class MatatuCulture {
    constructor(gameState, matatuMesh, uiManager) {
        this.gameState = gameState;
        this.matatuMesh = matatuMesh;
        this.uiManager = uiManager;
    }

    startTrafficLightCycle() {
        // Initial state set in game.js: 'GREEN'
        setInterval(() => {
            if (this.gameState.isModalOpen) return;
            
            let newState;
            if (this.gameState.trafficLightState === 'GREEN') {
                newState = 'YELLOW';
            } else if (this.gameState.trafficLightState === 'YELLOW') {
                newState = 'RED';
            } else {
                newState = 'GREEN';
            }
            
            this.gameState.trafficLightState = newState;
            this.uiManager.updateTrafficLight(newState);
        }, TRAFFIC_LIGHT_CYCLE);
    }
    
    checkTrafficViolation() {
        if (this.gameState.role !== DRIVER || this.gameState.isModalOpen) return;
        
        // Check for running a red light (reckless driving)
        if (this.gameState.trafficLightState === 'RED' && this.gameState.speed > 0.005) {
            this.gameState.cash += 20; // Small reward for risk

            if (Math.random() < VIOLATION_CHANCE) {
                this.triggerPoliceEncounter("Running a red light during rush hour.");
            }
        }
        
        // We could add speeding checks here too
    }
    
    checkObstacleCollision(matatuMesh, obstacles) {
        if (this.gameState.isModalOpen) return;
        
        // Simple bounding box for the matatu (using global THREE now)
        const matatuBox = new THREE.Box3().setFromObject(matatuMesh);

        for (const obstacle of obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            
            if (matatuBox.intersectsBox(obstacleBox)) {
                this.gameState.cash -= 50;
                this.gameState.speed *= 0.1; // Massive speed penalty
                this.uiManager.showGameMessage("Hit an obstacle (Cone)! KSh 50 penalty for property damage!", 2000);
                
                // Nudge the obstacle away after collision to prevent repeated triggers
                obstacle.position.z += this.gameState.speed > 0 ? -1 : 1;
                return; 
            }
        }
    }
    
    // ----------------------------------
    // --- POLICE ENCOUNTER (BRIBERY/EXTORTION) ---
    // ----------------------------------
    
    triggerPoliceEncounter(reason) {
        if (this.gameState.isModalOpen) return;
        
        this.gameState.isModalOpen = true;
        
        const fine = BASE_FINE + Math.floor(Math.random() * 200);
        this.uiManager.openPoliceModal(reason, fine, this.handlePoliceDecision.bind(this));
    }
    
    handlePoliceDecision(action, fine) {
        this.gameState.isModalOpen = false;
        
        if (action === 'pay') {
            if (this.gameState.cash >= fine) {
                this.gameState.cash -= fine;
                this.uiManager.showGameMessage(`Bribe paid (KSh ${fine}). Matatu is back on the road.`, 3000);
            } else {
                // Not enough cash to bribe
                this.uiManager.showGameMessage("Not enough cash! Detention risk increases...", 3000);
                this.handleDeny(fine); 
            }
        } else if (action === 'deny') {
            this.handleDeny(fine);
        }
        this.uiManager.updateUI();
    }
    
    handleDeny(fine) {
        // 50% chance of getting away, 50% chance of detention
        if (Math.random() < 0.5) {
            this.uiManager.showGameMessage("You talked your way out! Drive safe.", 3000);
        } else {
            const detentionPenalty = fine * 2;
            this.gameState.cash -= detentionPenalty;
            this.uiManager.showGameMessage(`Detained! Paid KSh ${detentionPenalty} official fine. Lose time & money.`, 5000);
        }
    }
}
