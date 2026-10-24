import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  AttendanceOvertimeReport,
  AttendanceOvertimeReportRow,
  AttendanceOvertimeReportQuery,
  StaffMember,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  Clock,
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

export const AttendanceOvertimeReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin and Admin only (Accountants denied confidential HR data)
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/reports/attendance" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const businessDate = demoDate || new Date().toISOString().slice(0, 10);
  const defaultMonth = resolvePreset('THIS_MONTH', businessDate)!;

  // Filter Form State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedOtStatus, setSelectedOtStatus] = useState<string>('ALL');
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState<string>(defaultMonth.from);
  const [customTo, setCustomTo] = useState<string>(defaultMonth.to);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<AttendanceOvertimeReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load staff list for filter
  useEffect(() => {
    salonService
      .getStaff(selectedBranch || 'ALL')
      .then(setStaffList)
      .catch(() => setStaffList([]));
  }, [selectedBranch]);

  const handlePresetChange = (p: DatePreset) => {
    setSelectedPreset(p);
    const r = resolvePreset(p, businessDate);
    if (r) {
      setCustomFrom(r.from);
      setCustomTo(r.to);
    }
  };

  const branchNameDisplay = useMemo(() => {
    if (selectedBranch === 'ALL') return 'All Campuses';
    return (
      allBranches?.find((b) => b.id === selectedBranch)?.name ||
      reportData?.meta.branchName ||
      selectedBranch
    );
  }, [selectedBranch, allBranches, reportData]);

  // Fetch report data on demand from backend API
  const fetchReport = useCallback(
    async (q: AttendanceOvertimeReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getAttendanceOvertimeReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load Attendance & Overtime report:', err);
        setErrorMessage(
          err.message || 'Failed to fetch live attendance report from server.'
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

    const query: AttendanceOvertimeReportQuery = {
      branchId: selectedBranch,
      staffId: selectedStaffId,
      status: selectedStatus,
      otStatus: selectedOtStatus,
      preset: selectedPreset,
      from: customFrom || undefined,
      to: customTo || undefined,
      search: searchQuery.trim() || undefined,
    };

    fetchReport(query);
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Attendance & Overtime Reports'],
      ['Campus', branchNameDisplay],
      ['From Date', customFrom || reportData.meta.from || '—'],
      ['To Date', customTo || reportData.meta.to || '—'],
      ['Generated By', user.name],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      'Date',
      'Staff Name',
      'Code',
      'Designation',
      'Campus',
      'Shift',
      'Check-In',
      'Check-Out',
      'Scheduled Hours',
      'Worked Hours',
      'Late Minutes',
      'Early Exit Minutes',
      'Status',
      'OT Hours',
      'OT Amount (PKR)',
      'OT Status',
      'Approved By',
      'Notes',
    ];

    const rows = [
      ...reportData.rows.map((r) => [
        r.date,
        r.staffName,
        r.employeeCode,
        r.designation,
        r.branchName,
        r.shift,
        r.checkIn,
        r.checkOut,
        r.scheduledHours,
        r.workedHours,
        r.lateMinutes,
        r.earlyExitMinutes,
        r.status,
        r.otHours,
        r.otAmount.toFixed(2),
        r.otStatus,
        r.otApprovedBy,
        r.notes || r.otReason,
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
        reportData.totals.scheduledHours.toFixed(1),
        reportData.totals.workedHours.toFixed(1),
        '',
        '',
        '',
        reportData.totals.otHours.toFixed(1),
        reportData.totals.otAmount.toFixed(2),
        '',
        '',
        '',
      ],
    ];

    downloadReportExcel(`Attendance_Report_${customFrom}_${customTo}.csv`, meta, [
      { title: 'Attendance & Overtime Records', headers, rows },
    ]);
  };

  const handleExportCsv = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Attendance & Overtime Reports'],
      ['Campus', branchNameDisplay],
      ['Date Range', `${customFrom} to ${customTo}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      'Date',
      'Staff Name',
      'Code',
      'Designation',
      'Campus',
      'Shift',
      'Check-In',
      'Check-Out',
      'Scheduled Hours',
      'Worked Hours',
      'Late Minutes',
      'Early Exit Minutes',
      'Status',
      'OT Hours',
      'OT Amount (PKR)',
      'OT Status',
      'Approved By',
      'Notes',
    ];

    const rows = [
      ...reportData.rows.map((r) => [
        r.date,
        r.staffName,
        r.employeeCode,
        r.designation,
        r.branchName,
        r.shift,
        r.checkIn,
        r.checkOut,
        r.scheduledHours,
        r.workedHours,
        r.lateMinutes,
        r.earlyExitMinutes,
        r.status,
        r.otHours,
        r.otAmount.toFixed(2),
        r.otStatus,
        r.otApprovedBy,
        r.notes || r.otReason,
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
        reportData.totals.scheduledHours.toFixed(1),
        reportData.totals.workedHours.toFixed(1),
        '',
        '',
        '',
        reportData.totals.otHours.toFixed(1),
        reportData.totals.otAmount.toFixed(2),
        '',
        '',
        '',
      ],
    ];

    downloadReportCsv(`Attendance_Report_${customFrom}_${customTo}.csv`, meta, [
      { title: 'Attendance Records', headers, rows },
    ]);
  };

  const handlePrint = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Campus', branchNameDisplay],
      ['Date Range', `${customFrom} to ${customTo}`],
      ['Generated By', user.name],
    ];

    const headers = [
      'Date',
      'Staff Name',
      'Campus',
      'Shift',
      'In / Out',
      'Sched.',
      'Worked',
      'Late/Early',
      'Status',
      'OT Hours',
      'OT Amount',
    ];

    const rows = reportData.rows.map((r) => [
      r.date,
      `${r.staffName} (${r.employeeCode})`,
      r.branchName,
      r.shift,
      `${r.checkIn} - ${r.checkOut}`,
      `${r.scheduledHours}h`,
      `${r.workedHours}h`,
      r.lateMinutes > 0 ? `${r.lateMinutes}m late` : 'On time',
      r.status,
      `${r.otHours}h`,
      formatPKR(r.otAmount),
    ]);

    const footers = [
      'TOTALS',
      '',
      '',
      '',
      '',
      `${reportData.totals.scheduledHours.toFixed(1)}h`,
      `${reportData.totals.workedHours.toFixed(1)}h`,
      '',
      '',
      `${reportData.totals.otHours.toFixed(1)}h`,
      formatPKR(reportData.totals.otAmount),
    ];

    printReportWindow({
      title: 'Staff Attendance & Overtime Report',
      subtitle: `Working Hours, Overtime Audits & Shift Compliance`,
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
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Staff Attendance & Overtime Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit of staff attendance, working hours, punctuality, and overtime costs across campuses.
          </p>
        </div>

        {/* Filters Form Row */}
        <form onSubmit={handleApplyFilters} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Campus / Branch */}
            <div>
              <label className={labelClass}>Campus</label>
              <select
                className={selectClass}
                value={selectedBranch}
                disabled={!isSuperAdmin}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setSelectedStaffId('ALL');
                }}
              >
                {isSuperAdmin && <option value="ALL">All Campuses</option>}
                {allBranches?.map((b) => (
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

            {/* Attendance Status */}
            <div>
              <label className={labelClass}>Attendance Status</label>
              <select
                className={selectClass}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="PAID_LEAVE">Paid Leave</option>
                <option value="UNPAID_LEAVE">Unpaid Leave</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="MISSING_PUNCH">Missing Punch</option>
                <option value="OFF_DAY">Off Day</option>
                <option value="HOLIDAY">Holiday</option>
              </select>
            </div>

            {/* OT Status */}
            <div>
              <label className={labelClass}>OT Status</label>
              <select
                className={selectClass}
                value={selectedOtStatus}
                onChange={(e) => setSelectedOtStatus(e.target.value)}
              >
                <option value="ALL">All OT Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="SUBMITTED">Pending Review</option>
                <option value="REJECTED">Rejected</option>
                <option value="NONE">No Overtime</option>
              </select>
            </div>

            {/* Date Preset */}
            <div>
              <label className={labelClass}>Date Preset</label>
              <select
                className={selectClass}
                value={selectedPreset}
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
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => {
                  setCustomFrom(e.target.value);
                  setSelectedPreset('CUSTOM');
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
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => {
                  setCustomTo(e.target.value);
                  setSelectedPreset('CUSTOM');
                }}
              />
            </div>

            {/* Search Query */}
            <div className="md:col-span-4">
              <label className={labelClass}>Search</label>
              <input
                type="text"
                placeholder="Search staff, code, shift, designation..."
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
          <p className="text-slate-600 text-sm font-medium">Loading Attendance & Overtime Reports...</p>
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
              <Clock className="w-4 h-4 stroke-[2.5]" />
              <span>Staff Attendance & Overtime Reports ({reportData?.rows.length ?? 0} records)</span>
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
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Campus</th>
                  <th className="py-3.5 px-4">Shift</th>
                  <th className="py-3.5 px-4">In / Out</th>
                  <th className="py-3.5 px-4 text-right">Sched.</th>
                  <th className="py-3.5 px-4 text-right">Worked</th>
                  <th className="py-3.5 px-4">Late / Early</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Overtime</th>
                  <th className="py-3.5 px-4 text-right">OT Amount</th>
                  <th className="py-3.5 px-4">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                {!reportData || reportData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      No attendance and overtime records found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  reportData.rows.map((r, i) => (
                    <tr key={`${r.date}-${r.staffId}-${i}`} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                      <td className="py-3.5 px-4 font-semibold text-[#0B2545] whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{r.staffName}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.employeeCode} • {r.designation}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {r.branchName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-[12px]">
                        {r.shift}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-[12px]">
                        <span className="text-[#0B2545] font-semibold">{r.checkIn}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="text-slate-700">{r.checkOut}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 whitespace-nowrap font-medium">
                        {r.scheduledHours}h
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#0B2545] whitespace-nowrap">
                        {r.workedHours}h
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-[12px]">
                        {r.lateMinutes > 0 ? (
                          <span className="text-[#0047AB] font-semibold">{r.lateMinutes}m late</span>
                        ) : r.earlyExitMinutes > 0 ? (
                          <span className="text-slate-600 font-semibold">{r.earlyExitMinutes}m early</span>
                        ) : (
                          <span className="text-slate-500">On time</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0047AB] border border-blue-200">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {r.otHours > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-[#0B2545]">
                            {r.otHours.toFixed(1)}h {r.otStatus}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[#0047AB] whitespace-nowrap">
                        {r.otAmount > 0 ? formatPKR(r.otAmount) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[12px]">
                        {r.otApprovedBy || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {reportData && reportData.rows.length > 0 && (
                <tfoot className="bg-[#F8FAFC] font-bold text-[#0B2545] border-t-2 border-slate-200 text-[13px]">
                  <tr>
                    <td className="py-3.5 px-4 text-left">Totals</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4">{reportData.rows.length} Records</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4 text-right">
                      {reportData.totals.scheduledHours.toFixed(1)}h
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#0B2545]">
                      {reportData.totals.workedHours.toFixed(1)}h
                    </td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4">—</td>
                    <td className="py-3.5 px-4 text-center text-[#0047AB]">
                      {reportData.totals.otHours.toFixed(1)}h
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#0047AB]">
                      {formatPKR(reportData.totals.otAmount)}
                    </td>
                    <td className="py-3.5 px-4">—</td>
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
