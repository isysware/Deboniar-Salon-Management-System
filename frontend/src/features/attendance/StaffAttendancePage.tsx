import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService } from '../../services';
import {
  AttendanceRecord,
  StaffMember,
  Branch,
  CSVAttendanceImportRow,
  CSVAttendanceImportResult,
  AttendancePolicyConfig,
} from '../../types/salon';
import {
  Clock,
  ClockAlert,
  Calendar,
  Filter,
  Check,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  RotateCcw,
  Building2,
  Users,
  ShieldCheck,
  HelpCircle,
  Loader2,
  ChevronDown,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  formatMinutesToTime,
  parseTimeToMinutes,
  evaluateLateness,
  evaluateEarlyExit,
} from '../../lib/attendanceCalculations';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';
import { toast } from '../../context/ToastContext';

function formatTo24Hour(timeStr?: string): string {
  if (!timeStr || !timeStr.trim()) return '';
  const clean = timeStr.trim().toUpperCase();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(clean)) {
    return clean;
  }
  const mins = parseTimeToMinutes(clean);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface EditableAttendanceRow {
  staffId: string;
  employeeCode: string;
  name: string;
  phone: string;
  designation: string;
  roleTitle: string;
  compensationType: string;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "18:00"
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  isOvernightShift: boolean;

  // Editable fields
  recordId?: string;
  status: 'SELECT_STATUS' | 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF';
  checkIn: string;   // "09:00"
  checkOut: string;  // "18:00"
  notes: string;
  isModified: boolean;
  isAutoAbsent?: boolean;
}

export const StaffAttendancePage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();
  const { navigate } = useRouter();

  // Role guard: Super Admin and Admin only
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/operations/attendance" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const initialDate = demoDate || new Date().toISOString().slice(0, 10);

  // Filter Bar state
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? (activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '') : (user.branchId || '')
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [attendanceType, setAttendanceType] = useState<string>('NORMAL');
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  // Data state
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [rawStaffList, setRawStaffList] = useState<StaffMember[]>([]);
  const [rawAttendanceList, setRawAttendanceList] = useState<AttendanceRecord[]>([]);
  const [rows, setRows] = useState<EditableAttendanceRow[]>([]);
  const [attendancePolicy, setAttendancePolicy] = useState<AttendancePolicyConfig | null>(null);

  // Modals state (EOD finalize & CSV import)
  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importCsvText, setImportCsvText] = useState<string>('');
  const [importLoading, setImportLoading] = useState<boolean>(false);

  // Effective branch
  const effectiveBranchId = isSuperAdmin ? selectedBranchId : (user.branchId || activeBranchId);
  const currentBranch = allBranches.find((b) => b.id === effectiveBranchId) || allBranches[0];

  // Fetch staff and existing attendance from backend database
  const loadAttendanceData = async (branchIdToLoad: string, dateToLoad: string) => {
    if (!branchIdToLoad) return;
    try {
      setLoading(true);
      const [allStaff, attRecords, attPolicy] = await Promise.all([
        salonService.getStaff(branchIdToLoad),
        salonService.getAttendance(branchIdToLoad, dateToLoad, undefined, user || undefined),
        salonService.getAttendancePolicy(branchIdToLoad).catch(() => null),
      ]);

      const activeStaff = allStaff.filter((s) => s.isActive);
      setRawStaffList(activeStaff);
      setRawAttendanceList(attRecords);
      setAttendancePolicy(attPolicy);

      // Build initial editable rows map
      const attMap = new Map<string, AttendanceRecord>();
      attRecords.forEach((a) => {
        attMap.set(a.staffId, a);
      });

      const policyEnabled = attPolicy?.autoMarkAbsentEnabled ?? true;
      const thresholdMins = attPolicy?.autoAbsentThresholdMinutes ?? 60;
      const todayStr = demoDate || new Date().toISOString().slice(0, 10);
      const now = new Date();
      const currentDayMinutes = now.getHours() * 60 + now.getMinutes();

      const initialRows: EditableAttendanceRow[] = activeStaff.map((staff) => {
        const existing = attMap.get(staff.id);
        const defaultStart = staff.startTime ? formatTo24Hour(staff.startTime) : (attPolicy?.defaultStartTime || '09:00');
        const defaultEnd = staff.endTime ? formatTo24Hour(staff.endTime) : (attPolicy?.defaultEndTime || '18:00');

        if (existing) {
          let mappedStatus: EditableAttendanceRow['status'] = 'PRESENT';
          const exStatus = existing.status as string;
          if (exStatus === 'ABSENT') mappedStatus = 'ABSENT';
          else if (exStatus === 'HALF_DAY') mappedStatus = 'HALF_DAY';
          else if (exStatus === 'PAID_LEAVE') mappedStatus = 'PAID_LEAVE';
          else if (exStatus === 'UNPAID_LEAVE') mappedStatus = 'UNPAID_LEAVE';
          else if (exStatus === 'HOLIDAY') mappedStatus = 'HOLIDAY';
          else if (exStatus === 'WEEKLY_OFF') mappedStatus = 'WEEKLY_OFF';
          else mappedStatus = 'PRESENT';

          return {
            staffId: staff.id,
            employeeCode: staff.employeeCode || `EMP-${staff.id.slice(0, 4)}`,
            name: staff.name,
            phone: staff.phone || '-',
            designation: staff.designation || staff.roleTitle || 'Stylist',
            roleTitle: staff.roleTitle || '',
            compensationType: staff.compensationType || 'SALARY_ONLY',
            startTime: defaultStart,
            endTime: defaultEnd,
            lateGraceMinutes: staff.lateGraceMinutes ?? (attPolicy?.lateGraceMinutes ?? 15),
            earlyGraceMinutes: staff.earlyGraceMinutes ?? (attPolicy?.earlyGraceMinutes ?? 15),
            isOvernightShift: !!staff.isOvernightShift,

            recordId: existing.id,
            status: mappedStatus,
            checkIn: existing.checkIn && existing.checkIn !== 'ABSENT' && !existing.checkIn.includes('LEAVE') ? formatTo24Hour(existing.checkIn) : '',
            checkOut: existing.checkOut && existing.checkOut !== 'ABSENT' && !existing.checkOut.includes('LEAVE') ? formatTo24Hour(existing.checkOut) : '',
            notes: existing.notes || '',
            isModified: false,
            isAutoAbsent: false,
          };
        }

        // New unrecorded row for this day — apply Auto-Mark Absent rule if threshold passed
        let newStatus: EditableAttendanceRow['status'] = 'SELECT_STATUS';
        let newNotes = '';
        let isAutoMarked = false;

        if (policyEnabled) {
          if (dateToLoad < todayStr) {
            // Past day with no check-in -> auto-mark absent
            newStatus = 'ABSENT';
            newNotes = 'Auto-marked absent: Day ended without check-in';
            isAutoMarked = true;
          } else if (dateToLoad === todayStr) {
            // Today: check if current time has passed (shiftStart + threshold)
            const shiftStartMins = parseTimeToMinutes(defaultStart);
            const cutoffMins = shiftStartMins + thresholdMins;

            if (currentDayMinutes >= cutoffMins) {
              newStatus = 'ABSENT';
              newNotes = `Auto-marked absent: Not checked in within ${thresholdMins}m of shift start (${defaultStart})`;
              isAutoMarked = true;
            }
          }
        }

        return {
          staffId: staff.id,
          employeeCode: staff.employeeCode || `EMP-${staff.id.slice(0, 4)}`,
          name: staff.name,
          phone: staff.phone || '-',
          designation: staff.designation || staff.roleTitle || 'Stylist',
          roleTitle: staff.roleTitle || '',
          compensationType: staff.compensationType || 'SALARY_ONLY',
          startTime: defaultStart,
          endTime: defaultEnd,
          lateGraceMinutes: staff.lateGraceMinutes ?? (attPolicy?.lateGraceMinutes ?? 15),
          earlyGraceMinutes: staff.earlyGraceMinutes ?? (attPolicy?.earlyGraceMinutes ?? 15),
          isOvernightShift: !!staff.isOvernightShift,

          recordId: undefined,
          status: newStatus,
          checkIn: '',
          checkOut: '',
          notes: newNotes,
          isModified: isAutoMarked,
          isAutoAbsent: isAutoMarked,
        };
      });

      setRows(initialRows);
    } catch (err: any) {
      console.error('Error loading attendance:', err);
      toast.error(err.message || 'Failed to load staff attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveBranchId) return;
    salonService.getStaff(effectiveBranchId).then((allStaff) => {
      setRawStaffList(allStaff.filter((s) => s.isActive));
    }).catch((err) => console.error(err));
    setHasFiltered(false);
    setRows([]);
  }, [effectiveBranchId]);

  // Unique staff categories derived dynamically from active staff
  const staffCategories = useMemo(() => {
    const set = new Set<string>();
    rawStaffList.forEach((s) => {
      if (s.designation) set.add(s.designation);
      else if (s.roleTitle) set.add(s.roleTitle);
    });
    return Array.from(set);
  }, [rawStaffList]);

  // Filtered rows for display based on Category filter
  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (categoryFilter !== 'ALL' && r.designation !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [rows, categoryFilter]);

  // Handler: Manual Filter Button Click
  const handleApplyFilter = () => {
    setHasFiltered(true);
    loadAttendanceData(effectiveBranchId, selectedDate);
  };

  // Handler: Bulk Quick Actions
  const handleMarkAll = (targetStatus: EditableAttendanceRow['status']) => {
    setRows((prev) =>
      prev.map((r) => {
        // If category filter is active, only update visible rows
        if (categoryFilter !== 'ALL' && r.designation !== categoryFilter) {
          return r;
        }

        let newCheckIn = r.checkIn;
        let newCheckOut = r.checkOut;

        if (targetStatus === 'ABSENT' || targetStatus === 'HOLIDAY' || targetStatus === 'WEEKLY_OFF') {
          newCheckIn = '';
          newCheckOut = '';
        }

        return {
          ...r,
          status: targetStatus,
          checkIn: newCheckIn,
          checkOut: newCheckOut,
          isModified: true,
        };
      })
    );
    toast.success(`Marked all ${categoryFilter === 'ALL' ? '' : categoryFilter} staff as ${targetStatus}!`);
  };

  // Handler: Update row status
  const handleRowStatusChange = (staffId: string, newStatus: EditableAttendanceRow['status']) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.staffId !== staffId) return r;
        let cIn = r.checkIn;
        let cOut = r.checkOut;
        if (newStatus === 'ABSENT' || newStatus === 'HOLIDAY' || newStatus === 'WEEKLY_OFF') {
          cIn = '';
          cOut = '';
        }
        return {
          ...r,
          status: newStatus,
          checkIn: cIn,
          checkOut: cOut,
          isModified: true,
          isAutoAbsent: false,
        };
      })
    );
  };

  // Handler: Update row check-in time
  const handleRowCheckInChange = (staffId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.staffId !== staffId) return r;
        return {
          ...r,
          checkIn: val,
          status: r.status === 'SELECT_STATUS' ? 'PRESENT' : r.status,
          isModified: true,
        };
      })
    );
  };

  // Handler: Update row check-out time
  const handleRowCheckOutChange = (staffId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.staffId !== staffId) return r;
        return {
          ...r,
          checkOut: val,
          status: r.status === 'SELECT_STATUS' ? 'PRESENT' : r.status,
          isModified: true,
        };
      })
    );
  };

  // Helper: evaluate lateness for a row
  const getLateArrivalInfo = (r: EditableAttendanceRow) => {
    if (r.status !== 'PRESENT' && r.status !== 'HALF_DAY') return { text: '-', isLate: false };
    if (!r.checkIn) return { text: '-', isLate: false };
    const { isLate, lateMinutes } = evaluateLateness(r.checkIn, r.startTime, r.lateGraceMinutes);
    if (isLate) {
      return { text: `${lateMinutes}m Late`, isLate: true };
    }
    return { text: 'On Time', isLate: false };
  };

  // Helper: evaluate early exit for a row
  const getEarlyExitInfo = (r: EditableAttendanceRow) => {
    if (r.status !== 'PRESENT' && r.status !== 'HALF_DAY') return { text: '-', isEarly: false };
    if (!r.checkOut) return { text: '-', isEarly: false };
    const { isEarlyExit: isEarly, earlyExitMinutes } = evaluateEarlyExit(
      r.checkOut,
      r.endTime,
      r.earlyGraceMinutes,
      r.isOvernightShift
    );
    if (isEarly) {
      return { text: `${earlyExitMinutes}m Early Exit`, isEarly: true };
    }
    return { text: 'On Time', isEarly: false };
  };

  // Summary counts
  const summaryCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leaves = 0;
    let holidays = 0;
    let unselected = 0;

    rows.forEach((r) => {
      if (r.status === 'PRESENT' || r.status === 'HALF_DAY') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'PAID_LEAVE' || r.status === 'UNPAID_LEAVE') leaves++;
      else if (r.status === 'HOLIDAY' || r.status === 'WEEKLY_OFF') holidays++;
      else unselected++;
    });

    return { total: rows.length, present, absent, leaves, holidays, unselected };
  }, [rows]);

  // Handler: Save Attendance (Sends daily sheet to real backend DB)
  const handleSaveAttendance = async () => {
    // Only send rows that have been given a valid status
    const validRows = rows.filter((r) => r.status !== 'SELECT_STATUS');
    if (validRows.length === 0) {
      toast.error('Please mark status for at least one staff member before saving.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        branchId: effectiveBranchId,
        date: selectedDate,
        records: validRows.map((r) => ({
          staffId: r.staffId,
          status: r.status,
          checkIn: r.checkIn ? formatMinutesToTime(parseTimeToMinutes(r.checkIn)) : undefined,
          checkOut: r.checkOut ? formatMinutesToTime(parseTimeToMinutes(r.checkOut)) : undefined,
          notes: r.notes || undefined,
        })),
      };

      const result = await salonService.saveDailyAttendance(payload, user);
      toast.success(`Attendance successfully saved for ${result.savedCount} staff members!`);
      // Reload fresh data from database
      await loadAttendanceData(effectiveBranchId, selectedDate);
    } catch (err: any) {
      console.error('Failed to save attendance:', err);
      toast.error(err.message || 'Failed to save attendance records.');
    } finally {
      setSaving(false);
    }
  };

  // Handler: End of Day Finalize
  const handleFinalizeDay = async () => {
    try {
      setLoading(true);
      const res = await salonService.finalizeDayAttendance(effectiveBranchId, selectedDate, user);
      toast.success(`Day finalized! ${res.finalizedCount} records locked. Marked absent: ${res.markedAbsentStaffNames.length}`);
      setShowFinalizeModal(false);
      await loadAttendanceData(effectiveBranchId, selectedDate);
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize attendance.');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Biometric CSV Import
  const handleImportCSV = async () => {
    if (!importCsvText.trim()) return;
    try {
      setImportLoading(true);
      const lines = importCsvText.trim().split('\n');
      const rowsToImport: CSVAttendanceImportRow[] = [];
      lines.forEach((line, idx) => {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 3 && idx > 0) {
          rowsToImport.push({
            rowNumber: idx + 1,
            employeeCode: parts[0],
            date: parts[1] || selectedDate,
            checkIn: parts[2] || '09:00',
            checkOut: parts[3] || undefined,
            status: 'VALID',
          });
        }
      });

      if (rowsToImport.length === 0) {
        toast.error('Invalid CSV format. Header: employeeCode,date,checkIn,checkOut');
        return;
      }

      const res = await salonService.importAttendanceCSV(effectiveBranchId, rowsToImport, user);
      toast.success(`Import complete! Accepted: ${res.acceptedRows}, Rejected: ${res.rejectedRows}`);
      setShowImportModal(false);
      setImportCsvText('');
      await loadAttendanceData(effectiveBranchId, selectedDate);
    } catch (err: any) {
      toast.error(err.message || 'CSV import failed.');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Staff Attendance</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily attendance marking, arrival timings & real-time shift verification
            </p>
          </div>

          {/* Secondary tools */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/attendance-settings')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition-colors cursor-pointer"
              title="Configure auto-absent cutoff threshold and shift grace"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Attendance Settings</span>
            </button>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Import Biometric/CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFinalizeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Finalize Day (EOD)</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-4">
        {/* ── FILTER CARD (Matching User Reference) ────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
            {/* Branch Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch</label>
              <div className="relative">
                <select
                  value={selectedBranchId}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors appearance-none cursor-pointer disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {allBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Staff Category */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Staff Category</label>
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors appearance-none cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {staffCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Type</label>
              <div className="relative">
                <select
                  value={attendanceType}
                  onChange={(e) => setAttendanceType(e.target.value)}
                  className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors appearance-none cursor-pointer"
                >
                  <option value="NORMAL">Normal Attendance</option>
                  <option value="ALL">All Attendance</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setHasFiltered(false);
                  setRows([]);
                }}
                className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors cursor-pointer"
              />
            </div>

            {/* Filter Button */}
            <div>
              <button
                type="button"
                onClick={handleApplyFilter}
                disabled={loading}
                className="w-full h-9 bg-[#0047AB] hover:bg-[#003785] active:bg-[#002a66] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                {loading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" /> : <Filter className="w-3.5 h-3.5" />}
                <span>= Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── SELECTED PILL & QUICK ACTION BUTTONS ROW ─────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Branch Pill Badge */}
          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#0047AB] text-white text-xs font-semibold shadow-xs">
              Branch: {currentBranch?.name || 'Main Branch'}
            </span>
          </div>

          {/* Quick Bulk Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!hasFiltered || loading || visibleRows.length === 0}
              onClick={() => handleMarkAll('PRESENT')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Mark All Present</span>
            </button>

            <button
              type="button"
              disabled={!hasFiltered || loading || visibleRows.length === 0}
              onClick={() => handleMarkAll('ABSENT')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Mark All Absent</span>
            </button>

            <button
              type="button"
              disabled={!hasFiltered || loading || visibleRows.length === 0}
              onClick={() => handleMarkAll('HOLIDAY')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Mark All Holiday</span>
            </button>

            <button
              type="button"
              disabled={!hasFiltered || loading || visibleRows.length === 0}
              onClick={() => handleMarkAll('WEEKLY_OFF')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Mark All Sunday / Off</span>
            </button>
          </div>
        </div>

        {/* ── MAIN ATTENDANCE TABLE ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="report-records min-w-[1100px] w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px] tracking-wider whitespace-nowrap">
                  <th className="py-3 px-4 w-[110px] whitespace-nowrap">Emp. ID</th>
                  <th className="py-3 px-4 min-w-[180px] whitespace-nowrap">Name</th>
                  <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Phone / Info</th>
                  <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Designation</th>
                  <th className="py-3 px-4 min-w-[160px] whitespace-nowrap">Attendance Status</th>
                  <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Arrival Timing</th>
                  <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Exit Timing</th>
                  <th className="py-3 px-4 min-w-[120px] whitespace-nowrap">Late Arrival</th>
                  <th className="py-3 px-4 min-w-[120px] whitespace-nowrap">Early Exit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!hasFiltered ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-slate-500">
                      <div className="max-w-md mx-auto space-y-2">
                        <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700 text-sm">No Records Displayed</p>
                        <p className="text-xs text-slate-400">
                          Please select criteria above and click <span className="font-semibold text-[#0047AB]">= Filter</span> to load staff attendance records.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="w-6 h-6 rounded-full border-2 border-blue-100 border-t-[#2254E1] animate-spin mx-auto mb-2" />
                      Loading staff attendance data...
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No active staff found for this branch or category on {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const isPresentLike = row.status === 'PRESENT' || row.status === 'HALF_DAY';
                    const lateInfo = getLateArrivalInfo(row);
                    const earlyInfo = getEarlyExitInfo(row);

                    return (
                      <tr
                        key={row.staffId}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          row.isModified ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        {/* Emp ID */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {row.employeeCode}
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{row.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            {row.compensationType.replace(/_/g, ' ').toLowerCase()}
                          </div>
                        </td>

                        {/* Phone / Contact */}
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                          {row.phone}
                        </td>

                        {/* Designation & Scheduled Shift */}
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          <div>{row.designation}</div>
                          {row.startTime && row.endTime && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {row.startTime} - {row.endTime} (Grace: {row.lateGraceMinutes}m)
                            </div>
                          )}
                        </td>

                        {/* Attendance Status Dropdown */}
                        <td className="py-3.5 px-4">
                          <div className="relative">
                            <select
                              value={row.status}
                              onChange={(e) =>
                                handleRowStatusChange(
                                  row.staffId,
                                  e.target.value as EditableAttendanceRow['status']
                                )
                              }
                              className={`w-full h-8 text-xs font-semibold rounded-lg px-2.5 border transition-colors cursor-pointer appearance-none ${
                                row.status === 'PRESENT'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : row.status === 'ABSENT'
                                  ? 'bg-red-50 text-red-700 border-red-300'
                                  : row.status === 'HALF_DAY'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : row.status === 'HOLIDAY'
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : row.status === 'WEEKLY_OFF'
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : row.status.includes('LEAVE')
                                  ? 'bg-purple-50 text-purple-700 border-purple-300'
                                  : 'bg-white text-slate-500 border-slate-300'
                              }`}
                            >
                              <option value="SELECT_STATUS">Select Status</option>
                              <option value="PRESENT">Present</option>
                              <option value="ABSENT">Absent</option>
                              <option value="HALF_DAY">Half Day</option>
                              <option value="PAID_LEAVE">Leave (Paid)</option>
                              <option value="UNPAID_LEAVE">Leave (Unpaid)</option>
                              <option value="HOLIDAY">Holiday</option>
                              <option value="WEEKLY_OFF">Weekly Off</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                          </div>
                          {row.isAutoAbsent && row.status === 'ABSENT' && (
                            <div className="mt-1">
                              <span
                                className="inline-block text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shadow-2xs"
                                title={row.notes}
                              >
                                Auto-Absent (&gt;{attendancePolicy?.autoAbsentThresholdMinutes || 60}m)
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Arrival Timing */}
                        <td className="py-3.5 px-4">
                          <div className="relative flex items-center">
                            <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                            <input
                              type="time"
                              value={row.checkIn}
                              disabled={!isPresentLike}
                              onChange={(e) => handleRowCheckInChange(row.staffId, e.target.value)}
                              className="w-full h-8 pl-8 pr-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                            />
                          </div>
                        </td>

                        {/* Exit Timing */}
                        <td className="py-3.5 px-4">
                          <div className="relative flex items-center">
                            <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                            <input
                              type="time"
                              value={row.checkOut}
                              disabled={!isPresentLike}
                              onChange={(e) => handleRowCheckOutChange(row.staffId, e.target.value)}
                              className="w-full h-8 pl-8 pr-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                            />
                          </div>
                        </td>

                        {/* Late Arrival Badge */}
                        <td className="py-3.5 px-4">
                          {lateInfo.isLate ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                              {lateInfo.text}
                            </span>
                          ) : lateInfo.text === 'On Time' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              On Time
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">-</span>
                          )}
                        </td>

                        {/* Early Exit Badge */}
                        <td className="py-3.5 px-4">
                          {earlyInfo.isEarly ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              {earlyInfo.text}
                            </span>
                          ) : earlyInfo.text === 'On Time' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              On Time
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER: SUMMARY COUNTS & SAVE BUTTON ─────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Summary status pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
              Total Staff: <strong className="font-bold">{summaryCounts.total}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700">
              Present: <strong className="font-bold">{summaryCounts.present}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700">
              Absent: <strong className="font-bold">{summaryCounts.absent}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700">
              Off/Holiday: <strong className="font-bold">{summaryCounts.holidays}</strong>
            </span>
            {summaryCounts.unselected > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-semibold">
                Unmarked: {summaryCounts.unselected}
              </span>
            )}
          </div>

          {/* Save Attendance Button */}
          <div>
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={!hasFiltered || saving || loading || visibleRows.length === 0}
              className="w-full sm:w-auto px-7 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Attendance</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL: FINALIZE DAY (EOD) ───────────────────────────────────────── */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center gap-3 text-emerald-600 mb-2">
              <ShieldCheck className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-sm">Finalize Day Attendance</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Finalizing will lock all recorded attendance for <strong>{selectedDate}</strong> at{' '}
              <strong>{currentBranch?.name}</strong>. Any staff member who has not been marked present
              will be permanently recorded as <strong>ABSENT</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalizeDay}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
              >
                {loading ? 'Finalizing...' : 'Confirm & Lock Day'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BIOMETRIC CSV IMPORT ─────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Upload className="w-4 h-4 text-[#0047AB]" />
                <span>Import Biometric / CSV Attendance</span>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Paste CSV rows below. Format: <code>employeeCode,date,checkIn,checkOut</code>
            </p>
            <textarea
              rows={6}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              placeholder="EMP-01,2026-10-11,09:05,18:00&#10;EMP-02,2026-10-11,09:30,18:15"
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCSV}
                disabled={importLoading || !importCsvText.trim()}
                className="px-4 py-1.5 rounded-lg bg-[#0047AB] hover:bg-[#003785] text-white text-xs font-semibold shadow-xs disabled:opacity-60"
              >
                {importLoading ? 'Importing...' : 'Upload & Process'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
