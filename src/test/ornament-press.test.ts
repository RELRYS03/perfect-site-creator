import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildPressOrnament,
  createPressDome,
  defaultPressOrnamentConfig,
  disposePressOrnament,
  validatePressOrnamentConfig,
} from "@/lib/studio/ornament-press";

function edgeUseCounts(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const vertexKey = (vertex: number) =>
    [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
      .map((value) => Math.round(value * 1000))
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
  const openEdges = [...edgeUseCounts(geometry).values()].filter((uses) => uses !== 2);
  expect(openEdges, "todas as arestas devem pertencer a dois triângulos").toEqual([]);
}

describe("ornamento de prensagem", () => {
  it("limita dimensões e tolerâncias a valores seguros", () => {
    const config = validatePressOrnamentConfig({
      diameter: 999,
      pressDepth: 999,
      panelThickness: 0,
      clearance: 99,
      ribWidth: 0,
    });
    expect(config.diameter).toBe(140);
    expect(config.pressDepth).toBeLessThanOrEqual(config.diameter * 0.62);
    expect(config.panelThickness).toBe(0.8);
    expect(config.clearance).toBe(0.6);
    expect(config.ribWidth).toBe(0.65);
  });

  it.each(["honeycomb", "diamond", "round", "square", "triangle"] as const)(
    "gera malha curva fechada para o padrão %s",
    (pattern) => {
      const { geometry, perforationCount } = createPressDome({
        ...defaultPressOrnamentConfig,
        pattern,
      });
      try {
        expect(perforationCount).toBeGreaterThan(10);
        expect(geometry.getAttribute("position").count).toBeGreaterThan(100);
        expect(geometry.boundingBox).not.toBeNull();
        expectClosedSolid(geometry);
      } finally {
        geometry.dispose();
      }
    },
  );

  it("gera duas metades, molde macho/fêmea e malha plana nos modos adequados", () => {
    const assembled = buildPressOrnament({}, "assembled");
    const mold = buildPressOrnament({}, "mold");
    const flat = buildPressOrnament({}, "flat");
    try {
      const names = (root: THREE.Object3D) => {
        const result: string[] = [];
        root.traverse((node) => {
          if (node instanceof THREE.Mesh) result.push(node.name);
        });
        return result;
      };
      expect(names(assembled)).toContain("front-curved-lattice");
      expect(names(assembled)).toContain("rear-curved-lattice");
      expect(names(assembled)).toContain("joining-pin-1");
      expect(names(mold)).toContain("female-cavity-mold");
      expect(names(mold)).toContain("male-pressure-dome");
      expect(names(mold)).toContain("upper-press-handle");
      expect(names(flat)).toContain("flat-perforated-blank");
    } finally {
      disposePressOrnament(assembled);
      disposePressOrnament(mold);
      disposePressOrnament(flat);
    }
  });

  it("separa os aros de junção e dimensiona os pinos pela espessura da chapa", () => {
    const config = { ...defaultPressOrnamentConfig, panelThickness: 1.4, clearance: 0.3 };
    const model = buildPressOrnament(config, "assembled");
    try {
      const meshes: THREE.Mesh[] = [];
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) meshes.push(node);
      });
      const maleRim = meshes.find((mesh) => mesh.name === "male-joining-rim");
      const femaleRim = meshes.find((mesh) => mesh.name === "female-joining-rim");
      const pin = meshes.find((mesh) => mesh.name === "joining-pin-1");
      if (!maleRim || !femaleRim || !pin) throw new Error("componentes de união ausentes");
      expect(maleRim.position.z).toBeCloseTo(config.panelThickness / 2, 5);
      expect(femaleRim.position.z).toBeCloseTo(-config.panelThickness / 2, 5);
      pin.geometry.computeBoundingBox();
      expect(pin.geometry.boundingBox).not.toBeNull();
      expect(pin.geometry.boundingBox!.max.y - pin.geometry.boundingBox!.min.y)
        .toBeCloseTo(config.panelThickness + config.clearance * 2, 4);
    } finally {
      disposePressOrnament(model);
    }
  });

  it("mantém a argola opcional e os componentes identificados", () => {
    const model = buildPressOrnament({ includeLoop: false }, "assembled");
    try {
      const names: string[] = [];
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) names.push(node.name);
      });
      expect(names).not.toContain("hanging-loop");
      expect(model.userData["previewMode"]).toBe("assembled");
      expect(model.userData["config"].diameter).toBe(80);
    } finally {
      disposePressOrnament(model);
    }
  });
});
