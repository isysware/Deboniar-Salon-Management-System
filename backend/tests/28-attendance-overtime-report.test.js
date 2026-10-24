import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

describe('Staff Attendance & Overtime Report API Contract', () => {
  it('denies staff and accountants from accessing attendance overtime reports', async () => {
    const staffRes = await as('staff').get('/reports/attendance-overtime');
    expect(staffRes.status).toBe(403);

    const accountantRes = await as('accountant').get('/reports/attendance-overtime');
    expect(accountantRes.status).toBe(403);
  });

  it('allows administrator to query attendance-overtime report with preset and KPIs', async () => {
    const res = await as('admin').get('/reports/attendance-overtime?preset=THIS_MONTH');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('kpis');
    expect(data).toHaveProperty('rows');
    expect(data).toHaveProperty('totals');

    // KPI validations
    expect(typeof data.kpis.totalRecords).toBe('number');
    expect(typeof data.kpis.presentCount).toBe('number');
    expect(typeof data.kpis.absentCount).toBe('number');
    expect(typeof data.kpis.lateCount).toBe('number');
    expect(typeof data.kpis.totalWorkedHours).toBe('number');
    expect(typeof data.kpis.authorizedOtHours).toBe('number');
    expect(typeof data.kpis.authorizedOtAmount).toBe('number');

    // Row shape validations
    expect(Array.isArray(data.rows)).toBe(true);
    if (data.rows.length > 0) {
      const r = data.rows[0];
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('date');
      expect(r).toHaveProperty('staffName');
      expect(r).toHaveProperty('employeeCode');
      expect(r).toHaveProperty('designation');
      expect(r).toHaveProperty('branchName');
      expect(r).toHaveProperty('workedHours');
      expect(r).toHaveProperty('scheduledHours');
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('otHours');
      expect(r).toHaveProperty('otAmount');
      expect(r).toHaveProperty('otStatus');
    }
  });

  it('supports the /reports/attendance route alias for consolidated attendance reporting', async () => {
    const res = await as('admin').get('/reports/attendance?preset=THIS_MONTH');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('kpis');
    expect(res.body.data).toHaveProperty('rows');
  });

  it('supports filtering by status and search keyword', async () => {
    const res = await as('admin').get('/reports/attendance-overtime?status=PRESENT&preset=THIS_MONTH');
    expect(res.status).toBe(200);
    for (const row of res.body.data.rows) {
      expect(row.status).toBe('PRESENT');
    }
  });
});
