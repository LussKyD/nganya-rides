import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { DRIVER, CONDUCTOR, stopRoute } from './game.js';

const AUTOPILOT_FARE_RATE = 5; 
const DESTINATIONS = [
    { name: "CBD", baseFare: 150, z: 20 },
    { name: "Kibera", baseFare: 100, z: -50 },
    { name: "Thika Road", baseFare: 200, z: 100 },
    { name: "Embakasi", baseFare: 120, z: -150 }
];
const STOP_RADIUS = 7; 

export class ConductorRole {
    constructor(gameState, matatuMesh, scene, uiManager) {
        this.gameState = gameState;
        this.matatuMesh = matatuMesh;
        this.scene = scene;
        this.uiManager = uiManager;
        
        this.targetMarkerMesh = null;
    }
    
    initRoute() {
        if (!this.gameState.currentDestination) {
            this.setNextDestination();
        }
    }

    setNextDestination() {
        const potentialDestinations = DESTINATIONS.filter(d => d.name !== (this.gameState.currentDestination ? this.gameState.currentDestination.name : ''));
        const newDestination = potentialDestinations[Math.floor(Math.random() * potentialDestinations.length)];
        
        this.gameState.currentDestination = newDestination;
        this.createDestinationMarker(newDestination);
    }

    createDestinationMarker(destination) {
        if (this.targetMarkerMesh) {
            this.scene.remove(this.targetMarkerMesh);
        }
        
        const geometry = new THREE.TorusGeometry(3, 0.5, 16, 100);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 });
        this.targetMarkerMesh = new THREE.Mesh(geometry, material);
        
        this.targetMarkerMesh.rotation.x = Math.PI / 2;
        this.targetMarkerMesh.position.set(0, 0.1, destination.z);
        
        this.scene.add(this.targetMarkerMesh);
        this.gameState.targetMarker = this.targetMarkerMesh.position;
    }

    // ----------------------------------
    // --- CONDUCTOR ACTIONS ---
    // ----------------------------------
    
    passiveRoleUpdate() {
        if (this.gameState.role === DRIVER) {
            // Conductor Autopilot: Collects small fares passively
            const autoFare = Math.floor(Math.random() * 5) + AUTOPILOT_FARE_RATE;
            this.gameState.cash += autoFare;
        } 
    }
    
    handleConductorAction(actionType) {
        if (!this.gameState.isDriving) {
            this.uiManager.showGameMessage("The matatu must be moving for business!", 3000);
            return;
        }
        if (this.gameState.role !== CONDUCTOR) return;

        if (actionType === 'pick_up' && this.gameState.currentStop === 'pick_up') {
            const passengersGained = Math.min(Math.floor(Math.random() * 5) + 3, this.gameState.maxPassengers - this.gameState.passengers);
            if (passengersGained > 0) {
                this.gameState.passengers += passengersGained;
                const fare = passengersGained * 50; 
                this.gameState.cash += fare;
                this.uiManager.showGameMessage(`Wacha tupande! Picked up ${passengersGained} passengers. KSh ${fare}.`, 2000);
                this.setNextDestination(); // Route to next destination
            } else {
                this.uiManager.showGameMessage("Matatu is full! Get going!", 2000);
            }
            this.gameState.currentStop = null; // Clear stop
            this.uiManager.updateConductorButtons(null);
        } 
        else if (actionType === 'drop_off' && this.gameState.currentStop === 'drop_off') {
            const totalFare = this.gameState.passengers * this.gameState.currentDestination.baseFare;
            this.gameState.cash += totalFare;
            this.gameState.passengers = 0;
            this.uiManager.showGameMessage(`Tushukishe! Dropped off all passengers. KSh ${totalFare} total profit!`, 3000);
            this.setNextDestination(); // Set up the next run
            this.gameState.currentStop = null; // Clear stop
            this.uiManager.updateConductorButtons(null);
        } else {
            this.uiManager.showGameMessage("Wait for the right stop/destination.", 2000);
        }
        this.uiManager.updateUI();
    }
    
    // ----------------------------------
    // --- DESTINATION CHECKING ---
    // ----------------------------------
    
    checkDestinationArrival(matatuMesh, scene) {
        if (!this.gameState.targetMarker) return;
        
        const distance = matatuMesh.position.distanceTo(this.gameState.targetMarker);

        if (distance < STOP_RADIUS) {
            // Check if this is the final destination (z is far from 0) or a random pick up stop (z is close to 0)
            const isFinalDestination = Math.abs(this.gameState.targetMarker.z) > 10;

            if (isFinalDestination) {
                this.gameState.currentStop = 'drop_off';
                this.uiManager.showGameMessage(`Arrived at ${this.gameState.currentDestination.name}. Drop off passengers!`, 3000);
                this.uiManager.updateConductorButtons('drop_off');
            } else if (!this.gameState.currentStop) {
                // If it's a random short stop
                this.gameState.currentStop = 'pick_up';
                this.uiManager.showGameMessage(`Stop for passengers! Quick pick up!`, 3000);
                this.uiManager.updateConductorButtons('pick_up');
            }
            
            // Remove the marker to prevent repeated triggers
            scene.remove(this.targetMarkerMesh);
            this.targetMarkerMesh = null;
            this.gameState.targetMarker = null;
        }
    }
    
    // ----------------------------------
    // --- AUTOPILOT DRIVING (When Conductor is User) ---
    // ----------------------------------
    
    autopilotDrive(currentSpeedAbs) {
        if (!this.gameState.targetMarker) {
            // If no target, just cruise randomly
            const cruisingSpeed = this.gameState.maxSpeed * 0.7;
            if (this.gameState.speed < cruisingSpeed) {
                this.gameState.speed = Math.min(cruisingSpeed, this.gameState.speed + this.gameState.acceleration / 4);
            }
            if (Math.random() < 0.01) {
                this.matatuMesh.rotation.y += (Math.random() - 0.5) * this.gameState.rotationSpeed * 0.5;
            }
            return;
        }
        
        // Logic to steer towards the target
        const targetVector = new THREE.Vector3().subVectors(this.gameState.targetMarker, this.matatuMesh.position);
        targetVector.y = 0; // Ignore vertical axis
        
        const targetAngle = Math.atan2(targetVector.x, targetVector.z);
        const currentAngle = this.matatuMesh.rotation.y;

        let angleDifference = targetAngle - currentAngle;

        // Normalize angle difference to be between -PI and PI
        if (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;
        if (angleDifference < -Math.PI) angleDifference += 2 * Math.PI;

        const maxTurn = this.gameState.rotationSpeed * 0.05; // Gentle turning
        
        if (Math.abs(angleDifference) > 0.1) {
            // Turn towards the target
            this.matatuMesh.rotation.y += Math.sign(angleDifference) * Math.min(Math.abs(angleDifference), maxTurn);
        }
        
        // Speed control: slow down near the target
        if (this.matatuMesh.position.distanceTo(this.gameState.targetMarker) > STOP_RADIUS * 2) {
            this.gameState.speed = Math.min(this.gameState.maxSpeed, this.gameState.speed + this.gameState.acceleration * 0.5);
        } else {
            this.gameState.speed = Math.max(0, this.gameState.speed - this.gameState.acceleration); // Brake
        }
        
        if (this.matatuMesh.position.distanceTo(this.gameState.targetMarker) < STOP_RADIUS) {
            this.gameState.speed = 0;
            // The checkDestinationArrival function handles the UI/game state change when stopped
        }
    }
}
