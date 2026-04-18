import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { UserRole, RolePermissions, ROLE_PERMISSIONS, ROLE_LABELS } from '@/types/roles';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface StoredSession {
  user: User;
  expiresAt: number; // Timestamp in milliseconds
  lastActivity: number; // Track last user activity
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  permissions: RolePermissions | null;
  roleLabel: string;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  sessionExpiresIn: number | null; // Minutes until session expires
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session configuration
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const WARNING_BEFORE_EXPIRY = 5 * 60 * 1000; // Warn 5 minutes before expiry

// Mock users for demo - 5 roles
// MOCK_USERS removed as we now use Supabase directly

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('surgical_user');
      if (!saved) return null;

      const session: StoredSession = JSON.parse(saved);
      const now = Date.now();

      // Check if session expired
      if (now > session.expiresAt) {
        console.warn('Session expired. Please login again.');
        localStorage.removeItem('surgical_user');
        return null;
      }

      // Check if inactive for too long
      if (now - session.lastActivity > INACTIVITY_TIMEOUT) {
        console.warn('Session expired due to inactivity.');
        localStorage.removeItem('surgical_user');
        return null;
      }

      // Update last activity
      session.lastActivity = now;
      localStorage.setItem('surgical_user', JSON.stringify(session));

      return session.user;
    } catch (error) {
      console.error('Failed to parse user from local storage:', error);
      localStorage.removeItem('surgical_user');
      return null;
    }
  });

  const [sessionExpiresIn, setSessionExpiresIn] = useState<number | null>(null);



  const permissions = useMemo(() => {
    if (!user) return null;
    return ROLE_PERMISSIONS[user.role];
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user) return '';
    return ROLE_LABELS[user.role];
  }, [user]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // Use the new secure password verification function
      const { data, error } = await supabase.rpc('verify_user_password', {
        p_email: email,
        p_password: password
      });

      if (error) {
        console.error('Login error:', error);
        return false;
      }

      // Check if user was found and password was correct
      if (!data || data.length === 0) {
        console.error('Invalid email or password');
        return false;
      }

      // Get the first (and only) result
      const userData = data[0];

      const user: User = {
        id: userData.user_id,
        name: userData.user_name,
        email: userData.user_email,
        role: userData.user_role as UserRole,
      };

      // Create session with expiration
      const now = Date.now();
      const session: StoredSession = {
        user,
        expiresAt: now + SESSION_DURATION, // 8 hours from now
        lastActivity: now
      };

      setUser(user);
      localStorage.setItem('surgical_user', JSON.stringify(session));
      return true;
    } catch (error) {
      console.error('Login exception:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setSessionExpiresIn(null);
    localStorage.removeItem('surgical_user');
  }, []);

  const hasPermission = useCallback((permission: keyof RolePermissions): boolean => {
    if (!permissions) return false;
    return permissions[permission];
  }, [permissions]);

  // Validate user session on mount
  React.useEffect(() => {
    if (user) {
      // Check if ID is a valid UUID (simple regex check)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);

      if (!isUUID) {
        console.warn('Detected legacy user ID format. Logging out to refresh session.');
        logout();
        window.location.href = '/login'; // Force redirect
      }
    }
  }, [user, logout]);

  // Session monitoring - check expiration every minute
  React.useEffect(() => {
    if (!user) return;

    const checkSession = () => {
      const saved = localStorage.getItem('surgical_user');
      if (!saved) {
        logout();
        return;
      }

      try {
        const session: StoredSession = JSON.parse(saved);
        const now = Date.now();
        const timeUntilExpiry = session.expiresAt - now;
        const timeSinceActivity = now - session.lastActivity;

        // Calculate minutes until expiry
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / (60 * 1000));
        setSessionExpiresIn(minutesUntilExpiry);

        // Check if session expired
        if (timeUntilExpiry <= 0) {
          alert('جلستك انتهت. الرجاء تسجيل الدخول مرة أخرى.');
          logout();
          window.location.href = '/login';
          return;
        }

        // Check if inactive for too long
        if (timeSinceActivity > INACTIVITY_TIMEOUT) {
          alert('جلستك انتهت بسبب عدم النشاط. الرجاء تسجيل الدخول مرة أخرى.');
          logout();
          window.location.href = '/login';
          return;
        }

        // Warn before expiry (5 minutes)
        if (timeUntilExpiry <= WARNING_BEFORE_EXPIRY && timeUntilExpiry > WARNING_BEFORE_EXPIRY - 60000) {
          const minutes = Math.ceil(timeUntilExpiry / (60 * 1000));
          alert(`تحذير: جلستك ستنتهي خلال ${minutes} دقيقة. قم بحفظ عملك.`);
        }

        // Update last activity on any user interaction
        session.lastActivity = now;
        localStorage.setItem('surgical_user', JSON.stringify(session));
      } catch (error) {
        console.error('Session check error:', error);
        logout();
      }
    };

    // Check immediately
    checkSession();

    // Then check every minute
    const interval = setInterval(checkSession, 60 * 1000);

    return () => clearInterval(interval);
  }, [user, logout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    permissions,
    roleLabel,
    login,
    logout,
    hasPermission,
    sessionExpiresIn,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
