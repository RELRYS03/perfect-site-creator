import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  GIGAPRINT_BALL_REFERENCE,
  buildPressOrnamentReference,
  buildReferenceFlatBlank,
  buildReferenceFemaleMold,
  buildReferenceMalePlunger,
  disposeReferenceOrnament,
} from "@/lib/studio/ornament-press-reference";
import { defaultPressOrnamentConfig } from "@/lib/studio/ornament-press";

function meshNames(root: THREE.Object3D) {
  const names: string[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) names.push(node.name);
  });
  return names;
}

describe("geometria reconstruída da referência GigaPrint", () => {
  it("preserva as medidas-chave lidas do 3MF/README/STLs", () => {
    expect(GIGAPRINT_BALL_REFERENCE.nominalBallDiameter).toBe(100);
    expect(GIGAPRINT_BALL_REFERENCE.meshThickness).toBe(1.2);
    expect(GIGAPRINT_BALL_REFERENCE.rimThickness).toBe(2.4);
    expect(GIGAPRINT_BALL_REFERENCE.hexHoleAcross).toBe(5);
    expect(GIGAPRINT_BALL_REFERENCE.hexStrut).toBe(1.2);
    expect(GIGAPRINT_BALL_REFERENCE.stretchPercent).toBe(53);
    expect(GIGAPRINT_BALL_REFERENCE.pressGap).toBe(1.5);
    expect(
      defaultPressOrnamentConfig.panelThickness /
        (1 + defaultPressOrnamentConfig.stretchPercent / 100),
    ).toBeCloseTo(0.78, 2);
    expect(GIGAPRINT_BALL_REFERENCE.guidePostDiameter).toBe(8);
    expect(GIGAPRINT_BALL_REFERENCE.guideHoleDiameter).toBe(8.6);
    expect(GIGAPRINT_BALL_REFERENCE.joinPinDiameter).toBe(3);
    expect(GIGAPRINT_BALL_REFERENCE.joinHoleDiameter).toBe(3.2);
  });

  it("reconstrói a malha plana com aro, três pinos, furos e orelha", () => {
    const model = buildReferenceFlatBlank({});
    try {
      const names = meshNames(model);
      expect(names).toContain("flat-honeycomb-panel");
      expect(names).toContain("reinforced-2p4mm-perimeter-rim");
      expect(names).toContain("hemisphere-join-pin-1");
      expect(names).toContain("hemisphere-join-pin-2");
      expect(names).toContain("hemisphere-join-pin-3");
      expect(names).toContain("hanging-ear-with-3p6mm-hole");
      expect(model.userData["perforationCount"]).toBeGreaterThan(100);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(117, 0);
      expect(size.y).toBeGreaterThan(124);
      expect(size.z).toBeCloseTo(4.4, 1);
    } finally {
      disposeReferenceOrnament(model);
    }
  });

  it("reconstrói a cavidade e os três pinos de localização e três postes-guia", () => {
    const model = buildReferenceFemaleMold({});
    try {
      const names = meshNames(model);
      expect(names).toContain("female-cavity-block-body");
      expect(model.userData["cavitySurfaceIntegrated"]).toBe(true);
      expect(names.filter((name) => name.startsWith("mesh-locator-pin-"))).toHaveLength(3);
      expect(names.filter((name) => name.startsWith("plunger-guide-post-"))).toHaveLength(3);
      expect(model.userData["topPlaneZ"]).toBeCloseTo(38, 2);
      expect(model.userData["guidePostDiameterMm"]).toBe(8);
    } finally {
      disposeReferenceOrnament(model);
    }
  });

  it("reconstrói o êmbolo com furos-guia ajustados a 0,2 mm por lado", () => {
    const model = buildReferenceMalePlunger({});
    try {
      const names = meshNames(model);
      expect(names).toContain("male-plunger-flange-with-three-8p6mm-guide-holes");
      expect(names).toContain("male-plunger-dome-1p5mm-surface-gap");
      expect(model.userData["guideHoleDiameterMm"]).toBeCloseTo(8.4, 1);
      expect(model.userData["flangeSeatPlaneZ"]).toBe(10);
    } finally {
      disposeReferenceOrnament(model);
    }
  });

  it("oferece prévias separadas e o conjunto com duas metades", () => {
    const system = buildPressOrnamentReference({}, "system");
    const assembled = buildPressOrnamentReference({}, "assembled");
    const openPress = buildPressOrnamentReference({}, "mold");
    try {
      expect(meshNames(system)).toContain("flat-honeycomb-panel");
      expect(meshNames(system)).toContain("female-cavity-block-body");
      expect(meshNames(system)).toContain("male-plunger-flange-with-three-8p6mm-guide-holes");
      expect(meshNames(assembled)).toContain("front-curved-honeycomb-shell");
      expect(meshNames(assembled)).toContain("back-curved-honeycomb-shell");
      expect(assembled.userData["halves"]).toBe(2);
      expect(openPress.userData["workingGapMm"]).toBe(1.5);
    } finally {
      disposeReferenceOrnament(system);
      disposeReferenceOrnament(assembled);
      disposeReferenceOrnament(openPress);
    }
  });
});
