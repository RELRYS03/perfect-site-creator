// Pure parametric geometry for the "Organizador 3D" tray. Units: mm, Z up, origin at tray corner.
export type SplitMode = "auto" | "none" | "two";
export type OrganizerConfig = {
  innerLength: number; // box interior (empty half)
  innerWidth: number;
  innerDepth: number;
  clearance: number; // per side
  height: number; // tray outer height
  wall: number;
  base: number;
  divider: number;
  cols: number;
  rows: number;
  dividerHeight: number;
  split: SplitMode;
};
export const A1_BED = 256;
export const LID_GAP = 3;
export const MIN_THICKNESS = 1.2;
export const EPS = 0.01;
export const PLA_DENSITY = 1.24; // g/cm³
export const defaultOrganizerConfig: OrganizerConfig = {
  innerLength: 275,
  innerWidth: 200,
  innerDepth: 40,
  clearance: 2,
  height: 37,
  wall: 2,
  base: 2,
  divider: 1.6,
  cols: 3,
  rows: 2,
  dividerHeight: 37,
  split: "auto",
};
export type Box3 = { name: string; min: [number, number, number]; max: [number, number, number] };
export type Compartment = { length: number; width: number; depth: number; volumeMl: number };
export type Part = {
  id: string;
  offsetX: number; // placement inside the tray envelope
  length: number;
  width: number;
  height: number;
  boxes: Box3[]; // local coordinates
  compartments: Compartment[];
  cols: number;
};
export type OrganizerResult = {
  config: OrganizerConfig;
  outerLength: number;
  outerWidth: number;
  parts: Part[];
  fitsBed: boolean;
  warnings: string[];
  filamentGrams: number;
};
const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

export function validateOrganizer(input: Partial<OrganizerConfig>): OrganizerConfig {
  const c = { ...defaultOrganizerConfig, ...input };
  const innerLength = clamp(c.innerLength, 40, 600);
  const innerWidth = clamp(c.innerWidth, 40, 600);
  const innerDepth = clamp(c.innerDepth, 10 + LID_GAP, 300);
  const clearance = clamp(c.clearance, 0, 5);
  const wall = clamp(c.wall, MIN_THICKNESS, 6);
  const base = clamp(c.base, MIN_THICKNESS, 6);
  const divider = clamp(c.divider, MIN_THICKNESS, 6);
  const height = clamp(c.height, 10, innerDepth - LID_GAP);
  const dividerHeight = clamp(c.dividerHeight, base + 1, height);
  const cols = Math.round(clamp(c.cols, 1, 10));
  const rows = Math.round(clamp(c.rows, 1, 10));
  const split: SplitMode = ["auto", "none", "two"].includes(c.split) ? c.split : "auto";
  return { innerLength, innerWidth, innerDepth, clearance, height, wall, base, divider, cols, rows, dividerHeight, split };
}

function buildTray(id: string, L: number, W: number, cfg: OrganizerConfig, cols: number, offsetX: number): Part {
  const { wall: t, base: b, divider: d, rows, height: H, dividerHeight: dh } = cfg;
  const boxes: Box3[] = [
    { name: "base", min: [0, 0, 0], max: [L, W, b] },
    { name: "wall-front", min: [0, 0, b - EPS], max: [L, t, H] },
    { name: "wall-back", min: [0, W - t, b - EPS], max: [L, W, H] },
    { name: "wall-left", min: [0, t - EPS, b - EPS], max: [t, W - t + EPS, H] },
    { name: "wall-right", min: [L - t, t - EPS, b - EPS], max: [L, W - t + EPS, H] },
  ];
  const cw = (L - 2 * t - (cols - 1) * d) / cols;
  const rw = (W - 2 * t - (rows - 1) * d) / rows;
  for (let i = 1; i < cols; i++) {
    const x = t + i * cw + (i - 1) * d;
    boxes.push({ name: `divider-x${i}`, min: [x, t - EPS, b - EPS], max: [x + d, W - t + EPS, dh] });
  }
  for (let j = 1; j < rows; j++) {
    const y = t + j * rw + (j - 1) * d;
    boxes.push({ name: `divider-y${j}`, min: [t - EPS, y, b - EPS], max: [L - t + EPS, y + d, dh] });
  }
  const depth = H - b;
  const compartments: Compartment[] = [];
  for (let i = 0; i < cols * rows; i++)
    compartments.push({ length: cw, width: rw, depth, volumeMl: (cw * rw * depth) / 1000 });
  return { id, offsetX, length: L, width: W, height: H, boxes, compartments, cols };
}

export function boxVolume(b: Box3) {
  return (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
}

export function organizerLayout(input: Partial<OrganizerConfig>): OrganizerResult {
  const config = validateOrganizer(input);
  const outerLength = config.innerLength - 2 * config.clearance;
  const outerWidth = config.innerWidth - 2 * config.clearance;
  const warnings: string[] = [];
  const singleFits = Math.max(outerLength, outerWidth) <= A1_BED && config.height <= A1_BED;
  const split = config.split === "two" || (config.split === "auto" && !singleFits);
  let parts: Part[];
  if (split) {
    const half = outerLength / 2;
    const colsA = Math.max(1, Math.ceil(config.cols / 2));
    const colsB = Math.max(1, config.cols - colsA) || 1;
    parts = [buildTray("A", half, outerWidth, config, colsA, 0), buildTray("B", half, outerWidth, config, colsB, half)];
  } else parts = [buildTray("A", outerLength, outerWidth, config, config.cols, 0)];
  const fitsBed = parts.every((p) => Math.max(p.length, p.width) <= A1_BED && p.height <= A1_BED);
  if (!singleFits)
    warnings.push(
      split
        ? `A bandeja inteira (${outerLength.toFixed(0)} mm) não cabe na mesa da A1 (256 mm); foi dividida em 2 peças.`
        : `A bandeja (${outerLength.toFixed(0)} × ${outerWidth.toFixed(0)} mm) não cabe na mesa da A1 (256 mm). Ative a divisão em peças.`,
    );
  if (!fitsBed && split) warnings.push("Mesmo dividida, uma peça passa de 256 mm.");
  if (parts.some((p) => p.compartments.some((c) => c.length < 10 || c.width < 10)))
    warnings.push("Há compartimentos com menos de 10 mm; reduza as divisórias.");
  if (config.wall < 1.6) warnings.push("Parede abaixo de 1,6 mm pode ficar frágil.");
  const volume = parts.reduce((s, p) => s + p.boxes.reduce((a, b) => a + boxVolume(b), 0), 0);
  return { config, outerLength, outerWidth, parts, fitsBed, warnings, filamentGrams: (volume / 1000) * PLA_DENSITY };
}
