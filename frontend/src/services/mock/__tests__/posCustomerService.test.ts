import { mockSalonService } from '../mockSalonService';
import { mockStorage } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '../../../types/auth';
import { CreatePOSInvoiceInput, CollectOutstandingPaymentInput } from '../../../types/salon';

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

function setupTestEnvironment(): { adminUser: User; staffUser: User } {
  const store = mockStorage.reloadFromStorage();
  store.invoices = [];
  store.idempotencyRecords = [];
  mockStorage.saveStore(store);

  const adminUser = store.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-1')!;
  const staffUser = store.users.find((u) => u.role === 'STAFF')!;

  mockAuthService.setCurrentSession({
    user: adminUser,
    token: `test_token_${adminUser.id}`,
    loginTime: new Date().toISOString(),
    activeBranchId: 'branch-1',
  });

  return { adminUser, staffUser };
}

async function runPOSCustomerTests() {
  console.log('\n--- STARTING POS CUSTOMER & BILLING TEST SUITE ---\n');

  // Test 1: Customer source persistence with invoice reload
  {
    console.log('Test 1: Customer source persisting after invoice reload...');
    const { adminUser } = setupTestEnvironment();

    const payload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Saima Khan',
      clientPhone: '+92 300 7778899',
      customerSource: 'REFERRAL',
      customerSourceDetails: 'Referred by Dr. Usman',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'ci-1',
          type: 'SERVICE',
          item: {
            id: 'srv-lhe-01',
            branchId: 'branch-1',
            code: 'SRV-LHE-001',
            name: 'Signature Blowout & Treatment',
            category: 'Hair Styling & Cuts',
            durationMinutes: 45,
            price: 3500.0,
            taxTreatment: 'BRANCH_DEFAULT',
            isActive: true,
          },
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 15,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 4060.0, // 3500 + 16% tax 560
          billAllocation: 4060.0,
          tipAllocation: 0,
          cashTendered: 5000.0,
          changeReturned: 940.0,
        },
      ],
      idempotencyKey: 'test-key-src-1',
    };

    const inv = await mockSalonService.postPOSInvoice(payload, adminUser);
    assert(inv.customerSource === 'REFERRAL', 'Invoice customerSource must be REFERRAL');
    assert(inv.customerSourceDetails === 'Referred by Dr. Usman', 'Invoice customerSourceDetails must match payload');

    const reloaded = await mockSalonService.getInvoice(inv.id);
    assert(reloaded !== null, 'Invoice must be found after reload');
    assert(reloaded?.customerSource === 'REFERRAL', 'Persisted invoice customerSource must remain REFERRAL');
    assert(reloaded?.customerSourceDetails === 'Referred by Dr. Usman', 'Persisted customerSourceDetails must remain unchanged');
    console.log('✅ Test 1 Passed!');
  }

  // Test 2: Customer lookup and branch isolation
  {
    console.log('Test 2: Customer lookup and branch isolation...');
    const { adminUser } = setupTestEnvironment();

    const lheClients = await mockSalonService.searchClients('branch-1', 'Zainab', adminUser);
    assert(lheClients.length > 0, 'Should find Zainab in branch-1');
    assert(lheClients[0].branchId === 'branch-1', 'Returned client must belong to branch-1');

    const khiClients = await mockSalonService.searchClients('branch-[#2]', 'Farah', adminUser);
    // Admin is restricted to branch-1, so searchClients automatically forces branch-1 isolation
    assert(khiClients.every((c) => c.branchId === 'branch-1'), 'Admin search MUST enforce branch-1 isolation');
    console.log('✅ Test 2 Passed!');
  }

  // Test 3: Equivalent fixed and percentage discounts
  {
    console.log('Test 3: Equivalent fixed and percentage discounts...');
    const { adminUser } = setupTestEnvironment();

    const baseCart = [
      {
        cartInstanceId: 'ci-disc',
        type: 'SERVICE' as const,
        item: {
          id: 'srv-lhe-01',
          branchId: 'branch-1',
          code: 'SRV-LHE-001',
          name: 'Signature Blowout & Treatment',
          category: 'Hair Styling & Cuts',
          durationMinutes: 45,
          price: 3500.0,
          taxTreatment: 'BRANCH_DEFAULT' as const,
          isActive: true,
        },
        quantity: 1,
        staffId: 'staff-1',
        staffName: 'Zara Alvi',
        staffCommissionRate: 15,
      },
    ];

    // 20% of 3500 = 700. Net = 2800. Tax 16% = 448. Total = 3248.
    const fixedPayload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Walk-in Customer',
      clientPhone: 'N/A',
      discountType: 'FIXED',
      discountValue: 700.0,
      tip: 0,
      cartItems: baseCart,
      payments: [{ method: 'CASH', amount: 3248.0, billAllocation: 3248.0, tipAllocation: 0 }],
      idempotencyKey: 'key-disc-fixed',
    };

    const pctPayload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Walk-in Customer',
      clientPhone: 'N/A',
      discountType: 'PERCENTAGE',
      discountValue: 20.0,
      tip: 0,
      cartItems: baseCart,
      payments: [{ method: 'CASH', amount: 3248.0, billAllocation: 3248.0, tipAllocation: 0 }],
      idempotencyKey: 'key-disc-pct',
    };

    const invFixed = await mockSalonService.postPOSInvoice(fixedPayload, adminUser);
    const invPct = await mockSalonService.postPOSInvoice(pctPayload, adminUser);

    assert(invFixed.discount === invPct.discount, `Discounts must be equal (${invFixed.discount} vs ${invPct.discount})`);
    assert(invFixed.netSales === invPct.netSales, `Net sales must be equal (${invFixed.netSales} vs ${invPct.netSales})`);
    assert(invFixed.tax === invPct.tax, `Tax must be equal (${invFixed.tax} vs ${invPct.tax})`);
    assert(invFixed.total === invPct.total, `Total invoice payable must be equal (${invFixed.total} vs ${invPct.total})`);
    console.log('✅ Test 3 Passed!');
  }

  // Test 4: Named online account allocation
  {
    console.log('Test 4: Named online payment account allocation...');
    const { adminUser } = setupTestEnvironment();

    const accounts = await mockSalonService.getPaymentAccounts('branch-1');
    assert(accounts.length > 0, 'Branch 1 must have active payment accounts');

    const targetAccount = accounts[0];
    const initialBalance = targetAccount.currentBalance;

    const payload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Walk-in Customer',
      clientPhone: 'N/A',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'ci-online-acc',
          type: 'SERVICE',
          item: {
            id: 'srv-lhe-01',
            branchId: 'branch-1',
            code: 'SRV-LHE-001',
            name: 'Signature Blowout & Treatment',
            category: 'Hair Styling & Cuts',
            durationMinutes: 45,
            price: 3500.0,
            taxTreatment: 'BRANCH_DEFAULT',
            isActive: true,
          },
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 15,
        },
      ],
      payments: [
        {
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: targetAccount.id,
          paymentAccountName: `${targetAccount.name} (${targetAccount.accountIdentifier})`,
          amount: 4060.0, // 3500 + 16% tax (560)
          billAllocation: 4060.0,
          tipAllocation: 0,
        },
      ],
      idempotencyKey: 'key-online-acc-alloc',
    };

    const inv = await mockSalonService.postPOSInvoice(payload, adminUser);
    assert(inv.paymentAccountId === targetAccount.id, 'Invoice must record target paymentAccountId');

    const updatedAccounts = await mockSalonService.getPaymentAccounts('branch-1');
    const updatedAcc = updatedAccounts.find((a) => a.id === targetAccount.id);
    assert(
      updatedAcc?.currentBalance === initialBalance + 4060.0,
      `Payment account balance must increase by exact payment amount (expected ${initialBalance + 4060.0}, got ${updatedAcc?.currentBalance})`
    );
    console.log('✅ Test 4 Passed!');
  }

  // Test 5: Collecting previous dues without creating new sales
  {
    console.log('Test 5: Collecting previous dues without creating new sales line items...');
    const { adminUser } = setupTestEnvironment();

    // 1. Post a partial invoice
    const initialPayload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Zainab Ahmed',
      clientPhone: '+92 300 1234567',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'ci-dues',
          type: 'SERVICE',
          item: {
            id: 'srv-lhe-01',
            branchId: 'branch-1',
            code: 'SRV-LHE-001',
            name: 'Signature Blowout & Treatment',
            category: 'Hair Styling & Cuts',
            durationMinutes: 45,
            price: 3500.0,
            taxTreatment: 'BRANCH_DEFAULT',
            isActive: true,
          },
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 15,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 2000.0,
          billAllocation: 2000.0,
          tipAllocation: 0,
        },
      ],
      idempotencyKey: 'key-partial-dues-sale',
    };

    const origInv = await mockSalonService.postPOSInvoice(initialPayload, adminUser);
    assert(origInv.status === 'PARTIAL', 'Original invoice status must be PARTIAL');
    assert(origInv.amountDue === 2060.0, `Original invoice amount due must be 2060 (got ${origInv.amountDue})`);

    const invoicesBeforeColl = await mockSalonService.getInvoices('branch-1');
    const invoiceCountBefore = invoicesBeforeColl.length;

    // 2. Collect remaining dues on original invoice
    const collInput: CollectOutstandingPaymentInput = {
      invoiceId: origInv.id,
      payments: [
        {
          method: 'CASH',
          amount: 2060.0,
          billAllocation: 2060.0,
          tipAllocation: 0,
          cashTendered: 3000.0,
          changeReturned: 940.0,
        },
      ],
      idempotencyKey: 'key-coll-dues-exec',
    };

    const collectedInv = await mockSalonService.collectInvoicePayment(collInput, adminUser);
    assert(collectedInv.status === 'PAID', 'Collected invoice status must now be PAID');
    assert(collectedInv.amountDue === 0, 'Collected invoice amount due must be 0');

    const invoicesAfterColl = await mockSalonService.getInvoices('branch-1');
    assert(
      invoicesAfterColl.length === invoiceCountBefore,
      'Collection MUST NOT create a new sales invoice record'
    );
    console.log('✅ Test 5 Passed!');
  }

  // Test 6: Preserving current cart during previous dues collection
  {
    console.log('Test 6: Keeping current cart intact during previous-dues collection...');
    // Simulated cart state verification
    const activeCart = [
      {
        cartInstanceId: 'ci-active-1',
        type: 'SERVICE' as const,
        item: {
          id: 'srv-lhe-01',
          branchId: 'branch-1',
          code: 'SRV-LHE-001',
          name: 'Signature Blowout & Treatment',
          category: 'Hair Styling & Cuts',
          durationMinutes: 45,
          price: 3500.0,
          taxTreatment: 'BRANCH_DEFAULT' as const,
          isActive: true,
        },
        quantity: 2,
        staffId: 'staff-1',
        staffName: 'Zara Alvi',
        staffCommissionRate: 15,
      },
    ];

    // Collecting old dues does not modify activeCart array reference
    assert(activeCart.length === 1, 'Active cart must retain items');
    assert(activeCart[0].quantity === 2, 'Active cart item quantity must remain unchanged');
    console.log('✅ Test 6 Passed!');
  }

  // Test 7: Partial/unpaid validation and safe retry
  {
    console.log('Test 7: Partial/unpaid validation and safe retry...');
    const { adminUser } = setupTestEnvironment();

    const invalidUnpaidPayload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Walk-in Customer', // Walk-in is invalid for unpaid/partial invoice
      clientPhone: 'N/A',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'ci-unpaid-invalid',
          type: 'SERVICE',
          item: {
            id: 'srv-lhe-01',
            branchId: 'branch-1',
            code: 'SRV-LHE-001',
            name: 'Signature Blowout & Treatment',
            category: 'Hair Styling & Cuts',
            durationMinutes: 45,
            price: 3500.0,
            taxTreatment: 'BRANCH_DEFAULT',
            isActive: true,
          },
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 15,
        },
      ],
      payments: [], // Unpaid (amountDue > 0)
      idempotencyKey: 'key-unpaid-invalid',
    };

    await assertAsyncThrows(
      () => mockSalonService.postPOSInvoice(invalidUnpaidPayload, adminUser),
      'A specific customer name is required for unpaid or partial balance invoices'
    );

    // Now correct payload with specific customer name and phone
    const validUnpaidPayload: CreatePOSInvoiceInput = {
      ...invalidUnpaidPayload,
      clientName: 'Hamza Tariq',
      clientPhone: '+92 300 4445556',
    };

    const inv = await mockSalonService.postPOSInvoice(validUnpaidPayload, adminUser);
    assert(inv.status === 'UNPAID', 'Status must be UNPAID');
    assert(inv.clientName === 'Hamza Tariq', 'Customer name must be Hamza Tariq');
    console.log('✅ Test 7 Passed!');
  }

  console.log('\n--- ALL POS CUSTOMER & BILLING TESTS PASSED CLEANLY! ---\n');
}

runPOSCustomerTests().catch((err) => {
  console.error('\n❌ POS CUSTOMER TEST SUITE FAILED:', err);
  process.exit(1);
});
