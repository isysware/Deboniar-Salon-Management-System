import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import { CashDrawer, OnlineAccount, SalaryAdvance, StaffMember } from '../../types/salon';
import { Building2, Info, Wallet } from 'lucide-react';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';
import { PayrollExtrasPanel } from './PayrollExtrasPanel';

const rs = (n: number) => `Rs. ${(n || 0).toLocaleString()}`;

/**
 * Staff loans (salary advances). Money leaves now from the issuer's open cash drawer or a
 * branch online account; it is a staff receivable, not an expense, and is recovered from
 * payroll in monthly installments.
 */
export const StaffLoansPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/accounts/staff-loans" />;
  }

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user.role === 'SUPER_ADMIN' ? (activeBranchId === 'ALL' ? (allBranches[0]?.id || '') : activeBranchId) : (user.branchId || '')
  );
  const branchId = user.role === 'SUPER_ADMIN' ? selectedBranchId : (user.branchId || activeBranchId);
  const month = (demoDate || new Date().toISOString().slice(0, 10)).slice(0, 7);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [onlineAccounts, setOnlineAccounts] = useState<OnlineAccount[]>([]);
  const [cashDrawers, setCashDrawers] = useState<CashDrawer[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!branchId) return;
    Promise.all([
      salonService.getStaff(branchId),
      salonService.getOnlineAccounts(branchId),
      salonService.getCashDrawers(branchId),
      salonService.getSalaryAdvances(branchId),
    ])
      .then(([staff, accounts, drawers, loans]) => {
        setStaffList(staff);
        setOnlineAccounts(accounts);
        setCashDrawers(drawers);
        setAdvances(loans);
      })
      .catch((e) => setFeedback({ type: 'error', message: e?.message || 'Failed to load staff loans.' }));
  }, [branchId, refreshKey]);

  const myDrawer = cashDrawers.find((d) => d.branchId === branchId && d.custodianUserId === user.id && d.status === 'OPEN');

  const totals = useMemo(() => {
    const live = advances.filter((a) => a.status !== 'REVERSED');
    return {
      active: advances.filter((a) => a.status === 'ACTIVE').length,
      given: live.reduce((s, a) => s + a.amount, 0),
      recovered: live.reduce((s, a) => s + a.recoveredAmount, 0),
      outstanding: live.reduce((s, a) => s + a.balance, 0),
    };
  }, [advances]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 font-sans">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Wallet className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Staff Loans</h1>
            <p className="text-xs text-slate-500 mt-1">Give a loan (salary advance) and recover it from payroll in monthly installments.</p>
          </div>
        </div>
        {user.role === 'SUPER_ADMIN' && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select className="bg-transparent text-xs font-semibold text-slate-800 outline-none" value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)}>
              {allBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-slate-700">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div><b>Where the money comes from:</b> Cash → your own open cash drawer{myDrawer ? ` (expected ${rs(myDrawer.expectedInDrawer)})` : ' — open a drawer first'}; Online → a branch bank/online account.</div>
          <div><b>How it is recovered:</b> the monthly installment is deducted on the staff payslip when payroll is finalized, starting from the chosen month.</div>
          <div>A loan is not an expense — salary expense is recognized once, on payroll finalization. A loan can be reversed only before any recovery.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active Loans', value: String(totals.active), cls: 'text-slate-900' },
          { label: 'Total Given', value: rs(totals.given), cls: 'text-slate-900' },
          { label: 'Recovered', value: rs(totals.recovered), cls: 'text-emerald-600' },
          { label: 'Outstanding', value: rs(totals.outstanding), cls: 'text-rose-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
            <div className="text-[11px] uppercase font-medium text-slate-500">{k.label}</div>
            <div className={`text-lg font-bold mt-0.5 ${k.cls}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {feedback && (
        <div className={`px-4 py-2.5 rounded-xl text-xs font-medium ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {feedback.message}
        </div>
      )}

      {branchId && (
        <PayrollExtrasPanel
          key={`${branchId}-${refreshKey}`}
          view="ADVANCES"
          branchId={branchId}
          month={month}
          staffList={staffList}
          onlineAccounts={onlineAccounts}
          hasOpenDrawer={!!myDrawer}
          onFeedback={(type, message) => {
            setFeedback({ type, message });
            if (type === 'success') setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
};
