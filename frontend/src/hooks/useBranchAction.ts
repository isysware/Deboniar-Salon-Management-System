import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/context/ToastContext';

/** Use a stable module-level loader. Results from an old branch are never exposed. */
export function useBranchAction<T>(open: boolean, loader: (branchId: string) => Promise<T>) {
  const { user, allBranches } = useAuth();
  const [selection, setBranchId] = useState('');
  const branchId = user?.role === 'SUPER_ADMIN' ? selection : user?.branchId || '';
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  const key = `${user?.id}:${branchId}:${revision}`;
  const validBranch = !!branchId && branchId !== 'ALL' && allBranches.some((b) => b.id === branchId);
  useEffect(() => {
    if (!open) { setBranchId(''); setResult({ key: '' }); }
  }, [open]);
  useEffect(() => {
    if (!open || !validBranch) return;
    let cancelled = false;
    loader(branchId).then((data) => {
      if (!cancelled) setResult({ key, data });
    }).catch((error) => {
      if (!cancelled) setResult({ key, error: error.message || 'Unable to load branch data.' });
    });
    return () => { cancelled = true; };
  }, [open, validBranch, branchId, key, loader]);
  const ready = open && validBranch && result.key === key && result.data !== undefined && !result.error;
  const error = result.key === key ? result.error : undefined;
  return {
    branchId, setBranchId, ready, error,
    data: ready ? result.data : undefined,
    refresh: () => setRevision((value) => value + 1),
    validate: () => {
      if (!ready) toast.error(error || (validBranch ? 'Please wait for branch data to load.' : 'Please select a branch for this action.'));
      return ready;
    },
  };
}
