import { create } from 'zustand';

interface LifecycleState {
  // Global loading overlay
  isGlobalLoading: boolean;
  globalLoadingMessage: string | null;
  
  // Track in-flight operations
  activeOperations: Set<string>;
  
  // Actions
  showGlobalLoader: (message?: string) => void;
  hideGlobalLoader: () => void;
  startOperation: (id: string) => void;
  endOperation: (id: string) => void;
  resetAllLoaders: () => void;
}

export const useLifecycleStore = create<LifecycleState>((set, get) => ({
  isGlobalLoading: false,
  globalLoadingMessage: null,
  activeOperations: new Set(),

  showGlobalLoader: (message) => set({ 
    isGlobalLoading: true, 
    globalLoadingMessage: message ?? null 
  }),
  
  hideGlobalLoader: () => set({ 
    isGlobalLoading: false, 
    globalLoadingMessage: null 
  }),
  
  startOperation: (id) => {
    const ops = new Set(get().activeOperations);
    ops.add(id);
    set({ activeOperations: ops });
  },
  
  endOperation: (id) => {
    const ops = new Set(get().activeOperations);
    ops.delete(id);
    set({ activeOperations: ops });
  },
  
  resetAllLoaders: () => set({
    isGlobalLoading: false,
    globalLoadingMessage: null,
    activeOperations: new Set(),
  }),
}));
