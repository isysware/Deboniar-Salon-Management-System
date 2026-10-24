import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { User, Role } from '@/types/auth';
import { Branch, StaffMember } from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
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
  ShieldCheck,
  UserCheck,
  UserX,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Building2,
  Copy,
  Check,
  RefreshCw,
  Lock,
  User as UserIcon,
  Trash2,
} from 'lucide-react';

export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  SUPER_ADMIN: 'Super Administrator',
  ADMIN: 'Branch Administrator',
  ACCOUNTANT: 'Sales and Billing',
  STAFF: 'Staff / Stylist',
};

export const UsersAccessPage: React.FC = () => {
  const { user } = useAuth();

  // Role guard: Only SUPER_ADMIN and ADMIN
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/admin/users" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DEACTIVATED'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(isSuperAdmin ? 'ALL' : (user.branchId as string));

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeactivateAlertOpen, setIsDeactivateAlertOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetResult, setResetResult] = useState<{ temporaryPassword: string; message: string } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: (isSuperAdmin ? 'ADMIN' : 'ACCOUNTANT') as Role,
    branchId: isSuperAdmin ? '' : (user.branchId as string),
    staffId: '',
    title: '',
    password: '',
    phone: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedUsers, fetchedBranches, fetchedStaff] = await Promise.all([
        salonService.getUsers(user, branchFilter),
        salonService.getBranches(),
        salonService.getStaffMembers(user, branchFilter),
      ]);
      setUsers(fetchedUsers);
      setBranches(fetchedBranches);
      setStaffList(fetchedStaff);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [branchFilter]);

  // Available staff members for staff linking
  const eligibleStaff = staffList.filter(
    (s) => s.branchId === formData.branchId && s.isActive && !s.hasPortalAccess
  );

  // Filtered users
  const filteredUsers = users.filter((u) => {
    // Search
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery));

    if (!matchesSearch) return false;

    // Role
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

    // Status
    if (statusFilter === 'ACTIVE' && !u.isActive) return false;
    if (statusFilter === 'DEACTIVATED' && u.isActive) return false;

    // Branch
    if (isSuperAdmin && branchFilter !== 'ALL' && u.branchId !== branchFilter) return false;

    return true;
  });

  const handleOpenAdd = () => {
    const defaultBranch = isSuperAdmin ? (branches[0]?.id || '') : (user.branchId as string);
    setFormData({
      name: '',
      email: '',
      role: isSuperAdmin ? 'ADMIN' : 'ACCOUNTANT',
      branchId: defaultBranch,
      staffId: '',
      title: '',
      password: '',
      phone: '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (targetUser: User) => {
    setSelectedUser(targetUser);
    setFormData({
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      branchId: targetUser.branchId as string,
      staffId: targetUser.staffId || '',
      title: targetUser.title,
      password: '',
      phone: targetUser.phone || '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleOpenResetPassword = (targetUser: User) => {
    setSelectedUser(targetUser);
    setResetResult(null);
    setCopiedPass(false);
    setIsResetPasswordModalOpen(true);
  };

  const handleOpenDeactivate = (targetUser: User) => {
    setSelectedUser(targetUser);
    setIsDeactivateAlertOpen(true);
  };

  const handleStaffSelectionChange = (staffId: string) => {
    const matched = staffList.find((s) => s.id === staffId);
    if (matched) {
      setFormData({
        ...formData,
        staffId,
        name: matched.name,
        title: matched.designation,
        phone: matched.phone,
        email: matched.email || `${matched.name.toLowerCase().replace(/\s+/g, '.')}@isysware.com`,
      });
    } else {
      setFormData({ ...formData, staffId });
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.email.trim()) {
      const msg = 'Full name and unique login identifier (email) are required.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    if (formData.role === 'STAFF' && !formData.staffId) {
      const msg = 'Staff portal accounts must reference an existing eligible employee record.';
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await salonService.createUser(
        {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          branchId: isSuperAdmin ? formData.branchId : (user.branchId as string),
          staffId: formData.role === 'STAFF' ? formData.staffId : undefined,
          title: formData.title.trim(),
          password: formData.password.trim() || undefined,
          phone: formData.phone.trim() || undefined,
        },
        user
      );
      const successMsg = `User '${created.name}' (${created.email}) created successfully.`;
      setFormSuccess(successMsg);
      toast.success(successMsg);
      await loadData();
      setTimeout(() => {
        setIsAddModalOpen(false);
      }, 700);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to create user account.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);

    setIsSubmitting(true);
    try {
      await salonService.updateUser(
        selectedUser.id,
        {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          title: formData.title.trim(),
          phone: formData.phone.trim() || undefined,
          ...(isSuperAdmin && {
            role: formData.role,
            branchId: formData.branchId,
          }),
        },
        user
      );
      const successMsg = `User '${formData.name}' updated successfully.`;
      setFormSuccess(successMsg);
      toast.success(successMsg);
      await loadData();
      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 700);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to update user account.';
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmResetPassword = async () => {
    if (!selectedUser) return;
    try {
      const res = await salonService.resetUserPassword(selectedUser.id, user);
      setResetResult(res);
      toast.success(`Password reset generated for ${selectedUser.name}.`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset user password.');
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!selectedUser) return;
    try {
      await salonService.deactivateUser(selectedUser.id, user);
      toast.success(`User '${selectedUser.name}' account deactivated.`);
      await loadData();
      setIsDeactivateAlertOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate account.');
    }
  };

  const handleReactivateUser = async (targetUser: User) => {
    try {
      await salonService.reactivateUser(targetUser.id, user);
      toast.success(`User '${targetUser.name}' account reactivated.`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reactivate account.');
    }
  };

  const handleOpenDelete = (targetUser: User) => {
    setSelectedUser(targetUser);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    try {
      await salonService.deleteUser(selectedUser.id, user);
      toast.success(`User '${selectedUser.name}' account permanently deleted.`);
      await loadData();
      setIsDeleteAlertOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user account.');
    }
  };

  const copyPasswordToClipboard = (pw: string) => {
    navigator.clipboard.writeText(pw);
    setCopiedPass(true);
    toast.success('Password copied to clipboard.');
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const roleBadgeVariants: Record<Role, { variant: 'primary' | 'secondary' | 'success' | 'warning'; label: string }> = {
    SUPER_ADMIN: { variant: 'primary', label: 'Super Admin' },
    ADMIN: { variant: 'secondary', label: 'Branch Admin' },
    ACCOUNTANT: { variant: 'success', label: ROLE_DISPLAY_NAMES.ACCOUNTANT },
    STAFF: { variant: 'warning', label: ROLE_DISPLAY_NAMES.STAFF },
  };

  // Helper check if current actor is permitted to manage target user
  const canManageTarget = (targetUser: User) => {
    if (isSuperAdmin) return true;
    // Admin cannot edit or reset Super Admin or Admin accounts
    if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN') return false;
    return targetUser.branchId === user.branchId;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2254E1] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {isSuperAdmin ? 'Enterprise Access Control' : `Branch Console · ${user.branchName}`}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-medium">Users & Permissions</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 mt-1">
            Users & Access Control
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authenticated portal accounts, branch scopes, and credential provisioning.
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
            Create User Account
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search by name, email, or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Filter for Super Admin */}
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Branch:</span>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[170px] h-9 text-xs">
                  <SelectValue placeholder="Branch Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Role:</span>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                {isSuperAdmin && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
                {isSuperAdmin && <SelectItem value="ADMIN">Branch Admin</SelectItem>}
                <SelectItem value="ACCOUNTANT">{ROLE_DISPLAY_NAMES.ACCOUNTANT}</SelectItem>
                <SelectItem value="STAFF">Staff / Stylist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Status:</span>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="ACTIVE">Active Only</SelectItem>
                <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto w-full">
          <Table className="min-w-[1050px] w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">User Name & Title</TableHead>
                <TableHead className="whitespace-nowrap">Login Identifier</TableHead>
                <TableHead className="whitespace-nowrap">System Role</TableHead>
                <TableHead className="whitespace-nowrap">Assigned Branch</TableHead>
                <TableHead className="whitespace-nowrap">Linked Employee Record</TableHead>
                <TableHead className="whitespace-nowrap">Access Status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500 text-xs">
                    {searchQuery
                      ? `No user accounts found matching "${searchQuery}".`
                      : 'No users registered under the selected filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((targetUser) => {
                  const roleMeta = roleBadgeVariants[targetUser.role];
                  const isActorSelf = targetUser.id === user.id;
                  const isProtectedSuperAdmin = targetUser.role === 'SUPER_ADMIN';
                  const isPermitted = canManageTarget(targetUser);

                  const linkedStaff = targetUser.staffId
                    ? staffList.find((s) => s.id === targetUser.staffId)
                    : null;

                  return (
                    <TableRow key={targetUser.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#2254E1]/10 text-[#2254E1] border border-[#2254E1]/20 font-bold text-xs flex items-center justify-center shrink-0">
                            {targetUser.name
                              ? targetUser.name
                                  .split(' ')
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((n) => n[0].toUpperCase())
                                  .join('')
                              : 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                              <span>{targetUser.name}</span>
                              {isActorSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-[#2254E1] font-bold">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 whitespace-nowrap">{targetUser.title}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <div className="font-mono text-xs text-slate-800 font-medium whitespace-nowrap">
                          {targetUser.email}
                        </div>
                        {targetUser.phone && (
                          <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">{targetUser.phone}</div>
                        )}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <Badge variant={roleMeta.variant} dot className="whitespace-nowrap">
                          {roleMeta.label}
                        </Badge>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <div className="text-xs text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{targetUser.branchName || (targetUser.branchId === 'ALL' ? 'All Branches' : targetUser.branchId)}</span>
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {linkedStaff ? (
                          <div>
                            <span className="text-xs font-semibold text-slate-900 block whitespace-nowrap">
                              {linkedStaff.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                              {linkedStaff.employeeCode} · {linkedStaff.designation}
                            </span>
                          </div>
                        ) : targetUser.role === 'STAFF' ? (
                          <span className="text-xs text-amber-600 italic whitespace-nowrap">Unlinked Staff Record</span>
                        ) : (
                          <span className="text-xs text-slate-400 whitespace-nowrap">Direct System User</span>
                        )}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <Badge variant={targetUser.isActive ? 'success' : 'secondary'} dot className="whitespace-nowrap">
                          {targetUser.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4 text-slate-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(targetUser);
                                setIsViewModalOpen(true);
                              }}
                              className="cursor-pointer text-xs"
                            >
                              <Eye className="w-3.5 h-3.5 mr-2 text-slate-500" />
                              View Account
                            </DropdownMenuItem>

                            {isPermitted && !isProtectedSuperAdmin && (
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(targetUser)}
                                className="cursor-pointer text-xs"
                              >
                                <Edit className="w-3.5 h-3.5 mr-2 text-slate-500" />
                                Edit Account
                              </DropdownMenuItem>
                            )}

                            {isPermitted && (
                              <DropdownMenuItem
                                onClick={() => handleOpenResetPassword(targetUser)}
                                className="cursor-pointer text-xs text-blue-600 focus:bg-blue-50 focus:text-blue-700"
                              >
                                <KeyRound className="w-3.5 h-3.5 mr-2" />
                                Simulated Reset
                              </DropdownMenuItem>
                            )}

                            {isPermitted && !isProtectedSuperAdmin && !isActorSelf && (
                              <>
                                <DropdownMenuSeparator />
                                {targetUser.isActive ? (
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDeactivate(targetUser)}
                                    className="cursor-pointer text-xs text-amber-600 focus:bg-amber-50 focus:text-amber-700"
                                  >
                                    <UserX className="w-3.5 h-3.5 mr-2" />
                                    Deactivate Account
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleReactivateUser(targetUser)}
                                    className="cursor-pointer text-xs text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 mr-2" />
                                    Reactivate Account
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem
                                  onClick={() => handleOpenDelete(targetUser)}
                                  className="cursor-pointer text-xs text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete Account
                                </DropdownMenuItem>
                              </>
                            )}
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

      {/* --- ADD USER MODAL --- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create User Account</DialogTitle>
            <DialogDescription>
              Provision login credentials for administrative or billing portal access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUserSubmit} className="space-y-3.5 py-1">
            {/* Role & Branch Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Portal Role *
                </label>
                <Select
                  value={formData.role}
                  onValueChange={(val: Role) => setFormData({ ...formData, role: val, staffId: '' })}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && <SelectItem value="ADMIN">{ROLE_DISPLAY_NAMES.ADMIN}</SelectItem>}
                    <SelectItem value="ACCOUNTANT">{ROLE_DISPLAY_NAMES.ACCOUNTANT}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Branch Scope *
                </label>
                {isSuperAdmin ? (
                  <Select
                    value={formData.branchId}
                    onValueChange={(val) => setFormData({ ...formData, branchId: val, staffId: '' })}
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                    <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    <span className="truncate">{user.branchName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* If STAFF Role: Required selection of existing eligible staff member */}
            {formData.role === 'STAFF' && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                <label className="block text-xs font-semibold text-amber-900">
                  Select Existing Staff Member *
                </label>
                {eligibleStaff.length === 0 ? (
                  <p className="text-xs text-amber-800">
                    No unlinked staff members found at this branch. All current staff already have portal access or none are registered. You can add new staff in the Staff Directory.
                  </p>
                ) : (
                  <Select value={formData.staffId} onValueChange={handleStaffSelectionChange}>
                    <SelectTrigger className="h-10 text-xs bg-white">
                      <SelectValue placeholder="Choose employee to grant access..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleStaff.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name} ({st.employeeCode}) · {st.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-amber-700">
                  Staff accounts must reference exactly one valid employee record. Selecting an employee pre-fills their details.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Full Name *"
                type="text"
                required
                placeholder="e.g. Tariq Mehmood"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                label="Login Identifier (Email) *"
                type="email"
                required
                placeholder="e.g. tariq.admin@isysware.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Official Title / Position *"
                type="text"
                required
                placeholder="e.g. Senior Floor Manager"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />

              <Input
                label="Phone (Optional)"
                type="text"
                placeholder="+92 (300) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <Input
              label="Temporary Password *"
              type="text"
              placeholder="e.g. Admin@2026"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              helperText="Credentials will be active immediately for login simulation."
            />

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                isLoading={isSubmitting}
                disabled={formData.role === 'STAFF' && !formData.staffId}
              >
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- EDIT USER MODAL --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User Account</DialogTitle>
            <DialogDescription>
              Update profile details for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUserSubmit} className="space-y-3.5 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Full Name *"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                label="Login Identifier (Email) *"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Job Title *"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />

              <Input
                label="Phone"
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            {/* Super Admin can change branch/role, Branch Admin cannot */}
            {isSuperAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Role
                  </label>
                  <Select
                    value={formData.role}
                    onValueChange={(val: Role) => setFormData({ ...formData, role: val })}
                    disabled={selectedUser?.role === 'SUPER_ADMIN'}
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">{ROLE_DISPLAY_NAMES.SUPER_ADMIN}</SelectItem>
                      <SelectItem value="ADMIN">{ROLE_DISPLAY_NAMES.ADMIN}</SelectItem>
                      <SelectItem value="ACCOUNTANT">{ROLE_DISPLAY_NAMES.ACCOUNTANT}</SelectItem>
                      {selectedUser?.role === 'STAFF' && (
                        <SelectItem value="STAFF">{ROLE_DISPLAY_NAMES.STAFF}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Branch Assignment
                  </label>
                  {isSuperAdmin ? (
                    <Select
                      value={formData.branchId}
                      onValueChange={(val) => setFormData({ ...formData, branchId: val })}
                      disabled={selectedUser?.role === 'SUPER_ADMIN'}
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Branches</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                      <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      <span className="truncate">{user.branchName}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

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

      {/* --- SIMULATED PASSWORD RESET MODAL --- */}
      <Dialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-600" />
              <span>Simulated Credential Reset</span>
            </DialogTitle>
            <DialogDescription>
              Generate new login credentials for {selectedUser?.name} ({selectedUser?.email}).
            </DialogDescription>
          </DialogHeader>

          {resetResult ? (
            <div className="space-y-4 py-2">
              <Alert variant="success">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <AlertTitle className="text-xs font-semibold text-emerald-900">
                  Password Reset Successfully
                </AlertTitle>
                <AlertDescription className="text-xs text-emerald-800 mt-1">
                  {resetResult.message}
                </AlertDescription>
              </Alert>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">New Temporary Password:</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-slate-900 bg-white px-3 py-1.5 rounded border border-slate-300">
                    {resetResult.temporaryPassword}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyPasswordToClipboard(resetResult.temporaryPassword)}
                  >
                    {copiedPass ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiedPass ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button variant="default" size="sm" onClick={() => setIsResetPasswordModalOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-xs text-slate-600">
                Are you sure you want to generate a new password for <strong className="text-slate-900">{selectedUser?.name}</strong>?
              </p>
              <Alert variant="info" className="py-2.5">
                <AlertDescription className="text-xs text-slate-600">
                  Security Notice: The newly generated credentials will become active immediately and displayed for copying.
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setIsResetPasswordModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleConfirmResetPassword}>
                  Generate New Password
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* --- DEACTIVATE USER ALERT DIALOG --- */}
      <AlertDialog open={isDeactivateAlertOpen} onOpenChange={setIsDeactivateAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <UserX className="w-5 h-5 text-rose-600" />
              <span>Deactivate Account: {selectedUser?.name}</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs text-slate-600 pt-1">
                <p>
                  Are you sure you want to deactivate login access for <strong className="text-slate-900">{selectedUser?.email}</strong>?
                </p>
                <p className="text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  Deactivating this account will immediately revoke portal access. If an active session is in progress, it will be terminated. Historical transactions, staff payroll logs, and shift audit trails are fully preserved.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeactivate}>
              Deactivate Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- DELETE USER ALERT DIALOG --- */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <span>Delete Account: {selectedUser?.name}</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs text-slate-600 pt-1">
                <p>
                  Are you sure you want to permanently delete the login account for <strong className="text-slate-900">{selectedUser?.email}</strong>?
                </p>
                <p className="text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  <strong>Warning:</strong> This action cannot be undone. The user credentials and login access will be permanently deleted. If linked to an employee profile, employee records and payroll history will be safely preserved.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- VIEW USER MODAL --- */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Account Details</DialogTitle>
            <DialogDescription>
              Security and access scope summary for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{selectedUser.name}</h4>
                  <p className="text-slate-500">{selectedUser.title}</p>
                  <div className="mt-1">
                    <Badge variant={roleBadgeVariants[selectedUser.role].variant} dot>
                      {roleBadgeVariants[selectedUser.role].label}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-white border border-slate-200/80 rounded-lg">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Login Identifier:</span>
                  <span className="font-mono font-medium text-slate-900">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Assigned Branch:</span>
                  <span className="font-medium text-slate-900">{selectedUser.branchName || selectedUser.branchId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Account Status:</span>
                  <Badge variant={selectedUser.isActive ? 'success' : 'secondary'} dot>
                    {selectedUser.isActive ? 'Active' : 'Deactivated'}
                  </Badge>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Created Date:</span>
                  <span className="text-slate-700">{selectedUser.createdAt}</span>
                </div>
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
    </div>
  );
};
