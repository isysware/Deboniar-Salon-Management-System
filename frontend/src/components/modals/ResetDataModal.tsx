import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { salonService } from '@/services';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  RotateCcw,
  Trash2,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface ResetDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBranchId?: string;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  isOpen,
  onClose,
  defaultBranchId,
}) => {
  const { user, activeBranchId, allBranches } = useAuth();
  const toast = useToast();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? '' : (user?.branchId || '')
  );
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedBranchId(isSuperAdmin ? '' : (user?.branchId || ''));
      setResetConfirmationText('');
    }
  }, [isOpen, isSuperAdmin, user?.branchId]);

  // Cleanup options
  const [wipeClients, setWipeClients] = useState(true);
  const [wipeSuppliers, setWipeSuppliers] = useState(true);
  const [wipeInventory, setWipeInventory] = useState(true);
  const [wipeCatalogue, setWipeCatalogue] = useState(false);
  const [wipeStaff, setWipeStaff] = useState(false);

  const handleExecuteReset = async () => {
    if (!selectedBranchId || (selectedBranchId !== 'ALL' && !allBranches.some((branch) => branch.id === selectedBranchId))) {
      toast.error('Please select the branch to reset.');
      return;
    }
    if (resetConfirmationText.trim().toUpperCase() !== 'RESET') {
      toast.error('Please type "RESET" in capital letters to confirm.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await salonService.resetTestData({
        branchId: selectedBranchId,
        wipeClients,
        wipeSuppliers,
        wipeCatalogue,
        wipeInventory,
        wipeStaff,
      });

      toast.success(res.message || 'Operational test data has been successfully reset.');
      onClose();
      setResetConfirmationText('');

      // Reload after short delay to refresh all financial ledgers, drawers and counters
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset test data.');
    } finally {
      setIsResetting(false);
    }
  };

  const branchName =
    selectedBranchId === 'ALL'
      ? 'All Branches (Consolidated)'
      : allBranches.find((b) => b.id === selectedBranchId)?.name || 'Selected Branch';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isResetting && !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-rose-600" />
            </div>
            <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-rose-300">
              System Administration
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">
            Clear Operational Ledgers & Records
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Clear transaction records for <strong>{branchName}</strong> and reset all financial ledgers, cash drawers, and numbering sequences back to fresh state.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs">
          {/* Branch Target Selector for Super Admin */}
          {isSuperAdmin && (
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Select Reset Target:
              </label>
              <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val)}>
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder="Target branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs font-semibold">
                    All Branches (System-Wide Reset)
                  </SelectItem>
                  {allBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Warning Box */}
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/90 text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              What Will Be Cleared
            </span>
            <p className="text-[11px] leading-relaxed text-amber-900">
              Sales invoices, POS bills, appointments, attendance punches, staff loans & advances, payroll runs & payslips, cash drawer movements, expenses, and supplier ledgers will be wiped. Bill numbering sequences start fresh from #1.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Admin logins, passwords, and branch setups remain completely safe.
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <span className="font-bold text-slate-700 block mb-1">Optional Cleanup:</span>
            <label className="flex items-center gap-2 cursor-pointer text-slate-800">
              <Checkbox
                checked={wipeClients}
                onCheckedChange={(val) => setWipeClients(!!val)}
              />
              <span>Delete test customers / clients</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-800">
              <Checkbox
                checked={wipeSuppliers}
                onCheckedChange={(val) => setWipeSuppliers(!!val)}
              />
              <span>Delete test suppliers (or reset their balance to 0)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-800">
              <Checkbox
                checked={wipeInventory}
                onCheckedChange={(val) => setWipeInventory(!!val)}
              />
              <span className="font-semibold text-rose-700">Delete inventory product items & stock</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-800">
              <Checkbox
                checked={wipeStaff}
                onCheckedChange={(val) => setWipeStaff(!!val)}
              />
              <span className="text-rose-700">Delete staff directory profiles (Logins are preserved)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-800">
              <Checkbox
                checked={wipeCatalogue}
                onCheckedChange={(val) => setWipeCatalogue(!!val)}
              />
              <span className="text-rose-700">Delete service catalogue & treatment packages</span>
            </label>
          </div>

          {/* Confirmation input */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Type <strong className="text-rose-600 font-mono">RESET</strong> to confirm:
            </label>
            <Input
              placeholder="RESET"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              className="font-mono text-xs uppercase"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isResetting}
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={resetConfirmationText.trim().toUpperCase() !== 'RESET' || isResetting}
            onClick={handleExecuteReset}
            className="text-xs gap-1.5"
          >
            {isResetting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                Resetting Data...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Confirm & Reset Records
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
