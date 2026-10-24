import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { Branch } from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { DeviceIntegrationView } from '@/features/branches/components/DeviceIntegrationView';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Building2, Cpu } from 'lucide-react';

export const DeviceIntegrationPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  // Role guard: Only SUPER_ADMIN and ADMIN
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/admin/devices" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const initialBranchId = isSuperAdmin
    ? (activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '')
    : (user.branchId as string);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      if (activeBranchId !== 'ALL') {
        setSelectedBranchId(activeBranchId);
      } else if (!selectedBranchId && allBranches.length > 0) {
        setSelectedBranchId(allBranches[0].id);
      }
    }
  }, [activeBranchId, isSuperAdmin, selectedBranchId, allBranches]);

  const loadBranchInfo = async (bId: string) => {
    if (!bId) return;
    try {
      const branches = await salonService.getBranches();
      const br = branches.find((b) => b.id === bId) || null;
      setCurrentBranch(br);
    } catch (err) {
      console.error('Failed to load branch info:', err);
    }
  };

  useEffect(() => {
    if (selectedBranchId) {
      loadBranchInfo(selectedBranchId);
    }
  }, [selectedBranchId]);

  return (
    <div className="space-y-6 font-sans">
      <DeviceIntegrationView
        branchId={selectedBranchId}
        branchName={currentBranch?.name}
        onRefresh={() => loadBranchInfo(selectedBranchId)}
        branchSwitcher={
          isSuperAdmin ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Branch:
              </span>
              <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val)}>
                <SelectTrigger className="w-48 sm:w-56 h-9 text-xs">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {allBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : undefined
        }
      />
    </div>
  );
};
