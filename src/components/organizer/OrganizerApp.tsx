import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Link, ClientOnly } from "@tanstack/react-router";
import { Download, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nav } from "@/components/studio/StudioApp";
import { useStudio } from "@/components/studio/StudioProvider";
import { defaultConfig, downloadBlob, sceneColor } from "@/lib/studio/model";
import {
  defaultOrganizerConfig,
  organizerLayout,
  type OrganizerConfig,
  type SplitMode,
} from "@/lib/organizer/organizer";
import { buildOrganizerScene, exportPartSTL } from "@/lib/organizer/buildOrganizer";
const ModelScene = lazy(() => import("@/components/studio/ModelScene"));

type NumKey = Exclude<keyof OrganizerConfig, "split">;
const groups: { title: string; fields: [NumKey, string, number, number, number][] }[] = [
  {
    title: "Espaço interno da metade vazia",
    fields: [
      ["innerLength", "Comprimento (mm)", 40, 600, 1],
      ["innerWidth", "Largura (mm)", 40, 600, 1],
      ["innerDepth", "Profundidade (mm)", 13, 300, 1],
      ["clearance", "Folga por lado (mm)", 0, 5, 0.1],
    ],
  },
  {
    title: "Bandeja",
    fields: [
      ["height", "Altura externa (mm)", 10, 297, 0.5],
      ["wall", "Parede (mm)", 1.2, 6, 0.1],
      ["base", "Base (mm)", 1.2, 6, 0.1],
    ],
  },
  {
    title: "Divisórias",
    fields: [
      ["cols", "Colunas", 1, 10, 1],
      ["rows", "Linhas", 1, 10, 1],
      ["divider", "Espessura (mm)", 1.2, 6, 0.1],
      ["dividerHeight", "Altura (mm)", 3, 297, 0.5],
    ],
  },
];
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function OrganizerApp() {
  const { organizer, setOrganizer } = useStudio();
  const [view, setView] = useState("3d");
  const result = useMemo(() => organizerLayout(organizer), [organizer]);
  const set = (k: keyof OrganizerConfig, v: number | SplitMode) =>
    setOrganizer((c) => ({ ...c, [k]: v }));
  const buildObject = useCallback(
    () =>
      buildOrganizerScene(
        result,
        [sceneColor("--model-jade"), sceneColor("--model-gold")],
        sceneColor("--muted-foreground"),
      ),
    [result],
  );
  const exportAll = async () => {
    for (const p of result.parts) {
      const data = await exportPartSTL(p);
      const suffix = result.parts.length > 1 ? `-peca-${p.id}` : "";
      downloadBlob(
        new Blob([data.buffer as ArrayBuffer], { type: "model/stl" }),
        `organizador-${fmt(p.length)}x${fmt(p.width)}x${fmt(p.height)}${suffix}.stl`,
      );
    }
  };
  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          <span>
            express<em>'</em>arte<small>CRIATIVIDADE EM CADA CAMADA</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Navegação principal">
          {nav.map((n) => (
            <Link key={n.page} to={n.to} className={`nav-link ${n.page === "organizador" ? "active" : ""}`}>
              <n.icon />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="organizer-page">
        <section className="page-intro">
          <div>
            <h1>Organizador 3D</h1>
            <p>Bandeja com divisórias sob medida para a metade vazia da caixa — Bambu Lab A1.</p>
          </div>
        </section>
        <div className="organizer-layout">
          <aside className="organizer-panel" aria-label="Parâmetros do organizador">
            {groups.map((g) => (
              <fieldset key={g.title}>
                <legend>{g.title}</legend>
                {g.fields.map(([k, label, min, max, step]) => (
                  <label key={k} className="organizer-field">
                    <span>{label}</span>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={organizer[k]}
                      onChange={(e) => set(k, Number(e.target.value))}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            <fieldset>
              <legend>Peças</legend>
              <label className="organizer-field">
                <span>Divisão para a mesa</span>
                <select value={organizer.split} onChange={(e) => set("split", e.target.value as SplitMode)}>
                  <option value="auto">Automática</option>
                  <option value="none">Peça única</option>
                  <option value="two">2 peças</option>
                </select>
              </label>
            </fieldset>
            <Button variant="outline" onClick={() => setOrganizer(defaultOrganizerConfig)}>
              <RotateCcw /> Restaurar padrão
            </Button>
          </aside>
          <section className="organizer-viewport">
            <div className="organizer-view-tabs">
              <Button size="sm" variant={view === "3d" ? "default" : "outline"} onClick={() => setView("3d")}>3D</Button>
              <Button size="sm" variant={view === "2d" ? "default" : "outline"} onClick={() => setView("2d")}>Vista de cima</Button>
            </div>
            <ClientOnly fallback={<div className="empty-view">Carregando modelo…</div>}>
              <Suspense fallback={<div className="empty-view">Carregando modelo…</div>}>
                <ModelScene
                  config={defaultConfig}
                  view={view}
                  zoom={100}
                  reset={0}
                  wireframe={false}
                  buildObject={buildObject}
                  distanceScale={2}
                />
              </Suspense>
            </ClientOnly>
          </section>
          <aside className="organizer-summary" aria-label="Resumo">
            <h2>Resumo</h2>
            <dl>
              <dt>Medida externa</dt>
              <dd>{fmt(result.outerLength)} × {fmt(result.outerWidth)} × {fmt(result.config.height)} mm</dd>
              <dt>Peças</dt>
              <dd>{result.parts.map((p) => `${p.id}: ${fmt(p.length)} × ${fmt(p.width)} mm`).join(" · ")}</dd>
              <dt>Compartimento</dt>
              <dd>
                {result.parts.map((p) => {
                  const c = p.compartments[0]!;
                  return `${fmt(c.length)} × ${fmt(c.width)} × ${fmt(c.depth)} mm (${fmt(c.volumeMl)} ml)`;
                }).join(" · ")}
              </dd>
              <dt>Filamento (PLA, sólido)</dt>
              <dd>≈ {fmt(result.filamentGrams)} g</dd>
              <dt>Folga até a tampa</dt>
              <dd>{fmt(result.config.innerDepth - result.config.height)} mm</dd>
            </dl>
            {result.warnings.map((w) => (
              <p key={w} className="organizer-warning"><TriangleAlert /> {w}</p>
            ))}
            <Button onClick={exportAll} disabled={!result.fitsBed && result.parts.length > 1}>
              <Download /> Exportar STL{result.parts.length > 1 ? " (2 peças)" : ""}
            </Button>
            <p className="organizer-note">3MF não está disponível nesta versão; o Bambu Studio abre o STL normalmente.</p>
          </aside>
        </div>
      </main>
    </>
  );
}
