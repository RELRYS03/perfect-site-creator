import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import { defaultConfig, type ModelConfig } from '@/lib/studio/model';
export type Project={id:number;config:ModelConfig};
const StudioContext=createContext<{config:ModelConfig;setConfig:Dispatch<SetStateAction<ModelConfig>>;projects:Project[];setProjects:Dispatch<SetStateAction<Project[]>>}|null>(null);
export function StudioProvider({children}:{children:ReactNode}){const [config,setConfig]=useState<ModelConfig>(defaultConfig);const [projects,setProjects]=useState<Project[]>([]);return <StudioContext.Provider value={{config,setConfig,projects,setProjects}}>{children}</StudioContext.Provider>;}
export function useStudio(){const context=useContext(StudioContext);if(!context)throw new Error('StudioProvider is required');return context;}
