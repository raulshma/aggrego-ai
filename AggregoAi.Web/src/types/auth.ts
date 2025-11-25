export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  expiresAt: Date | null;
}
