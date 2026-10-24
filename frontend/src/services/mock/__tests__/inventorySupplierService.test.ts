import { mockSalonService } from '../mockSalonService';
import { mockStorage } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '../../../types/auth';
import {
  CreateInventoryItemInput,
  CreatePurchaseInput,
  PaySupplierInput,
  CreateSupplierReturnInput,
  CreateManualStockOutInput,
  CreateStockSettlementInput,
  CreatePOSInvoiceInput,
} from '../../../types/salon';

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
  const store = mockStorage.getStore();

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

async function runInventorySupplierTests() {
  console.log('\n--- STARTING INVENTORY & SUPPLIER TEST SUITE ---\n');

  // Test 1: Inventory Item Creation with separate purchase cost and selling price
  {
    console.log('Test 1: Inventory item creation with separate purchase and selling price...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const itemInput = {
      sku: 'SKU-SERUM-001',
      name: 'Argan Oil Hair Serum 100ml',
      category: 'HAIR_CARE',
      itemType: 'RETAIL_PRODUCT' as const,
      description: 'Professional nourishing hair serum',
      brand: 'Moroccan Glow',
      purchaseUnit: 'PIECE' as const,
      issueUnit: 'PIECE' as const,
      unitConversionRatio: 1,
      taxTreatment: 'BRANCH_DEFAULT' as const,
      defaultPurchaseCost: 1500,
      sellingPrice: 2800,
      price: 2800,
      code: 'SKU-SERUM-001',
      minStockLevel: 5,
      trackBatch: true,
      trackExpiry: true,
      nearExpiryAlertDays: 60,
      branchAvailability: ['branch-1'],
      isActive: true,
    };

    const newItem = await mockSalonService.createInventoryItem(itemInput);
    assert(newItem.id !== '', 'Item ID must be generated');
    assert(newItem.sku === 'SKU-SERUM-001', 'SKU must match');
    assert(newItem.defaultPurchaseCost === 1500, 'Purchase cost must be 1500');
    assert(newItem.sellingPrice === 2800, 'Selling price must be 2800');
    assert(newItem.price === 2800, 'POS mirror price must match selling price');
    assert(newItem.code === 'SKU-SERUM-001', 'POS mirror code must match sku');
    assert(newItem.isActive === true, 'New item must be active');

    // Verify initial stock snapshot is 0 without mutation
    const stockSnap = await mockSalonService.getItemStockInBranch(newItem.id, 'branch-1');
    assert(stockSnap.currentStock === 0, 'Initial quantity on hand must be 0');
    console.log('✅ Test 1 Passed!');
  }

  // Test 2: Branch Isolation for Inventory & Stock
  {
    console.log('Test 2: Branch isolation for items and stock counts...');
    setupTestEnvironment('SUPER_ADMIN');

    const itemsBranch1 = await mockSalonService.getInventoryItems('branch-1');
    const itemsBranch2 = await mockSalonService.getInventoryItems('branch-2');

    // An item assigned only to branch-1 should not appear when querying branch-2
    const foundInBranch1 = itemsBranch1.some((i) => i.sku === 'SKU-SERUM-001');
    const foundInBranch2 = itemsBranch2.some((i) => i.sku === 'SKU-SERUM-001');
    assert(foundInBranch1, 'Item should be present in branch-1');
    assert(!foundInBranch2, 'Item must NOT be present in branch-2');
    console.log('✅ Test 2 Passed!');
  }

  // Test 3: Purchases / Stock In (Credit Purchase increases Stock, creates Batches & updates Supplier Ledger)
  {
    console.log('Test 3: Purchases Stock-In increases inventory, creates batches, and updates supplier ledger...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const suppliers = await mockSalonService.getSuppliers('branch-1');
    assert(suppliers.length > 0, 'Suppliers should exist in test environment');
    const supplier = suppliers[0];
    const initialPayable = supplier.currentPayable;

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;

    const purchaseInput: CreatePurchaseInput = {
      branchId: 'branch-1',
      supplierId: supplier.id,
      purchaseDate: '2026-10-01',
      supplierInvoiceNo: 'INV-SUP-9090',
      notes: 'Initial stock intake test',
      lines: [
        {
          itemId: item.id,
          quantity: 20,
          unitPurchaseCost: 1400,
          batchNumber: 'LOT-ARG-001',
          expiryDate: '2027-10-01',
        },
      ],
      paymentMethod: 'CREDIT',
    };

    const purchase = await mockSalonService.createPurchase(purchaseInput);
    assert(purchase.id !== '', 'Purchase must be created');
    assert(purchase.paymentStatus === 'UNPAID', 'Credit purchase status should be UNPAID');
    assert(purchase.netAmount === 28000, 'Net amount must be 20 * 1400 = 28000');
    assert(purchase.lines[0].historicalCostSnapshot === 1400, 'Cost snapshot must be 1400');

    // Verify Stock Movement was created
    const movements = await mockSalonService.getStockMovements('branch-1', { itemId: item.id });
    const inMovement = movements.find((m) => m.referenceId === purchase.id && m.movementType === 'PURCHASE_IN');
    assert(!!inMovement, 'PURCHASE_IN stock movement must be posted');
    assert(inMovement?.quantity === 20, 'Movement quantity must be 20');
    assert(inMovement?.unitCostSnapshot === 1400, 'Movement unit cost snapshot must be 1400');

    // Verify Stock Level updated
    const updatedStock = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');
    assert(updatedStock.currentStock === 20, 'Stock on hand must now be 20');

    // Verify Batch Created
    const batches = await mockSalonService.getInventoryBatches('branch-1', item.id);
    const createdBatch = batches.find((b) => b.batchNumber === 'LOT-ARG-001');
    assert(!!createdBatch, 'Batch LOT-ARG-001 must exist');
    assert(createdBatch?.remainingQuantity === 20, 'Batch remaining quantity must be 20');
    assert(createdBatch?.status === 'VALID', 'Batch status must be VALID');

    // Verify Supplier Payable and Ledger
    const updatedSupplier = await mockSalonService.getSupplier(supplier.id);
    assert(
      updatedSupplier?.currentPayable === initialPayable + 28000,
      `Supplier payable should increase by 28000. Expected ${initialPayable + 28000}, got ${updatedSupplier?.currentPayable}`
    );

    const ledger = await mockSalonService.getSupplierLedger(supplier.id, 'branch-1');
    const creditEntry = ledger.entries.find((e) => e.referenceId === purchase.id && e.entryType === 'PURCHASE_BILL');
    assert(!!creditEntry, 'Supplier ledger must contain PURCHASE_BILL entry');
    assert(creditEntry?.payableCredit === 28000, 'Ledger payableCredit must be 28000');
    console.log('✅ Test 3 Passed!');
  }

  // Test 4: Cash Purchase updates cash drawer balance
  {
    console.log('Test 4: Cash purchase deducts from open cash drawer...');
    const { user } = setupTestEnvironment('ADMIN', 'branch-1');

    const store = mockStorage.getStore();
    // Ensure open cash drawer with sufficient float
    let drawer = store.cashDrawers.find((d) => d.branchId === 'branch-1' && d.status === 'OPEN');
    if (!drawer) {
      drawer = {
        id: 'drawer-test-01',
        branchId: 'branch-1',
        date: '2026-10-01',
        openingCash: 50000,
        cashSales: 0,
        cashTipsCollected: 0,
        cashExpensesPaid: 0,
        expectedInDrawer: 50000,
        actualInDrawer: 50000,
        variance: 0,
        custodianUserId: user.id,
        custodianName: user.name,
        status: 'OPEN',
      };
      store.cashDrawers.push(drawer);
      mockStorage.saveStore(store);
    } else {
      drawer.custodianUserId = user.id;
      drawer.expectedInDrawer = 50000;
      mockStorage.saveStore(store);
    }

    const suppliers = await mockSalonService.getSuppliers('branch-1');
    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;

    const initialExpectedInDrawer = drawer.expectedInDrawer;

    const purchaseInput = {
      branchId: 'branch-1',
      supplierId: suppliers[0].id,
      purchaseDate: '2026-10-01',
      lines: [
        {
          itemId: item.id,
          quantity: 5,
          unitPurchaseCost: 1400,
        },
      ],
      paymentMethod: 'CASH' as const,
    };

    const cashPurchase = await mockSalonService.createPurchase(purchaseInput);
    assert(cashPurchase.paymentStatus === 'PAID', 'Payment status should be PAID');
    assert(cashPurchase.paidAmount === 7000, 'Paid amount must be 7000');

    const refreshedDrawer = mockStorage.getStore().cashDrawers.find((d) => d.id === drawer!.id)!;
    assert(
      refreshedDrawer.expectedInDrawer === initialExpectedInDrawer - 7000,
      `Drawer cash should be reduced by 7000. Expected ${initialExpectedInDrawer - 7000}, got ${refreshedDrawer.expectedInDrawer}`
    );
    console.log('✅ Test 4 Passed!');
  }

  // Test 5: Partial Purchase creates correct paid/payable split
  {
    console.log('Test 5: Partial purchase splits paid vs payable correctly...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const suppliers = await mockSalonService.getSuppliers('branch-1');
    const supplier = suppliers[0];
    const initialPayable = (await mockSalonService.getSupplier(supplier.id))!.currentPayable;

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;

    const partialPurchaseInput = {
      branchId: 'branch-1',
      supplierId: supplier.id,
      purchaseDate: '2026-10-01',
      lines: [
        {
          itemId: item.id,
          quantity: 10,
          unitPurchaseCost: 1500, // Total = 15,000
        },
      ],
      paymentMethod: 'PARTIAL' as const,
      paidAmount: 5000, // Paid 5,000 cash, 10,000 payable
    };

    const partialPurchase = await mockSalonService.createPurchase(partialPurchaseInput);
    assert(partialPurchase.paymentStatus === 'PARTIAL', 'Status should be PARTIAL');
    assert(partialPurchase.paidAmount === 5000, 'Paid amount should be 5000');
    assert(partialPurchase.netAmount === 15000, 'Net amount should be 15000');

    const postSupplier = (await mockSalonService.getSupplier(supplier.id))!;
    assert(
      postSupplier.currentPayable === initialPayable + 10000,
      `Payable should increase by remaining 10,000. Expected ${initialPayable + 10000}, got ${postSupplier.currentPayable}`
    );
    console.log('✅ Test 5 Passed!');
  }

  // Test 6: Supplier Payment & Overpayment (Supplier Advance)
  {
    console.log('Test 6: Supplier payment reduces payable and overpayment produces supplier advance...');
    const { user } = setupTestEnvironment('ACCOUNTANT', 'branch-1');

    const store = mockStorage.getStore();
    let drawer = store.cashDrawers.find((d) => d.branchId === 'branch-1' && d.custodianUserId === user.id && d.status === 'OPEN');
    if (!drawer) {
      drawer = {
        id: `drawer-${user.id}`,
        branchId: 'branch-1',
        date: '2026-10-01',
        openingCash: 250000,
        cashSales: 0,
        cashTipsCollected: 0,
        cashExpensesPaid: 0,
        expectedInDrawer: 250000,
        actualInDrawer: 250000,
        variance: 0,
        custodianUserId: user.id,
        custodianName: user.name,
        status: 'OPEN',
      };
      store.cashDrawers.push(drawer);
      mockStorage.saveStore(store);
    } else {
      drawer.expectedInDrawer = 250000;
      mockStorage.saveStore(store);
    }

    const suppliers = await mockSalonService.getSuppliers('branch-1');
    const supplier = suppliers[0];
    const payableBefore = (await mockSalonService.getSupplier(supplier.id))!.currentPayable;

    // Accountant pays PKR 5,000 via Cash Drawer
    const payInput: PaySupplierInput = {
      supplierId: supplier.id,
      branchId: 'branch-1',
      paymentDate: '2026-10-01',
      amount: 5000,
      method: 'CASH',
      notes: 'Partial payment against invoice',
    };

    const res = await mockSalonService.paySupplier(payInput);
    assert(res.payment.id !== '', 'Payment record created');
    assert(res.payment.amount === 5000, 'Payment amount must be 5000');

    const supplierAfter = (await mockSalonService.getSupplier(supplier.id))!;
    assert(
      supplierAfter.currentPayable === payableBefore - 5000,
      `Payable should decrease by 5,000. Expected ${payableBefore - 5000}, got ${supplierAfter.currentPayable}`
    );

    // Overpayment test: Pay remaining balance + PKR 2,000 extra
    const overpaymentAmount = supplierAfter.currentPayable + 2000;
    const overpayInput: PaySupplierInput = {
      supplierId: supplier.id,
      branchId: 'branch-1',
      paymentDate: '2026-10-01',
      amount: overpaymentAmount,
      method: 'CASH',
      notes: 'Overpayment creating advance',
    };

    await mockSalonService.paySupplier(overpayInput);
    const supplierOverpaid = (await mockSalonService.getSupplier(supplier.id))!;
    assert(
      supplierOverpaid.currentPayable === -2000,
      `Overpayment must result in negative payable (-2000) as advance, got ${supplierOverpaid.currentPayable}`
    );
    console.log('✅ Test 6 Passed!');
  }

  // Test 7: Supplier Return (Stock Out & Payable Reduction)
  {
    console.log('Test 7: Supplier return creates stock-out and reduces payable...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;
    const stockBefore = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');

    const suppliers = await mockSalonService.getSuppliers('branch-1');
    const supplier = suppliers[0];
    const payableBefore = (await mockSalonService.getSupplier(supplier.id))!.currentPayable;

    const returnInput: CreateSupplierReturnInput = {
      branchId: 'branch-1',
      supplierId: supplier.id,
      returnDate: '2026-10-01',
      refundTreatment: 'REDUCE_PAYABLE',
      reason: 'Defective batch packaging',
      lines: [
        {
          itemId: item.id,
          batchNumber: 'LOT-ARG-001',
          quantity: 2,
          unitCost: 1400,
        },
      ],
    };

    const supReturn = await mockSalonService.createSupplierReturn(returnInput);
    assert(supReturn.id !== '', 'Return record created');
    assert(supReturn.totalAmount === 2800, 'Total return amount must be 2800');

    // Stock level should decrease by 2
    const stockAfter = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');
    assert(
      stockAfter.currentStock === stockBefore.currentStock - 2,
      `Stock should decrease by 2. Expected ${stockBefore.currentStock - 2}, got ${stockAfter.currentStock}`
    );

    // Supplier payable should decrease by 2800
    const supplierAfter = (await mockSalonService.getSupplier(supplier.id))!;
    assert(
      supplierAfter.currentPayable === payableBefore - 2800,
      `Payable should decrease by 2800. Expected ${payableBefore - 2800}, got ${supplierAfter.currentPayable}`
    );
    console.log('✅ Test 7 Passed!');
  }

  // Test 8: Batch Expiry Blocking & FEFO Allocation in POS Invoice
  {
    console.log('Test 8: Batch FEFO allocation & expired batch blocking...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;

    // Create an expired batch directly in store for testing FEFO and blocking
    const store = mockStorage.getStore();
    const expiredBatch = {
      id: 'batch-exp-test',
      itemId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      branchId: 'branch-1',
      batchNumber: 'LOT-EXP-999',
      receivedDate: '2025-01-01',
      expiryDate: '2025-12-31', // Expired in the past!
      initialQuantity: 10,
      purchasedQuantity: 10,
      remainingQuantity: 10,
      unitCostSnapshot: 1000,
      unitPurchaseCost: 1000,
      status: 'EXPIRED' as const,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    if (!store.inventoryBatches) store.inventoryBatches = [];
    store.inventoryBatches.push(expiredBatch);
    mockStorage.saveStore(store);

    // Make sure we have 2 valid batches with different expiries:
    // Batch 1 (earlier): expiry 2027-01-01, cost 1200, qty 5
    // Batch 2 (later): LOT-ARG-001 expiry 2027-10-01, cost 1400
    const earlyBatch = {
      id: 'batch-fefo-early',
      itemId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      branchId: 'branch-1',
      batchNumber: 'LOT-FEFO-EARLY',
      receivedDate: '2026-01-01',
      expiryDate: '2027-01-01',
      initialQuantity: 5,
      purchasedQuantity: 5,
      remainingQuantity: 5,
      unitCostSnapshot: 1200,
      unitPurchaseCost: 1200,
      status: 'VALID' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    store.inventoryBatches.push(earlyBatch);
    mockStorage.saveStore(store);

    const stockBeforeSale = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');

    // POS Sale of 3 units
    const invoicePayload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Saima Khan',
      clientPhone: '+92 300 7778899',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'ci-fefo-1',
          type: 'PRODUCT',
          item: item,
          quantity: 3,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 15,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 8400,
          billAllocation: 8400,
          tipAllocation: 0,
        },
      ],
      notes: 'FEFO Test sale',
    };

    const invoice = await mockSalonService.postPOSInvoice(invoicePayload);
    assert(invoice.id !== '', 'Invoice created');

    // Verify FEFO picked LOT-FEFO-EARLY (unit cost 1200), NOT expired LOT-EXP-999
    const invLine = invoice.lineItems[0];
    assert(invLine.batchNumber === 'LOT-FEFO-EARLY', `FEFO must pick earliest valid batch, got ${invLine.batchNumber}`);
    assert(invLine.unitCostSnapshot === 1200, `Unit cost snapshot must be 1200, got ${invLine.unitCostSnapshot}`);
    assert(invLine.cogsAmount === 3600, `COGS amount must be 3 * 1200 = 3600, got ${invLine.cogsAmount}`);

    // Verify Remaining in early batch is 5 - 3 = 2
    const refreshedBatches = await mockSalonService.getInventoryBatches('branch-1', item.id);
    const earlyBatchRefreshed = refreshedBatches.find((b) => b.id === 'batch-fefo-early')!;
    assert(earlyBatchRefreshed.remainingQuantity === 2, `Early batch should have 2 left, got ${earlyBatchRefreshed.remainingQuantity}`);

    // Verify expired batch remaining quantity is still 10 (untouched)
    const expBatchRefreshed = refreshedBatches.find((b) => b.id === 'batch-exp-test')!;
    assert(expBatchRefreshed.remainingQuantity === 10, 'Expired batch must not be deducted');

    // Verify stock movement was created
    const movements = await mockSalonService.getStockMovements('branch-1', { itemId: item.id });
    const posOut = movements.find((m) => m.referenceId === invoice.id && m.movementType === 'POS_SALE_OUT');
    assert(!!posOut, 'POS_SALE_OUT stock movement must be posted');
    assert(posOut?.quantity === 3, 'Movement quantity must be 3');
    assert(posOut?.unitCostSnapshot === 1200, 'Movement unit cost snapshot must be 1200');
    console.log('✅ Test 8 Passed!');
  }

  // Test 9: POS Stock Validation Failure & Idempotency
  {
    console.log('Test 9: POS stock validation failure & duplicate retry idempotency...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;
    const stockSnap = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');

    // Attempting to sell more than available valid stock should throw an error
    const excessivePayload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Saima Khan',
      clientPhone: '+92 300 7778899',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      cartItems: [
        {
          cartInstanceId: 'ci-excess-1',
          type: 'PRODUCT',
          item: item,
          quantity: stockSnap.currentStock + 999,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 15,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: (stockSnap.currentStock + 999) * item.sellingPrice,
          billAllocation: (stockSnap.currentStock + 999) * item.sellingPrice,
          tipAllocation: 0,
        },
      ],
    };

    await assertAsyncThrows(
      () => mockSalonService.postPOSInvoice(excessivePayload),
      'Insufficient valid sellable stock'
    );

    // Verify stock was not changed after failed attempt
    const stockAfterFailed = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');
    assert(
      stockAfterFailed.currentStock === stockSnap.currentStock,
      'Stock must not be deducted on failed invoice'
    );

    // Test Idempotency: submitting same idempotencyKey does not double deduct
    const idempotencyKey = 'IDEMP-INVENTORY-TEST-001';
    const validSalePayload: CreatePOSInvoiceInput = {
      branchId: 'branch-1',
      clientName: 'Saima Khan',
      clientPhone: '+92 300 7778899',
      discountType: 'FIXED',
      discountValue: 0,
      tip: 0,
      idempotencyKey,
      cartItems: [
        {
          cartInstanceId: 'ci-idemp-1',
          type: 'PRODUCT',
          item: item,
          quantity: 1,
          staffId: 'staff-1',
          staffName: 'Zara Alvi',
          staffCommissionRate: 15,
        },
      ],
      payments: [
        {
          method: 'CASH',
          amount: 2800,
          billAllocation: 2800,
          tipAllocation: 0,
        },
      ],
    };

    const firstInvoice = await mockSalonService.postPOSInvoice(validSalePayload);
    const stockAfterFirst = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');

    // Retry with identical idempotencyKey
    const secondInvoice = await mockSalonService.postPOSInvoice(validSalePayload);
    assert(firstInvoice.id === secondInvoice.id, 'Idempotency must return the identical invoice record');

    const stockAfterSecond = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');
    assert(
      stockAfterSecond.currentStock === stockAfterFirst.currentStock,
      'Duplicate submission must NOT deduct stock twice'
    );
    console.log('✅ Test 9 Passed!');
  }

  // Test 10: Manual Stock Out (Salon Consumption / Damaged / Expired)
  {
    console.log('Test 10: Manual stock-out for salon consumption and damage...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;
    const stockBefore = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');

    const stockOutInput: CreateManualStockOutInput = {
      branchId: 'branch-1',
      itemId: item.id,
      quantity: 1,
      reasonType: 'SALON_CONSUMPTION',
      reason: 'SALON_CONSUMPTION',
      notes: 'Used in Hair Spa treatment',
    };

    const outMovement = await mockSalonService.createManualStockOut(stockOutInput);
    assert(outMovement.movementType === 'SALON_CONSUMPTION_OUT', 'Movement type must be SALON_CONSUMPTION_OUT');
    assert(outMovement.quantity === 1, 'Quantity must be 1');

    const stockAfter = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');
    assert(stockAfter.currentStock === stockBefore.currentStock - 1, 'Stock must decrease by 1');
    console.log('✅ Test 10 Passed!');
  }

  // Test 11: Physical Stock Settlement (Audit Reconciliation)
  {
    console.log('Test 11: Stock settlement reconciliation and adjustment movements...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;
    const currentStock = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');

    // Physical count finds 2 items missing (Damage / Missing)
    const countedQuantity = currentStock.currentStock - 2;

    const settlementInput = {
      branchId: 'branch-1',
      countDate: '2026-10-01',
      notes: 'End of month audit reconciliation',
      lines: [
        {
          itemId: item.id,
          countedQuantity: countedQuantity,
          reason: 'MISSING' as const,
          notes: 'Missing stock discovered during physical audit',
        },
      ],
    };

    const settlement = await mockSalonService.createStockSettlement(settlementInput);
    assert(settlement.status === 'POSTED', 'Settlement must be posted');
    assert(settlement.lines[0].difference === -2, 'Difference must be -2');

    // Verify negative adjustment movement created
    const movements = await mockSalonService.getStockMovements('branch-1', { itemId: item.id });
    const adjMovement = movements.find((m) => m.referenceId === settlement.id && m.movementType === 'NEGATIVE_ADJUSTMENT');
    assert(!!adjMovement, 'NEGATIVE_ADJUSTMENT movement must be posted');
    assert(adjMovement?.quantity === 2, 'Movement quantity must be 2');

    // Verify stock count reflects physical count
    const stockAfterSettlement = await mockSalonService.getItemStockInBranch(item.id, 'branch-1');
    assert(
      stockAfterSettlement.currentStock === countedQuantity,
      `Stock must equal physical counted quantity ${countedQuantity}, got ${stockAfterSettlement.currentStock}`
    );
    console.log('✅ Test 11 Passed!');
  }

  // Test 12: Historical Cost & Price Immutability after Item Edit
  {
    console.log('Test 12: Editing item master does NOT alter historical purchase costs or POS sale COGS...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const items = await mockSalonService.getInventoryItems('branch-1');
    const item = items.find((i) => i.sku === 'SKU-SERUM-001')!;

    // Edit item purchase cost from 1500 to 2200 and selling price to 3500
    await mockSalonService.updateInventoryItem(item.id, {
      defaultPurchaseCost: 2200,
      sellingPrice: 3500,
    });

    // Check historical purchases
    const purchases = await mockSalonService.getPurchases('branch-1');
    const pastPurchases = purchases.filter((p) => p.lines.some((l) => l.itemId === item.id));
    assert(pastPurchases.length > 0, 'Past purchases must exist');
    for (const p of pastPurchases) {
      for (const l of p.lines.filter((line) => line.itemId === item.id)) {
        assert(
          l.unitPurchaseCost === 1400 || l.unitPurchaseCost === 1500,
          `Historical purchase cost must remain original snapshot (1400 or 1500), NOT updated cost 2200. Got: ${l.unitPurchaseCost}`
        );
      }
    }

    // Check historical stock movements
    const movements = await mockSalonService.getStockMovements('branch-1', { itemId: item.id });
    const purchaseMovements = movements.filter((m) => m.itemId === item.id && m.movementType === 'PURCHASE_IN');
    assert(purchaseMovements.length > 0, 'Purchase movements must exist');
    for (const m of purchaseMovements) {
      assert(
        m.unitCostSnapshot === 1400 || m.unitCostSnapshot === 1500,
        `Historical movement cost snapshot must remain original snapshot, NOT updated cost 2200. Got: ${m.unitCostSnapshot}`
      );
    }
    console.log('✅ Test 12 Passed!');
  }

  // Test 13: COGS and Inventory Reports Accuracy
  {
    console.log('Test 13: COGS calculation and Inventory Summary report...');
    setupTestEnvironment('ADMIN', 'branch-1');

    const summary = await mockSalonService.getInventorySummary('branch-1');
    assert(summary.totalInventoryCostValue > 0, 'Total inventory cost value must be > 0');
    assert(summary.totalItemsCount > 0, 'Total items must be > 0');
    assert(summary.lowStockCount >= 0, 'Low stock count should be non-negative');

    const cogsReport = await mockSalonService.getCOGSReport('branch-1', { startDate: '2026-01-01', endDate: '2026-12-31' });
    assert(cogsReport.summary.totalRetailNetSales > 0, 'Net product sales should be > 0');
    assert(cogsReport.summary.totalRetailCOGS > 0, 'Total COGS should be > 0');
    assert(
      cogsReport.summary.totalRetailGrossProfit === cogsReport.summary.totalRetailNetSales - cogsReport.summary.totalRetailCOGS,
      'Gross profit must equal net sales - COGS'
    );
    console.log('✅ Test 13 Passed!');
  }

  // Test 14: Role Permissions (Accountant & Staff Restrictions)
  {
    console.log('Test 14: Role permission enforcement for Accountant and Staff...');

    // 1. Accountant cannot create or update item master
    setupTestEnvironment('ACCOUNTANT', 'branch-1');
    await assertAsyncThrows(
      () =>
        mockSalonService.createInventoryItem({
          sku: 'SKU-ILLEGAL',
          name: 'Illegal Item',
          category: 'HAIR_CARE',
          itemType: 'RETAIL_PRODUCT',
          purchaseUnit: 'PIECE',
          issueUnit: 'PIECE',
          taxTreatment: 'BRANCH_DEFAULT',
          defaultPurchaseCost: 100,
          sellingPrice: 200,
          price: 200,
          code: 'SKU-ILLEGAL',
          minStockLevel: 5,
          trackBatch: false,
          trackExpiry: false,
          nearExpiryAlertDays: 0,
          branchAvailability: ['branch-1'],
          isActive: true,
        }),
      'Access Denied'
    );

    // 2. Accountant cannot create manual stock-out
    await assertAsyncThrows(
      () =>
        mockSalonService.createManualStockOut({
          branchId: 'branch-1',
          itemId: 'any-id',
          quantity: 1,
          reasonType: 'DAMAGE',
          reason: 'DAMAGED',
        }),
      'Access Denied'
    );

    // 3. Accountant cannot perform stock settlement
    await assertAsyncThrows(
      () =>
        mockSalonService.createStockSettlement({
          branchId: 'branch-1',
          countDate: '2026-10-01',
          lines: [],
        }),
      'Access Denied'
    );

    // 4. Staff cannot view supplier ledger
    setupTestEnvironment('STAFF', 'branch-1');
    await assertAsyncThrows(
      () => mockSalonService.getSupplierLedger('sup-1', 'branch-1'),
      'Access Denied'
    );

    // 5. Staff cannot create purchases
    await assertAsyncThrows(
      () =>
        mockSalonService.createPurchase({
          branchId: 'branch-1',
          supplierId: 'sup-1',
          purchaseDate: '2026-10-01',
          lines: [],
          paymentMethod: 'CREDIT',
        }),
      'Access Denied'
    );
    console.log('✅ Test 14 Passed!');
  }

  console.log('\n--- ALL INVENTORY & SUPPLIER TESTS PASSED CLEANLY! ---\n');
}

runInventorySupplierTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:\n', err);
  process.exit(1);
});
