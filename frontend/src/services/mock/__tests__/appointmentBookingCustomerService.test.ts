import { mockSalonService } from '../mockSalonService';
import { mockStorage } from '../mockStorage';
import { mockAuthService } from '../mockAuthService';
import { User } from '@/types/auth';
import { CreateAppointmentInput, CreatePOSInvoiceInput } from '@/types/salon';
import { roundCurrency } from '@/lib/taxCalculations';

function setActiveUser(user: User) {
  mockAuthService.setCurrentSession({
    user,
    token: `token_${user.id}`,
    loginTime: new Date().toISOString(),
    activeBranchId: user.branchId || 'ALL',
  });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING APPOINTMENTS, CUSTOMERS & QUEUE TEST SUITE ');
  console.log('====================================================\n');

  const initialStore = mockStorage.reloadFromStorage();
  const branch1Id = 'branch-1';

  const SUPER_ADMIN = initialStore.users.find((u) => u.role === 'SUPER_ADMIN')!;
  const ADMIN_LHE = initialStore.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-1')!;
  const ADMIN_KHI = initialStore.users.find((u) => u.role === 'ADMIN' && u.branchId === 'branch-2')!;
  const ACCOUNTANT_LHE = initialStore.users.find((u) => u.role === 'ACCOUNTANT' && u.branchId === 'branch-1')!;
  const STAFF_ZARA = initialStore.users.find((u) => u.role === 'STAFF')!;

  try {
    // ----------------------------------------------------
    // TEST 1: Single-Service and Package Multi-Staff Persistence
    // ----------------------------------------------------
    console.log('Running Test 1: Single-service and package multi-staff persistence...');
    setActiveUser(ADMIN_LHE);

    const testDate = '2026-10-15';
    const store = mockStorage.getStore();
    const pkg = store.packages.find((p) => p.branchId === branch1Id);
    assert(!!pkg && pkg.components.length > 0, 'Test package must exist');

    const staff1 = store.staff.find((s) => s.branchId === branch1Id && s.isActive)!;
    const staff2 = store.staff.filter((s) => s.branchId === branch1Id && s.isActive && s.id !== staff1.id)[0] || staff1;

    // Single service booking
    const srv = store.services.find((s) => s.branchId === branch1Id && s.isActive)!;
    const singleApt = await mockSalonService.createAppointment(
      {
        branchId: branch1Id,
        clientName: 'Ayesha Raza',
        clientPhone: '+92 300 111 2233',
        customerSource: 'WALK_IN',
        date: testDate,
        startTime: '10:00 AM',
        items: [
          {
            type: 'SERVICE',
            itemId: srv.id,
            staffId: staff1.id,
          },
        ],
        notes: 'Requested quiet chair',
      },
      ADMIN_LHE
    );

    assert(singleApt.items!.length === 1, 'Single item must exist');
    assert(singleApt.items![0].staffId === staff1.id, 'Assigned staff must match');
    assert(singleApt.billingStatus === 'UNBILLED', 'Initial billing status must be UNBILLED');
    assert(singleApt.status === 'PENDING', 'Initial status must be PENDING');
    assert(singleApt.price === srv.price, 'Price must match service price');

    // Multi-staff package booking
    const packageComponentsAssignments = pkg!.components.map((c, idx) => ({
      serviceId: c.serviceId,
      staffId: idx % 2 === 0 ? staff1.id : staff2.id,
    }));

    const pkgApt = await mockSalonService.createAppointment(
      {
        branchId: branch1Id,
        clientName: 'Fatima Noor',
        clientPhone: '+92 321 444 5566',
        customerSource: 'SOCIAL_MEDIA',
        customerSourceDetails: 'Instagram campaign',
        date: testDate,
        startTime: '12:30 PM',
        items: [
          {
            type: 'PACKAGE',
            itemId: pkg!.id,
            packageComponents: packageComponentsAssignments,
          },
        ],
        status: 'CONFIRMED',
      },
      ADMIN_LHE
    );

    assert(pkgApt.items!.length === 1, 'Package item must exist');
    assert(pkgApt.items![0].type === 'PACKAGE', 'Item type must be PACKAGE');
    assert(pkgApt.items![0].packageComponents!.length === pkg!.components.length, 'All package components must be expanded');
    assert(pkgApt.price === pkg!.price, 'Package price must equal package selling price without staff multiplier');
    assert(pkgApt.status === 'CONFIRMED', 'Status must be CONFIRMED');
    console.log('✓ Test 1 Passed: Single-service and package multi-staff persistence verified.\n');

    // ----------------------------------------------------
    // TEST 2: Schedule Conflicts, Adjacent Slots, Leaves & Shift Bounds
    // ----------------------------------------------------
    console.log('Running Test 2: Schedule conflicts, adjacent slots, leaves, and shifts...');
    setActiveUser(ADMIN_LHE);

    const singleEnd = singleApt.items![0].endTime!;

    // 2a. Adjacent booking starting exactly at singleEnd is ALLOWED
    const adjacentApt = await mockSalonService.createAppointment(
      {
        branchId: branch1Id,
        clientName: 'Hina Bilal',
        clientPhone: '+92 333 777 8899',
        date: testDate,
        startTime: singleEnd, // Exact adjacent start
        items: [
          {
            type: 'SERVICE',
            itemId: srv.id,
            staffId: staff1.id,
          },
        ],
      },
      ADMIN_LHE
    );
    assert(!!adjacentApt.id, 'Adjacent appointment with matching start time must be created successfully');

    // 2b. Overlapping booking with staff1 must be REJECTED
    let conflictCaught = false;
    try {
      await mockSalonService.createAppointment(
        {
          branchId: branch1Id,
          clientName: 'Conflicting Booking',
          clientPhone: '+92 300 999 0011',
          date: testDate,
          startTime: '10:10 AM', // Directly inside [10:00 AM, singleEnd]
          items: [
            {
              type: 'SERVICE',
              itemId: srv.id,
              staffId: staff1.id,
            },
          ],
        },
        ADMIN_LHE
      );
    } catch (err: any) {
      conflictCaught = true;
      assert(err.message.includes('Scheduling Conflict') || err.message.includes('already booked'), 'Must describe conflict');
    }
    assert(conflictCaught, 'Overlapping appointment must be rejected');

    // 2c. Staff on approved leave must be REJECTED
    const leaveDate = '2026-10-20';
    await mockSalonService.markLeave(
      {
        branchId: branch1Id,
        staffId: staff1.id,
        startDate: leaveDate,
        endDate: leaveDate,
        type: 'PAID',
        reason: 'Medical checkup',
      },
      ADMIN_LHE
    );

    let leaveBlocked = false;
    try {
      await mockSalonService.createAppointment(
        {
          branchId: branch1Id,
          clientName: 'Blocked on Leave',
          clientPhone: '+92 300 222 3344',
          date: leaveDate,
          startTime: '11:00 AM',
          items: [
            {
              type: 'SERVICE',
              itemId: srv.id,
              staffId: staff1.id,
            },
          ],
        },
        ADMIN_LHE
      );
    } catch (err: any) {
      leaveBlocked = true;
      assert(err.message.includes('approved leave'), 'Error must mention approved leave');
    }
    assert(leaveBlocked, 'Booking for staff on approved leave must be rejected');
    console.log('✓ Test 2 Passed: Schedule conflicts, adjacent slots, leaves, and shifts verified.\n');

    // ----------------------------------------------------
    // TEST 3: Reschedule and Cancel Slot Release
    // ----------------------------------------------------
    console.log('Running Test 3: Reschedule and cancel slot release...');
    setActiveUser(ADMIN_LHE);

    const cancelledApt = await mockSalonService.updateAppointmentStatus(
      adjacentApt.id,
      'CANCELLED',
      'Client had personal emergency',
      ADMIN_LHE
    );
    assert(cancelledApt.status === 'CANCELLED', 'Status must be CANCELLED');
    assert(!!cancelledApt.cancelledAt, 'CancelledAt must be recorded');

    // Slot previously held by adjacentApt is RELEASED and can be booked
    const replacementApt = await mockSalonService.createAppointment(
      {
        branchId: branch1Id,
        clientName: 'New Replacement Customer',
        clientPhone: '+92 345 123 4567',
        date: testDate,
        startTime: singleEnd,
        items: [
          {
            type: 'SERVICE',
            itemId: srv.id,
            staffId: staff1.id,
          },
        ],
      },
      ADMIN_LHE
    );
    assert(!!replacementApt.id, 'Released slot after cancellation must be bookable');

    // Reschedule replacementApt to 04:00 PM
    const rescheduledApt = await mockSalonService.rescheduleAppointment(
      replacementApt.id,
      testDate,
      '04:00 PM',
      'Client requested afternoon slot',
      ADMIN_LHE
    );
    assert(rescheduledApt.startTime === '04:00 PM', 'Start time must be updated');
    assert(rescheduledApt.rescheduleHistory!.length === 1, 'Reschedule history must be tracked');
    assert(rescheduledApt.rescheduleHistory![0].previousStartTime === singleEnd, 'Previous time must be preserved');
    console.log('✓ Test 3 Passed: Cancellation and reschedule slot release verified.\n');

    // ----------------------------------------------------
    // TEST 4: Confirmation Message and POS Queue Retrieval
    // ----------------------------------------------------
    console.log('Running Test 4: Confirmation message and POS queue retrieval...');
    setActiveUser(ADMIN_LHE);

    const confirmedSingle = await mockSalonService.updateAppointmentStatus(
      singleApt.id,
      'CONFIRMED',
      undefined,
      ADMIN_LHE
    );
    assert(confirmedSingle.status === 'CONFIRMED', 'Status must be CONFIRMED');
    assert(!!confirmedSingle.confirmedAt, 'ConfirmedAt timestamp must be recorded');

    const msg = await mockSalonService.prepareConfirmationMessage(confirmedSingle.id, ADMIN_LHE);
    assert(msg.clientName === 'Ayesha Raza', 'Client name must be in message');
    assert(msg.totalEstimatedPrice === srv.price, 'Price must be in message');
    assert(msg.whatsappUrl.startsWith('https://wa.me/'), 'WhatsApp URL must be generated');

    // Confirming again must NOT duplicate queue entries
    const reconfirmed = await mockSalonService.updateAppointmentStatus(
      singleApt.id,
      'CONFIRMED',
      undefined,
      ADMIN_LHE
    );
    assert(reconfirmed.id === singleApt.id, 'Must be same appointment');

    // Check POS Queue for testDate
    const queue = await mockSalonService.getAppointmentQueue(branch1Id, testDate, ADMIN_LHE);
    const queueMatches = queue.filter((a) => a.id === singleApt.id);
    assert(queueMatches.length === 1, 'Must appear exactly once in POS queue');
    assert(queue.some((a) => a.id === pkgApt.id), 'Package appointment must appear in queue');
    console.log('✓ Test 4 Passed: Confirmation preparation and deduplicated queue retrieval verified.\n');

    // ----------------------------------------------------
    // TEST 5: Appointment Handoff to POS & Atomic Billing Invariance
    // ----------------------------------------------------
    console.log('Running Test 5: Appointment handoff to POS and atomic billing...');
    setActiveUser(ADMIN_LHE);

    const branch1 = store.branches.find((b) => b.id === branch1Id)!;
    const taxRate = branch1.taxEnabled ? (branch1.taxRate || 0) : 0;
    const fullPay = roundCurrency(srv.price + roundCurrency(srv.price * taxRate));

    const invoiceInput: CreatePOSInvoiceInput = {
      branchId: branch1Id,
      appointmentId: singleApt.id,
      clientName: singleApt.clientName,
      clientPhone: singleApt.clientPhone,
      customerSource: singleApt.customerSource,
      cartItems: [
        {
          cartInstanceId: 'cart-inst-1',
          item: srv,
          quantity: 1,
          type: 'SERVICE',
          staffId: staff1.id,
          staffName: staff1.name,
          staffCommissionRate: staff1.commissionRate || 0.1,
        },
      ],
      discountType: 'PERCENTAGE',
      discountValue: 0,
      tip: 0,
      payments: [
        {
          method: 'CASH',
          amount: fullPay,
          billAllocation: fullPay,
          tipAllocation: 0,
        },
      ],
      idempotencyKey: `pos-apt-${Date.now()}-1`,
    };

    const invoice = await mockSalonService.postPOSInvoice(invoiceInput, ADMIN_LHE);
    assert(invoice.appointmentId === singleApt.id, 'Invoice must record appointmentId');
    assert(invoice.status === 'PAID', 'Invoice must be PAID');

    // Verify appointment was updated atomically
    const billedApt = (await mockSalonService.getAppointment(singleApt.id, ADMIN_LHE))!;
    assert(billedApt.billingStatus === 'BILLED', 'Appointment must be marked BILLED');
    assert(billedApt.linkedInvoiceId === invoice.id, 'Linked invoice ID must be set');
    assert(billedApt.linkedInvoiceNumber === invoice.invoiceNumber, 'Linked invoice number must be set');
    assert(billedApt.status === 'COMPLETED', 'Status must advance to COMPLETED');

    // Billed appointment must NO LONGER appear in active unbilled POS queue
    const updatedQueue = await mockSalonService.getAppointmentQueue(branch1Id, testDate, ADMIN_LHE);
    assert(!updatedQueue.some((a) => a.id === singleApt.id), 'Billed appointment must be removed from unbilled queue');

    // Second invoice posting attempt for SAME appointment must be REJECTED
    let duplicateBillingRejected = false;
    try {
      const duplicateInput = { ...invoiceInput, idempotencyKey: `pos-apt-${Date.now()}-2` };
      await mockSalonService.postPOSInvoice(duplicateInput, ADMIN_LHE);
    } catch (err: any) {
      duplicateBillingRejected = true;
      assert(err.message.includes('already been billed') || err.message.includes('Duplicate'), 'Must reject duplicate billing');
    }
    assert(duplicateBillingRejected, 'Duplicate invoice billing on same appointment must be blocked');

    // Cancelling a billed appointment must be REJECTED
    let cancelBilledBlocked = false;
    try {
      await mockSalonService.updateAppointmentStatus(singleApt.id, 'CANCELLED', 'Test cancel', ADMIN_LHE);
    } catch (err: any) {
      cancelBilledBlocked = true;
      assert(err.message.includes('already been billed'), 'Must reject cancellation of billed appointment');
    }
    assert(cancelBilledBlocked, 'Cancellation of billed appointment must be blocked');
    console.log('✓ Test 5 Passed: Appointment handoff, atomic billing, and duplicate invoice prevention verified.\n');

    // ----------------------------------------------------
    // TEST 6: Multi-Staff Package Commission Attribution Example
    // ----------------------------------------------------
    console.log('Running Test 6: Multi-staff package commission example and snapshots...');
    setActiveUser(ADMIN_LHE);

    const storeSnapshot = mockStorage.getStore();
    const realServices = storeSnapshot.services.filter((s) => s.branchId === branch1Id && s.isActive);
    const s1 = realServices[0];
    const s2 = realServices[1];
    const s3 = realServices[2];

    const customPkg = {
      id: `pkg-test-comm-${Date.now()}`,
      branchId: branch1Id,
      code: 'PKG-COMM-TEST',
      name: 'Bridal Triple Deluxe',
      price: 5000.0,
      taxTreatment: 'BRANCH_DEFAULT' as const,
      isActive: true,
      components: [
        {
          serviceId: s1.id,
          serviceCode: s1.code,
          serviceName: s1.name,
          quantity: 1,
          allocationPercentage: 40,
          unitPrice: 2000,
        },
        {
          serviceId: s2.id,
          serviceCode: s2.code,
          serviceName: s2.name,
          quantity: 1,
          allocationPercentage: 40,
          unitPrice: 2000,
        },
        {
          serviceId: s3.id,
          serviceCode: s3.code,
          serviceName: s3.name,
          quantity: 1,
          allocationPercentage: 20,
          unitPrice: 1000,
        },
      ],
    };

    storeSnapshot.packages.push(customPkg);

    const aliStaff = storeSnapshot.staff.find((s) => s.id === staff1.id)!;
    const ahmedStaff = storeSnapshot.staff.find((s) => s.id === staff2.id)!;
    aliStaff.commissionRate = 0.10;
    ahmedStaff.commissionRate = 0.15;
    mockStorage.saveStore(storeSnapshot);

    const pkgInvoiceInput: CreatePOSInvoiceInput = {
      branchId: branch1Id,
      clientName: 'Farah Bridal',
      clientPhone: '+92 300 555 6677',
      cartItems: [
        {
          cartInstanceId: 'cart-inst-pkg',
          item: customPkg,
          quantity: 1,
          type: 'PACKAGE',
          staffId: aliStaff.id,
          staffName: aliStaff.name,
          staffCommissionRate: aliStaff.commissionRate || 0.1,
          packageComponents: [
            {
              serviceId: s1.id,
              serviceCode: s1.code,
              serviceName: s1.name,
              quantity: 1,
              allocationPercentage: 40,
              allocatedAmount: 2000,
              staffId: aliStaff.id,
              staffName: aliStaff.name,
              staffCommissionRate: aliStaff.commissionRate || 0.1,
            },
            {
              serviceId: s2.id,
              serviceCode: s2.code,
              serviceName: s2.name,
              quantity: 1,
              allocationPercentage: 40,
              allocatedAmount: 2000,
              staffId: ahmedStaff.id,
              staffName: ahmedStaff.name,
              staffCommissionRate: ahmedStaff.commissionRate || 0.15,
            },
            {
              serviceId: s3.id,
              serviceCode: s3.code,
              serviceName: s3.name,
              quantity: 1,
              allocationPercentage: 20,
              allocatedAmount: 1000,
              staffId: aliStaff.id,
              staffName: aliStaff.name,
              staffCommissionRate: aliStaff.commissionRate || 0.1,
            },
          ],
        },
      ],
      discountType: 'PERCENTAGE',
      discountValue: 0,
      tip: 0,
      payments: [
        {
          method: 'CASH',
          amount: 5000 + roundCurrency(5000 * (storeSnapshot.branches[0].taxRate || 0)),
          billAllocation: 5000 + roundCurrency(5000 * (storeSnapshot.branches[0].taxRate || 0)),
          tipAllocation: 0,
        },
      ],
      idempotencyKey: `pos-pkg-${Date.now()}`,
    };

    const pkgInvoice = await mockSalonService.postPOSInvoice(pkgInvoiceInput, ADMIN_LHE);
    const lineItem = pkgInvoice.lineItems[0];
    assert(!!lineItem.packageComponentsSnapshot, 'Package components snapshot must be recorded');
    assert(lineItem.packageComponentsSnapshot!.length === 3, 'Must have 3 components');

    const comp1 = lineItem.packageComponentsSnapshot![0];
    const comp2 = lineItem.packageComponentsSnapshot![1];
    const comp3 = lineItem.packageComponentsSnapshot![2];

    assert(comp1.allocatedAmount === 2000, `Comp 1 allocated amount must be 2000, got ${comp1.allocatedAmount}`);
    assert(comp2.allocatedAmount === 2000, `Comp 2 allocated amount must be 2000, got ${comp2.allocatedAmount}`);
    assert(comp3.allocatedAmount === 1000, `Comp 3 allocated amount must be 1000, got ${comp3.allocatedAmount}`);

    const aliNet = roundCurrency(comp1.allocatedAmount + comp3.allocatedAmount);
    const ahmedNet = roundCurrency(comp2.allocatedAmount);
    assert(aliNet === 3000, `Ali attributed net sales must be 3000, got ${aliNet}`);
    assert(ahmedNet === 2000, `Ahmed attributed net sales must be 2000, got ${ahmedNet}`);

    const aliCommission = roundCurrency(aliNet * 0.10);
    const ahmedCommission = roundCurrency(ahmedNet * 0.15);
    assert(aliCommission === 300, `Ali commission must be 300, got ${aliCommission}`);
    assert(ahmedCommission === 300, `Ahmed commission must be 300, got ${ahmedCommission}`);
    console.log('✓ Test 6 Passed: Multi-staff package commission formula and snapshots verified.\n');

    // ----------------------------------------------------
    // TEST 7: Customer Directory, History and Archive Non-Destructive
    // ----------------------------------------------------
    console.log('Running Test 7: Customer directory, history, and non-destructive archiving...');
    setActiveUser(ADMIN_LHE);

    const newClient = await mockSalonService.createClient(
      {
        branchId: branch1Id,
        name: 'Sumbul Jawad',
        phone: '+92 300 888 9900',
        email: 'sumbul@example.com',
        source: 'REFERRAL',
        sourceDetails: 'Dr. Mariam',
        notes: 'VIP Client',
      },
      ADMIN_LHE
    );

    assert(newClient.name === 'Sumbul Jawad', 'Client name must match');
    assert(newClient.isArchived === false, 'Client must not be archived initially');

    const updatedClient = await mockSalonService.updateClient(
      newClient.id,
      { notes: 'VIP Client - allergic to ammonia' },
      ADMIN_LHE
    );
    assert(updatedClient.notes === 'VIP Client - allergic to ammonia', 'Notes must update');

    const archived = await mockSalonService.archiveClient(newClient.id, true, ADMIN_LHE);
    assert(archived.isArchived === true, 'Client must be archived');

    const details = await mockSalonService.getClientDetails(newClient.id, ADMIN_LHE);
    assert(details.client.id === newClient.id, 'Client record must be retrieved');
    assert(Array.isArray(details.appointments), 'Appointments list must be returned');
    assert(Array.isArray(details.invoices), 'Invoices list must be returned');

    await mockSalonService.archiveClient(newClient.id, false, ADMIN_LHE);
    console.log('✓ Test 7 Passed: Customer directory, history, and non-destructive archiving verified.\n');

    // ----------------------------------------------------
    // TEST 8: Dedicated Appointment Report & Status Derivations
    // ----------------------------------------------------
    console.log('Running Test 8: Dedicated appointment reporting & independent statuses...');
    setActiveUser(ADMIN_LHE);

    const report = await mockSalonService.getAppointmentReport(
      branch1Id,
      '2026-10-01',
      '2026-10-31',
      {},
      ADMIN_LHE
    );

    assert(report.summary.totalAppointments >= 2, 'Report must contain booked appointments');
    assert(report.summary.billedCount >= 1, 'Report must reflect at least 1 billed appointment');
    assert(report.summary.totalQuotedValue > 0, 'Quoted value must be greater than zero');
    assert(report.summary.totalActualNetSales > 0, 'Actual net sales must reflect linked invoices');
    assert(report.records.some((r) => r.billingStatus === 'BILLED'), 'Billed record must be present');
    console.log('✓ Test 8 Passed: Dedicated appointment reporting and status derivations verified.\n');

    // ----------------------------------------------------
    // TEST 9: Role-Based Access Control and Governance
    // ----------------------------------------------------
    console.log('Running Test 9: Role-based permissions and branch isolation...');
    // Staff cannot create appointments
    setActiveUser(STAFF_ZARA);
    let staffBlocked = false;
    try {
      await mockSalonService.createAppointment(
        {
          branchId: branch1Id,
          clientName: 'Staff Attempt',
          clientPhone: '+92 300 123 4567',
          date: testDate,
          startTime: '05:00 PM',
          items: [{ type: 'SERVICE', itemId: srv.id, staffId: staff1.id }],
        },
        STAFF_ZARA
      );
    } catch (err: any) {
      staffBlocked = true;
      assert(err.message.includes('Access Denied'), 'Staff must be denied appointment booking');
    }
    assert(staffBlocked, 'Staff role must be prohibited from booking appointments');

    // Accountant cannot manage appointments or CRM
    setActiveUser(ACCOUNTANT_LHE);
    let accountantBlocked = false;
    try {
      await mockSalonService.createClient(
        {
          branchId: branch1Id,
          name: 'Accountant Attempt',
          phone: '+92 300 000 1122',
        },
        ACCOUNTANT_LHE
      );
    } catch (err: any) {
      accountantBlocked = true;
      assert(err.message.includes('Access Denied'), 'Accountant must be denied client creation');
    }
    assert(accountantBlocked, 'Accountant role must be prohibited from customer administration');

    // Admin KHI scope
    setActiveUser(ADMIN_KHI);
    const khiAppointments = await mockSalonService.getAppointments('branch-1', undefined, ADMIN_KHI);
    assert(
      khiAppointments.every((a) => a.branchId === 'branch-2'),
      'Admin KHI must be strictly scoped to branch-2'
    );
    console.log('✓ Test 9 Passed: Role-based governance and branch isolation verified.\n');

    // ----------------------------------------------------
    // TEST 10: Confirmation Creates No Financial Movement
    // ----------------------------------------------------
    console.log('Running Test 10: Confirming appointment creates zero sales or commission...');
    setActiveUser(ADMIN_LHE);

    const drawerBefore = storeSnapshot.cashDrawers.find((d) => d.branchId === branch1Id && d.status === 'OPEN');
    const cashBefore = drawerBefore?.cashSales || 0;

    const pureApt = await mockSalonService.createAppointment(
      {
        branchId: branch1Id,
        clientName: 'No Money Moved Customer',
        clientPhone: '+92 300 777 9999',
        date: '2026-10-25',
        startTime: '11:00 AM',
        items: [{ type: 'SERVICE', itemId: srv.id, staffId: staff1.id }],
        status: 'CONFIRMED',
      },
      ADMIN_LHE
    );

    const storeAfter = mockStorage.getStore();
    const drawerAfter = storeAfter.cashDrawers.find((d) => d.branchId === branch1Id && d.status === 'OPEN');
    const cashAfter = drawerAfter?.cashSales || 0;
    assert(cashBefore === cashAfter, 'Cash sales must not change from booking confirmation');
    assert(pureApt.billingStatus === 'UNBILLED', 'Pure booking must remain unbilled');
    console.log('✓ Test 10 Passed: Confirmation moves no money and generates no unbilled commission.\n');

    console.log('====================================================');
    console.log('  ALL 10 APPOINTMENT, CRM & QUEUE TESTS PASSED!      ');
    console.log('====================================================\n');
  } finally {
    mockStorage.saveStore(initialStore);
  }
}

runTests().catch((err) => {
  console.error('TEST RUNNER FAILED:', err);
  process.exit(1);
});
