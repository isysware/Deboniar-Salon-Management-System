import { BranchActionField } from '@/components/BranchActionField';
import { useBranchAction } from '@/hooks/useBranchAction';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import {
  ServiceItem,
  PackageItem,
  PackageComponent,
  ServiceCategory,
  TaxRule,
  TaxTreatment,
  StaffMember,
  Branch,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { formatCurrency } from '@/lib/formatters';
import { allocatePackageRevenue, roundCurrency } from '@/lib/taxCalculations';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Scissors,
  Package,
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
  Clock,
  Coins,
  Percent,
  Users,
  Layers,
  Sparkles,
  Info,
  Trash2,
  X,
  Loader2,
  Upload,
  Download,
} from 'lucide-react';
import { BulkUploadCatalogueModal } from './components/BulkUploadCatalogueModal';

const loadActionCatalogue = async (branchId: string) => {
  const [services, categories] = await Promise.all([salonService.getServices(branchId), salonService.getServiceCategories(branchId)]);
  return { services, categories };
};

export const ServicesPackagesPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  // Role guard: Only SUPER_ADMIN and ADMIN
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/operations/services-packages" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Branch selector state: For Super Admin, use activeBranchId or first branch; for Admin, use user.branchId
  const initialBranchId = isSuperAdmin
    ? (activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '')
    : (user.branchId as string);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'PACKAGES'>('SERVICES');

  // Data collections
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [allServices, setAllServices] = useState<ServiceItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [allPackages, setAllPackages] = useState<PackageItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [branchStaff, setBranchStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [isViewServiceModalOpen, setIsViewServiceModalOpen] = useState(false);
  const [isServiceStatusAlertOpen, setIsServiceStatusAlertOpen] = useState(false);
  const [isDeleteServiceAlertOpen, setIsDeleteServiceAlertOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const [isAddPackageModalOpen, setIsAddPackageModalOpen] = useState(false);
  const [isEditPackageModalOpen, setIsEditPackageModalOpen] = useState(false);
  const [isViewPackageModalOpen, setIsViewPackageModalOpen] = useState(false);
  const [isPackageStatusAlertOpen, setIsPackageStatusAlertOpen] = useState(false);
  const [isDeletePackageAlertOpen, setIsDeletePackageAlertOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Inline category creation inside Service modal
  const [isInlineCategoryAdd, setIsInlineCategoryAdd] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const [inlineCategoryError, setInlineCategoryError] = useState<string | null>(null);
  const [isCreatingInlineCategory, setIsCreatingInlineCategory] = useState(false);

  // Staff Assignment Preview Modal (for packages)
  const [isStaffPreviewModalOpen, setIsStaffPreviewModalOpen] = useState(false);
  const [previewPackage, setPreviewPackage] = useState<PackageItem | null>(null);
  const [previewStaffAssignments, setPreviewStaffAssignments] = useState<Record<string, string>>({});

  // Bulk CSV Upload Modal state
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState<'SERVICES' | 'PACKAGES'>('SERVICES');

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forms state
  const [serviceFormData, setServiceFormData] = useState<{
    code: string;
    name: string;
    category: string;
    durationMinutes: number;
    price: number;
    description: string;
    taxTreatment: TaxTreatment;
    specificTaxRuleId: string;
    isActive: boolean;
  }>({
    code: '',
    name: '',
    category: 'Hair Styling & Cuts',
    durationMinutes: 45,
    price: 3500,
    description: '',
    taxTreatment: 'BRANCH_DEFAULT',
    specificTaxRuleId: '',
    isActive: true,
  });

  const [packageFormData, setPackageFormData] = useState<{
    code: string;
    name: string;
    description: string;
    price: number;
    taxTreatment: TaxTreatment;
    specificTaxRuleId: string;
    isActive: boolean;
    components: PackageComponent[];
  }>({
    code: '',
    name: '',
    description: '',
    price: 0,
    taxTreatment: 'BRANCH_DEFAULT',
    specificTaxRuleId: '',
    isActive: true,
    components: [],
  });

  const actionScope = useBranchAction(isAddServiceModalOpen || isAddPackageModalOpen || isCategoryModalOpen, loadActionCatalogue);
  const formServices = isAddPackageModalOpen ? actionScope.data?.services || [] : services;
  const formCategories = isAddServiceModalOpen || isCategoryModalOpen ? actionScope.data?.categories || [] : categories;
  const formBranchId = isEditServiceModalOpen ? selectedService?.branchId || '' : isEditPackageModalOpen ? selectedPackage?.branchId || '' : actionScope.branchId;
  const formBranch = allBranches.find((b) => b.id === formBranchId);
  const changeActionBranch = (id: string) => {
    actionScope.setBranchId(id);
    setServiceFormData((prev) => ({ ...prev, category: '' }));
    setPackageFormData((prev) => ({ ...prev, components: [] }));
    setInlineCategoryName('');
  };

  // Current branch entity
  const currentBranch = allBranches.find((b) => b.id === selectedBranchId) || allBranches[0];
  const branchTaxRate = currentBranch?.taxEnabled ? (currentBranch.taxRate ?? 0) : 0;
  const branchTaxPercent = (branchTaxRate * 100).toFixed(0);

  // Fetch all data for branch
  const loadBranchCatalogue = async () => {
    if (!selectedBranchId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [srvList, allSrv, pkgList, allPkg, catList, taxList, staffList] = await Promise.all([
        salonService.getServices(selectedBranchId),
        salonService.getServices('ALL'),
        salonService.getPackages(selectedBranchId),
        salonService.getPackages('ALL'),
        salonService.getServiceCategories(selectedBranchId),
        salonService.getTaxRules(selectedBranchId),
        salonService.getStaffMembers(user, selectedBranchId),
      ]);
      setServices(srvList);
      setAllServices(allSrv);
      setPackages(pkgList);
      setAllPackages(allPkg);
      setCategories(catList);
      setTaxRules(taxList);
      setBranchStaff(staffList.filter((s) => s.isActive));
    } catch (err: any) {
      console.error('Failed to load catalogue data:', err);
      setErrorMessage(err.message || 'Failed to load branch catalogue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranchCatalogue();
  }, [selectedBranchId]);

  // Keep branch in sync if activeBranchId changes for Super Admin or when branches load
  useEffect(() => {
    if (isSuperAdmin && activeBranchId !== 'ALL' && activeBranchId !== selectedBranchId) {
      setSelectedBranchId(activeBranchId);
    } else if (!selectedBranchId && allBranches.length > 0) {
      setSelectedBranchId(allBranches[0].id);
    }
  }, [activeBranchId, isSuperAdmin, allBranches]);

  // Filtered Services
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const matchesSearch =
        srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        srv.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        srv.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'ALL' || srv.category === categoryFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && srv.isActive) ||
        (statusFilter === 'INACTIVE' && !srv.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [services, searchQuery, categoryFilter, statusFilter]);

  // Filtered Packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch =
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.description && pkg.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && pkg.isActive) ||
        (statusFilter === 'INACTIVE' && !pkg.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [packages, searchQuery, statusFilter]);

  // Sum of included services standard catalogue prices
  const servicesTotalValue = useMemo(() => {
    return packageFormData.components.reduce(
      (sum, c) => sum + (c.unitPrice || 0) * (c.quantity || 1),
      0
    );
  }, [packageFormData.components]);

  // ── Real CSV Export Handlers ───────────────────────────────────────────────
  const escapeCsvCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportServicesCsv = () => {
    const listToExport = filteredServices.length > 0 ? filteredServices : (services.length > 0 ? services : allServices);
    if (listToExport.length === 0) {
      toast.warning('No services found to export.');
      return;
    }

    const branchName = allBranches.find((b) => b.id === selectedBranchId)?.name || 'Branch';
    const headers = ['Name', 'Category', 'Price', 'Duration', 'Code', 'Description', 'TaxTreatment', 'Status'];
    const rows = listToExport.map((s) => [
      s.name,
      s.category || 'General',
      s.price,
      s.durationMinutes,
      s.code || '',
      s.description || '',
      s.taxTreatment || 'BRANCH_DEFAULT',
      s.isActive ? 'Active' : 'Inactive',
    ]);

    const csvContent = '\uFEFF' + [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Services_${branchName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${listToExport.length} real services to CSV.`);
  };

  const handleExportPackagesCsv = () => {
    const listToExport = filteredPackages.length > 0 ? filteredPackages : (packages.length > 0 ? packages : allPackages);
    if (listToExport.length === 0) {
      toast.warning('No packages found to export.');
      return;
    }

    const branchName = allBranches.find((b) => b.id === selectedBranchId)?.name || 'Branch';
    const headers = ['Name', 'Price', 'Components', 'Code', 'Description', 'TaxTreatment', 'Status'];
    const rows = listToExport.map((p) => {
      const comps = (p.components || [])
        .map((c) => `${c.serviceName}:${c.quantity || 1}:${c.allocationPercentage || 0}`)
        .join(';');
      return [
        p.name,
        p.price,
        comps,
        p.code || '',
        p.description || '',
        p.taxTreatment || 'BRANCH_DEFAULT',
        p.isActive ? 'Active' : 'Inactive',
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Packages_${branchName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${listToExport.length} real packages to CSV.`);
  };

  // Handler: Add category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !actionScope.validate()) return;
    setCategoryError(null);
    try {
      const created = await salonService.createServiceCategory(formBranchId, newCategoryName, user);
      if (isEditServiceModalOpen) setCategories((prev) => [...prev, created]); else actionScope.refresh();
      loadBranchCatalogue();
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      setSuccessMessage(`Category '${created.name}' created successfully.`);
      toast.success(`Category '${created.name}' created successfully!`);
    } catch (err: any) {
      const msg = err.message || 'Failed to create category.';
      setCategoryError(msg);
      toast.error(msg);
    }
  };

  // Handler: Add category inline inside Service modal
  const handleCreateInlineCategory = async () => {
    if (!inlineCategoryName.trim() || (isAddServiceModalOpen && !actionScope.validate())) return;
    setInlineCategoryError(null);
    setIsCreatingInlineCategory(true);
    try {
      const created = await salonService.createServiceCategory(formBranchId, inlineCategoryName.trim(), user);
      if (isEditServiceModalOpen) setCategories((prev) => [...prev, created]); else actionScope.refresh();
      loadBranchCatalogue();
      setServiceFormData((prev) => ({ ...prev, category: created.name }));
      setInlineCategoryName('');
      setIsInlineCategoryAdd(false);
      toast.success(`Category '${created.name}' created successfully!`);
    } catch (err: any) {
      const msg = err.message || 'Failed to create category.';
      setInlineCategoryError(msg);
      toast.error(msg);
    } finally {
      setIsCreatingInlineCategory(false);
    }
  };

  // Handler: Save Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddServiceModalOpen && !actionScope.validate()) return;
    setErrorMessage(null);
    try {
      if (isAddServiceModalOpen) {
        await salonService.createService(
          {
            branchId: formBranchId,
            code: serviceFormData.code,
            name: serviceFormData.name,
            category: serviceFormData.category,
            durationMinutes: Number(serviceFormData.durationMinutes),
            price: Number(serviceFormData.price),
            description: serviceFormData.description,
            taxTreatment: 'BRANCH_DEFAULT',
            specificTaxRuleId: undefined,
            isActive: serviceFormData.isActive,
          },
          user
        );
        const msg = `Service '${serviceFormData.name}' created successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsAddServiceModalOpen(false);
      } else if (isEditServiceModalOpen && selectedService) {
        await salonService.updateService(
          selectedService.id,
          {
            code: serviceFormData.code,
            name: serviceFormData.name,
            category: serviceFormData.category,
            durationMinutes: Number(serviceFormData.durationMinutes),
            price: Number(serviceFormData.price),
            description: serviceFormData.description,
            taxTreatment: 'BRANCH_DEFAULT',
            specificTaxRuleId: undefined,
            isActive: serviceFormData.isActive,
          },
          user
        );
        const msg = `Service '${serviceFormData.name}' updated successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsEditServiceModalOpen(false);
      }
      loadBranchCatalogue();
    } catch (err: any) {
      const msg = err.message || 'Failed to save service.';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  // Handler: Toggle Service Status
  const handleToggleServiceStatus = async () => {
    if (!selectedService) return;
    try {
      const updated = await salonService.toggleServiceStatus(selectedService.id, user);
      const msg = `Service '${updated.name}' is now ${updated.isActive ? 'Active' : 'Inactive'}.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsServiceStatusAlertOpen(false);
      loadBranchCatalogue();
    } catch (err: any) {
      const msg = err.message || 'Failed to change service status.';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  // Handler: Delete Service
  const handleDeleteService = async () => {
    if (!selectedService) return;
    setIsDeleting(true);
    try {
      const res = await salonService.deleteService(selectedService.id, user || undefined);
      toast.success(res.message || `Service '${selectedService.name}' deleted successfully.`);
      setIsDeleteServiceAlertOpen(false);
      setSelectedService(null);
      await loadBranchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete service.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler: Add Component to Package Form
  const handleAddPackageComponent = (serviceId: string) => {
    const srv = formServices.find((s) => s.id === serviceId);
    if (!srv) return;
    if (packageFormData.components.some((c) => c.serviceId === serviceId)) {
      toast.error(`Service '${srv.name}' is already added to this package.`);
      return;
    }

    const newComponents: PackageComponent[] = [
      ...packageFormData.components,
      {
        serviceId: srv.id,
        serviceCode: srv.code,
        serviceName: srv.name,
        quantity: 1,
        allocationPercentage: 0,
        unitPrice: srv.price,
      },
    ];

    // Retain custom package selling price entered by user - do not overwrite with services sum
    setPackageFormData({
      ...packageFormData,
      components: newComponents,
    });
  };

  // Handler: Remove Component from Package Form
  const handleRemovePackageComponent = (index: number) => {
    const next = [...packageFormData.components];
    next.splice(index, 1);
    setPackageFormData({ ...packageFormData, components: next });
  };

  // Handler: Update Component in Package Form
  const handleUpdatePackageComponent = (index: number, fields: Partial<PackageComponent>) => {
    const next = [...packageFormData.components];
    next[index] = { ...next[index], ...fields };
    setPackageFormData({ ...packageFormData, components: next });
  };

  // Handler: Save Package
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddPackageModalOpen && !actionScope.validate()) return;
    setErrorMessage(null);
    try {
      if (packageFormData.components.length === 0) {
        throw new Error('Please add at least one service to the package.');
      }

      // Auto-assign equal allocation percentage in background for schema compliance
      const n = packageFormData.components.length;
      const base = n > 0 ? Math.floor((100 / n) * 100) / 100 : 0;
      let acc = 0;
      const normalizedComponents = packageFormData.components.map((c, i) => {
        let alloc = base;
        if (i === n - 1) {
          alloc = Number((100 - acc).toFixed(2));
        } else {
          acc += base;
        }
        return {
          ...c,
          allocationPercentage: alloc,
        };
      });

      if (isAddPackageModalOpen) {
        await salonService.createPackage(
          {
            branchId: formBranchId,
            code: packageFormData.code,
            name: packageFormData.name,
            description: packageFormData.description,
            price: Number(packageFormData.price),
            components: normalizedComponents,
            taxTreatment: 'BRANCH_DEFAULT',
            specificTaxRuleId: undefined,
            isActive: packageFormData.isActive,
          },
          user
        );
        const msg = `Package '${packageFormData.name}' created successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsAddPackageModalOpen(false);
      } else if (isEditPackageModalOpen && selectedPackage) {
        await salonService.updatePackage(
          selectedPackage.id,
          {
            code: packageFormData.code,
            name: packageFormData.name,
            description: packageFormData.description,
            price: Number(packageFormData.price),
            components: normalizedComponents,
            taxTreatment: 'BRANCH_DEFAULT',
            specificTaxRuleId: undefined,
            isActive: packageFormData.isActive,
          },
          user
        );
        const msg = `Package '${packageFormData.name}' updated successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
        setIsEditPackageModalOpen(false);
      }
      loadBranchCatalogue();
    } catch (err: any) {
      const msg = err.message || 'Failed to save package.';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  // Handler: Toggle Package Status
  const handleTogglePackageStatus = async () => {
    if (!selectedPackage) return;
    try {
      const updated = await salonService.togglePackageStatus(selectedPackage.id, user);
      const msg = `Package '${updated.name}' is now ${updated.isActive ? 'Active' : 'Inactive'}.`;
      setSuccessMessage(msg);
      toast.success(msg);
      setIsPackageStatusAlertOpen(false);
      loadBranchCatalogue();
    } catch (err: any) {
      const msg = err.message || 'Failed to change package status.';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  // Handler: Delete Package
  const handleDeletePackage = async () => {
    if (!selectedPackage) return;
    setIsDeleting(true);
    try {
      const res = await salonService.deletePackage(selectedPackage.id, user || undefined);
      toast.success(res.message || `Package '${selectedPackage.name}' deleted successfully.`);
      setIsDeletePackageAlertOpen(false);
      setSelectedPackage(null);
      await loadBranchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete package.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit Service Modal
  const openEditServiceModal = (srv: ServiceItem) => {
    setSelectedService(srv);
    setServiceFormData({
      code: srv.code,
      name: srv.name,
      category: srv.category,
      durationMinutes: srv.durationMinutes,
      price: srv.price,
      description: srv.description || '',
      taxTreatment: srv.taxTreatment,
      specificTaxRuleId: srv.specificTaxRuleId || '',
      isActive: srv.isActive,
    });
    setInlineCategoryName('');
    setInlineCategoryError(null);
    setIsInlineCategoryAdd(false);
    setIsEditServiceModalOpen(true);
  };

  // Open Edit Package Modal
  const openEditPackageModal = (pkg: PackageItem) => {
    setSelectedPackage(pkg);
    setPackageFormData({
      code: pkg.code,
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price,
      taxTreatment: pkg.taxTreatment,
      specificTaxRuleId: pkg.specificTaxRuleId || '',
      isActive: pkg.isActive,
      components: [...pkg.components],
    });
    setIsEditPackageModalOpen(true);
  };

  // Open Multi-Staff Assignment Preview Modal
  const openStaffPreviewModal = (pkg: PackageItem) => {
    setPreviewPackage(pkg);
    // Seed initial assignments with active branch stylists
    const initialMap: Record<string, string> = {};
    pkg.components.forEach((c, idx) => {
      const assigned = branchStaff[idx % branchStaff.length];
      if (assigned) initialMap[c.serviceId] = assigned.id;
    });
    setPreviewStaffAssignments(initialMap);
    setIsStaffPreviewModalOpen(true);
  };

  // Helper for Tax Treatment label
  const renderTaxTreatmentBadge = (treatment: TaxTreatment, specificRuleId?: string) => {
    if (treatment === 'EXEMPT') {
      return (
        <Badge variant="neutral" className="font-mono text-[10px]">
          Exempt (0%)
        </Badge>
      );
    }
    if (treatment === 'SPECIFIC_RULE') {
      const rule = taxRules.find((r) => r.id === specificRuleId);
      return (
        <Badge variant="warning" className="font-mono text-[10px]">
          {rule ? `${rule.name} (${(rule.rate * 100).toFixed(0)}%)` : 'Specific Rule'}
        </Badge>
      );
    }
    return (
      <Badge variant="primary" className="font-mono text-[10px]">
        Branch Default ({branchTaxPercent}%)
      </Badge>
    );
  };

  const generateNextServiceCode = (currentList: ServiceItem[] = (allServices.length > 0 ? allServices : services)) => {
    let maxNum = 0;
    const existingCodes = new Set(
      currentList
        .map((s) => s.code?.trim().toUpperCase())
        .filter(Boolean) as string[]
    );

    for (const s of currentList) {
      if (!s.code) continue;
      const m = s.code.match(/(\d+)$/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `Svr-${String(nextNum).padStart(4, '0')}`;
    while (existingCodes.has(candidate)) {
      nextNum++;
      candidate = `Svr-${String(nextNum).padStart(4, '0')}`;
    }
    return candidate;
  };

  const generateNextPackageCode = (currentList: PackageItem[] = (allPackages.length > 0 ? allPackages : packages)) => {
    let maxNum = 0;
    const existingCodes = new Set(
      currentList
        .map((p) => p.code?.trim().toUpperCase())
        .filter(Boolean) as string[]
    );

    for (const p of currentList) {
      if (!p.code) continue;
      const m = p.code.match(/(\d+)$/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `PKG-${String(nextNum).padStart(4, '0')}`;
    while (existingCodes.has(candidate)) {
      nextNum++;
      candidate = `PKG-${String(nextNum).padStart(4, '0')}`;
    }
    return candidate;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Services & Package Catalogue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure standalone treatments, bundled packages, and multi-stylist allocation.
          </p>
        </div>

        {/* Super Admin Branch Switcher */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Branch Context:
            </span>
            <Select value={selectedBranchId} onValueChange={(val) => setSelectedBranchId(val)}>
              <SelectTrigger className="w-56 h-9 text-xs">
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
      </div>

      {/* TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-slate-100/80 p-1">
            <TabsTrigger value="SERVICES" className="text-xs gap-2 py-1.5 px-4">
              <Scissors className="w-3.5 h-3.5 text-[#2254E1]" />
              Standalone Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="PACKAGES" className="text-xs gap-2 py-1.5 px-4">
              <Package className="w-3.5 h-3.5 text-[#2254E1]" />
              Bundled Packages ({packages.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2.5">
            {activeTab === 'SERVICES' ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Layers className="w-3.5 h-3.5" />}
                  onClick={() => setIsCategoryModalOpen(true)}
                >
                  Manage Categories
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="w-3.5 h-3.5 text-slate-600" />}
                  onClick={handleExportServicesCsv}
                  title="Export filtered/active services to CSV"
                >
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Upload className="w-3.5 h-3.5 text-[#2254E1]" />}
                  onClick={() => {
                    setBulkUploadType('SERVICES');
                    setIsBulkUploadModalOpen(true);
                  }}
                >
                  Bulk Upload (CSV)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    const defaultCat = categories[0]?.name || '';
                    setServiceFormData({
                      code: generateNextServiceCode(allServices.length > 0 ? allServices : services),
                      name: '',
                      category: defaultCat,
                      durationMinutes: 45,
                      price: 3500,
                      description: '',
                      taxTreatment: 'BRANCH_DEFAULT',
                      specificTaxRuleId: '',
                      isActive: true,
                    });
                    setInlineCategoryName('');
                    setInlineCategoryError(null);
                    setIsInlineCategoryAdd(categories.length === 0);
                    setIsAddServiceModalOpen(true);
                  }}
                >
                  Add Service
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="w-3.5 h-3.5 text-slate-600" />}
                  onClick={handleExportPackagesCsv}
                  title="Export filtered/active packages to CSV"
                >
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Upload className="w-3.5 h-3.5 text-[#2254E1]" />}
                  onClick={() => {
                    setBulkUploadType('PACKAGES');
                    setIsBulkUploadModalOpen(true);
                  }}
                >
                  Bulk Upload (CSV)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setPackageFormData({
                      code: generateNextPackageCode(allPackages.length > 0 ? allPackages : packages),
                      name: '',
                      description: '',
                      price: 0,
                      taxTreatment: 'BRANCH_DEFAULT',
                      specificTaxRuleId: '',
                      isActive: true,
                      components: [],
                    });
                    setIsAddPackageModalOpen(true);
                  }}
                >
                  Add Package
                </Button>
              </>
            )}
          </div>
        </div>

        {/* --- TAB 1: STANDALONE SERVICES --- */}
        {activeTab === 'SERVICES' && (
          <div className="space-y-4 mt-4">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Search by code, title, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Categories ({categories.length})</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE" className="text-xs">Active Treatments Only</SelectItem>
                  <SelectItem value="INACTIVE" className="text-xs">Deactivated Treatments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Services Table */}
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/75">
                      <TableHead className="w-28 text-xs font-semibold">Code</TableHead>
                      <TableHead className="text-xs font-semibold">Service Details</TableHead>
                      <TableHead className="text-xs font-semibold">Category</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Selling Price</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="w-12 text-center text-xs font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                          <Scissors className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-medium text-xs text-slate-600">No services match the active filters.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Add a new service or adjust your search.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredServices.map((srv) => (
                        <TableRow key={srv.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold text-[#2254E1]">
                            {srv.code}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs text-slate-900">{srv.name}</p>
                              {srv.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                  {srv.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600 px-2 py-0.5 rounded bg-slate-100">
                              {srv.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-900 text-right tabular-nums">
                            {formatCurrency(srv.price)}
                          </TableCell>
                          <TableCell>
                            {srv.isActive ? (
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
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedService(srv);
                                    setIsViewServiceModalOpen(true);
                                  }}
                                  className="text-xs cursor-pointer gap-2"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openEditServiceModal(srv)}
                                  className="text-xs cursor-pointer gap-2"
                                >
                                  <Edit className="w-3.5 h-3.5 text-[#2254E1]" />
                                  Edit Service
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedService(srv);
                                    setIsServiceStatusAlertOpen(true);
                                  }}
                                  className={`text-xs cursor-pointer gap-2 ${
                                    srv.isActive ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  {srv.isActive ? (
                                    <>
                                      <PowerOff className="w-3.5 h-3.5" />
                                      Deactivate Service
                                    </>
                                  ) : (
                                    <>
                                      <Power className="w-3.5 h-3.5" />
                                      Activate Service
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedService(srv);
                                    setIsDeleteServiceAlertOpen(true);
                                  }}
                                  className="text-xs cursor-pointer gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete Service
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

        {/* --- TAB 2: PACKAGES --- */}
        {activeTab === 'PACKAGES' && (
          <div className="space-y-4 mt-4">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <Input
                  placeholder="Search package code, bundle name, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Package Statuses</SelectItem>
                  <SelectItem value="ACTIVE" className="text-xs">Active Bundles Only</SelectItem>
                  <SelectItem value="INACTIVE" className="text-xs">Deactivated Bundles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Packages Table */}
            <Card padding="none" className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/75">
                      <TableHead className="w-28 text-xs font-semibold">Code</TableHead>
                      <TableHead className="text-xs font-semibold">Package Bundle</TableHead>
                      <TableHead className="text-xs font-semibold">Included Services Breakdown</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Package Price</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="w-12 text-center text-xs font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPackages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                          <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-medium text-xs text-slate-600">No packages configured for this branch.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Create your first bundled package with services.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPackages.map((pkg) => (
                        <TableRow key={pkg.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold text-purple-700">
                            {pkg.code}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs text-slate-900">{pkg.name}</p>
                              {pkg.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                  {pkg.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 max-w-md">
                              <span className="text-[11px] font-medium text-slate-500">
                                {pkg.components.length} treatments included:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {pkg.components.map((c, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-[#2254E1] border border-blue-200"
                                  >
                                    {c.quantity}x {c.serviceName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-900 text-right tabular-nums">
                            {formatCurrency(pkg.price)}
                          </TableCell>
                          <TableCell>
                            {pkg.isActive ? (
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
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedPackage(pkg);
                                    setIsViewPackageModalOpen(true);
                                  }}
                                  className="text-xs cursor-pointer gap-2"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  View Package Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openStaffPreviewModal(pkg)}
                                  className="text-xs cursor-pointer gap-2 text-purple-700"
                                >
                                  <Users className="w-3.5 h-3.5 text-purple-600" />
                                  Multi-Staff Assignment Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openEditPackageModal(pkg)}
                                  className="text-xs cursor-pointer gap-2"
                                >
                                  <Edit className="w-3.5 h-3.5 text-[#2254E1]" />
                                  Edit Package
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedPackage(pkg);
                                    setIsPackageStatusAlertOpen(true);
                                  }}
                                  className={`text-xs cursor-pointer gap-2 ${
                                    pkg.isActive ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  {pkg.isActive ? (
                                    <>
                                      <PowerOff className="w-3.5 h-3.5" />
                                      Deactivate Package
                                    </>
                                  ) : (
                                    <>
                                      <Power className="w-3.5 h-3.5" />
                                      Activate Package
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedPackage(pkg);
                                    setIsDeletePackageAlertOpen(true);
                                  }}
                                  className="text-xs cursor-pointer gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete Package
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}
      </Tabs>

      {/* --- MODAL: ADD / EDIT SERVICE --- */}
      <Dialog
        open={isAddServiceModalOpen || isEditServiceModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddServiceModalOpen(false);
            setIsEditServiceModalOpen(false);
            setIsInlineCategoryAdd(false);
            setInlineCategoryName('');
            setInlineCategoryError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isAddServiceModalOpen ? 'Add New Salon Service' : `Edit Service: ${selectedService?.code}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure treatment pricing and category classification for {formBranch?.name || 'the selected branch'}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveService} className="space-y-3.5 text-xs">
            {isAddServiceModalOpen && <BranchActionField value={actionScope.branchId} onChange={changeActionBranch} />}
            {isAddServiceModalOpen && actionScope.error && <p role="alert" className="text-xs text-rose-600">{actionScope.error}</p>}
            <fieldset disabled={isAddServiceModalOpen && !actionScope.ready} className="space-y-4 disabled:opacity-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Service Code * (Auto-generated)</label>
                <Input
                  value={serviceFormData.code}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. Svr-0001"
                  required
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 block">Category *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInlineCategoryAdd((prev) => !prev);
                      setInlineCategoryError(null);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isInlineCategoryAdd ? 'Cancel' : 'Add Category'}</span>
                  </button>
                </div>

                {isInlineCategoryAdd && (
                  <div className="p-2 mb-2 bg-blue-50/80 border border-blue-200 rounded-lg space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-900">
                        Create New Category
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsInlineCategoryAdd(false);
                          setInlineCategoryError(null);
                          setInlineCategoryName('');
                        }}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {inlineCategoryError && (
                      <p className="text-[11px] text-rose-600 font-medium">{inlineCategoryError}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={inlineCategoryName}
                        onChange={(e) => setInlineCategoryName(e.target.value)}
                        placeholder="New category name (e.g. Hair Spa)..."
                        className="h-8 text-xs bg-white"
                        disabled={isCreatingInlineCategory}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateInlineCategory();
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 px-3 text-xs bg-[#0047AB] hover:bg-[#003785] text-white shrink-0"
                        onClick={handleCreateInlineCategory}
                        disabled={isCreatingInlineCategory || !inlineCategoryName.trim()}
                      >
                        {isCreatingInlineCategory ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" /> : 'Add'}
                      </Button>
                    </div>
                  </div>
                )}

                <Select
                  value={serviceFormData.category}
                  onValueChange={(val) => setServiceFormData({ ...serviceFormData, category: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={formCategories.length === 0 ? 'No categories (Add above)' : 'Select Category'} />
                  </SelectTrigger>
                  <SelectContent>
                    {formCategories.length === 0 ? (
                      <div className="p-2 text-center text-xs text-slate-400">
                        No categories found
                      </div>
                    ) : (
                      formCategories.map((c) => (
                        <SelectItem key={c.id} value={c.name} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {formCategories.length === 0 && !isInlineCategoryAdd && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    No category found. Please{' '}
                    <button
                      type="button"
                      onClick={() => setIsInlineCategoryAdd(true)}
                      className="underline font-semibold hover:text-amber-800 cursor-pointer"
                    >
                      add a category
                    </button>
                    .
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Service Name *</label>
              <Input
                value={serviceFormData.name}
                onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                placeholder="e.g. Signature Balayage & Gloss"
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Selling Price (PKR) *</label>
              <Input
                type="number"
                min="0"
                step="50"
                value={serviceFormData.price}
                onChange={(e) =>
                  setServiceFormData({ ...serviceFormData, price: Math.max(0, Number(e.target.value)) })
                }
                required
                className="text-xs font-semibold tabular-nums"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Description (Optional)</label>
              <Input
                value={serviceFormData.description}
                onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                placeholder="Brief client-facing service overview..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddServiceModalOpen(false);
                  setIsEditServiceModalOpen(false);
                  setIsInlineCategoryAdd(false);
                  setInlineCategoryName('');
                  setInlineCategoryError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                {isAddServiceModalOpen ? 'Create Service' : 'Save Changes'}
              </Button>
            </DialogFooter>
          
            </fieldset>
</form>
        </DialogContent>
      </Dialog>

      {/* --- MODAL: ADD / EDIT PACKAGE --- */}
      <Dialog
        open={isAddPackageModalOpen || isEditPackageModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddPackageModalOpen(false);
            setIsEditPackageModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isAddPackageModalOpen ? 'Create Bundled Service Package' : `Edit Package: ${selectedPackage?.code}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Combine standalone services into an independently priced bundle for {formBranch?.name || 'the selected branch'}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePackage} className="space-y-4 text-xs">
            {isAddPackageModalOpen && <BranchActionField value={actionScope.branchId} onChange={changeActionBranch} />}
            {isAddPackageModalOpen && actionScope.error && <p role="alert" className="text-xs text-rose-600">{actionScope.error}</p>}
            <fieldset disabled={isAddPackageModalOpen && !actionScope.ready} className="space-y-4 disabled:opacity-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Package Code * (Auto-generated)</label>
                <Input
                  value={packageFormData.code}
                  onChange={(e) => setPackageFormData({ ...packageFormData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. PKG-0001"
                  required
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Package Selling Price (PKR) *</label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={packageFormData.price}
                  onChange={(e) =>
                    setPackageFormData({ ...packageFormData, price: Math.max(0, Number(e.target.value)) })
                  }
                  required
                  className="text-xs font-semibold tabular-nums text-slate-900"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Independently priced custom package rate; preserved as entered.
                </span>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Package Bundle Name *</label>
              <Input
                value={packageFormData.name}
                onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })}
                placeholder="e.g. Bridal Glamour & Hair Transformation"
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Description (Optional)</label>
              <Input
                value={packageFormData.description}
                onChange={(e) => setPackageFormData({ ...packageFormData, description: e.target.value })}
                placeholder="Includes signature blowdry, master balayage, and restorative keratin..."
                className="text-xs"
              />
            </div>

            {/* PACKAGE COMPONENTS BUILDER */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800 text-xs">Included Services</h4>
                  <p className="text-[11px] text-slate-500">
                    Add the services included in this package bundle.
                  </p>
                </div>

                {packageFormData.components.length > 0 && (
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Total Services Value:</span>
                      <span className="font-mono font-semibold text-xs text-slate-800">
                        {formatCurrency(servicesTotalValue)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 py-0 border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer"
                      onClick={() => setPackageFormData((prev) => ({ ...prev, price: servicesTotalValue }))}
                      title="Set package selling price equal to total individual services value"
                    >
                      Use as Price
                    </Button>
                  </div>
                )}
              </div>

              {/* Add Component Selector */}
              <div className="flex items-center gap-2">
                <Select onValueChange={(val) => handleAddPackageComponent(val)}>
                  <SelectTrigger className="h-8 text-xs bg-white flex-1">
                    <SelectValue placeholder="Add an active service from catalogue..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formServices
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.code} · {s.name} ({formatCurrency(s.price)})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Component Rows Table */}
              {packageFormData.components.length === 0 ? (
                <div className="py-6 text-center text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                  <p className="text-xs font-medium text-slate-500">No services added yet.</p>
                  <p className="text-[11px] text-slate-400">Select active services from the dropdown above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {packageFormData.components.map((comp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-slate-200"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-slate-400">{comp.serviceCode}</span>
                          <span>{comp.serviceName}</span>
                        </p>
                        <span className="text-[10px] text-slate-400">
                          Price: {formatCurrency(comp.unitPrice)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500">Qty:</span>
                          <Input
                            type="number"
                            min="1"
                            value={comp.quantity}
                            onChange={(e) => {
                              const newQty = Math.max(1, Number(e.target.value));
                              handleUpdatePackageComponent(idx, { quantity: newQty });
                            }}
                            className="w-14 h-7 text-xs text-center"
                          />
                        </div>

                        <span className="font-mono font-semibold text-xs text-slate-700 w-20 text-right">
                          {formatCurrency((comp.unitPrice || 0) * (comp.quantity || 1))}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemovePackageComponent(idx)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                          title="Remove service"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddPackageModalOpen(false);
                  setIsEditPackageModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={packageFormData.components.length === 0}
              >
                {isAddPackageModalOpen ? 'Create Package' : 'Save Changes'}
              </Button>
            </DialogFooter>
          
            </fieldset>
</form>
        </DialogContent>
      </Dialog>

      {/* --- MODAL: MULTI-STAFF ASSIGNMENT PREVIEW (NON-POSTING) --- */}
      <Dialog open={isStaffPreviewModalOpen} onOpenChange={setIsStaffPreviewModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Multi-Staff Assignment Preview: {previewPackage?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Revenue allocation and stylist commission breakdown for this treatment package.
            </DialogDescription>
          </DialogHeader>

          {previewPackage && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-purple-700 font-semibold uppercase tracking-wider block">
                    Total Package Selling Price
                  </span>
                  <span className="text-lg font-semibold text-slate-900 tabular-nums">
                    {formatCurrency(previewPackage.price)}
                  </span>
                </div>
                <Badge variant="primary">Revenue Distribution Preview</Badge>
              </div>

              <div className="space-y-2.5">
                <span className="font-semibold text-slate-700 block">Assigned Stylists per Component:</span>
                {previewPackage.components.map((comp, idx) => {
                  const allocatedShare = roundCurrency(previewPackage.price * (comp.allocationPercentage / 100));
                  const assignedStaffId = previewStaffAssignments[comp.serviceId] || branchStaff[0]?.id;
                  const assignedStaffMember = branchStaff.find((s) => s.id === assignedStaffId);
                  const estimatedCommission = assignedStaffMember
                    ? roundCurrency(allocatedShare * assignedStaffMember.commissionRate)
                    : 0;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{comp.serviceName}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Net revenue share: <strong className="text-slate-900">{formatCurrency(allocatedShare)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={assignedStaffId}
                          onValueChange={(val) =>
                            setPreviewStaffAssignments({ ...previewStaffAssignments, [comp.serviceId]: val })
                          }
                        >
                          <SelectTrigger className="w-48 h-8 text-xs">
                            <SelectValue placeholder="Assign Stylist" />
                          </SelectTrigger>
                          <SelectContent>
                            {branchStaff.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">
                                {s.name} ({(s.commissionRate * 100).toFixed(0)}% Comm)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="w-20 text-right">
                          <span className="text-[10px] text-slate-400 block">Commission</span>
                          <span className="font-mono text-xs font-semibold text-emerald-700">
                            +{formatCurrency(estimatedCommission)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                <strong>Business Rule:</strong> Each stylist earns commission strictly based on their individual contract tier applied against their attributed share of the package's net selling price.
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsStaffPreviewModalOpen(false)}>
                  Close Preview
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- MODAL: MANAGE CATEGORIES --- */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Branch Service Categories</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Manage custom service categories for {formBranch?.name || 'the selected branch'}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
            <BranchActionField value={actionScope.branchId} onChange={changeActionBranch} />
            {actionScope.error && <p role="alert" className="text-xs text-rose-600">{actionScope.error}</p>}
            <fieldset disabled={!actionScope.ready} className="space-y-4 disabled:opacity-50">
            {categoryError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-xs">{categoryError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2">
              <Input
                placeholder="New category name (e.g. Laser Esthetics)..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-9 text-xs"
                required
              />
              <Button type="submit" variant="primary" size="sm">
                Add
              </Button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pt-2">
              <span className="font-semibold text-slate-700 block text-[11px] uppercase tracking-wider">
                Active Branch Categories ({formCategories.length})
              </span>
              {formCategories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200"
                >
                  <span className="text-xs font-medium text-slate-800">{c.name}</span>
                  <Badge variant="success">Active</Badge>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsCategoryModalOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          
            </fieldset>
</form>
        </DialogContent>
      </Dialog>

      {/* --- ALERT: TOGGLE SERVICE STATUS --- */}
      <AlertDialog open={isServiceStatusAlertOpen} onOpenChange={setIsServiceStatusAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {selectedService?.isActive ? 'Deactivate Service?' : 'Activate Service?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              {selectedService?.isActive
                ? `Deactivating '${selectedService?.name}' will prevent it from being selected in new appointments or sales. Historical records and transactions will be strictly preserved.`
                : `Activating '${selectedService?.name}' will immediately make it selectable for new appointments and billing.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleServiceStatus}
              className={`text-xs ${
                selectedService?.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {selectedService?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- ALERT: TOGGLE PACKAGE STATUS --- */}
      <AlertDialog open={isPackageStatusAlertOpen} onOpenChange={setIsPackageStatusAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {selectedPackage?.isActive ? 'Deactivate Package Bundle?' : 'Activate Package Bundle?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              {selectedPackage?.isActive
                ? `Deactivating '${selectedPackage?.name}' will hide it from active POS sales. Past sales and commissions remain intact.`
                : `Activating '${selectedPackage?.name}' will enable checkout with the configured revenue allocations.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTogglePackageStatus}
              className={`text-xs ${
                selectedPackage?.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {selectedPackage?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- ALERT: DELETE SERVICE --- */}
      <AlertDialog open={isDeleteServiceAlertOpen} onOpenChange={setIsDeleteServiceAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-rose-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Delete Service Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{selectedService?.name}</span> ({selectedService?.code})?
              <br /><br />
              This action cannot be undone. If this service is currently part of any active package bundles, deletion will be safely blocked to maintain catalogue integrity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              disabled={isDeleting}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete Service'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- ALERT: DELETE PACKAGE --- */}
      <AlertDialog open={isDeletePackageAlertOpen} onOpenChange={setIsDeletePackageAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-rose-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Delete Package Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete package bundle <span className="font-semibold text-slate-700">{selectedPackage?.name}</span> ({selectedPackage?.code})?
              <br /><br />
              This will remove the package bundle and its component links. Historical invoices and sales receipts already completed will remain preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs" disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePackage}
              disabled={isDeleting}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? 'Deleting...' : 'Delete Package'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- MODAL: BULK UPLOAD CATALOGUE (SERVICES & PACKAGES) --- */}
      <BulkUploadCatalogueModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        initialType={bulkUploadType}
        branchId={selectedBranchId}
        existingServices={allServices.length > 0 ? allServices : services}
        existingPackages={allPackages.length > 0 ? allPackages : packages}
        onSuccess={loadBranchCatalogue}
      />
    </div>
  );
};
