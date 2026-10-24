// prisma/seed-data.js
// Demo master data — copied from the frontend mock (src/services/mock/mockStorage.ts)
// with the SAME ids, so the frontend behaves identically after switching to the API.

export const BRANCHES = [
  {
    id: 'branch-1', name: 'Gulberg Flagship Lounge', code: 'LHE-01',
    address: 'M.M. Alam Road, Gulberg III', city: 'Lahore', phone: '+92 (42) 3578-9101',
    email: 'gulberg@isysware-salon.pk', taxRate: 0.16, taxEnabled: true, defaultTaxRuleId: 'tax-lhe-std',
    openingCashFloat: 25000, assignedAdminId: 'usr-admin-01', taxAuthority: 'Punjab Revenue Authority (PRA)',
  },
  {
    id: 'branch-2', name: 'Clifton Luxury Suites', code: 'KHI-02',
    address: 'Block 4, Clifton Marine Promenade', city: 'Karachi', phone: '+92 (21) 3582-4411',
    email: 'clifton@isysware-salon.pk', taxRate: 0.13, taxEnabled: true, defaultTaxRuleId: 'tax-khi-std',
    openingCashFloat: 30000, assignedAdminId: 'usr-admin-02', taxAuthority: 'Sindh Revenue Board (SRB)',
  },
];

export const TAX_RULES = [
  { id: 'tax-lhe-std', branchId: 'branch-1', name: 'Punjab Sales Tax (PST Standard)', rate: 0.16, description: '16% PRA sales tax on salon and beauty services in Punjab', isBranchDefault: true },
  { id: 'tax-lhe-reduced', branchId: 'branch-1', name: 'Special Beauty Concession', rate: 0.05, description: '5% concession rate for designated skin consultations', isBranchDefault: false },
  { id: 'tax-khi-std', branchId: 'branch-2', name: 'Sindh Sales Tax (SST Standard)', rate: 0.13, description: '13% SRB sales tax on personal grooming services in Sindh', isBranchDefault: true },
  { id: 'tax-khi-reduced', branchId: 'branch-2', name: 'SRB Wellness Concession', rate: 0.08, description: '8% reduced tier for wellness treatments', isBranchDefault: false },
];

export const USERS = [
  { id: 'usr-super-01', name: 'Super Administrator', email: 'superadmin@isysware.com', role: 'SUPER_ADMIN', branchId: null, title: 'Chief Executive Officer', phone: '+92 (300) 111-2233', createdAt: '2026-01-15', password: 'admin123' },
  { id: '85887989-7308-4579-b32d-05d660dcdb8d', name: 'Huzaifa', email: 'huzaifawarsi2006@gmail.com', role: 'ADMIN', branchId: 'branch-1', title: 'Branch Manager', phone: '03132220567', createdAt: '2026-10-01', password: 'admin123' },
  { id: 'usr-admin-01', name: 'Aamina Sheikh', email: 'admin.gulberg@isysware.com', role: 'ADMIN', branchId: 'branch-1', title: 'Branch General Manager', phone: '+92 (300) 222-3344', createdAt: '2026-01-20', password: 'admin123' },
  { id: 'usr-admin-02', name: 'Kamran Akram', email: 'admin.clifton@isysware.com', role: 'ADMIN', branchId: 'branch-2', title: 'Branch Managing Director', phone: '+92 (321) 555-8899', createdAt: '2026-01-22', password: 'admin123' },
  { id: 'usr-acc-01', name: 'Usman Farooq', email: 'accountant.gulberg@isysware.com', role: 'ACCOUNTANT', branchId: 'branch-1', title: 'Branch Cashier & Accountant', phone: '+92 (300) 333-4455', createdAt: '2026-02-01', password: 'admin123' },
  { id: 'usr-staff-01', name: 'Zara Alvi', email: 'zara.stylist@isysware.com', role: 'STAFF', branchId: 'branch-1', staffId: 'staff-1', title: 'Senior Hair Stylist & Colorist', phone: '+92 (300) 444-5566', createdAt: '2026-02-15', password: 'admin123' },
];

const noDeduction = { enabled: false, type: 'FIXED', amount: 0 };
const staffBase = {
  effectiveDate: '2026-01-01', lateInDeduction: noDeduction, earlyExitDeduction: noDeduction,
  payrollDivisor: 30, combinationPolicy: 'BOTH', isActive: true,
};

export const STAFF = [
  { ...staffBase, id: 'staff-1', employeeCode: 'EMP-LHE-001', branchId: 'branch-1', name: 'Zara Alvi', email: 'zara.stylist@isysware.com', phone: '+92 (300) 456-7890', designation: 'Senior Stylist & Colorist', roleTitle: 'Senior Stylist & Colorist', joiningDate: '2024-03-15', compensationType: 'MONTHLY_PLUS_COMMISSION', baseSalary: 85000, dailySalaryRate: 0, commissionRate: 20, overtimeHourlyRate: 600, startTime: '09:00', endTime: '18:00', lateGraceMinutes: 15, earlyGraceMinutes: 15, allowedLeaveDays: 12, leaveAllowancePeriod: 'YEARLY', specialties: ['Balayage & Foilyage', 'Keratin Smoothing', 'Bridal Hair Design'], hasPortalAccess: true },
  { ...staffBase, id: 'staff-2', employeeCode: 'EMP-LHE-002', branchId: 'branch-1', name: 'Hamza Malik', email: 'hamza.barber@isysware.com', phone: '+92 (300) 456-7891', designation: 'Master Barber & Grooming', roleTitle: 'Master Barber & Grooming', joiningDate: '2024-06-01', compensationType: 'MONTHLY_PLUS_COMMISSION', baseSalary: 75000, dailySalaryRate: 0, commissionRate: 18, overtimeHourlyRate: 500, startTime: '10:00', endTime: '19:00', lateGraceMinutes: 15, earlyGraceMinutes: 15, allowedLeaveDays: 12, leaveAllowancePeriod: 'YEARLY', specialties: ['Executive Fade', 'Royal Hot Towel Shave', 'Beard Contouring'], hasPortalAccess: false },
  { ...staffBase, id: 'staff-3', employeeCode: 'EMP-LHE-003', branchId: 'branch-1', name: 'Ayesha Khan', email: 'ayesha.nails@isysware.com', phone: '+92 (300) 456-7892', designation: 'Nail Artist & Esthetician', roleTitle: 'Nail Artist & Esthetician', joiningDate: '2024-09-10', compensationType: 'MONTHLY_PLUS_COMMISSION', baseSalary: 65000, dailySalaryRate: 0, commissionRate: 15, overtimeHourlyRate: 450, startTime: '09:30', endTime: '18:30', lateGraceMinutes: 10, earlyGraceMinutes: 10, allowedLeaveDays: 12, leaveAllowancePeriod: 'YEARLY', specialties: ['Gel Polish Art', 'Russian Manicure', 'HydraFacial Glow'], hasPortalAccess: false },
  { ...staffBase, id: 'staff-4', employeeCode: 'EMP-KHI-001', branchId: 'branch-2', name: 'Sana Mir', email: 'sana.spa@isysware.com', phone: '+92 (321) 987-6543', designation: 'Skin Therapist & Spa Specialist', roleTitle: 'Skin Therapist & Spa Specialist', joiningDate: '2025-01-05', compensationType: 'MONTHLY_SALARY', baseSalary: 80000, dailySalaryRate: 0, commissionRate: 0, overtimeHourlyRate: 550, startTime: '09:00', endTime: '18:00', lateGraceMinutes: 15, earlyGraceMinutes: 15, allowedLeaveDays: 12, leaveAllowancePeriod: 'YEARLY', specialties: ['HydraFacial', 'Deep Tissue Reflexology', 'Organic Peels'], hasPortalAccess: false },
  { ...staffBase, id: 'staff-5', employeeCode: 'EMP-KHI-002', branchId: 'branch-2', name: 'Bilal Tariq', email: 'bilal.stylist@isysware.com', phone: '+92 (321) 987-6544', designation: 'Creative Director & Hair Artist', roleTitle: 'Creative Director & Hair Artist', joiningDate: '2025-02-01', compensationType: 'DAILY_PLUS_COMMISSION', baseSalary: 0, dailySalaryRate: 3500, commissionRate: 22, overtimeHourlyRate: 650, startTime: '11:00', endTime: '20:00', lateGraceMinutes: 15, earlyGraceMinutes: 15, allowedLeaveDays: 1, leaveAllowancePeriod: 'MONTHLY', specialties: ['Precision Architecture Cuts', 'Color Transformation', 'Beard Artistry'], hasPortalAccess: false },
];

export const SERVICE_CATEGORIES = [
  { id: 'cat-lhe-1', branchId: 'branch-1', name: 'Hair Styling & Cuts' },
  { id: 'cat-lhe-2', branchId: 'branch-1', name: 'Hair Coloring & Balayage' },
  { id: 'cat-lhe-3', branchId: 'branch-1', name: 'Skin & HydraFacial' },
  { id: 'cat-lhe-4', branchId: 'branch-1', name: 'Nails & Pedicure' },
  { id: 'cat-lhe-5', branchId: 'branch-1', name: 'Men Grooming' },
  { id: 'cat-khi-1', branchId: 'branch-2', name: 'Hair Couture' },
  { id: 'cat-khi-2', branchId: 'branch-2', name: 'Spa & Wellness' },
  { id: 'cat-khi-3', branchId: 'branch-2', name: 'Nail Esthetics' },
  { id: 'cat-khi-4', branchId: 'branch-2', name: 'Luxury Barbering' },
];

export const SERVICES = [
  { id: 'srv-lhe-01', branchId: 'branch-1', code: 'SRV-LHE-001', name: 'Signature Blowout & Treatment', category: 'Hair Styling & Cuts', durationMinutes: 45, price: 3500, description: 'Wash, nourishing deep-conditioning rinse, and premium salon blowout with volume finish.', taxTreatment: 'BRANCH_DEFAULT' },
  { id: 'srv-lhe-02', branchId: 'branch-1', code: 'SRV-LHE-002', name: 'Executive Hot Towel Shave & Cut', category: 'Men Grooming', durationMinutes: 40, price: 4000, description: 'Precision scissor and clipper trim with hot towel botanical lather shave.', taxTreatment: 'BRANCH_DEFAULT' },
  { id: 'srv-lhe-03', branchId: 'branch-1', code: 'SRV-LHE-003', name: 'Signature Balayage & Gloss Finish', category: 'Hair Coloring & Balayage', durationMinutes: 120, price: 18500, description: 'Hand-painted dimensional contouring followed by conditioning tonal glaze gloss.', taxTreatment: 'BRANCH_DEFAULT' },
  { id: 'srv-lhe-04', branchId: 'branch-1', code: 'SRV-LHE-004', name: 'Keratin Smoothing Therapy', category: 'Hair Styling & Cuts', durationMinutes: 150, price: 22000, description: 'Formaldehyde-free intensive smoothing treatment eliminating frizz for up to 4 months.', taxTreatment: 'BRANCH_DEFAULT' },
  { id: 'srv-lhe-05', branchId: 'branch-1', code: 'SRV-LHE-005', name: 'Russian Gel Manicure', category: 'Nails & Pedicure', durationMinutes: 60, price: 5000, description: 'Dry hardware cuticle refinement, nail apex reinforcement, and flawless high-gloss gel polish.', taxTreatment: 'BRANCH_DEFAULT' },
  { id: 'srv-lhe-06', branchId: 'branch-1', code: 'SRV-LHE-006', name: 'Clinical HydraFacial Glow', category: 'Skin & HydraFacial', durationMinutes: 75, price: 12000, description: '3-step vortex extraction, gentle chemical peel, and hyaluronic acid antioxidant serum infusion.', taxTreatment: 'SPECIFIC_RULE', specificTaxRuleId: 'tax-lhe-reduced' },
  { id: 'srv-lhe-07', branchId: 'branch-1', code: 'SRV-LHE-007', name: 'Scalp Detox & Micro-Mist Therapy', category: 'Hair Styling & Cuts', durationMinutes: 30, price: 4500, description: 'Exfoliating salicylic acid scalp scrub followed by ultrasound micro-mist hydration.', taxTreatment: 'EXEMPT' },
  { id: 'srv-khi-01', branchId: 'branch-2', code: 'SRV-KHI-001', name: 'Couture Balayage & Olaplex Infusion', category: 'Hair Couture', durationMinutes: 135, price: 21000, description: 'Bespoke coastal illumination with multi-bond restructuring treatment.', taxTreatment: 'BRANCH_DEFAULT' },
  { id: 'srv-khi-02', branchId: 'branch-2', code: 'SRV-KHI-002', name: 'Deep Tissue Aromatherapy Massage', category: 'Spa & Wellness', durationMinutes: 60, price: 9500, description: 'Therapeutic neuromuscular release utilizing organic lavender and eucalyptus cold-pressed oils.', taxTreatment: 'BRANCH_DEFAULT' },
  { id: 'srv-khi-03', branchId: 'branch-2', code: 'SRV-KHI-003', name: 'Royal Beard Architecture & Shave', category: 'Luxury Barbering', durationMinutes: 45, price: 4500, description: 'Razor edge alignment, conditioning beard oil mask, and invigorating menthol mist.', taxTreatment: 'BRANCH_DEFAULT' },
];

export const PACKAGES = [
  {
    id: 'pkg-lhe-01', branchId: 'branch-1', code: 'PKG-LHE-001', name: 'Bridal Glamour & Hair Transformation',
    description: 'Luxury pre-wedding makeover combining master balayage, keratin renewal, and Russian manicure.',
    price: 42000, taxTreatment: 'BRANCH_DEFAULT',
    components: [
      { serviceId: 'srv-lhe-03', quantity: 1, allocationPercentage: 45 },
      { serviceId: 'srv-lhe-04', quantity: 1, allocationPercentage: 45 },
      { serviceId: 'srv-lhe-05', quantity: 1, allocationPercentage: 10 },
    ],
  },
  {
    id: 'pkg-lhe-02', branchId: 'branch-1', code: 'PKG-LHE-002', name: 'Executive Grooming Suite',
    description: 'Complete restorative grooming including tailored cut, hot towel shave, and scalp detox micro-mist.',
    price: 7000, taxTreatment: 'BRANCH_DEFAULT',
    components: [
      { serviceId: 'srv-lhe-02', quantity: 1, allocationPercentage: 60 },
      { serviceId: 'srv-lhe-07', quantity: 1, allocationPercentage: 40 },
    ],
  },
  {
    id: 'pkg-khi-01', branchId: 'branch-2', code: 'PKG-KHI-001', name: 'Clifton Riviera Glow Package',
    description: 'Luxury coastal styling with deep-tissue full body aromatherapy.',
    price: 28000, taxTreatment: 'BRANCH_DEFAULT',
    components: [
      { serviceId: 'srv-khi-01', quantity: 1, allocationPercentage: 70 },
      { serviceId: 'srv-khi-02', quantity: 1, allocationPercentage: 30 },
    ],
  },
];

// openingBalance = the balance the mock starts with; later balances come only from movements.
export const PAYMENT_ACCOUNTS = [
  { id: 'acc-1', branchId: 'branch-1', name: 'Meezan Corporate Checking', accountType: 'BANK', providerName: 'Meezan Bank Ltd', accountHolder: 'iSysware Salon Gulberg', accountIdentifier: 'PK36MEZN0001004821', openingBalance: 1845000, createdAt: '2026-01-01' },
  { id: 'acc-2', branchId: 'branch-1', name: 'HBL Smart POS Terminal 01', accountType: 'OTHER', providerName: 'Habib Bank Limited', accountHolder: 'iSysware Salon Terminal', accountIdentifier: 'TID-883201-LHE', openingBalance: 425000, createdAt: '2026-01-01' },
  { id: 'acc-3', branchId: 'branch-1', name: 'JazzCash Merchant Till', accountType: 'JAZZCASH', providerName: 'Mobilink Microfinance Bank', accountHolder: 'Usman Farooq (Merchant Till)', accountIdentifier: '03001231049', openingBalance: 148500, createdAt: '2026-01-10' },
  { id: 'acc-4', branchId: 'branch-2', name: 'Bank Alfalah Premier Business', accountType: 'BANK', providerName: 'Bank Alfalah Ltd', accountHolder: 'iSysware Salon Karachi', accountIdentifier: 'PK42ALFH0009102201', openingBalance: 2340000, createdAt: '2026-01-01' },
  { id: 'acc-5', branchId: 'branch-2', name: 'Clifton Reception POS 01', accountType: 'OTHER', providerName: 'HBL Digital Merchant', accountHolder: 'iSysware Karachi POS', accountIdentifier: 'TID-441902-KHI', openingBalance: 560000, createdAt: '2026-01-01' },
  { id: 'acc-6', branchId: 'branch-2', name: 'Easypaisa Digital Till', accountType: 'EASYPAISA', providerName: 'Telenor Microfinance Bank', accountHolder: 'Kamran Akram Till', accountIdentifier: '03219877741', openingBalance: 195000, createdAt: '2026-01-12' },
];

export const EXPENSE_CATEGORIES = [
  { id: 'exp-cat-1', branchId: 'branch-1', name: 'Supplies', description: 'Salon consumables and sanitation products' },
  { id: 'exp-cat-2', branchId: 'branch-1', name: 'Utilities', description: 'Electricity, water, gas, and internet bills' },
  { id: 'exp-cat-3', branchId: 'branch-1', name: 'Maintenance', description: 'Equipment repair and facility upkeep' },
  { id: 'exp-cat-4', branchId: 'branch-1', name: 'Refreshments', description: 'Client teas, beverages, and hospitality' },
  { id: 'exp-cat-5', branchId: 'branch-1', name: 'Marketing', description: 'Local promotions, flyers, and ad spend' },
  { id: 'exp-cat-6', branchId: 'branch-2', name: 'Supplies', description: 'Salon consumables and sanitation products' },
  { id: 'exp-cat-7', branchId: 'branch-2', name: 'Utilities', description: 'Electricity, water, gas, and internet bills' },
  { id: 'exp-cat-8', branchId: 'branch-2', name: 'Maintenance', description: 'Equipment repair and facility upkeep' },
];

// Opening receivable balances from the mock are NOT seeded — dues only come from real invoices.
export const CLIENTS = [
  { id: 'client-1', branchId: 'branch-1', name: 'Zainab Ahmed', phone: '+92 (300) 123-4567', email: 'zainab.ahmed@example.com', source: 'WALK_IN', loyaltyPoints: 120 },
  { id: 'client-2', branchId: 'branch-1', name: 'Tariq Mahmood', phone: '+92 (321) 987-6543', email: 'tariq.m@example.com', source: 'REFERRAL', sourceDetails: 'Referred by Dr. Usman', loyaltyPoints: 45 },
  { id: 'client-3', branchId: 'branch-2', name: 'Farah Naz', phone: '+92 (333) 555-1234', email: 'farah.naz@example.com', source: 'SOCIAL_MEDIA', sourceDetails: 'Instagram @farahnaz_looks', loyaltyPoints: 80 },
];

// Branch vault (admin safe) opening cash — same figures as the mock's vaultBalances.
export const VAULTS = [
  { id: 'vault-branch-1', branchId: 'branch-1', openingCash: 150000 },
  { id: 'vault-branch-2', branchId: 'branch-2', openingCash: 100000 },
];

// ── Inventory master data (same ids as the frontend mock) ──────────────────
const itemBase = { taxTreatment: 'BRANCH_DEFAULT', trackBatch: true, trackExpiry: true, nearExpiryAlertDays: 60, isActive: true };
export const INVENTORY_ITEMS = [
  { ...itemBase, id: 'item-1', sku: 'PROD-LHE-001', barcode: '896400010011', name: 'Moroccanoil Treatment Original (100ml)', category: 'Hair Care', brand: 'Moroccanoil', itemType: 'RETAIL_PRODUCT', defaultPurchaseCost: 5500, sellingPrice: 7800, purchaseUnit: 'BOTTLE', issueUnit: 'BOTTLE', minStockLevel: 5, branchAvailability: ['branch-1', 'branch-2'] },
  { ...itemBase, id: 'item-2', sku: 'PROD-LHE-002', barcode: '896400010028', name: 'Olaplex No. 3 Hair Perfector (100ml)', category: 'Hair Repair', brand: 'Olaplex', itemType: 'RETAIL_PRODUCT', defaultPurchaseCost: 6200, sellingPrice: 8900, purchaseUnit: 'BOTTLE', issueUnit: 'BOTTLE', minStockLevel: 4, branchAvailability: ['branch-1', 'branch-2'] },
  { ...itemBase, id: 'item-3', sku: 'PROD-LHE-003', barcode: '896400010035', name: 'Kérastase Elixir Ultime Hair Oil (100ml)', category: 'Luxury Care', brand: 'Kérastase', itemType: 'RETAIL_PRODUCT', defaultPurchaseCost: 7500, sellingPrice: 11500, purchaseUnit: 'BOTTLE', issueUnit: 'BOTTLE', minStockLevel: 3, branchAvailability: ['branch-1'] },
  { ...itemBase, id: 'item-4', sku: 'CONS-LHE-001', barcode: '896400020010', name: 'Majirel Hair Color Cream 5.0 Light Brown (50ml)', category: 'Colorants', brand: "L'Oréal", itemType: 'SALON_CONSUMABLE', defaultPurchaseCost: 1400, sellingPrice: 0, purchaseUnit: 'TUBE', issueUnit: 'TUBE', taxTreatment: 'EXEMPT', minStockLevel: 10, nearExpiryAlertDays: 90, branchAvailability: ['branch-1', 'branch-2'] },
  { ...itemBase, id: 'item-5', sku: 'CONS-LHE-002', barcode: '896400020027', name: 'Oxydant Creme 20 Vol 6% Developer (1000ml)', category: 'Colorants', brand: "L'Oréal", itemType: 'SALON_CONSUMABLE', defaultPurchaseCost: 2200, sellingPrice: 0, purchaseUnit: 'BOTTLE', issueUnit: 'ML', unitConversionRatio: 1000, taxTreatment: 'EXEMPT', minStockLevel: 3, nearExpiryAlertDays: 90, branchAvailability: ['branch-1', 'branch-2'] },
  { ...itemBase, id: 'item-6', sku: 'CONS-LHE-003', barcode: '896400030019', name: 'Nitrile Powder-Free Salon Gloves (Box of 100)', category: 'Salon Disposables', brand: 'ProGuard', itemType: 'SALON_CONSUMABLE', defaultPurchaseCost: 1800, sellingPrice: 0, purchaseUnit: 'BOX', issueUnit: 'PAIR', unitConversionRatio: 50, minStockLevel: 2, trackBatch: false, trackExpiry: false, nearExpiryAlertDays: 0, branchAvailability: ['branch-1', 'branch-2'] },
  { ...itemBase, id: 'item-7', sku: 'PROD-LHE-004', barcode: '896400010042', name: 'Davines OI All In One Milk (135ml)', category: 'Styling', brand: 'Davines', itemType: 'BOTH', defaultPurchaseCost: 4800, sellingPrice: 6900, purchaseUnit: 'BOTTLE', issueUnit: 'BOTTLE', minStockLevel: 4, branchAvailability: ['branch-1'] },
];

export const SUPPLIERS = [
  { id: 'sup-1', supplierCode: 'SUP-001', name: "L'Oréal Professional Pakistan", phone: '+92 (21) 3529-8800', email: 'orders@loreal-pakistan.com', contactPerson: 'Salman Qureshi', address: 'Clifton Block 4, Karachi', taxNumber: 'NTN-7392014-9', notes: "Official direct distributor for L'Oréal & Kérastase", branchId: 'ALL', openingPayable: 45000, ledgerBranchId: 'branch-1' },
  { id: 'sup-2', supplierCode: 'SUP-002', name: 'Schwarzkopf Professional PK', phone: '+92 (42) 3571-4411', email: 'supply@schwarzkopf.com.pk', contactPerson: 'Naveed Butt', address: 'Gulberg III, Lahore', taxNumber: 'NTN-8402155-3', notes: 'Supplier of Igora Royal & Bonacure lines', branchId: 'branch-1', openingPayable: 0, ledgerBranchId: 'branch-1' },
  { id: 'sup-3', supplierCode: 'SUP-003', name: 'Salon Essentials Distribution', phone: '+92 (42) 3668-9900', email: 'support@salonessentials.pk', contactPerson: 'Imran Siddiqui', address: 'DHA Phase 5, Lahore', taxNumber: 'NTN-9124032-1', notes: 'Disposables, gloves, foils, and salon consumables', branchId: 'branch-1', openingPayable: 18500, ledgerBranchId: 'branch-1' },
];

// Opening stock layers (posted as OPENING_STOCK movements so quantity = Σ movements).
export const OPENING_BATCHES = [
  { id: 'batch-1', itemId: 'item-1', branchId: 'branch-1', batchNumber: 'B-MO-2601', supplierId: 'sup-1', receivedDate: '2026-09-15', expiryDate: '2027-06-30', quantity: 12, unitCost: 5500 },
  { id: 'batch-2', itemId: 'item-2', branchId: 'branch-1', batchNumber: 'B-OL-2502', supplierId: 'sup-1', receivedDate: '2026-08-01', expiryDate: '2026-10-25', quantity: 8, unitCost: 6200 },
  { id: 'batch-3', itemId: 'item-2', branchId: 'branch-1', batchNumber: 'B-OL-2601', supplierId: 'sup-1', receivedDate: '2026-09-15', expiryDate: '2027-08-31', quantity: 10, unitCost: 6200 },
  { id: 'batch-4', itemId: 'item-3', branchId: 'branch-1', batchNumber: 'B-KR-2401', supplierId: 'sup-1', receivedDate: '2025-08-10', expiryDate: '2026-08-15', quantity: 2, unitCost: 7200 },
  { id: 'batch-5', itemId: 'item-3', branchId: 'branch-1', batchNumber: 'B-KR-2501', supplierId: 'sup-1', receivedDate: '2026-09-15', expiryDate: '2027-04-30', quantity: 5, unitCost: 7500 },
  { id: 'batch-6', itemId: 'item-4', branchId: 'branch-1', batchNumber: 'B-MJ-2601', supplierId: 'sup-1', receivedDate: '2026-09-15', expiryDate: '2027-12-31', quantity: 25, unitCost: 1400 },
  { id: 'batch-7', itemId: 'item-5', branchId: 'branch-1', batchNumber: 'B-OX-2601', supplierId: 'sup-1', receivedDate: '2026-09-15', expiryDate: '2028-01-31', quantity: 6, unitCost: 2200 },
  { id: 'batch-8', itemId: 'item-6', branchId: 'branch-1', batchNumber: 'LOT-2026-GL', supplierId: 'sup-3', receivedDate: '2026-09-20', expiryDate: null, quantity: 4, unitCost: 1800 },
  { id: 'batch-9', itemId: 'item-7', branchId: 'branch-1', batchNumber: 'B-DV-2601', supplierId: 'sup-1', receivedDate: '2026-09-10', expiryDate: '2027-09-30', quantity: 7, unitCost: 4800 },
];
