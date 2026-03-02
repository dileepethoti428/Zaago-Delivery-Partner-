import { create } from 'zustand';

interface AppState {
  isAuthed: boolean;
  setIsAuthed: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthed: false,
  setIsAuthed: (value) => set({ isAuthed: value }),
}));
