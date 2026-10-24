import { beforeEach, expect, it, vi } from 'vitest';
const { tx, staff } = vi.hoisted(() => {
  const staff = { id: 's', branchId: 'b', isActive: true, startTime: '09:00', endTime: '18:00', compensationType: 'DAILY_SALARY', dailySalaryRate: 1000 };
  const tx = { staff: { findMany: vi.fn() }, attendanceRecord: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } };
  return { tx, staff };
});
vi.mock('../src/config/prisma.js', () => ({ default: { $transaction: fn => fn(tx) } }));
vi.mock('../src/lib/audit.js', () => ({ auditLog: vi.fn() }));
vi.mock('../src/lib/hrTransactions.js', () => ({ lockStaffPayBranch: vi.fn(), assertPayrollPeriodOpen: vi.fn() }));
vi.mock('../src/modules/staff/staff.mapper.js', () => ({ toStaffDTO: s => s }));
import { bulkSaveAttendance } from '../src/modules/attendance/attendance.service.js';
const actor = { id: 'admin', name: 'Admin', role: 'SUPER_ADMIN' };
const save = item => bulkSaveAttendance({ branchId: 'b', date: '2026-10-12', records: [{ staffId: 's', status: 'PRESENT', ...item }] }, actor);
beforeEach(() => { vi.clearAllMocks(); tx.staff.findMany.mockResolvedValue([staff]); tx.attendanceRecord.findUnique.mockResolvedValue(null); });
it('keeps blank punches blank instead of inventing shift times', async () => {
  await save({});
  expect(tx.attendanceRecord.create.mock.calls[0][0].data).toMatchObject({ checkIn: '', checkOut: null, workedHours: 0, isMissingPunch: true, punches: { create: [] } });
});
it('saves check-in only then completes the same attendance on checkout', async () => {
  await save({ checkIn: '09:00' });
  expect(tx.attendanceRecord.create.mock.calls[0][0].data).toMatchObject({ checkIn: '09:00', checkOut: null, workedHours: 0, isMissingPunch: true });
  tx.attendanceRecord.findUnique.mockResolvedValue({ id: 'record' });
  await save({ checkIn: '09:00', checkOut: '18:00' });
  expect(tx.attendanceRecord.update.mock.calls[0][0]).toMatchObject({ where: { id: 'record' }, data: { status: 'PRESENT', workedHours: 9, isMissingPunch: false } });
});
it('rejects checkout without check-in', async () => {
  await expect(save({ checkOut: '18:00' })).rejects.toThrow('Enter check-in before check-out.');
  expect(tx.attendanceRecord.create).not.toHaveBeenCalled();
});
it('preserves half-day status after both punches are entered', async () => {
  await save({ status: 'HALF_DAY', checkIn: '09:00', checkOut: '13:00' });
  expect(tx.attendanceRecord.create.mock.calls[0][0].data).toMatchObject({ status: 'HALF_DAY', workedHours: 4, isMissingPunch: false });
});
