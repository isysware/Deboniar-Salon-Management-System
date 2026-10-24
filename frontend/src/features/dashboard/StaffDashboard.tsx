import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService, StaffDashboardData } from '../../services';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScissorLoader } from '@/components/ui/ScissorLoader';
import {
  Scissors,
  Banknote,
  Coins,
  TrendingUp,
  Clock,
  CheckCircle2,
  RefreshCw,
  Building2,
  Lock,
  Wallet,
  Award,
} from 'lucide-react';

export const StaffDashboard: React.FC = () => {
  const { user, demoDate } = useAuth();
  const { navigate } = useRouter();
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (!user.staffId) {
        throw new Error('No employee profile is linked to this user account. Please contact your Salon Administrator.');
      }
      if (!user.branchId || user.branchId === 'ALL') {
        throw new Error('Staff accounts must belong to a specific branch. Mismatched branch scope detected.');
      }
      const res = await salonService.getStaffDashboardData(user.staffId, user.branchId);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load Staff dashboard:', err);
      setErrorMessage(err.message || 'Failed to load personal staff performance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, demoDate]);

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center font-sans">
        <ScissorLoader size="lg" />
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-4">
        <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-600" />
            <h3 className="font-semibold text-sm">Staff Portal Scope Error</h3>
          </div>
          <p className="text-xs leading-relaxed text-rose-700">
            {errorMessage || 'Unable to load staff portal. Invalid profile or branch scope.'}
          </p>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Personal Isolation Scope */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Welcome, {data.staffMember.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {data.staffMember.roleTitle} · Personal Performance, Attendance & Earnings for {data.branch.name}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadData}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Strict Privacy Notice */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Personal Read-Only Scope:</strong> Displays your individual service production, attendance punches, commissions, and direct tips.
          </span>
        </div>
        <span className="text-xs font-medium text-[#2254E1] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
          Commission Tier: {(data.staffMember.commissionRate * 100).toFixed(0)}%
        </span>
      </div>

      {/* PERSONAL PERFORMANCE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Services This Month"
          value={formatNumber(data.monthlyServicesCompletedCount)}
          subtitle="Completed client treatments"
          icon={<Scissors className="w-4 h-4" />}
          tone="primary"
        />
        <StatCard
          title="Service Sales Production"
          value={formatCurrency(data.monthlyServiceSalesTotal)}
          subtitle="Gross service value created"
          icon={<Banknote className="w-4 h-4" />}
          tone="purple"
        />
        <StatCard
          title="Earned Commission"
          value={formatCurrency(data.earnedCommissionTotal)}
          subtitle={`At ${(data.staffMember.commissionRate * 100).toFixed(0)}% service contract rate`}
          icon={<TrendingUp className="w-4 h-4" />}
          tone="success"
          trendText="+Earned"
          trendDirection="up"
        />
        <StatCard
          title="Direct Tips Received"
          value={formatCurrency(data.personalTipsTotal)}
          subtitle="100% direct personal gratuity"
          icon={<Coins className="w-4 h-4" />}
          tone="warning"
          trendText="Segregated"
        />
      </div>

      {/* TWO COLUMNS: Monthly Earnings Breakdown & Shift Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Monthly Earnings Breakdown */}
        <Card padding="md" className="space-y-4">
          <CardHeader
            title="Monthly Compensation & Payout Breakdown"
            subtitle="Base salary, service commission, direct tips and approved overtime"
            action={
              <Badge variant="primary">
                Contract Tier Verified
              </Badge>
            }
          />

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Monthly Base Salary</span>
                <span className="font-semibold text-slate-900 tabular-nums text-sm">
                  {formatCurrency(data.monthlyEarningsSummary.baseSalary)}
                </span>
              </div>
              <span className="text-slate-500 font-medium">Contract Fixed</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Service Commission ({(data.staffMember.commissionRate * 100).toFixed(0)}%)</span>
                <span className="font-semibold text-emerald-700 tabular-nums text-sm">
                  +{formatCurrency(data.monthlyEarningsSummary.earnedCommission)}
                </span>
              </div>
              <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Performance Pay
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Direct Client Tips (Segregated)</span>
                <span className="font-semibold text-purple-700 tabular-nums text-sm">
                  +{formatCurrency(data.monthlyEarningsSummary.directTips)}
                </span>
              </div>
              <span className="text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                100% Personal
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">
                  Approved Overtime Pay ({formatCurrency(data.staffMember.overtimeHourlyRate)}/hr)
                </span>
                <span className="font-semibold text-amber-800 tabular-nums text-sm">
                  +{formatCurrency(data.monthlyEarningsSummary.approvedOvertimePay)}
                </span>
              </div>
              <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Admin Approved
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-col gap-1.5 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#2254E1] font-semibold block uppercase tracking-wider">
                    Estimated Combined Monthly Earnings
                  </span>
                  <span className="text-lg font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(data.monthlyEarningsSummary.estimatedGrossPayout)}
                  </span>
                </div>
                <Award className="w-6 h-6 text-[#2254E1]" />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Informational summary. Base salary, tiered commissions, direct client gratuities, and overtime are separate line items with distinct payout schedules.
              </p>
            </div>
          </div>
        </Card>

        {/* Shift Attendance & Punches Card */}
        <Card padding="md" className="space-y-4">
          <CardHeader
            title="My Shift & Attendance Record"
            subtitle="Biometric punch log and approved overtime minutes"
            action={
              data.attendanceSummary.status === 'Not recorded' ? (
                <Badge variant="neutral">Not Recorded</Badge>
              ) : (
                <Badge variant="success" dot>
                  Punch Verified
                </Badge>
              )
            }
          />

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Today's Clock In</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {data.attendanceSummary.todayCheckIn}
                </span>
              </div>
              {data.attendanceSummary.status === 'ON_TIME' ? (
                <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  On Time
                </span>
              ) : data.attendanceSummary.status === 'LATE' ? (
                <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Late
                </span>
              ) : (
                <span className="text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Not recorded
                </span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Weekly Scheduled Hours</span>
                <span className="font-semibold text-slate-900 tabular-nums text-sm">
                  {data.attendanceSummary.scheduledHoursWeek} hrs
                </span>
              </div>
              <span className="text-slate-500 font-medium">Standard 6-day week</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Worked Hours So Far</span>
                <span className="font-semibold text-slate-900 tabular-nums text-sm">
                  {data.attendanceSummary.workedHoursWeek} hrs
                </span>
              </div>
              <span className="text-slate-500">
                {data.attendanceSummary.workedHoursWeek > 0 ? 'In Progress' : 'No punches logged'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-amber-800 block font-medium">Approved Overtime</span>
                <span className="font-semibold text-amber-900 tabular-nums text-sm">
                  {data.attendanceSummary.approvedOvertimeMinutesMonth} minutes
                </span>
              </div>
              <span className="text-xs text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-300 font-medium">
                Rate: {formatCurrency(data.staffMember.overtimeHourlyRate)}/hr
              </span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need to view full punch history or request leave?</span>
            <button
              onClick={() => navigate('/my-attendance')}
              className="font-medium text-[#2254E1] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>View My Attendance</span>
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-400 italic leading-relaxed pt-1">
            Biometric punches verify daily arrival. Per salon operating regulations, overtime minutes are approved strictly by the Branch General Manager using the configured hourly rate.
          </p>
        </Card>
      </div>

      {/* MY RECENT COMPLETED SERVICES & COMMISSION ARCHIVE */}
      <Card padding="none">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Personal Service & Commission Archive</h3>
            <p className="text-xs text-slate-500">Itemized log of completed client treatments, commissions, and tips</p>
          </div>
          <Badge variant="neutral">Recent Services</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="report-records w-full text-xs text-left">
            <thead className="bg-slate-50/75 text-slate-600 font-medium border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-4">Service Performed</th>
                <th className="py-3 px-4">Client Name</th>
                <th className="py-3 px-4 text-right">Service Price</th>
                <th className="py-3 px-4 text-right">Commission ({(data.staffMember.commissionRate * 100).toFixed(0)}%)</th>
                <th className="py-3 px-5 text-right">Tip Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentCompletedServices.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-5 text-slate-500">{row.date}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{row.serviceName}</td>
                  <td className="py-3 px-4 text-slate-700">{row.clientName}</td>
                  <td className="py-3 px-4 text-right font-medium text-slate-900 tabular-nums">
                    {formatCurrency(row.servicePrice)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-700 tabular-nums">
                    +{formatCurrency(row.commissionEarned)}
                  </td>
                  <td className="py-3 px-5 text-right font-semibold text-purple-700 tabular-nums">
                    {row.tipReceived > 0 ? `+${formatCurrency(row.tipReceived)}` : 'PKR 0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
