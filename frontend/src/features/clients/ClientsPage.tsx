import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Branch, Client, CustomerSource } from '@/types/salon';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { formatCurrency, formatPhoneNumber, normalizePhoneDigits } from '@/lib/formatters';
import {
  Users,
  Search,
  Plus,
  Filter,
  Eye,
  Edit,
  Archive,
  RotateCcw,
  Calendar,
  Receipt,
  Phone,
  Mail,
  Building2,
  Tag,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClientFormModal } from './components/ClientFormModal';
import { toast } from '@/context/ToastContext';
import { ClientDetailsModal } from './components/ClientDetailsModal';
import { BookingFormModal } from '../appointments/components/BookingFormModal';

export const ClientsPage: React.FC = () => {
  const { user, allBranches } = useAuth();
  const { navigate } = useRouter();

  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [archiveFilter, setArchiveFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [selectedClientIdForDetails, setSelectedClientIdForDetails] = useState<string | null>(null);

  // Quick booking state
  const [bookingClient, setBookingClient] = useState<Client | null>(null);

  // Load branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const loaded = await salonService.getBranches();
        setBranches(loaded);
        if (user?.role === 'SUPER_ADMIN') {
          setSelectedBranchId('ALL');
        } else if (user?.branchId) {
          setSelectedBranchId(user.branchId);
        } else if (loaded.length > 0) {
          setSelectedBranchId(loaded[0].id);
        }
      } catch (err) {
        console.error('Failed to load branches', err);
      }
    }
    loadBranches();
  }, [user]);

  // Load clients
  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const targetBranch = selectedBranchId !== 'ALL' ? selectedBranchId : 'ALL';
      const loaded = await salonService.getClients(targetBranch, user || undefined);
      setClients(loaded);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, user]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Filter clients
  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const normDigits = q.replace(/\D/g, '');

    return clients.filter((client) => {
      // Archive filter
      if (archiveFilter === 'ACTIVE' && client.isArchived) return false;
      if (archiveFilter === 'ARCHIVED' && !client.isArchived) return false;

      // Branch filter
      if (selectedBranchId !== 'ALL' && client.branchId !== selectedBranchId) {
        return false;
      }

      // Source filter
      if (selectedSource !== 'ALL' && client.source !== selectedSource) {
        return false;
      }

      // Search query
      if (q) {
        const nameMatch = client.name.toLowerCase().includes(q);
        const normPhone = normalizePhoneDigits(client.phone);
        const phoneMatch = normDigits ? normPhone.includes(normDigits) : false;
        const emailMatch = client.email?.toLowerCase().includes(q) || false;
        if (!nameMatch && !phoneMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [clients, archiveFilter, selectedBranchId, selectedSource, searchQuery]);

  // Summary KPIs
  const summaryKPIs = useMemo(() => {
    const totalCount = clients.length;
    const activeCount = clients.filter((c) => !c.isArchived).length;
    const totalDues = clients.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
    const totalVisits = clients.reduce((sum, c) => sum + (c.totalVisits || 0), 0);

    return {
      totalCount,
      activeCount,
      totalDues,
      totalVisits,
    };
  }, [clients]);

  // Archive / Restore handler
  const handleToggleArchive = async (client: Client) => {
    const nextStatus = !client.isArchived;
    const actionLabel = nextStatus ? 'archive' : 'restore';
    if (!window.confirm(`Are you sure you want to ${actionLabel} client '${client.name}'? Historical records will be preserved.`)) {
      return;
    }

    try {
      await salonService.archiveClient(client.id, nextStatus, user || undefined);
      toast.success(`Client '${client.name}' ${nextStatus ? 'archived' : 'restored'} successfully.`);
      await fetchClients();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionLabel} client.`);
    }
  };

  const activeBranchName = useMemo(() => {
    if (selectedBranchId === 'ALL') return 'All Branches';
    return branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId;
  }, [selectedBranchId, branches]);

  const getBranchDisplayName = useCallback(
    (branchId: string) => {
      if (!branchId || branchId === 'ALL') return 'All Branches';
      const found = branches.find((b) => b.id === branchId) || allBranches?.find((b) => b.id === branchId);
      return found?.name || 'Warsi Salon';
    },
    [branches, allBranches]
  );

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Customer Directory & History (CRM)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Client registry, lifetime visit frequency, service preferences & outstanding dues.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchClients}
            disabled={isLoading}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setClientToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 h-9 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Customers
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {summaryKPIs.totalCount}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {summaryKPIs.activeCount} active in system
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Completed Visits
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {summaryKPIs.totalVisits}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Cumulative salon visits
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Outstanding Receivables
          </span>
          <span className="text-xl font-bold text-rose-600 mt-1 block">
            {formatCurrency(summaryKPIs.totalDues)}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Uncollected client invoices
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Scope / Branch
          </span>
          <span className="text-base font-bold text-slate-800 mt-1 truncate block">
            {activeBranchName}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">
            Role: {user?.role}
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Live Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search name, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={user?.role !== 'SUPER_ADMIN'}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            >
              {user?.role === 'SUPER_ADMIN' && <option value="ALL">All Branches</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Acquisition Sources</option>
              <option value="WALK_IN">Walk-In</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="TIKTOK">TikTok</option>
              <option value="GOOGLE">Google Search / Maps</option>
              <option value="WORD_OF_MOUTH">Word of Mouth</option>
              <option value="REFERRAL">Client Referral</option>
              <option value="INFLUENCER">Influencer Campaign</option>
              <option value="RETURNING">Returning Regular</option>
              <option value="OTHER">Other Channel</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={archiveFilter}
              onChange={(e) => setArchiveFilter(e.target.value as any)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ACTIVE">Active Customers Only</option>
              <option value="ARCHIVED">Archived Customers</option>
              <option value="ALL">All (Active & Archived)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Customers ({filteredClients.length} Matches)
          </h3>
          <span className="text-xs text-slate-500">
            Showing records for {activeBranchName}
          </span>
        </div>

        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No customers found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search criteria or register a new customer.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setClientToEdit(null);
                setIsFormModalOpen(true);
              }}
              className="mt-4 text-xs font-semibold gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Customer
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="report-records min-w-[1000px] w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 whitespace-nowrap">Customer</th>
                  <th className="py-3 px-4 whitespace-nowrap">Contact</th>
                  <th className="py-3 px-4 whitespace-nowrap">Branch</th>
                  <th className="py-3 px-4 whitespace-nowrap">Acquisition Source</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">Visits</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Outstanding Dues</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  const hasDues = (client.outstandingBalance || 0) > 0;

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50/75 transition-colors cursor-pointer"
                      onClick={() => setSelectedClientIdForDetails(client.id)}
                    >
                      {/* Name & Initials */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{client.name}</div>
                            {client.loyaltyPoints ? (
                              <div className="text-[10px] text-purple-600 font-semibold">
                                {client.loyaltyPoints} loyalty pts
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {formatPhoneNumber(client.phone)}
                        </div>
                        {client.email && (
                          <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            {client.email}
                          </div>
                        )}
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          {getBranchDisplayName(client.branchId)}
                        </span>
                      </td>

                      {/* Acquisition Source */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50">
                          {client.source || 'WALK_IN'}
                        </Badge>
                        {client.sourceDetails && (
                          <div className="text-[10px] text-slate-400 mt-0.5 max-w-[140px] truncate">
                            {client.sourceDetails}
                          </div>
                        )}
                      </td>

                      {/* Visits */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-900">{client.totalVisits || 0}</span>
                        {client.lastVisitDate && (
                          <span className="block text-[10px] text-slate-400">
                            Last: {client.lastVisitDate}
                          </span>
                        )}
                      </td>

                      {/* Outstanding Dues */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {hasDues ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {formatCurrency(client.outstandingBalance)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">PKR 0</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {client.isArchived ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 text-[10px]">
                            Archived
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedClientIdForDetails(client.id)}
                            className="h-7 px-2 text-slate-600 hover:text-blue-600 text-xs gap-1"
                            title="View History & Invoices"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setClientToEdit(client);
                              setIsFormModalOpen(true);
                            }}
                            className="h-7 px-2 text-slate-600 hover:text-blue-600 text-xs gap-1"
                            title="Edit Profile"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBookingClient(client);
                            }}
                            className="h-7 px-2 text-slate-600 hover:text-blue-600 text-xs gap-1"
                            title="New Appointment"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/pos?clientId=${client.id}`)}
                            className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-xs gap-1"
                            title="Open in POS"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleArchive(client)}
                            className="h-7 px-1.5 text-slate-400 hover:text-slate-700 text-xs"
                            title={client.isArchived ? 'Restore Client' : 'Archive Client'}
                          >
                            {client.isArchived ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      <ClientFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setClientToEdit(null);
        }}
        onSuccess={() => {
          setIsFormModalOpen(false);
          setClientToEdit(null);
          fetchClients();
        }}
        clientToEdit={clientToEdit}
        activeBranchId={selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id || ''}
        branches={branches}
      />

      {/* Client Full Details & History Modal */}
      <ClientDetailsModal
        isOpen={Boolean(selectedClientIdForDetails)}
        onClose={() => setSelectedClientIdForDetails(null)}
        clientId={selectedClientIdForDetails}
        onEdit={(cl) => {
          setSelectedClientIdForDetails(null);
          setClientToEdit(cl);
          setIsFormModalOpen(true);
        }}
        onBookAppointment={(cl) => {
          setSelectedClientIdForDetails(null);
          setBookingClient(cl);
        }}
        onOpenPOS={(cl) => {
          setSelectedClientIdForDetails(null);
          navigate(`/pos?clientId=${cl.id}`);
        }}
        onRefreshList={fetchClients}
      />

      {/* Quick Booking Form Modal from Client Directory */}
      {bookingClient && (
        <BookingFormModal
          isOpen={Boolean(bookingClient)}
          onClose={() => setBookingClient(null)}
          onSuccess={() => {
            setBookingClient(null);
            fetchClients();
          }}
          activeBranchId={bookingClient.branchId || branches[0]?.id || ''}
          branches={branches}
        />
      )}
    </div>
  );
};
