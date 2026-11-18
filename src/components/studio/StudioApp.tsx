import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Link, ClientOnly } from "@tanstack/react-router";
import {
  Box,
  Shapes,
  FolderOpen,
  Calculator,
  Users,
  Stethoscope,
  Plus,
  Download,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Maximize,
  Move,
  Minus,
  Check,
  ChevronRight,
  Layers,
  Type,
  Palette,
  Settings2,
  Monitor,
  FileBox,
  Upload,
  X,
  ExternalLink,
  Save,
  Trash2,
  CircleHelp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultConfig,
  shapes,
  materials,
  buildModel,
  disposeModel,
  downloadBlob,
  type ModelConfig,
  type ShapeKind,
} from "@/lib/studio/model";
import { ShapeIcon } from "./ShapeIcon";
import { useStudio } from "./StudioProvider";
import { isSTLFileWithinLimit, MAX_STL_FILE_MB } from "@/lib/studio/uploadLimits";
import {
  buildOrnament,
  defaultOrnamentConfig,
  disposeOrnament,
  validateOrnamentConfig,
  type LatticePattern,
  type OrnamentConfig,
} from "@/lib/studio/ornament";
const ModelScene = lazy(() => import("./ModelScene"));
export type StudioPage = "studio" | "formas" | "projetos" | "calculadora" | "mesh" | "comunidade";
export const nav = [
  { to: "/", label: "Studio 3D", icon: Box, page: "studio" },
  { to: "/formas", label: "Formas", icon: Shapes, page: "formas" },
  { to: "/organizador", label: "Organizador 3D", icon: Layers, page: "organizador" },
  { to: "/projetos", label: "Meus projetos", icon: FolderOpen, page: "projetos" },
  { to: "/calculadora", label: "Calculadora", icon: Calculator, page: "calculadora" },
  { to: "/mesh-doctor", label: "Mesh Doctor", icon: Stethoscope, page: "mesh" },
  { to: "/comunidade", label: "Comunidade", icon: Users, page: "comunidade" },
] as const;
const titles: Record<StudioPage, [string, string]> = {
  studio: ["Studio 3D", "Sua ideia ganha forma. Crie, personalize e prepare para imprimir."],
  formas: ["Biblioteca de formas", "Escolha o ponto de partida da sua próxima criação."],
  projetos: ["Meus projetos", "Suas criações nesta sessão."],
  calculadora: ["Calculadora de impressão", "Materiais, energia e tempo de produção."],
  mesh: ["Mesh Doctor", "Inspeção de arquivos STL para impressão 3D."],
  comunidade: ["Comunidade", "Um espaço para quem transforma ideias em arte."],
};
function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="range-field">
      <label className="field-label">
        <span>{label}</span>
        <output>{value.toLocaleString("pt-BR")} mm</output>
      </label>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="range-limits">
        <span>{min} mm</span>
        <span>{max} mm</span>
      </div>
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <Button
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={onChange}
        className={`switch-control ${checked ? "enabled" : ""}`}
        variant="ghost"
      >
        <span className="switch-thumb" />
      </Button>
    </div>
  );
}
export default function StudioApp({ page = "studio" }: { page?: StudioPage }) {
  const { config, setConfig, projects, setProjects } = useStudio();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [view, setView] = useState("3d");
  const [zoom, setZoom] = useState(100);
  const [reset, setReset] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [editorMode, setEditorMode] = useState<"medalha" | "ornament">("medalha");
  const [ornamentConfig, setOrnamentConfig] = useState<OrnamentConfig>(defaultOrnamentConfig);
  const [dialog, setDialog] = useState<"export" | "blender" | "help" | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mesh, setMesh] = useState<{
    name: string;
    triangles: number;
    size: number;
    dimensions: string;
    closed: boolean;
  } | null>(null);
  const [cost, setCost] = useState({
    weight: 50,
    price: 100,
    hours: 3,
    power: 150,
    kwh: 0.9,
    margin: 30,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const update = <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const updateOrnament = <K extends keyof OrnamentConfig>(key: K, value: OrnamentConfig[K]) =>
    setOrnamentConfig((current) => validateOrnamentConfig({ ...current, [key]: value }));
  const buildOrnamentPreview = useCallback(
    () => buildOrnament(ornamentConfig),
    [ornamentConfig],
  );
  const notify = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 3500);
  };
  const filtered = shapes.filter(
    (s) =>
      (category === "Todas" || s.category === category) &&
      s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const save = () => {
    if (editorMode === "ornament") {
      const project = {
        format: "Perfect Site Creator",
        version: 1,
        type: "perforated-ornament",
        config: ornamentConfig,
      };
      setProjects((p) => [
        ...p,
        { id: Date.now(), kind: "ornament", ornamentConfig: { ...ornamentConfig } },
      ]);
      downloadBlob(
        new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
        "PerfectSiteCreator-adorno.json",
      );
      notify("Adorno salvo em Meus projetos e exportado em JSON.");
      return;
    }
    setProjects((p) => [...p, { id: Date.now(), config: { ...config } }]);
    downloadBlob(
      new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }),
      "ExpressArte-projeto.json",
    );
    notify("Projeto salvo e baixado no seu computador.");
  };
  const exportModel = async (format: "stl" | "glb") => {
    setBusy(true);
    let model: ReturnType<typeof buildModel> | null = null;
    try {
      model = editorMode === "ornament" ? buildOrnament(ornamentConfig) : buildModel(config);
      if (format === "stl") {
        const { STLExporter } = await import("three/examples/jsm/exporters/STLExporter.js");
        const data = new STLExporter().parse(model, { binary: true });
        downloadBlob(
          new Blob([new Uint8Array(data.buffer)], { type: "application/sla" }),
          editorMode === "ornament" ? "PerfectSiteCreator-adorno-montado.stl" : "ExpressArte-medalha.stl",
        );
        notify(
          editorMode === "ornament"
            ? "STL do conjunto exportado. STL não preserva as cores; confira a montagem no Bambu Studio."
            : "Modelo exportado. Revise a geometria no fatiador antes de imprimir.",
        );
      } else {
        const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
        const result = await new GLTFExporter().parseAsync(model, { binary: true });
        if (result instanceof ArrayBuffer) {
          downloadBlob(
            new Blob([result], { type: "model/gltf-binary" }),
            editorMode === "ornament" ? "PerfectSiteCreator-adorno-colorido.glb" : "ExpressArte-medalha.glb",
          );
          notify("Modelo GLB exportado com as cores e os componentes separados.");
        } else {
          throw new Error("O exportador não retornou um arquivo GLB.");
        }
      }
      setDialog(null);
    } catch (error) {
      notify(error instanceof Error ? `Não foi possível exportar: ${error.message}` : "Não foi possível exportar o modelo.");
    } finally {
      if (model) {
        if (editorMode === "ornament") disposeOrnament(model);
        else disposeModel(model);
      }
      setBusy(false);
    }
  };
  const inspectFile = async (file: File) => {
    if (!isSTLFileWithinLimit(file.size)) {
      notify(`O limite é de ${MAX_STL_FILE_MB} MB por arquivo.`);
      return;
    }
    try {
      const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
      const geometry = new STLLoader().parse(await file.arrayBuffer());
      geometry.computeBoundingBox();
      const position = geometry.getAttribute("position"),
        box = geometry.boundingBox;
      if (!box || position.count === 0) throw new Error("empty");
      const edges = new Map<string, number>();
      for (let i = 0; i < position.count; i += 3) {
        const vertices = [0, 1, 2].map((j) =>
          [position.getX(i + j), position.getY(i + j), position.getZ(i + j)]
            .map((n) => n.toFixed(4))
            .join(","),
        );
        for (let j = 0; j < 3; j++) {
          const key = [vertices[j], vertices[(j + 1) % 3]].sort().join("|");
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      setMesh({
        name: file.name,
        triangles: position.count / 3,
        size: file.size,
        dimensions: `${(box.max.x - box.min.x).toFixed(1)} × ${(box.max.y - box.min.y).toFixed(1)} × ${(box.max.z - box.min.z).toFixed(1)} mm`,
        closed: [...edges.values()].every((n) => n === 2),
      });
      geometry.dispose();
    } catch {
      notify("Arquivo STL inválido ou vazio.");
    }
  };
  const library = (
    <>
      <div className="library-controls">
        <div className="search-field">
          <Search />
          <input
            placeholder="Buscar forma..."
            aria-label="Buscar forma"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="category-tabs">
          {["Todas", "Básicas", "Especiais"].map((c) => (
            <Button
              key={c}
              variant="ghost"
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
      <div className={page === "formas" ? "full-library" : "shape-grid"}>
        {filtered.map((s) => (
          <Button
            key={s.kind}
            variant="ghost"
            className={`shape-card ${config.shape === s.kind ? "selected" : ""}`}
            onClick={() => {
              update("shape", s.kind);
              if (page === "formas")
                notify(`${s.name} selecionado. Abra o Studio 3D para personalizar.`);
            }}
          >
            <ShapeIcon kind={s.kind} />
            <span>{s.name}</span>
          </Button>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-xs">Nenhuma forma encontrada.</p>
        )}
      </div>
    </>
  );
  const total = (cost.weight / 1000) * cost.price + ((cost.hours * cost.power) / 1000) * cost.kwh;
  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          <svg className="brand-mark" viewBox="0 0 36 40" fill="none" aria-hidden="true">
            <path d="m18 2 16 9v18l-16 9L2 29V11L18 2Z" stroke="currentColor" strokeWidth="2.4" />
            <path
              d="m2 11 16 9 16-9M18 20v18M10 7l16 9v10l-8 5"
              stroke="currentColor"
              strokeWidth="2.4"
            />
          </svg>
          <span>
            express<em>'</em>arte<small>CRIATIVIDADE EM CADA CAMADA</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Navegação principal">
          {nav.map((n) => (
            <Link key={n.page} to={n.to} className={`nav-link ${page === n.page ? "active" : ""}`}>
              <n.icon />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-end">
          <span className="version">STUDIO v7.3</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ajuda"
            title="Ajuda"
            onClick={() => setDialog("help")}
          >
            <CircleHelp />
          </Button>
          <span className="avatar">EA</span>
        </div>
      </header>
      <main>
        <section className="page-intro">
          <div>
            <h1>{titles[page][0]}</h1>
            <p>{titles[page][1]}</p>
          </div>
          {page === "studio" && (
            <div className="intro-actions">
              <Button
                variant="outline"
                onClick={() => {
                  setConfig({ ...defaultConfig });
                  setEditorMode("medalha");
                  setOrnamentConfig(defaultOrnamentConfig);
                  setZoom(100);
                  setReset((r) => r + 1);
                  notify("Novo projeto criado.");
                }}
              >
                <Plus />
                Novo projeto
              </Button>
              <Button
                variant="outline"
                onClick={save}
                title="Salvar projeto"
                aria-label="Salvar projeto"
              >
                <Save />
              </Button>
              <Button className="primary-action" onClick={() => setDialog("export")}>
                <Download />
                Exportar
              </Button>
            </div>
          )}
        </section>
        {page === "studio" && (
          <>
            <div className="workspace" ref={workspaceRef}>
              <aside className="library-panel">
                <div className="panel-heading">
                  <span>{editorMode === "ornament" ? "Padrões perfurados" : "Biblioteca de formas"}</span>
                  <span className="count">{editorMode === "ornament" ? "5 padrões" : "15 formas"}</span>
                </div>
                {editorMode === "ornament" ? (
                  <div className="ornament-pattern-grid">
                    {([
                      ["honeycomb", "Colmeia", "Hexágonos interligados"],
                      ["diamond", "Losango", "Aberturas em diamante"],
                      ["round", "Redondo", "Furos circulares"],
                      ["square", "Quadrado", "Aberturas quadradas"],
                      ["triangle", "Triângulos", "Aberturas triangulares"],
                    ] as [LatticePattern, string, string][]).map(([pattern, label, description]) => (
                      <Button
                        key={pattern}
                        type="button"
                        variant="outline"
                        className={`ornament-pattern-card ${ornamentConfig.pattern === pattern ? "selected" : ""}`}
                        aria-pressed={ornamentConfig.pattern === pattern}
                        onClick={() => updateOrnament("pattern", pattern)}
                      >
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </Button>
                    ))}
                  </div>
                ) : library}
                <div className="library-footer">
                  <Layers size={12} />
                  Feitas para dar vida às suas ideias
                </div>
              </aside>
              <section className="viewport" aria-label="Área de modelagem">
                <ClientOnly fallback={<div className="empty-view">Carregando modelo…</div>}>
                  <Suspense fallback={<div className="empty-view">Carregando modelo…</div>}>
                    <ModelScene
                      config={config}
                      view={view}
                      zoom={zoom}
                      reset={reset}
                      wireframe={wireframe}
                      buildObject={editorMode === "ornament" ? buildOrnamentPreview : undefined}
                    />
                  </Suspense>
                </ClientOnly>
                <div className="viewport-top">
                  <div className="view-tabs">
                    <Button
                      variant="ghost"
                      className={view === "3d" ? "selected" : ""}
                      onClick={() => setView("3d")}
                    >
                      <Box size={12} />
                      3D
                    </Button>
                    <Button
                      variant="ghost"
                      className={view === "2d" ? "selected" : ""}
                      onClick={() => setView("2d")}
                    >
                      Vista superior
                    </Button>
                  </div>
                  <div className="viewport-tools">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Exibir malha"
                      aria-label="Exibir malha"
                      onClick={() => setWireframe((v) => !v)}
                    >
                      <Move />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Redefinir vista"
                      aria-label="Redefinir vista"
                      onClick={() => {
                        setReset((r) => r + 1);
                        setZoom(100);
                        setView("3d");
                      }}
                    >
                      <RotateCcw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Tela cheia"
                      aria-label="Tela cheia"
                      onClick={() => {
                        if (document.fullscreenElement) document.exitFullscreen();
                        else
                          workspaceRef.current
                            ?.requestFullscreen()
                            .catch(() => notify("Tela cheia não disponível neste navegador."));
                      }}
                    >
                      <Maximize />
                    </Button>
                  </div>
                </div>
                <div className="model-badge">
                  <span className="status-dot" />
                  {editorMode === "ornament"
                    ? `Adorno perfurado · ${ornamentConfig.diameter} mm · ${({
                      honeycomb: "Colmeia",
                      diamond: "Losango",
                      round: "Redondo",
                      square: "Quadrado",
                      triangle: "Triângulos",
                    } as Record<LatticePattern, string>)[ornamentConfig.pattern]}`
                    : `${shapes.find((s) => s.kind === config.shape)?.name} · ${config.diameter} × ${config.thickness} mm`}
                </div>
                <div className="orientation">
                  <span className="axis-z">Z</span>
                  <span className="axis-x">X</span>
                  <span className="axis-y">Y</span>
                </div>
                <div className="viewport-bottom">
                  <span>
                    <Monitor />
                    Visualização em tempo real
                  </span>
                  <div className="zoom-tools">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Diminuir zoom"
                      onClick={() => setZoom((z) => Math.max(50, z - 10))}
                    >
                      <Minus />
                    </Button>
                    <span>{zoom}%</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Aumentar zoom"
                      onClick={() => setZoom((z) => Math.min(180, z + 10))}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              </section>
              <aside className="properties-panel">
                <div className="panel-heading">
                  <span>Personalizar modelo</span>
                  <SlidersHorizontal size={15} />
                </div>
                <div className="property-section">
                  <div className="section-label"><Layers /> Modo de criação</div>
                  <div className="editor-mode-switch">
                    <Button
                      type="button"
                      variant={editorMode === "medalha" ? "default" : "outline"}
                      aria-pressed={editorMode === "medalha"}
                      onClick={() => setEditorMode("medalha")}
                    >
                      Medalha
                    </Button>
                    <Button
                      type="button"
                      variant={editorMode === "ornament" ? "default" : "outline"}
                      aria-pressed={editorMode === "ornament"}
                      onClick={() => setEditorMode("ornament")}
                    >
                      Adorno perfurado
                    </Button>
                  </div>
                </div>
                {editorMode === "ornament" ? (
                  <>
                    <div className="property-section">
                      <div className="section-label"><Settings2 /> Dimensões e malha</div>
                      <RangeField
                        label="Diâmetro externo"
                        value={ornamentConfig.diameter}
                        min={40}
                        max={180}
                        onChange={(value) => updateOrnament("diameter", value)}
                      />
                      <RangeField
                        label="Espessura do painel"
                        value={ornamentConfig.panelThickness}
                        min={0.8}
                        max={4}
                        step={0.1}
                        onChange={(value) => updateOrnament("panelThickness", value)}
                      />
                      <RangeField
                        label="Largura do aro"
                        value={ornamentConfig.rimWidth}
                        min={2}
                        max={Math.min(12, ornamentConfig.diameter / 5)}
                        step={0.2}
                        onChange={(value) => updateOrnament("rimWidth", value)}
                      />
                      <label className="field-label" htmlFor="ornament-pattern">Padrão de perfuração</label>
                      <select
                        id="ornament-pattern"
                        className="text-input ornament-select"
                        value={ornamentConfig.pattern}
                        onChange={(event) => updateOrnament("pattern", event.target.value as LatticePattern)}
                      >
                        <option value="honeycomb">Colmeia</option>
                        <option value="diamond">Losango</option>
                        <option value="round">Redondo</option>
                        <option value="square">Quadrado</option>
                        <option value="triangle">Triângulos</option>
                      </select>
                      <RangeField
                        label="Tamanho das aberturas"
                        value={ornamentConfig.cellSize}
                        min={3}
                        max={18}
                        step={0.5}
                        onChange={(value) => updateOrnament("cellSize", value)}
                      />
                      <RangeField
                        label="Espessura das nervuras"
                        value={ornamentConfig.webWidth}
                        min={0.6}
                        max={Math.min(3, ornamentConfig.cellSize / 2)}
                        step={0.1}
                        onChange={(value) => updateOrnament("webWidth", value)}
                      />
                    </div>
                    <div className="property-section">
                      <div className="section-label"><Layers /> Encaixes e montagem</div>
                      <RangeField
                        label="Diâmetro dos pinos"
                        value={ornamentConfig.connectorDiameter}
                        min={1.5}
                        max={Math.max(1.5, ornamentConfig.rimWidth - 0.4 - 2 * ornamentConfig.connectorClearance)}
                        step={0.1}
                        onChange={(value) => updateOrnament("connectorDiameter", value)}
                      />
                      <RangeField
                        label="Folga dos encaixes"
                        value={ornamentConfig.connectorClearance}
                        min={0.1}
                        max={Math.min(0.6, Math.max(0.1, (ornamentConfig.rimWidth - 1.9) / 2))}
                        step={0.05}
                        onChange={(value) => updateOrnament("connectorClearance", value)}
                      />
                      <RangeField
                        label="Altura dos pinos"
                        value={ornamentConfig.connectorHeight}
                        min={1}
                        max={5}
                        step={0.1}
                        onChange={(value) => updateOrnament("connectorHeight", value)}
                      />
                      <Toggle
                        label="Argola para pendurar"
                        checked={ornamentConfig.includeLoop}
                        onChange={() => updateOrnament("includeLoop", !ornamentConfig.includeLoop)}
                      />
                      {ornamentConfig.includeLoop && (
                        <RangeField
                          label="Diâmetro da argola"
                          value={ornamentConfig.loopDiameter}
                          min={3}
                          max={12}
                          step={0.5}
                          onChange={(value) => updateOrnament("loopDiameter", value)}
                        />
                      )}
                    </div>
                    <div className="property-section">
                      <div className="section-label"><Palette /> Cores por componente</div>
                      <label className="ornament-color-field">
                        <span>Painel perfurado</span>
                        <input
                          aria-label="Cor do painel perfurado"
                          type="color"
                          value={ornamentConfig.meshColor}
                          onChange={(event) => updateOrnament("meshColor", event.target.value)}
                        />
                      </label>
                      <label className="ornament-color-field">
                        <span>Aros e argola</span>
                        <input
                          aria-label="Cor dos aros e da argola"
                          type="color"
                          value={ornamentConfig.designColor}
                          onChange={(event) => updateOrnament("designColor", event.target.value)}
                        />
                      </label>
                      <label className="ornament-color-field">
                        <span>Pinos de pressão</span>
                        <input
                          aria-label="Cor dos pinos"
                          type="color"
                          value={ornamentConfig.pressColor}
                          onChange={(event) => updateOrnament("pressColor", event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="ready">
                      <Check />
                      Prévia paramétrica atualizada. Valide encaixes e fatiamento antes de fabricar.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="property-section">
                      <div className="section-label">
                        <Type />
                        Texto em relevo
                      </div>
                      <label className="field-label" htmlFor="model-text">
                        Texto da medalha
                      </label>
                      <input
                        id="model-text"
                        className="text-input"
                        maxLength={22}
                        value={config.name}
                        onChange={(e) => update("name", e.target.value)}
                      />
                      <div className="field-note">
                        <span>Até 22 caracteres</span>
                        <span>{config.name.length}/22</span>
                      </div>
                    </div>
                    <div className="property-section">
                      <div className="section-label">
                        <Settings2 />
                        Dimensões
                      </div>
                      <RangeField
                        label="Diâmetro"
                        value={config.diameter}
                        min={35}
                        max={180}
                        onChange={(v) => update("diameter", v)}
                      />
                      <RangeField
                        label="Espessura da base"
                        value={config.thickness}
                        min={2}
                        max={12}
                        step={0.5}
                        onChange={(v) =>
                          setConfig((c) => ({
                            ...c,
                            thickness: v,
                            textHeight: Math.min(c.textHeight, v * 1.5),
                          }))
                        }
                      />
                      <RangeField
                        label="Altura do relevo"
                        value={config.textHeight}
                        min={0.4}
                        max={Math.min(5, config.thickness * 1.5)}
                        step={0.1}
                        onChange={(v) => update("textHeight", v)}
                      />
                    </div>
                    <div className="property-section">
                      <div className="section-label">
                        <Palette />
                        Material e cor
                      </div>
                      <div className="swatches">
                        {materials.map((m) => (
                          <Button
                            key={m.id}
                            variant="ghost"
                            aria-label={m.name}
                            title={m.name}
                            className={`swatch swatch-${m.id} ${config.material === m.id ? "selected" : ""}`}
                            onClick={() => update("material", m.id)}
                          />
                        ))}
                      </div>
                      <p className="material-name">
                        {materials.find((m) => m.id === config.material)?.name}
                      </p>
                    </div>
                    <div className="property-section">
                      <div className="section-label">
                        <Layers />
                        Acabamento
                      </div>
                      <Toggle
                        label="Argola de fixação"
                        checked={config.ring}
                        onChange={() => update("ring", !config.ring)}
                      />
                      <Toggle
                        label="Borda decorativa"
                        checked={config.border}
                        onChange={() => update("border", !config.border)}
                      />
                    </div>
                    <div className="ready">
                      <Check />
                      Modelo pronto para exportar
                    </div>
                  </>
                )}
              </aside>
            </div>
            <div className="quick-strip">
              <div className="quick-item">
                <div className="quick-icon">
                  <Box />
                </div>
                <div>
                  <strong>Studio Blender</strong>
                  <p>Continue sua criação no Blender.</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Abrir opções Blender"
                  onClick={() => setDialog("blender")}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="quick-item">
                <div className="quick-icon">
                  <Stethoscope />
                </div>
                <div>
                  <strong>Mesh Doctor</strong>
                  <p>Uma malha saudável. Uma impressão melhor.</p>
                </div>
                <Button asChild size="icon" variant="ghost">
                  <Link to="/mesh-doctor" aria-label="Abrir Mesh Doctor">
                    <ChevronRight />
                  </Link>
                </Button>
              </div>
              <div className="quick-item">
                <div className="quick-icon">
                  <FolderOpen />
                </div>
                <div>
                  <strong>Seu próximo projeto começa aqui</strong>
                  <p>Salve sua criação e leve suas ideias com você.</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Salvar criação" onClick={save}>
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
        {page === "formas" && (
          <section className="content-view">
            {library}
            <div className="mt-6 flex justify-end">
              <Button asChild>
                <Link to="/">
                  Abrir Studio 3D
                  <ChevronRight />
                </Link>
              </Button>
            </div>
          </section>
        )}
        {page === "projetos" && (
          <section className="content-view">
            <div className="content-toolbar">
              <input
                type="file"
                accept=".json"
                className="hidden"
                ref={fileRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const parsed: unknown = JSON.parse(await file.text());
                    if (
                      parsed &&
                      typeof parsed === "object" &&
                      "type" in parsed &&
                      parsed.type === "perforated-ornament" &&
                      "config" in parsed
                    ) {
                      const importedOrnament = validateOrnamentConfig(
                        parsed.config as Partial<OrnamentConfig>,
                      );
                      setProjects((p) => [
                        ...p,
                        { id: Date.now(), kind: "ornament", ornamentConfig: importedOrnament },
                      ]);
                      notify("Configuração de adorno importada.");
                      return;
                    }
                    const data = parsed as ModelConfig;
                    if (
                      !shapes.some((s) => s.kind === data.shape) ||
                      typeof data.name !== "string" ||
                      data.name.length > 22 ||
                      ![data.diameter, data.thickness, data.textHeight].every(
                        (v) => typeof v === "number" && Number.isFinite(v),
                      ) ||
                      data.diameter < 35 ||
                      data.diameter > 180 ||
                      data.thickness < 2 ||
                      data.thickness > 12 ||
                      data.textHeight < 0.4 ||
                      data.textHeight > Math.min(5, data.thickness * 1.5) ||
                      !materials.some((m) => m.id === data.material) ||
                      typeof data.ring !== "boolean" ||
                      typeof data.border !== "boolean"
                    )
                      throw new Error();
                    setProjects((p) => [...p, { id: Date.now(), kind: "medalha", config: data }]);
                    notify("Projeto importado.");
                  } catch {
                    notify("Este arquivo não contém um projeto ExpressArte válido.");
                  }
                }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload />
                Importar projeto
              </Button>
              <Button asChild>
                <Link to="/">
                  <Plus />
                  Novo projeto
                </Link>
              </Button>
            </div>
            {projects.length === 0 ? (
              <div className="empty-view">
                <FolderOpen />
                <h2>Uma nova coleção de ideias</h2>
                <p>Seus projetos salvos nesta sessão aparecerão aqui.</p>
              </div>
            ) : (
              projects.map((p) => (
                <div className="project-row" key={p.id}>
                  <div>
                    <h3>{p.kind === "ornament" ? "Adorno perfurado" : p.config.name}</h3>
                    <p>
                      {p.kind === "ornament"
                        ? `${p.ornamentConfig.diameter} mm · ${p.ornamentConfig.pattern} · ${p.ornamentConfig.cellSize} mm de célula`
                        : `${p.config.diameter} mm · ${shapes.find((s) => s.kind === p.config.shape)?.name}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      asChild
                      variant="outline"
                      onClick={() => {
                        if (p.kind === "ornament") {
                          setOrnamentConfig({ ...p.ornamentConfig });
                          setEditorMode("ornament");
                        } else {
                          setConfig(p.config);
                          setEditorMode("medalha");
                        }
                      }}
                    >
                      <Link to="/">Abrir</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir projeto"
                      onClick={() => setProjects((all) => all.filter((item) => item.id !== p.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
        {page === "calculadora" && (
          <section className="content-view tool-layout">
            <div className="tool-form">
              {(
                [
                  { key: "weight", label: "Peso do modelo (g)", step: 1 },
                  { key: "price", label: "Preço do filamento (R$/kg)", step: 1 },
                  { key: "hours", label: "Tempo de impressão (horas)", step: 0.5 },
                  { key: "power", label: "Potência da impressora (W)", step: 1 },
                  { key: "kwh", label: "Tarifa de energia (R$/kWh)", step: 0.01 },
                  { key: "margin", label: "Margem sobre o custo (%)", step: 1 },
                ] as const
              ).map((f) => (
                <label key={f.key}>
                  {f.label}
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step={f.step}
                    value={cost[f.key]}
                    onChange={(e) =>
                      setCost((c) => ({ ...c, [f.key]: Math.max(0, Number(e.target.value)) }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="cost-result">
              <span>CUSTO ESTIMADO</span>
              <strong>
                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
              <p>
                Material:{" "}
                {((cost.weight / 1000) * cost.price).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
              <p>
                Energia:{" "}
                {(((cost.hours * cost.power) / 1000) * cost.kwh).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
              <hr className="my-6 border-border" />
              <span>PREÇO COM MARGEM</span>
              <strong>
                {(total * (1 + cost.margin / 100)).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
              <p>Estimativa sem mão de obra, manutenção ou impostos.</p>
            </div>
          </section>
        )}
        {page === "mesh" && (
          <section className="content-view">
            <div className="upload-zone">
              <Stethoscope />
              <h2>Inspecionar uma malha</h2>
              <p>Arquivo STL · até {MAX_STL_FILE_MB} MB</p>
              <input
                type="file"
                accept=".stl"
                className="hidden"
                ref={fileRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) inspectFile(file);
                }}
              />
              <Button onClick={() => fileRef.current?.click()}>
                <Upload />
                Selecionar arquivo STL
              </Button>
            </div>
            {mesh && (
              <>
                <div className="project-row">
                  <h3>{mesh.name}</h3>
                  <span className="text-muted-foreground">{(mesh.size / 1024).toFixed(1)} KB</span>
                </div>
                <div className="mesh-stats">
                  <div>
                    Triângulos<strong>{mesh.triangles.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    Dimensões<strong className="text-base">{mesh.dimensions}</strong>
                  </div>
                  <div>
                    Conectividade das arestas
                    <strong className="text-base">
                      {mesh.closed ? "Malha fechada" : "Arestas abertas ou sobrepostas"}
                    </strong>
                  </div>
                </div>
                <p className="text-muted-foreground mt-5">
                  Inspeção geométrica básica; não verifica interseções ou orientação das faces.
                  Revise no fatiador antes de imprimir.
                </p>
              </>
            )}
          </section>
        )}
        {page === "comunidade" && (
          <section className="content-view empty-view">
            <Users />
            <h2>A comunidade está em preparação</h2>
            <p>As publicações do projeto original não foram incluídas nos arquivos enviados.</p>
            <Button asChild variant="outline">
              <Link to="/">
                Voltar à criação
                <ChevronRight />
              </Link>
            </Button>
          </section>
        )}
      </main>
      <footer className="app-footer">
        <span>
          © 2026 Express'Arte Studio<span>·</span>Feito para transformar ideias em realidade.
        </span>
        <span>
          <span className="status-dot" />
          Studio no navegador<span>·</span>mm
        </span>
      </footer>
      {dialog && (
        <div className="dialog-backdrop" onClick={() => !busy && setDialog(null)}>
          <section
            className="dialog-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h2 id="dialog-title">
                {dialog === "export"
                  ? "Exportar criação"
                  : dialog === "blender"
                    ? "Continuar no Blender"
                    : "Sobre o ExpressArte"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                <X />
              </Button>
            </div>
            {dialog === "export" ? (
              <>
                <p>
                  {editorMode === "ornament"
                    ? "Exporte o adorno paramétrico. STL reúne as peças em um único arquivo; GLB preserva as cores e os componentes."
                    : "Escolha o formato da sua medalha. Revise a geometria no fatiador antes da impressão."}
                </p>
                <div className="dialog-actions">
                  <Button variant="outline" disabled={busy} onClick={() => exportModel("glb")}>
                    <FileBox />
                    {busy ? "Exportando…" : "Modelo GLB"}
                  </Button>
                  <Button disabled={busy} onClick={() => exportModel("stl")}>
                    <Download />
                    {busy ? "Exportando…" : "Impressão STL"}
                  </Button>
                </div>
              </>
            ) : dialog === "blender" ? (
              <>
                <p>
                  Baixe o modelo GLB e importe no Blender instalado no seu computador. A conexão
                  automática dos scripts Windows não está disponível neste site.
                </p>
                <div className="dialog-actions">
                  <Button disabled={busy} onClick={() => exportModel("glb")}>
                    <Download />
                    Baixar GLB
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Versão web criada a partir dos arquivos enviados. As criações podem ser baixadas
                  em JSON, STL e GLB. Os projetos ficam na sessão atual; baixe-os para guardar.
                </p>
                <p>
                  Blender local, Copilot e as publicações originais precisam do pacote completo para
                  integração.
                </p>
                <div className="dialog-actions">
                  <Button onClick={() => setDialog(null)}>
                    Continuar criando
                    <ChevronRight />
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {notice && (
        <div className="notification" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
