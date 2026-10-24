import React, { useState, useEffect } from 'react';
import { Invoice, PaymentAccount } from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { formatCurrency } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/context/ToastContext';
import { AlertCircle, CreditCard, Banknote, Landmark, CheckCircle2 } from 'lucide-react';

interface CollectDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSuccess: (updatedInvoice: Invoice) => void;
}

export const CollectDuesModal: React.FC<CollectDuesModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}) => {
  const { user } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE_ACCOUNT'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [selectedOnlineAccountId, setSelectedOnlineAccountId] = useState<string>('');
  const [onlineAccounts, setOnlineAccounts] = useState<PaymentAccount[]>([]);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const paymentKey = React.useRef('');
  const paymentBusy = React.useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (invoice && isOpen) {
      paymentKey.current = crypto.randomUUID();
      setPaymentAmount(invoice.amountDue);
      setCashTendered(invoice.amountDue);
      setNotes(`Dues collection for invoice ${invoice.invoiceNumber}`);
      setErrorMsg(null);

      // Fetch online accounts for the branch
      salonService.getPaymentAccounts(invoice.branchId).then((accs) => {
        const active = accs.filter((a) => a.isActive);
        setOnlineAccounts(active);
        if (active.length > 0) {
          setSelectedOnlineAccountId(active[0].id);
        }
      });
    }
  }, [invoice, isOpen]);

  if (!invoice) return null;

  const changeDue = Math.max(0, cashTendered - paymentAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentBusy.current) return;
    setErrorMsg(null);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      toast.error('Payment amount must be greater than zero.');
      return;
    }

    if (paymentAmount > invoice.amountDue) {
      toast.error(`Payment amount cannot exceed outstanding balance of ${formatCurrency(invoice.amountDue)}.`);
      return;
    }

    if (paymentMethod === 'CASH' && cashTendered < paymentAmount) {
      toast.error('Cash tendered cannot be less than payment amount.');
      return;
    }

    if (paymentMethod === 'ONLINE_ACCOUNT' && !selectedOnlineAccountId) {
      toast.error('Please select a valid online bank account.');
      return;
    }

    paymentBusy.current = true;
    setIsSubmitting(true);
    try {
      const payments = [];
      if (paymentMethod === 'CASH') {
        payments.push({
          method: 'CASH' as const,
          amount: paymentAmount,
          billAllocation: paymentAmount,
          tipAllocation: 0,
          cashTendered,
          changeReturned: changeDue,
        });
      } else {
        const acc = onlineAccounts.find((a) => a.id === selectedOnlineAccountId);
        payments.push({
          method: 'ONLINE_ACCOUNT' as const,
          paymentAccountId: acc?.id,
          paymentAccountName: acc?.name,
          amount: paymentAmount,
          billAllocation: paymentAmount,
          tipAllocation: 0,
        });
      }

      const idempotencyKey = paymentKey.current;

      const updated = await salonService.collectInvoicePayment(
        {
          invoiceId: invoice.id,
          payments,
          idempotencyKey,
          notes: notes.trim() || undefined,
        },
        user || undefined
      );

      toast.success(`Payment of ${formatCurrency(paymentAmount)} recorded successfully.`);
      onSuccess(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh-notifications'));
      }
    } catch (err: any) {
      console.error('Failed to collect dues payment', err);
      toast.error(err.message || 'Payment collection failed.');
    } finally {
      paymentBusy.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>Collect Outstanding Dues</span>
            </DialogTitle>
          </DialogHeader>

          {/* Invoice Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Reference:</span>
              <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-medium text-slate-800">{invoice.clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Invoice Amount:</span>
              <span className="text-slate-800 font-medium">{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-rose-600 font-bold">Outstanding Balance:</span>
              <span className="text-rose-600 font-bold text-sm">
                {formatCurrency(invoice.amountDue)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Payment Method
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'CASH'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                Physical Cash
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('ONLINE_ACCOUNT')}
                className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'ONLINE_ACCOUNT'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Landmark className="w-4 h-4 text-indigo-600" />
                Online / Bank
              </button>
            </div>
          </div>

          {/* Amount to Pay */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 block mb-1">
              Amount to Collect (PKR)
            </Label>
            <Input
              type="number"
              min={1}
              max={invoice.amountDue}
              value={paymentAmount}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPaymentAmount(val);
                if (paymentMethod === 'CASH' && cashTendered < val) {
                  setCashTendered(val);
                }
              }}
              className="h-9 text-xs font-bold"
            />
          </div>

          {/* Cash Details or Bank Details */}
          {paymentMethod === 'CASH' ? (
            <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
              <div>
                <Label className="text-[11px] font-semibold text-emerald-900 block mb-1">
                  Cash Tendered (PKR)
                </Label>
                <Input
                  type="number"
                  min={paymentAmount}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(Number(e.target.value))}
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-emerald-900 block mb-1">
                  Change to Return (PKR)
                </Label>
                <div className="h-8 px-3 rounded-md bg-white border border-slate-200 flex items-center text-xs font-bold text-emerald-700">
                  {formatCurrency(changeDue)}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-1">
                Deposit Bank Account
              </Label>
              <select
                value={selectedOnlineAccountId}
                onChange={(e) => setSelectedOnlineAccountId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
              >
                {onlineAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.providerName} - {a.accountIdentifier})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 block mb-1">
              Payment Memo / Note
            </Label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared via Cash at counter"
              className="h-8 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSubmitting ? 'Posting Payment...' : `Collect ${formatCurrency(paymentAmount)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
