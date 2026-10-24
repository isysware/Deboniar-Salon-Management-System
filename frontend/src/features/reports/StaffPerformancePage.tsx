import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { salonService } from '../../services';
import {
  StaffPerformanceRecord,
  StaffPerformanceServiceItem,
  Branch,
  StaffMember,
  ServiceItem,
  PackageItem,
} from '../../types/salon';
import {
  Award,
  Filter,
  Search,
  Printer,
  Download,
  Eye,
  X,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { AccessDeniedView } from '../scaffold/AccessDeniedView';
import {
  DATE_PRESETS,
  DatePreset,
  downloadReportCsv,
  downloadReportExcel,
  printReportWindow,
  resolvePreset,
} from './reportUtils';

const selectClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const inputClass =
  'w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB] focus:border-[#0047AB] transition-colors';
const labelClass = 'block text-[11px] font-semibold text-[#0B2545] mb-1.5';

function formatCurrency(val: number): string {
  const num = Number(val) || 0;
  return Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const StaffPerformancePage: React.FC = () => {
  const { user, activeBranchId, allBranches, demoDate } = useAuth();

  // Role guard: Super Admin and Branch Admin only. Accountant and Staff denied.
  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return <AccessDeniedView attemptedPath="/reports/staff-performance" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const businessDate = demoDate || new Date().toISOString().slice(0, 10);
  const defaultMonth = resolvePreset('THIS_MONTH', businessDate)!;

  // Filters State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    isSuperAdmin ? (activeBranchId || 'ALL') : (user.branchId || '')
  );
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [packagesList, setPackagesList] = useState<PackageItem[]>([]);

  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>(defaultMonth.from);
  const [endDate, setEndDate] = useState<string>(defaultMonth.to);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('ALL');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Page state: Only fetch when user explicitly clicks Filter ("filter karna sa aae default nhi")
  const [hasFiltered, setHasFiltered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [performanceRecords, setPerformanceRecords] = useState<StaffPerformanceRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Drilldown Modal State
  const [selectedStaffRecord, setSelectedStaffRecord] = useState<StaffPerformanceRecord | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');
  const [drilldownFilterType, setDrilldownFilterType] = useState<'ALL' | 'SERVICE' | 'PACKAGE_COMPONENT'>('ALL');

  // Load auxiliary data
  useEffect(() => {
    const loadAux = async () => {
      try {
        const branchParam = selectedBranchId || 'ALL';
        const [bList, sList, svcList, pkgList] = await Promise.all([
          allBranches && allBranches.length > 0 ? Promise.resolve(allBranches) : salonService.getBranches(),
          salonService.getStaff(branchParam),
          salonService.getServices(branchParam),
          salonService.getPackages(branchParam),
        ]);
        setBranches(bList);
        setAllStaff(sList);
        setServicesList(svcList);
        setPackagesList(pkgList);
      } catch (err) {
        console.error('Failed to load auxiliary staff performance data', err);
      }
    };
    loadAux();
  }, [allBranches, selectedBranchId]);

  const handlePresetChange = (p: DatePreset) => {
    setPreset(p);
    const r = resolvePreset(p, businessDate);
    if (r) {
      setStartDate(r.from);
      setEndDate(r.to);
    }
  };

  const branchNameDisplay = useMemo(() => {
    if (selectedBranchId === 'ALL') return 'All Campuses';
    return branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId;
  }, [selectedBranchId, branches]);

  // Load performance report data on demand from backend API
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await salonService.getStaffPerformanceReport(
        selectedBranchId,
        startDate,
        endDate,
        {
          staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
          serviceId: selectedServiceId !== 'ALL' ? selectedServiceId : undefined,
          packageId: selectedPackageId !== 'ALL' ? selectedPackageId : undefined,
        },
        user
      );
      setPerformanceRecords(data);
    } catch (err: any) {
      console.error('Failed to load staff performance report', err);
      setErrorMessage(err.message || 'Failed to fetch live staff performance data.');
    } finally {
      setLoading(false);
    }
  }, [
    selectedBranchId,
    startDate,
    endDate,
    selectedStaffId,
    selectedServiceId,
    selectedPackageId,
    user,
  ]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHasFiltered(true);
    fetchReport();
  };

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return performanceRecords;
    const q = searchQuery.toLowerCase().trim();
    return performanceRecords.filter(
      (r) =>
        r.staffName.toLowerCase().includes(q) ||
        r.staffCode.toLowerCase().includes(q) ||
        r.roleTitle.toLowerCase().includes(q)
    );
  }, [performanceRecords, searchQuery]);

  // Consolidated Aggregated Summary Metrics across active records
  const aggregatedMetrics = useMemo(() => {
    let totalDirectServices = 0;
    let totalPackageComponents = 0;
    let totalUnits = 0;
    let totalUniqueClients = 0;
    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalNetSales = 0;
    let totalEstimatedCommission = 0;
    let totalFinalizedCommission = 0;
    let totalAllocatedTips = 0;
    let totalPaidTips = 0;
    let totalOutstandingTips = 0;
    let totalWorkedHours = 0;
    let totalOvertimeMinutes = 0;

    filteredRecords.forEach((r) => {
      totalDirectServices += r.directServicesCount;
      totalPackageComponents += r.packageComponentsCount;
      totalUnits += r.totalServiceUnits;
      totalUniqueClients += r.uniqueClientsCount;
      totalGrossSales += r.attributedGrossSales;
      totalDiscount += r.discountAllocation;
      totalNetSales += r.attributedNetSales;
      totalEstimatedCommission += r.estimatedCommission;
      totalFinalizedCommission += r.finalizedCommission;
      totalAllocatedTips += r.allocatedTips;
      totalPaidTips += r.paidTips;
      totalOutstandingTips += r.outstandingTips;
      totalWorkedHours += r.workedHours;
      totalOvertimeMinutes += r.approvedOvertimeMinutes;
    });

    return {
      totalDirectServices,
      totalPackageComponents,
      totalUnits,
      totalUniqueClients,
      totalGrossSales,
      totalDiscount,
      totalNetSales,
      totalEstimatedCommission,
      totalFinalizedCommission,
      totalAllocatedTips,
      totalPaidTips,
      totalOutstandingTips,
      totalWorkedHours,
      totalOvertimeMinutes,
    };
  }, [filteredRecords]);

  // Filtered detailed services for drilldown modal
  const filteredDetailedServices = useMemo(() => {
    if (!selectedStaffRecord) return [];
    let items = selectedStaffRecord.detailedServices || [];

    if (drilldownFilterType !== 'ALL') {
      items = items.filter((item) => item.itemType === drilldownFilterType);
    }

    if (drilldownSearch.trim()) {
      const q = drilldownSearch.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.serviceName.toLowerCase().includes(q) ||
          item.invoiceNumber.toLowerCase().includes(q) ||
          (item.clientName && item.clientName.toLowerCase().includes(q))
      );
    }

    return items;
  }, [selectedStaffRecord, drilldownFilterType, drilldownSearch]);

  // Export Handlers
  const handleExportCSV = () => {
    if (!filteredRecords.length) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Productivity & Performance Reports'],
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      'Staff Code',
      'Staff Name',
      'Role',
      'Branch',
      'Total Units',
      'Direct Services',
      'Package Components',
      'Unique Clients',
      'Gross Sales (PKR)',
      'Discount (PKR)',
      'Attributed Net Sales (PKR)',
      'Estimated Commission (PKR)',
      'Finalized Commission (PKR)',
      'Allocated Tips (PKR)',
      'Worked Hours',
      'Overtime Minutes',
    ];

    const rows = [
      ...filteredRecords.map((r) => [
        r.staffCode,
        r.staffName,
        r.roleTitle,
        r.branchName,
        r.totalServiceUnits,
        r.directServicesCount,
        r.packageComponentsCount,
        r.uniqueClientsCount,
        r.attributedGrossSales.toFixed(2),
        r.discountAllocation.toFixed(2),
        r.attributedNetSales.toFixed(2),
        r.estimatedCommission.toFixed(2),
        r.finalizedCommission.toFixed(2),
        r.allocatedTips.toFixed(2),
        r.workedHours,
        r.approvedOvertimeMinutes,
      ]),
      [
        'TOTALS',
        '',
        '',
        '',
        aggregatedMetrics.totalUnits,
        aggregatedMetrics.totalDirectServices,
        aggregatedMetrics.totalPackageComponents,
        aggregatedMetrics.totalUniqueClients,
        aggregatedMetrics.totalGrossSales.toFixed(2),
        aggregatedMetrics.totalDiscount.toFixed(2),
        aggregatedMetrics.totalNetSales.toFixed(2),
        aggregatedMetrics.totalEstimatedCommission.toFixed(2),
        aggregatedMetrics.totalFinalizedCommission.toFixed(2),
        aggregatedMetrics.totalAllocatedTips.toFixed(2),
        aggregatedMetrics.totalWorkedHours,
        aggregatedMetrics.totalOvertimeMinutes,
      ],
    ];

    downloadReportCsv(`Staff_Performance_${startDate}_${endDate}.csv`, meta, [
      { title: 'Performance Summary', headers, rows },
    ]);
  };

  const handleExportExcel = () => {
    if (!filteredRecords.length) return;
    const meta: [string, string][] = [
      ['Report', 'Staff Productivity & Performance Reports'],
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Generated At', new Date().toLocaleString()],
    ];

    const headers = [
      'Staff Code',
      'Staff Name',
      'Role',
      'Branch',
      'Total Units',
      'Direct Services',
      'Package Components',
      'Unique Clients',
      'Gross Sales (PKR)',
      'Discount (PKR)',
      'Attributed Net Sales (PKR)',
      'Estimated Commission (PKR)',
      'Finalized Commission (PKR)',
      'Allocated Tips (PKR)',
      'Worked Hours',
      'Overtime Minutes',
    ];

    const rows = [
      ...filteredRecords.map((r) => [
        r.staffCode,
        r.staffName,
        r.roleTitle,
        r.branchName,
        r.totalServiceUnits,
        r.directServicesCount,
        r.packageComponentsCount,
        r.uniqueClientsCount,
        r.attributedGrossSales.toFixed(2),
        r.discountAllocation.toFixed(2),
        r.attributedNetSales.toFixed(2),
        r.estimatedCommission.toFixed(2),
        r.finalizedCommission.toFixed(2),
        r.allocatedTips.toFixed(2),
        r.workedHours,
        r.approvedOvertimeMinutes,
      ]),
      [
        'TOTALS',
        '',
        '',
        '',
        aggregatedMetrics.totalUnits,
        aggregatedMetrics.totalDirectServices,
        aggregatedMetrics.totalPackageComponents,
        aggregatedMetrics.totalUniqueClients,
        aggregatedMetrics.totalGrossSales.toFixed(2),
        aggregatedMetrics.totalDiscount.toFixed(2),
        aggregatedMetrics.totalNetSales.toFixed(2),
        aggregatedMetrics.totalEstimatedCommission.toFixed(2),
        aggregatedMetrics.totalFinalizedCommission.toFixed(2),
        aggregatedMetrics.totalAllocatedTips.toFixed(2),
        aggregatedMetrics.totalWorkedHours,
        aggregatedMetrics.totalOvertimeMinutes,
      ],
    ];

    downloadReportExcel(`Staff_Performance_${startDate}_${endDate}.csv`, meta, [
      { title: 'Performance Summary', headers, rows },
    ]);
  };

  const handlePrint = () => {
    if (!filteredRecords.length) return;
    const meta: [string, string][] = [
      ['Campus', branchNameDisplay],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Generated By', user.name],
    ];

    const headers = [
      '#',
      'Employee',
      'Campus',
      'Units',
      'Clients',
      'Attributed Net Sales',
      'Commission',
      'Tips',
      'Worked Hours',
    ];

    const rows = filteredRecords.map((r, i) => [
      i + 1,
      `${r.staffName} (${r.staffCode})`,
      r.branchName,
      `${r.totalServiceUnits} (${r.directServicesCount} dir / ${r.packageComponentsCount} pkg)`,
      r.uniqueClientsCount,
      formatCurrency(r.attributedNetSales),
      formatCurrency(r.estimatedCommission),
      formatCurrency(r.allocatedTips),
      `${r.workedHours}h (OT ${r.approvedOvertimeMinutes}m)`,
    ]);

    const footers = [
      'TOTALS',
      '',
      '',
      `${aggregatedMetrics.totalUnits} Units`,
      aggregatedMetrics.totalUniqueClients,
      formatCurrency(aggregatedMetrics.totalNetSales),
      formatCurrency(aggregatedMetrics.totalEstimatedCommission),
      formatCurrency(aggregatedMetrics.totalAllocatedTips),
      `${aggregatedMetrics.totalWorkedHours}h`,
    ];

    printReportWindow({
      title: 'Staff Productivity & Performance Report',
      subtitle: `Attributed Sales Velocity & Commission Analysis`,
      meta,
      headers,
      rows,
      totals: footers,
    });
  };

  const handleExportDrilldownCSV = () => {
    if (!selectedStaffRecord || !filteredDetailedServices.length) return;
    let csv = `STAFF SERVICE DETAIL: ${selectedStaffRecord.staffName} (${selectedStaffRecord.staffCode})\n`;
    csv += `Scope: ${selectedStaffRecord.branchName}\n`;
    csv += `Period: ${startDate} to ${endDate}\n`;
    csv += `Generated On: ${new Date().toLocaleString()}\n\n`;

    csv += 'Date,Time,Invoice #,Type,Item Name,Client Name,Gross Price,Discount,Attributed Net,Commission Est,Tip Alloc\n';
    filteredDetailedServices.forEach((item) => {
      csv += `"${item.date}","${item.time || ''}","${item.invoiceNumber}","${item.itemType}","${item.serviceName}","${item.clientName || '-'}","${item.cataloguePrice}","${item.discountAllocated}","${item.netSales}","${item.commissionEarned}","0"\n`;
    });

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Staff_Detail_${selectedStaffRecord.staffCode}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-5 md:px-8 md:py-6 text-slate-800 font-sans">
      {/* Top Header & Filters Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 md:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#0B2545] tracking-tight">
              Staff Productivity & Performance Reports
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Attributed net sales, direct & package service volume, commissions, gratuities, and operational hours.
            </p>
          </div>
        </div>

        <form onSubmit={handleApplyFilters}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
            {/* Campus / Branch */}
            <div>
              <label className={labelClass}>Campus</label>
              <select
                className={selectClass}
                value={selectedBranchId}
                disabled={!isSuperAdmin}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSelectedStaffId('ALL');
                }}
              >
                {isSuperAdmin && <option value="ALL">All Campuses</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Staff */}
            <div>
              <label className={labelClass}>Staff Member</label>
              <select
                className={selectClass}
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="ALL">All Staff</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.employeeCode || s.id.slice(-4)})
                  </option>
                ))}
              </select>
            </div>

            {/* Catalogue Filter */}
            <div>
              <label className={labelClass}>Catalogue Item</label>
              <select
                className={selectClass}
                value={
                  selectedServiceId !== 'ALL'
                    ? `svc:${selectedServiceId}`
                    : selectedPackageId !== 'ALL'
                    ? `pkg:${selectedPackageId}`
                    : 'ALL'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    setSelectedServiceId('ALL');
                    setSelectedPackageId('ALL');
                  } else if (val.startsWith('svc:')) {
                    setSelectedServiceId(val.replace('svc:', ''));
                    setSelectedPackageId('ALL');
                  } else if (val.startsWith('pkg:')) {
                    setSelectedPackageId(val.replace('pkg:', ''));
                    setSelectedServiceId('ALL');
                  }
                }}
              >
                <option value="ALL">All Services & Packages</option>
                <optgroup label="Direct Services">
                  {servicesList.map((svc) => (
                    <option key={svc.id} value={`svc:${svc.id}`}>
                      {svc.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Bundled Packages">
                  {packagesList.map((pkg) => (
                    <option key={pkg.id} value={`pkg:${pkg.id}`}>
                      {pkg.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Date Preset */}
            <div>
              <label className={labelClass}>Date Preset</label>
              <select
                className={selectClass}
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className={labelClass}>From Date</label>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>

            {/* To Date */}
            <div>
              <label className={labelClass}>To Date</label>
              <input
                type="date"
                className={inputClass}
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset('CUSTOM');
                }}
              />
            </div>

            {/* Search Query */}
            <div>
              <label className={labelClass}>Search</label>
              <input
                type="text"
                placeholder="Code, name, role..."
                className={inputClass}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[35px] bg-[#0047AB] hover:bg-[#003785] active:bg-[#002d6b] text-white text-xs font-semibold rounded-md shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Filter className="w-3.5 h-3.5 fill-current" />
                    <span>Filter</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Main Content Area */}
      {!hasFiltered ? (
        /* Empty State before Filter clicked */
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 md:p-24 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="text-slate-400 mb-3">
            <Filter className="w-14 h-14 stroke-[1.25] text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">
            Please apply filters to view reports
          </p>
        </div>
      ) : loading ? (
        /* Loading Skeleton */
        <div className="bg-white rounded-xl border border-slate-200/90 p-16 flex flex-col items-center justify-center min-h-[380px] shadow-xs text-center">
          <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
          <p className="text-slate-600 text-sm font-medium">
            Calculating Staff Performance Metrics...
          </p>
        </div>
      ) : errorMessage ? (
        /* Error Message */
        <div className="bg-white rounded-xl border border-rose-200 p-8 shadow-xs text-center">
          <p className="text-rose-600 text-sm font-medium mb-3">{errorMessage}</p>
          <button
            onClick={() => handleApplyFilters()}
            className="px-4 py-1.5 bg-[#0047AB] text-white text-xs font-semibold rounded-md shadow-xs hover:bg-[#003785]"
          >
            Retry
          </button>
        </div>
      ) : (
        /* Filtered Data Layout */
        <div className="mb-8">
          {/* Royal Blue Banner Header */}
          <div className="bg-[#0047AB] text-white px-5 py-3 rounded-t-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Award className="w-5 h-5 text-white/90" />
              <span className="font-semibold text-sm tracking-wide">
                Staff Productivity & Performance Reports ({filteredRecords.length} staff members)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="bg-[#009688] hover:bg-[#00897B] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="bg-[#4B5563] hover:bg-[#374151] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>

          {/* Table Container with Horizontal Scroll */}
          <div className="bg-white overflow-x-auto rounded-b-xl border border-t-0 border-slate-200/90 shadow-sm">
            <table className="report-records w-full min-w-[1300px] text-left border-collapse font-['Inter',sans-serif] text-[13px] antialiased">
              <thead>
                <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                  <th className="py-3.5 px-3 text-center w-8">#</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Campus</th>
                  <th className="py-3.5 px-4 text-center">Units (Dir / Pkg)</th>
                  <th className="py-3.5 px-4 text-center">Clients</th>
                  <th className="py-3.5 px-4 text-right">Attributed Net Sales</th>
                  <th className="py-3.5 px-4 text-right">Commission (Est / Fin)</th>
                  <th className="py-3.5 px-4 text-right">Tips (Alloc / Due)</th>
                  <th className="py-3.5 px-4 text-center">Worked Hours</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-[#334155]">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                      No staff performance records found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record, idx) => (
                    <tr
                      key={record.staffId}
                      className="hover:bg-blue-50/20 transition-colors border-b border-dashed border-slate-200 cursor-pointer"
                      onClick={() => setSelectedStaffRecord(record)}
                    >
                      <td className="py-3.5 px-3 text-center font-normal text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {record.staffName}
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-normal">
                            {record.staffCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{record.roleTitle}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {record.branchName}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-semibold text-slate-800">{record.totalServiceUnits}</div>
                        <div className="text-[11px] text-slate-400">
                          {record.directServicesCount} dir · {record.packageComponentsCount} pkg
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-slate-800">
                        {record.uniqueClientsCount}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-semibold text-slate-800 tabular-nums">{formatCurrency(record.attributedNetSales)}</div>
                        <div className="text-[11px] text-slate-400 font-normal tabular-nums">
                          Gross: {formatCurrency(record.attributedGrossSales)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-semibold text-[#10B981] tabular-nums">{formatCurrency(record.estimatedCommission)}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          Fin: {formatCurrency(record.finalizedCommission)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-semibold text-slate-800 tabular-nums">{formatCurrency(record.allocatedTips)}</div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          Due: {formatCurrency(record.outstandingTips)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-medium text-slate-800">
                          {record.workedHours}h
                        </div>
                        <div className="text-[11px] text-slate-400">
                          OT: {record.approvedOvertimeMinutes}m
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStaffRecord(record);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-[#0047AB] hover:bg-blue-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Breakdown
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredRecords.length > 0 && (
                <tfoot className="bg-[#F8FAFC] border-t-2 border-slate-200 font-['Inter',sans-serif] text-[13px] text-[#334155]">
                  <tr>
                    <td colSpan={3} className="py-3.5 px-4 font-bold text-slate-800 text-right uppercase tracking-wider">
                      Totals:
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                      {aggregatedMetrics.totalUnits}
                      <div className="text-[11px] font-normal text-slate-400">
                        ({aggregatedMetrics.totalDirectServices} dir / {aggregatedMetrics.totalPackageComponents} pkg)
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800">{aggregatedMetrics.totalUniqueClients}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-800">
                      {formatCurrency(aggregatedMetrics.totalNetSales)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#10B981]">
                      {formatCurrency(aggregatedMetrics.totalEstimatedCommission)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-800">
                      {formatCurrency(aggregatedMetrics.totalAllocatedTips)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600">
                      OT: {aggregatedMetrics.totalOvertimeMinutes}m
                    </td>
                    <td className="py-3.5 px-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Employee Service Drilldown Modal */}
      {selectedStaffRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-[#0047AB] rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      {selectedStaffRecord.staffName}
                    </h3>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {selectedStaffRecord.staffCode}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#0047AB] font-medium">
                      {selectedStaffRecord.branchName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedStaffRecord.roleTitle} · Detailed Service Ledger ({startDate} to {endDate})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportDrilldownCSV}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Items CSV
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStaffRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Sub-Banner Summary Metrics */}
            <div className="bg-slate-50/70 p-3.5 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Attributed Net Sales</span>
                <span className="text-base font-bold text-slate-900">
                  {formatCurrency(selectedStaffRecord.attributedNetSales)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Gross: {formatCurrency(selectedStaffRecord.attributedGrossSales)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Total Units</span>
                <span className="text-base font-bold text-slate-900">
                  {selectedStaffRecord.totalServiceUnits} units
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {selectedStaffRecord.directServicesCount} Direct · {selectedStaffRecord.packageComponentsCount} Package
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Estimated Commission</span>
                <span className="text-base font-bold text-[#0047AB]">
                  {formatCurrency(selectedStaffRecord.estimatedCommission)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Finalized: {formatCurrency(selectedStaffRecord.finalizedCommission)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Gratuity Entitlement</span>
                <span className="text-base font-bold text-[#0B2545]">
                  {formatCurrency(selectedStaffRecord.allocatedTips)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Paid: {formatCurrency(selectedStaffRecord.paidTips)} · Due: {formatCurrency(selectedStaffRecord.outstandingTips)}
                </span>
              </div>
            </div>

            {/* Drilldown Filters */}
            <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrilldownFilterType('ALL')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    drilldownFilterType === 'ALL'
                      ? 'bg-[#0B2545] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Items ({selectedStaffRecord.detailedServices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrilldownFilterType('SERVICE')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    drilldownFilterType === 'SERVICE'
                      ? 'bg-[#0047AB] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Direct Services ({selectedStaffRecord.directServicesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDrilldownFilterType('PACKAGE_COMPONENT')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                    drilldownFilterType === 'PACKAGE_COMPONENT'
                      ? 'bg-[#0047AB] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Package Components ({selectedStaffRecord.packageComponentsCount})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search invoice or service name..."
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:bg-white placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Drilldown Table */}
            <div className="p-4 flex-1 overflow-y-auto">
              <table className="report-records w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[#0B2545] font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Service Name</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3 text-right">Gross</th>
                    <th className="py-2.5 px-3 text-right">Discount</th>
                    <th className="py-2.5 px-3 text-right">Net Sales</th>
                    <th className="py-2.5 px-3 text-right">Comm.</th>
                    <th className="py-2.5 px-3 text-right">Tip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDetailedServices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No service records found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDetailedServices.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{item.date}</td>
                        <td className="py-2 px-3 font-mono text-[11px] font-medium text-slate-900">{item.invoiceNumber}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              item.itemType === 'SERVICE'
                                ? 'bg-blue-50 text-[#0047AB]'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.itemType === 'SERVICE' ? 'Service' : 'Package'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">{item.serviceName}</td>
                        <td className="py-2 px-3 text-slate-600">{item.clientName || 'Walk-in'}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(item.cataloguePrice)}</td>
                        <td className="py-2 px-3 text-right text-slate-500">{formatCurrency(item.discountAllocated)}</td>
                        <td className="py-2 px-3 text-right font-bold text-[#0B2545]">{formatCurrency(item.netSales)}</td>
                        <td className="py-2 px-3 text-right text-[#0047AB] font-semibold">{formatCurrency(item.commissionEarned)}</td>
                        <td className="py-2 px-3 text-right text-slate-700 font-semibold">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-8 text-center text-xs text-slate-400 pb-6">
        © iSysware Management System
      </div>
    </div>
  );
};
