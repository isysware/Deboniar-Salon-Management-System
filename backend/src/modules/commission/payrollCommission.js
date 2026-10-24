// Canonical commission statements remain the liability/payment source, even when paid in payroll.
import { buildStatements } from './commission.service.js';
import { conflict } from '../../lib/AppError.js';
import { round2, toDec } from '../../lib/money.js';
import { dateOnly } from '../../lib/dates.js';
import { nextSequence } from '../../lib/sequence.js';

export const lockCommissionBranch = (tx, branchId) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`commission:${branchId}`}::text))`;

export const combinedContract = (type) => ['DAILY_PLUS_COMMISSION', 'MONTHLY_PLUS_COMMISSION', 'COMMISSION_ONLY'].includes(type);
export const completedAmount = (payments) => round2(payments.filter((p) => p.status === 'COMPLETED').reduce((s, p) => s.plus(p.amount), toDec(0)));

// Net lifetime earnings also carry refund debt across periods. Never pay a clamped estimate.
export const availableCommission = async (tx, branchId, staffId) => {
  const events = await tx.commissionEvent.groupBy({ by: ['type'], where: { branchId, staffId }, _sum: { amount: true } });
  const paid = await tx.commissionPayment.aggregate({ where: { branchId, staffId, status: 'COMPLETED' }, _sum: { amount: true } });
  const earned = toDec(events.find((e) => e.type === 'EARN')?._sum.amount ?? 0);
  const reversed = toDec(events.find((e) => e.type === 'REVERSAL')?._sum.amount ?? 0);
  return round2(earned.minus(reversed).minus(paid._sum.amount ?? 0));
};

export const assertCommissionAvailable = async (tx, branchId, staffId, amount) => {
  if (toDec(amount).greaterThan(await availableCommission(tx, branchId, staffId))) {
    throw conflict('COMMISSION_REFUND_ADJUSTMENT', 'Commission changed after finalization (refund or payout). Cancel the unpaid run and regenerate before paying commission.');
  }
};

export const payrollCommission = async (tx, actor, branchId, month, staffIds, finalize = false, period = {}) => {
  const startDate = period.startDate || `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const endDate = period.endDate || `${month}-${new Date(year, m, 0).getDate()}`;
  const built = await buildStatements(tx, branchId, startDate, endDate, undefined, staffIds);
  // Carry forward finalized unpaid statements through the period end, preserving their original
  // dates and payments. A statement ending after this payroll remains eligible in a later run.
  const existing = await tx.commissionStatement.findMany({
    where: { staffId: { in: staffIds }, payrollPayslipId: null, run: { branchId, status: 'FINALIZED', endDate: { lte: dateOnly(endDate) } } },
    include: { payments: true }, orderBy: { id: 'asc' },
  });
  const byStaff = new Map(staffIds.map((id) => [id, { amount: 0, statements: [] }]));
  for (const id of staffIds) {
    const statements = existing.filter((s) => s.staffId === id).map((s) => ({ id: s.id, amount: round2(toDec(s.netPayable).minus(completedAmount(s.payments))).toNumber() })).filter((s) => s.amount > 0);
    const pending = built.find((b) => b.staff.id === id);
    const total = round2(statements.reduce((s, st) => s.plus(st.amount), pending?.net ?? toDec(0)));
    const available = await availableCommission(tx, branchId, id);
    // Refund debt must be resolved in the canonical statement, never hidden in salary accounting.
    if (finalize && total.greaterThan(0) && total.greaterThan(available)) {
      throw conflict('COMMISSION_REFUND_ADJUSTMENT', 'Eligible commission includes refund debt outside this period. Finalize an adjusted commission period before linking payroll.');
    }
    byStaff.set(id, { amount: total.toNumber(), statements });
  }
  const withEvents = built.filter((b) => b.eventIds.length);
  if (finalize && withEvents.length) {
    const branch = await tx.branch.findUnique({ where: { id: branchId } });
    const run = await tx.commissionRun.create({ data: {
      branchId, startDate: dateOnly(startDate), endDate: dateOnly(endDate), status: 'FINALIZED',
      commissionNumber: await nextSequence(tx, branch.code, 'COM', year), generatedByUserId: actor.id, generatedByName: actor.name,
      finalizedAt: new Date(), finalizedByUserId: actor.id, finalizedByName: actor.name,
    } });
    for (const b of withEvents) {
      const st = await tx.commissionStatement.create({ data: {
        runId: run.id, staffId: b.staff.id, statementNumber: await nextSequence(tx, branch.code, 'CS', year), snapshot: b.snapshot, netPayable: b.net,
      } });
      const claimed = await tx.commissionEvent.updateMany({ where: { id: { in: b.eventIds }, consumedByRunId: null }, data: { consumedByRunId: run.id } });
      if (claimed.count !== b.eventIds.length) throw conflict('COMMISSION_ALREADY_CONSUMED', 'Commission has already been finalized. Regenerate payroll.');
      // Link zero statements too: their consumed earn/refund events must be released on cancellation.
      byStaff.get(b.staff.id).statements.push({ id: st.id, amount: b.net.toNumber(), createdByPayroll: true });
    }
  }
  return byStaff;
};
