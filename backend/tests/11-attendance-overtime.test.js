// Step 14 — Attendance, leaves, holidays · Step 15 — Manual overtime
import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Step 14 · Attendance', () => {
  let record;

  it('records punches with lateness/early-exit from the shared engine', async () => {
    const res = await as('admin').post('/attendance', { staffId: 'staff-1', date: '2026-09-22', checkIn: '09:20 AM', checkOut: '05:30 PM' });
    expect(res.status).toBe(201);
    record = res.body.data;
    expect(record).toMatchObject({
      staffName: 'Zara Alvi', status: 'PRESENT', isLate: true, lateMinutes: 20, isEarlyExit: true, earlyExitMinutes: 30,
      scheduledHours: 9, scheduledShift: '09:00 AM - 06:00 PM',
    });
    expect(record.punches.map((p) => p.type)).toEqual(['CHECK_IN', 'CHECK_OUT']);
    expect(record.calculationSnapshot.compensationType).toBe('MONTHLY_PLUS_COMMISSION');
  });

  it('rejects duplicates and impossible punches', async () => {
    expect((await as('admin').post('/attendance', { staffId: 'staff-1', date: '2026-09-22', checkIn: '09:00' })).status).toBe(409);
    expect((await as('admin').post('/attendance', { staffId: 'staff-2', date: '2026-09-22', checkIn: '06:00 PM', checkOut: '10:00 AM' })).status).toBe(400);
    expect((await as('admin').post('/attendance', { staffId: 'staff-4', date: '2026-09-22', checkIn: '09:00' })).status).toBe(400);
  });

  it('corrections keep a before/after audit trail', async () => {
    const res = await as('admin').put(`/attendance/${record.id}/correct`, { checkIn: '09:05 AM', checkOut: '06:00 PM', reason: 'Biometric device delay' });
    expect(res.body.data).toMatchObject({ isLate: false, isEarlyExit: false });
    expect(res.body.data.correctionHistory).toHaveLength(1);
    expect(res.body.data.correctionHistory[0].beforeSnapshot).toMatchObject({ checkIn: '09:20 AM', isLate: true });
    expect((await as('admin').put(`/attendance/${record.id}/correct`, { checkIn: '09:00' })).status).toBe(400);
  });

  it('CSV import accepts, flags duplicates and rejects unknown codes', async () => {
    const res = await as('admin').post('/attendance/import-csv', {
      rows: [
        { rowNumber: 1, employeeCode: 'emp-lhe-001', date: '2026-09-21', checkIn: '09:05 AM', checkOut: '06:05 PM', deviceId: 'ZK-01' },
        { rowNumber: 2, employeeCode: 'EMP-LHE-001', date: '2026-09-21', checkIn: '09:10 AM' },
        { rowNumber: 3, employeeCode: 'EMP-X-999', date: '2026-09-21', checkIn: '09:10 AM' },
      ],
    });
    expect(res.body.data).toMatchObject({ totalRows: 3, acceptedRows: 1, duplicateRows: 1, rejectedRows: 1 });
  });

  it('access: accountants blocked, staff see only themselves', async () => {
    expect((await as('accountant').get('/attendance')).status).toBe(403);
    const mine = await as('staff').get('/attendance');
    expect(mine.body.data.every((r) => r.staffId === 'staff-1')).toBe(true);
    expect((await as('staff').get('/attendance?staffId=staff-2')).status).toBe(403);
    const me = await as('staff').get('/attendance/me');
    expect(me.body.data.summary).toMatchObject({ staffName: 'Zara Alvi', allowance: { isConfigured: true, allowedDays: 12 } });
  });
});

describe('Step 14 · Leaves & finalize day', () => {
  let leave;

  it('paid leave counts working days only and blocks attendance & bookings', async () => {
    const res = await as('admin').post('/leaves', { staffId: 'staff-2', startDate: '2026-09-23', endDate: '2026-09-27', type: 'PAID', reason: 'Family wedding' });
    expect(res.status).toBe(201);
    leave = res.body.data;
    expect(leave).toMatchObject({ totalDays: 4, status: 'APPROVED', staffName: 'Hamza Malik' }); // Sunday 27th excluded
    const days = await as('admin').get('/attendance?staffId=staff-2&startDate=2026-09-23&endDate=2026-09-27');
    expect(days.body.data.map((d) => d.status)).toEqual(['PAID_LEAVE', 'PAID_LEAVE', 'PAID_LEAVE', 'PAID_LEAVE']);

    expect((await as('admin').post('/attendance', { staffId: 'staff-2', date: '2026-09-24', checkIn: '10:00' })).status).toBe(409);
    const booking = await as('admin').post('/appointments', {
      clientName: 'Leave Test', clientPhone: '03009990001', date: '2026-09-24', startTime: '11:00',
      items: [{ type: 'SERVICE', itemId: 'srv-lhe-02', staffId: 'staff-2' }],
    });
    expect(booking.status).toBe(409);
    expect(booking.body.error.code).toBe('STAFF_ON_LEAVE');
    expect((await as('admin').post('/leaves', { staffId: 'staff-2', startDate: '2026-09-25', endDate: '2026-09-25', type: 'UNPAID', reason: 'x' })).status).toBe(409);
  });

  it('cancelling removes the leave days', async () => {
    const res = await as('admin').post(`/leaves/${leave.id}/cancel`, { reason: 'Event postponed' });
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Event postponed' });
    const days = await as('admin').get('/attendance?staffId=staff-2&startDate=2026-09-23&endDate=2026-09-27');
    expect(days.body.data).toHaveLength(0);
  });

  it('finalize day marks absentees; future dates are blocked', async () => {
    await as('super').put('/system/date', { date: '2026-09-28' });
    expect((await as('admin').post('/attendance/finalize-day', { date: '2026-12-01' })).status).toBe(400);
    const res = await as('admin').post('/attendance/finalize-day', { date: '2026-09-22' });
    expect(res.status).toBe(200);
    expect(res.body.data.markedAbsentStaffNames).toContain('Hamza Malik');
    expect(res.body.data.markedAbsentStaffNames).not.toContain('Zara Alvi');
  });

  it('holidays are not working days', async () => {
    const h = await as('admin').post('/holidays', { date: '2026-09-29', title: 'Eid' });
    expect(h.status).toBe(201);
    const res = await as('admin').post('/leaves', { staffId: 'staff-1', startDate: '2026-09-29', endDate: '2026-09-29', type: 'UNPAID', reason: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_WORKING_DAYS');
  });
});

describe('Step 15 · Manual overtime', () => {
  let ot;

  it('admin enters overtime; duplicates for the same day are blocked', async () => {
    const res = await as('admin').post('/overtime', { staffId: 'staff-1', date: '2026-09-22', minutes: 90, reason: 'Bridal party ran late', status: 'SUBMITTED' });
    expect(res.status).toBe(201);
    ot = res.body.data;
    expect(ot).toMatchObject({ overtimeNumber: 'OT-LHE-01-2026-0001', status: 'SUBMITTED', approvedMinutes: 0, hourlyRate: 600, amount: 900 });
    expect((await as('admin').post('/overtime', { staffId: 'staff-1', date: '2026-09-22', minutes: 30, reason: 'x' })).status).toBe(409);
    expect((await as('accountant').get('/overtime')).status).toBe(403);
  });

  it('approval snapshots the rate; staff only ever see approved minutes', async () => {
    const pending = await as('admin').post('/overtime', { staffId: 'staff-1', date: '2026-09-23', minutes: 60, reason: 'Inventory count', status: 'SUBMITTED' });
    await as('admin').post(`/overtime/${pending.body.data.id}/reject`, { reason: 'Not pre-approved' });

    const ok = await as('admin').post(`/overtime/${ot.id}/approve`);
    expect(ok.body.data).toMatchObject({ status: 'APPROVED', approvedMinutes: 90, amount: 900, approvedByName: 'Aamina Sheikh' });
    expect((await as('admin').put(`/overtime/${ot.id}`, { minutes: 10 })).status).toBe(409);

    const me = await as('staff').get('/overtime/me');
    expect(me.body.data).toMatchObject({ approvedMinutes: 90, approvedPay: 900 });
    const list = await as('staff').get('/overtime');
    expect(list.body.data.every((o) => o.status === 'APPROVED')).toBe(true);
  });
});
