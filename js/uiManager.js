export class UIManager {
    constructor() {
        // --- DOM Elements ---
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
        this.setupEventListeners();
    }
    
    // Links core functions from game.js
    linkActions(actions) {
        this.linkedActions = actions;
    }

    setupEventListeners() {
        this.switchRoleButton.addEventListener('click', () => this.linkedActions.switchRole());
        this.refuelButton.addEventListener('click', () => this.linkedActions.handleRefuel());
        
        // Conductor Actions
        this.pickUpButton.addEventListener('click', () => this.linkedActions.handleConductorAction('pick_up'));
        this.dropOffButton.addEventListener('click', () => this.linkedActions.handleConductorAction('drop_off'));
        
        // Touch/Mouse Controls Setup
        const setupButton = (element, key, isTurn = false) => {
            const startFunc = () => { element.classList.add('opacity-100'); if (isTurn) { this.linkedActions.startRoute(); } };
            const endFunc = () => { element.classList.remove('opacity-100'); };
            
            element.addEventListener('touchstart', (e) => { e.preventDefault(); key.value = true; startFunc(); }, { passive: false });
            element.addEventListener('touchend', (e) => { e.preventDefault(); key.value = false; endFunc(); });
            element.addEventListener('mousedown', () => { key.value = true; startFunc(); });
            element.addEventListener('mouseup', () => { key.value = false; endFunc(); });
            element.addEventListener('mouseleave', () => { key.value = false; endFunc(); }); 
        };

        // Need to import touchControl object and modify its properties
        import('./game.js').then(({ touchControl }) => {
            setupButton(this.accelerateButton, { value: false, set value(v) { touchControl.forward = v; if(v) this.linkedActions.startRoute(); } });
            setupButton(this.turnLeftButton, { value: false, set value(v) { touchControl.left = v; } }, true);
            setupButton(this.turnRightButton, { value: false, set value(v) { touchControl.right = v; } }, true);
        });
    }

    updateUI() {
        import('./game.js').then(({ gameState, DRIVER }) => {
            // Update HUD
            this.roleDisplay.textContent = gameState.role;
            this.roleDisplay.className = gameState.role === DRIVER ? 'text-red-600' : 'text-green-600';
            this.cashDisplay.textContent = `KSh ${Math.round(gameState.cash)}`;
            this.fuelDisplay.textContent = `${Math.round(gameState.fuel)}%`;
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
            
            // Update traffic light color (Relies on MatatuCulture module setting gameState.trafficLightState)
            if (gameState.trafficLightState) {
                const colors = { 'RED': '#ef4444', 'YELLOW': '#fcd34d', 'GREEN': '#10b981' };
                document.getElementById('trafficLightDisplay').style.backgroundColor = colors[gameState.trafficLightState] || '#333';
            }
        });
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
