// js/components/bus.js
// Procedural bus model + simple visual kinematic controller.
// Expose Bus class: constructor(scene), methods: setPosition(x,y,z), update(dt), applySteer(s), applyThrottle(t)

import * as THREE from "three";

export class Bus {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // identity physical state (kinematic fallback)
    this.x = opts.x || 120;
    this.y = opts.y || 0;
    this.z = opts.z || 0;
    this.angle = opts.angle || 0; // radians, 0 facing +X
    this.speed = 0;
    this._throttle = 0;
    this._steer = 0;

    // Build model
    this.buildBody();
    this.buildWheels();
    this.buildWindows();
    this.buildDoors();
    this.buildSeatsAndPassengers();

    // camera follow offset (third person)
    this.cameraOffsetTP = new THREE.Vector3(-20, 8, 0);
    this.cameraOffsetFP = new THREE.Vector3(2.2, 2.6, 0.5);

    // add a small shadow plane if needed
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 12), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.15, transparent: true }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.group.add(shadow);

    // passengers list (for simple own visuals)
    this.passengers = [];
  }

  // create main bus body
  buildBody() {
    const body = new THREE.Group();
    // body chassis
    const bodyGeo = new THREE.BoxGeometry(6, 3, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc7441f, metalness: 0.1, roughness: 0.6 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 1.8;
    body.add(bodyMesh);

    // roof
    const roofGeo = new THREE.BoxGeometry(6.2, 0.6, 12.2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc3c12, metalness: 0.1, roughness: 0.6 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 3.05;
    body.add(roof);

    // front windscreen (simple)
    const windMat = new THREE.MeshStandardMaterial({ color: 0x112233, opacity: 0.95, transparent: true });
    const windGeo = new THREE.PlaneGeometry(5.2, 1.6);
    const wind = new THREE.Mesh(windGeo, windMat);
    wind.position.set(0, 2.2, -5.9);
    wind.rotation.y = 0;
    body.add(wind);

    this.body = body;
    this.group.add(this.body);
  }

  // wheels as cylinders
  buildWheels() {
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.5 });
    const positions = [
      { x: -2.4, z: -4.3 },
      { x: 2.4, z: -4.3 },
      { x: -2.4, z: 4.0 },
      { x: 2.4, z: 4.0 }
    ];
    positions.forEach((p) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p.x, 0.7, p.z);
      this.group.add(w);
      this.wheels.push(w);
    });
  }

  // windows as separate panels that slide (transform by position)
  buildWindows() {
    this.windows = [];
    const winMat = new THREE.MeshStandardMaterial({ color: 0x0d1b2a, opacity: 0.8, transparent: true });
    const rows = 4;
    for (let i = 0; i < rows; i++) {
      const wGeo = new THREE.PlaneGeometry(2, 0.9);
      const w = new THREE.Mesh(wGeo, winMat.clone());
      w.position.set(-1.4 + i * 1.2, 2.1, 0.4);
      w.rotation.y = 0;
      // store closed position and open offset
      w.userData.closedX = w.position.x;
      w.userData.openOffset = 0.9; // slides along X
      this.windows.push(w);
      this.group.add(w);
    }
  }

  // simple door that rotates open
  buildDoors() {
    this.door = new THREE.Group();
    const doorGeo = new THREE.BoxGeometry(0.2, 1.8, 2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x661100, metalness: 0.1 });
    const d = new THREE.Mesh(doorGeo, doorMat);
    d.position.set(3.01, 1.2, 0.8);
    this.door.add(d);
    this.group.add(this.door);
    this.door.userData.closedAngle = 0;
    this.door.userData.openAngle = Math.PI / 2.2;
    this.door.userData.isOpen = false;
  }

  // seats + passenger placeholder
  buildSeatsAndPassengers() {
    this.seats = [];
    const seatGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c <= 1; c += 2) {
        const s = new THREE.Mesh(seatGeo, seatMat);
        s.position.set(c * 1.2, 1.0, -3 + r * 1.6);
        this.group.add(s);
        this.seats.push(s);
      }
    }

    // spawn simple passengers (a few)
    const passengerMat = new THREE.MeshStandardMaterial({ color: 0xffe0b2 });
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), passengerMat);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x334455 }));
      head.position.set(0, 0.6, 0);
      body.position.set(0, 0.15, 0);
      p.add(head);
      p.add(body);
      // assign to seat
      const seat = this.seats[i % this.seats.length];
      p.position.copy(seat.position).add(new THREE.Vector3(0, 0.3, 0));
      this.group.add(p);
      this.passengers.push({ group: p, seatIndex: i % this.seats.length, bob: Math.random() * Math.PI * 2 });
    }
  }

  // methods
  setPosition(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.group.position.set(this.x, this.y, this.z);
  }

  setRotation(angleRad) {
    this.angle = angleRad;
    this.group.rotation.y = -this.angle; // three.js rotation sign convention
  }

  applySteer(s) {
    this._steer = s; // -1..1
  }

  applyThrottle(t) {
    this._throttle = t; // -1..1
  }

  // animate windows (value 0..1, 1 -> fully open)
  setWindowOpen(value) {
    this.windows.forEach((w) => {
      w.position.x = w.userData.closedX - w.userData.openOffset * value;
    });
  }

  // toggle door open boolean (animated in update)
  toggleDoor(open) {
    this.door.userData.isOpen = open;
  }

  // small kinematic update (call each frame)
  update(dt) {
    // simple physics: steering rotates angle slightly based on steer & speed
    const steerAngle = this._steer * 0.04; // radians per frame factor
    // update angle based on steering and speed
    this.angle += steerAngle * Math.min(1, Math.abs(this._throttle) + 0.1) * dt * 10;
    // accelerate / decelerate
    const accel = this._throttle * 3.5; // tune
    this.speed += accel * dt;
    // clamp
    this.speed = Math.max(0, Math.min(8, this.speed));
    // move forward in local X direction
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.z += Math.sin(this.angle) * this.speed * dt;

    // position & rotation
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = -this.angle;

    // wheels rotate visually
    this.wheels.forEach((w) => {
      w.rotation.x += (this.speed / 0.8) * dt;
    });

    // door animation
    const targetAngle = this.door.userData.isOpen ? this.door.userData.openAngle : this.door.userData.closedAngle;
    // rotate around left hinge: for simplicity rotate the door group
    this.door.rotation.y += (targetAngle - this.door.rotation.y) * Math.min(1, dt * 6);

    // animate passengers bobbing
    this.passengers.forEach((p, i) => {
      p.bob += dt * 3;
      p.group.position.y = 0.3 + Math.sin(p.bob) * 0.02;
    });
  }

  // convenience to set from external physics
  setFromState(state) {
    if (!state) return;
    if ("x" in state && "z" in state) this.setPosition(state.x, state.y || 0, state.z);
    if ("angle" in state) this.setRotation(state.angle);
    if ("speed" in state) this.speed = state.speed;
  }

  // animate window auto based on speed (open at stops)
  autoWindowBehaviour(isStopped) {
    this.setWindowOpen(isStopped ? 1 : 0);
  }

  // Fare collection visual: open door, play small animation, close
  playFareCollectAnim() {
    this.toggleDoor(true);
    setTimeout(() => this.toggleDoor(false), 1400);
  }
}
