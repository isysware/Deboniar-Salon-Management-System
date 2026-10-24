import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import {
  Device,
  DeviceType,
  DeviceConnectionType,
  DeviceStatus,
  DeviceLog,
  TestConnectionResult,
} from '@/types/salon';
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
  Cpu,
  Plus,
  Search,
  MoreVertical,
  Edit,
  PowerOff,
  Power,
  Trash2,
  RefreshCw,
  Activity,
  Wifi,
  Server,
  Printer,
  Fingerprint,
  Barcode,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  FileText,
  Sliders,
  ShieldCheck,
} from 'lucide-react';

interface DeviceIntegrationViewProps {
  branchId: string;
  branchName?: string;
  onRefresh?: () => void;
  branchSwitcher?: React.ReactNode;
}

export const DeviceIntegrationView: React.FC<DeviceIntegrationViewProps> = ({
  branchId,
  branchName,
  branchSwitcher,
}) => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<DeviceLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    deviceType: DeviceType;
    brand: string;
    model: string;
    serialNumber: string;
    connectionType: DeviceConnectionType;
    ipAddress: string;
    port: string;
    communicationKey: string;
    isActive: boolean;
    paperWidth: string;
    autoCut: boolean;
    drawerKick: boolean;
  }>({
    name: '',
    deviceType: 'BIOMETRIC_ATTENDANCE',
    brand: 'ZKTeco',
    model: 'iClock 880',
    serialNumber: '',
    connectionType: 'ETHERNET_LAN',
    ipAddress: '192.168.1.201',
    port: '4370',
    communicationKey: '0',
    isActive: true,
    paperWidth: '80',
    autoCut: true,
    drawerKick: true,
  });

  const loadDevices = async () => {
    if (!branchId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await salonService.getDevices(branchId, user || undefined);
      setDevices(data);
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      setErrorMessage(err.message || 'Failed to load branch devices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [branchId]);

  // Handle device type change to populate smart defaults
  const handleDeviceTypeChange = (type: DeviceType) => {
    if (type === 'BIOMETRIC_ATTENDANCE') {
      setFormData((prev) => ({
        ...prev,
        deviceType: type,
        brand: 'ZKTeco',
        model: 'iClock 880',
        port: '4370',
        connectionType: 'ETHERNET_LAN',
      }));
    } else if (type === 'POS_PRINTER') {
      setFormData((prev) => ({
        ...prev,
        deviceType: type,
        brand: 'Epson',
        model: 'TM-T88VI',
        port: '9100',
        connectionType: 'ETHERNET_LAN',
      }));
    } else if (type === 'BARCODE_SCANNER') {
      setFormData((prev) => ({
        ...prev,
        deviceType: type,
        brand: 'Honeywell',
        model: 'Voyager 1200g',
        connectionType: 'USB',
        port: '',
        ipAddress: '',
      }));
    } else if (type === 'PAYMENT_TERMINAL') {
      setFormData((prev) => ({
        ...prev,
        deviceType: type,
        brand: 'Pax',
        model: 'D220',
        connectionType: 'WIFI',
        port: '8080',
        ipAddress: '192.168.1.210',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        deviceType: type,
        brand: 'APG',
        model: 'Series 100',
        connectionType: 'USB',
        port: '',
        ipAddress: '',
      }));
    }
  };

  // Open Edit Modal
  const openEditModal = (dev: Device) => {
    setSelectedDevice(dev);
    setFormData({
      name: dev.name,
      deviceType: dev.deviceType,
      brand: dev.brand,
      model: dev.model,
      serialNumber: dev.serialNumber || '',
      connectionType: dev.connectionType,
      ipAddress: dev.ipAddress || '',
      port: dev.port ? String(dev.port) : '',
      communicationKey: dev.communicationKey || '',
      isActive: dev.isActive,
      paperWidth: dev.config?.paperWidth ? String(dev.config.paperWidth) : '80',
      autoCut: dev.config?.autoCut ?? true,
      drawerKick: dev.config?.drawerKick ?? true,
    });
    setIsEditModalOpen(true);
  };

  // Save handler (Add / Edit)
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        branchId,
        name: formData.name.trim(),
        deviceType: formData.deviceType,
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        serialNumber: formData.serialNumber.trim() || undefined,
        connectionType: formData.connectionType,
        ipAddress: formData.ipAddress.trim() || undefined,
        port: formData.port ? parseInt(formData.port, 10) : undefined,
        communicationKey: formData.communicationKey.trim() || undefined,
        isActive: formData.isActive,
        config: {
          paperWidth: formData.deviceType === 'POS_PRINTER' ? Number(formData.paperWidth) : undefined,
          autoCut: formData.deviceType === 'POS_PRINTER' ? formData.autoCut : undefined,
          drawerKick: formData.deviceType === 'POS_PRINTER' ? formData.drawerKick : undefined,
        },
      };

      if (isAddModalOpen) {
        await salonService.createDevice(payload, user || undefined);
        toast.success(`Device '${payload.name}' registered successfully!`);
        setIsAddModalOpen(false);
      } else if (isEditModalOpen && selectedDevice) {
        await salonService.updateDevice(selectedDevice.id, payload, user || undefined);
        toast.success(`Device '${payload.name}' updated successfully!`);
        setIsEditModalOpen(false);
      }
      loadDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save device.');
    }
  };

  // Toggle active status
  const handleToggleStatus = async (dev: Device) => {
    try {
      const updated = await salonService.toggleDeviceStatus(dev.id, user || undefined);
      toast.success(`Device '${dev.name}' is now ${updated.isActive ? 'Active' : 'Disabled'}.`);
      loadDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change device status.');
    }
  };

  // Delete handler
  const handleDeleteDevice = async () => {
    if (!selectedDevice) return;
    try {
      const res = await salonService.deleteDevice(selectedDevice.id, user || undefined);
      toast.success(res.message);
      setIsDeleteModalOpen(false);
      loadDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove device.');
    }
  };

  // Test Connection handler
  const runTestConnection = async (dev: Device) => {
    setSelectedDevice(dev);
    setTestResult(null);
    setIsTestModalOpen(true);
    setIsTesting(true);
    try {
      const result = await salonService.testDeviceConnection(dev.id, undefined, user || undefined);
      setTestResult(result);
      if (result.connected) {
        toast.success(`Device online! Ping latency: ${result.latencyMs}ms`);
      } else {
        toast.error(`Device test failed: ${result.message}`);
      }
      loadDevices();
    } catch (err: any) {
      toast.error(err.message || 'Connection test failed.');
    } finally {
      setIsTesting(false);
    }
  };

  // Sync handler
  const handleSyncDevice = async (dev: Device) => {
    setIsSyncingId(dev.id);
    try {
      const res = await salonService.syncDevice(dev.id, undefined, user || undefined);
      toast.success(res.message);
      loadDevices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync device.');
    } finally {
      setIsSyncingId(null);
    }
  };

  // View logs handler
  const handleViewLogs = async (dev: Device) => {
    setSelectedDevice(dev);
    setIsLogsModalOpen(true);
    setIsLoadingLogs(true);
    try {
      const logs = await salonService.getDeviceLogs(dev.id, user || undefined, 30);
      setDeviceLogs(logs);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch device logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        (d.ipAddress && d.ipAddress.includes(q)) ||
        (d.serialNumber && d.serialNumber.toLowerCase().includes(q));

      const matchesType = typeFilter === 'ALL' || d.deviceType === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [devices, searchQuery, typeFilter, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.status === 'ONLINE' && d.isActive).length;
    const biometric = devices.filter((d) => d.deviceType === 'BIOMETRIC_ATTENDANCE').length;
    const printers = devices.filter((d) => d.deviceType === 'POS_PRINTER').length;
    return { total, online, biometric, printers };
  }, [devices]);

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'BIOMETRIC_ATTENDANCE':
        return <Fingerprint className="w-4 h-4 text-emerald-600" />;
      case 'POS_PRINTER':
        return <Printer className="w-4 h-4 text-[#2254E1]" />;
      case 'BARCODE_SCANNER':
        return <Barcode className="w-4 h-4 text-purple-600" />;
      case 'PAYMENT_TERMINAL':
        return <CreditCard className="w-4 h-4 text-amber-600" />;
      default:
        return <Cpu className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: DeviceStatus, isActive: boolean) => {
    if (!isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Deactivated
        </span>
      );
    }

    switch (status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online & Ready
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
            Syncing
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            Unreachable / Error
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Offline
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[#2254E1]" />
            Connected Devices & Terminals
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure ZKTeco biometric punch terminals, ESC/POS thermal printers, barcode scanners, and payment card readers for {branchName || 'this branch'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {branchSwitcher}
          <Button
            variant="outline"
            size="sm"
            onClick={loadDevices}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="text-xs font-semibold"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              handleDeviceTypeChange('BIOMETRIC_ATTENDANCE');
              setFormData((prev) => ({
                ...prev,
                name: 'Main Entrance Biometric',
                serialNumber: '',
              }));
              setIsAddModalOpen(true);
            }}
            className="text-xs font-semibold shadow-sm"
          >
            Add Hardware Device
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Hardware Error</AlertTitle>
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="sm" className="bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">Total Registered</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-[#2254E1]" />
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900 mt-2 block">{metrics.total}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Configured hardware profiles</span>
        </Card>

        <Card padding="sm" className="bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">Online Terminals</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
          <span className="text-2xl font-bold text-emerald-700 mt-2 block">{metrics.online}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Responding to ping heartbeat</span>
        </Card>

        <Card padding="sm" className="bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">Biometric Readers</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <Fingerprint className="w-3.5 h-3.5 text-purple-600" />
            </div>
          </div>
          <span className="text-2xl font-bold text-purple-700 mt-2 block">{metrics.biometric}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">ZKTeco / BioTime attendance</span>
        </Card>

        <Card padding="sm" className="bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">POS Printers</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Printer className="w-3.5 h-3.5 text-amber-600" />
            </div>
          </div>
          <span className="text-2xl font-bold text-amber-700 mt-2 block">{metrics.printers}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">ESC/POS thermal counters</span>
        </Card>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search device name, brand, model, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="All Device Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Hardware Categories</SelectItem>
            <SelectItem value="BIOMETRIC_ATTENDANCE" className="text-xs">Biometric Attendance Terminals</SelectItem>
            <SelectItem value="POS_PRINTER" className="text-xs">Receipt / POS Printers</SelectItem>
            <SelectItem value="BARCODE_SCANNER" className="text-xs">Barcode / QR Scanners</SelectItem>
            <SelectItem value="PAYMENT_TERMINAL" className="text-xs">Card Payment Terminals</SelectItem>
            <SelectItem value="CASH_DRAWER" className="text-xs">Electronic Cash Drawers</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="All Connection Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All Connection Statuses</SelectItem>
            <SelectItem value="ONLINE" className="text-xs">Online & Connected</SelectItem>
            <SelectItem value="OFFLINE" className="text-xs">Offline</SelectItem>
            <SelectItem value="ERROR" className="text-xs">Error / Unreachable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* DEVICES TABLE */}
      <Card padding="none" className="bg-white border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700 py-3">Device / Hardware</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 py-3">Category</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 py-3">Connection Details</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 py-3">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 py-3">Last Activity / Sync</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                    Scanning branch hardware network...
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500 text-xs">
                    <Cpu className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No hardware devices configured matching current criteria.
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('');
                          setTypeFilter('ALL');
                          setStatusFilter('ALL');
                        }}
                        className="text-xs"
                      >
                        Clear Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((dev) => (
                  <TableRow key={dev.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Device info */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                          {getDeviceIcon(dev.deviceType)}
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-slate-900 block">{dev.name}</span>
                          <span className="text-[11px] text-slate-500 block">
                            {dev.brand} {dev.model}
                            {dev.serialNumber ? ` · S/N: ${dev.serialNumber}` : ''}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell className="py-3">
                      <span className="text-xs font-medium text-slate-700">
                        {dev.deviceType === 'BIOMETRIC_ATTENDANCE'
                          ? 'Biometric Attendance'
                          : dev.deviceType === 'POS_PRINTER'
                          ? 'POS Thermal Printer'
                          : dev.deviceType === 'BARCODE_SCANNER'
                          ? 'Barcode Scanner'
                          : dev.deviceType === 'PAYMENT_TERMINAL'
                          ? 'Card Terminal'
                          : 'Cash Drawer'}
                      </span>
                    </TableCell>

                    {/* Connection */}
                    <TableCell className="py-3">
                      <div className="text-xs">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800">
                          {dev.connectionType === 'ETHERNET_LAN' && <Server className="w-3 h-3 text-slate-400" />}
                          {dev.connectionType === 'WIFI' && <Wifi className="w-3 h-3 text-slate-400" />}
                          {dev.ipAddress ? (
                            <span>
                              {dev.ipAddress}
                              {dev.port ? `:${dev.port}` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">Direct {dev.connectionType}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {dev.connectionType.replace('_', ' ')}
                          {dev.baudRate ? ` · ${dev.baudRate} bps` : ''}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      {getStatusBadge(dev.status, dev.isActive)}
                    </TableCell>

                    {/* Last Activity */}
                    <TableCell className="py-3">
                      <div className="text-[11px] text-slate-600">
                        {dev.lastPingAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Ping: {new Date(dev.lastPingAt).toLocaleTimeString()}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Never pinged</span>
                        )}
                        {dev.lastSyncStatus && (
                          <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5" title={dev.lastSyncStatus}>
                            {dev.lastSyncStatus}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runTestConnection(dev)}
                          className="h-8 text-[11px] font-semibold text-[#2254E1] border-blue-200 hover:bg-blue-50"
                        >
                          Test Ping
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSyncingId === dev.id || !dev.isActive}
                          onClick={() => handleSyncDevice(dev)}
                          className="h-8 text-[11px] font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        >
                          {isSyncingId === dev.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                          ) : (
                            'Sync'
                          )}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs font-medium">
                            <DropdownMenuItem onClick={() => openEditModal(dev)} className="gap-2 cursor-pointer">
                              <Edit className="w-3.5 h-3.5 text-slate-500" />
                              Edit Configuration
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewLogs(dev)} className="gap-2 cursor-pointer">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              View Diagnostic Logs
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(dev)} className="gap-2 cursor-pointer">
                              {dev.isActive ? (
                                <>
                                  <PowerOff className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Deactivate Hardware</span>
                                </>
                              ) : (
                                <>
                                  <Power className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Activate Hardware</span>
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedDevice(dev);
                                setIsDeleteModalOpen(true);
                              }}
                              className="gap-2 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove Device
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── MODAL: ADD / EDIT DEVICE ────────────────────────────────────────── */}
      <Dialog
        open={isAddModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-xl font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Cpu className="w-4 h-4 text-[#2254E1]" />
              {isAddModalOpen ? 'Register Hardware Device' : `Edit Device: ${selectedDevice?.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provide network credentials and interface settings for this branch terminal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDevice} className="space-y-4 py-2">
            {/* Category / Purpose */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Device Category / Purpose</label>
              <Select
                value={formData.deviceType}
                onValueChange={(val) => handleDeviceTypeChange(val as DeviceType)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIOMETRIC_ATTENDANCE" className="text-xs">
                    Biometric Attendance Machine (ZKTeco / BioTime)
                  </SelectItem>
                  <SelectItem value="POS_PRINTER" className="text-xs">
                    POS Receipt Thermal Printer (ESC/POS)
                  </SelectItem>
                  <SelectItem value="BARCODE_SCANNER" className="text-xs">
                    Barcode / QR Scanner (USB / Wireless)
                  </SelectItem>
                  <SelectItem value="PAYMENT_TERMINAL" className="text-xs">
                    Card Payment Terminal (Pax / Ingenico)
                  </SelectItem>
                  <SelectItem value="CASH_DRAWER" className="text-xs">
                    Electronic Cash Drawer (RJ11/USB Trigger)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name & Serial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Device Display Name *</label>
                <Input
                  required
                  placeholder="e.g. Front Counter Biometric"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Serial Number</label>
                <Input
                  placeholder="e.g. ZK-LHE-98210"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Brand & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Manufacturer / Brand *</label>
                <Input
                  required
                  placeholder="e.g. ZKTeco, Epson, Zebra"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Hardware Model *</label>
                <Input
                  required
                  placeholder="e.g. iClock 880, TM-T88VI"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Connection Interface */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Connection Interface</label>
              <Select
                value={formData.connectionType}
                onValueChange={(val) => setFormData({ ...formData, connectionType: val as DeviceConnectionType })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Interface" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETHERNET_LAN" className="text-xs">Ethernet LAN (TCP/IP Cable)</SelectItem>
                  <SelectItem value="WIFI" className="text-xs">Wi-Fi Wireless Subnet</SelectItem>
                  <SelectItem value="USB" className="text-xs">Direct USB Cable</SelectItem>
                  <SelectItem value="SERIAL_COM" className="text-xs">RS232 / Serial COM Port</SelectItem>
                  <SelectItem value="BLUETOOTH" className="text-xs">Bluetooth Wireless</SelectItem>
                  <SelectItem value="CLOUD_API" className="text-xs">Cloud Push API / Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Network IP & Port (if LAN / Wi-Fi) */}
            {(formData.connectionType === 'ETHERNET_LAN' ||
              formData.connectionType === 'WIFI' ||
              formData.connectionType === 'CLOUD_API') && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 mb-1 block">IP Address (Static LAN)</label>
                  <Input
                    placeholder="192.168.1.201"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Assign fixed DHCP reservation</span>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-1 block">Port</label>
                  <Input
                    placeholder="4370"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="h-9 text-xs font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">ZKTeco: 4370 · Printer: 9100</span>
                </div>
              </div>
            )}

            {/* Communication Key for Biometrics */}
            {formData.deviceType === 'BIOMETRIC_ATTENDANCE' && (
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Communication Password / CommKey
                </label>
                <Input
                  placeholder="0 (Default is 0)"
                  value={formData.communicationKey}
                  onChange={(e) => setFormData({ ...formData, communicationKey: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Match the Communication Key configured on device menu.
                </span>
              </div>
            )}

            {/* Printer specific options */}
            {formData.deviceType === 'POS_PRINTER' && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-1 block">Paper Width</label>
                  <Select
                    value={formData.paperWidth}
                    onValueChange={(val) => setFormData({ ...formData, paperWidth: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Width" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80" className="text-xs">80mm (Standard)</SelectItem>
                      <SelectItem value="58" className="text-xs">58mm (Compact)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="autoCut"
                    checked={formData.autoCut}
                    onChange={(e) => setFormData({ ...formData, autoCut: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="autoCut" className="text-xs text-slate-700 font-medium">Auto-cut paper</label>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="drawerKick"
                    checked={formData.drawerKick}
                    onChange={(e) => setFormData({ ...formData, drawerKick: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="drawerKick" className="text-xs text-slate-700 font-medium">Kick cash drawer</label>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                {isAddModalOpen ? 'Save Hardware Device' : 'Update Configuration'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: TEST CONNECTION ──────────────────────────────────────────── */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Activity className="w-4 h-4 text-[#2254E1]" />
              Hardware Diagnostic Ping: {selectedDevice?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Verifying real-time TCP socket handshake and device firmware responsiveness.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {isTesting ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#2254E1] mb-3" />
                <span className="text-xs font-semibold text-slate-800 block">
                  Transmitting SYN packet to {selectedDevice?.ipAddress}:{selectedDevice?.port}...
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">Awaiting ACK response from device buffer</span>
              </div>
            ) : testResult ? (
              <div className="space-y-3">
                <div
                  className={`p-4 rounded-xl border ${
                    testResult.connected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.connected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                    )}
                    <div>
                      <span className="text-xs font-bold block">
                        {testResult.connected ? 'Device Reachable (Online)' : 'Connection Failed'}
                      </span>
                      <span className="text-[11px] opacity-90 block mt-0.5">{testResult.message}</span>
                    </div>
                  </div>
                </div>

                {/* Diagnostics table */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Round-Trip Latency:</span>
                    <span className="font-semibold text-slate-800">{testResult.latencyMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Address:</span>
                    <span className="text-slate-800">
                      {selectedDevice?.ipAddress || 'Direct COM'}:{selectedDevice?.port || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Protocol:</span>
                    <span className="text-slate-800">
                      {selectedDevice?.deviceType === 'BIOMETRIC_ATTENDANCE'
                        ? 'ZKTeco UDP/TCP 4370'
                        : selectedDevice?.deviceType === 'POS_PRINTER'
                        ? 'ESC/POS Raw 9100'
                        : selectedDevice?.connectionType}
                    </span>
                  </div>
                </div>

                {!testResult.connected && testResult.diagnostics?.troubleshooting && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
                    <span className="font-bold block mb-1">Troubleshooting Checklist:</span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      {testResult.diagnostics.troubleshooting.map((tip: string, i: number) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={isTesting}
              onClick={() => setIsTestModalOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isTesting || !selectedDevice}
              onClick={() => selectedDevice && runTestConnection(selectedDevice)}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />}
            >
              Re-test Ping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: VIEW LOGS ────────────────────────────────────────────────── */}
      <Dialog open={isLogsModalOpen} onOpenChange={setIsLogsModalOpen}>
        <DialogContent className="max-w-2xl font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileText className="w-4 h-4 text-[#2254E1]" />
              Event History & Diagnostics: {selectedDevice?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Audit trails, ping packets, and synchronization logs for this terminal.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 max-h-96 overflow-y-auto space-y-2">
            {isLoadingLogs ? (
              <div className="text-center py-8 text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto text-blue-600 mb-2" />
                Loading diagnostic logs...
              </div>
            ) : deviceLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No logs recorded yet for this terminal.
              </div>
            ) : (
              deviceLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      {log.eventType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{log.message}</p>
                  {log.payload && (
                    <pre className="text-[10px] font-mono bg-white p-2 rounded border border-slate-200 overflow-x-auto text-slate-700">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsLogsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: DELETE DEVICE CONFIRMATION ────────────────────────────────── */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent className="font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-rose-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Remove Hardware Device
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Are you sure you want to remove <strong>{selectedDevice?.name}</strong>? This will detach
              the hardware from branch <strong>{branchName}</strong>. Historical employee attendance records
              already synchronized will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDevice}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
            >
              Yes, Remove Device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
