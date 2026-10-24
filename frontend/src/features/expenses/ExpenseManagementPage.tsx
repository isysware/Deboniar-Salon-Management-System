import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import {
  Expense,
  ExpenseStatus,
  ExpenseCategoryItem,
  Branch,
  PaymentAccount,
  CashDrawer,
} from '@/types/salon';
import { User } from '@/types/auth';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Printer,
  Eye,
  RotateCcw,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Banknote,
  CreditCard,
  Layers,
  ArrowRightLeft,
  X,
  Filter,
  Check,
} from 'lucide-react';

export const ExpenseManagementPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/accounts/expenses" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAdmin = user.role === 'ADMIN';
  const isAccountant = user.role === 'ACCOUNTANT';
  const canManageCategoriesOrFloat = isSuperAdmin || isAdmin;

  // Selected branch scope
  const [selectedBranchId, setSelectedBranchId] = useState<string | 'ALL'>(
    isSuperAdmin ? activeBranchId || 'ALL' : (user.branchId as string)
  );

  useEffect(() => {
    if (isSuperAdmin && activeBranchId) {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId, isSuperAdmin]);

  // Main state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [cashDrawers, setCashDrawers] = useState<CashDrawer[]>([]);
  const [branchUsers, setBranchUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExpenseStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [paymentSourceFilter, setPaymentSourceFilter] = useState<'ALL' | 'CASH_DRAWER' | 'ONLINE_ACCOUNT'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isFloatTransferModalOpen, setIsFloatTransferModalOpen] = useState(false);

  // Active items for modals
  const [activeExpenseForVoucher, setActiveExpenseForVoucher] = useState<Expense | null>(null);
  const [activeExpenseForReversal, setActiveExpenseForReversal] = useState<Expense | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add / Edit form state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [formBranchId, setFormBranchId] = useState<string>(
    selectedBranchId !== 'ALL' ? selectedBranchId : user.branchId || ''
  );
  const [formExpenseDate, setFormExpenseDate] = useState<string>(demoDate || new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<string>('');
  const [formPayee, setFormPayee] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formPaymentSource, setFormPaymentSource] = useState<'CASH_DRAWER' | 'ONLINE_ACCOUNT'>('CASH_DRAWER');
  const [formPaymentAccountId, setFormPaymentAccountId] = useState<string>('');
  const [formExternalRef, setFormExternalRef] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Category management modal form state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);

  // Float transfer modal form state
  const [floatTargetUserId, setFloatTargetUserId] = useState('');
  const [floatAmount, setFloatAmount] = useState('');
  const [floatNotes, setFloatNotes] = useState('');
  const [floatModalError, setFloatModalError] = useState<string | null>(null);

  const printVoucherRef = useRef<HTMLDivElement>(null);

  // Load all required data
  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const branchToQuery = selectedBranchId;
      const [fetchedExpenses, fetchedCategories, fetchedBranches, fetchedAccounts, fetchedDrawers, fetchedUsers] =
        await Promise.all([
          salonService.getExpenses(branchToQuery, undefined, user),
          salonService.getExpenseCategories(branchToQuery, user),
          salonService.getBranches(),
          salonService.getPaymentAccounts(branchToQuery),
          salonService.getCashDrawers(branchToQuery),
          // Accountants may not list user accounts; the list only feeds name lookups/filters here.
          user.role === 'ACCOUNTANT' ? Promise.resolve([] as User[]) : salonService.getUsers(user, branchToQuery === 'ALL' ? undefined : branchToQuery).catch(() => [] as User[]),
        ]);

      setExpenses(fetchedExpenses);
      setCategories(fetchedCategories);
      setPaymentAccounts(fetchedAccounts.filter((a) => a.isActive));
      setCashDrawers(fetchedDrawers);
      setBranchUsers(fetchedUsers.filter((u) => u.isActive));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load expense records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranchId]);

  // Derived filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Branch filter if Super Admin selected single branch
      if (selectedBranchId !== 'ALL' && exp.branchId !== selectedBranchId) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'POSTED') {
          if (exp.status !== 'POSTED' && exp.status !== 'PAID') return false;
        } else if (exp.status !== statusFilter) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'ALL' && exp.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // Payment source
      if (paymentSourceFilter !== 'ALL' && exp.paymentSource !== paymentSourceFilter) {
        return false;
      }

      // Date range
      const expDate = exp.expenseDate || exp.date;
      if (startDate && expDate < startDate) return false;
      if (endDate && expDate > endDate) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          exp.voucherNumber.toLowerCase().includes(q) ||
          (exp.payee && exp.payee.toLowerCase().includes(q)) ||
          exp.title.toLowerCase().includes(q) ||
          (exp.description && exp.description.toLowerCase().includes(q)) ||
          (exp.notes && exp.notes.toLowerCase().includes(q)) ||
          (exp.paymentAccountName && exp.paymentAccountName.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [expenses, selectedBranchId, statusFilter, categoryFilter, paymentSourceFilter, startDate, endDate, searchQuery]);

  // Summary Metrics calculated authoritative from filtered list
  const metrics = useMemo(() => {
    let postedTotal = 0;
    let postedCount = 0;
    let reversedTotal = 0;
    let reversedCount = 0;
    let draftCount = 0;

    for (const exp of filteredExpenses) {
      if (exp.status === 'POSTED' || exp.status === 'PAID') {
        if (!exp.reversalOfVoucherNumber) {
          postedTotal += exp.amount;
          postedCount++;
        }
      } else if (exp.status === 'REVERSED') {
        if (!exp.reversalOfVoucherNumber) {
          // Count the original reversed expense amount once
          reversedTotal += exp.amount;
          reversedCount++;
        }
      } else if (exp.status === 'DRAFT') {
        draftCount++;
      }
    }

    const netExpenses = postedTotal - reversedTotal;

    return {
      postedTotal,
      postedCount,
      reversedTotal,
      reversedCount,
      netExpenses,
      draftCount,
    };
  }, [filteredExpenses]);

  // Open Add Modal
  const handleOpenAddModal = (draftToEdit?: Expense) => {
    setFormError(null);
    if (draftToEdit) {
      setEditingExpenseId(draftToEdit.id);
      setFormBranchId(draftToEdit.branchId);
      setFormExpenseDate(draftToEdit.expenseDate || draftToEdit.date);
      setFormCategory(draftToEdit.category);
      setFormPayee(draftToEdit.payee || '');
      setFormTitle(draftToEdit.title);
      setFormDescription(draftToEdit.description || '');
      setFormAmount(draftToEdit.amount.toString());
      setFormPaymentSource(draftToEdit.paymentSource);
      setFormPaymentAccountId(draftToEdit.paymentAccountId || '');
      setFormExternalRef(draftToEdit.externalReference || '');
      setFormNotes(draftToEdit.notes || '');
    } else {
      setEditingExpenseId(null);
      const defaultBranch = selectedBranchId !== 'ALL' ? selectedBranchId : user.branchId || '';
      setFormBranchId(defaultBranch);
      setFormExpenseDate(demoDate || new Date().toISOString().split('T')[0]);
      setFormCategory(categories.find((c) => c.branchId === defaultBranch && c.isActive)?.name || 'Supplies');
      setFormPayee('');
      setFormTitle('');
      setFormDescription('');
      setFormAmount('');
      setFormPaymentSource('CASH_DRAWER');
      setFormPaymentAccountId(paymentAccounts.find((a) => a.branchId === defaultBranch)?.id || '');
      setFormExternalRef('');
      setFormNotes('');
    }
    setIsAddExpenseModalOpen(true);
  };

  // Submit Save Draft
  const handleSaveDraft = async () => {
    setFormError(null);
    const amountNum = parseFloat(formAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      const msg = 'Please enter a valid expense amount greater than zero.';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!formCategory) {
      const msg = 'Please select an expense category.';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!formPayee.trim()) {
      const msg = 'Payee / Paid to name is required.';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!formTitle.trim()) {
      const msg = 'Expense title / purpose is required.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingExpenseId) {
        await salonService.updateExpenseDraft(
          editingExpenseId,
          {
            expenseDate: formExpenseDate,
            date: formExpenseDate,
            category: formCategory,
            payee: formPayee.trim(),
            title: formTitle.trim(),
            description: formDescription.trim() || formTitle.trim(),
            amount: amountNum,
            paymentSource: formPaymentSource,
            paymentAccountId: formPaymentSource === 'ONLINE_ACCOUNT' ? formPaymentAccountId : undefined,
            externalReference: formExternalRef.trim() || undefined,
            notes: formNotes.trim() || undefined,
          },
          user
        );
        const msg = 'Draft expense updated successfully.';
        setSuccessMessage(msg);
        toast.success(msg);
      } else {
        await salonService.createExpenseDraft(
          {
            branchId: formBranchId,
            expenseDate: formExpenseDate,
            date: formExpenseDate,
            time: '10:00 AM',
            category: formCategory,
            payee: formPayee.trim(),
            title: formTitle.trim(),
            description: formDescription.trim() || formTitle.trim(),
            amount: amountNum,
            paymentSource: formPaymentSource,
            paymentAccountId: formPaymentSource === 'ONLINE_ACCOUNT' ? formPaymentAccountId : undefined,
            externalReference: formExternalRef.trim() || undefined,
            notes: formNotes.trim() || undefined,
            createdByUserId: user.id,
            createdByName: user.name,
          },
          user
        );
        const msg = 'Expense draft saved successfully.';
        setSuccessMessage(msg);
        toast.success(msg);
      }
      setIsAddExpenseModalOpen(false);
      await loadData();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save expense draft.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Post Expense
  const handlePostExpense = async () => {
    setFormError(null);
    const amountNum = parseFloat(formAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      const msg = 'Please enter a valid expense amount greater than zero.';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!formCategory) {
      const msg = 'Please select an expense category.';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!formPayee.trim()) {
      const msg = 'Payee / Paid to name is required.';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!formTitle.trim()) {
      const msg = 'Expense title / purpose is required.';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (formPaymentSource === 'ONLINE_ACCOUNT' && !formPaymentAccountId) {
      const msg = 'Please select an active online payment account.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const posted = await salonService.postExpense(
        {
          expenseId: editingExpenseId || undefined,
          branchId: formBranchId,
          expenseDate: formExpenseDate,
          category: formCategory,
          payee: formPayee.trim(),
          title: formTitle.trim(),
          description: formDescription.trim() || formTitle.trim(),
          amount: amountNum,
          paymentSource: formPaymentSource,
          paymentAccountId: formPaymentSource === 'ONLINE_ACCOUNT' ? formPaymentAccountId : undefined,
          externalReference: formExternalRef.trim() || undefined,
          notes: formNotes.trim() || undefined,
          idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        },
        user
      );

      const msg = `Expense voucher ${posted.voucherNumber} posted and funds disbursed successfully.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsAddExpenseModalOpen(false);
      await loadData();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to post expense transaction.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Draft
  const handleDeleteDraft = async (exp: Expense) => {
    if (!window.confirm(`Are you sure you want to delete draft voucher ${exp.voucherNumber}?`)) {
      return;
    }
    try {
      await salonService.deleteExpenseDraft(exp.id, user);
      toast.success(`Draft ${exp.voucherNumber} deleted.`);
      setSuccessMessage(`Draft ${exp.voucherNumber} deleted.`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete draft.');
      setErrorMessage(err.message || 'Failed to delete draft.');
    }
  };

  // Open Reversal Modal
  const handleOpenReversalModal = (exp: Expense) => {
    setActiveExpenseForReversal(exp);
    setReversalReason('');
    setIsReverseModalOpen(true);
  };

  // Confirm Reversal
  const handleConfirmReversal = async () => {
    if (!activeExpenseForReversal) return;
    if (!reversalReason.trim()) {
      toast.error('Please enter a clear explanation for this reversal.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await salonService.reverseExpense(
        activeExpenseForReversal.id,
        reversalReason.trim(),
        user
      );
      const msg = `Voucher ${result.originalExpense.voucherNumber} reversed successfully. Linked Reversal Voucher: ${result.reversalExpense.voucherNumber}.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsReverseModalOpen(false);
      setActiveExpenseForReversal(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Category
  const handleCreateCategory = async () => {
    setCategoryModalError(null);
    if (!newCategoryName.trim()) {
      const msg = 'Category name is required.';
      setCategoryModalError(msg);
      toast.error(msg);
      return;
    }
    const targetBranch = selectedBranchId !== 'ALL' ? selectedBranchId : user.branchId || '';
    try {
      await salonService.createExpenseCategory(targetBranch, newCategoryName.trim(), newCategoryDescription.trim(), user);
      setNewCategoryName('');
      setNewCategoryDescription('');
      toast.success('Category created successfully.');
      setSuccessMessage('Category created successfully.');
      const freshCats = await salonService.getExpenseCategories(selectedBranchId, user);
      setCategories(freshCats);
    } catch (err: any) {
      const msg = err.message || 'Failed to create category.';
      setCategoryModalError(msg);
      toast.error(msg);
    }
  };

  // Toggle Category Status
  const handleToggleCategory = async (catId: string) => {
    try {
      await salonService.toggleExpenseCategoryStatus(catId, user);
      toast.success('Category status updated.');
      const freshCats = await salonService.getExpenseCategories(selectedBranchId, user);
      setCategories(freshCats);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update category status.');
    }
  };

  // Handle Cash Float Transfer
  const handleTransferFloat = async () => {
    setFloatModalError(null);
    const amountNum = parseFloat(floatAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      const msg = 'Please enter a valid positive transfer amount.';
      setFloatModalError(msg);
      toast.error(msg);
      return;
    }
    if (!floatTargetUserId) {
      const msg = 'Please select a target custodian with an open drawer.';
      setFloatModalError(msg);
      toast.error(msg);
      return;
    }
    const targetBranch = selectedBranchId !== 'ALL' ? selectedBranchId : user.branchId || '';

    setIsSubmitting(true);
    try {
      const record = await salonService.transferCashFloat(
        {
          branchId: targetBranch,
          targetUserId: floatTargetUserId,
          amount: amountNum,
          notes: floatNotes.trim() || 'Internal cash float replenishment for expense disbursements',
        },
        user
      );
      const msg = `Cash float transfer ${record.transferNumber} of PKR ${amountNum.toLocaleString()} completed successfully.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsFloatTransferModalOpen(false);
      setFloatAmount('');
      setFloatNotes('');
      await loadData();
    } catch (err: any) {
      const msg = err.message || 'Failed to transfer cash float.';
      setFloatModalError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export Filtered Table to CSV
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      toast.warning('No expense records to export matching current filters.');
      return;
    }

    const headers = [
      'Voucher No',
      'Expense Date',
      'Category',
      'Payee',
      'Title',
      'Description',
      'Amount (PKR)',
      'Payment Source',
      'Payment Account',
      'Status',
      'Entered By',
      'Paid By',
      'Reversal Voucher',
      'Reversal Reason',
    ];

    const rows = filteredExpenses.map((exp) => [
      exp.voucherNumber,
      exp.expenseDate || exp.date,
      `"${exp.category.replace(/"/g, '""')}"`,
      `"${(exp.payee || '').replace(/"/g, '""')}"`,
      `"${exp.title.replace(/"/g, '""')}"`,
      `"${(exp.description || '').replace(/"/g, '""')}"`,
      exp.amount.toFixed(2),
      exp.paymentSource,
      `"${(exp.paymentAccountName || '').replace(/"/g, '""')}"`,
      exp.status,
      `"${(exp.createdByName || '').replace(/"/g, '""')}"`,
      `"${(exp.paidByName || '').replace(/"/g, '""')}"`,
      exp.reversalVoucherNumber || '',
      `"${(exp.reversalReason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `salon_expenses_${selectedBranchId}_${demoDate || 'report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print voucher handler
  const handlePrintVoucher = () => {
    window.print();
  };

  // Branch entity lookup
  const currentBranchName = useMemo(() => {
    if (selectedBranchId === 'ALL') return 'All Branches (Consolidated)';
    const b = allBranches.find((x) => x.id === selectedBranchId);
    return b ? `${b.name} (${b.code})` : selectedBranchId;
  }, [selectedBranchId, allBranches]);

  const activeBranchEntity = useMemo(() => {
    return allBranches.find((b) => b.id === (selectedBranchId === 'ALL' ? user.branchId : selectedBranchId));
  }, [allBranches, selectedBranchId]);

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expense Management</h1>
            <Badge className="bg-[#2254E1]/10 text-[#2254E1] hover:bg-[#2254E1]/20 font-medium">
              Phase 3B
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative operating expense vouchers, cash drawer disbursements, and bank payouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Super Admin branch selector */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 mr-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val)}>
                <SelectTrigger className="w-[200px] h-9 text-xs">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Branches (Consolidated)</SelectItem>
                  {allBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {canManageCategoriesOrFloat && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs font-medium border-slate-300 hover:bg-slate-50"
                onClick={() => setIsFloatTransferModalOpen(true)}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
                Fund Cash Float
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs font-medium border-slate-300 hover:bg-slate-50"
                onClick={() => setIsCategoryModalOpen(true)}
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Categories
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium border-slate-300 hover:bg-slate-50"
            onClick={handleExportCSV}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Export CSV
          </Button>

          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs font-medium bg-[#2254E1] hover:bg-[#1b43b4] text-white shadow-sm"
            onClick={() => handleOpenAddModal()}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Super Admin Read-Only Notice */}
      {isSuperAdmin && selectedBranchId === 'ALL' && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            You are viewing the <strong>consolidated multi-branch ledger</strong> (read-only). To create an expense, transfer cash float, or reverse vouchers, please select a specific branch from the dropdown above.
          </span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-slate-200 bg-white shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Posted Expenses</span>
            <div className="p-2 rounded-lg bg-blue-50 text-[#2254E1]">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.postedTotal)}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{metrics.postedCount}</span> vouchers posted & paid
            </div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 bg-white shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reversed Amount</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">
              {metrics.reversedTotal > 0 ? `-${formatCurrency(metrics.reversedTotal)}` : 'PKR 0.00'}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{metrics.reversedCount}</span> vouchers cancelled / reversed
            </div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Net Operating Expenses</span>
            <div className="p-2 rounded-lg bg-white/10 text-white">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{formatCurrency(metrics.netExpenses)}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
              Filtered reconciliation matching active parameters
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Search voucher, payee, title, description..."
              className="pl-9 h-9 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="POSTED">Posted / Paid</SelectItem>
                <SelectItem value="DRAFT">Drafts Only</SelectItem>
                <SelectItem value="REVERSED">Reversed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div>
            <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name} {!c.isActive ? '(Inactive)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method */}
          <div>
            <Select value={paymentSourceFilter} onValueChange={(val: any) => setPaymentSourceFilter(val)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Payment Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Methods</SelectItem>
                <SelectItem value="CASH_DRAWER">Cash Drawer</SelectItem>
                <SelectItem value="ONLINE_ACCOUNT">Online Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-slate-600 hover:text-slate-900 w-full"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setPaymentSourceFilter('ALL');
                setStartDate('');
                setEndDate('');
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Expenses Table */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200">
                <TableHead className="w-[140px] text-xs font-semibold text-slate-700">Voucher No</TableHead>
                <TableHead className="w-[110px] text-xs font-semibold text-slate-700">Expense Date</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold text-slate-700">Category</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Payee & Title</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-700">Amount</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Payment Source</TableHead>
                <TableHead className="text-center text-xs font-semibold text-slate-700">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Entered / Paid By</TableHead>
                <TableHead className="text-right text-xs font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                    Loading expenses ledger...
                  </TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16">
                    <div className="max-w-sm mx-auto text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-slate-900 text-base">No expenses found</h3>
                      <p className="text-xs text-slate-500">
                        No expense vouchers match the selected branch and filter criteria.
                      </p>
                      <Button
                        size="sm"
                        className="bg-[#2254E1] hover:bg-[#1b43b4] text-white text-xs h-8 mt-2"
                        onClick={() => handleOpenAddModal()}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add First Expense
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((exp) => {
                  const isDraft = exp.status === 'DRAFT';
                  const isReversed = exp.status === 'REVERSED';
                  const isPaid = exp.status === 'POSTED' || exp.status === 'PAID';
                  const canEditThisDraft = isDraft && (isSuperAdmin || isAdmin || (isAccountant && exp.createdByUserId === user.id));
                  const canReverseThis = isPaid && !exp.reversalOfVoucherNumber && (isSuperAdmin || (isAdmin && exp.branchId === user.branchId));

                  return (
                    <TableRow key={exp.id} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100 text-xs">
                      {/* Voucher No */}
                      <TableCell className="font-mono font-medium text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{exp.voucherNumber}</span>
                          {exp.reversalOfVoucherNumber && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-rose-300 text-rose-600 bg-rose-50">
                              REV
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatDate(exp.expenseDate || exp.date)}
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[11px] font-normal">
                          {exp.category}
                        </Badge>
                      </TableCell>

                      {/* Payee & Title */}
                      <TableCell>
                        <div className="font-medium text-slate-900">{exp.payee || 'Supplier / Vendor'}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[240px]">{exp.title}</div>
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="text-right font-semibold text-slate-900 whitespace-nowrap">
                        {isReversed && !exp.reversalOfVoucherNumber ? (
                          <span className="line-through text-slate-400">{formatCurrency(exp.amount)}</span>
                        ) : isReversed && exp.reversalOfVoucherNumber ? (
                          <span className="text-rose-600">-{formatCurrency(exp.amount)}</span>
                        ) : (
                          formatCurrency(exp.amount)
                        )}
                      </TableCell>

                      {/* Payment Source */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {exp.paymentSource === 'CASH_DRAWER' ? (
                            <>
                              <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-slate-700">Cash Drawer</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="text-slate-700 truncate max-w-[130px]">
                                {exp.paymentAccountName || 'Online Account'}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {isPaid && (
                          <Badge className="bg-blue-50 text-[#2254E1] border-blue-200 hover:bg-blue-100 text-[10px] font-medium">
                            POSTED
                          </Badge>
                        )}
                        {isDraft && (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px] font-medium">
                            DRAFT
                          </Badge>
                        )}
                        {isReversed && (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 text-[10px] font-medium">
                            REVERSED
                          </Badge>
                        )}
                      </TableCell>

                      {/* Entered / Paid By */}
                      <TableCell>
                        <div className="text-slate-900">{exp.paidByName || exp.createdByName || 'Staff'}</div>
                        <div className="text-[10px] text-slate-400">
                          {exp.createdByName && exp.paidByName && exp.createdByName !== exp.paidByName
                            ? `by ${exp.createdByName}`
                            : 'Direct'}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Voucher */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                            title="View Printable Voucher"
                            onClick={() => {
                              setActiveExpenseForVoucher(exp);
                              setIsVoucherModalOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          {/* Print Voucher */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                            title="Print Voucher"
                            onClick={() => {
                              setActiveExpenseForVoucher(exp);
                              setIsVoucherModalOpen(true);
                            }}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>

                          {/* Draft Operations */}
                          {canEditThisDraft && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800"
                                title="Edit Draft"
                                onClick={() => handleOpenAddModal(exp)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800"
                                title="Delete Draft"
                                onClick={() => handleDeleteDraft(exp)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {/* Reversal action for Admin/Super Admin on posted items */}
                          {canReverseThis && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                              title="Reverse Posted Expense"
                              onClick={() => handleOpenReversalModal(exp)}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ================================================= */}
      {/* 1. ADD / EDIT EXPENSE MODAL                       */}
      {/* ================================================= */}
      <Dialog open={isAddExpenseModalOpen} onOpenChange={setIsAddExpenseModalOpen}>
        <DialogContent className="sm:max-w-[550px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingExpenseId ? 'Edit Draft Expense' : 'Record Operating Expense'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Disburse operating funds from cash drawer custody or online bank account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            {/* Branch */}
            <div className="space-y-1 col-span-2">
              <label className="font-medium text-slate-700">Branch Location</label>
              <Select
                value={formBranchId}
                onValueChange={(val) => {
                  setFormBranchId(val);
                  const branchCats = categories.filter((c) => c.branchId === val && c.isActive);
                  if (branchCats.length > 0) setFormCategory(branchCats[0].name);
                  const branchAccs = paymentAccounts.filter((a) => a.branchId === val);
                  if (branchAccs.length > 0) setFormPaymentAccountId(branchAccs[0].id);
                }}
                disabled={!isSuperAdmin}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {allBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expense Date */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Expense Date</label>
              <Input
                type="date"
                className="h-9 text-xs"
                value={formExpenseDate}
                onChange={(e) => setFormExpenseDate(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Category</label>
              <Select value={formCategory} onValueChange={(val) => setFormCategory(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c.branchId === formBranchId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name} {!c.isActive ? '(Inactive)' : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payee */}
            <div className="space-y-1 col-span-2">
              <label className="font-medium text-slate-700">Payee / Paid To</label>
              <Input
                placeholder="e.g. Lahore Cleaners, Gourmet Bakers, WAPDA"
                className="h-9 text-xs"
                value={formPayee}
                onChange={(e) => setFormPayee(e.target.value)}
              />
            </div>

            {/* Title */}
            <div className="space-y-1 col-span-2">
              <label className="font-medium text-slate-700">Expense Title / Short Purpose</label>
              <Input
                placeholder="e.g. Disinfectant spray and salon cotton restock"
                className="h-9 text-xs"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="font-medium text-slate-700">Amount (PKR)</label>
              <Input
                type="number"
                min="1"
                step="any"
                placeholder="0.00"
                className="h-9 text-xs font-semibold text-slate-900"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="font-medium text-slate-700">Payment Source</label>
              <Select
                value={formPaymentSource}
                onValueChange={(val: any) => setFormPaymentSource(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH_DRAWER">Cash Drawer Custody</SelectItem>
                  <SelectItem value="ONLINE_ACCOUNT">Online Bank Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Account (when Online) */}
            {formPaymentSource === 'ONLINE_ACCOUNT' && (
              <div className="space-y-1 col-span-2">
                <label className="font-medium text-slate-700">Select Bank Account</label>
                <Select
                  value={formPaymentAccountId}
                  onValueChange={(val) => setFormPaymentAccountId(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentAccounts
                      .filter((a) => a.branchId === formBranchId)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — Balance: {formatCurrency(a.currentBalance)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* External Reference */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="font-medium text-slate-700">Bill / Cheque No (Optional)</label>
              <Input
                placeholder="e.g. INV-98421 or CHQ-4029"
                className="h-9 text-xs"
                value={formExternalRef}
                onChange={(e) => setFormExternalRef(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="font-medium text-slate-700">Notes / Remarks (Optional)</label>
              <Input
                placeholder="Internal verification notes"
                className="h-9 text-xs"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-9"
              onClick={() => setIsAddExpenseModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-9 border-amber-300 text-amber-800 hover:bg-amber-50"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs h-9 bg-[#2254E1] hover:bg-[#1b43b4] text-white"
                onClick={handlePostExpense}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Post & Disburse Funds'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================= */}
      {/* 2. PRINTABLE EXPENSE VOUCHER MODAL                */}
      {/* ================================================= */}
      <Dialog open={isVoucherModalOpen} onOpenChange={setIsVoucherModalOpen}>
        <DialogContent className="sm:max-w-[650px] font-sans">
          <DialogHeader className="no-print">
            <DialogTitle className="text-base font-bold text-slate-900">Official Expense Voucher</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Audit-ready disbursement statement with dual authorized sign-offs.
            </DialogDescription>
          </DialogHeader>

          {activeExpenseForVoucher && (
            <div ref={printVoucherRef} className="p-6 bg-white border border-slate-200 rounded-lg space-y-5 text-xs text-slate-800 printable-voucher">
              {/* Salon Branding Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">SALON OS</h2>
                  <p className="font-medium text-slate-700 text-xs">{activeBranchEntity?.name}</p>
                  <p className="text-slate-500 text-[11px]">{activeBranchEntity?.address}, {activeBranchEntity?.city}</p>
                  <p className="text-slate-500 text-[11px]">Phone: {activeBranchEntity?.phone}</p>
                  {activeBranchEntity?.taxRegistrationNumber && (
                    <p className="text-slate-500 text-[11px]">PRA/Tax ID: {activeBranchEntity.taxRegistrationNumber}</p>
                  )}
                </div>

                <div className="text-right">
                  <Badge variant="outline" className="text-xs font-mono font-bold border-slate-400 text-slate-900 px-2 py-0.5">
                    {activeExpenseForVoucher.voucherNumber}
                  </Badge>
                  <div className="mt-1 text-slate-500 text-[11px]">
                    Date: <span className="font-semibold text-slate-800">{activeExpenseForVoucher.expenseDate || activeExpenseForVoucher.date}</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Time: {activeExpenseForVoucher.time || '10:00 AM'}
                  </div>
                  <div className="mt-1">
                    {activeExpenseForVoucher.status === 'POSTED' || activeExpenseForVoucher.status === 'PAID' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px]">PAID & POSTED</Badge>
                    ) : activeExpenseForVoucher.status === 'REVERSED' ? (
                      <Badge className="bg-rose-100 text-rose-800 border-none text-[10px]">REVERSED</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-none text-[10px]">DRAFT ESTIMATE</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Reversal notice if reversed */}
              {activeExpenseForVoucher.status === 'REVERSED' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">
                  <div className="font-bold flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> REVERSAL VOID NOTICE
                  </div>
                  <div className="mt-1 text-[11px]">
                    Reversed by Voucher: <span className="font-mono font-semibold">{activeExpenseForVoucher.reversalVoucherNumber}</span> on{' '}
                    {activeExpenseForVoucher.reversedAt?.split('T')[0] || 'N/A'} by {activeExpenseForVoucher.reversedByName || 'Admin'}.
                  </div>
                  {activeExpenseForVoucher.reversalReason && (
                    <div className="mt-0.5 text-[11px] italic">
                      Reason: "{activeExpenseForVoucher.reversalReason}"
                    </div>
                  )}
                </div>
              )}

              {/* Voucher Core Table */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="report-records w-full text-left">
                  <tbody>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td className="p-2 font-semibold text-slate-600 w-1/3">Payee / Beneficiary:</td>
                      <td className="p-2 font-bold text-slate-900">{activeExpenseForVoucher.payee || 'N/A'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-2 font-semibold text-slate-600">Category:</td>
                      <td className="p-2 font-medium text-slate-800">{activeExpenseForVoucher.category}</td>
                    </tr>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td className="p-2 font-semibold text-slate-600">Expense Title:</td>
                      <td className="p-2 text-slate-800">{activeExpenseForVoucher.title}</td>
                    </tr>
                    {activeExpenseForVoucher.description && activeExpenseForVoucher.description !== activeExpenseForVoucher.title && (
                      <tr className="border-b border-slate-100">
                        <td className="p-2 font-semibold text-slate-600">Description / Details:</td>
                        <td className="p-2 text-slate-700">{activeExpenseForVoucher.description}</td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td className="p-2 font-semibold text-slate-600">Payment Source:</td>
                      <td className="p-2 text-slate-800">
                        {activeExpenseForVoucher.paymentSource === 'CASH_DRAWER'
                          ? 'Physical Cash Drawer Custody'
                          : `Online Account (${activeExpenseForVoucher.paymentAccountName || 'Bank Check'})`}
                      </td>
                    </tr>
                    {activeExpenseForVoucher.externalReference && (
                      <tr className="border-b border-slate-100">
                        <td className="p-2 font-semibold text-slate-600">Bill / Cheque Ref:</td>
                        <td className="p-2 font-mono text-slate-800">{activeExpenseForVoucher.externalReference}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-100/70">
                      <td className="p-3 font-bold text-slate-900 text-sm">Disbursed Amount:</td>
                      <td className="p-3 font-bold text-slate-900 text-base">
                        {formatCurrency(activeExpenseForVoucher.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures & Custody Verification */}
              <div className="grid grid-cols-3 gap-4 pt-8 text-center text-[10px] text-slate-500">
                <div className="border-t border-slate-300 pt-1.5">
                  <div className="font-semibold text-slate-800">{activeExpenseForVoucher.createdByName || 'Entered By'}</div>
                  <div>Entered By</div>
                </div>
                <div className="border-t border-slate-300 pt-1.5">
                  <div className="font-semibold text-slate-800">{activeExpenseForVoucher.paidByName || 'Disbursed By'}</div>
                  <div>Disbursed / Paid By</div>
                </div>
                <div className="border-t border-slate-300 pt-1.5">
                  <div className="font-semibold text-slate-800">Authorized Branch Admin</div>
                  <div>Sign & Verification</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="no-print flex items-center justify-between sm:justify-between border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-9"
              onClick={() => setIsVoucherModalOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs h-9 gap-1.5 bg-[#2254E1] hover:bg-[#1b43b4] text-white"
              onClick={handlePrintVoucher}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================= */}
      {/* 3. REVERSAL CONFIRMATION MODAL                    */}
      {/* ================================================= */}
      <Dialog open={isReverseModalOpen} onOpenChange={setIsReverseModalOpen}>
        <DialogContent className="sm:max-w-[480px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              Reverse Expense Voucher
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This administrative action reverses the posted voucher and restores the original payment funds.
            </DialogDescription>
          </DialogHeader>

          {activeExpenseForReversal && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">Voucher No:</span>
                  <span className="font-mono text-slate-900">{activeExpenseForReversal.voucherNumber}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">Payee:</span>
                  <span className="text-slate-900">{activeExpenseForReversal.payee}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-200">
                  <span className="text-slate-900">Amount to Refund:</span>
                  <span className="text-emerald-700">{formatCurrency(activeExpenseForReversal.amount)}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                <strong>Restoration Target:</strong>{' '}
                {activeExpenseForReversal.paymentSource === 'CASH_DRAWER'
                  ? 'Physical cash drawer in custody will receive PKR ' + activeExpenseForReversal.amount.toLocaleString() + ' refund credit.'
                  : `Online Account (${activeExpenseForReversal.paymentAccountName || 'Bank'}) will be credited PKR ` + activeExpenseForReversal.amount.toLocaleString() + '.'}
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-700">Reason for Reversal (Required)</label>
                <Input
                  placeholder="e.g. Duplicate voucher entered by mistake, supplier issued refund"
                  className="h-9 text-xs"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-9"
              onClick={() => setIsReverseModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-medium"
              onClick={handleConfirmReversal}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Reversing...' : 'Confirm Reversal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================= */}
      {/* 4. CATEGORY MANAGEMENT MODAL                      */}
      {/* ================================================= */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-[500px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Expense Categories ({currentBranchName})
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Create, rename, and toggle active status for branch operating categories.
            </DialogDescription>
          </DialogHeader>

          {categoryModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{categoryModalError}</span>
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            {/* Add Category Form */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <span className="font-semibold text-slate-800 text-xs">Add New Category</span>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Category Name"
                  className="col-span-2 h-8 text-xs"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-8 text-xs bg-[#2254E1] text-white"
                  onClick={handleCreateCategory}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              <Input
                placeholder="Description (Optional)"
                className="h-8 text-xs"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
              />
            </div>

            {/* List Existing Categories */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[240px] overflow-y-auto">
              <table className="report-records w-full text-left">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="p-2">Name</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories
                    .filter((c) => selectedBranchId === 'ALL' || c.branchId === selectedBranchId)
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-2 font-medium text-slate-900">
                          {c.name}
                          {c.description && <div className="text-[10px] text-slate-400">{c.description}</div>}
                        </td>
                        <td className="p-2">
                          {c.isActive ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Active</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">Deactivated</Badge>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2 text-slate-600 hover:text-slate-900"
                            onClick={() => handleToggleCategory(c.id)}
                          >
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-9 w-full"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================= */}
      {/* 5. CASH FLOAT TRANSFER MODAL                      */}
      {/* ================================================= */}
      <Dialog open={isFloatTransferModalOpen} onOpenChange={setIsFloatTransferModalOpen}>
        <DialogContent className="sm:max-w-[480px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
              Transfer Cash Float
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Replenish a cashier or accountant drawer from branch vault float for cash expense disbursements.
            </DialogDescription>
          </DialogHeader>

          {floatModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{floatModalError}</span>
            </div>
          )}

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs">
              <strong>Notice:</strong> This internal custody transfer updates the custodian cash ledger atomically. It does <em>not</em> create an invoice or an operating expense.
            </div>

            {/* Target Custodian */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Target Drawer Custodian</label>
              <Select value={floatTargetUserId} onValueChange={(val) => setFloatTargetUserId(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select user with open drawer" />
                </SelectTrigger>
                <SelectContent>
                  {cashDrawers
                    .filter((d) => d.status === 'OPEN' && (selectedBranchId === 'ALL' || d.branchId === selectedBranchId))
                    .map((d) => (
                      <SelectItem key={d.custodianUserId} value={d.custodianUserId}>
                        {d.custodianName} — In Custody: {formatCurrency(d.expectedInDrawer)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Float Amount */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Float Amount (PKR)</label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 10000"
                className="h-9 text-xs font-semibold"
                value={floatAmount}
                onChange={(e) => setFloatAmount(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Transfer Purpose / Notes</label>
              <Input
                placeholder="e.g. Morning cash replenishment for local supplies"
                className="h-9 text-xs"
                value={floatNotes}
                onChange={(e) => setFloatNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-9"
              onClick={() => setIsFloatTransferModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              onClick={handleTransferFloat}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Transferring...' : 'Confirm Float Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
