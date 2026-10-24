import React, { useState, useEffect, useMemo } from 'react';
import { AppointmentConfirmationMessage } from '@/types/salon';
import { salonService } from '@/services';
import { useAuth } from '@/context/AuthContext';
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
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Clock,
  Scissors,
  CheckCheck,
} from 'lucide-react';
import { toast } from '@/context/ToastContext';
import { formatCurrency, normalizePhoneDigits } from '@/lib/formatters';

interface ConfirmationMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string | null;
}

export const ConfirmationMessageModal: React.FC<ConfirmationMessageModalProps> = ({
  isOpen,
  onClose,
  appointmentId,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<AppointmentConfirmationMessage | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !appointmentId) {
      setData(null);
      setCopied(false);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    async function loadMessage() {
      setLoading(true);
      try {
        const msg = await salonService.prepareConfirmationMessage(appointmentId!, user || undefined);
        if (isMounted) setData(msg);
      } catch (err: any) {
        const msg = err.message || 'Failed to prepare confirmation message.';
        if (isMounted) setErrorMsg(msg);
        toast.error(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadMessage();
    return () => {
      isMounted = false;
    };
  }, [isOpen, appointmentId, user]);

  const fullMessageText = useMemo(() => {
    if (!data) return '';
    const timeLine = data.time ? `Time: ${data.time}\n` : '';
    return `Dear ${data.clientName},\nYour appointment at ${data.branchName} is confirmed!\n\nReference: ${data.appointmentNumber}\nDate: ${data.date}\n${timeLine}Services: ${data.servicesList?.join(', ')}\nEstimated Total: PKR ${data.totalEstimatedPrice?.toLocaleString('en-PK')}\nBranch Contact: ${data.branchPhone}\n\nWe look forward to serving you!`;
  }, [data]);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(fullMessageText);
    setCopied(true);
    toast.success('Confirmation message copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!data) return;
    const digitsOnly = normalizePhoneDigits(data.clientPhone);
    const cleanPhone = digitsOnly.startsWith('92') ? digitsOnly : digitsOnly.startsWith('0') ? `92${digitsOnly.slice(1)}` : `92${digitsOnly}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullMessageText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-5 sm:p-6 font-sans">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-xs">
                <MessageSquare className="w-4.5 h-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                  Appointment Confirmation
                </DialogTitle>
                <p className="text-xs text-slate-400">
                  Ready to send via WhatsApp or SMS
                </p>
              </div>
            </div>
            <Badge variant="neutral" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200 py-0.5 px-2">
              WhatsApp Ready
            </Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <div className="w-6 h-6 rounded-full border-2 border-emerald-100 border-t-emerald-600 animate-spin mx-auto" />
            <p>Formatting confirmation preview...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {errorMsg}
          </div>
        ) : data ? (
          <div className="space-y-3 py-1">
            {/* Client Summary Header */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2254E1] flex items-center justify-center font-bold text-xs shrink-0">
                  {data.clientName?.charAt(0) || 'C'}
                </div>
                <div className="truncate">
                  <span className="font-bold text-slate-900 block text-xs truncate">{data.clientName}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">{data.clientPhone}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-mono">Ref</span>
                <span className="font-mono font-bold text-xs text-slate-800">{data.appointmentNumber}</span>
              </div>
            </div>

            {/* WhatsApp Styled Message Bubble Container */}
            <div className="p-3.5 rounded-2xl bg-[#EFEAE2]/60 border border-slate-200/70 space-y-2">
              <div className="text-center">
                <span className="text-[9px] font-semibold bg-white/90 text-slate-500 px-2.5 py-0.5 rounded-full shadow-2xs">
                  Booking Confirmation
                </span>
              </div>

              {/* Chat Message Bubble */}
              <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-xs border border-slate-200/50 space-y-2 text-xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900 text-xs">
                    Dear {data.clientName},
                  </p>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Your appointment at <strong className="text-slate-900">{data.branchName}</strong> is confirmed!
                  </p>
                </div>

                {/* Structured Details Box */}
                <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#2254E1]" /> Date:
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-[11px]">{data.date}</span>
                  </div>
                  {data.time && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" /> Time:
                      </span>
                      <span className="font-bold text-emerald-700 font-mono text-[11px]">{data.time}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 text-[11px] flex items-center gap-1.5 shrink-0">
                      <Scissors className="w-3.5 h-3.5 text-indigo-500" /> Services:
                    </span>
                    <span className="font-semibold text-slate-800 text-right truncate text-[11px]">
                      {data.servicesList?.join(', ') || 'Salon Service'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                    <span className="text-slate-500 text-[11px]">Estimated Total:</span>
                    <span className="font-bold font-mono text-[#2254E1] text-xs">
                      {formatCurrency(data.totalEstimatedPrice)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Contact: <strong className="font-mono text-slate-700">{data.branchPhone}</strong></span>
                  <div className="flex items-center gap-1 text-slate-400 font-mono">
                    <span>Just now</span>
                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 sm:gap-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-800">
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!data}
              className="gap-1.5 text-xs text-slate-700 rounded-xl h-8.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenWhatsApp}
              disabled={!data}
              className="bg-[#25D366] hover:bg-[#1EBE5D] text-white gap-1.5 text-xs font-bold rounded-xl h-8.5 px-4 shadow-xs cursor-pointer transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open WhatsApp
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
