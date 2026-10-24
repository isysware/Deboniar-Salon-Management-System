export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF';

export type PortalType = 'SUPER_ADMIN' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | 'ALL'; // Super Admin can have 'ALL' or specific branch
  branchName?: string;
  staffId?: string; // Links to staff profile for STAFF role
  title: string;
  avatarUrl?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  password?: string;
}

export interface Session {
  user: User;
  token: string;
  loginTime: string;
  activeBranchId: string | 'ALL';
}

export interface DemoCredential {
  portal: PortalType;
  label: string;
  roleName: string;
  email: string;
  password: string;
  branchName: string;
  description: string;
  user: User;
}
