import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ReportKpis } from './components/ReportKpis';
import { salonService } from '@/services';
import { Branch, StaffMember, StaffSalaryReport, StaffSalaryReportQuery } from '@/types/salon';
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
  Banknote,
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

export const StaffSalaryReportPage: React.FC = () => {
  const { user, demoDate } = useAuth();

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/reports/staff-salary" />;
  }

  const thisMonth = (demoDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const yearStart = `${thisMonth.slice(0, 4)}-01`;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Filter Form State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isSuperAdmin ? (user.branchId || 'ALL') : (user.branchId || '')
  );
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [fromMonth, setFromMonth] = useState<string>(yearStart);
  const [toMonth, setToMonth] = useState<string>(thisMonth);

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<StaffSalaryReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    salonService.getBranches().then(setBranches).catch(() => undefined);
  }, []);

  useEffect(() => {
    salonService.getStaff(selectedBranch || 'ALL').then(setStaffList).catch(() => setStaffList([]));
  }, [selectedBranch]);

  // Fetch report data on demand from backend API
  const fetchReport = useCallback(
    async (q: StaffSalaryReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getStaffSalaryReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load Staff Salary report:', err);
        setErrorMessage(err.message || 'Failed to fetch live staff salary report from server.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);

    const query: StaffSalaryReportQuery = {
      branchId: selectedBranch,
      fromMonth,
      toMonth,
      staffId: selectedStaff !== 'ALL' ? selectedStaff : undefined,
      paymentStatus: paymentStatus !== 'ALL' ? (paymentStatus as any) : undefined,
    };

    fetchReport(query);
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Salary Report'],
      ['Campus', selectedBranch === 'ALL' ? 'All Campuses' : branches.find((b) => b.id === selectedBranch)?.name || selectedBranch],
      ['Payroll Period', `${fromMonth} to ${toMonth}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Period',
      'Payslip #',
      'Staff',
      'Code',
      'Campus',
      'Basic',
      'Gross',
      'Net Salary',
      'Paid',
      'Outstanding',
      'Status',
    ];

    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.period,
      r.payslipNumber,
      r.staffName,
      r.employeeCode,
      r.branchName,
      r.basic.toFixed(2),
      r.gross.toFixed(2),
      r.net.toFixed(2),
      r.paid.toFixed(2),
      r.outstanding.toFixed(2),
      r.status,
    ]);

    downloadReportExcel('Staff_Salary_Report', meta, [{ headers, rows }]);
  };

  const handleExportPdf = () => {
    if (!reportData || !reportData.rows.length) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Salary Report'],
      ['Campus', selectedBranch === 'ALL' ? 'All Campuses' : branches.find((b) => b.id === selectedBranch)?.name || selectedBranch],
      ['Payroll Period', `${fromMonth} to ${toMonth}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Period',
      'Payslip #',
      'Staff',
      'Code',
      'Campus',
      'Basic',
      'Gross',
      'Net Salary',
      'Paid',
      'Outstanding',
      'Status',
    ];

    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.period,
      r.payslipNumber,
      r.staffName,
      r.employeeCode,
      r.branchName,
      r.basic.toFixed(2),
      r.gross.toFixed(2),
      r.net.toFixed(2),
      r.paid.toFixed(2),
      r.outstanding.toFixed(2),
      r.status,
    ]);

    downloadReportCsv('Staff_Salary_Report', meta, [{ headers, rows }]);
  };

  const handlePrint = () => {
    if (!reportData || !reportData.rows.length) {
      window.print();
      return;
    }
    const meta: [string, string][] = [
      ['Campus', selectedBranch === 'ALL' ? 'All Campuses' : branches.find((b) => b.id === selectedBranch)?.name || selectedBranch],
      ['Payroll Period', `${fromMonth} to ${toMonth}`],
      ['Total Gross', formatPKR(reportData.totals.gross)],
      ['Total Net Salary', formatPKR(reportData.totals.net)],
      ['Total Paid', formatPKR(reportData.totals.paid)],
    ];
    const headers = ['#', 'Period', 'Payslip #', 'Staff', 'Campus', 'Gross', 'Net', 'Paid', 'Outstanding', 'Status'];
    const rows = reportData.rows.map((r, i) => [
      i + 1,
      r.period,
      r.payslipNumber,
      r.staffName,
      r.branchName,
      formatPKR(r.gross),
      formatPKR(r.net),
      formatPKR(r.paid),
      formatPKR(r.outstanding),
      r.status,
    ]);

    printReportWindow({
      title: 'Staff Salary Report',
      meta,
      headers,
      rows,
    });
  };

  const totals = reportData?.totals || {
    basic: 0,
    attendance: 0,
    overtime: 0,
    allowances: 0,
    deductions: 0,
    advanceRecovery: 0,
    gross: 0,
    net: 0,
    paid: 0,
    outstanding: 0,
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800">
      {/* Top Header Card with Title & Filters */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Staff Salary Reports</h1>
          <p className="text-xs text-slate-500 mt-1">
            Finalized staff remuneration payroll audit: basic wages, attendance penalties, overtime additions, allowances, gross earnings, net pay and payouts
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
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          <div>
            <label className={labelClass}>Staff Member</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.employeeCode})
                </option>
              ))}
            </select>
          </div>

          {/* From Month */}
          <div>
            <label className={labelClass}>From Month</label>
            <input
              type="month"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* To Month */}
          <div>
            <label className={labelClass}>To Month</label>
            <input
              type="month"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Payment Status */}
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="FINALIZED">Finalized</option>
            </select>
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
          <p className="text-slate-600 text-sm font-medium">Loading Staff Salary Reports...</p>
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
          <ReportKpis items={[
            { label: 'Gross Salary', value: `PKR ${formatPKR(totals.gross)}` },
            { label: 'Net Salary', value: `PKR ${formatPKR(totals.net)}` },
            { label: 'Paid', value: `PKR ${formatPKR(totals.paid)}`, tone: 'positive' },
            { label: 'Outstanding', value: `PKR ${formatPKR(totals.outstanding)}`, tone: 'negative' },
          ]} />
          {/* Royal Blue Banner Header */}
          <div className="bg-[#0047AB] text-white px-5 py-3 rounded-t-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Banknote className="w-5 h-5 text-white/90" />
              <span className="font-semibold text-sm tracking-wide">Staff Salary Register</span>
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
                  <th className="py-3.5 px-4 whitespace-nowrap">Period</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Payslip #</th>
                  <th className="py-3.5 px-4">Staff</th>
                  <th className="py-3.5 px-4">Campus</th>
                  <th className="py-3.5 px-4 text-right">Basic</th>
                  <th className="py-3.5 px-4 text-right">Gross</th>
                  <th className="py-3.5 px-4 text-right">Net Salary</th>
                  <th className="py-3.5 px-4 text-right">Paid</th>
                  <th className="py-3.5 px-4 text-right">Outstanding</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-[#334155]">
                {reportData && reportData.rows.length > 0 ? (
                  reportData.rows.map((row, idx) => {
                    const isPaid = row.status === 'PAID';

                    return (
                      <tr key={row.payslipId || idx} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        {/* 1. # */}
                        <td className="py-3.5 px-3 text-center font-normal text-slate-400">
                          {idx + 1}
                        </td>

                        {/* 2. Period */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                          {row.period}
                        </td>

                        {/* 3. Payslip # */}
                        <td className="py-3.5 px-4 font-semibold text-[#0047AB] whitespace-nowrap">
                          {row.payslipNumber}
                        </td>

                        {/* 4. Staff */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                          {row.staffName} <span className="text-slate-400 font-normal">({row.employeeCode})</span>
                        </td>

                        {/* 5. Campus */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {row.branchName || 'Main Campus'}
                        </td>

                        {/* 6. Basic */}
                        <td className="py-3.5 px-4 text-right tabular-nums text-slate-600 whitespace-nowrap">
                          {formatPKR(row.basic)}
                        </td>

                        {/* 7. Gross */}
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                          {formatPKR(row.gross)}
                        </td>

                        {/* 8. Net Salary */}
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#0047AB] whitespace-nowrap">
                          {formatPKR(row.net)}
                        </td>

                        {/* 9. Paid */}
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#10B981] whitespace-nowrap">
                          {formatPKR(row.paid)}
                        </td>

                        {/* 10. Outstanding */}
                        <td
                          className={`py-3.5 px-4 text-right tabular-nums whitespace-nowrap ${
                            row.outstanding > 0 ? 'text-[#EF4444] font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {formatPKR(row.outstanding)}
                        </td>

                        {/* 11. Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isPaid ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981] text-white shadow-2xs">
                              PAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B] text-white shadow-2xs">
                              {row.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                      No salary records found for the selected campus, dates, and filters.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Integrated Table Footer */}
              <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px] text-[#334155]">
                {/* Row 1: TOTALS (PKR) */}
                <tr className="border-b border-slate-200/70">
                  <td colSpan={5} className="py-3.5 px-4 text-right font-bold text-slate-800 tracking-wide">
                    TOTAL SALARIES (PKR)
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-700">
                    {formatPKR(totals.basic)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-slate-800">
                    {formatPKR(totals.gross)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#0047AB]">
                    {formatPKR(totals.net)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#10B981]">
                    {formatPKR(totals.paid)}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#EF4444]">
                    {formatPKR(totals.outstanding)}
                  </td>
                  <td className="py-3.5 px-4"></td>
                </tr>

                {/* Row 2: Net Disbursed */}
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-right font-medium text-slate-600">
                    Net Paid Salary Disbursements
                  </td>
                  <td colSpan={6} className="py-3 px-4 text-right tabular-nums font-bold text-[#0047AB] text-sm">
                    +{formatPKR(totals.paid)}
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

export default StaffSalaryReportPage;
