import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Active project / case ───────────────────────────────────
      activeProjectId: null,
      activeCaseId:    null,
      setActiveProject: (id) => set({ activeProjectId: id, activeCaseId: null }),
      setActiveCase:    (id) => set({ activeCaseId: id }),

      // ── Units preference ────────────────────────────────────────
      units: 'imperial',  // 'imperial' | 'metric'
      setUnits: (u) => set({ units: u }),

      // ── Last calculation result (for quick access) ──────────────
      lastResult: null,
      setLastResult: (r) => set({ lastResult: r }),

      // ── Pending unsaved changes ──────────────────────────────────
      dirty: false,
      setDirty: (v) => set({ dirty: v }),

      // ── Sidebar width ────────────────────────────────────────────
      sidebarOpen: true,
      toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

      // ── Current sizing phase ─────────────────────────────────────
      phase: 'gas',
      setPhase: (p) => set({ phase: p }),

      // ── Notification queue ────────────────────────────────────────
      notifications: [],
      notify: (msg, type='info') => {
        const id = Date.now()
        set(s => ({ notifications: [...s.notifications, { id, msg, type }] }))
        setTimeout(() => set(s => ({
          notifications: s.notifications.filter(n => n.id !== id)
        })), 4000)
      },
      dismissNotification: (id) => set(s => ({
        notifications: s.notifications.filter(n => n.id !== id)
      })),
    }),
    { name: 'psv-pro-ui', partialize: s => ({ units: s.units, sidebarOpen: s.sidebarOpen }) }
  )
)
