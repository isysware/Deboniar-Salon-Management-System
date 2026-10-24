import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  OperatingProfitReport,
  OperatingProfitStatementRow,
  OperatingProfitDetailRow,
  OperatingProfitReportQuery,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import {
  DATE_PRESETS,
  DatePreset,
  downloadReportCsv,
  formatSignedPKR,
  printReportWindow,
  resolvePreset,
} from './reportUtils';

const selectClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const inputClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const labelClass = 'block text-[11px] font-semibold text-[#0B2545] mb-1.5';

const formatPKR = formatSignedPKR;

export const COGSReportPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/reports/operating-profit" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const businessDate = demoDate || new Date().toISOString().slice(0, 10);
  const defaultMonth = resolvePreset('THIS_MONTH', businessDate)!;

  // Filter Form State
  const [selectedBranch, setSelectedBranch] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState<string>(defaultMonth.from);
  const [customTo, setCustomTo] = useState<string>(defaultMonth.to);
  const [activeTab, setActiveTab] = useState<'STATEMENT' | 'DETAILED'>('STATEMENT');

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<OperatingProfitReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Fetch report data from live backend API (100% Real DB)
  const fetchReport = useCallback(
    async (q: OperatingProfitReportQuery) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await salonService.getOperatingProfitReport(q);
        setReportData(data);
      } catch (err: any) {
        console.error('Failed to load Operating Profit report:', err);
        setErrorMessage(
          err.message || 'Failed to fetch live operating profit report from server.'
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

    const query: OperatingProfitReportQuery = {
      branchId: selectedBranch,
      preset: selectedPreset,
      startDate: customFrom || undefined,
      endDate: customTo || undefined,
      from: customFrom || undefined,
      to: customTo || undefined,
    };

    fetchReport(query);
  };

  // Export handlers
  const exportHeaders = [
    'Account / Line Item',
    'Classification',
    'Department / Category',
    'Current Period (PKR)',
    '% of Net Revenue',
    'Prior Period (PKR)',
    'Variance (PKR)',
    'Growth (%)',
    'Notes / Details',
  ];

  const exportRows = useMemo(() => {
    if (!reportData?.rows) return [];
    return reportData.rows.map((r) => [
      r.accountName,
      r.classification,
      r.department,
      r.currentAmount.toFixed(2),
      `${r.percentOfRevenue}%`,
      r.priorAmount.toFixed(2),
      r.varianceAmount.toFixed(2),
      r.growthPercent !== null ? `${r.growthPercent}%` : 'N/A',
      r.notes,
    ]);
  }, [reportData]);

  const exportMeta: [string, string][] = useMemo(() => {
    const meta = reportData?.meta;
    return [
      ['Report', 'Operating Profit & P&L Statement'],
      ['Campus', branchNameDisplay],
      ['Current Period', `${customFrom || meta?.from || ''} to ${customTo || meta?.to || ''}`],
      ['Generated By', user?.name || 'Administrator'],
      ['Generated At', new Date().toLocaleString()],
    ];
  }, [reportData, user, branchNameDisplay, customFrom, customTo]);

  const handleExportCsv = () => {
    if (!reportData || !reportData.rows.length) return;
    downloadReportCsv('operating_profit_statement', exportMeta, [
      { headers: exportHeaders, rows: exportRows },
    ]);
  };

  const handlePrint = () => {
    if (!reportData || !reportData.rows.length) return;
    const totals = reportData.totals;
    const footers = [
      'NET OPERATING PROFIT',
      'NET_PROFIT',
      'Total Business',
      formatPKR(totals.netProfit),
      `${reportData.kpis.operatingMarginPercent}%`,
      formatPKR(reportData.kpis.priorOperatingProfit),
      formatPKR(totals.netProfit - reportData.kpis.priorOperatingProfit),
      reportData.kpis.profitGrowthPercent !== null ? `${reportData.kpis.profitGrowthPercent}%` : 'N/A',
      `Operating Margin: ${reportData.kpis.operatingMarginPercent}%`,
    ];

    printReportWindow({
      title: 'Operating Profit & P&L Statement',
      subtitle: `Branch: ${branchNameDisplay} · Period: ${customFrom} to ${customTo}`,
      meta: exportMeta,
      headers: exportHeaders,
      rows: exportRows,
      totals: footers,
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800">
      {/* Top Header Card with Title & Filters */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Operating Profit & P&L Statement</h1>
          <p className="text-xs text-slate-500 mt-1">
            Managerial Profit & Loss statement with net revenue, cost of goods/services, overheads, and operating profit.
          </p>
        </div>

        {/* Filters Form Row */}
        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5 items-end">
          {/* Campus Filter */}
          <div>
            <label className={labelClass}>Campus</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className={selectClass}
            >
              {isSuperAdmin && <option value="ALL">All Campuses</option>}
              {allBranches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Preset Filter */}
          <div>
            <label className={labelClass}>Date Preset</label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
              className={selectClass}
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
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setSelectedPreset('CUSTOM');
              }}
              className={inputClass}
            />
          </div>

          {/* To Date */}
          <div>
            <label className={labelClass}>To Date</label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setSelectedPreset('CUSTOM');
              }}
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
          <p className="text-slate-600 text-sm font-medium">Calculating Operating Profit Statement...</p>
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 font-bold text-sm tracking-wide text-white">
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                <span>Operating Profit & P&L Statement</span>
              </div>
              <div className="flex items-center bg-black/15 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('STATEMENT')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'STATEMENT'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  P&L Statement
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DETAILED')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'DETAILED'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Detailed Ledger ({reportData?.rows.length ?? 0})
                </button>
              </div>
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

          {/* Table Container */}
          <div className="bg-white overflow-x-auto rounded-b-xl border-t border-blue-200/40">
            {activeTab === 'STATEMENT' ? (
              <table className="report-records w-full text-[13px] text-left text-slate-700 whitespace-nowrap border-collapse min-w-[900px] font-['Inter',sans-serif]">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4 text-left">P&L Financial Line Item</th>
                    <th className="py-3.5 px-4 text-center">Section</th>
                    <th className="py-3.5 px-4 text-right">Current Period (PKR)</th>
                    <th className="py-3.5 px-4 text-right">% of Net Revenue</th>
                    <th className="py-3.5 px-4 text-right">Prior Period (PKR)</th>
                    <th className="py-3.5 px-4 text-right">Variance / Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.statementRows?.length ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No financial records found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    reportData.statementRows.map((line) => {
                      if (line.isHeader) {
                        return (
                          <tr key={line.id} className="bg-slate-100/60 font-bold text-[#0B2545]">
                            <td colSpan={6} className="py-2.5 px-4 uppercase tracking-wider text-[11px] text-[#0047AB]">
                              {line.name}
                            </td>
                          </tr>
                        );
                      }

                      if (line.isTotal || line.isMajorTotal || line.isFinalNet) {
                        return (
                          <tr
                            key={line.id}
                            className={`font-bold border-t border-b ${
                              line.isFinalNet
                                ? 'bg-slate-100 font-extrabold text-[#0B2545] border-slate-300'
                                : 'bg-slate-50 text-[#0B2545] border-slate-200'
                            }`}
                          >
                            <td className="py-2.5 px-4">{line.name}</td>
                            <td className="py-2.5 px-4 text-center text-[10px] text-slate-500 font-mono">
                              {line.isFinalNet ? 'NET RESULT' : 'SUBTOTAL'}
                            </td>
                            <td className={`py-2.5 px-4 text-right font-mono font-bold ${line.isFinalNet || line.section === 'GROSS_PROFIT' ? (line.currentAmount < 0 ? 'text-red-600' : 'text-green-600') : 'text-[#0B2545]'}`}>
                              {formatPKR(line.currentAmount)}
                            </td>
                            <td className={`py-2.5 px-4 text-right font-mono ${line.isFinalNet ? (line.currentAmount < 0 ? 'text-red-600' : 'text-green-600') : 'text-slate-600'}`}>
                              {line.percentOfRevenue}%
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                              {formatPKR(line.priorAmount)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">
                              {line.growthPercent !== null ? (
                                <span className="text-[#0047AB] font-semibold">
                                  {line.growthPercent >= 0 ? `+${line.growthPercent}%` : `${line.growthPercent}%`}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={line.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-4 pl-8 text-slate-800 font-medium flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {line.name}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className="text-[10px] text-slate-400 font-mono">{line.section}</span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-900 font-medium">
                            {formatPKR(line.currentAmount)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-500">
                            {line.percentOfRevenue}%
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-400">
                            {formatPKR(line.priorAmount)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-600">
                            {line.growthPercent !== null ? `${line.growthPercent}%` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="report-records w-full text-[13px] text-left text-slate-700 whitespace-nowrap border-collapse min-w-[1000px] font-['Inter',sans-serif]">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-3">Account / Line Item</th>
                    <th className="py-3.5 px-3">Classification</th>
                    <th className="py-3.5 px-3">Department / Layer</th>
                    <th className="py-3.5 px-3 text-right">Current Period (PKR)</th>
                    <th className="py-3.5 px-3 text-right">% of Revenue</th>
                    <th className="py-3.5 px-3 text-right">Prior Period (PKR)</th>
                    <th className="py-3.5 px-3 text-right">Variance (PKR)</th>
                    <th className="py-3.5 px-3 text-right">Growth (%)</th>
                    <th className="py-3.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!reportData?.rows?.length ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No ledger items recorded for this criteria.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((r, i) => (
                      <tr key={`${r.accountName}-${i}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#0B2545]">{r.accountName}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0047AB] border border-blue-200">
                            {r.classification}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{r.department}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#0B2545]">
                          {formatPKR(r.currentAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{r.percentOfRevenue}%</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{formatPKR(r.priorAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {formatPKR(r.varianceAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {r.growthPercent !== null ? `${r.growthPercent}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate" title={r.notes}>
                          {r.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {reportData && reportData.rows.length > 0 && (
                  <tfoot className="bg-slate-50 font-bold text-[#0B2545] border-t-2 border-slate-200 text-xs">
                    <tr>
                      <td className="py-2.5 px-3 text-left">Totals</td>
                      <td className="py-2.5 px-3">—</td>
                      <td className="py-2.5 px-3">{reportData.rows.length} Items</td>
                      <td className={`py-2.5 px-3 text-right ${reportData.totals.netProfit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatPKR(reportData.totals.netProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-right">{reportData.kpis.operatingMarginPercent}%</td>
                      <td className="py-2.5 px-3 text-right">{formatPKR(reportData.kpis.priorOperatingProfit)}</td>
                      <td className="py-2.5 px-3 text-right">
                        {formatPKR(reportData.totals.netProfit - reportData.kpis.priorOperatingProfit)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {reportData.kpis.profitGrowthPercent !== null
                          ? `${reportData.kpis.profitGrowthPercent}%`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">—</td>
                    </tr>
                  </tfoot>
                )}
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

export default COGSReportPage;
