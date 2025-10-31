// js/modules/interactions.js
import { RouteStages, getNextStage, isStageReached } from './routes.js';

export class ConductorAutopilot {
  constructor(bus) {
    this.bus = bus;
    this.currentStage = 0;
    this.speed = 0.4;
    this.target = RouteStages[0];
    this.enabled = false;
  }
  toggle(state) {
    this.enabled = state !== undefined ? state : !this.enabled;
    if (this.enabled) console.log('Conductor autopilot engaged.');
  }
  update() {
    if (!this.enabled || !this.bus.position) return;
    const pos = this.bus.position;
    const dx = this.target.position[0] - pos.x;
    const dz = this.target.position[2] - pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 5) {
      console.log('Stage reached:', this.target.name);
      document.dispatchEvent(new CustomEvent('fareCollected', { detail: { stage: this.target.name, amount: 50 } }));
      this.currentStage = (this.currentStage + 1) % RouteStages.length;
      this.target = RouteStages[this.currentStage];
    } else {
      this.bus.position.x += (dx / dist) * this.speed;
      this.bus.position.z += (dz / dist) * this.speed;
    }
  }
}


// ✅ Added fallback ConductorAutopilot
export function ConductorAutopilot() {
  console.log('Autopilot engaged for conductor');
}
