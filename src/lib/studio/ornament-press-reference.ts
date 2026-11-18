import * as THREE from "three";
import {
  validatePressOrnamentConfig,
  type PressOrnamentConfig,
  type PressPreviewMode,
} from "@/lib/studio/ornament-press";

export type PressReferencePreviewMode =
  | PressPreviewMode
  | "mold-print"
  | "female-mold"
  | "male-plunger";

/**
 * Reference measurements reverse-engineered from ball_ornament.zip:
 * ball_ornament.3mf + mesh_lattice.stl + press_cavity_block.stl + press_plunger.stl.
 * All coordinates are millimetres, in the source STL's XY build-plate convention.
 */
export const GIGAPRINT_BALL_REFERENCE = {
  nominalBallDiameter: 100,
  flatMeshOuterRadius: 58.5,
  latticeRadius: 50,
  meshThickness: 1.2,
  rimThickness: 2.4,
  hexHoleAcross: 5,
  hexStrut: 1.2,
  stretchPercent: 53,
  formedThickness: 0.79,
  pressGap: 1.5,
  pressTopZ: 38,
  cavityBottomZ: 3,
  cavityEdgeZ: 35.5,
  plungerSeatZ: 10,
  plungerApexZ: 43.5,
  blockBounds: [127.58, 147.145, 45] as const,
  guidePostDiameter: 8,
  guideHoleDiameter: 8.6,
  guidePostHeight: 7,
  locatorPostDiameter: 2.8,
  locatorPostHeight: 2,
  joinPinDiameter: 3,
  joinPinHeight: 2,
  joinHoleDiameter: 3.2,
  hangingHoleDiameter: 3.6,
  maleJoinPins: [
    [-27.5, 47.61],
    [54.98, 0],
    [-27.5, -47.63],
  ] as const,
  femaleJoinHoles: [
    [27.5, -47.61],
    [-54.98, 0],
    [27.5, 47.63],
  ] as const,
  hangingEarCenter: [0, 61.08] as const,
  locatorPinCenters: [
    [27.5, -47.61],
    [-54.98, 0],
    [27.5, 47.63],
  ] as const,
  guidePostCenters: [
    [-46.88, 46.88],
    [46.88, 46.88],
    [0, -66.3],
  ] as const,
};

const CAVITY_PROFILE: readonly (readonly [number, number])[] = [
  [0, 3], [2, 3.021], [4, 3.115], [6, 3.235], [8, 3.398],
  [10, 3.683], [12, 3.95], [14, 4.262], [16, 4.753], [18, 5.179],
  [20, 5.657], [22, 6.379], [24, 6.989], [26, 7.661], [28, 8.662],
  [30, 9.5], [32, 10.42], [34, 11.792], [36, 12.946], [38, 14.226],
  [40, 16.069], [42, 17.866], [44, 20.238], [46, 23.072], [48, 26.4],
  [49, 29.1], [50, 35.5],
];

const PLUNGER_PRINT_PROFILE: readonly (readonly [number, number])[] = [
  [0, 43.5], [2, 43.479], [4, 43.383], [6, 43.26], [8, 43.094],
  [10, 42.803], [12, 42.53], [14, 42.211], [16, 41.709], [18, 41.273],
  [20, 40.784], [22, 40.043], [24, 39.417], [26, 38.725], [28, 37.692],
  [30, 36.826], [32, 35.871], [34, 34.441], [36, 33.23], [38, 31.78],
  [40, 29.957], [42, 27.955], [44, 25.581], [46, 22.325], [48, 15.845],
  [49, 11.45], [50, 11.007],
];

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;

function interpolateProfile(profile: readonly (readonly [number, number])[], radius: number) {
  const r = clamp(radius, profile[0]![0], profile[profile.length - 1]![0]);
  for (let index = 0; index < profile.length - 1; index++) {
    const a = profile[index]!;
    const b = profile[index + 1]!;
    if (r <= b[0]) {
      const t = (r - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return profile[profile.length - 1]![1];
}

function profileSlope(profile: readonly (readonly [number, number])[], radius: number) {
  const delta = 0.15;
  const before = interpolateProfile(profile, Math.max(0, radius - delta));
  const after = interpolateProfile(profile, Math.min(50, radius + delta));
  const span = Math.min(50, radius + delta) - Math.max(0, radius - delta);
  return span > 0 ? (after - before) / span : 0;
}

function circleHole(cx: number, cy: number, radius: number) {
  const hole = new THREE.Path();
  hole.absarc(cx, cy, radius, 0, Math.PI * 2, true);
  return hole;
}

function pointyHexHole(cx: number, cy: number, across = 5) {
  const radius = across / Math.sqrt(3);
  const points: [number, number][] = [
    [0, -radius],
    [across / 2, -radius / 2],
    [across / 2, radius / 2],
    [0, radius],
    [-across / 2, radius / 2],
    [-across / 2, -radius / 2],
  ];
  const path = new THREE.Path();
  points.reverse().forEach(([x, y], index) => {
    if (index === 0) path.moveTo(cx + x, cy + y);
    else path.lineTo(cx + x, cy + y);
  });
  path.closePath();
  return path;
}

function addHoneycombHoles(shape: THREE.Shape, config: PressOrnamentConfig, maxRadius: number) {
  const spacing = config.holeSize + config.ribWidth;
  const rowStep = spacing * Math.sqrt(3) / 2;
  const rows = Math.ceil(maxRadius / rowStep) + 2;
  const cols = Math.ceil(maxRadius / spacing) + 2;
  const holeAcross = config.holeSize;
  const holeRadius = holeAcross / Math.sqrt(3);
  let count = 0;

  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      const x = col * spacing + ((row & 1) ? spacing / 2 : 0);
      const y = row * rowStep;
      // Keep the outer cells clear of the rim, pin seats and eyelet tab.
      if (Math.hypot(x, y) > maxRadius - holeRadius * 0.6) continue;
      shape.holes.push(pointyHexHole(x, y, holeAcross));
      count++;
    }
  }
  return count;
}

function roundedTriangleShape(
  width = 127.58,
  height = 147.145,
  corner = 11,
  centerOffsetY = 0,
) {
  const vertices: [number, number][] = [
    [-width / 2, height / 2 + centerOffsetY],
    [width / 2, height / 2 + centerOffsetY],
    [0, -height / 2 + centerOffsetY],
  ];
  const shape = new THREE.Shape();
  const starts = vertices.map((point, index) => {
    const previous = vertices[(index + vertices.length - 1) % vertices.length]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const inLength = Math.hypot(previous[0] - point[0], previous[1] - point[1]);
    const outLength = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const cut = Math.min(corner, inLength * 0.22, outLength * 0.22);
    return {
      incoming: [
        point[0] + ((previous[0] - point[0]) / inLength) * cut,
        point[1] + ((previous[1] - point[1]) / inLength) * cut,
      ] as [number, number],
      outgoing: [
        point[0] + ((next[0] - point[0]) / outLength) * cut,
        point[1] + ((next[1] - point[1]) / outLength) * cut,
      ] as [number, number],
      control: point,
    };
  });
  shape.moveTo(starts[0]!.incoming[0], starts[0]!.incoming[1]);
  for (let index = 0; index < starts.length; index++) {
    const current = starts[index]!;
    const next = starts[(index + 1) % starts.length]!;
    shape.quadraticCurveTo(
      current.control[0],
      current.control[1],
      current.outgoing[0],
      current.outgoing[1],
    );
    shape.lineTo(next.incoming[0], next.incoming[1]);
  }
  shape.closePath();
  return shape;
}

function createFlatLatticePanel(config: PressOrnamentConfig) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 50 * (config.diameter / 100), 0, Math.PI * 2, false);
  const count = config.pattern === "honeycomb"
    ? addHoneycombHoles(shape, config, 49.5 * (config.diameter / 100))
    : addSimplePatternHoles(shape, config, 49.5 * (config.diameter / 100));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: config.panelThickness,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.userData["perforationCount"] = count;
  geometry.userData["referencePattern"] = config.pattern;
  return { geometry, perforationCount: count };
}

function addSimplePatternHoles(shape: THREE.Shape, config: PressOrnamentConfig, maxRadius: number) {
  const spacing = config.holeSize + config.ribWidth;
  const rowStep = spacing * (config.pattern === "triangle" ? 0.866 : 1);
  const rows = Math.ceil(maxRadius / rowStep) + 2;
  const cols = Math.ceil(maxRadius / spacing) + 2;
  let count = 0;
  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      const x = col * spacing + ((config.pattern === "honeycomb" && (row & 1)) ? spacing / 2 : 0);
      const y = row * rowStep;
      if (Math.hypot(x, y) > maxRadius - config.holeSize * 0.7) continue;
      if (config.pattern === "round") {
        shape.holes.push(circleHole(x, y, config.holeSize / 2));
      } else {
        const sides = config.pattern === "triangle" ? 3 : 4;
        const rotation = config.pattern === "diamond" ? Math.PI / 4 : config.pattern === "triangle" ? -Math.PI / 2 : 0;
        const r = config.holeSize / (config.pattern === "square" ? Math.SQRT2 : 2);
        const path = new THREE.Path();
        for (let vertex = 0; vertex < sides; vertex++) {
          const angle = rotation + vertex * Math.PI * 2 / sides;
          const px = x + Math.cos(angle) * r;
          const py = y + Math.sin(angle) * r;
          if (vertex === 0) path.moveTo(px, py);
          else path.lineTo(px, py);
        }
        path.closePath();
        shape.holes.push(path);
      }
      count++;
    }
  }
  return count;
}

function annulusShape(config: PressOrnamentConfig, includeConnectorHoles = true) {
  const outer = 58.5 * (config.diameter / 100);
  const inner = 50 * (config.diameter / 100);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  shape.holes.push(circleHole(0, 0, inner));
  if (includeConnectorHoles) {
    for (const [x, y] of GIGAPRINT_BALL_REFERENCE.femaleJoinHoles) {
      shape.holes.push(circleHole(
        x * config.diameter / 100,
        y * config.diameter / 100,
        1.6 * config.diameter / 100,
      ));
    }
  }
  return shape;
}

function createHangingEar(config: PressOrnamentConfig, zDepth: number) {
  const scale = config.diameter / 100;
  const shape = new THREE.Shape();
  shape.moveTo(-5.5 * scale, 53 * scale);
  shape.lineTo(-5.5 * scale, 60.5 * scale);
  shape.quadraticCurveTo(-5.5 * scale, 66.5 * scale, 0, 66.5 * scale);
  shape.quadraticCurveTo(5.5 * scale, 66.5 * scale, 5.5 * scale, 60.5 * scale);
  shape.lineTo(5.5 * scale, 53 * scale);
  shape.closePath();
  shape.holes.push(circleHole(0, 61.08 * scale, 1.8 * scale));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: zDepth,
    bevelEnabled: false,
    curveSegments: 24,
  });
  return geometry;
}

function makeMaterial(color: string, roughness = 0.68) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}

function addCylinderAt(
  group: THREE.Group,
  name: string,
  x: number,
  y: number,
  radius: number,
  height: number,
  baseZ: number,
  color: string,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 32),
    makeMaterial(color),
  );
  mesh.name = name;
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, baseZ + height / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function buildReferenceFlatBlank(input: Partial<PressOrnamentConfig> = {}) {
  const config = validatePressOrnamentConfig(input);
  const group = new THREE.Group();
  group.name = "gigaprint-flat-mesh-blank";

  const panel = createFlatLatticePanel(config);
  const panelMesh = new THREE.Mesh(panel.geometry, makeMaterial(config.meshColor, 0.55));
  panelMesh.name = "flat-honeycomb-panel";
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;
  group.add(panelMesh);

  const rimGeometry = new THREE.ExtrudeGeometry(annulusShape(config), {
    depth: config.rimWidth,
    bevelEnabled: false,
    curveSegments: 96,
  });
  const rim = new THREE.Mesh(rimGeometry, makeMaterial(config.meshColor, 0.55));
  rim.name = "reinforced-2p4mm-perimeter-rim";
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  if (config.joinMethod === "pins") {
    const scale = config.diameter / 100;
    GIGAPRINT_BALL_REFERENCE.maleJoinPins.forEach(([x, y], index) => {
      addCylinderAt(
        group,
        "hemisphere-join-pin-" + (index + 1),
        x * scale,
        y * scale,
        1.5 * scale,
        2 * scale,
        config.rimWidth,
        config.pressColor,
      );
    });
  }

  if (config.includeLoop) {
    const ear = new THREE.Mesh(createHangingEar(config, config.rimWidth), makeMaterial(config.meshColor));
    ear.name = "hanging-ear-with-3p6mm-hole";
    ear.castShadow = true;
    ear.receiveShadow = true;
    group.add(ear);
  }

  group.userData["component"] = "flat-mesh";
  group.userData["perforationCount"] = panel.perforationCount;
  group.userData["nominalBallDiameterMm"] = config.diameter;
  group.userData["flatBlankBoundsMm"] = [117, 125.1, 4.4];
  group.userData["sourceReference"] = "GigaPrint ball_ornament.3mf / mesh_lattice.stl";
  return group;
}

function createProfileVolume(
  profile: readonly (readonly [number, number])[],
  bottomZ: number,
  topRimZ: number,
  radialScale: number,
) {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0, bottomZ),
    new THREE.Vector2(50 * radialScale, bottomZ),
    new THREE.Vector2(50 * radialScale, topRimZ),
  ];
  for (let index = profile.length - 1; index >= 0; index--) {
    const [r, z] = profile[index]!;
    points.push(new THREE.Vector2(r * radialScale, z));
  }
  points.push(new THREE.Vector2(0, bottomZ));
  const geometry = new THREE.LatheGeometry(points, 128);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function createMoldBlockBase(config: PressOrnamentConfig, topZ: number, scale: number) {
  const shape = roundedTriangleShape(127.58 * scale, 147.145 * scale, 11 * scale, -1.6945 * scale);
  shape.holes.push(circleHole(0, 0, 50 * scale));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: topZ,
    bevelEnabled: false,
    curveSegments: 48,
  });
  const base = new THREE.Mesh(geometry, makeMaterial(config.pressColor, 0.74));
  base.name = "female-cavity-block-body";
  base.castShadow = true;
  base.receiveShadow = true;
  return base;
}

export function buildReferenceFemaleMold(input: Partial<PressOrnamentConfig> = {}) {
  const config = validatePressOrnamentConfig(input);
  const scale = config.diameter / 100;
  const depthScale = config.pressDepth / 32.5;
  const topZ = 38 * depthScale;
  const group = new THREE.Group();
  group.name = "gigaprint-female-cavity-mold";

  group.add(createMoldBlockBase(config, topZ, scale));

  const cavityProfile = CAVITY_PROFILE.map(([r, z]) => [r * scale, z * depthScale] as const);
  // The input profile is already scaled into model millimetres.
  const bowlGeometry = createProfileVolume(cavityProfile, 0, topZ, 1);
  const bowl = new THREE.Mesh(bowlGeometry, makeMaterial(config.pressColor, 0.66));
  bowl.name = "female-concave-forming-surface";
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);

  GIGAPRINT_BALL_REFERENCE.locatorPinCenters.forEach(([x, y], index) => {
    addCylinderAt(
      group,
      "mesh-locator-pin-" + (index + 1),
      x * scale,
      y * scale,
      1.4 * scale,
      2 * depthScale,
      topZ,
      config.pressColor,
    );
  });

  GIGAPRINT_BALL_REFERENCE.guidePostCenters.forEach(([x, y], index) => {
    addCylinderAt(
      group,
      "plunger-guide-post-" + (index + 1),
      x * scale,
      y * scale,
      4 * scale,
      7 * depthScale,
      topZ,
      config.pressColor,
    );
  });

  group.userData["component"] = "female-cavity-block";
  group.userData["topPlaneZ"] = topZ;
  group.userData["cavityProfile"] = cavityProfile;
  group.userData["guidePostDiameterMm"] = 8 * scale;
  group.userData["locatorPinDiameterMm"] = 2.8 * scale;
  return group;
}

function createPlungerFlange(config: PressOrnamentConfig, scale: number, plateDepth: number) {
  const shape = roundedTriangleShape(127.364 * scale, 147.144 * scale, 11 * scale, -1.6945 * scale);
  GIGAPRINT_BALL_REFERENCE.guidePostCenters.forEach(([x, y]) => {
    shape.holes.push(circleHole(x * scale, y * scale, 4.3 * scale));
  });
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: plateDepth,
    bevelEnabled: false,
    curveSegments: 48,
  });
  const flange = new THREE.Mesh(geometry, makeMaterial(config.pressColor, 0.72));
  flange.name = "male-plunger-flange-with-three-8p6mm-guide-holes";
  flange.castShadow = true;
  flange.receiveShadow = true;
  return flange;
}

function createPlungerDome(config: PressOrnamentConfig, scale: number, depthScale: number) {
  const profile = PLUNGER_PRINT_PROFILE.map(([r, z]) => [r * scale, z * depthScale] as const);
  const plateTop = 10 * depthScale;
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0, plateTop),
    new THREE.Vector2(50 * scale, plateTop),
    new THREE.Vector2(50 * scale, 11 * depthScale),
  ];
  for (let index = profile.length - 1; index >= 0; index--) {
    const [r, z] = profile[index]!;
    points.push(new THREE.Vector2(r, z));
  }
  points.push(new THREE.Vector2(0, plateTop));
  const geometry = new THREE.LatheGeometry(points, 128);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const dome = new THREE.Mesh(geometry, makeMaterial(config.pressColor, 0.62));
  dome.name = "male-plunger-dome-1p5mm-surface-gap";
  dome.castShadow = true;
  dome.receiveShadow = true;
  return dome;
}

export function buildReferenceMalePlunger(input: Partial<PressOrnamentConfig> = {}) {
  const config = validatePressOrnamentConfig(input);
  const scale = config.diameter / 100;
  const depthScale = config.pressDepth / 32.5;
  const plateDepth = 10 * depthScale;
  const group = new THREE.Group();
  group.name = "gigaprint-male-press-plunger";
  group.add(createPlungerFlange(config, scale, plateDepth));
  group.add(createPlungerDome(config, scale, depthScale));
  group.userData["component"] = "male-plunger";
  group.userData["guideHoleDiameterMm"] = 8.6 * scale;
  group.userData["flangeSeatPlaneZ"] = plateDepth;
  group.userData["printOrientation"] = "dome-up";
  return group;
}

function buildPressAssembly(config: PressOrnamentConfig, openGap = 16) {
  const group = new THREE.Group();
  group.name = "gigaprint-press-tooling-open";
  const cavity = buildReferenceFemaleMold(config);
  group.add(cavity);

  const plunger = buildReferenceMalePlunger(config);
  // Reverse the print orientation, exactly as the README instructs. The
  // original z=10 flange face becomes the seat at z=38; dome faces down.
  plunger.rotation.y = Math.PI;
  plunger.position.z = 48 * (config.pressDepth / 32.5) + openGap;
  plunger.name = "working-orientation-inverted-plunger";
  group.add(plunger);

  group.userData["workingGapMm"] = 1.5;
  group.userData["fullPressSeatPlaneZ"] = 38 * (config.pressDepth / 32.5);
  group.userData["plungerOpenGapMm"] = openGap;
  return group;
}

function profileDomeZ(radius: number, config: PressOrnamentConfig) {
  const r = clamp(radius, 0, 50);
  const scale = config.diameter / 100;
  const radial = r / scale;
  const depthScale = config.pressDepth / 32.5;
  return (35.5 - interpolateProfile(CAVITY_PROFILE, radial)) * depthScale;
}

function createFormedLattice(config: PressOrnamentConfig, sign: 1 | -1) {
  const scale = config.diameter / 100;
  const finalThickness = config.panelThickness / (1 + config.stretchPercent / 100);
  const flat = createFlatLatticePanel(config);
  const geometry = flat.geometry;
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radius = Math.min(50 * scale, Math.hypot(x, y));
    const angle = Math.atan2(y, x);
    const normalizedRadius = radius / scale;
    const surfaceZ = profileDomeZ(radius, config);
    const slope = -profileSlope(CAVITY_PROFILE, normalizedRadius) * (config.pressDepth / 32.5);
    const normalLength = Math.sqrt(1 + slope * slope);
    const layer = clamp(z / config.panelThickness, 0, 1);
    const normalOffset = (layer - 0.5) * finalThickness;
    const radialOffset = -normalOffset * slope / normalLength;
    const verticalOffset = normalOffset / normalLength;
    const mappedRadius = radius + radialOffset;
    position.setXYZ(
      index,
      mappedRadius * Math.cos(angle),
      mappedRadius * Math.sin(angle),
      sign * (surfaceZ + verticalOffset),
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData["formedThicknessMm"] = finalThickness;
  geometry.userData["stretchPercent"] = config.stretchPercent;
  geometry.userData["perforationCount"] = flat.perforationCount;
  return { geometry, perforationCount: flat.perforationCount, finalThickness };
}

function buildHalf(config: PressOrnamentConfig, sign: 1 | -1, addDesign = true) {
  const group = new THREE.Group();
  group.name = sign === 1 ? "formed-front-hemisphere" : "formed-back-hemisphere";
  const scale = config.diameter / 100;
  const ringDepth = config.rimWidth;

  const dome = createFormedLattice(config, sign);
  const shell = new THREE.Mesh(dome.geometry, makeMaterial(config.meshColor, 0.55));
  shell.name = sign === 1 ? "front-curved-honeycomb-shell" : "back-curved-honeycomb-shell";
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(annulusShape(config), {
      depth: ringDepth,
      bevelEnabled: false,
      curveSegments: 96,
    }),
    makeMaterial(config.meshColor, 0.55),
  );
  rim.name = sign === 1 ? "front-flat-joining-rim" : "back-flat-joining-rim";
  rim.position.z = sign === 1 ? -ringDepth : 0;
  group.add(rim);

  if (config.joinMethod === "pins") {
    GIGAPRINT_BALL_REFERENCE.maleJoinPins.forEach(([x, y], index) => {
      addCylinderAt(
        group,
        "formed-join-pin-" + (index + 1),
        x * scale,
        y * scale,
        1.5 * scale,
        2 * scale,
        sign === 1 ? 0 : -2 * scale,
        config.pressColor,
      );
    });
  }

  if (config.includeLoop) {
    const ear = new THREE.Mesh(
      createHangingEar(config, ringDepth),
      makeMaterial(config.meshColor),
    );
    ear.name = "formed-hanging-ear";
    ear.position.z = sign === 1 ? -ringDepth : 0;
    group.add(ear);
  }

  if (addDesign && config.design !== "plain") addDomeMotif(group, config, sign);
  group.userData["stretchPercent"] = config.stretchPercent;
  group.userData["formedThicknessMm"] = dome.finalThickness;
  group.userData["perforationCount"] = dome.perforationCount;
  return group;
}

function domePoint(x: number, y: number, config: PressOrnamentConfig, sign: 1 | -1, offset = 0) {
  const radius = Math.min(49.5 * config.diameter / 100, Math.hypot(x, y));
  const angle = Math.atan2(y, x);
  const surfaceZ = profileDomeZ(radius, config);
  const slope = -profileSlope(CAVITY_PROFILE, radius / (config.diameter / 100)) * (config.pressDepth / 32.5);
  const normal = Math.sqrt(1 + slope * slope);
  return new THREE.Vector3(
    (radius - offset * slope / normal) * Math.cos(angle),
    (radius - offset * slope / normal) * Math.sin(angle),
    sign * (surfaceZ + offset / normal),
  );
}

function motifLines(config: PressOrnamentConfig): [number, number][][] {
  const r = config.designWidth / 2;
  const lines: [number, number][][] = [];
  if (config.design === "snowflake") {
    for (let arm = 0; arm < 6; arm++) {
      const angle = arm * Math.PI / 3;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      lines.push([[0, 0], [ux * r, uy * r]]);
      for (const side of [-1, 1]) {
        const start = r * 0.58, end = r * 0.84;
        const branch = angle + side * Math.PI / 3;
        lines.push([[ux * start, uy * start], [ux * start + Math.cos(branch) * (end - start), uy * start + Math.sin(branch) * (end - start)]]);
      }
    }
  } else if (config.design === "star") {
    lines.push(Array.from({ length: 11 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const length = index % 2 ? r * 0.45 : r;
      return [Math.cos(angle) * length, Math.sin(angle) * length] as [number, number];
    }));
  } else if (config.design === "heart") {
    lines.push(Array.from({ length: 65 }, (_, index) => {
      const t = index / 64 * Math.PI * 2;
      return [16 * Math.sin(t) ** 3 * r / 18, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * r / 18] as [number, number];
    }));
  } else if (config.design === "tree") {
    lines.push([[0, -r], [-r * 0.7, -r * 0.25], [-r * 0.42, -r * 0.25], [-r * 0.8, r * 0.2], [-r * 0.4, r * 0.2], [0, r], [r * 0.4, r * 0.2], [r * 0.8, r * 0.2], [r * 0.42, -r * 0.25], [r * 0.7, -r * 0.25], [0, -r]]);
  }
  return lines;
}

function addDomeMotif(group: THREE.Group, config: PressOrnamentConfig, sign: 1 | -1) {
  const material = makeMaterial(config.designColor, 0.5);
  for (const line of motifLines(config)) {
    if (line.length < 2) continue;
    const points = line.map(([x, y]) => domePoint(x, y, config, sign, config.designHeight * 0.5));
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(32, line.length * 6), Math.max(0.45, config.designHeight * 0.5), 8, false),
      material,
    );
    mesh.name = "decorative-" + config.design;
    group.add(mesh);
  }
}

function buildAssembledOrnament(config: PressOrnamentConfig, exploded = false) {
  const group = new THREE.Group();
  group.name = exploded ? "exploded-two-half-ornament" : "assembled-two-half-ornament";
  const front = buildHalf(config, 1, true);
  const back = buildHalf(config, -1, true);
  back.rotation.z = Math.PI;
  if (exploded) {
    const gap = 10;
    front.position.z = gap;
    back.position.z = -gap;
  }
  group.add(front);
  group.add(back);
  group.userData["halves"] = 2;
  group.userData["connectorCountPerHalf"] = 3;
  group.userData["assembledDepthReferenceMm"] = 69.8;
  return group;
}

export function buildPressOrnamentReference(
  input: Partial<PressOrnamentConfig>,
  mode: PressReferencePreviewMode = "system",
) {
  const config = validatePressOrnamentConfig(input);
  const group = new THREE.Group();
  group.name = "gigaprint-ball-press-reference-" + mode;

  if (mode === "flat") {
    group.add(buildReferenceFlatBlank(config));
  } else if (mode === "mold") {
    group.add(buildPressAssembly(config, 16));
  } else if (mode === "mold-print") {
    const block = buildReferenceFemaleMold(config);
    const plunger = buildReferenceMalePlunger(config);
    block.position.x = -75;
    plunger.position.x = 75;
    group.add(block, plunger);
  } else if (mode === "female-mold") {
    group.add(buildReferenceFemaleMold(config));
  } else if (mode === "male-plunger") {
    group.add(buildReferenceMalePlunger(config));
  } else if (mode === "half") {
    group.add(buildHalf(config, 1, true));
  } else if (mode === "assembled") {
    group.add(buildAssembledOrnament(config, false));
  } else {
    const tooling = buildPressAssembly(config, 17);
    tooling.position.x = -155;
    group.add(tooling);

    const blank = buildReferenceFlatBlank(config);
    blank.position.x = 0;
    group.add(blank);

    const formed = buildAssembledOrnament(config, true);
    formed.position.x = 155;
    group.add(formed);
  }

  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.userData["dimensionsMm"] = {
    x: Number(size.x.toFixed(2)),
    y: Number(size.y.toFixed(2)),
    z: Number(size.z.toFixed(2)),
  };
  group.userData["config"] = config;
  group.userData["previewMode"] = mode;
  group.userData["source"] = "STL/3MF reverse engineering from user-supplied ball_ornament.zip";
  group.userData["pressGapMm"] = 1.5;
  group.userData["formedThicknessMm"] = config.panelThickness / (1 + config.stretchPercent / 100);
  group.userData["manufacturingNote"] =
    "Geometria reconstituída da referência. Confirme tolerâncias, fatiamento e resistência térmica no Bambu Studio antes de fabricar.";
  return group;
}

export function countReferenceTriangles(object: THREE.Object3D) {
  let count = 0;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const index = child.geometry.getIndex();
    const position = child.geometry.getAttribute("position");
    count += (index ? index.count : position.count) / 3;
  });
  return Math.floor(count);
}

export function disposeReferenceOrnament(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}
