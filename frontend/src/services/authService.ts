import { PortalType, Session, User } from '../types/auth';

export interface LoginParams {
  portal: PortalType;
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  simulatedToken?: string;
  userEmail: string;
}

export interface AuthServiceContract {
  login(params: LoginParams): Promise<Session>;
  logout(): Promise<void>;
  getCurrentSession(): Session | null;
  setCurrentSession(session: Session | null): void;
  setActiveBranch(branchId: string | 'ALL'): Session | null;
  getSavedRememberMeIdentifier(): string | null;
  requestPasswordReset(identifier: string, portal: PortalType): Promise<PasswordResetResponse>;
  /** API adapter only: rebuilds the session on page load (refresh cookie). */
  restoreSession?(): Promise<Session | null>;
}
