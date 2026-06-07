import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'hr_admin' | 'branch_manager' | 'employee';

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const LAST_ACTIVITY_KEY = 'mvc_last_activity';
const SESSION_EXPIRED_KEY = 'mvc_session_expired';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    mustChangePassword?: boolean;
  } | null;
  loading: boolean;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(() => {
    return localStorage.getItem(SESSION_EXPIRED_KEY) === 'true';
  });

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
    localStorage.removeItem(SESSION_EXPIRED_KEY);
  }, []);

  // Track user activity
  const updateLastActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  // Check session expiration on load and periodically
  useEffect(() => {
    const checkExpiration = async () => {
      const hasExpiredFlag = localStorage.getItem(SESSION_EXPIRED_KEY) === 'true';
      if (hasExpiredFlag) {
        setSessionExpired(true);
      }

      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!lastActivity) return;

      const lastActivityTs = Number.parseInt(lastActivity, 10);
      if (Number.isNaN(lastActivityTs)) return;

      const elapsed = Date.now() - lastActivityTs;
      if (elapsed < SESSION_TIMEOUT_MS) return;

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      localStorage.setItem(SESSION_EXPIRED_KEY, 'true');
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      setSessionExpired(true);

      if (currentSession) {
        await supabase.auth.signOut();
      }
    };

    checkExpiration();

    // Check every minute
    const interval = setInterval(checkExpiration, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for user activity events to update last activity timestamp
  useEffect(() => {
    if (!user) return;

    updateLastActivity();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    // Throttle activity updates to once per minute
    let lastUpdate = Date.now();
    const throttledUpdate = () => {
      if (Date.now() - lastUpdate > 60000) {
        lastUpdate = Date.now();
        updateLastActivity();
      }
    };

    events.forEach(event => window.addEventListener(event, throttledUpdate, { passive: true }));
    return () => {
      events.forEach(event => window.removeEventListener(event, throttledUpdate));
    };
  }, [user, updateLastActivity]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          updateLastActivity();
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (roleData) {
        setRole(roleData.role as AppRole);
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, avatar_url, must_change_password')
        .eq('id', userId)
        .maybeSingle();

      // Also fetch employee avatar if profile avatar is not set
      let avatarUrl = profileData?.avatar_url ?? undefined;
      if (!avatarUrl) {
        const { data: empData } = await supabase
          .from('employees')
          .select('avatar_url')
          .eq('user_id', userId)
          .maybeSingle();
        if (empData?.avatar_url) {
          avatarUrl = empData.avatar_url;
        }
      }
      
      if (profileData) {
        setProfile({
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          email: profileData.email,
          avatarUrl,
          mustChangePassword: profileData.must_change_password ?? false,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    // Clear expired flag on new login attempt
    clearSessionExpired();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (!error && data.user) {
      updateLastActivity();

      // Check if user must change password
      const { data: profileData } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', data.user.id)
        .maybeSingle();
      
      if (profileData?.must_change_password) {
        window.location.href = '/change-password';
        return { error: null };
      }
      
      window.location.href = '/';
    }
    
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchUserData(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, sessionExpired, clearSessionExpired, refreshProfile, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
