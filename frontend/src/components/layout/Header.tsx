import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  ChevronDown,
  Building2,
  Lock,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeft,
  Calendar,
  RotateCcw,
  Bell,
} from 'lucide-react';
import { ResetDataModal } from '@/components/modals/ResetDataModal';

interface HeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileDrawer: () => void;
  breadcrumbs: Array<{ label: string; href?: string }>;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenMobileDrawer,
  breadcrumbs,
}) => {
  const { user, activeBranchId, allBranches, logout, demoDate, setDemoDate } = useAuth();
  const { navigate } = useRouter();

  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    description: string;
    count: number;
    urgency: 'high' | 'medium' | 'low';
    href: string;
  }>>([]);

  const fetchNotifications = useCallback(() => {
    if (!user || user.role === 'STAFF') return;
    const branchToFetch = (user.role === 'SUPER_ADMIN' && activeBranchId === 'ALL')
      ? (allBranches[0]?.id || '')
      : (user.branchId || activeBranchId || '');
    if (!branchToFetch) return;

    salonService.getAdminDashboardData(branchToFetch)
      .then((data) => {
        setNotifications(data?.pendingActions || []);
      })
      .catch((err) => {
        console.error('Failed to load header notifications:', err);
      });
  }, [user, activeBranchId, allBranches]);

  useEffect(() => {
    fetchNotifications();

    const handleRefresh = () => fetchNotifications();
    window.addEventListener('refresh-notifications', handleRefresh);
    window.addEventListener('refresh-invoices', handleRefresh);
    window.addEventListener('invoice-settled', handleRefresh);
    window.addEventListener('focus', handleRefresh);

    const interval = setInterval(fetchNotifications, 15000);

    return () => {
      window.removeEventListener('refresh-notifications', handleRefresh);
      window.removeEventListener('refresh-invoices', handleRefresh);
      window.removeEventListener('invoice-settled', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      clearInterval(interval);
    };
  }, [fetchNotifications, demoDate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };


  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const roleMeta: Record<string, { label: string; variant: 'primary' | 'secondary' | 'success' | 'warning' | 'default' }> = {
    SUPER_ADMIN: { label: 'Super Admin', variant: 'primary' },
    ADMIN: { label: 'Branch Admin', variant: 'default' },
    ACCOUNTANT: { label: 'Sales & Billing', variant: 'success' },
    STAFF: { label: 'Staff / Stylist', variant: 'warning' },
  };

  const userRole = user ? roleMeta[user.role] : { label: 'User', variant: 'secondary' as const };

  return (
    <header className="sticky top-0 z-30 min-h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-2 shadow-2xs font-sans">
      {/* LEFT ZONE: Toggle button + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileDrawer}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className="hidden lg:flex p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeft className="w-4 h-4 text-slate-600" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Breadcrumb Trail */}
        <nav className="flex min-w-0 items-center text-xs font-medium text-slate-500" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <span className="mx-2 text-slate-300">/</span>}
                {isLast ? (
                  <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-none">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    onClick={() => crumb.href && navigate(crumb.href)}
                    className="hover:text-slate-900 hover:underline transition-colors truncate max-w-[140px] cursor-pointer"
                  >
                    {crumb.label}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* RIGHT ZONE: Branch Selector + Demo Date + User Profile Menu */}
      <div className="flex flex-wrap sm:flex-nowrap w-full sm:w-auto shrink-0 items-center justify-between gap-2 sm:gap-3">
        {/* SHARED DEMO DATE SELECTOR */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100 transition-colors text-xs">
          <Calendar className="w-3.5 h-3.5 text-[#2254E1] shrink-0" />
          <span className="hidden xl:inline text-[11px] font-medium text-slate-500">Date:</span>
          <input
            type="date"
            value={demoDate}
            onChange={(e) => {
              if (e.target.value) {
                setDemoDate(e.target.value);
              }
            }}
            className="text-xs font-semibold text-slate-800 bg-transparent border-none p-0 focus:outline-none focus:ring-0 cursor-pointer w-[115px]"
            title="Operational System Date (changes trigger immediate dashboard and financial reconciliation)"
          />
        </div>

        {/* QUICK RESET DATA BUTTON (VISIBLE IN FRONT FOR TESTING) */}
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/90 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:border-rose-300"
            title="Reset operational & test data (Wipe bills, bookings, cash registers to 0)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="hidden md:inline">Reset Data</span>
          </button>
        )}

        {!isSuperAdmin && (

            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700"
              title="Your assigned branch is fixed by your role permissions."
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline font-semibold">
                {allBranches?.find((b) => b.id === user?.branchId)?.name || user?.branchName || 'Assigned Branch'}
              </span>
              <span className="sm:hidden font-semibold">
                {allBranches?.find((b) => b.id === user?.branchId)?.code || 'Branch'}
              </span>
              <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
            </div>
        )}


        {/* NOTIFICATIONS BELL DROPDOWN */}
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
          <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifications(); }}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-[#2254E1]/20"
                title="Notifications & Operational Alerts"
              >
                <Bell className="w-4 h-4 text-slate-600" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 p-0 font-sans shadow-lg rounded-xl">
              <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
                <div className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#2254E1]" />
                  <span className="text-xs font-bold text-slate-900">Notifications & Alerts</span>
                </div>
                {notifications.length > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {notifications.length} Pending
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">All caught up</span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <p className="text-xs font-semibold text-slate-700">No active alerts</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      All daily collections, invoices and verifications are up to date.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-slate-50/80 transition-colors space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900">{item.title}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                          item.urgency === 'high'
                            ? 'bg-rose-50 text-rose-600 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.urgency === 'high' ? 'High' : 'Action'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{item.description}</p>
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => navigate(item.href)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#2254E1] hover:bg-[#1B3FC5] text-white transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* USER PROFILE MENU using shadcn DropdownMenu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 p-1 sm:px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-[#2254E1]/20"
            >
              <div className="w-8 h-8 rounded-full bg-[#2254E1]/10 text-[#2254E1] border border-[#2254E1]/20 font-bold text-xs flex items-center justify-center shrink-0">
                {user?.name
                  ? user.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0].toUpperCase())
                    .join('')
                  : 'U'}
              </div>

              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[130px]">
                  {user?.name || 'Staff User'}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight truncate max-w-[130px]">
                  {user?.title || userRole.label}
                </p>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72">
            {/* Profile Card Header */}
            <div className="px-3 py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2254E1]/10 text-[#2254E1] border border-[#2254E1]/20 font-bold text-sm flex items-center justify-center shrink-0">
                  {user?.name
                    ? user.name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0].toUpperCase())
                      .join('')
                    : 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  <div className="mt-1">
                    <Badge variant={userRole.variant} size="sm">
                      {userRole.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>



            {/* Clear Operational Data */}
            {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
              <>
                <DropdownMenuItem
                  onClick={() => setIsResetModalOpen(true)}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer font-medium text-xs py-2"
                >
                  <RotateCcw className="w-4 h-4 mr-2 text-rose-500" />
                  <span>Clear Operational Data & Ledgers</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Logout Button */}
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer font-medium py-2"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Log out of SalonOS</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* GLOBAL RESET DATA MODAL */}
      <ResetDataModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
      />
    </header>
  );
};
