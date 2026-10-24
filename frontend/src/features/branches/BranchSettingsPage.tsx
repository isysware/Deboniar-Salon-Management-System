import { BranchActionField } from '@/components/BranchActionField';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import {
  PaymentAccount,
  PaymentAccountType,
  TaxRule,
  Branch,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { DeviceIntegrationView } from './components/DeviceIntegrationView';
import { formatCurrency } from '@/lib/formatters';
import { calculateTaxAndTotals, roundCurrency } from '@/lib/taxCalculations';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Landmark,
  Percent,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  PowerOff,
  Power,
  AlertCircle,
  CheckCircle2,
  Building2,
  ChevronDown,
  CreditCard,
  Wallet,
  Smartphone,
  Info,
  ShieldAlert,
  Calculator,
  ArrowRight,
  EyeOff,
  RotateCcw,
  Trash2,
  Database,
  AlertTriangle,
  RefreshCw,
  Clock,
  Cpu,
  Store,
  Upload,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';

export const BranchSettingsPage: React.FC = () => {
  const { user, activeBranchId, allBranches, refreshBranches } = useAuth();
  const { pathname, navigate } = useRouter();

  // Role guard: Only SUPER_ADMIN and ADMIN
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/admin/branch-settings" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [creationBranchIds, setCreationBranchIds] = useState<string[]>([]);

  // Branch context
  const initialBranchId = isSuperAdmin
    ? ''
    : (user.branchId as string);

  const getTabFromPath = (path: string): 'SALON_PROFILE' | 'PAYMENT_ACCOUNTS' | 'TAX_SETTINGS' | 'DATA_RESET' | 'DEVICE_INTEGRATION' => {
    if (path === '/admin/data-reset' || path === '/admin/reset-data') return 'DATA_RESET';
    if (path === '/admin/devices' || path === '/admin/device-settings') return 'DEVICE_INTEGRATION';
    if (path === '/admin/payment-accounts') return 'PAYMENT_ACCOUNTS';
    if (path === '/admin/tax-settings') return 'TAX_SETTINGS';
    return 'SALON_PROFILE';
  };

  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [activeTab, setActiveTab] = useState<'SALON_PROFILE' | 'PAYMENT_ACCOUNTS' | 'TAX_SETTINGS' | 'DATA_RESET' | 'DEVICE_INTEGRATION'>(
    getTabFromPath(pathname)
  );

  // Salon Profile & Branding state
  const [profileName, setProfileName] = useState<string>('');
  const [profilePhone, setProfilePhone] = useState<string>('');
  const [profileEmail, setProfileEmail] = useState<string>('');
  const [profileAddress, setProfileAddress] = useState<string>('');
  const [profileCity, setProfileCity] = useState<string>('');
  const [profileTaxReg, setProfileTaxReg] = useState<string>('');
  const [profileTaxAuth, setProfileTaxAuth] = useState<string>('');
  const [profileLogoUrl, setProfileLogoUrl] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Simple Branch Tax settings state
  const [branchTaxEnabled, setBranchTaxEnabled] = useState<boolean>(true);
  const [branchTaxRateInput, setBranchTaxRateInput] = useState<string>('13');
  const [branchTaxName, setBranchTaxName] = useState<string>('Sales Tax (SST)');
  const [isSavingTax, setIsSavingTax] = useState<boolean>(false);

  useEffect(() => {
    setActiveTab(getTabFromPath(pathname));
  }, [pathname]);

  // Test data reset states
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [wipeClients, setWipeClients] = useState(true);
  const [wipeSuppliers, setWipeSuppliers] = useState(true);
  const [wipeCatalogue, setWipeCatalogue] = useState(false);
  const [wipeStaff, setWipeStaff] = useState(false);

  // Branch entity & lists
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
  const [isAccountStatusAlertOpen, setIsAccountStatusAlertOpen] = useState(false);
  const [isDeleteAccountAlertOpen, setIsDeleteAccountAlertOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
  const [unmaskedAccountIds, setUnmaskedAccountIds] = useState<Record<string, boolean>>({});

  const [isAddTaxRuleModalOpen, setIsAddTaxRuleModalOpen] = useState(false);
  const [isEditTaxRuleModalOpen, setIsEditTaxRuleModalOpen] = useState(false);
  const [isTaxRuleStatusAlertOpen, setIsTaxRuleStatusAlertOpen] = useState(false);
  const [selectedTaxRule, setSelectedTaxRule] = useState<TaxRule | null>(null);

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states: Payment Account
  const [accountFormData, setAccountFormData] = useState<{
    name: string;
    accountType: PaymentAccountType;
    providerName: string;
    accountHolder: string;
    accountIdentifier: string;
    isActive: boolean;
  }>({
    name: '',
    accountType: 'BANK',
    providerName: '',
    accountHolder: '',
    accountIdentifier: '',
    isActive: true,
  });

  // Form states: Tax Rule
  const [taxRuleFormData, setTaxRuleFormData] = useState<{
    name: string;
    rate: number;
    description: string;
    isBranchDefault: boolean;
    isActive: boolean;
  }>({
    name: '',
    rate: 16,
    description: '',
    isBranchDefault: false,
    isActive: true,
  });

  // Interactive Live Tax Calculation Preview state
  const [previewGrossPrice, setPreviewGrossPrice] = useState<number>(10000);
  const [previewDiscount, setPreviewDiscount] = useState<number>(1000);
  const [previewTaxTreatment, setPreviewTaxTreatment] = useState<'BRANCH_DEFAULT' | 'SPECIFIC_RULE' | 'EXEMPT'>('BRANCH_DEFAULT');
  const [previewSpecificRuleId, setPreviewSpecificRuleId] = useState<string>('');
  const [previewTip, setPreviewTip] = useState<number>(500);

  // Load branch data
  const loadBranchSettings = async () => {
    if (!selectedBranchId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [branch, accounts, rules] = await Promise.all([
        salonService.getBranch(selectedBranchId),
        isSuperAdmin ? salonService.getPaymentAccounts(selectedBranchId) : Promise.resolve([]),
        isSuperAdmin ? salonService.getTaxRules(selectedBranchId) : Promise.resolve([]),
      ]);
      setCurrentBranch(branch);
      setPaymentAccounts(accounts);
      setTaxRules(rules);
      if (branch) {
        setProfileName(branch.name || '');
        setProfilePhone(branch.phone || '');
        setProfileEmail(branch.email || '');
        setProfileAddress(branch.address || '');
        setProfileCity(branch.city || '');
        setProfileTaxReg(branch.taxRegistrationNumber || '');
        setProfileTaxAuth(branch.taxAuthority || '');
        setProfileLogoUrl(branch.logoUrl || '');
        setBranchTaxEnabled(!!branch.taxEnabled);
        setBranchTaxRateInput(((branch.taxRate ?? 0) * 100).toFixed(0));
      }
      const defaultRule = rules.find((r) => r.isBranchDefault) || rules[0];
      if (defaultRule) {
        setBranchTaxName(defaultRule.name);
      }
      if (rules.length > 0 && !previewSpecificRuleId) {
        setPreviewSpecificRuleId(rules[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load branch settings:', err);
      setErrorMessage(err.message || 'Failed to load branch settings.');
    } finally {
      setIsLoading(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setProfileLogoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (selectedBranchId && currentBranch?.logoUrl) {
      try {
        setIsSavingProfile(true);
        const updated = await salonService.updateBranch(
          selectedBranchId,
          {
            logoUrl: null,
          },
          user
        );
        setCurrentBranch(updated);
        if (refreshBranches) {
          await refreshBranches();
        }
        toast.success('Logo removed successfully!');
        setSuccessMessage('Logo removed. Changes are active across the header, invoices, and receipts.');
      } catch (err: any) {
        toast.error(err.message || 'Failed to remove logo.');
      } finally {
        setIsSavingProfile(false);
      }
    } else {
      toast.info('Logo cleared.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) return;
    if (!profileName.trim()) {
      toast.error('Salon name is required.');
      return;
    }
    setIsSavingProfile(true);
    setErrorMessage(null);
    try {
      const updated = await salonService.updateBranch(
        selectedBranchId,
        {
          name: profileName.trim(),
          phone: profilePhone.trim() || undefined,
          email: profileEmail.trim() || undefined,
          address: profileAddress.trim() || undefined,
          city: profileCity.trim() || undefined,
          taxRegistrationNumber: profileTaxReg.trim() || undefined,
          taxAuthority: profileTaxAuth.trim() || undefined,
          logoUrl: profileLogoUrl ? profileLogoUrl.trim() : null,
        },
        user
      );
      setCurrentBranch(updated);
      if (refreshBranches) {
        await refreshBranches();
      }
      toast.success('Salon profile & logo saved successfully!');
      setSuccessMessage('Salon details updated. The new logo and name are now active across the header, invoices, and receipts.');
    } catch (err: any) {
      const msg = err.message || 'Failed to update salon profile.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    loadBranchSettings();
  }, [selectedBranchId]);

  // Filtered payment accounts
  const filteredAccounts = useMemo(() => {
    return paymentAccounts.filter((acc) => {
      const matchesSearch =
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.accountHolder.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (acc.accountIdentifier && acc.accountIdentifier.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = accountTypeFilter === 'ALL' || acc.accountType === accountTypeFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && acc.isActive) ||
        (statusFilter === 'INACTIVE' && !acc.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [paymentAccounts, searchQuery, accountTypeFilter, statusFilter]);

  // KPI Summary for Payment Accounts
  const accountMetrics = useMemo(() => {
    const total = paymentAccounts.length;
    const bankCount = paymentAccounts.filter((a) => a.accountType === 'BANK' && a.isActive).length;
    const posCount = paymentAccounts.filter((a) => a.accountType === 'OTHER' && a.isActive).length;
    const walletCount = paymentAccounts.filter(
      (a) => (a.accountType === 'EASYPAISA' || a.accountType === 'JAZZCASH') && a.isActive
    ).length;
    // Preserve balances of inactive payment accounts in financial totals; hide them only from new-payment selectors
    const totalBalance = paymentAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
    return { total, bankCount, posCount, walletCount, totalBalance };
  }, [paymentAccounts]);

  // Tax calculation preview output
  const liveTaxPreview = useMemo(() => {
    // Zero is valid; disabled/default-missing tax must not silently become 16%
    const branchDefaultRate = currentBranch?.taxEnabled ? (currentBranch.taxRate ?? 0) : 0;
    const selectedRule = taxRules.find((r) => r.id === previewSpecificRuleId);
    const specificRuleRate = selectedRule ? selectedRule.rate : branchDefaultRate;

    return calculateTaxAndTotals({
      grossPrice: previewGrossPrice,
      discount: previewDiscount,
      taxTreatment: previewTaxTreatment,
      branchDefaultRate,
      specificRuleRate,
      tip: previewTip,
    });
  }, [previewGrossPrice, previewDiscount, previewTaxTreatment, previewSpecificRuleId, previewTip, currentBranch, taxRules]);

  // Masking helper
  const maskIdentifier = (idStr?: string) => {
    if (!idStr) return 'Not Provided';
    if (idStr.length <= 4) return idStr;
    const last4 = idStr.slice(-4);
    return `····${last4}`;
  };

  // Toggle mask state
  const toggleMask = (accId: string) => {
    setUnmaskedAccountIds((prev) => ({
      ...prev,
      [accId]: !prev[accId],
    }));
  };

  const renderBranchSelection = () => {
    const selectedBranches = allBranches.filter((branch) => creationBranchIds.includes(branch.id));
    return (
      <div className="space-y-1.5">
        <label id="creation-branches-label" className="font-semibold text-slate-700 block">Branches *</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" aria-labelledby="creation-branches-label creation-branches-value"
              className="w-full justify-between h-10 px-3 text-xs font-normal border-slate-200 shadow-none">
              <span className="flex min-w-0 items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span id="creation-branches-value" className="truncate">
                  {selectedBranches.length === 0 ? 'Select branches' : selectedBranches.length === 1 ? selectedBranches[0].name : selectedBranches.length + ' branches selected'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto p-1.5">
            {allBranches.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No branches available.</p>}
            {allBranches.map((branch) => (
              <DropdownMenuCheckboxItem key={branch.id} checked={creationBranchIds.includes(branch.id)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => setCreationBranchIds((ids) => checked ? [...new Set([...ids, branch.id])] : ids.filter((id) => id !== branch.id))}
                className="py-2.5 text-xs data-[state=checked]:bg-blue-50 data-[state=checked]:text-[#2254E1]">
                <span className="flex flex-1 items-center justify-between gap-3">
                  <span>{branch.name}</span>
                  <span className="text-[10px] text-slate-400">{branch.code}</span>
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {selectedBranches.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedBranches.map((branch) => <Badge key={branch.id} variant="neutral" className="text-[10px] font-medium">{branch.name}</Badge>)}
          </div>
        )}
        <p className="text-[10px] text-slate-500">Choose the branches where this will be available.</p>
      </div>
    );
  };

  // Handler: Save Payment Account
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      if (isAddAccountModalOpen && creationBranchIds.length === 0) throw new Error('Select at least one branch.');
      if (isAddAccountModalOpen) {
        await salonService.createPaymentAccount(
          selectedBranchId,
          {
            ...(isAddAccountModalOpen ? { branchIds: creationBranchIds } : {}),
            name: accountFormData.name,
            accountType: accountFormData.accountType,
            providerName: accountFormData.providerName,
            accountHolder: accountFormData.accountHolder,
            accountIdentifier: accountFormData.accountIdentifier || undefined,
            isActive: accountFormData.isActive,
          },
          user
        );
        const msg = `Payment account '${accountFormData.name}' registered successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsAddAccountModalOpen(false);
      } else if (isEditAccountModalOpen && selectedAccount) {
        await salonService.updatePaymentAccount(
          selectedAccount.id,
          {
            ...(isAddAccountModalOpen ? { branchIds: creationBranchIds } : {}),
            name: accountFormData.name,
            accountType: accountFormData.accountType,
            providerName: accountFormData.providerName,
            accountHolder: accountFormData.accountHolder,
            accountIdentifier: accountFormData.accountIdentifier || undefined,
            isActive: accountFormData.isActive,
          },
          user
        );
        const msg = `Payment account '${accountFormData.name}' updated successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsEditAccountModalOpen(false);
      }
      loadBranchSettings();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save payment account.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  // Handler: Toggle Payment Account Status
  const handleToggleAccountStatus = async () => {
    if (!selectedAccount) return;
    try {
      const updated = await salonService.togglePaymentAccountStatus(selectedAccount.id, user);
      const msg = `Payment account '${updated.name}' is now ${updated.isActive ? 'Active' : 'Inactive'}.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsAccountStatusAlertOpen(false);
      loadBranchSettings();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to change payment account status.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  // Handler: Delete / Remove Payment Account
  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    try {
      setIsDeletingAccount(true);
      const result = await salonService.deletePaymentAccount(selectedAccount.id, user);
      setSuccessMessage(result.message);
      toast.success(result.message);
      setIsDeleteAccountAlertOpen(false);
      loadBranchSettings();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to remove payment account.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Handler: Save Tax Rule
  const handleSaveTaxRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const rateDecimal = Number(taxRuleFormData.rate) / 100;
      if (isNaN(rateDecimal) || rateDecimal < 0 || rateDecimal > 1) {
        throw new Error('Tax rate percentage must be between 0% and 100%.');
      }

      if (isAddTaxRuleModalOpen && creationBranchIds.length === 0) throw new Error('Select at least one branch.');
      if (isAddTaxRuleModalOpen) {
        await salonService.createTaxRule(
          selectedBranchId,
          {
            ...(isAddTaxRuleModalOpen ? { branchIds: creationBranchIds } : {}),
            name: taxRuleFormData.name,
            rate: rateDecimal,
            description: taxRuleFormData.description,
            isBranchDefault: taxRuleFormData.isBranchDefault,
            isActive: taxRuleFormData.isActive,
          },
          user
        );
        const msg = `Tax rule '${taxRuleFormData.name}' created successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsAddTaxRuleModalOpen(false);
      } else if (isEditTaxRuleModalOpen && selectedTaxRule) {
        await salonService.updateTaxRule(
          selectedTaxRule.id,
          {
            ...(isAddTaxRuleModalOpen ? { branchIds: creationBranchIds } : {}),
            name: taxRuleFormData.name,
            rate: rateDecimal,
            description: taxRuleFormData.description,
            isBranchDefault: taxRuleFormData.isBranchDefault,
            isActive: taxRuleFormData.isActive,
          },
          user
        );
        const msg = `Tax rule '${taxRuleFormData.name}' updated successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsEditTaxRuleModalOpen(false);
      }
      loadBranchSettings();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save tax rule.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  // Handler: Set as Branch Default Tax Rule
  const handleSetDefaultTaxRule = async (ruleId: string | null) => {
    setErrorMessage(null);
    try {
      const updatedBranch = await salonService.setBranchDefaultTaxRule(selectedBranchId, ruleId, user);
      setCurrentBranch(updatedBranch);
      if (refreshBranches) await refreshBranches();
      const msg = ruleId
        ? `Branch default tax rate updated to ${(updatedBranch.taxRate * 100).toFixed(1)}%.`
        : 'Branch sales tax has been disabled.';
      setSuccessMessage(msg);
      toast.success(msg);
      loadBranchSettings();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to update branch default tax rule.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  // Handler: Save Simple Branch Tax Rate
  const handleSaveSimpleBranchTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTax(true);
    setErrorMessage(null);
    try {
      const parsedRate = parseFloat(branchTaxRateInput);
      if (branchTaxEnabled && (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100)) {
        throw new Error('Please enter a valid tax percentage between 0% and 100%.');
      }

      const rateDecimal = branchTaxEnabled ? parsedRate / 100 : 0;
      const ruleName = branchTaxName.trim() || 'Sales Tax';

      let defaultRule = taxRules.find((r) => r.isBranchDefault) || taxRules[0];

      if (defaultRule) {
        await salonService.updateTaxRule(
          defaultRule.id,
          {
            name: ruleName,
            rate: rateDecimal,
            isActive: branchTaxEnabled,
            isBranchDefault: branchTaxEnabled,
          },
          user
        );
        if (branchTaxEnabled) {
          await salonService.setBranchDefaultTaxRule(selectedBranchId, defaultRule.id, user);
        } else {
          await salonService.setBranchDefaultTaxRule(selectedBranchId, null, user);
        }
      } else if (branchTaxEnabled) {
        const created = await salonService.createTaxRule(
          selectedBranchId,
          {
            name: ruleName,
            rate: rateDecimal,
            isActive: true,
            isBranchDefault: true,
          },
          user
        );
        await salonService.setBranchDefaultTaxRule(selectedBranchId, created.id, user);
      } else {
        await salonService.setBranchDefaultTaxRule(selectedBranchId, null, user);
      }

      if (refreshBranches) {
        await refreshBranches();
      }
      await loadBranchSettings();

      const displayRate = branchTaxEnabled ? `${parsedRate}%` : 'Disabled (0%)';
      toast.success(`Branch tax updated to ${displayRate}!`);
      setSuccessMessage(`Branch tax updated to ${displayRate}. This rate is now active across all services and POS billing.`);
    } catch (err: any) {
      const msg = err.message || 'Failed to update branch tax.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSavingTax(false);
    }
  };

  // Handler: Toggle Tax Rule Status
  const handleToggleTaxRuleStatus = async () => {
    if (!selectedTaxRule) return;
    try {
      const updated = await salonService.toggleTaxRuleStatus(selectedTaxRule.id, user);
      const msg = `Tax rule '${updated.name}' is now ${updated.isActive ? 'Active' : 'Inactive'}.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsTaxRuleStatusAlertOpen(false);
      loadBranchSettings();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to change tax rule status.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  const getAccountTypeIcon = (type: PaymentAccountType) => {
    switch (type) {
      case 'BANK':
        return <Landmark className="w-3.5 h-3.5 text-[#2254E1]" />;
      case 'EASYPAISA':
      case 'JAZZCASH':
        return <Smartphone className="w-3.5 h-3.5 text-emerald-600" />;
      case 'OTHER':
      default:
        return <CreditCard className="w-3.5 h-3.5 text-purple-600" />;
    }
  };

  // Handler: Execute Data Reset
  const handleExecuteDataReset = async () => {
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
        wipeStaff,
      });
      toast.success(res.message || 'Test data has been successfully reset.');
      setIsResetModalOpen(false);
      setResetConfirmationText('');
      loadBranchSettings();
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset test data.');
    } finally {
      setIsResetting(false);
    }
  };

  if (!isSuperAdmin && ['/admin/payment-accounts', '/admin/tax-settings'].includes(pathname)) return <AccessDeniedView attemptedPath={pathname} />;

  if (isSuperAdmin && !selectedBranchId) {
    return <div className="max-w-lg mx-auto mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="font-semibold text-slate-900">Select a branch</h1>
      <p className="text-sm text-slate-500">Choose the branch whose settings you want to view or update.</p>
      <BranchActionField value={selectedBranchId} onChange={setSelectedBranchId} />
    </div>;
  }

  return (
    <div className="space-y-6 font-sans">
      {/* FEEDBACK ALERTS */}
      {errorMessage && (
        <Alert variant="destructive" className="animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Action Notice</AlertTitle>
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <AlertTitle>Configuration Saved</AlertTitle>
          <AlertDescription className="text-xs">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* UNIFIED PAGE HEADER & ACTIONS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {activeTab === 'SALON_PROFILE' && (
                <>
                  <Store className="w-6 h-6 text-[#2254E1]" />
                  <span>Salon Profile & Branding</span>
                </>
              )}
              {activeTab === 'PAYMENT_ACCOUNTS' && (
                <>
                  <Landmark className="w-6 h-6 text-[#2254E1]" />
                  <span>Payment Accounts & Settlement Channels</span>
                </>
              )}
              {activeTab === 'TAX_SETTINGS' && (
                <>
                  <Percent className="w-6 h-6 text-[#2254E1]" />
                  <span>Branch Tax Settings & Invoicing Rules</span>
                </>
              )}
              {activeTab === 'DEVICE_INTEGRATION' && (
                <>
                  <Cpu className="w-6 h-6 text-[#2254E1]" />
                  <span>Hardware & Device Integration</span>
                </>
              )}
              {activeTab === 'DATA_RESET' && (
                <>
                  <RotateCcw className="w-6 h-6 text-rose-600" />
                  <span>Operational Data Reset</span>
                </>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'SALON_PROFILE' && `Manage salon business name, official logo, contact information, and address for ${currentBranch?.name || 'this branch'}.`}
              {activeTab === 'PAYMENT_ACCOUNTS' && `Active payment collection accounts and bank settlement channels for ${currentBranch?.name || 'this salon'}.`}
              {activeTab === 'TAX_SETTINGS' && `Configure provincial sales tax, tax authority, and invoice tax rules for ${currentBranch?.name || 'this branch'}.`}
              {activeTab === 'DEVICE_INTEGRATION' && `Manage connected biometric attendance, POS printers and cash drawers for ${currentBranch?.name || 'this branch'}.`}
              {activeTab === 'DATA_RESET' && `Reset operational data, bookings, bills, and registers.`}
            </p>
          </div>

          {/* Controls: Branch Switcher (if Super Admin) + Contextual Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isSuperAdmin && (
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
            )}

            {activeTab === 'PAYMENT_ACCOUNTS' && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setAccountFormData({
                    name: '',
                    accountType: 'BANK',
                    providerName: 'Meezan Bank Ltd',
                    accountHolder: currentBranch?.name || 'Salon Merchant',
                    accountIdentifier: '',
                    isActive: true,
                  });
                  setCreationBranchIds([]);
                  setIsAddAccountModalOpen(true);
                }}
                className="text-xs font-semibold shadow-sm"
              >
                Add Payment Account
              </Button>
            )}

            {activeTab === 'TAX_SETTINGS' && isSuperAdmin && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setTaxRuleFormData({
                    name: '',
                    rate: 16,
                    description: '',
                    isBranchDefault: taxRules.length === 0,
                    isActive: true,
                  });
                  setCreationBranchIds([]);
                  setIsAddTaxRuleModalOpen(true);
                }}
                className="text-xs font-semibold shadow-sm"
              >
                Add Tax Rule
              </Button>
            )}
          </div>
        </div>

        {/* --- TAB 0: SALON PROFILE & BRANDING --- */}
        {activeTab === 'SALON_PROFILE' && (
          <form onSubmit={handleSaveProfile} className="space-y-6 mt-4">
            <Card padding="lg" className="bg-white border-slate-200/90 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#2254E1]" />
                  Salon Branding & Identity
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage your salon's business name, official logo, and contact info displayed on system headers, invoices, thermal receipts, and client PDFs.
                </p>
              </div>

              {/* LOGO UPLOAD SECTION */}
              <div className="bg-slate-50/80 rounded-xl p-4 sm:p-5 border border-slate-200/80">
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  Salon Official Logo
                </label>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  {/* Logo Preview Box */}
                  <div className="relative group shrink-0">
                    <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shadow-xs">
                      {profileLogoUrl ? (
                        <img
                          src={profileLogoUrl}
                          alt="Salon Logo"
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-center p-3">
                          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                          <span className="text-[10px] font-medium text-slate-400 block leading-tight">
                            No Logo Set
                          </span>
                        </div>
                      )}
                    </div>
                    {profileLogoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold hover:bg-rose-600 shadow-xs cursor-pointer z-10"
                        title="Remove logo"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 space-y-3 text-center sm:text-left w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2254E1] hover:bg-[#1B3FC5] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo Image</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoFileUpload}
                          className="hidden"
                        />
                      </label>

                      {profileLogoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Remove Logo</span>
                        </button>
                      )}

                      <span className="text-[11px] text-slate-400 block sm:inline w-full sm:w-auto mt-1 sm:mt-0">
                        PNG, JPG, SVG or WEBP (Max 2MB).
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-500 block">Or Image URL:</span>
                      <Input
                        type="text"
                        value={profileLogoUrl}
                        onChange={(e) => setProfileLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="text-xs max-w-md bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SALON BASIC INFO FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Salon / Branch Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Warsi Salon & Spa"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Contact Phone Number
                  </label>
                  <Input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="e.g. 0300 1234567"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Business Email
                  </label>
                  <Input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="e.g. info@warsisalon.com"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    City
                  </label>
                  <Input
                    type="text"
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    placeholder="e.g. Lahore"
                    className="text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Salon Address (Appears on Invoices & Receipts)
                  </label>
                  <Input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="e.g. Shop # 4, Main Boulevard, Gulberg III"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tax Authority Name (Optional)
                  </label>
                  <Input
                    type="text"
                    value={profileTaxAuth}
                    onChange={(e) => setProfileTaxAuth(e.target.value)}
                    placeholder="e.g. PRA / SRB / FBR"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tax Registration / NTN (Optional)
                  </label>
                  <Input
                    type="text"
                    value={profileTaxReg}
                    onChange={(e) => setProfileTaxReg(e.target.value)}
                    placeholder="e.g. PRA-LHE-7392014-9"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* SAVE ACTION BAR */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSavingProfile}
                  className="font-semibold shadow-xs gap-2"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Branding & Profile
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* --- TAB 1: PAYMENT ACCOUNTS --- */}
        {activeTab === 'PAYMENT_ACCOUNTS' && (
          <div className="space-y-5 mt-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card padding="sm" className="bg-white border-slate-200/90 shadow-xs relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Total Active Accounts</span>
                    <span className="text-xl font-bold text-slate-900 mt-1 block">
                      {accountMetrics.total} {accountMetrics.total === 1 ? 'Account' : 'Accounts'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Configured for {currentBranch?.name}</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              <Card padding="sm" className="bg-white border-slate-200/90 shadow-xs relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Commercial Bank Checking</span>
                    <span className="text-xl font-bold text-[#2254E1] mt-1 block">
                      {accountMetrics.bankCount} {accountMetrics.bankCount === 1 ? 'Corporate Account' : 'Corporate Accounts'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Active settlement channels</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2254E1] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              <Card padding="sm" className="bg-white border-slate-200/90 shadow-xs relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Card POS Terminals</span>
                    <span className="text-xl font-bold text-purple-700 mt-1 block">
                      {accountMetrics.posCount} {accountMetrics.posCount === 1 ? 'Terminal' : 'Terminals'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Physical card readers</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
              </Card>

              <Card padding="sm" className="bg-white border-slate-200/90 shadow-xs relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">Total Electronic Balances</span>
                    <span className="text-xl font-bold text-emerald-700 mt-1 block tabular-nums">
                      {formatCurrency(accountMetrics.totalBalance)}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Sum of active accounts</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Search account name, bank, or holder..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select value={accountTypeFilter} onValueChange={(val) => setAccountTypeFilter(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Account Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Account Types</SelectItem>
                  <SelectItem value="BANK" className="text-xs">Bank Checking Accounts</SelectItem>
                  <SelectItem value="OTHER" className="text-xs">POS Card Terminals</SelectItem>
                  <SelectItem value="EASYPAISA" className="text-xs">Easypaisa Wallets</SelectItem>
                  <SelectItem value="JAZZCASH" className="text-xs">JazzCash Wallets</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE" className="text-xs">Active Accounts Only</SelectItem>
                  <SelectItem value="INACTIVE" className="text-xs">Deactivated Accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Accounts Table */}
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/75">
                      <TableHead className="text-xs font-semibold">Account Display Name</TableHead>
                      <TableHead className="text-xs font-semibold">Type & Institution</TableHead>
                      <TableHead className="text-xs font-semibold">Account Holder</TableHead>
                      <TableHead className="text-xs font-semibold">Identifier / IBAN</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Current Ledger Balance</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="min-w-[70px] text-center text-xs font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                          <Landmark className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-medium text-xs text-slate-600">No payment accounts found.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Register a commercial bank account or card terminal.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAccounts.map((acc) => {
                        const isRevealed = unmaskedAccountIds[acc.id];
                        return (
                          <TableRow key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell>
                              <div>
                                <p className="font-medium text-xs text-slate-900">{acc.name}</p>
                                <span className="text-[10px] text-slate-500">{(acc.branchIds ?? [acc.branchId]).map((id) => allBranches.find((b) => b.id === id)?.name ?? id).join(", ")}</span>
                                <span className="text-[10px] text-slate-400 block font-mono">ID: {acc.id}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {getAccountTypeIcon(acc.accountType)}
                                <div>
                                  <span className="font-medium text-xs text-slate-800">{acc.providerName}</span>
                                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                                    {acc.accountType === 'OTHER' ? 'POS Terminal' : acc.accountType}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-700">
                              {acc.accountHolder}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
                                <span>{isRevealed ? acc.accountIdentifier || 'N/A' : maskIdentifier(acc.accountIdentifier)}</span>
                                {acc.accountIdentifier && (
                                  <button
                                    type="button"
                                    onClick={() => toggleMask(acc.id)}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                                    title={isRevealed ? 'Mask' : 'Reveal full identifier'}
                                  >
                                    {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-900 text-right tabular-nums">
                              {formatCurrency(acc.currentBalance)}
                            </TableCell>
                            <TableCell>
                              {acc.isActive ? (
                                <Badge variant="success" dot>Active</Badge>
                              ) : (
                                <Badge variant="neutral">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer">
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedAccount(acc);
                                      setAccountFormData({
                                        name: acc.name,
                                        accountType: acc.accountType,
                                        providerName: acc.providerName,
                                        accountHolder: acc.accountHolder,
                                        accountIdentifier: acc.accountIdentifier || '',
                                        isActive: acc.isActive,
                                      });
                                      setIsEditAccountModalOpen(true);
                                    }}
                                    className="text-xs cursor-pointer gap-2"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-[#2254E1]" />
                                    Edit Account
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedAccount(acc);
                                      setIsAccountStatusAlertOpen(true);
                                    }}
                                    className={`text-xs cursor-pointer gap-2 ${acc.isActive ? 'text-rose-600' : 'text-emerald-600'
                                      }`}
                                  >
                                    {acc.isActive ? (
                                      <>
                                        <PowerOff className="w-3.5 h-3.5" />
                                        Deactivate Account
                                      </>
                                    ) : (
                                      <>
                                        <Power className="w-3.5 h-3.5" />
                                        Activate Account
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedAccount(acc);
                                      setIsDeleteAccountAlertOpen(true);
                                    }}
                                    className="text-xs cursor-pointer gap-2 text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    Remove Account
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#2254E1] shrink-0" />
                <span>
                  <strong>Role Isolation Rule:</strong> Branch Accountants can select these active accounts in POS to process client payments, but cannot configure or alter accounts. Direct balance edits are blocked.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: SIMPLE BRANCH TAX SETTINGS --- */}
        {activeTab === 'TAX_SETTINGS' && (
          <div className="space-y-6 mt-4 max-w-3xl">
            <Card padding="lg" className="bg-white border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Percent className="w-5 h-5 text-[#2254E1]" />
                    Branch Sales Tax Settings
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Set the sales tax rate for <strong>{currentBranch?.name || 'this branch'}</strong>. This rate is dynamically applied across all salon services, packages, and POS bill checkouts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={currentBranch?.taxEnabled ? 'primary' : 'neutral'} className="text-xs font-mono py-1 px-2.5">
                    Current Rate: {currentBranch?.taxEnabled ? `${((currentBranch?.taxRate || 0) * 100).toFixed(0)}%` : 'Disabled (0%)'}
                  </Badge>
                </div>
              </div>

              <form onSubmit={handleSaveSimpleBranchTax} className="space-y-5">
                {/* Enable / Disable Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
                  <div className="space-y-0.5">
                    <label className="text-sm font-semibold text-slate-800 cursor-pointer" htmlFor="tax-toggle">
                      Enable Sales Tax on Billing
                    </label>
                    <p className="text-xs text-slate-500">
                      When enabled, tax is automatically calculated on POS invoices and services for this branch.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="tax-toggle"
                      type="checkbox"
                      checked={branchTaxEnabled}
                      onChange={(e) => setBranchTaxEnabled(e.target.checked)}
                      className="w-5 h-5 text-[#2254E1] rounded border-slate-300 focus:ring-[#2254E1] cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      {branchTaxEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Tax Rate & Tax Name Input Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-xs">
                      Branch Tax Rate (%) *
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={branchTaxRateInput}
                        onChange={(e) => setBranchTaxRateInput(e.target.value)}
                        disabled={!branchTaxEnabled}
                        placeholder="e.g. 20"
                        required={branchTaxEnabled}
                        className="h-10 text-sm font-semibold tabular-nums pr-8 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-sm pointer-events-none">
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter percentage (e.g. 20 for 20% SST / GST).
                    </p>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 text-xs">
                      Tax Label / Name
                    </label>
                    <Input
                      type="text"
                      value={branchTaxName}
                      onChange={(e) => setBranchTaxName(e.target.value)}
                      disabled={!branchTaxEnabled}
                      placeholder="e.g. Sindh Sales Tax (SST)"
                      className="h-10 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Appears on customer invoices and receipts.
                    </p>
                  </div>
                </div>

                {/* Information Banner */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-slate-700 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#2254E1] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900">Dynamic Synchronization:</strong> The tax rate configured here (<strong>{branchTaxEnabled ? `${branchTaxRateInput || 0}%` : '0%'}</strong>) is automatically used everywhere — in catalogue services, package builders, and POS sales invoices.
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSavingTax}
                    className="flex items-center gap-2 px-6 h-10 text-xs font-semibold"
                  >
                    {isSavingTax ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving Tax Rate...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Save Branch Tax Settings
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* --- TAB 3: DATA RESET (TESTING & ENVIRONMENT RESTORATION) --- */}
        {activeTab === 'DATA_RESET' && (
          <div className="space-y-6 mt-4">
            <Card padding="md" className="bg-white border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm text-rose-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-rose-600" />
                    Operational & Transactional Data Reset
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Reset testing records (sales invoices, appointments, attendance, cash custody, purchases & ledgers) back to 0.
                  </p>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setResetConfirmationText('');
                    setIsResetModalOpen(true);
                  }}
                >
                  Reset Test Data
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 text-xs text-rose-900 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-rose-950">How Testing Reset Works:</h4>
                    <p className="text-rose-800 text-xs mt-0.5 leading-relaxed">
                      Use this tool during system testing and quality assurance to clear dummy test transactions and reset registers to clean zero states.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-rose-200/80">
                  <div className="bg-white/80 p-3 rounded-lg border border-rose-100">
                    <span className="font-bold text-rose-900 block mb-1">🗑️ What Will Be Reset to 0:</span>
                    <ul className="space-y-1 text-slate-700 list-disc list-inside text-[11px]">
                      <li>Invoices, POS orders, refunds and payment lines</li>
                      <li>Appointments calendar and booking history</li>
                      <li>Cash drawer sessions, movements and daily settlements</li>
                      <li>Attendance clock-ins, punches, leaves and overtime records</li>
                      <li>Inventory purchase bills, supplier returns and supplier ledgers</li>
                      <li>Expenses, general ledger journal movements and audit trails</li>
                      <li>Invoice and Purchase Order sequential numbering counters</li>
                    </ul>
                  </div>

                  <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
                    <span className="font-bold text-emerald-900 block mb-1">🔒 What Remains Completely Safe:</span>
                    <ul className="space-y-1 text-slate-700 list-disc list-inside text-[11px]">
                      <li><strong>Administrator Logins & Credentials:</strong> Kept intact, you will not be logged out.</li>
                      <li><strong>Branch Profiles:</strong> Locations, opening float rules, and branch definitions.</li>
                      <li><strong>Services & Catalogues:</strong> Service list, categories and bundles (unless checked).</li>
                      <li><strong>Staff Members:</strong> Employee profiles and compensation rates (unless checked).</li>
                      <li><strong>Tax Rules & Accounts:</strong> Form configurations and payment account bindings.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB 4: HARDWARE & DEVICE INTEGRATION --- */}
        {activeTab === 'DEVICE_INTEGRATION' && (
          <div className="mt-4">
            <DeviceIntegrationView
              branchId={selectedBranchId}
              branchName={currentBranch?.name}
              onRefresh={loadBranchSettings}
            />
          </div>
        )}
      </div>

      {/* --- MODAL: ADD / EDIT PAYMENT ACCOUNT --- */}
      <Dialog
        open={isAddAccountModalOpen || isEditAccountModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddAccountModalOpen(false);
            setIsEditAccountModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isAddAccountModalOpen ? 'Add Payment Collection Account' : `Edit Account: ${selectedAccount?.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure named commercial account or payment terminal for {currentBranch?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAccount} className="space-y-3.5 text-xs">
            {isAddAccountModalOpen && isSuperAdmin && renderBranchSelection()}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Account Display Name *</label>
              <Input
                value={accountFormData.name}
                onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                placeholder="e.g. Meezan Corporate Current"
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Type *</label>
                <Select
                  value={accountFormData.accountType}
                  onValueChange={(val) => setAccountFormData({ ...accountFormData, accountType: val as any })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK" className="text-xs">Bank Account</SelectItem>
                    <SelectItem value="OTHER" className="text-xs">POS Terminal</SelectItem>
                    <SelectItem value="EASYPAISA" className="text-xs">Easypaisa</SelectItem>
                    <SelectItem value="JAZZCASH" className="text-xs">JazzCash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Provider / Bank *</label>
                <Input
                  value={accountFormData.providerName}
                  onChange={(e) => setAccountFormData({ ...accountFormData, providerName: e.target.value })}
                  placeholder="e.g. Meezan Bank Ltd"
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Account Holder Name *</label>
              <Input
                value={accountFormData.accountHolder}
                onChange={(e) => setAccountFormData({ ...accountFormData, accountHolder: e.target.value })}
                placeholder="e.g. iSysware Salon PVT LTD"
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">IBAN / Terminal Identifier (Optional)</label>
              <Input
                value={accountFormData.accountIdentifier}
                onChange={(e) => setAccountFormData({ ...accountFormData, accountIdentifier: e.target.value })}
                placeholder="e.g. PK36MEZN0001004821 or TID-883201"
                className="font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Masked automatically on screen for cashier safety.
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700 block text-xs">Initial Ledger Balance</span>
                <span className="text-[10px] text-slate-400">New accounts start at PKR 0.00 balance</span>
              </div>
              <span className="font-mono font-semibold text-slate-900">PKR 0.00</span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddAccountModalOpen(false);
                  setIsEditAccountModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                {isAddAccountModalOpen ? 'Register Account' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- MODAL: ADD / EDIT TAX RULE --- */}
      <Dialog
        open={isAddTaxRuleModalOpen || isEditTaxRuleModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddTaxRuleModalOpen(false);
            setIsEditTaxRuleModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isAddTaxRuleModalOpen ? 'Create Branch Tax Rule' : `Edit Tax Rule: ${selectedTaxRule?.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure taxable percentage for treatments and bundles in {currentBranch?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTaxRule} className="space-y-3.5 text-xs">
            {isAddTaxRuleModalOpen && isSuperAdmin && renderBranchSelection()}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Rule Name *</label>
              <Input
                value={taxRuleFormData.name}
                onChange={(e) => setTaxRuleFormData({ ...taxRuleFormData, name: e.target.value })}
                placeholder="e.g. Punjab Sales Tax (PST Standard)"
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Tax Percentage (%) *</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxRuleFormData.rate}
                  onChange={(e) => setTaxRuleFormData({ ...taxRuleFormData, rate: Number(e.target.value) })}
                  required
                  className="pr-8 text-xs font-semibold tabular-nums"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Enter percentage (e.g. 16 for 16.0%, 13 for 13.0%).
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Description (Optional)</label>
              <Input
                value={taxRuleFormData.description}
                onChange={(e) => setTaxRuleFormData({ ...taxRuleFormData, description: e.target.value })}
                placeholder="Applicable provincial sales tax category..."
                className="text-xs"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700 block text-xs">Set as Branch Default Rule</span>
                <span className="text-[10px] text-slate-400">Automatically applies to newly added services</span>
              </div>
              <input
                type="checkbox"
                checked={taxRuleFormData.isBranchDefault}
                onChange={(e) => setTaxRuleFormData({ ...taxRuleFormData, isBranchDefault: e.target.checked })}
                className="w-4 h-4 rounded text-[#2254E1] cursor-pointer"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddTaxRuleModalOpen(false);
                  setIsEditTaxRuleModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                {isAddTaxRuleModalOpen ? 'Create Rule' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- ALERT: TOGGLE PAYMENT ACCOUNT STATUS --- */}
      <AlertDialog open={isAccountStatusAlertOpen} onOpenChange={setIsAccountStatusAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {selectedAccount?.isActive ? 'Deactivate Payment Account?' : 'Activate Payment Account?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              {selectedAccount?.isActive
                ? `Deactivating '${selectedAccount?.name}' will prevent it from receiving new POS collections. Existing balances and transaction histories are strictly preserved.`
                : `Activating '${selectedAccount?.name}' will make it immediately selectable by cashiers in POS billing.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleAccountStatus}
              className={`text-xs ${selectedAccount?.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
              {selectedAccount?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- ALERT: REMOVE PAYMENT ACCOUNT --- */}
      <AlertDialog open={isDeleteAccountAlertOpen} onOpenChange={setIsDeleteAccountAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-rose-600" />
              </div>
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                Remove Payment Account?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to remove <strong>'{selectedAccount?.name}'</strong>?
              <br /><br />
              <span className="text-slate-600 block bg-slate-50 border border-slate-200 rounded p-2.5">
                <strong>Financial Safety Rule:</strong> If this account has never recorded any transactions, it will be permanently deleted. If it has transaction history or an opening balance, it will be deactivated and archived to preserve your financial ledgers and audit records.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAccount} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingAccount}
              onClick={handleDeleteAccount}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              {isDeletingAccount ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Removing...
                </>
              ) : (
                'Confirm Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- ALERT: TOGGLE TAX RULE STATUS --- */}
      <AlertDialog open={isTaxRuleStatusAlertOpen} onOpenChange={setIsTaxRuleStatusAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {selectedTaxRule?.isActive ? 'Deactivate Tax Rule?' : 'Activate Tax Rule?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              {selectedTaxRule?.isActive
                ? `Deactivating '${selectedTaxRule?.name}' will prevent new services from selecting it. Existing historical invoices will not be altered.`
                : `Activating '${selectedTaxRule?.name}' will make it selectable in the service and bundle catalogue.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleTaxRuleStatus}
              className={`text-xs ${selectedTaxRule?.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
              {selectedTaxRule?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- MODAL: RESET TEST DATA CONFIRMATION --- */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-rose-600" />
              </div>
              <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-rose-300">
                Testing Utility
              </Badge>
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Reset Testing & Operational Data
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This will wipe test transactions for <strong>{currentBranch?.name || 'Selected Branch'}</strong> and reset all financial registers and sequence numbers to 0.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Warning Box */}
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/80 text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Permanent Action
              </span>
              <p className="text-[11px] leading-relaxed">
                Sales bills, appointments, attendance, staff loans & advances, payroll runs, cash custody, purchases, and supplier khata will be deleted. Admin logins and branch setup will remain safe.
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              <span className="font-bold text-slate-700 block mb-1">Cleanup Options:</span>
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
                  checked={wipeStaff}
                  onCheckedChange={(val) => setWipeStaff(!!val)}
                />
                <span className="text-rose-700">Delete staff directory profiles (Users/Logins are always preserved)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                <Checkbox
                  checked={wipeCatalogue}
                  onCheckedChange={(val) => setWipeCatalogue(!!val)}
                />
                <span className="text-rose-700">Delete service & inventory product catalogue</span>
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
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isResetting}
              onClick={() => setIsResetModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={resetConfirmationText.trim().toUpperCase() !== 'RESET' || isResetting}
              onClick={handleExecuteDataReset}
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
                  Confirm & Reset All Test Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
