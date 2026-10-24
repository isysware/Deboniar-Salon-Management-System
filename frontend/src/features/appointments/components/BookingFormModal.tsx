import React, { useState, useEffect, useMemo } from 'react';
import {
  Appointment,
  AppointmentItem,
  AppointmentStatus,
  Branch,
  Client,
  CustomerSource,
  PackageItem,
  ServiceItem,
  StaffMember,
} from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { formatCurrency, formatPhoneNumber, normalizePhoneDigits } from '@/lib/formatters';
import { parseTimeToMinutes, formatMinutesToTime } from '@/lib/attendanceCalculations';
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
import { Badge } from '@/components/ui/badge';
import {
  User as UserIcon,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  Scissors,
  Package as PackageIcon,
  Sparkles,
  Search,
  X,
} from 'lucide-react';

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (appointment: Appointment, messagePreparation?: boolean) => void;
  initialDate?: string;
  activeBranchId: string;
  branches: Branch[];
  appointmentToEdit?: Appointment | null;
}

export const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  activeBranchId,
  branches,
  appointmentToEdit,
}) => {
  const { user } = useAuth();

  // Branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (appointmentToEdit?.branchId) return appointmentToEdit.branchId;
    if (activeBranchId && activeBranchId !== 'ALL') return activeBranchId;
    return branches[0]?.id || '';
  });

  // Client Selection State
  const [isNewClient, setIsNewClient] = useState<boolean>(!appointmentToEdit);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [matchingClients, setMatchingClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [customerSource, setCustomerSource] = useState<CustomerSource>('WALK_IN');
  const [customerSourceDetails, setCustomerSourceDetails] = useState<string>('');

  // Schedule
  const [date, setDate] = useState<string>(initialDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>('10:00 AM');
  const [notes, setNotes] = useState<string>('');

  // Items in Cart/Booking
  interface BookingFormItem {
    lineInstanceId: string;
    type: 'SERVICE' | 'PACKAGE';
    itemId: string;
    staffId: string;
    assignedStaff?: Array<{
      staffId: string;
      staffName: string;
      staffCommissionRate?: number;
    }>;
    packageComponents?: Array<{
      serviceId: string;
      staffId: string;
    }>;
  }
  const [selectedItems, setSelectedItems] = useState<BookingFormItem[]>([]);

  // Catalogue & Staff for Selected Branch
  const [branchStaff, setBranchStaff] = useState<StaffMember[]>([]);
  const [branchServices, setBranchServices] = useState<ServiceItem[]>([]);
  const [branchPackages, setBranchPackages] = useState<PackageItem[]>([]);

  // Feedback & Validation
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Catalogue & Staff when branch changes
  useEffect(() => {
    let isMounted = true;
    async function loadBranchData() {
      try {
        const [staff, srvs, pkgs] = await Promise.all([
          salonService.getStaff(selectedBranchId),
          salonService.getServices(selectedBranchId),
          salonService.getPackages(selectedBranchId),
        ]);
        if (!isMounted) return;
        setBranchStaff(staff.filter((s) => s.isActive));
        setBranchServices(srvs.filter((s) => s.isActive));
        setBranchPackages(pkgs.filter((p) => p.isActive));
      } catch (err) {
        console.error('Failed to load branch catalogue:', err);
      }
    }
    if (selectedBranchId) {
      loadBranchData();
    }
    return () => {
      isMounted = false;
    };
  }, [selectedBranchId]);

  // Search existing clients
  useEffect(() => {
    let isMounted = true;
    async function doSearch() {
      if (!clientSearchQuery.trim() || !selectedBranchId) {
        setMatchingClients([]);
        return;
      }
      try {
        const found = await salonService.searchClients(selectedBranchId, clientSearchQuery, user || undefined);
        if (isMounted) setMatchingClients(found);
      } catch (e) {
        console.error('Client search error:', e);
      }
    }
    const timer = setTimeout(doSearch, 200);
    return () => {
      clearTimeout(timer);
      isMounted = false;
    };
  }, [clientSearchQuery, selectedBranchId, user]);

  // Initialize form state when editing or opening
  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);

    if (appointmentToEdit) {
      setSelectedBranchId(appointmentToEdit.branchId);
      setDate(appointmentToEdit.date);
      setStartTime(appointmentToEdit.startTime || appointmentToEdit.time || '10:00 AM');
      setClientName(appointmentToEdit.clientName);
      setClientPhone(appointmentToEdit.clientPhone);
      setClientEmail(appointmentToEdit.clientEmail || '');
      setCustomerSource(appointmentToEdit.customerSource || 'WALK_IN');
      setCustomerSourceDetails(appointmentToEdit.customerSourceDetails || '');
      setNotes(appointmentToEdit.notes || '');
      setIsNewClient(false);

      if (appointmentToEdit.items && appointmentToEdit.items.length > 0) {
        setSelectedItems(
          appointmentToEdit.items.map((it) => ({
            lineInstanceId: it.lineInstanceId,
            type: it.type,
            itemId: it.itemId,
            staffId: it.staffId,
            assignedStaff: it.assignedStaff,
            packageComponents: it.packageComponents?.map((pc) => ({
              serviceId: pc.serviceId,
              staffId: pc.staffId,
            })),
          }))
        );
      } else if (appointmentToEdit.serviceId && appointmentToEdit.staffId) {
        setSelectedItems([
          {
            lineInstanceId: `line-${Date.now()}`,
            type: 'SERVICE',
            itemId: appointmentToEdit.serviceId,
            staffId: appointmentToEdit.staffId,
          },
        ]);
      }
    } else {
      setDate(initialDate || new Date().toISOString().slice(0, 10));
      setStartTime('10:00 AM');
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setCustomerSource('WALK_IN');
      setCustomerSourceDetails('');
      setNotes('');
      setIsNewClient(true);
      setSelectedClient(null);
      setSelectedItems([]);
      setClientSearchQuery('');
    }
  }, [isOpen, appointmentToEdit, initialDate]);

  // Add Item to Booking
  const handleAddItem = (type: 'SERVICE' | 'PACKAGE', itemId: string) => {
    const lineInstanceId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    if (type === 'SERVICE') {
      setSelectedItems((prev) => [
        ...prev,
        {
          lineInstanceId,
          type: 'SERVICE',
          itemId,
          staffId: '',
        },
      ]);
    } else {
      const pkg = branchPackages.find((p) => p.id === itemId);
      const components = pkg?.components.map((c) => ({
        serviceId: c.serviceId,
        staffId: '',
      })) || [];

      setSelectedItems((prev) => [
        ...prev,
        {
          lineInstanceId,
          type: 'PACKAGE',
          itemId,
          staffId: '',
          assignedStaff: [],
          packageComponents: components,
        },
      ]);
    }
  };

  const handleRemoveItem = (lineInstanceId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.lineInstanceId !== lineInstanceId));
  };

  const handleServiceStaffChange = (lineInstanceId: string, staffId: string) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.lineInstanceId === lineInstanceId ? { ...i, staffId } : i))
    );
  };

  const handleAddStaffToPackage = (lineInstanceId: string, staffId: string) => {
    const staff = branchStaff.find((s) => s.id === staffId);
    if (!staff) return;

    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.lineInstanceId !== lineInstanceId) return i;
        const currentStaff = i.assignedStaff || [];
        if (currentStaff.some((s) => s.staffId === staffId)) return i;
        const updated = [...currentStaff, { staffId: staff.id, staffName: staff.name, staffCommissionRate: staff.commissionRate }];
        return {
          ...i,
          staffId: updated[0]?.staffId || '',
          assignedStaff: updated,
        };
      })
    );
  };

  const handleRemoveStaffFromPackage = (lineInstanceId: string, staffId: string) => {
    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.lineInstanceId !== lineInstanceId) return i;
        const currentStaff = i.assignedStaff || [];
        const updated = currentStaff.filter((s) => s.staffId !== staffId);
        return {
          ...i,
          staffId: updated[0]?.staffId || '',
          assignedStaff: updated,
        };
      })
    );
  };

  const handlePackageComponentStaffChange = (
    lineInstanceId: string,
    serviceId: string,
    staffId: string
  ) => {
    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.lineInstanceId !== lineInstanceId) return i;
        const updatedComps = (i.packageComponents || []).map((c) =>
          c.serviceId === serviceId ? { ...c, staffId } : c
        );
        return {
          ...i,
          staffId: updatedComps[0]?.staffId || i.staffId,
          packageComponents: updatedComps,
        };
      })
    );
  };

  // Live sequential duration and price computation
  const { totalEstimatedPrice, totalEstimatedMinutes, estimatedEndTime, sequentialPreview } =
    useMemo(() => {
      let price = 0;
      let totalMins = 0;
      const previewList: Array<{
        title: string;
        staffName: string;
        duration: number;
        startStr: string;
        endStr: string;
      }> = [];

      let currentPointer = parseTimeToMinutes(startTime);

      for (const it of selectedItems) {
        if (it.type === 'SERVICE') {
          const srv = branchServices.find((s) => s.id === it.itemId);
          if (srv) {
            price += srv.price;
            const dur = srv.durationMinutes || 30;
            const sMin = currentPointer;
            const eMin = sMin + dur;
            currentPointer = eMin;
            totalMins += dur;

            const st = branchStaff.find((s) => s.id === it.staffId);
            previewList.push({
              title: srv.name,
              staffName: st?.name || 'Unassigned',
              duration: dur,
              startStr: formatMinutesToTime(sMin),
              endStr: formatMinutesToTime(eMin),
            });
          }
        } else if (it.type === 'PACKAGE') {
          const pkg = branchPackages.find((p) => p.id === it.itemId);
          if (pkg) {
            price += pkg.price;
            for (const c of pkg.components) {
              const compSrv = branchServices.find((s) => s.id === c.serviceId);
              const dur = compSrv?.durationMinutes || 30;
              const sMin = currentPointer;
              const eMin = sMin + dur;
              currentPointer = eMin;
              totalMins += dur;

              const compAssigned = it.packageComponents?.find((pc) => pc.serviceId === c.serviceId);
              const st = branchStaff.find((s) => s.id === compAssigned?.staffId);
              const packageStaffName = it.assignedStaff && it.assignedStaff.length > 0
                ? it.assignedStaff.map((s) => s.staffName).join(', ')
                : (st?.name || 'Unassigned');
              previewList.push({
                title: `${pkg.name} → ${c.serviceName}`,
                staffName: packageStaffName,
                duration: dur,
                startStr: formatMinutesToTime(sMin),
                endStr: formatMinutesToTime(eMin),
              });
            }
          }
        }
      }

      return {
        totalEstimatedPrice: price,
        totalEstimatedMinutes: totalMins,
        estimatedEndTime: formatMinutesToTime(currentPointer),
        sequentialPreview: previewList,
      };
    }, [selectedItems, branchServices, branchPackages, branchStaff, startTime]);

  // Form Submit Handler
  const handleSubmit = async (targetStatus: 'PENDING' | 'CONFIRMED') => {
    setFormError(null);

    // 1. Customer validation
    const name = clientName.trim();
    if (!name) {
      setFormError('Customer name is required.');
      toast.error('Customer name is required.');
      return;
    }
    const rawDigits = normalizePhoneDigits(clientPhone);
    if (!rawDigits || rawDigits.length < 10) {
      setFormError('A valid phone number with at least 10 digits is required.');
      toast.error('A valid phone number with at least 10 digits is required.');
      return;
    }

    // 2. Items validation
    if (selectedItems.length === 0) {
      setFormError('Please select at least one service or package for the appointment.');
      toast.error('Please select at least one service or package for the appointment.');
      return;
    }

    // 3. Staff assignments validation
    for (const it of selectedItems) {
      if (it.type === 'SERVICE' && !it.staffId) {
        setFormError('Please assign a staff member to every selected service.');
        toast.error('Please assign a staff member to every selected service.');
        return;
      }
      if (it.type === 'PACKAGE') {
        const pkg = branchPackages.find((p) => p.id === it.itemId);
        const hasAssigned = (it.assignedStaff && it.assignedStaff.length > 0) || it.staffId;
        if (!hasAssigned) {
          setFormError(`Please assign at least one staff member to package '${pkg?.name}'.`);
          toast.error(`Please assign at least one staff member to package '${pkg?.name}'.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      if (appointmentToEdit) {
        // Update flow
        const updated = await salonService.updateAppointment(
          appointmentToEdit.id,
          {
            date,
            startTime,
            clientName: name,
            clientPhone: formatPhoneNumber(clientPhone),
            clientEmail: clientEmail.trim() || undefined,
            customerSource,
            customerSourceDetails: customerSourceDetails.trim() || undefined,
            notes: notes.trim() || undefined,
            items: selectedItems,
          },
          user || undefined
        );

        if (targetStatus === 'CONFIRMED' && updated.status !== 'CONFIRMED') {
          const confirmed = await salonService.updateAppointmentStatus(
            updated.id,
            'CONFIRMED',
            undefined,
            user || undefined
          );
          toast.success(`Appointment for ${name} confirmed successfully!`);
          onSuccess(confirmed, true);
        } else {
          toast.success(`Appointment for ${name} updated successfully!`);
          onSuccess(updated, false);
        }
      } else {
        // Create flow
        const created = await salonService.createAppointment(
          {
            branchId: selectedBranchId,
            clientId: selectedClient?.id,
            clientName: name,
            clientPhone: formatPhoneNumber(clientPhone),
            clientEmail: clientEmail.trim() || undefined,
            customerSource,
            customerSourceDetails: customerSourceDetails.trim() || undefined,
            date,
            startTime,
            items: selectedItems,
            notes: notes.trim() || undefined,
            status: targetStatus,
          },
          user || undefined
        );

        toast.success(`Appointment for ${name} booked successfully!`);
        onSuccess(created, targetStatus === 'CONFIRMED');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save appointment. Please check inputs and staff availability.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
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

  const effectiveTimeOptions = useMemo(() => {
    if (startTime && !timeOptions.includes(startTime)) {
      return [startTime, ...timeOptions];
    }
    return timeOptions;
  }, [startTime]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-[#2254E1]" />
              {appointmentToEdit ? `Edit Appointment (${appointmentToEdit.appointmentNumber || appointmentToEdit.id})` : 'New Salon Appointment'}
            </span>
            <Badge variant="outline" className="font-normal text-xs bg-slate-50">
              Sequential Slot Scheduling
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* SECTION 1: CUSTOMER IDENTITY */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#2254E1]" />
                1. Customer Identity & Registry
              </h3>
              {!appointmentToEdit && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewClient(false);
                      setSelectedClient(null);
                    }}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      !isNewClient ? 'bg-[#2254E1] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Lookup Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewClient(true);
                      setSelectedClient(null);
                      setClientName('');
                      setClientPhone('');
                    }}
                    className={`px-2.5 py-1 rounded font-medium transition-all ${
                      isNewClient ? 'bg-[#2254E1] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    + New Customer
                  </button>
                </div>
              )}
            </div>

            {!isNewClient && !appointmentToEdit ? (
              <div className="space-y-2">
                <Label className="text-xs">Search Customer by Name or Phone</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Type client name or mobile digits (e.g. 0300)..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
                {matchingClients.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-md">
                    {matchingClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(c);
                          setClientName(c.name);
                          setClientPhone(c.phone);
                          setClientEmail(c.email || '');
                          if (c.source) setCustomerSource(c.source);
                          if (c.sourceDetails) setCustomerSourceDetails(c.sourceDetails);
                          setClientSearchQuery('');
                          setMatchingClients([]);
                        }}
                        className="w-full text-left p-2.5 hover:bg-blue-50/60 transition-colors flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div>
                          <strong className="text-slate-900 block font-medium">{c.name}</strong>
                          <span className="text-slate-500">{c.phone}</span>
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          <span>{c.totalVisits || 0} visits</span>
                          {c.outstandingBalance ? (
                            <span className="text-amber-600 font-medium block">
                              Due: {formatCurrency(c.outstandingBalance)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs">Customer Name *</Label>
                <Input
                  placeholder="e.g. Mahnoor Tariq"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="bg-white mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Mobile Phone (e.g. +92 300 1234567) *</Label>
                <Input
                  placeholder="+92 (3XX) XXXXXXX"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="bg-white mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs">Customer Acquisition Source</Label>
                <select
                  value={customerSource}
                  onChange={(e) => setCustomerSource(e.target.value as CustomerSource)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                >
                  <option value="WALK_IN">Walk-in Client</option>
                  <option value="REFERRAL">Client Referral</option>
                  <option value="SOCIAL_MEDIA">Social Media (Instagram / TikTok)</option>
                  <option value="OTHER">Other Source</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Source Details (Optional)</Label>
                <Input
                  placeholder="e.g. Referred by Dr. Usman"
                  value={customerSourceDetails}
                  onChange={(e) => setCustomerSourceDetails(e.target.value)}
                  className="bg-white mt-1"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: SCHEDULE & BRANCH */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#2254E1]" />
                2. Branch, Date & Time Schedule
              </h3>
              {totalEstimatedMinutes > 0 && (
                <span className="text-xs text-slate-500 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  Estimated Slot: <strong className="text-[#2254E1]">{startTime}</strong> to <strong className="text-[#2254E1]">{estimatedEndTime}</strong> ({totalEstimatedMinutes} mins)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Branch</Label>
                <select
                  value={selectedBranchId}
                  disabled={!!appointmentToEdit || (user?.role !== 'SUPER_ADMIN' && user?.branchId !== 'ALL')}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setSelectedItems([]);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 disabled:opacity-70 h-9"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#2254E1]" />
                  Appointment Date *
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-white mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#2254E1]" />
                  Appointment Start Time *
                </Label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 h-9 cursor-pointer"
                  required
                >
                  {effectiveTimeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: SERVICES & MULTI-STAFF PACKAGES */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-[#2254E1]" />
                  3. Selected Services & Packages
                </h3>
                <p className="text-xs text-slate-500">Each service and package component is attributed to individual staff</p>
              </div>

              <div className="flex items-center gap-2">
                {branchServices.length > 0 && (
                  <select
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItem('SERVICE', e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>+ Add Service...</option>
                    {branchServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.price)})
                      </option>
                    ))}
                  </select>
                )}

                {branchPackages.length > 0 && (
                  <select
                    className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-[#2254E1] font-medium rounded-lg text-xs cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItem('PACKAGE', e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>+ Add Package...</option>
                    {branchPackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatCurrency(p.price)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {selectedItems.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <Scissors className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No Services or Packages Added</p>
                <p className="text-xs text-slate-400 mt-0.5">Use the buttons above to select from your branch catalogue.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedItems.map((item, index) => {
                  if (item.type === 'SERVICE') {
                    const srv = branchServices.find((s) => s.id === item.itemId);
                    return (
                      <div
                        key={item.lineInstanceId}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#2254E1] flex items-center justify-center font-bold text-xs">
                            {index + 1}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 text-xs block">
                              {srv?.name || 'Service Item'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {formatCurrency(srv?.price || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Label className="text-[11px] text-slate-500 whitespace-nowrap">Assigned Stylist:</Label>
                            <select
                              value={item.staffId || ''}
                              onChange={(e) => handleServiceStaffChange(item.lineInstanceId, e.target.value)}
                              className={`px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium ${
                                !item.staffId
                                  ? 'border-amber-400 text-amber-800 bg-amber-50/60 font-semibold'
                                  : 'border-slate-200 text-slate-800'
                              }`}
                            >
                              <option value="">-- Select Staff --</option>
                              {branchStaff.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name} ({st.designation})
                                </option>
                              ))}
                            </select>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.lineInstanceId)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  } else {
                    const pkg = branchPackages.find((p) => p.id === item.itemId);
                    return (
                      <div
                        key={item.lineInstanceId}
                        className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                          <div className="flex items-center gap-2">
                            <PackageIcon className="w-4 h-4 text-[#2254E1]" />
                            <span className="font-semibold text-slate-900 text-xs">{pkg?.name} (Bundled Package)</span>
                            <Badge variant="outline" className="text-[10px] bg-white text-[#2254E1]">
                              Price: {formatCurrency(pkg?.price || 0)}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.lineInstanceId)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Package Assigned Staff & Multi-Staff Selection */}
                        <div className="space-y-2 pl-4 border-l-2 border-blue-400">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-700">
                              Assigned Stylists ({item.assignedStaff?.length || 0}):
                            </span>
                            {item.assignedStaff && item.assignedStaff.length > 1 ? (
                              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                                Equal Split ({(100 / item.assignedStaff.length).toFixed(1)}% each)
                              </span>
                            ) : item.assignedStaff && item.assignedStaff.length === 1 ? (
                              <span className="text-[10px] text-slate-400">
                                100% attributed
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                                No stylist assigned
                              </span>
                            )}
                          </div>

                          {/* Staff chips */}
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {(item.assignedStaff || []).map((st) => (
                              <span
                                key={st.staffId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 rounded-md text-xs font-medium border border-slate-200 transition-colors"
                              >
                                <span>{st.staffName}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaffFromPackage(item.lineInstanceId, st.staffId)}
                                  className="ml-1 text-slate-400 hover:text-rose-600 focus:outline-hidden cursor-pointer"
                                  title="Remove staff"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}

                            {/* Add Staff dropdown */}
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleAddStaffToPackage(item.lineInstanceId, e.target.value);
                              }}
                              className="px-2 py-1 bg-blue-50/60 border border-blue-200 rounded text-xs font-semibold text-[#2254E1] hover:bg-blue-100/60 cursor-pointer"
                            >
                              <option value="">{(!item.assignedStaff || item.assignedStaff.length === 0) ? '+ Assign Staff...' : '+ Add Staff...'}</option>
                              {branchStaff
                                .filter((s) => !item.assignedStaff?.some((as) => as.staffId === s.id))
                                .map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.name} ({st.designation || st.roleTitle})
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Included Services list */}
                          <div className="pt-1 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-600">Included Services: </span>
                            {(pkg?.components || []).map((c) => c.serviceName).join(', ')}
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>

          {/* SECTION 4: ESTIMATED QUOTE & NOTES */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
                Estimated Quote
              </span>
              <span className="text-xl font-bold text-[#2254E1] tabular-nums">
                {formatCurrency(totalEstimatedPrice)}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
            </span>
          </div>

          <div>
            <Label className="text-xs">Special Client Notes / Allergies (Optional)</Label>
            <textarea
              rows={2}
              placeholder="e.g. Prefers organic shampoo; requested cup of green tea on arrival."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2254E1]"
            />
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit('PENDING')}
            disabled={isSubmitting}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium"
          >
            Save as Pending
          </Button>

          <Button
            type="button"
            onClick={() => handleSubmit('CONFIRMED')}
            disabled={isSubmitting}
            className="bg-[#2254E1] hover:bg-[#1b43b5] text-white font-medium shadow-sm"
          >
            {isSubmitting ? 'Validating Slots...' : 'Save & Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
