// js/modules/routes.js
export const RouteStages = [
  { name: "Ambassadeur", position: [0, 0, 0] },
  { name: "Kencom", position: [200, 0, -50] },
  { name: "Afya Centre", position: [400, 0, -80] },
  { name: "Railways", position: [600, 0, -120] },
];

export function getNextStage(currentIndex) {
  return RouteStages[(currentIndex + 1) % RouteStages.length];
}

export function isStageReached(busPos, targetPos, threshold = 10) {
  const dx = busPos.x - targetPos[0];
  const dz = busPos.z - targetPos[2];
  return Math.sqrt(dx * dx + dz * dz) < threshold;
}
