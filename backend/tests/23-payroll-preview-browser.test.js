// Opt-in browser verification against the isolated test database, never the live salon.
// SALONOS_PLAYWRIGHT_MODULE may point to an already-installed Playwright module.
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import prisma from '../src/config/prisma.js';
import app from '../src/app.js';
import { ACCOUNTS } from './helpers.js';
import { setSystemDate } from '../src/modules/settings/settings.service.js';
import { postInvoice } from '../src/modules/pos/pos.service.js';

describe.skipIf(!process.env.SALONOS_BROWSER_VERIFY)('Payroll browser → API → database', () => {
  it('shows employment proration, unpaid commission and the reconciled total, then finalizes without paying', async () => {
    const actor = { id: 'usr-super-01', name: 'Super Admin', role: 'SUPER_ADMIN' };
    const branch = await prisma.branch.create({ data: { name: 'Payroll browser verification', code: 'PBR', address: 'Test', city: 'Lahore', phone: '03000000000' } });
    const account = await prisma.paymentAccount.create({ data: { branchId: branch.id, name: 'Browser bank', accountType: 'BANK', providerName: 'Test', accountHolder: 'Salon', openingBalance: 100000 } });
    const staff = await prisma.staff.create({ data: { branchId: branch.id, name: 'Browser Monthly Staff', employeeCode: 'PBR-1', phone: '03001239876',
      roleTitle: 'Barber', designation: 'Barber', joiningDate: new Date('2026-10-08'), effectiveDate: new Date('2026-10-01'),
      compensationType: 'MONTHLY_PLUS_COMMISSION', baseSalary: 30000, commissionRate: 10, overtimeHourlyRate: 200,
      lateInDeduction: { mode: 'NONE' }, earlyExitDeduction: { mode: 'NONE' }, specialties: [] } });
    await prisma.attendanceRecord.createMany({ data: Array.from({ length: 8 }, (_, i) => ({ branchId: branch.id, staffId: staff.id,
      workDate: new Date(`2026-10-${String(i + 1).padStart(2, '0')}`), checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'PRESENT', isFinalized: true })) });
    await prisma.overtimeRecord.create({ data: { branchId: branch.id, staffId: staff.id, workDate: new Date('2026-10-08'), overtimeNumber: 'OT-PBR',
      minutes: 60, approvedMinutes: 60, hourlyRate: 200, amount: 200, status: 'APPROVED', reason: 'Test OT', enteredByUserId: actor.id, enteredByName: actor.name } });
    const category = await prisma.serviceCategory.create({ data: { branchId: branch.id, name: 'Hair' } });
    const service = await prisma.service.create({ data: { branchId: branch.id, categoryId: category.id, code: 'PBR-HAIR', name: 'Haircut', durationMinutes: 30, price: 1000 } });
    await setSystemDate('2026-10-08', actor);
    await postInvoice({ branchId: branch.id, clientName: 'Browser Test', clientPhone: '03101239876',
      cartItems: [{ type: 'SERVICE', item: { id: service.id, price: 1000 }, quantity: 1, staffId: staff.id }],
      payments: [{ method: 'ONLINE_ACCOUNT', paymentAccountId: account.id, amount: 1000, billAllocation: 1000, tipAllocation: 0 }] }, actor, 'browser-payroll-sale');

    const server = app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    const apiPort = server.address().port;
    const frontendDir = resolve('../Salon Software Frontend');
    const vite = spawn(process.execPath, [resolve(frontendDir, 'node_modules/vite/bin/vite.js'), '--port', '3107', '--host', '127.0.0.1', '--strictPort'], {
      cwd: frontendDir, windowsHide: true, env: { ...process.env, VITE_USE_MOCK: 'false', VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` }, stdio: 'pipe',
    });
    let browser;
    try {
      let output = '';
      vite.stderr.on('data', d => { output += d.toString(); });
      vite.stdout.on('data', d => { output += d.toString(); });
      for (let n = 0; n < 150; n++) {
        if (vite.exitCode !== null) throw new Error(output);
        if (await fetch('http://127.0.0.1:3107').then(r => r.ok).catch(() => false)) break;
        await new Promise(r => setTimeout(r, 200));
      }
      const module = process.env.SALONOS_PLAYWRIGHT_MODULE;
      const { chromium } = await import(module ? pathToFileURL(module).href : 'playwright');
      browser = await chromium.launch({ headless: true, ...(process.env.SALONOS_BROWSER_CHANNEL ? { channel: process.env.SALONOS_BROWSER_CHANNEL } : {}) });
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:3107');
      await page.getByPlaceholder('e.g. superadmin@isysware.com').fill(ACCOUNTS.super.identifier);
      await page.locator('input[type="password"]').fill(ACCOUNTS.super.password);
      await page.getByRole('button', { name: 'Login to Portal' }).click();
      await page.waitForURL(url => url.pathname !== '/login' && url.pathname !== '/');
      await page.goto('http://127.0.0.1:3107/accounts/payroll');
      const field = label => page.locator('label').filter({ hasText: new RegExp(`^${label}$`) }).locator('..');
      await field('Branch').locator('select').selectOption(branch.id);
      await field('Payroll Month').locator('input').fill('2026-10');
      await field('Employee').locator('select').selectOption(staff.id);
      await field('Payroll Period').locator('select').selectOption('CUSTOM_RANGE');
      await field('From Date').locator('input').fill('2026-10-01');
      await field('To Date').locator('input').fill('2026-10-08');
      const response = page.waitForResponse(r => r.url().endsWith('/payroll/preview') && r.request().method() === 'POST');
      await page.getByRole('button', { name: /Generate Preview/ }).click();
      const previewResponse = await response;
      expect(previewResponse.status()).toBe(201);
      const preview = (await previewResponse.json()).data;
      expect(preview.payslips[0]).toMatchObject({ baseEarnings: 967.74, approvedOvertimeAmount: 200, commissionPayable: 100, netPayable: 1267.74 });
      await page.getByText('Eligible days: 1 / 31', { exact: true }).waitFor();
      expect(await page.getByText('Joined: 2026-10-08', { exact: true }).count()).toBeGreaterThan(0);
      expect(await page.getByRole('columnheader', { name: 'Commission', exact: true }).count()).toBeGreaterThan(0);
      await mkdir('test-artifacts', { recursive: true });
      await page.screenshot({ path: 'test-artifacts/payroll-preview.png', fullPage: true });
      await page.getByRole('button', { name: /Finalize & Lock Payroll Run/ }).click();
      await page.getByTitle('View Calculation Details').click();
      await page.getByText(/Commission \(Rs\. 100\).*Net Payable \(Rs\. 1,267\.74\)/).waitFor();
      const stored = await prisma.payslip.findFirst({ where: { runId: preview.id } });
      expect(Number(stored.netPayable)).toBe(1167.74);
      expect(await prisma.commissionPayment.count({ where: { staffId: staff.id } })).toBe(0);
      expect(await prisma.commissionStatement.findFirst({ where: { staffId: staff.id } })).toMatchObject({ payrollPayslipId: stored.id });
      expect(errors).toEqual([]);
    } finally {
      await browser?.close();
      vite.kill();
      await new Promise(r => server.close(r));
    }
  }, 120000);
});
