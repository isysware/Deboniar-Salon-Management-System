import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService } from '../../services';
import { AttendancePolicyConfig, Branch } from '../../types/salon';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';
import { toast } from '../../context/ToastContext';
import {
  Clock,
  ClockAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sliders,
  Sparkles,
  Info,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

const THRESHOLD_PRESETS = [
  { value: 30, label: '30 Mins (Half Hour)' },
  { value: 45, label: '45 Mins' },
  { value: 60, label: '60 Mins (1 Hour - Recommended)' },
  { value: 90, label: '90 Mins (1.5 Hours)' },
  { value: 120, label: '120 Mins (2 Hours)' },
];

export const AttendanceSettingsPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();
  const { navigate } = useRouter();

  // Role guard: Only Super Admin and Admin
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/admin/attendance-settings" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Branch Selection
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (isSuperAdmin) {
      return activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '';
    }
    return user.branchId || '';
  });

  const effectiveBranchId = isSuperAdmin ? selectedBranchId : (user.branchId || activeBranchId);
  const currentBranch = allBranches.find((b) => b.id === effectiveBranchId) || allBranches[0];

  // Loading & Saving states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Policy Form State
  const [autoMarkAbsentEnabled, setAutoMarkAbsentEnabled] = useState<boolean>(true);
  const [thresholdMinutes, setThresholdMinutes] = useState<number>(60);
  const [defaultStartTime, setDefaultStartTime] = useState<string>('09:00');
  const [defaultEndTime, setDefaultEndTime] = useState<string>('18:00');
  const [lateGraceMinutes, setLateGraceMinutes] = useState<number>(15);
  const [earlyGraceMinutes, setEarlyGraceMinutes] = useState<number>(15);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Load Policy
  const loadPolicy = async (bId: string) => {
    if (!bId) return;
    try {
      setIsLoading(true);
      const policy = await salonService.getAttendancePolicy(bId);
      setAutoMarkAbsentEnabled(policy.autoMarkAbsentEnabled ?? true);
      setThresholdMinutes(policy.autoAbsentThresholdMinutes ?? 60);
      setDefaultStartTime(policy.defaultStartTime || '09:00');
      setDefaultEndTime(policy.defaultEndTime || '18:00');
      setLateGraceMinutes(policy.lateGraceMinutes ?? 15);
      setEarlyGraceMinutes(policy.earlyGraceMinutes ?? 15);
      setLastUpdated(policy.updatedAt || null);
    } catch (err: any) {
      console.error('Failed to load attendance policy:', err);
      toast.error(err.message || 'Failed to load attendance policy.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveBranchId) {
      loadPolicy(effectiveBranchId);
    }
  }, [effectiveBranchId]);

  // Save Policy
  const handleSavePolicy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!effectiveBranchId) return;

    try {
      setIsSaving(true);
      const payload: Partial<AttendancePolicyConfig> = {
        branchId: effectiveBranchId,
        autoMarkAbsentEnabled,
        autoAbsentThresholdMinutes: Number(thresholdMinutes) || 60,
        defaultStartTime,
        defaultEndTime,
        lateGraceMinutes: Number(lateGraceMinutes) || 15,
        earlyGraceMinutes: Number(earlyGraceMinutes) || 15,
      };

      const res = await salonService.updateAttendancePolicy(effectiveBranchId, payload, user);
      toast.success('Attendance and shift settings saved successfully!');
      setLastUpdated(res.updatedAt || new Date().toISOString());
    } catch (err: any) {
      console.error('Failed to update attendance policy:', err);
      toast.error(err.message || 'Failed to save attendance policy.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate cutoff preview time
  const calculatedCutoffTime = useMemo(() => {
    const [hStr, mStr] = defaultStartTime.split(':');
    const startMins = (parseInt(hStr, 10) || 9) * 60 + (parseInt(mStr, 10) || 0);
    const cutoffMins = startMins + (Number(thresholdMinutes) || 60);
    const cutH = Math.floor(cutoffMins / 60) % 24;
    const cutM = cutoffMins % 60;
    const period = cutH >= 12 ? 'PM' : 'AM';
    const displayH = cutH % 12 === 0 ? 12 : cutH % 12;
    return `${String(displayH).padStart(2, '0')}:${String(cutM).padStart(2, '0')} ${period}`;
  }, [defaultStartTime, thresholdMinutes]);

  const displayStartFormatted = useMemo(() => {
    const [hStr, mStr] = defaultStartTime.split(':');
    const h = parseInt(hStr, 10) || 9;
    const m = parseInt(mStr, 10) || 0;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  }, [defaultStartTime]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-[#0047AB] rounded-xl border border-blue-100">
              <ClockAlert className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Attendance Settings</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure shift start cutoffs, auto-marking absent thresholds, and grace periods for staff attendance.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && allBranches.length > 1 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/operations/attendance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
            Daily Attendance Sheet
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/branch-settings')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            Branch Settings
          </button>
        </div>
      </div>

      {/* Overview Information Box */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white p-5 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 text-xs">
          <h3 className="font-bold text-slate-900 text-sm">
            Auto-Mark Absent Rule (By-Default Absent on Lateness)
          </h3>
          <p className="text-slate-600 leading-relaxed">
            Agar koi staff member apni shift start time ke baad tay shuda threshold (e.g. 1 ghante) tak check-in na kare,
            toh system by-default uski attendance <strong>'ABSENT'</strong> mark kar dega.
          </p>
          <p className="text-slate-500 italic">
            * Note: Admin baad mein attendance sheet par kisi bhi waqt manual check-in time ya status tabdeel kar sakta hai.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200/80 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading attendance policy...</p>
        </div>
      ) : (
        <form onSubmit={handleSavePolicy} className="space-y-6">
          {/* Card 1: Auto-Mark Absent Rule */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="space-y-0.5">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Shift Cutoff & Auto-Absent Setting</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                      autoMarkAbsentEnabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {autoMarkAbsentEnabled ? 'Rule Active' : 'Rule Inactive'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Automatically mark staff as Absent if they do not punch in within threshold minutes after shift start.
                </p>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoMarkAbsentEnabled}
                  onChange={(e) => setAutoMarkAbsentEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0047AB]" />
                <span className="ml-3 text-xs font-semibold text-slate-700">
                  {autoMarkAbsentEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            {/* Threshold Selector */}
            <div className={`space-y-4 transition-opacity ${autoMarkAbsentEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Grace / Cutoff Threshold Before Auto-Absent <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {THRESHOLD_PRESETS.map((p) => {
                    const isSelected = thresholdMinutes === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setThresholdMinutes(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#0047AB] text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 max-w-xs">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={10}
                      max={360}
                      value={thresholdMinutes}
                      onChange={(e) => setThresholdMinutes(Math.max(10, parseInt(e.target.value, 10) || 60))}
                      className="w-full text-xs pr-16 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-400 font-medium">
                      Minutes
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">
                    ({(thresholdMinutes / 60).toFixed(1)} hrs)
                  </span>
                </div>
              </div>

              {/* Dynamic Live Demonstration Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Info className="w-4 h-4 text-[#0047AB]" />
                  <span>Rule in Action (Example Preview):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-400 block">Shift Start Time:</span>
                    <span className="font-bold text-slate-800 text-sm">{displayStartFormatted}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-400 block">Threshold:</span>
                    <span className="font-bold text-blue-700 text-sm">+{thresholdMinutes} Minutes</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-400 block">Auto-Absent Cutoff:</span>
                    <span className="font-bold text-rose-700 text-sm">{calculatedCutoffTime}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  Agar staff <strong>{calculatedCutoffTime}</strong> tak check-in nahi karta, toh attendance sheet par uska status automatically <strong>'ABSENT'</strong> select ho jayega.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Shift Default Timings & Lateness Grace */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              Shift Timings & Grace Periods (Branch Standards)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              {/* Default Start */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Default Shift Start
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={defaultStartTime}
                    onChange={(e) => setDefaultStartTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Standard shift start time</span>
              </div>

              {/* Default End */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Default Shift End
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={defaultEndTime}
                    onChange={(e) => setDefaultEndTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Standard shift end time</span>
              </div>

              {/* Late Grace */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Late In Grace Time
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full text-xs pr-12 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-400 font-medium">
                    Mins
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Grace before marking Late</span>
              </div>

              {/* Early Grace */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Early Exit Grace Time
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={earlyGraceMinutes}
                    onChange={(e) => setEarlyGraceMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full text-xs pr-12 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-400 font-medium">
                    Mins
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Grace before marking Early Exit</span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-400">
              {lastUpdated ? (
                <span>Last updated on: {new Date(lastUpdated).toLocaleString()}</span>
              ) : (
                <span>Ready to apply across {currentBranch?.name || 'current branch'}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => loadPolicy(effectiveBranchId)}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Form
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0047AB] hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Attendance Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
