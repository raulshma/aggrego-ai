import { useState, useEffect, useCallback, type ReactNode, useMemo } from 'react';
import { authService } from '../services/auth';
import type { AuthState } from '../types/auth';
import { AuthContext } from './authContextDef';

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize synchronously from localStorage
  const [authState, setAuthState] = useState<AuthState>(() => authService.getAuthState());
  const [isLoading] = useState(false);

  // Set up token expiration check
  useEffect(() => {
    if (!authState.expiresAt) return;

    const timeUntilExpiry = authState.expiresAt.getTime() - Date.now();
    if (timeUntilExpiry <= 0) {
      // Token already expired, handle via callback
      const handleExpiry = () => {
        authService.logout();
        setAuthState({ isAuthenticated: false, token: null, expiresAt: null });
      };
      handleExpiry();
      return;
    }

    const timer = setTimeout(() => {
      authService.logout();
      setAuthState({ isAuthenticated: false, token: null, expiresAt: null });
    }, timeUntilExpiry);

    return () => clearTimeout(timer);
  }, [authState.expiresAt]);

  const login = useCallback(async (credentials: { username: string; password: string }) => {
    const response = await authService.login(credentials);
    setAuthState({
      isAuthenticated: true,
      token: response.token,
      expiresAt: new Date(response.expiresAt),
    });
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setAuthState({ isAuthenticated: false, token: null, expiresAt: null });
  }, []);

  const value = useMemo(
    () => ({
      ...authState,
      login,
      logout,
      isLoading,
    }),
    [authState, login, logout, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
