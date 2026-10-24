import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService, AccountantDashboardData } from '../../services';
import { formatCurrency } from '../../lib/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScissorLoader } from '@/components/ui/ScissorLoader';
import {
  Wallet,
  Receipt,
  CreditCard,
  Scale,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';

const SalesMetricCard = ({ title, value, subtitle, icon: Icon, label, gradient }: {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  label: string;
  gradient: string;
}) => (
  <div className={`group relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-sm transition-shadow hover:shadow-md ${gradient}`}>
    <Icon aria-hidden="true" strokeWidth={1.5} className="pointer-events-none absolute -bottom-3 -right-3 h-32 w-32 -rotate-12 opacity-15 transition-transform duration-500 motion-safe:group-hover:rotate-0 motion-safe:group-hover:scale-110" />
    <div className="relative z-10 flex items-start justify-between gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 shadow-2xs backdrop-blur-xs">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">{label}</span>
    </div>
    <div className="relative z-10 mt-4">
      <p className="break-words font-mono text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
      <h2 className="mt-1 text-xs font-medium text-white/90">{title}</h2>
      <p className="mt-1 text-[11px] text-white/70">{subtitle}</p>
    </div>
  </div>
);

export const AccountantDashboard: React.FC = () => {
  const { user, demoDate } = useAuth();
  const { navigate } = useRouter();

  const [data, setData] = useState<AccountantDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const branchId = user.branchId || '';
      const res = await salonService.getAccountantDashboardData(branchId, user.id);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load Accountant dashboard:', err);
      setLoadError(err.message || 'Failed to load Sales & Billing dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, demoDate]);

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center font-sans">
        <ScissorLoader size="lg" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center font-sans space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Dashboard Unavailable</h3>
        <p className="text-xs text-slate-500">
          {loadError || 'Unable to retrieve your shift custody and sales metrics at this time.'}
        </p>
        <Button variant="default" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Role Scope Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Sales & Billing Counter ({data.branch.name})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daily register settlement, invoice reconciliations, and cash custody.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => navigate('/accounts/account-settlement')}
          >
            Initiate Cash Settlement
          </Button>
        </div>
      </div>

      {/* TOP 5 FINANCIAL CUSTODY KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3.5">
        <SalesMetricCard
          title="Physical Cash in Drawer"
          value={formatCurrency(data.cashCustodyBalance)}
          subtitle="Net in cashier custody"
          icon={Wallet}
          label="Custody"
          gradient="from-[#2254E1] via-[#1B44B8] to-[#1236A8]"
        />
        <SalesMetricCard
          title="Today's Cash Inflow"
          value={formatCurrency(data.todayCashCollected)}
          subtitle="Cash POS receipts"
          icon={Receipt}
          label="Cash"
          gradient="from-[#0284C7] via-[#0369A1] to-[#075985]"
        />
        <SalesMetricCard
          title="Online Card Inflow"
          value={formatCurrency(data.todayOnlineCollected)}
          subtitle="Direct POS terminals"
          icon={CreditCard}
          label="Online"
          gradient="from-[#4338CA] via-[#3730A3] to-[#312E81]"
        />
        <SalesMetricCard
          title="Cash Paid Out (Expenses)"
          value={formatCurrency(data.expensesPaidByAccountant)}
          subtitle="Voucher disbursements"
          icon={CreditCard}
          label="Expenses"
          gradient="from-[#D97706] via-[#B45309] to-[#92400E]"
        />
        <SalesMetricCard
          title="Pending Safe Transfer"
          value={formatCurrency(data.pendingSettlementAmount)}
          subtitle="Awaiting Admin sign-off"
          icon={Scale}
          label="Settlement"
          gradient={data.pendingSettlementAmount > 0
            ? 'from-[#D97706] via-[#B45309] to-[#92400E]'
            : 'from-[#475569] via-[#334155] to-[#1E293B]'}
        />
      </div>

      {/* SETTLEMENT STATUS BANNER */}
      {data.settlementStatus === 'PENDING_VERIFICATION' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 flex flex-col sm:flex-row items-start justify-between gap-4 text-xs text-amber-900">
          <div className="flex items-start gap-3">
            <Scale className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-sm">
                Cash Custody Settlement Pending Admin Vault Verification
              </span>
              <p className="mt-0.5 text-amber-800">
                You submitted <strong className="font-semibold">{formatCurrency(data.pendingSettlementAmount)}</strong> for end-of-shift transfer to Branch Administrator Aamina Sheikh.
                <span className="block mt-0.5 text-slate-600">
                  Note: Business rule prohibits self-approval. Settlement must be acknowledged by the Admin.
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/accounts/account-settlement')}
          >
            Review Submission
          </Button>
        </div>
      )}

      {/* TWO COLUMNS: Recent Cash Receipts vs Recent Expense Disbursements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Cash Receipts */}
        <Card padding="none" className="rounded-2xl overflow-hidden border-slate-200/90 bg-white shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900">Today's Physical Cash Collections</h3>
              <p className="text-xs text-slate-500">Invoices settled in physical tender</p>
            </div>
            <button
              onClick={() => navigate('/pos')}
              className="text-xs font-semibold text-[#2254E1] hover:underline cursor-pointer"
            >
              Collect New Payment
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data.recentCashReceipts.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Receipt aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">No cash collections today</p>
                <p className="mt-1 text-[11px] text-slate-400">Your cash receipts will appear here once recorded.</p>
              </div>
            )}
            {data.recentCashReceipts.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">{inv.invoiceNumber}</span>
                    <Badge size="sm" variant="success">PAID CASH</Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {inv.clientName} · Processed at {inv.time}
                  </p>
                  {inv.tip > 0 && (
                    <p className="text-[11px] text-purple-700 font-medium">
                      Includes {formatCurrency(inv.tip)} tip in cash envelope
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 tabular-nums block">
                    {formatCurrency(inv.total)}
                  </span>
                  <span className="text-[10px] text-slate-400">Exact Tender</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Expense Disbursements */}
        <Card padding="none" className="rounded-2xl overflow-hidden border-slate-200/90 bg-white shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900">Cash Drawer Disbursements</h3>
              <p className="text-xs text-slate-500">Emergency supplies & petty cash vouchers</p>
            </div>
            <button
              onClick={() => navigate('/accounts/expenses')}
              className="text-xs font-semibold text-[#2254E1] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Expense</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data.recentDisbursements.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Wallet aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">No cash disbursements recorded</p>
                <p className="mt-1 text-[11px] text-slate-400">Your recorded expense vouchers will appear here.</p>
              </div>
            )}
            {data.recentDisbursements.map((exp) => (
              <div key={exp.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-800">{exp.voucherNumber}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                      {exp.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5 font-medium">{exp.title}</p>
                  <p className="text-[11px] text-slate-400">Paid from: {exp.paymentSource.replace('_', ' ')}</p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-rose-700 tabular-nums block">
                    -{formatCurrency(exp.amount)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">Voucher Signed</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Access to Financial Reports Permitted for Accountant */}
      <Card padding="md" className="rounded-2xl border-slate-200/90 shadow-2xs">
        <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2.5">
          Authorized Financial Tools & Reports
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
          <button
            onClick={() => navigate('/accounts/my-balance-sheet')}
            className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 hover:border-[#2254E1] hover:bg-blue-50/30 transition-all text-left cursor-pointer"
          >
            <p className="font-semibold text-slate-900">My Balance Sheet</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Drawer float reconciliation</p>
          </button>
          <button
            onClick={() => navigate('/reports/unpaid-invoices')}
            className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 hover:border-[#2254E1] hover:bg-blue-50/30 transition-all text-left cursor-pointer"
          >
            <p className="font-semibold text-slate-900">Unpaid Invoices</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{data.unpaidInvoicesCount} invoices pending collection</p>
          </button>
          <button
            onClick={() => navigate('/reports/income-expense')}
            className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 hover:border-[#2254E1] hover:bg-blue-50/30 transition-all text-left cursor-pointer"
          >
            <p className="font-semibold text-slate-900">Income & Expense</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Approved revenue statement</p>
          </button>
          <button
            onClick={() => navigate('/reports/debit-credit?tab=cash')}
            className="p-4 rounded-xl bg-slate-50/60 border border-slate-200 hover:border-[#2254E1] hover:bg-blue-50/30 transition-all text-left cursor-pointer"
          >
            <p className="font-semibold text-slate-900">Cash Debit / Credit</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Cash transactions and shift reconciliation</p>
          </button>
        </div>
      </Card>
    </div>
  );
};
