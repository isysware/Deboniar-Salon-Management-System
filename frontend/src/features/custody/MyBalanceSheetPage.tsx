import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import {
  BalanceSheetSummary,
  CustodyTransaction,
  CashDrawer,
} from '@/types/salon';
import { User } from '@/types/auth';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  downloadReportExcel,
  downloadReportCsv,
  printReportWindow,
} from '@/features/reports/reportUtils';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  RotateCw,
  MinusSquare,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
} from 'lucide-react';

const formatPKR = (num: number) => {
  const val = Number(num) || 0;
  return `PKR ${Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const MyBalanceSheetPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();
  const { navigate } = useRouter();

  // Role guard: Super Admin, Admin, and Accountant.
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/accounts/my-balance-sheet" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAdmin = user.role === 'ADMIN';

  // Branch scope
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin
      ? activeBranchId && activeBranchId !== 'ALL'
        ? activeBranchId
        : user.branchId || allBranches[0]?.id || ''
      : (user.branchId as string)
  );

  useEffect(() => {
    if (isSuperAdmin && activeBranchId && activeBranchId !== 'ALL') {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId, isSuperAdmin]);

  // Target User (Admin can select other staff/cashiers, otherwise strictly logged in user)
  const [targetUserId, setTargetUserId] = useState<string>(user.id);
  const [branchUsers, setBranchUsers] = useState<User[]>([]);

  // Period preset state
  type PeriodType = 'CURRENT_SHIFT' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('CURRENT_SHIFT');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Loaded data
  const [summary, setSummary] = useState<BalanceSheetSummary | null>(null);
  const [transactions, setTransactions] = useState<CustodyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load branch users for the Admin/SuperAdmin selector dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadUsers() {
      if (user && (isSuperAdmin || isAdmin)) {
        try {
          const users = await salonService.getUsers(user, selectedBranchId || 'ALL');
          if (isMounted) {
            setBranchUsers(users.filter((u) => u.role !== 'STAFF'));
          }
        } catch {
          // ignore
        }
      }
    }
    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [selectedBranchId, isSuperAdmin, isAdmin]);

  // Compute date range from period preset
  const { dateFrom, dateTo } = useMemo(() => {
    const today = new Date();
    const todayStr = ymd(today);

    switch (selectedPeriod) {
      case 'TODAY':
        return { dateFrom: todayStr, dateTo: todayStr };
      case 'YESTERDAY': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const yStr = ymd(y);
        return { dateFrom: yStr, dateTo: yStr };
      }
      case 'THIS_WEEK': {
        const offset = (today.getDay() + 6) % 7;
        const monday = new Date(today);
        monday.setDate(monday.getDate() - offset);
        return { dateFrom: ymd(monday), dateTo: todayStr };
      }
      case 'THIS_MONTH': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { dateFrom: ymd(firstDay), dateTo: todayStr };
      }
      case 'CUSTOM':
        return { dateFrom: customStartDate || undefined, dateTo: customEndDate || undefined };
      case 'CURRENT_SHIFT':
      default:
        // Current shift passes undefined dates to query active custody/session
        return { dateFrom: undefined, dateTo: undefined };
    }
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Fetch statement data
  const loadStatement = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await salonService.getCashCustodyStatement(
        {
          branchId: selectedBranchId,
          userId: targetUserId,
          startDate: dateFrom,
          endDate: dateTo,
        },
        user
      );
      setSummary(res.summary);
      setTransactions(res.transactions || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load cash custody balance sheet.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, targetUserId, dateFrom, dateTo, user]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

  // Separate transactions into Collections (Payments) and Expenses & Refunds
  const collectionsList = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.cashIn > 0 ||
        t.type === 'POS_SALE' ||
        t.type === 'DUES_COLLECTION' ||
        t.type === 'TIP_RECEIVED' ||
        t.type === 'FLOAT_RECEIVED'
    );
  }, [transactions]);

  const expensesList = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.cashOut > 0 ||
        t.type === 'EXPENSE_PAID' ||
        t.type === 'INVOICE_REFUND' ||
        t.type === 'HANDOVER_SETTLEMENT'
    );
  }, [transactions]);

  // Totals
  const totalCollections = useMemo(() => {
    return collectionsList.reduce((acc, t) => acc + (t.cashIn || 0), 0);
  }, [collectionsList]);

  const totalExpenses = useMemo(() => {
    return expensesList.reduce((acc, t) => acc + (t.cashOut || 0), 0);
  }, [expensesList]);

  // Summary Metrics
  const openingCash = summary?.openingCash ?? 0;
  const cashSales = summary?.cashSalesTotal ?? 0;
  const duesCollected = summary?.previousDuesCollectedTotal ?? 0;
  const tipsCollected = summary?.cashTipsTotal ?? 0;
  const totalCashCollections = cashSales + duesCollected + tipsCollected || totalCollections;
  const cashExpenses = summary?.cashExpensesPaidTotal ?? expensesList.filter((t) => t.type !== 'INVOICE_REFUND' && t.type !== 'HANDOVER_SETTLEMENT').reduce((acc, t) => acc + (t.cashOut || 0), 0);
  const cashRefunds = summary?.cashRefundsPaidTotal ?? expensesList.filter((t) => t.type === 'INVOICE_REFUND').reduce((acc, t) => acc + (t.cashOut || 0), 0);
  const handovers = summary?.approvedHandoversTotal ?? expensesList.filter((t) => t.type === 'HANDOVER_SETTLEMENT').reduce((acc, t) => acc + (t.cashOut || 0), 0);
  const nonCash = summary?.onlineCollectionsTotal ?? 0;
  const expectedCash = summary?.expectedCashInCustody ?? Math.max(0, openingCash + totalCashCollections - cashExpenses - cashRefunds - handovers);
  const remainingUnsettled = Math.max(0, expectedCash);
  const isSettled = remainingUnsettled === 0;

  // Header Title
  const isViewingSelf = targetUserId === user.id;
  const isSupervisorMode = (isSuperAdmin || isAdmin) && !isViewingSelf;
  const pageTitle = isSupervisorMode ? 'Cash Balance Sheets' : 'My Cash Balance Sheet';

  // Export handlers
  const handleExportExcel = () => {
    const meta: [string, string][] = [
      ['Report', pageTitle],
      ['User', (summary?.user?.name || user.name) + ` (${summary?.user?.role || user.role})`],
      ['Branch', summary?.branch?.name || selectedBranchId],
      ['Period', selectedPeriod],
      ['Expected Cash', formatPKR(expectedCash)],
      ['Generated At', new Date().toLocaleString()],
    ];

    const collHeaders = ['#', 'RECEIPT / REF', 'CATEGORY', 'METHOD', 'AMOUNT'];
    const collRows = collectionsList.map((t, idx) => [
      idx + 1,
      t.referenceNumber || '—',
      t.type === 'POS_SALE' ? 'Collection' : t.type === 'DUES_COLLECTION' ? 'Dues' : t.type === 'TIP_RECEIVED' ? 'Tip' : 'Collection',
      (t as any).paymentMethod || 'CASH',
      `PKR ${(t.cashIn || 0).toLocaleString()}`,
    ]);

    const expHeaders = ['#', 'REF / RECEIPT', 'EXPENSE / REASON', 'METHOD', 'AMOUNT'];
    const expRows = expensesList.map((t, idx) => [
      idx + 1,
      t.referenceNumber || '—',
      t.description || t.type || 'Expense',
      (t as any).paymentMethod || 'CASH',
      `PKR ${(t.cashOut || 0).toLocaleString()}`,
    ]);

    downloadReportExcel(
      `${pageTitle.replace(/\s+/g, '_')}_${ymd(new Date())}`,
      meta,
      [
        { headers: collHeaders, rows: collRows },
        { headers: expHeaders, rows: expRows },
      ]
    );
  };

  const handleExportCSV = () => {
    const meta: [string, string][] = [
      ['Report', pageTitle],
      ['User', (summary?.user?.name || user.name)],
      ['Period', selectedPeriod],
      ['Expected Cash', formatPKR(expectedCash)],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = ['#', 'Type', 'Receipt / Ref', 'Category / Reason', 'Method', 'Amount (PKR)', 'Date', 'Time'];
    const rows = [
      ...collectionsList.map((t, i) => [
        i + 1,
        'Collection',
        t.referenceNumber || '—',
        t.type,
        (t as any).paymentMethod || 'CASH',
        (t.cashIn || 0).toFixed(2),
        t.date || '—',
        t.time || '—',
      ]),
      ...expensesList.map((t, i) => [
        collectionsList.length + i + 1,
        'Expense',
        t.referenceNumber || '—',
        t.description || t.type,
        (t as any).paymentMethod || 'CASH',
        `-${(t.cashOut || 0).toFixed(2)}`,
        t.date || '—',
        t.time || '—',
      ]),
    ];

    downloadReportCsv(`${pageTitle.replace(/\s+/g, '_')}_${ymd(new Date())}`, meta, [{ headers, rows }]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800 font-['Inter',sans-serif]">
      {/* 1. Header Bar with Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545] tracking-tight">{pageTitle}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {selectedPeriod === 'CURRENT_SHIFT'
              ? isSettled
                ? 'Current Shift (settled)'
                : 'Current Shift (unsettled)'
              : `Period: ${selectedPeriod}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Buttons matching user images */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-[#107C41] hover:bg-[#0E6837] active:bg-[#0A4B27] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="bg-[#475569] hover:bg-[#334155] active:bg-[#1E293B] text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={loadStatement}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {/* Status Badge in My Balance Sheet view */}
          {!isSupervisorMode && (
            <div
              className={`text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 border shadow-2xs ${
                isSettled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}
            >
              {isSettled ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Settled</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Unsettled</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Filter Bar (PERIOD Pills + USER Dropdown) */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: PERIOD Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mr-1">
            PERIOD:
          </span>

          {(
            [
              { id: 'CURRENT_SHIFT', label: 'Current Shift' },
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'CUSTOM', label: 'Custom' },
            ] as const
          ).map((p) => {
            const isActive = selectedPeriod === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPeriod(p.id)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0D6251] text-white shadow-xs'
                    : 'bg-slate-100/90 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Right: Branch & User dropdown for Supervisor/Admin */}
        <div className="flex items-center gap-3">
          {/* Branch selector for Super Admin */}
          {isSuperAdmin && allBranches && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">BRANCH:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="text-xs font-medium border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0D6251]"
              >
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User Selector for Admins */}
          {(isSuperAdmin || isAdmin) && branchUsers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">USER:</span>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="text-xs font-semibold border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0D6251]"
              >
                <option value={user.id}>
                  {user.name} ({user.role === 'ADMIN' ? 'Admin' : user.role})
                </option>
                {branchUsers
                  .filter((u) => u.id !== user.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role === 'ACCOUNTANT' ? 'Front Desk / Cashier' : u.role})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Pickers row if Custom is selected */}
      {selectedPeriod === 'CUSTOM' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700"
            />
          </div>
          <button
            type="button"
            onClick={loadStatement}
            className="bg-[#0D6251] text-white text-xs font-semibold px-4 py-1.5 rounded-md hover:bg-[#0B5345] cursor-pointer"
          >
            Apply Dates
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* 3. Main Grid: Two Tables Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Left Card: Payments (Collections) */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col">
          {/* Solid Green Header */}
          <div className="bg-[#15803D] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MinusSquare className="w-4 h-4 opacity-90" />
              <span className="font-bold text-sm tracking-wide">Payments (Collections)</span>
            </div>
            <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              {collectionsList.length} items
            </span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1">
            <table className="report-records w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5 text-center w-10">#</th>
                  <th className="py-2.5 px-3.5">RECEIPT / REF</th>
                  <th className="py-2.5 px-3.5">CATEGORY</th>
                  <th className="py-2.5 px-3.5">METHOD</th>
                  <th className="py-2.5 px-3.5 text-right">DEBIT (IN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collectionsList.length > 0 ? (
                  collectionsList.map((t, idx) => (
                    <tr key={t.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-2.5 px-3.5 font-semibold text-[#0047AB] hover:underline cursor-pointer">
                        {t.referenceNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 font-medium">
                        {t.type === 'POS_SALE'
                          ? 'Collection'
                          : t.type === 'DUES_COLLECTION'
                          ? 'Dues'
                          : t.type === 'TIP_RECEIVED'
                          ? 'Tip'
                          : 'Collection'}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-slate-700 uppercase">
                        {(t as any).paymentMethod || 'CASH'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-[#15803D] tabular-nums">
                        PKR {(t.cashIn || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      No payment records in current custody
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Footer Total Row */}
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                  <td colSpan={4} className="py-2.5 px-3.5 uppercase tracking-wide text-slate-700">
                    TOTAL
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-bold text-[#15803D] bg-emerald-50/90 tabular-nums">
                    PKR {totalCollections.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right Card: Expenses & Refunds */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden flex flex-col">
          {/* Solid Red Header */}
          <div className="bg-[#DC2626] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 opacity-90" />
              <span className="font-bold text-sm tracking-wide">Expenses & Refunds</span>
            </div>
            <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              {expensesList.length} items
            </span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1">
            <table className="report-records w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5 text-center w-10">#</th>
                  <th className="py-2.5 px-3.5">REF / RECEIPT</th>
                  <th className="py-2.5 px-3.5">EXPENSE / REASON</th>
                  <th className="py-2.5 px-3.5">METHOD</th>
                  <th className="py-2.5 px-3.5 text-right">CREDIT (OUT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expensesList.length > 0 ? (
                  expensesList.map((t, idx) => (
                    <tr key={t.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-2.5 px-3.5 font-semibold text-[#DC2626]">
                        {t.referenceNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 font-medium">
                        {t.description || t.type || 'Expense'}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-slate-700 uppercase">
                        {(t as any).paymentMethod || 'CASH'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-[#DC2626] tabular-nums">
                        PKR {(t.cashOut || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      No expense / refund records in current custody
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Footer Total Row */}
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                  <td colSpan={4} className="py-2.5 px-3.5 uppercase tracking-wide text-slate-700">
                    TOTAL
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-bold text-[#DC2626] bg-rose-50/90 tabular-nums">
                    PKR {totalExpenses.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Bottom Full-Width Card: BALANCE SUMMARY */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
        <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">BALANCE SUMMARY</h2>
        </div>

        <div className="divide-y divide-slate-100 text-xs font-medium">
          {/* Row 1: Opening / Carry Forward Cash */}
          <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
            <span className="text-slate-600">Opening / Carry Forward Cash:</span>
            <span className="font-bold text-slate-900 tabular-nums">{formatPKR(openingCash)}</span>
          </div>

          {/* Row 2: (+) Cash Collections (Debit / In) */}
          <div className="flex items-center justify-between px-5 py-3 bg-emerald-50/40">
            <span className="text-slate-700 font-semibold">(+) Cash Collections (Debit / In):</span>
            <span className="font-bold text-[#15803D] bg-emerald-100/80 px-3 py-1 rounded-sm tabular-nums">
              + {formatPKR(totalCashCollections)}
            </span>
          </div>

          {/* Row 3: (-) Cash Expenses (Credit / Out) */}
          <div className="flex items-center justify-between px-5 py-3 bg-rose-50/30">
            <span className="text-slate-700">(-) Cash Expenses (Credit / Out):</span>
            <span className="font-bold text-[#DC2626] bg-rose-100/70 px-3 py-1 rounded-sm tabular-nums">
              - {formatPKR(cashExpenses)}
            </span>
          </div>

          {/* Row 4: (-) Cash Refunds (Credit / Out) */}
          <div className="flex items-center justify-between px-5 py-3 bg-rose-50/30">
            <span className="text-slate-700">(-) Cash Refunds (Credit / Out):</span>
            <span className="font-bold text-[#DC2626] bg-rose-100/70 px-3 py-1 rounded-sm tabular-nums">
              - {formatPKR(cashRefunds)}
            </span>
          </div>

          {/* Row 5: Non-Cash (Card / Bank / Online) */}
          <div className="flex items-center justify-between px-5 py-3 bg-sky-50/30">
            <span className="text-slate-700">
              Non-Cash (Card / Bank / Online) — not physical cash:
            </span>
            <span className="font-bold text-[#0284C7] bg-sky-100/70 px-3 py-1 rounded-sm tabular-nums">
              {formatPKR(nonCash)}
            </span>
          </div>

          {/* Row 6: Expected Cash (Physical) */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-50/70 border-t border-slate-200">
            <span className="text-slate-900 font-bold">Expected Cash (Physical):</span>
            <span className="font-extrabold text-sm text-[#15803D] bg-emerald-200/80 px-3.5 py-1 rounded-sm tabular-nums">
              {formatPKR(expectedCash)}
            </span>
          </div>

          {/* Row 7: Remaining (Unsettled) Cash for My Balance Sheet */}
          {!isSupervisorMode && (
            <div className="flex items-center justify-between px-5 py-3.5 bg-amber-50/60 border-t border-amber-200/50">
              <span className="text-slate-900 font-bold">Remaining (Unsettled) Cash:</span>
              <span className="font-extrabold text-sm text-[#D97706] bg-amber-200/80 px-3.5 py-1 rounded-sm tabular-nums">
                {formatPKR(remainingUnsettled)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyBalanceSheetPage;
