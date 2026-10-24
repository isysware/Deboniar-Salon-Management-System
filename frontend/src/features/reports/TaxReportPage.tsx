import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  TaxReport,
  TaxReportServiceRow,
  TaxReportServiceSummary,
  TaxReportRow,
  TaxReportQuery,
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
  Search,
  Scissors,
  Layers,
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

const formatMethod = (method: string) => {
  if (!method) return 'Cash';
  const m = method.toUpperCase();
  if (m === 'CASH') return 'Cash';
  if (m.includes('BANK') || m.includes('ONLINE') || m.includes('TRANSFER')) return 'Bank Transfer';
  if (m.includes('CARD')) return 'Card';
  return method;
};

type TaxViewTab = 'SERVICES' | 'SERVICE_SUMMARY' | 'INVOICES';

export const TaxReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/reports/tax" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Filters State
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId || user.branchId || 'ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<TaxViewTab>('SERVICES');

  // Page state: Only fetch when user explicitly clicks Filter (Matching Income & Expense Page UI)
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportData, setReportData] = useState<TaxReport | null>(null);

  // Synchronize branch when context updates
  useEffect(() => {
    if (!isSuperAdmin && user.branchId) {
      setSelectedBranch(user.branchId);
    } else if (activeBranchId) {
      setSelectedBranch(activeBranchId);
    }
  }, [activeBranchId, user.branchId, isSuperAdmin]);

  const fetchReport = useCallback(
    async (q: TaxReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await salonService.getTaxReport(q);
        setReportData(res);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to fetch live tax report data from server.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);

    const query: TaxReportQuery = {
      branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      preset: !fromDate && !toDate ? 'THIS_MONTH' : 'CUSTOM',
      search: searchQuery.trim() || undefined,
    };

    fetchReport(query);
  };

  // Service rows & summaries
  const serviceRows: TaxReportServiceRow[] = useMemo(() => {
    if (!reportData) return [];
    if (reportData.serviceRows && reportData.serviceRows.length) return reportData.serviceRows;
    return (reportData.rows as TaxReportServiceRow[]) || [];
  }, [reportData]);

  const serviceSummary: TaxReportServiceSummary[] = useMemo(() => {
    if (!reportData) return [];
    if (reportData.serviceSummary && reportData.serviceSummary.length) return reportData.serviceSummary;
    const map = new Map<string, TaxReportServiceSummary>();
    serviceRows.forEach((r) => {
      const name = r.serviceName || 'Service';
      const existing = map.get(name) || {
        serviceName: name,
        serviceType: r.serviceType || 'SERVICE',
        count: 0,
        taxableBase: 0,
        taxAmount: 0,
        taxRate: r.taxRate || 0,
      };
      existing.count += r.quantity || 1;
      existing.taxableBase += r.taxableBase || 0;
      existing.taxAmount += r.taxAmount || 0;
      map.set(name, existing);
    });
    return Array.from(map.values());
  }, [reportData, serviceRows]);

  const invoiceRows: TaxReportRow[] = useMemo(() => {
    if (!reportData) return [];
    return reportData.invoiceRows || [];
  }, [reportData]);

  // Export handlers
  const handleExportExcel = () => {
    if (!reportData) return;
    const meta: [string, string][] = [
      ['Report', 'Tax Management & Summary Report'],
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Generated At', new Date().toLocaleString()],
    ];

    if (activeTab === 'SERVICES') {
      const headers = [
        '#',
        'Date',
        'Time',
        'Service Name',
        'Staff',
        'Invoice #',
        'Client',
        'Service Charge',
        'Discount',
        'Taxable Base',
        'Rate %',
        'Tax Amount',
        'Total Bill',
      ];
      const rows = serviceRows.map((r, i) => [
        i + 1,
        formatDateDisplay(r.date),
        r.time || '—',
        r.serviceName,
        r.staffName || 'Staff',
        r.invoiceNumber,
        r.clientName || 'Walk-in',
        (r.unitPrice || 0).toFixed(2),
        (r.discount || 0).toFixed(2),
        r.taxableBase.toFixed(2),
        `${r.taxRate}%`,
        r.taxAmount.toFixed(2),
        r.total.toFixed(2),
      ]);
      downloadReportExcel('Tax_Services_Report', meta, [{ headers, rows }]);
    } else if (activeTab === 'SERVICE_SUMMARY') {
      const headers = [
        '#',
        'Service Name',
        'Category / Type',
        'Times Done (Qty)',
        'Total Taxable Sales',
        'Tax Rate %',
        'Total Tax Collected',
      ];
      const rows = serviceSummary.map((s, i) => [
        i + 1,
        s.serviceName,
        s.serviceType,
        s.count,
        s.taxableBase.toFixed(2),
        `${s.taxRate}%`,
        s.taxAmount.toFixed(2),
      ]);
      downloadReportExcel('Tax_Service_Summary', meta, [{ headers, rows }]);
    } else {
      const headers = [
        '#',
        'Date',
        'Invoice #',
        'Branch',
        'Client',
        'Taxable Base',
        'Rate %',
        'Tax Collected',
        'Total Bill',
        'Method',
        'Status',
      ];
      const rows = invoiceRows.map((r, i) => [
        i + 1,
        formatDateDisplay(r.date),
        r.reference,
        r.branchName || '—',
        r.clientName || 'Walk-in',
        r.taxableBase.toFixed(2),
        `${r.taxRate}%`,
        r.taxAmount.toFixed(2),
        r.total.toFixed(2),
        formatMethod(r.paymentMethod),
        r.status,
      ]);
      downloadReportExcel('Tax_Invoices_Report', meta, [{ headers, rows }]);
    }
  };

  const handleExportCsv = () => {
    if (!reportData) return;
    const meta: [string, string][] = [
      ['Report', 'Tax Management & Summary Report'],
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch],
      ['From Date', fromDate || reportData.meta.from || '—'],
      ['To Date', toDate || reportData.meta.to || '—'],
      ['Generated At', new Date().toLocaleString()],
    ];

    if (activeTab === 'SERVICES') {
      const headers = [
        '#',
        'Date',
        'Time',
        'Service Name',
        'Staff',
        'Invoice #',
        'Client',
        'Service Charge',
        'Discount',
        'Taxable Base',
        'Rate %',
        'Tax Amount',
        'Total Bill',
      ];
      const rows = serviceRows.map((r, i) => [
        i + 1,
        formatDateDisplay(r.date),
        r.time || '—',
        r.serviceName,
        r.staffName || 'Staff',
        r.invoiceNumber,
        r.clientName || 'Walk-in',
        (r.unitPrice || 0).toFixed(2),
        (r.discount || 0).toFixed(2),
        r.taxableBase.toFixed(2),
        `${r.taxRate}%`,
        r.taxAmount.toFixed(2),
        r.total.toFixed(2),
      ]);
      downloadReportCsv('Tax_Services_Report', meta, [{ headers, rows }]);
    } else {
      const headers = [
        '#',
        'Service Name',
        'Times Done',
        'Total Taxable Sales',
        'Tax Rate %',
        'Total Tax Collected',
      ];
      const rows = serviceSummary.map((s, i) => [
        i + 1,
        s.serviceName,
        s.count,
        s.taxableBase.toFixed(2),
        `${s.taxRate}%`,
        s.taxAmount.toFixed(2),
      ]);
      downloadReportCsv('Tax_Service_Summary', meta, [{ headers, rows }]);
    }
  };

  const handleExportPdf = () => {
    handlePrint();
  };

  const handlePrint = () => {
    if (!reportData) {
      window.print();
      return;
    }
    const meta: [string, string][] = [
      ['Report', 'Tax Management & Summary Report'],
      ['Branch', selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch],
      ['Period', `${formatDateDisplay(reportData.meta.from)} – ${formatDateDisplay(reportData.meta.to)}`],
      ['Total Taxable Sales', `PKR ${formatPKR(reportData.kpis.totalTaxableSales)}`],
      ['Gross Tax Collected', `PKR ${formatPKR(reportData.kpis.totalTaxCollected)}`],
      ['Tax Refunded', `PKR ${formatPKR(reportData.kpis.totalTaxRefunded)}`],
      ['Net Tax Liability', `PKR ${formatPKR(reportData.kpis.netTaxLiability)}`],
    ];

    if (activeTab === 'SERVICES') {
      const headers = [
        '#',
        'Date',
        'Service Name',
        'Staff',
        'Invoice #',
        'Client',
        'Price (PKR)',
        'Taxable (PKR)',
        'Rate %',
        'Tax (PKR)',
        'Total (PKR)',
      ];
      const rows = serviceRows.map((r, i) => [
        i + 1,
        formatDateDisplay(r.date),
        r.serviceName,
        r.staffName || '—',
        r.invoiceNumber,
        r.clientName || 'Walk-in',
        formatPKR(r.unitPrice),
        formatPKR(r.taxableBase),
        `${r.taxRate}%`,
        formatPKR(r.taxAmount),
        formatPKR(r.total),
      ]);
      printReportWindow({
        title: 'Tax Management Report — Service Breakdown',
        subtitle: `Branch: ${selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch}`,
        meta,
        headers,
        rows,
        totals: [
          'Total',
          '—',
          `${serviceRows.length} Services`,
          '—',
          '—',
          '—',
          '—',
          `PKR ${formatPKR(reportData.totals.taxableBase)}`,
          '—',
          `PKR ${formatPKR(reportData.totals.total ?? ((reportData.totals.taxableBase || 0) + (reportData.totals.taxAmount || 0)))}`,
        ],
      });
    } else {
      const headers = [
        '#',
        'Service Name',
        'Type',
        'Times Done',
        'Taxable Sales (PKR)',
        'Rate %',
        'Tax Collected (PKR)',
      ];
      const rows = serviceSummary.map((s, i) => [
        i + 1,
        s.serviceName,
        s.serviceType,
        s.count,
        formatPKR(s.taxableBase),
        `${s.taxRate}%`,
        formatPKR(s.taxAmount),
      ]);
      printReportWindow({
        title: 'Tax Management Report — Service Summary',
        subtitle: `Branch: ${selectedBranch === 'ALL' ? 'All Branches' : reportData.meta.branchName || selectedBranch}`,
        meta,
        headers,
        rows,
        totals: [
          'Total',
          '—',
          '—',
          '—',
          `PKR ${formatPKR(reportData.totals.taxableBase)}`,
          '—',
          `PKR ${formatPKR(reportData.totals.taxAmount)}`,
        ],
      });
    }
  };

  const availableBranches = useMemo(() => {
    if (!allBranches) return [];
    return allBranches;
  }, [allBranches]);

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800 font-['Inter',sans-serif]">
      {/* Top Header Card with Title & Filters (Exact Matching Income & Expense Report) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Tax Management Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Provincial & Federal Sales Tax (PST / SST) · Har service ke sath exact tax breakdown aur aakhir mein total collection
          </p>
        </div>

        {/* Filters Form Row */}
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 items-end">
          {/* Branch Filter */}
          <div>
            <label className={labelClass}>Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={!isSuperAdmin}
              className={selectClass}
            >
              {isSuperAdmin && <option value="ALL">All Branches</option>}
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search / Service */}
          <div>
            <label className={labelClass}>Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Service, Invoice #, Client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} pl-8`}
              />
            </div>
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

      {/* Main Content Area: NO CARDS ON TOP, full width table layout matching Income & Expense */}
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
          <p className="text-slate-600 text-sm font-medium">Loading Tax Management Reports...</p>
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
        /* Filtered Data Layout: Royal Blue Banner + Full Table + Integrated Footer */
        <div className="shadow-sm rounded-xl overflow-hidden border border-slate-200/90 mb-8 bg-white">
          {/* Royal Blue Banner Header (matching Income & Expense Report exactly) */}
          <div className="bg-[#0047AB] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 font-bold text-sm tracking-wide text-white">
                <Receipt className="w-4 h-4 stroke-[2.5]" />
                <span>Tax Management Reports</span>
              </div>

              {/* View Switcher Tabs inside the banner */}
              <div className="flex items-center bg-blue-900/60 p-0.5 rounded-lg border border-blue-400/30 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('SERVICES')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'SERVICES'
                      ? 'bg-white text-[#0047AB] font-bold shadow-xs'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  <Scissors className="w-3 h-3" />
                  <span>Service Breakdown ({serviceRows.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('SERVICE_SUMMARY')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'SERVICE_SUMMARY'
                      ? 'bg-white text-[#0047AB] font-bold shadow-xs'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Service Summary ({serviceSummary.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('INVOICES')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'INVOICES'
                      ? 'bg-white text-[#0047AB] font-bold shadow-xs'
                      : 'text-blue-100 hover:text-white'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Invoice Summary ({invoiceRows.length})</span>
                </button>
              </div>
            </div>

            {/* Export Buttons */}
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
                onClick={handleExportExcel}
                className="bg-[#059669] hover:bg-[#047857] active:bg-[#065F46] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
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

          {/* TAB 1: Service Breakdown (har service ke sath mein tax aa raha hoga) */}
          {activeTab === 'SERVICES' && (
            <div className="bg-white overflow-x-auto rounded-b-xl border-t border-blue-200/40">
              <table className="report-records w-full min-w-[1250px] text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4 text-center w-12 font-medium text-[#475569]">#</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Date & Time</th>
                    <th className="py-3.5 px-4 min-w-[190px] font-medium text-[#475569]">Service Performed</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Staff / Stylist</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Invoice #</th>
                    <th className="py-3.5 px-4 min-w-[160px] font-medium text-[#475569]">Client Name</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Service Price</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Discount</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Taxable Base</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#475569]">Rate %</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Tax Collected</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Total Bill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {serviceRows.length > 0 ? (
                    serviceRows.map((row, idx) => {
                      const dateParts = formatDateParts(row.date);
                      return (
                        <tr key={row.id || idx} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                          <td className="py-3.5 px-4 text-center text-slate-500 font-normal">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                            <div className="leading-tight">
                              <div>{dateParts.dayMonth}</div>
                              <div className="text-[12px] text-slate-400">{row.time || dateParts.year}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{row.serviceName}</span>
                              {row.quantity > 1 && (
                                <span className="text-[11px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                                  ×{row.quantity}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-normal">{row.serviceType}</div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                            {row.staffName || 'Staff'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-medium text-[#0047AB]">
                            {row.invoiceNumber}
                          </td>
                          <td className="py-3.5 px-4 text-slate-800">
                            {row.clientName || 'Walk-in Customer'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-700 whitespace-nowrap tabular-nums">
                            PKR {formatPKR(row.unitPrice)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-500 whitespace-nowrap tabular-nums">
                            {row.discount > 0 ? `PKR ${formatPKR(row.discount)}` : '0.00'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-900 whitespace-nowrap tabular-nums">
                            PKR {formatPKR(row.taxableBase)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {row.taxRate}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                            +PKR {formatPKR(row.taxAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                            PKR {formatPKR(row.total)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-16 text-center text-slate-400 font-medium">
                        No service tax transactions found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Integrated Table Footer (Matching Income & Expense Totals Structure) */}
                <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px]">
                  {/* Row 1: TOTALS (PKR) */}
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={6} className="py-3.5 px-4 text-right font-bold text-slate-800 tracking-wide">
                      TOTALS ({serviceRows.length} Services):
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-700 tabular-nums">
                      PKR {formatPKR(serviceRows.reduce((acc, r) => acc + (r.unitPrice || 0), 0))}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-500 tabular-nums">
                      PKR {formatPKR(serviceRows.reduce((acc, r) => acc + (r.discount || 0), 0))}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0047AB] tabular-nums">
                      PKR {formatPKR(reportData?.totals.taxableBase || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400">—</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 tabular-nums">
                      +PKR {formatPKR(reportData?.totals.taxAmount || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      PKR {formatPKR(reportData?.totals.total || 0)}
                    </td>
                  </tr>

                  {/* Row 2: Total Tax Collected */}
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={8} className="py-3 px-4 text-right font-medium text-slate-700">
                      Total Sales Tax Collected (Gross)
                    </td>
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-[13px] tabular-nums text-emerald-600">
                      +PKR {formatPKR(reportData?.kpis.totalTaxCollected || reportData?.totals.taxAmount || 0)}
                    </td>
                  </tr>

                  {/* Row 3: Tax Refunded / Reversed */}
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={8} className="py-3 px-4 text-right font-medium text-slate-700">
                      Tax Refunded / Reversed
                    </td>
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-[13px] tabular-nums text-amber-600">
                      -PKR {formatPKR(reportData?.kpis.totalTaxRefunded || 0)}
                    </td>
                  </tr>

                  {/* Row 4: Net Tax Liability */}
                  <tr>
                    <td colSpan={8} className="py-3 px-4 text-right font-bold text-slate-800">
                      Net Sales Tax Liability (Payable to Authority)
                    </td>
                    <td colSpan={4} className="py-3 px-4 text-right font-bold text-[13px] tabular-nums text-[#0047AB]">
                      PKR {formatPKR(reportData?.kpis.netTaxLiability || reportData?.totals.netTax || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* TAB 2: Service Summary (Grouped by service) */}
          {activeTab === 'SERVICE_SUMMARY' && (
            <div className="bg-white overflow-x-auto rounded-b-xl border-t border-blue-200/40">
              <table className="report-records w-full min-w-[950px] text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4 text-center w-12 font-medium text-[#475569]">#</th>
                    <th className="py-3.5 px-4 min-w-[220px] font-medium text-[#475569]">Service Name</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Category / Type</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#475569]">Times Billed</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Total Taxable Sales</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#475569]">Tax Rate %</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Total Tax Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {serviceSummary.length > 0 ? (
                    serviceSummary.map((s, idx) => (
                      <tr key={s.serviceName || idx} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        <td className="py-3.5 px-4 text-center text-slate-500 font-normal">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {s.serviceName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                            {s.serviceType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-[#0047AB]">
                          {s.count}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-900 whitespace-nowrap tabular-nums">
                          PKR {formatPKR(s.taxableBase)}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-slate-600">
                          {s.taxRate}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                          +PKR {formatPKR(s.taxAmount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                        No service summary data found.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px]">
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={4} className="py-3.5 px-4 text-right font-bold text-slate-800">
                      TOTALS ({serviceSummary.length} Unique Services):
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0047AB] tabular-nums">
                      PKR {formatPKR(reportData?.totals.taxableBase || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400">—</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 tabular-nums">
                      +PKR {formatPKR(reportData?.totals.taxAmount || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* TAB 3: Invoice Summary */}
          {activeTab === 'INVOICES' && (
            <div className="bg-white overflow-x-auto rounded-b-xl border-t border-blue-200/40">
              <table className="report-records w-full min-w-[1100px] text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4 text-center w-12 font-medium text-[#475569]">#</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Date & Time</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Invoice #</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Branch</th>
                    <th className="py-3.5 px-4 min-w-[180px] font-medium text-[#475569]">Client Name</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Taxable Base</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#475569]">Rate %</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Tax Collected</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap font-medium text-[#475569]">Total Invoice</th>
                    <th className="py-3.5 px-4 whitespace-nowrap font-medium text-[#475569]">Payment Method</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#475569]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {invoiceRows.length > 0 ? (
                    invoiceRows.map((row, idx) => {
                      const dateParts = formatDateParts(row.date);
                      return (
                        <tr key={row.id || idx} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                          <td className="py-3.5 px-4 text-center text-slate-500 font-normal">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                            <div className="leading-tight">
                              <div>{dateParts.dayMonth}</div>
                              <div className="text-[12px] text-slate-400">{row.time || dateParts.year}</div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-medium text-[#0047AB]">
                            {row.reference}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                            {row.branchName || 'Branch'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-800">
                            {row.clientName || 'Walk-in Customer'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-900 whitespace-nowrap tabular-nums">
                            PKR {formatPKR(row.taxableBase)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {row.taxRate}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap tabular-nums">
                            +PKR {formatPKR(row.taxAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                            PKR {formatPKR(row.total)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                            {formatMethod(row.paymentMethod)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400 font-medium">
                        No invoice tax transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>

                <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px]">
                  <tr className="border-b border-slate-200/70">
                    <td colSpan={5} className="py-3.5 px-4 text-right font-bold text-slate-800">
                      TOTALS ({invoiceRows.length} Invoices):
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0047AB] tabular-nums">
                      PKR {formatPKR(reportData?.totals.taxableBase || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400">—</td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 tabular-nums">
                      +PKR {formatPKR(reportData?.totals.taxAmount || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      PKR {formatPKR(reportData?.totals.total || 0)}
                    </td>
                    <td colSpan={2} className="py-3.5 px-4 text-slate-600">
                      Net Liability: <span className="text-[#0047AB] font-bold">PKR {formatPKR(reportData?.totals.netTax || 0)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaxReportPage;
