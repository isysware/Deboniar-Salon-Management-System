import {
  Branch,
  OnlineAccount,
  PaymentAccount,
  StaffMember,
  Appointment,
  Invoice,
  Expense,
  CashDrawer,
  Settlement,
  AttendanceRecord,
  OvertimeRecord,
  ServiceItem,
  PackageItem,
  ServiceCategory,
  TaxRule,
  IdempotencyRecord,
  Client,
  ExpenseCategoryItem,
  CashTransferRecord,
  CashVarianceAdjustment,
  LeaveRecord,
  BranchHoliday,
  PayrollRun,
  PayrollPayment,
  PayrollPolicyConfig,
  CommissionRun,
  CommissionPayment,
  TipReceiptRecord,
  TipAllocationRecord,
  TipPayoutRecord,
  InventoryItem,
  InventoryBatch,
  Supplier,
  SupplierLedgerEntry,
  Purchase,
  SupplierPaymentRecord,
  SupplierReturn,
  StockMovement,
  StockSettlement,
  Device,
} from '@/types/salon';
import { User } from '@/types/auth';

const STORAGE_VERSION = 'isysware_salon_store_v3';
export const DEFAULT_DEMO_DATE = '2026-09-28';

export interface StorageSchema {
  version: string;
  systemDate: string;
  branches: Branch[];
  users: User[];
  staff: StaffMember[];
  onlineAccounts: OnlineAccount[];
  paymentAccounts: PaymentAccount[];
  services: ServiceItem[];
  packages: PackageItem[];
  serviceCategories: ServiceCategory[];
  taxRules: TaxRule[];
  appointments: Appointment[];
  invoices: Invoice[];
  expenses: Expense[];
  cashDrawers: CashDrawer[];
  settlements: Settlement[];
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  idempotencyRecords?: IdempotencyRecord[];
  invoiceSequenceCounters?: Record<string, number>;
  clients?: Client[];
  expenseCategories?: ExpenseCategoryItem[];
  cashTransfers?: CashTransferRecord[];
  expenseSequenceCounters?: Record<string, number>;
  settlementSequenceCounters?: Record<string, number>;
  varianceAdjustmentSequenceCounters?: Record<string, number>;
  cashVarianceAdjustments?: CashVarianceAdjustment[];
  vaultBalances?: Record<string, number>;
  leaves?: LeaveRecord[];
  branchHolidays?: BranchHoliday[];
  overtimeSequenceCounters?: Record<string, number>;
  leaveSequenceCounters?: Record<string, number>;
  payrollRuns?: PayrollRun[];
  payrollPayments?: PayrollPayment[];
  payrollPolicyConfigs?: PayrollPolicyConfig[];
  payrollSequenceCounters?: Record<string, number>;
  payslipSequenceCounters?: Record<string, number>;
  payrollPaymentSequenceCounters?: Record<string, number>;
  commissionRuns?: CommissionRun[];
  commissionPayments?: CommissionPayment[];
  commissionSequenceCounters?: Record<string, number>;
  commissionStatementSequenceCounters?: Record<string, number>;
  commissionPaymentSequenceCounters?: Record<string, number>;
  tipReceipts?: TipReceiptRecord[];
  tipAllocations?: TipAllocationRecord[];
  tipPayouts?: TipPayoutRecord[];
  tipReceiptSequenceCounters?: Record<string, number>;
  tipAllocationSequenceCounters?: Record<string, number>;
  tipPayoutSequenceCounters?: Record<string, number>;
  appointmentSequenceCounters?: Record<string, number>;
  clientSequenceCounters?: Record<string, number>;
  inventoryItems?: InventoryItem[];
  inventoryBatches?: InventoryBatch[];
  suppliers?: Supplier[];
  supplierLedger?: SupplierLedgerEntry[];
  purchases?: Purchase[];
  supplierPayments?: SupplierPaymentRecord[];
  supplierReturns?: SupplierReturn[];
  stockMovements?: StockMovement[];
  stockSettlements?: StockSettlement[];
  purchaseSequenceCounters?: Record<string, number>;
  supplierSequenceCounters?: Record<string, number>;
  movementSequenceCounters?: Record<string, number>;
  supplierPaymentSequenceCounters?: Record<string, number>;
  supplierReturnSequenceCounters?: Record<string, number>;
  settlementRecordSequenceCounters?: Record<string, number>;
  devices?: Device[];
}

export type StoreListener = (store: StorageSchema) => void;

// --- INITIAL SEEDED DATA ---

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'client-1',
    branchId: 'branch-1',
    name: 'Zainab Ahmed',
    phone: '+92 (300) 123-4567',
    email: 'zainab.ahmed@example.com',
    source: 'WALK_IN',
    outstandingBalance: 35680.0,
    totalVisits: 8,
    loyaltyPoints: 120,
    lastVisitDate: '2026-09-28',
  },
  {
    id: 'client-2',
    branchId: 'branch-1',
    name: 'Tariq Mahmood',
    phone: '+92 (321) 987-6543',
    email: 'tariq.m@example.com',
    source: 'REFERRAL',
    sourceDetails: 'Referred by Dr. Usman',
    outstandingBalance: 0.0,
    totalVisits: 3,
    loyaltyPoints: 45,
    lastVisitDate: '2026-09-25',
  },
  {
    id: 'client-3',
    branchId: 'branch-2',
    name: 'Farah Naz',
    phone: '+92 (333) 555-1234',
    email: 'farah.naz@example.com',
    source: 'SOCIAL_MEDIA',
    sourceDetails: 'Instagram @farahnaz_looks',
    outstandingBalance: 8500.0,
    totalVisits: 5,
    loyaltyPoints: 80,
    lastVisitDate: '2026-09-18',
  },
];

export const INITIAL_EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  { id: 'exp-cat-1', branchId: 'branch-1', name: 'Supplies', description: 'Salon consumables and sanitation products', isActive: true, createdAt: '2026-01-01' },
  { id: 'exp-cat-2', branchId: 'branch-1', name: 'Utilities', description: 'Electricity, water, gas, and internet bills', isActive: true, createdAt: '2026-01-01' },
  { id: 'exp-cat-3', branchId: 'branch-1', name: 'Maintenance', description: 'Equipment repair and facility upkeep', isActive: true, createdAt: '2026-01-01' },
  { id: 'exp-cat-4', branchId: 'branch-1', name: 'Refreshments', description: 'Client teas, beverages, and hospitality', isActive: true, createdAt: '2026-01-01' },
  { id: 'exp-cat-5', branchId: 'branch-1', name: 'Marketing', description: 'Local promotions, flyers, and ad spend', isActive: true, createdAt: '2026-01-01' },
  { id: 'exp-cat-6', branchId: 'branch-2', name: 'Supplies', description: 'Salon consumables and sanitation products', isActive: true, createdAt: '2026-01-01' },
  { id: 'exp-cat-7', branchId: 'branch-2', name: 'Utilities', description: 'Electricity, water, gas, and internet bills', isActive: true, createdAt: '2026-01-01' },
  { id: 'exp-cat-8', branchId: 'branch-2', name: 'Maintenance', description: 'Equipment repair and facility upkeep', isActive: true, createdAt: '2026-01-01' },
];

const INITIAL_TAX_RULES: TaxRule[] = [
  {
    id: 'tax-lhe-std',
    branchId: 'branch-1',
    name: 'Punjab Sales Tax (PST Standard)',
    rate: 0.16,
    description: '16% PRA sales tax on salon and beauty services in Punjab',
    isActive: true,
    isBranchDefault: true,
  },
  {
    id: 'tax-lhe-reduced',
    branchId: 'branch-1',
    name: 'Special Beauty Concession',
    rate: 0.05,
    description: '5% concession rate for designated skin consultations',
    isActive: true,
    isBranchDefault: false,
  },
  {
    id: 'tax-khi-std',
    branchId: 'branch-2',
    name: 'Sindh Sales Tax (SST Standard)',
    rate: 0.13,
    description: '13% SRB sales tax on personal grooming services in Sindh',
    isActive: true,
    isBranchDefault: true,
  },
  {
    id: 'tax-khi-reduced',
    branchId: 'branch-2',
    name: 'SRB Wellness Concession',
    rate: 0.08,
    description: '8% reduced tier for wellness treatments',
    isActive: true,
    isBranchDefault: false,
  },
];

const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'branch-1',
    name: 'Gulberg Flagship Lounge',
    code: 'LHE-01',
    address: 'M.M. Alam Road, Gulberg III',
    city: 'Lahore',
    phone: '+92 (42) 3578-9101',
    email: 'gulberg@isysware-salon.pk',
    timezone: 'Asia/Karachi',
    taxRate: 0.16,
    taxEnabled: true,
    defaultTaxRuleId: 'tax-lhe-std',
    currency: 'PKR',
    openingCashFloat: 25000.0,
    isActive: true,
    assignedAdminId: 'usr-admin-01',
    assignedAdminName: 'Aamina Sheikh',
  },
  {
    id: 'branch-2',
    name: 'Clifton Luxury Suites',
    code: 'KHI-02',
    address: 'Block 4, Clifton Marine Promenade',
    city: 'Karachi',
    phone: '+92 (21) 3582-4411',
    email: 'clifton@isysware-salon.pk',
    timezone: 'Asia/Karachi',
    taxRate: 0.13,
    taxEnabled: true,
    defaultTaxRuleId: 'tax-khi-std',
    currency: 'PKR',
    openingCashFloat: 30000.0,
    isActive: true,
    assignedAdminId: 'usr-admin-02',
    assignedAdminName: 'Kamran Akram',
  },
  {
    id: '84b4c825-09f5-4163-8464-d497312f9a23',
    name: 'Warsi Salon',
    code: 'WAR-01',
    address: 'Karachi',
    city: 'Karachi',
    phone: '03132220567',
    email: 'huzaifawarsi2006@gmail.com',
    timezone: 'Asia/Karachi',
    taxRate: 0.13,
    taxEnabled: true,
    currency: 'PKR',
    openingCashFloat: 0.0,
    isActive: true,
    assignedAdminId: '85887989-7308-4579-b32d-05d660dcdb8d',
    assignedAdminName: 'Huzaifa',
  },
];

const INITIAL_USERS: User[] = [
  {
    id: 'usr-super-01',
    name: 'Super Administrator',
    email: 'superadmin@isysware.com',
    role: 'SUPER_ADMIN',
    branchId: 'ALL',
    branchName: 'All Branches (Consolidated)',
    title: 'Chief Executive Officer',
    phone: '+92 (300) 111-2233',
    isActive: true,
    createdAt: '2026-01-15',
    password: 'admin123',
  },
  {
    id: '85887989-7308-4579-b32d-05d660dcdb8d',
    name: 'Huzaifa',
    email: 'huzaifawarsi2006@gmail.com',
    role: 'ADMIN',
    branchId: '84b4c825-09f5-4163-8464-d497312f9a23',
    branchName: 'Warsi Salon',
    title: 'Branch Manager',
    phone: '03132220567',
    isActive: true,
    createdAt: '2026-10-01',
    password: 'admin123',
  },
  {
    id: 'usr-admin-01',
    name: 'Aamina Sheikh',
    email: 'admin.gulberg@isysware.com',
    role: 'ADMIN',
    branchId: 'branch-1',
    branchName: 'Gulberg Flagship Lounge',
    title: 'Branch General Manager',
    phone: '+92 (300) 222-3344',
    isActive: true,
    createdAt: '2026-01-20',
    password: 'admin123',
  },
  {
    id: 'usr-admin-02',
    name: 'Kamran Akram',
    email: 'admin.clifton@isysware.com',
    role: 'ADMIN',
    branchId: 'branch-2',
    branchName: 'Clifton Luxury Suites',
    title: 'Branch Managing Director',
    phone: '+92 (321) 555-8899',
    isActive: true,
    createdAt: '2026-01-22',
    password: 'admin123',
  },
  {
    id: 'usr-acc-01',
    name: 'Usman Farooq',
    email: 'accountant.gulberg@isysware.com',
    role: 'ACCOUNTANT',
    branchId: 'branch-1',
    branchName: 'Gulberg Flagship Lounge',
    title: 'Branch Cashier & Accountant',
    phone: '+92 (300) 333-4455',
    isActive: true,
    createdAt: '2026-02-01',
    password: 'admin123',
  },
  {
    id: 'usr-staff-01',
    name: 'Zara Alvi',
    email: 'zara.stylist@isysware.com',
    role: 'STAFF',
    branchId: 'branch-1',
    branchName: 'Gulberg Flagship Lounge',
    staffId: 'staff-1',
    title: 'Senior Hair Stylist & Colorist',
    phone: '+92 (300) 444-5566',
    isActive: true,
    createdAt: '2026-02-15',
    password: 'admin123',
  },
];

const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'staff-1',
    employeeCode: 'EMP-LHE-001',
    branchId: 'branch-1',
    branchName: 'Gulberg Flagship Lounge',
    name: 'Zara Alvi',
    email: 'zara.stylist@isysware.com',
    phone: '+92 (300) 456-7890',
    designation: 'Senior Stylist & Colorist',
    roleTitle: 'Senior Stylist & Colorist',
    joiningDate: '2024-03-15',
    compensationType: 'MONTHLY_PLUS_COMMISSION',
    baseSalary: 85000.0,
    dailySalaryRate: 0,
    commissionRate: 20, // 20%
    overtimeHourlyRate: 600.0,
    effectiveDate: '2026-01-01',
    startTime: '09:00',
    endTime: '18:00',
    lateGraceMinutes: 15,
    earlyGraceMinutes: 15,
    allowedLeaveDays: 12,
    leaveAllowancePeriod: 'YEARLY',
    lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    payrollDivisor: 30,
    combinationPolicy: 'BOTH',
    isActive: true,
    specialties: ['Balayage & Foilyage', 'Keratin Smoothing', 'Bridal Hair Design'],
    hasPortalAccess: true,
    linkedUserId: 'usr-staff-01',
    linkedUserEmail: 'zara.stylist@isysware.com',
  },
  {
    id: 'staff-2',
    employeeCode: 'EMP-LHE-002',
    branchId: 'branch-1',
    branchName: 'Gulberg Flagship Lounge',
    name: 'Hamza Malik',
    email: 'hamza.barber@isysware.com',
    phone: '+92 (300) 456-7891',
    designation: 'Master Barber & Grooming',
    roleTitle: 'Master Barber & Grooming',
    joiningDate: '2024-06-01',
    compensationType: 'MONTHLY_PLUS_COMMISSION',
    baseSalary: 75000.0,
    dailySalaryRate: 0,
    commissionRate: 18, // 18%
    overtimeHourlyRate: 500.0,
    effectiveDate: '2026-01-01',
    startTime: '10:00',
    endTime: '19:00',
    lateGraceMinutes: 15,
    earlyGraceMinutes: 15,
    allowedLeaveDays: 12,
    leaveAllowancePeriod: 'YEARLY',
    lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    payrollDivisor: 30,
    combinationPolicy: 'BOTH',
    isActive: true,
    specialties: ['Executive Fade', 'Royal Hot Towel Shave', 'Beard Contouring'],
    hasPortalAccess: false,
  },
  {
    id: 'staff-3',
    employeeCode: 'EMP-LHE-003',
    branchId: 'branch-1',
    branchName: 'Gulberg Flagship Lounge',
    name: 'Ayesha Khan',
    email: 'ayesha.nails@isysware.com',
    phone: '+92 (300) 456-7892',
    designation: 'Nail Artist & Esthetician',
    roleTitle: 'Nail Artist & Esthetician',
    joiningDate: '2024-09-10',
    compensationType: 'MONTHLY_PLUS_COMMISSION',
    baseSalary: 65000.0,
    dailySalaryRate: 0,
    commissionRate: 15, // 15%
    overtimeHourlyRate: 450.0,
    effectiveDate: '2026-01-01',
    startTime: '09:30',
    endTime: '18:30',
    lateGraceMinutes: 10,
    earlyGraceMinutes: 10,
    allowedLeaveDays: 12,
    leaveAllowancePeriod: 'YEARLY',
    lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    payrollDivisor: 30,
    combinationPolicy: 'BOTH',
    isActive: true,
    specialties: ['Gel Polish Art', 'Russian Manicure', 'HydraFacial Glow'],
    hasPortalAccess: false,
  },
  {
    id: 'staff-4',
    employeeCode: 'EMP-KHI-001',
    branchId: 'branch-2',
    branchName: 'Clifton Luxury Suites',
    name: 'Sana Mir',
    email: 'sana.spa@isysware.com',
    phone: '+92 (321) 987-6543',
    designation: 'Skin Therapist & Spa Specialist',
    roleTitle: 'Skin Therapist & Spa Specialist',
    joiningDate: '2025-01-05',
    compensationType: 'MONTHLY_SALARY',
    baseSalary: 80000.0,
    dailySalaryRate: 0,
    commissionRate: 0,
    overtimeHourlyRate: 550.0,
    effectiveDate: '2026-01-01',
    startTime: '09:00',
    endTime: '18:00',
    lateGraceMinutes: 15,
    earlyGraceMinutes: 15,
    allowedLeaveDays: 12,
    leaveAllowancePeriod: 'YEARLY',
    lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    payrollDivisor: 30,
    combinationPolicy: 'BOTH',
    isActive: true,
    specialties: ['HydraFacial', 'Deep Tissue Reflexology', 'Organic Peels'],
    hasPortalAccess: false,
  },
  {
    id: 'staff-5',
    employeeCode: 'EMP-KHI-002',
    branchId: 'branch-2',
    branchName: 'Clifton Luxury Suites',
    name: 'Bilal Tariq',
    email: 'bilal.stylist@isysware.com',
    phone: '+92 (321) 987-6544',
    designation: 'Creative Director & Hair Artist',
    roleTitle: 'Creative Director & Hair Artist',
    joiningDate: '2025-02-01',
    compensationType: 'DAILY_PLUS_COMMISSION',
    baseSalary: 0,
    dailySalaryRate: 3500.0,
    commissionRate: 22, // 22%
    overtimeHourlyRate: 650.0,
    effectiveDate: '2026-01-01',
    startTime: '11:00',
    endTime: '20:00',
    lateGraceMinutes: 15,
    earlyGraceMinutes: 15,
    allowedLeaveDays: 1,
    leaveAllowancePeriod: 'MONTHLY',
    lateInDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    earlyExitDeduction: { enabled: false, type: 'FIXED', amount: 0 },
    payrollDivisor: 30,
    combinationPolicy: 'BOTH',
    isActive: true,
    specialties: ['Precision Architecture Cuts', 'Color Transformation', 'Beard Artistry'],
    hasPortalAccess: false,
  },
];

const INITIAL_SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'cat-lhe-1', branchId: 'branch-1', name: 'Hair Styling & Cuts', isActive: true },
  { id: 'cat-lhe-2', branchId: 'branch-1', name: 'Hair Coloring & Balayage', isActive: true },
  { id: 'cat-lhe-3', branchId: 'branch-1', name: 'Skin & HydraFacial', isActive: true },
  { id: 'cat-lhe-4', branchId: 'branch-1', name: 'Nails & Pedicure', isActive: true },
  { id: 'cat-lhe-5', branchId: 'branch-1', name: 'Men Grooming', isActive: true },
  { id: 'cat-khi-1', branchId: 'branch-2', name: 'Hair Couture', isActive: true },
  { id: 'cat-khi-2', branchId: 'branch-2', name: 'Spa & Wellness', isActive: true },
  { id: 'cat-khi-3', branchId: 'branch-2', name: 'Nail Esthetics', isActive: true },
  { id: 'cat-khi-4', branchId: 'branch-2', name: 'Luxury Barbering', isActive: true },
];

const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: 'srv-lhe-01',
    branchId: 'branch-1',
    code: 'SRV-LHE-001',
    name: 'Signature Blowout & Treatment',
    category: 'Hair Styling & Cuts',
    durationMinutes: 45,
    price: 3500.0,
    description: 'Wash, nourishing deep-conditioning rinse, and premium salon blowout with volume finish.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
  {
    id: 'srv-lhe-02',
    branchId: 'branch-1',
    code: 'SRV-LHE-002',
    name: 'Executive Hot Towel Shave & Cut',
    category: 'Men Grooming',
    durationMinutes: 40,
    price: 4000.0,
    description: 'Precision scissor and clipper trim with hot towel botanical lather shave.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
  {
    id: 'srv-lhe-03',
    branchId: 'branch-1',
    code: 'SRV-LHE-003',
    name: 'Signature Balayage & Gloss Finish',
    category: 'Hair Coloring & Balayage',
    durationMinutes: 120,
    price: 18500.0,
    description: 'Hand-painted dimensional contouring followed by conditioning tonal glaze gloss.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
  {
    id: 'srv-lhe-04',
    branchId: 'branch-1',
    code: 'SRV-LHE-004',
    name: 'Keratin Smoothing Therapy',
    category: 'Hair Styling & Cuts',
    durationMinutes: 150,
    price: 22000.0,
    description: 'Formaldehyde-free intensive smoothing treatment eliminating frizz for up to 4 months.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
  {
    id: 'srv-lhe-05',
    branchId: 'branch-1',
    code: 'SRV-LHE-005',
    name: 'Russian Gel Manicure',
    category: 'Nails & Pedicure',
    durationMinutes: 60,
    price: 5000.0,
    description: 'Dry hardware cuticle refinement, nail apex reinforcement, and flawless high-gloss gel polish.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
  {
    id: 'srv-lhe-06',
    branchId: 'branch-1',
    code: 'SRV-LHE-006',
    name: 'Clinical HydraFacial Glow',
    category: 'Skin & HydraFacial',
    durationMinutes: 75,
    price: 12000.0,
    description: '3-step vortex extraction, gentle chemical peel, and hyaluronic acid antioxidant serum infusion.',
    taxTreatment: 'SPECIFIC_RULE',
    specificTaxRuleId: 'tax-lhe-reduced',
    isActive: true,
  },
  {
    id: 'srv-lhe-07',
    branchId: 'branch-1',
    code: 'SRV-LHE-007',
    name: 'Scalp Detox & Micro-Mist Therapy',
    category: 'Hair Styling & Cuts',
    durationMinutes: 30,
    price: 4500.0,
    description: 'Exfoliating salicylic acid scalp scrub followed by ultrasound micro-mist hydration.',
    taxTreatment: 'EXEMPT',
    isActive: true,
  },
  {
    id: 'srv-khi-01',
    branchId: 'branch-2',
    code: 'SRV-KHI-001',
    name: 'Couture Balayage & Olaplex Infusion',
    category: 'Hair Couture',
    durationMinutes: 135,
    price: 21000.0,
    description: 'Bespoke coastal illumination with multi-bond restructuring treatment.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
  {
    id: 'srv-khi-02',
    branchId: 'branch-2',
    code: 'SRV-KHI-002',
    name: 'Deep Tissue Aromatherapy Massage',
    category: 'Spa & Wellness',
    durationMinutes: 60,
    price: 9500.0,
    description: 'Therapeutic neuromuscular release utilizing organic lavender and eucalyptus cold-pressed oils.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
  {
    id: 'srv-khi-03',
    branchId: 'branch-2',
    code: 'SRV-KHI-003',
    name: 'Royal Beard Architecture & Shave',
    category: 'Luxury Barbering',
    durationMinutes: 45,
    price: 4500.0,
    description: 'Razor edge alignment, conditioning beard oil mask, and invigorating menthol mist.',
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
  },
];

const INITIAL_PACKAGES: PackageItem[] = [
  {
    id: 'pkg-lhe-01',
    branchId: 'branch-1',
    code: 'PKG-LHE-001',
    name: 'Bridal Glamour & Hair Transformation',
    description: 'Luxury pre-wedding makeover combining master balayage, keratin renewal, and Russian manicure.',
    price: 42000.0,
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
    components: [
      {
        serviceId: 'srv-lhe-03',
        serviceCode: 'SRV-LHE-003',
        serviceName: 'Signature Balayage & Gloss Finish',
        quantity: 1,
        allocationPercentage: 45,
        unitPrice: 18500.0,
      },
      {
        serviceId: 'srv-lhe-04',
        serviceCode: 'SRV-LHE-004',
        serviceName: 'Keratin Smoothing Therapy',
        quantity: 1,
        allocationPercentage: 45,
        unitPrice: 22000.0,
      },
      {
        serviceId: 'srv-lhe-05',
        serviceCode: 'SRV-LHE-005',
        serviceName: 'Russian Gel Manicure',
        quantity: 1,
        allocationPercentage: 10,
        unitPrice: 5000.0,
      },
    ],
  },
  {
    id: 'pkg-lhe-02',
    branchId: 'branch-1',
    code: 'PKG-LHE-002',
    name: 'Executive Grooming Suite',
    description: 'Complete restorative grooming including tailored cut, hot towel shave, and scalp detox micro-mist.',
    price: 7000.0,
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
    components: [
      {
        serviceId: 'srv-lhe-02',
        serviceCode: 'SRV-LHE-002',
        serviceName: 'Executive Hot Towel Shave & Cut',
        quantity: 1,
        allocationPercentage: 60,
        unitPrice: 4000.0,
      },
      {
        serviceId: 'srv-lhe-07',
        serviceCode: 'SRV-LHE-007',
        serviceName: 'Scalp Detox & Micro-Mist Therapy',
        quantity: 1,
        allocationPercentage: 40,
        unitPrice: 4500.0,
      },
    ],
  },
  {
    id: 'pkg-khi-01',
    branchId: 'branch-2',
    code: 'PKG-KHI-001',
    name: 'Clifton Riviera Glow Package',
    description: 'Luxury coastal styling with deep-tissue full body aromatherapy.',
    price: 28000.0,
    taxTreatment: 'BRANCH_DEFAULT',
    isActive: true,
    components: [
      {
        serviceId: 'srv-khi-01',
        serviceCode: 'SRV-KHI-001',
        serviceName: 'Couture Balayage & Olaplex Infusion',
        quantity: 1,
        allocationPercentage: 70,
        unitPrice: 21000.0,
      },
      {
        serviceId: 'srv-khi-02',
        serviceCode: 'SRV-KHI-002',
        serviceName: 'Deep Tissue Aromatherapy Massage',
        quantity: 1,
        allocationPercentage: 30,
        unitPrice: 9500.0,
      },
    ],
  },
];

const INITIAL_PAYMENT_ACCOUNTS: PaymentAccount[] = [
  {
    id: 'acc-1',
    branchId: 'branch-1',
    name: 'Meezan Corporate Checking',
    accountType: 'BANK',
    providerName: 'Meezan Bank Ltd',
    accountHolder: 'iSysware Salon Gulberg',
    accountIdentifier: 'PK36MEZN0001004821',
    currentBalance: 1845000.0,
    isActive: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'acc-2',
    branchId: 'branch-1',
    name: 'HBL Smart POS Terminal 01',
    accountType: 'OTHER',
    providerName: 'Habib Bank Limited',
    accountHolder: 'iSysware Salon Terminal',
    accountIdentifier: 'TID-883201-LHE',
    currentBalance: 425000.0,
    isActive: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'acc-3',
    branchId: 'branch-1',
    name: 'JazzCash Merchant Till',
    accountType: 'JAZZCASH',
    providerName: 'Mobilink Microfinance Bank',
    accountHolder: 'Usman Farooq (Merchant Till)',
    accountIdentifier: '03001231049',
    currentBalance: 148500.0,
    isActive: true,
    createdAt: '2026-01-10',
  },
  {
    id: 'acc-4',
    branchId: 'branch-2',
    name: 'Bank Alfalah Premier Business',
    accountType: 'BANK',
    providerName: 'Bank Alfalah Ltd',
    accountHolder: 'iSysware Salon Karachi',
    accountIdentifier: 'PK42ALFH0009102201',
    currentBalance: 2340000.0,
    isActive: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'acc-5',
    branchId: 'branch-2',
    name: 'Clifton Reception POS 01',
    accountType: 'OTHER',
    providerName: 'HBL Digital Merchant',
    accountHolder: 'iSysware Karachi POS',
    accountIdentifier: 'TID-441902-KHI',
    currentBalance: 560000.0,
    isActive: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'acc-6',
    branchId: 'branch-2',
    name: 'Easypaisa Digital Till',
    accountType: 'EASYPAISA',
    providerName: 'Telenor Microfinance Bank',
    accountHolder: 'Kamran Akram Till',
    accountIdentifier: '03219877741',
    currentBalance: 195000.0,
    isActive: true,
    createdAt: '2026-01-12',
  },
];

export function migrateStaffMember(s: any): StaffMember {
  const baseSalary = typeof s.baseSalary === 'number' && !isNaN(s.baseSalary) ? s.baseSalary : 0;
  let commissionRate = typeof s.commissionRate === 'number' && !isNaN(s.commissionRate) ? s.commissionRate : 0;
  if (commissionRate > 0 && commissionRate <= 1) {
    commissionRate = Math.round(commissionRate * 100 * 100) / 100;
  }
  const dailySalaryRate = typeof s.dailySalaryRate === 'number' && !isNaN(s.dailySalaryRate) ? s.dailySalaryRate : 0;

  let compensationType: StaffMember['compensationType'] = s.compensationType;
  let requiresCompensationReview = s.requiresCompensationReview ?? false;

  if (!compensationType) {
    if (baseSalary > 0 && commissionRate > 0) {
      compensationType = 'MONTHLY_PLUS_COMMISSION';
    } else if (baseSalary > 0 && commissionRate === 0) {
      compensationType = 'MONTHLY_SALARY';
    } else if (dailySalaryRate > 0 && commissionRate > 0) {
      compensationType = 'DAILY_PLUS_COMMISSION';
    } else if (dailySalaryRate > 0 && commissionRate === 0) {
      compensationType = 'DAILY_SALARY';
    } else if (baseSalary === 0 && dailySalaryRate === 0 && commissionRate > 0) {
      compensationType = 'COMMISSION_ONLY';
    } else {
      compensationType = 'MONTHLY_SALARY';
      requiresCompensationReview = true;
    }
  }

  return {
    ...s,
    compensationType,
    baseSalary,
    dailySalaryRate,
    commissionRate,
    overtimeHourlyRate: typeof s.overtimeHourlyRate === 'number' && !isNaN(s.overtimeHourlyRate) ? s.overtimeHourlyRate : 0,
    effectiveDate: s.effectiveDate || s.joiningDate || '2026-01-01',
    requiresCompensationReview,

    startTime: s.startTime || '09:00',
    endTime: s.endTime || '18:00',
    lateGraceMinutes: typeof s.lateGraceMinutes === 'number' ? s.lateGraceMinutes : 15,
    earlyGraceMinutes: typeof s.earlyGraceMinutes === 'number' ? s.earlyGraceMinutes : 15,
    isOvernightShift: s.isOvernightShift ?? false,

    allowedLeaveDays: typeof s.allowedLeaveDays === 'number' ? s.allowedLeaveDays : 12,
    leaveAllowancePeriod: s.leaveAllowancePeriod || 'YEARLY',

    lateInDeduction: s.lateInDeduction || { enabled: false, type: 'FIXED', amount: 0 },
    earlyExitDeduction: s.earlyExitDeduction || { enabled: false, type: 'FIXED', amount: 0 },
    payrollDivisor: typeof s.payrollDivisor === 'number' ? s.payrollDivisor : 30,
    combinationPolicy: s.combinationPolicy || 'BOTH',

    isActive: s.isActive ?? true,
    avatarUrl: undefined, // Photo removal requirement
    specialties: Array.isArray(s.specialties) ? s.specialties : [],
  };
}

export function migrateExpense(e: any): Expense {
  let status: Expense['status'] = 'POSTED';
  if (e.status === 'DRAFT' || e.status === 'PENDING_APPROVAL') {
    status = 'DRAFT';
  } else if (e.status === 'REVERSED') {
    status = 'REVERSED';
  } else if (e.status === 'PAID' || e.status === 'POSTED') {
    status = 'POSTED';
  }

  return {
    ...e,
    expenseDate: e.expenseDate || e.date || DEFAULT_DEMO_DATE,
    date: e.date || DEFAULT_DEMO_DATE,
    time: e.time || '10:00 AM',
    title: e.title || e.description || 'Operating Expense',
    payee: e.payee || e.title || 'Supplier / Vendor',
    category: e.category || 'SUPPLIES',
    amount: typeof e.amount === 'number' ? e.amount : 0,
    paymentSource: e.paymentSource || 'CASH_DRAWER',
    createdByUserId: e.createdByUserId || e.paidByUserId || 'usr-acc-01',
    createdByName: e.createdByName || e.paidByName || 'Usman Farooq',
    paidByUserId: e.paidByUserId || e.createdByUserId || 'usr-acc-01',
    paidByName: e.paidByName || e.createdByName || 'Usman Farooq',
    status,
    createdAt: e.createdAt || `${e.date || DEFAULT_DEMO_DATE}T10:00:00.000Z`,
  };
}

export class MockStorageManager {
  private inMemoryStore: StorageSchema | null = null;
  private listeners: Set<StoreListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_VERSION) {
          this.inMemoryStore = null;
          const fresh = this.getStore();
          this.notifyListeners(fresh);
        }
      });

      window.addEventListener('isysware_store_updated', () => {
        this.inMemoryStore = null;
        const fresh = this.getStore();
        this.notifyListeners(fresh);
      });
    }
  }

  public subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(store: StorageSchema): void {
    this.listeners.forEach((fn) => {
      try {
        fn(store);
      } catch (err) {
        console.error('Error in store listener:', err);
      }
    });
  }

  public getSystemDate(): string {
    return this.getStore().systemDate || DEFAULT_DEMO_DATE;
  }

  public setSystemDate(newDate: string): void {
    const store = this.getStore();
    store.systemDate = newDate;
    this.saveStore(store);
  }

  public hasLegacyV2Data(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const v2Raw = localStorage.getItem('isysware_salon_store_v2');
      return !!v2Raw;
    } catch {
      return false;
    }
  }

  public restoreFromV2Backup(): StorageSchema {
    if (typeof window === 'undefined') {
      throw new Error('Storage recovery is only available in browser context.');
    }
    const v2Raw = localStorage.getItem('isysware_salon_store_v2');
    if (!v2Raw) {
      throw new Error('No legacy v2 storage backup was found.');
    }
    const parsedV2 = JSON.parse(v2Raw);
    const migrated = this.migrateV2ToV3(parsedV2);
    this.saveStore(migrated);
    return migrated;
  }

  private migrateV2ToV3(parsedV2: any): StorageSchema {
    const base = this.createDefaultStore();
    const migrated: StorageSchema = {
      ...base,
      ...parsedV2,
      version: STORAGE_VERSION,
      systemDate: parsedV2.systemDate || DEFAULT_DEMO_DATE,
    };

    // Ensure Phase 2B/3A collections are present
    if (!migrated.services || migrated.services.length === 0) migrated.services = [...INITIAL_SERVICES];
    if (!migrated.packages || migrated.packages.length === 0) migrated.packages = [...INITIAL_PACKAGES];
    if (!migrated.serviceCategories || migrated.serviceCategories.length === 0) migrated.serviceCategories = [...INITIAL_SERVICE_CATEGORIES];
    if (!migrated.taxRules || migrated.taxRules.length === 0) migrated.taxRules = [...INITIAL_TAX_RULES];

    // Consolidate legacy onlineAccounts and new paymentAccounts into one canonical paymentAccounts source
    if (!migrated.paymentAccounts || migrated.paymentAccounts.length === 0) {
      migrated.paymentAccounts = [...INITIAL_PAYMENT_ACCOUNTS];
    }

    if (parsedV2 && parsedV2.onlineAccounts && Array.isArray(parsedV2.onlineAccounts)) {
      parsedV2.onlineAccounts.forEach((oa: any) => {
        let accountType: 'BANK' | 'EASYPAISA' | 'JAZZCASH' | 'OTHER' = 'OTHER';
        const nameLower = (oa.accountName || oa.bankName || '').toLowerCase();
        if (oa.type === 'BANK_CHECKING' || nameLower.includes('bank') || nameLower.includes('checking')) {
          accountType = 'BANK';
        } else if (nameLower.includes('jazzcash')) {
          accountType = 'JAZZCASH';
        } else if (nameLower.includes('easypaisa')) {
          accountType = 'EASYPAISA';
        }

        const existingIdx = migrated.paymentAccounts.findIndex((a) => a.id === oa.id);
        const mappedAccount: PaymentAccount = {
          id: oa.id,
          branchId: oa.branchId,
          name: oa.accountName || oa.bankName || 'Legacy Account',
          accountType,
          providerName: oa.bankName || 'Financial Provider',
          accountHolder: oa.accountHolder || 'Salon Account',
          accountIdentifier: oa.accountNumberMasked || '····0000',
          currentBalance: oa.currentBalance ?? 0,
          isActive: oa.isActive ?? true,
          createdAt: oa.createdAt || '2026-01-01',
        };

        if (existingIdx >= 0) {
          migrated.paymentAccounts[existingIdx] = {
            ...mappedAccount,
            ...migrated.paymentAccounts[existingIdx],
            currentBalance: oa.currentBalance ?? migrated.paymentAccounts[existingIdx].currentBalance,
          };
        } else {
          migrated.paymentAccounts.push(mappedAccount);
        }
      });
    }

    if (!migrated.idempotencyRecords) migrated.idempotencyRecords = [];
    if (!migrated.invoiceSequenceCounters) migrated.invoiceSequenceCounters = {};
    if (migrated.staff && Array.isArray(migrated.staff)) {
      migrated.staff = migrated.staff.map(migrateStaffMember);
    }

    // Reconcile INV-LHE-2026-0041 if present in migrated invoices
    this.reconcileInvoices(migrated.invoices);

    if (!migrated.leaves) migrated.leaves = [];
    if (!migrated.branchHolidays) migrated.branchHolidays = [];
    if (!migrated.overtimeSequenceCounters) migrated.overtimeSequenceCounters = {};
    if (!migrated.leaveSequenceCounters) migrated.leaveSequenceCounters = {};
    if (!migrated.payrollRuns) migrated.payrollRuns = [];
    if (!migrated.payrollPayments) migrated.payrollPayments = [];
    if (!migrated.payrollPolicyConfigs || migrated.payrollPolicyConfigs.length === 0) {
      migrated.payrollPolicyConfigs = [
        {
          branchId: 'ALL',
          monthlyAbsenceDivisor: 26,
          customDivisorDays: 26,
          dailyStaffPaidLeaveEligibility: true,
          nonWorkedWeeklyOffPaid: false,
          nonWorkedHolidayPaid: true,
          prorationMethod: 'CALENDAR_DAYS',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          branchId: 'branch-1',
          monthlyAbsenceDivisor: 30,
          customDivisorDays: 30,
          dailyStaffPaidLeaveEligibility: true,
          nonWorkedWeeklyOffPaid: false,
          nonWorkedHolidayPaid: true,
          prorationMethod: 'CALENDAR_DAYS',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          branchId: 'branch-2',
          monthlyAbsenceDivisor: 26,
          customDivisorDays: 26,
          dailyStaffPaidLeaveEligibility: true,
          nonWorkedWeeklyOffPaid: false,
          nonWorkedHolidayPaid: true,
          prorationMethod: 'CALENDAR_DAYS',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];
    }
    if (!migrated.payrollSequenceCounters) migrated.payrollSequenceCounters = {};
    if (!migrated.payslipSequenceCounters) migrated.payslipSequenceCounters = {};
    if (!migrated.payrollPaymentSequenceCounters) migrated.payrollPaymentSequenceCounters = {};
    if (!migrated.commissionRuns) migrated.commissionRuns = [];
    if (!migrated.commissionPayments) migrated.commissionPayments = [];
    if (!migrated.commissionSequenceCounters) migrated.commissionSequenceCounters = {};
    if (!migrated.commissionStatementSequenceCounters) migrated.commissionStatementSequenceCounters = {};
    if (!migrated.commissionPaymentSequenceCounters) migrated.commissionPaymentSequenceCounters = {};

    return migrated;
  }

  private reconcileInvoices(invoices?: Invoice[]): void {
    if (!invoices) return;
    const inv0041 = invoices.find((inv) => inv.invoiceNumber === 'INV-LHE-2026-0041' || inv.id === 'inv-1001');
    if (inv0041 && inv0041.lineItems && inv0041.lineItems.length > 0) {
      const li = inv0041.lineItems[0];
      // Correct line total to match discounted net + tax: 2800 + 448 = 3248
      if (li.total === 3948.0) {
        li.total = 3248.0;
      }
    }
  }

  public getStore(): StorageSchema {
    if (this.inMemoryStore) {
      return this.inMemoryStore;
    }

    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_VERSION);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.version === STORAGE_VERSION && parsed.branches && parsed.users && parsed.staff) {
            // Ensure collections exist
            if (!parsed.services) parsed.services = [...INITIAL_SERVICES];
            if (!parsed.packages) parsed.packages = [...INITIAL_PACKAGES];
            if (!parsed.serviceCategories) parsed.serviceCategories = [...INITIAL_SERVICE_CATEGORIES];
            if (!parsed.taxRules) parsed.taxRules = [...INITIAL_TAX_RULES];
            if (!parsed.paymentAccounts) parsed.paymentAccounts = [...INITIAL_PAYMENT_ACCOUNTS];
            if (!parsed.clients) parsed.clients = [...INITIAL_CLIENTS];
            if (!parsed.expenseCategories) parsed.expenseCategories = [...INITIAL_EXPENSE_CATEGORIES];
            if (!parsed.cashTransfers) parsed.cashTransfers = [];
            if (!parsed.idempotencyRecords) parsed.idempotencyRecords = [];
            if (!parsed.invoiceSequenceCounters) parsed.invoiceSequenceCounters = {};
            if (!parsed.expenseSequenceCounters) parsed.expenseSequenceCounters = {};
            if (!parsed.settlementSequenceCounters) parsed.settlementSequenceCounters = {};
            if (!parsed.varianceAdjustmentSequenceCounters) parsed.varianceAdjustmentSequenceCounters = {};
            if (!parsed.cashVarianceAdjustments) parsed.cashVarianceAdjustments = [];
            if (!parsed.vaultBalances) parsed.vaultBalances = { 'branch-1': 150000, 'branch-2': 100000 };
            if (!parsed.systemDate) parsed.systemDate = DEFAULT_DEMO_DATE;
            if (!parsed.leaves) parsed.leaves = [];
            if (!parsed.branchHolidays) {
              parsed.branchHolidays = [
                { id: 'hol-1', branchId: 'ALL', date: '2026-12-25', title: 'Quaid-e-Azam Day / Christmas' },
                { id: 'hol-2', branchId: 'ALL', date: '2026-03-23', title: 'Pakistan Day' },
                { id: 'hol-3', branchId: 'ALL', date: '2026-08-14', title: 'Independence Day' },
              ];
            }
            if (!parsed.overtimeSequenceCounters) parsed.overtimeSequenceCounters = {};
            if (!parsed.leaveSequenceCounters) parsed.leaveSequenceCounters = {};
            if (parsed.attendance && Array.isArray(parsed.attendance)) {
              parsed.attendance = parsed.attendance.map((a: any) => ({
                ...a,
                source: a.source || 'MANUAL',
                status: a.status || 'PRESENT',
                scheduledHours: a.scheduledHours ?? 8.0,
                workedHours: a.workedHours ?? 0,
              }));
            }
            if (parsed.overtime && Array.isArray(parsed.overtime)) {
              parsed.overtime = parsed.overtime.map((ot: any) => ({
                ...ot,
                status: ot.status || 'APPROVED',
                minutes: ot.minutes ?? ot.approvedMinutes ?? 0,
                approvedMinutes: ot.approvedMinutes ?? ot.minutes ?? 0,
                hourlyRate: ot.hourlyRate ?? 500,
                amount: ot.amount ?? Math.round(((ot.approvedMinutes ?? ot.minutes ?? 0) / 60) * (ot.hourlyRate ?? 500)),
              }));
            }
            if (parsed.staff && Array.isArray(parsed.staff)) {
              parsed.staff = parsed.staff.map(migrateStaffMember);
            }
            if (parsed.expenses && Array.isArray(parsed.expenses)) {
              parsed.expenses = parsed.expenses.map(migrateExpense);
            }
            if (!parsed.payrollRuns) parsed.payrollRuns = [];
            if (!parsed.payrollPayments) parsed.payrollPayments = [];
            if (!parsed.payrollPolicyConfigs) {
              parsed.payrollPolicyConfigs = [
                {
                  branchId: 'ALL',
                  monthlyAbsenceDivisor: 26,
                  customDivisorDays: 26,
                  dailyStaffPaidLeaveEligibility: true,
                  nonWorkedWeeklyOffPaid: false,
                  nonWorkedHolidayPaid: true,
                  prorationMethod: 'CALENDAR_DAYS',
                  updatedAt: '2026-01-01T00:00:00Z',
                },
                {
                  branchId: 'branch-1',
                  monthlyAbsenceDivisor: 30,
                  customDivisorDays: 30,
                  dailyStaffPaidLeaveEligibility: true,
                  nonWorkedWeeklyOffPaid: false,
                  nonWorkedHolidayPaid: true,
                  prorationMethod: 'CALENDAR_DAYS',
                  updatedAt: '2026-01-01T00:00:00Z',
                },
                {
                  branchId: 'branch-2',
                  monthlyAbsenceDivisor: 26,
                  customDivisorDays: 26,
                  dailyStaffPaidLeaveEligibility: true,
                  nonWorkedWeeklyOffPaid: false,
                  nonWorkedHolidayPaid: true,
                  prorationMethod: 'CALENDAR_DAYS',
                  updatedAt: '2026-01-01T00:00:00Z',
                },
              ];
            }
            if (!parsed.payrollSequenceCounters) parsed.payrollSequenceCounters = {};
            if (!parsed.payslipSequenceCounters) parsed.payslipSequenceCounters = {};
            if (!parsed.payrollPaymentSequenceCounters) parsed.payrollPaymentSequenceCounters = {};
            if (!parsed.commissionRuns) parsed.commissionRuns = [];
            if (!parsed.commissionPayments) parsed.commissionPayments = [];
            if (!parsed.commissionSequenceCounters) parsed.commissionSequenceCounters = {};
            if (!parsed.commissionStatementSequenceCounters) parsed.commissionStatementSequenceCounters = {};
            if (!parsed.commissionPaymentSequenceCounters) parsed.commissionPaymentSequenceCounters = {};
            if (!parsed.tipReceipts || parsed.tipReceipts.length === 0) {
              parsed.tipReceipts = this.createDefaultTipReceipts();
            }
            if (!parsed.tipAllocations || parsed.tipAllocations.length === 0) {
              parsed.tipAllocations = this.createDefaultTipAllocations();
            }
            if (!parsed.tipPayouts || parsed.tipPayouts.length === 0) {
              parsed.tipPayouts = this.createDefaultTipPayouts();
            }
            if (!parsed.tipReceiptSequenceCounters) parsed.tipReceiptSequenceCounters = { 'LHE-2026': 3 };
            if (!parsed.tipAllocationSequenceCounters) parsed.tipAllocationSequenceCounters = { 'LHE-2026': 3 };
            if (!parsed.tipPayoutSequenceCounters) parsed.tipPayoutSequenceCounters = { 'LHE-2026': 1 };
            if (!parsed.inventoryItems || parsed.inventoryItems.length === 0) {
              parsed.inventoryItems = this.createDefaultInventoryItems();
            }
            if (!parsed.inventoryBatches || parsed.inventoryBatches.length === 0) {
              parsed.inventoryBatches = this.createDefaultBatches();
            }
            if (!parsed.suppliers || parsed.suppliers.length === 0) {
              parsed.suppliers = this.createDefaultSuppliers();
            }
            if (!parsed.supplierLedger || parsed.supplierLedger.length === 0) {
              parsed.supplierLedger = this.createDefaultSupplierLedger();
            }
            if (!parsed.purchases || parsed.purchases.length === 0) {
              parsed.purchases = this.createDefaultPurchases();
            }
            if (!parsed.supplierPayments) parsed.supplierPayments = [];
            if (!parsed.supplierReturns) parsed.supplierReturns = [];
            if (!parsed.stockMovements || parsed.stockMovements.length === 0) {
              parsed.stockMovements = this.createDefaultStockMovements();
            }
            if (!parsed.stockSettlements) parsed.stockSettlements = [];
            if (!parsed.purchaseSequenceCounters) parsed.purchaseSequenceCounters = { 'LHE-2026': 1, 'KHI-2026': 0 };
            if (!parsed.supplierSequenceCounters) parsed.supplierSequenceCounters = { 'SUP': 3 };
            if (!parsed.movementSequenceCounters) parsed.movementSequenceCounters = { 'LHE-2026': 10, 'KHI-2026': 0 };
            if (!parsed.supplierPaymentSequenceCounters) parsed.supplierPaymentSequenceCounters = { 'LHE-2026': 0 };
            if (!parsed.supplierReturnSequenceCounters) parsed.supplierReturnSequenceCounters = { 'LHE-2026': 0 };
            if (!parsed.settlementRecordSequenceCounters) parsed.settlementRecordSequenceCounters = { 'LHE-2026': 0 };
            this.reconcileInvoices(parsed.invoices);
            this.inMemoryStore = parsed;
            return parsed;
          }
        }

        // v3 does not exist yet: check for legacy v2 to migrate non-destructively
        const v2Raw = localStorage.getItem('isysware_salon_store_v2');
        if (v2Raw) {
          const parsedV2 = JSON.parse(v2Raw);
          if (parsedV2 && parsedV2.branches && parsedV2.users) {
            const migrated = this.migrateV2ToV3(parsedV2);
            this.saveStore(migrated);
            return migrated;
          }
        }
      } catch (err) {
        console.warn('Failed to parse localStorage store:', err);
      }
    }

    const defaultStore = this.createDefaultStore();
    this.saveStore(defaultStore);
    return defaultStore;
  }

  public saveStore(store: StorageSchema): void {
    this.inMemoryStore = store;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_VERSION, JSON.stringify(store));
        window.dispatchEvent(new CustomEvent('isysware_store_updated', { detail: store }));
      } catch (err) {
        console.error('Failed to save store to localStorage:', err);
      }
    }
    this.notifyListeners(store);
  }

  public reloadFromStorage(): StorageSchema {
    this.inMemoryStore = null;
    return this.getStore();
  }

  private createDefaultStore(): StorageSchema {
    return {
      version: STORAGE_VERSION,
      systemDate: DEFAULT_DEMO_DATE,
      branches: [...INITIAL_BRANCHES],
      users: [...INITIAL_USERS],
      staff: [...INITIAL_STAFF],
      clients: [...INITIAL_CLIENTS],
      expenseCategories: [...INITIAL_EXPENSE_CATEGORIES],
      cashTransfers: [],
      taxRules: [...INITIAL_TAX_RULES],
      serviceCategories: [...INITIAL_SERVICE_CATEGORIES],
      services: [...INITIAL_SERVICES],
      packages: [...INITIAL_PACKAGES],
      paymentAccounts: [...INITIAL_PAYMENT_ACCOUNTS],
      idempotencyRecords: [],
      invoiceSequenceCounters: {},
      expenseSequenceCounters: {},
      settlementSequenceCounters: {},
      varianceAdjustmentSequenceCounters: {},
      cashVarianceAdjustments: [],
      vaultBalances: { 'branch-1': 150000, 'branch-2': 100000 },
      leaves: [],
      branchHolidays: [
        { id: 'hol-1', branchId: 'ALL', date: '2026-12-25', title: 'Quaid-e-Azam Day / Christmas' },
        { id: 'hol-2', branchId: 'ALL', date: '2026-03-23', title: 'Pakistan Day' },
        { id: 'hol-3', branchId: 'ALL', date: '2026-08-14', title: 'Independence Day' },
      ],
      overtimeSequenceCounters: {},
      leaveSequenceCounters: {},
      onlineAccounts: [
        {
          id: 'acc-1',
          branchId: 'branch-1',
          accountName: 'Corporate Checking Account',
          bankName: 'Meezan Bank Ltd',
          type: 'BANK_CHECKING',
          accountNumberMasked: '····4821',
          currentBalance: 1845000.0,
          lastSyncTime: '10 mins ago',
        },
        {
          id: 'acc-2',
          branchId: 'branch-1',
          accountName: 'Salon Card Terminal POS',
          bankName: 'HBL Smart POS',
          type: 'TERMINAL_POS',
          accountNumberMasked: '····8832',
          currentBalance: 425000.0,
          lastSyncTime: '5 mins ago',
        },
        {
          id: 'acc-3',
          branchId: 'branch-1',
          accountName: 'Digital Merchant Till',
          bankName: 'JazzCash Business',
          type: 'DIGITAL_WALLET',
          accountNumberMasked: '····1049',
          currentBalance: 148500.0,
          lastSyncTime: 'Just now',
        },
        {
          id: 'acc-4',
          branchId: 'branch-2',
          accountName: 'Premier Commercial Checking',
          bankName: 'Bank Alfalah Ltd',
          type: 'BANK_CHECKING',
          accountNumberMasked: '····9102',
          currentBalance: 2340000.0,
          lastSyncTime: '15 mins ago',
        },
        {
          id: 'acc-5',
          branchId: 'branch-2',
          accountName: 'Clifton Counter POS',
          bankName: 'HBL Smart POS',
          type: 'TERMINAL_POS',
          accountNumberMasked: '····4419',
          currentBalance: 560000.0,
          lastSyncTime: '8 mins ago',
        },
        {
          id: 'acc-6',
          branchId: 'branch-2',
          accountName: 'Digital Contactless Wallet',
          bankName: 'Easypaisa Retail',
          type: 'DIGITAL_WALLET',
          accountNumberMasked: '····7741',
          currentBalance: 195000.0,
          lastSyncTime: '2 mins ago',
        },
      ],
      appointments: [
        {
          id: 'apt-1',
          branchId: 'branch-1',
          clientName: 'Mahnoor Tariq',
          clientPhone: '+92 (300) 123-4567',
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          serviceId: 'srv-lhe-03',
          serviceName: 'Signature Balayage & Gloss',
          date: '2026-09-28',
          time: '09:30 AM',
          durationMinutes: 120,
          price: 18500.0,
          status: 'IN_PROGRESS',
        },
        {
          id: 'apt-2',
          branchId: 'branch-1',
          clientName: 'Zainab Asif',
          clientPhone: '+92 (300) 234-5678',
          staffId: 'staff-3',
          staffName: 'Ayesha Khan',
          serviceId: 'srv-lhe-05',
          serviceName: 'Russian Gel Manicure',
          date: '2026-09-28',
          time: '10:00 AM',
          durationMinutes: 60,
          price: 5000.0,
          status: 'COMPLETED',
        },
        {
          id: 'apt-3',
          branchId: 'branch-1',
          clientName: 'Omer Farooq',
          clientPhone: '+92 (300) 345-6789',
          staffId: 'staff-2',
          staffName: 'Hamza Malik',
          serviceId: 'srv-lhe-02',
          serviceName: 'Executive Grooming Package',
          date: '2026-09-28',
          time: '11:00 AM',
          durationMinutes: 40,
          price: 4000.0,
          status: 'SCHEDULED',
        },
        {
          id: 'apt-4',
          branchId: 'branch-2',
          clientName: 'Nida Kazmi',
          clientPhone: '+92 (321) 111-2233',
          staffId: 'staff-4',
          staffName: 'Sana Mir',
          serviceId: 'srv-khi-02',
          serviceName: 'Deep Tissue Aromatherapy',
          date: '2026-09-28',
          time: '11:00 AM',
          durationMinutes: 60,
          price: 9500.0,
          status: 'COMPLETED',
        },
      ],
      invoices: [
        {
          id: 'inv-1001',
          invoiceNumber: 'INV-LHE-2026-0041',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '10:45 AM',
          clientName: 'Zehra Bokhari',
          clientPhone: '+92 (301) 456-8899',
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          lineItems: [
            {
              id: 'li-1',
              name: 'Signature Blowout & Treatment',
              type: 'SERVICE',
              staffId: 'staff-1',
              staffName: 'Zara Alvi',
              quantity: 1,
              unitPrice: 3500.0,
              tax: 448.0,
              total: 3248.0,
            },
          ],
          subtotal: 3500.0,
          discount: 700.0,
          netSales: 2800.0,
          tax: 448.0, // 16% on netSales 2800
          tip: 500.0, // Segregated gratuity
          total: 3748.0, // 2800 + 448 + 500
          paymentMethod: 'CASH',
          status: 'PAID',
          amountPaid: 3748.0,
          amountDue: 0.0,
          payments: [
            {
              id: 'pay-01',
              invoiceId: 'inv-1001',
              branchId: 'branch-1',
              date: '2026-09-28',
              time: '10:45 AM',
              amount: 3748.0,
              billAmountAllocated: 3248.0,
              tipAmountAllocated: 500.0,
              method: 'CASH',
              processedByUserId: 'usr-acc-01',
              processedByName: 'Usman Farooq',
            },
          ],
          processedByUserId: 'usr-acc-01',
          processedByName: 'Usman Farooq',
        },
        {
          id: 'inv-1002',
          invoiceNumber: 'INV-LHE-2026-0042',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '11:15 AM',
          clientName: 'Shahid Mehmood',
          clientPhone: '+92 (300) 887-1122',
          staffId: 'staff-2',
          staffName: 'Hamza Malik',
          lineItems: [
            {
              id: 'li-2',
              name: 'Executive Grooming Package',
              type: 'SERVICE',
              staffId: 'staff-2',
              staffName: 'Hamza Malik',
              quantity: 1,
              unitPrice: 7000.0,
              tax: 1120.0,
              total: 8120.0,
            },
          ],
          subtotal: 7000.0,
          discount: 0.0,
          netSales: 7000.0,
          tax: 1120.0,
          tip: 1000.0,
          total: 9120.0,
          paymentMethod: 'CASH',
          status: 'PAID',
          amountPaid: 9120.0, // Reconciled: Full payment covering bill and tip
          amountDue: 0.0, // Zero outstanding balance on PAID invoice
          payments: [
            {
              id: 'pay-02',
              invoiceId: 'inv-1002',
              branchId: 'branch-1',
              date: '2026-09-28',
              time: '11:15 AM',
              amount: 9120.0,
              billAmountAllocated: 8120.0,
              tipAmountAllocated: 1000.0,
              method: 'CASH',
              processedByUserId: 'usr-acc-01',
              processedByName: 'Usman Farooq',
            },
          ],
          processedByUserId: 'usr-acc-01',
          processedByName: 'Usman Farooq',
        },
        {
          id: 'inv-1003',
          invoiceNumber: 'INV-LHE-2026-0043',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '12:00 PM',
          clientName: 'Sara Jahangir',
          clientPhone: '+92 (333) 998-3344',
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          lineItems: [
            {
              id: 'li-3',
              name: 'Keratin Smoothing Therapy',
              type: 'SERVICE',
              staffId: 'staff-1',
              staffName: 'Zara Alvi',
              quantity: 1,
              unitPrice: 22000.0,
              tax: 3200.0,
              total: 25200.0,
            },
          ],
          subtotal: 22000.0,
          discount: 2000.0,
          netSales: 20000.0,
          tax: 3200.0, // 16% on netSales 20000
          tip: 2000.0,
          total: 25200.0,
          paymentMethod: 'ONLINE_ACCOUNT',
          paymentAccountId: 'acc-2',
          paymentAccountName: 'HBL Smart POS (····8832)',
          status: 'PAID',
          amountPaid: 25200.0,
          amountDue: 0.0,
          payments: [
            {
              id: 'pay-03',
              invoiceId: 'inv-1003',
              branchId: 'branch-1',
              date: '2026-09-28',
              time: '12:00 PM',
              amount: 25200.0,
              billAmountAllocated: 23200.0,
              tipAmountAllocated: 2000.0,
              method: 'ONLINE_ACCOUNT',
              paymentAccountId: 'acc-2',
              paymentAccountName: 'HBL Smart POS (····8832)',
              processedByUserId: 'usr-acc-01',
              processedByName: 'Usman Farooq',
            },
          ],
          processedByUserId: 'usr-acc-01',
          processedByName: 'Usman Farooq',
        },
        {
          id: 'inv-1004',
          invoiceNumber: 'INV-LHE-2026-0044',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '01:05 PM',
          clientName: 'Begum Asif (Bridal Booking)',
          clientPhone: '+92 (300) 301-9988',
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          lineItems: [
            {
              id: 'li-4',
              name: 'Bridal Glamour & Hair Transformation',
              type: 'PACKAGE',
              staffId: 'staff-1',
              staffName: 'Zara Alvi',
              quantity: 1,
              unitPrice: 50000.0,
              tax: 7680.0,
              total: 55680.0,
            },
          ],
          subtotal: 50000.0,
          discount: 2000.0,
          netSales: 48000.0,
          tax: 7680.0,
          tip: 0.0,
          total: 55680.0,
          paymentMethod: 'ONLINE_ACCOUNT',
          status: 'PARTIAL',
          amountPaid: 20000.0,
          amountDue: 35680.0, // Remaining balance
          payments: [
            {
              id: 'pay-04',
              invoiceId: 'inv-1004',
              branchId: 'branch-1',
              date: '2026-09-28',
              time: '01:05 PM',
              amount: 20000.0,
              billAmountAllocated: 20000.0,
              tipAmountAllocated: 0.0,
              method: 'ONLINE_ACCOUNT',
              paymentAccountId: 'acc-1',
              paymentAccountName: 'Meezan Bank (····4821)',
              processedByUserId: 'usr-admin-01',
              processedByName: 'Aamina Sheikh',
            },
          ],
          processedByUserId: 'usr-admin-01',
          processedByName: 'Aamina Sheikh',
        },
      ],
      expenses: [
        {
          id: 'exp-01',
          voucherNumber: 'EXP-LHE-2026-012',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '10:15 AM',
          title: 'Sanitary Towels & Disinfectant Restock',
          category: 'SUPPLIES',
          amount: 4500.0,
          paymentSource: 'CASH_DRAWER',
          paidByUserId: 'usr-acc-01',
          paidByName: 'Usman Farooq',
          approvedByUserId: 'usr-admin-01',
          status: 'PAID',
          notes: 'Emergency morning replenishment from local supplier.',
        },
        {
          id: 'exp-02',
          voucherNumber: 'EXP-LHE-2026-013',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '11:00 AM',
          title: 'Gourmet Herbal Teas & Client Refreshments',
          category: 'REFRESHMENTS',
          amount: 3200.0,
          paymentSource: 'CASH_DRAWER',
          paidByUserId: 'usr-acc-01',
          paidByName: 'Usman Farooq',
          approvedByUserId: 'usr-admin-01',
          status: 'PAID',
        },
        {
          id: 'exp-03',
          voucherNumber: 'EXP-LHE-2026-014',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '12:30 PM',
          title: 'Salon Dryer Motor & Coil Repair',
          category: 'MAINTENANCE',
          amount: 11000.0,
          paymentSource: 'ONLINE_ACCOUNT',
          paymentAccountId: 'acc-1',
          paymentAccountName: 'Meezan Bank (····4821)',
          paidByUserId: 'usr-admin-01',
          paidByName: 'Aamina Sheikh',
          status: 'PAID',
        },
      ],
      cashDrawers: [
        {
          id: 'drawer-lhe-01',
          branchId: 'branch-1',
          date: '2026-09-28',
          openingCash: 25000.0,
          cashSales: 11368.0,
          cashTipsCollected: 1500.0,
          cashExpensesPaid: 7700.0,
          expectedInDrawer: 30168.0,
          actualInDrawer: 30168.0,
          variance: 0.0,
          custodianUserId: 'usr-acc-01',
          custodianName: 'Usman Farooq',
          status: 'OPEN',
        },
        {
          id: 'drawer-khi-01',
          branchId: 'branch-2',
          date: '2026-09-28',
          openingCash: 30000.0,
          cashSales: 0.0,
          cashTipsCollected: 0.0,
          cashExpensesPaid: 0.0,
          expectedInDrawer: 30000.0,
          actualInDrawer: 30000.0,
          variance: 0.0,
          custodianUserId: 'usr-admin-02',
          custodianName: 'Kamran Akram',
          status: 'OPEN',
        },
      ],
      settlements: [
        {
          id: 'set-001',
          settlementNumber: 'SET-LHE-2026-0019',
          branchId: 'branch-1',
          date: '2026-09-27',
          time: '07:30 PM',
          amount: 48000.0,
          submittedByUserId: 'usr-acc-01',
          submittedByName: 'Usman Farooq',
          submittedByRole: 'ACCOUNTANT',
          receivedByUserId: 'usr-admin-01',
          receivedByName: 'Aamina Sheikh',
          status: 'APPROVED_TRANSFERRED',
          notes: 'End of evening shift cash transfer to main safe. Verified without variance.',
        },
        {
          id: 'set-002',
          settlementNumber: 'SET-LHE-2026-0020',
          branchId: 'branch-1',
          date: '2026-09-28',
          time: '01:30 PM',
          amount: 9168.0,
          submittedByUserId: 'usr-acc-01',
          submittedByName: 'Usman Farooq',
          submittedByRole: 'ACCOUNTANT',
          status: 'PENDING_VERIFICATION',
          notes: 'Mid-day excess cash custody handoff from cashier drawer to Branch Admin.',
        },
      ],
      attendance: [
        {
          id: 'att-1',
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          branchId: 'branch-1',
          date: '2026-09-28',
          checkIn: '08:52 AM',
          scheduledHours: 8.0,
          workedHours: 4.8,
          status: 'ON_TIME',
        },
        {
          id: 'att-2',
          staffId: 'staff-2',
          staffName: 'Hamza Malik',
          branchId: 'branch-1',
          date: '2026-09-28',
          checkIn: '09:05 AM',
          scheduledHours: 8.0,
          workedHours: 4.5,
          status: 'ON_TIME',
        },
        {
          id: 'att-3',
          staffId: 'staff-3',
          staffName: 'Ayesha Khan',
          branchId: 'branch-1',
          date: '2026-09-28',
          checkIn: '10:15 AM',
          scheduledHours: 7.0,
          workedHours: 3.4,
          status: 'ON_TIME',
        },
      ],
      overtime: [
        {
          id: 'ot-1',
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          branchId: 'branch-1',
          date: '2026-09-26',
          approvedMinutes: 90,
          approvedByUserId: 'usr-admin-01',
          approvedByName: 'Aamina Sheikh',
          reason: 'Extended bridal styling session requested by client',
          rateMultiplier: 1.0,
        },
        {
          id: 'ot-2',
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          branchId: 'branch-1',
          date: '2026-09-27',
          approvedMinutes: 60,
          approvedByUserId: 'usr-admin-01',
          approvedByName: 'Aamina Sheikh',
          reason: 'Weekend evening rush coverage',
          rateMultiplier: 1.0,
        },
      ],
      payrollRuns: [],
      payrollPayments: [],
      payrollPolicyConfigs: [
        {
          branchId: 'ALL',
          monthlyAbsenceDivisor: 26,
          customDivisorDays: 26,
          dailyStaffPaidLeaveEligibility: true,
          nonWorkedWeeklyOffPaid: false,
          nonWorkedHolidayPaid: true,
          prorationMethod: 'CALENDAR_DAYS',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          branchId: 'branch-1',
          monthlyAbsenceDivisor: 30,
          customDivisorDays: 30,
          dailyStaffPaidLeaveEligibility: true,
          nonWorkedWeeklyOffPaid: false,
          nonWorkedHolidayPaid: true,
          prorationMethod: 'CALENDAR_DAYS',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          branchId: 'branch-2',
          monthlyAbsenceDivisor: 26,
          customDivisorDays: 26,
          dailyStaffPaidLeaveEligibility: true,
          nonWorkedWeeklyOffPaid: false,
          nonWorkedHolidayPaid: true,
          prorationMethod: 'CALENDAR_DAYS',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      payrollSequenceCounters: {},
      payslipSequenceCounters: {},
      payrollPaymentSequenceCounters: {},
      commissionRuns: [],
      commissionPayments: [],
      commissionSequenceCounters: {},
      commissionStatementSequenceCounters: {},
      commissionPaymentSequenceCounters: {},
      tipReceipts: this.createDefaultTipReceipts(),
      tipAllocations: this.createDefaultTipAllocations(),
      tipPayouts: this.createDefaultTipPayouts(),
      tipReceiptSequenceCounters: { 'LHE-2026': 3 },
      tipAllocationSequenceCounters: { 'LHE-2026': 3 },
      tipPayoutSequenceCounters: { 'LHE-2026': 1 },
      inventoryItems: this.createDefaultInventoryItems(),
      inventoryBatches: this.createDefaultBatches(),
      suppliers: this.createDefaultSuppliers(),
      supplierLedger: this.createDefaultSupplierLedger(),
      purchases: this.createDefaultPurchases(),
      supplierPayments: [],
      supplierReturns: [],
      stockMovements: this.createDefaultStockMovements(),
      stockSettlements: [],
      purchaseSequenceCounters: { 'LHE-2026': 1, 'KHI-2026': 0 },
      supplierSequenceCounters: { 'SUP': 3 },
      movementSequenceCounters: { 'LHE-2026': 10, 'KHI-2026': 0 },
      supplierPaymentSequenceCounters: { 'LHE-2026': 0 },
      supplierReturnSequenceCounters: { 'LHE-2026': 0 },
      settlementRecordSequenceCounters: { 'LHE-2026': 0 },
    };
  }

  private createDefaultTipReceipts(): TipReceiptRecord[] {
    return [
      {
        id: 'tip-rec-pay-01',
        receiptNumber: 'TR-LHE-2026-0001',
        branchId: 'branch-1',
        branchName: 'DHA Phase 5 Flagship',
        invoiceId: 'inv-1001',
        invoiceNumber: 'INV-LHE-2026-0041',
        paymentId: 'pay-01',
        collectionDate: '2026-09-28',
        collectionTime: '10:45 AM',
        clientName: 'Zehra Bokhari',
        method: 'CASH',
        cashDrawerId: 'drawer-lhe-01',
        collectedByUserId: 'usr-acc-01',
        collectedByName: 'Usman Farooq',
        collectedAmount: 500,
        directStaffId: 'staff-1',
        directStaffName: 'Zara Alvi',
        allocatedAmount: 500,
        unallocatedAmount: 0,
        status: 'FULLY_ALLOCATED',
        createdAt: '2026-09-28T10:45:00',
      },
      {
        id: 'tip-rec-pay-02',
        receiptNumber: 'TR-LHE-2026-0002',
        branchId: 'branch-1',
        branchName: 'DHA Phase 5 Flagship',
        invoiceId: 'inv-1002',
        invoiceNumber: 'INV-LHE-2026-0042',
        paymentId: 'pay-02',
        collectionDate: '2026-09-28',
        collectionTime: '11:15 AM',
        clientName: 'Shahid Mehmood',
        method: 'CASH',
        cashDrawerId: 'drawer-lhe-01',
        collectedByUserId: 'usr-acc-01',
        collectedByName: 'Usman Farooq',
        collectedAmount: 1000,
        directStaffId: 'staff-2',
        directStaffName: 'Hamza Malik',
        allocatedAmount: 1000,
        unallocatedAmount: 0,
        status: 'FULLY_ALLOCATED',
        createdAt: '2026-09-28T11:15:00',
      },
      {
        id: 'tip-rec-pay-03',
        receiptNumber: 'TR-LHE-2026-0003',
        branchId: 'branch-1',
        branchName: 'DHA Phase 5 Flagship',
        invoiceId: 'inv-1003',
        invoiceNumber: 'INV-LHE-2026-0043',
        paymentId: 'pay-03',
        collectionDate: '2026-09-28',
        collectionTime: '12:00 PM',
        clientName: 'Sara Jahangir',
        method: 'ONLINE_ACCOUNT',
        paymentAccountId: 'acc-2',
        paymentAccountName: 'HBL Smart POS (····8832)',
        collectedByUserId: 'usr-acc-01',
        collectedByName: 'Usman Farooq',
        collectedAmount: 2000,
        directStaffId: 'staff-1',
        directStaffName: 'Zara Alvi',
        allocatedAmount: 0,
        unallocatedAmount: 2000,
        status: 'UNALLOCATED',
        createdAt: '2026-09-28T12:00:00',
      },
    ];
  }

  private createDefaultTipAllocations(): TipAllocationRecord[] {
    return [
      {
        id: 'tip-alloc-01',
        allocationNumber: 'TA-LHE-2026-0001',
        branchId: 'branch-1',
        tipReceiptId: 'tip-rec-pay-01',
        tipReceiptNumber: 'TR-LHE-2026-0001',
        invoiceId: 'inv-1001',
        invoiceNumber: 'INV-LHE-2026-0041',
        paymentId: 'pay-01',
        staffId: 'staff-1',
        staffName: 'Zara Alvi',
        staffRole: 'Senior Stylist',
        amount: 500,
        paidAmount: 0,
        outstandingAmount: 500,
        allocationType: 'DIRECT',
        allocationDate: '2026-09-28',
        allocationTime: '11:00 AM',
        allocatedByUserId: 'usr-admin-01',
        allocatedByName: 'Aamina Sheikh',
        status: 'UNPAID',
      },
      {
        id: 'tip-alloc-02',
        allocationNumber: 'TA-LHE-2026-0002',
        branchId: 'branch-1',
        tipReceiptId: 'tip-rec-pay-02',
        tipReceiptNumber: 'TR-LHE-2026-0002',
        invoiceId: 'inv-1002',
        invoiceNumber: 'INV-LHE-2026-0042',
        paymentId: 'pay-02',
        staffId: 'staff-2',
        staffName: 'Hamza Malik',
        staffRole: 'Barber & Stylist',
        amount: 500,
        paidAmount: 500,
        outstandingAmount: 0,
        allocationType: 'POOLED_EQUAL',
        allocationDate: '2026-09-28',
        allocationTime: '11:30 AM',
        allocatedByUserId: 'usr-admin-01',
        allocatedByName: 'Aamina Sheikh',
        status: 'PAID',
      },
      {
        id: 'tip-alloc-03',
        allocationNumber: 'TA-LHE-2026-0003',
        branchId: 'branch-1',
        tipReceiptId: 'tip-rec-pay-02',
        tipReceiptNumber: 'TR-LHE-2026-0002',
        invoiceId: 'inv-1002',
        invoiceNumber: 'INV-LHE-2026-0042',
        paymentId: 'pay-02',
        staffId: 'staff-3',
        staffName: 'Bilal Tariq',
        staffRole: 'Nail & Spa Technician',
        amount: 500,
        paidAmount: 0,
        outstandingAmount: 500,
        allocationType: 'POOLED_EQUAL',
        allocationDate: '2026-09-28',
        allocationTime: '11:30 AM',
        allocatedByUserId: 'usr-admin-01',
        allocatedByName: 'Aamina Sheikh',
        status: 'UNPAID',
      },
    ];
  }

  private createDefaultTipPayouts(): TipPayoutRecord[] {
    return [
      {
        id: 'tip-pay-01',
        payoutNumber: 'TP-LHE-2026-0001',
        branchId: 'branch-1',
        staffId: 'staff-2',
        staffName: 'Hamza Malik',
        allocationId: 'tip-alloc-02',
        allocationNumber: 'TA-LHE-2026-0002',
        tipReceiptId: 'tip-rec-pay-02',
        amount: 500,
        method: 'CASH',
        cashDrawerId: 'drawer-lhe-01',
        collectionMethod: 'CASH',
        payoutDate: '2026-09-28',
        payoutTime: '01:00 PM',
        paidByUserId: 'usr-admin-01',
        paidByName: 'Aamina Sheikh',
        status: 'COMPLETED',
        notes: 'Shift tip disbursement',
      },
    ];
  }

  private createDefaultSuppliers(): Supplier[] {
    return [
      {
        id: 'sup-1',
        supplierCode: 'SUP-001',
        name: "L'Oréal Professional Pakistan",
        phone: '+92 (21) 3529-8800',
        email: 'orders@loreal-pakistan.com',
        contactPerson: 'Salman Qureshi',
        address: 'Clifton Block 4, Karachi',
        taxNumber: 'NTN-7392014-9',
        notes: "Official direct distributor for L'Oréal & Kérastase",
        branchId: 'ALL',
        isActive: true,
        openingPayable: 0,
        currentPayable: 45000,
        totalPurchases: 45000,
        totalPayments: 0,
        totalReturns: 0,
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'sup-2',
        supplierCode: 'SUP-002',
        name: 'Schwarzkopf Professional PK',
        phone: '+92 (42) 3571-4411',
        email: 'supply@schwarzkopf.com.pk',
        contactPerson: 'Naveed Butt',
        address: 'Gulberg III, Lahore',
        taxNumber: 'NTN-8402155-3',
        notes: 'Supplier of Igora Royal & Bonacure lines',
        branchId: 'branch-1',
        isActive: true,
        openingPayable: 0,
        currentPayable: 0,
        totalPurchases: 0,
        totalPayments: 0,
        totalReturns: 0,
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'sup-3',
        supplierCode: 'SUP-003',
        name: 'Salon Essentials Distribution',
        phone: '+92 (42) 3668-9900',
        email: 'support@salonessentials.pk',
        contactPerson: 'Imran Siddiqui',
        address: 'DHA Phase 5, Lahore',
        taxNumber: 'NTN-9124032-1',
        notes: 'Disposables, gloves, foils, and salon consumables',
        branchId: 'branch-1',
        isActive: true,
        openingPayable: 0,
        currentPayable: 18500,
        totalPurchases: 18500,
        totalPayments: 0,
        totalReturns: 0,
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-05T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
    ];
  }

  private createDefaultInventoryItems(): InventoryItem[] {
    return [
      {
        id: 'item-1',
        sku: 'PROD-LHE-001',
        code: 'PROD-LHE-001',
        barcode: '896400010011',
        name: 'Moroccanoil Treatment Original (100ml)',
        category: 'Hair Care',
        brand: 'Moroccanoil',
        itemType: 'RETAIL_PRODUCT',
        defaultPurchaseCost: 5500,
        sellingPrice: 7800,
        price: 7800,
        purchaseUnit: 'BOTTLE',
        issueUnit: 'BOTTLE',
        taxTreatment: 'BRANCH_DEFAULT',
        minStockLevel: 5,
        trackBatch: true,
        trackExpiry: true,
        nearExpiryAlertDays: 60,
        isActive: true,
        branchAvailability: ['branch-1', 'branch-2'],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'item-2',
        sku: 'PROD-LHE-002',
        code: 'PROD-LHE-002',
        barcode: '896400010028',
        name: 'Olaplex No. 3 Hair Perfector (100ml)',
        category: 'Hair Repair',
        brand: 'Olaplex',
        itemType: 'RETAIL_PRODUCT',
        defaultPurchaseCost: 6200,
        sellingPrice: 8900,
        price: 8900,
        purchaseUnit: 'BOTTLE',
        issueUnit: 'BOTTLE',
        taxTreatment: 'BRANCH_DEFAULT',
        minStockLevel: 4,
        trackBatch: true,
        trackExpiry: true,
        nearExpiryAlertDays: 60,
        isActive: true,
        branchAvailability: ['branch-1', 'branch-2'],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'item-3',
        sku: 'PROD-LHE-003',
        code: 'PROD-LHE-003',
        barcode: '896400010035',
        name: 'Kérastase Elixir Ultime Hair Oil (100ml)',
        category: 'Luxury Care',
        brand: 'Kérastase',
        itemType: 'RETAIL_PRODUCT',
        defaultPurchaseCost: 7500,
        sellingPrice: 11500,
        price: 11500,
        purchaseUnit: 'BOTTLE',
        issueUnit: 'BOTTLE',
        taxTreatment: 'BRANCH_DEFAULT',
        minStockLevel: 3,
        trackBatch: true,
        trackExpiry: true,
        nearExpiryAlertDays: 60,
        isActive: true,
        branchAvailability: ['branch-1'],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'item-4',
        sku: 'CONS-LHE-001',
        code: 'CONS-LHE-001',
        barcode: '896400020010',
        name: 'Majirel Hair Color Cream 5.0 Light Brown (50ml)',
        category: 'Colorants',
        brand: "L'Oréal",
        itemType: 'SALON_CONSUMABLE',
        defaultPurchaseCost: 1400,
        sellingPrice: 0,
        price: 0,
        purchaseUnit: 'TUBE',
        issueUnit: 'TUBE',
        taxTreatment: 'EXEMPT',
        minStockLevel: 10,
        trackBatch: true,
        trackExpiry: true,
        nearExpiryAlertDays: 90,
        isActive: true,
        branchAvailability: ['branch-1', 'branch-2'],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'item-5',
        sku: 'CONS-LHE-002',
        code: 'CONS-LHE-002',
        barcode: '896400020027',
        name: 'Oxydant Creme 20 Vol 6% Developer (1000ml)',
        category: 'Colorants',
        brand: "L'Oréal",
        itemType: 'SALON_CONSUMABLE',
        defaultPurchaseCost: 2200,
        sellingPrice: 0,
        price: 0,
        purchaseUnit: 'BOTTLE',
        issueUnit: 'ML',
        unitConversionRatio: 1000,
        taxTreatment: 'EXEMPT',
        minStockLevel: 3,
        trackBatch: true,
        trackExpiry: true,
        nearExpiryAlertDays: 90,
        isActive: true,
        branchAvailability: ['branch-1', 'branch-2'],
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'item-6',
        sku: 'CONS-LHE-003',
        code: 'CONS-LHE-003',
        barcode: '896400030019',
        name: 'Nitrile Powder-Free Salon Gloves (Box of 100)',
        category: 'Salon Disposables',
        brand: 'ProGuard',
        itemType: 'SALON_CONSUMABLE',
        defaultPurchaseCost: 1800,
        sellingPrice: 0,
        price: 0,
        purchaseUnit: 'BOX',
        issueUnit: 'PAIR',
        unitConversionRatio: 50,
        taxTreatment: 'BRANCH_DEFAULT',
        minStockLevel: 2,
        trackBatch: false,
        trackExpiry: false,
        nearExpiryAlertDays: 0,
        isActive: true,
        branchAvailability: ['branch-1', 'branch-2'],
        createdAt: '2026-09-05T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'item-7',
        sku: 'PROD-LHE-004',
        code: 'PROD-LHE-004',
        barcode: '896400010042',
        name: 'Davines OI All In One Milk (135ml)',
        category: 'Styling',
        brand: 'Davines',
        itemType: 'BOTH',
        defaultPurchaseCost: 4800,
        sellingPrice: 6900,
        price: 6900,
        purchaseUnit: 'BOTTLE',
        issueUnit: 'BOTTLE',
        taxTreatment: 'BRANCH_DEFAULT',
        minStockLevel: 4,
        trackBatch: true,
        trackExpiry: true,
        nearExpiryAlertDays: 60,
        isActive: true,
        branchAvailability: ['branch-1'],
        createdAt: '2026-09-08T00:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
    ];
  }

  private createDefaultBatches(): InventoryBatch[] {
    return [
      {
        id: 'batch-1',
        itemId: 'item-1',
        itemName: 'Moroccanoil Treatment Original (100ml)',
        itemSku: 'PROD-LHE-001',
        branchId: 'branch-1',
        batchNumber: 'B-MO-2601',
        purchaseId: 'po-1001',
        purchaseNumber: 'PO-LHE-2026-0001',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2026-09-15',
        expiryDate: '2027-06-30',
        initialQuantity: 12,
        remainingQuantity: 12,
        unitCostSnapshot: 5500,
        status: 'VALID',
        createdAt: '2026-09-15T11:00:00Z',
        updatedAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'batch-2',
        itemId: 'item-2',
        itemName: 'Olaplex No. 3 Hair Perfector (100ml)',
        itemSku: 'PROD-LHE-002',
        branchId: 'branch-1',
        batchNumber: 'B-OL-2502',
        purchaseId: 'po-1001',
        purchaseNumber: 'PO-LHE-2026-0001',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2026-08-01',
        expiryDate: '2026-10-25', // Near expiry as of 2026-09-28 (<60 days)
        initialQuantity: 8,
        remainingQuantity: 8,
        unitCostSnapshot: 6200,
        status: 'NEAR_EXPIRY',
        createdAt: '2026-08-01T11:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'batch-3',
        itemId: 'item-2',
        itemName: 'Olaplex No. 3 Hair Perfector (100ml)',
        itemSku: 'PROD-LHE-002',
        branchId: 'branch-1',
        batchNumber: 'B-OL-2601',
        purchaseId: 'po-1001',
        purchaseNumber: 'PO-LHE-2026-0001',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2026-09-15',
        expiryDate: '2027-08-31',
        initialQuantity: 10,
        remainingQuantity: 10,
        unitCostSnapshot: 6200,
        status: 'VALID',
        createdAt: '2026-09-15T11:00:00Z',
        updatedAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'batch-4',
        itemId: 'item-3',
        itemName: 'Kérastase Elixir Ultime Hair Oil (100ml)',
        itemSku: 'PROD-LHE-003',
        branchId: 'branch-1',
        batchNumber: 'B-KR-2401',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2025-08-10',
        expiryDate: '2026-08-15', // Expired as of 2026-09-28
        initialQuantity: 5,
        remainingQuantity: 2,
        unitCostSnapshot: 7200,
        status: 'EXPIRED',
        createdAt: '2025-08-10T11:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
      },
      {
        id: 'batch-5',
        itemId: 'item-3',
        itemName: 'Kérastase Elixir Ultime Hair Oil (100ml)',
        itemSku: 'PROD-LHE-003',
        branchId: 'branch-1',
        batchNumber: 'B-KR-2501',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2026-09-15',
        expiryDate: '2027-04-30',
        initialQuantity: 5,
        remainingQuantity: 5,
        unitCostSnapshot: 7500,
        status: 'VALID',
        createdAt: '2026-09-15T11:00:00Z',
        updatedAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'batch-6',
        itemId: 'item-4',
        itemName: 'Majirel Hair Color Cream 5.0 Light Brown (50ml)',
        itemSku: 'CONS-LHE-001',
        branchId: 'branch-1',
        batchNumber: 'B-MJ-2601',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2026-09-15',
        expiryDate: '2027-12-31',
        initialQuantity: 25,
        remainingQuantity: 25,
        unitCostSnapshot: 1400,
        status: 'VALID',
        createdAt: '2026-09-15T11:00:00Z',
        updatedAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'batch-7',
        itemId: 'item-5',
        itemName: 'Oxydant Creme 20 Vol 6% Developer (1000ml)',
        itemSku: 'CONS-LHE-002',
        branchId: 'branch-1',
        batchNumber: 'B-OX-2601',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2026-09-15',
        expiryDate: '2028-01-31',
        initialQuantity: 6,
        remainingQuantity: 6,
        unitCostSnapshot: 2200,
        status: 'VALID',
        createdAt: '2026-09-15T11:00:00Z',
        updatedAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'batch-8',
        itemId: 'item-6',
        itemName: 'Nitrile Powder-Free Salon Gloves (Box of 100)',
        itemSku: 'CONS-LHE-003',
        branchId: 'branch-1',
        batchNumber: 'LOT-2026-GL',
        supplierId: 'sup-3',
        supplierName: 'Salon Essentials Distribution',
        receivedDate: '2026-09-20',
        initialQuantity: 4,
        remainingQuantity: 4,
        unitCostSnapshot: 1800,
        status: 'VALID',
        createdAt: '2026-09-20T11:00:00Z',
        updatedAt: '2026-09-20T11:00:00Z',
      },
      {
        id: 'batch-9',
        itemId: 'item-7',
        itemName: 'Davines OI All In One Milk (135ml)',
        itemSku: 'PROD-LHE-004',
        branchId: 'branch-1',
        batchNumber: 'B-DV-2601',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        receivedDate: '2026-09-10',
        expiryDate: '2027-09-30',
        initialQuantity: 7,
        remainingQuantity: 7,
        unitCostSnapshot: 4800,
        status: 'VALID',
        createdAt: '2026-09-10T11:00:00Z',
        updatedAt: '2026-09-10T11:00:00Z',
      },
    ];
  }

  private createDefaultPurchases(): Purchase[] {
    return [
      {
        id: 'po-1001',
        purchaseNumber: 'PO-LHE-2026-0001',
        branchId: 'branch-1',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        purchaseDate: '2026-09-15',
        supplierInvoiceNumber: 'LOR-INV-8891',
        notes: 'Monthly retail restock and color replenishment',
        subtotal: 45000,
        discount: 0,
        netAmount: 45000,
        paidAmount: 0,
        balanceDue: 45000,
        paymentMethod: 'CREDIT',
        paymentStatus: 'UNPAID',
        lines: [
          {
            id: 'pol-1',
            itemId: 'item-1',
            itemName: 'Moroccanoil Treatment Original (100ml)',
            itemSku: 'PROD-LHE-001',
            quantity: 4,
            unitPurchaseCost: 5500,
            lineDiscount: 0,
            lineTotal: 22000,
            batchNumber: 'B-MO-2601',
            expiryDate: '2027-06-30',
          },
          {
            id: 'pol-2',
            itemId: 'item-4',
            itemName: 'Majirel Hair Color Cream 5.0 Light Brown (50ml)',
            itemSku: 'CONS-LHE-001',
            quantity: 10,
            unitPurchaseCost: 1400,
            lineDiscount: 0,
            lineTotal: 14000,
            batchNumber: 'B-MJ-2601',
            expiryDate: '2027-12-31',
          },
          {
            id: 'pol-3',
            itemId: 'item-5',
            itemName: 'Oxydant Creme 20 Vol 6% Developer (1000ml)',
            itemSku: 'CONS-LHE-002',
            quantity: 4,
            unitPurchaseCost: 2200,
            lineDiscount: 0,
            lineTotal: 8800,
            batchNumber: 'B-OX-2601',
            expiryDate: '2028-01-31',
          },
        ],
        status: 'POSTED',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-15T11:00:00Z',
      },
    ];
  }

  private createDefaultSupplierLedger(): SupplierLedgerEntry[] {
    return [
      {
        id: 'led-sup-1001',
        supplierId: 'sup-1',
        supplierName: "L'Oréal Professional Pakistan",
        branchId: 'branch-1',
        date: '2026-09-15',
        time: '11:00 AM',
        entryType: 'PURCHASE_CREDIT',
        referenceType: 'PURCHASE',
        referenceId: 'po-1001',
        referenceNumber: 'PO-LHE-2026-0001',
        description: 'Credit Purchase: PO-LHE-2026-0001 (Invoice #LOR-INV-8891)',
        debit: 0,
        credit: 45000,
        runningBalance: 45000,
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'led-sup-1002',
        supplierId: 'sup-3',
        supplierName: 'Salon Essentials Distribution',
        branchId: 'branch-1',
        date: '2026-09-05',
        time: '10:00 AM',
        entryType: 'OPENING_BALANCE',
        referenceType: 'OPENING',
        referenceId: 'init-003',
        referenceNumber: 'OPN-2026-003',
        description: 'Opening Payable Balance verified by Branch Admin',
        debit: 0,
        credit: 18500,
        runningBalance: 18500,
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-05T10:00:00Z',
      },
    ];
  }

  private createDefaultStockMovements(): StockMovement[] {
    return [
      {
        id: 'sm-1001',
        movementNumber: 'SM-LHE-2026-0001',
        branchId: 'branch-1',
        itemId: 'item-1',
        itemName: 'Moroccanoil Treatment Original (100ml)',
        itemSku: 'PROD-LHE-001',
        batchNumber: 'B-MO-2601',
        movementType: 'OPENING_STOCK',
        direction: 'IN',
        quantity: 8,
        unitCostSnapshot: 5500,
        totalCostImpact: 44000,
        sourceReferenceType: 'OPENING',
        sourceReferenceId: 'init-stk-1',
        sourceReferenceNumber: 'OPN-STK-001',
        reason: 'Opening stock count',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'sm-1002',
        movementNumber: 'SM-LHE-2026-0002',
        branchId: 'branch-1',
        itemId: 'item-1',
        itemName: 'Moroccanoil Treatment Original (100ml)',
        itemSku: 'PROD-LHE-001',
        batchNumber: 'B-MO-2601',
        movementType: 'PURCHASE_IN',
        direction: 'IN',
        quantity: 4,
        unitCostSnapshot: 5500,
        totalCostImpact: 22000,
        sourceReferenceType: 'PURCHASE',
        sourceReferenceId: 'po-1001',
        sourceReferenceNumber: 'PO-LHE-2026-0001',
        reason: 'Goods received from PO-LHE-2026-0001',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'sm-1003',
        movementNumber: 'SM-LHE-2026-0003',
        branchId: 'branch-1',
        itemId: 'item-2',
        itemName: 'Olaplex No. 3 Hair Perfector (100ml)',
        itemSku: 'PROD-LHE-002',
        batchNumber: 'B-OL-2502',
        movementType: 'OPENING_STOCK',
        direction: 'IN',
        quantity: 8,
        unitCostSnapshot: 6200,
        totalCostImpact: 49600,
        sourceReferenceType: 'OPENING',
        sourceReferenceId: 'init-stk-2',
        sourceReferenceNumber: 'OPN-STK-002',
        reason: 'Opening stock count',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-08-01T11:00:00Z',
      },
      {
        id: 'sm-1004',
        movementNumber: 'SM-LHE-2026-0004',
        branchId: 'branch-1',
        itemId: 'item-2',
        itemName: 'Olaplex No. 3 Hair Perfector (100ml)',
        itemSku: 'PROD-LHE-002',
        batchNumber: 'B-OL-2601',
        movementType: 'OPENING_STOCK',
        direction: 'IN',
        quantity: 10,
        unitCostSnapshot: 6200,
        totalCostImpact: 62000,
        sourceReferenceType: 'OPENING',
        sourceReferenceId: 'init-stk-3',
        sourceReferenceNumber: 'OPN-STK-003',
        reason: 'Opening stock count',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'sm-1005',
        movementNumber: 'SM-LHE-2026-0005',
        branchId: 'branch-1',
        itemId: 'item-3',
        itemName: 'Kérastase Elixir Ultime Hair Oil (100ml)',
        itemSku: 'PROD-LHE-003',
        batchNumber: 'B-KR-2401',
        movementType: 'OPENING_STOCK',
        direction: 'IN',
        quantity: 2,
        unitCostSnapshot: 7200,
        totalCostImpact: 14400,
        sourceReferenceType: 'OPENING',
        sourceReferenceId: 'init-stk-4',
        sourceReferenceNumber: 'OPN-STK-004',
        reason: 'Opening stock count (expired lot)',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2025-08-10T11:00:00Z',
      },
      {
        id: 'sm-1006',
        movementNumber: 'SM-LHE-2026-0006',
        branchId: 'branch-1',
        itemId: 'item-3',
        itemName: 'Kérastase Elixir Ultime Hair Oil (100ml)',
        itemSku: 'PROD-LHE-003',
        batchNumber: 'B-KR-2501',
        movementType: 'OPENING_STOCK',
        direction: 'IN',
        quantity: 5,
        unitCostSnapshot: 7500,
        totalCostImpact: 37500,
        sourceReferenceType: 'OPENING',
        sourceReferenceId: 'init-stk-5',
        sourceReferenceNumber: 'OPN-STK-005',
        reason: 'Opening stock count',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'sm-1007',
        movementNumber: 'SM-LHE-2026-0007',
        branchId: 'branch-1',
        itemId: 'item-4',
        itemName: 'Majirel Hair Color Cream 5.0 Light Brown (50ml)',
        itemSku: 'CONS-LHE-001',
        batchNumber: 'B-MJ-2601',
        movementType: 'PURCHASE_IN',
        direction: 'IN',
        quantity: 25,
        unitCostSnapshot: 1400,
        totalCostImpact: 35000,
        sourceReferenceType: 'PURCHASE',
        sourceReferenceId: 'po-1001',
        sourceReferenceNumber: 'PO-LHE-2026-0001',
        reason: 'Goods received from PO-LHE-2026-0001',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'sm-1008',
        movementNumber: 'SM-LHE-2026-0008',
        branchId: 'branch-1',
        itemId: 'item-5',
        itemName: 'Oxydant Creme 20 Vol 6% Developer (1000ml)',
        itemSku: 'CONS-LHE-002',
        batchNumber: 'B-OX-2601',
        movementType: 'PURCHASE_IN',
        direction: 'IN',
        quantity: 6,
        unitCostSnapshot: 2200,
        totalCostImpact: 13200,
        sourceReferenceType: 'PURCHASE',
        sourceReferenceId: 'po-1001',
        sourceReferenceNumber: 'PO-LHE-2026-0001',
        reason: 'Goods received from PO-LHE-2026-0001',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-15T11:00:00Z',
      },
      {
        id: 'sm-1009',
        movementNumber: 'SM-LHE-2026-0009',
        branchId: 'branch-1',
        itemId: 'item-6',
        itemName: 'Nitrile Powder-Free Salon Gloves (Box of 100)',
        itemSku: 'CONS-LHE-003',
        batchNumber: 'LOT-2026-GL',
        movementType: 'OPENING_STOCK',
        direction: 'IN',
        quantity: 4,
        unitCostSnapshot: 1800,
        totalCostImpact: 7200,
        sourceReferenceType: 'OPENING',
        sourceReferenceId: 'init-stk-6',
        sourceReferenceNumber: 'OPN-STK-006',
        reason: 'Opening stock count',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-20T11:00:00Z',
      },
      {
        id: 'sm-1010',
        movementNumber: 'SM-LHE-2026-0010',
        branchId: 'branch-1',
        itemId: 'item-7',
        itemName: 'Davines OI All In One Milk (135ml)',
        itemSku: 'PROD-LHE-004',
        batchNumber: 'B-DV-2601',
        movementType: 'OPENING_STOCK',
        direction: 'IN',
        quantity: 7,
        unitCostSnapshot: 4800,
        totalCostImpact: 33600,
        sourceReferenceType: 'OPENING',
        sourceReferenceId: 'init-stk-7',
        sourceReferenceNumber: 'OPN-STK-007',
        reason: 'Opening stock count',
        createdById: 'usr-admin-01',
        createdByName: 'Aamina Sheikh',
        createdAt: '2026-09-10T11:00:00Z',
      },
    ];
  }
}

export const mockStorage = new MockStorageManager();
