import { describe, expect, it } from "vitest";
import { createBallOrnament3MF } from "@/lib/studio/three-mf-export";
import {
  defaultPressOrnamentConfig,
  validatePressOrnamentConfig,
} from "@/lib/studio/ornament-press";

const MODEL_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readStoredZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const expectedCrc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    if (method !== 0) throw new Error("O teste espera entradas ZIP armazenadas sem compressão.");
    const data = bytes.subarray(dataStart, dataStart + size);
    expect(crc32(data), "CRC inválido em " + name).toBe(expectedCrc);
    files.set(name, decoder.decode(data));
    offset = dataStart + size;
  }

  const endOffset = bytes.length - 22;
  expect(view.getUint32(endOffset, true)).toBe(0x06054b50);
  expect(view.getUint16(endOffset + 10, true)).toBe(files.size);
  expect(view.getUint32(endOffset + 16, true)).toBe(offset);
  return { files, size: bytes.length };
}

function expectWellFormedXml(xml: string) {
  const stack: string[] = [];
  const tags = xml.match(/<\/?[A-Za-z][A-Za-z0-9:_-]*(?:\s[^<>]*?)?\s*\/?>/g) ?? [];
  for (const tag of tags) {
    const closing = tag.startsWith("</");
    const selfClosing = tag.endsWith("/>");
    const name = tag.match(/^<\/?([A-Za-z][A-Za-z0-9:_-]*)/)?.[1];
    if (!name) throw new Error("Tag XML inválida: " + tag.slice(0, 80));
    if (closing) {
      expect(stack.pop(), "fechamento XML inesperado: " + name).toBe(name);
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  expect(stack, "tags XML não fechadas").toEqual([]);
}


function parseXml(xml: string) {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0);
  return parsed;
}

async function verify3mf(config: typeof defaultPressOrnamentConfig, expectedTitle = "Ball ornament") {
  const bytes = createBallOrnament3MF(config, expectedTitle);
  const { files, size } = readStoredZip(bytes);
  expect(bytes).toBeInstanceOf(Uint8Array);
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

  const modelXml = files.get("3D/3dmodel.model")!;
  expectWellFormedXml(modelXml);
  expect(modelXml).toContain('<model unit="millimeter"');
  expect(modelXml).toContain('<metadata name="Application">BambuStudio-02.08.02.61</metadata>');
  expect(modelXml).toContain('<metadata name="Title">' + expectedTitle + '</metadata>');
  expect(modelXml).toContain('<metadata name="Description">Made with GigaPrint (gigaprint.app)</metadata>');
  expect(modelXml).toContain('<base name="Product filament" displaycolor="' + config.meshColor.toUpperCase() + 'FF"/>');
  expect(modelXml).toContain('<base name="Press tooling filament" displaycolor="' + config.pressColor.toUpperCase() + 'FF"/>');

  const objectPattern = /<object id="(\\d+)" name="([^"]+)" type="model" pid="1" pindex="(\\d+)"><mesh><vertices>([\\s\\S]*?)<\\/vertices><triangles>([\\s\\S]*?)<\\/triangles><\\/mesh><\\/object>/g;
  const objects = [...modelXml.matchAll(objectPattern)];
  expect(objects).toHaveLength(4);
  expect(objects.map((match) => match[2])).toEqual([
    "Ornament mesh, front half",
    "Ornament mesh, back half",
    "Press cavity block",
    "Press plunger",
  ]);
  expect(objects.map((match) => match[3])).toEqual(["0", "0", "1", "1"]);

  for (const object of objects) {
    const vertexXml = object[4]!;
    const triangleXml = object[5]!;
    const triangleCount = (triangleXml.match(/<triangle /g) ?? []).length;
    expect((vertexXml.match(/<vertex /g) ?? []).length).toBeGreaterThan(100);
    expect(triangleCount).toBeGreaterThan(100);
    expect(triangleCount).toBeLessThan(150_000);

    const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
    const vertexPattern = /<vertex x="([0-9.-]+)" y="([0-9.-]+)" z="([0-9.-]+)"\/>/g;
    for (const vertex of vertexXml.matchAll(vertexPattern)) {
      for (let axis = 0; axis < 3; axis++) {
        const value = Number(vertex[axis + 1]);
        min[axis] = Math.min(min[axis]!, value);
        max[axis] = Math.max(max[axis]!, value);
      }
    }
    expect(min[0]).toBeGreaterThanOrEqual(-0.001);
    expect(min[1]).toBeGreaterThanOrEqual(-0.001);
    expect(min[2]).toBeCloseTo(0, 3);
    expect(max[0]).toBeLessThanOrEqual(256.001);
    expect(max[1]).toBeLessThanOrEqual(256.001);
    expect(max[2]).toBeLessThanOrEqual(256.001);
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
