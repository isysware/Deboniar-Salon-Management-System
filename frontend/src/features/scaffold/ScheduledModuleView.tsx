import React from 'react';
import { useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDefaultRouteForRole } from '@/lib/permissions';
import {
  CalendarClock,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface ScheduledModuleViewProps {
  title: string;
  category: string;
  description?: string;
  plannedFeatures?: string[];
}

export const ScheduledModuleView: React.FC<ScheduledModuleViewProps> = ({
  title,
  category,
  description,
  plannedFeatures = [
    'Comprehensive operational workflows and record management.',
    'Role-specific transaction logging and multi-branch ledger synchronization.',
    'Verified access control with branch data isolation.',
  ],
}) => {
  const { user, activeBranchId, allBranches } = useAuth();
  const { navigate } = useRouter();

  const activeBranchName =
    activeBranchId === 'ALL'
      ? 'All Branches'
      : allBranches.find((b) => b.id === activeBranchId)?.name || 'Selected Branch';

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {category}
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="neutral">
              Scheduled Release
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 mt-1">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => navigate(user ? getDefaultRouteForRole(user.role) : '/')}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Main Notice Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2254E1] shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">
                  Feature In Development
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The <span className="font-medium text-slate-800">{title}</span> module is scheduled for the upcoming production release cycle. Operational controls and reports will be activated upon deployment.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Planned Functionality
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-600">
                {plannedFeatures.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        {/* Operational Context Card */}
        <div>
          <Card padding="md" className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Current Session Context
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-400 block">Active Portal Role</span>
                <span className="font-semibold text-slate-800">{user?.role}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-400 block">Assigned Branch Context</span>
                <span className="font-semibold text-slate-800 truncate block">{activeBranchName}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-400 block">Access Permission</span>
                <span className="font-medium text-emerald-700">Authorized for Module</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
