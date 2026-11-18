import * as THREE from "three";

export type LatticePattern = "honeycomb" | "diamond" | "round" | "square" | "triangle";
export type OrnamentConfig = {
  diameter: number;
  panelThickness: number;
  rimWidth: number;
  pattern: LatticePattern;
  cellSize: number;
  webWidth: number;
  connectorDiameter: number;
  connectorClearance: number;
  connectorHeight: number;
  includeLoop: boolean;
  loopDiameter: number;
  meshColor: string;
  designColor: string;
  pressColor: string;
};
export const defaultOrnamentConfig: OrnamentConfig = {
  diameter: 80,
  panelThickness: 1.6,
  rimWidth: 4,
  pattern: "honeycomb",
  cellSize: 7,
  webWidth: 1.2,
  connectorDiameter: 3,
  connectorClearance: 0.25,
  connectorHeight: 2.4,
  includeLoop: true,
  loopDiameter: 5,
  meshColor: "#198754",
  designColor: "#d9a520",
  pressColor: "#166534",
};
const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
export function validateOrnamentConfig(input: Partial<OrnamentConfig>): OrnamentConfig {
  const c = { ...defaultOrnamentConfig, ...input };
  const diameter = clamp(c.diameter, 40, 180);
  const rimWidth = clamp(c.rimWidth, 2, Math.min(12, diameter / 5));
  const cellSize = clamp(c.cellSize, 3, 18);
  return {
    ...c,
    diameter,
    panelThickness: clamp(c.panelThickness, 0.8, 4),
    rimWidth,
    cellSize,
    webWidth: clamp(c.webWidth, 0.6, Math.min(3, cellSize / 2)),
    connectorDiameter: clamp(c.connectorDiameter, 1.5, 6),
    connectorClearance: clamp(c.connectorClearance, 0.1, 0.6),
    connectorHeight: clamp(c.connectorHeight, 1, 5),
    loopDiameter: clamp(c.loopDiameter, 3, 12),
  };
}
type Point = [number, number];
function polygonPoints(x: number, y: number, radius: number, sides: number, rotation = 0): Point[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * Math.PI * 2) / sides;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
  });
}
function addHole(shape: THREE.Shape, points: Point[]) {
  const hole = new THREE.Path();
  [...points].reverse().forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
  hole.closePath();
  shape.holes.push(hole);
}
const connectorPositions = (radius: number): Point[] => [
  [radius, 0], [0, radius], [-radius, 0], [0, -radius],
];
export function createPerforatedPanel(config: Partial<OrnamentConfig>) {
  const c = validateOrnamentConfig(config);
  const innerRadius = c.diameter / 2 - c.rimWidth;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, innerRadius, 0, Math.PI * 2, false);
  const holeRadius = Math.max(0.8, (c.cellSize - c.webWidth) / 2);
  const shapeFactor = c.pattern === "diamond" ? 1.18 : c.pattern === "square" ? Math.SQRT2 : 1;
  const margin = holeRadius * shapeFactor + c.webWidth * 0.55;
  const points: Point[] = [];
  const rowStep = c.cellSize * (c.pattern === "honeycomb" || c.pattern === "triangle" ? 0.866 : 1);
  const colStep = c.cellSize;
  const rows = Math.ceil((innerRadius * 2) / rowStep) + 1;
  const cols = Math.ceil((innerRadius * 2) / colStep) + 1;
  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      const stagger = c.pattern === "honeycomb" || c.pattern === "triangle" ? (row & 1) * colStep / 2 : 0;
      const x = col * colStep + stagger;
      const y = row * rowStep;
      if (Math.hypot(x, y) <= innerRadius - margin) points.push([x, y]);
    }
  }
  for (const [x, y] of points) {
    if (c.pattern === "round") {
      const hole = new THREE.Path();
      hole.absarc(x, y, holeRadius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    } else {
      const sides = c.pattern === "square" ? 4 : c.pattern === "triangle" ? 3 : 6;
      const radius = c.pattern === "diamond" ? holeRadius * 1.18 : holeRadius;
      const rotation = c.pattern === "diamond" ? Math.PI / 4 : c.pattern === "triangle" ? -Math.PI / 2 : 0;
      addHole(shape, polygonPoints(x, y, radius, sides, rotation));
    }
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: c.panelThickness,
    bevelEnabled: false,
    curveSegments: 20,
    steps: 1,
  });
  geometry.computeVertexNormals();
  return { geometry, perforationCount: points.length, config: c };
}
function makeRim(config: OrnamentConfig, connectorHoles = false) {
  const outer = new THREE.Shape();
  outer.absarc(0, 0, config.diameter / 2, 0, Math.PI * 2, false);
  const inner = new THREE.Path();
  inner.absarc(0, 0, config.diameter / 2 - config.rimWidth, 0, Math.PI * 2, true);
  outer.holes.push(inner);
  if (connectorHoles) {
    const connectorRadius = config.diameter / 2 - config.rimWidth / 2;
    for (const [x, y] of connectorPositions(connectorRadius)) {
      const hole = new THREE.Path();
      hole.absarc(x, y, config.connectorDiameter / 2 + config.connectorClearance, 0, Math.PI * 2, true);
      outer.holes.push(hole);
    }
  }
  return new THREE.ExtrudeGeometry(outer, {
    depth: config.panelThickness,
    bevelEnabled: false,
    curveSegments: 96,
  });
}
export function buildOrnament(input: Partial<OrnamentConfig>) {
  const c = validateOrnamentConfig(input);
  const group = new THREE.Group();
  group.name = "ornament-press-fit";
  const meshMaterial = new THREE.MeshStandardMaterial({ color: c.meshColor, roughness: 0.72 });
  const designMaterial = new THREE.MeshStandardMaterial({ color: c.designColor, roughness: 0.5 });
  const pressMaterial = new THREE.MeshStandardMaterial({ color: c.pressColor, roughness: 0.55 });
  const front = createPerforatedPanel(c);
  const back = createPerforatedPanel(c);
  const frontMesh = new THREE.Mesh(front.geometry, meshMaterial);
  frontMesh.name = "front-perforated-panel";
  group.add(frontMesh);
  const frontRim = new THREE.Mesh(makeRim(c), designMaterial);
  frontRim.name = "front-solid-rim";
  group.add(frontRim);
  const pinRadius = c.diameter / 2 - c.rimWidth / 2;
  connectorPositions(pinRadius).forEach(([x, y], index) => {
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(c.connectorDiameter / 2, c.connectorDiameter / 2, c.connectorHeight, 24),
      pressMaterial,
    );
    pin.name = `press-pin-${index + 1}`;
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, y, c.panelThickness + c.connectorHeight / 2);
    group.add(pin);
  });
  const backAssembly = new THREE.Group();
  backAssembly.name = "rear-perforated-panel";
  const backMesh = new THREE.Mesh(back.geometry, meshMaterial);
  backMesh.position.z = c.panelThickness + c.connectorHeight * 0.6;
  backAssembly.add(backMesh);
  const backRim = new THREE.Mesh(makeRim(c, true), designMaterial);
  backRim.position.z = c.panelThickness + c.connectorHeight * 0.6;
  backAssembly.add(backRim);
  group.add(backAssembly);
  if (c.includeLoop) {
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(c.loopDiameter, Math.max(0.7, c.panelThickness / 2), 12, 48),
      designMaterial,
    );
    loop.name = "hanging-loop";
    loop.position.set(0, c.diameter / 2 - c.rimWidth / 2, c.panelThickness / 2);
    group.add(loop);
  }
  group.userData = {
    perforationCount: front.perforationCount,
    triangles: countTriangles(group),
    dimensionsMm: { x: c.diameter, y: c.diameter, z: c.panelThickness * 2 + c.connectorHeight * 0.6 },
    config: c,
  };
  return group;
}
export function countTriangles(object: THREE.Object3D) {
  let triangles = 0;
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry;
    const index = geometry.getIndex();
    const position = geometry.getAttribute("position");
    triangles += index ? index.count / 3 : position.count / 3;
  });
  return Math.floor(triangles);
}
export function disposeOrnament(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}
