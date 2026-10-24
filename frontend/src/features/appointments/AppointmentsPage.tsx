import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Appointment,
  AppointmentStatus,
  Branch,
  StaffMember,
} from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Search,
  List,
  Grid,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Receipt,
  FileCheck,
  RefreshCw,
  Building2,
  Phone,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BookingFormModal } from './components/BookingFormModal';
import { AppointmentDetailsModal } from './components/AppointmentDetailsModal';
import { RescheduleModal } from './components/RescheduleModal';
import { ConfirmationMessageModal } from './components/ConfirmationMessageModal';

// Status badge helper
const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  CHECKED_IN: {
    label: 'Checked In',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  IN_SERVICE: {
    label: 'In Service',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  NO_SHOW: {
    label: 'No-Show',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  // Current view mode: calendar or list
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Month navigation: year and month (0-indexed)
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());

  // Filter state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBillingStatus, setSelectedBillingStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingInitialDate, setBookingInitialDate] = useState<string | undefined>(undefined);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);

  const [selectedAppointmentForDetails, setSelectedAppointmentForDetails] = useState<Appointment | null>(null);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);
  const [confirmationMessageApptId, setConfirmationMessageApptId] = useState<string | null>(null);

  // Day overflow dialog state
  const [selectedDayForDialog, setSelectedDayForDialog] = useState<string | null>(null);

  // Initialize branches and branch selection
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [loadedBranches, loadedStaff] = await Promise.all([
          salonService.getBranches(),
          salonService.getStaff('ALL'),
        ]);
        setBranches(loadedBranches);
        setStaffList(loadedStaff);

        if (user?.role === 'SUPER_ADMIN') {
          setSelectedBranchId('ALL');
        } else if (user?.branchId) {
          setSelectedBranchId(user.branchId);
        } else if (loadedBranches.length > 0) {
          setSelectedBranchId(loadedBranches[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial branches/staff', err);
      }
    }
    loadInitialData();
  }, [user]);

  // Load appointments
  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date window for current month (with +/- 7 days margin for calendar display)
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);

      // Pad 7 days before and after
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + 7);

      const dateFrom = startDate.toISOString().split('T')[0];
      const dateTo = endDate.toISOString().split('T')[0];

      const loaded = await salonService.getAppointments(
        selectedBranchId,
        {
          startDate: dateFrom,
          endDate: dateTo,
          status: selectedStatus !== 'ALL' ? (selectedStatus as AppointmentStatus) : undefined,
          staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
          search: searchQuery.trim() || undefined,
        },
        user || undefined
      );

      // Secondary client-side billing filter if selected
      let filtered = loaded;
      if (selectedBillingStatus === 'BILLED') {
        filtered = filtered.filter((a) => a.billingStatus === 'BILLED');
      } else if (selectedBillingStatus === 'UNBILLED') {
        filtered = filtered.filter((a) => a.billingStatus !== 'BILLED');
      }

      setAppointments(filtered);
    } catch (err) {
      console.error('Failed to fetch appointments', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentYear,
    currentMonth,
    selectedBranchId,
    selectedStaffId,
    selectedStatus,
    selectedBillingStatus,
    searchQuery,
  ]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Handlers for month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Open booking modal
  const handleOpenBooking = (initialDateStr?: string) => {
    setBookingInitialDate(initialDateStr);
    setAppointmentToEdit(null);
    setIsBookingModalOpen(true);
  };

  const handleEditAppointment = (appt: Appointment) => {
    setSelectedAppointmentForDetails(null);
    setAppointmentToEdit(appt);
    setIsBookingModalOpen(true);
  };

  const handleOpenReschedule = (appt: Appointment) => {
    setSelectedAppointmentForDetails(null);
    setAppointmentToReschedule(appt);
  };

  // Calendar Day Grid Computation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const dayOfWeekFirst = firstDayOfMonth.getDay(); // 0 is Sunday
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Days from previous month
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = dayOfWeekFirst - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
      const dateString = prevDate.toISOString().split('T')[0];
      days.push({
        dateString,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateString = `${currentYear}-${monthStr}-${dayStr}`;
      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
      });
    }

    // Days from next month to fill grid (35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const dateString = nextDate.toISOString().split('T')[0];
      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Group appointments by date string
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const list = map.get(appt.date) || [];
      list.push(appt);
      map.set(appt.date, list);
    }
    // Sort each day's appointments by start time
    map.forEach((list) => {
      list.sort((a, b) => {
        const timeA = a.startTime || a.time || '00:00';
        const timeB = b.startTime || b.time || '00:00';
        return timeA.localeCompare(timeB);
      });
    });
    return map;
  }, [appointments]);

  // Appointments for Day Dialog
  const selectedDayAppointments = useMemo(() => {
    if (!selectedDayForDialog) return [];
    return appointmentsByDate.get(selectedDayForDialog) || [];
  }, [selectedDayForDialog, appointmentsByDate]);

  // Active branch for booking (fallback to first branch if 'ALL')
  const defaultBookingBranchId = useMemo(() => {
    if (selectedBranchId !== 'ALL') return selectedBranchId;
    if (user?.branchId) return user.branchId;
    return branches[0]?.id || '';
  }, [selectedBranchId, user, branches]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Appointment Calendar & Booking
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Salon chair scheduling, multi-staff service assignments, live conflict detection & billing handoff.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Calendar / List View Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchAppointments}
            disabled={isLoading}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleOpenBooking()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 h-9 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Month Navigator & Calendar Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-100">
          {/* Month / Year Navigator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                className="h-8 px-2.5 hover:bg-slate-200 text-slate-700 rounded-none"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-8 px-3 text-xs font-semibold hover:bg-slate-200 text-slate-700 rounded-none border-x border-slate-200"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                className="h-8 px-2.5 hover:bg-slate-200 text-slate-700 rounded-none"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <h2 className="text-lg font-bold text-slate-900 ml-2">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
          </div>

          {/* Quick Search */}
          <div className="w-full md:w-72 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search client, phone, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Branch Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Branch
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={user?.role !== 'SUPER_ADMIN'}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            >
              {user?.role === 'SUPER_ADMIN' && <option value="ALL">All Branches</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Staff Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Staff Member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Stylists & Staff</option>
              {staffList
                .filter((s) => selectedBranchId === 'ALL' || s.branchId === selectedBranchId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.roleTitle || s.designation || 'Staff'})
                  </option>
                ))}
            </select>
          </div>

          {/* Appointment Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Appointment Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="IN_SERVICE">In Service</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-Show</option>
            </select>
          </div>

          {/* Billing Status Filter */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Billing Status
            </label>
            <select
              value={selectedBillingStatus}
              onChange={(e) => setSelectedBillingStatus(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Billing States</option>
              <option value="UNBILLED">Unbilled</option>
              <option value="BILLED">Billed (Invoice Created)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area: Calendar or List */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/75">
            {WEEKDAY_NAMES.map((w, idx) => (
              <div
                key={w}
                className={`py-2.5 text-center text-xs font-bold uppercase tracking-wider ${
                  idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[640px]">
            {calendarDays.map((cell) => {
              const dayAppts = appointmentsByDate.get(cell.dateString) || [];
              const hasOverflow = dayAppts.length > 3;
              const displayAppts = hasOverflow ? dayAppts.slice(0, 3) : dayAppts;
              const overflowCount = dayAppts.length - 3;

              return (
                <div
                  key={cell.dateString}
                  className={`min-h-[120px] p-2 flex flex-col justify-between transition-colors group relative ${
                    cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/40 text-slate-400'
                  } ${cell.isToday ? 'bg-blue-50/20' : ''}`}
                >
                  {/* Top Bar of cell: Day Number + Add Button */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        cell.isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Quick Add button on hover */}
                    <button
                      type="button"
                      onClick={() => handleOpenBooking(cell.dateString)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                      title={`Book for ${cell.dateString}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Appointments list */}
                  <div className="space-y-1.5 flex-1 overflow-hidden">
                    {displayAppts.map((appt) => {
                      const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.PENDING;
                      const isBilled = appt.billingStatus === 'BILLED';

                      return (
                        <div
                          key={appt.id}
                          onClick={() => setSelectedAppointmentForDetails(appt)}
                          className={`p-1.5 rounded-md border text-left cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xs ${cfg.bg} ${cfg.border} border-l-4`}
                          style={{
                            borderLeftColor:
                              appt.status === 'CONFIRMED'
                                ? '#2563eb'
                                : appt.status === 'COMPLETED'
                                ? '#059669'
                                : appt.status === 'CHECKED_IN'
                                ? '#9333ea'
                                : appt.status === 'IN_SERVICE'
                                ? '#4f46e5'
                                : appt.status === 'CANCELLED'
                                ? '#e11d48'
                                : '#d97706',
                          }}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] font-semibold">
                            <span className="font-mono text-slate-500 truncate text-[9px]">
                              {appt.appointmentNumber || appt.id.slice(-6)}
                            </span>
                            <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </div>

                          <div className="text-[11px] font-bold text-slate-900 truncate mt-0.5">
                            {appt.clientName || 'Walk-in Client'}
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px] text-slate-500">
                            <span className="truncate">
                              {appt.items?.length
                                ? appt.items.map((i) => i.name).join(', ')
                                : appt.serviceName || 'Service'}
                            </span>
                            {isBilled && (
                              <Badge
                                variant="outline"
                                className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] h-3.5 px-1 py-0"
                              >
                                Billed
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Overflow "+N more" badge button */}
                    {hasOverflow && (
                      <button
                        type="button"
                        onClick={() => setSelectedDayForDialog(cell.dateString)}
                        className="w-full text-center py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 rounded-md transition-colors"
                      >
                        +{overflowCount} more...
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Appointments List ({appointments.length} Total)
            </h3>
            <span className="text-xs text-slate-500">
              Showing filtered results for {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">No appointments found matching your criteria</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or date range.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenBooking()}
                className="mt-4 text-xs font-semibold gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Book New Appointment
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="report-records w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Services & Staff</th>
                    <th className="py-3 px-4 text-right">Est. Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Billing</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((appt) => {
                    const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.PENDING;
                    const isBilled = appt.billingStatus === 'BILLED';

                    return (
                      <tr
                        key={appt.id}
                        className="hover:bg-slate-50/75 transition-colors cursor-pointer"
                        onClick={() => setSelectedAppointmentForDetails(appt)}
                      >
                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{appt.date}</div>
                        </td>

                        {/* Client */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {appt.clientName || 'Walk-in Client'}
                          </div>
                          {appt.clientPhone && (
                            <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {formatPhoneNumber(appt.clientPhone)}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Ref: {appt.appointmentNumber || appt.id}
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-slate-700">
                            {appt.branchName || appt.branchId}
                          </span>
                        </td>

                        {/* Services & Staff */}
                        <td className="py-3 px-4 max-w-xs">
                          {appt.items && appt.items.length > 0 ? (
                            <div className="space-y-1">
                              {appt.items.map((item, idx) => (
                                <div key={item.lineInstanceId || idx} className="text-slate-700">
                                  <span className="font-medium">{item.name}</span>
                                  {item.staffName && (
                                    <span className="text-slate-500 ml-1">
                                      ({item.staffName})
                                    </span>
                                  )}
                                  {item.type === 'PACKAGE' && (
                                    <div className="pl-2 text-[10px] text-slate-500">
                                      {item.assignedStaff && item.assignedStaff.length > 1 && (
                                        <div className="text-blue-600 font-medium">
                                          Shared ({item.assignedStaff.length} stylists): {item.assignedStaff.map((s) => s.staffName).join(', ')}
                                        </div>
                                      )}
                                      {item.packageComponents && item.packageComponents.map((c, cIdx) => (
                                        <div key={c.componentInstanceId || cIdx}>
                                          • {c.serviceName}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-700">
                              {appt.serviceName || 'Standard Service'}
                            </span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(appt.price || 0)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Billing */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isBilled ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs">
                              Billed
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-slate-600 border-slate-300 font-semibold text-xs"
                            >
                              Unbilled
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          className="py-3 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAppointmentForDetails(appt)}
                              className="h-7 px-2 text-slate-600 hover:text-blue-600 text-xs gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </Button>

                            {!isBilled &&
                              ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED'].includes(
                                appt.status
                              ) && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => navigate(`/pos?appointmentId=${appt.id}`)}
                                  className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                                >
                                  <Receipt className="w-3 h-3" />
                                  POS
                                </Button>
                              )}
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
      )}

      {/* Day Overview Popover / Dialog (when clicking "+N more") */}
      <Dialog
        open={Boolean(selectedDayForDialog)}
        onOpenChange={(open) => !open && setSelectedDayForDialog(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>Appointments for {selectedDayForDialog}</span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const day = selectedDayForDialog;
                  setSelectedDayForDialog(null);
                  if (day) handleOpenBooking(day);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1 h-7"
              >
                <Plus className="w-3.5 h-3.5" />
                Add for this date
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto space-y-2 py-2">
            {selectedDayAppointments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No appointments on this date.</p>
            ) : (
              selectedDayAppointments.map((appt) => {
                const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.PENDING;
                return (
                  <div
                    key={appt.id}
                    onClick={() => {
                      setSelectedDayForDialog(null);
                      setSelectedAppointmentForDetails(appt);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer hover:shadow-xs transition-all ${cfg.bg} ${cfg.border} border-l-4`}
                    style={{
                      borderLeftColor:
                        appt.status === 'CONFIRMED'
                          ? '#2563eb'
                          : appt.status === 'COMPLETED'
                          ? '#059669'
                          : appt.status === 'CHECKED_IN'
                          ? '#9333ea'
                          : appt.status === 'IN_SERVICE'
                          ? '#4f46e5'
                          : appt.status === 'CANCELLED'
                          ? '#e11d48'
                          : '#d97706',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-slate-500 text-[11px]">
                        Ref: {appt.appointmentNumber || appt.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="font-bold text-slate-800 text-sm mt-1">
                      {appt.clientName || 'Walk-in Client'}
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5">
                      {appt.items?.map((i) => i.name).join(', ') || appt.serviceName}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200/50">
                      <span>Ref: {appt.appointmentNumber || appt.id}</span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(appt.price || 0)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedDayForDialog(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Form Modal */}
      <BookingFormModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setAppointmentToEdit(null);
        }}
        onSuccess={(savedAppt, shouldPrepareMessage) => {
          setIsBookingModalOpen(false);
          setAppointmentToEdit(null);
          fetchAppointments();
          if (shouldPrepareMessage) {
            setConfirmationMessageApptId(savedAppt.id);
          }
        }}
        initialDate={bookingInitialDate}
        activeBranchId={defaultBookingBranchId}
        branches={branches}
        appointmentToEdit={appointmentToEdit}
      />

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        isOpen={Boolean(selectedAppointmentForDetails)}
        onClose={() => setSelectedAppointmentForDetails(null)}
        appointment={selectedAppointmentForDetails}
        onEdit={(appt) => handleEditAppointment(appt)}
        onReschedule={(appt) => handleOpenReschedule(appt)}
        onShowConfirmationMessage={(apptId) => setConfirmationMessageApptId(apptId)}
        onStatusChange={(updated) => {
          setSelectedAppointmentForDetails(updated);
          fetchAppointments();
        }}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={Boolean(appointmentToReschedule)}
        onClose={() => setAppointmentToReschedule(null)}
        appointment={appointmentToReschedule}
        onSuccess={(updated) => {
          setAppointmentToReschedule(null);
          fetchAppointments();
          // Prompt updated confirmation message
          setConfirmationMessageApptId(updated.id);
        }}
      />

      {/* Confirmation Message Modal */}
      <ConfirmationMessageModal
        isOpen={Boolean(confirmationMessageApptId)}
        onClose={() => setConfirmationMessageApptId(null)}
        appointmentId={confirmationMessageApptId}
      />
    </div>
  );
};
