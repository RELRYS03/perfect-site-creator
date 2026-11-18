import { describe, expect, it } from "vitest";
import { createBallOrnament3MF } from "@/lib/studio/three-mf-export";
import {
  defaultPressOrnamentConfig,
  validatePressOrnamentConfig,
} from "@/lib/studio/ornament-press";

const MODEL_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";

async function blobToBytes(blob: Blob) {
  return await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("O FileReader não retornou um ArrayBuffer."));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o 3MF."));
    reader.readAsArrayBuffer(blob);
  });
}

async function readStoredZip(blob: Blob) {
  const bytes = await blobToBytes(blob);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    if (method !== 0) throw new Error("O teste espera entradas ZIP armazenadas sem compressão.");
    const data = bytes.subarray(dataStart, dataStart + size);
    files.set(name, decoder.decode(data));
    offset = dataStart + size;
  }
  return { files, size: bytes.length };
}

function parseXml(xml: string) {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0);
  return parsed;
}

async function verify3mf(config: typeof defaultPressOrnamentConfig, expectedTitle = "Ball ornament") {
  const blob = await createBallOrnament3MF(config, expectedTitle);
  const { files, size } = await readStoredZip(blob);
  expect(blob.type).toBe("application/vnd.ms-package.3dmanufacturing-3dmodel+zip");
  expect(size).toBeLessThan(28 * 1024 * 1024);

  for (const required of [
    "[Content_Types].xml",
    "_rels/.rels",
    "3D/3dmodel.model",
    "Metadata/model_settings.config",
    "Metadata/project_settings.config",
  ]) {
    expect(files.has(required), "arquivo interno ausente: " + required).toBe(true);
  }

  const types = parseXml(files.get("[Content_Types].xml")!);
  expect(types.documentElement.localName).toBe("Types");
  const relationships = parseXml(files.get("_rels/.rels")!);
  expect(relationships.getElementsByTagName("Relationship")).toHaveLength(1);

  const model = parseXml(files.get("3D/3dmodel.model")!);
  const modelRoot = model.documentElement;
  expect(modelRoot.getAttribute("unit")).toBe("millimeter");
  expect(model.getElementsByTagNameNS(MODEL_NS, "metadata")[0]?.textContent).toBe("BambuStudio-02.08.02.61");
  const metadata = [...model.getElementsByTagNameNS(MODEL_NS, "metadata")];
  expect(metadata.find((node) => node.getAttribute("name") === "Title")?.textContent).toBe(expectedTitle);
  expect(metadata.find((node) => node.getAttribute("name") === "Description")?.textContent)
    .toBe("Made with GigaPrint (gigaprint.app)");

  const materials = model.getElementsByTagNameNS(MODEL_NS, "basematerials");
  expect(materials).toHaveLength(1);
  const bases = materials[0]!.getElementsByTagNameNS(MODEL_NS, "base");
  expect(bases).toHaveLength(2);
  expect(bases[0]!.getAttribute("displaycolor")).toBe(config.meshColor.toUpperCase() + "FF");
  expect(bases[1]!.getAttribute("displaycolor")).toBe(config.pressColor.toUpperCase() + "FF");

  const objects = [...model.getElementsByTagNameNS(MODEL_NS, "object")];
  expect(objects).toHaveLength(4);
  expect(objects.map((node) => node.getAttribute("name"))).toEqual([
    "Ornament mesh, front half",
    "Ornament mesh, back half",
    "Press cavity block",
    "Press plunger",
  ]);
  expect(objects.map((node) => node.getAttribute("pindex"))).toEqual(["0", "0", "1", "1"]);

  for (const object of objects) {
    const vertices = [...object.getElementsByTagNameNS(MODEL_NS, "vertex")];
    const triangles = object.getElementsByTagNameNS(MODEL_NS, "triangle");
    expect(vertices.length).toBeGreaterThan(100);
    expect(triangles.length).toBeGreaterThan(100);
    expect(triangles.length).toBeLessThan(150_000);
    const coords = vertices.map((vertex) => [
      Number(vertex.getAttribute("x")),
      Number(vertex.getAttribute("y")),
      Number(vertex.getAttribute("z")),
    ]);
    const mins = [0, 1, 2].map((axis) => Math.min(...coords.map((point) => point[axis]!)));
    const maxs = [0, 1, 2].map((axis) => Math.max(...coords.map((point) => point[axis]!)));
    expect(mins[0]).toBeGreaterThanOrEqual(-0.001);
    expect(mins[1]).toBeGreaterThanOrEqual(-0.001);
    expect(mins[2]).toBeCloseTo(0, 3);
    expect(maxs[0]).toBeLessThanOrEqual(256.001);
    expect(maxs[1]).toBeLessThanOrEqual(256.001);
    expect(maxs[2]).toBeLessThanOrEqual(256.001);
  }

  const settings = parseXml(files.get("Metadata/model_settings.config")!);
  const plates = [...settings.getElementsByTagName("plate")];
  expect(plates).toHaveLength(4);
  expect(plates.map((plate) => [...plate.getElementsByTagName("metadata")]
    .find((node) => node.getAttribute("key") === "plater_name")?.getAttribute("value"))).toEqual([
      "Plate 1", "Plate 2", "Plate 3", "Plate 4",
    ]);
  for (const plate of plates) {
    expect(plate.getElementsByTagName("model_instance")).toHaveLength(1);
  }

  const project = JSON.parse(files.get("Metadata/project_settings.config")!) as {
    printer_model: string;
    nozzle_diameter: string[];
    print_settings_id: string;
    filament_settings_id: string[];
    filament_colour: string[];
  };
  expect(project.printer_model).toBe("Bambu Lab A1");
  expect(project.nozzle_diameter).toEqual(["0.4"]);
  expect(project.print_settings_id).toBe("0.20mm Standard @BBL A1");
  expect(project.filament_settings_id).toEqual([
    "Bambu PLA Basic @BBL A1",
    "Bambu PLA Basic @BBL A1",
  ]);
  expect(project.filament_colour).toEqual([
    config.meshColor.toUpperCase(),
    config.pressColor.toUpperCase(),
  ]);
}

// Every 3MF part is checked before ZIP packaging; failed topology blocks export.
describe("exportador 3MF Ball ornament", () => {
  it("gera o 3MF padrão com quatro objetos e quatro placas", async () => {
    await verify3mf(defaultPressOrnamentConfig);
  });

  it("gera 3MF válido no extremo mínimo permitido", async () => {
    const config = validatePressOrnamentConfig({
      diameter: 50,
      pressDepth: 12,
      panelThickness: 1.2,
      rimWidth: 1.2,
      holeSize: 2.5,
      ribWidth: 1.2,
      clearance: 0.2,
    });
    await verify3mf(config, "Ball ornament - minimum");
  });

  it("gera 3MF válido no extremo máximo permitido", async () => {
    const config = validatePressOrnamentConfig({
      diameter: 140,
      pressDepth: 86.8,
      panelThickness: 2.4,
      rimWidth: 4,
      holeSize: 10,
      ribWidth: 2.8,
      clearance: 0.6,
    });
    await verify3mf(config, "Ball ornament - maximum");
  });

  it("rejeita dimensões de parede abaixo de duas linhas de 0,4 mm", () => {
    const config = validatePressOrnamentConfig({
      panelThickness: 0.4,
      ribWidth: 0.4,
      rimWidth: 0.4,
    });
    expect(config.panelThickness).toBe(1.2);
    expect(config.ribWidth).toBe(1.2);
    expect(config.rimWidth).toBe(1.2);
  });
});
