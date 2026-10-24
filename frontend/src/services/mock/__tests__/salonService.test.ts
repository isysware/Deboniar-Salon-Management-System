import { mockSalonService } from '../mockSalonService';
import { mockStorage } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '../../../types/auth';
import { CreatePOSInvoiceInput, CollectOutstandingPaymentInput } from '../../../types/salon';

// Helper assertion function
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function assertAsyncThrows(fn: () => Promise<any>, expectedSubstring?: string) {
  let threw = false;
  let caughtError: any = null;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    caughtError = err;
  }
  if (!threw) {
    throw new Error(`ASSERTION FAILED: Expected async function to throw an error, but it succeeded.`);
  }
  if (expectedSubstring && !caughtError.message.includes(expectedSubstring)) {
    throw new Error(
      `ASSERTION FAILED: Expected error containing "${expectedSubstring}", but got "${caughtError.message}"`
    );
  }
}

// Helper to create clean isolated test store and establish session
function setupIsolatedTestStore(userRole: 'ADMIN' | 'STAFF' | 'SUPER_ADMIN' = 'ADMIN', branchId: string = 'branch-1'): { adminUser: User; staffUser: User; testBranchId: string } {
  const testStore = mockStorage.reloadFromStorage();
  
  // Ensure clear baseline
  testStore.invoices = [];
  testStore.expenses = [];
  testStore.cashDrawers = [];
  testStore.settlements = [];
  testStore.idempotencyRecords = [];
  testStore.invoiceSequenceCounters = {};

  mockStorage.saveStore(testStore);

  const adminUser = testStore.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-1')!;
  const staffUser = testStore.users.find((u) => u.role === 'STAFF')!;
  const superAdminUser = testStore.users.find((u) => u.role === 'SUPER_ADMIN')!;
  const testBranchId = 'branch-1';

  let activeUser = adminUser;
  if (userRole === 'STAFF') activeUser = staffUser;
  if (userRole === 'SUPER_ADMIN') activeUser = superAdminUser;

  mockAuthService.setCurrentSession({
    user: activeUser,
    token: `test_token_${activeUser.id}`,
    loginTime: new Date().toISOString(),
    activeBranchId: userRole === 'SUPER_ADMIN' ? 'ALL' : branchId,
  });

  return { adminUser, staffUser, testBranchId };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('  RUNNING SALON OS POS CORRECTNESS SUITE (11 TESTS)');
  console.log('====================================================\n');

  let passedCount = 0;

  // ----------------------------------------------------
  // TEST 1: Invalid second split payment: zero partial changes
  // ----------------------------------------------------
  {
    console.log('Running Test 1: Invalid second split payment (zero partial changes)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const initialStore = mockStorage.getStore();
    const initialAcc1Balance = initialStore.paymentAccounts.find((a) => a.id === 'acc-1')!.currentBalance;

    const payload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Test Customer',
      clientPhone: '+92 (300) 000-0000',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: initialStore.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: 'acc-1', // valid
          amount: 2000,
          billAllocation: 2000,
          tipAllocation: 0,
        },
        {
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: 'INVALID-ACC-999', // invalid 2nd payment
          amount: 1500,
          billAllocation: 1500,
          tipAllocation: 0,
        },
      ],
    };

    await assertAsyncThrows(async () => {
      await mockSalonService.postPOSInvoice(payload, adminUser);
    }, 'invalid or deactivated');

    const storeAfter = mockStorage.getStore();
    assert(storeAfter.invoices.length === 0, 'Invoices list must remain empty on transaction failure.');
    assert(
      storeAfter.paymentAccounts.find((a) => a.id === 'acc-1')!.currentBalance === initialAcc1Balance,
      'Payment account 1 balance must remain unchanged after failure.'
    );
    console.log('✓ Test 1 Passed: Zero partial changes on invalid second split payment.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 2: Storage failure: no posting or success
  // ----------------------------------------------------
  {
    console.log('Running Test 2: Storage failure (no posting or success)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();

    const originalSaveStore = mockStorage.saveStore.bind(mockStorage);
    mockStorage.saveStore = () => {
      throw new Error('Simulated LocalStorage Disk Full / Quota Exceeded Failure');
    };

    const payload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Test Customer',
      clientPhone: '+92 (300) 000-0000',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 3500,
          billAllocation: 3500,
          tipAllocation: 0,
          cashTendered: 3500,
          changeReturned: 0,
        },
      ],
    };

    await assertAsyncThrows(async () => {
      await mockSalonService.postPOSInvoice(payload, adminUser);
    }, 'Simulated LocalStorage Disk Full');

    mockStorage.saveStore = originalSaveStore;
    const storeAfter = mockStorage.getStore();
    assert(storeAfter.invoices.length === 0, 'No invoice posted when storage throws error.');
    console.log('✓ Test 2 Passed: Storage failure cleanly aborted transaction without state change.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 3: Insufficient cash and mismatched allocations: rejected
  // ----------------------------------------------------
  {
    console.log('Running Test 3: Insufficient cash and mismatched allocations (rejected)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();

    const payloadInsufficientCash: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Walk-in',
      clientPhone: 'N/A',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 3500,
          billAllocation: 3500,
          tipAllocation: 0,
          cashTendered: 2000, // Insufficient!
          changeReturned: 0,
        },
      ],
    };

    await assertAsyncThrows(async () => {
      await mockSalonService.postPOSInvoice(payloadInsufficientCash, adminUser);
    }, 'Insufficient cash tendered');

    const payloadMismatchedAlloc: CreatePOSInvoiceInput = {
      ...payloadInsufficientCash,
      payments: [
        {
          method: 'CASH',
          amount: 3500,
          billAllocation: 2000,
          tipAllocation: 500, // Sum = 2500 != 3500!
          cashTendered: 3500,
          changeReturned: 0,
        },
      ],
    };

    await assertAsyncThrows(async () => {
      await mockSalonService.postPOSInvoice(payloadMismatchedAlloc, adminUser);
    }, 'bill allocation (2000) + tip allocation (500) must equal payment amount (3500)');

    console.log('✓ Test 3 Passed: Insufficient cash and mismatched allocations were rejected.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 4: Duplicate POS/collection retry: exactly one posting
  // ----------------------------------------------------
  {
    console.log('Running Test 4: Duplicate POS retry (exactly one posting)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();
    const key = `KEY-RETRY-TEST-${Date.now()}`;

    const payload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Idempotent Client',
      clientPhone: '+92 (300) 111-2222',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 3500,
          billAllocation: 3500,
          tipAllocation: 0,
          cashTendered: 3500,
          changeReturned: 0,
        },
      ],
      idempotencyKey: key,
    };

    const res1 = await mockSalonService.postPOSInvoice(payload, adminUser);
    const res2 = await mockSalonService.postPOSInvoice(payload, adminUser);

    assert(res1.id === res2.id, 'Retry must return exact original invoice ID.');
    const storeAfter = mockStorage.getStore();
    assert(storeAfter.invoices.length === 1, 'Store must contain exactly one invoice after retry.');
    console.log('✓ Test 4 Passed: Duplicate submission retry returned original result with 1 posting.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 5: Changed payload with reused key: rejected
  // ----------------------------------------------------
  {
    console.log('Running Test 5: Changed payload with reused key (rejected)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();
    const key = `KEY-PAYLOAD-MUTATE-${Date.now()}`;

    const payloadA: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Client A',
      clientPhone: '+92 (300) 111-2222',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 3500,
          billAllocation: 3500,
          tipAllocation: 0,
          cashTendered: 3500,
          changeReturned: 0,
        },
      ],
      idempotencyKey: key,
    };

    await mockSalonService.postPOSInvoice(payloadA, adminUser);

    const payloadB: CreatePOSInvoiceInput = {
      ...payloadA,
      clientName: 'Client B DIFFERENT NAME',
    };

    await assertAsyncThrows(async () => {
      await mockSalonService.postPOSInvoice(payloadB, adminUser);
    }, 'reused with a different payload');

    console.log('✓ Test 5 Passed: Reusing key with different payload was rejected.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 6: Package discount rounding: exact reconciliation
  // ----------------------------------------------------
  {
    console.log('Running Test 6: Package discount rounding (exact reconciliation)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();
    const pkgItem = store.packages.find((p) => p.id === 'pkg-lhe-01')!;

    const payload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Bridal Client',
      clientPhone: '+92 (300) 999-8888',
      discountType: 'FIXED',
      discountValue: 3333,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-pkg-1',
          type: 'PACKAGE',
          item: pkgItem,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
          packageComponents: [
            { serviceId: 'srv-lhe-03', serviceCode: 'SRV-LHE-003', serviceName: 'Balayage', quantity: 1, allocationPercentage: 45, allocatedAmount: 0, staffId: 'staff-1', staffName: 'Zara Alvi', staffCommissionRate: 0.2 },
            { serviceId: 'srv-lhe-04', serviceCode: 'SRV-LHE-004', serviceName: 'Keratin', quantity: 1, allocationPercentage: 45, allocatedAmount: 0, staffId: 'staff-1', staffName: 'Zara Alvi', staffCommissionRate: 0.2 },
            { serviceId: 'srv-lhe-05', serviceCode: 'SRV-LHE-005', serviceName: 'Manicure', quantity: 1, allocationPercentage: 10, allocatedAmount: 0, staffId: 'staff-3', staffName: 'Ayesha Khan', staffCommissionRate: 0.15 },
          ],
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 44853.72,
          billAllocation: 44853.72,
          tipAllocation: 0,
          cashTendered: 45000,
          changeReturned: 146.28,
        },
      ],
    };

    const inv = await mockSalonService.postPOSInvoice(payload, adminUser);
    const lineItem = inv.lineItems[0];
    assert(lineItem.packageComponents !== undefined, 'Package line must contain components snapshot.');
    const sumAllocated = lineItem.packageComponents!.reduce((sum, c) => sum + c.allocatedAmount, 0);
    const netSalesRounded = Math.round(lineItem.netSales! * 100) / 100;
    const sumAllocatedRounded = Math.round(sumAllocated * 100) / 100;
    assert(
      Math.abs(sumAllocatedRounded - netSalesRounded) < 0.001,
      `Component allocated amounts (${sumAllocatedRounded}) must sum EXACTLY to package net sales (${netSalesRounded}).`
    );

    console.log('✓ Test 6 Passed: Package component discount allocations reconciled exactly.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 7: Partial sale followed by collection: sales counted once
  // ----------------------------------------------------
  {
    console.log('Running Test 7: Partial sale followed by collection (sales counted once)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();

    const posPayload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Partial Client',
      clientPhone: '+92 (300) 555-4444',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 2000,
          billAllocation: 2000,
          tipAllocation: 0,
          cashTendered: 2000,
          changeReturned: 0,
        },
      ],
    };

    const inv = await mockSalonService.postPOSInvoice(posPayload, adminUser);
    assert(inv.status === 'PARTIAL', 'Invoice status must be PARTIAL.');
    assert(inv.amountDue === 2060, 'Outstanding due must be 2060 PKR.');

    const collectPayload: CollectOutstandingPaymentInput = {
      invoiceId: inv.id,
      idempotencyKey: `COLLECT-TEST-${Date.now()}`,
      payments: [
        {
          method: 'CASH',
          amount: 2060,
          billAllocation: 2060,
          tipAllocation: 0,
          cashTendered: 2060,
          changeReturned: 0,
        },
      ],
    };

    const updatedInv = await mockSalonService.collectInvoicePayment(collectPayload, adminUser);
    assert(updatedInv.status === 'PAID', 'Collected invoice status must be PAID.');
    assert(updatedInv.amountDue === 0, 'Remaining balance due must be 0 PKR.');
    assert(updatedInv.netSales === 3500, 'Original net sales must remain 3500 (not duplicated).');

    console.log('✓ Test 7 Passed: Sales revenue was counted once on partial sale and collection.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 8: Cash plus two online accounts: balances reconcile
  // ----------------------------------------------------
  {
    console.log('Running Test 8: Cash plus two online accounts (balances reconcile)...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();

    const acc1Initial = store.paymentAccounts.find((a) => a.id === 'acc-1')!.currentBalance;
    const acc2Initial = store.paymentAccounts.find((a) => a.id === 'acc-2')!.currentBalance;

    const payload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Split Client',
      clientPhone: '+92 (300) 777-8888',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-04')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 5520,
          billAllocation: 5520,
          tipAllocation: 0,
          cashTendered: 6000,
          changeReturned: 480,
        },
        {
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: 'acc-1',
          paymentAccountName: 'Meezan Bank',
          amount: 10000,
          billAllocation: 10000,
          tipAllocation: 0,
        },
        {
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: 'acc-2',
          paymentAccountName: 'HBL Smart POS',
          amount: 10000,
          billAllocation: 10000,
          tipAllocation: 0,
        },
      ],
    };

    const inv = await mockSalonService.postPOSInvoice(payload, adminUser);
    assert(inv.paymentMethod === 'SPLIT', 'Invoice payment method must be SPLIT.');
    assert(inv.payments.length === 3, 'Invoice must contain 3 payment records.');

    const storeAfter = mockStorage.getStore();
    const acc1After = storeAfter.paymentAccounts.find((a) => a.id === 'acc-1')!.currentBalance;
    const acc2After = storeAfter.paymentAccounts.find((a) => a.id === 'acc-2')!.currentBalance;

    assert(acc1After === acc1Initial + 10000, 'Acc 1 balance must increase by exactly 10,000.');
    assert(acc2After === acc2Initial + 10000, 'Acc 2 balance must increase by exactly 10,000.');

    console.log('✓ Test 8 Passed: Cash and 2 online account balances reconciled cleanly.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 9: Cross-branch or Staff posting: rejected
  // ----------------------------------------------------
  {
    console.log('Running Test 9: Cross-branch or Staff posting (rejected)...');
    const { adminUser, staffUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();

    const payload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Unauthorized Client',
      clientPhone: '+92 (300) 000-0000',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 3500,
          billAllocation: 3500,
          tipAllocation: 0,
          cashTendered: 3500,
          changeReturned: 0,
        },
      ],
    };

    // Staff role posting attempt
    mockAuthService.setCurrentSession({
      user: staffUser,
      token: 'staff_token',
      loginTime: new Date().toISOString(),
      activeBranchId: 'branch-1',
    });

    await assertAsyncThrows(async () => {
      await mockSalonService.postPOSInvoice(payload, staffUser);
    }, 'Access Denied: Staff members cannot perform POS billing');

    // Admin posting for cross branch
    mockAuthService.setCurrentSession({
      user: adminUser, // adminUser is branch-1
      token: 'admin_token',
      loginTime: new Date().toISOString(),
      activeBranchId: 'branch-1',
    });

    const crossBranchPayload: CreatePOSInvoiceInput = {
      ...payload,
      branchId: 'branch-2',
    };

    await assertAsyncThrows(async () => {
      await mockSalonService.postPOSInvoice(crossBranchPayload, adminUser);
    }, 'Access Denied: Cannot perform operations for another branch');

    console.log('✓ Test 9 Passed: Staff role and cross-branch postings were rejected.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 10: Historical invoice unchanged after catalogue edits
  // ----------------------------------------------------
  {
    console.log('Running Test 10: Historical invoice unchanged after catalogue edits...');
    const { adminUser, testBranchId } = setupIsolatedTestStore('ADMIN');
    const store = mockStorage.getStore();

    const payload: CreatePOSInvoiceInput = {
      branchId: testBranchId,
      clientName: 'Historical Client',
      clientPhone: '+92 (300) 123-9999',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'c-1',
          type: 'SERVICE',
          item: store.services.find((s) => s.id === 'srv-lhe-01')!,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 0.2,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 4060,
          billAllocation: 4060,
          tipAllocation: 0,
          cashTendered: 4060,
          changeReturned: 0,
        },
      ],
    };

    const inv = await mockSalonService.postPOSInvoice(payload, adminUser);
    assert(inv.lineItems[0].unitPrice === 3500, 'Original line item unit price must be 3500.');

    // Edit service catalogue price to 9999
    const liveStore = mockStorage.getStore();
    const targetService = liveStore.services.find((s) => s.id === 'srv-lhe-01')!;
    targetService.price = 9999;
    mockStorage.saveStore(liveStore);

    const historicInv = await mockSalonService.getInvoice(inv.id);
    assert(historicInv !== null, 'Historical invoice must be retrievable.');
    assert(historicInv!.lineItems[0].unitPrice === 3500, 'Historical invoice line item unitPrice must remain 3500 after catalogue edit.');
    assert(historicInv!.total === 4060, 'Historical invoice total must remain 4060.');

    console.log('✓ Test 10 Passed: Historic invoice snapshots remained unchanged after catalogue price edit.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 11: Legacy custom account migration preserves data
  // ----------------------------------------------------
  {
    console.log('Running Test 11: Legacy custom account migration preserves data...');
    setupIsolatedTestStore('ADMIN');

    const fakeV2 = {
      version: 'isysware_salon_store_v2',
      systemDate: '2026-09-28',
      branches: mockStorage.getStore().branches,
      users: mockStorage.getStore().users,
      onlineAccounts: [
        {
          id: 'acc-custom-legacy-99',
          branchId: 'branch-1',
          accountName: 'Custom Legacy Bank Account',
          bankName: 'Standard Chartered Bank',
          type: 'BANK_CHECKING',
          accountNumberMasked: '····9988',
          currentBalance: 888000.0,
          isActive: true,
        },
      ],
    };

    const migrated = (mockStorage as any).migrateV2ToV3(fakeV2);
    const customAcc = migrated.paymentAccounts.find((a: any) => a.id === 'acc-custom-legacy-99');

    assert(customAcc !== undefined, 'Custom legacy account must be present in migrated paymentAccounts.');
    assert(customAcc.currentBalance === 888000.0, 'Custom legacy account balance must be preserved (888,000 PKR).');
    assert(customAcc.name === 'Custom Legacy Bank Account', 'Custom legacy account name must be preserved.');

    console.log('✓ Test 11 Passed: Legacy custom online account migrated without data loss.\n');
    passedCount++;
  }

  console.log('====================================================');
  console.log(`  SUITE COMPLETED SUCCESSFULLY: ${passedCount}/11 TESTS PASSED`);
  console.log('====================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
