import React from 'react';
import { useAuth } from '@/context/AuthContext';

/** The action branch is deliberately independent of the page's read filter. */
export function BranchActionField({ value, onChange, disabled = false }: {
  value: string;
  onChange: (branchId: string) => void;
  disabled?: boolean;
}) {
  const { user, allBranches } = useAuth();
  const id = React.useId();
  if (user?.role !== 'SUPER_ADMIN') return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">Branch <span className="text-rose-500">*</span></label>
      <select id={id} required value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60">
        <option value="">Select branch for this action</option>
        {allBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
    </div>
  );
}
