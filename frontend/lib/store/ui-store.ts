import { create } from "zustand";

interface UiState {
  isNavRailCollapsed: boolean;
  toggleNavRail: () => void;

  /**
   * Off-canvas nav drawer for the `/admin` shell below the `lg` breakpoint
   * (see `components/layout/sidebar.tsx`). Only meaningful on narrow
   * viewports — at `lg` and above the sidebar is always docked and this
   * flag is simply never read, so no guard is needed at the call sites.
   */
  isMobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
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

  isMobileNavOpen: false,
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
  toggleMobileNav: () => set((state) => ({ isMobileNavOpen: !state.isMobileNavOpen })),
}));
