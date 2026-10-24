import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import { ServiceItem, PackageItem } from '@/types/salon';
import { formatCurrency } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Upload,
  Download,
  Scissors,
  Package,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  FileText,
} from 'lucide-react';

interface BulkUploadCatalogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'SERVICES' | 'PACKAGES';
  branchId: string;
  existingServices: ServiceItem[];
  existingPackages: PackageItem[];
  onSuccess: () => void;
}

interface ParsedServiceRow {
  rowNumber: number;
  name: string;
  category: string;
  price: number;
  durationMinutes: number;
  code?: string;
  description?: string;
  taxTreatment: 'BRANCH_DEFAULT' | 'SPECIFIC_RULE' | 'EXEMPT';
  isActive: boolean;
  isValid: boolean;
  error?: string;
}

interface ParsedPackageComponent {
  serviceIdentifier: string; // name or code
  matchedService?: ServiceItem;
  quantity: number;
  allocationPercentage?: number;
}

interface ParsedPackageRow {
  rowNumber: number;
  name: string;
  price: number;
  code?: string;
  description?: string;
  taxTreatment: 'BRANCH_DEFAULT' | 'SPECIFIC_RULE' | 'EXEMPT';
  isActive: boolean;
  components: ParsedPackageComponent[];
  isValid: boolean;
  error?: string;
}

/**
 * Robust CSV line tokenizer respecting quoted strings with commas and escaped quotes.
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCSVText(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map(parseCSVLine);
}

export const BulkUploadCatalogueModal: React.FC<BulkUploadCatalogueModalProps> = ({
  isOpen,
  onClose,
  initialType = 'SERVICES',
  branchId,
  existingServices,
  existingPackages,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'PACKAGES'>(initialType);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed state
  const [parsedServices, setParsedServices] = useState<ParsedServiceRow[]>([]);
  const [parsedPackages, setParsedPackages] = useState<ParsedPackageRow[]>([]);

  // When tab changes, reset state
  const handleTabChange = (val: string) => {
    setActiveTab(val as 'SERVICES' | 'PACKAGES');
    setRawText('');
    setFileName(null);
    setParsedServices([]);
    setParsedPackages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── CSV Escaping & Helpers ────────────────────────────────────────────────
  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // ── CSV Export / Templates ────────────────────────────────────────────────
  const downloadServicesTemplate = () => {
    const branchServices = existingServices.filter((s) => !branchId || s.branchId === branchId);
    const targetServices = branchServices.length > 0 ? branchServices : existingServices;

    const headers = ['Name', 'Category', 'Price', 'Duration', 'Code', 'Description', 'TaxTreatment', 'Status'];
    let rows: string[][] = [];

    if (targetServices.length > 0) {
      rows = targetServices.map((s) => [
        s.name,
        s.category || 'General',
        String(s.price),
        String(s.durationMinutes),
        s.code || '',
        s.description || '',
        s.taxTreatment || 'BRANCH_DEFAULT',
        s.isActive ? 'Active' : 'Inactive',
      ]);
    } else {
      rows = [
        ['Hair Cut & Style', 'Hair Services', '1500', '45', 'HAIR-01', 'Standard hair cut and styling', 'BRANCH_DEFAULT', 'Active'],
        ['Beard Grooming', 'Grooming', '800', '30', 'GRM-01', 'Beard trim and shape up', 'BRANCH_DEFAULT', 'Active'],
      ];
    }

    const csvContent = '\uFEFF' + [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ].join('\n');

    downloadFile(csvContent, targetServices.length > 0 ? 'services_catalogue_export.csv' : 'services_bulk_import_template.csv');
  };

  const downloadPackagesTemplate = () => {
    const branchPackages = existingPackages.filter((p) => !branchId || p.branchId === branchId);
    const targetPackages = branchPackages.length > 0 ? branchPackages : existingPackages;

    const headers = ['Name', 'Price', 'Components', 'Code', 'Description', 'TaxTreatment', 'Status'];
    let rows: string[][] = [];

    if (targetPackages.length > 0) {
      rows = targetPackages.map((p) => {
        const comps = (p.components || [])
          .map((c) => `${c.serviceName}:${c.quantity || 1}:${c.allocationPercentage || 0}`)
          .join(';');
        return [
          p.name,
          String(p.price),
          comps,
          p.code || '',
          p.description || '',
          p.taxTreatment || 'BRANCH_DEFAULT',
          p.isActive ? 'Active' : 'Inactive',
        ];
      });
    } else {
      rows = [
        ['Bridal Glow', '12000', 'Hydra Facial:1:50;Classic Manicure:1:50', 'PKG-01', 'Complete bridal pamper package', 'BRANCH_DEFAULT', 'Active'],
      ];
    }

    const csvContent = '\uFEFF' + [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ].join('\n');

    downloadFile(csvContent, targetPackages.length > 0 ? 'packages_catalogue_export.csv' : 'packages_bulk_import_template.csv');
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── File upload handler ───────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawText(content);
      parseContent(content, activeTab);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setRawText(content);
    setFileName(null);
    parseContent(content, activeTab);
  };

  // ── CSV Parsing Logic ─────────────────────────────────────────────────────
  const parseContent = (content: string, type: 'SERVICES' | 'PACKAGES') => {
    const grid = parseCSVText(content);
    if (grid.length < 2) {
      if (type === 'SERVICES') setParsedServices([]);
      else setParsedPackages([]);
      return;
    }

    const header = grid[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = grid.slice(1);

    if (type === 'SERVICES') {
      const nameIdx = header.findIndex((h) => h.includes('name') || h === 'service');
      const catIdx = header.findIndex((h) => h.includes('cat'));
      const priceIdx = header.findIndex((h) => h.includes('price') || h.includes('rate') || h.includes('cost'));
      const durationIdx = header.findIndex((h) => h.includes('dur') || h.includes('min') || h.includes('time'));
      const codeIdx = header.findIndex((h) => h.includes('code') || h === 'id');
      const descIdx = header.findIndex((h) => h.includes('desc'));
      const taxIdx = header.findIndex((h) => h.includes('tax'));
      const statusIdx = header.findIndex((h) => h.includes('status') || h.includes('active'));

      const existingCodes = new Set(
        existingServices
          .filter((s) => s.branchId === branchId)
          .map((s) => s.code.toUpperCase())
      );
      const seenCodesInBatch = new Set<string>();

      const parsed: ParsedServiceRow[] = rows.map((cols, idx) => {
        const rowNum = idx + 2;
        const name = (nameIdx >= 0 ? cols[nameIdx] : cols[0]) || '';
        const category = (catIdx >= 0 ? cols[catIdx] : 'General') || 'General';
        const rawPrice = priceIdx >= 0 ? cols[priceIdx] : cols[1];
        const price = Number(rawPrice);
        const rawDur = durationIdx >= 0 ? cols[durationIdx] : '30';
        const duration = Number(rawDur) || 30;
        const code = (codeIdx >= 0 ? cols[codeIdx] : '')?.toUpperCase() || undefined;
        const description = descIdx >= 0 ? cols[descIdx] : '';
        const rawTax = (taxIdx >= 0 ? cols[taxIdx] : '')?.toUpperCase();
        const taxTreatment: 'BRANCH_DEFAULT' | 'SPECIFIC_RULE' | 'EXEMPT' =
          rawTax === 'EXEMPT' ? 'EXEMPT' : rawTax === 'SPECIFIC_RULE' ? 'SPECIFIC_RULE' : 'BRANCH_DEFAULT';
        const rawStatus = (statusIdx >= 0 ? cols[statusIdx] : '')?.toLowerCase();
        const isActive = rawStatus === 'inactive' || rawStatus === 'false' ? false : true;

        let error: string | undefined;
        let isValid = true;

        if (!name.trim()) {
          isValid = false;
          error = 'Service name is missing.';
        } else if (isNaN(price) || price < 0) {
          isValid = false;
          error = 'Price must be a valid non-negative number.';
        } else if (code) {
          if (existingCodes.has(code)) {
            isValid = false;
            error = `Code '${code}' is already registered in this branch.`;
          } else if (seenCodesInBatch.has(code)) {
            isValid = false;
            error = `Duplicate code '${code}' in import file.`;
          } else {
            seenCodesInBatch.add(code);
          }
        }

        return {
          rowNumber: rowNum,
          name: name.trim(),
          category: category.trim(),
          price: isNaN(price) ? 0 : price,
          durationMinutes: duration,
          code,
          description: description?.trim(),
          taxTreatment,
          isActive,
          isValid,
          error,
        };
      });

      setParsedServices(parsed);
    } else {
      // PACKAGES
      const nameIdx = header.findIndex((h) => h.includes('name') || h === 'package');
      const priceIdx = header.findIndex((h) => h.includes('price') || h.includes('rate') || h.includes('cost'));
      const compIdx = header.findIndex((h) => h.includes('comp') || h.includes('service') || h.includes('item'));
      const codeIdx = header.findIndex((h) => h.includes('code') || h === 'id');
      const descIdx = header.findIndex((h) => h.includes('desc'));
      const taxIdx = header.findIndex((h) => h.includes('tax'));
      const statusIdx = header.findIndex((h) => h.includes('status') || h.includes('active'));

      const existingCodes = new Set(
        existingPackages
          .filter((p) => p.branchId === branchId)
          .map((p) => p.code.toUpperCase())
      );
      const branchServices = existingServices.filter((s) => s.branchId === branchId);
      const seenCodesInBatch = new Set<string>();

      const parsed: ParsedPackageRow[] = rows.map((cols, idx) => {
        const rowNum = idx + 2;
        const name = (nameIdx >= 0 ? cols[nameIdx] : cols[0]) || '';
        const rawPrice = priceIdx >= 0 ? cols[priceIdx] : cols[1];
        const price = Number(rawPrice);
        const rawComps = (compIdx >= 0 ? cols[compIdx] : cols[2]) || '';
        const code = (codeIdx >= 0 ? cols[codeIdx] : '')?.toUpperCase() || undefined;
        const description = descIdx >= 0 ? cols[descIdx] : '';
        const rawTax = (taxIdx >= 0 ? cols[taxIdx] : '')?.toUpperCase();
        const taxTreatment: 'BRANCH_DEFAULT' | 'SPECIFIC_RULE' | 'EXEMPT' =
          rawTax === 'EXEMPT' ? 'EXEMPT' : rawTax === 'SPECIFIC_RULE' ? 'SPECIFIC_RULE' : 'BRANCH_DEFAULT';
        const rawStatus = (statusIdx >= 0 ? cols[statusIdx] : '')?.toLowerCase();
        const isActive = rawStatus === 'inactive' || rawStatus === 'false' ? false : true;

        let error: string | undefined;
        let isValid = true;

        if (!name.trim()) {
          isValid = false;
          error = 'Package name is missing.';
        } else if (isNaN(price) || price < 0) {
          isValid = false;
          error = 'Price must be a valid non-negative number.';
        } else if (code) {
          if (existingCodes.has(code)) {
            isValid = false;
            error = `Code '${code}' is already registered in this branch.`;
          } else if (seenCodesInBatch.has(code)) {
            isValid = false;
            error = `Duplicate code '${code}' in import file.`;
          } else {
            seenCodesInBatch.add(code);
          }
        }

        // Parse components: format "Service1:Qty:Alloc; Service2:Qty:Alloc" or "Service1; Service2"
        const componentTokens = rawComps
          .split(';')
          .map((c) => c.trim())
          .filter(Boolean);

        const components: ParsedPackageComponent[] = [];

        if (componentTokens.length === 0 && isValid) {
          isValid = false;
          error = 'No component services specified (Components column is empty).';
        } else {
          for (const token of componentTokens) {
            const parts = token.split(':').map((p) => p.trim());
            const identifier = parts[0];
            const qty = parts[1] ? parseInt(parts[1], 10) || 1 : 1;
            const alloc = parts[2] ? parseFloat(parts[2]) : undefined;

            // Match against branch services by code or name or id
            const matched = branchServices.find(
              (s) =>
                s.code.toUpperCase() === identifier.toUpperCase() ||
                s.name.toLowerCase() === identifier.toLowerCase() ||
                s.id === identifier
            );

            if (!matched && isValid) {
              isValid = false;
              error = `Component service '${identifier}' not found in branch services.`;
            } else if (matched && !matched.isActive && isValid) {
              isValid = false;
              error = `Component service '${matched.name}' is deactivated.`;
            }

            components.push({
              serviceIdentifier: identifier,
              matchedService: matched,
              quantity: qty,
              allocationPercentage: alloc,
            });
          }
        }

        return {
          rowNumber: rowNum,
          name: name.trim(),
          price: isNaN(price) ? 0 : price,
          code,
          description: description?.trim(),
          taxTreatment,
          isActive,
          components,
          isValid,
          error,
        };
      });

      setParsedPackages(parsed);
    }
  };

  // ── Import Submission ─────────────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (activeTab === 'SERVICES') {
      const validRows = parsedServices.filter((s) => s.isValid);
      if (validRows.length === 0) {
        toast.error('No valid service rows to import.');
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = validRows.map((r) => ({
          name: r.name,
          category: r.category,
          price: r.price,
          durationMinutes: r.durationMinutes,
          code: r.code,
          description: r.description,
          taxTreatment: r.taxTreatment,
          isActive: r.isActive,
        }));

        const result = await salonService.bulkImportServices(branchId, payload, user || undefined);
        toast.success(
          `Services Import Complete! Accepted: ${result.acceptedRows}, Skipped/Duplicate: ${result.duplicateRows}, Rejected: ${result.rejectedRows}`
        );
        onSuccess();
        onClose();
      } catch (err: any) {
        toast.error(err.message || 'Failed to bulk import services.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const validRows = parsedPackages.filter((p) => p.isValid);
      if (validRows.length === 0) {
        toast.error('No valid package rows to import.');
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = validRows.map((r) => ({
          name: r.name,
          price: r.price,
          code: r.code,
          description: r.description,
          taxTreatment: r.taxTreatment,
          isActive: r.isActive,
          components: r.components.map((c) => ({
            serviceId: c.matchedService?.id,
            serviceCode: c.matchedService?.code || c.serviceIdentifier,
            serviceName: c.matchedService?.name,
            quantity: c.quantity,
            allocationPercentage: c.allocationPercentage,
          })),
        }));

        const result = await salonService.bulkImportPackages(branchId, payload, user || undefined);
        toast.success(
          `Packages Import Complete! Accepted: ${result.acceptedRows}, Skipped/Duplicate: ${result.duplicateRows}, Rejected: ${result.rejectedRows}`
        );
        onSuccess();
        onClose();
      } catch (err: any) {
        toast.error(err.message || 'Failed to bulk import packages.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const currentParsedCount = activeTab === 'SERVICES' ? parsedServices.length : parsedPackages.length;
  const currentValidCount =
    activeTab === 'SERVICES'
      ? parsedServices.filter((s) => s.isValid).length
      : parsedPackages.filter((p) => p.isValid).length;
  const currentInvalidCount = currentParsedCount - currentValidCount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2254E1] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Bulk Upload via CSV
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Upload or paste comma-separated records to add multiple standalone services or package bundles at once.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* TAB SELECTOR: SERVICES vs PACKAGES */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="SERVICES" className="text-xs gap-1.5 py-1 px-3">
                <Scissors className="w-3.5 h-3.5 text-[#2254E1]" />
                Services CSV
              </TabsTrigger>
              <TabsTrigger value="PACKAGES" className="text-xs gap-1.5 py-1 px-3">
                <Package className="w-3.5 h-3.5 text-[#2254E1]" />
                Packages CSV
              </TabsTrigger>
            </TabsList>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" />}
              onClick={activeTab === 'SERVICES' ? downloadServicesTemplate : downloadPackagesTemplate}
              className="text-xs h-8"
            >
              Download {activeTab === 'SERVICES' ? 'Services' : 'Packages'} Template (.CSV)
            </Button>
          </div>

          {/* INPUT CONTAINER */}
          <div className="space-y-4 pt-4">
            {/* FILE UPLOAD / DRAG AREA */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-file-input"
              />
              <label
                htmlFor="csv-file-input"
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 text-[#2254E1]" />
                <span>Choose .CSV File</span>
              </label>

              {fileName && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium">{fileName}</span>
                </div>
              )}

              {rawText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRawText('');
                    setFileName(null);
                    setParsedServices([]);
                    setParsedPackages([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 ml-auto h-8 gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Data
                </Button>
              )}
            </div>

            {/* RAW TEXTAREA */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-600">
                  Or Paste CSV Content Directly:
                </span>
                <span className="text-[11px] text-slate-400">
                  First row must contain header names
                </span>
              </div>
              <textarea
                value={rawText}
                onChange={handleTextChange}
                placeholder={
                  activeTab === 'SERVICES'
                    ? `Name,Category,Price,Duration,Code,Description\nHair Cut & Style,Hair Services,1500,45,HAIR-01,Standard hair cut\nBeard Grooming,Grooming,800,30,GRM-01,Trim and shape`
                    : `Name,Price,Components,Code,Description\n"Bridal Glow",12000,"Hydra Facial;Classic Manicure;Hair Cut & Style",PKG-01,"Complete package"\n"Groom Special",4500,"Hair Cut & Style:1:60;Beard Grooming:1:40",PKG-02,"Hair and beard"`
                }
                rows={5}
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2254E1]/20 focus:border-[#2254E1] transition-all bg-slate-50/50"
              />
            </div>

            {/* PREVIEW SUMMARY BADGES */}
            {currentParsedCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Preview:</span>
                <Badge variant="neutral" className="text-xs">
                  Total: {currentParsedCount}
                </Badge>
                <Badge variant="primary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Ready: {currentValidCount}
                </Badge>
                {currentInvalidCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Errors: {currentInvalidCount}
                  </Badge>
                )}
                {currentInvalidCount > 0 && (
                  <span className="text-[11px] text-rose-500 italic ml-2">
                    (Invalid rows will be skipped or rejected upon import)
                  </span>
                )}
              </div>
            )}

            {/* PREVIEW TABLE */}
            {currentParsedCount > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow className="text-[11px]">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      {activeTab === 'SERVICES' ? (
                        <>
                          <TableHead>Category</TableHead>
                          <TableHead>Duration</TableHead>
                        </>
                      ) : (
                        <TableHead>Component Services</TableHead>
                      )}
                      <TableHead>Price</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTab === 'SERVICES'
                      ? parsedServices.map((row) => (
                          <TableRow
                            key={row.rowNumber}
                            className={`text-xs ${!row.isValid ? 'bg-rose-50/50' : ''}`}
                          >
                            <TableCell className="font-mono text-slate-400 text-[11px]">
                              {row.rowNumber}
                            </TableCell>
                            <TableCell className="font-medium text-slate-800">
                              {row.name || <span className="text-rose-400 italic">Missing</span>}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              <Badge variant="neutral" className="text-[10px]">
                                {row.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600">{row.durationMinutes}m</TableCell>
                            <TableCell className="font-semibold text-slate-900">
                              {formatCurrency(row.price)}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500">
                              {row.code || <span className="text-slate-400 italic">Auto</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.isValid ? (
                                <Badge variant="primary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Valid
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-rose-600 flex items-center justify-end gap-1">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                  {row.error}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      : parsedPackages.map((row) => (
                          <TableRow
                            key={row.rowNumber}
                            className={`text-xs ${!row.isValid ? 'bg-rose-50/50' : ''}`}
                          >
                            <TableCell className="font-mono text-slate-400 text-[11px]">
                              {row.rowNumber}
                            </TableCell>
                            <TableCell className="font-medium text-slate-800">
                              {row.name || <span className="text-rose-400 italic">Missing</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {row.components.map((c, i) => (
                                  <Badge
                                    key={i}
                                    variant={c.matchedService ? 'neutral' : 'destructive'}
                                    className="text-[9px] font-normal"
                                  >
                                    {c.matchedService?.name || c.serviceIdentifier}
                                    {c.quantity > 1 ? ` (x${c.quantity})` : ''}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">
                              {formatCurrency(row.price)}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500">
                              {row.code || <span className="text-slate-400 italic">Auto</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.isValid ? (
                                <Badge variant="primary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                  Valid
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-rose-600 flex items-center justify-end gap-1">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                  {row.error}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Tabs>

        <DialogFooter className="mt-4 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmImport}
            disabled={isSubmitting || currentValidCount === 0}
            leftIcon={
              isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )
            }
          >
            {isSubmitting
              ? 'Importing...'
              : `Import ${currentValidCount} ${activeTab === 'SERVICES' ? 'Services' : 'Packages'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
