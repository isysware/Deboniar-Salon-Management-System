import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import {
  PayslipRecord,
  CommissionStatementRecord,
  TipAllocationRecord,
  TipPayoutRecord,
  StaffPerformanceRecord,
} from '../../types/salon';
import {
  DollarSign,
  Award,
  Calendar,
  CreditCard,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  TrendingUp,
  X,
  FileText,
  Coins,
  Sparkles,
  Download,
  Filter,
  AlertCircle,
  Briefcase,
  Layers,
  Percent,
  RotateCcw,
} from 'lucide-react';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';

function formatCurrency(val: number): string {
  return `PKR ${val.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Base actually earned this month (prorated base + paid leave + holiday pay), so lines add up to net. */
const basicEarned = (p: PayslipRecord) => p.baseEarnings + (p.leaveEarnings || 0) + (p.holidayEarnings || 0);

export const StaffPersonalReportsPage: React.FC = () => {
  const { user } = useAuth();

  // Role guard: Staff only
  if (!user || user.role !== 'STAFF') {
    return <AccessDeniedView attemptedPath="/my-reports" />;
  }

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'PAYSLIPS' | 'COMMISSIONS' | 'TIPS' | 'PERFORMANCE'>('PAYSLIPS');

  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionStatementRecord[]>([]);
  const [tipsData, setTipsData] = useState<{
    summary: { totalAllocated: number; totalPaid: number; totalOutstanding: number };
    allocations: TipAllocationRecord[];
    payouts: TipPayoutRecord[];
  }>({
    summary: { totalAllocated: 0, totalPaid: 0, totalOutstanding: 0 },
    allocations: [],
    payouts: [],
  });

  // Performance Tab State
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthStartStr = useMemo(() => todayStr.slice(0, 7) + '-01', [todayStr]);
  const [perfStartDate, setPerfStartDate] = useState<string>(monthStartStr);
  const [perfEndDate, setPerfEndDate] = useState<string>(todayStr);
  const [performanceRecord, setPerformanceRecord] = useState<StaffPerformanceRecord | null>(null);

  // Selected records for modals
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);
  const [selectedCommission, setSelectedCommission] = useState<CommissionStatementRecord | null>(null);
  const [showPayslipPrintModal, setShowPayslipPrintModal] = useState<boolean>(false);
  const [showCommissionPrintModal, setShowCommissionPrintModal] = useState<boolean>(false);
  const [showCommissionBreakdownModal, setShowCommissionBreakdownModal] = useState<boolean>(false);
  const [showPerfPrintModal, setShowPerfPrintModal] = useState<boolean>(false);

  // Load staff personal records
  useEffect(() => {
    const loadStaffData = async () => {
      try {
        setLoading(true);
        const [myPayslips, myCommissions, myTips, myPerf] = await Promise.all([
          salonService.getStaffPersonalPayslips(user),
          salonService.getStaffPersonalCommissions(user),
          salonService.getStaffPersonalTips(user),
          salonService.getStaffPersonalPerformance(user, perfStartDate, perfEndDate),
        ]);
        setPayslips(myPayslips);
        setCommissions(myCommissions);
        setTipsData(myTips);
        setPerformanceRecord(myPerf);
      } catch (err) {
        console.error('Failed to load personal statements', err);
      } finally {
        setLoading(false);
      }
    };

    loadStaffData();
  }, [user, perfStartDate, perfEndDate]);

  // Overall financial summary
  const summaryMetrics = useMemo(() => {
    let finalizedPayable = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    payslips.forEach((p) => {
      const salaryNet = p.salaryNetPayable ?? p.netPayable;
      const salaryPaid = p.salaryPaidAmount ?? p.paidAmount;
      finalizedPayable += salaryNet;
      totalPaid += salaryPaid;
      totalOutstanding += salaryNet - salaryPaid;
    });

    commissions.forEach((c) => {
      finalizedPayable += c.netCommissionPayable;
      totalPaid += c.paidAmount;
      totalOutstanding += c.outstandingAmount;
    });

    // Include personal tips in staff financial summary
    finalizedPayable += tipsData.summary.totalAllocated;
    totalPaid += tipsData.summary.totalPaid;
    totalOutstanding += tipsData.summary.totalOutstanding;

    return {
      finalizedPayable,
      totalPaid,
      totalOutstanding,
      estimatedEarnings: finalizedPayable,
    };
  }, [payslips, commissions, tipsData]);

  // CSV Export for Personal Tips
  const handleExportTipsCSV = () => {
    const headers = [
      'Type',
      'Record ID / Number',
      'Date',
      'Method / Source',
      'Amount (PKR)',
      'Status',
    ];

    const allocationRows = tipsData.allocations.map((a) => [
      'Allocation Entitlement',
      a.id,
      a.allocationDate,
      a.allocationType === 'DIRECT' ? 'Direct POS Allocation' : 'Pooled Staff Split',
      a.amount.toFixed(2),
      a.status,
    ]);

    const payoutRows = tipsData.payouts.map((p) => [
      'Payout Disbursement',
      p.payoutNumber,
      p.payoutDate,
      p.method === 'CASH' ? 'Cash Custody Payout' : `Online Bank (${p.onlineAccountName || 'Account'})`,
      p.amount.toFixed(2),
      p.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...allocationRows.map((r) => r.join(',')), ...payoutRows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `My_Tips_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Personal Performance
  const handleExportPerfCSV = () => {
    if (!performanceRecord) return;
    const headers = [
      'Date',
      'Time',
      'Invoice #',
      'Client',
      'Item Type',
      'Service / Component',
      'Catalogue Price (PKR)',
      'Discount (PKR)',
      'Net Sales (PKR)',
      'Commission Rate (%)',
      'Earned (PKR)',
    ];

    const rows = (performanceRecord.detailedServices || []).map((s) => [
      s.date,
      s.time || '',
      s.invoiceNumber,
      `"${(s.clientName || 'Walk-in Client').replace(/"/g, '""')}"`,
      s.itemType,
      `"${s.serviceName.replace(/"/g, '""')}"`,
      s.cataloguePrice.toFixed(2),
      s.discountAllocated.toFixed(2),
      s.netSales.toFixed(2),
      s.commissionRatePercent.toFixed(1),
      s.commissionEarned.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `My_Performance_${perfStartDate}_to_${perfEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Earnings & Statements</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#2254E1] border border-blue-200">
                  Staff Self-Service
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Personal finalized monthly salary payslips, service commission statements, gratuity payouts, and service performance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab('PAYSLIPS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'PAYSLIPS'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Salary Payslips ({payslips.length})
          </button>
          <button
            onClick={() => setActiveTab('COMMISSIONS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'COMMISSIONS'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Commission ({commissions.length})
          </button>
          <button
            onClick={() => setActiveTab('TIPS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'TIPS'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Tips ({tipsData.allocations.length})
          </button>
          <button
            onClick={() => setActiveTab('PERFORMANCE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'PERFORMANCE'
                ? 'bg-white text-[#2254E1] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Performance
          </button>
        </div>
      </div>

      {/* 4 Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Earnings</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(summaryMetrics.estimatedEarnings)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
              Gross Entitlement
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Combined salary, commission & tips</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Finalized Payable</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-600">
              {formatCurrency(summaryMetrics.finalizedPayable)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
              Audited
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Approved by branch management</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Received</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600">
              {formatCurrency(summaryMetrics.totalPaid)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              Disbursed
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Actual payouts received</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Balance</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">
              {formatCurrency(summaryMetrics.totalOutstanding)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              Pending Payout
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Unpaid balance remaining</p>
        </div>
      </div>

      {/* TAB 1: PAYSLIPS */}
      {activeTab === 'PAYSLIPS' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Salary Payslips History</h2>
            <span className="text-xs text-slate-500 font-medium">Showing {payslips.length} monthly runs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="report-records w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Base Salary</th>
                  <th className="py-3 px-4">Deductions</th>
                  <th className="py-3 px-4">Overtime Pay</th>
                  <th className="py-3 px-4">Allowances</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payslips.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No finalized salary payslips generated for your profile yet.
                    </td>
                  </tr>
                ) : (
                  payslips.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{p.month}</td>
                      <td className="py-3 px-4">{formatCurrency(basicEarned(p))}</td>
                      <td className="py-3 px-4 text-rose-600">
                        -{formatCurrency(p.totalDeductions)}
                      </td>
                      <td className="py-3 px-4 text-indigo-600 font-medium">
                        +{formatCurrency(p.approvedOvertimeAmount)}
                      </td>
                      <td className="py-3 px-4 text-emerald-600">+{formatCurrency(p.allowancesTotal ?? 0)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(p.netPayable)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-semibold">
                        {formatCurrency(p.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-600 font-semibold">
                        {formatCurrency(p.outstandingAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedPayslip(p);
                            setShowPayslipPrintModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          View / Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: COMMISSIONS */}
      {activeTab === 'COMMISSIONS' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Commission Statements</h2>
            <span className="text-xs text-slate-500 font-medium">Showing {commissions.length} statements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="report-records w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Net Sales Attributed</th>
                  <th className="py-3 px-4">Commission Earned</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No finalized commission statements found for your profile.
                    </td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.startDate} to {c.endDate}</td>
                      <td className="py-3 px-4">{formatCurrency(c.attributedNetSales)}</td>
                      <td className="py-3 px-4 text-purple-700 font-semibold">
                        {formatCurrency(c.grossCommissionEarned)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(c.netCommissionPayable)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-semibold">
                        {formatCurrency(c.paidAmount)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-600 font-semibold">
                        {formatCurrency(c.outstandingAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700'
                              : c.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center space-x-1.5">
                        <button
                          onClick={() => {
                            setSelectedCommission(c);
                            setShowCommissionBreakdownModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Breakdown
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCommission(c);
                            setShowCommissionPrintModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MY TIPS */}
      {activeTab === 'TIPS' && (
        <div className="space-y-6">
          {/* Tips Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Allocated Tips
                </span>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {formatCurrency(tipsData.summary.totalAllocated)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {tipsData.allocations.length} personal allocations
                </p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Coins className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Disbursed / Paid
                </span>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {formatCurrency(tipsData.summary.totalPaid)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {tipsData.payouts.filter((p) => p.status === 'COMPLETED').length} payout receipts
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Outstanding Gratuity Due
                </span>
                <div className="text-2xl font-bold text-rose-600 mt-1">
                  {formatCurrency(tipsData.summary.totalOutstanding)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ready for cashier disbursement
                </p>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Coins className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Tips Ledger Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Allocations */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-slate-900 text-sm">Personal Tip Allocations</h3>
                </div>
                <button
                  onClick={handleExportTipsCSV}
                  className="flex items-center gap-1 text-xs text-[#2254E1] font-semibold hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="report-records w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-100">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tipsData.allocations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No tip allocations recorded for your profile.
                        </td>
                      </tr>
                    ) : (
                      tipsData.allocations.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {a.allocationDate}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                a.allocationType === 'DIRECT'
                                  ? 'bg-blue-50 text-[#2254E1]'
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {a.allocationType === 'DIRECT' ? 'Direct POS' : 'Pooled Split'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                            {formatCurrency(a.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                a.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : a.status === 'CANCELLED'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Disbursements / Payouts */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Disbursement Receipts</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {tipsData.payouts.length} disbursements
                </span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="report-records w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-100">
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tipsData.payouts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No tip payout disbursements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      tipsData.payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-900">
                            {p.payoutNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{p.payoutDate}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {p.method === 'CASH' ? 'Cash' : `Bank (${p.onlineAccountName || 'Online'})`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MY PERFORMANCE */}
      {activeTab === 'PERFORMANCE' && (
        <div className="space-y-6">
          {/* Performance Date Filter Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">From:</span>
                <input
                  type="date"
                  value={perfStartDate}
                  onChange={(e) => setPerfStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">To:</span>
                <input
                  type="date"
                  value={perfEndDate}
                  onChange={(e) => setPerfEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPerfCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => setShowPerfPrintModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2254E1] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Performance Review
              </button>
            </div>
          </div>

          {/* Performance KPIs */}
          {performanceRecord && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Attributed Net Sales
                </span>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCurrency(performanceRecord.attributedNetSales)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gross: {formatCurrency(performanceRecord.attributedGrossSales)} · Disc: {formatCurrency(performanceRecord.discountAllocation)}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Completed Services
                </span>
                <div className="text-2xl font-bold text-[#2254E1] mt-1">
                  {performanceRecord.totalServiceUnits} units
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {performanceRecord.directServicesCount} Direct · {performanceRecord.packageComponentsCount} Package · {performanceRecord.uniqueClientsCount} Clients
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Commission Earned
                </span>
                <div className="text-2xl font-bold text-purple-700 mt-1">
                  {formatCurrency(performanceRecord.estimatedCommission)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Finalized: {formatCurrency(performanceRecord.finalizedCommission)} · Paid: {formatCurrency(performanceRecord.paidCommission)}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Attendance & Overtime
                </span>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {performanceRecord.presentDays} days ({performanceRecord.workedHours}h)
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {performanceRecord.latePunchesCount} late punches · Approved OT: {performanceRecord.approvedOvertimeMinutes}m
                </p>
              </div>
            </div>
          )}

          {/* Performance Service Line Items Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Personal Service Delivery Ledger</h2>
              <span className="text-xs text-slate-500 font-medium">
                Showing {performanceRecord?.detailedServices?.length || 0} service items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="report-records w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4 text-right">Catalogue Price</th>
                    <th className="py-3 px-4 text-right">Discount</th>
                    <th className="py-3 px-4 text-right">Net Sales</th>
                    <th className="py-3 px-4 text-right">Rate %</th>
                    <th className="py-3 px-4 text-right">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(!performanceRecord?.detailedServices || performanceRecord.detailedServices.length === 0) ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No service deliveries found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    performanceRecord.detailedServices.map((item, idx) => (
                      <tr key={`${item.invoiceId}-${item.itemId}-${idx}`} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {item.date} {item.time ? `· ${item.time}` : ''}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] font-semibold text-slate-900">
                          {item.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {item.clientName || 'Walk-in Client'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.itemType === 'SERVICE'
                                ? 'bg-blue-50 text-[#2254E1]'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {item.itemType === 'SERVICE' ? 'Direct' : 'Package'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{item.serviceName}</td>
                        <td className="py-3 px-4 text-right text-slate-600">
                          {formatCurrency(item.cataloguePrice)}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-600">
                          {item.discountAllocated > 0 ? `-${formatCurrency(item.discountAllocated)}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(item.netSales)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-mono">
                          {item.commissionRatePercent}%
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-purple-700">
                          {formatCurrency(item.commissionEarned)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: PAYSLIP */}
      {showPayslipPrintModal && selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Salary Payslip — {selectedPayslip.month}</h3>
              <button
                onClick={() => setShowPayslipPrintModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Employee Name</span>
                <span className="font-bold text-slate-900">{selectedPayslip.staffName}</span>
              </div>
              {/* 1. Base Salary & Proration */}
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Contractual Base Salary</span>
                <span className="font-semibold text-slate-900">{formatCurrency(selectedPayslip.effectiveBaseSalary ?? selectedPayslip.baseEarnings)}</span>
              </div>
              {selectedPayslip.calculationDetails?.prorationApplied && (
                <div className="flex justify-between py-1 border-b border-slate-50 text-amber-700 bg-amber-50/50 px-1 rounded">
                  <span>
                    Proration Adjustment
                    <span className="block text-[10px] text-amber-600 font-normal">{selectedPayslip.calculationDetails.prorationFormula}</span>
                  </span>
                  <span className="font-semibold">-{formatCurrency(Math.max(0, (selectedPayslip.effectiveBaseSalary || 0) - selectedPayslip.baseEarnings))}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-50 bg-slate-50/60 px-1 rounded">
                <span className="text-slate-700 font-medium">Earned Base Salary</span>
                <span className="font-bold text-slate-900">{formatCurrency(basicEarned(selectedPayslip))}</span>
              </div>

              {/* 2. Other Earnings */}
              {selectedPayslip.leaveEarnings > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Eligible Paid Leave ({selectedPayslip.paidLeaveDays} days)</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(selectedPayslip.leaveEarnings)}</span>
                </div>
              )}
              {(selectedPayslip.holidayEarnings ?? 0) > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-600">Holiday / Weekly-off Pay</span>
                  <span className="font-semibold text-slate-900">+{formatCurrency(selectedPayslip.holidayEarnings || 0)}</span>
                </div>
              )}
              {selectedPayslip.approvedOvertimeAmount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-50 text-indigo-600">
                  <span>Approved Overtime ({selectedPayslip.approvedOvertimeMinutes} mins)</span>
                  <span className="font-semibold">+{formatCurrency(selectedPayslip.approvedOvertimeAmount)}</span>
                </div>
              )}
              {(selectedPayslip.allowanceLines ?? []).map((a) => (
                <div key={a.id} className="flex justify-between py-1 border-b border-slate-50 text-emerald-600">
                  <span>{a.name} Allowance</span>
                  <span className="font-semibold">+{formatCurrency(a.amount)}</span>
                </div>
              ))}
              {(selectedPayslip.adjustments ?? []).filter((a) => a.type !== 'DEDUCTION').map((a) => (
                <div key={a.id} className="flex justify-between py-1 border-b border-slate-50 text-emerald-600">
                  <span>{a.title}</span>
                  <span className="font-semibold">+{formatCurrency(a.amount)}</span>
                </div>
              ))}

              {/* Gross Earnings Subtotal */}
              <div className="flex justify-between py-1.5 border-b-2 border-slate-200 bg-slate-100/70 px-2 rounded font-semibold text-slate-900">
                <span>Gross Earnings</span>
                <span>{formatCurrency(selectedPayslip.grossPayable)}</span>
              </div>

              {/* 3. Deductions */}
              {selectedPayslip.absenceDeductions > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-50 text-rose-600">
                  <span>Absence Deductions ({selectedPayslip.absentDays} days)</span>
                  <span>-{formatCurrency(selectedPayslip.absenceDeductions)}</span>
                </div>
              )}
              {selectedPayslip.lateEarlyDeductions > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-50 text-rose-600">
                  <span>Late Punches Penalty</span>
                  <span>-{formatCurrency(selectedPayslip.lateEarlyDeductions)}</span>
                </div>
              )}
              {(selectedPayslip.adjustments ?? []).filter((a) => a.type === 'DEDUCTION').map((a) => (
                <div key={a.id} className="flex justify-between py-1 border-b border-slate-50 text-rose-600">
                  <span>{a.title}</span>
                  <span>-{formatCurrency(a.amount)}</span>
                </div>
              ))}

              {/* Loan Recoveries */}
              {(selectedPayslip.advanceRecoveries ?? []).map((r) => (
                <div key={r.advanceId} className="flex justify-between py-1 border-b border-slate-50 text-rose-600">
                  <span>
                    Loan Recovery ({r.advanceNumber}){' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({selectedPayslip.status === 'DRAFT' ? 'projected balance' : 'remaining balance'}: {formatCurrency(r.balanceAfter)})
                    </span>
                  </span>
                  <span className="font-semibold">-{formatCurrency(r.amount)}</span>
                </div>
              ))}

              {/* Total Deductions Subtotal */}
              <div className="flex justify-between py-1.5 border-b border-slate-200 text-rose-600 font-semibold px-2">
                <span>Total Deductions</span>
                <span>-{formatCurrency(selectedPayslip.totalDeductions)}</span>
              </div>

              {/* 4. Net Payable */}
                <div className="pt-2 flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-900">
                  <span>Net Salary Payable</span>
                  <span>{formatCurrency(selectedPayslip.salaryNetPayable ?? selectedPayslip.netPayable)}</span>
                </div>
                <div className="flex justify-between py-1 text-emerald-700">
                  <span>Finalized Commission</span>
                  <span>+{formatCurrency(selectedPayslip.commissionPayable ?? 0)}</span>
                </div>
                <div className="pt-2 flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-900">
                  <span>Combined Net Payable</span>
                  <span className="text-indigo-600">{formatCurrency(selectedPayslip.netPayable)}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1">
                <span>Paid: {formatCurrency(selectedPayslip.paidAmount)}</span>
                <span>Outstanding: {formatCurrency(selectedPayslip.outstandingAmount)}</span>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#2254E1] text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
              >
                Print Payslip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: COMMISSION */}
      {showCommissionPrintModal && selectedCommission && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Commission Statement — {selectedCommission.startDate} to {selectedCommission.endDate}</h3>
              <button
                onClick={() => setShowCommissionPrintModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Employee Name</span>
                <span className="font-bold text-slate-900">{selectedCommission.staffName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Attributed Net Service Sales</span>
                <span className="font-semibold">{formatCurrency(selectedCommission.attributedNetSales)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 text-purple-700">
                <span>Gross Commission Earned</span>
                <span className="font-semibold">{formatCurrency(selectedCommission.grossCommissionEarned)}</span>
              </div>
              <div className="pt-2 flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-900">
                <span>Net Commission Payable</span>
                <span className="text-purple-700">{formatCurrency(selectedCommission.netCommissionPayable)}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1">
                <span>Paid: {formatCurrency(selectedCommission.paidAmount)}</span>
                <span>Outstanding: {formatCurrency(selectedCommission.outstandingAmount)}</span>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#2254E1] text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
              >
                Print Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMMISSION BREAKDOWN */}
      {showCommissionBreakdownModal && selectedCommission && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-100 overflow-y-auto overscroll-contain">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Commission Breakdown — {selectedCommission.startDate} to {selectedCommission.endDate}
                </h3>
                <p className="text-xs text-slate-500">{selectedCommission.staffName} ({selectedCommission.designation})</p>
              </div>
              <button
                onClick={() => setShowCommissionBreakdownModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Attributed Net Service Sales:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(selectedCommission.attributedNetSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Commission Earned:</span>
                  <span className="font-bold text-purple-700">{formatCurrency(selectedCommission.grossCommissionEarned)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                  <span className="text-slate-900">Net Payable:</span>
                  <span className="text-purple-700">{formatCurrency(selectedCommission.netCommissionPayable)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Commission was computed exclusively on net service revenue after discount allocation, excluding gratuity and sales tax.
              </p>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowCommissionBreakdownModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: PERSONAL PERFORMANCE */}
      {showPerfPrintModal && performanceRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-y-auto overscroll-contain">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
              <h3 className="font-bold text-slate-900 text-sm">Print Personal Performance Review</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#2254E1] text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
                >
                  Print
                </button>
                <button
                  onClick={() => setShowPerfPrintModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs" id="printable-personal-perf">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">iSysware SalonOS</h1>
                  <h2 className="text-sm font-semibold text-slate-700">Staff Personal Performance Review</h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Employee: {performanceRecord.staffName} ({performanceRecord.staffCode}) · {performanceRecord.roleTitle}
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <div>Period: {perfStartDate} to {perfEndDate}</div>
                  <div>Branch: {performanceRecord.branchName}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Attributed Net Sales</span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(performanceRecord.attributedNetSales)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Delivered Units</span>
                  <span className="text-sm font-bold text-slate-900">{performanceRecord.totalServiceUnits} units</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Commission Earned</span>
                  <span className="text-sm font-bold text-purple-700">{formatCurrency(performanceRecord.estimatedCommission)}</span>
                </div>
              </div>

              <table className="report-records w-full text-left text-[11px] border border-slate-200 mt-2">
                <thead className="bg-slate-100 font-semibold text-slate-700">
                  <tr>
                    <th className="py-1.5 px-2">Date</th>
                    <th className="py-1.5 px-2">Invoice #</th>
                    <th className="py-1.5 px-2">Service</th>
                    <th className="py-1.5 px-2 text-right">Net Sales</th>
                    <th className="py-1.5 px-2 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(performanceRecord.detailedServices || []).slice(0, 15).map((s, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-2 font-mono">{s.date}</td>
                      <td className="py-1.5 px-2 font-mono">{s.invoiceNumber}</td>
                      <td className="py-1.5 px-2">{s.serviceName}</td>
                      <td className="py-1.5 px-2 text-right font-semibold">{formatCurrency(s.netSales)}</td>
                      <td className="py-1.5 px-2 text-right text-purple-700 font-semibold">{formatCurrency(s.commissionEarned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-slate-500 text-[10px]">
                <div className="border-t border-slate-200 pt-2">Staff Member Signature</div>
                <div className="border-t border-slate-200 pt-2">Branch Manager / Supervisor</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
