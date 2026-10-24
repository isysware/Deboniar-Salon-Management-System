import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService } from '../../services';
import {
  TipReceiptRecord,
  TipAllocationRecord,
  TipPayoutRecord,
  TipsStatementSummary,
  Branch,
  StaffMember,
  PaymentAccount,
} from '../../types/salon';
import {
  Filter,
  Search,
  Printer,
  X,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Coins,
} from 'lucide-react';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';
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

function formatCurrency(val: number): string {
  const num = Number(val) || 0;
  return Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const TipsStatementPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();
  const { navigate } = useRouter();

  // Role guard: Super Admin and Branch Admin only. Accountant and Staff denied.
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/accounts/tips-statement" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const businessDate = demoDate || new Date().toISOString().slice(0, 10);
  const defaultMonth = resolvePreset('THIS_MONTH', businessDate)!;

  // Filters State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);

  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>(defaultMonth.from);
  const [endDate, setEndDate] = useState<string>(defaultMonth.to);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [selectedPaymentSource, setSelectedPaymentSource] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'COLLECTIONS' | 'ALLOCATIONS' | 'PAYOUTS'>('SUMMARY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [summary, setSummary] = useState<TipsStatementSummary>({
    openingLiability: 0,
    netTipsCollected: 0,
    netPayouts: 0,
    closingLiability: 0,
    unallocatedTips: 0,
    allocatedUnpaidTips: 0,
    receiptsCount: 0,
    allocationsCount: 0,
    payoutsCount: 0,
  });
  const [receipts, setReceipts] = useState<TipReceiptRecord[]>([]);
  const [allocations, setAllocations] = useState<TipAllocationRecord[]>([]);
  const [payouts, setPayouts] = useState<TipPayoutRecord[]>([]);

  // Load auxiliary data
  useEffect(() => {
    const loadAux = async () => {
      try {
        const branchParam = selectedBranchId || 'ALL';
        const [bList, sList, pList] = await Promise.all([
          allBranches && allBranches.length > 0 ? Promise.resolve(allBranches) : salonService.getBranches(),
          salonService.getStaff(branchParam),
          salonService.getPaymentAccounts(branchParam),
        ]);
        setBranches(bList);
        setAllStaff(sList);
        setPaymentAccounts(pList);
      } catch (err) {
        console.error('Failed to load auxiliary tips statement data', err);
      }
    };
    loadAux();
  }, [allBranches, selectedBranchId]);

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

  // Load statement data on demand from backend API
  const fetchStatement = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await salonService.getTipsStatement(
        selectedBranchId,
        startDate,
        endDate,
        {
          staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
          paymentSource: selectedPaymentSource !== 'ALL' ? selectedPaymentSource : undefined,
        },
        user
      );
      setSummary(res.summary);
      setReceipts(res.receipts);
      setAllocations(res.allocations);
      setPayouts(res.payouts);
    } catch (err: any) {
      console.error('Failed to load tips statement', err);
      setErrorMessage(err.message || 'Failed to fetch live tips statement from server.');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, startDate, endDate, selectedStaffId, selectedPaymentSource, user]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);
    fetchStatement();
  };

  // Filtered lists for search query
  const filteredReceipts = useMemo(() => {
    if (!searchQuery.trim()) return receipts;
    const q = searchQuery.toLowerCase();
    return receipts.filter(
      (r) =>
        r.receiptNumber.toLowerCase().includes(q) ||
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.directStaffName && r.directStaffName.toLowerCase().includes(q))
    );
  }, [receipts, searchQuery]);

  const filteredAllocations = useMemo(() => {
    if (!searchQuery.trim()) return allocations;
    const q = searchQuery.toLowerCase();
    return allocations.filter(
      (a) =>
        a.allocationNumber.toLowerCase().includes(q) ||
        a.tipReceiptNumber.toLowerCase().includes(q) ||
        a.invoiceNumber.toLowerCase().includes(q) ||
        a.staffName.toLowerCase().includes(q)
    );
  }, [allocations, searchQuery]);

  const filteredPayouts = useMemo(() => {
    if (!searchQuery.trim()) return payouts;
    const q = searchQuery.toLowerCase();
    return payouts.filter(
      (p) =>
        p.payoutNumber.toLowerCase().includes(q) ||
        p.allocationNumber.toLowerCase().includes(q) ||
        p.staffName.toLowerCase().includes(q) ||
        (p.onlineAccountName && p.onlineAccountName.toLowerCase().includes(q)) ||
        (p.reference && p.reference.toLowerCase().includes(q))
    );
  }, [payouts, searchQuery]);

  const isEquationBalanced = useMemo(() => {
    const calc = summary.openingLiability + summary.netTipsCollected - summary.netPayouts;
    return Math.abs(calc - summary.closingLiability) <= 1;
  }, [summary]);

  // Export handlers
  const handleExportCSV = () => {
    const meta: [string, string][] = [
      ['Report', 'Tips & Gratuity Financial Statement'],
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Opening Liability', summary.openingLiability.toFixed(2)],
      ['Net Tips Collected', summary.netTipsCollected.toFixed(2)],
      ['Net Payouts', summary.netPayouts.toFixed(2)],
      ['Closing Liability', summary.closingLiability.toFixed(2)],
      ['Generated At', new Date().toLocaleString()],
    ];

    const receiptHeaders = ['Receipt #', 'Date', 'Time', 'Invoice #', 'Client', 'Channel', 'Collected', 'Allocated', 'Unallocated', 'Status'];
    const receiptRows = filteredReceipts.map((r) => [
      r.receiptNumber, r.collectionDate, r.collectionTime, r.invoiceNumber, r.clientName, r.method,
      r.collectedAmount.toFixed(2), r.allocatedAmount.toFixed(2), r.unallocatedAmount.toFixed(2), r.status
    ]);

    const allocHeaders = ['Allocation #', 'Date', 'Receipt #', 'Staff Recipient', 'Type', 'Amount', 'Paid', 'Outstanding', 'Status'];
    const allocRows = filteredAllocations.map((a) => [
      a.allocationNumber, a.allocationDate, a.tipReceiptNumber, a.staffName, a.allocationType,
      a.amount.toFixed(2), a.paidAmount.toFixed(2), a.outstandingAmount.toFixed(2), a.status
    ]);

    const payoutHeaders = ['Payout #', 'Date', 'Time', 'Staff Recipient', 'Allocation #', 'Source', 'Amount', 'Processed By', 'Status'];
    const payoutRows = filteredPayouts.map((p) => [
      p.payoutNumber, p.payoutDate, p.payoutTime, p.staffName, p.allocationNumber, p.method,
      p.amount.toFixed(2), p.paidByName, p.status
    ]);

    downloadReportCsv(`Tips_Statement_${startDate}_${endDate}.csv`, meta, [
      { title: 'Tip Receipts', headers: receiptHeaders, rows: receiptRows },
      { title: 'Tip Allocations', headers: allocHeaders, rows: allocRows },
      { title: 'Tip Disbursements', headers: payoutHeaders, rows: payoutRows },
    ]);
  };

  const handleExportExcel = () => {
    const meta: [string, string][] = [
      ['Report', 'Tips & Gratuity Financial Statement'],
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Opening Liability', summary.openingLiability.toFixed(2)],
      ['Net Tips Collected', summary.netTipsCollected.toFixed(2)],
      ['Net Payouts', summary.netPayouts.toFixed(2)],
      ['Closing Liability', summary.closingLiability.toFixed(2)],
      ['Generated At', new Date().toLocaleString()],
    ];

    const receiptHeaders = ['Receipt #', 'Date', 'Time', 'Invoice #', 'Client', 'Channel', 'Collected', 'Allocated', 'Unallocated', 'Status'];
    const receiptRows = filteredReceipts.map((r) => [
      r.receiptNumber, r.collectionDate, r.collectionTime, r.invoiceNumber, r.clientName, r.method,
      r.collectedAmount.toFixed(2), r.allocatedAmount.toFixed(2), r.unallocatedAmount.toFixed(2), r.status
    ]);

    const allocHeaders = ['Allocation #', 'Date', 'Receipt #', 'Staff Recipient', 'Type', 'Amount', 'Paid', 'Outstanding', 'Status'];
    const allocRows = filteredAllocations.map((a) => [
      a.allocationNumber, a.allocationDate, a.tipReceiptNumber, a.staffName, a.allocationType,
      a.amount.toFixed(2), a.paidAmount.toFixed(2), a.outstandingAmount.toFixed(2), a.status
    ]);

    const payoutHeaders = ['Payout #', 'Date', 'Time', 'Staff Recipient', 'Allocation #', 'Source', 'Amount', 'Processed By', 'Status'];
    const payoutRows = filteredPayouts.map((p) => [
      p.payoutNumber, p.payoutDate, p.payoutTime, p.staffName, p.allocationNumber, p.method,
      p.amount.toFixed(2), p.paidByName, p.status
    ]);

    downloadReportExcel(`Tips_Statement_${startDate}_${endDate}.csv`, meta, [
      { title: 'Tip Receipts', headers: receiptHeaders, rows: receiptRows },
      { title: 'Tip Allocations', headers: allocHeaders, rows: allocRows },
      { title: 'Tip Disbursements', headers: payoutHeaders, rows: payoutRows },
    ]);
  };

  const handlePrint = () => {
    const meta: [string, string][] = [
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Opening Liability', formatCurrency(summary.openingLiability)],
      ['Net Tips Collected', formatCurrency(summary.netTipsCollected)],
      ['Net Payouts Disbursed', formatCurrency(summary.netPayouts)],
      ['Closing Liability', formatCurrency(summary.closingLiability)],
      ['Generated By', user.name],
    ];

    if (activeTab === 'COLLECTIONS') {
      const headers = ['Receipt #', 'Date', 'Invoice #', 'Client', 'Channel', 'Collected', 'Allocated', 'Unallocated', 'Status'];
      const rows = filteredReceipts.map((r) => [
        r.receiptNumber, r.collectionDate, r.invoiceNumber, r.clientName, r.method,
        formatCurrency(r.collectedAmount), formatCurrency(r.allocatedAmount), formatCurrency(r.unallocatedAmount), r.status
      ]);
      printReportWindow({ title: 'Tip Collections Statement', subtitle: `Receipts Breakdown`, meta, headers, rows });
    } else if (activeTab === 'ALLOCATIONS') {
      const headers = ['Allocation #', 'Date', 'Receipt #', 'Staff Recipient', 'Type', 'Amount', 'Paid', 'Outstanding', 'Status'];
      const rows = filteredAllocations.map((a) => [
        a.allocationNumber, a.allocationDate, a.tipReceiptNumber, a.staffName, a.allocationType,
        formatCurrency(a.amount), formatCurrency(a.paidAmount), formatCurrency(a.outstandingAmount), a.status
      ]);
      printReportWindow({ title: 'Tip Allocations Statement', subtitle: `Staff Payable Entitlements`, meta, headers, rows });
    } else if (activeTab === 'PAYOUTS') {
      const headers = ['Payout #', 'Date', 'Staff Recipient', 'Allocation #', 'Source', 'Amount', 'Processed By', 'Status'];
      const rows = filteredPayouts.map((p) => [
        p.payoutNumber, p.payoutDate, p.staffName, p.allocationNumber, p.method,
        formatCurrency(p.amount), p.paidByName, p.status
      ]);
      printReportWindow({ title: 'Tip Disbursements Statement', subtitle: `Staff Gratuity Payouts`, meta, headers, rows });
    } else {
      const headers = ['Liability Metric', 'Status', 'Amount (PKR)'];
      const rows = [
        ['Opening Gratuity Liability (Prior to period)', 'Opening', formatCurrency(summary.openingLiability)],
        ['Net Gratuity Collected (Period Receipts)', 'Inflow (+)', formatCurrency(summary.netTipsCollected)],
        ['Net Gratuity Disbursed (Period Payouts)', 'Outflow (-)', formatCurrency(summary.netPayouts)],
        ['Closing Gratuity Liability (At cutoff date)', 'Closing Balance', formatCurrency(summary.closingLiability)],
        ['Unallocated Gratuity Pool (Awaiting Assignment)', 'Internal Pool', formatCurrency(summary.unallocatedTips)],
        ['Allocated Unpaid Tips (Awaiting Disbursement)', 'Staff Payable', formatCurrency(summary.allocatedUnpaidTips)],
      ];
      printReportWindow({ title: 'Tips Financial Statement', subtitle: `Comprehensive Audit Reconciliation`, meta, headers, rows });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800">
      {/* Top Header Card with Title & Filters */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">Tips & Gratuity Financial Statement</h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit of tip collections, staff entitlements, disbursements, and unallocated pool reconciliation.
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

            {/* Staff Member */}
            <div>
              <label className={labelClass}>Staff Member</label>
              <select
                className={selectClass}
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="ALL">All Staff</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Source */}
            <div>
              <label className={labelClass}>Payment Channel</label>
              <select
                className={selectClass}
                value={selectedPaymentSource}
                onChange={(e) => setSelectedPaymentSource(e.target.value)}
              >
                <option value="ALL">All Channels</option>
                <option value="CASH">Cash Float</option>
                <option value="ONLINE">Bank / Online Account</option>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5 items-end">
            {/* Search Query */}
            <div className="md:col-span-5">
              <label className={labelClass}>Search</label>
              <input
                type="text"
                placeholder="Search receipt #, invoice #, staff recipient..."
                className={inputClass}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Action Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[35px] bg-[#0047AB] hover:bg-[#003785] active:bg-[#002b66] text-white font-medium text-xs rounded-md shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-70"
              >
                {loading ? (
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
      ) : loading ? (
        /* Loading Skeleton */
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
          <p className="text-slate-600 text-sm font-medium">Reconciling Tip Ledger Records...</p>
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
                <Coins className="w-4 h-4 stroke-[2.5]" />
                <span>Tips Financial Statement</span>
              </div>
              <div className="flex items-center bg-black/15 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('SUMMARY')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'SUMMARY'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('COLLECTIONS')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'COLLECTIONS'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Collections ({filteredReceipts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ALLOCATIONS')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'ALLOCATIONS'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Allocations ({filteredAllocations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('PAYOUTS')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'PAYOUTS'
                      ? 'bg-white text-[#0047AB] shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Disbursements ({filteredPayouts.length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
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
            {activeTab === 'SUMMARY' ? (
              <table className="report-records w-full text-left border-collapse min-w-[800px] font-['Inter',sans-serif] text-[13px] antialiased">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4">Financial Liability Metric</th>
                    <th className="py-3.5 px-4 text-center">Accounting Classification</th>
                    <th className="py-3.5 px-4 text-right">Balance (PKR)</th>
                    <th className="py-3.5 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  <tr className="hover:bg-blue-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#0B2545]">Opening Gratuity Liability</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        OPENING BALANCE
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0B2545]">
                      {formatCurrency(summary.openingLiability)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">Unsettled tip balance prior to {startDate}</td>
                  </tr>
                  <tr className="hover:bg-blue-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#0B2545]">Net Tips Collected at POS</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0047AB] border border-blue-200">
                        PERIOD INFLOW (+)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0047AB]">
                      {formatCurrency(summary.netTipsCollected)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{summary.receiptsCount} client receipts posted</td>
                  </tr>
                  <tr className="hover:bg-blue-50/20 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#0B2545]">Net Payouts Disbursed to Staff</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        PERIOD OUTFLOW (-)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(summary.netPayouts)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{summary.payoutsCount} staff cash/bank payouts</td>
                  </tr>
                  <tr className="bg-slate-100/70 border-t-2 border-b-2 border-slate-300 font-bold text-[#0B2545]">
                    <td className="py-3 px-4 font-black">Closing Gratuity Liability</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#0B2545] text-white">
                        CLOSING BALANCE
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-black text-[#0B2545]">
                      {formatCurrency(summary.closingLiability)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">Net liability owed as of {endDate}</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-800 pl-8">• Unallocated Gratuity Pool</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        RESERVE POOL
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700">
                      {formatCurrency(summary.unallocatedTips)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">Tips collected but not yet assigned to staff</td>
                  </tr>
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-800 pl-8">• Staff Payable (Allocated Unpaid)</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-[#0047AB]">
                        STAFF PAYABLE
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#0047AB]">
                      {formatCurrency(summary.allocatedUnpaidTips)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">Assigned entitlements awaiting disbursement</td>
                  </tr>
                </tbody>
              </table>
            ) : activeTab === 'COLLECTIONS' ? (
              <table className="report-records w-full text-left border-collapse min-w-[900px] font-['Inter',sans-serif] text-[13px] antialiased">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4">Receipt #</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Channel</th>
                    <th className="py-3.5 px-4 text-right">Collected Amount</th>
                    <th className="py-3.5 px-4 text-right">Allocated</th>
                    <th className="py-3.5 px-4 text-right">Unallocated</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No tip receipts found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((r) => (
                      <tr key={r.id} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{r.receiptNumber}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {r.collectionDate} <span className="text-slate-400 text-[11px]">{r.collectionTime}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{r.invoiceNumber}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">{r.clientName}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {r.method === 'CASH' ? 'Cash Float' : r.paymentAccountName || 'Online Account'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0B2545]">
                          {formatCurrency(r.collectedAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-[#0047AB]">
                          {formatCurrency(r.allocatedAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                          {formatCurrency(r.unallocatedAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0047AB] border border-blue-200">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredReceipts.length > 0 && (
                  <tfoot className="bg-[#F8FAFC] font-bold text-[#0B2545] border-t-2 border-slate-200 text-[13px]">
                    <tr>
                      <td className="py-3.5 px-4 text-left">Totals</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4">{filteredReceipts.length} Receipts</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4 text-right text-[#0B2545]">
                        {formatCurrency(filteredReceipts.reduce((s, r) => s + r.collectedAmount, 0))}
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#0047AB]">
                        {formatCurrency(filteredReceipts.reduce((s, r) => s + r.allocatedAmount, 0))}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {formatCurrency(filteredReceipts.reduce((s, r) => s + r.unallocatedAmount, 0))}
                      </td>
                      <td className="py-3.5 px-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : activeTab === 'ALLOCATIONS' ? (
              <table className="report-records w-full text-left border-collapse min-w-[900px] font-['Inter',sans-serif] text-[13px] antialiased">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4">Allocation #</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Tip Receipt #</th>
                    <th className="py-3.5 px-4">Staff Recipient</th>
                    <th className="py-3.5 px-4 text-center">Type</th>
                    <th className="py-3.5 px-4 text-right">Allocated Amount</th>
                    <th className="py-3.5 px-4 text-right">Disbursed (Paid)</th>
                    <th className="py-3.5 px-4 text-right">Outstanding</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {filteredAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No tip allocations found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAllocations.map((a) => (
                      <tr key={a.id} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{a.allocationNumber}</td>
                        <td className="py-3.5 px-4 text-slate-600">{a.allocationDate}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{a.tipReceiptNumber}</td>
                        <td className="py-3.5 px-4 font-semibold text-[#0B2545]">{a.staffName}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {a.allocationType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0B2545]">
                          {formatCurrency(a.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                          {formatCurrency(a.paidAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0047AB]">
                          {formatCurrency(a.outstandingAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0047AB] border border-blue-200">
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredAllocations.length > 0 && (
                  <tfoot className="bg-[#F8FAFC] font-bold text-[#0B2545] border-t-2 border-slate-200 text-[13px]">
                    <tr>
                      <td className="py-3.5 px-4 text-left">Totals</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4">{filteredAllocations.length} Allocations</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4 text-right text-[#0B2545]">
                        {formatCurrency(filteredAllocations.reduce((s, a) => s + a.amount, 0))}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {formatCurrency(filteredAllocations.reduce((s, a) => s + a.paidAmount, 0))}
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#0047AB]">
                        {formatCurrency(filteredAllocations.reduce((s, a) => s + a.outstandingAmount, 0))}
                      </td>
                      <td className="py-3.5 px-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <table className="report-records w-full text-left border-collapse min-w-[900px] font-['Inter',sans-serif] text-[13px] antialiased">
                <thead>
                  <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                    <th className="py-3.5 px-4">Payout #</th>
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Staff Recipient</th>
                    <th className="py-3.5 px-4">Allocation #</th>
                    <th className="py-3.5 px-4">Disbursement Source</th>
                    <th className="py-3.5 px-4 text-right">Disbursed Amount</th>
                    <th className="py-3.5 px-4">Processed By</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {filteredPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No tip disbursements found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPayouts.map((p) => (
                      <tr key={p.id} className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{p.payoutNumber}</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {p.payoutDate} <span className="text-slate-400 text-[11px]">{p.payoutTime}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#0B2545]">{p.staffName}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{p.allocationNumber}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {p.method === 'CASH' ? 'Cash Drawer' : p.onlineAccountName || 'Bank Account'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#0B2545]">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{p.paidByName}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0047AB] border border-blue-200">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredPayouts.length > 0 && (
                  <tfoot className="bg-[#F8FAFC] font-bold text-[#0B2545] border-t-2 border-slate-200 text-[13px]">
                    <tr>
                      <td className="py-3.5 px-4 text-left">Totals</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4">{filteredPayouts.length} Disbursements</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4 text-right text-[#0B2545]">
                        {formatCurrency(filteredPayouts.reduce((s, p) => s + p.amount, 0))}
                      </td>
                      <td className="py-3.5 px-4">—</td>
                      <td className="py-3.5 px-4"></td>
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
