import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

type ViewMode = 'admin' | 'employee';

interface ViewModeContextType {
  viewMode: ViewMode;
  effectiveRole: 'hr_admin' | 'branch_manager' | 'employee' | null;
  actualRole: 'hr_admin' | 'branch_manager' | 'employee' | null;
  isViewingSwitched: boolean;
  switchToEmployee: () => void;
  switchToAdmin: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('admin');

  const isViewingSwitched = role === 'hr_admin' && viewMode === 'employee';
  const effectiveRole = isViewingSwitched ? 'employee' : role;

  const switchToEmployee = () => {
    if (role === 'hr_admin') setViewMode('employee');
  };

  const switchToAdmin = () => {
    setViewMode('admin');
  };

  return (
    <ViewModeContext.Provider
      value={{
        viewMode,
        effectiveRole,
        actualRole: role,
        isViewingSwitched,
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
