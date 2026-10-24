import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import {
  Branch,
  StaffCommissionReport,
  StaffCommissionReportQuery,
  StaffMember,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  ExternalLink,
  BadgePercent,
} from 'lucide-react';
import {
  DATE_PRESETS,
  DatePreset,
  downloadReportCsv,
  downloadReportExcel,
  printReportWindow,
  resolvePreset,
} from './reportUtils';

const selectClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const inputClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const labelClass = 'block text-[11px] font-semibold text-[#0B2545] mb-1.5';

const formatPKR = (amt: number) => {
  const num = Number(amt) || 0;
  return Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export const StaffCommissionReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();
  const { navigate } = useRouter();

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/reports/staff-commission" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const businessDate = demoDate || new Date().toISOString().slice(0, 10);
  const defaultMonth = resolvePreset('THIS_MONTH', businessDate)!;

  // Filter Form State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(
    activeBranchId || user.branchId || 'ALL'
  );
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');
  const [fromDate, setFromDate] = useState<string>(defaultMonth.from);
  const [toDate, setToDate] = useState<string>(defaultMonth.to);

  // Tab State
  const [tab, setTab] = useState<'STAFF' | 'LINES'>('STAFF');

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<StaffCommissionReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    if (allBranches && allBranches.length > 0) {
      setBranches(allBranches);
    } else {
      salonService.getBranches().then(setBranches).catch(() => undefined);
    }
  }, [allBranches]);

  // Load staff dynamically when branch selection changes
  useEffect(() => {
    salonService
      .getStaff(selectedBranch || 'ALL')
      .then(setStaffList)
      .catch(() => setStaffList([]));
  }, [selectedBranch]);

  const handlePresetChange = (p: DatePreset) => {
    setPreset(p);
    const r = resolvePreset(p, businessDate);
    if (r) {
      setFromDate(r.from);
      setToDate(r.to);
    }
  };

  const branchName = (id?: string) => {
    if (!id || id === 'ALL') return 'All Branches';
    return branches.find((b) => b.id === id)?.name || id;
  };

  // Fetch report data on demand from backend API
  const fetchReport = useCallback(
    async (q: StaffCommissionReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getStaffCommissionReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load Staff Commission report:', err);
        setErrorMessage(
          err.message || 'Failed to fetch live commission report from server.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);

    const query: StaffCommissionReportQuery = {
      branchId: selectedBranch,
      staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
      source:
        selectedSource !== 'ALL'
          ? (selectedSource as StaffCommissionReportQuery['source'])
          : undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      startDate: fromDate || defaultMonth.from,
      endDate: toDate || defaultMonth.to,
    };

    fetchReport(query);
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!reportData) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Commission Reports'],
      ['Branch', branchName(selectedBranch)],
      ['From Date', fromDate || '—'],
      ['To Date', toDate || '—'],
      ['Staff Filter', selectedStaffId !== 'ALL' ? staffList.find((s) => s.id === selectedStaffId)?.name || selectedStaffId : 'All Staff'],
      ['Generated By', user.name],
      ['Generated At', new Date().toLocaleString()],
    ];

    const staffHeaders = [
      'Staff',
      'Employee Code',
      'Attributed Net Sales',
      'Opening Liability',
      'Earned',
      'Reversed',
      'Net',
      'Paid',
      'Outstanding',
    ];

    const staffRows = [
      ...reportData.byStaff.map((s) => [
        s.staffName,
        s.employeeCode,
        s.attributedNetSales.toFixed(2),
        s.openingLiability.toFixed(2),
        s.earned.toFixed(2),
        s.reversed.toFixed(2),
        s.net.toFixed(2),
        s.paid.toFixed(2),
        s.outstanding.toFixed(2),
      ]),
      [
        'TOTALS',
        '',
        reportData.totals.attributedNetSales.toFixed(2),
        reportData.totals.openingLiability.toFixed(2),
        reportData.totals.earned.toFixed(2),
        reportData.totals.reversed.toFixed(2),
        reportData.totals.net.toFixed(2),
        reportData.totals.paid.toFixed(2),
        reportData.totals.outstanding.toFixed(2),
      ],
    ];

    const linesHeaders = [
      'Date',
      'Staff',
      'Invoice #',
      'Customer',
      'Item',
      'Source',
      'Event Type',
      'Attributed Net',
      'Rate %',
      'Earned',
      'Reversed',
      'Net',
      'Run Status',
    ];

    const linesRows = reportData.rows.map((r) => [
      r.date,
      r.staffName,
      r.invoiceNumber,
      r.customer,
      r.itemName,
      r.source,
      r.eventType,
      r.attributedNetSales.toFixed(2),
      `${r.rateSnapshot}%`,
      r.earned.toFixed(2),
      r.reversed.toFixed(2),
      r.net.toFixed(2),
      r.runStatus,
    ]);

    downloadReportExcel(`Staff_Commission_${fromDate}_${toDate}.csv`, meta, [
      { title: 'Summary By Staff', headers: staffHeaders, rows: staffRows },
      { title: 'Commission Detail Events', headers: linesHeaders, rows: linesRows },
    ]);
  };

  const handleExportCsv = () => {
    if (!reportData) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Commission Reports'],
      ['Branch', branchName(selectedBranch)],
      ['Date Range', `${fromDate} to ${toDate}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const staffHeaders = [
      'Staff',
      'Employee Code',
      'Attributed Net Sales',
      'Opening Liability',
      'Earned',
      'Reversed',
      'Net',
      'Paid',
      'Outstanding',
    ];

    const staffRows = [
      ...reportData.byStaff.map((s) => [
        s.staffName,
        s.employeeCode,
        s.attributedNetSales.toFixed(2),
        s.openingLiability.toFixed(2),
        s.earned.toFixed(2),
        s.reversed.toFixed(2),
        s.net.toFixed(2),
        s.paid.toFixed(2),
        s.outstanding.toFixed(2),
      ]),
      [
        'TOTALS',
        '',
        reportData.totals.attributedNetSales.toFixed(2),
        reportData.totals.openingLiability.toFixed(2),
        reportData.totals.earned.toFixed(2),
        reportData.totals.reversed.toFixed(2),
        reportData.totals.net.toFixed(2),
        reportData.totals.paid.toFixed(2),
        reportData.totals.outstanding.toFixed(2),
      ],
    ];

    downloadReportCsv(`Staff_Commission_${fromDate}_${toDate}.csv`, meta, [
      { title: 'By Staff', headers: staffHeaders, rows: staffRows },
    ]);
  };

  const handlePrint = () => {
    if (!reportData) return;
    const meta: [string, string][] = [
      ['Branch', branchName(selectedBranch)],
      ['Date Range', `${fromDate} to ${toDate}`],
      ['Generated By', user.name],
    ];

    if (tab === 'STAFF') {
      const headers = [
        'Staff',
        'Code',
        'Attributed Sales',
        'Opening Liab.',
        'Earned',
        'Reversed',
        'Net',
        'Paid',
        'Outstanding',
      ];
      const rows = reportData.byStaff.map((s) => [
        s.staffName,
        s.employeeCode,
        formatPKR(s.attributedNetSales),
        formatPKR(s.openingLiability),
        formatPKR(s.earned),
        formatPKR(s.reversed),
        formatPKR(s.net),
        formatPKR(s.paid),
        formatPKR(s.outstanding),
      ]);
      const footers = [
        'TOTALS',
        '',
        formatPKR(reportData.totals.attributedNetSales),
        formatPKR(reportData.totals.openingLiability),
        formatPKR(reportData.totals.earned),
        formatPKR(reportData.totals.reversed),
        formatPKR(reportData.totals.net),
        formatPKR(reportData.totals.paid),
        formatPKR(reportData.totals.outstanding),
      ];

      printReportWindow({
        title: 'Staff Commission Report (By Staff)',
        subtitle: `Performance & Commission Liability Breakdown`,
        meta,
        headers,
        rows,
        totals: footers,
      });
    } else {
      const headers = [
        'Date',
        'Staff',
        'Invoice',
        'Customer',
        'Item',
        'Sales',
        'Rate',
        'Earned',
        'Reversed',
        'Net',
      ];
      const rows = reportData.rows.map((r) => [
        r.date,
        r.staffName,
        r.invoiceNumber,
        r.customer,
        r.itemName,
        formatPKR(r.attributedNetSales),
        `${r.rateSnapshot}%`,
        formatPKR(r.earned),
        formatPKR(r.reversed),
        formatPKR(r.net),
      ]);

      printReportWindow({
        title: 'Staff Commission Report (Events)',
        subtitle: `Commission Event Logs`,
        meta,
        headers,
        rows,
      });
    }
  };

  const t = reportData?.totals;

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800 font-sans">
      {/* Top Header & Filters Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">
              Staff Commission Reports
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Attributed net sales, commission earned, reversals, paid amounts, and outstanding liability.
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => navigate('/accounts/commission')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Commission Runs
            </button>
          </div>
        </div>

        <form onSubmit={handleApplyFilters}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
            {/* Branch */}
            <div>
              <label className={labelClass}>Branch</label>
              <select
                className={selectClass}
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setSelectedStaffId('ALL');
                }}
              >
                {isSuperAdmin && <option value="ALL">All Branches</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Staff */}
            <div>
              <label className={labelClass}>Staff</label>
              <select
                className={selectClass}
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="ALL">All Staff</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Source */}
            <div>
              <label className={labelClass}>Source</label>
              <select
                className={selectClass}
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                <option value="ALL">All Sources</option>
                <option value="SERVICE">Service</option>
                <option value="PACKAGE">Package Component</option>
              </select>
            </div>

            {/* Invoice # */}
            <div>
              <label className={labelClass}>Invoice #</label>
              <input
                type="text"
                placeholder="e.g. INV-..."
                className={inputClass}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            {/* Date Preset */}
            <div>
              <label className={labelClass}>Date Preset</label>
              <select
                className={selectClass}
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className={labelClass}>From Date</label>
              <input
                type="date"
                className={inputClass}
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>

            {/* To Date */}
            <div>
              <label className={labelClass}>To Date</label>
              <input
                type="date"
                className={inputClass}
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>

            {/* Filter Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[35px] bg-[#0047AB] hover:bg-[#003785] active:bg-[#002d6b] text-white text-xs font-semibold rounded-md shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
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
          <p className="text-slate-400 text-sm font-medium">
            Please apply filters to view reports
          </p>
        </div>
      ) : isLoading ? (
        /* Loading Skeleton */
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
          <p className="text-slate-600 text-sm font-medium">
            Loading Staff Commission Reports...
          </p>
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <BadgePercent className="w-5 h-5 text-white/90" />
                <span className="font-semibold text-sm tracking-wide">
                  Staff Commission Reports
                </span>
              </div>
              <div className="flex items-center bg-black/15 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setTab('STAFF')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    tab === 'STAFF'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  By Staff
                </button>
                <button
                  type="button"
                  onClick={() => setTab('LINES')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    tab === 'LINES'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Commission Events ({reportData?.rows.length ?? 0})
                </button>
              </div>
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
                onClick={handleExportCsv}
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
            {tab === 'STAFF' ? (
              <table className="report-records w-full min-w-[1250px] text-left border-collapse font-['Inter',sans-serif] text-[13px] antialiased">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4">Staff</th>
                    <th className="py-3.5 px-4">Employee Code</th>
                    <th className="py-3.5 px-4 text-right">Attributed Net Sales</th>
                    <th className="py-3.5 px-4 text-right">Opening Liability</th>
                    <th className="py-3.5 px-4 text-right">Earned</th>
                    <th className="py-3.5 px-4 text-right">Reversed</th>
                    <th className="py-3.5 px-4 text-right">Net Commission</th>
                    <th className="py-3.5 px-4 text-right">Paid</th>
                    <th className="py-3.5 px-4 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="text-[#334155]">
                  {(!reportData || reportData.byStaff.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                        No staff commission records found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    reportData.byStaff.map((s) => (
                      <tr key={s.staffId} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {s.staffName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {s.employeeCode || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-800">
                          {formatPKR(s.attributedNetSales)}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-slate-600">
                          {formatPKR(s.openingLiability)}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#10B981]">
                          {formatPKR(s.earned)}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#EF4444]">
                          {s.reversed ? formatPKR(s.reversed) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-800">
                          {formatPKR(s.net)}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-slate-600">
                          {formatPKR(s.paid)}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#0047AB]">
                          {formatPKR(s.outstanding)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {t && reportData && reportData.byStaff.length > 0 && (
                  <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px] text-[#334155]">
                    <tr>
                      <td className="py-3.5 px-4 text-left font-bold text-slate-800">Totals</td>
                      <td className="py-3.5 px-4 text-left text-slate-400">—</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-800">{formatPKR(t.attributedNetSales)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-600">{formatPKR(t.openingLiability)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#10B981]">{formatPKR(t.earned)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#EF4444]">{formatPKR(t.reversed)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-800">{formatPKR(t.net)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-slate-600">{formatPKR(t.paid)}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#0047AB]">{formatPKR(t.outstanding)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <table className="report-records w-full min-w-[1300px] text-left border-collapse font-['Inter',sans-serif] text-[13px] antialiased">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                    <th className="py-3.5 px-4">Staff</th>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Item Name</th>
                    <th className="py-3.5 px-4">Source</th>
                    <th className="py-3.5 px-4 text-right">Attributed Net</th>
                    <th className="py-3.5 px-4 text-right">Rate %</th>
                    <th className="py-3.5 px-4 text-right">Earned</th>
                    <th className="py-3.5 px-4 text-right">Reversed</th>
                    <th className="py-3.5 px-4 text-right">Net</th>
                    <th className="py-3.5 px-4 text-center">Run Status</th>
                  </tr>
                </thead>
                <tbody className="text-[#334155]">
                  {(!reportData || reportData.rows.length === 0) ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400 font-medium">
                        No commission events found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((r) => {
                      const dateParts = formatDateParts(r.date);
                      return (
                        <tr key={r.eventId} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                          <td className="py-3.5 px-4 whitespace-nowrap leading-tight">
                            <div className="font-medium text-slate-800">{dateParts.dayMonth}</div>
                            <div className="text-[11px] text-slate-400">{dateParts.year}</div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {r.staffName}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                            <span className="font-semibold text-[#0047AB]">{r.invoiceNumber}</span>
                            {r.eventType === 'REVERSAL' && (
                              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EF4444] text-white">
                                REVERSAL
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">{r.customer}</td>
                          <td className="py-3.5 px-4 text-slate-800 font-medium">{r.itemName}</td>
                          <td className="py-3.5 px-4 text-slate-500 capitalize">{r.source.toLowerCase()}</td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-800">
                            {formatPKR(r.attributedNetSales)}
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums text-slate-600">
                            {r.rateSnapshot}%
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#10B981]">
                            {r.earned ? formatPKR(r.earned) : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums text-[#EF4444]">
                            {r.reversed ? formatPKR(r.reversed) : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-800">
                            {formatPKR(r.net)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                r.runStatus === 'IN_RUN'
                                  ? 'bg-[#0047AB] text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {r.runStatus === 'IN_RUN' ? 'In Run' : 'Not Run'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-8 text-center text-xs text-slate-400 pb-6">
        © iSysware Management System
      </div>
    </div>
  );
};
