import * as THREE from "three";
import type { PressOrnamentConfig } from "@/lib/studio/ornament-press";
import {
  buildReferenceFlatBlank,
  buildReferenceFemaleMold,
  buildReferenceMalePlunger,
  disposeReferenceOrnament,
} from "@/lib/studio/ornament-press-reference";

const BED = { x: 256, y: 256, z: 256 } as const;
const BED_CENTER = { x: 128, y: 128 } as const;
const MAX_TRIANGLES_PER_PART = 120_000;
const MAX_TRIANGLES_TOTAL = 300_000;
const MAX_3MF_BYTES = 28 * 1024 * 1024;

type PartDefinition = {
  id: number;
  name: string;
  extruder: 1 | 2;
  group: THREE.Group;
};

type MeshData = {
  vertices: number[];
  triangles: number[];
  bounds: { min: [number, number, number]; max: [number, number, number] };
  triangleCount: number;
};

function safeNumber(value: number) {
  if (!Number.isFinite(value)) throw new Error("A geometria contém coordenadas inválidas.");
  return Math.abs(value) < 0.0005 ? 0 : value;
}

function assertWatertightChildMesh(
  mesh: THREE.Mesh,
  partName: string,
  matrix: THREE.Matrix4,
) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const e = matrix.elements;
  const keyAt = (vertex: number) => {
    const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
    const tx = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
    const ty = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
    const tz = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
    return [tx, ty, tz].map((value) => Math.round(value * 1000)).join(",");
  };
  const edgeUses = new Map<string, number>();
  let signedVolume = 0;
  const aPoint = new THREE.Vector3();
  const bPoint = new THREE.Vector3();
  const cPoint = new THREE.Vector3();
  for (let offset = 0; offset < count; offset += 3) {
    const ids = [
      index ? index.getX(offset) : offset,
      index ? index.getX(offset + 1) : offset + 1,
      index ? index.getX(offset + 2) : offset + 2,
    ];
    aPoint.fromBufferAttribute(position, ids[0]!).applyMatrix4(matrix);
    bPoint.fromBufferAttribute(position, ids[1]!).applyMatrix4(matrix);
    cPoint.fromBufferAttribute(position, ids[2]!).applyMatrix4(matrix);
    if (matrix.determinant() < 0) [bPoint, cPoint] = [cPoint, bPoint];
    signedVolume += aPoint.dot(bPoint.clone().cross(cPoint)) / 6;
    const keys = ids.map(keyAt);
    for (let edge = 0; edge < 3; edge++) {
      const a = keys[edge]!;
      const b = keys[(edge + 1) % 3]!;
      const key = a < b ? a + "|" + b : b + "|" + a;
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
    }
  }
  const bad = [...edgeUses.entries()].filter(([, uses]) => uses !== 2);
  const badEdges = bad.length;
  if (badEdges) {
    throw new Error(
      partName + " / " + mesh.name + ": malha não-manifold (" +
      badEdges + " arestas abertas ou compartilhadas incorretamente). " +
      "Amostra: " + bad.slice(0, 8).map(([edge, uses]) => edge + " [" + uses + "]").join("; "),
    );
  }
  if (signedVolume <= 0) {
    throw new Error(
      partName + " / " + mesh.name + ": orientação de faces inválida (volume assinado " +
      signedVolume.toFixed(3) + " mm³).",
    );
  }
}

function collectPartMesh(group: THREE.Group, partName: string): MeshData {
  group.updateMatrixWorld(true);
  const vertices: number[] = [];
  const triangles: number[] = [];
  const bounds = {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [number, number, number],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY] as [number, number, number],
  };
  let meshCount = 0;

  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry;
    const position = geometry.getAttribute("position");
    if (!position || position.count < 3) return;
    meshCount += 1;
    assertWatertightChildMesh(child, partName, child.matrixWorld);

    const base = vertices.length / 3;
    const matrix = child.matrixWorld;
    const e = matrix.elements;
    const determinant = matrix.determinant();
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const tx = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
      const ty = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
      const tz = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
      vertices.push(tx, ty, tz);
    }

    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    if (count % 3 !== 0) throw new Error(partName + ": malha com quantidade de índices inválida.");
    for (let offset = 0; offset < count; offset += 3) {
      const a = index ? index.getX(offset) : offset;
      let b = index ? index.getX(offset + 1) : offset + 1;
      let c = index ? index.getX(offset + 2) : offset + 2;
      if (determinant < 0) [b, c] = [c, b];
      triangles.push(base + a, base + b, base + c);
    }
  });

  if (!meshCount || !vertices.length || !triangles.length) {
    throw new Error(partName + ": não foi possível gerar uma malha imprimível.");
  }

  for (let index = 0; index < vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = vertices[index + axis]!;
      bounds.min[axis] = Math.min(bounds.min[axis], value);
      bounds.max[axis] = Math.max(bounds.max[axis], value);
    }
  }

  const size: [number, number, number] = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  if (size[0] > BED.x || size[1] > BED.y || size[2] > BED.z) {
    throw new Error(
      partName + " excede o volume da Bambu Lab A1 (256 × 256 × 256 mm). " +
      "Dimensões calculadas: " + size.map((v) => v.toFixed(1)).join(" × ") +
      " mm. Reduza o tamanho.",
    );
  }

  const shift: [number, number, number] = [
    BED_CENTER.x - (bounds.min[0] + bounds.max[0]) / 2,
    BED_CENTER.y - (bounds.min[1] + bounds.max[1]) / 2,
    -bounds.min[2],
  ];
  for (let index = 0; index < vertices.length; index += 3) {
    vertices[index] = safeNumber(vertices[index]! + shift[0]);
    vertices[index + 1] = safeNumber(vertices[index + 1]! + shift[1]);
    vertices[index + 2] = safeNumber(vertices[index + 2]! + shift[2]);
  }

  const translatedBounds = {
    min: [bounds.min[0] + shift[0], bounds.min[1] + shift[1], 0] as [number, number, number],
    max: [bounds.max[0] + shift[0], bounds.max[1] + shift[1], size[2]] as [number, number, number],
  };
  if (
    translatedBounds.min[0] < -0.001 ||
    translatedBounds.min[1] < -0.001 ||
    translatedBounds.max[0] > BED.x + 0.001 ||
    translatedBounds.max[1] > BED.y + 0.001 ||
    translatedBounds.min[2] < -0.001 ||
    translatedBounds.max[2] > BED.z + 0.001
  ) {
    throw new Error(partName + ": a peça ficou fora da área de impressão da Bambu Lab A1.");
  }

  const triangleCount = triangles.length / 3;
  if (triangleCount > MAX_TRIANGLES_PER_PART) {
    throw new Error(
      partName + ": a malha excedeu o limite de " +
      MAX_TRIANGLES_PER_PART.toLocaleString("pt-BR") +
      " triângulos. Reduza a resolução ou o tamanho antes de exportar.",
    );
  }

  return { vertices, triangles, bounds: translatedBounds, triangleCount };
}

function xmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function modelXml(parts: Array<{ definition: PartDefinition; mesh: MeshData }>, title: string) {
  const objectXml = parts.map(({ definition, mesh }) => {
    const vertices = [];
    for (let index = 0; index < mesh.vertices.length; index += 3) {
      vertices.push(
        '<vertex x="' + mesh.vertices[index]!.toFixed(3) +
        '" y="' + mesh.vertices[index + 1]!.toFixed(3) +
        '" z="' + mesh.vertices[index + 2]!.toFixed(3) + '"/>',
      );
    }
    const faces = [];
    for (let index = 0; index < mesh.triangles.length; index += 3) {
      faces.push(
        '<triangle v1="' + mesh.triangles[index] +
        '" v2="' + mesh.triangles[index + 1] +
        '" v3="' + mesh.triangles[index + 2] + '"/>',
      );
    }
    const pindex = definition.extruder - 1;
    return '<object id="' + definition.id + '" name="' + xmlEscape(definition.name) +
      '" type="model" pid="1" pindex="' + pindex + '"><mesh><vertices>' +
      vertices.join("") + '</vertices><triangles>' + faces.join("") +
      '</triangles></mesh></object>';
  }).join("");

  const items = parts.map(({ definition }) => '<item objectid="' + definition.id + '"/>').join("");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    '<metadata name="Application">BambuStudio-02.08.02.61</metadata>' +
    '<metadata name="Title">' + xmlEscape(title) + '</metadata>' +
    '<metadata name="Description">Made with GigaPrint (gigaprint.app)</metadata>' +
    '<resources><basematerials id="1">' +
    '<base name="Product filament" displaycolor="#F2A0B5FF"/>' +
    '<base name="Press tooling filament" displaycolor="#2E8B57FF"/>' +
    '</basematerials>' + objectXml + '</resources><build>' + items + '</build></model>';
}

function modelSettingsXml(parts: Array<{ definition: PartDefinition }>) {
  const objects = parts.map(({ definition }) =>
    '<object id="' + definition.id + '"><metadata key="name" value="' +
    xmlEscape(definition.name) + '"/><metadata key="extruder" value="' +
    definition.extruder + '"/></object>',
  ).join("");
  const plates = parts.map(({ definition }, index) =>
    '<plate><metadata key="plater_id" value="' + (index + 1) +
    '"/><metadata key="plater_name" value="Plate ' + (index + 1) +
    '"/><metadata key="locked" value="false"/><model_instance>' +
    '<metadata key="object_id" value="' + definition.id +
    '"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="' +
    (index + 1) + '"/></model_instance></plate>',
  ).join("");
  return '<?xml version="1.0" encoding="UTF-8"?><config>' + objects + plates + '</config>';
}

function projectSettingsJson(meshColor: string, pressColor: string) {
  return JSON.stringify({
    from: "project",
    name: "project_settings",
    version: "02.08.02.61",
    printer_model: "Bambu Lab A1",
    printer_settings_id: "Bambu Lab A1 0.4 nozzle",
    nozzle_diameter: ["0.4"],
    print_settings_id: "0.20mm Standard @BBL A1",
    filament_settings_id: ["Bambu PLA Basic @BBL A1", "Bambu PLA Basic @BBL A1"],
    filament_colour: [meshColor.toUpperCase(), pressColor.toUpperCase()],
  }, null, 2);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function makeZip(entries: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;
  const dosDate = 0x0021;
  const dosTime = 0;
  const utf8Flag = 0x0800;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + name.length);
    const local = new DataView(localHeader.buffer);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, utf8Flag, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, checksum, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    localHeader.set(name, 30);

    const centralHeader = new Uint8Array(46 + name.length);
    const central = new DataView(centralHeader.buffer);
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, utf8Flag, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, checksum, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, localOffset, true);
    centralHeader.set(name, 46);

    localChunks.push(localHeader, data);
    centralChunks.push(centralHeader);
    localOffset += localHeader.length + data.length;
  }

  const centralDirectory = concatBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return concatBytes([...localChunks, centralDirectory, end]);
}

function makePartDefinitions(config: PressOrnamentConfig): PartDefinition[] {
  return [
    { id: 2, name: "Ornament mesh, front half", extruder: 1, group: buildReferenceFlatBlank(config) },
    { id: 3, name: "Ornament mesh, back half", extruder: 1, group: buildReferenceFlatBlank(config) },
    { id: 4, name: "Press cavity block", extruder: 2, group: buildReferenceFemaleMold(config) },
    { id: 5, name: "Press plunger", extruder: 2, group: buildReferenceMalePlunger(config) },
  ];
}

export async function createBallOrnament3MF(config: PressOrnamentConfig, title = "Ball ornament") {
  const definitions = makePartDefinitions(config);
  try {
    const parts = definitions.map((definition) => ({
      definition,
      mesh: collectPartMesh(definition.group, definition.name),
    }));
    const zip = makeZip([
      {
        name: "[Content_Types].xml",
        content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>',
      },
      {
        name: "_rels/.rels",
        content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>',
      },
      { name: "3D/3dmodel.model", content: modelXml(parts, title) },
      { name: "Metadata/model_settings.config", content: modelSettingsXml(parts) },
      { name: "Metadata/project_settings.config", content: projectSettingsJson(config.meshColor, config.pressColor) },
    ]);
    if (zip.byteLength > MAX_3MF_BYTES) {
      throw new Error("O arquivo 3MF ultrapassou 28 MB. Reduza a resolução da malha ou o tamanho.");
    }
    return new Blob([zip], { type: "application/vnd.ms-package.3dmanufacturing-3dmodel+zip" });
  } finally {
    definitions.forEach(({ group }) => disposeReferenceOrnament(group));
  }
}

export function get3MFPartLimit() {
  return MAX_TRIANGLES_PER_PART;
}

export function get3MFTotalLimit() {
  return MAX_TRIANGLES_TOTAL;
}