import React, { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  DetailedExpensesReport,
  DetailedExpenseRow,
  DetailedExpensesReportQuery,
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
  Receipt,
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
    const year = d.getFullYear();
    return { dayMonth: `${day} ${month}`, year: `${year}` };
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

export const DetailedExpensesReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/reports/detailed-expenses" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Filter Form State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPaymentSource, setSelectedPaymentSource] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<DetailedExpensesReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch report data on demand from backend API
  const fetchReport = useCallback(
    async (q: DetailedExpensesReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getDetailedExpensesReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load Detailed Expenses report:', err);
        setErrorMessage(err.message || 'Failed to fetch live expenses report from server.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);

    const query: DetailedExpensesReportQuery = {
      branchId: selectedBranch,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      preset: !fromDate && !toDate ? 'THIS_MONTH' : 'CUSTOM',
      category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      status: (selectedStatus as any) || 'ALL',
      paymentSource: (selectedPaymentSource as any) || 'ALL',
      search: searchQuery.trim() || undefined,
    };

    fetchReport(query);
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Detailed Expenses Report'],
      ['Campus', selectedBranch === 'ALL' ? 'All Campuses' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Voucher #',
      'Date',
      'Campus',
      'Category',
      'Title',
      'Payee',
      'Payment Source',
      'Status',
      'Created By',
      'Amount (PKR)',
    ];

    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.voucherNumber,
      formatDateDisplay(r.date),
      r.branchName,
      r.category,
      r.title,
      r.payee,
      r.paymentSource,
      r.status,
      r.createdByName || 'Staff',
      r.amount.toFixed(2),
    ]);

    downloadReportExcel('Detailed_Expenses_Report', meta, [{ headers, rows }]);
  };

  const handleExportPdf = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Detailed Expenses Report'],
      ['Campus', selectedBranch === 'ALL' ? 'All Campuses' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Voucher #',
      'Date',
      'Campus',
      'Category',
      'Title',
      'Payee',
      'Payment Source',
      'Status',
      'Created By',
      'Amount (PKR)',
    ];

    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.voucherNumber,
      formatDateDisplay(r.date),
      r.branchName,
      r.category,
      r.title,
      r.payee,
      r.paymentSource,
      r.status,
      r.createdByName || 'Staff',
      r.amount.toFixed(2),
    ]);

    downloadReportCsv('Detailed_Expenses_Report', meta, [{ headers, rows }]);
  };

  const handlePrint = () => {
    if (!reportData || !reportData.rows.length) {
      window.print();
      return;
    }
    const meta: [string, string][] = [
      ['Campus', selectedBranch === 'ALL' ? 'All Campuses' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Total Expenses', formatPKR(reportData.totals.amount)],
    ];
    const headers = ['#', 'Voucher #', 'Date', 'Campus', 'Category', 'Title', 'Payee', 'Source', 'Status', 'Amount'];
    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.voucherNumber,
      formatDateDisplay(r.date),
      r.branchName,
      r.category,
      r.title,
      r.payee,
      r.paymentSource,
      r.status,
      formatPKR(r.amount),
    ]);

    printReportWindow({
      title: 'Detailed Expenses Report',
      meta,
      headers,
      rows,
    });
  };

  const kpis = reportData?.kpis || {
    totalPostedAmount: 0,
    totalReversedAmount: 0,
    netExpenseAmount: 0,
    totalVouchersCount: 0,
    activeVouchersCount: 0,
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800">
      {/* Top Header Card with Title & Filters */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Detailed Expenses Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Itemized operational expenditure audit: voucher-level disbursements, payee accounting, expense categorization and tender breakdowns
          </p>
        </div>

        {/* Filters Form Row */}
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5 items-end">
          {/* Campus Filter */}
          <div>
            <label className={labelClass}>Campus</label>
            <select
              value={selectedBranch}
              disabled={!isSuperAdmin}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={selectClass}
            >
              {isSuperAdmin && <option value="ALL">All Campuses</option>}
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Source Filter */}
          <div>
            <label className={labelClass}>Payment Source</label>
            <select
              value={selectedPaymentSource}
              onChange={(e) => setSelectedPaymentSource(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Sources</option>
              <option value="CASH_DRAWER">Cash Drawer</option>
              <option value="ONLINE_ACCOUNT">Online / Bank Account</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className={labelClass}>Voucher Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Statuses</option>
              <option value="POSTED">Posted</option>
              <option value="REVERSED">Reversed</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

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
        /* Empty State before Filter clicked */
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
          <p className="text-slate-600 text-sm font-medium">Loading Detailed Expenses Reports...</p>
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
        /* Filtered Data Layout */
        <div className="mb-8">
          {/* Royal Blue Banner Header */}
          <div className="bg-[#0047AB] text-white px-5 py-3 rounded-t-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Receipt className="w-5 h-5 text-white/90" />
              <span className="font-semibold text-sm tracking-wide">Expense Disbursements Register</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="bg-[#009688] hover:bg-[#00897B] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="bg-[#4B5563] hover:bg-[#374151] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>

          {/* Table Container with Horizontal Scroll */}
          <div className="bg-white overflow-x-auto rounded-b-xl border border-t-0 border-slate-200/90 shadow-sm">
            <table className="report-records w-full min-w-[1300px] text-left border-collapse font-['Inter',sans-serif] text-[13px] antialiased">
              <thead>
                <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                  <th className="py-3.5 px-3 text-center w-8">#</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Voucher #</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3.5 px-4">Campus</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Payee</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Created By</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-[#334155]">
                {reportData && reportData.rows.length > 0 ? (
                  reportData.rows.map((row: DetailedExpenseRow, idx: number) => {
                    const isPosted = row.status === 'POSTED';
                    const dateParts = formatDateParts(row.date);

                    return (
                      <tr key={row.id || idx} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        {/* 1. # */}
                        <td className="py-3.5 px-3 text-center font-normal text-slate-400">
                          {idx + 1}
                        </td>

                        {/* 2. Voucher # */}
                        <td className="py-3.5 px-4 font-semibold text-[#0047AB] whitespace-nowrap">
                          {row.voucherNumber}
                        </td>

                        {/* 3. Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap leading-tight">
                          <div className="font-medium text-slate-800">{dateParts.dayMonth}</div>
                          <div className="text-[11px] text-slate-400">{dateParts.year}</div>
                        </td>

                        {/* 4. Campus */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {row.branchName || 'Main Campus'}
                        </td>

                        {/* 5. Category */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-800 font-medium">
                          {row.category}
                        </td>

                        {/* 6. Title */}
                        <td className="py-3.5 px-4 text-slate-800 max-w-[220px] truncate" title={row.title}>
                          {row.title}
                        </td>

                        {/* 7. Payee */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {row.payee}
                        </td>

                        {/* 8. Source */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {row.paymentSource === 'CASH_DRAWER' ? 'Cash Drawer' : (row.paymentAccountName || 'Bank / Online')}
                        </td>

                        {/* 9. Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isPosted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981] text-white shadow-2xs">
                              POSTED
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#64748B] text-white shadow-2xs">
                              {row.status}
                            </span>
                          )}
                        </td>

                        {/* 10. Created By */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {row.createdByName || 'Staff'}
                        </td>

                        {/* 11. Amount */}
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#EF4444] whitespace-nowrap">
                          {formatPKR(row.amount)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                      No expense disbursements found for the selected campus, dates, and filters.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Integrated Table Footer */}
              <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px] text-[#334155]">
                {/* Row 1: TOTALS (PKR) */}
                <tr className="border-b border-slate-200/70">
                  <td colSpan={10} className="py-3.5 px-4 text-right font-bold text-slate-800 tracking-wide">
                    TOTAL POSTED EXPENSES (PKR)
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#EF4444]">
                    {formatPKR((kpis as any).totalExpenses ?? (kpis as any).totalPostedAmount ?? reportData?.totals?.amount ?? 0)}
                  </td>
                </tr>

                {/* Row 2: Net Operating Disbursements */}
                <tr>
                  <td colSpan={10} className="py-3 px-4 text-right font-medium text-slate-600">
                    Net Recognized Disbursements
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-bold text-[#0047AB] text-sm">
                    {formatPKR((kpis as any).totalExpenses ?? (kpis as any).netExpenseAmount ?? reportData?.totals?.amount ?? 0)}
                  </td>
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

export default DetailedExpensesReportPage;
