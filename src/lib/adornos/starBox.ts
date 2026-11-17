import * as THREE from "three";

/**
 * Caixa aberta em forma de estrela: base sólida e paredes elevadas.
 * As dimensões são em milímetros. Prévia geométrica, ainda não validada para impressão.
 */
export function makeStarBox(diameter: number, height: number): THREE.Group {
  const group = new THREE.Group();
  const radius = diameter / 2;
  const wall = 3;
  const floor = 2;
  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.47;
    const innerR = Math.max(1, r - wall);
    outer.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    inner.push(new THREE.Vector2(Math.cos(angle) * innerR, Math.sin(angle) * innerR));
  }
  const makeOutline = (points: THREE.Vector2[]): THREE.Shape => {
    const shape = new THREE.Shape();
    points.forEach((point, index) => index === 0 ? shape.moveTo(point.x, point.y) : shape.lineTo(point.x, point.y));
    shape.closePath();
    return shape;
  };
  const material = new THREE.MeshStandardMaterial({
    color: "#d92c51", roughness: 0.52, metalness: 0.06, side: THREE.DoubleSide,
  });
  const base = new THREE.Mesh(
    new THREE.ExtrudeGeometry(makeOutline(outer), { depth: floor, bevelEnabled: false, curveSegments: 1 }),
    material,
  );
  base.name = "Fundo da estrela";
  group.add(base);

  const wallShape = makeOutline(outer);
  const hole = new THREE.Path();
  [...inner].reverse().forEach((point, index) => index === 0 ? hole.moveTo(point.x, point.y) : hole.lineTo(point.x, point.y));
  hole.closePath();
  wallShape.holes.push(hole);
  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wallShape, {
      depth: Math.max(3, height - floor), bevelEnabled: false, curveSegments: 1,
    }),
    material,
  );
  rim.position.z = floor;
  rim.name = "Paredes da estrela";
  group.add(rim);
  group.position.z = -height / 2;
  return group;
}
