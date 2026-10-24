import { DemoCredential } from '../types/auth';

export const BRAND_COLORS = {
  primary: '#2254E1',
  primaryHover: '#1B3FC5',
  darkText: '#0B1020',
  pageBg: '#F5F7FB',
  white: '#FFFFFF',
  border: '#E2E8F0',
  borderMuted: '#EDF2F7',
};

export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    portal: 'SUPER_ADMIN',
    label: 'Super Administrator',
    roleName: 'Global Executive Admin',
    email: 'superadmin@isysware.com',
    password: 'admin123',
    branchName: 'All Branches (Consolidated View)',
    description: 'Consolidated oversight, branch management, and full system audit.',
    user: {
      id: 'usr-super-01',
      name: 'Super Administrator',
      email: 'superadmin@isysware.com',
      role: 'SUPER_ADMIN',
      branchId: 'ALL',
      branchName: 'All Branches',
      title: 'Global Operations Director',
      phone: '+92 (42) 3578-9100',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    portal: 'ADMIN',
    label: 'Warsi Salon Admin',
    roleName: 'Warsi Salon General Manager',
    email: 'huzaifawarsi2006@gmail.com',
    password: 'admin123',
    branchName: 'Warsi Salon (Karachi)',
    description: 'Branch administrator for Warsi Salon: appointments, billing, staff and finances.',
    user: {
      id: '85887989-7308-4579-b32d-05d660dcdb8d',
      name: 'Huzaifa',
      email: 'huzaifawarsi2006@gmail.com',
      role: 'ADMIN',
      branchId: '84b4c825-09f5-4163-8464-d497312f9a23',
      branchName: 'Warsi Salon',
      title: 'Branch Manager',
      phone: '03132220567',
      isActive: true,
      createdAt: '2026-10-01T00:00:00Z',
    },
  },
];
