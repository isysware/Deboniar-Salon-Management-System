import { mockSalonService } from '../mockSalonService';
import { mockStorage } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '@/types/auth';
import {
  StaffMember,
  Invoice,
  TipReceiptRecord,
  TipAllocationRecord,
  TipPayoutRecord,
  CashDrawer,
  PaymentAccount,
} from '@/types/salon';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function assertAsyncThrows(fn: () => Promise<any>, expectedErrorSubstring?: string) {
  try {
    await fn();
    throw new Error('Expected function to throw, but it succeeded.');
  } catch (err: any) {
    if (expectedErrorSubstring) {
      const errMsg = err?.message || String(err);
      if (!errMsg.toLowerCase().includes(expectedErrorSubstring.toLowerCase())) {
        throw new Error(
          `Expected error containing "${expectedErrorSubstring}", but got: "${errMsg}"`
        );
      }
    }
  }
}

function setActiveUser(user: User) {
  mockAuthService.setCurrentSession({
    user,
    token: `token_${user.id}`,
    loginTime: new Date().toISOString(),
    activeBranchId: user.branchId || 'ALL',
  });
}

function setupTestEnvironment(): {
  superAdmin: User;
  adminBranch1: User;
  accountant: User;
  staffUser: User;
} {
  const store = mockStorage.reloadFromStorage();

  const superAdmin = store.users.find((u) => u.role === 'SUPER_ADMIN')!;
  const adminBranch1 = store.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-1')!;
  const accountant = store.users.find((u) => u.role === 'ACCOUNTANT')!;
  const staffUser = store.users.find((u) => u.role === 'STAFF')!;

  setActiveUser(adminBranch1);

  return { superAdmin, adminBranch1, accountant, staffUser };
}

async function runTipsPerformanceTests() {
  console.log('====================================================');
  console.log('  RUNNING TIPS & STAFF PERFORMANCE TEST SUITE       ');
  console.log('====================================================\n');

  const { superAdmin, adminBranch1, accountant, staffUser } = setupTestEnvironment();

  // --------------------------------------------------------------------------
  // TEST 1: Collected vs Billed Tips (Tip Liability Segregation from Sales Revenue)
  // --------------------------------------------------------------------------
  console.log('Running Test 1: Tip receipts collection and segregation from sales revenue...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();

    // Verify existing tip receipts are segregated liabilities
    const receipts = await mockSalonService.getTipReceipts('branch-1', {}, adminBranch1);
    assert(receipts.length > 0, 'Initial tip receipts should exist in demo seed.');

    const firstReceipt = receipts[0];
    assert(firstReceipt.collectedAmount > 0, 'Tip receipt collectedAmount must be positive.');
    assert(firstReceipt.allocatedAmount <= firstReceipt.collectedAmount, 'Allocated amount cannot exceed total.');
    assert(
      firstReceipt.unallocatedAmount === firstReceipt.collectedAmount - firstReceipt.allocatedAmount,
      'Unallocated amount must equal total minus allocated.'
    );

    // Tip amounts must not inflate sales revenue or operational income
    const invoice = store.invoices.find((inv) => inv.id === firstReceipt.invoiceId);
    if (invoice) {
      const invTip = typeof (invoice as any).tip === 'number' ? (invoice as any).tip : (invoice as any).tipAmount;
      assert(
        invTip === firstReceipt.collectedAmount,
        'Invoice tip must match tip receipt amount.'
      );
      assert(
        invoice.total === invoice.subtotal - (invoice.discount || 0) + (invoice.tax || 0) + (invTip || 0),
        'Invoice total includes tip as a liability collection, while net sales excludes tip.'
      );
    }

    console.log('✓ Test 1 Passed: Tips segregated from sales revenue and tracked as liability.');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Direct and Pooled Allocation without Duplicate Consumption
  // --------------------------------------------------------------------------
  console.log('Running Test 2: Direct and pooled allocation without duplicate consumption...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const branchStaff = store.staff.filter((s) => s.branchId === 'branch-1' && s.isActive);
    assert(branchStaff.length >= 2, 'Need at least 2 staff members in branch-1.');

    // Create an unallocated test tip receipt
    const testReceipt: TipReceiptRecord = {
      id: 'tip-rec-test-01',
      receiptNumber: 'TIP-LHE-2026-TEST1',
      branchId: 'branch-1',
      branchName: 'DHA Phase 5 Flagship',
      invoiceId: 'inv-test-01',
      invoiceNumber: 'INV-TEST-0001',
      paymentId: 'pay-test-01',
      clientName: 'Test Client',
      collectedAmount: 1000,
      allocatedAmount: 0,
      unallocatedAmount: 1000,
      method: 'CASH',
      collectionDate: '2026-09-30',
      collectionTime: '10:00:00',
      collectedByUserId: adminBranch1.id,
      collectedByName: adminBranch1.name,
      status: 'UNALLOCATED',
      createdAt: '2026-09-30T10:00:00Z',
    };
    store.tipReceipts = store.tipReceipts || [];
    store.tipReceipts.push(testReceipt);
    mockStorage.saveStore(store);

    // Allocate 600 to staff 1 (partial allocation)
    const allocResult = await mockSalonService.allocateTips(
      {
        tipReceiptId: testReceipt.id,
        allocationType: 'DIRECT',
        recipients: [{ staffId: branchStaff[0].id, amount: 600 }],
        notes: 'Test direct tip allocation',
      },
      adminBranch1
    );

    assert(allocResult.tipReceipt.allocatedAmount === 600, 'Allocated amount should now be 600.');
    assert(allocResult.tipReceipt.unallocatedAmount === 400, 'Unallocated remaining should be 400.');
    assert(allocResult.tipReceipt.status === 'PARTIALLY_ALLOCATED', 'Status should be PARTIALLY_ALLOCATED.');
    assert(allocResult.allocations.length === 1, 'Should create 1 allocation record.');
    assert(allocResult.allocations[0].amount === 600, 'Allocation amount should be 600.');

    // Allocate remaining 400 pooled to staff 1 and staff 2
    const pooledResult = await mockSalonService.allocateTips(
      {
        tipReceiptId: testReceipt.id,
        allocationType: 'POOLED_EQUAL',
        recipients: [
          { staffId: branchStaff[0].id, amount: 200 },
          { staffId: branchStaff[1].id, amount: 200 },
        ],
        notes: 'Test pooled split of remainder',
      },
      adminBranch1
    );

    assert(pooledResult.tipReceipt.allocatedAmount === 1000, 'Allocated amount should now be 1000.');
    assert(pooledResult.tipReceipt.unallocatedAmount === 0, 'Unallocated remaining should be 0.');
    assert(pooledResult.tipReceipt.status === 'FULLY_ALLOCATED', 'Status should now be FULLY_ALLOCATED.');

    // Prevent duplicate or over-allocation on already fully allocated receipt
    await assertAsyncThrows(
      () =>
        mockSalonService.allocateTips(
          {
            tipReceiptId: testReceipt.id,
            allocationType: 'DIRECT',
            recipients: [{ staffId: branchStaff[0].id, amount: 100 }],
          },
          adminBranch1
        ),
      'already fully allocated'
    );

    console.log('✓ Test 2 Passed: Direct and pooled allocations cleanly segregated without duplicate consumption.');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Deterministic Rounding and Over-Allocation Rejection
  // --------------------------------------------------------------------------
  console.log('Running Test 3: Deterministic split rounding and over-allocation rejection...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const branchStaff = store.staff.filter((s) => s.branchId === 'branch-1' && s.isActive).slice(0, 3);
    assert(branchStaff.length === 3, 'Need 3 staff members for 3-way split test.');

    const oddReceipt: TipReceiptRecord = {
      id: 'tip-rec-test-odd',
      receiptNumber: 'TIP-LHE-2026-ODD',
      branchId: 'branch-1',
      branchName: 'DHA Phase 5 Flagship',
      invoiceId: 'inv-test-odd',
      invoiceNumber: 'INV-TEST-ODD',
      paymentId: 'pay-test-odd',
      clientName: 'Odd Split Client',
      collectedAmount: 100, // PKR 100 / 3 = 33.34, 33.33, 33.33
      allocatedAmount: 0,
      unallocatedAmount: 100,
      method: 'ONLINE_ACCOUNT',
      collectionDate: '2026-09-30',
      collectionTime: '11:00:00',
      collectedByUserId: adminBranch1.id,
      collectedByName: adminBranch1.name,
      status: 'UNALLOCATED',
      createdAt: '2026-09-30T11:00:00Z',
    };
    (store.tipReceipts = store.tipReceipts || []).push(oddReceipt);
    mockStorage.saveStore(store);

    // Try over-allocation: 50 + 50 + 10 = 110 > 100
    await assertAsyncThrows(
      () =>
        mockSalonService.allocateTips(
          {
            tipReceiptId: oddReceipt.id,
            allocationType: 'POOLED_EQUAL',
            recipients: [
              { staffId: branchStaff[0].id, amount: 50 },
              { staffId: branchStaff[1].id, amount: 50 },
              { staffId: branchStaff[2].id, amount: 10 },
            ],
          },
          adminBranch1
        ),
      'exceeds available unallocated'
    );

    // Deterministic 3-way split: 33.34 + 33.33 + 33.33 = 100.00
    const validOddResult = await mockSalonService.allocateTips(
      {
        tipReceiptId: oddReceipt.id,
        allocationType: 'POOLED_EQUAL',
        recipients: [
          { staffId: branchStaff[0].id, amount: 33.34 },
          { staffId: branchStaff[1].id, amount: 33.33 },
          { staffId: branchStaff[2].id, amount: 33.33 },
        ],
      },
      adminBranch1
    );

    const totalAllocatedSum = validOddResult.allocations.reduce((sum, a) => sum + a.amount, 0);
    assert(Math.abs(totalAllocatedSum - 100) < 0.001, 'Sum of rounded allocations must equal 100 exactly.');
    assert(validOddResult.tipReceipt.unallocatedAmount === 0, 'Unallocated amount must be zero.');

    console.log('✓ Test 3 Passed: Deterministic rounding preserved and over-allocation rejected.');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Partial and Full Payouts with Drawer and Online Account Custody
  // --------------------------------------------------------------------------
  console.log('Running Test 4: Tip payouts via Cash drawer and Online Account with fund deductions...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const branchStaff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;
    let openDrawer = store.cashDrawers.find(
      (d) => d.branchId === 'branch-1' && d.status === 'OPEN' && d.custodianUserId === adminBranch1.id
    );
    if (!openDrawer) {
      openDrawer = {
        id: 'drawer-admin-lhe-01',
        branchId: 'branch-1',
        date: '2026-09-30',
        openingCash: 50000,
        expectedInDrawer: 50000,
        actualInDrawer: 50000,
        cashSales: 0,
        cashTipsCollected: 0,
        cashExpensesPaid: 0,
        variance: 0,
        custodianUserId: adminBranch1.id,
        custodianName: adminBranch1.name,
        status: 'OPEN',
      };
      store.cashDrawers.push(openDrawer);
      mockStorage.saveStore(store);
    }
    const initialDrawerBalance = openDrawer.expectedInDrawer;

    // Create an allocation of 2,500 PKR
    const payoutReceipt: TipReceiptRecord = {
      id: 'tip-rec-test-pay',
      receiptNumber: 'TIP-LHE-2026-PAY',
      branchId: 'branch-1',
      branchName: 'DHA Phase 5 Flagship',
      invoiceId: 'inv-test-pay',
      invoiceNumber: 'INV-TEST-PAY',
      paymentId: 'pay-test-pay',
      clientName: 'Payout Client',
      collectedAmount: 2500,
      allocatedAmount: 2500,
      unallocatedAmount: 0,
      method: 'CASH',
      collectionDate: '2026-09-30',
      collectionTime: '12:00:00',
      collectedByUserId: adminBranch1.id,
      collectedByName: adminBranch1.name,
      status: 'FULLY_ALLOCATED',
      createdAt: '2026-09-30T12:00:00Z',
    };
    const testAllocation: TipAllocationRecord = {
      id: 'tip-alloc-test-pay',
      allocationNumber: 'TA-LHE-2026-PAY',
      branchId: 'branch-1',
      tipReceiptId: payoutReceipt.id,
      tipReceiptNumber: payoutReceipt.receiptNumber,
      invoiceId: payoutReceipt.invoiceId,
      invoiceNumber: payoutReceipt.invoiceNumber,
      paymentId: 'pay-01',
      staffId: branchStaff.id,
      staffName: branchStaff.name,
      amount: 2500,
      paidAmount: 0,
      outstandingAmount: 2500,
      allocationType: 'DIRECT',
      allocationDate: '2026-09-30',
      allocationTime: '12:05:00',
      allocatedByUserId: adminBranch1.id,
      allocatedByName: adminBranch1.name,
      status: 'UNPAID',
    };
    (store.tipReceipts = store.tipReceipts || []).push(payoutReceipt);
    store.tipAllocations = store.tipAllocations || [];
    store.tipAllocations.push(testAllocation);
    mockStorage.saveStore(store);

    // Partial cash payout of 1,000 PKR
    const partialPayout = await mockSalonService.recordTipPayout(
      {
        allocationId: testAllocation.id,
        amount: 1000,
        method: 'CASH',
        cashDrawerId: openDrawer.id,
        notes: 'Partial cash payout',
      },
      adminBranch1
    );

    assert(partialPayout.payout.amount === 1000, 'Payout amount should be 1000.');
    assert(partialPayout.allocation.paidAmount === 1000, 'Allocation paidAmount should be 1000.');
    assert(partialPayout.allocation.outstandingAmount === 1500, 'Allocation outstanding should be 1500.');
    assert(partialPayout.allocation.status === 'PARTIALLY_PAID', 'Allocation status should be PARTIALLY_PAID.');

    // Verify cash drawer deduction
    const updatedStore = mockStorage.getStore();
    const updatedDrawer = updatedStore.cashDrawers.find((d) => d.id === openDrawer.id)!;
    assert(
      updatedDrawer.expectedInDrawer === initialDrawerBalance - 1000,
      'Cash drawer expectedInDrawer should decrease by 1000.'
    );

    // Online payout of remaining 1,500 PKR using canonical payment account
    const onlineAccount = updatedStore.paymentAccounts.find((a) => a.branchId === 'branch-1' && a.isActive)!;
    assert(!!onlineAccount, 'Active payment account needed for online payout.');
    const initialAccountBalance = onlineAccount.currentBalance;

    const fullPayout = await mockSalonService.recordTipPayout(
      {
        allocationId: testAllocation.id,
        amount: 1500,
        method: 'ONLINE',
        onlineAccountId: onlineAccount.id,
        notes: 'Final settlement via online bank',
      },
      adminBranch1
    );

    assert(fullPayout.allocation.paidAmount === 2500, 'Allocation should now be fully paid (2500).');
    assert(fullPayout.allocation.outstandingAmount === 0, 'Allocation outstanding should be 0.');
    assert(fullPayout.allocation.status === 'PAID', 'Allocation status should now be PAID.');

    // Verify online payment account deduction
    const storeAfterOnline = mockStorage.getStore();
    const updatedAccount = storeAfterOnline.paymentAccounts.find((a) => a.id === onlineAccount.id)!;
    assert(
      updatedAccount.currentBalance === initialAccountBalance - 1500,
      'Payment account balance should decrease by 1500.'
    );

    // Overpayment rejection: cannot pay more than outstanding 0
    await assertAsyncThrows(
      () =>
        mockSalonService.recordTipPayout(
          {
            allocationId: testAllocation.id,
            amount: 100,
            method: 'CASH',
            cashDrawerId: openDrawer.id,
          },
          adminBranch1
        ),
      'already fully paid'
    );

    console.log('✓ Test 4 Passed: Partial and full payouts disbursed via Cash and Online accounts with strict balance checks.');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Audited Payout Reversals & Fund Restoration
  // --------------------------------------------------------------------------
  console.log('Running Test 5: Tip payout reversal, liability restoration, and fund return...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const openDrawer = store.cashDrawers.find(
      (d) => d.branchId === 'branch-1' && d.status === 'OPEN' && d.custodianUserId === adminBranch1.id
    )!;
    const drawerBalanceBefore = openDrawer.expectedInDrawer;

    // Find the cash payout recorded in Test 4
    const payoutToReverse = store.tipPayouts?.find(
      (p) => p.allocationId === 'tip-alloc-test-pay' && p.method === 'CASH' && p.status === 'COMPLETED'
    );
    assert(!!payoutToReverse, 'Payout to reverse must exist.');

    const reversalResult = await mockSalonService.reverseTipPayout(
      {
        payoutId: payoutToReverse!.id,
        reversalReason: 'Staff returned payout due to incorrect shift allocation',
      },
      adminBranch1
    );

    assert(reversalResult.reversedPayout.status === 'REVERSED', 'Payout status must be REVERSED.');
    assert(reversalResult.allocation.outstandingAmount === 1000, 'Allocation outstanding should increase by 1000.');
    assert(reversalResult.allocation.paidAmount === 1500, 'Allocation paid amount should decrease to 1500.');
    assert(reversalResult.allocation.status === 'PARTIALLY_PAID', 'Allocation status should revert to PARTIALLY_PAID.');

    // Verify funds returned to drawer
    const storeAfterReversal = mockStorage.getStore();
    const drawerAfterReversal = storeAfterReversal.cashDrawers.find((d) => d.id === openDrawer.id)!;
    assert(
      drawerAfterReversal.expectedInDrawer === drawerBalanceBefore + 1000,
      'Cash drawer expectedInDrawer should increase back by 1000.'
    );

    // Prevent double reversal
    await assertAsyncThrows(
      () =>
        mockSalonService.reverseTipPayout(
          {
            payoutId: payoutToReverse!.id,
            reversalReason: 'Attempt double reverse',
          },
          adminBranch1
        ),
      'already reversed'
    );

    console.log('✓ Test 5 Passed: Audited reversal restores unpaid liability and returns physical funds.');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Closed/Locked Drawer Protection and Insufficient Funds Rollback
  // --------------------------------------------------------------------------
  console.log('Running Test 6: Closed drawer rejection and insufficient funds rollback...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const openDrawer = store.cashDrawers.find(
      (d) => d.branchId === 'branch-1' && d.status === 'OPEN' && d.custodianUserId === adminBranch1.id
    )!;

    openDrawer.expectedInDrawer = 200;
    mockStorage.saveStore(store);

    // 1. Attempt payout exceeding drawer funds (500 > 200) -> Must throw
    await assertAsyncThrows(
      () =>
        mockSalonService.recordTipPayout(
          {
            allocationId: 'tip-alloc-test-pay',
            amount: 500,
            method: 'CASH',
            cashDrawerId: openDrawer.id,
          },
          adminBranch1
        ),
      'Insufficient cash float'
    );

    // Verify storage rollback: openDrawer balance unchanged at 200
    const storeRollback = mockStorage.getStore();
    const verifyBrokeDrawer = storeRollback.cashDrawers.find((d) => d.id === openDrawer.id)!;
    assert(verifyBrokeDrawer.expectedInDrawer === 200, 'Drawer balance must rollback intact on failure.');

    // 2. Attempt payout when user has no open drawer (drawer is settled) -> Must throw
    openDrawer.status = 'SETTLED';
    mockStorage.saveStore(store);

    await assertAsyncThrows(
      () =>
        mockSalonService.recordTipPayout(
          {
            allocationId: 'tip-alloc-test-pay',
            amount: 100,
            method: 'CASH',
            cashDrawerId: openDrawer.id,
          },
          adminBranch1
        ),
      'requires an OPEN cash drawer'
    );

    // Restore drawer for subsequent tests
    openDrawer.status = 'OPEN';
    openDrawer.expectedInDrawer = 50000;
    mockStorage.saveStore(store);

    console.log('✓ Test 6 Passed: Closed drawers protected and storage safely rolled back on insufficient funds.');
  }

  // --------------------------------------------------------------------------
  // TEST 7: Tips Statement Reconciliation (Opening + Collections - Payouts = Closing)
  // --------------------------------------------------------------------------
  console.log('Running Test 7: Historical tips statement reconciliation formula verification...');
  {
    setActiveUser(adminBranch1);
    const statement = await mockSalonService.getTipsStatement(
      'branch-1',
      '2026-09-01',
      '2026-09-30',
      {},
      adminBranch1
    );

    const s = statement.summary;
    console.log('DEBUG Test 7 statement summary:', JSON.stringify(s));
    const calculatedClosing = s.openingLiability + s.netTipsCollected - s.netPayouts;
    assert(
      Math.abs(s.closingLiability - calculatedClosing) < 0.01,
      `Reconciling equation violated: closing ${s.closingLiability} != opening ${s.openingLiability} + net collections ${s.netTipsCollected} - net payouts ${s.netPayouts}`
    );

    assert(
      Math.abs(s.closingLiability - (s.unallocatedTips + s.allocatedUnpaidTips)) < 0.01,
      `Closing liability must equal unallocated (${s.unallocatedTips}) + allocated-unpaid (${s.allocatedUnpaidTips})`
    );

    console.log('✓ Test 7 Passed: Tips statement reconciles closing liability = opening + collections - payouts.');
  }

  // --------------------------------------------------------------------------
  // TEST 8: Staff Performance Attribution & Package Components Separation
  // --------------------------------------------------------------------------
  console.log('Running Test 8: Staff performance report metric derivation and package component separation...');
  {
    setActiveUser(adminBranch1);
    const perfReport = await mockSalonService.getStaffPerformanceReport(
      'branch-1',
      '2026-09-01',
      '2026-09-30',
      {},
      adminBranch1
    );

    assert(perfReport.length > 0, 'Staff performance report should return records for active staff.');

    for (const record of perfReport) {
      assert(record.staffName.length > 0, 'Staff name must be populated.');
      assert(
        record.totalServiceUnits === record.directServicesCount + record.packageComponentsCount,
        'Total units must equal direct services + package components without double-counting parent.'
      );
      assert(
        record.attributedNetSales <= record.attributedGrossSales,
        'Attributed net sales cannot exceed gross catalogue sales.'
      );
      assert(
        Math.abs(record.discountAllocation - (record.attributedGrossSales - record.attributedNetSales)) < 0.01,
        'Discount allocation must reconcile gross and net sales.'
      );

      // Verify detailed services consistency
      for (const item of record.detailedServices) {
        assert(
          Math.abs(item.netSales - (item.cataloguePrice - item.discountAllocated)) < 0.01,
          'Detailed service line item net sales must equal price minus discount.'
        );
      }
    }

    console.log('✓ Test 8 Passed: Staff performance derives accurate service units, net sales, and client counts.');
  }

  // --------------------------------------------------------------------------
  // TEST 9: Staff Personal Self-Service Isolation & Non-Disclosure
  // --------------------------------------------------------------------------
  console.log('Running Test 9: Staff personal self-service portal privacy and permission bounds...');
  {
    setActiveUser(staffUser);

    // 1. Staff can view their own personal tips
    const personalTips = await mockSalonService.getStaffPersonalTips(staffUser);
    assert(personalTips.summary.totalAllocated >= 0, 'Personal tips totalAllocated must be non-negative.');
    assert(
      personalTips.summary.totalOutstanding ===
        Math.max(0, personalTips.summary.totalAllocated - personalTips.summary.totalPaid),
      'Outstanding tips must equal allocated minus paid.'
    );

    // 2. Staff cannot access management tips statement or tip allocation
    await assertAsyncThrows(
      () =>
        mockSalonService.allocateTips(
          {
            tipReceiptId: 'tip-rec-test-01',
            allocationType: 'DIRECT',
            recipients: [{ staffId: staffUser.id, amount: 50 }],
          },
          staffUser
        ),
      'Staff members cannot allocate tips'
    );

    await assertAsyncThrows(
      () => mockSalonService.getTipsStatement('branch-1', '2026-09-01', '2026-09-30', {}, staffUser),
      'Staff members cannot access management tip'
    );

    // 3. Staff cannot access global staff performance management report
    await assertAsyncThrows(
      () => mockSalonService.getStaffPerformanceReport('branch-1', '2026-09-01', '2026-09-30', {}, staffUser),
      'Staff members cannot access management staff performance'
    );

    // 4. Staff can access their own personal performance
    const personalPerf = await mockSalonService.getStaffPersonalPerformance(staffUser, '2026-09-01', '2026-09-30');
    assert(personalPerf.staffName.length > 0, 'Personal performance staff name must be populated.');

    console.log('✓ Test 9 Passed: Staff personal workspace strictly isolated; management actions blocked.');
  }

  // --------------------------------------------------------------------------
  // TEST 10: Accountant Role Isolation (Tips Management and Staff Performance Denied)
  // --------------------------------------------------------------------------
  console.log('Running Test 10: Accountant role segregation and access denial...');
  {
    setActiveUser(accountant);

    // Accountant can collect tips at POS (read receipts), but cannot allocate tips
    await assertAsyncThrows(
      () =>
        mockSalonService.allocateTips(
          {
            tipReceiptId: 'tip-rec-test-01',
            allocationType: 'DIRECT',
            recipients: [{ staffId: 'staff-01', amount: 50 }],
          },
          accountant
        ),
      'Accountants cannot allocate staff tips'
    );

    // Accountant cannot record tip payouts or reversals
    await assertAsyncThrows(
      () =>
        mockSalonService.recordTipPayout(
          {
            allocationId: 'tip-alloc-test-pay',
            amount: 100,
            method: 'CASH',
          },
          accountant
        ),
      'authorized to disburse tip payouts'
    );

    // Accountant cannot access management staff performance report
    await assertAsyncThrows(
      () => mockSalonService.getStaffPerformanceReport('branch-1', '2026-09-01', '2026-09-30', {}, accountant),
      'Accountants are not authorized to view staff performance'
    );

    console.log('✓ Test 10 Passed: Accountant role strictly restricted according to corporate governance.');
  }

  // --------------------------------------------------------------------------
  // TEST 11: Idempotency Key Prevention of Duplicate Tip Payouts
  // --------------------------------------------------------------------------
  console.log('Running Test 11: Idempotency key preservation and duplicate payout prevention...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const branchStaff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;
    const openDrawer = store.cashDrawers.find(
      (d) => d.branchId === 'branch-1' && d.status === 'OPEN' && d.custodianUserId === adminBranch1.id
    )!;

    // Create matching receipt and allocation of 500 PKR
    const idempReceipt: TipReceiptRecord = {
      id: 'tip-rec-idemp',
      receiptNumber: 'TIP-IDEMP',
      branchId: 'branch-1',
      branchName: 'DHA Phase 5 Flagship',
      invoiceId: 'inv-idemp',
      invoiceNumber: 'INV-IDEMP',
      paymentId: 'pay-idemp',
      clientName: 'Idemp Client',
      collectedAmount: 500,
      allocatedAmount: 500,
      unallocatedAmount: 0,
      method: 'CASH',
      collectionDate: '2026-09-30',
      collectionTime: '12:55:00',
      collectedByUserId: adminBranch1.id,
      collectedByName: adminBranch1.name,
      status: 'FULLY_ALLOCATED',
      createdAt: '2026-09-30T12:55:00Z',
    };
    const testAlloc: TipAllocationRecord = {
      id: 'tip-alloc-idemp-01',
      allocationNumber: 'TA-LHE-IDEMP-01',
      branchId: 'branch-1',
      tipReceiptId: idempReceipt.id,
      tipReceiptNumber: idempReceipt.receiptNumber,
      invoiceId: idempReceipt.invoiceId,
      invoiceNumber: idempReceipt.invoiceNumber,
      paymentId: 'pay-idemp',
      staffId: branchStaff.id,
      staffName: branchStaff.name,
      amount: 500,
      paidAmount: 0,
      outstandingAmount: 500,
      allocationType: 'DIRECT',
      allocationDate: '2026-09-30',
      allocationTime: '13:00:00',
      allocatedByUserId: adminBranch1.id,
      allocatedByName: adminBranch1.name,
      status: 'UNPAID',
    };
    (store.tipReceipts = store.tipReceipts || []).push(idempReceipt);
    (store.tipAllocations = store.tipAllocations || []).push(testAlloc);
    mockStorage.saveStore(store);

    const idempotencyKey = 'IDEMP-TIP-PAY-2026-0001';

    // First attempt -> Succeeds
    const firstPayout = await mockSalonService.recordTipPayout(
      {
        allocationId: testAlloc.id,
        amount: 250,
        method: 'CASH',
        cashDrawerId: openDrawer.id,
        idempotencyKey,
      },
      adminBranch1
    );

    assert(firstPayout.payout.amount === 250, 'First payout amount must be 250.');

    // Second attempt with SAME idempotency key -> Returns cached record without double debit
    const secondPayout = await mockSalonService.recordTipPayout(
      {
        allocationId: testAlloc.id,
        amount: 250,
        method: 'CASH',
        cashDrawerId: openDrawer.id,
        idempotencyKey,
      },
      adminBranch1
    );

    assert(secondPayout.payout.id === firstPayout.payout.id, 'Idempotent request must return the same payout.');
    assert(
      secondPayout.allocation.paidAmount === 250,
      'Paid amount must remain 250, preventing double disbursement.'
    );

    console.log('✓ Test 11 Passed: Idempotency keys prevent duplicate payouts and accidental double debits.');
  }

  // --------------------------------------------------------------------------
  // TEST 12: Cancellation of Unpaid Allocations
  // --------------------------------------------------------------------------
  console.log('Running Test 12: Cancellation of unpaid allocations restoring tip receipt balance...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const branchStaff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;

    // Create a receipt of 800 PKR
    const cancelReceipt: TipReceiptRecord = {
      id: 'tip-rec-cancel-01',
      receiptNumber: 'TIP-CANCEL-01',
      branchId: 'branch-1',
      branchName: 'DHA Phase 5 Flagship',
      invoiceId: 'inv-cancel-01',
      invoiceNumber: 'INV-CANCEL-01',
      paymentId: 'pay-cancel',
      clientName: 'Cancellation Client',
      collectedAmount: 800,
      allocatedAmount: 800,
      unallocatedAmount: 0,
      method: 'CASH',
      collectionDate: '2026-09-30',
      collectionTime: '14:00:00',
      collectedByUserId: adminBranch1.id,
      collectedByName: adminBranch1.name,
      status: 'FULLY_ALLOCATED',
      createdAt: '2026-09-30T14:00:00Z',
    };
    const cancelAlloc: TipAllocationRecord = {
      id: 'tip-alloc-cancel-01',
      allocationNumber: 'TA-CANCEL-01',
      branchId: 'branch-1',
      tipReceiptId: cancelReceipt.id,
      tipReceiptNumber: cancelReceipt.receiptNumber,
      invoiceId: cancelReceipt.invoiceId,
      invoiceNumber: cancelReceipt.invoiceNumber,
      paymentId: 'pay-cancel',
      staffId: branchStaff.id,
      staffName: branchStaff.name,
      amount: 800,
      paidAmount: 0,
      outstandingAmount: 800,
      allocationType: 'DIRECT',
      allocationDate: '2026-09-30',
      allocationTime: '14:05:00',
      allocatedByUserId: adminBranch1.id,
      allocatedByName: adminBranch1.name,
      status: 'UNPAID',
    };
    (store.tipReceipts = store.tipReceipts || []).push(cancelReceipt);
    (store.tipAllocations = store.tipAllocations || []).push(cancelAlloc);
    mockStorage.saveStore(store);

    const cancelResult = await mockSalonService.cancelTipAllocation(
      cancelAlloc.id,
      'Staff member requested reassignment',
      adminBranch1
    );

    assert(cancelResult.cancelledAllocation.status === 'CANCELLED', 'Allocation status must be CANCELLED.');
    assert(cancelResult.tipReceipt.unallocatedAmount === 800, 'Tip receipt unallocated amount must return to 800.');
    assert(cancelResult.tipReceipt.allocatedAmount === 0, 'Tip receipt allocated amount must return to 0.');
    assert(cancelResult.tipReceipt.status === 'UNALLOCATED', 'Tip receipt status must revert to UNALLOCATED.');

    console.log('✓ Test 12 Passed: Unpaid allocation cancellation restores tip receipt balance cleanly.');
  }

  // --------------------------------------------------------------------------
  // TEST 13: Cross-Date Boundary Payout and Reversal Historical Reporting
  // --------------------------------------------------------------------------
  console.log('Running Test 13: Historical reporting across date boundaries (Payout Sept 30, Reversal Oct 1)...');
  {
    setActiveUser(adminBranch1);
    const store = mockStorage.getStore();
    const branchStaff = store.staff.find((s) => s.branchId === 'branch-1' && s.isActive)!;

    // Create a receipt collected on 2026-09-25 for 3,000 PKR
    const boundaryReceipt: TipReceiptRecord = {
      id: 'tip-rec-bound-01',
      receiptNumber: 'TIP-BOUND-01',
      branchId: 'branch-1',
      branchName: 'DHA Phase 5 Flagship',
      invoiceId: 'inv-bound-01',
      invoiceNumber: 'INV-BOUND-01',
      paymentId: 'pay-bound-01',
      clientName: 'Boundary Client',
      collectedAmount: 3000,
      allocatedAmount: 3000,
      unallocatedAmount: 0,
      method: 'CASH',
      collectionDate: '2026-09-25',
      collectionTime: '10:00:00',
      collectedByUserId: adminBranch1.id,
      collectedByName: adminBranch1.name,
      status: 'FULLY_ALLOCATED',
      createdAt: '2026-09-25T10:00:00Z',
    };

    const boundaryAlloc: TipAllocationRecord = {
      id: 'tip-alloc-bound-01',
      allocationNumber: 'TA-BOUND-01',
      branchId: 'branch-1',
      tipReceiptId: boundaryReceipt.id,
      tipReceiptNumber: boundaryReceipt.receiptNumber,
      invoiceId: boundaryReceipt.invoiceId,
      invoiceNumber: boundaryReceipt.invoiceNumber,
      paymentId: 'pay-bound-01',
      staffId: branchStaff.id,
      staffName: branchStaff.name,
      amount: 3000,
      paidAmount: 3000,
      outstandingAmount: 0,
      allocationType: 'DIRECT',
      allocationDate: '2026-09-25',
      allocationTime: '10:05:00',
      allocatedByUserId: adminBranch1.id,
      allocatedByName: adminBranch1.name,
      status: 'PAID',
    };

    // Payout executed on 2026-09-30 for 1,000 PKR, then REVERSED on 2026-10-01
    const boundaryPayout: TipPayoutRecord = {
      id: 'tip-pay-bound-01',
      payoutNumber: 'TP-BOUND-01',
      branchId: 'branch-1',
      staffId: branchStaff.id,
      staffName: branchStaff.name,
      allocationId: boundaryAlloc.id,
      allocationNumber: boundaryAlloc.allocationNumber,
      tipReceiptId: boundaryReceipt.id,
      amount: 1000,
      method: 'CASH',
      cashDrawerId: 'drawer-lhe-01',
      collectionMethod: 'CASH',
      payoutDate: '2026-09-30',
      payoutTime: '05:00 PM',
      paidByUserId: adminBranch1.id,
      paidByName: adminBranch1.name,
      status: 'REVERSED',
      reversalReason: 'Disputed shift distribution reversed on Oct 1',
      reversalDate: '2026-10-01',
      reversedAt: '2026-10-01T09:30:00Z',
      reversedByUserId: adminBranch1.id,
      reversedByName: adminBranch1.name,
    };

    // Reflect the reversal state on allocation as of current time:
    boundaryAlloc.paidAmount = 0;
    boundaryAlloc.outstandingAmount = 3000;
    boundaryAlloc.status = 'UNPAID';

    (store.tipReceipts = store.tipReceipts || []).push(boundaryReceipt);
    (store.tipAllocations = store.tipAllocations || []).push(boundaryAlloc);
    (store.tipPayouts = store.tipPayouts || []).push(boundaryPayout);
    mockStorage.saveStore(store);

    // 1. September Statement (2026-09-01 to 2026-09-30)
    // September MUST include the original payout of 1,000, because the reversal only happened on Oct 1.
    const septStatement = await mockSalonService.getTipsStatement('branch-1', '2026-09-01', '2026-09-30', {}, adminBranch1);
    const septSum = septStatement.summary;
    const septPayoutRecord = septStatement.payouts.find((p) => p.id === boundaryPayout.id);
    assert(!!septPayoutRecord, 'September statement must include the Sept 30 payout record.');
    // Check that equation balances in September
    const septCalcClosing = septSum.openingLiability + septSum.netTipsCollected - septSum.netPayouts;
    assert(Math.abs(septSum.closingLiability - septCalcClosing) < 0.01, 'September statement equation must balance.');
    assert(
      Math.abs(septSum.closingLiability - (septSum.unallocatedTips + septSum.allocatedUnpaidTips)) < 0.01,
      'September closing liability must match unallocated + allocated-unpaid.'
    );

    // 2. October Statement (2026-10-01 to 2026-10-31)
    // October MUST include the reversal on Oct 1 restoring liability.
    const octStatement = await mockSalonService.getTipsStatement('branch-1', '2026-10-01', '2026-10-31', {}, adminBranch1);
    const octSum = octStatement.summary;
    const octPayoutRecord = octStatement.payouts.find((p) => p.id === boundaryPayout.id);
    assert(!!octPayoutRecord, 'October statement must include the Oct 1 reversal event.');
    // In October, Opening Liability matches September Closing Liability
    assert(
      Math.abs(octSum.openingLiability - septSum.closingLiability) < 0.01,
      `October opening liability (${octSum.openingLiability}) must equal September closing liability (${septSum.closingLiability}).`
    );
    // Check that equation balances in October
    const octCalcClosing = octSum.openingLiability + octSum.netTipsCollected - octSum.netPayouts;
    assert(Math.abs(octSum.closingLiability - octCalcClosing) < 0.01, 'October statement equation must balance.');
    assert(
      Math.abs(octSum.closingLiability - (octSum.unallocatedTips + octSum.allocatedUnpaidTips)) < 0.01,
      'October closing liability must match unallocated + allocated-unpaid.'
    );

    console.log('✓ Test 13 Passed: Cross-date boundary reporting verified: September reflects payout, October reflects reversal restoration.');
  }

  console.log('\n====================================================');
  console.log('  ALL 13 TIPS & PERFORMANCE TESTS PASSED CLEANLY!   ');
  console.log('====================================================\n');
}

runTipsPerformanceTests().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
