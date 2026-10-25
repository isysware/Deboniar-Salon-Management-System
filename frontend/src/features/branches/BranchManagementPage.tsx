import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { Branch } from '@/types/salon';
import { User } from '@/types/auth';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/context/ToastContext';
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
  Building2,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  UserCheck,
  PowerOff,
  Power,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Clock,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
  Shield,
  Users,
} from 'lucide-react';

export const BranchManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  // Route & permission guard: SUPER_ADMIN only
  if (!user || user.role !== 'SUPER_ADMIN') {
    return <AccessDeniedView attemptedPath="/admin/branches" />;
  }

  const [branches, setBranches] = useState<Branch[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);
  const [isDeactivateAlertOpen, setIsDeactivateAlertOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [deactivationBlockers, setDeactivationBlockers] = useState<string[]>([]);
  const [isCheckingBlockers, setIsCheckingBlockers] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: 'Lahore',
    phone: '',
    email: '',
    timezone: 'Asia/Karachi',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [branchLoginEmail, setBranchLoginEmail] = useState('');
  const [branchLoginPassword, setBranchLoginPassword] = useState('');
  const selectedAdmin = adminUsers.find((admin) => admin.id === selectedAdminId);
  const needsBranchCredentials = !!selectedAdmin && (
    (!!selectedAdmin.branchId && selectedAdmin.branchId !== selectedBranch?.id) ||
    branches.some((branch) => branch.id !== selectedBranch?.id && branch.assignedAdminId === selectedAdmin.id)
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allBranches, allUsers] = await Promise.all([
        salonService.getBranches(),
        salonService.getUsers(user),
      ]);
      setBranches(allBranches);
      setAdminUsers(allUsers.filter((u) => u.role === 'ADMIN' && u.isActive));
    } catch (err: any) {
      console.error('Failed to load branches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered branches
  const filteredBranches = branches.filter((branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.phone.includes(searchQuery);

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') return branch.isActive;
    if (statusFilter === 'INACTIVE') return !branch.isActive;
    return true;
  });

  const generateNextBranchCode = (currentList: Branch[] = branches) => {
    let maxNum = 0;
    const existingCodes = new Set(
      currentList
        .map((b) => b.code?.trim().toUpperCase())
        .filter(Boolean) as string[]
    );

    for (const b of currentList) {
      if (!b.code) continue;
      const m = b.code.match(/(\d+)$/);
      if (m) {
        const val = parseInt(m[1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `BR-${String(nextNum).padStart(4, '0')}`;
    while (existingCodes.has(candidate)) {
      nextNum++;
      candidate = `BR-${String(nextNum).padStart(4, '0')}`;
    }
    return candidate;
  };

  const handleOpenAdd = () => {
    const autoCode = generateNextBranchCode(branches);
    setFormData({
      name: '',
      code: autoCode,
      address: '',
      city: 'Lahore',
      phone: '+92 (42) ',
      email: '',
      timezone: 'Asia/Karachi',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      city: branch.city,
      phone: branch.phone,
      email: branch.email || '',
      timezone: branch.timezone || 'Asia/Karachi',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleOpenAssignAdmin = (branch: Branch) => {
    const current = branches.find((b) => b.id === branch.id) || branch;
    setSelectedBranch(current);
    setSelectedAdminId('');
    setBranchLoginEmail('');
    setBranchLoginPassword('');
    setFormError(null);
    setIsAssignAdminModalOpen(true);
  };

  const handleOpenDeactivateAlert = async (branch: Branch) => {
    setSelectedBranch(branch);
    setIsCheckingBlockers(true);
    setIsDeactivateAlertOpen(true);
    try {
      const check = await salonService.checkBranchDeactivationBlockers(branch.id);
      setDeactivationBlockers(check.blockers);
    } catch (err: any) {
      setDeactivationBlockers([err.message || 'Failed to inspect branch dependencies.']);
    } finally {
      setIsCheckingBlockers(false);
    }
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      const msg = 'Branch name and unique branch code are required.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await salonService.createBranch(
        {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          timezone: formData.timezone,
          taxRate: 0.16,
          currency: 'PKR',
          openingCashFloat: 25000.0,
          isActive: true,
        },
        user
      );
      const successMsg = `Branch '${formData.name}' created successfully.`;
      setFormSuccess(successMsg);
      toast.success(successMsg);
      await loadData();
      setTimeout(() => {
        setIsAddModalOpen(false);
      }, 700);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to create branch.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    setFormError(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      const msg = 'Branch name and branch code are required.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await salonService.updateBranch(
        selectedBranch.id,
        {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          timezone: formData.timezone,
        },
        user
      );
      const successMsg = `Branch '${formData.name}' updated successfully.`;
      setFormSuccess(successMsg);
      toast.success(successMsg);
      await loadData();
      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 700);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to update branch.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch || !selectedAdminId) return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      const updated = await salonService.assignBranchAdmin(selectedBranch.id, selectedAdminId, user, needsBranchCredentials ? { email: branchLoginEmail, password: branchLoginPassword } : undefined);
      toast.success('Branch administrator assigned successfully.');
      const [allBranches, allUsers] = await Promise.all([
        salonService.getBranches(),
        salonService.getUsers(user),
      ]);
      setBranches(allBranches);
      setAdminUsers(allUsers.filter((u) => u.role === 'ADMIN' && u.isActive));
      const fresh = allBranches.find((b) => b.id === selectedBranch.id) || updated;
      setSelectedBranch(fresh);
      setSelectedAdminId('');
      setBranchLoginEmail('');
      setBranchLoginPassword('');
    } catch (err: any) {
      const errMsg = err.message || 'Failed to assign branch administrator.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassignAdmin = async (adminId: string) => {
    if (!selectedBranch) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const updated = await salonService.unassignBranchAdmin(selectedBranch.id, adminId, user);
      toast.success('Administrator removed from branch.');
      const [allBranches, allUsers] = await Promise.all([
        salonService.getBranches(),
        salonService.getUsers(user),
      ]);
      setBranches(allBranches);
      setAdminUsers(allUsers.filter((u) => u.role === 'ADMIN' && u.isActive));
      const fresh = allBranches.find((b) => b.id === selectedBranch.id) || updated;
      setSelectedBranch(fresh);
    } catch (err: any) {
      toast.error(err.message || 'Failed to unassign administrator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!selectedBranch) return;
    try {
      await salonService.deactivateBranch(selectedBranch.id, user);
      toast.success(`Branch '${selectedBranch.name}' deactivated.`);
      await loadData();
      setIsDeactivateAlertOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate branch.');
    }
  };

  const handleReactivateBranch = async (branch: Branch) => {
    try {
      await salonService.updateBranch(branch.id, { isActive: true }, user);
      toast.success(`Branch '${branch.name}' reactivated.`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate branch.');
    }
  };

  const handleOpenDeleteAlert = (branch: Branch) => {
    setSelectedBranch(branch);
    setDeleteError(null);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBranch) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await salonService.deleteBranch(selectedBranch.id, user);
      await loadData();
      setIsDeleteAlertOpen(false);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete branch.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Title & Scope Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Super Admin Exclusive
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-medium">Administration</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 mt-1">
            Branches Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure multi-location physical salons, assign branch managers, and audit location active status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Branch
          </Button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="sm" className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Total Branches</p>
            <p className="text-2xl font-semibold text-slate-900 mt-0.5">{branches.length}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-[#2254E1]">
            <Building2 className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="sm" className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Active Locations</p>
            <p className="text-2xl font-semibold text-emerald-700 mt-0.5">
              {branches.filter((b) => b.isActive).length}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card padding="sm" className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Inactive Locations</p>
            <p className="text-2xl font-semibold text-slate-600 mt-0.5">
              {branches.filter((b) => !b.isActive).length}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-500">
            <PowerOff className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search branches by name, code, city, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Filter Status:</span>
          <Select
            value={statusFilter}
            onValueChange={(val: any) => setStatusFilter(val)}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active Only</SelectItem>
              <SelectItem value="INACTIVE">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Branches Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch Name & Code</TableHead>
                <TableHead>Location & Address</TableHead>
                <TableHead>Contact Details</TableHead>
                <TableHead>Assigned Administrator</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBranches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500 text-xs">
                    {searchQuery
                      ? `No salon branches found matching "${searchQuery}".`
                      : 'No branches registered in system yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBranches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#2254E1] shrink-0" />
                        <span>{branch.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Code: <span className="font-semibold text-slate-600">{branch.code}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-medium text-slate-800">{branch.city}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={branch.address}>
                        {branch.address}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-700 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{branch.phone}</span>
                      </div>
                      {branch.email && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{branch.email}</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {branch.assignedAdmins && branch.assignedAdmins.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 max-w-[220px]">
                          {branch.assignedAdmins.map((admin) => (
                            <span
                              key={admin.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-medium text-[#2254E1]"
                              title={admin.email || admin.name}
                            >
                              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                {admin.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate max-w-[120px]">{admin.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : branch.assignedAdminName ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-100 text-[#2254E1] flex items-center justify-center text-[10px] font-bold shrink-0">
                            {branch.assignedAdminName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-slate-900">
                            {branch.assignedAdminName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not Assigned</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{branch.timezone}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={branch.isActive ? 'success' : 'secondary'} dot>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4 text-slate-600" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedBranch(branch);
                              setIsViewModalOpen(true);
                            }}
                            className="cursor-pointer text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            View Branch Details
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(branch)}
                            className="cursor-pointer text-xs"
                          >
                            <Edit className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            Edit Branch
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleOpenAssignAdmin(branch)}
                            className="cursor-pointer text-xs"
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-2 text-blue-600" />
                            Assign Administrator
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {branch.isActive ? (
                            <DropdownMenuItem
                              onClick={() => handleOpenDeactivateAlert(branch)}
                              className="cursor-pointer text-xs text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                            >
                              <PowerOff className="w-3.5 h-3.5 mr-2" />
                              Deactivate Branch
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleReactivateBranch(branch)}
                              className="cursor-pointer text-xs text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700"
                            >
                              <Power className="w-3.5 h-3.5 mr-2" />
                              Reactivate Branch
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => handleOpenDeleteAlert(branch)}
                            className="cursor-pointer text-xs text-rose-600 focus:bg-rose-50 focus:text-rose-700 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete Branch
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

      {/* --- ADD BRANCH DIALOG --- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Salon Branch</DialogTitle>
            <DialogDescription>
              Create an operational physical branch. Unique branch code will be used as the invoice & employee prefix.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBranchSubmit} className="space-y-3.5 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Branch Name *"
                type="text"
                required
                placeholder="e.g. F-7 Markaz Boutique"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                label="Branch Code * (Auto-generated)"
                type="text"
                required
                placeholder="e.g. BR-01"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="City *"
                type="text"
                required
                placeholder="e.g. Islamabad"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />

              <Input
                label="Primary Phone *"
                type="text"
                required
                placeholder="+92 (51) 289-0101"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <Input
              label="Physical Address *"
              type="text"
              required
              placeholder="e.g. Plaza 14-B, Main Jinnah Super, F-7"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Branch Email (Optional)"
                type="email"
                placeholder="islamabad@isysware-salon.pk"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Operating Timezone
                </label>
                <Select
                  value={formData.timezone}
                  onValueChange={(val) => setFormData({ ...formData, timezone: val })}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</SelectItem>
                    <SelectItem value="UTC">UTC (Universal Time)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" isLoading={isSubmitting}>
                Create Branch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- EDIT BRANCH DIALOG --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Salon Branch</DialogTitle>
            <DialogDescription>
              Update address, contact details, or operational status for {selectedBranch?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditBranchSubmit} className="space-y-3.5 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Branch Name *"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                label="Unique Code *"
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="City *"
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />

              <Input
                label="Phone *"
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <Input
              label="Physical Address *"
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Branch Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Operating Timezone
                </label>
                <Select
                  value={formData.timezone}
                  onValueChange={(val) => setFormData({ ...formData, timezone: val })}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</SelectItem>
                    <SelectItem value="UTC">UTC (Universal Time)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- VIEW BRANCH DETAILS DIALOG --- */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#2254E1]" />
              <span>{selectedBranch?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Branch Profile & Operational Configuration
            </DialogDescription>
          </DialogHeader>

          {selectedBranch && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Branch Code</span>
                  <span className="font-semibold text-slate-900">{selectedBranch.code}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <Badge variant={selectedBranch.isActive ? 'success' : 'secondary'} dot>
                    {selectedBranch.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">City</span>
                  <span className="font-semibold text-slate-800">{selectedBranch.city}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Currency</span>
                  <span className="font-semibold text-slate-800">{selectedBranch.currency}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Physical Address:</span>
                    <p className="text-slate-600 mt-0.5">{selectedBranch.address}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700">{selectedBranch.phone}</span>
                </div>

                {selectedBranch.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">{selectedBranch.email}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700">Timezone: {selectedBranch.timezone}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Assigned General Manager</span>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {selectedBranch.assignedAdminName || 'None assigned yet'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- ASSIGN BRANCH ADMIN DIALOG --- */}
      <Dialog open={isAssignAdminModalOpen} onOpenChange={setIsAssignAdminModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Branch Administrators</DialogTitle>
            <DialogDescription>
              Designate branch managers or promote staff members to oversee operations and daily shift settlements for <strong className="text-slate-900">{selectedBranch?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <AlertDescription className="text-xs">{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-2">
            {/* Currently Assigned Administrators */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#2254E1]" />
                  Currently Assigned Administrators ({selectedBranch?.assignedAdmins?.length || (selectedBranch?.assignedAdminName ? 1 : 0)})
                </span>
                <span className="text-[11px] text-slate-400">Multiple administrators supported</span>
              </div>

              {selectedBranch?.assignedAdmins && selectedBranch.assignedAdmins.length > 0 ? (
                <div className="space-y-2">
                  {selectedBranch.assignedAdmins.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2254E1] flex items-center justify-center text-xs font-bold shrink-0">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{admin.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{admin.email || 'No email registered'}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px] shrink-0"
                        onClick={() => handleUnassignAdmin(admin.id)}
                        disabled={isSubmitting}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Unassign
                      </Button>
                    </div>
                  ))}
                </div>
              ) : selectedBranch?.assignedAdminName ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2254E1] flex items-center justify-center text-xs font-bold shrink-0">
                      {selectedBranch.assignedAdminName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{selectedBranch.assignedAdminName}</p>
                      <p className="text-[11px] text-slate-500">Branch Administrator</p>
                    </div>
                  </div>
                  {selectedBranch.assignedAdminId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px] shrink-0"
                      onClick={() => handleUnassignAdmin(selectedBranch.assignedAdminId!)}
                      disabled={isSubmitting}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Unassign
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/70 text-xs text-amber-800">
                  No administrator is currently assigned to this branch.
                </div>
              )}
            </div>

            {/* Form to Assign Administrator Account */}
            <form onSubmit={handleAssignAdminSubmit} className="space-y-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Select Administrator Account
                </label>
                <Select value={selectedAdminId} onValueChange={(id) => { setSelectedAdminId(id); setBranchLoginEmail(''); setBranchLoginPassword(''); }}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Choose an administrator account..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {adminUsers.length > 0 ? (
                      adminUsers.map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          <span className="font-medium text-slate-900">{admin.name}</span>
                          <span className="text-slate-500 text-[11px] ml-1.5">({admin.email})</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">
                            · Current: {admin.branchName || 'Unassigned'}
                          </span>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        No active administrator accounts found.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {needsBranchCredentials && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">Create a separate login for this branch. The existing branch login and access will remain unchanged.</p>
                  <label className="block text-xs font-medium text-slate-700">
                    New branch login email
                    <Input type="email" autoComplete="off" required value={branchLoginEmail} onChange={(e) => setBranchLoginEmail(e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-slate-700">
                    New branch login password
                    <Input type="password" autoComplete="new-password" required minLength={6} maxLength={72} value={branchLoginPassword} onChange={(e) => setBranchLoginPassword(e.target.value)} />
                  </label>
                </div>
              )}

              <Alert variant="info" className="py-2">
                <AlertDescription className="text-xs text-slate-600">
                  Tip: When you create a new Administrator user under <strong>Users & Access</strong> and select this branch, they will automatically appear here as an assigned branch administrator.
                </AlertDescription>
              </Alert>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAssignAdminModalOpen(false)}>
                  Done
                </Button>
                <Button type="submit" variant="default" size="sm" isLoading={isSubmitting} disabled={!selectedAdminId}>
                  Assign Administrator
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- DEACTIVATE CONFIRMATION & BLOCKER VALIDATION --- */}
      <AlertDialog open={isDeactivateAlertOpen} onOpenChange={setIsDeactivateAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Deactivate Branch: {selectedBranch?.name}</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs text-slate-600 pt-1">
                {isCheckingBlockers ? (
                  <div className="flex items-center gap-2 py-4 text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#2254E1]" />
                    <span>Verifying branch operational dependencies...</span>
                  </div>
                ) : deactivationBlockers.length > 0 ? (
                  <div className="space-y-2">
                    <Alert variant="destructive">
                      <AlertTitle className="text-xs font-semibold text-rose-900">
                        Deactivation Blocked by Active Dependencies
                      </AlertTitle>
                      <AlertDescription className="text-xs text-rose-800 mt-1">
                        Cannot deactivate this branch while active accounts or unresolved financial balances remain:
                      </AlertDescription>
                    </Alert>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-rose-800 bg-rose-50/50 p-3 rounded-lg border border-rose-200">
                      {deactivationBlockers.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-500 pt-1">
                      Historical data is strictly protected. Please reassign or deactivate active accounts and settle active drawer balances before deactivating this branch.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p>
                      Are you sure you want to deactivate <strong className="text-slate-900">{selectedBranch?.name}</strong>?
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Historical invoices, audit trails, and payment records will be preserved, but the branch will be hidden from daily POS and appointment creation.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeactivate}
              disabled={isCheckingBlockers || deactivationBlockers.length > 0}
            >
              Confirm Deactivation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- DELETE BRANCH CONFIRMATION --- */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <span>Delete Branch: {selectedBranch?.name}</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-xs text-slate-600 pt-1">
                {deleteError && (
                  <Alert variant="destructive">
                    <AlertTitle className="text-xs font-semibold text-rose-900">
                      Cannot Delete Branch
                    </AlertTitle>
                    <AlertDescription className="text-xs text-rose-800 mt-1">
                      {deleteError}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1.5">
                  <p className="font-semibold text-xs text-rose-900">⚠️ Permanent Branch Deletion</p>
                  <p className="text-[11px] leading-relaxed">
                    Are you sure you want to permanently delete <strong className="text-rose-950 font-bold">{selectedBranch?.name} ({selectedBranch?.code})</strong>?
                  </p>
                  <p className="text-[11px] leading-relaxed text-rose-700">
                    This action will purge this branch and all its operational data permanently from the system. This action <strong>CANNOT</strong> be undone.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
