import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { Invoice, PaymentAccount, InvoiceStatus, POSPaymentEntry } from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { ReceiptModal } from '@/features/pos/ReceiptModal';
import { formatCurrency } from '@/lib/formatters';
import { toast } from '@/context/ToastContext';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  AlertCircle,
  CreditCard,
  Banknote,
  Receipt,
  Phone,
  User,
  Calendar,
  Building2,
  RefreshCw,
  Coins,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const UnpaidInvoicesPage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/reports/unpaid-invoices" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const branchScope = isSuperAdmin ? activeBranchId : (user.branchId as string);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Collect Payment Modal state
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectMethod, setCollectMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectCashTendered, setCollectCashTendered] = useState<number>(0);
  const [selectedOnlineAccountId, setSelectedOnlineAccountId] = useState<string>('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [collectionIdempotencyKey, setCollectionIdempotencyKey] = useState<string>('');

  // Receipt Modal state
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allInvs, allAccs] = await Promise.all([
        salonService.getInvoices(branchScope),
        salonService.getPaymentAccounts(branchScope),
      ]);
      // Only invoices with pending receivable balances
      const unpaidList = allInvs.filter((inv) => inv.amountDue > 0 && inv.status !== 'PAID');
      setInvoices(unpaidList);
      const activeAccs = allAccs.filter((a) => a.isActive);
      setPaymentAccounts(activeAccs);
      if (activeAccs.length > 0) {
        setSelectedOnlineAccountId(activeAccs[0].id);
      }
    } catch (err) {
      console.error('Failed to load unpaid invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchScope, demoDate]);

  // Filtered unpaid invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientPhone.toLowerCase().includes(q)
      );
    });
  }, [invoices, searchQuery]);

  const totalOutstanding = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);
  }, [filteredInvoices]);

  // Open Collect Modal
  const handleOpenCollect = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setCollectAmount(inv.amountDue);
    setCollectCashTendered(inv.amountDue);
    setCollectError(null);
    setCollectionNotes('');
    setCollectMethod('CASH');

    const key = `COLLECT-${inv.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setCollectionIdempotencyKey(key);

    // Find accounts for this invoice's branch
    const branchAccs = paymentAccounts.filter((a) => (a.branchIds ?? [a.branchId]).includes(inv.branchId));
    if (branchAccs.length > 0) {
      setSelectedOnlineAccountId(branchAccs[0].id);
    }

    setIsCollectModalOpen(true);
  };

  // Submit collection
  const handleSubmitCollection = async () => {
    if (!selectedInvoice) return;
    setIsCollecting(true);
    setCollectError(null);

    try {
      const paymentAmount = Math.max(0, collectAmount);
      if (paymentAmount <= 0) {
        throw new Error('Please enter a collection amount greater than 0.');
      }
      if (paymentAmount > selectedInvoice.amountDue) {
        throw new Error(`Collection amount cannot exceed outstanding balance (${selectedInvoice.amountDue} PKR).`);
      }

      const payments: POSPaymentEntry[] = [];

      if (collectMethod === 'CASH') {
        const tendered = Math.max(paymentAmount, collectCashTendered || paymentAmount);
        const change = Math.max(0, tendered - paymentAmount);
        payments.push({
          method: 'CASH',
          amount: paymentAmount,
          billAllocation: paymentAmount,
          tipAllocation: 0,
          cashTendered: tendered,
          changeReturned: change,
        });
      } else {
        const acc = paymentAccounts.find((a) => a.id === selectedOnlineAccountId);
        if (!acc) {
          throw new Error('Please select an active payment account.');
        }
        payments.push({
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: acc.id,
          paymentAccountName: `${acc.name} (${acc.accountIdentifier})`,
          amount: paymentAmount,
          billAllocation: paymentAmount,
          tipAllocation: 0,
        });
      }

      const updated = await salonService.collectInvoicePayment(
        {
          invoiceId: selectedInvoice.id,
          payments,
          idempotencyKey: collectionIdempotencyKey,
          notes: collectionNotes,
        },
        user
      );

      // Successfully collected
      setIsCollectModalOpen(false);
      setReceiptInvoice(updated);
      setIsReceiptOpen(true);
      toast.success('Payment collected and invoice settled successfully!');
      await loadData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh-notifications'));
      }
    } catch (err: any) {
      console.error('Failed to collect payment:', err);
      const msg = err.message || 'Payment collection failed.';
      setCollectError(msg);
      toast.error(msg);
    } finally {
      setIsCollecting(false);
    }
  };

  const getBranchName = (bId: string) => {
    return allBranches.find((b) => b.id === bId)?.name || bId;
  };

  return (
    <div className="space-y-4 font-sans max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Unpaid Invoices & Receivables</h1>
              <Badge variant="destructive" className="text-[10px]">{invoices.length} Pending</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Follow up customer balances, record payments into cashier drawers, and settle outstanding bills.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="text-xs gap-1.5 self-start sm:self-center"
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-100 border-t-[#2254E1] animate-spin shrink-0" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh Receivables
        </Button>
      </div>

      {/* Aggregate Receivable Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card padding="sm" className="bg-white border-slate-200/80">
          <span className="text-[11px] text-slate-500 block">Total Unpaid Invoices</span>
          <span className="text-lg font-mono font-bold text-slate-900">{filteredInvoices.length}</span>
          <span className="text-[10px] text-slate-400 block">Requiring settlement</span>
        </Card>

        <Card padding="sm" className="bg-white border-slate-200/80">
          <span className="text-[11px] text-slate-500 block">Total Receivable Balance</span>
          <span className="text-lg font-mono font-bold text-rose-600">{formatCurrency(totalOutstanding)}</span>
          <span className="text-[10px] text-slate-400 block">Cumulative unpaid debt</span>
        </Card>

        <Card padding="sm" className="bg-white border-slate-200/80">
          <span className="text-[11px] text-slate-500 block">Operating Collection Date</span>
          <span className="text-lg font-mono font-bold text-[#2254E1]">{demoDate}</span>
          <span className="text-[10px] text-slate-400 block">Receipts will post to today's custody</span>
        </Card>
      </div>

      {/* Search Input */}
      <Card padding="sm">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search customer, phone, or invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8.5 h-8.5 text-xs"
          />
        </div>
      </Card>

      {/* Unpaid Invoices Table */}
      <Card padding="none" className="overflow-hidden border-slate-200/90 shadow-2xs">
        <div className="overflow-x-auto">
          <Table className="min-w-[1000px] w-full">
            <TableHeader>
              <TableRow className="bg-slate-50/75">
                <TableHead className="text-xs font-semibold whitespace-nowrap">Invoice No.</TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap">Sale Date</TableHead>
                {isSuperAdmin && branchScope === 'ALL' && (
                  <TableHead className="text-xs font-semibold whitespace-nowrap">Branch</TableHead>
                )}
                <TableHead className="text-xs font-semibold whitespace-nowrap">Customer Details</TableHead>
                <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Bill Total</TableHead>
                <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Paid So Far</TableHead>
                <TableHead className="text-xs font-semibold text-right whitespace-nowrap">Balance Due</TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap">Status</TableHead>
                <TableHead className="w-36 text-center text-xs font-semibold whitespace-nowrap">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isSuperAdmin && branchScope === 'ALL' ? 9 : 8}
                    className="py-12 text-center text-slate-400 text-xs"
                  >
                    No outstanding unpaid invoices found. All client balances are fully reconciled!
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-slate-50/50 transition-colors text-xs">
                    <TableCell className="font-mono font-bold text-slate-900 whitespace-nowrap">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap">
                      {inv.date} <span className="text-slate-400 text-[10px]">{inv.time}</span>
                    </TableCell>
                    {isSuperAdmin && branchScope === 'ALL' && (
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {getBranchName(inv.branchId)}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      <span className="font-semibold text-slate-900 block">{inv.clientName}</span>
                      <span className="text-[10px] text-slate-500 font-mono block flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {inv.clientPhone}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                      {formatCurrency(inv.netSales + inv.tax)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-700 whitespace-nowrap">
                      {formatCurrency(inv.amountPaid)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-rose-600 text-sm whitespace-nowrap">
                      {formatCurrency(inv.amountDue)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={inv.status === 'PARTIAL' ? 'warning' : 'destructive'}
                        className="text-[10px]"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Button
                        size="sm"
                        onClick={() => handleOpenCollect(inv)}
                        className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Coins className="w-3 h-3" />
                        Collect Payment
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* COLLECT PAYMENT MODAL */}
      <Dialog open={isCollectModalOpen} onOpenChange={setIsCollectModalOpen}>
        <DialogContent className="max-w-md font-sans p-4 sm:p-5 space-y-2.5">
          <DialogHeader className="pb-1 border-b border-slate-100">
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                Collect Outstanding Receivable
              </DialogTitle>
              <Badge variant="neutral" className="text-[10px] font-mono bg-blue-50 text-[#2254E1] border-blue-200">
                {selectedInvoice?.invoiceNumber}
              </Badge>
            </div>
            <DialogDescription className="text-[11px] text-slate-500">
              Record customer payment against Invoice {selectedInvoice?.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>

          {/* Form Content */}
          {selectedInvoice && (
            <div className="space-y-2.5 text-xs">
              {/* Compact Customer & Outstanding Balance Card */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{selectedInvoice.clientName}</span>
                    {selectedInvoice.clientPhone && (
                      <span className="text-[10px] font-normal font-mono text-slate-500">({selectedInvoice.clientPhone})</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">Sale Date: {selectedInvoice.date} (retained)</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wide block">Balance Due</span>
                  <span className="font-mono font-extrabold text-rose-700 text-sm">
                    {formatCurrency(selectedInvoice.amountDue)}
                  </span>
                </div>
              </div>

              {/* Method choice */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-1">Receipt Payment Method</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCollectMethod('CASH')}
                    className={`h-7.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      collectMethod === 'CASH'
                        ? 'bg-blue-50 border-[#2254E1] text-[#2254E1] font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Physical Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMethod('ONLINE')}
                    className={`h-7.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      collectMethod === 'ONLINE'
                        ? 'bg-blue-50 border-[#2254E1] text-[#2254E1] font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Online Account
                  </button>
                </div>
              </div>

              {/* Amount to Collect Input */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[10px] font-bold text-slate-700">Amount to Collect (PKR)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCollectAmount(selectedInvoice.amountDue);
                      setCollectCashTendered(selectedInvoice.amountDue);
                    }}
                    className="text-[10px] text-[#2254E1] hover:underline font-bold cursor-pointer"
                  >
                    Full Balance ({formatCurrency(selectedInvoice.amountDue)})
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={selectedInvoice.amountDue}
                  value={collectAmount || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setCollectAmount(val);
                    setCollectCashTendered(val);
                  }}
                  className="font-mono font-bold text-xs h-7.5"
                />
              </div>

              {/* Cash Tendered / Change */}
              {collectMethod === 'CASH' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Cash Tendered (PKR)</label>
                    <Input
                      type="number"
                      min="0"
                      value={collectCashTendered || ''}
                      onChange={(e) => setCollectCashTendered(parseFloat(e.target.value) || 0)}
                      className="font-mono h-7 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Change Returned</label>
                    <div className="h-7 flex items-center font-mono font-bold text-emerald-700 text-xs px-2 bg-slate-50 border border-slate-200 rounded-md">
                      {formatCurrency(Math.max(0, collectCashTendered - collectAmount))}
                    </div>
                  </div>
                </div>
              )}

              {/* Online Account Picker */}
              {collectMethod === 'ONLINE' && (
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Deposit To Payment Account</label>
                  <Select
                    value={selectedOnlineAccountId}
                    onValueChange={setSelectedOnlineAccountId}
                  >
                    <SelectTrigger className="h-7.5 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts
                        .filter((a) => (a.branchIds ?? [a.branchId]).includes(selectedInvoice.branchId))
                        .map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} className="text-xs">
                            {acc.name} ({acc.accountIdentifier})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Collection Notes */}
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-0.5">Collection Notes (Optional)</label>
                <Input
                  placeholder="e.g. Cleared remaining balance via cash till"
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>

              {/* Compact Audit Badge */}
              <div className="py-1 px-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Receipt attributed to <strong className="text-slate-700">{user.name}</strong></span>
                <span>Date: <strong className="text-slate-700">{demoDate}</strong></span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1 border-t border-slate-100 sm:justify-end">
            <Button
              variant="outline"
              disabled={isCollecting}
              onClick={() => setIsCollectModalOpen(false)}
              className="text-xs h-7.5 px-3"
            >
              Cancel
            </Button>
            <Button
              disabled={isCollecting || collectAmount <= 0}
              onClick={handleSubmitCollection}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7.5 px-3.5 gap-1.5 cursor-pointer font-bold"
            >
              {isCollecting ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm Receipt ({formatCurrency(collectAmount)})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRINTABLE RECEIPT MODAL */}
      {isReceiptOpen && receiptInvoice && (
        <ReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          invoice={receiptInvoice}
          branch={allBranches.find((b) => b.id === receiptInvoice?.branchId) || null}
        />
      )}
    </div>
  );
};
