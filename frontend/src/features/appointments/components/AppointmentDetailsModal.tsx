import React, { useState } from 'react';
import { Appointment, AppointmentStatus } from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
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
  Calendar,
  Clock,
  User,
  Phone,
  Scissors,
  Package,
  Receipt,
  AlertCircle,
  CheckCircle,
  PlayCircle,
  FileCheck,
  XCircle,
  UserX,
  MessageSquare,
  Edit,
  History,
  Building2,
} from 'lucide-react';

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onEdit: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onShowConfirmationMessage: (appointmentId: string) => void;
  onStatusChange: (updatedAppointment: Appointment) => void;
}

export const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onEdit,
  onReschedule,
  onShowConfirmationMessage,
  onStatusChange,
}) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cancellation sub-flow
  const [showCancelPrompt, setShowCancelPrompt] = useState<boolean>(false);
  const [cancelTargetStatus, setCancelTargetStatus] = useState<'CANCELLED' | 'NO_SHOW'>('CANCELLED');
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('');

  if (!appointment) return null;

  const handleUpdateStatus = async (newStatus: AppointmentStatus, reason?: string) => {
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const updated = await salonService.updateAppointmentStatus(
        appointment.id,
        newStatus,
        reason,
        user || undefined
      );
      toast.success(`Appointment status updated to ${newStatus.replace('_', ' ')}.`);
      setIsProcessing(false);
      setShowCancelPrompt(false);
      onStatusChange(updated);
    } catch (err: any) {
      setIsProcessing(false);
      const errMsg = err.message || 'Failed to update status.';
      setErrorMsg(errMsg);
      toast.error(errMsg);
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'CONFIRMED':
      case 'SCHEDULED':
        return (
          <Badge variant="primary" className="bg-blue-600 text-white font-medium">
            CONFIRMED
          </Badge>
        );
      case 'CHECKED_IN':
        return (
          <Badge variant="neutral" className="bg-purple-600 text-white font-medium">
            CHECKED IN
          </Badge>
        );
      case 'IN_SERVICE':
      case 'IN_PROGRESS':
        return (
          <Badge variant="warning" className="bg-amber-500 text-white font-medium">
            IN SERVICE
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="success" className="bg-emerald-600 text-white font-medium">
            COMPLETED
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="destructive" className="bg-rose-600 text-white font-medium">
            CANCELLED
          </Badge>
        );
      case 'NO_SHOW':
        return (
          <Badge variant="destructive" className="bg-slate-700 text-white font-medium">
            NO SHOW
          </Badge>
        );
      case 'PENDING':
      default:
        return (
          <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 font-medium">
            PENDING
          </Badge>
        );
    }
  };

  const isBilled = appointment.billingStatus === 'BILLED';
  const canModify = !isBilled && appointment.status !== 'CANCELLED' && appointment.status !== 'NO_SHOW';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-mono block">
                {appointment.appointmentNumber || appointment.id}
              </span>
              <DialogTitle className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                {appointment.clientName}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(appointment.status)}
              <Badge
                variant="outline"
                className={`text-xs ${
                  isBilled
                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                    : 'border-slate-300 text-slate-600 bg-slate-50'
                }`}
              >
                {isBilled ? 'BILLED' : 'UNBILLED'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Cancellation Reason if cancelled */}
          {(appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') && (
            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 text-rose-800 text-xs space-y-1">
              <span className="font-semibold block">
                {appointment.status === 'CANCELLED' ? 'Cancellation Details:' : 'Marked No-Show:'}
              </span>
              <p>{appointment.cancelReason || 'No specific reason entered'}</p>
              <span className="text-[11px] text-rose-600 block mt-1">
                By {appointment.cancelledByName || 'Admin'} at {appointment.cancelledAt || 'N/A'}
              </span>
            </div>
          )}

          {/* 1. Schedule & Customer Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-[#2254E1]" />
                <span>
                  Date: <strong className="text-slate-900">{appointment.date}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Building2 className="w-4 h-4 text-[#2254E1]" />
                <span>
                  Branch: <strong className="text-slate-900">{appointment.branchName || 'Branch'}</strong>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="w-4 h-4 text-[#2254E1]" />
                <span>
                  Customer: <strong className="text-slate-900">{appointment.clientName}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-[#2254E1]" />
                <span>
                  Phone: <strong className="text-slate-900">{appointment.clientPhone}</strong>
                </span>
              </div>
              {appointment.customerSource && (
                <div className="text-slate-500 pl-6">
                  Source: <span className="text-slate-800">{appointment.customerSource.replace('_', ' ')}</span>
                  {appointment.customerSourceDetails ? ` (${appointment.customerSourceDetails})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* 2. Selected Services & Package Components Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Selected Services & Staff Assignments
            </h4>

            {appointment.items && appointment.items.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                {appointment.items.map((it, idx) => (
                  <div key={idx} className="p-3.5 bg-white text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {it.type === 'PACKAGE' ? (
                          <Package className="w-4 h-4 text-[#2254E1]" />
                        ) : (
                          <Scissors className="w-4 h-4 text-[#2254E1]" />
                        )}
                        <strong className="text-slate-900">{it.name}</strong>
                        {it.type === 'PACKAGE' && (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-[#2254E1]">
                            Package Bundle
                          </Badge>
                        )}
                      </div>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(it.unitPrice)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 pl-6">
                      <span>
                        Stylist{it.assignedStaff && it.assignedStaff.length > 1 ? 's (Equal Split)' : ''}: <strong className="text-slate-700">
                          {it.assignedStaff && it.assignedStaff.length > 0
                            ? it.assignedStaff.map((s) => s.staffName).join(', ')
                            : it.staffName}
                        </strong>
                      </span>
                    </div>

                    {/* If package, show included components & team */}
                    {it.type === 'PACKAGE' && (
                      <div className="mt-2 pl-6 pt-2 border-t border-slate-100 space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Included Services & Team:
                        </span>
                        {it.assignedStaff && it.assignedStaff.length > 1 && (
                          <div className="text-[11px] text-blue-700 bg-blue-50/70 p-2 rounded-lg font-medium border border-blue-200/50">
                            Shared by {it.assignedStaff.length} stylists • Revenue & commission split equally ({(100 / it.assignedStaff.length).toFixed(1)}% each)
                          </div>
                        )}
                        {it.packageComponents && it.packageComponents.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {it.packageComponents.map((comp, cIdx) => (
                              <span
                                key={cIdx}
                                className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 rounded text-[11px]"
                              >
                                • {comp.serviceName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs flex items-center justify-between">
                <div>
                  <strong className="text-slate-900 block">{appointment.serviceName || 'Service'}</strong>
                  <span className="text-slate-500">Stylist: {appointment.staffName}</span>
                </div>
                <span className="font-semibold text-slate-900">{formatCurrency(appointment.price)}</span>
              </div>
            )}
          </div>

          {/* 3. Estimated Quote & Notes */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/40 border border-blue-100">
            <div>
              <span className="text-xs text-slate-500 block">Total Quoted Price</span>
              <span className="text-xl font-bold text-[#2254E1] tabular-nums">
                {formatCurrency(appointment.price)}
              </span>
            </div>
            {appointment.notes && (
              <div className="text-right max-w-xs text-xs text-slate-600">
                <span className="font-semibold text-slate-700 block">Notes:</span>
                <p className="italic">{appointment.notes}</p>
              </div>
            )}
          </div>

          {/* 4. Linked Invoice Banner if Billed */}
          {isBilled && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-emerald-800">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <div>
                  <strong className="block">Billed under Invoice {appointment.linkedInvoiceNumber}</strong>
                  <span className="text-[11px] text-emerald-700">
                    Services have been finalized and recorded in the branch ledger.
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  navigate(`/reports/sales-invoices?search=${appointment.linkedInvoiceNumber}`);
                }}
                className="bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-xs"
              >
                View Invoice
              </Button>
            </div>
          )}

          {/* 5. Reschedule Audit Trail if any */}
          {appointment.rescheduleHistory && appointment.rescheduleHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                Reschedule History Audit
              </h4>
              <div className="space-y-1.5">
                {appointment.rescheduleHistory.map((rh, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span>
                        Moved from {rh.previousDate} ({rh.previousStartTime}) → {rh.newDate} ({rh.newStartTime})
                      </span>
                      <span className="text-slate-400">{rh.rescheduledAt}</span>
                    </div>
                    <div className="text-slate-500">
                      Reason: {rh.reason} (by {rh.rescheduledByName})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Audit Footprint */}
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span>Created by: {appointment.createdByName || 'System'} ({appointment.createdAt || 'N/A'})</span>
            {appointment.confirmedByName && (
              <span>Confirmed by: {appointment.confirmedByName} ({appointment.confirmedAt})</span>
            )}
          </div>

          {/* Cancellation Reason Prompt */}
          {showCancelPrompt && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3 animate-in fade-in">
              <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {cancelTargetStatus === 'CANCELLED' ? 'Confirm Appointment Cancellation' : 'Mark Customer as No-Show'}
              </h4>
              <p className="text-xs text-rose-700">
                This will release the reserved time slot and make stylist chairs available. It will not generate any invoice changes.
              </p>
              <div>
                <input
                  type="text"
                  placeholder={
                    cancelTargetStatus === 'CANCELLED'
                      ? 'Reason for cancellation (e.g. Client requested via phone)...'
                      : 'Notes on no-show (e.g. Unreachable after 20 mins)...'
                  }
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelPrompt(false)}
                  disabled={isProcessing}
                  className="text-xs h-8"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleUpdateStatus(cancelTargetStatus, cancelReasonInput)}
                  disabled={isProcessing}
                  className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isProcessing ? 'Processing...' : 'Confirm & Release Slot'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons following state and role rules */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onShowConfirmationMessage(appointment.id)}
              className="text-xs gap-1.5 text-slate-700 hover:text-[#2254E1]"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Confirmation Message
            </Button>

            {canModify && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onEdit(appointment);
                  }}
                  className="text-xs gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onReschedule(appointment);
                  }}
                  className="text-xs gap-1.5"
                >
                  <History className="w-3.5 h-3.5" />
                  Reschedule
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Status Flow Buttons */}
            {canModify && appointment.status === 'PENDING' && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleUpdateStatus('CONFIRMED')}
                disabled={isProcessing}
                className="bg-[#2254E1] hover:bg-[#1b43b5] text-white text-xs gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Confirm Booking
              </Button>
            )}

            {canModify && appointment.status === 'CONFIRMED' && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleUpdateStatus('CHECKED_IN')}
                disabled={isProcessing}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Check In Client
              </Button>
            )}

            {canModify && appointment.status === 'CHECKED_IN' && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleUpdateStatus('IN_SERVICE')}
                disabled={isProcessing}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Start Service
              </Button>
            )}

            {canModify && appointment.status === 'IN_SERVICE' && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleUpdateStatus('COMPLETED')}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
              >
                <FileCheck className="w-3.5 h-3.5" />
                Complete Service
              </Button>
            )}

            {/* Open in POS Button (if confirmed/checked-in/in-service/completed and unbilled) */}
            {!isBilled &&
              ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'SCHEDULED', 'IN_PROGRESS'].includes(
                appointment.status
              ) && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/pos?appointmentId=${appointment.id}`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-xs"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Open in POS
                </Button>
              )}

            {/* Cancel / No-show triggers */}
            {canModify && !showCancelPrompt && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCancelTargetStatus('NO_SHOW');
                    setShowCancelPrompt(true);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  <UserX className="w-3.5 h-3.5 mr-1" />
                  No-Show
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCancelTargetStatus('CANCELLED');
                    setShowCancelPrompt(true);
                  }}
                  className="text-xs text-rose-600 hover:bg-rose-50"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
