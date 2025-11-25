import type { LoginRequest, LoginResponse, AuthState } from '../types/auth';

const API_BASE = '/api';
const TOKEN_KEY = 'aggregoai_token';
const EXPIRES_KEY = 'aggregoai_expires';

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Invalid credentials');
    }

    const data: LoginResponse = await response.json();
    
    // Store token securely
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(EXPIRES_KEY, data.expiresAt);
    
    return data;
  },

  logout: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  },

  getAuthState: (): AuthState => {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresStr = localStorage.getItem(EXPIRES_KEY);
    
    if (!token || !expiresStr) {
      return { isAuthenticated: false, token: null, expiresAt: null };
    }

    const expiresAt = new Date(expiresStr);
    
    // Check if token is expired
    if (expiresAt <= new Date()) {
      authService.logout();
      return { isAuthenticated: false, token: null, expiresAt: null };
    }

    return { isAuthenticated: true, token, expiresAt };
  },

  getToken: (): string | null => {
    const state = authService.getAuthState();
    return state.isAuthenticated ? state.token : null;
  },

  verify: async (): Promise<boolean> => {
    const token = authService.getToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

// Helper to add auth header to fetch requests
export function getAuthHeaders(): HeadersInit {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
