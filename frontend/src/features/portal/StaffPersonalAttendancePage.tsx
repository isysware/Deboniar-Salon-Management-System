import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import { AttendanceRecord, LeaveRecord, OvertimeRecord } from '../../types/salon';
import {
  Clock,
  Calendar,
  Timer,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { formatMinutesToTime, parseTimeToMinutes } from '../../lib/attendanceCalculations';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';

export const StaffPersonalAttendancePage: React.FC = () => {
  const { user } = useAuth();

  // Role guard: Staff only
  if (!user || user.role !== 'STAFF') {
    return <AccessDeniedView attemptedPath="/my-attendance" />;
  }

  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'LEAVES' | 'OVERTIME'>('ATTENDANCE');

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [overtimeStats, setOvertimeStats] = useState<{ approvedMinutes: number; approvedPay: number }>({
    approvedMinutes: 0,
    approvedPay: 0,
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchPersonalData = async () => {
      try {
        setLoading(true);
        const [attRes, otRes] = await Promise.all([
          salonService.getStaffPersonalAttendance(user || undefined),
          salonService.getStaffPersonalOvertime(user || undefined),
        ]);

        setAttendanceRecords(attRes.records);
        setLeaveRecords(attRes.leaves);
        setSummaryData(attRes.summary);

        setOvertimeRecords(otRes.records);
        setOvertimeStats({
          approvedMinutes: otRes.approvedMinutes,
          approvedPay: otRes.approvedPay,
        });
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load personal attendance and overtime records.');
      } finally {
        setLoading(false);
      }
    };

    fetchPersonalData();
  }, [user]);

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh] font-sans">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <div className="w-6 h-6 rounded-full border-2 border-blue-100 border-t-[#2254E1] animate-spin shrink-0" />
          <span>Loading your personal shift attendance & overtime profile...</span>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 max-w-6xl mx-auto font-sans">
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load staff profile</p>
            <p className="text-xs text-rose-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  const allowance = summaryData?.allowance;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans">
      {/* PERSONAL PROFILE HERO CARD */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white/5 -skew-x-12 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                Staff Personal Portal
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-blue-200">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                Read-Only Access
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1 tracking-tight">
              {summaryData?.staffName || user?.name}
            </h1>
            <p className="text-sm text-blue-200 mt-0.5">
              {summaryData?.roleTitle || 'Stylist'} • Shift:{' '}
              {summaryData?.startTime
                ? `${formatMinutesToTime(parseTimeToMinutes(summaryData.startTime))} - ${formatMinutesToTime(parseTimeToMinutes(summaryData.endTime))}`
                : '09:00 AM - 06:00 PM'}
              {summaryData?.isOvernightShift && ' (Overnight)'}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 text-xs">
            <div>
              <span className="text-blue-200 block text-[10px] uppercase font-semibold">Approved Overtime</span>
              <span className="text-xl font-bold text-white">{overtimeStats.approvedMinutes} mins</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <span className="text-blue-200 block text-[10px] uppercase font-semibold">Earned Overtime Pay</span>
              <span className="text-xl font-bold text-emerald-300">Rs. {overtimeStats.approvedPay.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'ATTENDANCE'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          My Shift Attendance ({attendanceRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('LEAVES')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'LEAVES'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          My Leave Entitlement & History ({leaveRecords.length})
        </button>

        <button
          onClick={() => setActiveTab('OVERTIME')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'OVERTIME'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Timer className="w-4 h-4" />
          My Approved Overtime ({overtimeRecords.length})
        </button>
      </div>

      {/* TAB CONTENT 1: ATTENDANCE RECORDS */}
      {activeTab === 'ATTENDANCE' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Daily Punch Record & Worked Hours</h3>
            <span className="text-xs text-slate-400">Chronological history</span>
          </div>

          <div className="overflow-x-auto">
            <table className="report-records w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Check-In</th>
                  <th className="py-3 px-3">Check-Out</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Punctuality Notes</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No shift punches recorded yet</p>
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.date}</td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-slate-900">{r.checkIn}</span>
                        {r.isLate && (
                          <span className="inline-block ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">
                            +{r.lateMinutes}m
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {r.checkOut ? (
                          <>
                            <span className="font-medium text-slate-900">{r.checkOut}</span>
                            {r.isEarlyExit && (
                              <span className="inline-block ml-1.5 text-[10px] font-semibold text-orange-700 bg-orange-50 px-1 rounded border border-orange-200">
                                -{r.earlyExitMinutes}m
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-purple-600 text-[11px] font-semibold">Missing check-out</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {r.workedHours > 0 ? `${r.workedHours.toFixed(2)} hrs` : '0.00 hrs'}
                      </td>
                      <td className="py-3 px-3">
                        {r.status === 'PRESENT' || r.status === 'COMPLETED' || r.status === 'ON_TIME' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Present
                          </span>
                        ) : r.status === 'PAID_LEAVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            Paid Leave
                          </span>
                        ) : r.status === 'UNPAID_LEAVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Unpaid Leave
                          </span>
                        ) : r.status === 'ABSENT' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            Missing Punch
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">{r.notes || '—'}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {r.source || 'MANUAL'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: LEAVES */}
      {activeTab === 'LEAVES' && (
        <div className="space-y-4">
          {/* Allowance Summary Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Leave Allowance & Usage Balance</h3>
            {allowance && allowance.isConfigured ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Policy Cycle</span>
                  <p className="text-sm font-bold text-slate-800 mt-1">{allowance.period}</p>
                </div>
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <span className="text-[10px] font-semibold text-blue-600 uppercase">Total Allowed</span>
                  <p className="text-xl font-bold text-blue-900 mt-1">{allowance.allowedDays} days</p>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                  <span className="text-[10px] font-semibold text-amber-600 uppercase">Consumed</span>
                  <p className="text-xl font-bold text-amber-800 mt-1">{allowance.usedDays} days</p>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase">Remaining</span>
                  <p className="text-xl font-bold text-emerald-800 mt-1">{allowance.remainingDays} days</p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
                Paid leave allowance is <strong>Not configured</strong> on your employee profile.
                Any approved leaves will be treated as unpaid leave.
              </div>
            )}
          </div>

          {/* Leaves Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Approved Leave History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="report-records w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Leave Voucher #</th>
                    <th className="py-3 px-3">Date Range</th>
                    <th className="py-3 px-3">Working Days</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {leaveRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No leaves logged</p>
                      </td>
                    </tr>
                  ) : (
                    leaveRecords.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-700">{l.leaveNumber}</td>
                        <td className="py-3 px-3 font-medium">
                          {l.startDate} to {l.endDate}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{l.totalDays} days</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              l.type === 'PAID'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {l.type === 'PAID' ? 'Paid Leave' : 'Unpaid Leave'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              l.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{l.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: OVERTIME */}
      {activeTab === 'OVERTIME' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-0.5">
              <p className="font-semibold">Overtime Payout Verification Policy</p>
              <p className="text-blue-700 leading-relaxed">
                Only manually submitted overtime entries that have been officially <strong>Approved</strong> by the
                Branch Admin or Super Admin are counted towards your monthly payout. Pending entries are shown for
                audit visibility and do not inflate approved earnings.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Personal Overtime Vouchers</h3>
              <div className="text-xs font-semibold text-slate-700">
                Total Verified Pay:{' '}
                <span className="text-emerald-700 font-bold">
                  Rs. {overtimeStats.approvedPay.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="report-records w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Voucher #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Minutes</th>
                    <th className="py-3 px-3">Rate</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Payable Amount</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {overtimeRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Timer className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No overtime entries recorded</p>
                      </td>
                    </tr>
                  ) : (
                    overtimeRecords.map((ot) => (
                      <tr key={ot.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                          {ot.overtimeNumber || ot.id}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">{ot.date}</td>
                        <td className="py-3 px-3 font-medium">
                          {ot.status === 'APPROVED' ? ot.approvedMinutes : ot.minutes} mins (
                          {(((ot.status === 'APPROVED' ? ot.approvedMinutes : ot.minutes) || 0) / 60).toFixed(1)}h)
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                          Rs. {(ot.hourlyRate ?? 0).toLocaleString()}/hr
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {ot.status === 'APPROVED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved
                            </span>
                          ) : ot.status === 'SUBMITTED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Submitted (Pending)
                            </span>
                          ) : ot.status === 'REJECTED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {ot.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {ot.status === 'APPROVED' ? (
                            <span className="font-bold text-emerald-700">
                              Rs. {(ot.amount || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              Rs. {(ot.amount || 0).toLocaleString()} (Unapproved)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{ot.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
