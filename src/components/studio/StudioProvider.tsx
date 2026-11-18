import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { defaultConfig, type ModelConfig } from "@/lib/studio/model";
import { defaultOrganizerConfig, type OrganizerConfig } from "@/lib/organizer/organizer";
import type { OrnamentConfig } from "@/lib/studio/ornament";
import { defaultPressOrnamentConfig, type PressOrnamentConfig } from "@/lib/studio/ornament-press";
export type Project =
  | { id: number; kind: "ornament"; ornamentConfig: OrnamentConfig }
  | { id: number; kind: "press-ornament"; pressConfig: PressOrnamentConfig }
  | { id: number; kind?: "medalha"; config: ModelConfig };
const StudioContext = createContext<{
  config: ModelConfig;
  setConfig: Dispatch<SetStateAction<ModelConfig>>;
  projects: Project[];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  organizer: OrganizerConfig;
  setOrganizer: Dispatch<SetStateAction<OrganizerConfig>>;
  pressOrnament: PressOrnamentConfig;
  setPressOrnament: Dispatch<SetStateAction<PressOrnamentConfig>>;
} | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ModelConfig>(defaultConfig);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizer, setOrganizer] = useState<OrganizerConfig>(defaultOrganizerConfig);
  const [pressOrnament, setPressOrnament] = useState<PressOrnamentConfig>(defaultPressOrnamentConfig);
  return (
    <StudioContext.Provider
      value={{ config, setConfig, projects, setProjects, organizer, setOrganizer, pressOrnament, setPressOrnament }}
    >
      {children}
    </StudioContext.Provider>
  );
}
export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("StudioProvider is required");
  return context;
}
