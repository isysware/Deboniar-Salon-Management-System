import React from 'react';
import { Appointment } from '@/types/salon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShoppingCart, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface CartOverwritePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingAppointment: Appointment | null;
  currentCartCount: number;
  onConfirmReplace: () => void;
}

export const CartOverwritePromptModal: React.FC<CartOverwritePromptModalProps> = ({
  isOpen,
  onClose,
  pendingAppointment,
  currentCartCount,
  onConfirmReplace,
}) => {
  if (!pendingAppointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">
            Existing Cart Detected
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            You currently have <span className="font-bold text-slate-900">{currentCartCount} item(s)</span> in your active POS checkout cart.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 my-2">
          <div className="font-semibold text-slate-800">
            Incoming Appointment to Load:
          </div>
          <div className="text-slate-600">
            <span className="font-medium text-slate-900">{pendingAppointment.clientName}</span> • Ref: {pendingAppointment.appointmentNumber || pendingAppointment.id}
          </div>
          <div className="text-slate-500">
            Scheduled for {pendingAppointment.date} at {pendingAppointment.startTime || pendingAppointment.time || '10:00 AM'}
          </div>
          <div className="font-bold text-slate-900 pt-1 border-t border-slate-200">
            Estimated Booking Quote: {formatCurrency(pendingAppointment.price || 0)}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Would you like to replace your existing cart with the booked services for this client, or keep your current cart intact?
        </p>

        <DialogFooter className="pt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Keep Existing Cart
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              onConfirmReplace();
              onClose();
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1"
          >
            Replace Cart Items
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
