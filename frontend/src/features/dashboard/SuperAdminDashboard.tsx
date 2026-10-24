import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { salonService, SuperAdminDashboardData } from '../../services';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BranchOperationalSections } from './components/BranchOperationalSections';
import { ScissorLoader } from '@/components/ui/ScissorLoader';
import {
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const { activeBranchId, switchBranch, demoDate } = useAuth();
  const { navigate } = useRouter();

  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Prevent race conditions on rapid branch changes
  const activeBranchRef = useRef(activeBranchId);
  activeBranchRef.current = activeBranchId;

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await salonService.getSuperAdminDashboardData(activeBranchId);
      // Only set state if the branch context hasn't changed while awaiting response
      if (activeBranchRef.current === activeBranchId) {
        setData(res);
      }
    } catch (err: any) {
      if (activeBranchRef.current === activeBranchId) {
        setError(err.message || 'Failed to aggregate cross-branch metrics.');
      }
    } finally {
      if (activeBranchRef.current === activeBranchId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranchId, demoDate]);

  if (isLoading && !data) {
    return (
      <div className="py-32 flex items-center justify-center font-sans">
        <ScissorLoader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-3 max-w-lg mx-auto">
          <p className="font-semibold text-sm">Failed to Load Dashboard</p>
          <p>{error}</p>
          <Button variant="primary" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Title & Scope Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Executive Financial & Operations Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {data.isConsolidated ? 'Consolidated multi-location analytics and real-time enterprise performance.' : `Operational performance and financials for ${data.activeBranchName}.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadData}
          >
            Refresh Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => navigate('/reports/income-expense')}
          >
            Financial Reports
          </Button>
        </div>
      </div>


      {/* Shared Branch Operational Sections */}
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

      {/* Branch Performance Comparison Matrix Table */}
      {data.isConsolidated && (
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">Branch Performance Comparison</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidated comparison across verified branch locations
              </p>
            </div>
            <Badge variant="neutral">
              {data.branchStats.length} Locations Monitored
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="report-records w-full text-xs text-left">
              <thead className="bg-slate-50/75 text-slate-600 font-medium border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-5">Branch Name & Code</th>
                  <th className="py-3 px-4 text-right">Gross Sales</th>
                  <th className="py-3 px-4 text-right">Actual Collections</th>
                  <th className="py-3 px-4 text-right">Cash in Till</th>
                  <th className="py-3 px-4 text-right">Bank Balance</th>
                  <th className="py-3 px-4 text-center">Active Staff</th>
                  <th className="py-3 px-4 text-center">Appointments</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.branchStats.map((branch) => (
                  <tr key={branch.branchId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900">{branch.branchName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{branch.branchCode}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900 tabular-nums">
                      {formatCurrency(branch.grossSales)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-700 tabular-nums">
                      {formatCurrency(branch.actualCollections)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-medium text-slate-800">
                      {formatCurrency(branch.cashInCustody)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums text-slate-800 font-medium">
                      {formatCurrency(branch.onlineBalancesTotal)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {branch.activeStaffOnDuty}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-800">
                      {branch.appointmentsTodayCount}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => switchBranch(branch.branchId)}
                      >
                        Inspect Branch
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
