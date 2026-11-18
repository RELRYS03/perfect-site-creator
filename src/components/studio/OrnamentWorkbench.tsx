import { useCallback, useState, type ReactNode } from "react";
import type { Object3D } from "three";
import { Link } from "@tanstack/react-router";
import { Download, Save, Box, RotateCcw, Sparkles, Layers, Settings2, Palette, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModelScene from "./ModelScene";
import { defaultConfig, downloadBlob } from "@/lib/studio/model";
import { useStudio } from "./StudioProvider";
import {
  validatePressOrnamentConfig,
  type PressOrnamentConfig,
} from "@/lib/studio/ornament-press";
import {
  buildPressOrnamentReference,
  disposeReferenceOrnament,
  GIGAPRINT_BALL_REFERENCE,
  type PressReferencePreviewMode,
} from "@/lib/studio/ornament-press-reference";
import { createBallOrnament3MF } from "@/lib/studio/three-mf-export";

const formOptions: { value: PressOrnamentConfig["form"]; label: string; note: string }[] = [
  { value: "ball", label: "Bola", note: "Esférica" },
  { value: "egg", label: "Ovo", note: "aguardando modelo" },
  { value: "bell", label: "Sino", note: "aguardando modelo" },
  { value: "finial", label: "Finial", note: "aguardando modelo" },
  { value: "star", label: "Estrela", note: "aguardando modelo" },
  { value: "heart", label: "Coração", note: "aguardando modelo" },
  { value: "tree", label: "Árvore", note: "aguardando modelo" },
];
const patternOptions: { value: PressOrnamentConfig["pattern"]; label: string }[] = [
  { value: "honeycomb", label: "Colmeia" },
  { value: "diamond", label: "Losango" },
  { value: "round", label: "Redondo" },
  { value: "square", label: "Quadrado" },
  { value: "triangle", label: "Triângulos" },
];
const designOptions: { value: PressOrnamentConfig["design"]; label: string }[] = [
  { value: "snowflake", label: "Floco de neve" },
  { value: "star", label: "Estrela" },
  { value: "tree", label: "Árvore" },
  { value: "heart", label: "Coração" },
  { value: "plain", label: "Sem desenho" },
];
const previewOptions: { value: PressReferencePreviewMode; label: string; detail: string }[] = [
  { value: "system", label: "Peças para imprimir", detail: "4 peças em placas separadas" },
  { value: "flat", label: "Malha plana ×2", detail: "Imprimir duas cópias iguais" },
  { value: "mold", label: "Prensa aberta", detail: "Bloco e êmbolo alinhados" },
  { value: "female-mold", label: "Bloco inferior", detail: "Cavidade e pinos-guia" },
  { value: "male-plunger", label: "Êmbolo superior", detail: "Cúpula e furos-guia" },
  { value: "half", label: "Metade formada", detail: "Casca após a prensagem" },
  { value: "assembled", label: "Enfeite montado", detail: "Duas metades unidas" },
];

function RangeControl({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = "mm",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="press-range">
      <span><b>{label}</b><output>{Number(value.toFixed(2)).toLocaleString("pt-BR")} {unit}</output></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))} />
      <small><span>{min} {unit}</span><span>{max} {unit}</span></small>
    </label>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="press-section"><h2>{icon}{title}</h2>{children}</section>;
}

export default function OrnamentWorkbench() {
  const { pressOrnament, setPressOrnament, setProjects } = useStudio();
  const [preview, setPreview] = useState<PressReferencePreviewMode>("system");
  const [wireframe, setWireframe] = useState(false);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const config = validatePressOrnamentConfig(pressOrnament);
  const update = <K extends keyof PressOrnamentConfig>(key: K, value: PressOrnamentConfig[K]) => {
    setPressOrnament((current) => validatePressOrnamentConfig({ ...current, [key]: value }));
  };
  const buildPreview = useCallback(
    () => buildPressOrnamentReference(config, preview),
    [config, preview],
  );
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const saveProject = () => {
    setProjects((all) => [
      ...all,
      { id: Date.now(), kind: "press-ornament", pressConfig: { ...config } },
    ]);
    const payload = {
      format: "Perfect Site Creator",
      version: 1,
      type: "press-ornament",
      config,
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      "PerfectSiteCreator-adorno-prensagem.json",
    );
    notify("Projeto salvo em Meus projetos e exportado em JSON.");
  };

  const export3mf = async () => {
    setBusy(true);
    try {
      const bytes = createBallOrnament3MF(config, "Ball ornament");
      const file = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], {
        type: "application/vnd.ms-package.3dmanufacturing-3dmodel+zip",
      });
      downloadBlob(file, "ExpressArte-Ball-ornament.3mf");
      notify("3MF gerado com 4 peças separadas em 4 placas. Abra no Bambu Studio para conferir o fatiamento.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível gerar o arquivo 3MF.");
    } finally {
      setBusy(false);
    }
  };

  const exportGlb = async () => {
    setBusy(true);
    let model: Object3D | null = null;
    try {
      model = buildPressOrnamentReference(config, preview);
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
      const result = await new GLTFExporter().parseAsync(model, { binary: true });
      if (!(result instanceof ArrayBuffer)) throw new Error("O exportador não retornou um GLB.");
      downloadBlob(
        new Blob([result], { type: "model/gltf-binary" }),
        "ExpressArte-visualizacao-" + preview + ".glb",
      );
      notify("Visualização GLB exportada.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível exportar a prévia GLB.");
    } finally {
      if (model) disposeReferenceOrnament(model);
      setBusy(false);
    }
  };

  return (
    <main className="press-workbench">
      <header className="press-page-header">
        <div className="press-brand-block">
          <Link className="press-back-link" to="/">← Studio 3D</Link>
          <div>
            <span className="press-eyebrow"><Sparkles size={13} /> BIBLIOTECA SEPARADA DE ADORNOS</span>
            <h1>Adornos de prensagem</h1>
            <p>Imprima a malha plana, aqueça, pressione no molde e una as duas metades.</p>
          </div>
        </div>
        <div className="press-header-actions">
          <Button variant="outline" onClick={saveProject}><Save size={16} /> Salvar projeto</Button>
          <Button onClick={export3mf} disabled={busy}>
            <Download size={16} /> {busy ? "Gerando 3MF..." : "Baixar .3mf"}
          </Button>
          <Button variant="outline" onClick={exportGlb} disabled={busy}>
            <Box size={16} /> Prévia GLB
          </Button>
        </div>
      </header>

      <div className="press-workspace">
        <aside className="press-controls-panel">
          <Section title="1. Formato do adorno" icon={<Box size={15} />}>
            <div className="press-choice-grid press-form-grid">
              {formOptions.map((option) => (
                <button key={option.value} type="button"
                  className={config.form === option.value ? "press-choice selected" : "press-choice"}
                  disabled={option.value !== "ball"}
                  title={option.value === "ball" ? "Modelo reconstruído a partir do STL/3MF enviado" : "Aguardando um arquivo STL/3MF deste formato para reconstrução fiel"}
                  onClick={() => update("form", option.value)}>
                  <strong>{option.label}</strong><small>{option.note}</small>
                </button>
              ))}
            </div>
            <RangeControl label="Diâmetro externo" value={config.diameter} min={50} max={140} step={1}
              onChange={(value) => update("diameter", value)} />
            <RangeControl label="Profundidade da prensagem" value={config.pressDepth} min={12}
              max={config.diameter * 0.62} step={1} onChange={(value) => update("pressDepth", value)} />
            <RangeControl label="Espessura da malha plana" value={config.panelThickness} min={1.2} max={2.4}
              onChange={(value) => update("panelThickness", value)} />
            <div className="press-reference-metric">
              <span>Espessura estimada depois da prensagem</span>
              <strong>{(config.panelThickness / (1 + config.stretchPercent / 100)).toFixed(2).replace(".", ",")} mm</strong>
            </div>
            <p className="press-source-note">Este arquivo de referência contém o formato Bola. Os outros formatos ficam bloqueados até recebermos os respectivos modelos de fabricação.</p>
          </Section>

          <Section title="2. Padrão da malha" icon={<Layers size={15} />}>
            <div className="press-choice-grid">
              {patternOptions.map((option) => (
                <button key={option.value} type="button"
                  className={config.pattern === option.value ? "press-choice selected" : "press-choice"}
                  onClick={() => update("pattern", option.value)}>{option.label}</button>
              ))}
            </div>
            <RangeControl label="Tamanho das aberturas" value={config.holeSize} min={2.5} max={10}
              onChange={(value) => update("holeSize", value)} />
            <RangeControl label="Largura das nervuras" value={config.ribWidth} min={1.2} max={2.8}
              onChange={(value) => update("ribWidth", value)} />
            <RangeControl label="Alongamento na prensagem" value={config.stretchPercent} min={0} max={80} step={1} unit="%"
              onChange={(value) => update("stretchPercent", value)} />
          </Section>

          <Section title="3. Desenho decorativo" icon={<Sparkles size={15} />}>
            <div className="press-design-grid">
              {designOptions.map((option) => (
                <button key={option.value} type="button"
                  className={config.design === option.value ? "press-design-choice selected" : "press-design-choice"}
                  onClick={() => update("design", option.value)}>{option.label}</button>
              ))}
            </div>
            {config.design !== "plain" && (
              <>
                <RangeControl label="Largura do desenho" value={config.designWidth} min={12}
                  max={config.diameter * 0.62} onChange={(value) => update("designWidth", value)} />
                <RangeControl label="Altura do relevo" value={config.designHeight} min={0.4} max={1.8}
                  onChange={(value) => update("designHeight", value)} />
              </>
            )}
            <label className="press-check-row">
              <input type="checkbox" checked={config.backDesign}
                onChange={(event) => update("backDesign", event.target.checked)} />
              Repetir desenho na metade traseira
            </label>
          </Section>

          <Section title="4. Molde e união" icon={<Settings2 size={15} />}>
            <div className="press-field">
              <label htmlFor="press-join-method">Método de união das metades</label>
              <select id="press-join-method" value={config.joinMethod}
                onChange={(event) => update("joinMethod", event.target.value as PressOrnamentConfig["joinMethod"])}>
                <option value="pins">Pinos e furos</option>
                <option value="glue">Aro plano para colagem</option>
              </select>
            </div>
            <RangeControl label="Espessura do aro externo" value={config.rimWidth} min={1.2}
              max={Math.min(4, config.diameter / 8)} onChange={(value) => update("rimWidth", value)} />
            <div className="press-reference-metric">
              <span>Folga de trabalho do molde (referência)</span><strong>{GIGAPRINT_BALL_REFERENCE.pressGap.toFixed(1).replace(".", ",")} mm</strong>
            </div>
            {config.joinMethod === "pins" && (
              <RangeControl label="Folga por lado entre peças" value={config.clearance} min={0.1} max={0.6}
                onChange={(value) => update("clearance", value)} />
            )}
            <label className="press-check-row">
              <input type="checkbox" checked={config.includeLoop}
                onChange={(event) => update("includeLoop", event.target.checked)} />
              Incluir argola para pendurar
            </label>
            {config.includeLoop && (
              <RangeControl label="Diâmetro do furo da argola" value={config.loopDiameter} min={3} max={10}
                onChange={(value) => update("loopDiameter", value)} />
            )}
          </Section>

          <Section title="5. Cores dos componentes" icon={<Palette size={15} />}>
            <label className="press-color-field"><span>Filamento 1 · Malha (rosa)</span>
              <input type="color" value={config.meshColor} onChange={(event) => update("meshColor", event.target.value)} />
            </label>
            <label className="press-color-field"><span>Filamento 2 · Ferramental (verde)</span>
              <input type="color" value={config.pressColor} onChange={(event) => update("pressColor", event.target.value)} />
            </label>
          </Section>
          <div className="press-help-note">
            <CircleHelp size={16} />
            <p>O 3MF leva duas cores, quatro objetos e quatro placas independentes: duas malhas, bloco inferior e êmbolo. Perfil salvo para Bambu Lab A1, bico 0,4 mm e Bambu PLA Basic.</p>
          </div>
        </aside>

        <section className="press-preview-panel">
          <div className="press-preview-header">
            <div><span className="press-eyebrow">VISUALIZAÇÃO PARAMÉTRICA</span><h2>Prévia 3D em tempo real</h2></div>
            <div className="press-view-actions">
              <Button variant="outline" size="sm" onClick={() => setWireframe((value) => !value)}>
                {wireframe ? "Sólido" : "Wireframe"}
              </Button>
              <Button variant="outline" size="icon" onClick={() => setReset((value) => value + 1)} aria-label="Redefinir vista">
                <RotateCcw size={15} />
              </Button>
            </div>
          </div>
          <div className="press-preview-tabs">
            {previewOptions.map((option) => (
              <button type="button" key={option.value}
                className={preview === option.value ? "selected" : ""}
                onClick={() => setPreview(option.value)}>
                <strong>{option.label}</strong><small>{option.detail}</small>
              </button>
            ))}
          </div>
          <div className="press-canvas">
            <ModelScene config={defaultConfig} view={preview === "flat" ? "2d" : "3d"}
              zoom={100} reset={reset} wireframe={wireframe} buildObject={buildPreview}
              distanceScale={preview === "system" ? 4.2 : preview === "mold" ? 2.1 : preview === "flat" ? 1.8 : 1.45} />
          </div>
          <div className="press-preview-footer">
            <span><i /> {config.diameter} mm · {config.form} · {config.pattern}</span>
            <span>{previewOptions.find((option) => option.value === preview)?.detail}</span>
          </div>
          <div className="press-process-strip">
            <div><b>01</b><strong>Imprimir</strong><small>Malha plana</small></div>
            <div><b>02</b><strong>Aquecer</strong><small>Com soprador térmico</small></div>
            <div><b>03</b><strong>Prensar</strong><small>Molde macho e fêmea</small></div>
            <div><b>04</b><strong>Unir</strong><small>Duas metades</small></div>
          </div>
          <div className="press-manufacturing-warning">
            <strong>Validação antes de fabricar</strong>
            <p>O .3mf é organizado em quatro placas separadas e centralizadas na área de 256 × 256 × 256 mm da A1. As malhas são reconstruídas a partir das medidas do arquivo de referência; confira o fatiamento no Bambu Studio e faça uma prensagem de teste antes de produção. A geometria não certifica resistência térmica ou encaixe físico.</p>
          </div>
        </section>
      </div>
      {notice && <div className="press-notice" role="status">{notice}</div>}
    </main>
  );
}
