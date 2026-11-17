import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

export const Route = createFileRoute("/adornos")({ component: AdornosPage });

type ShapeName = "Bola" | "Pato" | "Porco" | "Gato" | "Cachorro" | "Estrela" | "Árvore" | "Coração";
type MeshName = "Grade" | "Diamante" | "Triângulos";
const shapes: ShapeName[] = ["Bola", "Pato", "Porco", "Gato", "Cachorro", "Estrela", "Árvore", "Coração"];
const meshes: MeshName[] = ["Grade", "Diamante", "Triângulos"];
const icons: Record<ShapeName, string> = { Bola: "🔴", Pato: "🦆", Porco: "🐷", Gato: "🐱", Cachorro: "🐶", Estrela: "⭐", Árvore: "🎄", Coração: "♥" };

function outline(name: ShapeName): THREE.Shape {
  const s = new THREE.Shape();
  if (name === "Bola") { s.absarc(0, 0, 1, 0, Math.PI * 2, false); return s; }
  if (name === "Coração") {
    s.moveTo(0, -0.96); s.bezierCurveTo(-0.22, -0.68, -1.05, -0.17, -0.93, 0.43);
    s.bezierCurveTo(-0.84, 1.08, -0.19, 1.05, 0, 0.62); s.bezierCurveTo(0.19, 1.05, 0.84, 1.08, 0.93, 0.43);
    s.bezierCurveTo(1.05, -0.17, 0.22, -0.68, 0, -0.96); return s;
  }
  if (name === "Estrela") {
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.47 : 1; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); }
    s.closePath(); return s;
  }
  if (name === "Árvore") {
    s.moveTo(-0.22, -1); s.lineTo(0.22, -1); s.lineTo(0.22, -0.69); s.lineTo(0.9, -0.69);
    s.lineTo(0.55, -0.19); s.lineTo(0.75, -0.19); s.lineTo(0.34, 0.31);
    s.lineTo(0.56, 0.31); s.lineTo(0, 1); s.lineTo(-0.56, 0.31);
    s.lineTo(-0.34, 0.31); s.lineTo(-0.75, -0.19); s.lineTo(-0.55, -0.19);
    s.lineTo(-0.9, -0.69); s.lineTo(-0.22, -0.69); s.closePath(); return s;
  }
  if (name === "Gato" || name === "Cachorro") {
    s.moveTo(-0.77, -0.48); s.bezierCurveTo(-1.1, 0.08, -0.84, 0.62, -0.72, 0.68);
    if (name === "Gato") { s.lineTo(-0.9, 1); s.lineTo(-0.27, 0.78); s.lineTo(0.27, 0.78); s.lineTo(0.9, 1); s.lineTo(0.72, 0.68); }
    else { s.lineTo(-1, 0.78); s.lineTo(-0.47, 0.65); s.lineTo(0.47, 0.65); s.lineTo(1, 0.78); s.lineTo(0.72, 0.68); }
    s.bezierCurveTo(0.84, 0.62, 1.1, 0.08, 0.77, -0.48); s.bezierCurveTo(0.36, -1.12, -0.36, -1.12, -0.77, -0.48); return s;
  }
  if (name === "Porco") {
    s.moveTo(-0.76, -0.5); s.bezierCurveTo(-1, -0.2, -0.96, 0.38, -0.75, 0.55);
    s.lineTo(-0.95, 0.98); s.lineTo(-0.39, 0.76); s.bezierCurveTo(0, 0.91, 0.39, 0.76, 0.39, 0.76);
    s.lineTo(0.95, 0.98); s.lineTo(0.75, 0.55); s.bezierCurveTo(0.96, 0.38, 1, -0.2, 0.76, -0.5);
    s.bezierCurveTo(0.38, -1.04, -0.38, -1.04, -0.76, -0.5); return s;
  }
  // Pato: corpo arredondado, cauda, pescoço, cabeça e bico.
  s.moveTo(-0.9, -0.5); s.bezierCurveTo(-1.02, -0.12, -0.83, 0.2, -0.38, 0.18);
  s.bezierCurveTo(-0.46, 0.58, -0.12, 0.87, 0.13, 0.87); s.bezierCurveTo(0.56, 0.89, 0.68, 0.54, 0.53, 0.35);
  s.lineTo(1, 0.24); s.lineTo(0.55, 0.06); s.bezierCurveTo(0.5, -0.3, 0.8, -0.61, 0.35, -0.83);
  s.bezierCurveTo(-0.19, -1.05, -0.65, -0.75, -0.9, -0.5); return s;
}

function makeDisk(name: ShapeName, diameter: number, pattern: MeshName, pitch: number): THREE.Group {
  const root = new THREE.Group();
  const shape = outline(name);
  const size = diameter / 2;
  const depth = 1.25;
  const outlinePoints = shape.getPoints(100);
  const edge = new THREE.CatmullRomCurve3(outlinePoints.map(p => new THREE.Vector3(p.x * size, p.y * size, depth / 2)), true);
  const edgeRadius = Math.max(0.9, diameter / 85);
  const solid = new THREE.MeshStandardMaterial({ color: "#dc2349", roughness: 0.56, metalness: 0.04, side: THREE.DoubleSide });
  const edgeMesh = new THREE.Mesh(new THREE.TubeGeometry(edge, Math.max(100, outlinePoints.length), edgeRadius, 6, true), solid);
  root.add(edgeMesh);
  const lines: Array<[number, number, number, number]> = [];
  const spacing = Math.max(4, pitch);
  const bound = size * 1.2;
  if (pattern === "Grade" || pattern === "Diamante") {
    for (let d = -bound * 2; d <= bound * 2; d += spacing) {
      if (pattern === "Grade") { lines.push([-bound, d, bound, d], [d, -bound, d, bound]); }
      else { lines.push([-bound, -bound + d, bound, bound + d], [-bound, bound - d, bound, -bound - d]); }
    }
  } else {
    for (let d = -bound * 2; d <= bound * 2; d += spacing) {
      lines.push([-bound, d, bound, d], [-bound, -bound + d, bound, bound + d], [-bound, bound - d, bound, -bound - d]);
    }
  }
  const inside = (x: number, y: number) => shape.containsPoint(new THREE.Vector2(x / size, y / size));
  const segments: THREE.Vector3[] = [];
  // Sample straight lattice bars into short pieces, clipping them to the chosen silhouette.
  for (const [ax, ay, bx, by] of lines) {
    const length = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(length / 1.4);
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps, tm = (t0 + t1) / 2;
      const mx = ax + (bx - ax) * tm, my = ay + (by - ay) * tm;
      if (!inside(mx, my)) continue;
      segments.push(new THREE.Vector3(ax + (bx - ax) * t0, ay + (by - ay) * t0, 0), new THREE.Vector3(ax + (bx - ax) * t1, ay + (by - ay) * t1, 0));
    }
  }
  // These are preview lines. STL is intentionally disabled until watertight lattice geometry is implemented.
  const lineGeo = new THREE.BufferGeometry().setFromPoints(segments);
  root.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: "#e52b52" })));
  // Hanging loop: visual reference only.
  const loop = new THREE.Mesh(new THREE.TorusGeometry(3.6, 1.1, 8, 24), new THREE.MeshStandardMaterial({ color: "#c99a30" }));
  loop.position.set(0, size + 5, 0); root.add(loop);
  return root;
}

function Preview({ model, view, wire }: { model: THREE.Group; view: string; wire: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const refs = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls } | null>(null);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#f4f7fd");
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1500);
    camera.position.set(90, 85, 135);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    node.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    controls.minDistance = 50; controls.maxDistance = 600;
    refs.current = { camera, controls };
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa5acc1, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(80, 120, 110); scene.add(light);
    const grid = new THREE.GridHelper(256, 16, 0xc4d3ed, 0xdce5f5);
    grid.rotation.x = Math.PI / 2; grid.position.z = -2; scene.add(grid);
    scene.add(model);
    const resize = () => { const w = node.clientWidth, h = node.clientHeight; if (!w || !h) return; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    const ro = new ResizeObserver(resize); ro.observe(node); resize();
    let frame = 0; const tick = () => { frame = requestAnimationFrame(tick); controls.update(); renderer.render(scene, camera); }; tick();
    return () => { cancelAnimationFrame(frame); ro.disconnect(); controls.dispose(); scene.remove(model); renderer.dispose(); renderer.domElement.remove(); refs.current = null; };
  }, [model]);
  useEffect(() => {
    const r = refs.current; if (!r) return;
    const d = 145;
    r.camera.position.set(...(view === "Frente" ? [0, 0, d] : view === "Acima" ? [0, d, 0.01] : view === "Lado" ? [d, 0, 0.01] : [90, 85, 135]) as [number, number, number]);
    r.camera.up.set(0, 1, 0); r.controls.target.set(0, 0, 0); r.controls.update();
  }, [view, model]);
  useEffect(() => { model.traverse(obj => { if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) obj.material.wireframe = wire; }); }, [model, wire]);
  return <div ref={host} className="h-full w-full" aria-label="Visualização tridimensional do adorno" />;
}

function AdornosPage() {
  const [shape, setShape] = useState<ShapeName>("Bola");
  const [pattern, setPattern] = useState<MeshName>("Grade");
  const [diameter, setDiameter] = useState(80);
  const [pitch, setPitch] = useState(9);
  const [view, setView] = useState("3D");
  const [wire, setWire] = useState(false);
  const model = useMemo(() => makeDisk(shape, diameter, pattern, pitch), [shape, diameter, pattern, pitch]);
  useEffect(() => () => { model.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.dispose()); } }); }, [model]);
  const button = "rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-blue-500";
  return (
    <div className="flex h-dvh min-h-[540px] flex-col bg-[#f4f7fd] text-slate-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3"><Link to="/" className="font-bold text-slate-700">Express'Arte Studio</Link><span className="text-slate-300">/</span><strong>Adornos 3D</strong></div>
        <span className="rounded-md bg-blue-50 px-3 py-1 text-xs text-blue-700">Protótipo visual • não pronto para impressão</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 overflow-y-auto border-b border-slate-200 bg-white p-4 md:w-[320px] md:border-b-0 md:border-r">
          <h1 className="text-xl font-bold">Fábrica de Adornos</h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">Primeira visualização: escolha a silhueta, o padrão e as dimensões. A malha ainda é uma prévia, não um arquivo imprimível.</p>
          <div className="my-5 border-t border-slate-200" />
          <h2 className="text-xs font-bold uppercase tracking-wider">01 · Forma do adorno</h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {shapes.map(name => <button key={name} onClick={() => setShape(name)} aria-pressed={shape === name} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-1 text-xs ${shape === name ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-white hover:border-blue-300"}`}><span className="text-xl" aria-hidden>{icons[name]}</span>{name}</button>)}
          </div>
          <h2 className="mt-6 text-xs font-bold uppercase tracking-wider">02 · Diâmetro</h2>
          <div className="mt-2 flex flex-wrap gap-2">{[60, 80, 100].map(v => <button key={v} className={button + (diameter === v ? " !border-blue-600 !bg-blue-50" : "")} onClick={() => setDiameter(v)}>{v} mm</button>)}</div>
          <label className="mt-3 block text-xs text-slate-500">Personalizado: {diameter} mm<input aria-label="Diâmetro em milímetros" className="mt-1 w-full" type="range" min="40" max="160" step="5" value={diameter} onChange={e => setDiameter(Number(e.target.value))} /></label>
          <h2 className="mt-6 text-xs font-bold uppercase tracking-wider">03 · Padrão de malha</h2>
          <div className="mt-2 flex flex-wrap gap-2">{meshes.map(name => <button key={name} onClick={() => setPattern(name)} className={button + (pattern === name ? " !border-blue-600 !bg-blue-50" : "")}>{name}</button>)}</div>
          <label className="mt-3 block text-xs text-slate-500">Espaçamento: {pitch} mm<input aria-label="Espaçamento da malha" className="mt-1 w-full" type="range" min="5" max="18" value={pitch} onChange={e => setPitch(Number(e.target.value))} /></label>
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">O molde, as duas metades, os encaixes e a exportação STL/3MF ainda não estão implementados. Esta etapa serve para validar o layout e a aparência da geometria.</div>
        </aside>
        <main className="flex min-h-[360px] min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs">{shape} · {diameter} mm</span>
            <div className="flex flex-wrap gap-1">{["3D", "Frente", "Acima", "Lado"].map(v => <button key={v} className={button + (view === v ? " !border-blue-600 !bg-blue-50" : "")} onClick={() => setView(v)}>{v}</button>)}<button className={button} onClick={() => setWire(w => !w)} aria-pressed={wire}>Arame</button></div>
          </div>
          <div className="relative min-h-0 flex-1"><Preview model={model} view={view} wire={wire} /></div>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white p-3">
            <div><strong className="text-sm">ADORNO {shape.toUpperCase()}</strong><p className="text-xs text-slate-500">Prévia geométrica em desenvolvimento</p></div>
            <div className="flex gap-2"><button disabled title="Disponível após validação da geometria imprimível" className={button + " cursor-not-allowed opacity-50"}>Exportar STL</button><button disabled title="Disponível em etapa posterior" className="cursor-not-allowed rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white opacity-50">Exportar 3MF</button></div>
          </footer>
        </main>
      </div>
    </div>
  );
}
