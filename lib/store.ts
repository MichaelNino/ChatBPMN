import { create } from 'zustand';

interface DiagramState {
  diagramXml: string | null;
  setDiagramXml: (xml: string) => void;
}

export const useDiagramStore = create<DiagramState>((set) => ({
  diagramXml: null,
  setDiagramXml: (xml) => set({ diagramXml: xml }),
}));
