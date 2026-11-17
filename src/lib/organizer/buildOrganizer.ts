import * as THREE from "three";
import type { OrganizerResult, Part } from "./organizer";

// Part as Z-up group in its own local coordinates (origin at part corner) — what gets exported.
export function buildPart(part: Part, material: THREE.Material = new THREE.MeshStandardMaterial()) {
  const group = new THREE.Group();
  group.name = `part-${part.id}`;
  for (const b of part.boxes) {
    const size = b.max.map((value, i) => value - (b.min[i] ?? 0));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.name = b.name;
    mesh.position.set((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  return group;
}

export async function exportPartSTL(part: Part) {
  const { STLExporter } = await import("three/examples/jsm/exporters/STLExporter.js");
  const group = buildPart(part);
  const data = new STLExporter().parse(group, { binary: true }) as DataView;
  group.traverse((c) => c instanceof THREE.Mesh && c.geometry.dispose());
  return data;
}

// Display object for the Y-up viewer: tray parts plus the box envelope, centered on origin.
export function buildOrganizerScene(result: OrganizerResult, colors: THREE.Color[], edgeColor: THREE.Color) {
  const root = new THREE.Group();
  const zUp = new THREE.Group();
  zUp.rotation.x = -Math.PI / 2;
  const { innerLength: L, innerWidth: W, innerDepth: D, clearance: c } = result.config;
  zUp.position.set(-L / 2, 0, W / 2);
  result.parts.forEach((p, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length] ?? edgeColor, metalness: 0.1, roughness: 0.6 });
    const g = buildPart(p, mat);
    g.position.set(c + p.offsetX + (result.parts.length > 1 ? i * 2 : 0), c, 0);
    zUp.add(g);
  });
  const env = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(L, W, D)),
    new THREE.LineBasicMaterial({ color: edgeColor }),
  );
  env.position.set(L / 2, W / 2, D / 2);
  zUp.add(env);
  root.add(zUp);
  return root;
}
