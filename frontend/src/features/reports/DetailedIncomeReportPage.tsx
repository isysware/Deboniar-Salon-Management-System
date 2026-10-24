import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  DetailedIncomeReport,
  DetailedIncomeRow,
  DetailedIncomeReportQuery,
  InvoiceStatus,
  InvoiceLifecycle,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  downloadReportCsv,
  printReportWindow,
} from '@/features/reports/reportUtils';
import {
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  Receipt,
  ChevronDown,
  ChevronUp,
  Scissors,
  ShoppingBag,
  PackageCheck,
  CreditCard,
  Search,
  RotateCw,
} from 'lucide-react';

const selectClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const inputClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const labelClass = 'block text-[11px] font-semibold text-[#0B2545] mb-1.5';

const formatPKR = (amt: number) => {
  const num = Number(amt) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export const DetailedIncomeReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/reports/detailed-income" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAccountant = user.role === 'ACCOUNTANT';

  // Filters State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sourceType, setSourceType] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [lifecycle, setLifecycle] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Page State
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportData, setReportData] = useState<DetailedIncomeReport | null>(null);

  // Expandable Row Set
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchReport = useCallback(
    async (q: DetailedIncomeReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getDetailedIncomeReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load detailed income report:', err);
        setErrorMessage(err.message || 'Failed to fetch live detailed income report.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);

    const query: DetailedIncomeReportQuery = {
      branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      preset: !fromDate && !toDate ? 'THIS_MONTH' : 'CUSTOM',
      sourceType: (sourceType as any) || 'ALL',
      paymentStatus: (paymentStatus as any) || 'ALL',
      lifecycle: (lifecycle as any) || 'ALL',
      search: searchQuery.trim() || undefined,
      soldByUserId: isAccountant ? user.id : undefined,
    };

    fetchReport(query);
  };

  const filteredRows = useMemo(() => {
    if (!reportData) return [];
    return reportData.rows;
  }, [reportData]);

  const handleExportCsv = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Campus', selectedBranch === 'ALL' ? 'All Campuses' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Source Filter', sourceType],
      ['Total Line Transactions', String(reportData.kpis.totalTransactions)],
      ['Total Recognized Net Revenue', formatPKR(reportData.kpis.recognizedNetRevenue)],
    ];

    const headers = [
      '#',
      'Invoice #',
      'Date',
      'Source',
      'Item Name',
      'Client',
      'Staff',
      'Campus',
      'Qty',
      'Unit Price',
      'Gross',
      'Discount',
      'Net Recognized',
      'Tax',
      'Total',
      'Status',
      'Lifecycle',
      'Created By',
    ];

    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.invoiceNumber,
      formatDateDisplay(r.date),
      r.incomeSource,
      r.itemName,
      r.clientName,
      r.staffName,
      r.branchName,
      r.quantity,
      r.unitPrice.toFixed(2),
      r.gross.toFixed(2),
      r.discount.toFixed(2),
      r.recognizedNet.toFixed(2),
      r.tax.toFixed(2),
      r.total.toFixed(2),
      r.paymentStatus,
      r.lifecycle,
      r.createdByName,
    ]);

    downloadReportCsv('Detailed_Income_Report', meta, [{ headers, rows }]);
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
      ['Total Transactions', String(reportData.kpis.totalTransactions)],
      ['Recognized Net Revenue', `PKR ${formatPKR(reportData.kpis.recognizedNetRevenue)}`],
    ];

    const headers = [
      '#',
      'Invoice #',
      'Date',
      'Source',
      'Item',
      'Client',
      'Staff',
      'Net Sales',
      'Tax',
      'Total',
      'Status',
    ];

    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.invoiceNumber,
      formatDateDisplay(r.date),
      r.incomeSource,
      r.itemName,
      r.clientName,
      r.staffName,
      formatPKR(r.recognizedNet),
      formatPKR(r.tax),
      formatPKR(r.total),
      r.paymentStatus,
    ]);

    printReportWindow({
      title: 'Detailed Income Report (Recognized Revenue)',
      meta,
      headers,
      rows,
    });
  };

  const totals = reportData?.totals || {
    gross: 0,
    discount: 0,
    netSales: 0,
    refundedNet: 0,
    recognizedNet: 0,
    tax: 0,
    netTax: 0,
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Detailed Income Report</h1>
          <p className="text-xs text-slate-500 mt-1">
            Transaction-level recognized revenue register: granular drilldown by service, package component and retail product
          </p>
        </div>

        {/* Filters Form */}
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3.5 items-end">
          {/* Campus */}
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

          {/* Source Type */}
          <div>
            <label className={labelClass}>Income Source</label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Sources</option>
              <option value="SERVICE">Services Only</option>
              <option value="PRODUCT">Retail Products Only</option>
              <option value="PACKAGE">Packages Only</option>
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className={labelClass}>Pay Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>

          {/* Lifecycle */}
          <div>
            <label className={labelClass}>Lifecycle</label>
            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Active & Refunded</option>
              <option value="ACTIVE">Active Only</option>
              <option value="PARTIALLY_REFUNDED">Partial Refund</option>
              <option value="REFUNDED">Refunded</option>
              <option value="VOIDED">Voided</option>
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

          {/* Filter Button */}
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
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 md:p-24 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="text-slate-400 mb-3">
            <Filter className="w-14 h-14 stroke-[1.25] text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Please apply filters to view detailed recognized income</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
          <p className="text-slate-600 text-sm font-medium">Loading Detailed Income Drilldown...</p>
        </div>
      ) : errorMessage ? (
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
        <div>
          {/* KPI Summary Cards */}
          {reportData?.kpis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Total Lines</span>
                <span className="text-xl font-bold text-slate-800">{reportData.kpis.totalTransactions}</span>
                <div className="text-[10px] text-slate-400 mt-1">Recognized line items</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Gross Sales</span>
                <span className="text-xl font-bold text-slate-800">PKR {formatPKR(reportData.kpis.grossSales)}</span>
                <div className="text-[10px] text-slate-400 mt-1">Before allocated disc</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Net Revenue</span>
                <span className="text-xl font-bold text-[#0047AB]">PKR {formatPKR(reportData.kpis.recognizedNetRevenue)}</span>
                <div className="text-[10px] text-emerald-600 mt-1">P&L recognized sales</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Services Net</span>
                <span className="text-xl font-bold text-emerald-600">PKR {formatPKR(reportData.kpis.serviceRevenue)}</span>
                <div className="text-[10px] text-slate-400 mt-1">{reportData.kpis.serviceCount} service units</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Products Net</span>
                <span className="text-xl font-bold text-purple-600">PKR {formatPKR(reportData.kpis.productRevenue)}</span>
                <div className="text-[10px] text-slate-400 mt-1">{reportData.kpis.productCount} retail units</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Packages Net</span>
                <span className="text-xl font-bold text-amber-600">PKR {formatPKR(reportData.kpis.packageRevenue)}</span>
                <div className="text-[10px] text-slate-400 mt-1">{reportData.kpis.packageCount} package sales</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Sales Tax Net</span>
                <span className="text-xl font-bold text-slate-700">PKR {formatPKR(reportData.kpis.netTaxLiability)}</span>
                <div className="text-[10px] text-slate-400 mt-1">Excluded from revenue</div>
              </div>
            </div>
          )}

          {/* Banner + Table */}
          <div className="shadow-sm rounded-xl overflow-hidden border border-slate-200/90 mb-8 bg-white">
            <div className="bg-[#0047AB] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
              <div className="flex items-center gap-2 font-bold text-sm tracking-wide text-white">
                <Receipt className="w-4 h-4 stroke-[2.5]" />
                <span>Transaction-Level Income Register</span>
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
                  onClick={handlePrint}
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

            <div className="bg-white overflow-x-auto rounded-b-xl border-t border-blue-200/40">
              <table className="report-records w-full min-w-[1380px] text-left border-collapse font-['Inter',sans-serif] text-[13px] antialiased">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-3 text-center w-10 font-medium text-[#475569]">#</th>
                    <th className="py-3.5 px-3 whitespace-nowrap font-medium text-[#475569]">Date & Time</th>
                    <th className="py-3.5 px-3 whitespace-nowrap font-medium text-[#475569]">Invoice #</th>
                    <th className="py-3.5 px-3 text-center font-medium text-[#475569]">Source</th>
                    <th className="py-3.5 px-3 min-w-[180px] font-medium text-[#475569]">Item / Description</th>
                    <th className="py-3.5 px-3 min-w-[140px] font-medium text-[#475569]">Client</th>
                    <th className="py-3.5 px-3 whitespace-nowrap font-medium text-[#475569]">Staff / Stylist</th>
                    <th className="py-3.5 px-3 text-center w-14 font-medium text-[#475569]">Qty</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap font-medium text-[#475569]">Gross</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap font-medium text-[#475569]">Discount</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap font-bold text-[#0047AB]">Recognized Net</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap font-medium text-[#475569]">Tax</th>
                    <th className="py-3.5 px-3 text-right whitespace-nowrap font-medium text-[#475569]">Total</th>
                    <th className="py-3.5 px-3 text-center w-24 font-medium text-[#475569]">Status</th>
                    <th className="py-3.5 px-3 text-center w-20 font-medium text-[#475569]">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row: DetailedIncomeRow, idx: number) => {
                      const dateParts = formatDateParts(row.date);
                      const isExpanded = expandedRows.has(row.id);

                      return (
                        <React.Fragment key={row.id || idx}>
                          <tr className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                            {/* # */}
                            <td className="py-3.5 px-3 text-center font-normal text-slate-500 text-[13px]">
                              {idx + 1}
                            </td>

                            {/* Date */}
                            <td className="py-3.5 px-3 whitespace-nowrap text-slate-700">
                              <div className="leading-tight">
                                <div>{dateParts.dayMonth}</div>
                                <div className="text-[11px] text-slate-400">{row.time || dateParts.year}</div>
                              </div>
                            </td>

                            {/* Invoice # */}
                            <td className="py-3.5 px-3 font-semibold text-[#0047AB] whitespace-nowrap">
                              {row.invoiceNumber}
                            </td>

                            {/* Source Type Badge */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              {row.incomeSource === 'SERVICE' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Scissors className="w-3 h-3" />
                                  <span>Service</span>
                                </span>
                              ) : row.incomeSource === 'PRODUCT' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                  <ShoppingBag className="w-3 h-3" />
                                  <span>Product</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <PackageCheck className="w-3 h-3" />
                                  <span>Package</span>
                                </span>
                              )}
                            </td>

                            {/* Item Name */}
                            <td className="py-3.5 px-3 font-semibold text-slate-900">
                              <div>{row.itemName}</div>
                              {row.itemCode && row.itemCode !== '—' && (
                                <div className="text-[11px] text-slate-400 font-normal">{row.itemCode}</div>
                              )}
                            </td>

                            {/* Client */}
                            <td className="py-3.5 px-3 text-slate-800 whitespace-nowrap">
                              {row.clientName}
                            </td>

                            {/* Staff */}
                            <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap font-medium">
                              {row.staffName}
                            </td>

                            {/* Qty */}
                            <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                              {row.quantity}
                            </td>

                            {/* Gross */}
                            <td className="py-3.5 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                              PKR {formatPKR(row.gross)}
                            </td>

                            {/* Discount */}
                            <td className="py-3.5 px-3 text-right tabular-nums text-slate-500 whitespace-nowrap">
                              {row.discount > 0 ? `-PKR ${formatPKR(row.discount)}` : '0.00'}
                            </td>

                            {/* Recognized Net */}
                            <td className="py-3.5 px-3 text-right tabular-nums whitespace-nowrap">
                              <div className="font-bold text-[#0047AB]">PKR {formatPKR(row.recognizedNet)}</div>
                              {row.refundedNet > 0 && (
                                <div className="text-[10px] text-rose-600 font-medium">
                                  Reversal: -PKR {formatPKR(row.refundedNet)}
                                </div>
                              )}
                            </td>

                            {/* Tax */}
                            <td className="py-3.5 px-3 text-right tabular-nums text-slate-600 whitespace-nowrap">
                              +PKR {formatPKR(row.tax)}
                            </td>

                            {/* Total */}
                            <td className="py-3.5 px-3 text-right tabular-nums font-bold text-slate-800 whitespace-nowrap">
                              PKR {formatPKR(row.total)}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              {row.paymentStatus === 'PAID' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981] text-white">
                                  Paid
                                </span>
                              ) : row.paymentStatus === 'PARTIAL' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B] text-white">
                                  Partial
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#64748B] text-white">
                                  {row.paymentStatus || 'Unpaid'}
                                </span>
                              )}
                            </td>

                            {/* Details Toggle */}
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => toggleRow(row.id)}
                                className="p-1.5 rounded-md hover:bg-blue-50 text-slate-500 hover:text-[#0047AB] transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium"
                              >
                                <span>{isExpanded ? 'Hide' : 'View'}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Drawer Row */}
                          {isExpanded && (
                            <tr className="bg-blue-50/30 border-b border-blue-200/50">
                              <td colSpan={15} className="p-4 pl-12 text-xs">
                                <div className="space-y-3">
                                  {/* Package Components (if package) */}
                                  {row.incomeSource === 'PACKAGE' && row.components && row.components.length > 0 && (
                                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                                      <span className="font-bold text-[#0B2545] block mb-2">Package Service Components Breakdown:</span>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {row.components.map((comp) => (
                                          <div key={comp.id} className="p-2 rounded bg-slate-50 border border-slate-200 text-xs">
                                            <div className="font-semibold text-slate-800">{comp.serviceName}</div>
                                            <div className="text-slate-500">Stylist: {comp.staffName}</div>
                                            <div className="text-[#0047AB] font-bold mt-1">
                                              Allocated: PKR {formatPKR(comp.allocatedAmount)} ({comp.allocationPercentage}%)
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Cash / Bank Payments History for this invoice */}
                                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-bold text-[#0B2545]">Invoice Payment Audit (Cash / Bank Accounts):</span>
                                      <span className="text-[11px] text-slate-500 italic">
                                        * Income recognized once upon invoice posting. Subsequent collections update only Cash/Receivables without re-booking revenue.
                                      </span>
                                    </div>
                                    {row.payments && row.payments.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {row.payments.map((p) => (
                                          <div key={p.id} className="px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                                            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>{p.date}</span>
                                            <span className="font-semibold">{p.paymentAccountName} ({p.method})</span>
                                            <span className="font-bold text-emerald-700">PKR {formatPKR(p.amount)}</span>
                                            {p.kind && <span className="text-[10px] bg-emerald-200/60 px-1 rounded uppercase font-semibold">{p.kind}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">No payment records yet (Bill is Unpaid).</span>
                                    )}
                                  </div>

                                  {/* Refunds & Reversals linked to this invoice */}
                                  {row.refunds && row.refunds.length > 0 && (
                                    <div className="bg-white p-3 rounded-lg border border-rose-200">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-rose-800">Linked Refund & Reversal Entries ({row.invoiceNumber}):</span>
                                        <span className="text-[11px] text-slate-500 italic">
                                          * Linked reversals deducted from recognized turnover; actual refunds paid out on refund date.
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {row.refunds.map((r) => (
                                          <div key={r.id} className="px-3 py-1.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                                            <RotateCw className="w-3.5 h-3.5 text-rose-600" />
                                            <span className="font-semibold">{r.refundNumber}</span>
                                            <span>{r.refundDate}</span>
                                            <span>Reversal: <strong className="text-rose-700">PKR {formatPKR(r.netReversed)}</strong></span>
                                            {r.cashOut > 0 && <span>(Cash Out: PKR {formatPKR(r.cashOut)})</span>}
                                            {r.lineRefund && <span>[Line Net: -PKR {formatPKR(r.lineRefund.net)}]</span>}
                                            {r.reason && <span className="text-[11px] text-slate-500 italic">({r.reason})</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="text-[11px] text-slate-400">
                                    Created & Posted by: <strong className="text-slate-700">{row.createdByName}</strong> • Campus: <strong className="text-slate-700">{row.branchName}</strong>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={15} className="py-16 text-center text-slate-400 font-medium">
                        No detailed income transactions found for the selected campus and date filters.
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Table Footer */}
                <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px]">
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={8} className="py-3.5 px-3 text-right font-bold text-slate-800 tracking-wide">
                      TOTALS ({filteredRows.length} Line Items):
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-slate-700 font-bold">
                      PKR {formatPKR(totals.gross)}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-slate-500 font-medium">
                      {totals.discount > 0 ? `-PKR ${formatPKR(totals.discount)}` : '0.00'}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums font-bold text-[#0047AB] text-sm">
                      PKR {formatPKR(totals.recognizedNet)}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-slate-700 font-semibold">
                      +PKR {formatPKR(totals.tax)}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums font-bold text-slate-900">
                      PKR {formatPKR(totals.recognizedNet + totals.tax)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>

                  <tr>
                    <td colSpan={8} className="py-3 px-3 text-right font-medium text-slate-700">
                      Recognized Net Revenue Summary
                    </td>
                    <td colSpan={7} className="py-3 px-3 text-right text-xs">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold mr-4">
                        Services: PKR {formatPKR(reportData?.kpis.serviceRevenue || 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-purple-700 font-semibold mr-4">
                        Products: PKR {formatPKR(reportData?.kpis.productRevenue || 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold mr-4">
                        Packages: PKR {formatPKR(reportData?.kpis.packageRevenue || 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#0047AB] font-bold">
                        P&L Recognized Total: PKR {formatPKR(totals.recognizedNet)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
