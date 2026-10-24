import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import {
  CommissionRun,
  CommissionStatementRecord,
  StaffMember,
  OnlineAccount,
  CashDrawer,
  CommissionAttributionLine,
} from '../../types/salon';
import {
  Award,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileSpreadsheet,
  Eye,
  CreditCard,
  Ban,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  History,
  X,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { roundCurrency } from '../../lib/taxCalculations';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';
import { toast } from '../../context/ToastContext';
import { BranchActionField } from '@/components/BranchActionField';
import { useBranchAction } from '@/hooks/useBranchAction';

const loadCommissionStaff = (branchId: string) => salonService.getStaff(branchId);

export const StaffCommissionPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin and Admin only (Accountant and Staff denied)
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/accounts/commission" />;
  }

  const todayStr = demoDate || new Date().toISOString().slice(0, 10);
  const monthStartStr = `${todayStr.slice(0, 7)}-01`;

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [commissionRuns, setCommissionRuns] = useState<CommissionRun[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [onlineAccounts, setOnlineAccounts] = useState<OnlineAccount[]>([]);
  const [cashDrawers, setCashDrawers] = useState<CashDrawer[]>([]);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user.role === 'SUPER_ADMIN' ? (activeBranchId === 'ALL' ? (allBranches[0]?.id || '') : activeBranchId) : (user.branchId || '')
  );
  const [startDate, setStartDate] = useState<string>(monthStartStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Active Draft Run (preview currently being inspected / generated)
  const [activeDraft, setActiveDraft] = useState<CommissionRun | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<CommissionStatementRecord | null>(null);

  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generationStaffId, setGenerationStaffId] = useState('ALL');
  const generationScope = useBranchAction(showGenerateForm, loadCommissionStaff);
  const [showBreakdownModal, setShowBreakdownModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // Payment Form
  const [paymentTargetRun, setPaymentTargetRun] = useState<CommissionRun | null>(null);
  const [paymentTargetStatement, setPaymentTargetStatement] = useState<CommissionStatementRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'CASH' as 'CASH' | 'ONLINE',
    onlineAccountId: '',
    reference: '',
  });

  // Cancel / Reversal Form
  const [cancelReason, setCancelReason] = useState<string>('');
  const [runToCancel, setRunToCancel] = useState<CommissionRun | null>(null);
  const [paymentToReverse, setPaymentToReverse] = useState<{ id: string; amount: number; staffName: string } | null>(null);
  const [reverseReason, setReverseReason] = useState<string>('');

  // Action feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const effectiveBranchId = user.role === 'SUPER_ADMIN' ? selectedBranchId : (user.branchId || activeBranchId);

  // Fetch all initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const [runs, staff, accounts, drawers] = await Promise.all([
        salonService.getCommissionRuns(effectiveBranchId, user),
        salonService.getStaff(effectiveBranchId),
        salonService.getOnlineAccounts(effectiveBranchId),
        salonService.getCashDrawers(effectiveBranchId),
      ]);

      setCommissionRuns(runs);
      setStaffList(staff);
      setOnlineAccounts(accounts);
      setCashDrawers(drawers);
    } catch (err: any) {
      const msg = err.message || 'Failed to load commission data.';
      setFeedback({ type: 'error', message: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role === 'SUPER_ADMIN') {
      if (activeBranchId !== 'ALL' && activeBranchId) {
        setSelectedBranchId(activeBranchId);
      } else if (!selectedBranchId && allBranches.length > 0) {
        setSelectedBranchId(allBranches[0].id);
      }
    }
  }, [activeBranchId, allBranches, user.role]);

  useEffect(() => {
    if (effectiveBranchId) {
      loadData();
    }
  }, [effectiveBranchId]);

  // Derived Statistics
  const summaryStats = useMemo(() => {
    let eligibleNetSales = 0;
    let finalizedCommission = 0;
    let paid = 0;
    let outstanding = 0;

    commissionRuns
      .filter((r) => r.status !== 'CANCELLED' && r.status !== 'DRAFT')
      .forEach((r) => {
        finalizedCommission += r.totalCommissionPayable;
        paid += r.totalPaid;
        outstanding += r.totalOutstanding;
        r.statements.forEach((s) => {
          eligibleNetSales += s.attributedNetSales;
        });
      });

    return {
      eligibleNetSales: roundCurrency(eligibleNetSales),
      finalizedCommission: roundCurrency(finalizedCommission),
      paid: roundCurrency(paid),
      outstanding: roundCurrency(outstanding),
    };
  }, [commissionRuns]);

  // Filtered runs for table
  const displayRuns = useMemo(() => {
    return commissionRuns.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [commissionRuns, statusFilter]);

  // Open drawer check
  const activeUserOpenDrawer = useMemo(() => {
    return cashDrawers.find(
      (d) => d.branchId === effectiveBranchId && d.custodianUserId === user.id && d.status === 'OPEN'
    );
  }, [cashDrawers, effectiveBranchId, user.id]);

  // Generate Draft Preview
  const handleGeneratePreview = async () => {
    if (user.role === 'SUPER_ADMIN' && !generationScope.validate()) return;
    try {
      setActionLoading(true);
      setFeedback(null);
      const preview = await salonService.generateCommissionPreview(
        user.role === 'SUPER_ADMIN' ? generationScope.branchId : effectiveBranchId,
        startDate,
        endDate,
        user.role === 'SUPER_ADMIN'
          ? (generationStaffId !== 'ALL' ? generationStaffId : undefined)
          : (staffFilter !== 'ALL' ? staffFilter : undefined),
        user
      );
      setActiveDraft(preview);
      setShowGenerateForm(false);
      setShowPreviewModal(true);
      toast.success(`Draft preview generated for ${preview.statements.length} staff member(s)!`);
    } catch (err: any) {
      const msg = err.message || 'Failed to generate commission preview.';
      setFeedback({ type: 'error', message: msg });
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Finalize Draft Commission
  const handleFinalizeCommission = async () => {
    if (!activeDraft) return;
    try {
      setActionLoading(true);
      setFeedback(null);
      const finalized = await salonService.finalizeCommission(activeDraft.id, user);
      const msg = `Commission Run ${finalized.commissionNumber} successfully finalized! Total payable: Rs. ${finalized.totalCommissionPayable.toLocaleString()}. Service attributions locked.`;
      setFeedback({
        type: 'success',
        message: msg,
      });
      toast.success(msg);
      setShowPreviewModal(false);
      setActiveDraft(null);
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to finalize commission run.';
      setFeedback({ type: 'error', message: msg });
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Payment Modal
  const openPaymentModal = (run: CommissionRun, st?: CommissionStatementRecord) => {
    setPaymentTargetRun(run);
    const targetStatement = st || run.statements.find((s) => s.outstandingAmount > 0 && !s.payrollPayslipId);
    if (!targetStatement || targetStatement.payrollPayslipId) {
      toast.error('Commission included in payroll must be paid through its payslip.');
      return;
    }
    setPaymentTargetStatement(targetStatement);
    setPaymentForm({
      amount: targetStatement ? targetStatement.outstandingAmount : 0,
      method: 'CASH',
      onlineAccountId: onlineAccounts[0]?.id || '',
      reference: `Commission payment for ${targetStatement?.staffName || 'staff'} (${run.startDate} to ${run.endDate})`,
    });
    setShowPaymentModal(true);
  };

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetRun || !paymentTargetStatement) return;

    if (paymentForm.amount <= 0 || paymentForm.amount > paymentTargetStatement.outstandingAmount) {
      const msg = `Payment amount must be between 1 and ${paymentTargetStatement.outstandingAmount.toLocaleString()}`;
      setFeedback({ type: 'error', message: msg });
      toast.error(msg);
      return;
    }

    try {
      setActionLoading(true);
      setFeedback(null);
      await salonService.recordCommissionPayment(
        {
          commissionRunId: paymentTargetRun.id,
          statementId: paymentTargetStatement.id,
          amount: paymentForm.amount,
          method: paymentForm.method,
          onlineAccountId: paymentForm.method === 'ONLINE' ? paymentForm.onlineAccountId : undefined,
          reference: paymentForm.reference,
        },
        user
      );

      const msg = `Successfully paid Rs. ${paymentForm.amount.toLocaleString()} commission to ${paymentTargetStatement.staffName}!`;
      setFeedback({
        type: 'success',
        message: msg,
      });
      toast.success(msg);
      setShowPaymentModal(false);
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Commission payment failed.';
      setFeedback({ type: 'error', message: msg });
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Run
  const handleCancelRun = async () => {
    if (!runToCancel || !cancelReason.trim()) {
      toast.error('Please specify a cancellation reason.');
      return;
    }
    try {
      setActionLoading(true);
      await salonService.cancelCommissionRun(runToCancel.id, cancelReason, user);
      const msg = `Commission Run ${runToCancel.commissionNumber} cancelled and sales attributions unlocked.`;
      setFeedback({
        type: 'success',
        message: msg,
      });
      toast.success(msg);
      setShowCancelModal(false);
      setRunToCancel(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to cancel commission run.';
      setFeedback({ type: 'error', message: msg });
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Reverse Payment
  const handleReversePayment = async () => {
    if (!paymentToReverse || !reverseReason.trim()) {
      toast.error('Please specify a reason for payment reversal.');
      return;
    }
    try {
      setActionLoading(true);
      await salonService.reverseCommissionPayment(paymentToReverse.id, reverseReason, user);
      const msg = `Commission payment of Rs. ${paymentToReverse.amount.toLocaleString()} reversed. Funds restored to source.`;
      setFeedback({
        type: 'success',
        message: msg,
      });
      toast.success(msg);
      setPaymentToReverse(null);
      setReverseReason('');
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to reverse commission payment.';
      setFeedback({ type: 'error', message: msg });
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = (run: CommissionRun) => {
    const headers = [
      'Statement Number',
      'Employee Code',
      'Staff Name',
      'Compensation Type',
      'Commission Rate (%)',
      'Attributed Net Sales',
      'Gross Commission',
      'Refund Adjustments',
      'Net Commission Payable',
      'Paid Amount',
      'Outstanding',
      'Status',
    ];

    const rows = run.statements.map((s) => [
      s.statementNumber,
      s.employeeCode,
      `"${s.staffName}"`,
      s.compensationType,
      s.commissionRatePercent,
      s.attributedNetSales,
      s.grossCommissionEarned,
      s.refundAdjustments,
      s.netCommissionPayable,
      s.paidAmount,
      s.outstandingAmount,
      s.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Commission_${run.commissionNumber}_${run.startDate}_to_${run.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Commission Management</h1>
              <p className="text-sm text-slate-500">
                Service attributions, package component revenue shares, and auditable disbursements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => user.role === 'SUPER_ADMIN' ? setShowGenerateForm(true) : handleGeneratePreview()}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl text-sm shadow-sm transition-all hover:shadow"
          >
            <Calendar className="w-4 h-4" />
            Generate Commission Preview
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <p className="font-medium">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Eligible Net Sales</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              Rs. {summaryStats.eligibleNetSales.toLocaleString()}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
              After Discounts
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Excludes sales taxes, tips & product sales</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Finalized Commission</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-purple-600">
              Rs. {summaryStats.finalizedCommission.toLocaleString()}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
              Earned
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Net payable after void/refund adjustments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Commission Paid</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600">Rs. {summaryStats.paid.toLocaleString()}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              Disbursed
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Audited disbursements via Drawer/Bank</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Commission</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">
              Rs. {summaryStats.outstanding.toLocaleString()}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              Pending Payout
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Balance awaiting staff payout</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Filter className="w-4 h-4 text-purple-600" />
          <span>Commission Run Filters & Date Range</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          {user.role === 'SUPER_ADMIN' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
              >
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commission Month</label>
            <input
              type="month"
              value={startDate.slice(0, 7) === endDate.slice(0, 7) ? startDate.slice(0, 7) : ''}
              onChange={(e) => {
                // Monthly commission run: 1st .. last day of the chosen month.
                const m = e.target.value;
                if (!m) return;
                const [y, mo] = m.split('-').map(Number);
                setStartDate(`${m}-01`);
                setEndDate(`${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`);
              }}
              className="w-full text-sm border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Employee</label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Eligible Staff</option>
              {staffList
                .filter(
                  (s) =>
                    s.compensationType === 'MONTHLY_PLUS_COMMISSION' ||
                    s.compensationType === 'DAILY_PLUS_COMMISSION' ||
                    s.compensationType === 'COMMISSION_ONLY'
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.commissionRate}%)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Run Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-sm border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="FINALIZED">Finalized</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Commission Runs List */}
      <div className="space-y-6">
        {displayRuns.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Finalized Commission Runs Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Generate a commission preview to calculate net service sales, multi-staff package allocations, and lock
              sales attributions into an auditable run.
            </p>
            <button
              onClick={() => user.role === 'SUPER_ADMIN' ? setShowGenerateForm(true) : handleGeneratePreview()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl text-sm"
            >
              Generate Preview for Date Range
            </button>
          </div>
        ) : (
          displayRuns.map((run) => (
            <div key={run.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Run Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-slate-900">{run.commissionNumber}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        run.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : run.status === 'PARTIALLY_PAID'
                          ? 'bg-amber-100 text-amber-800'
                          : run.status === 'FINALIZED'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {run.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      Period: {run.startDate} to {run.endDate} ({run.branchName})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Finalized by {run.finalizedByName} on {new Date(run.finalizedAt || '').toLocaleDateString()} • Basis: Completed Service Invoices
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleExportCSV(run)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium shadow-sm"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    CSV Export
                  </button>

                  <button
                    onClick={() => openPaymentModal(run)}
                    disabled={run.status === 'PAID' || run.status === 'CANCELLED'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Record Payout
                  </button>

                  {run.status !== 'CANCELLED' && (
                    <button
                      onClick={() => {
                        setRunToCancel(run);
                        setShowCancelModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancel Run
                    </button>
                  )}
                </div>
              </div>

              {/* Table of Commission Statements */}
              <div className="overflow-x-auto">
                <table className="report-records w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-3">Comp Type</th>
                      <th className="py-3 px-3 text-center">Comm. Rate</th>
                      <th className="py-3 px-3 text-right">Attributed Net Sales</th>
                      <th className="py-3 px-3 text-right">Gross Earned</th>
                      <th className="py-3 px-3 text-right">Refund Adj.</th>
                      <th className="py-3 px-3 text-right font-bold text-purple-700">Net Payable</th>
                      <th className="py-3 px-3 text-right text-emerald-600">Paid</th>
                      <th className="py-3 px-3 text-right text-amber-600">Outstanding</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {run.statements
                      .filter((s) => (staffFilter === 'ALL' ? true : s.staffId === staffFilter))
                      .map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{st.staffName}</div>
                            <div className="text-[11px] text-slate-400">{st.employeeCode} • {st.designation}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                              {st.compensationType.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-800">
                            {st.commissionRatePercent}%
                          </td>
                          <td className="py-3 px-3 text-right text-slate-800 font-medium">
                            Rs. {st.attributedNetSales.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-purple-600 font-medium">
                            Rs. {st.grossCommissionEarned.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-600">
                            {st.refundAdjustments !== 0 ? `Rs. ${st.refundAdjustments.toLocaleString()}` : '0'}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            Rs. {st.netCommissionPayable.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                            Rs. {st.paidAmount.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-amber-600">
                            Rs. {st.outstandingAmount.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                st.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : st.status === 'PARTIALLY_PAID'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {st.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedStatement(st);
                                  setShowBreakdownModal(true);
                                }}
                                title="View Attributed Sales Breakdown"
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-lg"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedStatement(st);
                                  setShowPrintModal(true);
                                }}
                                title="Print Commission Statement"
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {st.payrollPayslipId && <span className="text-[10px] text-indigo-600">Included in Payroll</span>}
                              {st.outstandingAmount > 0 && !st.payrollPayslipId && run.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => openPaymentModal(run, st)}
                                  title="Pay Commission"
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </button>
                              )}

                              {(st.payments || []).length > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedStatement(st);
                                    setPaymentTargetRun(run);
                                    setShowHistoryModal(true);
                                  }}
                                  title="Payout History & Reversals"
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PREVIEW & FINALIZATION MODAL                                     */}
      {/* ========================================================================= */}
      {showGenerateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form role="dialog" aria-modal="true" aria-label="Generate commission" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" onSubmit={(event) => { event.preventDefault(); handleGeneratePreview(); }}>
            <h2 className="text-lg font-bold text-slate-900">Generate Commission</h2>
            <p className="text-xs text-slate-500">Period: {startDate} to {endDate}</p>
            <BranchActionField value={generationScope.branchId} disabled={actionLoading} onChange={(id) => { generationScope.setBranchId(id); setGenerationStaffId('ALL'); }} />
            {generationScope.error && <p role="alert" className="text-xs text-rose-600">{generationScope.error}</p>}
            <label className="block space-y-1 text-xs font-medium text-slate-700">
              <span>Employee</span>
              <select value={generationStaffId} disabled={!generationScope.ready || actionLoading} onChange={(event) => setGenerationStaffId(event.target.value)} className="w-full rounded-lg border border-slate-200 p-2 text-sm">
                <option value="ALL">All employees in this branch</option>
                {generationScope.data?.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={actionLoading} onClick={() => setShowGenerateForm(false)} className="rounded-lg border px-4 py-2 text-xs">Cancel</button>
              <button type="submit" disabled={!generationScope.ready || actionLoading} className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{actionLoading ? 'Generating...' : 'Generate Preview'}</button>
            </div>
          </form>
        </div>
      )}
      {showPreviewModal && activeDraft && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Commission Preview: {activeDraft.startDate} to {activeDraft.endDate}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Evaluated from completed POS service invoices. Dues collections and uncompleted services excluded. Money does not move.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="report-records w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-2 text-center">Comm. Rate</th>
                      <th className="py-2.5 px-3 text-right">Attributed Net Sales</th>
                      <th className="py-2.5 px-3 text-right">Gross Commission</th>
                      <th className="py-2.5 px-3 text-right">Refund Adjustments</th>
                      <th className="py-2.5 px-3 text-right font-bold text-purple-700">Net Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeDraft.statements.map((s) => (
                      <tr key={s.staffId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{s.staffName}</div>
                          <div className="text-[10px] text-slate-400">{s.employeeCode}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                            {s.compensationType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-semibold text-slate-800">
                          {s.commissionRatePercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">Rs. {s.attributedNetSales.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-purple-600">Rs. {s.grossCommissionEarned.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-rose-600">
                          {s.refundAdjustments !== 0 ? `Rs. ${s.refundAdjustments.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          Rs. {s.netCommissionPayable.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-end">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 w-72 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Staff Eligible:</span>
                    <span className="font-semibold text-slate-900">{activeDraft.statements.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Eligible Sales:</span>
                    <span className="font-semibold text-slate-900">
                      Rs.{' '}
                      {activeDraft.statements
                        .reduce((sum, s) => sum + s.attributedNetSales, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total Net Commission:</span>
                    <span className="text-purple-600">Rs. {activeDraft.totalCommissionPayable.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Finalizing will lock all attributed invoice items with this run ID, preventing double-commissioning.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-medium"
                >
                  Close
                </button>
                <button
                  onClick={handleFinalizeCommission}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Finalize & Lock Commission Run
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ATTRIBUTED SALES BREAKDOWN MODAL                                 */}
      {/* ========================================================================= */}
      {showBreakdownModal && selectedStatement && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Attributed Sales Breakdown: {selectedStatement.staffName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedStatement.statementNumber} • Rate: {selectedStatement.commissionRatePercent}% • Attributed Net Sales: Rs.{' '}
                  {selectedStatement.attributedNetSales.toLocaleString()}
                </p>
              </div>
              <button onClick={() => setShowBreakdownModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="report-records w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Invoice</th>
                      <th className="py-2.5 px-3">Service / Component</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Gross Price</th>
                      <th className="py-2.5 px-3 text-right">Discount</th>
                      <th className="py-2.5 px-3 text-right font-medium">Net Sales</th>
                      <th className="py-2.5 px-3 text-right font-bold text-purple-700">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedStatement.lineItems || selectedStatement.attributionLines || []).map((line: CommissionAttributionLine) => (
                      <tr key={line.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-slate-600">{line.date}</td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-800">{line.invoiceNumber}</td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-900">{line.serviceOrPackageName}</span>
                          {line.isPackageComponent && (
                            <span className="block text-[10px] text-purple-600">
                              Part of Package: {line.componentPackageName}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                            {line.isPackageComponent ? 'Package Comp.' : 'Direct Service'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">Rs. {line.cataloguePrice.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-rose-600">
                          {line.discountAllocation > 0 ? `-Rs. ${line.discountAllocation.toLocaleString()}` : '0'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          Rs. {line.netAttributedAmount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-purple-700">
                          Rs. {line.commissionEarned.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                Total Attributed Items: {(selectedStatement.lineItems || selectedStatement.attributionLines || []).length}
              </span>
              <button
                onClick={() => setShowBreakdownModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RECORD PAYMENT MODAL                                             */}
      {/* ========================================================================= */}
      {showPaymentModal && paymentTargetStatement && paymentTargetRun && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Disburse Commission Payout</h3>
                  <p className="text-xs text-slate-500">
                    Pay {paymentTargetStatement.staffName} ({paymentTargetStatement.employeeCode})
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex justify-between items-center text-amber-900">
                <span>Outstanding Commission:</span>
                <span className="text-sm font-bold">
                  Rs. {paymentTargetStatement.outstandingAmount.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Disbursement Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, method: 'CASH' })}
                    className={`p-3 rounded-xl border text-center font-medium transition-all ${
                      paymentForm.method === 'CASH'
                        ? 'border-purple-600 bg-purple-50/50 text-purple-700 ring-2 ring-purple-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    💵 Cash (Open Drawer)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, method: 'ONLINE' })}
                    className={`p-3 rounded-xl border text-center font-medium transition-all ${
                      paymentForm.method === 'ONLINE'
                        ? 'border-purple-600 bg-purple-50/50 text-purple-700 ring-2 ring-purple-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    🏦 Bank / Online Account
                  </button>
                </div>
              </div>

              {paymentForm.method === 'CASH' ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Custodian Drawer:</span>
                    <span className="font-semibold text-slate-800">
                      {activeUserOpenDrawer ? `${user.name} (OPEN)` : 'No Open Drawer!'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Available Cash in Drawer:</span>
                    <span
                      className={`font-bold ${
                        (activeUserOpenDrawer?.expectedInDrawer || 0) < paymentForm.amount
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      Rs. {(activeUserOpenDrawer?.expectedInDrawer || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Select Bank / Online Account</label>
                  <select
                    value={paymentForm.onlineAccountId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, onlineAccountId: e.target.value })}
                    className="w-full border-slate-200 rounded-xl px-3 py-2 text-xs bg-slate-50"
                  >
                    {onlineAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountName} (Bal: Rs. {b.currentBalance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-medium mb-1">Payment Amount (Rs.)</label>
                <input
                  type="number"
                  min="1"
                  max={paymentTargetStatement.outstandingAmount}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Reference / Voucher Note</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="e.g. Commission payout round 1"
                  className="w-full border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    actionLoading ||
                    (paymentForm.method === 'CASH' &&
                      (!activeUserOpenDrawer || activeUserOpenDrawer.expectedInDrawer < paymentForm.amount))
                  }
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PAYMENT HISTORY & REVERSAL MODAL                                 */}
      {/* ========================================================================= */}
      {showHistoryModal && selectedStatement && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Commission Payout History: {selectedStatement.staffName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedStatement.statementNumber} • Total Paid: Rs. {selectedStatement.paidAmount.toLocaleString()}
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              {selectedStatement.payments.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No disbursements recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {selectedStatement.payments.map((pmt) => (
                    <div
                      key={pmt.id}
                      className={`p-4 rounded-xl border flex items-center justify-between ${
                        pmt.status === 'REVERSED'
                          ? 'bg-rose-50/50 border-rose-100 opacity-75'
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">Rs. {pmt.amount.toLocaleString()}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              pmt.status === 'REVERSED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {pmt.status}
                          </span>
                          <span className="text-slate-400">via {pmt.method}</span>
                        </div>
                        <p className="text-slate-500 text-[11px]">
                          Payer: {pmt.paidByName} | Ref: {pmt.paymentNumber} ({new Date(pmt.paidAt).toLocaleString()})
                        </p>
                        {pmt.status === 'REVERSED' && (
                          <p className="text-rose-600 text-[11px] font-medium">
                            Reversed by {pmt.reversedByName} on {new Date(pmt.reversedAt || '').toLocaleString()}:{' '}
                            {pmt.reversalReason}
                          </p>
                        )}
                      </div>

                      {pmt.status === 'COMPLETED' && !selectedStatement.payrollPayslipId && (
                        <button
                          onClick={() => {
                            setPaymentToReverse({
                              id: pmt.id,
                              amount: pmt.amount,
                              staffName: selectedStatement.staffName,
                            });
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reverse
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {paymentToReverse && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <h4 className="font-bold text-rose-900 text-sm">
                    Confirm Reversal of Rs. {paymentToReverse.amount.toLocaleString()}
                  </h4>
                  <div>
                    <label className="block text-rose-900 font-medium mb-1">Reason for Reversal *</label>
                    <input
                      type="text"
                      value={reverseReason}
                      onChange={(e) => setReverseReason(e.target.value)}
                      placeholder="e.g. Duplicate payout voucher"
                      className="w-full border-rose-300 rounded-xl px-3 py-2 text-xs"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setPaymentToReverse(null)}
                      className="px-3 py-1.5 border border-rose-300 text-rose-800 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReversePayment}
                      disabled={actionLoading || !reverseReason.trim()}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm"
                    >
                      Confirm Reversal
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CANCEL COMMISSION RUN MODAL                                      */}
      {/* ========================================================================= */}
      {showCancelModal && runToCancel && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancel Commission Run</h3>
                <p className="text-slate-500">{runToCancel.commissionNumber}</p>
              </div>
            </div>

            <p className="text-slate-600">
              Cancelling releases all consumed invoice service attribution IDs so they can be re-evaluated in a future run.
              Runs with active payments must have payments reversed first.
            </p>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Cancellation Reason *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Sales attribution adjustments required"
                rows={3}
                className="w-full border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setRunToCancel(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-medium"
              >
                Back
              </button>
              <button
                onClick={handleCancelRun}
                disabled={actionLoading || !cancelReason.trim()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-sm"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: PRINT STATEMENT MODAL                                            */}
      {/* ========================================================================= */}
      {showPrintModal && selectedStatement && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="font-bold text-slate-800 text-sm">Official Commission Statement</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Now
                </button>
                <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-xs bg-white text-slate-900" id="printable-statement">
              <div className="text-center pb-4 border-b border-slate-200">
                <h2 className="text-lg font-bold tracking-tight">SALON OS MANAGEMENT</h2>
                <p className="text-xs text-slate-500">Official Staff Commission Statement</p>
                <div className="mt-2 inline-block px-3 py-1 bg-purple-50 text-purple-700 rounded-full font-semibold">
                  Statement Ref: {selectedStatement.statementNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Staff Member</span>
                  <p className="font-bold text-sm text-slate-900">{selectedStatement.staffName}</p>
                  <p className="text-slate-600">{selectedStatement.employeeCode} • {selectedStatement.designation}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase">Effective Rate</span>
                  <p className="font-bold text-purple-700 text-base">{selectedStatement.commissionRatePercent}%</p>
                  <p className="text-slate-600">Status: {selectedStatement.status}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Attributed Net Service Sales</span>
                  <span className="font-semibold text-slate-900">
                    Rs. {selectedStatement.attributedNetSales.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Gross Commission Earned</span>
                  <span className="font-semibold text-purple-700">
                    Rs. {selectedStatement.grossCommissionEarned.toLocaleString()}
                  </span>
                </div>
                {selectedStatement.refundAdjustments !== 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                    <span>Refund & Void Adjustments</span>
                    <span className="font-semibold">Rs. {selectedStatement.refundAdjustments.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-2 flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-900">
                  <span>Net Commission Payable</span>
                  <span className="text-purple-700">Rs. {selectedStatement.netCommissionPayable.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-500 pt-1">
                  <span>Total Paid: Rs. {selectedStatement.paidAmount.toLocaleString()}</span>
                  <span>Outstanding: Rs. {selectedStatement.outstandingAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                Attributed service sales reflect completed POS invoices after promotional discounts. Tax and customer tips excluded.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
