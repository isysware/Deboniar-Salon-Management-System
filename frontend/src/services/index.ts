import { AuthServiceContract } from './authService';
import { SalonServiceContract } from './salonService';
import { mockAuthService } from './mock/mockAuthService';
import { mockSalonService } from './mock/mockSalonService';
import { httpAuthService } from './http/httpAuthService';
import { httpSalonService } from './http/httpSalonService';

// VITE_USE_MOCK=true → everything runs on the in-browser mock (offline demo).
// Otherwise → the Express API (modules not migrated yet fall back to the mock automatically).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const authService: AuthServiceContract = USE_MOCK ? mockAuthService : httpAuthService;
export const salonService: SalonServiceContract = USE_MOCK ? mockSalonService : httpSalonService;

export * from './authService';
export * from './salonService';
