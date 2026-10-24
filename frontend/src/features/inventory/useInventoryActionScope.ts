import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import type { InventoryItem, InventoryBatch, Supplier, PaymentAccount, CashDrawer } from '@/types/salon';

const emptyData = { items: [] as InventoryItem[], batches: [] as InventoryBatch[], suppliers: [] as Supplier[], accounts: [] as PaymentAccount[], drawers: [] as CashDrawer[] };

export function useInventoryActionScope(open: boolean) {
  const { user, allBranches } = useAuth();
  const [selection, setBranchId] = useState('');
  const branchId = user?.role === 'SUPER_ADMIN' ? selection : user?.branchId || '';
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState({ key: '', data: emptyData, error: '' });
  const key = `${user?.id}:${branchId}:${version}`;
  const validBranch = !!branchId && branchId !== 'ALL' && allBranches.some((b) => b.id === branchId);

  useEffect(() => {
    if (!open) { setBranchId(''); setSnapshot({ key: '', data: emptyData, error: '' }); }
  }, [open]);

  useEffect(() => {
    if (!open || !validBranch || !user) return;
    let cancelled = false;
    Promise.all([
      salonService.getInventoryItems(branchId, user),
      salonService.getInventoryBatches(branchId, undefined, user),
      salonService.getSuppliers(branchId, user),
      salonService.getPaymentAccounts(branchId),
      salonService.getCashDrawers(branchId),
    ]).then(([items, batches, suppliers, accounts, drawers]) => {
      if (!cancelled) setSnapshot({ key, data: { items, batches, suppliers, accounts, drawers }, error: '' });
    }).catch((error) => {
      if (!cancelled) setSnapshot({ key, data: emptyData, error: error.message || 'Unable to load branch data. Please select the branch again.' });
    });
    return () => { cancelled = true; };
  }, [open, branchId, validBranch, user, key]);

  const data = open && snapshot.key === key ? snapshot.data : emptyData;
  const error = snapshot.key === key ? snapshot.error : '';
  const ready = open && validBranch && snapshot.key === key && !error;
  const stockMap: Record<string, number> = {};
  data.batches.filter((batch) => batch.branchId === branchId).forEach((batch) => {
    stockMap[batch.itemId] = (stockMap[batch.itemId] || 0) + (batch.remainingQuantity || 0);
  });
  return {
    ...data, branchId, stockMap, ready, error,
    loading: open && validBranch && snapshot.key !== key,
    activeDrawer: data.drawers.find((d) => d.branchId === branchId && d.status === 'OPEN' && d.custodianUserId === user?.id) || null,
    setBranchId,
    refresh: () => setVersion((v) => v + 1),
    validate: () => {
      if (!ready) toast.error(error || (validBranch ? 'Please wait for branch data to load.' : 'Please select a branch for this action.'));
      return ready;
    },
  };
}
