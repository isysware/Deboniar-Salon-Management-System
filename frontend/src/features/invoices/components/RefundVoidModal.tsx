import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  Invoice,
  PaymentAccount,
  RefundInvoiceInput,
  RefundLineInput,
  RefundInvoiceResult,
} from '@/types/salon';
import { formatCurrency } from '@/lib/formatters';
import { toast } from '@/context/ToastContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  RotateCcw,
  Ban,
  CheckCircle2,
  DollarSign,
  Package,
  Scissors,
  Layers,
  Wallet,
  Building,
  Loader2,
  Info,
} from 'lucide-react';

interface RefundVoidModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess: (result: RefundInvoiceResult) => void;
}

const QUICK_REASONS = [
  'Customer Request',
  'Dissatisfied with Service',
  'Billing / Pricing Error',
  'Product Return / Exchange',
  'Duplicate Invoice',
  'Customer Cancelled Appointment',
];

export const RefundVoidModal: React.FC<RefundVoidModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}) => {
  const { user } = useAuth();

  const [actionType, setActionType] = useState<'VOID' | 'REFUND'>('VOID');
  const [reason, setReason] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'ONLINE_ACCOUNT'>('CASH');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Line selections for REFUND mode: lineId -> { selected, quantity, restock }
  const [lineSelections, setLineSelections] = useState<
    Record<
      string,
      {
        selected: boolean;
        quantity: number;
        restock: 'RESALABLE' | 'DAMAGED' | 'NONE';
      }
    >
  >({});

  // Reset & initialize state when invoice changes or modal opens
  useEffect(() => {
    if (!isOpen || !invoice) {
      setReason('');
      setActionType('VOID');
      setLineSelections({});
      return;
    }

    const lines = invoice.lines || invoice.lineItems || [];
    const initial: Record<
      string,
      {
        selected: boolean;
        quantity: number;
        restock: 'RESALABLE' | 'DAMAGED' | 'NONE';
      }
    > = {};

    lines.forEach((l) => {
      // Calculate remaining quantity if refunds already exist
      const alreadyRefunded = (invoice.refunds || [])
        .flatMap((r) => r.lines || [])
        .filter((rl) => rl.lineId === l.id)
        .reduce((sum, rl) => sum + Number(rl.quantity || 0), 0);
      const remaining = Math.max(0, l.quantity - alreadyRefunded);

      initial[l.id] = {
        selected: remaining > 0,
        quantity: remaining,
        restock: l.type === 'PRODUCT' ? 'RESALABLE' : 'NONE',
      };
    });

    setLineSelections(initial);

    // Default refund method to match how the customer paid if online account was used
    if (invoice.paymentMethod === 'ONLINE_ACCOUNT' || invoice.paymentAccountId) {
      setRefundMethod('ONLINE_ACCOUNT');
      if (invoice.paymentAccountId) setSelectedAccountId(invoice.paymentAccountId);
    } else {
      setRefundMethod('CASH');
    }

    // Load available online/payment accounts for the branch
    if (invoice.branchId) {
      setIsLoadingAccounts(true);
      salonService
        .getPaymentAccounts(invoice.branchId)
        .then((accounts) => {
          setPaymentAccounts(accounts.filter((a) => a.isActive));
          if (!selectedAccountId && accounts.length > 0) {
            setSelectedAccountId(accounts[0].id);
          }
        })
        .catch((err) => console.error('Failed to load payment accounts:', err))
        .finally(() => setIsLoadingAccounts(false));
    }
  }, [isOpen, invoice]);

  const lines = useMemo(() => {
    if (!invoice) return [];
    return invoice.lines || invoice.lineItems || [];
  }, [invoice]);

  // Already refunded quantities map
  const alreadyRefundedMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!invoice || !invoice.refunds) return map;
    for (const r of invoice.refunds) {
      for (const l of r.lines || []) {
        map.set(l.lineId, (map.get(l.lineId) || 0) + Number(l.quantity || 0));
      }
    }
    return map;
  }, [invoice]);

  // Reactive financial calculations for preview
  const calculations = useMemo(() => {
    if (!invoice) {
      return {
        netReversed: 0,
        taxReversed: 0,
        totalReversed: 0,
        cashOut: 0,
        receivableCancelled: 0,
        canSubmit: false,
      };
    }

    const isVoid = actionType === 'VOID';

    let netReversed = 0;
    let taxReversed = 0;
    let selectedLineCount = 0;

    for (const line of lines) {
      const already = alreadyRefundedMap.get(line.id) || 0;
      const remaining = Math.max(0, line.quantity - already);
      if (remaining <= 0) continue;

      let refundQty = 0;
      if (isVoid) {
        refundQty = remaining;
        selectedLineCount++;
      } else {
        const sel = lineSelections[line.id];
        if (sel && sel.selected && sel.quantity > 0) {
          refundQty = Math.min(sel.quantity, remaining);
          selectedLineCount++;
        }
      }

      if (refundQty > 0) {
        const ratio = refundQty / (line.quantity || 1);
        const lineNet = line.quantity > 0 ? (line.netSales || 0) * ratio : 0;
        const lineTax = line.quantity > 0 ? (line.tax || 0) * ratio : 0;
        netReversed += lineNet;
        taxReversed += lineTax;
      }
    }

    const totalReversed = netReversed + taxReversed;

    // Money received vs effective bill
    const prevPaid = Number(invoice.amountPaid || 0);
    const prevDue = Number(invoice.amountDue || 0);

    // Cash out cannot exceed what was actually paid
    const cashOut = Math.min(prevPaid, totalReversed);
    const receivableCancelled = Math.min(prevDue, Math.max(0, totalReversed - cashOut));

    const canSubmit =
      (isVoid || selectedLineCount > 0) &&
      reason.trim().length >= 3 &&
      (cashOut <= 0 || refundMethod === 'CASH' || (refundMethod === 'ONLINE_ACCOUNT' && !!selectedAccountId));

    return {
      netReversed: Math.round(netReversed * 100) / 100,
      taxReversed: Math.round(taxReversed * 100) / 100,
      totalReversed: Math.round(totalReversed * 100) / 100,
      cashOut: Math.round(cashOut * 100) / 100,
      receivableCancelled: Math.round(receivableCancelled * 100) / 100,
      canSubmit,
    };
  }, [invoice, lines, actionType, lineSelections, alreadyRefundedMap, reason, refundMethod, selectedAccountId]);

  const handleSubmit = async () => {
    if (!invoice || !calculations.canSubmit) return;

    setIsSubmitting(true);
    try {
      let payloadLines: RefundLineInput[] | undefined = undefined;

      if (actionType === 'REFUND') {
        payloadLines = [];
        for (const line of lines) {
          const sel = lineSelections[line.id];
          if (sel && sel.selected && sel.quantity > 0) {
            payloadLines.push({
              lineId: line.id,
              quantity: sel.quantity,
              restock: line.type === 'PRODUCT' ? sel.restock : 'NONE',
            });
          }
        }
      }

      const payload: RefundInvoiceInput = {
        type: actionType,
        reason: reason.trim(),
        refundMethod: calculations.cashOut > 0 ? refundMethod : undefined,
        paymentAccountId:
          calculations.cashOut > 0 && refundMethod === 'ONLINE_ACCOUNT'
            ? selectedAccountId
            : undefined,
        lines: payloadLines,
      };

      const result = await salonService.refundInvoice(invoice.id, payload, user || undefined);

      toast.success(
        actionType === 'VOID'
          ? `Invoice ${invoice.invoiceNumber} has been VOIDED successfully.`
          : `Refund of ${formatCurrency(calculations.totalReversed)} processed successfully.`
      );

      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error('Refund / Void execution failed:', err);
      toast.error(err.message || 'Failed to process refund. Please check permissions and cash drawer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto font-sans p-6">
        <DialogHeader>
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  actionType === 'VOID'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {actionType === 'VOID' ? <Ban className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-800">
                  {actionType === 'VOID'
                    ? 'Void Invoice'
                    : 'Issue Sale Refund'}
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-[#0047AB]">{invoice.invoiceNumber}</span>
                  <span>•</span>
                  <span>{invoice.clientName || 'Walk-in'}</span>
                  <span>•</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold ${
                      invoice.lifecycle === 'VOIDED'
                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                        : invoice.lifecycle === 'REFUNDED'
                        ? 'border-purple-400 bg-purple-50 text-purple-700'
                        : invoice.lifecycle === 'PARTIALLY_REFUNDED'
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {invoice.lifecycle || 'ACTIVE'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Action Type Selector Cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => setActionType('VOID')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              actionType === 'VOID'
                ? 'border-rose-500 bg-rose-50/70 shadow-sm ring-1 ring-rose-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-rose-600" /> Full Void
              </span>
              {actionType === 'VOID' && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
              Completely voids invoice, reverses all sales, returns all items to stock, and clears commissions.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActionType('REFUND')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              actionType === 'REFUND'
                ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" /> Line-Item Refund
              </span>
              {actionType === 'REFUND' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
              Select specific items or partial quantities to return and refund to customer.
            </p>
          </button>
        </div>

        {/* Mode explanation alert */}
        {actionType === 'VOID' ? (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 mt-3">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Full Invoice Cancellation</p>
              <p className="text-[11px] text-rose-700">
                This will mark the invoice as <strong>VOIDED</strong>. It will be excluded from gross revenue and operational reports. Retail products will be restocked to inventory.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 mt-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Item-Level Partial Refund</p>
              <p className="text-[11px] text-amber-700">
                Choose the items and quantities below. Net sales and tax will be credited on the report, and staff commission will be reversed proportionally.
              </p>
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Invoice Items ({lines.length})</span>
            <span className="text-[11px] text-slate-500 font-normal">Original Total: {formatCurrency(invoice.total)}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {lines.map((line) => {
              const already = alreadyRefundedMap.get(line.id) || 0;
              const remaining = Math.max(0, line.quantity - already);
              const sel = lineSelections[line.id] || { selected: false, quantity: 0, restock: 'NONE' };
              const isFullyRefunded = remaining <= 0;

              return (
                <div
                  key={line.id}
                  className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isFullyRefunded
                      ? 'bg-slate-50/70 opacity-60'
                      : sel.selected && actionType === 'REFUND'
                      ? 'bg-amber-50/30'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    {actionType === 'REFUND' && (
                      <input
                        type="checkbox"
                        disabled={isFullyRefunded}
                        checked={sel.selected}
                        onChange={(e) => {
                          setLineSelections((prev) => ({
                            ...prev,
                            [line.id]: {
                              ...prev[line.id],
                              selected: e.target.checked,
                              quantity: e.target.checked ? (prev[line.id]?.quantity || remaining) : 0,
                            },
                          }));
                        }}
                        className="mt-1 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800">{line.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            line.type === 'SERVICE'
                              ? 'bg-blue-50 text-blue-700'
                              : line.type === 'PACKAGE'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {line.type}
                        </span>
                        {already > 0 && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">
                            {already} already refunded
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Qty: {line.quantity} × {formatCurrency(line.unitPrice || 0)} • Total: {formatCurrency(line.total || 0)}
                        {line.staffName && ` • Staff: ${line.staffName}`}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Restock Controls (if in REFUND mode) */}
                  {actionType === 'REFUND' && !isFullyRefunded && (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500">Return Qty:</span>
                        <input
                          type="number"
                          min={1}
                          max={remaining}
                          disabled={!sel.selected}
                          value={sel.quantity || 1}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(remaining, parseInt(e.target.value) || 1));
                            setLineSelections((prev) => ({
                              ...prev,
                              [line.id]: { ...prev[line.id], quantity: val },
                            }));
                          }}
                          className="w-14 text-center text-xs border border-slate-300 rounded px-1.5 py-1 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-[11px] text-slate-400">/ {remaining}</span>
                      </div>

                      {line.type === 'PRODUCT' && (
                        <select
                          disabled={!sel.selected}
                          value={sel.restock}
                          onChange={(e) => {
                            setLineSelections((prev) => ({
                              ...prev,
                              [line.id]: {
                                ...prev[line.id],
                                restock: e.target.value as 'RESALABLE' | 'DAMAGED' | 'NONE',
                              },
                            }));
                          }}
                          className="text-[11px] border border-slate-300 rounded px-2 py-1 bg-white disabled:bg-slate-100"
                          title="Stock Restock Condition"
                        >
                          <option value="RESALABLE">Resalable Stock</option>
                          <option value="DAMAGED">Damaged / Scrap</option>
                          <option value="NONE">No Restock</option>
                        </select>
                      )}
                    </div>
                  )}

                  {/* Void mode display: entire remaining qty */}
                  {actionType === 'VOID' && (
                    <div className="text-right text-[11px] font-medium text-rose-700">
                      Reversing: {remaining} units
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Refund Payment Source Section (If money has been paid) */}
        {calculations.cashOut > 0 && (
          <div className="mt-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Customer Cash-Out Payout: {formatCurrency(calculations.cashOut)}
              </span>
              <span className="text-[11px] text-slate-500">How will money be returned?</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <label
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  refundMethod === 'CASH'
                    ? 'border-[#0047AB] bg-blue-50/70 text-[#0047AB] font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="refundMethod"
                  value="CASH"
                  checked={refundMethod === 'CASH'}
                  onChange={() => setRefundMethod('CASH')}
                  className="text-[#0047AB]"
                />
                <Wallet className="w-4 h-4" />
                <span>Cash Drawer</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  refundMethod === 'ONLINE_ACCOUNT'
                    ? 'border-[#0047AB] bg-blue-50/70 text-[#0047AB] font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="refundMethod"
                  value="ONLINE_ACCOUNT"
                  checked={refundMethod === 'ONLINE_ACCOUNT'}
                  onChange={() => setRefundMethod('ONLINE_ACCOUNT')}
                  className="text-[#0047AB]"
                />
                <Building className="w-4 h-4" />
                <span>Bank / Online Account</span>
              </label>
            </div>

            {refundMethod === 'ONLINE_ACCOUNT' && (
              <div className="pt-1.5">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Select Payout Bank / Wallet Account:
                </label>
                {isLoadingAccounts ? (
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading accounts...
                  </div>
                ) : (
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800"
                  >
                    <option value="">-- Choose Account --</option>
                    {paymentAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountType}) — Bal: {formatCurrency(acc.currentBalance)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reason Section (Required) */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            Reason for {actionType === 'VOID' ? 'Void' : 'Refund'} <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((qr) => (
              <button
                key={qr}
                type="button"
                onClick={() => setReason(qr)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                  reason === qr
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {qr}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Detailed reason for audit log (minimum 3 characters)..."
            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB]"
          />
        </div>

        {/* Live Financial Breakdown Card */}
        <div className="mt-4 p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2 text-xs">
          <div className="font-bold text-[#0B2545] border-b border-blue-200/60 pb-1.5 flex items-center justify-between">
            <span>Financial & Report Impact Summary</span>
            <span className="text-[11px] font-normal text-blue-700">Real-time accounting breakdown</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
              <span className="block text-[10px] text-slate-500">Net Sales Reversed:</span>
              <span className="font-bold text-rose-600 text-[13px]">
                -{formatCurrency(calculations.netReversed)}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
              <span className="block text-[10px] text-slate-500">Tax Liability Reversed:</span>
              <span className="font-bold text-rose-600 text-[13px]">
                -{formatCurrency(calculations.taxReversed)}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
              <span className="block text-[10px] text-slate-500">Customer Payout (Cash-Out):</span>
              <span className="font-bold text-amber-700 text-[13px]">
                {formatCurrency(calculations.cashOut)}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
              <span className="block text-[10px] text-slate-500">Receivable Cancelled:</span>
              <span className="font-bold text-slate-700 text-[13px]">
                {formatCurrency(calculations.receivableCancelled)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!calculations.canSubmit || isSubmitting}
            className={`text-white text-xs gap-1.5 ${
              actionType === 'VOID'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
              </>
            ) : actionType === 'VOID' ? (
              <>
                <Ban className="w-3.5 h-3.5" /> Confirm Void Invoice
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" /> Process Sale Refund
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
