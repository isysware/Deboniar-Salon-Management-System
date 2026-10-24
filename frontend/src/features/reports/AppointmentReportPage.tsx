import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import {
  AppointmentBillingStatus,
  AppointmentReportRecord,
  AppointmentReportSummary,
  AppointmentStatus,
  Branch,
  CustomerSource,
  StaffMember,
} from '@/types/salon';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  ExternalLink,
  CalendarCheck,
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

export const AppointmentReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();
  const { navigate } = useRouter();

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/reports/appointments" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const businessDate = demoDate || new Date().toISOString().slice(0, 10);
  const defaultMonth = resolvePreset('THIS_MONTH', businessDate)!;

  // Filter Form State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBillingStatus, setSelectedBillingStatus] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>(defaultMonth.from);
  const [endDate, setEndDate] = useState<string>(defaultMonth.to);

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [records, setRecords] = useState<AppointmentReportRecord[]>([]);
  const [summary, setSummary] = useState<AppointmentReportSummary>({
    totalAppointments: 0,
    pendingCount: 0,
    confirmedCount: 0,
    checkedInCount: 0,
    inServiceCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    noShowCount: 0,
    billedCount: 0,
    unbilledCount: 0,
    totalQuotedValue: 0,
    totalActualNetSales: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load auxiliary branches and staff
  useEffect(() => {
    if (allBranches && allBranches.length > 0) {
      setBranches(allBranches);
    } else {
      salonService.getBranches().then(setBranches).catch(() => undefined);
    }
  }, [allBranches]);

  useEffect(() => {
    salonService
      .getStaff(selectedBranchId || 'ALL')
      .then(setStaffList)
      .catch(() => setStaffList([]));
  }, [selectedBranchId]);

  const handlePresetChange = (p: DatePreset) => {
    setPreset(p);
    const r = resolvePreset(p, businessDate);
    if (r) {
      setStartDate(r.from);
      setEndDate(r.to);
    }
  };

  const branchNameDisplay = useMemo(() => {
    if (selectedBranchId === 'ALL') return 'All Campuses';
    return branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId;
  }, [selectedBranchId, branches]);

  // Fetch report data on demand from backend API
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await salonService.getAppointmentReport(
        selectedBranchId,
        startDate,
        endDate,
        {
          status: selectedStatus !== 'ALL' ? (selectedStatus as AppointmentStatus) : undefined,
          billingStatus:
            selectedBillingStatus !== 'ALL'
              ? (selectedBillingStatus as AppointmentBillingStatus)
              : undefined,
          staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
          customerSource: selectedSource !== 'ALL' ? (selectedSource as CustomerSource) : undefined,
          search: searchQuery.trim() || undefined,
        },
        user || undefined
      );

      setRecords(data.records);
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Failed to load Appointment report:', err);
      setErrorMessage(
        err.message || 'Failed to fetch live appointment report from server.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedBranchId,
    startDate,
    endDate,
    selectedStatus,
    selectedBillingStatus,
    selectedStaffId,
    selectedSource,
    searchQuery,
    user,
  ]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);
    fetchReport();
  };

  // Export Handlers
  const handleExportExcel = () => {
    if (!records.length) return;
    const meta: [string, string][] = [
      ['Report', 'Appointment Audit Reports'],
      ['Campus', branchNameDisplay],
      ['From Date', startDate || '—'],
      ['To Date', endDate || '—'],
      ['Status Filter', selectedStatus],
      ['Generated By', user.name],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      'Ref #',
      'Scheduled Date',
      'Time',
      'Customer Name',
      'Phone',
      'Campus',
      'Services / Packages',
      'Staff',
      'Status',
      'Billing Status',
      'Quoted Value (PKR)',
      'Linked Invoice #',
      'Invoice Net Sales (PKR)',
      'Invoice Status',
    ];

    const rows = [
      ...records.map((r) => [
        r.appointmentNumber || r.id,
        r.date,
        r.startTime,
        r.clientName,
        r.clientPhone,
        r.branchName || r.branchId,
        r.serviceSummary,
        r.staffSummary,
        r.status,
        r.billingStatus,
        r.quotedPrice.toFixed(2),
        r.linkedInvoiceNumber || '—',
        (r.actualNetSales || 0).toFixed(2),
        r.invoicePaymentStatus || '—',
      ]),
      [
        'TOTALS',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        summary.totalQuotedValue.toFixed(2),
        '',
        summary.totalActualNetSales.toFixed(2),
        '',
      ],
    ];

    downloadReportExcel(`Appointments_Report_${startDate}_${endDate}.csv`, meta, [
      { title: 'Appointment Records', headers, rows },
    ]);
  };

  const handleExportCsv = () => {
    if (!records.length) return;
    const meta: [string, string][] = [
      ['Report', 'Appointment Audit Reports'],
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      'Ref #',
      'Scheduled Date',
      'Time',
      'Customer Name',
      'Phone',
      'Campus',
      'Services / Packages',
      'Staff',
      'Status',
      'Billing Status',
      'Quoted Value (PKR)',
      'Linked Invoice #',
      'Invoice Net Sales (PKR)',
      'Invoice Status',
    ];

    const rows = [
      ...records.map((r) => [
        r.appointmentNumber || r.id,
        r.date,
        r.startTime,
        r.clientName,
        r.clientPhone,
        r.branchName || r.branchId,
        r.serviceSummary,
        r.staffSummary,
        r.status,
        r.billingStatus,
        r.quotedPrice.toFixed(2),
        r.linkedInvoiceNumber || '—',
        (r.actualNetSales || 0).toFixed(2),
        r.invoicePaymentStatus || '—',
      ]),
      [
        'TOTALS',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        summary.totalQuotedValue.toFixed(2),
        '',
        summary.totalActualNetSales.toFixed(2),
        '',
      ],
    ];

    downloadReportCsv(`Appointments_Report_${startDate}_${endDate}.csv`, meta, [
      { title: 'Appointment Records', headers, rows },
    ]);
  };

  const handlePrint = () => {
    if (!records.length) return;
    const meta: [string, string][] = [
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Generated By', user.name],
    ];

    const headers = [
      'Date',
      'Ref #',
      'Customer',
      'Campus',
      'Services & Staff',
      'Quoted Value',
      'Status',
      'Billing',
      'Invoice #',
      'Invoice Net',
    ];

    const rows = records.map((r) => [
      r.date,
      r.appointmentNumber || r.id.slice(-6),
      r.clientName,
      r.branchName || r.branchId,
      r.serviceSummary,
      formatPKR(r.quotedPrice),
      r.status,
      r.billingStatus,
      r.linkedInvoiceNumber || '—',
      formatPKR(r.actualNetSales || 0),
    ]);

    const footers = [
      'TOTALS',
      '',
      '',
      '',
      '',
      formatPKR(summary.totalQuotedValue),
      '',
      '',
      '',
      formatPKR(summary.totalActualNetSales),
    ];

    printReportWindow({
      title: 'Appointment Audit Report',
      subtitle: `Scheduled Reservation Audits & Revenue Conversion`,
      meta,
      headers,
      rows,
      totals: footers,
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800">
      {/* Top Header Card with Title & Filters */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Appointment Audit Reports</h1>
            <p className="text-xs text-slate-500 mt-1">
              Audit of scheduled reservations, status velocity, estimated booking values & actual POS conversions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/operations/appointments')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Go to Operational Calendar
          </button>
        </div>

        {/* Filters Form Row */}
        <form onSubmit={handleApplyFilters} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Campus / Branch */}
            <div>
              <label className={labelClass}>Campus</label>
              <select
                className={selectClass}
                value={selectedBranchId}
                disabled={!isSuperAdmin}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedStaffId('ALL');
                }}
              >
                {isSuperAdmin && <option value="ALL">All Campuses</option>}
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

            {/* Status */}
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={selectClass}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="IN_SERVICE">In Service</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No-Show</option>
              </select>
            </div>

            {/* Billing State */}
            <div>
              <label className={labelClass}>Billing State</label>
              <select
                className={selectClass}
                value={selectedBillingStatus}
                onChange={(e) => setSelectedBillingStatus(e.target.value)}
              >
                <option value="ALL">All Billing States</option>
                <option value="BILLED">Billed</option>
                <option value="UNBILLED">Unbilled</option>
              </select>
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
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5 items-end">
            {/* To Date */}
            <div>
              <label className={labelClass}>To Date</label>
              <input
                type="date"
                className={inputClass}
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>

            {/* Search Query */}
            <div className="md:col-span-4">
              <label className={labelClass}>Search</label>
              <input
                type="text"
                placeholder="Search ref #, customer, phone, stylist..."
                className={inputClass}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          <p className="text-slate-600 text-sm font-medium">Loading Appointment Reports...</p>
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
        <div className="shadow-sm rounded-xl overflow-hidden border border-slate-200/90 mb-8 bg-white">
          {/* Royal Blue Banner Header */}
          <div className="bg-[#0047AB] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
            <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
              <CalendarCheck className="w-4 h-4 stroke-[2.5]" />
              <span>Appointment Audit Reports ({records.length} records)</span>
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
                onClick={handleExportExcel}
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

          {/* Table Container */}
          <div className="bg-white overflow-x-auto rounded-b-xl border-t border-blue-200/40">
            <table className="report-records w-full text-left border-collapse min-w-[1100px] font-['Inter',sans-serif] text-[13px] antialiased">
              <thead>
                <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                  <th className="py-3.5 px-4">Scheduled Date</th>
                  <th className="py-3.5 px-4">Ref #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Campus</th>
                  <th className="py-3.5 px-4">Services & Staff</th>
                  <th className="py-3.5 px-4 text-right">Quoted Value</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Billing State</th>
                  <th className="py-3.5 px-4">Linked Invoice</th>
                  <th className="py-3.5 px-4 text-right">Invoice Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No appointments found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                      <td className="py-3.5 px-4 font-semibold text-[#0B2545] whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[12px] text-slate-600 whitespace-nowrap">
                        {r.appointmentNumber || r.id.slice(-6)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{r.clientName}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatPhoneNumber(r.clientPhone)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {r.branchName || r.branchId}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-slate-800 truncate" title={r.serviceSummary}>
                          {r.serviceSummary}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={r.staffSummary}>
                          Stylists: {r.staffSummary}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatPKR(r.quotedPrice)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0047AB] border border-blue-200">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.billingStatus === 'BILLED'
                              ? 'bg-blue-100 text-[#0B2545]'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.billingStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[12px] text-slate-600 whitespace-nowrap">
                        {r.linkedInvoiceNumber || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#0B2545] whitespace-nowrap">
                        {formatPKR(r.actualNetSales || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {records.length > 0 && (
                <tfoot className="bg-[#F8FAFC] font-bold text-[#0B2545] border-t-2 border-slate-200 text-[13px]">
                  <tr>
                    <td className="py-3.5 px-4 text-left">Totals</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4">{records.length} Appointments</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4 text-right text-[#0047AB]">
                      {formatPKR(summary.totalQuotedValue)}
                    </td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4 text-right text-[#0B2545]">
                      {formatPKR(summary.totalActualNetSales)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
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
