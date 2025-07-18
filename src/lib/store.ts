import { create } from 'zustand';

interface AppState {
  charityDataNeedsRefresh: boolean;
  triggerCharityRefresh: () => void;
  resetCharityRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  charityDataNeedsRefresh: false,
  triggerCharityRefresh: () => set({ charityDataNeedsRefresh: true }),
  resetCharityRefresh: () => set({ charityDataNeedsRefresh: false }),
}));
