import React, { useState, useMemo } from 'react';
import { BranchFinancialMetrics } from '../../../services/salonService';
import { Appointment, Invoice, OnlineAccount, CashDrawer } from '../../../types/salon';
import { formatCurrency, formatNumber } from '../../../lib/formatters';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Calendar,
  Scissors,
  Sparkles,
  Clock,
  ArrowRight,
  TrendingUp,
  Wallet,
  Landmark,
  Receipt,
  CreditCard,
  Plus,
  CheckCircle2,
  Building2,
  ChevronRight,
  ChevronLeft,
  Search,
  UserCheck,
  Layers,
  BarChart3,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface BranchOperationalSectionsProps {
  metrics: BranchFinancialMetrics;
  onlineAccounts: OnlineAccount[];
  todayAppointments: Appointment[];
  recentInvoices: Invoice[];
  cashDrawers: CashDrawer[];
  totalClientsCount?: number;
  totalServicesCount?: number;
  totalAppointmentsCount?: number;
  staffList?: Array<{ id: string; name: string; roleTitle: string }>;
  revenueTrend?: Array<{ label: string; revenue: number; expenses: number; collections: number }>;
  categoryBreakdown?: Array<{ type: string; count: number; revenue: number }>;
  onNavigateAppointments?: () => void;
  onNavigateInvoices?: () => void;
  onNavigateAccounts?: () => void;
  onNavigateSettlement?: () => void;
}

// Cubic bezier smoothing for SVG area graph
function getSmoothCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

export const BranchOperationalSections: React.FC<BranchOperationalSectionsProps> = ({
  metrics,
  onlineAccounts,
  todayAppointments,
  recentInvoices,
  cashDrawers,
  totalClientsCount = 0,
  totalServicesCount = 0,
  totalAppointmentsCount = 0,
  staffList = [],
  revenueTrend = [],
  categoryBreakdown = [],
  onNavigateAppointments,
  onNavigateInvoices,
  onNavigateAccounts,
  onNavigateSettlement,
}) => {
  // Statistics chart active tab
  const [statsTab, setStatsTab] = useState<'SERVICES' | 'PRODUCTS' | 'PACKAGES'>('SERVICES');
  // Day Schedule filter staff
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  // Hovered point on line chart
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

  // Real Category figures from invoice line items
  const categoryStats = useMemo(() => {
    const sType = statsTab === 'SERVICES' ? 'SERVICE' : statsTab === 'PRODUCTS' ? 'PRODUCT' : 'PACKAGE';
    const match = categoryBreakdown.find((c) => c.type === sType);
    return {
      revenue: match?.revenue || 0,
      count: match?.count || 0,
    };
  }, [categoryBreakdown, statsTab]);

  // Purely real monthly data - past months strictly 0 if no invoices exist, no synthetic ratios
  const trendData = useMemo(() => {
    if (revenueTrend && revenueTrend.length > 0) return revenueTrend;
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const isCurrent = i === 0;
      months.push({
        label: d.toLocaleString('en-US', { month: 'short' }),
        revenue: isCurrent ? (metrics.netSales || 0) : 0,
        collections: isCurrent ? (metrics.actualCollections || 0) : 0,
        expenses: isCurrent ? (metrics.totalExpensesPaid || 0) : 0,
      });
    }
    return months;
  }, [revenueTrend, metrics]);

  // Curve data points for Statistics Area Chart (Width: 440, Height: 110)
  const chartPoints = useMemo(() => {
    const width = 440;
    const height = 110;
    const paddingX = 24;
    const paddingY = 16;

    // Strictly real values by selected tab category
    const values = trendData.map((d, idx) => {
      const isCurrent = idx === trendData.length - 1;
      if (statsTab === 'SERVICES') {
        const servRev = categoryBreakdown.find((c) => c.type === 'SERVICE')?.revenue;
        return isCurrent ? (servRev !== undefined ? servRev : d.revenue) : d.revenue;
      }
      if (statsTab === 'PRODUCTS') {
        const prodRev = categoryBreakdown.find((c) => c.type === 'PRODUCT')?.revenue;
        return isCurrent ? (prodRev || 0) : 0;
      }
      if (statsTab === 'PACKAGES') {
        const pkgRev = categoryBreakdown.find((c) => c.type === 'PACKAGE')?.revenue;
        return isCurrent ? (pkgRev || 0) : 0;
      }
      return d.revenue;
    });

    const maxVal = Math.max(...values, 0);
    const minVal = 0;

    const points = values.map((val, idx) => {
      const x = paddingX + (idx / Math.max(values.length - 1, 1)) * (width - 2 * paddingX);
      const y = maxVal > 0
        ? height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - 2 * paddingY)
        : height - paddingY; // Flat baseline when 0
      return { x, y, value: val, label: trendData[idx]?.label || '' };
    });

    const curvePath = maxVal > 0
      ? getSmoothCurvePath(points)
      : `M ${points[0]?.x || paddingX} ${height - paddingY} L ${points[points.length - 1]?.x || width - paddingX} ${height - paddingY}`;
    const lastPt = points[points.length - 1];
    const firstPt = points[0];
    const areaPath = maxVal > 0 && points.length > 0
      ? `${curvePath} L ${lastPt.x} ${height - 5} L ${firstPt.x} ${height - 5} Z`
      : '';

    return { points, curvePath, areaPath, width, height, maxVal };
  }, [trendData, statsTab, categoryBreakdown]);

  // Max value for Bar Chart scaling
  const maxBarValue = useMemo(() => {
    let max = 0;
    trendData.forEach((d) => {
      if (d.revenue > max) max = d.revenue;
      if (d.collections > max) max = d.collections;
      if (d.expenses > max) max = d.expenses;
    });
    return max > 0 ? max : 1000;
  }, [trendData]);

  // Timeline slots for Day Schedule
  const timeSlots = [
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '01:00 PM',
    '02:00 PM',
    '03:00 PM',
    '04:00 PM',
    '05:00 PM',
    '06:00 PM',
  ];

  // Stylists for Day Schedule columns (Strictly real staff from DB)
  const activeStylists = useMemo(() => {
    if (staffList.length > 0) return staffList.slice(0, 6);
    // If not provided, extract unique staff names from appointments
    const staffNames = Array.from(new Set(todayAppointments.map((a) => a.staffName).filter(Boolean)));
    if (staffNames.length > 0) {
      return staffNames.map((name, i) => ({ id: `s-${i}`, name: name as string, roleTitle: 'Stylist' }));
    }
    return [];
  }, [staffList, todayAppointments]);

  // Filtered appointments for timeline
  const filteredAppointments = useMemo(() => {
    if (selectedStaffId === 'ALL') return todayAppointments;
    return todayAppointments.filter((a) => a.staffId === selectedStaffId || a.staffName === selectedStaffId);
  }, [todayAppointments, selectedStaffId]);

  return (
    <div className="space-y-5 font-sans">
      {/* ── 1. TOP OVERVIEW: 4 VIBRANT HIGH-IMPACT GRADIENT METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Clients (Royal Blue SalonOS Gradient) */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#2254E1] via-[#1B44B8] to-[#1236A8] text-white shadow-sm transition-all hover:shadow-md group">
          {/* Stylized Clients / Users Silhouette Watermark */}
          <svg
            className="absolute -right-3 -bottom-3 w-32 h-32 opacity-15 pointer-events-none transition-transform duration-500 group-hover:scale-110"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>

          <div className="relative z-10 flex items-start justify-between">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
              Clients
            </span>
          </div>

          <div className="relative z-10 mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight font-mono">
              {formatNumber(totalClientsCount ?? 0)}
            </h3>
            <p className="text-xs text-white/80 font-medium mt-1">Total Registered Clients</p>
          </div>
        </div>

        {/* Card 2: Total Appointments (Cyan / Sky Gradient) */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#0284C7] via-[#0369A1] to-[#075985] text-white shadow-sm transition-all hover:shadow-md group">
          {/* Stylized Calendar / Appointments Schedule Watermark */}
          <svg
            className="absolute -right-3 -bottom-3 w-32 h-32 opacity-15 pointer-events-none -rotate-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="4" rx="3" />
            <line x1="16" x2="16" y1="2" y2="6" strokeWidth="2" />
            <line x1="8" x2="8" y1="2" y2="6" strokeWidth="2" />
            <line x1="3" x2="21" y1="10" y2="10" strokeWidth="1.5" />
            <path d="m9 16 2 2 4-4" strokeWidth="2" />
          </svg>

          <div className="relative z-10 flex items-start justify-between">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
              Bookings
            </span>
          </div>

          <div className="relative z-10 mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight font-mono">
              {formatNumber(totalAppointmentsCount ?? (todayAppointments ? todayAppointments.length : 0))}
            </h3>
            <p className="text-xs text-white/80 font-medium mt-1">Total Appointments</p>
          </div>
        </div>

        {/* Card 3: Total Services (Indigo / Cobalt Gradient) */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#4338CA] via-[#3730A3] to-[#312E81] text-white shadow-sm transition-all hover:shadow-md group">
          {/* Stylized Salon Scissors Watermark */}
          <svg
            className="absolute -right-2 -bottom-2 w-36 h-36 opacity-20 pointer-events-none rotate-45 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="6" cy="6" r="3.2" />
            <circle cx="6" cy="18" r="3.2" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" strokeWidth="2" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" strokeWidth="2" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" strokeWidth="2" />
          </svg>

          <div className="relative z-10 flex items-start justify-between">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-2xs">
              <Scissors className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
              Services
            </span>
          </div>

          <div className="relative z-10 mt-4">
            <h3 className="text-3xl font-extrabold tracking-tight font-mono">
              {formatNumber(totalServicesCount ?? 0)}
            </h3>
            <p className="text-xs text-white/80 font-medium mt-1">Active Catalogue Services</p>
          </div>
        </div>

        {/* Card 4: Collections & Revenue (Golden Amber / Warm Bronze Gradient) */}
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#D97706] via-[#B45309] to-[#92400E] text-white shadow-sm transition-all hover:shadow-md group">
          {/* Stylized Cash Banknote / Collections Watermark */}
          <svg
            className="absolute -right-3 -bottom-3 w-32 h-32 opacity-15 pointer-events-none -rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="12" x="2" y="6" rx="2" />
            <circle cx="12" cy="12" r="3" strokeWidth="1.8" />
            <path d="M6 12h.01M18 12h.01" strokeWidth="2.5" />
          </svg>

          <div className="relative z-10 flex items-start justify-between">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-2xs">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
              Collections
            </span>
          </div>

          <div className="relative z-10 mt-4">
            <h3 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-mono">
              {formatCurrency(metrics.actualCollections ?? metrics.grossSales ?? 0)}
            </h3>
            <p className="text-xs text-white/80 font-medium mt-1">Total Actual Collections Today</p>
          </div>
        </div>
      </div>

      {/* ── 2. MAIN DASHBOARD CONTENT GRID (MATCHING LUXURY SALON LAYOUT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── LEFT COLUMN: DAY SCHEDULE TIMELINE MATRIX (lg:col-span-5) ── */}
        <div className="lg:col-span-5">
          <Card padding="none" className="bg-white border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Day Schedule</h3>
                <p className="text-[11px] text-slate-400">Appointments booking timeline for today</p>
              </div>

              {onNavigateAppointments && (
                <button
                  type="button"
                  onClick={onNavigateAppointments}
                  className="text-xs font-semibold text-[#2254E1] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Full Agenda
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Staff Filter Selector Pills */}
            <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                Staff:
              </span>
              <button
                type="button"
                onClick={() => setSelectedStaffId('ALL')}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                  selectedStaffId === 'ALL'
                    ? 'bg-[#2254E1] text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              {activeStylists.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStaffId(st.name)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                    selectedStaffId === st.name
                      ? 'bg-[#2254E1] text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  <span>{st.name}</span>
                </button>
              ))}
            </div>

            {/* Timeline Matrix */}
            <div className="p-3 max-h-[510px] overflow-y-auto space-y-2 divide-y divide-slate-100/80">
              {timeSlots.map((time) => {
                // Find appointments for this slot
                const matchedApts = filteredAppointments.filter((a) => {
                  if (!a.startTime) return false;
                  return a.startTime.includes(time.slice(0, 2)) || a.time?.includes(time.slice(0, 2));
                });

                return (
                  <div key={time} className="pt-2 first:pt-0 flex items-start gap-3">
                    {/* Time Label */}
                    <div className="w-16 shrink-0 text-[11px] font-mono font-semibold text-slate-400 pt-1">
                      {time}
                    </div>

                    {/* Booking Slots Lane */}
                    <div className="flex-1 min-w-0">
                      {matchedApts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {matchedApts.map((apt) => (
                            <div
                              key={apt.id}
                              onClick={onNavigateAppointments}
                              className="p-2 rounded-xl bg-blue-50/80 border border-blue-200/80 hover:border-[#2254E1] hover:bg-blue-50 transition-all cursor-pointer group space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-[11px] text-slate-900 group-hover:text-[#2254E1] truncate">
                                  {apt.serviceName || apt.items?.[0]?.name || 'Salon Service'}
                                </span>
                                <span className="text-[9px] font-mono font-bold text-[#2254E1]">
                                  {formatCurrency(apt.price || 0)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span className="truncate">{apt.clientName || 'Walk-in'}</span>
                                <span className="text-slate-400 font-mono text-[9px]">
                                  {apt.staffName ? `• ${apt.staffName}` : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-7 rounded-lg border border-dashed border-slate-200 flex items-center justify-between px-3 text-[10px] text-slate-400 bg-slate-50/40">
                          <span>Available slot</span>
                          <span className="text-[9px] text-slate-300">Open</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── CENTER COLUMN: 2 INTERACTIVE REAL-DATA CHARTS (lg:col-span-4) ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* 1. Statistics (Curved Area Chart) */}
          <Card padding="none" className="bg-white border-slate-200/90 shadow-2xs rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Statistics</h3>
                <p className="text-[11px] text-slate-500">
                  {categoryStats.count} {statsTab.toLowerCase()} recorded · {formatCurrency(categoryStats.revenue)}
                </p>
              </div>

              {/* Tabs: Services, Products, Packages */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold text-slate-600">
                {(['SERVICES', 'PRODUCTS', 'PACKAGES'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatsTab(tab)}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      statsTab === tab
                        ? 'bg-white text-[#2254E1] shadow-2xs font-bold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Curved Area SVG Graph Wrapper */}
            <div className="pt-2">
              <div
                className="relative w-full h-28 cursor-crosshair select-none"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, x / rect.width));
                  const svgX = ratio * chartPoints.width;

                  let closestIdx = 0;
                  let minDiff = Infinity;
                  chartPoints.points.forEach((pt, i) => {
                    const diff = Math.abs(pt.x - svgX);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestIdx = i;
                    }
                  });
                  setHoveredPointIdx(closestIdx);
                }}
                onMouseLeave={() => setHoveredPointIdx(null)}
              >
                {/* Floating Sales Tooltip Card on Hover */}
                {hoveredPointIdx !== null && chartPoints.points[hoveredPointIdx] && (
                  <div
                    className="absolute z-30 pointer-events-none transition-all duration-75 ease-out"
                    style={{
                      left: `${(chartPoints.points[hoveredPointIdx].x / chartPoints.width) * 100}%`,
                      top: `${chartPoints.points[hoveredPointIdx].y < 45 ? 65 : (chartPoints.points[hoveredPointIdx].y / chartPoints.height) * 100}%`,
                      transform: chartPoints.points[hoveredPointIdx].y < 45 ? 'translate(-50%, 0%)' : 'translate(-50%, -120%)',
                    }}
                  >
                    <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl py-1.5 px-3 shadow-xl border border-slate-700/80 text-left whitespace-nowrap min-w-[130px]">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-1 mb-1">
                        <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                          {chartPoints.points[hoveredPointIdx].label}
                        </span>
                        <span className="text-[9px] font-medium text-blue-400 capitalize">
                          {statsTab.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white font-mono">
                          {formatCurrency(chartPoints.points[hoveredPointIdx].value)}
                        </span>
                        {chartPoints.maxVal > 0 && chartPoints.points[hoveredPointIdx].value === chartPoints.maxVal && (
                          <span className="text-[8px] bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-1 py-0.2 rounded font-bold uppercase">
                            Peak
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {chartPoints.points[hoveredPointIdx].value > 0 ? 'Confirmed Sales' : 'No Sales Recorded'}
                      </div>
                    </div>
                    {/* Caret arrow pointing to dot */}
                    {chartPoints.points[hoveredPointIdx].y >= 45 && (
                      <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1 border-r border-b border-slate-700/80" />
                    )}
                  </div>
                )}

                {/* Peak summary indicator when no point is actively hovered */}
                {hoveredPointIdx === null && chartPoints.maxVal > 0 && (
                  <div className="absolute right-2 top-0 bg-[#2254E1]/10 text-[#2254E1] border border-[#2254E1]/20 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 pointer-events-none transition-opacity">
                    <span className="font-mono">{formatCurrency(chartPoints.maxVal)}</span>
                    <span className="text-[9px] font-semibold opacity-75">Peak</span>
                  </div>
                )}

                <svg
                  viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
                  className="w-full h-full overflow-visible pointer-events-none"
                >
                  <defs>
                    <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2254E1" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2254E1" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guidelines */}
                  <line x1="20" y1="20" x2="420" y2="20" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="20" y1="55" x2="420" y2="55" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="20" y1="90" x2="420" y2="90" stroke="#F1F5F9" strokeWidth="1" />

                  {/* Area under curve */}
                  {chartPoints.areaPath && (
                    <path d={chartPoints.areaPath} fill="url(#curveGradient)" />
                  )}

                  {/* Curved line stroke */}
                  {chartPoints.curvePath && (
                    <path
                      d={chartPoints.curvePath}
                      fill="none"
                      stroke="#2254E1"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Vertical Guideline & Halo on Hovered Point */}
                  {hoveredPointIdx !== null && chartPoints.points[hoveredPointIdx] && (
                    <g className="pointer-events-none">
                      <line
                        x1={chartPoints.points[hoveredPointIdx].x}
                        y1={12}
                        x2={chartPoints.points[hoveredPointIdx].x}
                        y2={chartPoints.height - 15}
                        stroke="#2254E1"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        opacity="0.5"
                      />
                      <circle
                        cx={chartPoints.points[hoveredPointIdx].x}
                        cy={chartPoints.points[hoveredPointIdx].y}
                        r="9"
                        fill="#2254E1"
                        opacity="0.2"
                      />
                    </g>
                  )}

                  {/* Data Points */}
                  {chartPoints.points.map((pt, idx) => {
                    const isHovered = hoveredPointIdx === idx;
                    return (
                      <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 5.5 : 4}
                        fill={isHovered ? '#2254E1' : '#FFFFFF'}
                        stroke={isHovered ? '#FFFFFF' : '#2254E1'}
                        strokeWidth={isHovered ? 2.5 : 2}
                        className="transition-all duration-100"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* X-axis Month Labels */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-4 pt-1">
                {trendData.map((d, i) => (
                  <span
                    key={i}
                    className={`transition-colors ${
                      hoveredPointIdx === i ? 'text-[#2254E1] font-bold' : ''
                    }`}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* 2. Revenue Generation (Multi-Bar Comparison Chart) */}
          <Card padding="none" className="bg-white border-slate-200/90 shadow-2xs rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Revenue Generation</h3>
                <p className="text-[11px] text-slate-400">Monthly actual sales, collections & expenses</p>
              </div>

              {/* Legend Indicator */}
              <div className="flex items-center gap-2 text-[10px] font-semibold">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#2254E1]" /> Revenue
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Collections
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Expenses
                </span>
              </div>
            </div>

            {/* Vertical Multi-Bar Display */}
            <div className="pt-2">
              <div className="h-32 flex items-end justify-between gap-2 px-2 border-b border-slate-100 pb-1">
                {trendData.map((item, idx) => {
                  const hasRev = item.revenue > 0;
                  const hasColl = item.collections > 0;
                  const hasExp = item.expenses > 0;
                  const hasAny = hasRev || hasColl || hasExp;

                  const revHeight = hasRev ? Math.max(6, Math.round((item.revenue / maxBarValue) * 100)) : 0;
                  const collHeight = hasColl ? Math.max(6, Math.round((item.collections / maxBarValue) * 100)) : 0;
                  const expHeight = hasExp ? Math.max(6, Math.round((item.expenses / maxBarValue) * 100)) : 0;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative cursor-pointer"
                    >
                      <div className="w-full flex items-end justify-center gap-1 h-full">
                        {hasAny ? (
                          <>
                            {hasRev ? (
                              <div
                                style={{ height: `${revHeight}%` }}
                                className="w-2 sm:w-2.5 bg-[#2254E1] rounded-t-md transition-all group-hover:brightness-110 shadow-2xs"
                                title={`Revenue: ${formatCurrency(item.revenue)}`}
                              />
                            ) : (
                              <div className="w-2 sm:w-2.5 h-0.5 bg-slate-200 rounded-full" />
                            )}
                            {hasColl ? (
                              <div
                                style={{ height: `${collHeight}%` }}
                                className="w-2 sm:w-2.5 bg-emerald-500 rounded-t-md transition-all group-hover:brightness-110 shadow-2xs"
                                title={`Collections: ${formatCurrency(item.collections)}`}
                              />
                            ) : (
                              <div className="w-2 sm:w-2.5 h-0.5 bg-slate-200 rounded-full" />
                            )}
                            {hasExp ? (
                              <div
                                style={{ height: `${expHeight}%` }}
                                className="w-2 sm:w-2.5 bg-amber-400 rounded-t-md transition-all group-hover:brightness-110 shadow-2xs"
                                title={`Expenses: ${formatCurrency(item.expenses)}`}
                              />
                            ) : (
                              <div className="w-2 sm:w-2.5 h-0.5 bg-slate-200 rounded-full" />
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-end h-full pb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block" title="0 activity recorded" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-medium transition-colors ${hasAny ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Summary Pill */}
              <div className="flex items-center justify-between text-[11px] pt-2 text-slate-600">
                <span>Net Operating Flow:</span>
                <span className="font-mono font-bold text-[#2254E1]">
                  {formatCurrency(metrics.netOperatingCashFlow || metrics.actualCollections)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: UPCOMING APPOINTMENTS SIDEBAR (lg:col-span-3) ── */}
        <div className="lg:col-span-3">
          <Card padding="none" className="bg-white border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden p-4 space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2254E1] flex items-center justify-center font-bold">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 tracking-tight">Upcoming Bookings</h3>
                  <p className="text-[10px] text-slate-400">
                    {todayAppointments.length} scheduled for today
                  </p>
                </div>
              </div>
            </div>

            {/* Mini Date Strip - Dynamic 5-day calendar from today */}
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-center">
              {Array.from({ length: 5 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const dayName = d.toLocaleString('en-US', { weekday: 'short' });
                const dayNum = String(d.getDate()).padStart(2, '0');
                const isToday = i === 0;

                return (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded-lg transition-all ${
                      isToday
                        ? 'bg-[#2254E1] text-white shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-[9px] block uppercase">{dayName}</span>
                    <span className="text-xs font-mono font-semibold">{dayNum}</span>
                  </div>
                );
              })}
            </div>

            {/* Appointment Cards List */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5">
              {todayAppointments.length === 0 ? (
                <div className="py-10 text-center space-y-2 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-4">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No bookings yet today</p>
                  <p className="text-[11px] text-slate-400">
                    Use the POS terminal or appointment scheduler to book clients.
                  </p>
                  {onNavigateAppointments && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onNavigateAppointments}
                      className="text-xs h-7 gap-1 border-blue-200 text-[#2254E1] hover:bg-blue-50 mt-1"
                    >
                      <Plus className="w-3 h-3" /> Book Appointment
                    </Button>
                  )}
                </div>
              ) : (
                todayAppointments.slice(0, 6).map((apt) => (
                  <div
                    key={apt.id}
                    onClick={onNavigateAppointments}
                    className="p-2.5 rounded-xl border border-slate-200/80 hover:border-[#2254E1] hover:bg-blue-50/30 transition-all flex items-center justify-between gap-2 cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Stylist / Client Initial Avatar */}
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-[#2254E1] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
                        {apt.clientName?.charAt(0) || 'C'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-[#2254E1]">
                          {apt.clientName || 'Walk-in Client'}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate">
                          {apt.serviceName || apt.items?.[0]?.name || 'Service'}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {apt.startTime || '10:00 AM'} • {apt.staffName || 'Stylist'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-[#2254E1] block">
                        {formatCurrency(apt.price || 0)}
                      </span>
                      <span
                        className={`text-[8px] font-semibold px-1.5 py-0.2 rounded-full uppercase ${
                          apt.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : apt.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {apt.status || 'CONFIRMED'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {onNavigateAppointments && todayAppointments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateAppointments}
                className="w-full text-xs h-7.5 border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                View All Appointments
              </Button>
            )}
          </Card>
        </div>
      </div>

      {/* ── 3. BOTTOM SECTION: FINANCIAL CUSTODY & TRANSACTION RECENT LOGS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
        {/* Physical Cash in Counter Till */}
        <Card padding="md" className="bg-white border-slate-200/90 shadow-2xs rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-600" />
              Physical Cash in Drawer
            </span>
            <Badge variant="success" className="text-[9px]">
              Active Till
            </Badge>
          </div>
          <p className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(metrics.cashInCustody)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Net cash collected today:</span>
            <span className="font-mono font-semibold text-slate-800">{formatCurrency(metrics.cashCollected)}</span>
          </div>
          {onNavigateSettlement && (
            <button
              type="button"
              onClick={onNavigateSettlement}
              className="text-xs font-semibold text-[#2254E1] hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
            >
              Transfer & Settle Cash <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </Card>

        {/* Online Bank & Deposit Accounts */}
        <Card padding="md" className="bg-white border-slate-200/90 shadow-2xs rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-[#2254E1]" />
              Online Bank Balances
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {onlineAccounts.length} account{onlineAccounts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-2xl font-mono font-extrabold text-[#2254E1] tracking-tight">
            {formatCurrency(metrics.onlineBalancesTotal)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Online collected today:</span>
            <span className="font-mono font-semibold text-slate-800">{formatCurrency(metrics.onlineCollected)}</span>
          </div>
          {onNavigateAccounts && (
            <button
              type="button"
              onClick={onNavigateAccounts}
              className="text-xs font-semibold text-[#2254E1] hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
            >
              Account Statements <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </Card>

        {/* Outstanding Receivables & Unpaid Invoices */}
        <Card padding="md" className="bg-white border-slate-200/90 shadow-2xs rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-amber-600" />
              Outstanding Receivables
            </span>
            {metrics.outstandingReceivables > 0 && (
              <Badge variant="warning" className="text-[9px]">
                Due
              </Badge>
            )}
          </div>
          <p className={`text-2xl font-mono font-extrabold tracking-tight ${
            metrics.outstandingReceivables > 0 ? 'text-amber-600' : 'text-slate-900'
          }`}>
            {formatCurrency(metrics.outstandingReceivables)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Discounts granted today:</span>
            <span className="font-mono font-semibold text-slate-800">{formatCurrency(metrics.totalDiscounts)}</span>
          </div>
          {onNavigateInvoices && (
            <button
              type="button"
              onClick={onNavigateInvoices}
              className="text-xs font-semibold text-[#2254E1] hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
            >
              Inspect Invoices & Inflows <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </Card>
      </div>
    </div>
  );
};
