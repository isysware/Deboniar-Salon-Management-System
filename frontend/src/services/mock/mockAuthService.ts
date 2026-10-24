import { AuthServiceContract, LoginParams, PasswordResetResponse } from '../authService';
import { Session, PortalType, User } from '@/types/auth';
import { mockStorage } from './mockStorage';

const SESSION_STORAGE_KEY = 'isysware_salon_session_v3';
const REMEMBER_ME_KEY = 'isysware_salon_remembered_id';

function sanitizeUser(user: User): User {
  const { password: _, ...safeUser } = user;
  return safeUser as User;
}

class MockAuthService implements AuthServiceContract {
  private currentSession: Session | null = null;

  constructor() {
    this.rehydrateSession();
  }

  private rehydrateSession(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed: Session = JSON.parse(stored);
        const store = mockStorage.getStore();
        const liveUser = store.users.find((u) => u.id === parsed.user.id);

        if (!liveUser || !liveUser.isActive) {
          this.setCurrentSession(null);
          return;
        }

        // Validate branch
        if (liveUser.role !== 'SUPER_ADMIN') {
          const branch = store.branches.find((b) => b.id === liveUser.branchId);
          if (!branch || !branch.isActive) {
            this.setCurrentSession(null);
            return;
          }
        }

        // Validate staff
        if (liveUser.role === 'STAFF') {
          if (!liveUser.staffId) {
            this.setCurrentSession(null);
            return;
          }
          const staff = store.staff.find((s) => s.id === liveUser.staffId);
          if (!staff || !staff.isActive || !staff.hasPortalAccess || staff.branchId !== liveUser.branchId) {
            this.setCurrentSession(null);
            return;
          }
        }

        this.currentSession = {
          ...parsed,
          user: sanitizeUser(liveUser),
        };
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      this.setCurrentSession(null);
    }
  }

  async login({ portal, identifier, password, rememberMe }: LoginParams): Promise<Session> {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    const store = mockStorage.getStore();

    // 1. Locate account in unified persistent store by email or id
    const matchedUser = store.users.find(
      (u) => u.email.toLowerCase() === cleanId || u.id.toLowerCase() === cleanId
    );

    if (!matchedUser) {
      throw new Error(
        'Account not found. Please verify your login identifier or select an account from the demo accounts drawer.'
      );
    }

    // 2. Access Status Check
    if (!matchedUser.isActive) {
      throw new Error(
        `Account Disabled: The login credentials for '${matchedUser.email}' have been deactivated. Access denied.`
      );
    }

    // 3. Portal Check
    if (matchedUser.role !== portal) {
      const portalNames: Record<PortalType, string> = {
        SUPER_ADMIN: 'Super Administrator',
        ADMIN: 'Branch Administrator',
        ACCOUNTANT: 'Sales and Billing',
        STAFF: 'Staff / Stylist',
      };
      throw new Error(
        `Portal Mismatch: The account '${matchedUser.email}' is designated as a ${portalNames[matchedUser.role]}. You selected the ${portalNames[portal]} portal. Please switch to the ${portalNames[matchedUser.role]} portal.`
      );
    }

    // 4. Branch Validation
    if (matchedUser.role !== 'SUPER_ADMIN') {
      const branch = store.branches.find((b) => b.id === matchedUser.branchId);
      if (!branch) {
        throw new Error('Access Denied: The assigned salon branch does not exist.');
      }
      if (!branch.isActive) {
        throw new Error(`Access Denied: Branch '${branch.name}' is currently deactivated.`);
      }
    }

    // 5. Staff Profile Validation
    if (matchedUser.role === 'STAFF') {
      if (!matchedUser.staffId) {
        throw new Error('Access Denied: Account is not linked to an employee profile.');
      }
      const staff = store.staff.find((s) => s.id === matchedUser.staffId);
      if (!staff) {
        throw new Error('Access Denied: Linked employee record not found.');
      }
      if (!staff.isActive) {
        throw new Error(`Access Denied: Employee '${staff.name}' is currently inactive.`);
      }
      if (!staff.hasPortalAccess) {
        throw new Error(`Access Denied: Portal access has been revoked for employee '${staff.name}'.`);
      }
      if (staff.branchId !== matchedUser.branchId) {
        throw new Error('Access Denied: Employee branch does not match login account branch.');
      }
    }

    // 6. Password Validation
    const expectedPassword = matchedUser.password || 'Salon@2026';
    if (expectedPassword !== cleanPass) {
      throw new Error('Invalid password. Please check your credentials or use the demo accounts selector.');
    }

    // 7. Remember Me
    if (typeof window !== 'undefined') {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, matchedUser.email);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }
    }

    // 8. Generate Session (EXCLUDING password field)
    const session: Session = {
      user: sanitizeUser(matchedUser),
      token: `mock_jwt_${Date.now()}_${matchedUser.id}`,
      loginTime: new Date().toISOString(),
      activeBranchId: matchedUser.role === 'SUPER_ADMIN' ? 'ALL' : matchedUser.branchId,
    };

    this.setCurrentSession(session);
    return session;
  }

  async logout(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.setCurrentSession(null);
  }

  getCurrentSession(): Session | null {
    if (!this.currentSession) return null;

    const store = mockStorage.getStore();
    const liveUser = store.users.find((u) => u.id === this.currentSession!.user.id);
    if (!liveUser || !liveUser.isActive) {
      this.setCurrentSession(null);
      return null;
    }

    // Validate branch
    if (liveUser.role !== 'SUPER_ADMIN') {
      const branch = store.branches.find((b) => b.id === liveUser.branchId);
      if (!branch || !branch.isActive) {
        this.setCurrentSession(null);
        return null;
      }
    }

    // Validate staff
    if (liveUser.role === 'STAFF') {
      if (!liveUser.staffId) {
        this.setCurrentSession(null);
        return null;
      }
      const staff = store.staff.find((s) => s.id === liveUser.staffId);
      if (!staff || !staff.isActive || !staff.hasPortalAccess || staff.branchId !== liveUser.branchId) {
        this.setCurrentSession(null);
        return null;
      }
    }

    this.currentSession.user = sanitizeUser(liveUser);
    return this.currentSession;
  }

  setCurrentSession(session: Session | null): void {
    this.currentSession = session;
    if (typeof window !== 'undefined') {
      if (session) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }

  setActiveBranch(branchId: string | 'ALL'): Session | null {
    if (!this.currentSession) return null;

    if (this.currentSession.user.role !== 'SUPER_ADMIN') {
      return this.currentSession;
    }

    const updatedSession: Session = {
      ...this.currentSession,
      activeBranchId: branchId,
    };

    this.setCurrentSession(updatedSession);
    return updatedSession;
  }

  getSavedRememberMeIdentifier(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REMEMBER_ME_KEY);
  }

  async requestPasswordReset(identifier: string, portal: PortalType): Promise<PasswordResetResponse> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const cleanId = identifier.trim().toLowerCase();
    const store = mockStorage.getStore();

    const matched = store.users.find(
      (u) => u.email.toLowerCase() === cleanId && u.role === portal
    );

    const simulatedToken = `rst_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    if (!matched) {
      return {
        success: false,
        userEmail: identifier,
        message: `No active account matching '${identifier}' was found under the selected portal.`,
      };
    }

    if (!matched.isActive) {
      return {
        success: false,
        userEmail: identifier,
        message: `Account '${identifier}' is deactivated. Please contact your system administrator.`,
      };
    }

    // Never return the existing password!
    return {
      success: true,
      userEmail: matched.email,
      simulatedToken,
      message: `Simulated Reset Request: A secure password recovery link has been generated and dispatched to ${matched.email} (simulated demonstration).`,
    };
  }
}

export const mockAuthService = new MockAuthService();
