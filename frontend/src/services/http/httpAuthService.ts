// Auth adapter for the Express API (JWT access token in memory + httpOnly refresh cookie).

import { AuthServiceContract, LoginParams, PasswordResetResponse } from '../authService';
import { Session, PortalType } from '@/types/auth';
import { api, refreshSession, setAccessToken, setSessionExpiredHandler } from './apiClient';

const ACTIVE_BRANCH_KEY = 'salonos_active_branch';
const REMEMBER_ME_KEY = 'isysware_salon_remembered_id';

const readActiveBranch = (): string | null => {
  try {
    return sessionStorage.getItem(ACTIVE_BRANCH_KEY);
  } catch {
    return null;
  }
};

const writeActiveBranch = (branchId: string | null) => {
  try {
    if (branchId) sessionStorage.setItem(ACTIVE_BRANCH_KEY, branchId);
    else sessionStorage.removeItem(ACTIVE_BRANCH_KEY);
  } catch {
    /* storage unavailable — branch choice just won't survive a reload */
  }
};

class HttpAuthService implements AuthServiceContract {
  private currentSession: Session | null = null;

  constructor() {
    setSessionExpiredHandler(() => this.setCurrentSession(null));
  }

  private restoring: Promise<Session | null> | null = null;

  /**
   * Restores the session on page load using the refresh cookie. Concurrent callers (e.g. React
   * StrictMode running effects twice) share one request, because each refresh rotates the token.
   */
  restoreSession(): Promise<Session | null> {
    if (!this.restoring) {
      this.restoring = this.doRestore().finally(() => {
        this.restoring = null;
      });
    }
    return this.restoring;
  }

  private async doRestore(): Promise<Session | null> {
    const data = await refreshSession().catch(() => null);
    if (!data) {
      this.setCurrentSession(null);
      return null;
    }
    const session: Session = data;
    if (session.user.role === 'SUPER_ADMIN') session.activeBranchId = readActiveBranch() || 'ALL';
    this.setCurrentSession(session);
    return session;
  }

  async login({ portal, identifier, password, rememberMe }: LoginParams): Promise<Session> {
    const session = await api.post<Session>('/auth/login', { portal, identifier: identifier.trim(), password });
    try {
      if (rememberMe) localStorage.setItem(REMEMBER_ME_KEY, session.user.email);
      else localStorage.removeItem(REMEMBER_ME_KEY);
    } catch {
      /* ignore */
    }
    writeActiveBranch(null);
    this.setCurrentSession(session);
    return session;
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => undefined);
    writeActiveBranch(null);
    this.setCurrentSession(null);
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  setCurrentSession(session: Session | null): void {
    this.currentSession = session;
    setAccessToken(session?.token ?? null);
  }

  setActiveBranch(branchId: string | 'ALL'): Session | null {
    if (!this.currentSession || this.currentSession.user.role !== 'SUPER_ADMIN') return this.currentSession;
    writeActiveBranch(branchId);
    this.setCurrentSession({ ...this.currentSession, activeBranchId: branchId });
    return this.currentSession;
  }

  getSavedRememberMeIdentifier(): string | null {
    try {
      return localStorage.getItem(REMEMBER_ME_KEY);
    } catch {
      return null;
    }
  }

  async requestPasswordReset(identifier: string, portal: PortalType): Promise<PasswordResetResponse> {
    return api.post<PasswordResetResponse>('/auth/forgot-password', { identifier, portal });
  }
}

export const httpAuthService = new HttpAuthService();
