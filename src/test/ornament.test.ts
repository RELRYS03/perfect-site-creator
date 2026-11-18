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

function edgeUseCounts(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  // ExtrudeGeometry may duplicate seam vertices with tiny float32 drift.
  // Merge coordinates within 0.001 mm before counting undirected mesh edges.
  const vertexKey = (vertex: number) =>
    [
      position.getX(vertex),
      position.getY(vertex),
      position.getZ(vertex),
    ]
      .map((value) => Math.round(value * 1_000))
      .join(",");
  const counts = new Map<string, number>();
  const vertexAt = (offset: number) => index ? index.getX(offset) : offset;

  for (let offset = 0; offset < (index?.count ?? position.count); offset += 3) {
    const vertices = [vertexAt(offset), vertexAt(offset + 1), vertexAt(offset + 2)];
    for (let edge = 0; edge < 3; edge++) {
      const first = vertexKey(vertices[edge]!);
      const second = vertexKey(vertices[(edge + 1) % 3]!);
      const key = [first, second].sort().join("|");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function expectClosedSolid(geometry: THREE.BufferGeometry) {
  const invalidEdges = [...edgeUseCounts(geometry).values()].filter((uses) => uses !== 2);
  expect(invalidEdges, "cada aresta da malha deve pertencer a exatamente dois triângulos").toEqual([]);
}

describe("parametric press-fit ornament", () => {
  it("clamps dimensions and keeps connector holes inside the rim", () => {
    const config = validateOrnamentConfig({
      diameter: 999,
      panelThickness: 0,
      connectorClearance: 9,
      connectorDiameter: 9,
      rimWidth: 2,
    });
    expect(config.diameter).toBe(180);
    expect(config.panelThickness).toBe(0.8);
    expect(config.connectorClearance).toBe(0.1);
    expect(config.connectorDiameter).toBe(1.5);
    expect(config.connectorDiameter / 2 + config.connectorClearance)
      .toBeLessThan(config.rimWidth / 2);
  });

  it.each(["honeycomb", "diamond", "round", "square", "triangle"] as const)(
    "builds a watertight perforated panel for the %s pattern",
    (pattern) => {
      const { geometry, perforationCount } = createPerforatedPanel({ pattern });
      try {
        expect(perforationCount).toBeGreaterThan(10);
        expect(geometry.getAttribute("position").count).toBeGreaterThan(100);
        expect(geometry.userData["pattern"]).toBe(pattern);
        expect(geometry.boundingBox).not.toBeNull();
        expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeCloseTo(
          defaultOrnamentConfig.panelThickness,
          5,
        );
        expectClosedSolid(geometry);
      } finally {
        geometry.dispose();
      }
    },
  );

  it("creates two perforated faces, two rims, four press pins and an optional loop", () => {
    const model = buildOrnament({});
    try {
      const meshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
      const names = meshes.map((mesh) => mesh.name);
      expect(names).toContain("front-perforated-panel");
      expect(names).toContain("rear-perforated-panel");
      expect(names).toContain("front-solid-rim");
      expect(names).toContain("rear-solid-rim");
      expect(names.filter((name) => name.startsWith("press-pin-"))).toHaveLength(4);
      expect(names).toContain("hanging-loop");
      expect(countTriangles(model)).toBeGreaterThan(1000);
      expect(model.userData["perforationCount"]).toBeGreaterThan(10);
      for (const mesh of meshes) expectClosedSolid(mesh.geometry);
    } finally {
      disposeOrnament(model);
    }
  });

  it("reports the real envelope including the hanging loop", () => {
    const model = buildOrnament({ diameter: 90, includeLoop: true });
    try {
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(bounds.min.x).toBeGreaterThanOrEqual(-45.01);
      expect(bounds.max.x).toBeLessThanOrEqual(45.01);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-45.01);
      expect(bounds.max.y).toBeGreaterThan(45);
      expect(model.userData["dimensionsMm"].x).toBeCloseTo(size.x, 2);
      expect(model.userData["dimensionsMm"].y).toBeCloseTo(size.y, 2);
      expect(model.userData["dimensionsMm"].z).toBeCloseTo(size.z, 2);
    } finally {
      disposeOrnament(model);
    }
  });

  it("keeps the ornament inside the configured XY envelope when the loop is disabled", () => {
    const model = buildOrnament({ diameter: 90, includeLoop: false });
    try {
      const bounds = new THREE.Box3().setFromObject(model);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-45.01);
      expect(bounds.max.x).toBeLessThanOrEqual(45.01);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-45.01);
      expect(bounds.max.y).toBeLessThanOrEqual(45.01);
    } finally {
      disposeOrnament(model);
    }
  });
});
