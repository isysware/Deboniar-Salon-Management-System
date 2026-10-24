import React, { useState, useEffect } from 'react';
import { Appointment } from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
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
import { Clock, Calendar, AlertCircle } from 'lucide-react';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSuccess: (updatedAppointment: Appointment) => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onSuccess,
}) => {
  const { user } = useAuth();

  const [newDate, setNewDate] = useState<string>('');
  const [newStartTime, setNewStartTime] = useState<string>('10:00 AM');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (appointment) {
      setNewDate(appointment.date);
      setNewStartTime(appointment.startTime || appointment.time || '10:00 AM');
      setReason('');
      setErrorMsg(null);
    }
  }, [appointment, isOpen]);

  if (!appointment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newDate) {
      toast.error('Please select a valid date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await salonService.rescheduleAppointment(
        appointment.id,
        newDate,
        newStartTime,
        reason.trim() || undefined,
        user || undefined
      );
      setIsSubmitting(false);
      toast.success('Appointment rescheduled successfully.');
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      const msg = err.message || 'Failed to reschedule appointment. Please check stylist availability.';
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  const timeOptions = [
    '08:00 AM', '08:30 AM',
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
    '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
    '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM',
    '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM',
    '09:00 PM', '09:30 PM', '10:00 PM',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#2254E1]" />
            Reschedule Appointment
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Move {appointment.clientName}&apos;s appointment ({appointment.appointmentNumber || appointment.id})
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-500 block text-[10px]">Current Scheduled Slot:</span>
              <span className="font-semibold text-slate-800">
                {appointment.date} at {appointment.startTime || appointment.time || '10:00 AM'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#2254E1]" />
                New Date *
              </Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1 text-xs h-9 bg-white"
                required
              />
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#2254E1]" />
                New Time *
              </Label>
              <select
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 h-9 cursor-pointer"
                required
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Reason for Rescheduling</Label>
            <Input
              placeholder="e.g. Client called to push slot by 2 hours"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>

          <DialogFooter className="pt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-[#2254E1] hover:bg-[#1b43b5] text-white"
            >
              {isSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
