import { BranchActionField } from '@/components/BranchActionField';
import { useBranchAction } from '@/hooks/useBranchAction';
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useMemo, useState } from 'react';
import { salonService } from '../../services';
import {
  MonthlyPaySummary,
  OnlineAccount,
  PayrollAdjustment,
  PayrollAdjustmentType,
  SalaryAdvance,
  StaffAllowance,
  StaffMember,
} from '../../types/salon';
import { Ban, Lock, Plus, RotateCcw, Wallet } from 'lucide-react';

export type PayrollExtrasView = 'SUMMARY' | 'INPUTS' | 'ADVANCES';

interface Props {
  view: PayrollExtrasView;
  branchId: string;
  month: string;
  staffList: StaffMember[];
  onlineAccounts: OnlineAccount[];
  hasOpenDrawer: boolean;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

const rs = (n: number) => `Rs. ${(n || 0).toLocaleString()}`;
const input = 'w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500';
const card = 'bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden';
const th = 'py-3 px-3 text-left';
const primaryBtn = 'inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-xl text-xs';

const typeBadge: Record<PayrollAdjustmentType, string> = {
  ALLOWANCE: 'bg-sky-100 text-sky-800',
  BONUS: 'bg-emerald-100 text-emerald-800',
  DEDUCTION: 'bg-rose-100 text-rose-800',
};

/**
 * Payroll inputs beside attendance/overtime (payroll.md §3.7–3.8) and the combined monthly view.
 * Every change here only affects DRAFT previews; a finalized month is locked by the API.
 */
const loadPayrollAction = async (branchId: string) => {
  const [staff, accounts, drawers] = await Promise.all([salonService.getStaff(branchId), salonService.getOnlineAccounts(branchId), salonService.getCashDrawers(branchId)]);
  return { staff, accounts, drawers };
};

export const PayrollExtrasPanel: React.FC<Props> = ({ view, branchId, month, staffList, onlineAccounts, hasOpenDrawer, onFeedback }) => {
  const { user } = useAuth();
  const allowanceScope = useBranchAction(view === 'INPUTS', loadPayrollAction);
  const adjustmentScope = useBranchAction(view === 'INPUTS', loadPayrollAction);
  const advanceScope = useBranchAction(view === 'ADVANCES', loadPayrollAction);
  const advanceHasDrawer = !!advanceScope.data?.drawers.some((drawer) => drawer.branchId === advanceScope.branchId && drawer.custodianUserId === user?.id && drawer.status === 'OPEN');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<MonthlyPaySummary | null>(null);
  const [allowances, setAllowances] = useState<StaffAllowance[]>([]);
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);

  const activeStaff = useMemo(() => staffList.filter((s) => s.isActive), [staffList]);
  const staffName = (id: string) => staffList.find((s) => s.id === id)?.name ?? id;
  const firstStaff = activeStaff[0]?.id ?? '';

  const [allowanceForm, setAllowanceForm] = useState({ staffId: '', name: '', amount: '' });
  const [adjForm, setAdjForm] = useState({ staffId: '', type: 'BONUS' as PayrollAdjustmentType, title: '', amount: '', notes: '' });
  const [advForm, setAdvForm] = useState({
    staffId: '', amount: '', recoveryPerMonth: '', startMonth: month, method: 'CASH' as 'CASH' | 'ONLINE', onlineAccountId: '', reason: '',
  });

  const load = async () => {
    if (!branchId) return;
    try {
      if (view === 'SUMMARY') setSummary(await salonService.getPayrollMonthlySummary(branchId, month));
      if (view === 'INPUTS') {
        const [a, j] = await Promise.all([salonService.getStaffAllowances(branchId), salonService.getPayrollAdjustments(branchId, month)]);
        setAllowances(a);
        setAdjustments(j);
      }
      if (view === 'ADVANCES') setAdvances(await salonService.getSalaryAdvances(branchId));
    } catch (e: any) {
      onFeedback('error', e.message || 'Failed to load payroll data.');
    }
  };

  useEffect(() => {
    load();
    setAdvForm((f) => ({ ...f, startMonth: month }));
  }, [view, branchId, month]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      onFeedback('success', ok);
      await load();
      return true;
    } catch (e: any) {
      onFeedback('error', e.message || 'Action failed.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ── Monthly summary ──────────────────────────────────────────────────────
  if (view === 'SUMMARY') {
    const t = summary?.totals;
    return (
      <div className={card}>
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-900">Monthly Earnings Summary — {month}</h3>
          <p className="text-xs text-slate-500 mt-1">
            Salary (payroll run: {summary?.payrollStatus?.replace(/_/g, ' ') ?? '—'}; a draft shows as “est.” and is not payable until finalized) and commission are separate liabilities, paid
            separately. Commission counts finalized runs inside this month; “Pending” = this month's sales not yet in a commission run.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="report-records w-full text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold">
              <tr>
                <th className={th}>Employee</th>
                <th className={th}>Salary Status</th>
                <th className={`${th} text-right`}>Salary Net</th>
                <th className={`${th} text-right`}>Salary Paid</th>
                <th className={`${th} text-right`}>Commission Net</th>
                <th className={`${th} text-right`}>Commission Paid</th>
                <th className={`${th} text-right`}>Pending Comm.</th>
                <th className={`${th} text-right font-bold`}>Total Earnings</th>
                <th className={`${th} text-right text-amber-600`}>Outstanding</th>
                <th className={`${th} text-right`}>Advance Bal.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(summary?.rows ?? []).map((r) => (
                <tr key={r.staffId} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{r.staffName}</div>
                    <div className="text-[11px] text-slate-400">{r.employeeCode} • {r.compensationType.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">{r.salaryStatus.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {r.salaryEstimate > 0 ? (
                      <span className="text-slate-400" title="Draft preview — finalize payroll to make it payable">
                        {rs(r.salaryEstimate)} <span className="text-[10px]">est.</span>
                      </span>
                    ) : (
                      rs(r.salaryNet)
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-600">{rs(r.salaryPaid)}</td>
                  <td className="py-2.5 px-3 text-right">{rs(r.commissionNet)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600">{rs(r.commissionPaid)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{r.commissionPending > 0 ? rs(r.commissionPending) : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{rs(r.totalEarnings)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-amber-600">{rs(r.totalOutstanding)}</td>
                  <td className="py-2.5 px-3 text-right text-rose-600">{r.advanceBalance > 0 ? rs(r.advanceBalance) : '—'}</td>
                </tr>
              ))}
              {summary && summary.rows.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-slate-400">No employees for this month.</td></tr>
              )}
            </tbody>
            {t && (
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td className="py-3 px-3" colSpan={2}>Totals</td>
                  <td className="py-3 px-3 text-right">
                    {rs(t.salaryNet)}
                    {t.salaryEstimate > 0 && <div className="text-[10px] font-normal text-slate-400">+ {rs(t.salaryEstimate)} est. (draft)</div>}
                  </td>
                  <td className="py-3 px-3 text-right">{rs(t.salaryPaid)}</td>
                  <td className="py-3 px-3 text-right">{rs(t.commissionNet)}</td>
                  <td className="py-3 px-3 text-right">{rs(t.commissionPaid)}</td>
                  <td className="py-3 px-3 text-right">{rs(t.commissionPending)}</td>
                  <td className="py-3 px-3 text-right">{rs(t.totalEarnings)}</td>
                  <td className="py-3 px-3 text-right text-amber-600">{rs(t.totalOutstanding)}</td>
                  <td className="py-3 px-3 text-right text-rose-600">{rs(t.advanceBalance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  // ── Allowances & one-off adjustments ─────────────────────────────────────
  if (view === 'INPUTS') {
    const addAllowance = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!allowanceScope.validate()) return;
      const staffId = allowanceForm.staffId;
      if (!allowanceScope.data?.staff.some((staff) => staff.id === staffId && staff.isActive)) { onFeedback('error', 'Please select an employee in this branch.'); return; }
      const ok = await run(
        () => salonService.createStaffAllowance({ staffId, name: allowanceForm.name.trim(), amount: Number(allowanceForm.amount) }),
        `Recurring allowance added for ${staffName(staffId)}.`
      );
      if (ok) setAllowanceForm({ staffId, name: '', amount: '' });
    };
    const addAdjustment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adjustmentScope.validate()) return;
      const staffId = adjForm.staffId;
      if (!adjustmentScope.data?.staff.some((staff) => staff.id === staffId && staff.isActive)) { onFeedback('error', 'Please select an employee in this branch.'); return; }
      const ok = await run(
        () => salonService.createPayrollAdjustment({
          staffId, month, type: adjForm.type, title: adjForm.title.trim(), amount: Number(adjForm.amount), notes: adjForm.notes || undefined,
        }),
        `${adjForm.type.toLowerCase()} added to ${month} for ${staffName(staffId)}. Regenerate the preview to see it.`
      );
      if (ok) setAdjForm({ ...adjForm, staffId, title: '', amount: '', notes: '' });
    };

    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className={card}>
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-900">Recurring Monthly Allowances</h3>
            <p className="text-xs text-slate-500 mt-1">Added to every payslip while active (transport, food, mobile…).</p>
          </div>
          <form onSubmit={addAllowance} className="p-5 space-y-3 border-b border-slate-100">
            <BranchActionField value={allowanceScope.branchId} disabled={busy} onChange={(id) => { allowanceScope.setBranchId(id); setAllowanceForm((prev) => ({ ...prev, staffId: '' })); }} />
            {allowanceScope.error && <p role="alert" className="text-xs text-rose-600">{allowanceScope.error}</p>}
            <fieldset disabled={!allowanceScope.ready || busy} className="grid grid-cols-1 sm:grid-cols-2 gap-3 disabled:opacity-50">
            <select className={input} value={allowanceForm.staffId} onChange={(e) => setAllowanceForm({ ...allowanceForm, staffId: e.target.value })}>
              <option value="">Select employee</option>
              {(allowanceScope.data?.staff || []).filter((staff) => staff.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className={input} placeholder="Name (e.g. Transport)" required value={allowanceForm.name} onChange={(e) => setAllowanceForm({ ...allowanceForm, name: e.target.value })} />
            <input className={input} type="number" min="1" step="0.01" placeholder="Amount / month" required value={allowanceForm.amount} onChange={(e) => setAllowanceForm({ ...allowanceForm, amount: e.target.value })} />
            <button disabled={busy} className={`${primaryBtn} justify-center`}><Plus className="w-3.5 h-3.5" /> Add Allowance</button>
          
            </fieldset>
</form>
          <table className="report-records w-full text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold">
              <tr><th className={th}>Employee</th><th className={th}>Allowance</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allowances.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{staffName(a.staffId)}</td>
                  <td className="py-2.5 px-3">{a.name}</td>
                  <td className="py-2.5 px-3 text-right">{rs(a.amount)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      disabled={busy}
                      onClick={() => run(() => salonService.updateStaffAllowance(a.id, { isActive: !a.isActive }), `Allowance ${a.isActive ? 'paused' : 'resumed'}.`)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${a.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}
                      title="Click to toggle"
                    >
                      {a.isActive ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </td>
                </tr>
              ))}
              {allowances.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">No recurring allowances.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className={card}>
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-900">One-off Adjustments — {month}</h3>
            <p className="text-xs text-slate-500 mt-1">Bonus, extra allowance or deduction for this month only. Locked once the month is finalized.</p>
          </div>
          <form onSubmit={addAdjustment} className="p-5 space-y-3 border-b border-slate-100">
            <BranchActionField value={adjustmentScope.branchId} disabled={busy} onChange={(id) => { adjustmentScope.setBranchId(id); setAdjForm((prev) => ({ ...prev, staffId: '' })); }} />
            {adjustmentScope.error && <p role="alert" className="text-xs text-rose-600">{adjustmentScope.error}</p>}
            <fieldset disabled={!adjustmentScope.ready || busy} className="grid grid-cols-1 sm:grid-cols-2 gap-3 disabled:opacity-50">
            <select className={input} value={adjForm.staffId} onChange={(e) => setAdjForm({ ...adjForm, staffId: e.target.value })}>
              <option value="">Select employee</option>
              {(adjustmentScope.data?.staff || []).filter((staff) => staff.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className={input} value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value as PayrollAdjustmentType })}>
              <option value="BONUS">Bonus (+)</option>
              <option value="ALLOWANCE">Allowance (+)</option>
              <option value="DEDUCTION">Deduction (−)</option>
            </select>
            <input className={input} placeholder="Title (e.g. Eid bonus, Damaged dryer)" required value={adjForm.title} onChange={(e) => setAdjForm({ ...adjForm, title: e.target.value })} />
            <input className={input} type="number" min="1" step="0.01" placeholder="Amount" required value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} />
            <input className={`${input} sm:col-span-2`} placeholder="Notes (optional)" value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} />
            <div className="sm:col-span-2 flex justify-end">
              <button disabled={busy} className={primaryBtn}><Plus className="w-3.5 h-3.5" /> Add Adjustment</button>
            </div>
          
            </fieldset>
</form>
          <table className="report-records w-full text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold">
              <tr><th className={th}>Employee</th><th className={th}>Type</th><th className={th}>Title</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.map((a) => (
                <tr key={a.id} className={a.status === 'CANCELLED' ? 'opacity-50' : ''}>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{staffName(a.staffId)}</td>
                  <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${typeBadge[a.type]}`}>{a.type}</span></td>
                  <td className="py-2.5 px-3">{a.title}{a.status === 'CANCELLED' && <span className="ml-1 text-[10px] text-slate-400">(cancelled)</span>}</td>
                  <td className={`py-2.5 px-3 text-right font-semibold ${a.type === 'DEDUCTION' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {a.type === 'DEDUCTION' ? '−' : '+'}{rs(a.amount)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {a.locked ? (
                      <span title="Locked by finalized payroll" className="inline-flex text-slate-400"><Lock className="w-3.5 h-3.5" /></span>
                    ) : a.status === 'ACTIVE' ? (
                      <button disabled={busy} onClick={() => run(() => salonService.cancelPayrollAdjustment(a.id), 'Adjustment cancelled.')} title="Cancel" className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {adjustments.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No adjustments for {month}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Salary advances ──────────────────────────────────────────────────────
  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
      if (!advanceScope.validate()) return;
    const staffId = advForm.staffId;
      if (!advanceScope.data?.staff.some((staff) => staff.id === staffId && staff.isActive)) { onFeedback('error', 'Please select an employee in this branch.'); return; }
    const ok = await run(
      () => salonService.issueSalaryAdvance({
        staffId, amount: Number(advForm.amount), recoveryPerMonth: advForm.recoveryPerMonth ? Number(advForm.recoveryPerMonth) : undefined,
        startMonth: advForm.startMonth, method: advForm.method, onlineAccountId: advForm.method === 'ONLINE' ? advForm.onlineAccountId : undefined,
        reason: advForm.reason.trim(),
      }),
      `Advance of Rs. ${Number(advForm.amount).toLocaleString()} paid to ${staffName(staffId)}.`
    );
    if (ok) setAdvForm({ ...advForm, staffId, amount: '', recoveryPerMonth: '', reason: '' });
  };
  const reverse = (a: SalaryAdvance) => {
    const reason = window.prompt(`Reverse advance ${a.advanceNumber} (Rs. ${a.amount.toLocaleString()})? Money comes back to your drawer/account.\nReason:`);
    if (reason?.trim()) run(() => salonService.reverseSalaryAdvance(a.id, reason.trim()), `Advance ${a.advanceNumber} reversed.`);
  };
  const statusCls = { ACTIVE: 'bg-amber-100 text-amber-800', RECOVERED: 'bg-emerald-100 text-emerald-800', REVERSED: 'bg-slate-100 text-slate-500' };

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-start gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Wallet className="w-5 h-5" /></div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Issue Salary Advance</h3>
            <p className="text-xs text-slate-500 mt-1">
              Money leaves now (cash drawer or account). It is not an expense — it is recovered from payroll in monthly installments
              starting from the chosen month.
            </p>
          </div>
        </div>
        <form onSubmit={issue} className="p-5 space-y-3 border-b border-slate-100">
            <BranchActionField value={advanceScope.branchId} disabled={busy} onChange={(id) => { advanceScope.setBranchId(id); setAdvForm((prev) => ({ ...prev, staffId: '', onlineAccountId: '' })); }} />
            {advanceScope.error && <p role="alert" className="text-xs text-rose-600">{advanceScope.error}</p>}
            <fieldset disabled={!advanceScope.ready || busy} className="grid grid-cols-1 sm:grid-cols-2 gap-3 disabled:opacity-50">
          <select className={input} value={advForm.staffId} onChange={(e) => setAdvForm({ ...advForm, staffId: e.target.value })}>
              <option value="">Select employee</option>
            {(advanceScope.data?.staff || []).filter((staff) => staff.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className={input} type="number" min="1" step="0.01" placeholder="Advance amount" required value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} />
          <input className={input} type="number" min="1" step="0.01" placeholder="Recover / month (default all)" value={advForm.recoveryPerMonth} onChange={(e) => setAdvForm({ ...advForm, recoveryPerMonth: e.target.value })} />
          <input className={input} type="month" title="First recovery month" value={advForm.startMonth} onChange={(e) => setAdvForm({ ...advForm, startMonth: e.target.value })} />
          <select className={input} value={advForm.method} onChange={(e) => setAdvForm({ ...advForm, method: e.target.value as 'CASH' | 'ONLINE' })}>
            <option value="CASH">Cash (my drawer)</option>
            <option value="ONLINE">Online account</option>
          </select>
          {advForm.method === 'ONLINE' ? (
            <select className={input} required value={advForm.onlineAccountId} onChange={(e) => setAdvForm({ ...advForm, onlineAccountId: e.target.value })}>
              <option value="">Select account…</option>
              {(advanceScope.data?.accounts || []).filter((a) => a.isActive !== false).map((a) => <option key={a.id} value={a.id}>{a.accountName} (Rs. {a.currentBalance.toLocaleString()})</option>)}
            </select>
          ) : (
            <div className={`text-[11px] self-center ${advanceHasDrawer ? 'text-emerald-600' : 'text-rose-600'}`}>
              {advanceHasDrawer ? 'Paid from your open drawer' : 'Open a cash drawer first'}
            </div>
          )}
          <input className={`${input} sm:col-span-2 lg:col-span-5`} placeholder="Reason" required value={advForm.reason} onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })} />
          <button disabled={busy} className={`${primaryBtn} justify-center`}><Plus className="w-3.5 h-3.5" /> Issue Advance</button>
        
            </fieldset>
</form>
      </div>

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="report-records w-full text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold">
              <tr>
                <th className={th}>Advance #</th><th className={th}>Employee</th><th className={th}>Issued</th>
                <th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Per Month</th>
                <th className={`${th} text-right`}>Recovered</th><th className={`${th} text-right`}>Balance</th>
                <th className={th}>Method</th><th className={th}>Status</th><th className={`${th} text-right`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {advances.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{a.advanceNumber}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium">{a.staffName}</div>
                    <div className="text-[11px] text-slate-400" title={a.reason}>{a.reason}</div>
                  </td>
                  <td className="py-2.5 px-3">{a.issueDate}<div className="text-[11px] text-slate-400">from {a.startMonth}</div></td>
                  <td className="py-2.5 px-3 text-right">{rs(a.amount)}</td>
                  <td className="py-2.5 px-3 text-right">{rs(a.recoveryPerMonth)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600">
                    {rs(a.recoveredAmount)}
                    {a.recoveries.length > 0 && <div className="text-[10px] text-slate-400">{a.recoveries.map((r) => r.month).join(', ')}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-rose-600">{rs(a.balance)}</td>
                  <td className="py-2.5 px-3">{a.method === 'ONLINE' ? a.onlineAccountName || 'Online' : 'Cash'}</td>
                  <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusCls[a.status]}`}>{a.status}</span></td>
                  <td className="py-2.5 px-3 text-right">
                    {a.status === 'ACTIVE' && a.recoveries.length === 0 && (
                      <button disabled={busy} onClick={() => reverse(a)} title="Reverse advance" className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {advances.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-slate-400">No salary advances.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
