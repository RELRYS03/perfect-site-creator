import { useCallback, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Save, Box, RotateCcw, Sparkles, Layers, Settings2, Palette, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModelScene from "./ModelScene";
import { defaultConfig, downloadBlob } from "@/lib/studio/model";
import { useStudio } from "./StudioProvider";
import {
  buildPressOrnament,
  disposePressOrnament,
  validatePressOrnamentConfig,
  type PressOrnamentConfig,
  type PressPreviewMode,
} from "@/lib/studio/ornament-press";

const formOptions: { value: PressOrnamentConfig["form"]; label: string; note: string }[] = [
  { value: "ball", label: "Bola", note: "Esférica" },
  { value: "egg", label: "Ovo", note: "Ovalada" },
  { value: "bell", label: "Sino", note: "Base larga" },
  { value: "finial", label: "Finial", note: "Ponta superior" },
  { value: "star", label: "Estrela", note: "Contorno estrelado" },
  { value: "heart", label: "Coração", note: "Contorno de coração" },
  { value: "tree", label: "Árvore", note: "Contorno de árvore" },
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
  { value: "candy-cane", label: "Bastão doce" },
  { value: "bell", label: "Sino" },
  { value: "gift", label: "Presente" },
  { value: "snowman", label: "Boneco de neve" },
  { value: "plain", label: "Sem desenho" },
];
const previewOptions: { value: PressPreviewMode; label: string; detail: string }[] = [
  { value: "system", label: "Conjunto", detail: "Molde, malha e metades" },
  { value: "flat", label: "Malha plana", detail: "Peça antes da prensagem" },
  { value: "mold", label: "Molde", detail: "Macho e fêmea" },
  { value: "half", label: "Metade formada", detail: "Uma concha vazada" },
  { value: "assembled", label: "Enfeite montado", detail: "Duas metades unidas" },
];

function RangeControl({
  label,
  value,
  min,
  max,
  step = 0.1,
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
    <label className="press-range">
      <span><b>{label}</b><output>{Number(value.toFixed(2)).toLocaleString("pt-BR")} mm</output></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))} />
      <small><span>{min} mm</span><span>{max} mm</span></small>
    </label>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="press-section"><h2>{icon}{title}</h2>{children}</section>;
}

export default function OrnamentWorkbench() {
  const { pressOrnament, setPressOrnament, setProjects } = useStudio();
  const [preview, setPreview] = useState<PressPreviewMode>("system");
  const [wireframe, setWireframe] = useState(false);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const config = validatePressOrnamentConfig(pressOrnament);
  const update = <K extends keyof PressOrnamentConfig>(key: K, value: PressOrnamentConfig[K]) => {
    setPressOrnament((current) => validatePressOrnamentConfig({ ...current, [key]: value }));
  };
  const buildPreview = useCallback(() => buildPressOrnament(config, preview), [config, preview]);
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

  const exportModel = async (format: "stl" | "glb") => {
    setBusy(true);
    let model: ReturnType<typeof buildPressOrnament> | null = null;
    try {
      model = buildPressOrnament(config, preview);
      if (format === "stl") {
        const { STLExporter } = await import("three/examples/jsm/exporters/STLExporter.js");
        const data = new STLExporter().parse(model, { binary: true });
        downloadBlob(
          new Blob([new Uint8Array(data.buffer)], { type: "application/sla" }),
          `ExpressArte-${preview}-prensagem.stl`,
        );
        notify("STL exportado. Confira escala, orientação e folgas no Bambu Studio antes de imprimir.");
      } else {
        const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
        const result = await new GLTFExporter().parseAsync(model, { binary: true });
        if (!(result instanceof ArrayBuffer)) throw new Error("O exportador não retornou um GLB.");
        downloadBlob(
          new Blob([result], { type: "model/gltf-binary" }),
          `ExpressArte-adorno-prensagem-${preview}.glb`,
        );
        notify("GLB colorido exportado com os componentes identificados.");
      }
    } catch (error) {
      notify(error instanceof Error ? `Falha na exportação: ${error.message}` : "Não foi possível exportar o modelo.");
    } finally {
      if (model) disposePressOrnament(model);
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
          <Button variant="outline" onClick={() => exportModel("stl")} disabled={busy}><Download size={16} /> Exportar STL</Button>
          <Button onClick={() => exportModel("glb")} disabled={busy}><Box size={16} /> Exportar GLB</Button>
        </div>
      </header>

      <div className="press-workspace">
        <aside className="press-controls-panel">
          <Section title="1. Formato do adorno" icon={<Box size={15} />}>
            <div className="press-choice-grid press-form-grid">
              {formOptions.map((option) => (
                <button key={option.value} type="button"
                  className={config.form === option.value ? "press-choice selected" : "press-choice"}
                  onClick={() => update("form", option.value)}>
                  <strong>{option.label}</strong><small>{option.note}</small>
                </button>
              ))}
            </div>
            <RangeControl label="Diâmetro externo" value={config.diameter} min={50} max={140} step={1}
              onChange={(value) => update("diameter", value)} />
            <RangeControl label="Profundidade da prensagem" value={config.pressDepth} min={12}
              max={config.diameter * 0.62} step={1} onChange={(value) => update("pressDepth", value)} />
            <RangeControl label="Espessura da malha" value={config.panelThickness} min={0.8} max={2.4}
              onChange={(value) => update("panelThickness", value)} />
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
            <RangeControl label="Largura das nervuras" value={config.ribWidth} min={0.65} max={2.8}
              onChange={(value) => update("ribWidth", value)} />
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
                <RangeControl label="Altura do relevo" value={config.designHeight} min={0.25} max={1.8}
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
            <RangeControl label="Largura do aro de união" value={config.rimWidth} min={2.2}
              max={Math.min(8, config.diameter / 8)} onChange={(value) => update("rimWidth", value)} />
            {config.joinMethod === "pins" && (
              <RangeControl label="Folga entre pino e furo" value={config.clearance} min={0.15} max={0.6}
                onChange={(value) => update("clearance", value)} />
            )}
            <label className="press-check-row">
              <input type="checkbox" checked={config.includeLoop}
                onChange={(event) => update("includeLoop", event.target.checked)} />
              Incluir argola para pendurar
            </label>
            {config.includeLoop && (
              <RangeControl label="Diâmetro da argola" value={config.loopDiameter} min={3} max={10}
                onChange={(value) => update("loopDiameter", value)} />
            )}
          </Section>

          <Section title="5. Cores dos componentes" icon={<Palette size={15} />}>
            <label className="press-color-field"><span>Malha e estrutura</span>
              <input type="color" value={config.meshColor} onChange={(event) => update("meshColor", event.target.value)} />
            </label>
            <label className="press-color-field"><span>Desenho e aro</span>
              <input type="color" value={config.designColor} onChange={(event) => update("designColor", event.target.value)} />
            </label>
            <label className="press-color-field"><span>Molde e pinos</span>
              <input type="color" value={config.pressColor} onChange={(event) => update("pressColor", event.target.value)} />
            </label>
          </Section>
          <div className="press-help-note">
            <CircleHelp size={16} />
            <p>As cores servem para identificar as peças na prévia. O STL não preserva cores; use GLB para conferir a separação visual.</p>
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
              zoom={100} reset={reset} wireframe={wireframe} buildObject={buildPreview} distanceScale={preview === "system" ? 2.5 : 1.6} />
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
            <p>Esta é uma prévia paramétrica inicial. A geometria visual não comprova resistência ao calor, espessura adequada para o material aquecido, tolerância mecânica ou encaixe perfeito. Confira cada componente no Bambu Studio e faça um teste de impressão antes de produzir em série.</p>
          </div>
        </section>
      </div>
      {notice && <div className="press-notice" role="status">{notice}</div>}
    </main>
  );
}
