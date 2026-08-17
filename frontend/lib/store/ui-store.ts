import { create } from "zustand";

interface UiState {
  isNavRailCollapsed: boolean;
  toggleNavRail: () => void;
}

/**
 * Trivial Zustand wiring example for local UI state (things that never
 * need to hit the network, e.g. collapsed/expanded chrome). Server state
 * belongs in React Query hooks (see `lib/hooks/`), not here.
 */
export const useUiStore = create<UiState>((set) => ({
  isNavRailCollapsed: false,
  toggleNavRail: () =>
    set((state) => ({ isNavRailCollapsed: !state.isNavRailCollapsed })),
}));
