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
export type Project =
  | { id: number; kind: "ornament"; ornamentConfig: OrnamentConfig }
  | { id: number; kind?: "medalha"; config: ModelConfig };
const StudioContext = createContext<{
  config: ModelConfig;
  setConfig: Dispatch<SetStateAction<ModelConfig>>;
  projects: Project[];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  organizer: OrganizerConfig;
  setOrganizer: Dispatch<SetStateAction<OrganizerConfig>>;
} | null>(null);
export function StudioProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ModelConfig>(defaultConfig);
  const [projects, setProjects] = useState<Project[]>([]);
  const [organizer, setOrganizer] = useState<OrganizerConfig>(defaultOrganizerConfig);
  return (
    <StudioContext.Provider
      value={{ config, setConfig, projects, setProjects, organizer, setOrganizer }}
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
