import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Plus, Building2 } from 'lucide-react';

interface InventoryNavHeaderProps {
  title: string;
  subtitle: string;
  activePath?: string;
  selectedBranchId: string;
  onBranchChange?: (branchId: string) => void;
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
}

export const InventoryNavHeader: React.FC<InventoryNavHeaderProps> = ({
  title,
  subtitle,
  selectedBranchId,
  onBranchChange,
  primaryAction,
  secondaryAction,
}) => {
  const { user, allBranches } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="mb-6 space-y-4">
      {/* Top Row: Title, Branch Picker & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Operations</span>
            <span>/</span>
            <span>Inventory Management</span>
            <span>/</span>
            <span className="text-[#0047AB] font-semibold">{title}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0B2545] tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Picker for Super Admin */}
          {isSuperAdmin && onBranchChange && allBranches.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => onBranchChange(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-transparent border-none focus:outline-hidden cursor-pointer"
              >
                {allBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="text-xs font-semibold px-3.5 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {secondaryAction.icon || <Plus className="w-3.5 h-3.5" />}
              <span>{secondaryAction.label}</span>
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="text-xs font-semibold px-4 py-2 text-white bg-[#0047AB] hover:bg-[#003785] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {primaryAction.icon || <Plus className="w-3.5 h-3.5" />}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
