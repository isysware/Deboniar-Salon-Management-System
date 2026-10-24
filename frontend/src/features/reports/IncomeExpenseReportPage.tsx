import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { User } from '@/types/auth';
import {
  IncomeExpenseReport,
  IncomeExpenseReportRow,
  IncomeExpenseReportQuery,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  downloadReportCsv,
  downloadReportExcel,
  printReportWindow,
} from '@/features/reports/reportUtils';
import {
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  List,
} from 'lucide-react';

const selectClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const inputClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const labelClass = 'block text-[11px] font-semibold text-[#0B2545] mb-1.5';

const formatPKR = (amt: number, withSign = false) => {
  const num = Number(amt) || 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (withSign) {
    return num >= 0 ? `+${formatted}` : `-${formatted}`;
  }
  return formatted;
};

const formatDateParts = (dateStr: string) => {
  if (!dateStr) return { dayMonth: '—', year: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { dayMonth: dateStr, year: '' };
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = String(d.getFullYear());
    return { dayMonth: `${day} ${month}`, year };
  } catch {
    return { dayMonth: dateStr, year: '' };
  }
};

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;
  } catch {
    return dateStr;
  }
};

const formatMethod = (method: string) => {
  if (!method) return 'Cash Payment';
  const m = method.toUpperCase();
  if (m === 'CASH') return 'Cash Payment';
  if (m.includes('BANK') || m.includes('ONLINE') || m.includes('TRANSFER')) return 'Bank Transfer';
  if (m.includes('CARD')) return 'Card Payment';
  return method;
};

export const IncomeExpenseReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/reports/income-expense" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAccountant = user.role === 'ACCOUNTANT';
  const defaultBranch = isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '');

  // Filter Form State
  const [selectedBranch, setSelectedBranch] = useState<string>(defaultBranch);
  const [selectedUserType, setSelectedUserType] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Loaded users for filter dropdown
  const [usersList, setUsersList] = useState<User[]>([]);

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<IncomeExpenseReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load users list dynamically
  useEffect(() => {
    let active = true;
    const branchForUsers = selectedBranch !== 'ALL' ? selectedBranch : undefined;
    salonService
      .getUsers(user, branchForUsers)
      .then((data) => {
        if (active && Array.isArray(data)) {
          setUsersList(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load users for filter:', err);
      });
    return () => {
      active = false;
    };
  }, [user, selectedBranch]);

  // Filter user options based on selected user type
  const filteredUsers = useMemo(() => {
    if (selectedUserType === 'ALL') return usersList;
    return usersList.filter((u) => u.role === selectedUserType);
  }, [usersList, selectedUserType]);

  // Execute report fetch on filter submit
  const fetchReport = useCallback(
    async (q: IncomeExpenseReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getIncomeExpenseReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load Income & Expense report:', err);
        setErrorMessage(err.message || 'Failed to fetch live income & expense report from server.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);

    const query: IncomeExpenseReportQuery = {
      branchId: selectedBranch,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      preset: !fromDate && !toDate ? 'THIS_MONTH' : 'CUSTOM',
      userType: isAccountant ? 'ACCOUNTANT' : (selectedUserType !== 'ALL' ? selectedUserType : undefined),
      user: isAccountant ? user.name : (selectedUser !== 'ALL' ? selectedUser : undefined),
    };

    fetchReport(query);
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Income & Expense Reports'],
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Type',
      'Source',
      'User',
      'Branch',
      'Title',
      'Status',
      'Amount',
      'Paid',
      'Discount',
      'Remaining',
      'Date',
      'Method',
    ];

    const rows = reportData.rows.map((r, i) => {
      const isIncome = r.income > 0 || r.type === 'INCOME';
      const isAccruedComm = r.type === 'COMMISSION_EXPENSE' && (r.status === 'ACCRUED' || !r.paid);
      const paidVal = isAccruedComm ? 0 : isIncome ? (r.paid ?? r.income) : (r.paid ?? r.expense);
      const remainingVal = isAccruedComm ? (r.remaining || r.expense) : (r.remaining || 0);

      return [
        i + 1,
        r.type === 'SETTLEMENT' ? 'Settlement' : isIncome ? 'Income' : 'Expense',
        r.source || '—',
        r.userOrPayee || '—',
        r.branchName || '—',
        r.description || r.reference || '—',
        r.status || 'PAID',
        (isIncome ? r.income : r.expense) === 0 ? '0.00' : isIncome ? `+${r.income.toFixed(2)}` : `-${r.expense.toFixed(2)}`,
        r.cashFlow !== undefined ? `${r.cashFlow >= 0 ? '+' : '-'}${Math.abs(r.cashFlow).toFixed(2)}` : isAccruedComm || paidVal === 0 ? '0.00' : isIncome ? `+${paidVal.toFixed(2)}` : `-${paidVal.toFixed(2)}`,
        (r.discount || 0).toFixed(2),
        remainingVal.toFixed(2),
        formatDateDisplay(r.date),
        formatMethod(r.paymentMethod),
      ];
    });

    const signedPaidFormatted = signedPaid >= 0 ? `+${signedPaid.toFixed(2)}` : `-${Math.abs(signedPaid).toFixed(2)}`;
    const totalsRow = [
      'TOTALS (PKR)',
      '',
      '',
      '',
      '',
      '',
      '',
      reportData.totals.net >= 0 ? `+${reportData.totals.net.toFixed(2)}` : `-${Math.abs(reportData.totals.net).toFixed(2)}`,
      signedPaidFormatted,
      (reportData.totals.discount || 0).toFixed(2),
      (reportData.totals.remaining || 0).toFixed(2),
      '',
      '',
    ];

    downloadReportExcel('Income_Expense_Report', meta, [{ headers, rows: [...rows, totalsRow] }]);
  };

  const handleExportCsv = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Income & Expense Reports'],
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Type',
      'Source',
      'User',
      'Branch',
      'Title',
      'Status',
      'Amount',
      'Paid',
      'Discount',
      'Remaining',
      'Date',
      'Method',
    ];

    const rows = reportData.rows.map((r, i) => {
      const isIncome = r.income > 0 || r.type === 'INCOME';
      const isAccruedComm = r.type === 'COMMISSION_EXPENSE' && (r.status === 'ACCRUED' || !r.paid);
      const paidVal = isAccruedComm ? 0 : isIncome ? (r.paid ?? r.income) : (r.paid ?? r.expense);
      const remainingVal = isAccruedComm ? (r.remaining || r.expense) : (r.remaining || 0);

      return [
        i + 1,
        r.type === 'SETTLEMENT' ? 'Settlement' : isIncome ? 'Income' : 'Expense',
        r.source || '—',
        r.userOrPayee || '—',
        r.branchName || '—',
        r.description || r.reference || '—',
        r.status || 'PAID',
        (isIncome ? r.income : r.expense) === 0 ? '0.00' : isIncome ? `+${r.income.toFixed(2)}` : `-${r.expense.toFixed(2)}`,
        r.cashFlow !== undefined ? `${r.cashFlow >= 0 ? '+' : '-'}${Math.abs(r.cashFlow).toFixed(2)}` : isAccruedComm || paidVal === 0 ? '0.00' : isIncome ? `+${paidVal.toFixed(2)}` : `-${paidVal.toFixed(2)}`,
        (r.discount || 0).toFixed(2),
        remainingVal.toFixed(2),
        formatDateDisplay(r.date),
        formatMethod(r.paymentMethod),
      ];
    });

    const signedPaidFormatted = signedPaid >= 0 ? `+${signedPaid.toFixed(2)}` : `-${Math.abs(signedPaid).toFixed(2)}`;
    const totalsRow = [
      'TOTALS (PKR)',
      '',
      '',
      '',
      '',
      '',
      '',
      reportData.totals.net >= 0 ? `+${reportData.totals.net.toFixed(2)}` : `-${Math.abs(reportData.totals.net).toFixed(2)}`,
      signedPaidFormatted,
      (reportData.totals.discount || 0).toFixed(2),
      (reportData.totals.remaining || 0).toFixed(2),
      '',
      '',
    ];

    downloadReportCsv('Income_Expense_Report', meta, [{ headers, rows: [...rows, totalsRow] }]);
  };

  // Signed Paid total: Net cash settled = income paid - expense paid (e.g. 2,000 - 150 - 50 = PKR 1,800)
  const signedPaid = useMemo(() => {
    if (typeof reportData?.totals?.paid === 'number') {
      return reportData.totals.paid;
    }
    if (!reportData?.rows) return 0;
    return reportData.rows.reduce((acc, r) => {
      const isIncome = r.income > 0 || r.type === 'INCOME';
      const isAccruedComm = r.type === 'COMMISSION_EXPENSE' && (r.status === 'ACCRUED' || !r.paid);
      const paidVal = isAccruedComm ? 0 : isIncome ? (r.collectionAmount ?? r.paid ?? r.income) : (r.paid ?? r.expense);
      return r.cashFlow !== undefined ? acc + r.cashFlow : isIncome ? acc + paidVal : acc - paidVal;
    }, 0);
  }, [reportData]);

  const handleExportPdf = () => {
    if (!reportData || !reportData.rows.length) {
      window.print();
      return;
    }
    const signedPaidFormatted = signedPaid >= 0 ? `+${formatPKR(signedPaid)}` : `-${formatPKR(Math.abs(signedPaid))}`;
    const meta: [string, string][] = [
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Total Income', `PKR ${formatPKR(reportData.totals.income)}`],
      ['Total Expense', `PKR ${formatPKR(reportData.totals.expense)}`],
      ['Net Settled (Paid)', `PKR ${signedPaidFormatted}`],
      ['Net Position', `PKR ${reportData.totals.net >= 0 ? '+' : '-'}${formatPKR(Math.abs(reportData.totals.net))}`],
    ];
    const headers = ['#', 'Type', 'Source', 'User', 'Branch', 'Title', 'Status', 'Amount', 'Paid', 'Discount', 'Remaining', 'Date', 'Method'];
    const rows = reportData.rows.map((r, i) => {
      const isIncome = r.income > 0 || r.type === 'INCOME';
      const isAccruedComm = r.type === 'COMMISSION_EXPENSE' && (r.status === 'ACCRUED' || !r.paid);
      const paidVal = isAccruedComm ? 0 : isIncome ? (r.paid ?? r.income) : (r.paid ?? r.expense);
      const remainingVal = isAccruedComm ? (r.remaining || r.expense) : (r.remaining || 0);

      return [
        i + 1,
        r.type === 'SETTLEMENT' ? 'Settlement' : isIncome ? 'Income' : 'Expense',
        r.source || '—',
        r.userOrPayee || '—',
        r.branchName || '—',
        r.description || r.reference || '—',
        r.status || 'PAID',
        (isIncome ? r.income : r.expense) === 0 ? '0.00' : isIncome ? `+${formatPKR(r.income)}` : `-${formatPKR(r.expense)}`,
        r.cashFlow !== undefined ? `${r.cashFlow >= 0 ? '+' : '-'}${formatPKR(Math.abs(r.cashFlow))}` : isAccruedComm || paidVal === 0 ? '0.00' : isIncome ? `+${formatPKR(paidVal)}` : `-${formatPKR(paidVal)}`,
        formatPKR(r.discount || 0),
        formatPKR(remainingVal),
        formatDateDisplay(r.date),
        formatMethod(r.paymentMethod),
      ];
    });

    printReportWindow({
      title: 'Income & Expense Reports',
      subtitle: 'Generated Report Document',
      meta,
      headers,
      rows,
      totals: [
        'TOTALS (PKR)',
        '',
        '',
        '',
        '',
        '',
        '',
        reportData.totals.net >= 0 ? `+${formatPKR(reportData.totals.net)}` : `-${formatPKR(Math.abs(reportData.totals.net))}`,
        signedPaidFormatted,
        `+${formatPKR(reportData.totals.discount || 0)}`,
        `+${formatPKR(reportData.totals.remaining || 0)}`,
        '',
        '',
      ],
    });
  };

  const handlePrint = () => {
    handleExportPdf();
  };

  // Calculations for bottom summary
  const totals = reportData?.totals ? { ...reportData.totals, paid: signedPaid } : { income: 0, expense: 0, paid: 0, discount: 0, remaining: 0, net: 0 };
  const totalCashCollected = totals.income;
  const totalExpensesRecognized = totals.expense;
  const netRealizedPosition = totals.net ?? ((totals.income || 0) - (totals.expense || 0));

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800">
      {/* Top Header Card with Title & Filters */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Income & Expense Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Income: POS sales and collections · Expense: Salon operational vouchers, paid staff salaries & commissions
          </p>
        </div>

        {/* Role Scope Notice */}
        {isAccountant ? (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="font-semibold">Personal Accountant Register Active:</span>
              <span>Showing POS sales revenue and operational expense vouchers processed by your account (<strong>{user.name}</strong>). Staff salaries & commissions are hidden.</span>
            </div>
            <span className="text-[11px] font-medium bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700 shadow-2xs">
              Accountant Scoped
            </span>
          </div>
        ) : (
          <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Administrator Consolidated Statement:</span>
              <span>Complete salon income and expenses including all cashiers, operational disbursements, and staff payrolls. Filter by accountant below to review specific accounts.</span>
            </div>
          </div>
        )}

        {/* Filters Form Row */}
        <form onSubmit={handleApplyFilters} className={`grid grid-cols-1 sm:grid-cols-2 ${!isAccountant ? 'md:grid-cols-6' : 'md:grid-cols-5'} gap-3.5 items-end`}>
          {/* Branch Filter */}
          <div>
            <label className={labelClass}>Branch</label>
            <select
              value={selectedBranch}
              disabled={!isSuperAdmin}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setSelectedUser('ALL');
              }}
              className={selectClass}
            >
              {isSuperAdmin && <option value="ALL">All Branches</option>}
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {!isAccountant ? (
            <>
              {/* User Type Filter */}
              <div>
                <label className={labelClass}>User Type</label>
                <select
                  value={selectedUserType}
                  onChange={(e) => {
                    setSelectedUserType(e.target.value);
                    setSelectedUser('ALL');
                  }}
                  className={selectClass}
                >
                  <option value="ALL">All Types</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>

              {/* User Filter */}
              <div>
                <label className={labelClass}>User</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className={selectClass}
                >
                  <option value="ALL">All Users</option>
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className={labelClass}>Account Scope</label>
              <input
                type="text"
                disabled
                value={`${user.name} (My Sales & Expenses)`}
                className={`${inputClass} bg-slate-100 text-slate-600 font-medium cursor-not-allowed`}
              />
            </div>
          )}

          {/* From Date */}
          <div>
            <label className={labelClass}>From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* To Date */}
          <div>
            <label className={labelClass}>To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Filter Action Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[35px] bg-[#0047AB] hover:bg-[#003785] active:bg-[#002b66] text-white font-medium text-xs rounded-md shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Filter className="w-3.5 h-3.5 fill-current" />
                  <span>Filter</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Main Content Area */}
      {!hasFiltered ? (
        /* Empty State before Filter clicked (Matching Reference Image 1) */
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 md:p-24 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="text-slate-400 mb-3">
            <Filter className="w-14 h-14 stroke-[1.25] text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Please apply filters to view reports</p>
        </div>
      ) : isLoading ? (
        /* Loading Skeleton */
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
          <p className="text-slate-600 text-sm font-medium">Loading Income & Expense Reports...</p>
        </div>
      ) : errorMessage ? (
        /* Error Message */
        <div className="bg-white rounded-xl border border-rose-200 p-8 shadow-xs text-center">
          <p className="text-rose-600 text-sm font-medium mb-3">{errorMessage}</p>
          <button
            onClick={() => handleApplyFilters()}
            className="px-4 py-1.5 bg-[#0047AB] text-white text-xs font-semibold rounded-md shadow-xs hover:bg-[#003785]"
          >
            Retry
          </button>
        </div>
      ) : (
        /* Filtered Data Layout (Matching Reference Image 2) */
        <div className="shadow-sm rounded-xl overflow-hidden border border-slate-200/90 mb-8 bg-white">
          {/* Royal Blue Banner Header (matching reference Image 2) */}
          <div className="bg-[#0047AB] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
            <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
              <List className="w-4 h-4 stroke-[2.5]" />
              <span>Income & Expense Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="bg-[#009688] hover:bg-[#00897B] active:bg-[#00796B] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="bg-[#4B5563] hover:bg-[#374151] active:bg-[#1F2937] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Table Container with smooth horizontal scroll and generous column space */}
          <div className="bg-white overflow-x-auto rounded-b-xl border-t border-blue-200/40">
            <table className="report-records w-full min-w-[1300px] text-left border-collapse font-['Inter',sans-serif] text-[13px] antialiased">
              <thead>
                <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                  <th className="py-3.5 px-4 text-center w-12 font-medium text-[#475569]">#</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] w-24">Type</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] whitespace-nowrap">Source</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] whitespace-nowrap">User</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] whitespace-nowrap">Branch</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] min-w-[220px]">Title</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] text-center w-24">Status</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] text-right whitespace-nowrap">Amount</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] text-right whitespace-nowrap">Total Paid / Collection</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] text-right whitespace-nowrap">Discount</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] text-right whitespace-nowrap">Remaining</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] whitespace-nowrap">Date</th>
                  <th className="py-3.5 px-4 font-medium text-[#475569] whitespace-nowrap">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                {reportData && reportData.rows.length > 0 ? (
                  reportData.rows.map((row: IncomeExpenseReportRow, idx: number) => {
                    const isIncome = row.income > 0 || row.type === 'INCOME';
                    const amountValue = isIncome ? row.income : row.expense;
                    const isAccruedComm = row.type === 'COMMISSION_EXPENSE' && (row.status === 'ACCRUED' || !row.paid);
                    const paidValue = isAccruedComm ? 0 : isIncome ? (row.paid ?? row.income) : (row.paid ?? row.expense);
                    const discountValue = row.discount || 0;
                    const remainingValue = isAccruedComm ? (row.remaining || row.expense) : (row.remaining || 0);
                    const dateParts = formatDateParts(row.date);

                    return (
                      <tr key={row.id || idx} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        {/* 1. # */}
                        <td className="py-3.5 px-4 text-center font-normal text-slate-500 text-[13px]">
                          {idx + 1}
                        </td>

                        {/* 2. Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {row.type === 'SETTLEMENT' ? <span className="text-blue-700 font-semibold">Settlement</span> : isIncome ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981] text-white">
                              Income
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EF4444] text-white">
                              Expense
                            </span>
                          )}
                        </td>

                        {/* 3. Source */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#475569] text-[13px] font-normal">
                          {row.paymentEventType ? row.paymentEventType.replaceAll('_', ' ') : row.source || (isIncome ? 'Fee Collection' : 'Expense')}
                        </td>

                        {/* 4. User */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#334155] text-[13px] font-normal">
                          {row.userOrPayee || 'Staff'}
                        </td>

                        {/* 5. Branch */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#475569] text-[13px] font-normal">
                          {row.branchName || 'Main Branch'}
                        </td>

                        {/* 6. Title */}
                        <td className="py-3.5 px-4 text-[#334155] text-[13px] font-normal max-w-[240px] truncate" title={row.description || row.reference}>
                          {row.description || row.reference || '—'}
                        </td>

                        {/* 7. Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {row.status === 'PAID' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981] text-white">
                              Paid
                            </span>
                          ) : row.status === 'FINALIZED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#64748B] text-white">
                              Finalized
                            </span>
                          ) : row.status === 'ACCRUED' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B] text-white">
                              Accrued
                            </span>
                          ) : row.status === 'PARTIAL' || row.status === 'PARTIALLY_PAID' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B] text-white">
                              Partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#64748B] text-white">
                              {row.status || 'Unpaid'}
                            </span>
                          )}
                        </td>

                        {/* 8. Amount (Recognized) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`text-[13px] font-semibold tabular-nums ${isIncome ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                            {amountValue === 0 ? '0.00' : formatPKR(amountValue * (isIncome ? 1 : -1), true)}
                          </span>
                        </td>

                        {/* 9. Paid (Cash Flow) */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {row.cashFlow !== undefined ? <span className={row.cashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{row.cashFlow >= 0 ? '+' : '-'}{formatPKR(Math.abs(row.cashFlow))}</span> : isAccruedComm || paidValue === 0 ? (
                            <span className="text-[13px] font-medium tabular-nums text-slate-400">0.00</span>
                          ) : isIncome ? (
                            <span className="text-[13px] font-semibold tabular-nums text-[#10B981]">+{formatPKR(paidValue)}</span>
                          ) : (
                            <span className="text-[13px] font-semibold tabular-nums text-[#EF4444]">-${formatPKR(paidValue)}</span>
                          )}
                        </td>

                        {/* 10. Discount */}
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#475569] text-[13px] whitespace-nowrap">
                          {formatPKR(discountValue)}
                        </td>

                        {/* 11. Remaining (Receivable / Payable) */}
                        <td className={`py-3.5 px-4 text-right tabular-nums text-[13px] whitespace-nowrap ${isAccruedComm ? 'text-[#D97706] font-semibold' : remainingValue > 0 ? 'text-[#EF4444] font-semibold' : 'text-[#475569]'}`}>
                          <span>{formatPKR(remainingValue)}</span>
                          {isAccruedComm && <span className="ml-1 text-[11px] text-amber-600 font-normal">(Payable)</span>}
                        </td>

                        {/* 12. Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#475569] text-[13px]">
                          <div className="leading-tight">
                            <div>{dateParts.dayMonth}</div>
                            {dateParts.year && <div className="text-[12px] text-slate-400">{dateParts.year}</div>}
                          </div>
                        </td>

                        {/* 13. Method */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#475569] text-[13px] font-normal">
                          {formatMethod(row.paymentMethod)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-slate-400 font-medium">
                      No records found for the selected branch, dates, and filters.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Integrated Table Footer */}
              <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px]">
                {reportData?.totals.collections !== undefined && (
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={7} className="py-3 px-4 text-right font-medium text-slate-700">Total Collections (Net Client Payments)</td>
                    <td colSpan={4} className="py-3 px-4 text-right font-bold tabular-nums">{formatPKR(reportData.totals.collections, true)}</td>
                    <td colSpan={2} />
                  </tr>
                )}
                {/* Row 1: TOTALS (PKR) */}
                <tr className="border-b border-slate-200/70">
                  <td colSpan={7} className="py-3.5 px-4 text-right font-bold text-slate-800 tracking-wide">
                    TOTALS (PKR)
                  </td>
                  {/* Col 8: Amount (Net recognized position) */}
                  <td className={`py-3.5 px-4 text-right font-bold text-[13px] tabular-nums ${totals.net >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {totals.net >= 0 ? `+${formatPKR(totals.net)}` : `-${formatPKR(Math.abs(totals.net))}`}
                  </td>
                  {/* Col 9: Paid (Total cash settled / collected using signed amounts: income.paid - expense.paid) */}
                  <td className={`py-3.5 px-4 text-right font-bold text-[13px] tabular-nums ${signedPaid >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {signedPaid >= 0 ? `+${formatPKR(signedPaid)}` : `-${formatPKR(Math.abs(signedPaid))}`}
                  </td>
                  {/* Col 10: Discount */}
                  <td className="py-3.5 px-4 text-right font-medium text-[13px] tabular-nums text-[#475569]">
                    +{formatPKR(totals.discount || 0)}
                  </td>
                  {/* Col 11: Remaining (Total pending receivable / accrued payable) */}
                  <td className="py-3.5 px-4 text-right font-bold text-[13px] tabular-nums text-[#D97706]">
                    +{formatPKR(totals.remaining || 0)}
                  </td>
                  {/* Col 12 & 13: Date & Method */}
                  <td colSpan={2} className="py-3.5 px-4"></td>
                </tr>

                {/* Row 2: Recognized Business Revenue */}
                <tr className="border-b border-slate-200/70">
                  <td colSpan={7} className="py-3 px-4 text-right font-medium text-slate-700">
                    Recognized Business Revenue (Accrual Net Sales)
                  </td>
                  <td colSpan={4} className="py-3 px-4 text-right font-bold text-[13px] tabular-nums text-[#10B981]">
                    +{formatPKR(totals.income)}
                  </td>
                  <td colSpan={2} className="py-3 px-4"></td>
                </tr>

                {/* Row 3: Cost of Goods Sold (COGS & Consumables) */}
                {reportData?.kpis?.cogs !== undefined && (
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={7} className="py-3 px-4 text-right font-medium text-slate-700">
                      Cost of Goods Sold (Retail COGS & Consumable Usage)
                    </td>
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-[13px] tabular-nums text-amber-600">
                      -{formatPKR(reportData.kpis.cogs || 0)}
                    </td>
                    <td colSpan={2} className="py-3 px-4"></td>
                  </tr>
                )}

                {/* Row 4: Operating Overheads */}
                <tr className="border-b border-slate-200/70">
                  <td colSpan={7} className="py-3 px-4 text-right font-medium text-slate-700">
                    Operating Expenses (Vouchers, Finalized Salaries & Commission Earned)
                  </td>
                  <td colSpan={4} className="py-3 px-4 text-right font-bold text-[13px] tabular-nums text-[#EF4444]">
                    -{formatPKR(totalExpensesRecognized)}
                  </td>
                  <td colSpan={2} className="py-3 px-4"></td>
                </tr>

                {/* Row 5: Operating Profit (Revenue - COGS - Expenses) */}
                <tr>
                  <td colSpan={7} className="py-3 px-4 text-right font-bold text-slate-800">
                    Net Operating Profit (Revenue − COGS − Operating Expenses)
                  </td>
                  <td colSpan={4} className={`py-3 px-4 text-right font-bold text-[13px] tabular-nums ${netRealizedPosition >= 0 ? 'text-[#0047AB]' : 'text-[#EF4444]'}`}>
                    {netRealizedPosition >= 0 ? `+${formatPKR(netRealizedPosition)}` : `-${formatPKR(Math.abs(netRealizedPosition))}`}
                  </td>
                  <td colSpan={2} className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="text-center py-4 text-xs text-slate-400 font-medium tracking-wide">
        © iSysware Management System
      </div>
    </div>
  );
};

export default IncomeExpenseReportPage;
