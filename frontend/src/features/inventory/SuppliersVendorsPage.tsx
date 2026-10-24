import { useInventoryActionScope } from './useInventoryActionScope';
import { BranchActionField } from '@/components/BranchActionField';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import {
  Supplier,
  SupplierLedgerEntry,
  PaySupplierInput,
  PaymentAccount,
  CashDrawer,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { InventoryNavHeader } from './InventoryNavHeader';
import { toast } from '@/context/ToastContext';
import {
  Truck,
  Plus,
  Search,
  Filter,
  Banknote,
  Phone,
  Mail,
  Building2,
  Receipt,
  CreditCard,
  History,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Edit2,
  FileText,
  BookOpen,
  Printer,
  Download,
  Calendar,
} from 'lucide-react';

const formatPKR = (amt: number) => {
  return (Number(amt) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const SuppliersVendorsPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();
  const { pathname, navigate, currentRoute } = useRouter();

  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/operations/suppliers" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const defaultBranchId = isSuperAdmin
    ? (activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '')
    : (user.branchId || '');

  const isLedgerRoute = pathname === '/operations/supplier-ledger' || pathname === '/operations/supplier-khata';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'LEDGER'>(isLedgerRoute ? 'LEDGER' : 'DIRECTORY');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<CashDrawer | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [formBranchId, setFormBranchId] = useState(isSuperAdmin ? '' : user.branchId || '');
  // Add/Edit Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState<{
    name: string;
    companyName: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    taxNumber: string;
    openingBalance: number;
  }>({
    name: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    openingBalance: 0,
  });

  // Pay Supplier Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [payReference, setPayReference] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payDate, setPayDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }));
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const paymentKey = React.useRef('');
  const paymentBusy = React.useRef(false);

  // Khata Ledger Drawer / Modal & Dedicated View State
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState<boolean>(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<SupplierLedgerEntry[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(false);
  const [ledgerStartDate, setLedgerStartDate] = useState<string>('');
  const [ledgerEndDate, setLedgerEndDate] = useState<string>('');
  const [ledgerSummary, setLedgerSummary] = useState<{
    openingPayable: number;
    closingPayable: number;
    totalPurchases: number;
    totalPayments: number;
    totalReturns: number;
  }>({
    openingPayable: 0,
    closingPayable: 0,
    totalPurchases: 0,
    totalPayments: 0,
    totalReturns: 0,
  });

  const loadData = useCallback(async (bId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [suppList, accounts, drawers] = await Promise.all([
        salonService.getSuppliers(bId || 'ALL', user).catch(() => []),
        salonService.getPaymentAccounts(bId || 'ALL').catch(() => []),
        salonService.getCashDrawers(bId || 'ALL').catch(() => []),
      ]);
      setSuppliers(suppList);
      setPaymentAccounts(accounts.filter((account) => account.isActive));

      const userDrawer = drawers.find((d: any) => d.status === 'OPEN' && d.custodianUserId === user.id) || null;
      setActiveDrawer(userDrawer);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load suppliers.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData(selectedBranchId);
  }, [loadData, selectedBranchId]);

  // KPIs
  const kpis = useMemo(() => {
    let totalPayables = 0;
    let suppliersWithDebt = 0;

    suppliers.forEach((s) => {
      const bal = s.currentPayable ?? s.currentBalance ?? 0;
      totalPayables += bal;
      if (bal > 0) suppliersWithDebt++;
    });

    return {
      totalSuppliers: suppliers.length,
      totalPayables,
      suppliersWithDebt,
    };
  }, [suppliers]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.companyName && s.companyName.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  // Open Add Supplier Modal
  const handleOpenAddModal = () => {
    setFormBranchId(isSuperAdmin ? '' : user.branchId || '');
    setEditingSupplier(null);
    setSupplierFormData({
      name: '',
      companyName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      openingBalance: 0,
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierFormData({
      name: s.name,
      companyName: s.companyName || '',
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      taxNumber: s.taxNumber || '',
      openingBalance: s.openingPayable || s.openingBalance || 0,
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier && (!formBranchId || !allBranches.some((b) => b.id === formBranchId))) { toast.error('Please select a branch for this supplier.'); return; }
    if (!supplierFormData.name?.trim()) {
      const msg = 'Vendor name is required.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    try {
      if (editingSupplier) {
        await salonService.updateSupplier(
          editingSupplier.id,
          {
            name: supplierFormData.name,
            companyName: supplierFormData.companyName,
            contactPerson: supplierFormData.contactPerson,
            phone: supplierFormData.phone,
            email: supplierFormData.email,
            address: supplierFormData.address,
            taxNumber: supplierFormData.taxNumber,
          },
          user
        );
        const msg = `Supplier "${supplierFormData.name}" updated successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
      } else {
        await salonService.createSupplier(
          {
            branchId: formBranchId,
            name: supplierFormData.name,
            companyName: supplierFormData.companyName || supplierFormData.name,
            contactPerson: supplierFormData.contactPerson,
            phone: supplierFormData.phone || '—',
            email: supplierFormData.email,
            address: supplierFormData.address,
            taxNumber: supplierFormData.taxNumber,
            openingPayable: Number(supplierFormData.openingBalance) || 0,
            openingBalance: Number(supplierFormData.openingBalance) || 0,
            isActive: true,
          },
          user
        );
        const msg = `New supplier "${supplierFormData.name}" registered successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
      }
      setIsSupplierModalOpen(false);
      loadData(selectedBranchId);
    } catch (err: any) {
      const msg = err?.message || 'Failed to save supplier.';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const paymentScope = useInventoryActionScope(isPayModalOpen);
  const paymentSupplier = paymentScope.suppliers.find((supplier) => supplier.id === payingSupplier?.id);

  // Open Pay Supplier Modal
  const handleOpenPayModal = (s: Supplier) => {
    const bal = s.currentPayable ?? s.currentBalance ?? 0;
    setErrorMessage(null);
    setPayingSupplier(s);
    setPayAmount(bal > 0 ? bal : 0);
    setPayMethod('CASH');
    setPayAccountId(paymentAccounts[0]?.id || '');
    setPayReference('');
    setPayNotes('');
    setPayDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }));
    paymentKey.current = crypto.randomUUID();
    setIsPayModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentScope.validate()) return;
    if (!paymentSupplier) { toast.error('This supplier is not available in the selected branch.'); return; }
    if (!payingSupplier || paymentBusy.current) return;
    if (!Number.isFinite(payAmount) || payAmount <= 0 || payAmount > (paymentSupplier.currentPayable ?? paymentSupplier.currentBalance ?? 0)) {
      const msg = 'Enter a positive amount within the outstanding payable.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (payMethod === 'CASH' && !paymentScope.activeDrawer) {
      const msg = 'Payment from Cash Drawer requires an OPEN active cash drawer in your custody.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (payMethod === 'ONLINE' && !payAccountId) {
      const msg = 'Select a branch payment account.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    paymentBusy.current = true;
    setPaymentSubmitting(true);
    try {
      const input: PaySupplierInput = {
        idempotencyKey: paymentKey.current,
        branchId: paymentScope.branchId,
        supplierId: paymentSupplier.id,
        amount: Number(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        paymentAccountId: payMethod === 'ONLINE' ? payAccountId : undefined,
        payerDrawerId: payMethod === 'CASH' ? paymentScope.activeDrawer?.id : undefined,
        reference: payReference,
        notes: payNotes,
      };

      await salonService.paySupplier(input, user);
      const msg = `Payment voucher of PKR ${formatPKR(payAmount)} recorded for ${paymentSupplier.name}. Khata balance updated.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsPayModalOpen(false);
      loadData(selectedBranchId);
    } catch (err: any) {
      const msg = err?.message || 'Failed to record supplier payment.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally { paymentBusy.current = false; setPaymentSubmitting(false); }
  };

  // Fetch Supplier Ledger
  const fetchSupplierLedger = useCallback(
    async (suppId: string, bId: string, start?: string, end?: string) => {
      setIsLedgerLoading(true);
      setErrorMessage(null);
      try {
        const range =
          start || end
            ? { startDate: start || undefined, endDate: end || undefined }
            : undefined;
        const res = await salonService.getSupplierLedger(suppId, bId, range, user);
        setLedgerEntries(res?.entries || []);
        setLedgerSummary({
          openingPayable: res?.openingPayable || 0,
          closingPayable: res?.closingPayable || 0,
          totalPurchases: res?.totalPurchases || 0,
          totalPayments: res?.totalPayments || 0,
          totalReturns: res?.totalReturns || 0,
        });
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load supplier ledger.');
      } finally {
        setIsLedgerLoading(false);
      }
    },
    [user]
  );

  const handleSelectLedgerSupplier = (suppId: string) => {
    const supp = suppliers.find((s) => s.id === suppId);
    if (supp) {
      setLedgerSupplier(supp);
      fetchSupplierLedger(supp.id, selectedBranchId, ledgerStartDate, ledgerEndDate);
    }
  };

  useEffect(() => {
    if (pathname === '/operations/supplier-ledger' || pathname === '/operations/supplier-khata') {
      setActiveTab('LEDGER');
    } else if (
      pathname === '/operations/suppliers' ||
      pathname === '/suppliers' ||
      pathname === '/operations/vendors'
    ) {
      setActiveTab('DIRECTORY');
    }
  }, [pathname]);

  // Synchronize single supplier from URL query if present (or fallback to first debtor)
  useEffect(() => {
    const query = currentRoute.includes('?')
      ? currentRoute.split('?')[1]
      : (typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '');
    const urlParams = new URLSearchParams(query);
    const suppId = urlParams.get('supplierId');
    if (suppId && suppliers.length > 0) {
      const match = suppliers.find((s) => s.id === suppId);
      if (match) {
        setLedgerSupplier(match);
        setActiveTab('LEDGER');
        fetchSupplierLedger(match.id, selectedBranchId, ledgerStartDate, ledgerEndDate);
      }
    } else if (activeTab === 'LEDGER' && !ledgerSupplier && suppliers.length > 0) {
      const defaultSupp =
        suppliers.find((s) => (s.currentPayable ?? s.currentBalance ?? 0) > 0) || suppliers[0];
      setLedgerSupplier(defaultSupp);
      fetchSupplierLedger(defaultSupp.id, selectedBranchId, ledgerStartDate, ledgerEndDate);
    }
  }, [currentRoute, suppliers, activeTab, selectedBranchId, fetchSupplierLedger]);

  // View Khata Ledger in Modal
  const handleOpenLedger = async (s: Supplier) => {
    setLedgerSupplier(s);
    setIsLedgerModalOpen(true);
    fetchSupplierLedger(s.id, selectedBranchId, ledgerStartDate, ledgerEndDate);
  };

  // Print Ledger Statement
  const handlePrintLedger = () => {
    if (!ledgerSupplier || ledgerEntries.length === 0) return;
    const branchObj = allBranches.find((b) => b.id === selectedBranchId);
    const branchName = branchObj ? `${branchObj.name} (${branchObj.city})` : 'Salon Branch';
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Supplier Khata Statement - ${ledgerSupplier.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 32px; color: #1e293b; line-height: 1.4; }
          .header { border-bottom: 2px solid #0047ab; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 22px; font-weight: bold; color: #0b2545; }
          .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; font-size: 12px; }
          .meta-item strong { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          th { background: #eaf2fb; color: #334155; font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          tfoot td { font-weight: bold; background: #f8fafc; border-top: 2px solid #cbd5e1; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Supplier Khata Statement</div>
            <div class="subtitle">${ledgerSupplier.name} (${ledgerSupplier.companyName || 'Vendor'})</div>
            <div class="subtitle">Campus: ${branchName} | Period: ${ledgerStartDate || 'Beginning'} to ${ledgerEndDate || 'Present'}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            <div>Printed on: ${new Date().toLocaleDateString('en-GB')}</div>
            <div style="font-weight: bold; color: #0047ab; font-size: 14px; margin-top: 4px;">Closing Due: PKR ${formatPKR(ledgerSummary.closingPayable || (ledgerSupplier.currentPayable ?? ledgerSupplier.currentBalance ?? 0))}</div>
          </div>
        </div>

        <div class="meta-box">
          <div class="meta-item"><strong>Contact Person</strong>${ledgerSupplier.contactPerson || '—'}</div>
          <div class="meta-item"><strong>Phone Number</strong>${ledgerSupplier.phone || '—'}</div>
          <div class="meta-item"><strong>Tax #</strong>${ledgerSupplier.taxNumber || '—'}</div>
          <div class="meta-item"><strong>Address</strong>${ledgerSupplier.address || '—'}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Date</th>
              <th>Type</th>
              <th>Reference #</th>
              <th>Description</th>
              <th class="text-right">Debit (Bill)</th>
              <th class="text-right">Credit (Paid)</th>
              <th class="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerEntries.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${formatDate(e.date)}</td>
                <td>${e.entryType || e.type || 'Transaction'}</td>
                <td>${e.referenceNumber || e.reference || '—'}</td>
                <td>${e.description || '—'}</td>
                <td class="text-right">${e.debit > 0 ? 'PKR ' + formatPKR(e.debit) : '—'}</td>
                <td class="text-right">${e.credit > 0 ? 'PKR ' + formatPKR(e.credit) : '—'}</td>
                <td class="text-right font-bold">PKR ${formatPKR(e.runningBalance)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5">Totals</td>
              <td class="text-right">PKR ${formatPKR(ledgerSummary.totalPurchases)}</td>
              <td class="text-right">PKR ${formatPKR(ledgerSummary.totalPayments)}</td>
              <td class="text-right">PKR ${formatPKR(ledgerSummary.closingPayable || (ledgerSupplier.currentPayable ?? ledgerSupplier.currentBalance ?? 0))}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.document.fonts.ready.then(() => {
      printWindow.print();
    });
  };

  // Export Ledger CSV
  const handleExportLedgerCsv = () => {
    if (!ledgerSupplier || ledgerEntries.length === 0) return;
    const headers = ['#', 'Date', 'Type', 'Reference', 'Description', 'Debit (Bill)', 'Credit (Paid)', 'Running Balance'];
    const rows = ledgerEntries.map((e, idx) => [
      idx + 1,
      formatDate(e.date),
      e.entryType || e.type || '',
      e.referenceNumber || e.reference || '',
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.debit || 0,
      e.credit || 0,
      e.runningBalance || 0,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Supplier_Ledger_${ledgerSupplier.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 max-w-7xl mx-auto font-['Inter',sans-serif]">
      {/* Header */}
      <InventoryNavHeader
        title={activeTab === 'LEDGER' ? 'Supplier Khata Ledger Statements' : 'Suppliers & Vendors Management'}
        subtitle={
          activeTab === 'LEDGER'
            ? 'Audit chronological bills, payments, returns and running debt balance per supplier.'
            : 'Maintain vendor directory, outstanding khata balances, purchase histories and disbursement payment vouchers.'
        }
        activePath={activeTab === 'LEDGER' ? '/operations/supplier-ledger' : '/operations/suppliers'}
        selectedBranchId={selectedBranchId}
        onBranchChange={setSelectedBranchId}
        primaryAction={{
          label: activeTab === 'LEDGER' ? 'Record Payment' : 'Add New Supplier',
          icon: activeTab === 'LEDGER' ? <Banknote className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />,
          onClick: activeTab === 'LEDGER' && ledgerSupplier ? () => handleOpenPayModal(ledgerSupplier) : handleOpenAddModal,
        }}
      />

      {/* View Switcher Tabs: Directory vs Khata Ledger */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('DIRECTORY');
            navigate('/operations/suppliers');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'DIRECTORY'
              ? 'bg-[#0047AB] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Vendors Directory ({suppliers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('LEDGER');
            navigate('/operations/supplier-ledger');
            if (!ledgerSupplier && suppliers.length > 0) {
              const defaultSupp =
                suppliers.find((s) => (s.currentPayable ?? s.currentBalance ?? 0) > 0) || suppliers[0];
              setLedgerSupplier(defaultSupp);
              fetchSupplierLedger(defaultSupp.id, selectedBranchId);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'LEDGER'
              ? 'bg-[#0047AB] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Supplier Khata Ledger Statements</span>
        </button>
      </div>

      {/* --- TAB 1: VENDORS DIRECTORY --- */}
      {activeTab === 'DIRECTORY' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Suppliers / Vendors
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0047AB] flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{kpis.totalSuppliers}</div>
              <div className="text-[11px] text-slate-500 mt-1">Active vendor partners</div>
            </div>

            <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-xs bg-linear-to-br from-white to-rose-50/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                  Total Outstanding Payables (Khata)
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-rose-900">PKR {formatPKR(kpis.totalPayables)}</div>
              <div className="text-[11px] text-rose-700 mt-1">Cumulative unpaid supplier balance</div>
            </div>

            <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-xs bg-linear-to-br from-white to-amber-50/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
                  Vendors with Unsettled Khata
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-amber-900">{kpis.suppliersWithDebt}</div>
              <div className="text-[11px] text-amber-700 mt-1">Vendors awaiting payments</div>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by vendor name, company, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('LEDGER');
                  navigate('/operations/supplier-ledger');
                }}
                className="text-xs font-semibold px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#0047AB]" />
                <span>View Full Ledger</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="text-xs font-semibold px-4 py-2 bg-[#0047AB] hover:bg-[#003785] text-white rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Supplier</span>
              </button>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden mb-8">
            <div className="bg-[#0047AB] text-white px-5 py-3 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
                <Truck className="w-4 h-4 stroke-[2.5]" />
                <span>Suppliers & Vendors Directory ({filteredSuppliers.length})</span>
              </div>
            </div>

            {isLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
                <p className="text-slate-600 text-sm font-medium">Loading suppliers directory...</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <Truck className="w-12 h-12 stroke-[1.25] text-slate-400 mb-3" />
                <p className="text-slate-600 text-sm font-semibold mb-1">No suppliers registered yet</p>
                <p className="text-slate-400 text-xs mb-4">Add your product suppliers and distributor contacts.</p>
                <button
                  onClick={handleOpenAddModal}
                  className="text-xs font-semibold px-4 py-2 bg-[#0047AB] text-white rounded-md hover:bg-[#003785] transition-colors"
                >
                  Add First Supplier
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="report-records w-full min-w-[950px] text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                      <th className="py-3.5 px-4 text-center w-12">#</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Supplier / Vendor</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Company / Brand</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Contact Details</th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap font-bold">Outstanding Khata</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                      <th className="py-3.5 px-4 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-slate-200">
                    {filteredSuppliers.map((s, idx) => {
                      const bal = s.currentPayable ?? s.currentBalance ?? 0;
                      const hasDebt = bal > 0;

                      return (
                        <tr key={s.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="py-3.5 px-4 text-center text-slate-400 font-normal">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{s.name}</div>
                            {s.contactPerson && (
                              <div className="text-[11px] text-slate-400">Rep: {s.contactPerson}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                            {s.companyName || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{s.phone || '—'}</span>
                            </div>
                            {s.email && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                <Mail className="w-3 h-3" />
                                <span>{s.email}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setLedgerSupplier(s);
                                setActiveTab('LEDGER');
                                navigate(`/operations/supplier-ledger?supplierId=${s.id}`);
                                fetchSupplierLedger(s.id, selectedBranchId);
                              }}
                              className="group inline-flex flex-col items-end cursor-pointer"
                              title="Click to view supplier khata ledger"
                            >
                              {hasDebt ? (
                                <span className="font-bold text-rose-700 text-[14px] group-hover:underline flex items-center gap-1">
                                  <span>PKR {formatPKR(bal)}</span>
                                  <BookOpen className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                              ) : (
                                <span className="font-medium text-emerald-700 group-hover:underline flex items-center gap-1">
                                  <span>PKR 0.00 (Settled)</span>
                                  <BookOpen className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 group-hover:text-[#0047AB]">View Khata →</span>
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {hasDebt ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                Payable Due
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                All Settled
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenPayModal(s)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1 cursor-pointer"
                                title="Record Payment Voucher"
                              >
                                <Banknote className="w-3 h-3" />
                                <span>Pay</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLedgerSupplier(s);
                                  setActiveTab('LEDGER');
                                  navigate(`/operations/supplier-ledger?supplierId=${s.id}`);
                                  fetchSupplierLedger(s.id, selectedBranchId);
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0047AB] border border-blue-200 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                                title="View Supplier Khata Ledger Statement"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>Ledger</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(s)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Edit Supplier"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- TAB 2: SUPPLIER KHATA LEDGER STATEMENTS --- */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-6 mb-8">
          {/* Supplier Selector & Date Filters Bar */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              {/* Supplier Picker */}
              <div className="lg:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#0047AB]" />
                    <span>Select Vendor / Supplier *</span>
                  </span>
                  {ledgerSupplier && (
                    <span className="text-[11px] font-medium text-slate-400">
                      Rep: {ledgerSupplier.contactPerson || '—'} · {ledgerSupplier.phone || 'No phone'}
                    </span>
                  )}
                </label>
                <select
                  value={ledgerSupplier?.id || ''}
                  onChange={(e) => handleSelectLedgerSupplier(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                >
                  {suppliers.map((s) => {
                    const bal = s.currentPayable ?? s.currentBalance ?? 0;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.companyName || 'Vendor'}) — PKR {formatPKR(bal)} {bal > 0 ? 'DUE' : 'SETTLED'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Date Filters */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>From Date</span>
                </label>
                <input
                  type="date"
                  value={ledgerStartDate}
                  onChange={(e) => setLedgerStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-hidden"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>To Date</span>
                </label>
                <input
                  type="date"
                  value={ledgerEndDate}
                  min={ledgerStartDate || undefined}
                  onChange={(e) => setLedgerEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="lg:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (ledgerSupplier) {
                      fetchSupplierLedger(ledgerSupplier.id, selectedBranchId, ledgerStartDate, ledgerEndDate);
                    }
                  }}
                  disabled={isLedgerLoading || !ledgerSupplier}
                  className="flex-1 h-[38px] bg-[#0047AB] hover:bg-[#003785] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isLedgerLoading ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                  ) : (
                    <Filter className="w-3.5 h-3.5" />
                  )}
                  <span>Filter Statement</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLedgerStartDate('');
                    setLedgerEndDate('');
                    if (ledgerSupplier) {
                      fetchSupplierLedger(ledgerSupplier.id, selectedBranchId);
                    }
                  }}
                  className="h-[38px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
                  title="Clear Date Filters"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Supplier Info & Quick Summary Cards */}
          {ledgerSupplier && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Opening Balance
                </div>
                <div className="text-xl font-bold text-slate-900">
                  PKR {formatPKR(ledgerSummary.openingPayable)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Khata balance before period</div>
              </div>

              <div className="bg-white rounded-xl border border-blue-200/90 p-4 shadow-xs bg-linear-to-br from-white to-blue-50/20">
                <div className="text-[11px] font-semibold text-[#0047AB] uppercase tracking-wider mb-1">
                  Total Purchases / Bills
                </div>
                <div className="text-xl font-bold text-[#0B2545]">
                  PKR {formatPKR(ledgerSummary.totalPurchases)}
                </div>
                <div className="text-[11px] text-blue-700 mt-1">Inventory received on credit</div>
              </div>

              <div className="bg-white rounded-xl border border-emerald-200/90 p-4 shadow-xs bg-linear-to-br from-white to-emerald-50/20">
                <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                  Total Payments Disbursed
                </div>
                <div className="text-xl font-bold text-emerald-800">
                  PKR {formatPKR(ledgerSummary.totalPayments)}
                </div>
                <div className="text-[11px] text-emerald-600 mt-1">Cash & bank vouchers cleared</div>
              </div>

              <div className="bg-white rounded-xl border border-rose-200/90 p-4 shadow-xs bg-linear-to-br from-white to-rose-50/20">
                <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider mb-1">
                  Current Khata Balance
                </div>
                <div className="text-xl font-bold text-rose-700">
                  PKR {formatPKR(ledgerSummary.closingPayable || (ledgerSupplier.currentPayable ?? ledgerSupplier.currentBalance ?? 0))}
                </div>
                <div className="text-[11px] text-rose-600 mt-1">Net outstanding payable</div>
              </div>
            </div>
          )}

          {/* Statement Table Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Header with Title and Print/Export Actions */}
            <div className="bg-[#0047AB] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 stroke-[2.5]" />
                <span className="font-bold text-sm tracking-wide">
                  Khata Ledger Statement: {ledgerSupplier?.name || 'Selected Supplier'}
                </span>
                <span className="text-blue-200 text-xs">
                  ({ledgerEntries.length} Records)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {ledgerSupplier && (
                  <button
                    type="button"
                    onClick={() => handleOpenPayModal(ledgerSupplier)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Pay Supplier</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePrintLedger}
                  disabled={ledgerEntries.length === 0}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  title="Print Khata Statement"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportLedgerCsv}
                  disabled={ledgerEntries.length === 0}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  title="Export Statement CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Table or Loading */}
            {isLedgerLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
                <p className="text-slate-600 text-sm font-medium">Loading ledger entries...</p>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <Truck className="w-12 h-12 stroke-[1.25] text-slate-300 mb-3" />
                <p className="text-slate-800 text-sm font-semibold mb-1">No Suppliers Registered Yet</p>
                <p className="text-slate-500 text-xs max-w-md mb-4">
                  There are no vendors registered in Warsi Salon. Register a supplier to start recording stock shipments, purchase bills, and view their single khata ledger statements.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-[#0047AB] hover:bg-[#003785] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register First Supplier</span>
                </button>
              </div>
            ) : !ledgerSupplier ? (
              <div className="p-16 text-center text-slate-400 text-sm">
                Please select a vendor / supplier above to view their statement.
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-center">
                <BookOpen className="w-12 h-12 stroke-[1.25] text-slate-300 mb-3" />
                <p className="text-slate-600 text-sm font-semibold mb-1">No transactions recorded</p>
                <p className="text-slate-400 text-xs">
                  There are no purchase bills or payments logged for {ledgerSupplier.name} in this period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="report-records w-full min-w-[900px] text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 whitespace-nowrap">Date & Time</th>
                      <th className="py-3 px-4 whitespace-nowrap">Entry Type</th>
                      <th className="py-3 px-4 whitespace-nowrap">Reference #</th>
                      <th className="py-3 px-4 min-w-[200px]">Description</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap font-bold">Bill (Debit)</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap font-bold">Paid (Credit)</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap font-bold text-[#0047AB]">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-slate-200">
                    {ledgerEntries.map((e, idx) => {
                      const isPayment = e.entryType === 'SUPPLIER_PAYMENT' || e.referenceType === 'PAYMENT';
                      const isReturn = e.entryType === 'PURCHASE_RETURN' || e.referenceType === 'RETURN';

                      return (
                        <tr key={e.id || idx} className="hover:bg-blue-50/20 transition-colors">
                          <td className="py-3 px-4 text-center text-slate-400 text-xs">{idx + 1}</td>
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap text-xs">
                            <span className="font-medium text-slate-900">{formatDate(e.date)}</span>
                            {e.time && <span className="text-slate-400 text-[11px] ml-1.5">{e.time}</span>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isPayment ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                Payment Voucher
                              </span>
                            ) : isReturn ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                                Purchase Return
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                                Purchase Bill
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                            {e.referenceNumber || e.reference || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            {e.description || '—'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap text-xs font-semibold text-slate-900">
                            {e.debit > 0 ? `PKR ${formatPKR(e.debit)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap text-xs font-semibold text-emerald-700">
                            {e.credit > 0 ? `PKR ${formatPKR(e.credit)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap text-xs font-bold text-[#0047AB]">
                            PKR {formatPKR(e.runningBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#F8FAFC] font-bold text-[#0B2545] border-t-2 border-slate-200 text-[13px]">
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-left">Period Totals</td>
                      <td className="py-3 px-4 text-right text-slate-900">PKR {formatPKR(ledgerSummary.totalPurchases)}</td>
                      <td className="py-3 px-4 text-right text-emerald-700">PKR {formatPKR(ledgerSummary.totalPayments)}</td>
                      <td className="py-3 px-4 text-right text-rose-700">PKR {formatPKR(ledgerSummary.closingPayable || (ledgerSupplier?.currentPayable ?? ledgerSupplier?.currentBalance ?? 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: ADD / EDIT SUPPLIER --- */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingSupplier ? 'Edit Supplier' : 'Register New Supplier / Vendor'}
              </h2>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4 pt-4">
              {!editingSupplier && <BranchActionField value={formBranchId} onChange={setFormBranchId} />}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor / Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asad Traders"
                    value={supplierFormData.name || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company / Brand Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. L'Oreal Official Distributor"
                    value={supplierFormData.companyName || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, companyName: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0300-1234567"
                    value={supplierFormData.phone || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="vendor@company.com"
                    value={supplierFormData.email || ''}
                    onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Address / City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shop # 14, Main Market, Lahore"
                  value={supplierFormData.address || ''}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0047AB] hover:bg-[#003785] rounded-lg shadow-xs cursor-pointer"
                >
                  {editingSupplier ? 'Save Changes' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: PAY SUPPLIER (RECORD PAYMENT VOUCHER) --- */}
      {isPayModalOpen && payingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Pay Supplier: {payingSupplier.name}</span>
                </h3>
                <div className="text-xs text-rose-700 font-semibold mt-0.5">
                  Current Khata Balance: PKR {formatPKR(payingSupplier.currentPayable ?? payingSupplier.currentBalance ?? 0)}
                </div>
              </div>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4 pt-4">
              <BranchActionField value={paymentScope.branchId} disabled={paymentSubmitting} onChange={(id) => { paymentScope.setBranchId(id); setPayAccountId(''); setPayAmount(0); }} />
              {paymentScope.error && <p role="alert" className="text-xs text-rose-600">{paymentScope.error}</p>}
              {paymentScope.ready && !paymentSupplier && <p role="alert" className="text-xs text-rose-600">Select the branch belonging to this supplier.</p>}
              <fieldset disabled={!paymentScope.ready || !paymentSupplier} className="space-y-4 disabled:opacity-50">
              {errorMessage && <p role="alert" className="text-xs text-rose-700">{errorMessage}</p>}
              <label className="block text-xs font-semibold">Payment Date *<input type="date" required value={payDate} onChange={(e) => setPayDate(e.target.value)} className="block w-full border rounded-lg px-3 py-2" /></label>
              <label className="block text-xs font-semibold">Notes<input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="block w-full border rounded-lg px-3 py-2" /></label>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={(payingSupplier.currentPayable ?? payingSupplier.currentBalance ?? 0) > 0 ? (payingSupplier.currentPayable ?? payingSupplier.currentBalance ?? 0) : undefined}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full text-sm font-bold text-[#0047AB] px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Source *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden"
                >
                  <option value="CASH">Cash Drawer (Disburse from Active Custody)</option>
                  <option value="ONLINE">Bank / Online Account Transfer</option>
                </select>
              </div>

              {payMethod === 'ONLINE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Bank / Online Account *
                  </label>
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden"
                  >
                    <option value="">Select a bank / online account</option>
                    {paymentScope.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.bankName || 'Bank'}) — PKR {formatPKR(a.currentBalance || 0)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {payMethod === 'CASH' && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900">
                  {paymentScope.activeDrawer ? (
                    <div>Disbursing from active drawer <strong>#{paymentScope.activeDrawer.drawerName}</strong></div>
                  ) : (
                    <div className="text-rose-700 font-bold">No active drawer open! Open shift custody first.</div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Reference / Voucher #
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{paymentSubmitting ? 'Posting?' : 'Confirm Payment'}</span>
                </button>
              </div>
            
              </fieldset>
</form>
          </div>
        </div>
      )}

      {/* --- MODAL: KHATA LEDGER STATEMENT --- */}
      {isLedgerModalOpen && ledgerSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#0047AB]" />
                  <span>Khata Ledger: {ledgerSupplier.name}</span>
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Chronological purchases, payments and running debt balance.
                </div>
              </div>
              <button onClick={() => setIsLedgerModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto py-4 flex-1">
              {isLedgerLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 rounded-full border-[2.5px] border-blue-100 border-t-[#2254E1] animate-spin mb-2" />
                  <p className="text-slate-500 text-xs">Loading ledger entries...</p>
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No recorded ledger transactions for this supplier yet.
                </div>
              ) : (
                <table className="report-records w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3 text-right">Debit (Bill)</th>
                      <th className="py-2.5 px-3 text-right">Credit (Paid)</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerEntries.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-600">{formatDate(e.date)}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{e.entryType || e.type}</td>
                        <td className="py-2 px-3 text-slate-600">{e.referenceNumber || e.reference || '—'}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {e.debit > 0 ? `PKR ${formatPKR(e.debit)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-emerald-700">
                          {e.credit > 0 ? `PKR ${formatPKR(e.credit)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#0047AB]">
                          PKR {formatPKR(e.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="text-xs font-bold text-slate-900">
                Current Khata Balance:{' '}
                <span className="text-rose-700">PKR {formatPKR(ledgerSupplier.currentPayable ?? ledgerSupplier.currentBalance ?? 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintLedger}
                  disabled={ledgerEntries.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLedgerModalOpen(false);
                    handleOpenPayModal(ledgerSupplier);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Pay</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLedgerModalOpen(false);
                    setActiveTab('LEDGER');
                    navigate(`/operations/supplier-ledger?supplierId=${ledgerSupplier.id}`);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#0047AB] hover:bg-[#003785] text-white rounded-lg cursor-pointer"
                >
                  Open Full Statement →
                </button>
                <button
                  type="button"
                  onClick={() => setIsLedgerModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SuppliersVendorsPage;
