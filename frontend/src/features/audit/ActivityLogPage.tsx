import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService, AuditEventItem } from '@/services';
import { formatNumber } from '@/lib/formatters';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  History,
  FileCode,
} from 'lucide-react';

export const ActivityLogPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  // Filters state
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Data state
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail inspection modal
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);

  const effectiveBranchId = user?.role === 'SUPER_ADMIN' ? activeBranchId : user?.branchId;

  const loadAuditEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await salonService.getAuditEvents({
        branchId: effectiveBranchId === 'ALL' ? undefined : effectiveBranchId,
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        search: search.trim() || undefined,
        page,
        limit,
      });

      setEvents(res.events);
      setTotalCount(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve activity audit records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditEvents();
  }, [effectiveBranchId, actionFilter, entityFilter, fromDate, toDate, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAuditEvents();
  };

  const handleResetFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const currentBranchName =
    effectiveBranchId === 'ALL'
      ? 'All Locations (Consolidated)'
      : allBranches.find((b) => b.id === effectiveBranchId)?.name || 'Branch Audit';

  const getActionBadgeVariant = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('VOID') || act.includes('REVERSE') || act.includes('REJECT')) {
      return 'danger';
    }
    if (act.includes('CREATE') || act.includes('APPROVE') || act.includes('POST')) {
      return 'success';
    }
    if (act.includes('UPDATE') || act.includes('MODIFY')) {
      return 'warning';
    }
    return 'primary';
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#2254E1]" />
            Audit & Activity Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable system audit trail tracking logins, invoice modifications, expense approvals, and staff records for {currentBranchName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadAuditEvents}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Action Select */}
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="VOID">VOID / REVERSE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="LOGIN">LOGIN</option>
            </select>

            {/* Entity Select */}
            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="">All Entities</option>
              <option value="INVOICE">Invoice</option>
              <option value="EXPENSE">Expense</option>
              <option value="SETTLEMENT">Settlement</option>
              <option value="CLIENT">Client</option>
              <option value="STAFF">Staff</option>
              <option value="APPOINTMENT">Appointment</option>
              <option value="INVENTORY">Inventory</option>
              <option value="USER">User / Auth</option>
            </select>
          </div>

          {/* Date Range and Reset */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
              />
              <span>to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user name, action, entity name or record ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2254E1]/20 focus:border-[#2254E1] bg-white"
            />
          </div>
          <Button variant="outline" size="sm" type="submit">
            Search
          </Button>
        </form>
      </Card>

      {/* Events Table */}
      <Card padding="none" className="overflow-hidden">
        {isLoading && events.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#2254E1] animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Scanning immutable audit records...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : events.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No Activity Events Recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              No audit actions match your active filter and date criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="report-records w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {new Date(e.createdAt).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(e.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-[#2254E1] flex items-center justify-center text-[10px] font-bold">
                          {e.userName.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-800">{e.userName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant={getActionBadgeVariant(e.action)} size="sm">
                        {e.action}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                      {e.entity}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {e.entityId ? e.entityId.slice(0, 12) + (e.entityId.length > 12 ? '...' : '') : '—'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {e.branchName}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {(e.before || e.after) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(e)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2254E1] hover:underline cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect Diff
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of{' '}
              {formatNumber(totalCount)} events
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-xs font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* State Diff Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-[#2254E1]" />
                  Audit Record Diff: {selectedEvent.entity} ({selectedEvent.action})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operator: {selectedEvent.userName} · {new Date(selectedEvent.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono">
              {selectedEvent.before && (
                <div>
                  <h4 className="font-semibold text-rose-800 text-[11px] mb-1 uppercase font-sans">
                    Previous State (Before)
                  </h4>
                  <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto text-slate-800 text-[11px]">
                    {JSON.stringify(selectedEvent.before, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEvent.after && (
                <div>
                  <h4 className="font-semibold text-emerald-800 text-[11px] mb-1 uppercase font-sans">
                    New State (After)
                  </h4>
                  <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto text-slate-800 text-[11px]">
                    {JSON.stringify(selectedEvent.after, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
