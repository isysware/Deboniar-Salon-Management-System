import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import {
  Settlement,
  SettlementStatus,
  CashDrawer,
  CreateSettlementInput,
  ApproveSettlementInput,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { toast } from '@/context/ToastContext';
import {
  downloadReportExcel,
  downloadReportCsv,
  printReportWindow,
} from '@/features/reports/reportUtils';
import {
  Search,
  Printer,
  FileSpreadsheet,
  FileText,
  RotateCw,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  X,
  FileCheck,
  Eye,
  Check,
} from 'lucide-react';

const formatPKR = (num: number) => {
  const val = Number(num) || 0;
  return `PKR ${Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

export const AccountSettlementPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();
  const { navigate } = useRouter();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/accounts/account-settlement" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAdmin = user.role === 'ADMIN';
  const canReview = isSuperAdmin || isAdmin;

  // Branch scope
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin
      ? activeBranchId && activeBranchId !== 'ALL'
        ? activeBranchId
        : user.branchId || allBranches[0]?.id || ''
      : (user.branchId as string)
  );

  useEffect(() => {
    if (isSuperAdmin && activeBranchId && activeBranchId !== 'ALL') {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId, isSuperAdmin]);

  // Main state
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [myDrawers, setMyDrawers] = useState<CashDrawer[]>([]);
  const [activeDrawerExpectedCash, setActiveDrawerExpectedCash] = useState<number>(0);
  const [activeDrawer, setActiveDrawer] = useState<CashDrawer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Settle Current Shift inline form state
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [retainedFloatInput, setRetainedFloatInput] = useState<string>('0');
  const [varianceExplanation, setVarianceExplanation] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSettleForm, setShowSettleForm] = useState<boolean>(false);

  // Modals for Admin Review & Settlement View
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState<string>('');

  // Load settlements and user drawer
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const list = await salonService.getSettlements(selectedBranchId, undefined, user);
      setSettlements(list || []);

      // Load open drawers for active user
      const drawers = await salonService.getCashDrawers(selectedBranchId, user.id);
      setMyDrawers(drawers || []);
      const openDrawer = drawers.find((d) => d.status === 'OPEN') || drawers[0] || null;
      setActiveDrawer(openDrawer);

      // Fetch custody to get expected cash in drawer
      if (openDrawer) {
        try {
          const res = await salonService.getCashCustodyStatement(
            { branchId: selectedBranchId, userId: user.id, drawerId: openDrawer.id },
            user
          );
          setActiveDrawerExpectedCash(res.summary.expectedCashInCustody || 0);
        } catch {
          setActiveDrawerExpectedCash(openDrawer.expectedInDrawer || 0);
        }
      } else {
        setActiveDrawerExpectedCash(0);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load settlements.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Form Calculations
  const countedNum = parseFloat(countedCashInput) || 0;
  const retainedNum = parseFloat(retainedFloatInput) || 0;
  const handoverNum = Math.max(0, countedNum - retainedNum);
  const varianceNum = countedNum - activeDrawerExpectedCash;

  // Handle inline submit settlement
  const handleInlineSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDrawer) {
      const msg = 'No active cash drawer found for settlement.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (countedNum < 0 || retainedNum < 0) {
      const msg = 'Amounts must be non-negative numbers.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (handoverNum + retainedNum !== countedNum) {
      const msg = 'Handover amount + Retained float must equal total counted cash.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (Math.abs(varianceNum) > 0.001 && !varianceExplanation.trim()) {
      const msg = 'A variance explanation is required for a cash shortage or overage.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: CreateSettlementInput = {
        drawerId: activeDrawer.id,
        branchId: selectedBranchId,
        countedCash: countedNum,
        handoverAmount: handoverNum,
        retainedFloat: retainedNum,
        varianceExplanation: varianceExplanation.trim() || undefined,
        destinationVaultName: 'Main Safe',
        notes: settlementNotes.trim() || undefined,
      };

      await salonService.submitSettlement(payload, user);
      const msg = 'Shift settlement submitted successfully for manager review.';
      setSuccessMessage(msg);
      toast.success(msg);
      setCountedCashInput('');
      setRetainedFloatInput('0');
      setVarianceExplanation('');
      setSettlementNotes('');
      setShowSettleForm(false);
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to submit settlement.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered settlements list
  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      // Role scoping: Cashier sees only their own; Admin sees all
      if (!canReview && s.submittedByUserId !== user.id) {
        return false;
      }

      // Status Filter
      if (selectedStatus !== 'ALL' && s.status !== selectedStatus) {
        return false;
      }

      // Period Filter
      if (selectedPeriod !== 'ALL' && s.date) {
        const today = new Date().toISOString().slice(0, 10);
        if (selectedPeriod === 'TODAY' && s.date !== today) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = s.settlementNumber.toLowerCase().includes(q);
        const matchesSubmitter = (s.submittedByName || '').toLowerCase().includes(q);
        const matchesNotes = (s.notes || '').toLowerCase().includes(q);
        if (!matchesNum && !matchesSubmitter && !matchesNotes) return false;
      }

      return true;
    });
  }, [settlements, canReview, user.id, selectedStatus, selectedPeriod, searchQuery]);

  // Export handlers
  const handleExportExcel = () => {
    const meta: [string, string][] = [
      ['Report', 'Settlement History'],
      ['Period', selectedPeriod],
      ['Status', selectedStatus],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'SUBMITTED AT',
      'STATUS',
      'EXPECTED CASH',
      'COUNTED CASH',
      'DIFFERENCE',
      'CARRIED FORWARD',
      'REASON',
      'SHIFT PERIOD',
    ];

    const rows = filteredSettlements.map((s, idx) => [
      idx + 1,
      s.submittedAt ? new Date(s.submittedAt).toLocaleString() : s.date,
      s.status,
      `PKR ${(s.expectedCash || 0).toLocaleString()}`,
      `PKR ${(s.countedCash || 0).toLocaleString()}`,
      `PKR ${((s as any).difference ?? s.variance ?? 0).toLocaleString()}`,
      `PKR ${(s.retainedFloat || 0).toLocaleString()}`,
      s.notes || s.varianceExplanation || '—',
      s.date || 'Shift',
    ]);

    downloadReportExcel('Settlement_History', meta, [{ headers, rows }]);
  };

  const handleExportCSV = () => {
    const meta: [string, string][] = [
      ['Report', 'Settlement History'],
      ['Period', selectedPeriod],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      '#',
      'Submitted At',
      'Status',
      'Expected Cash',
      'Counted Cash',
      'Difference',
      'Carried Forward',
      'Reason',
      'Date',
    ];

    const rows = filteredSettlements.map((s, idx) => [
      idx + 1,
      s.submittedAt || s.date,
      s.status,
      s.expectedCash,
      s.countedCash,
      (s as any).difference ?? s.variance ?? 0,
      s.retainedFloat || 0,
      s.notes || s.varianceExplanation || '—',
      s.date,
    ]);

    downloadReportCsv('Settlement_History', meta, [{ headers, rows }]);
  };

  const handlePrint = () => {
    window.print();
  };

  // Admin Approve Handler
  const handleApproveSettlement = async () => {
    if (!selectedSettlement) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: ApproveSettlementInput = {
        actualCashReceived: selectedSettlement.handoverAmount,
        destinationVaultId: 'VAULT-MAIN',
        notes: approvalNotes.trim() || undefined,
        acceptVariance: true,
      };
      await salonService.approveSettlement(selectedSettlement.id, payload, user);
      const msg = `Settlement ${selectedSettlement.settlementNumber} approved successfully.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsApproveModalOpen(false);
      setSelectedSettlement(null);
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to approve settlement.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Reject Handler
  const handleRejectSettlement = async () => {
    if (!selectedSettlement) return;
    if (!rejectionReason.trim()) {
      const msg = 'Please provide a reason for rejecting the settlement.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await salonService.rejectSettlement(selectedSettlement.id, rejectionReason.trim(), user);
      const msg = `Settlement ${selectedSettlement.settlementNumber} rejected.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsRejectModalOpen(false);
      setSelectedSettlement(null);
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to reject settlement.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUnsettledCash = activeDrawerExpectedCash > 0;

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800 font-['Inter',sans-serif]">
      {/* 1. Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2545] tracking-tight">
            {canReview ? 'Account Settlements' : 'My Account Settlement'}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Count the cash in your drawer, enter it once, and submit.
          </p>
        </div>

        {/* View Balance Sheet Button */}
        <button
          type="button"
          onClick={() => navigate('/accounts/my-balance-sheet')}
          className="border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs flex items-center gap-2 transition-colors cursor-pointer self-start md:self-auto"
        >
          <FileCheck className="w-4 h-4 text-slate-500" />
          <span>View Balance Sheet</span>
        </button>
      </div>

      {/* 2. Top Card: SETTLE CURRENT SHIFT */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden mb-8">
        <div className="bg-slate-50/80 border-b border-slate-200 px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            SETTLE CURRENT SHIFT
          </h2>
        </div>

        <div className="p-6">
          {!hasUnsettledCash && !showSettleForm ? (
            <div className="py-8 text-center text-slate-500 text-sm font-medium">
              Nothing to settle — you have no unsettled cash right now.
            </div>
          ) : (
            <form onSubmit={handleInlineSubmitSettlement} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Expected Cash in drawer */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                  <span className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Expected Cash in Drawer
                  </span>
                  <span className="text-base font-extrabold text-[#15803D] tabular-nums">
                    {formatPKR(activeDrawerExpectedCash)}
                  </span>
                </div>

                {/* Counted Cash input */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Counted Cash (PKR) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter counted amount"
                    value={countedCashInput}
                    onChange={(e) => setCountedCashInput(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#0D6251]"
                  />
                </div>

                {/* Retained Float input */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Retained Float (PKR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Cash left in drawer (usually 0)"
                    value={retainedFloatInput}
                    onChange={(e) => setRetainedFloatInput(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#0D6251]"
                  />
                </div>

                {/* Handover Amount calculated */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                  <span className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Handover to Safe / Admin
                  </span>
                  <span className="text-base font-extrabold text-[#0047AB] tabular-nums">
                    {formatPKR(handoverNum)}
                  </span>
                </div>
              </div>

              {/* Difference Indicator */}
              {countedCashInput && (
                <div
                  className={`text-xs p-3 rounded-md border flex items-center justify-between ${
                    varianceNum === 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : varianceNum > 0
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <span className="font-semibold">
                    Difference:{' '}
                    {varianceNum === 0
                      ? 'Exact Match (Rs. 0)'
                      : varianceNum > 0
                      ? `Cash Overage (+${formatPKR(varianceNum)})`
                      : `Cash Shortage (-${formatPKR(Math.abs(varianceNum))})`}
                  </span>
                </div>
              )}

              {/* Variance reason if mismatch */}
              {Math.abs(varianceNum) > 0.001 && countedCashInput && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Variance Explanation *
                  </label>
                  <input
                    type="text"
                    placeholder="Reason for cash difference..."
                    value={varianceExplanation}
                    onChange={(e) => setVarianceExplanation(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-800"
                  />
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#0D6251] hover:bg-[#0B5345] text-white text-xs font-semibold px-5 py-2 rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Settlement'}
                </button>
                {showSettleForm && (
                  <button
                    type="button"
                    onClick={() => setShowSettleForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 cursor-pointer font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 3. Bottom Section: Settlement History */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#0B2545] tracking-tight">Settlement History</h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Your submitted settlements and their review status.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-xs mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Period:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white text-slate-700"
            >
              <option value="ALL">All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="bg-[#0D6251] text-white text-xs font-semibold px-4 py-1.5 rounded-md hover:bg-[#0B5345] shadow-xs cursor-pointer"
          >
            Filter
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedPeriod('ALL');
              setSelectedStatus('ALL');
              setSearchQuery('');
            }}
            className="border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-slate-50 shadow-xs cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Green Header Card Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Dark Green Banner */}
        <div className="bg-[#0D6251] text-white px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 opacity-90" />
            <span className="font-bold text-sm tracking-wide">Settlement History</span>
            <span className="bg-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              {selectedPeriod === 'ALL' ? 'All Time' : selectedPeriod}
            </span>
          </div>

          {/* Search & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search in results..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-white text-slate-800 placeholder-slate-400 pl-8 pr-3 py-1.5 rounded-md border-0 focus:outline-hidden focus:ring-1 focus:ring-white w-48"
              />
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-[#107C41] hover:bg-[#0E6837] text-white text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3 h-3" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3 h-3" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="bg-[#475569] hover:bg-[#334155] text-white text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3 h-3" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="report-records w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 text-center w-10">#</th>
                <th className="py-3 px-3.5">SUBMITTED AT ⇅</th>
                <th className="py-3 px-3.5">STATUS ⇅</th>
                <th className="py-3 px-3.5 text-right">EXPECTED CASH ⇅</th>
                <th className="py-3 px-3.5 text-right">COUNTED CASH ⇅</th>
                <th className="py-3 px-3.5 text-right">DIFFERENCE ⇅</th>
                <th className="py-3 px-3.5 text-right">CARRIED FORWARD ⇅</th>
                <th className="py-3 px-3.5">REASON ⇅</th>
                <th className="py-3 px-3.5">SHIFT PERIOD ⇅</th>
                {canReview && <th className="py-3 px-3.5 text-center">ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSettlements.length > 0 ? (
                filteredSettlements.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="py-3 px-3.5 font-medium text-slate-700">
                      {s.submittedAt
                        ? new Date(s.submittedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : s.date}
                    </td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          s.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-semibold text-slate-800 tabular-nums">
                      PKR {(s.expectedCash || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-[#15803D] tabular-nums">
                      PKR {(s.countedCash || 0).toLocaleString()}
                    </td>
                    <td
                      className={`py-3 px-3.5 text-right font-bold tabular-nums ${
                        (((s as any).difference ?? s.variance ?? 0) === 0)
                          ? 'text-slate-500'
                          : (((s as any).difference ?? s.variance ?? 0) > 0)
                          ? 'text-[#0047AB]'
                          : 'text-[#DC2626]'
                      }`}
                    >
                      PKR {((s as any).difference ?? s.variance ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-right font-medium text-slate-700 tabular-nums">
                      PKR {(s.retainedFloat || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 max-w-[200px] truncate" title={s.notes || s.varianceExplanation}>
                      {s.notes || s.varianceExplanation || '—'}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 font-medium">
                      {s.date || 'Current Shift'}
                    </td>
                    {canReview && (
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSettlement(s);
                              setIsViewModalOpen(true);
                            }}
                            className="p-1 hover:bg-slate-100 rounded-sm text-slate-500"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {(s.status === 'SUBMITTED' || s.status === 'PENDING_VERIFICATION') && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSettlement(s);
                                  setIsApproveModalOpen(true);
                                }}
                                className="px-2 py-0.5 bg-emerald-600 text-white rounded-sm text-[11px] font-semibold hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSettlement(s);
                                  setIsRejectModalOpen(true);
                                }}
                                className="px-2 py-0.5 bg-rose-600 text-white rounded-sm text-[11px] font-semibold hover:bg-rose-700"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canReview ? 10 : 9} className="py-12 text-center text-slate-400 font-medium">
                    No settlements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Approve Modal */}
      {isApproveModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">Approve Settlement</h3>
            <p className="text-xs text-slate-500 mb-4">
              Confirm cash handover from {selectedSettlement.submittedByName} for settlement #{selectedSettlement.settlementNumber}.
            </p>
            <div className="bg-slate-50 p-3 rounded-lg mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Handover Amount:</span>
                <span className="font-bold text-slate-800">PKR {selectedSettlement.handoverAmount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Difference:</span>
                <span className="font-bold text-slate-800">PKR {((selectedSettlement as any).difference ?? selectedSettlement.variance ?? 0).toLocaleString()}</span>
              </div>
            </div>
            <textarea
              placeholder="Approval notes / safe receipt remarks..."
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-md p-2.5 mb-4"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSettlement}
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Reject Modal */}
      {isRejectModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl">
            <h3 className="text-base font-bold text-rose-700 mb-2">Reject Settlement</h3>
            <p className="text-xs text-slate-500 mb-4">
              Return settlement #{selectedSettlement.settlementNumber} to cashier for recount or correction.
            </p>
            <textarea
              placeholder="Reason for rejection (e.g. cash count mismatch)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              className="w-full text-xs border border-slate-300 rounded-md p-2.5 mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSettlement}
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs bg-rose-600 text-white rounded-md font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Settlement Modal */}
      {isViewModalOpen && selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Settlement Details ({selectedSettlement.settlementNumber})
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs space-y-2 mb-4">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Submitted By:</span>
                <span className="font-semibold text-slate-800">{selectedSettlement.submittedByName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Expected Cash:</span>
                <span className="font-semibold text-slate-800">PKR {selectedSettlement.expectedCash?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Counted Cash:</span>
                <span className="font-semibold text-emerald-700">PKR {selectedSettlement.countedCash?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Difference:</span>
                <span className="font-semibold text-slate-800">PKR {((selectedSettlement as any).difference ?? selectedSettlement.variance ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Handover to Safe:</span>
                <span className="font-semibold text-blue-700">PKR {selectedSettlement.handoverAmount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-slate-800">{selectedSettlement.status}</span>
              </div>
              {selectedSettlement.notes && (
                <div className="py-1">
                  <span className="text-slate-500 block mb-0.5">Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded-sm">{selectedSettlement.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-1.5 text-xs bg-slate-200 text-slate-700 rounded-md font-semibold hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettlementPage;
