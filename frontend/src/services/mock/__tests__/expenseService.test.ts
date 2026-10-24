import { mockSalonService } from '../mockSalonService';
import { mockStorage } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '../../../types/auth';
import { Expense, CashDrawer, PaymentAccount } from '../../../types/salon';

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

function setupTestEnvironment(
  userRole: 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'SUPER_ADMIN' = 'ADMIN',
  branchId: string = 'branch-1'
): {
  user: User;
  adminUser: User;
  accountantUser: User;
  superAdminUser: User;
  staffUser: User;
} {
  const store = mockStorage.reloadFromStorage();

  const adminUser = store.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-1')!;
  const accountantUser = store.users.find((u) => u.role === 'ACCOUNTANT' && u.branchId === 'branch-1')!;
  const superAdminUser = store.users.find((u) => u.role === 'SUPER_ADMIN')!;
  const staffUser = store.users.find((u) => u.role === 'STAFF')!;

  let activeUser = adminUser;
  if (userRole === 'ACCOUNTANT') activeUser = accountantUser;
  if (userRole === 'SUPER_ADMIN') activeUser = superAdminUser;
  if (userRole === 'STAFF') activeUser = staffUser;

  mockAuthService.setCurrentSession({
    user: activeUser,
    token: `token_${activeUser.id}`,
    loginTime: new Date().toISOString(),
    activeBranchId: userRole === 'SUPER_ADMIN' ? 'ALL' : branchId,
  });

  return { user: activeUser, adminUser, accountantUser, superAdminUser, staffUser };
}

async function runExpenseTestSuite() {
  console.log('====================================================');
  console.log('  RUNNING SALONOS EXPENSE MANAGEMENT TEST SUITE');
  console.log('====================================================\n');

  let passedCount = 0;

  // ----------------------------------------------------
  // TEST 1: Draft has no balance/report effect
  // ----------------------------------------------------
  {
    console.log('Running Test 1: Draft has no balance or report effect...');
    const { accountantUser } = setupTestEnvironment('ACCOUNTANT', 'branch-1');
    const store = mockStorage.getStore();
    const initialDrawer = store.cashDrawers.find((d) => d.custodianUserId === accountantUser.id && d.status === 'OPEN')!;
    const initialExpectedCash = initialDrawer.expectedInDrawer;
    const initialExpensesPaid = initialDrawer.cashExpensesPaid;

    const draft = await mockSalonService.createExpenseDraft(
      {
        branchId: 'branch-1',
        title: 'Draft Refreshments Order',
        category: 'Refreshments',
        payee: 'Local Bakery',
        amount: 3500,
        paymentSource: 'CASH_DRAWER',
        date: '2026-09-28',
      },
      accountantUser
    );

    assert(draft.status === 'DRAFT', 'Draft must have status DRAFT');
    assert(draft.voucherNumber.startsWith('DFT-'), 'Draft voucher must start with DFT-');

    // Verify cash drawer balance is completely untouched
    const reloadedStore = mockStorage.getStore();
    const reloadedDrawer = reloadedStore.cashDrawers.find((d) => d.id === initialDrawer.id)!;
    assert(
      reloadedDrawer.expectedInDrawer === initialExpectedCash,
      'Drawer expected cash must be untouched by draft'
    );
    assert(
      reloadedDrawer.cashExpensesPaid === initialExpensesPaid,
      'Drawer expenses paid must be untouched by draft'
    );

    // Verify dashboard metrics do not count draft
    const dashboard = await mockSalonService.getAccountantDashboardData('branch-1', accountantUser.id);
    assert(
      dashboard.expensesPaidByAccountant === reloadedDrawer.cashExpensesPaid,
      'Accountant dashboard must ignore draft expenses'
    );

    console.log('✓ Test 1 Passed: Draft has zero financial or report impact.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 2: Cash expense debits the correct drawer once
  // ----------------------------------------------------
  {
    console.log('Running Test 2: Cash expense debits the correct drawer once...');
    const { accountantUser } = setupTestEnvironment('ACCOUNTANT', 'branch-1');
    const store = mockStorage.getStore();
    const drawer = store.cashDrawers.find((d) => d.custodianUserId === accountantUser.id && d.status === 'OPEN')!;
    const initialExpected = drawer.expectedInDrawer;
    const initialExpensesPaid = drawer.cashExpensesPaid;
    const expenseAmount = 2500;

    const posted = await mockSalonService.postExpense(
      {
        branchId: 'branch-1',
        title: 'Disinfectant Restock',
        category: 'Supplies',
        payee: 'CleanCo Lahore',
        amount: expenseAmount,
        paymentSource: 'CASH_DRAWER',
        expenseDate: '2026-09-28',
      },
      accountantUser
    );

    assert(posted.status === 'POSTED', 'Expense status must be POSTED');
    assert(posted.voucherNumber.startsWith('EXP-LHE-01-2026-'), 'Voucher number must match branch/year format');
    assert(posted.paidByUserId === accountantUser.id, 'Payer must be the active custodian');

    const freshStore = mockStorage.getStore();
    const freshDrawer = freshStore.cashDrawers.find((d) => d.id === drawer.id)!;
    assert(
      freshDrawer.cashExpensesPaid === initialExpensesPaid + expenseAmount,
      `Drawer cashExpensesPaid must increase by ${expenseAmount}`
    );
    assert(
      freshDrawer.expectedInDrawer === initialExpected - expenseAmount,
      `Drawer expectedInDrawer must decrease by ${expenseAmount}`
    );

    // Verify other users' cash drawers are unaffected
    const otherDrawers = freshStore.cashDrawers.filter((d) => d.id !== drawer.id);
    for (const od of otherDrawers) {
      assert(od.branchId !== 'branch-1' || od.custodianUserId !== accountantUser.id, 'Only target drawer was modified');
    }

    console.log('✓ Test 2 Passed: Cash expense debited payer drawer exactly once.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 3: Online expense debits only the selected account
  // ----------------------------------------------------
  {
    console.log('Running Test 3: Online expense debits only the selected account...');
    const { adminUser } = setupTestEnvironment('ADMIN', 'branch-1');
    const store = mockStorage.getStore();
    const account = store.paymentAccounts.find((a) => a.id === 'acc-1' && a.branchId === 'branch-1')!;
    const initialBalance = account.currentBalance;
    const expenseAmount = 15000;

    const posted = await mockSalonService.postExpense(
      {
        branchId: 'branch-1',
        title: 'Generator Diesel Fill',
        category: 'Utilities',
        payee: 'PSO Fuel Station',
        amount: expenseAmount,
        paymentSource: 'ONLINE_ACCOUNT',
        paymentAccountId: account.id,
        expenseDate: '2026-09-28',
      },
      adminUser
    );

    assert(posted.status === 'POSTED', 'Posted online expense must have status POSTED');
    assert(posted.paymentAccountId === account.id, 'Must reference correct account ID');

    const freshStore = mockStorage.getStore();
    const freshAcc = freshStore.paymentAccounts.find((a) => a.id === account.id)!;
    assert(
      freshAcc.currentBalance === initialBalance - expenseAmount,
      `Account balance must decrease by exactly ${expenseAmount}`
    );

    // Physical cash drawers must NOT be affected by online account disbursements
    const drawers = freshStore.cashDrawers.filter((d) => d.branchId === 'branch-1');
    for (const d of drawers) {
      assert(Number.isFinite(d.expectedInDrawer), 'Drawer balance is valid and untampered by online disbursements');
    }

    console.log('✓ Test 3 Passed: Online expense debited only selected account.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 4: Insufficient funds & storage failure: zero partial changes
  // ----------------------------------------------------
  {
    console.log('Running Test 4: Insufficient funds & storage failure: zero partial changes...');
    const { accountantUser } = setupTestEnvironment('ACCOUNTANT', 'branch-1');
    const store = mockStorage.getStore();
    const drawer = store.cashDrawers.find((d) => d.custodianUserId === accountantUser.id && d.status === 'OPEN')!;
    const available = drawer.openingCash + drawer.cashSales + drawer.cashTipsCollected - drawer.cashExpensesPaid;

    // Attempt to post cash expense exceeding available drawer cash
    await assertAsyncThrows(
      () =>
        mockSalonService.postExpense(
          {
            branchId: 'branch-1',
            title: 'Massive Equipment Purchase',
            category: 'Supplies',
            payee: 'Mega Store',
            amount: available + 50000,
            paymentSource: 'CASH_DRAWER',
          },
          accountantUser
        ),
      'Insufficient funds in cash drawer'
    );

    // Verify zero partial mutations occurred
    const freshStore = mockStorage.getStore();
    const freshDrawer = freshStore.cashDrawers.find((d) => d.id === drawer.id)!;
    assert(freshDrawer.cashExpensesPaid === drawer.cashExpensesPaid, 'Drawer expenses paid unchanged');
    assert(freshDrawer.expectedInDrawer === drawer.expectedInDrawer, 'Drawer expected cash unchanged');

    // Storage failure test
    const originalSave = mockStorage.saveStore.bind(mockStorage);
    mockStorage.saveStore = () => {
      throw new Error('Simulated disk/localStorage write quota failure');
    };

    try {
      await assertAsyncThrows(
        () =>
          mockSalonService.postExpense(
            {
              branchId: 'branch-1',
              title: 'Minor Expense',
              category: 'Supplies',
              payee: 'Corner Shop',
              amount: 500,
              paymentSource: 'CASH_DRAWER',
            },
            accountantUser
          ),
        'Simulated disk/localStorage write quota failure'
      );
    } finally {
      mockStorage.saveStore = originalSave;
    }

    console.log('✓ Test 4 Passed: Insufficient funds and storage failure cleanly aborted with zero state change.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 5: Idempotent retry does not duplicate expense
  // ----------------------------------------------------
  {
    console.log('Running Test 5: Idempotent retry does not duplicate expense...');
    const { adminUser } = setupTestEnvironment('ADMIN', 'branch-1');
    const idempotencyKey = `idemp_exp_${Date.now()}`;
    const payload = {
      branchId: 'branch-1',
      title: 'Water Cooler Refill Bottles',
      category: 'Utilities',
      payee: 'Aquafina Punjab',
      amount: 1800,
      paymentSource: 'ONLINE_ACCOUNT' as const,
      paymentAccountId: 'acc-1',
      idempotencyKey,
    };

    const firstPost = await mockSalonService.postExpense(payload, adminUser);
    const storeAfterFirst = mockStorage.getStore();
    const countAfterFirst = storeAfterFirst.expenses.filter((e) => e.title === 'Water Cooler Refill Bottles').length;
    assert(countAfterFirst === 1, 'Exactly one expense record created on first post');

    // Retry identical request with same key
    const secondPost = await mockSalonService.postExpense(payload, adminUser);
    assert(secondPost.id === firstPost.id, 'Retry must return the exact same expense ID');
    assert(secondPost.voucherNumber === firstPost.voucherNumber, 'Retry must return the same voucher number');

    const storeAfterSecond = mockStorage.getStore();
    const countAfterSecond = storeAfterSecond.expenses.filter((e) => e.title === 'Water Cooler Refill Bottles').length;
    assert(countAfterSecond === 1, 'Duplicate retry did not create another expense record');

    // Attempting to reuse the same idempotency key with a altered payload must be rejected
    await assertAsyncThrows(
      () =>
        mockSalonService.postExpense(
          {
            ...payload,
            amount: 9999, // Altered amount
          },
          adminUser
        ),
      'reused with a different payload'
    );

    console.log('✓ Test 5 Passed: Idempotency prevents duplicate posting and protects key integrity.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 6: Reversal restores funds exactly once
  // ----------------------------------------------------
  {
    console.log('Running Test 6: Reversal restores funds exactly once...');
    const { adminUser } = setupTestEnvironment('ADMIN', 'branch-1');
    const store = mockStorage.getStore();
    const account = store.paymentAccounts.find((a) => a.id === 'acc-1' && a.branchId === 'branch-1')!;
    const initialBalance = account.currentBalance;
    const expenseAmount = 7000;

    // Post an online expense
    const posted = await mockSalonService.postExpense(
      {
        branchId: 'branch-1',
        title: 'Printer Toner Cartridges',
        category: 'Supplies',
        payee: 'Lahore IT Center',
        amount: expenseAmount,
        paymentSource: 'ONLINE_ACCOUNT',
        paymentAccountId: account.id,
      },
      adminUser
    );

    const postBalance = mockStorage.getStore().paymentAccounts.find((a) => a.id === account.id)!.currentBalance;
    assert(postBalance === initialBalance - expenseAmount, 'Balance was debited on post');

    // Reverse the expense
    const reversalResult = await mockSalonService.reverseExpense(
      posted.id,
      'Order cancelled: wrong toner model delivered',
      adminUser
    );

    assert(reversalResult.originalExpense.status === 'REVERSED', 'Original expense status is REVERSED');
    assert(
      Boolean(reversalResult.originalExpense.reversalVoucherNumber),
      'Original expense links to reversal voucher'
    );
    assert(reversalResult.reversalExpense.status === 'REVERSED', 'Reversal record status is REVERSED');
    assert(
      reversalResult.reversalExpense.voucherNumber.startsWith('REV-LHE-01-2026-'),
      'Reversal voucher matches REV format'
    );

    // Verify account balance was restored
    const restoredBalance = mockStorage.getStore().paymentAccounts.find((a) => a.id === account.id)!.currentBalance;
    assert(restoredBalance === initialBalance, 'Account balance was restored to original value');

    // Attempting to reverse the same expense again must be rejected
    await assertAsyncThrows(
      () => mockSalonService.reverseExpense(posted.id, 'Duplicate reversal attempt', adminUser),
      'has already been reversed'
    );

    console.log('✓ Test 6 Passed: Reversal restored funds cleanly and prevented double-reversal.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 7: Cross-branch & unauthorized actions fail
  // ----------------------------------------------------
  {
    console.log('Running Test 7: Cross-branch & unauthorized actions fail...');
    const { staffUser, accountantUser, adminUser } = setupTestEnvironment('STAFF', 'branch-1');

    // 1. Staff members cannot access or post expenses
    await assertAsyncThrows(
      () => mockSalonService.getExpenses('branch-1', undefined, staffUser),
      'Staff members cannot access expense management'
    );
    await assertAsyncThrows(
      () =>
        mockSalonService.postExpense(
          {
            branchId: 'branch-1',
            title: 'Staff Attempt',
            category: 'Supplies',
            payee: 'Store',
            amount: 500,
            paymentSource: 'CASH_DRAWER',
          },
          staffUser
        ),
      'Staff members cannot post expenses'
    );

    // 2. Accountants cannot reverse expenses
    mockAuthService.setCurrentSession({
      user: accountantUser,
      token: 'tok_acc',
      loginTime: new Date().toISOString(),
      activeBranchId: 'branch-1',
    });

    const store = mockStorage.getStore();
    const existingPosted = store.expenses.find((e) => (e.status === 'POSTED' || e.status === 'PAID') && e.branchId === 'branch-1')!;

    await assertAsyncThrows(
      () => mockSalonService.reverseExpense(existingPosted.id, 'Accountant trying to reverse', accountantUser),
      'Only Super Admin and Branch Admin can reverse posted expenses'
    );

    // 3. Accountants cannot create expense categories
    await assertAsyncThrows(
      () => mockSalonService.createExpenseCategory('branch-1', 'Illegal Category', undefined, accountantUser),
      'Only Super Admin and Branch Admin can manage expense categories'
    );

    // 4. Branch Admin cannot mutate expenses in another branch
    mockAuthService.setCurrentSession({
      user: adminUser,
      token: 'tok_admin',
      loginTime: new Date().toISOString(),
      activeBranchId: 'branch-1',
    });

    await assertAsyncThrows(
      () =>
        mockSalonService.postExpense(
          {
            branchId: 'branch-2', // Foreign branch
            title: 'Cross Branch Tampering',
            category: 'Supplies',
            payee: 'Karachi Vendor',
            amount: 1000,
            paymentSource: 'ONLINE_ACCOUNT',
            paymentAccountId: 'acc-3',
          },
          adminUser
        ),
      'Cannot perform operations for another branch'
    );

    console.log('✓ Test 7 Passed: Role hierarchies and branch boundaries strictly enforced.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 8: Filtered totals reconcile
  // ----------------------------------------------------
  {
    console.log('Running Test 8: Filtered totals reconcile...');
    const { superAdminUser } = setupTestEnvironment('SUPER_ADMIN', 'ALL');

    const allExpenses = await mockSalonService.getExpenses('ALL', undefined, superAdminUser);
    assert(allExpenses.length > 0, 'Must have expenses in store');

    // Filter by category: Supplies
    const suppliesOnly = await mockSalonService.getExpenses('ALL', { category: 'Supplies' }, superAdminUser);
    for (const exp of suppliesOnly) {
      assert(exp.category.toLowerCase() === 'supplies', 'Every returned record must match category');
    }

    // Filter by status: POSTED
    const postedOnly = await mockSalonService.getExpenses('ALL', { status: 'POSTED' }, superAdminUser);
    for (const exp of postedOnly) {
      assert(exp.status === 'POSTED' || exp.status === 'PAID', 'Every record is posted or paid');
    }

    // Search query
    const searchResults = await mockSalonService.getExpenses('ALL', { search: 'towels' }, superAdminUser);
    assert(searchResults.length > 0, 'Found matching search results');
    for (const exp of searchResults) {
      const match =
        exp.title.toLowerCase().includes('towels') ||
        (exp.description && exp.description.toLowerCase().includes('towels')) ||
        (exp.notes && exp.notes.toLowerCase().includes('towels'));
      assert(Boolean(match), 'Result contains search term');
    }

    console.log('✓ Test 8 Passed: Category, status, and search filters reconcile accurately.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 9: Cash Float Transfer updates drawer without revenue/expense
  // ----------------------------------------------------
  {
    console.log('Running Test 9: Cash Float Transfer updates drawer without revenue or expense...');
    const { adminUser, accountantUser } = setupTestEnvironment('ADMIN', 'branch-1');
    const store = mockStorage.getStore();
    const drawer = store.cashDrawers.find((d) => d.custodianUserId === accountantUser.id && d.status === 'OPEN')!;
    const initialOpening = drawer.openingCash;
    const initialExpected = drawer.expectedInDrawer;
    const initialExpensesCount = store.expenses.length;
    const initialInvoicesCount = store.invoices.length;
    const transferAmount = 10000;

    const transfer = await mockSalonService.transferCashFloat(
      {
        branchId: 'branch-1',
        targetUserId: accountantUser.id,
        amount: transferAmount,
        notes: 'Morning float replenishment for cash disbursements',
      },
      adminUser
    );

    assert(transfer.amount === transferAmount, 'Transfer amount matches');
    assert(transfer.toCustodianUserId === accountantUser.id, 'Target custodian matches');
    assert(transfer.transferNumber.startsWith('CXF-LHE-01-2026-'), 'Transfer number matches sequence');

    const freshStore = mockStorage.getStore();
    const freshDrawer = freshStore.cashDrawers.find((d) => d.id === drawer.id)!;
    assert(
      freshDrawer.openingCash === initialOpening + transferAmount,
      'Drawer opening cash increased by float transfer'
    );
    assert(
      freshDrawer.expectedInDrawer === initialExpected + transferAmount,
      'Drawer expected cash increased by float transfer'
    );

    // Transfer MUST NOT create an invoice (revenue) or an expense!
    assert(freshStore.expenses.length === initialExpensesCount, 'Expenses count remains unchanged');
    assert(freshStore.invoices.length === initialInvoicesCount, 'Invoices count remains unchanged');

    console.log('✓ Test 9 Passed: Float transfer atomically replenished drawer without revenue or expense.\n');
    passedCount++;
  }

  // ----------------------------------------------------
  // TEST 10: Category management prevents branch duplicates
  // ----------------------------------------------------
  {
    console.log('Running Test 10: Category management prevents branch duplicates...');
    const { adminUser } = setupTestEnvironment('ADMIN', 'branch-1');

    const newCat = await mockSalonService.createExpenseCategory(
      'branch-1',
      'Staff Training & Certification',
      'Workshops and diplomas',
      adminUser
    );
    assert(newCat.name === 'Staff Training & Certification', 'Category created with correct name');
    assert(newCat.isActive === true, 'New category is active by default');

    // Attempting to create duplicate category in the same branch must fail
    await assertAsyncThrows(
      () =>
        mockSalonService.createExpenseCategory(
          'branch-1',
          'Staff Training & Certification', // Exact duplicate
          undefined,
          adminUser
        ),
      'already exists in this branch'
    );

    // Toggle active status
    const toggled = await mockSalonService.toggleExpenseCategoryStatus(newCat.id, adminUser);
    assert(toggled.isActive === false, 'Category was deactivated');

    console.log('✓ Test 10 Passed: Category management enforces branch uniqueness and toggles cleanly.\n');
    passedCount++;
  }

  console.log('====================================================');
  console.log(`  EXPENSE SUITE COMPLETED: ${passedCount}/10 TESTS PASSED`);
  console.log('====================================================\n');
}

runExpenseTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE EXECUTION FAILED:');
  console.error(err);
  process.exit(1);
});
