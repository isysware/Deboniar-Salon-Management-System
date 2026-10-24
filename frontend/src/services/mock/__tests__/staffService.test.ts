import { mockSalonService } from '../mockSalonService';
import { mockAuthService } from '../mockAuthService';
import { mockStorage } from '../mockStorage';
import { CompensationType } from '../../../types/salon';

async function runStaffTests() {
  console.log('====================================================');
  console.log('  RUNNING SALONOS STAFF & COMPENSATION TEST SUITE   ');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      failedCount++;
    }
  }

  try {
    // Authenticate as Super Admin for initial tests
    const superAdminSession = await mockAuthService.login({
      portal: 'SUPER_ADMIN',
      identifier: 'superadmin@isysware.com',
      password: 'Super@Salon2026',
      rememberMe: false,
    });
    const superAdminUser = superAdminSession.user;

    // Clean up any test records from prior runs
    const initStore = mockStorage.getStore();
    initStore.staff = initStore.staff.filter((s) => !s.employeeCode.startsWith('TEST-'));
    mockStorage.saveStore(initStore);
    mockStorage.reloadFromStorage();

    // 1. Saving and reloading all 5 compensation types
    console.log('--- TEST GROUP 1: Five Compensation Types Saving & Reloading ---');
    const compTypes: CompensationType[] = [
      'MONTHLY_SALARY',
      'DAILY_SALARY',
      'MONTHLY_PLUS_COMMISSION',
      'DAILY_PLUS_COMMISSION',
      'COMMISSION_ONLY',
    ];

    const runId = Date.now().toString(36);
    for (let i = 0; i < compTypes.length; i++) {
      const type = compTypes[i];
      const code = `TEST-${runId}-${i + 1}`;
      const res = await mockSalonService.createStaffMember(
        {
          employeeCode: code,
          name: `Test Staff ${type}`,
          phone: `+9230000000${i}`,
          branchId: 'branch-1',
          designation: 'Test Specialist',
          joiningDate: '2026-09-28',
          compensationType: type,
          baseSalary: type.includes('MONTHLY') ? 80000 : 0,
          dailySalaryRate: type.includes('DAILY') ? 3500 : 0,
          commissionRate: type.includes('COMMISSION') ? 17.5 : 0,
          overtimeHourlyRate: 600,
          effectiveDate: '2026-09-28',
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
        },
        superAdminUser
      );

      const reloaded = await mockSalonService.getStaffMember(res.staff.id);
      assert(
        reloaded !== null && reloaded.compensationType === type,
        `Created and reloaded compensation type: ${type}`,
        `Expected ${type}, got ${reloaded?.compensationType} (baseSalary=${reloaded?.baseSalary}, dailyRate=${reloaded?.dailySalaryRate}, commission=${reloaded?.commissionRate})`
      );
    }

    // 2. Hidden field leakage prevention when switching types
    console.log('\n--- TEST GROUP 2: Hidden Field Leakage Prevention on Type Switch ---');
    const staffToSwitch = await mockSalonService.createStaffMember(
      {
        employeeCode: 'TEST-LEAK-01',
        name: 'Leak Test Employee',
        phone: '+923001112233',
        branchId: 'branch-1',
        designation: 'Stylist',
        joiningDate: '2026-09-28',
        compensationType: 'MONTHLY_PLUS_COMMISSION',
        baseSalary: 90000,
        dailySalaryRate: 0,
        commissionRate: 25,
        overtimeHourlyRate: 700,
      },
      superAdminUser
    );

    // Switch to MONTHLY_SALARY
    const switched1 = await mockSalonService.updateStaffMember(
      staffToSwitch.staff.id,
      {
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 85000,
        commissionRate: 25, // Should be zeroed out
      },
      superAdminUser
    );

    assert(
      switched1.baseSalary === 85000 && switched1.commissionRate === 0 && switched1.dailySalaryRate === 0,
      'Switching to MONTHLY_SALARY zeroes out commission and daily rate'
    );

    // Switch to COMMISSION_ONLY
    const switched2 = await mockSalonService.updateStaffMember(
      staffToSwitch.staff.id,
      {
        compensationType: 'COMMISSION_ONLY',
        commissionRate: 30,
      },
      superAdminUser
    );

    assert(
      switched2.commissionRate === 30 && switched2.baseSalary === 0 && switched2.dailySalaryRate === 0,
      'Switching to COMMISSION_ONLY zeroes out base salary and daily rate'
    );

    // 3. Schedule & overnight validation
    console.log('\n--- TEST GROUP 3: Working Schedule & Overnight Shifts ---');
    const overnightStaff = await mockSalonService.createStaffMember(
      {
        employeeCode: 'TEST-OVER-01',
        name: 'Night Shift Specialist',
        phone: '+923004445566',
        branchId: 'branch-1',
        designation: 'Night Stylist',
        joiningDate: '2026-09-28',
        compensationType: 'MONTHLY_SALARY',
        baseSalary: 80000,
        overtimeHourlyRate: 600,
        startTime: '21:00',
        endTime: '05:00',
        lateGraceMinutes: 20,
        earlyGraceMinutes: 15,
        isOvernightShift: true,
      },
      superAdminUser
    );

    assert(
      overnightStaff.staff.startTime === '21:00' &&
        overnightStaff.staff.endTime === '05:00' &&
        overnightStaff.staff.isOvernightShift === true,
      'Overnight shift configuration stored and validated cleanly'
    );

    // 4. Deduction Configuration & Payroll Divisor Requirement
    console.log('\n--- TEST GROUP 4: Deduction Rules & Payroll Divisor Requirement ---');
    let divisorErrorCaught = false;
    try {
      await mockSalonService.createStaffMember(
        {
          employeeCode: 'TEST-[#DIV]-01',
          name: 'Divisor Fail Employee',
          phone: '+923009998877',
          branchId: 'branch-1',
          designation: 'Stylist',
          joiningDate: '2026-09-28',
          compensationType: 'MONTHLY_SALARY',
          baseSalary: 75000,
          overtimeHourlyRate: 500,
          lateInDeduction: { enabled: true, type: 'PERCENTAGE', amount: 5 },
          payrollDivisor: 0, // Invalid
        },
        superAdminUser
      );
    } catch (err: any) {
      if (err.message.includes('Payroll divisor')) {
        divisorErrorCaught = true;
      }
    }

    assert(
      divisorErrorCaught,
      'Rejects monthly percentage deduction when payroll divisor is missing or 0'
    );

    // Commission Only disables salary deductions automatically
    const commOnlyStaff = await mockSalonService.createStaffMember(
      {
        employeeCode: 'TEST-COMM-DED',
        name: 'Comm Only Deduct Test',
        phone: '+923007778899',
        branchId: 'branch-1',
        designation: 'Commission Artist',
        joiningDate: '2026-09-28',
        compensationType: 'COMMISSION_ONLY',
        commissionRate: 20,
        overtimeHourlyRate: 500,
        lateInDeduction: { enabled: true, type: 'FIXED', amount: 500 },
      },
      superAdminUser
    );

    assert(
      commOnlyStaff.staff.lateInDeduction.enabled === false,
      'Disables salary deductions automatically for Commission Only staff'
    );

    // 5. Safe migration of legacy records
    console.log('\n--- TEST GROUP 5: Safe Migration of Existing Staff ---');
    const legacyRecord = {
      id: 'legacy-staff-101',
      employeeCode: 'EMP-LEG-101',
      branchId: 'branch-1',
      name: 'Legacy Stylist',
      phone: '+923001110000',
      designation: 'Stylist',
      joiningDate: '2024-01-01',
      baseSalary: 60000,
      commissionRate: 0.15, // Legacy ratio representation
      overtimeHourlyRate: 400,
      isActive: true,
      avatarUrl: 'https://images.unsplash.com/legacy-photo.jpg',
    };

    const { migrateStaffMember } = await import('../mockStorage');
    const migratedStaff = migrateStaffMember(legacyRecord);

    assert(
      migratedStaff.compensationType === 'MONTHLY_PLUS_COMMISSION' &&
        migratedStaff.commissionRate === 15 &&
        migratedStaff.avatarUrl === undefined &&
        migratedStaff.startTime === '09:00' &&
        migratedStaff.allowedLeaveDays === 12,
      'Legacy staff record mapped non-destructively with stripped avatar and safe defaults'
    );

    // 6. Access Control & Cross-Branch Enforcement
    console.log('\n--- TEST GROUP 6: Access Control & Permission Enforcement ---');
    const gulbergSession = await mockAuthService.login({
      portal: 'ADMIN',
      identifier: 'admin.gulberg@isysware.com',
      password: 'Admin@Gulberg2026',
      rememberMe: false,
    });
    const gulbergUser = gulbergSession.user;

    let crossBranchBlocked = false;
    try {
      // Gulberg Admin tries to update Clifton staff (staff-4 is in branch-2)
      await mockSalonService.updateStaffMember(
        'staff-4',
        { baseSalary: 100000 },
        gulbergUser
      );
    } catch (err: any) {
      if (err.message.includes('Access Denied')) {
        crossBranchBlocked = true;
      }
    }
    assert(crossBranchBlocked, 'Branch Admin rejected when modifying staff in another branch');

    const accountantSession = await mockAuthService.login({
      portal: 'ACCOUNTANT',
      identifier: 'accountant.gulberg@isysware.com',
      password: 'Accountant@2026',
      rememberMe: false,
    });
    const accountantUser = accountantSession.user;

    let accountantBlocked = false;
    try {
      await mockSalonService.createStaffMember(
        {
          employeeCode: 'TEST-ACC-BL',
          name: 'Accountant Hack',
          phone: '+923000000000',
          branchId: 'branch-1',
          designation: 'Test',
          joiningDate: '2026-09-28',
          compensationType: 'MONTHLY_SALARY',
          overtimeHourlyRate: 500,
        },
        accountantUser
      );
    } catch (err: any) {
      if (err.message.includes('Access Denied')) {
        accountantBlocked = true;
      }
    }
    assert(accountantBlocked, 'Accountant user rejected from creating staff members');
  } catch (globalErr: any) {
    console.error('CRITICAL UNHANDLED ERROR IN SUITE:', globalErr);
    failedCount++;
  }

  console.log('\n====================================================');
  console.log(`  STAFF TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED  `);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runStaffTests();
