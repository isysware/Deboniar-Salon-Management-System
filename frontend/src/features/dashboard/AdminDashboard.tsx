import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService, AdminDashboardData } from '../../services';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BranchOperationalSections } from './components/BranchOperationalSections';
import { ScissorLoader } from '@/components/ui/ScissorLoader';
import {
  Building2,
  Lock,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, demoDate } = useAuth();
  const { navigate } = useRouter();

  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userBranchRef = useRef(user?.branchId);
  userBranchRef.current = user?.branchId;

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const branchId = user.branchId || '';
      const res = await salonService.getAdminDashboardData(branchId);
      if (userBranchRef.current === user.branchId) {
        setData(res);
      }
    } catch (err: any) {
      if (userBranchRef.current === user.branchId) {
        setError(err.message || 'Unauthorized branch context.');
      }
    } finally {
      if (userBranchRef.current === user.branchId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [user, demoDate]);

  if (isLoading && !data) {
    return (
      <div className="py-32 flex items-center justify-center font-sans">
        <ScissorLoader size="lg" />
      </div>
    );
  }

  // Directive 8: Invalid or unauthorized branch context must produce an explicit error/access-denied state
  if (error) {
    return (
      <div className="py-12 flex items-center justify-center">
        <Card padding="lg" className="max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Branch Access Restriction</h2>
            <p className="text-xs text-slate-600 mt-1">{error}</p>
          </div>
          <Button variant="primary" size="sm" onClick={loadData}>
            Retry Verification
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Title & Branch Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {data.branch.name} Operations Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time branch sales, staff queues, appointments and daily cash settlement.
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
          <Button
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => navigate('/pos')}
          >
            Open POS Terminal
          </Button>
        </div>
      </div>

      {/* Shared Branch Operational Metrics & Drawers */}
      <BranchOperationalSections
        metrics={data.metrics}
        onlineAccounts={data.onlineAccounts}
        todayAppointments={data.todayAppointments}
        recentInvoices={data.recentInvoices}
        cashDrawers={data.cashDrawers}
        totalClientsCount={data.totalClientsCount}
        totalServicesCount={data.totalServicesCount}
        totalAppointmentsCount={data.totalAppointmentsCount}
        staffList={data.staffList}
        revenueTrend={data.revenueTrend}
        categoryBreakdown={data.categoryBreakdown}
        onNavigateAppointments={() => navigate('/operations/appointments')}
        onNavigateInvoices={() => navigate('/reports/sales-invoices')}
        onNavigateAccounts={() => navigate('/reports/debit-credit')}
        onNavigateSettlement={() => navigate('/accounts/account-settlement')}
      />

      {/* Staff Attendance Summary for Branch Admin */}
      <Card padding="md">
        <CardHeader
          title="Staff Active On Duty Today"
          subtitle={`${data.staffAttendanceSummary.presentCount} of ${data.staffAttendanceSummary.totalCount} stylists verified on duty in ${data.branch.name}`}
          action={
            <div className="flex items-center gap-2">
              <Badge variant="success" dot>
                Punch Log Active
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/operations/attendance')}
              >
                Manage Attendance
              </Button>
            </div>
          }
        />

        {data.staffAttendanceSummary.onDutyStaffNames.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No staff members checked in or active on duty today yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.staffAttendanceSummary.onDutyStaffNames.map((name, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200/80 bg-slate-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2254E1] flex items-center justify-center text-xs font-semibold">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{name}</p>
                    <p className="text-[11px] text-slate-400">Shift verified on duty</p>
                  </div>
                </div>

                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Checked In
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Need to record approved manual overtime?</span>
          <button
            onClick={() => navigate('/operations/manual-overtime')}
            className="font-medium text-[#2254E1] hover:underline cursor-pointer"
          >
            Manual Overtime Entry
          </button>
        </div>
      </Card>
    </div>
  );
};

