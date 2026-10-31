import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { A1_BED, EPS, organizerLayout, validateOrganizer } from "@/lib/organizer/organizer";
import { exportPartSTL } from "@/lib/organizer/buildOrganizer";

const extremes = [
  {},
  { cols: 10, rows: 10, clearance: 0 },
  { cols: 1, rows: 1, clearance: 5, wall: 6, base: 6 },
  { innerLength: 120, innerWidth: 90, split: "none" as const },
  { height: 999, dividerHeight: 999 },
];

describe("Organizador 3D", () => {
  it("defaults: outer = inner − 2×2 mm, height 37 mm", () => {
    const r = organizerLayout({});
    expect(r.outerLength).toBe(271);
    expect(r.outerWidth).toBe(196);
    expect(r.config.height).toBe(37);
  });

  it("clamps height to depth − 3 and thickness to ≥ 1.2 mm", () => {
    const c = validateOrganizer({ height: 50, wall: 0.2, base: -1, divider: NaN, clearance: 9 });
    expect(c.height).toBe(37);
    expect(c.wall).toBe(1.2);
    expect(c.base).toBe(1.2);
    expect(c.divider).toBe(1.2);
    expect(c.clearance).toBe(5);
  });

  it.each(extremes)("dividers start on the base and touch the walls (%o)", (cfg) => {
    const r = organizerLayout(cfg);
    for (const p of r.parts) {
      const t = r.config.wall;
      for (const b of p.boxes.filter((b) => b.name.startsWith("divider"))) {
        expect(b.min[2]).toBeLessThanOrEqual(r.config.base);
        expect(b.max[2]).toBeGreaterThan(r.config.base);
        const axis = b.name.startsWith("divider-x") ? 1 : 0;
        const span = axis === 1 ? p.width : p.length;
        expect(b.min[axis]).toBeLessThanOrEqual(t);
        expect(b.max[axis]).toBeGreaterThanOrEqual(span - t);
      }
    }
  });

  it.each(extremes)("nothing leaves the box envelope minus clearance (%o)", (cfg) => {
    const r = organizerLayout(cfg);
    const { innerLength: L, innerWidth: W, innerDepth: D, clearance: c } = r.config;
    for (const p of r.parts)
      for (const b of p.boxes) {
        expect(c + p.offsetX + b.min[0]).toBeGreaterThanOrEqual(c - EPS);
        expect(c + p.offsetX + b.max[0]).toBeLessThanOrEqual(L - c + EPS);
        expect(b.min[1]).toBeGreaterThanOrEqual(0);
        expect(c + b.max[1]).toBeLessThanOrEqual(W - c + EPS);
        expect(b.min[2]).toBeGreaterThanOrEqual(0);
        expect(b.max[2]).toBeLessThanOrEqual(D - 3);
      }
  });

  it("compartments + dividers + walls add up to the outer size", () => {
    const r = organizerLayout({ split: "none", innerLength: 200 });
    const p = r.parts[0]!;
    const { wall, divider, cols, rows } = r.config;
    const c = p.compartments[0]!;
    expect(cols * c.length + (cols - 1) * divider + 2 * wall).toBeCloseTo(p.length, 6);
    expect(rows * c.width + (rows - 1) * divider + 2 * wall).toBeCloseTo(p.width, 6);
    expect(p.compartments.every((x) => x.length > 0 && x.width > 0)).toBe(true);
  });

  it("271 mm does not fit the A1; auto split gives parts ≤ 256 mm", () => {
    const whole = organizerLayout({ split: "none" });
    expect(whole.fitsBed).toBe(false);
    expect(whole.warnings.join(" ")).toMatch(/não cabe/);
    const split = organizerLayout({});
    expect(split.parts).toHaveLength(2);
    expect(split.fitsBed).toBe(true);
    split.parts.forEach((p) => expect(Math.max(p.length, p.width)).toBeLessThanOrEqual(A1_BED));
  });

  it("exports a valid binary STL matching the part size", async () => {
    const r = organizerLayout({});
    const part = r.parts[0]!;
    const data = await exportPartSTL(part);
    const tris = data.getUint32(80, true);
    expect(tris).toBeGreaterThan(0);
    expect(data.byteLength).toBe(84 + 50 * tris);
    const geo = new STLLoader().parse(data.buffer as ArrayBuffer);
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(part.length, 3);
    expect(size.y).toBeCloseTo(part.width, 3);
    expect(size.z).toBeCloseTo(part.height, 3);
  });
});
