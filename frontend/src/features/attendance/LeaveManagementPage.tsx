import { BranchActionField } from '@/components/BranchActionField';
import { useBranchAction } from '@/hooks/useBranchAction';
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import { LeaveRecord, StaffMember, BranchHoliday } from '../../types/salon';
import { evaluateLeaveAllowance } from '../../lib/attendanceCalculations';
import { toast } from '../../context/ToastContext';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';

const loadLeaveAction = async (branchId: string) => {
  const [staff, leaves, holidays] = await Promise.all([salonService.getStaff(branchId), salonService.getLeaves(branchId), salonService.getBranchHolidays(branchId)]);
  return { staff, leaves, holidays };
};

export const LeaveManagementPage: React.FC = () => {
  const { user } = useAuth();
  if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return <AccessDeniedView attemptedPath="/operations/leaves" />;
  return <LeaveManagementContent />;
};

const LeaveManagementContent: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();
  const initialDate = demoDate || new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [leavesList, setLeavesList] = useState<LeaveRecord[]>([]);
  const [holidaysList, setHolidaysList] = useState<BranchHoliday[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranchId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.slice(0, 7));
  const [viewMode, setViewMode] = useState<'DAY' | 'MONTH'>('MONTH');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const actionScope = useBranchAction(showLeaveModal, loadLeaveAction);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const effectiveBranchId = user?.role === 'SUPER_ADMIN' ? selectedBranchId : (user?.branchId || activeBranchId);
  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [staff, leaves, holidays] = await Promise.all([
        salonService.getStaff(effectiveBranchId),
        salonService.getLeaves(effectiveBranchId, undefined, user || undefined),
        salonService.getBranchHolidays(effectiveBranchId),
      ]);
      setStaffList(staff); setLeavesList(leaves); setHolidaysList(holidays);
    } catch (error: any) { setLoadError(error.message || 'Failed to load leaves.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, [effectiveBranchId]);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL');
  const [leaveToCancel, setLeaveToCancel] = useState<LeaveRecord | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellingLeave, setCancellingLeave] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    staffId: '',
    startDate: selectedDate,
    endDate: selectedDate,
    type: 'PAID' as 'PAID' | 'UNPAID',
    reason: '',
  });

  const filteredLeaves = useMemo(() => {
    const from = viewMode === 'DAY' ? selectedDate : `${selectedMonth}-01`;
    const to = viewMode === 'DAY' ? selectedDate : `${selectedMonth}-31`;
    return leavesList.filter((leave) => {
      const staff = staffList.find((s) => s.id === leave.staffId);
      if (leave.startDate > to || leave.endDate < from) return false;
      if (staffFilter !== 'ALL' && leave.staffId !== staffFilter) return false;
      if (designationFilter !== 'ALL' && (staff?.designation || staff?.roleTitle) !== designationFilter) return false;
      if (leaveTypeFilter !== 'ALL' && leave.type !== leaveTypeFilter) return false;
      if (leaveStatusFilter !== 'ALL' && leave.status !== leaveStatusFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      return !q || [leave.staffName, leave.employeeCode, staff?.employeeCode].some((value) => value?.toLowerCase().includes(q));
    }).sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [leavesList, staffList, viewMode, selectedDate, selectedMonth, staffFilter, designationFilter, leaveTypeFilter, leaveStatusFilter, searchQuery]);

  const handleCancelLeave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leaveToCancel || !cancellationReason.trim() || cancellingLeave) return;
    setCancellingLeave(true);
    try {
      await salonService.cancelLeave(leaveToCancel.id, cancellationReason.trim(), user || undefined);
      setLeaveToCancel(null);
      setCancellationReason('');
      toast.success('Leave cancelled and attendance updated.');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel leave.');
    } finally {
      setCancellingLeave(false);
    }
  };

  // Handle Mark Leave
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionScope.validate()) return;
    if (saving) return;
    const selectedStaff = actionScope.data?.staff.find((s) => s.id === leaveForm.staffId);
    if (!selectedStaff) {
      toast.error('Please select an employee.');
      return;
    }
    if (leaveForm.endDate < leaveForm.startDate || !leaveForm.reason.trim()) { toast.error('Enter a valid date range and leave reason.'); return; }
    setSaving(true);
    try {
      const bId = selectedStaff.branchId;
      const res = await salonService.markLeave(
        {
          branchId: bId,
          staffId: leaveForm.staffId,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          type: leaveForm.type,
          reason: leaveForm.reason,
        },
        user || undefined
      );

      toast.success(`Leave ${res.leaveNumber} marked for ${res.staffName} (${res.totalDays} working days).`);
      setShowLeaveModal(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark leave.');
    } finally { setSaving(false); }
  };

  const leaveStaffPreview = useMemo(() => {
    if (!leaveForm.staffId) return null;
    const staff = actionScope.data?.staff.find((s) => s.id === leaveForm.staffId);
    if (!staff) return null;
    return evaluateLeaveAllowance(staff, actionScope.data?.leaves || [], leaveForm.startDate, actionScope.data?.holidays || []);
  }, [leaveForm.staffId, leaveForm.startDate, actionScope.data]);


  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Leave Management</h1><p className="text-sm text-slate-500 mt-1">Manage employee leave, entitlement and leave history.</p></div>
    {loadError && <div role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl">{loadError}<button onClick={loadData} className="ml-3 underline">Retry</button></div>}
    {/* Filter Card */}
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-end">
        {user?.role === 'SUPER_ADMIN' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch</label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setStaffFilter('ALL');
                setDesignationFilter('ALL');
              }}
              className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#2254E1] focus:border-[#2254E1] transition-colors cursor-pointer"
            >
              <option value="ALL">All branches</option>
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'DAY' | 'MONTH')}
            className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#2254E1] focus:border-[#2254E1] transition-colors cursor-pointer"
          >
            <option value="MONTH">Month</option>
            <option value="DAY">Day</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            {viewMode === 'DAY' ? 'Date' : 'Month'}
          </label>
          <input
            type={viewMode === 'DAY' ? 'date' : 'month'}
            value={viewMode === 'DAY' ? selectedDate : selectedMonth}
            onChange={(e) =>
              viewMode === 'DAY' ? setSelectedDate(e.target.value) : setSelectedMonth(e.target.value)
            }
            className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#2254E1] focus:border-[#2254E1] transition-colors cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Employee</label>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#2254E1] focus:border-[#2254E1] transition-colors cursor-pointer"
          >
            <option value="ALL">All employees</option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name} ({staff.employeeCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Designation</label>
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#2254E1] focus:border-[#2254E1] transition-colors cursor-pointer"
          >
            <option value="ALL">All designations</option>
            {Array.from(
              new Set(staffList.map((staff) => staff.designation || staff.roleTitle).filter(Boolean))
            ).map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search</label>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Employee name or code..."
            className="w-full h-9 text-xs border border-slate-300 rounded-lg px-3 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-[#2254E1] focus:border-[#2254E1] transition-colors"
          />
        </div>
      </div>
    </div>

    <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Leave vouchers register</h2>
          <p className="text-xs text-slate-500 mt-1">
            {filteredLeaves.length} vouchers overlapping the selected period. Date, branch, employee, designation and search filters apply.
          </p>
        </div>
        <button
          onClick={() => {
            setLeaveForm({
              staffId: staffFilter === 'ALL' ? '' : staffFilter,
              startDate: selectedDate,
              endDate: selectedDate,
              type: 'PAID',
              reason: '',
            });
            setShowLeaveModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2254E1] text-white text-xs font-semibold hover:bg-[#1B3FC5] cursor-pointer shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          Add Leave
        </button>
      </div>

      <div className="p-3.5 flex flex-wrap items-center gap-3 bg-slate-50/70 border-b border-slate-200/60">
        <label className="text-xs font-medium text-slate-600 flex items-center">
          Leave type
          <select
            value={leaveTypeFilter}
            onChange={(e) => setLeaveTypeFilter(e.target.value)}
            className="ml-2 border border-slate-300 rounded-lg bg-white px-2.5 py-1 text-xs text-slate-700 cursor-pointer"
          >
            <option value="ALL">All types</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 flex items-center">
          Leave status
          <select
            value={leaveStatusFilter}
            onChange={(e) => setLeaveStatusFilter(e.target.value)}
            className="ml-2 border border-slate-300 rounded-lg bg-white px-2.5 py-1 text-xs text-slate-700 cursor-pointer"
          >
            <option value="ALL">All statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <button
          onClick={() => {
            setStaffFilter('ALL');
            setDesignationFilter('ALL');
            setSearchQuery('');
            setLeaveTypeFilter('ALL');
            setLeaveStatusFilter('ALL');
          }}
          className="text-xs font-semibold text-[#2254E1] hover:underline cursor-pointer ml-auto"
        >
          Reset record filters
        </button>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="report-records w-full min-w-[1050px] text-left text-xs border-collapse whitespace-nowrap">
          <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 uppercase text-[11px] tracking-wider font-semibold">
            <tr>
              {['Employee / Voucher', 'Branch', 'Leave period', 'Working days', 'Type', 'Status', 'Reason / Audit', 'Action'].map(
                (title) => (
                  <th key={title} className="px-4 py-3 whitespace-nowrap">
                    {title}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-100 border-t-[#2254E1] animate-spin mx-auto mb-2" />
                  Loading leaves...
                </td>
              </tr>
            ) : filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  No leaves match your filters. Choose another day or month, or add a leave.
                </td>
              </tr>
            ) : (
              filteredLeaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-semibold text-slate-900">{leave.staffName}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {leave.employeeCode || staffList.find((s) => s.id === leave.staffId)?.employeeCode}
                    </p>
                    <p className="font-mono text-[#2254E1] text-[11px] mt-0.5">{leave.leaveNumber}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                    {allBranches.find((b) => b.id === leave.branchId)?.name || leave.branchId}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">
                    {leave.startDate} to {leave.endDate}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{leave.totalDays}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs font-medium text-slate-700">
                      {leave.type === 'PAID' ? 'Paid Leave' : 'Unpaid Leave'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        leave.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {leave.status === 'APPROVED' ? 'Approved' : 'Cancelled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-48 max-w-xs whitespace-normal break-words">
                    <p className="text-slate-800">{leave.reason}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Recorded by {leave.createdByName}</p>
                    {leave.status === 'CANCELLED' && (
                      <p className="text-rose-600 text-[10px] mt-0.5">
                        {leave.cancellationReason} · {leave.cancelledByName}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {leave.status === 'APPROVED' && (
                      <button
                        onClick={() => {
                          setCancellationReason('');
                          setLeaveToCancel(leave);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>

      {leaveToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleCancelLeave} role="dialog" aria-modal="true" aria-labelledby="cancel-leave-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 id="cancel-leave-title" className="text-lg font-bold text-slate-900">Cancel leave</h2>
            <p className="text-sm text-slate-500">{leaveToCancel.staffName} · {leaveToCancel.leaveNumber}<br />{leaveToCancel.startDate} to {leaveToCancel.endDate}</p>
            <label className="block text-sm font-medium text-slate-700">Cancellation reason<textarea required value={cancellationReason} onChange={(e) => setCancellationReason(e.target.value)} rows={3} className="block w-full border border-slate-300 rounded-lg p-3 mt-2" /></label>
            <div className="flex justify-end gap-2"><button type="button" disabled={cancellingLeave} onClick={() => setLeaveToCancel(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm">Keep leave</button><button disabled={cancellingLeave || !cancellationReason.trim()} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold disabled:opacity-50">{cancellingLeave ? 'Cancelling...' : 'Cancel leave'}</button></div>
          </form>
        </div>
      )}

      {/* MODAL 3: MARK LEAVE */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Mark Staff Leave</h3>
                <p className="text-xs text-slate-500 mt-0.5">Approve paid or unpaid absence with allowance preview</p>
              </div>
              <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="p-5 space-y-4">
              <BranchActionField value={actionScope.branchId} onChange={(id) => { actionScope.setBranchId(id); setLeaveForm((prev) => ({ ...prev, staffId: '' })); }} />
              {actionScope.error && <p role="alert" className="text-xs text-rose-600">{actionScope.error}</p>}
              <fieldset disabled={!actionScope.ready} className="space-y-4 disabled:opacity-50">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Employee *</label>
                <select
                  required
                  value={leaveForm.staffId}
                  onChange={(e) => setLeaveForm({ ...leaveForm, staffId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {(actionScope.data?.staff || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Allowance preview badge */}
              {leaveStaffPreview && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center justify-between">
                    <span>Leave Entitlement Preview:</span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {leaveStaffPreview.period} Policy
                    </span>
                  </div>
                  {leaveStaffPreview.isConfigured ? (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <span className="text-slate-400 text-[10px]">Allowed:</span>
                        <div className="font-bold text-slate-900">{leaveStaffPreview.allowedDays} days</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Used:</span>
                        <div className="font-bold text-amber-600">{leaveStaffPreview.usedDays} days</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">Remaining:</span>
                        <div className="font-bold text-emerald-600">{leaveStaffPreview.remainingDays} days</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-amber-800 font-medium text-xs">
                      Paid leave allowance: <strong>Not configured</strong> (Must use unpaid leave or configure staff profile first).
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-medium ${
                      leaveForm.type === 'PAID'
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="leaveType"
                      value="PAID"
                      checked={leaveForm.type === 'PAID'}
                      onChange={() => setLeaveForm({ ...leaveForm, type: 'PAID' })}
                      className="text-blue-600"
                    />
                    <span>Paid Leave (Counted)</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-medium ${
                      leaveForm.type === 'UNPAID'
                        ? 'bg-slate-100 border-slate-400 text-slate-900 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="leaveType"
                      value="UNPAID"
                      checked={leaveForm.type === 'UNPAID'}
                      onChange={() => setLeaveForm({ ...leaveForm, type: 'UNPAID' })}
                      className="text-slate-600"
                    />
                    <span>Unpaid Leave (No Pay)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Medical emergency, vacation, personal reason..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#2254E1] hover:bg-blue-700 shadow-xs"
                >
                  {saving ? 'Saving...' : 'Confirm Leave'}
                </button>
              </div>
            
              </fieldset>
</form>
          </div>
        </div>
      )}


  </div>;
};
