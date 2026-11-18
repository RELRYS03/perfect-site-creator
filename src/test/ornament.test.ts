import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildOrnament,
  countTriangles,
  createPerforatedPanel,
  defaultOrnamentConfig,
  disposeOrnament,
  validateOrnamentConfig,
} from "@/lib/studio/ornament";

describe("parametric press-fit ornament", () => {
  it("clamps dimensions and print-critical clearances", () => {
    const config = validateOrnamentConfig({ diameter: 999, panelThickness: 0, connectorClearance: 9 });
    expect(config.diameter).toBe(180);
    expect(config.panelThickness).toBe(0.8);
    expect(config.connectorClearance).toBe(0.6);
  });

  it.each(["honeycomb", "diamond", "round", "square", "triangle"] as const)(
    "builds a real perforated solid for the %s pattern",
    (pattern) => {
      const { geometry, perforationCount } = createPerforatedPanel({ pattern });
      expect(perforationCount).toBeGreaterThan(10);
      expect(geometry.getAttribute("position").count).toBeGreaterThan(100);
      expect(geometry.boundingBox).toBeNull();
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeCloseTo(
        defaultOrnamentConfig.panelThickness,
        5,
      );
      geometry.dispose();
    },
  );

  it("creates two perforated faces, a solid rim, four press pins and an optional loop", () => {
    const model = buildOrnament({});
    const names: string[] = [];
    model.traverse((child) => names.push(child.name));
    expect(names).toContain("front-perforated-panel");
    expect(names).toContain("rear-perforated-panel");
    expect(names).toContain("front-solid-rim");
    expect(names.filter((name) => name.startsWith("press-pin-"))).toHaveLength(4);
    expect(names).toContain("hanging-loop");
    expect(countTriangles(model)).toBeGreaterThan(1000);
    expect(model.userData.perforationCount).toBeGreaterThan(10);
    disposeOrnament(model);
  });

  it("keeps all meshes inside the configured XY envelope", () => {
    const model = buildOrnament({ diameter: 90, includeLoop: false });
    const bounds = new THREE.Box3().setFromObject(model);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-45.01);
    expect(bounds.max.x).toBeLessThanOrEqual(45.01);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-45.01);
    expect(bounds.max.y).toBeLessThanOrEqual(45.01);
    disposeOrnament(model);
  });
});
