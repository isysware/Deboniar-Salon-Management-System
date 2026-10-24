import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService } from '../../services';
import {
  TipReceiptRecord,
  TipAllocationRecord,
  TipPayoutRecord,
  Branch,
  StaffMember,
  PaymentAccount,
  CashDrawer,
  TipAllocationType,
} from '../../types/salon';
import {
  Coins,
  Wallet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Search,
  Calendar,
  RotateCcw,
  Printer,
  Download,
  Plus,
  AlertCircle,
  Building2,
  Users,
  CreditCard,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Receipt,
  Eye,
  FileText,
} from 'lucide-react';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';

function formatCurrency(val: number): string {
  return `PKR ${val.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export const TipsManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  // Role guard: Super Admin and Branch Admin only. Accountant and Staff strictly denied.
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/accounts/tips-management" />;
  }

  // Branch and filter states
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user.role === 'ADMIN' ? user.branchId || '' : 'ALL'
  );
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [cashDrawers, setCashDrawers] = useState<CashDrawer[]>([]);

  // Main data states
  const [receipts, setReceipts] = useState<TipReceiptRecord[]>([]);
  const [allocations, setAllocations] = useState<TipAllocationRecord[]>([]);
  const [payouts, setPayouts] = useState<TipPayoutRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'RECEIPTS' | 'ALLOCATIONS' | 'PAYOUTS'>('RECEIPTS');

  // Filter criteria
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showAllocateModal, setShowAllocateModal] = useState<boolean>(false);
  const [selectedReceiptForAllocation, setSelectedReceiptForAllocation] = useState<TipReceiptRecord | null>(null);

  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [selectedAllocationForPayout, setSelectedAllocationForPayout] = useState<TipAllocationRecord | null>(null);

  const [showReverseModal, setShowReverseModal] = useState<boolean>(false);
  const [selectedPayoutForReverse, setSelectedPayoutForReverse] = useState<TipPayoutRecord | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalReceivingDrawerId, setReversalReceivingDrawerId] = useState<string>('');

  const [showCancelAllocationModal, setShowCancelAllocationModal] = useState<boolean>(false);
  const [selectedAllocationForCancel, setSelectedAllocationForCancel] = useState<TipAllocationRecord | null>(null);
  const [cancelAllocationReason, setCancelAllocationReason] = useState<string>('');

  const [showPrintVoucherModal, setShowPrintVoucherModal] = useState<boolean>(false);
  const [voucherData, setVoucherData] = useState<{ type: 'PAYOUT' | 'RECEIPT'; record: any } | null>(null);

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Allocation Modal Form State
  const [allocType, setAllocType] = useState<TipAllocationType>('DIRECT');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [allocationNotes, setAllocationNotes] = useState<string>('');
  const [isSubmittingAlloc, setIsSubmittingAlloc] = useState<boolean>(false);

  // Payout Modal Form State
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [selectedOnlineAccountId, setSelectedOnlineAccountId] = useState<string>('');
  const [payoutReference, setPayoutReference] = useState<string>('');
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState<boolean>(false);

  // Load auxiliary data on mount
  useEffect(() => {
    const loadAux = async () => {
      try {
        const [bList, sList, dList] = await Promise.all([
          salonService.getBranches(),
          salonService.getStaff('ALL'),
          salonService.getCashDrawers('ALL'),
        ]);
        setBranches(bList);
        setStaffList(sList);
        setCashDrawers(dList);
      } catch (err) {
        console.error('Failed to load auxiliary data', err);
      }
    };
    loadAux();
  }, []);

  // Refresh tip data
  const loadTipData = async () => {
    try {
      setLoading(true);
      const [recs, allocs, pays, accs] = await Promise.all([
        salonService.getTipReceipts(selectedBranchId, undefined, user),
        salonService.getTipAllocations(selectedBranchId, undefined, user),
        salonService.getTipPayouts(selectedBranchId, undefined, user),
        salonService.getPaymentAccounts(selectedBranchId),
      ]);
      setReceipts(recs);
      setAllocations(allocs);
      setPayouts(pays);
      setPaymentAccounts(accs);
    } catch (err: any) {
      console.error('Failed to load tip data', err);
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to load tip collections.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTipData();
  }, [selectedBranchId, user]);

  // Active Open Drawer for current user
  const myOpenDrawer = useMemo(() => {
    const targetBranch = selectedBranchId === 'ALL' ? (user.role === 'ADMIN' ? user.branchId : branches[0]?.id) : selectedBranchId;
    return cashDrawers.find(
      (d) => d.branchId === targetBranch && d.custodianUserId === user.id && d.status === 'OPEN'
    );
  }, [cashDrawers, selectedBranchId, user]);

  // Overall Summary Metrics
  const summaryMetrics = useMemo(() => {
    const netCollected = receipts.reduce((sum, r) => sum + r.allocatedAmount + r.unallocatedAmount, 0);
    const unallocated = receipts.reduce((sum, r) => sum + r.unallocatedAmount, 0);
    const allocatedUnpaid = allocations
      .filter((a) => a.status !== 'CANCELLED')
      .reduce((sum, a) => sum + a.outstandingAmount, 0);
    const paid = payouts
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      netCollected,
      unallocated,
      allocatedUnpaid,
      paid: Math.max(0, paid),
    };
  }, [receipts, allocations, payouts]);

  // Filtered Receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (startDate && r.collectionDate < startDate) return false;
      if (endDate && r.collectionDate > endDate) return false;
      if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (staffFilter !== 'ALL' && r.directStaffId !== staffFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.receiptNumber.toLowerCase().includes(q) ||
          r.invoiceNumber.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (r.directStaffName && r.directStaffName.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [receipts, startDate, endDate, methodFilter, statusFilter, staffFilter, searchQuery]);

  // Filtered Allocations
  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (startDate && a.allocationDate < startDate) return false;
      if (endDate && a.allocationDate > endDate) return false;
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (staffFilter !== 'ALL' && a.staffId !== staffFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          a.allocationNumber.toLowerCase().includes(q) ||
          a.tipReceiptNumber.toLowerCase().includes(q) ||
          a.invoiceNumber.toLowerCase().includes(q) ||
          a.staffName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allocations, startDate, endDate, statusFilter, staffFilter, searchQuery]);

  // Filtered Payouts
  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      if (startDate && p.payoutDate < startDate) return false;
      if (endDate && p.payoutDate > endDate) return false;
      if (methodFilter !== 'ALL' && (p.method === 'ONLINE' ? 'ONLINE_ACCOUNT' : p.method) !== methodFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (staffFilter !== 'ALL' && p.staffId !== staffFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.payoutNumber.toLowerCase().includes(q) ||
          p.allocationNumber.toLowerCase().includes(q) ||
          p.staffName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [payouts, startDate, endDate, methodFilter, statusFilter, staffFilter, searchQuery]);

  // Open Allocation Modal
  const handleOpenAllocate = (receipt: TipReceiptRecord) => {
    setSelectedReceiptForAllocation(receipt);
    setAllocType('DIRECT');
    setAllocationNotes('');
    setFeedbackMessage(null);

    if (receipt.directStaffId) {
      setSelectedStaffIds([receipt.directStaffId]);
      setCustomAmounts({ [receipt.directStaffId]: receipt.unallocatedAmount });
    } else {
      setSelectedStaffIds([]);
      setCustomAmounts({});
    }

    setShowAllocateModal(true);
  };

  // Submit Allocation
  const handleSubmitAllocation = async () => {
    if (!selectedReceiptForAllocation) return;

    try {
      setIsSubmittingAlloc(true);
      setFeedbackMessage(null);

      if (selectedStaffIds.length === 0) {
        throw new Error('Please select at least one staff member to allocate tips.');
      }

      let recipientsPayload: Array<{ staffId: string; amount: number }> = [];

      if (allocType === 'DIRECT') {
        const staffId = selectedStaffIds[0];
        recipientsPayload = [
          {
            staffId,
            amount: selectedReceiptForAllocation.unallocatedAmount,
          },
        ];
      } else if (allocType === 'POOLED_EQUAL') {
        const totalCents = Math.round(selectedReceiptForAllocation.unallocatedAmount * 100);
        const count = selectedStaffIds.length;
        const baseCents = Math.floor(totalCents / count);
        const remainder = totalCents % count;

        recipientsPayload = selectedStaffIds.map((sId, idx) => {
          const cents = idx < remainder ? baseCents + 1 : baseCents;
          return {
            staffId: sId,
            amount: cents / 100,
          };
        });
      } else if (allocType === 'POOLED_CUSTOM') {
        recipientsPayload = selectedStaffIds.map((sId) => ({
          staffId: sId,
          amount: customAmounts[sId] || 0,
        }));
      }

      await salonService.allocateTips(
        {
          tipReceiptId: selectedReceiptForAllocation.id,
          allocationType: allocType,
          recipients: recipientsPayload,
          notes: allocationNotes,
        },
        user
      );

      setFeedbackMessage({ type: 'success', text: 'Tips allocated successfully!' });
      setShowAllocateModal(false);
      await loadTipData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to allocate tips.' });
    } finally {
      setIsSubmittingAlloc(false);
    }
  };

  // Open Payout Modal
  const handleOpenPayout = (allocation: TipAllocationRecord) => {
    setSelectedAllocationForPayout(allocation);
    setPayoutAmount(allocation.outstandingAmount);
    setPayoutMethod('CASH');
    setSelectedOnlineAccountId(paymentAccounts[0]?.id || '');
    setPayoutReference('');
    setPayoutNotes('');
    setFeedbackMessage(null);
    setShowPayoutModal(true);
  };

  // Submit Payout
  const handleSubmitPayout = async () => {
    if (!selectedAllocationForPayout) return;

    try {
      setIsSubmittingPayout(true);
      setFeedbackMessage(null);

      const idempotencyKey = `tip-pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      await salonService.recordTipPayout(
        {
          allocationId: selectedAllocationForPayout.id,
          amount: payoutAmount,
          method: payoutMethod,
          onlineAccountId: payoutMethod === 'ONLINE' ? selectedOnlineAccountId : undefined,
          reference: payoutReference,
          notes: payoutNotes,
          idempotencyKey,
        },
        user
      );

      setFeedbackMessage({ type: 'success', text: `Tip payout disbursed successfully to ${selectedAllocationForPayout.staffName}.` });
      setShowPayoutModal(false);
      await loadTipData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to disburse tip payout.' });
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // Submit Reversal
  const handleSubmitReversal = async () => {
    if (!selectedPayoutForReverse) return;

    try {
      setFeedbackMessage(null);
      await salonService.reverseTipPayout(
        {
          payoutId: selectedPayoutForReverse.id,
          reversalReason,
          receivingDrawerId: selectedPayoutForReverse.method === 'CASH' ? reversalReceivingDrawerId : undefined,
        },
        user
      );

      setFeedbackMessage({ type: 'success', text: `Tip payout ${selectedPayoutForReverse.payoutNumber} reversed cleanly.` });
      setShowReverseModal(false);
      await loadTipData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to reverse payout.' });
    }
  };

  // Submit Cancellation of Allocation
  const handleSubmitCancelAllocation = async () => {
    if (!selectedAllocationForCancel) return;

    try {
      setFeedbackMessage(null);
      await salonService.cancelTipAllocation(
        selectedAllocationForCancel.id,
        cancelAllocationReason,
        user
      );

      setFeedbackMessage({ type: 'success', text: `Allocation ${selectedAllocationForCancel.allocationNumber} cancelled and funds returned to receipt.` });
      setShowCancelAllocationModal(false);
      await loadTipData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to cancel allocation.' });
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    let csvContent = '';
    if (activeTab === 'RECEIPTS') {
      csvContent = 'Receipt Number,Date,Time,Invoice Number,Client,Method,Payment Account,Collected Amount,Allocated Amount,Unallocated Amount,Direct Staff,Status\n';
      filteredReceipts.forEach((r) => {
        csvContent += `"${r.receiptNumber}","${r.collectionDate}","${r.collectionTime}","${r.invoiceNumber}","${r.clientName}","${r.method}","${r.paymentAccountName || 'Cash Drawer'}","${r.collectedAmount}","${r.allocatedAmount}","${r.unallocatedAmount}","${r.directStaffName || 'None'}","${r.status}"\n`;
      });
    } else if (activeTab === 'ALLOCATIONS') {
      csvContent = 'Allocation Number,Date,Time,Tip Receipt,Invoice Number,Staff Name,Role,Type,Amount,Paid Amount,Outstanding Amount,Status\n';
      filteredAllocations.forEach((a) => {
        csvContent += `"${a.allocationNumber}","${a.allocationDate}","${a.allocationTime}","${a.tipReceiptNumber}","${a.invoiceNumber}","${a.staffName}","${a.staffRole || ''}","${a.allocationType}","${a.amount}","${a.paidAmount}","${a.outstandingAmount}","${a.status}"\n`;
      });
    } else {
      csvContent = 'Payout Number,Date,Time,Allocation Number,Staff Name,Method,Amount,Original Collection Method,Disbursed By,Status\n';
      filteredPayouts.forEach((p) => {
        csvContent += `"${p.payoutNumber}","${p.payoutDate}","${p.payoutTime}","${p.allocationNumber}","${p.staffName}","${p.method}","${p.amount}","${p.collectionMethod}","${p.paidByName}","${p.status}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tips_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Banner & Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Staff Tip Collection & Distribution
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  100% Staff Liability
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Segregated gratuity custody, deterministic pooling, and cash drawer/online disbursements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tips Statement is a subview of this module, not a Reporting menu page (spec §1) */}
          <button
            onClick={() => navigate('/accounts/tips-statement')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1.5 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            Tips Statement
          </button>
          {/* Branch selector for Super Admin */}
          {user.role === 'SUPER_ADMIN' ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                className="bg-transparent text-xs font-semibold text-slate-800 outline-none"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>{branches.find((b) => b.id === user.branchId)?.name || 'Assigned Branch'}</span>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Net Tips Collected
            </span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(summaryMetrics.netCollected)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">From verified paid invoice receipts</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Unallocated Tips
            </span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 tracking-tight">
              {formatCurrency(summaryMetrics.unallocated)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Awaiting staff pooling or direct assignment</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Allocated but Unpaid
            </span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-indigo-600 tracking-tight">
              {formatCurrency(summaryMetrics.allocatedUnpaid)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Staff entitlement awaiting cash or online payout</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tips Disbursed
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              {formatCurrency(summaryMetrics.paid)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Net paid after auditable reversals</p>
          </div>
        </div>
      </div>

      {/* Main Filter & Navigation Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
        {/* View Tabs */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('RECEIPTS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'RECEIPTS'
                  ? 'bg-[#2254E1] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Tip Receipts ({receipts.length})
            </button>
            <button
              onClick={() => setActiveTab('ALLOCATIONS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'ALLOCATIONS'
                  ? 'bg-[#2254E1] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              Staff Allocations ({allocations.length})
            </button>
            <button
              onClick={() => setActiveTab('PAYOUTS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                activeTab === 'PAYOUTS'
                  ? 'bg-[#2254E1] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Payout History ({payouts.length})
            </button>
          </div>

          {/* Custody Drawer Float Info */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-500 font-medium">Your Drawer Float:</span>
            <span className="font-semibold text-slate-800">
              {myOpenDrawer ? formatCurrency(myOpenDrawer.expectedInDrawer) : 'No Open Drawer'}
            </span>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, client..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-[#2254E1] transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              className="bg-transparent text-xs text-slate-700 outline-none w-full"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Start Date"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              className="bg-transparent text-xs text-slate-700 outline-none w-full"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="End Date"
            />
          </div>

          <div>
            <select
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white text-slate-700"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash Drawer</option>
              <option value="ONLINE_ACCOUNT">Online Payment Account</option>
            </select>
          </div>

          <div>
            <select
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white text-slate-700"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {activeTab === 'RECEIPTS' && (
                <>
                  <option value="UNALLOCATED">Unallocated</option>
                  <option value="PARTIALLY_ALLOCATED">Partially Allocated</option>
                  <option value="FULLY_ALLOCATED">Fully Allocated</option>
                </>
              )}
              {activeTab === 'ALLOCATIONS' && (
                <>
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </>
              )}
              {activeTab === 'PAYOUTS' && (
                <>
                  <option value="COMPLETED">Completed</option>
                  <option value="REVERSED">Reversed</option>
                </>
              )}
            </select>
          </div>

          <div>
            <select
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white text-slate-700"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
            >
              <option value="ALL">All Staff Members</option>
              {staffList
                .filter((s) => selectedBranchId === 'ALL' || s.branchId === selectedBranchId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.roleTitle || s.designation})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading tip records...</div>
        ) : (
          <>
            {/* VIEW 1: TIP RECEIPTS */}
            {activeTab === 'RECEIPTS' && (
              <div className="overflow-x-auto">
                <table className="report-records w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Receipt #</th>
                      <th className="py-3 px-4">Collected Date & Time</th>
                      <th className="py-3 px-4">Invoice # & Client</th>
                      <th className="py-3 px-4">Payment Method</th>
                      <th className="py-3 px-4">Direct Staff Recipient</th>
                      <th className="py-3 px-4 text-right">Collected Tip</th>
                      <th className="py-3 px-4 text-right">Allocated</th>
                      <th className="py-3 px-4 text-right">Unallocated</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No tip receipts found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredReceipts.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">{r.receiptNumber}</td>
                          <td className="py-3 px-4 text-slate-500">
                            <div>{r.collectionDate}</div>
                            <div className="text-[10px] text-slate-400">{r.collectionTime}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{r.invoiceNumber}</div>
                            <div className="text-[11px] text-slate-400">{r.clientName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                                r.method === 'CASH'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {r.method === 'CASH' ? 'Cash Drawer' : r.paymentAccountName || 'Online Account'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {r.directStaffName ? (
                              <span className="font-medium text-slate-800">{r.directStaffName}</span>
                            ) : (
                              <span className="text-slate-400 italic">Pooled / General</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(r.collectedAmount)}
                          </td>
                          <td className="py-3 px-4 text-right text-indigo-600 font-medium">
                            {formatCurrency(r.allocatedAmount)}
                          </td>
                          <td className="py-3 px-4 text-right text-amber-600 font-bold">
                            {formatCurrency(r.unallocatedAmount)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'FULLY_ALLOCATED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'PARTIALLY_ALLOCATED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {r.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {r.unallocatedAmount > 0.001 ? (
                              <button
                                onClick={() => handleOpenAllocate(r)}
                                className="px-3 py-1 bg-[#2254E1] hover:bg-[#1b43b5] text-white rounded-lg text-xs font-semibold shadow-2xs transition"
                              >
                                Allocate
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Allocated</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW 2: STAFF ALLOCATIONS */}
            {activeTab === 'ALLOCATIONS' && (
              <div className="overflow-x-auto">
                <table className="report-records w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Allocation #</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Staff Member & Role</th>
                      <th className="py-3 px-4">Funding Receipt</th>
                      <th className="py-3 px-4">Allocation Type</th>
                      <th className="py-3 px-4 text-right">Allocated Amount</th>
                      <th className="py-3 px-4 text-right">Paid Amount</th>
                      <th className="py-3 px-4 text-right">Outstanding</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAllocations.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No staff tip allocations found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredAllocations.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">{a.allocationNumber}</td>
                          <td className="py-3 px-4 text-slate-500">
                            <div>{a.allocationDate}</div>
                            <div className="text-[10px] text-slate-400">{a.allocationTime}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{a.staffName}</div>
                            <div className="text-[11px] text-slate-400">{a.staffRole || 'Stylist'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-700">{a.tipReceiptNumber}</span>
                            <div className="text-[10px] text-slate-400">{a.invoiceNumber}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                              {a.allocationType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(a.amount)}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                            {formatCurrency(a.paidAmount)}
                          </td>
                          <td className="py-3 px-4 text-right text-indigo-600 font-bold">
                            {formatCurrency(a.outstandingAmount)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                a.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : a.status === 'PARTIALLY_PAID'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : a.status === 'CANCELLED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {a.outstandingAmount > 0.001 && a.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => handleOpenPayout(a)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition"
                                >
                                  Disburse Payout
                                </button>
                              )}
                              {a.paidAmount <= 0.001 && a.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => {
                                    setSelectedAllocationForCancel(a);
                                    setCancelAllocationReason('');
                                    setShowCancelAllocationModal(true);
                                  }}
                                  className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-medium transition"
                                  title="Cancel Allocation"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW 3: PAYOUT HISTORY */}
            {activeTab === 'PAYOUTS' && (
              <div className="overflow-x-auto">
                <table className="report-records w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Payout #</th>
                      <th className="py-3 px-4">Disbursed Date</th>
                      <th className="py-3 px-4">Staff Recipient</th>
                      <th className="py-3 px-4">Allocation & Receipt</th>
                      <th className="py-3 px-4">Disbursement Method</th>
                      <th className="py-3 px-4">Original Collection</th>
                      <th className="py-3 px-4 text-right">Disbursed Amount</th>
                      <th className="py-3 px-4">Disbursed By</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayouts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No tip payouts recorded matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPayouts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">{p.payoutNumber}</td>
                          <td className="py-3 px-4 text-slate-500">
                            <div>{p.payoutDate}</div>
                            <div className="text-[10px] text-slate-400">{p.payoutTime}</div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{p.staffName}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-700">{p.allocationNumber}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                p.method === 'CASH'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {p.method === 'CASH' ? 'Cash Drawer' : p.onlineAccountName || 'Online Account'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {p.collectionMethod === 'CASH' ? 'Cash' : p.collectionPaymentAccountName || 'Online'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="py-3 px-4 text-slate-500">{p.paidByName}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setVoucherData({ type: 'PAYOUT', record: p });
                                  setShowPrintVoucherModal(true);
                                }}
                                className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition"
                                title="Print Payout Voucher"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {p.status === 'COMPLETED' && (
                                <button
                                  onClick={() => {
                                    setSelectedPayoutForReverse(p);
                                    setReversalReason('');
                                    setReversalReceivingDrawerId(myOpenDrawer?.id || '');
                                    setShowReverseModal(true);
                                  }}
                                  className="p-1 hover:bg-rose-50 text-rose-600 rounded transition"
                                  title="Reverse Payout"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL 1: ALLOCATE TIPS */}
      {showAllocateModal && selectedReceiptForAllocation && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Allocate Collected Tip</h3>
                <p className="text-xs text-slate-500">
                  Receipt {selectedReceiptForAllocation.receiptNumber} · Available: {formatCurrency(selectedReceiptForAllocation.unallocatedAmount)}
                </p>
              </div>
              <button
                onClick={() => setShowAllocateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Summary Strip */}
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-medium text-slate-800">{selectedReceiptForAllocation.invoiceNumber} ({selectedReceiptForAllocation.clientName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Tip Collected:</span>
                <span className="font-bold text-slate-900">{formatCurrency(selectedReceiptForAllocation.collectedAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Currently Unallocated:</span>
                <span className="font-bold text-amber-600">{formatCurrency(selectedReceiptForAllocation.unallocatedAmount)}</span>
              </div>
              {selectedReceiptForAllocation.directStaffName && (
                <div className="flex justify-between text-blue-700 font-medium">
                  <span>POS Stylist Attribution:</span>
                  <span>{selectedReceiptForAllocation.directStaffName}</span>
                </div>
              )}
            </div>

            {/* Allocation Mode Tabs */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Allocation Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAllocType('DIRECT')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    allocType === 'DIRECT'
                      ? 'border-[#2254E1] bg-blue-50/50 text-[#2254E1]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Direct (1 Staff)
                </button>
                <button
                  type="button"
                  onClick={() => setAllocType('POOLED_EQUAL')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    allocType === 'POOLED_EQUAL'
                      ? 'border-[#2254E1] bg-blue-50/50 text-[#2254E1]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Equal Split
                </button>
                <button
                  type="button"
                  onClick={() => setAllocType('POOLED_CUSTOM')}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    allocType === 'POOLED_CUSTOM'
                      ? 'border-[#2254E1] bg-blue-50/50 text-[#2254E1]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Custom Split
                </button>
              </div>
            </div>

            {/* Staff Selection Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 flex justify-between">
                <span>Select Staff Recipients ({selectedReceiptForAllocation.branchName})</span>
                <span className="text-slate-400 font-normal">
                  {selectedStaffIds.length} staff selected
                </span>
              </label>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-1">
                {staffList
                  .filter((s) => s.branchId === selectedReceiptForAllocation.branchId && s.isActive)
                  .map((staff) => {
                    const isSelected = selectedStaffIds.includes(staff.id);
                    return (
                      <div
                        key={staff.id}
                        className={`p-2 flex items-center justify-between rounded-lg transition ${
                          isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer flex-1 text-xs">
                          <input
                            type={allocType === 'DIRECT' ? 'radio' : 'checkbox'}
                            name="staff_select"
                            checked={isSelected}
                            onChange={() => {
                              if (allocType === 'DIRECT') {
                                setSelectedStaffIds([staff.id]);
                              } else {
                                if (isSelected) {
                                  setSelectedStaffIds(selectedStaffIds.filter((id) => id !== staff.id));
                                } else {
                                  setSelectedStaffIds([...selectedStaffIds, staff.id]);
                                }
                              }
                            }}
                          />
                          <div>
                            <span className="font-semibold text-slate-800">{staff.name}</span>
                            <span className="text-[11px] text-slate-400 ml-1.5">
                              ({staff.roleTitle || staff.designation})
                            </span>
                          </div>
                        </label>

                        {/* Custom amount input if POOLED_CUSTOM */}
                        {allocType === 'POOLED_CUSTOM' && isSelected && (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400">PKR</span>
                            <input
                              type="number"
                              min={0}
                              className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-right font-semibold"
                              value={customAmounts[staff.id] || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCustomAmounts({ ...customAmounts, [staff.id]: val });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Split Preview */}
            {allocType === 'POOLED_EQUAL' && selectedStaffIds.length > 0 && (
              <div className="p-3 bg-indigo-50/60 rounded-xl text-xs space-y-1 border border-indigo-100 text-indigo-900">
                <div className="font-semibold flex justify-between">
                  <span>Deterministic Equal Split:</span>
                  <span>{formatCurrency(selectedReceiptForAllocation.unallocatedAmount)} total</span>
                </div>
                <div className="text-[11px] text-indigo-700">
                  Each selected employee receives approximately{' '}
                  <span className="font-bold">
                    {formatCurrency(
                      Math.floor(
                        (selectedReceiptForAllocation.unallocatedAmount / selectedStaffIds.length) * 100
                      ) / 100
                    )}
                  </span>
                  . Deterministic remainder minor cents will be distributed sequentially without rounding loss.
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Allocation Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Split equally for bridal shift support"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white"
                value={allocationNotes}
                onChange={(e) => setAllocationNotes(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAlloc || selectedStaffIds.length === 0}
                onClick={handleSubmitAllocation}
                className="px-5 py-2 bg-[#2254E1] hover:bg-[#1b43b5] text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSubmittingAlloc ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD TIP PAYOUT */}
      {showPayoutModal && selectedAllocationForPayout && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Disburse Tip Payout</h3>
                <p className="text-xs text-slate-500">
                  {selectedAllocationForPayout.staffName} · Entitlement: {formatCurrency(selectedAllocationForPayout.outstandingAmount)}
                </p>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payout Details */}
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Allocation #:</span>
                <span className="font-semibold text-slate-800">{selectedAllocationForPayout.allocationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Funding Tip Receipt:</span>
                <span className="text-slate-700">{selectedAllocationForPayout.tipReceiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding Payable:</span>
                <span className="font-bold text-indigo-600">{formatCurrency(selectedAllocationForPayout.outstandingAmount)}</span>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Disbursement Amount (PKR)</label>
              <input
                type="number"
                min={1}
                max={selectedAllocationForPayout.outstandingAmount}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-[#2254E1]"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(parseFloat(e.target.value) || 0)}
              />
              <p className="text-[11px] text-slate-400">
                You can disburse a partial payout. Remaining balance stays payable.
              </p>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Disbursement Source</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutMethod('CASH')}
                  className={`p-3 rounded-xl border text-xs font-semibold text-center transition flex flex-col items-center gap-1 ${
                    payoutMethod === 'CASH'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-800'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  Cash Drawer Float
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod('ONLINE')}
                  className={`p-3 rounded-xl border text-xs font-semibold text-center transition flex flex-col items-center gap-1 ${
                    payoutMethod === 'ONLINE'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-800'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  Bank / Online Account
                </button>
              </div>
            </div>

            {/* Cash Drawer float check */}
            {payoutMethod === 'CASH' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                {myOpenDrawer ? (
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-500 block">Your Active Drawer Float:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(myOpenDrawer.expectedInDrawer)}</span>
                    </div>
                    {myOpenDrawer.expectedInDrawer < payoutAmount && (
                      <span className="text-rose-600 font-semibold text-[11px]">Insufficient Cash Float</span>
                    )}
                  </div>
                ) : (
                  <div className="text-rose-600 font-medium">
                    You do not have an active OPEN cash drawer assigned in this branch. Cash disbursement blocked.
                  </div>
                )}
              </div>
            )}

            {/* Online Account Picker */}
            {payoutMethod === 'ONLINE' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Select Bank / Online Account</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white text-slate-800"
                  value={selectedOnlineAccountId}
                  onChange={(e) => setSelectedOnlineAccountId(e.target.value)}
                >
                  {paymentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.providerName}) · Balance: {formatCurrency(acc.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reference & Notes */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Reference #</label>
                <input
                  type="text"
                  placeholder="Slip/Txn Ref"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Audit Notes</label>
                <input
                  type="text"
                  placeholder="Notes"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isSubmittingPayout ||
                  payoutAmount <= 0 ||
                  payoutAmount > selectedAllocationForPayout.outstandingAmount ||
                  (payoutMethod === 'CASH' && (!myOpenDrawer || myOpenDrawer.expectedInDrawer < payoutAmount))
                }
                onClick={handleSubmitPayout}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSubmittingPayout ? 'Disbursing...' : 'Disburse Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REVERSE TIP PAYOUT */}
      {showReverseModal && selectedPayoutForReverse && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">Reverse Tip Payout</h3>
              </div>
              <button
                onClick={() => setShowReverseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-900 space-y-1 border border-rose-200">
              <div className="font-semibold">Reversal Audit Safety Notice</div>
              <div>
                Reversing payout <span className="font-bold">{selectedPayoutForReverse.payoutNumber}</span> ({formatCurrency(selectedPayoutForReverse.amount)}) will restore staff tip liability and reimburse {selectedPayoutForReverse.method === 'CASH' ? 'cash drawer float' : 'the online bank account'}.
              </div>
            </div>

            {/* If cash and original drawer is closed */}
            {selectedPayoutForReverse.method === 'CASH' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Reimbursement Receiving Drawer</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white text-slate-800"
                  value={reversalReceivingDrawerId}
                  onChange={(e) => setReversalReceivingDrawerId(e.target.value)}
                >
                  <option value="">Select Active Receiving Drawer...</option>
                  {cashDrawers
                    .filter((d) => d.branchId === selectedPayoutForReverse.branchId && d.status === 'OPEN')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.custodianName}'s Drawer · Float: {formatCurrency(d.expectedInDrawer)}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Mandatory Reversal Reason</label>
              <textarea
                rows={2}
                placeholder="State why this payout is being reversed..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white text-slate-800"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReverseModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!reversalReason.trim()}
                onClick={handleSubmitReversal}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CANCEL ALLOCATION */}
      {showCancelAllocationModal && selectedAllocationForCancel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">Cancel Tip Allocation</h3>
              </div>
              <button
                onClick={() => setShowCancelAllocationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Cancelling allocation <span className="font-bold">{selectedAllocationForCancel.allocationNumber}</span> for <span className="font-semibold text-slate-900">{selectedAllocationForCancel.staffName}</span> will return <span className="font-bold text-emerald-700">{formatCurrency(selectedAllocationForCancel.amount)}</span> to the funding receipt unallocated pool.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Cancellation Reason</label>
              <textarea
                rows={2}
                placeholder="Reason for cancelling this allocation..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white text-slate-800"
                value={cancelAllocationReason}
                onChange={(e) => setCancelAllocationReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCancelAllocationModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!cancelAllocationReason.trim()}
                onClick={handleSubmitCancelAllocation}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: PRINT VOUCHER */}
      {showPrintVoucherModal && voucherData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="text-center border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">iSysware SalonOS</h2>
              <p className="text-xs text-slate-500">Official Staff Gratuity Disbursement Voucher</p>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                Voucher #: {voucherData.record.payoutNumber}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Disbursement Date:</span>
                <span className="font-semibold text-slate-800">{voucherData.record.payoutDate} {voucherData.record.payoutTime}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Staff Recipient:</span>
                <span className="font-bold text-slate-900">{voucherData.record.staffName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Linked Allocation:</span>
                <span className="text-slate-700">{voucherData.record.allocationNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Disbursement Method:</span>
                <span className="font-semibold text-slate-800">{voucherData.record.method === 'CASH' ? 'Cash Float' : voucherData.record.onlineAccountName || 'Bank Account'}</span>
              </div>
              <div className="flex justify-between py-2 border-b-2 border-slate-900 text-sm">
                <span className="font-bold text-slate-900">Amount Paid:</span>
                <span className="font-extrabold text-emerald-700">{formatCurrency(voucherData.record.amount)}</span>
              </div>
            </div>

            {/* Signature Lines */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div>
                <div className="border-t border-slate-300 pt-2 text-slate-500 font-medium">Disbursed By</div>
                <div className="font-semibold text-slate-800">{voucherData.record.paidByName}</div>
              </div>
              <div>
                <div className="border-t border-slate-300 pt-2 text-slate-500 font-medium">Employee Signature</div>
                <div className="font-semibold text-slate-800">{voucherData.record.staffName}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPrintVoucherModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-[#2254E1] hover:bg-[#1b43b5] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
