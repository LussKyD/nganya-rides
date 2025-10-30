// js/modules/interactions.js
// Conductor autopilot that fully drives the bus and collects fares (pure JS, ThreeJS-agnostic)
// Exposes: InteractionModule.switchRole(role), .isAutopilot(), .updateAutopilot(vehicle)
// Emits: 'roleChanged', 'fareCollected'

(function (window) {
  const InteractionModule = {};
  InteractionModule.role = "driver";
  InteractionModule.autopilot = false;

  const listeners = {};
  InteractionModule.on = function (ev, cb) {
    listeners[ev] = listeners[ev] || [];
    listeners[ev].push(cb);
  };
  InteractionModule.emit = function (ev, payload) {
    (listeners[ev] || []).forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error("InteractionModule listener error", e);
      }
    });
  };

  InteractionModule.switchRole = function (newRole) {
    if (newRole !== "driver" && newRole !== "conductor") return;
    InteractionModule.role = newRole;
    InteractionModule.autopilot = newRole === "conductor";
    InteractionModule.emit("roleChanged", { role: InteractionModule.role, autopilot: InteractionModule.autopilot });
    console.log("[InteractionModule] role:", InteractionModule.role, "autopilot:", InteractionModule.autopilot);
  };

  InteractionModule.getRole = function () {
    return InteractionModule.role;
  };
  InteractionModule.isAutopilot = function () {
    return !!InteractionModule.autopilot;
  };

  // PID for throttle
  function PID(kp, ki, kd) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this._prev = 0;
    this._int = 0;
  }
  PID.prototype.update = function (err, dt) {
    this._int += err * dt;
    const deriv = (err - this._prev) / (dt || 1e-3);
    this._prev = err;
    return this.kp * err + this.ki * this._int + this.kd * deriv;
  };

  function computeSteer(vehicleX, vehicleZ, vehicleAngle, lookaheadX, lookaheadZ) {
    // Pure pursuit in XZ-plane. vehicleAngle in radians, where 0 faces +X.
    const dx = lookaheadX - vehicleX;
    const dz = lookaheadZ - vehicleZ;
    // rotate by -vehicleAngle
    const localX = dx * Math.cos(-vehicleAngle) - dz * Math.sin(-vehicleAngle);
    const localZ = dx * Math.sin(-vehicleAngle) + dz * Math.cos(-vehicleAngle);
    const steerAng = Math.atan2(localZ, localX); // angle to lookahead
    const maxSteerRad = Math.PI / 4;
    return Math.max(-1, Math.min(1, steerAng / maxSteerRad));
  }

  const state = {
    targetSpeed: 3.8, // in world units per second — tune to your physics units
    pid: new PID(1.6, 0.02, 0.12),
    lastWaypointIndex: 0,
    lookaheadDistance: 90
  };

  InteractionModule.updateAutopilot = function (vehicle) {
    // vehicle: { x, z, angle (radians), speed (units/sec), dt }
    if (!InteractionModule.autopilot || typeof window.RouteModule === "undefined") return null;
    const path = window.RouteModule.path;
    if (!path || path.length === 0) return null;

    // find nearest waypoint (search near last known for performance)
    let nearest = state.lastWaypointIndex;
    let bestDist = Infinity;
    const start = Math.max(0, state.lastWaypointIndex - 20);
    const end = Math.min(path.length, state.lastWaypointIndex + 120);
    for (let i = start; i < end; i++) {
      const dx = vehicle.x - path[i].x;
      const dz = vehicle.z - path[i].z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }
    state.lastWaypointIndex = nearest;

    // publish stage transitions
    if (window.RouteModule && typeof window.RouteModule.checkStageTransitions === "function") {
      window.RouteModule.checkStageTransitions(nearest);
    }

    // lookahead point
    const lookahead = window.RouteModule.getLookaheadPoint(nearest, state.lookaheadDistance);

    // compute steering
    const steer = computeSteer(vehicle.x, vehicle.z, vehicle.angle || 0, lookahead.x, lookahead.z);

    // throttle (targetSpeed unit variance) - vehicle.speed is units/sec
    const speedErr = state.targetSpeed - (vehicle.speed || 0);
    const throttleCmd = state.pid.update(speedErr, Math.max(vehicle.dt || 1 / 60, 1e-3));
    const throttle = Math.max(-0.2, Math.min(1, throttleCmd)); // allow mild braking (neg throttle) if needed

    // stops proximity -> emit fareCollected
    if (window.RouteModule && typeof window.RouteModule.checkStopsProximity === "function") {
      const stop = window.RouteModule.checkStopsProximity({ x: vehicle.x, y: 0, z: vehicle.z }, 80);
      if (stop) {
        InteractionModule.emit("fareCollected", { stop: stop, time: Date.now() });
      }
    }

    return { throttle: throttle, steer: steer, nearestWaypointIndex: nearest, lookahead: lookahead };
  };

  window.InteractionModule = InteractionModule;
})(window);
