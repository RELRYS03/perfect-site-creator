import * as THREE from "three";

export type PressOrnamentForm = "ball" | "egg" | "bell" | "finial" | "star" | "heart" | "tree";
export type PressLatticePattern = "honeycomb" | "diamond" | "round" | "square" | "triangle";
export type PressOrnamentDesign =
  | "snowflake"
  | "star"
  | "tree"
  | "heart"
  | "candy-cane"
  | "bell"
  | "gift"
  | "snowman"
  | "plain";
export type PressJoinMethod = "pins" | "glue";
export type PressPreviewMode = "system" | "flat" | "mold" | "half" | "assembled";

export type PressOrnamentConfig = {
  form: PressOrnamentForm;
  diameter: number;
  pressDepth: number;
  panelThickness: number;
  rimWidth: number;
  pattern: PressLatticePattern;
  holeSize: number;
  ribWidth: number;
  design: PressOrnamentDesign;
  designWidth: number;
  designHeight: number;
  backDesign: boolean;
  stretchPercent: number;
  joinMethod: PressJoinMethod;
  clearance: number;
  includeLoop: boolean;
  loopDiameter: number;
  meshColor: string;
  designColor: string;
  pressColor: string;
};

export const defaultPressOrnamentConfig: PressOrnamentConfig = {
  form: "ball",
  diameter: 100,
  pressDepth: 32.5,
  panelThickness: 1.2,
  rimWidth: 2.4,
  pattern: "honeycomb",
  holeSize: 5,
  ribWidth: 1.2,
  design: "plain",
  designWidth: 28,
  designHeight: 0.8,
  backDesign: false,
  stretchPercent: 53,
  joinMethod: "pins",
  clearance: 0.1,
  includeLoop: true,
  loopDiameter: 3.6,
  meshColor: "#F2A0B5",
  designColor: "#F2A0B5",
  pressColor: "#2E8B57",
};

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;

export function validatePressOrnamentConfig(
  input: Partial<PressOrnamentConfig>,
): PressOrnamentConfig {
  const c = { ...defaultPressOrnamentConfig, ...input };
  const valid = <T extends string>(value: T, values: readonly T[], fallback: T) =>
    values.includes(value) ? value : fallback;
  const diameter = clamp(c.diameter, 50, 140);
  const validColor = (value: string, fallback: string) =>
    /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  return {
    form: valid(c.form, ["ball", "egg", "bell", "finial", "star", "heart", "tree"], "ball"),
    diameter,
    pressDepth: clamp(c.pressDepth, 12, diameter * 0.62),
    panelThickness: clamp(c.panelThickness, 0.8, 2.4),
    rimWidth: clamp(c.rimWidth, 2.2, Math.min(8, diameter / 8)),
    pattern: valid(
      c.pattern,
      ["honeycomb", "diamond", "round", "square", "triangle"],
      "honeycomb",
    ),
    holeSize: clamp(c.holeSize, 2.5, 10),
    ribWidth: clamp(c.ribWidth, 0.65, 2.8),
    design: valid(
      c.design,
      ["snowflake", "star", "tree", "heart", "candy-cane", "bell", "gift", "snowman", "plain"],
      "snowflake",
    ),
    designWidth: clamp(c.designWidth, 12, diameter * 0.62),
    designHeight: clamp(c.designHeight, 0.25, 1.8),
    backDesign: Boolean(c.backDesign),
    stretchPercent: clamp(c.stretchPercent, 0, 80),
    joinMethod: valid(c.joinMethod, ["pins", "glue"], "pins"),
    clearance: clamp(c.clearance, 0.1, 0.6),
    includeLoop: Boolean(c.includeLoop),
    loopDiameter: clamp(c.loopDiameter, 3, 10),
    meshColor: validColor(c.meshColor, defaultPressOrnamentConfig.meshColor),
    designColor: validColor(c.designColor, defaultPressOrnamentConfig.designColor),
    pressColor: validColor(c.pressColor, defaultPressOrnamentConfig.pressColor),
  };
}

type Point2 = [number, number];
type Line2 = Point2[];

function formFactor(form: PressOrnamentForm, angle: number) {
  const upper = Math.max(0, Math.sin(angle));
  const lower = Math.max(0, -Math.sin(angle));
  switch (form) {
    case "egg":
      return 1 - 0.17 * upper + 0.05 * lower;
    case "bell":
      return 1 - 0.21 * upper + 0.04 * lower;
    case "finial":
      return 0.94 - 0.18 * upper + 0.1 * lower;
    case "star":
      return 0.84 + 0.16 * Math.cos(5 * (angle - Math.PI / 2));
    case "heart":
      return 0.88 + 0.12 * Math.cos(2 * (angle + Math.PI / 2));
    case "tree":
      return 0.78 + 0.22 * Math.cos(3 * (angle - Math.PI / 2));
    default:
      return 1;
  }
}

function radialLimit(form: PressOrnamentForm, baseRadius: number, angle: number) {
  return baseRadius * formFactor(form, angle);
}

function addPolygonHole(shape: THREE.Shape, points: Point2[]) {
  const path = new THREE.Path();
  [...points].reverse().forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  path.closePath();
  shape.holes.push(path);
}

function regularPolygon(
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation = 0,
): Point2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index * Math.PI * 2) / sides;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
  });
}

function createLatticeShape(config: PressOrnamentConfig) {
  const baseRadius = config.diameter / 2 - config.rimWidth;
  const shape = new THREE.Shape();
  const boundarySegments = 120;
  for (let index = 0; index <= boundarySegments; index++) {
    const angle = (index / boundarySegments) * Math.PI * 2;
    const radius = radialLimit(config.form, baseRadius, angle);
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const spacing = config.holeSize + config.ribWidth * 1.25;
  const rowStep = spacing * (config.pattern === "honeycomb" ? 0.866 : 1);
  const rows = Math.ceil((baseRadius * 2) / rowStep) + 1;
  const cols = Math.ceil((baseRadius * 2) / spacing) + 1;
  const holeRadius = config.holeSize / 2;
  const points: Point2[] = [];
  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      const stagger = config.pattern === "honeycomb" ? (row & 1) * spacing / 2 : 0;
      const x = col * spacing + stagger;
      const y = row * rowStep;
      const distance = Math.hypot(x, y);
      const angle = Math.atan2(y, x);
      const polygonAllowance = config.pattern === "square" ? 1.42 : 1.08;
      if (
        distance < radialLimit(config.form, baseRadius, angle) - holeRadius * polygonAllowance - config.ribWidth
        && points.length < 1800
      ) {
        points.push([x, y]);
      }
    }
  }

  for (const [x, y] of points) {
    if (config.pattern === "round") {
      const hole = new THREE.Path();
      hole.absarc(x, y, holeRadius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      continue;
    }
    const sides =
      config.pattern === "honeycomb"
        ? 6
        : config.pattern === "triangle"
          ? 3
          : 4;
    const rotation =
      config.pattern === "diamond"
        ? Math.PI / 4
        : config.pattern === "triangle"
          ? -Math.PI / 2
          : 0;
    const factor = config.pattern === "square" ? 0.9 : 1;
    addPolygonHole(shape, regularPolygon(x, y, holeRadius * factor, sides, rotation));
  }
  return { shape, perforationCount: points.length, baseRadius };
}

function warpToDome(
  geometry: THREE.BufferGeometry,
  config: PressOrnamentConfig,
  sign: 1 | -1,
  baseRadius: number,
) {
  const position = geometry.getAttribute("position");
  const thickness = config.panelThickness;
  const sphereRadius = config.diameter / 2;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const layer = clamp(position.getZ(index) / thickness, 0, 1);
    const angle = Math.atan2(y, x);
    const factor = formFactor(config.form, angle);
    const limit = Math.max(0.001, baseRadius * factor);
    const normalizedRadius = clamp(Math.hypot(x, y) / limit, 0, 0.99999);
    const theta = Math.asin(normalizedRadius);
    const innerOffset = (1 - layer) * thickness;
    const shellRadius = sphereRadius - innerOffset;
    const radial = shellRadius * Math.sin(theta) * factor;
    const z = config.pressDepth * Math.cos(theta) - innerOffset * Math.cos(theta);
    position.setXYZ(
      index,
      radial * Math.cos(angle),
      radial * Math.sin(angle),
      sign * z,
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData["curved"] = true;
  geometry.userData["form"] = config.form;
}

export function createPressDome(configInput: Partial<PressOrnamentConfig>, sign: 1 | -1 = 1) {
  const config = validatePressOrnamentConfig(configInput);
  const { shape, perforationCount, baseRadius } = createLatticeShape(config);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: config.panelThickness,
    bevelEnabled: false,
    curveSegments: 24,
    steps: 1,
  });
  warpToDome(geometry, config, sign, baseRadius);
  geometry.userData["perforationCount"] = perforationCount;
  geometry.userData["pattern"] = config.pattern;
  return { geometry, perforationCount, config };
}

function createRim(config: PressOrnamentConfig, female: boolean) {
  const radius = config.diameter / 2;
  const pinRadius = Math.min(1.35, config.rimWidth * 0.28);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const inner = new THREE.Path();
  inner.absarc(0, 0, radius - config.rimWidth, 0, Math.PI * 2, true);
  shape.holes.push(inner);
  if (female && config.joinMethod === "pins") {
    const pinRadius = radius - config.rimWidth / 2;
    for (let index = 0; index < 4; index++) {
      const angle = (index * Math.PI) / 2;
      const hole = new THREE.Path();
      hole.absarc(
        pinRadius * Math.cos(angle),
        pinRadius * Math.sin(angle),
        pinRadius + config.clearance,
        0,
        Math.PI * 2,
        true,
      );
      shape.holes.push(hole);
    }
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: config.panelThickness,
    bevelEnabled: false,
    curveSegments: 64,
  });
  geometry.translate(0, 0, -config.panelThickness / 2);
  return geometry;
}

function pointOnDome(x: number, y: number, config: PressOrnamentConfig, sign: 1 | -1, offset = 0) {
  const angle = Math.atan2(y, x);
  const limit = Math.max(0.001, (config.diameter / 2 - config.rimWidth) * formFactor(config.form, angle));
  const theta = Math.asin(clamp(Math.hypot(x, y) / limit, 0, 0.94));
  const radius = config.diameter / 2 + offset;
  return new THREE.Vector3(
    radius * Math.sin(theta) * Math.cos(angle),
    radius * Math.sin(theta) * Math.sin(angle),
    sign * (config.pressDepth * Math.cos(theta) + offset),
  );
}

function createMotifLines(config: PressOrnamentConfig): Line2[] {
  const radius = config.designWidth / 2;
  const lines: Line2[] = [];
  if (config.design === "plain") return lines;
  if (config.design === "snowflake") {
    for (let arm = 0; arm < 6; arm++) {
      const angle = (arm * Math.PI) / 3;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      lines.push([[0, 0], [ux * radius, uy * radius]]);
      for (const side of [-1, 1]) {
        const branchStart = radius * 0.58;
        const branchEnd = radius * 0.84;
        const bx = ux * branchStart;
        const by = uy * branchStart;
        const branchAngle = angle + side * Math.PI / 3;
        lines.push([
          [bx, by],
          [bx + Math.cos(branchAngle) * (branchEnd - branchStart), by + Math.sin(branchAngle) * (branchEnd - branchStart)],
        ]);
      }
    }
  } else if (config.design === "star") {
    lines.push(
      Array.from({ length: 11 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / 10;
        const r = index % 2 ? radius * 0.44 : radius;
        return [Math.cos(angle) * r, Math.sin(angle) * r] as Point2;
      }),
    );
  } else if (config.design === "tree") {
    lines.push([[0, -radius], [0, radius * 0.68]]);
    lines.push([
      [-radius * 0.78, -radius * 0.45],
      [0, -radius * 0.1],
      [radius * 0.78, -radius * 0.45],
      [radius * 0.55, -radius * 0.08],
      [radius * 0.82, -radius * 0.08],
      [0, radius * 0.62],
      [-radius * 0.82, -radius * 0.08],
      [-radius * 0.55, -radius * 0.08],
      [-radius * 0.78, -radius * 0.45],
    ]);
  } else if (config.design === "heart") {
    lines.push(
      Array.from({ length: 65 }, (_, index) => {
        const t = (index / 64) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [x * radius / 18, y * radius / 18] as Point2;
      }),
    );
  } else if (config.design === "candy-cane") {
    lines.push(
      Array.from({ length: 35 }, (_, index) => {
        const t = index / 34;
        const x = -radius * 0.55 + radius * 0.7 * t + (t > 0.72 ? Math.sin((t - 0.72) * Math.PI * 3) * radius * 0.2 : 0);
        const y = -radius + radius * 1.8 * t;
        return [x, y] as Point2;
      }),
    );
  } else if (config.design === "bell") {
    lines.push([
      [-radius * 0.68, -radius * 0.55],
      [-radius * 0.55, -radius * 0.1],
      [-radius * 0.35, radius * 0.5],
      [radius * 0.35, radius * 0.5],
      [radius * 0.55, -radius * 0.1],
      [radius * 0.68, -radius * 0.55],
      [-radius * 0.68, -radius * 0.55],
    ]);
    lines.push([[-radius * 0.75, -radius * 0.6], [radius * 0.75, -radius * 0.6]]);
    lines.push([[-radius * 0.2, -radius * 0.72], [radius * 0.2, -radius * 0.72]]);
  } else if (config.design === "gift") {
    lines.push([
      [-radius * 0.65, -radius * 0.5],
      [radius * 0.65, -radius * 0.5],
      [radius * 0.65, radius * 0.5],
      [-radius * 0.65, radius * 0.5],
      [-radius * 0.65, -radius * 0.5],
    ]);
    lines.push([[-radius * 0.7, 0], [radius * 0.7, 0]]);
    lines.push([[0, -radius * 0.55], [0, radius * 0.55]]);
    lines.push([[0, radius * 0.5], [-radius * 0.25, radius * 0.85], [0, radius * 0.95], [radius * 0.25, radius * 0.85], [0, radius * 0.5]]);
  } else if (config.design === "snowman") {
    for (const [cx, cy, r] of [[0, -radius * 0.35, radius * 0.38], [0, radius * 0.38, radius * 0.25]] as const) {
      lines.push(
        Array.from({ length: 49 }, (_, index) => {
          const angle = (index / 48) * Math.PI * 2;
          return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as Point2;
        }),
      );
    }
  }
  return lines;
}

function addMotif(
  target: THREE.Group,
  config: PressOrnamentConfig,
  sign: 1 | -1,
  curved: boolean,
) {
  if (config.design === "plain") return;
  const material = new THREE.MeshStandardMaterial({
    color: config.designColor,
    roughness: 0.55,
    metalness: 0.04,
  });
  const tubeRadius = Math.max(0.45, config.designHeight * 0.62);
  for (const line of createMotifLines(config)) {
    if (line.length < 2) continue;
    const points = line.map(([x, y]) => {
      if (curved) return pointOnDome(x, y, config, sign, config.designHeight * 0.55);
      return new THREE.Vector3(x, y, sign * (config.panelThickness + config.designHeight));
    });
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, Math.max(24, line.length * 5), tubeRadius, 8, false);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `decorative-${config.design}`;
    target.add(mesh);
  }
}

function makeMaterial(color: string, roughness = 0.68) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
}

function buildHemisphere(config: PressOrnamentConfig, sign: 1 | -1, male: boolean) {
  const group = new THREE.Group();
  group.name = sign === 1 ? "front-hemisphere" : "rear-hemisphere";
  const dome = createPressDome(config, sign);
  const shell = new THREE.Mesh(dome.geometry, makeMaterial(config.meshColor));
  shell.name = sign === 1 ? "front-curved-lattice" : "rear-curved-lattice";
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const rim = new THREE.Mesh(createRim(config, !male), makeMaterial(config.designColor, 0.5));
  rim.name = male ? "male-joining-rim" : "female-joining-rim";
  // The male rim occupies the front side of the equator and the female rim
  // the rear side. Their mating faces meet at z=0 instead of overlapping.
  rim.position.z = sign * config.panelThickness / 2;
  rim.castShadow = true;
  group.add(rim);

  if (male && config.joinMethod === "pins") {
    const radius = config.diameter / 2 - config.rimWidth / 2;
    const pinRadius = Math.min(1.35, config.rimWidth * 0.28);
    const pinLength = config.panelThickness + config.clearance * 2;
    for (let index = 0; index < 4; index++) {
      const angle = (index * Math.PI) / 2;
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(pinRadius, pinRadius, pinLength, 24),
        makeMaterial(config.pressColor, 0.45),
      );
      pin.name = `joining-pin-${index + 1}`;
      pin.rotation.x = Math.PI / 2;
      pin.position.set(
        radius * Math.cos(angle),
        radius * Math.sin(angle),
        -pinLength / 2,
      );
      group.add(pin);
    }
  }

  if (sign === 1 || config.backDesign) addMotif(group, config, sign, true);

  if (sign === 1 && config.includeLoop) {
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(config.loopDiameter, Math.max(0.55, config.panelThickness * 0.42), 12, 48),
      makeMaterial(config.designColor, 0.48),
    );
    loop.name = "hanging-loop";
    loop.position.set(0, 0, config.pressDepth + config.loopDiameter * 0.62);
    group.add(loop);
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(config.loopDiameter * 0.75, config.panelThickness * 1.4, config.loopDiameter * 1.1),
      makeMaterial(config.designColor, 0.48),
    );
    bridge.name = "hanging-loop-bridge";
    bridge.position.set(0, 0, config.pressDepth + config.loopDiameter * 0.2);
    group.add(bridge);
  }
  group.userData["perforationCount"] = dome.perforationCount;
  return group;
}

function buildBlank(config: PressOrnamentConfig) {
  const { shape, perforationCount } = createLatticeShape(config);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: config.panelThickness,
    bevelEnabled: false,
    curveSegments: 24,
  });
  const group = new THREE.Group();
  const panel = new THREE.Mesh(geometry, makeMaterial(config.meshColor));
  panel.name = "flat-perforated-blank";
  group.add(panel);
  addMotif(group, config, 1, false);
  group.userData["perforationCount"] = perforationCount;
  return group;
}

function buildFemaleMold(config: PressOrnamentConfig) {
  const radius = config.diameter / 2;
  const depth = config.pressDepth;
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0, -depth - 12),
    new THREE.Vector2(radius + 8, -depth - 12),
    new THREE.Vector2(radius + 8, 0),
    new THREE.Vector2(radius, 0),
  ];
  for (let index = 1; index >= 0; index -= 1 / 32) {
    const radial = radius * index;
    const z = -depth * Math.sqrt(Math.max(0, 1 - index * index));
    points.push(new THREE.Vector2(radial, z));
  }
  points.push(new THREE.Vector2(0, -depth - 12));
  const geometry = new THREE.LatheGeometry(points, 96);
  geometry.rotateX(Math.PI / 2);
  const mold = new THREE.Mesh(geometry, makeMaterial(config.pressColor, 0.78));
  mold.name = "female-cavity-mold";
  mold.castShadow = true;
  mold.receiveShadow = true;
  return mold;
}

function buildMaleMold(config: PressOrnamentConfig) {
  const radius = config.diameter / 2;
  const depth = config.pressDepth;
  const group = new THREE.Group();
  const domeGeometry = new THREE.SphereGeometry(radius, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeometry.scale(1, depth / radius, 1);
  domeGeometry.rotateX(-Math.PI / 2);
  const dome = new THREE.Mesh(domeGeometry, makeMaterial(config.pressColor, 0.76));
  dome.name = "male-pressure-dome";
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

  const plateGeometry = new THREE.CylinderGeometry(radius + 8, radius + 8, 8, 96);
  plateGeometry.rotateX(-Math.PI / 2);
  const plate = new THREE.Mesh(plateGeometry, makeMaterial(config.pressColor, 0.72));
  plate.name = "upper-press-plate";
  plate.position.z = 4;
  plate.castShadow = true;
  group.add(plate);

  const handleGeometry = new THREE.CylinderGeometry(6, 8, 14, 48);
  handleGeometry.rotateX(-Math.PI / 2);
  const handle = new THREE.Mesh(handleGeometry, makeMaterial(config.pressColor, 0.68));
  handle.name = "upper-press-handle";
  handle.position.z = 15;
  group.add(handle);
  group.position.z = depth + 12 + config.panelThickness + 0.6;
  return group;
}

function buildMoldSet(config: PressOrnamentConfig) {
  const group = new THREE.Group();
  group.name = "male-and-female-press-mold";
  const female = buildFemaleMold(config);
  female.position.z = config.pressDepth + 12;
  group.add(female);
  group.add(buildMaleMold(config));
  return group;
}

function buildSphere(config: PressOrnamentConfig, exploded: boolean, includeBack = true) {
  const group = new THREE.Group();
  group.name = exploded ? "exploded-two-hemisphere-ornament" : "assembled-two-hemisphere-ornament";
  const front = buildHemisphere(config, 1, true);
  group.add(front);
  if (includeBack) {
    const rear = buildHemisphere(config, -1, false);
    const gap = Math.max(8, config.pressDepth * 0.3);
    if (exploded) rear.position.z = -gap;
    group.add(rear);
    if (exploded) {
      front.position.z = gap;
      group.position.z = config.pressDepth + gap;
    } else {
      group.position.z = config.pressDepth;
    }
  }
  group.userData["parts"] = includeBack ? 2 : 1;
  return group;
}

export function buildPressOrnament(
  input: Partial<PressOrnamentConfig>,
  mode: PressPreviewMode = "system",
) {
  const config = validatePressOrnamentConfig(input);
  const group = new THREE.Group();
  group.name = `press-ornament-${mode}`;
  if (mode === "flat") {
    group.add(buildBlank(config));
  } else if (mode === "mold") {
    group.add(buildMoldSet(config));
  } else if (mode === "half") {
    group.add(buildSphere(config, false, false));
  } else if (mode === "assembled") {
    group.add(buildSphere(config, false, true));
  } else if (mode === "system") {
    const mold = buildMoldSet(config);
    mold.position.x = -config.diameter * 0.95;
    group.add(mold);

    const blank = buildBlank(config);
    blank.position.z = 0;
    group.add(blank);

    const formed = buildSphere(config, true, true);
    formed.position.x = config.diameter * 1.15;
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
  group.userData["manufacturingNote"] =
    "Prévia paramétrica. Confirme tolerâncias, colisões e fatiamento no Bambu Studio antes de fabricar.";
  return group;
}

export function countPressTriangles(object: THREE.Object3D) {
  let triangles = 0;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const index = child.geometry.getIndex();
    const position = child.geometry.getAttribute("position");
    triangles += (index ? index.count : position.count) / 3;
  });
  return Math.floor(triangles);
}

export function disposePressOrnament(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}
