import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

type ViewMode = 'admin' | 'employee';
type EffectiveRole = 'hr_admin' | 'branch_manager' | 'employee' | null;

interface ViewModeContextType {
  viewMode: ViewMode;
  effectiveRole: EffectiveRole;
  actualRole: EffectiveRole;
  isViewingSwitched: boolean;
  isSuperAdmin: boolean;
  switchToEmployee: () => void;
  switchToAdmin: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

// Super admins are treated as hr_admins throughout the UI so they inherit all access.
const normalizeRole = (role: ReturnType<typeof useAuth>['role']): EffectiveRole => {
  if (role === 'super_admin') return 'hr_admin';
  return role as EffectiveRole;
};

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { role, user } = useAuth();
  const normalized = normalizeRole(role);
  const isSuperAdmin = role === 'super_admin';
  const storageKey = user?.id ? `mvc_view_mode:${user.id}` : 'mvc_view_mode';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'admin';
    const stored = localStorage.getItem(storageKey);
    return stored === 'employee' ? 'employee' : 'admin';
  });

  const isViewingSwitched = normalized === 'hr_admin' && viewMode === 'employee';
  const effectiveRole: EffectiveRole = isViewingSwitched ? 'employee' : normalized;

  const switchToEmployee = () => {
    if (normalized === 'hr_admin') {
      setViewMode('employee');
      try { localStorage.setItem(storageKey, 'employee'); } catch {}
    }
  };

  const switchToAdmin = () => {
    setViewMode('admin');
    try { localStorage.setItem(storageKey, 'admin'); } catch {}
  };

  return (
    <ViewModeContext.Provider
      value={{
        viewMode,
        effectiveRole,
        actualRole: normalized,
        isViewingSwitched,
        isSuperAdmin,
        switchToEmployee,
        switchToAdmin,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}
