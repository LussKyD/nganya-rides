// js/modules/routes.js
// Route module with looped waypoints and stops for v0.6+
// Exposes RouteModule.path, RouteModule.stages, RouteModule.stops,
// RouteModule.getNearestWaypointIndex(pos)
// RouteModule.getLookaheadPoint(idx, dist)
// RouteModule.checkStageTransitions(idx)
// RouteModule.checkStopsProximity(pos, threshold)
// Events: 'stageReached', 'stopReached', 'routeReset'

(function (window) {
  const RouteModule = {};

  // Stage geometry - tune spacing to fit your world scale.
  RouteModule.stages = [
    { id: 1, name: "Ambassadeur", startX: 100, length: 400 },
    { id: 2, name: "Kencom", startX: 500, length: 540 },
    { id: 3, name: "Afya Centre", startX: 1050, length: 490 },
    { id: 4, name: "Railways", startX: 1540, length: 380 }
  ];

  // Build dense path of waypoints across stages (2D X,Y plane)
  RouteModule.path = [];
  RouteModule.stageIndexForWaypoint = [];

  (function buildPath() {
    RouteModule.path = [];
    RouteModule.stageIndexForWaypoint = [];
    for (let s = 0; s < RouteModule.stages.length; s++) {
      const st = RouteModule.stages[s];
      // create simple slightly-curved path for each stage
      const steps = Math.max(10, Math.floor(st.length / 30));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = st.startX + t * st.length;
        const y = 0;
        const z = Math.sin((s + t) * 1.2) * 8; // little lateral wiggle
        RouteModule.path.push({ x: x, y: y, z: z });
        RouteModule.stageIndexForWaypoint.push(s);
      }
    }
    // Optionally add connection from last stage back to first to loop
    // Add a few transition waypoints to smoothly loop
    const last = RouteModule.path[RouteModule.path.length - 1];
    const first = RouteModule.path[0];
    const loopSteps = 20;
    for (let i = 1; i <= loopSteps; i++) {
      const t = i / loopSteps;
      const x = last.x + (first.x + (t * 10) - last.x) * t;
      const z = last.z + (first.z - last.z) * t;
      RouteModule.path.push({ x: x + t * 20, y: 0, z: z });
      RouteModule.stageIndexForWaypoint.push(0); // keep as stage 0 for loop-tail
    }
  })();

  // Stops are at the last waypoint of each stage
  RouteModule.stops = RouteModule.stages.map((s, idx) => {
    // find last waypoint index for stage idx
    let lastWaypointIndex = -1;
    for (let i = RouteModule.stageIndexForWaypoint.length - 1; i >= 0; i--) {
      if (RouteModule.stageIndexForWaypoint[i] === idx) {
        lastWaypointIndex = i;
        break;
      }
    }
    const p = RouteModule.path[lastWaypointIndex] || RouteModule.path[0];
    return { stageId: s.id, name: s.name + " Stop", pos: { x: p.x, y: p.y, z: p.z }, collected: false };
  });

  // Lightweight event emitter
  const listeners = {};
  RouteModule.on = function (ev, cb) {
    listeners[ev] = listeners[ev] || [];
    listeners[ev].push(cb);
  };
  RouteModule.emit = function (ev, payload) {
    (listeners[ev] || []).forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error("RouteModule listener error", e);
      }
    });
  };

  RouteModule.getNearestWaypointIndex = function (pos) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < RouteModule.path.length; i++) {
      const dx = pos.x - RouteModule.path[i].x;
      const dz = pos.z - RouteModule.path[i].z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  };

  RouteModule.getLookaheadPoint = function (currentIndex, lookaheadDistance) {
    lookaheadDistance = lookaheadDistance || 80;
    let distAccum = 0;
    for (let i = currentIndex; i < RouteModule.path.length - 1; i++) {
      const p1 = RouteModule.path[i];
      const p2 = RouteModule.path[i + 1];
      const seg = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      distAccum += seg;
      if (distAccum >= lookaheadDistance) {
        return RouteModule.path[i + 1];
      }
    }
    // loop back: return first if reached end
    return RouteModule.path[0];
  };

  RouteModule.checkStageTransitions = function (currentWaypointIndex) {
    const stageIdx = RouteModule.stageIndexForWaypoint[currentWaypointIndex] || 0;
    if (typeof RouteModule._lastStageIdx === "undefined") RouteModule._lastStageIdx = stageIdx;
    if (stageIdx !== RouteModule._lastStageIdx) {
      RouteModule._lastStageIdx = stageIdx;
      const stage = RouteModule.stages[stageIdx];
      RouteModule.emit("stageReached", stage);
    }
  };

  RouteModule.checkStopsProximity = function (pos, threshold) {
    threshold = threshold || 60;
    for (let s of RouteModule.stops) {
      if (s.collected) continue;
      const dx = pos.x - s.pos.x;
      const dz = pos.z - s.pos.z;
      if (dx * dx + dz * dz <= threshold * threshold) {
        s.collected = true;
        RouteModule.emit("stopReached", s);
        return s;
      }
    }
    return null;
  };

  RouteModule.reset = function () {
    RouteModule.stages.forEach((s) => {
      s.reached = false;
    });
    RouteModule.stops.forEach((s) => (s.collected = false));
    RouteModule._lastStageIdx = undefined;
    RouteModule.emit("routeReset", RouteModule.stages);
  };

  window.RouteModule = RouteModule;
})(window);
