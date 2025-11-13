import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { gameState, DRIVER, CONDUCTOR, matatuMesh, keyState, touchControl, GROUND_LEVEL, MATATU_HEIGHT, stopRoute } from './game.js';
import { UIManager } from './uiManager.js';
import { ConductorRole } from './conductorRole.js'; // To access autopilot methods

const MIN_SPEED_THRESHOLD = 0.0001; 
const BRAKE_FORCE = 0.005; 
const DRAG_FACTOR = 0.0005; 
const FUEL_CONSUMPTION_RATE = 0.05;

export class Physics {
    constructor(gameState, matatuMesh, keyState, touchControl) {
        this.gameState = gameState;
        this.matatuMesh = matatuMesh;
        this.keyState = keyState;
        this.touchControl = touchControl;
        
        // This is a bit of a hack to get access to other modules without circular dependency issues
        // In a better system, all communication would happen through a central manager.
        this.conductorRole = new ConductorRole(gameState, matatuMesh, null, new UIManager()); 
    }

    consumeFuel() {
        this.gameState.fuel = Math.max(0, this.gameState.fuel - FUEL_CONSUMPTION_RATE); 
        if (this.gameState.fuel <= 0 && this.gameState.isDriving) {
            stopRoute();
            // Since UIManager is not imported directly, we show message via console or shared function if possible
            // We rely on the core game.js to stop the route and show the message
        }
    }

    driveUpdate(currentRole) {
        if (this.gameState.fuel <= 0 || this.gameState.isModalOpen) {
            this.gameState.speed = 0;
            if (this.gameState.fuel <= 0) stopRoute();
            return; 
        }
        
        // --- 1. Apply Resistance and Friction ---
        const speedSign = Math.sign(this.gameState.speed);
        const currentSpeedAbs = Math.abs(this.gameState.speed);
        
        if (currentSpeedAbs > MIN_SPEED_THRESHOLD) {
            const dragLoss = DRAG_FACTOR * currentSpeedAbs;
            const frictionLoss = this.gameState.friction;
            const totalLoss = dragLoss + frictionLoss;
            
            this.gameState.speed = (currentSpeedAbs - totalLoss) * speedSign;

            if (Math.sign(this.gameState.speed) !== speedSign) {
                this.gameState.speed = 0;
            }
        } else {
            this.gameState.speed = 0; 
        }
        
        // --- 2. Handle Movement Logic ---
        if (currentRole === DRIVER) {
            this.handlePlayerInput(currentSpeedAbs);
        } else if (currentRole === CONDUCTOR && this.gameState.autopilotInterval) {
            this.conductorRole.autopilotDrive(currentSpeedAbs); // Use the Conductor's autopilot drive logic
        }
        
        // --- 3. Apply Movement to Matatu Mesh ---
        if (Math.abs(this.gameState.speed) > MIN_SPEED_THRESHOLD) {
            const direction = new THREE.Vector3(0, 0, 1);
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.matatuMesh.rotation.y);
            
            this.matatuMesh.position.x += direction.x * this.gameState.speed;
            this.matatuMesh.position.z -= direction.z * this.gameState.speed; 
        }

        this.matatuMesh.position.y = GROUND_LEVEL + (MATATU_HEIGHT / 2); 
        
        this.gameState.isDriving = (Math.abs(this.gameState.speed) > MIN_SPEED_THRESHOLD);
    }
    
    handlePlayerInput(currentSpeedAbs) {
        const isAccelerating = this.keyState['w'] || this.keyState['W'] || this.keyState['ArrowUp'] || this.touchControl.forward;
        const isBraking = this.keyState['s'] || this.keyState['S'] || this.keyState['ArrowDown'];
        const isTurningLeft = this.keyState['a'] || this.keyState['A'] || this.keyState['ArrowLeft'] || this.touchControl.left;
        const isTurningRight = this.keyState['d'] || this.keyState['D'] || this.keyState['ArrowRight'] || this.touchControl.right;
        
        // Acceleration
        if (isAccelerating) {
            this.gameState.speed = Math.min(this.gameState.maxSpeed * 1.5, this.gameState.speed + this.gameState.acceleration); 
        } 
        
        // Braking 
        if (isBraking) {
            if (this.gameState.speed > 0) {
                 this.gameState.speed = Math.max(0, this.gameState.speed - BRAKE_FORCE); 
            } else if (this.gameState.speed < 0) {
                 this.gameState.speed = Math.min(0, this.gameState.speed + BRAKE_FORCE); 
            }
        } else if (currentSpeedAbs < MIN_SPEED_THRESHOLD) {
            // Allow reverse only if stopped
            if (isBraking) { 
                 this.gameState.speed = Math.max(-this.gameState.maxSpeed / 2, this.gameState.speed - this.gameState.acceleration); 
            }
        }

        // Turning (Only if moving and stable)
        if (currentSpeedAbs > MIN_SPEED_THRESHOLD) { 
            const speedRatio = Math.min(1.0, currentSpeedAbs / (this.gameState.maxSpeed * 1.5)); 
            const steeringScale = 1.0 - (0.7 * speedRatio); 
            
            const effectiveRotationSpeed = this.gameState.rotationSpeed * steeringScale;
            
            const turnFactor = Math.sign(this.gameState.speed) * effectiveRotationSpeed; 

            if (isTurningLeft) {
                this.matatuMesh.rotation.y += turnFactor;
            }
            if (isTurningRight) {
                this.matatuMesh.rotation.y -= turnFactor;
            }
        }
    }
}
