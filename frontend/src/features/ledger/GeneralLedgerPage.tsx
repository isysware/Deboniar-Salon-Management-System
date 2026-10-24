import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService, LedgerMovement, GeneralLedgerSummary } from '@/services';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Search,
  Wallet,
  Landmark,
  Scale,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const GeneralLedgerPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();

  // Filters state
  const [channel, setChannel] = useState<'ALL' | 'CASH' | 'BANK'>('ALL');
  const [direction, setDirection] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Data state
  const [movements, setMovements] = useState<LedgerMovement[]>([]);
  const [summary, setSummary] = useState<GeneralLedgerSummary | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveBranchId = user?.role === 'SUPER_ADMIN' ? activeBranchId : user?.branchId;

  const loadLedger = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await salonService.getGeneralLedger({
        branchId: effectiveBranchId === 'ALL' ? undefined : effectiveBranchId,
        channel,
        direction: direction === 'ALL' ? undefined : direction,
        from: fromDate || undefined,
        to: toDate || undefined,
        search: search.trim() || undefined,
        page,
        limit,
      });

      setMovements(res.movements);
      setSummary(res.summary);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch general ledger records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [effectiveBranchId, channel, direction, fromDate, toDate, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLedger();
  };

  const handleResetFilters = () => {
    setChannel('ALL');
    setDirection('ALL');
    setSearch('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const currentBranchName =
    effectiveBranchId === 'ALL'
      ? 'All Locations (Consolidated)'
      : allBranches.find((b) => b.id === effectiveBranchId)?.name || 'Branch Ledger';

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#2254E1]" />
            General Ledger & Cash-Bank Movements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time double-entry audit movements across physical tills, bank accounts, and merchant wallets for {currentBranchName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadLedger}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Financial Metric Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Opening Balance"
          value={formatCurrency(summary?.openingBalance ?? 0)}
          subtitle="Carried forward balance"
          icon={<Scale className="w-4 h-4" />}
          tone="default"
        />

        <StatCard
          title="Total Inflows (In)"
          value={formatCurrency(summary?.totalIn ?? 0)}
          subtitle="Sales, floats & credits"
          icon={<ArrowDownLeft className="w-4 h-4" />}
          tone="success"
        />

        <StatCard
          title="Total Outflows (Out)"
          value={formatCurrency(summary?.totalOut ?? 0)}
          subtitle="Expenses & payouts"
          icon={<ArrowUpRight className="w-4 h-4" />}
          tone="warning"
        />

        <StatCard
          title="Net Movement"
          value={formatCurrency(summary?.netMovement ?? 0)}
          subtitle="Inflows less outflows"
          icon={<Scale className="w-4 h-4" />}
          tone={(summary?.netMovement ?? 0) >= 0 ? 'success' : 'warning'}
        />

        <StatCard
          title="Closing Balance"
          value={formatCurrency(summary?.closingBalance ?? 0)}
          subtitle="Effective running balance"
          icon={<Landmark className="w-4 h-4" />}
          tone="purple"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Channel Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => { setChannel('ALL'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  channel === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Channels
              </button>
              <button
                type="button"
                onClick={() => { setChannel('CASH'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  channel === 'CASH'
                    ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                Cash Drawers
              </button>
              <button
                type="button"
                onClick={() => { setChannel('BANK'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  channel === 'BANK'
                    ? 'bg-white text-[#2254E1] shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                Bank / Wallets
              </button>
            </div>

            {/* Direction Filter */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => { setDirection('ALL'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  direction === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Flows
              </button>
              <button
                type="button"
                onClick={() => { setDirection('IN'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  direction === 'IN' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Inflow (In)
              </button>
              <button
                type="button"
                onClick={() => { setDirection('OUT'); setPage(1); }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  direction === 'OUT' ? 'bg-white text-rose-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                - Outflow (Out)
              </button>
            </div>
          </div>

          {/* Quick Date Range & Reset */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                placeholder="From date"
              />
              <span>to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                placeholder="To date"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search description, reference, operator name, or till..."
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

      {/* Ledger Movements Table */}
      <Card padding="none" className="overflow-hidden">
        {isLoading && movements.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-[2.5px] border-blue-100 border-t-[#2254E1] animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Reconciling general ledger transactions...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs">{error}</div>
        ) : movements.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No Ledger Movements Recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              No financial inflows or disbursements match your selected date range and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="report-records w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Channel / Holder</th>
                  <th className="py-3 px-4">Module / Ref</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4 text-right">Debit (Out)</th>
                  <th className="py-3 px-4 text-right">Credit (In)</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{m.date}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {m.channel === 'CASH' ? (
                          <Badge variant="success" size="sm">
                            Cash Till
                          </Badge>
                        ) : (
                          <Badge variant="primary" size="sm">
                            Bank / Card
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium mt-0.5">{m.holderName}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 text-[11px]">{m.sourceModule}</span>
                      {m.reference && (
                        <div className="text-[11px] text-slate-400 font-mono">{m.reference}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate" title={m.description}>
                      <span className="text-slate-800">{m.description}</span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {m.userName || 'System'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-rose-700">
                      {m.direction === 'OUT' ? formatCurrency(m.amount) : '—'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-medium text-emerald-700">
                      {m.direction === 'IN' ? formatCurrency(m.amount) : '—'}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-bold tabular-nums text-slate-900">
                      {formatCurrency(m.balanceAfter)}
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
              {formatNumber(totalCount)} movements
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
    </div>
  );
};
