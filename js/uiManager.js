export class UIManager {
    constructor(gameState, touchControl) {
        this.gameState = gameState;
        this.touchControl = touchControl;
        
        // --- DOM Elements (Cached) ---
        this.roleDisplay = document.getElementById('roleDisplay');
        this.cashDisplay = document.getElementById('cashDisplay');
        this.fuelDisplay = document.getElementById('fuelDisplay');
        this.speedDisplay = document.getElementById('speedDisplay');
        this.switchRoleButton = document.getElementById('switchRoleButton');
        this.accelerateButton = document.getElementById('accelerateButton');
        this.turnLeftButton = document.getElementById('turnLeftButton');
        this.turnRightButton = document.getElementById('turnRightButton');
        this.pickUpButton = document.getElementById('pickUpButton');
        this.dropOffButton = document.getElementById('dropOffButton');
        this.conductorControls = document.getElementById('conductorControls');
        this.driverControls = document.getElementById('driverControls');
        this.driverControlsRight = document.getElementById('driverControlsRight');
        this.messageBox = document.getElementById('messageBox');
        this.refuelButton = document.getElementById('refuelButton');
        this.policeModal = document.getElementById('policeModal');
        this.payBribe = document.getElementById('payBribe');
        this.denyBribe = document.getElementById('denyBribe');
        this.fineAmountDisplay = document.getElementById('fineAmount');
        this.policeReasonDisplay = document.getElementById('policeReason');
        this.destinationDisplay = document.getElementById('destinationDisplay');
        this.passengerCountDisplay = document.getElementById('passengerCountDisplay');
        
        this.linkedActions = {};
    }
    
    // Links core functions from game.js
    linkActions(actions) {
        this.linkedActions = actions;
    }

    // CRITICAL FIX: Set up listeners ONLY when called from game.js AFTER actions are linked
    setupUI() {
        // Core Actions
        this.switchRoleButton.addEventListener('click', () => this.linkedActions.switchRole());
        this.refuelButton.addEventListener('click', () => this.linkedActions.handleRefuel());
        
        // Conductor Actions
        this.pickUpButton.addEventListener('click', () => this.linkedActions.handleConductorAction('pick_up'));
        this.dropOffButton.addEventListener('click', () => this.linkedActions.handleConductorAction('drop_off'));
        
        // Touch/Mouse Controls Setup
        const setupButton = (element, stateKey, startsRoute = false) => {
            const startFunc = () => { 
                element.classList.add('opacity-100'); 
                this.touchControl[stateKey] = true;
                if (startsRoute) this.linkedActions.startRoute(); 
            };
            const endFunc = () => { 
                element.classList.remove('opacity-100'); 
                this.touchControl[stateKey] = false;
            };
            
            element.addEventListener('touchstart', (e) => { e.preventDefault(); startFunc(); }, { passive: false });
            element.addEventListener('touchend', (e) => { e.preventDefault(); endFunc(); });
            element.addEventListener('mousedown', startFunc);
            element.addEventListener('mouseup', endFunc);
            element.addEventListener('mouseleave', endFunc); 
        };

        // Setup Player Driving Controls
        setupButton(this.accelerateButton, 'forward', true);
        setupButton(this.turnLeftButton, 'left');
        setupButton(this.turnRightButton, 'right');
    }

    updateUI() {
        const { gameState, DRIVER } = this;
        // Update HUD
        this.roleDisplay.textContent = gameState.role;
        this.roleDisplay.className = gameState.role === DRIVER ? 'text-red-600' : 'text-green-600';
        this.cashDisplay.textContent = `KSh ${Math.round(gameState.cash)}`;
        this.fuelDisplay.textContent = `${Math.round(gameState.fuel)}%`;
        // Convert speed magnitude to km/h for display
        this.speedDisplay.textContent = `${(Math.abs(gameState.speed) * 1000).toFixed(1)} km/h`; 
        
        this.destinationDisplay.textContent = gameState.currentDestination ? gameState.currentDestination.name : 'N/A';
        this.passengerCountDisplay.textContent = `${gameState.passengers}/${gameState.maxPassengers}`;

        // Update control visibility
        if (gameState.isModalOpen) {
            this.driverControls.style.display = 'none';
            this.driverControlsRight.style.display = 'none';
            this.conductorControls.style.display = 'none';
            this.refuelButton.style.display = 'none';
        } else {
            // Role-based controls
            if (gameState.role === DRIVER) {
                this.driverControls.style.display = 'flex';
                this.driverControlsRight.style.display = 'flex';
                this.conductorControls.style.display = 'none';
            } else {
                this.driverControls.style.display = 'none';
                this.driverControlsRight.style.display = 'none';
                this.conductorControls.style.display = gameState.isDriving ? 'flex' : 'none'; 
            }
            this.refuelButton.style.display = gameState.fuel < 100 && gameState.role === DRIVER ? 'block' : 'none';
        }
        
        // Update traffic light color
        if (gameState.trafficLightState) {
            const colors = { 'RED': '#ef4444', 'YELLOW': '#fcd34d', 'GREEN': '#10b981' };
            document.getElementById('trafficLightDisplay').style.backgroundColor = colors[gameState.trafficLightState] || '#333';
        }
    }

    updateConductorButtons(stopType) {
        this.pickUpButton.classList.add('hidden');
        this.dropOffButton.classList.add('hidden');

        if (stopType === 'pick_up') {
            this.pickUpButton.classList.remove('hidden');
        } else if (stopType === 'drop_off') {
            this.dropOffButton.classList.remove('hidden');
        }
    }


    showGameMessage(message, duration = 3000) {
        // Simple message box
        this.messageBox.textContent = message;
        this.messageBox.style.opacity = '1';
        clearTimeout(this.messageBox.timeout);
        this.messageBox.timeout = setTimeout(() => {
            this.messageBox.style.opacity = '0';
        }, duration);
    }
    
    showPoliceModal(fine, reason, callback) {
        this.policeReasonDisplay.textContent = reason;
        this.fineAmountDisplay.textContent = fine;
        this.policeModal.classList.remove('hidden');

        this.payBribe.onclick = () => {
            this.policeModal.classList.add('hidden');
            callback('pay', fine);
        };
        
        this.denyBribe.onclick = () => {
            this.policeModal.classList.add('hidden');
            callback('deny', fine);
        };
    }
}
