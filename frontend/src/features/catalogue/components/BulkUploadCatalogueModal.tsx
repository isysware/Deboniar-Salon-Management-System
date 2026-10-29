import { BranchActionField } from '@/components/BranchActionField';
import { useBranchAction } from '@/hooks/useBranchAction';
import React, { useState, useRef, useEffect } from 'react';
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

function cleanCell(val: string): string {
  let s = (val || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/""/g, '"');
}

/**
 * Auto-detects delimiter: Tab (\t) for Excel paste/TSV, Semicolon (;) for European/regional Excel, or Comma (,)
 */
function detectDelimiter(lines: string[]): string {
  for (const line of lines) {
    if (!line.trim()) continue;
    let inQuotes = false;
    let tabs = 0;
    let commas = 0;
    let semicolons = 0;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes) {
        if (ch === '\t') tabs++;
        else if (ch === ',') commas++;
        else if (ch === ';') semicolons++;
      }
    }

    if (tabs > 0 && tabs >= commas) return '\t';
    if (semicolons > 0 && semicolons >= commas) return ';';
    if (commas > 0) return ',';
  }
  return ',';
}

/**
 * Robust CSV/TSV line tokenizer respecting quoted strings with commas and escaped quotes.
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
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
    } else if (char === delimiter && !inQuotes) {
      values.push(cleanCell(current));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(cleanCell(current));
  return values;
}

function parseCSVText(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines);
  return lines.map((l) => parseCSVLine(l, delimiter));
}

const loadImportBranch = async (branchId: string) => {
  const [services, packages] = await Promise.all([salonService.getServices(branchId), salonService.getPackages(branchId)]);
  return { services, packages };
};

export const BulkUploadCatalogueModal: React.FC<BulkUploadCatalogueModalProps> = ({
  isOpen,
  onClose,
  initialType = 'SERVICES',
  branchId: readBranchId,
  existingServices: readServices,
  existingPackages: readPackages,
  onSuccess,
}) => {
  const { user } = useAuth();
  const actionScope = useBranchAction(isOpen, loadImportBranch);
  const branchId = actionScope.branchId;
  const existingServices = actionScope.data?.services || [];
  const existingPackages = actionScope.data?.packages || [];
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'PACKAGES'>(initialType);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync tab with initialType when modal opens or initialType changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
      setRawText('');
      setFileName(null);
      setParsedServices([]);
      setParsedPackages([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, initialType]);

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
    const headers = ['Name', 'Category', 'Price'];
    const rows = [
      ['Hair Cut', 'Hair', '3500'],
      ['Beard Grooming', 'Grooming', '800'],
      ['Signature Facial', 'Skin', '5000'],
    ];

    const csvContent = '\uFEFF' + [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ].join('\n');

    downloadFile(csvContent, 'services_bulk_import_template.csv');
  };

  const downloadPackagesTemplate = () => {
    const headers = ['Package Name', 'Price', 'Services'];
    const rows = [
      ['Groom Special', '4000', 'Hair Cut, Beard Grooming'],
      ['Bridal Glow', '15000', 'Hydra Facial, Classic Manicure'],
    ];

    const csvContent = '\uFEFF' + [
      headers.map(escapeCell).join(','),
      ...rows.map((r) => r.map(escapeCell).join(',')),
    ].join('\n');

    downloadFile(csvContent, 'packages_bulk_import_template.csv');
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
      const priceIdx = header.findIndex((h) => h.includes('price') || h.includes('rate') || h.includes('cost') || h.includes('amount') || h.includes('pkr'));
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
        const category = (catIdx >= 0 ? cols[catIdx] : (cols[1] || 'General')) || 'General';
        const rawPrice = (priceIdx >= 0 ? cols[priceIdx] : cols[2]) || '';
        const cleanedPrice = String(rawPrice).replace(/[^0-9.]/g, '');
        const price = cleanedPrice !== '' ? Number(cleanedPrice) : NaN;
        const rawDur = durationIdx >= 0 ? cols[durationIdx] : '30';
        const duration = Number(rawDur) || 30;
        const code = (codeIdx >= 0 && cols[codeIdx] ? cols[codeIdx] : '')?.toUpperCase() || undefined;
        const description = descIdx >= 0 && cols[descIdx] ? cols[descIdx].trim() : '';
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
        } else if (isNaN(price) || price < 0 || cleanedPrice === '') {
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
          category: category.trim() || 'General',
          price: isNaN(price) ? 0 : price,
          durationMinutes: duration,
          code,
          description,
          taxTreatment,
          isActive,
          isValid,
          error,
        };
      });

      setParsedServices(parsed);
    } else {
      // PACKAGES
      const nameIdx = header.findIndex((h) => h.includes('name') || h === 'package' || h.includes('pack'));
      const priceIdx = header.findIndex((h) => h.includes('price') || h.includes('rate') || h.includes('cost') || h.includes('amount') || h.includes('pkr'));
      const compIdx = header.findIndex((h) => h.includes('serv') || h.includes('comp') || h.includes('item'));
      const codeIdx = header.findIndex((h) => h.includes('code') || h === 'id');
      const descIdx = header.findIndex((h) => h.includes('desc'));
      const taxIdx = header.findIndex((h) => h.includes('tax'));
      const statusIdx = header.findIndex((h) => h.includes('status') || h.includes('active'));

      const existingCodes = new Set(
        existingPackages
          .filter((p) => p.branchId === branchId)
          .map((p) => p.code.toUpperCase())
      );
      const branchServices = existingServices.filter((s) => !branchId || branchId === 'ALL' || s.branchId === branchId);
      const availableServices = branchServices.length > 0 ? branchServices : existingServices;
      const seenCodesInBatch = new Set<string>();

      const parsed: ParsedPackageRow[] = rows.map((cols, idx) => {
        const rowNum = idx + 2;
        const name = (nameIdx >= 0 ? cols[nameIdx] : cols[0]) || '';
        const rawPrice = (priceIdx >= 0 ? cols[priceIdx] : cols[1]) || '';
        const cleanedPrice = String(rawPrice).replace(/[^0-9.]/g, '');
        const price = cleanedPrice !== '' ? Number(cleanedPrice) : NaN;
        
        let rawComps = '';
        if (compIdx >= 0) {
          rawComps = cols.slice(compIdx).join(', ');
        } else if (cols.length > 2) {
          rawComps = cols.slice(2).join(', ');
        } else {
          rawComps = cols[2] || '';
        }

        const code = (codeIdx >= 0 && cols[codeIdx] ? cols[codeIdx] : '')?.toUpperCase() || undefined;
        const description = descIdx >= 0 && cols[descIdx] ? cols[descIdx].trim() : '';
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
        } else if (isNaN(price) || price < 0 || cleanedPrice === '') {
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

        // Parse components: format "Service 1, Service 2" or "Service 1; Service 2" or "Service1:Qty:Alloc"
        const componentTokens = rawComps
          .split(/[,;+]/)
          .map((c) => c.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);

        const components: ParsedPackageComponent[] = [];

        if (componentTokens.length === 0 && isValid) {
          isValid = false;
          error = 'No services specified for this package.';
        } else {
          for (const token of componentTokens) {
            const parts = token.split(':').map((p) => p.trim());
            const identifier = parts[0];
            const qty = parts[1] ? parseInt(parts[1], 10) || 1 : 1;
            const alloc = parts[2] ? parseFloat(parts[2]) : undefined;

            // Match against available services by code or name or id
            const cleanId = identifier.trim().toLowerCase();
            const matched = availableServices.find(
              (s) =>
                s.name.trim().toLowerCase() === cleanId ||
                s.code.trim().toUpperCase() === identifier.trim().toUpperCase() ||
                s.id === identifier.trim()
            );

            if (matched && !matched.isActive && isValid) {
              isValid = false;
              error = `Service '${matched.name}' is deactivated.`;
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
          description,
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
    if (!actionScope.validate()) return;
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
            serviceCode: c.matchedService?.code,
            serviceName: c.matchedService?.name || c.serviceIdentifier,
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
                {activeTab === 'SERVICES' ? 'Bulk Upload Standalone Services' : 'Bulk Upload Bundled Packages'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {activeTab === 'SERVICES'
                  ? 'Upload or paste comma-separated records to add multiple standalone services to this branch catalogue.'
                  : 'Upload or paste comma-separated records to create package bundles from your existing catalogue services without creating standalone services.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* TAB SELECTOR: SERVICES vs PACKAGES */}
        <BranchActionField value={branchId} disabled={isSubmitting} onChange={(id) => { actionScope.setBranchId(id); handleTabChange(activeTab); }} />
        {actionScope.error && <p role="alert" className="text-xs text-rose-600">{actionScope.error}</p>}
        <fieldset disabled={!actionScope.ready}>
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
                  {activeTab === 'SERVICES'
                    ? 'Paste CSV Content (Columns: Name, Category, Price):'
                    : 'Paste CSV Content (Columns: Package Name, Price, Services):'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {activeTab === 'SERVICES'
                    ? 'Code: Auto-generated | Tax: Branch Default | Status: Active'
                    : 'Packages bundle existing services. Standalone services are NEVER auto-created.'}
                </span>
              </div>
              <textarea
                value={rawText}
                onChange={handleTextChange}
                placeholder={
                  activeTab === 'SERVICES'
                    ? `Name,Category,Price\nHair Cut,Hair,3500\nBeard Grooming,Grooming,800\nSignature Facial,Skin,5000`
                    : `Package Name,Price,Services\nGroom Special,4000,"Hair Cut, Beard Grooming"\nBridal Glow,15000,"Hydra Facial, Classic Manicure"`
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
                      <TableHead>{activeTab === 'SERVICES' ? 'Service Name' : 'Package Name'}</TableHead>
                      {activeTab === 'SERVICES' ? (
                        <>
                          <TableHead>Category</TableHead>
                          <TableHead>Price (PKR)</TableHead>
                          <TableHead>Service Code</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Included Services</TableHead>
                          <TableHead>Price (PKR)</TableHead>
                          <TableHead>Package Code</TableHead>
                        </>
                      )}
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
                            <TableCell className="font-semibold text-slate-900">
                              {formatCurrency(row.price)}
                            </TableCell>
                            <TableCell>
                              {row.code ? (
                                <span className="font-mono text-[11px] text-slate-600">{row.code}</span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  Auto-generated
                                </span>
                              )}
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
                                    variant={c.matchedService ? 'neutral' : 'outline'}
                                    className={`text-[10px] font-normal ${!c.matchedService ? 'border-blue-300 text-blue-700 bg-blue-50/60' : ''}`}
                                  >
                                    {c.matchedService?.name || c.serviceIdentifier}
                                    {!c.matchedService && (
                                      <span className="ml-1 text-[9px] font-semibold text-blue-600">(Package only)</span>
                                    )}
                                    {c.quantity > 1 ? ` (x${c.quantity})` : ''}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-900">
                              {formatCurrency(row.price)}
                            </TableCell>
                            <TableCell>
                              {row.code ? (
                                <span className="font-mono text-[11px] text-slate-600">{row.code}</span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  Auto-generated
                                </span>
                              )}
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

        </fieldset>
        <DialogFooter className="mt-4 pt-3 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirmImport}
            disabled={isSubmitting || !actionScope.ready || currentValidCount === 0}
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
