import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { salonService } from '@/services';
import {
  ServiceItem,
  PackageItem,
  StaffMember,
  PaymentAccount,
  Branch,
  Invoice,
  POSCartItem,
  POSCartComponentAssignment,
  POSPaymentEntry,
  CreatePOSInvoiceInput,
  Client,
  CustomerSource,
  Appointment,
  InventoryItem,
} from '@/types/salon';
import {
  getCatalogueSellingPrice,
  getCatalogueCode,
  getCatalogueTaxRuleId,
} from '@/utils/catalogueHelpers';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { ReceiptModal } from './ReceiptModal';
import { AppointmentQueueSheet } from './components/AppointmentQueueSheet';
import { CartOverwritePromptModal } from './components/CartOverwritePromptModal';
import { ClientFormModal } from '../clients/components/ClientFormModal';
import { toast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/formatters';
import { allocatePackageRevenue, roundCurrency } from '@/lib/taxCalculations';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScissorLoader } from '@/components/ui/ScissorLoader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  ShoppingCart,
  Scissors,
  Package,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Coins,
  Percent,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  UserCheck,
  History,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Printer,
  Tag,
  Wallet,
  Phone,
  ShoppingBag,
} from 'lucide-react';

export const POSBillingPage: React.FC = () => {
  const { user, activeBranchId, allBranches, switchBranch, demoDate } = useAuth();

  // 1. Role Guard: Super Admin, Admin, and Accountant
  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/pos" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Branch Scope
  const currentSelectedBranchId = isSuperAdmin
    ? (activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '')
    : (user.branchId as string);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentSelectedBranchId);

  // Sync when activeBranchId changes
  useEffect(() => {
    if (isSuperAdmin && activeBranchId !== 'ALL') {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId, isSuperAdmin]);

  // Data collections
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [productStockMap, setProductStockMap] = useState<Record<string, number>>({});
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Catalogue UI state
  const [catalogueTab, setCatalogueTab] = useState<'SERVICES' | 'PACKAGES' | 'PRODUCTS'>('SERVICES');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollerRef = useRef<HTMLDivElement>(null);

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (categoryScrollerRef.current && e.deltaY !== 0) {
      categoryScrollerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Shortcut: '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cart & Customer state
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [customerSource, setCustomerSource] = useState<CustomerSource>('WALK_IN');
  const [customerSourceDetails, setCustomerSourceDetails] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Customer search / lookup dropdown state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Client[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Dues / Invoices collection modal state
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [customerOutstandingInvoices, setCustomerOutstandingInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [collectionPaymentMode, setCollectionPaymentMode] = useState<'CASH' | 'ONLINE' | 'SPLIT'>('CASH');
  const [collectionAmountInput, setCollectionAmountInput] = useState<number>(0);
  const [collectionCashTendered, setCollectionCashTendered] = useState<number>(0);
  const [collectionOnlineAccountId, setCollectionOnlineAccountId] = useState<string>('');
  const [splitCollectionCashAmount, setSplitCollectionCashAmount] = useState<number>(0);
  const [splitCollectionCashTendered, setSplitCollectionCashTendered] = useState<number>(0);
  const [splitCollectionOnlinePayments, setSplitCollectionOnlinePayments] = useState<
    Array<{ paymentAccountId: string; amount: number }>
  >([]);
  const [collectionNotes, setCollectionNotes] = useState('');
  const [isPostingCollection, setIsPostingCollection] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  // Discount & Tip state
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [applyBranchTax, setApplyBranchTax] = useState<boolean>(true);

  // Payment / Checkout dialog state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'CASH' | 'ONLINE' | 'SPLIT' | 'UNPAID'>('CASH');
  const [cashTenderedInput, setCashTenderedInput] = useState<number>(0);
  const [selectedOnlineAccountId, setSelectedOnlineAccountId] = useState<string>('');
  const [onlineAmountInput, setOnlineAmountInput] = useState<number>(0);

  // Split payment state
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitCashTendered, setSplitCashTendered] = useState<number>(0);
  const [splitOnlinePayments, setSplitOnlinePayments] = useState<
    Array<{ paymentAccountId: string; amount: number }>
  >([]);

  // Posting & Receipt state
  const [isPosting, setIsPosting] = useState(false);
  const [postingError, setPostingError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [postedInvoice, setPostedInvoice] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Appointment Queue & Handoff state
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [loadedAppointment, setLoadedAppointment] = useState<Appointment | null>(null);
  const [pendingAppointmentToLoad, setPendingAppointmentToLoad] = useState<Appointment | null>(null);
  const [isCartOverwritePromptOpen, setIsCartOverwritePromptOpen] = useState(false);
  const [acknowledgedPriceDiscrepancy, setAcknowledgedPriceDiscrepancy] = useState(false);

  // Load branch data
  const loadBranchData = async (bId: string) => {
    setIsLoading(true);
    try {
      const [branchList, srvList, pkgList, stfList, accList, prodList, batchList] = await Promise.all([
        salonService.getBranches(),
        salonService.getServices(bId),
        salonService.getPackages(bId),
        salonService.getStaffMembers(user, bId),
        salonService.getPaymentAccounts(bId),
        salonService.getInventoryItems(bId, user),
        salonService.getInventoryBatches(bId, undefined, user),
      ]);

      const br = branchList.find((b) => b.id === bId) || null;
      setCurrentBranch(br);
      // Filter active items for POS catalogue
      setServices(srvList.filter((s) => s.isActive));
      setPackages(pkgList.filter((p) => p.isActive));

      const retailProds = prodList.filter(
        (p) => (p.itemType === 'RETAIL_PRODUCT' || p.itemType === 'BOTH') && p.isActive
      );
      setProducts(retailProds);

      const sMap: Record<string, number> = {};
      const todayStr = demoDate || new Date().toISOString().split('T')[0];
      for (const p of retailProds) {
        const pBatches = batchList.filter((b) => {
          if (b.itemId !== p.id) return false;
          if (b.branchId && b.branchId !== bId) return false;
          if (b.status === 'QUARANTINED' || b.status === 'EXPIRED') return false;
          if (b.expiryDate && b.expiryDate < todayStr) return false;
          return (Number(b.remainingQuantity) || 0) > 0;
        });
        sMap[p.id] = pBatches.reduce((sum, b) => sum + (Number(b.remainingQuantity) || 0), 0);
      }
      setProductStockMap(sMap);

      // Only active staff can be assigned
      const activeStaff = stfList.filter((st) => st.isActive);
      setStaffList(activeStaff);
      // Only active payment accounts
      const activeAccounts = accList.filter((acc) => acc.isActive);
      setPaymentAccounts(activeAccounts);

      if (activeAccounts.length > 0) {
        setSelectedOnlineAccountId(activeAccounts[0].id);
        setCollectionOnlineAccountId(activeAccounts[0].id);
      }
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh queue count
  const refreshQueueCount = async (bId: string) => {
    try {
      const qDate = demoDate || new Date().toISOString().split('T')[0];
      const items = await salonService.getAppointmentQueue(bId, qDate, user);
      setQueueCount(items.length);
    } catch (err) {
      console.error('Failed to fetch queue count', err);
    }
  };

  useEffect(() => {
    if (selectedBranchId && selectedBranchId !== 'ALL') {
      loadBranchData(selectedBranchId);
      refreshQueueCount(selectedBranchId);
    }
  }, [selectedBranchId, demoDate]);

  // Check URL query parameters (?appointmentId=... or ?clientId=...)
  useEffect(() => {
    const searchStr = window.location.search || window.location.hash.split('?')[1] || '';
    if (!searchStr) return;
    const params = new URLSearchParams(searchStr);
    const appointmentIdParam = params.get('appointmentId');
    const clientIdParam = params.get('clientId');

    if (appointmentIdParam) {
      salonService.getAppointment(appointmentIdParam, user).then((appt) => {
        if (appt) {
          if (appt.billingStatus === 'BILLED') {
            toast.warning(`Appointment ${appt.appointmentNumber || appt.id} has already been billed under invoice ${appt.linkedInvoiceNumber || appt.linkedInvoiceId}.`);
          } else {
            handleOpenAppointmentInPOS(appt);
          }
        }
      });
    } else if (clientIdParam && selectedBranchId) {
      salonService.getClient(clientIdParam, user).then((cl) => {
        if (cl) handleSelectClient(cl);
      });
    }
  }, [selectedBranchId, services.length, packages.length]);

  // Customer search debounced lookup
  useEffect(() => {
    if (!customerSearchQuery.trim() || !selectedBranchId) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingClients(true);
      try {
        const results = await salonService.searchClients(selectedBranchId, customerSearchQuery, user);
        setCustomerSearchResults(results);
      } catch (err) {
        console.error('Failed to search clients:', err);
      } finally {
        setIsSearchingClients(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearchQuery, selectedBranchId]);

  // Handle client selection from search
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientPhone(client.phone);
    setCustomerSource(client.source || 'WALK_IN');
    setCustomerSourceDetails(client.sourceDetails || '');
    setIsWalkIn(false);
    setShowClientDropdown(false);
    setCustomerSearchQuery('');
  };

  // Reset to anonymous walk-in
  const handleSetWalkIn = () => {
    setIsWalkIn(true);
    setClientName('');
    setClientPhone('');
    setCustomerSource('WALK_IN');
    setCustomerSourceDetails('');
    setSelectedClientId(undefined);
    setSelectedClient(null);
    setShowClientDropdown(false);
  };

  // Quick Add Client modal state in POS
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientModalPrefill, setClientModalPrefill] = useState<{ name: string; phone: string }>({ name: '', phone: '' });

  const handleOpenAddClientModal = (query?: string) => {
    const q = (query !== undefined ? query : customerSearchQuery || clientName || clientPhone || '').trim();
    const isPhone = /^[\d+()\-\s]+$/.test(q) && q.replace(/\D/g, '').length >= 4;
    setClientModalPrefill({
      name: isPhone ? (clientName || '') : q,
      phone: isPhone ? q : (clientPhone || ''),
    });
    setIsClientModalOpen(true);
    setShowClientDropdown(false);
  };

  const handleClientCreated = (newClient: Client) => {
    handleSelectClient(newClient);
    setIsClientModalOpen(false);
  };

  // Open Previous Outstanding Invoices modal
  const handleOpenCollectionModal = async () => {
    if (!selectedBranchId || (!selectedClientId && !clientPhone)) return;
    setIsLoadingInvoices(true);
    setIsCollectionModalOpen(true);
    setCollectionError(null);
    try {
      const invs = await salonService.getClientOutstandingInvoices(
        selectedBranchId,
        selectedClientId || clientPhone,
        user
      );
      setCustomerOutstandingInvoices(invs);
      if (invs.length > 0) {
        setSelectedInvoiceForPayment(invs[0]);
        setCollectionAmountInput(invs[0].amountDue);
        setCollectionCashTendered(invs[0].amountDue);
      } else {
        setSelectedInvoiceForPayment(null);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch outstanding invoices.';
      setCollectionError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Post collection payment against previous invoice
  const handlePostCollectionPayment = async () => {
    if (!selectedInvoiceForPayment || collectionAmountInput <= 0) return;
    setIsPostingCollection(true);
    setCollectionError(null);
    try {
      const pAmount = roundCurrency(collectionAmountInput);
      const payments: POSPaymentEntry[] = [];

      if (collectionPaymentMode === 'CASH') {
        const tendered = roundCurrency(collectionCashTendered || pAmount);
        const change = Math.max(0, roundCurrency(tendered - pAmount));
        payments.push({
          method: 'CASH',
          amount: pAmount,
          billAllocation: pAmount,
          tipAllocation: 0,
          cashTendered: tendered,
          changeReturned: change,
        });
      } else if (collectionPaymentMode === 'ONLINE') {
        const acc = paymentAccounts.find((a) => a.id === collectionOnlineAccountId);
        if (!acc) throw new Error('Please select an active payment account.');
        payments.push({
          method: 'ONLINE_ACCOUNT',
          paymentAccountId: acc.id,
          paymentAccountName: `${acc.name} (${acc.accountIdentifier || acc.providerName})`,
          amount: pAmount,
          billAllocation: pAmount,
          tipAllocation: 0,
        });
      } else if (collectionPaymentMode === 'SPLIT') {
        const cAmount = roundCurrency(splitCollectionCashAmount || 0);
        const cTendered = roundCurrency(splitCollectionCashTendered || cAmount);
        const cChange = Math.max(0, roundCurrency(cTendered - cAmount));

        if (cAmount > 0) {
          payments.push({
            method: 'CASH',
            amount: cAmount,
            billAllocation: cAmount,
            tipAllocation: 0,
            cashTendered: cTendered,
            changeReturned: cChange,
          });
        }

        for (const op of splitCollectionOnlinePayments) {
          const acc = paymentAccounts.find((a) => a.id === op.paymentAccountId);
          const opAmount = roundCurrency(op.amount || 0);
          if (opAmount > 0 && acc) {
            payments.push({
              method: 'ONLINE_ACCOUNT',
              paymentAccountId: acc.id,
              paymentAccountName: `${acc.name} (${acc.accountIdentifier || acc.providerName})`,
              amount: opAmount,
              billAllocation: opAmount,
              tipAllocation: 0,
            });
          }
        }
      }

      const collKey = `coll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const updatedInvoice = await salonService.collectInvoicePayment(
        {
          invoiceId: selectedInvoiceForPayment.id,
          payments,
          idempotencyKey: collKey,
          notes: collectionNotes || `Previous dues collected at POS for ${selectedInvoiceForPayment.clientName}`,
        },
        user
      );

      // Refresh client's outstanding balance
      if (selectedClientId && selectedBranchId) {
        const refreshedClient = await salonService.getClient(selectedClientId, user);
        if (refreshedClient) setSelectedClient(refreshedClient);
      }

      setPostedInvoice(updatedInvoice);
      setIsCollectionModalOpen(false);
      setIsReceiptOpen(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh-notifications'));
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to process collection payment.';
      setCollectionError(msg);
      toast.error(msg);
    } finally {
      setIsPostingCollection(false);
    }
  };

  // Categories list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach((s) => {
      if (s.category) cats.add(s.category);
    });
    return Array.from(cats);
  }, [services]);

  // Check if a package contains any deactivated service
  const getPackageValidity = (pkg: PackageItem) => {
    for (const comp of pkg.components) {
      const srv = services.find((s) => s.id === comp.serviceId);
      if (!srv || !srv.isActive) {
        return { isValid: false, reason: `Component '${comp.serviceName}' is deactivated` };
      }
    }
    return { isValid: true };
  };

  // Unified Catalogue list for the grid display (Services, Packages, Products)
  const allCatalogueItems = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'SERVICE' | 'PACKAGE' | 'PRODUCT';
      name: string;
      code: string;
      category: string;
      price: number;
      stock?: number;
      isOutOfStock?: boolean;
      isLowStock?: boolean;
      raw: ServiceItem | PackageItem | InventoryItem;
    }> = [];

    services.forEach((s) => {
      list.push({
        id: s.id,
        type: 'SERVICE',
        name: s.name,
        code: s.code || 'SRV',
        category: s.category || 'Service',
        price: getCatalogueSellingPrice(s),
        raw: s,
      });
    });

    packages.forEach((p) => {
      list.push({
        id: p.id,
        type: 'PACKAGE',
        name: p.name,
        code: p.code || 'PKG',
        category: 'Package',
        price: getCatalogueSellingPrice(p),
        raw: p,
      });
    });

    products.forEach((prod) => {
      const stock = productStockMap[prod.id] ?? 0;
      list.push({
        id: prod.id,
        type: 'PRODUCT',
        name: prod.name,
        code: getCatalogueCode(prod) || prod.sku || 'PRD',
        category: prod.category || prod.brand || 'Retail',
        price: getCatalogueSellingPrice(prod),
        stock,
        isOutOfStock: stock <= 0,
        isLowStock: stock > 0 && stock <= (prod.minStockLevel || 5),
        raw: prod,
      });
    });

    return list;
  }, [services, packages, products, productStockMap]);

  // Dynamic filter category pills matching reference design
  const categoryPills = useMemo(() => {
    const pills: Array<{ key: string; label: string; count: number }> = [];
    pills.push({ key: 'ALL', label: 'All Items', count: allCatalogueItems.length });
    pills.push({ key: 'SERVICES', label: 'Services', count: services.length });
    pills.push({ key: 'PACKAGES', label: 'Packages', count: packages.length });
    pills.push({ key: 'PRODUCTS', label: 'Products', count: products.length });

    // Distinct category names
    const catMap = new Map<string, number>();
    allCatalogueItems.forEach((item) => {
      if (item.category && item.category !== 'Package' && item.category !== 'Service' && item.category !== 'Retail') {
        catMap.set(item.category, (catMap.get(item.category) || 0) + 1);
      }
    });

    catMap.forEach((count, cat) => {
      pills.push({ key: `CAT:${cat}`, label: cat, count });
    });

    return pills;
  }, [allCatalogueItems, services.length, packages.length, products.length]);

  // Filtered items shown in the card grid
  const filteredCatalogueItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allCatalogueItems.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'SERVICES') return item.type === 'SERVICE';
      if (selectedCategory === 'PACKAGES') return item.type === 'PACKAGE';
      if (selectedCategory === 'PRODUCTS') return item.type === 'PRODUCT';
      if (selectedCategory.startsWith('CAT:')) {
        const cat = selectedCategory.slice(4);
        return item.category === cat;
      }
      return item.category === selectedCategory;
    });
  }, [allCatalogueItems, searchQuery, selectedCategory]);

  const handleItemCardClick = (item: any) => {
    if (item.type === 'SERVICE') {
      handleAddServiceToCart(item.raw as ServiceItem);
    } else if (item.type === 'PACKAGE') {
      handleAddPackageToCart(item.raw as PackageItem);
    } else if (item.type === 'PRODUCT') {
      handleAddProductToCart(item.raw as InventoryItem);
    }
  };

  const filteredServices = services;
  const filteredPackages = packages;
  const filteredProducts = products;

  const handleAddProductToCart = (product: InventoryItem) => {
    const available = productStockMap[product.id] ?? 0;
    const existing = cart.find((ci) => ci.type === 'PRODUCT' && ci.item.id === product.id);
    const existingQty = existing ? existing.quantity : 0;

    if (available <= 0) {
      toast.warning(`Product '${product.name}' is currently out of stock.`);
      return;
    }
    if (existingQty + 1 > available) {
      toast.warning(`Cannot add more '${product.name}'. Remaining stock in branch: ${available}`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (ci) => ci.type === 'PRODUCT' && ci.item.id === product.id
      );
      if (existingIndex >= 0) {
        return prev.map((ci, idx) =>
          idx === existingIndex ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }

      const cartInstanceId = `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const newItem: POSCartItem = {
        cartInstanceId,
        type: 'PRODUCT',
        item: product,
        quantity: 1,
        staffId: '',
        staffName: '',
        staffCommissionRate: 0,
      };
      return [...prev, newItem];
    });
  };

  // Add Service to Cart
  const handleAddServiceToCart = (service: ServiceItem) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (ci) => ci.type === 'SERVICE' && ci.item.id === service.id
      );
      if (existingIndex >= 0) {
        return prev.map((ci, idx) =>
          idx === existingIndex ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }

      const cartInstanceId = `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const newItem: POSCartItem = {
        cartInstanceId,
        type: 'SERVICE',
        item: service,
        quantity: 1,
        staffId: '',
        staffName: '',
        staffCommissionRate: 0,
      };
      return [...prev, newItem];
    });
  };

  // Add Package to Cart
  const handleAddPackageToCart = (pkg: PackageItem) => {
    const validity = getPackageValidity(pkg);
    if (!validity.isValid) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (ci) => ci.type === 'PACKAGE' && ci.item.id === pkg.id
      );
      if (existingIndex >= 0) {
        const target = prev[existingIndex];
        const newQty = target.quantity + 1;
        let updatedStaff = target.assignedStaff;
        if (target.assignedStaff && target.assignedStaff.length > 0) {
          const totalLine = getCatalogueSellingPrice(target.item) * newQty;
          const count = target.assignedStaff.length;
          const equalShare = Math.floor(totalLine / count);
          const rem = totalLine - equalShare * count;
          updatedStaff = target.assignedStaff.map((s, idx) => ({
            ...s,
            allocatedAmount: equalShare + (idx === 0 ? rem : 0),
          }));
        }
        return prev.map((ci, idx) =>
          idx === existingIndex ? { ...ci, quantity: newQty, assignedStaff: updatedStaff } : ci
        );
      }

      const cartInstanceId = `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const alloc = allocatePackageRevenue(pkg.price, pkg.components);

      const compAssignments: POSCartComponentAssignment[] = alloc.allocatedComponents.map((c) => ({
        serviceId: c.serviceId,
        serviceCode: c.serviceCode,
        serviceName: c.serviceName,
        quantity: c.quantity,
        allocationPercentage: c.allocationPercentage,
        allocatedAmount: c.allocatedAmount,
        staffId: '',
        staffName: '',
        staffCommissionRate: 0,
      }));

      const newItem: POSCartItem = {
        cartInstanceId,
        type: 'PACKAGE',
        item: pkg,
        quantity: 1,
        staffId: '',
        staffName: '',
        staffCommissionRate: 0,
        assignedStaff: [],
        packageComponents: compAssignments,
      };

      return [...prev, newItem];
    });
  };

  // Update Cart Item Quantity
  const handleUpdateQuantity = (cartInstanceId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.cartInstanceId === cartInstanceId) {
            const newQty = ci.quantity + delta;
            if (ci.type === 'PRODUCT' && delta > 0) {
              const available = productStockMap[ci.item.id] ?? 0;
              if (newQty > available) {
                toast.error(`Cannot exceed available branch stock of ${available} for '${ci.item.name}'.`);
                return ci;
              }
            }
            if (newQty <= 0) return null;

            if (ci.type === 'PACKAGE' && ci.assignedStaff && ci.assignedStaff.length > 0) {
              const newTotal = getCatalogueSellingPrice(ci.item) * newQty;
              const count = ci.assignedStaff.length;
              const oldTotal = getCatalogueSellingPrice(ci.item) * ci.quantity;

              let updatedStaff;
              if (oldTotal > 0) {
                let allocated = 0;
                updatedStaff = ci.assignedStaff.map((s, idx) => {
                  if (idx === count - 1) {
                    return { ...s, allocatedAmount: Math.max(0, newTotal - allocated) };
                  }
                  const ratio = (s.allocatedAmount ?? 0) / oldTotal;
                  const share = Math.round(newTotal * ratio);
                  allocated += share;
                  return { ...s, allocatedAmount: share };
                });
              } else {
                const equalShare = Math.floor(newTotal / count);
                const rem = newTotal - equalShare * count;
                updatedStaff = ci.assignedStaff.map((s, idx) => ({
                  ...s,
                  allocatedAmount: equalShare + (idx === 0 ? rem : 0),
                }));
              }
              return { ...ci, quantity: newQty, assignedStaff: updatedStaff };
            }

            return { ...ci, quantity: newQty };
          }
          return ci;
        })
        .filter(Boolean) as POSCartItem[]
    );
  };

  // Remove Cart Item
  const handleRemoveItem = (cartInstanceId: string) => {
    setCart((prev) => prev.filter((ci) => ci.cartInstanceId !== cartInstanceId));
  };

  // Assign staff to a service cart item
  const handleAssignStaff = (cartInstanceId: string, staffId: string) => {
    if (!staffId || staffId === 'unassigned') {
      setCart((prev) =>
        prev.map((ci) => {
          if (ci.cartInstanceId === cartInstanceId) {
            return {
              ...ci,
              staffId: '',
              staffName: '',
              staffCommissionRate: 0,
            };
          }
          return ci;
        })
      );
      return;
    }

    if (staffId === 'house') {
      setCart((prev) =>
        prev.map((ci) => {
          if (ci.cartInstanceId === cartInstanceId) {
            return {
              ...ci,
              staffId: 'house',
              staffName: 'House / Salon',
              staffCommissionRate: 0,
            };
          }
          return ci;
        })
      );
      return;
    }

    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    setCart((prev) =>
      prev.map((ci) => {
        if (ci.cartInstanceId === cartInstanceId) {
          return {
            ...ci,
            staffId: staff.id,
            staffName: staff.name,
            staffCommissionRate: staff.commissionRate,
          };
        }
        return ci;
      })
    );
  };

  // Fast bulk assign: Assign a staff member to ALL line items in cart at once
  const handleAssignStaffToAll = (staffId: string) => {
    if (!staffId || staffId === 'unassigned') return;
    const staff = staffId === 'house'
      ? { id: 'house', name: 'House / Salon', commissionRate: 0 }
      : staffList.find((s) => s.id === staffId);
    if (!staff) return;

    setCart((prev) =>
      prev.map((ci) => {
        const rate = typeof staff.commissionRate === 'number' && staff.commissionRate <= 1
          ? Math.round(staff.commissionRate * 100)
          : (staff.commissionRate || 0);

        if (ci.type === 'SERVICE' || ci.type === 'PRODUCT') {
          return {
            ...ci,
            staffId: staff.id,
            staffName: staff.name,
            staffCommissionRate: rate,
          };
        }
        if (ci.type === 'PACKAGE') {
          const totalLine = getCatalogueSellingPrice(ci.item) * ci.quantity;
          return {
            ...ci,
            staffId: staff.id,
            staffName: staff.name,
            staffCommissionRate: rate,
            assignedStaff: [
              {
                staffId: staff.id,
                staffName: staff.name,
                staffCommissionRate: rate,
                allocatedAmount: totalLine,
              },
            ],
          };
        }
        return ci;
      })
    );
    toast.success(`Assigned all items to ${staff.name}`);
  };

  // Add staff member to a package line item
  const handleAddStaffToPackage = (cartInstanceId: string, staffId: string) => {
    const staff = staffId === 'house'
      ? { id: 'house', name: 'House / Salon', commissionRate: 0 }
      : staffList.find((s) => s.id === staffId);
    if (!staff) return;

    setCart((prev) =>
      prev.map((ci) => {
        if (ci.cartInstanceId !== cartInstanceId) return ci;
        const currentStaff = ci.assignedStaff || [];
        if (currentStaff.some((s) => s.staffId === staffId)) return ci;

        const totalLineAmount = getCatalogueSellingPrice(ci.item) * ci.quantity;

        let updatedStaff;
        if (currentStaff.length === 0) {
          updatedStaff = [
            {
              staffId: staff.id,
              staffName: staff.name,
              staffCommissionRate: staff.commissionRate,
              allocatedAmount: totalLineAmount,
            },
          ];
        } else {
          const currentAllocated = currentStaff.reduce((sum, s) => sum + (s.allocatedAmount ?? 0), 0);
          const remainder = Math.max(0, totalLineAmount - currentAllocated);
          updatedStaff = [
            ...currentStaff,
            {
              staffId: staff.id,
              staffName: staff.name,
              staffCommissionRate: staff.commissionRate,
              allocatedAmount: remainder > 0 ? remainder : Math.floor(totalLineAmount / (currentStaff.length + 1)),
            },
          ];
        }

        return {
          ...ci,
          staffId: updatedStaff[0].staffId,
          staffName: updatedStaff.map((s) => s.staffName).join(', '),
          staffCommissionRate: updatedStaff[0].staffCommissionRate,
          assignedStaff: updatedStaff,
        };
      })
    );
  };

  // Update custom sales allocation amount for a staff member on a package
  const handleUpdateStaffPackageAmount = (
    cartInstanceId: string,
    staffId: string,
    amount: number
  ) => {
    setCart((prev) =>
      prev.map((ci) => {
        if (ci.cartInstanceId !== cartInstanceId) return ci;
        const currentStaff = ci.assignedStaff || [];
        if (currentStaff.length === 0) return ci;

        const totalLineAmount = getCatalogueSellingPrice(ci.item) * ci.quantity;
        const targetStaff = currentStaff.find((s) => s.staffId === staffId);
        if (!targetStaff) return ci;

        // Strictly clamp amount between 0 and totalLineAmount
        const clampedAmount = Math.max(0, Math.min(Math.round(amount), totalLineAmount));

        const updatedStaff = currentStaff.map((s) => {
          if (s.staffId === staffId) {
            return { ...s, allocatedAmount: clampedAmount };
          }
          return s;
        });

        return {
          ...ci,
          assignedStaff: updatedStaff,
        };
      })
    );
  };

  // Split package total evenly across all assigned staff
  const handleEqualizeStaffPackageAmounts = (cartInstanceId: string) => {
    setCart((prev) =>
      prev.map((ci) => {
        if (ci.cartInstanceId !== cartInstanceId) return ci;
        const currentStaff = ci.assignedStaff || [];
        if (currentStaff.length === 0) return ci;
        const totalLineAmount = getCatalogueSellingPrice(ci.item) * ci.quantity;
        const count = currentStaff.length;
        const equalShare = Math.floor(totalLineAmount / count);
        const remainder = totalLineAmount - equalShare * count;

        const updatedStaff = currentStaff.map((s, idx) => ({
          ...s,
          allocatedAmount: equalShare + (idx === 0 ? remainder : 0),
        }));

        return {
          ...ci,
          assignedStaff: updatedStaff,
        };
      })
    );
  };

  // Remove staff member from a package line item
  const handleRemoveStaffFromPackage = (cartInstanceId: string, staffId: string) => {
    setCart((prev) =>
      prev.map((ci) => {
        if (ci.cartInstanceId !== cartInstanceId) return ci;
        const currentStaff = ci.assignedStaff || [];
        const updatedStaffRaw = currentStaff.filter((s) => s.staffId !== staffId);

        if (updatedStaffRaw.length === 0) {
          return {
            ...ci,
            staffId: '',
            staffName: '',
            staffCommissionRate: 0,
            assignedStaff: [],
          };
        }

        const totalLineAmount = getCatalogueSellingPrice(ci.item) * ci.quantity;
        const count = updatedStaffRaw.length;
        const equalShare = Math.floor(totalLineAmount / count);
        const remainder = totalLineAmount - equalShare * count;

        const updatedStaff = updatedStaffRaw.map((s, idx) => ({
          ...s,
          allocatedAmount: equalShare + (idx === 0 ? remainder : 0),
        }));

        return {
          ...ci,
          staffId: updatedStaff[0].staffId,
          staffName: updatedStaff.map((s) => s.staffName).join(', '),
          staffCommissionRate: updatedStaff[0].staffCommissionRate,
          assignedStaff: updatedStaff,
        };
      })
    );
  };

  // Assign staff to a specific package component (legacy fallback)
  const handleAssignPackageComponentStaff = (
    cartInstanceId: string,
    serviceId: string,
    staffId: string
  ) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    setCart((prev) =>
      prev.map((ci) => {
        if (ci.cartInstanceId === cartInstanceId && ci.packageComponents) {
          const updatedComps = ci.packageComponents.map((comp) => {
            if (comp.serviceId === serviceId) {
              return {
                ...comp,
                staffId: staff.id,
                staffName: staff.name,
                staffCommissionRate: staff.commissionRate,
              };
            }
            return comp;
          });
          return { ...ci, packageComponents: updatedComps };
        }
        return ci;
      })
    );
  };

  // Clear Cart
  const handleClearCart = () => {
    setCart([]);
    setDiscountValue(0);
    setTipAmount(0);
    setInvoiceNotes('');
    setLoadedAppointment(null);
    setAcknowledgedPriceDiscrepancy(false);
    setApplyBranchTax(true);
  };

  // Open Appointment in POS
  const handleOpenAppointmentInPOS = (appt: Appointment, forceReplace = false) => {
    if (cart.length > 0 && !forceReplace) {
      setPendingAppointmentToLoad(appt);
      setIsCartOverwritePromptOpen(true);
      return;
    }

    setLoadedAppointment(appt);
    setAcknowledgedPriceDiscrepancy(false);
    setIsWalkIn(false);
    setClientName(appt.clientName);
    setClientPhone(appt.clientPhone);
    setCustomerSource((appt.customerSource as CustomerSource) || 'WALK_IN');
    setCustomerSourceDetails(appt.customerSourceDetails || '');
    if (appt.clientId) {
      setSelectedClientId(appt.clientId);
    }

    // Map items
    const newCartItems: POSCartItem[] = [];

    if (appt.items && appt.items.length > 0) {
      for (const itm of appt.items) {
        if (itm.type === 'PACKAGE') {
          const matchedPkg = packages.find((p) => p.id === itm.itemId) || {
            id: itm.itemId,
            branchId: appt.branchId,
            code: itm.code,
            name: itm.name,
            price: itm.unitPrice,
            components: (itm.packageComponents || []).map((c) => ({
              serviceId: c.serviceId,
              serviceCode: c.serviceCode,
              serviceName: c.serviceName,
              quantity: 1,
              allocationPercentage: c.allocationPercentage,
              unitPrice: 0,
            })),
            taxTreatment: 'BRANCH_DEFAULT' as const,
            isActive: true,
          };

          const alloc = allocatePackageRevenue(matchedPkg.price, matchedPkg.components);
          const compAssignments: POSCartComponentAssignment[] = alloc.allocatedComponents.map((c) => {
            const bookedComp = itm.packageComponents?.find((bc) => bc.serviceId === c.serviceId);
            const staffId = bookedComp?.staffId || itm.staffId || '';
            const staffMember = staffId ? staffList.find((s) => s.id === staffId) : undefined;
            const staffName = bookedComp?.staffName || itm.staffName || staffMember?.name || '';

            return {
              serviceId: c.serviceId,
              serviceCode: c.serviceCode,
              serviceName: c.serviceName,
              quantity: c.quantity,
              allocationPercentage: c.allocationPercentage,
              allocatedAmount: c.allocatedAmount,
              staffId,
              staffName,
              staffCommissionRate: staffMember?.commissionRate ?? 0,
            };
          });

          const primaryStaffId = compAssignments.find((c) => c.staffId)?.staffId || itm.staffId || '';
          const primaryStaffMember = primaryStaffId ? staffList.find((s) => s.id === primaryStaffId) : undefined;
          const primaryStaffName = compAssignments.find((c) => c.staffName)?.staffName || itm.staffName || primaryStaffMember?.name || '';

          const packageAssignedStaff = itm.assignedStaff && itm.assignedStaff.length > 0
            ? itm.assignedStaff.map((as) => {
                const member = staffList.find((s) => s.id === as.staffId);
                return {
                  staffId: as.staffId,
                  staffName: as.staffName || member?.name || 'Stylist',
                  staffCommissionRate: as.staffCommissionRate ?? member?.commissionRate ?? 0,
                };
              })
            : (primaryStaffId
                ? [
                    {
                      staffId: primaryStaffId,
                      staffName: primaryStaffName,
                      staffCommissionRate: primaryStaffMember?.commissionRate ?? 0,
                    },
                  ]
                : []);

          newCartItems.push({
            cartInstanceId: itm.lineInstanceId || `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'PACKAGE',
            item: matchedPkg,
            quantity: 1,
            staffId: primaryStaffId,
            staffName: packageAssignedStaff.map((s) => s.staffName).join(', ') || primaryStaffName,
            staffCommissionRate: primaryStaffMember?.commissionRate ?? 0.1,
            assignedStaff: packageAssignedStaff,
            packageComponents: compAssignments,
          });
        } else {
          const matchedService = services.find((s) => s.id === itm.itemId) || {
            id: itm.itemId,
            branchId: appt.branchId,
            code: itm.code,
            name: itm.name,
            category: 'General',
            durationMinutes: itm.durationMinutes,
            price: itm.unitPrice,
            taxTreatment: 'BRANCH_DEFAULT' as const,
            isActive: true,
          };

          const staffId = itm.staffId || '';
          const staffMember = staffId ? staffList.find((s) => s.id === staffId) : undefined;
          const staffName = itm.staffName || staffMember?.name || '';

          newCartItems.push({
            cartInstanceId: itm.lineInstanceId || `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'SERVICE',
            item: matchedService,
            quantity: 1,
            staffId,
            staffName,
            staffCommissionRate: staffMember?.commissionRate ?? 0,
          });
        }
      }
    }

    setCart(newCartItems);
    setIsQueueOpen(false);
  };

  // Financial Calculations
  const calculations = useMemo(() => {
    const grossSubtotal = roundCurrency(
      cart.reduce((sum, ci) => sum + getCatalogueSellingPrice(ci.item) * ci.quantity, 0)
    );

    let calculatedDiscount = 0;
    if (discountType === 'PERCENTAGE') {
      const pct = Math.max(0, Math.min(100, discountValue || 0));
      calculatedDiscount = roundCurrency(grossSubtotal * (pct / 100));
    } else {
      calculatedDiscount = roundCurrency(Math.max(0, Math.min(grossSubtotal, discountValue || 0)));
    }

    // Branch sales tax (configured in Branch Settings)
    const branchTaxRate = (applyBranchTax && currentBranch?.taxEnabled) ? (currentBranch.taxRate || 0) : 0;
    let totalTax = 0;

    const lineCalculations = cart.map((ci) => {
      const itemPrice = getCatalogueSellingPrice(ci.item);
      const gross = roundCurrency(itemPrice * ci.quantity);
      const lineDisc = grossSubtotal > 0 ? roundCurrency((gross / grossSubtotal) * calculatedDiscount) : 0;
      const lineNet = roundCurrency(gross - lineDisc);

      const effectiveTaxRate = branchTaxRate;
      const lineTax = roundCurrency(lineNet * effectiveTaxRate);
      totalTax = roundCurrency(totalTax + lineTax);

      return {
        ...ci,
        gross,
        lineDisc,
        lineNet,
        effectiveTaxRate,
        lineTax,
        lineTotal: roundCurrency(lineNet + lineTax),
      };
    });

    const netSales = roundCurrency(grossSubtotal - calculatedDiscount);
    const billTotal = roundCurrency(netSales + totalTax); // Bill excluding tips
    const cleanTip = Math.max(0, roundCurrency(tipAmount || 0));
    const fullInvoiceTotal = roundCurrency(billTotal + cleanTip);

    return {
      grossSubtotal,
      calculatedDiscount,
      netSales,
      totalTax,
      billTotal,
      cleanTip,
      fullInvoiceTotal,
      lineCalculations,
    };
  }, [cart, discountType, discountValue, tipAmount, currentBranch, applyBranchTax]);

  // Check if booking quote differs from canonical cart subtotal
  const bookingPriceDiscrepancy = useMemo(() => {
    if (!loadedAppointment) return null;
    const bookingQuoted = loadedAppointment.price || 0;
    const canonicalSubtotal = calculations.grossSubtotal;
    const diff = canonicalSubtotal - bookingQuoted;
    if (Math.abs(diff) > 0.5) {
      return {
        quoted: bookingQuoted,
        canonical: canonicalSubtotal,
        difference: diff,
      };
    }
    return null;
  }, [loadedAppointment, calculations.grossSubtotal]);

  // Open Checkout Modal
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;

    // Check if any service in cart is unassigned and warn cashier
    const unassignedService = cart.find(
      (ci) => ci.type === 'SERVICE' && (!ci.staffId || ci.staffId === 'unassigned')
    );
    if (unassignedService) {
      toast.warning(`Please select an assigned staff member for '${unassignedService.item.name}' before checkout.`);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileCartOpen(true);
      }
      return;
    }

    setMobileCartOpen(false);
    
    // Auto-assign House / Salon to any package that doesn't have assigned staff
    setCart((prev) =>
      prev.map((ci) => {
        if (ci.type === 'PACKAGE' && (!ci.assignedStaff || ci.assignedStaff.length === 0)) {
          const totalLineAmount = getCatalogueSellingPrice(ci.item) * ci.quantity;
          return {
            ...ci,
            staffId: 'house',
            staffName: 'House / Salon',
            staffCommissionRate: 0,
            assignedStaff: [
              {
                staffId: 'house',
                staffName: 'House / Salon',
                staffCommissionRate: 0,
                allocatedAmount: totalLineAmount,
              },
            ],
          };
        }
        return ci;
      })
    );

    if (bookingPriceDiscrepancy && !acknowledgedPriceDiscrepancy) {
      toast.warning(
        `Price Quote Notice: The quoted booking price was ${formatCurrency(
          bookingPriceDiscrepancy.quoted
        )}, but active catalogue subtotal is ${formatCurrency(
          bookingPriceDiscrepancy.canonical
        )}. Please acknowledge the price difference in the cart banner before checking out.`
      );
      return;
    }
    setPostingError(null);
    setIdempotencyKey(`pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);

    // Pre-populate exact amounts (bill + tip)
    const billAndTip = calculations.fullInvoiceTotal;
    setCashTenderedInput(billAndTip);
    setOnlineAmountInput(billAndTip);
    setSplitCashAmount(billAndTip);
    setSplitCashTendered(billAndTip);
    setSplitOnlinePayments([]);

    setIsCheckoutOpen(true);
  };

  // Smart Split Payment helpers (Auto-balances cash share with digital splits)
  const handleAddSplitOnlineRow = () => {
    if (paymentAccounts.length === 0) {
      toast.warning('No active branch payment accounts available.');
      return;
    }
    const currentOnlineTotal = splitOnlinePayments.reduce((s, p) => s + (p.amount || 0), 0);
    const remainingForThisRow = Math.max(0, roundCurrency(calculations.fullInvoiceTotal - currentOnlineTotal));
    const updated = [
      ...splitOnlinePayments,
      { paymentAccountId: paymentAccounts[0]?.id || '', amount: remainingForThisRow },
    ];
    setSplitOnlinePayments(updated);
    const newOnlineTotal = updated.reduce((s, p) => s + (p.amount || 0), 0);
    const newCashShare = Math.max(0, roundCurrency(calculations.fullInvoiceTotal - newOnlineTotal));
    setSplitCashAmount(newCashShare);
    setSplitCashTendered(newCashShare);
  };

  const handleUpdateSplitOnlineRow = (idx: number, field: 'paymentAccountId' | 'amount', val: any) => {
    const updated = [...splitOnlinePayments];
    if (field === 'paymentAccountId') {
      updated[idx].paymentAccountId = val;
    } else {
      updated[idx].amount = Math.max(0, parseFloat(val) || 0);
    }
    setSplitOnlinePayments(updated);

    if (field === 'amount') {
      const newOnlineTotal = updated.reduce((s, p) => s + (p.amount || 0), 0);
      const newCashShare = Math.max(0, roundCurrency(calculations.fullInvoiceTotal - newOnlineTotal));
      setSplitCashAmount(newCashShare);
      setSplitCashTendered(newCashShare);
    }
  };

  const handleRemoveSplitOnlineRow = (idx: number) => {
    const updated = splitOnlinePayments.filter((_, i) => i !== idx);
    setSplitOnlinePayments(updated);
    const newOnlineTotal = updated.reduce((s, p) => s + (p.amount || 0), 0);
    const newCashShare = Math.max(0, roundCurrency(calculations.fullInvoiceTotal - newOnlineTotal));
    setSplitCashAmount(newCashShare);
    setSplitCashTendered(newCashShare);
  };

  const handleAutoBalanceSplit = () => {
    const onlineTotal = splitOnlinePayments.reduce((s, p) => s + (p.amount || 0), 0);
    const balancedCash = Math.max(0, roundCurrency(calculations.fullInvoiceTotal - onlineTotal));
    setSplitCashAmount(balancedCash);
    setSplitCashTendered(balancedCash);
    toast.info(`Cash share balanced to PKR ${balancedCash}`);
  };

  // Submit and Post POS Invoice
  const handlePostInvoice = async () => {
    if (!currentBranch || cart.length === 0) return;
    setIsPosting(true);
    setPostingError(null);

    try {
      const payments: POSPaymentEntry[] = [];
      const billTotal = calculations.billTotal;
      const tipAmount = calculations.cleanTip;

      if (checkoutMode === 'CASH') {
        const cashTendered = roundCurrency(cashTenderedInput || 0);
        const retained = Math.min(cashTendered, calculations.fullInvoiceTotal);
        const change = Math.max(0, roundCurrency(cashTendered - retained));

        // Allocate retained to bill first, then tip
        const billAlloc = Math.min(retained, billTotal);
        const tipAlloc = Math.min(Math.max(0, roundCurrency(retained - billAlloc)), tipAmount);

        if (retained > 0) {
          payments.push({
            method: 'CASH',
            amount: retained,
            billAllocation: billAlloc,
            tipAllocation: tipAlloc,
            cashTendered,
            changeReturned: change,
          });
        }
      } else if (checkoutMode === 'ONLINE') {
        const selectedAcc = paymentAccounts.find((a) => a.id === selectedOnlineAccountId);
        if (!selectedAcc && (onlineAmountInput || 0) > 0) {
          throw new Error('Please select an active online payment account.');
        }

        const onlineAmount = roundCurrency(onlineAmountInput || 0);
        if (onlineAmount > calculations.fullInvoiceTotal) {
          throw new Error(`Online payment cannot exceed total due (${calculations.fullInvoiceTotal} PKR).`);
        }

        const billAlloc = Math.min(onlineAmount, billTotal);
        const tipAlloc = Math.min(Math.max(0, roundCurrency(onlineAmount - billAlloc)), tipAmount);

        if (onlineAmount > 0 && selectedAcc) {
          payments.push({
            method: 'ONLINE_ACCOUNT',
            paymentAccountId: selectedAcc.id,
            paymentAccountName: `${selectedAcc.name} (${selectedAcc.accountIdentifier || selectedAcc.providerName})`,
            amount: onlineAmount,
            billAllocation: billAlloc,
            tipAllocation: tipAlloc,
          });
        }
      } else if (checkoutMode === 'SPLIT') {
        // Cash component
        const cAmount = roundCurrency(splitCashAmount || 0);
        const cTendered = roundCurrency(splitCashTendered !== undefined && splitCashTendered !== null ? splitCashTendered : cAmount);
        const actualCashRetained = Math.min(cAmount, cTendered);
        const cChange = Math.max(0, roundCurrency(cTendered - cAmount));

        if (actualCashRetained > 0) {
          const bAlloc = Math.min(actualCashRetained, billTotal);
          const tAlloc = Math.min(Math.max(0, roundCurrency(actualCashRetained - bAlloc)), tipAmount);
          payments.push({
            method: 'CASH',
            amount: actualCashRetained,
            billAllocation: bAlloc,
            tipAllocation: tAlloc,
            cashTendered: cTendered,
            changeReturned: cChange,
          });
        }

        // Online components
        let accumulatedBill = payments.reduce((sum, p) => sum + p.billAllocation, 0);
        let accumulatedTip = payments.reduce((sum, p) => sum + p.tipAllocation, 0);

        for (const op of splitOnlinePayments) {
          const acc = paymentAccounts.find((a) => a.id === op.paymentAccountId);
          const opAmount = roundCurrency(op.amount || 0);
          if (opAmount > 0 && acc) {
            const remainingBill = Math.max(0, roundCurrency(billTotal - accumulatedBill));
            const bAlloc = Math.min(opAmount, remainingBill);
            const remainingTip = Math.max(0, roundCurrency(tipAmount - accumulatedTip));
            const tAlloc = Math.min(Math.max(0, roundCurrency(opAmount - bAlloc)), remainingTip);

            accumulatedBill += bAlloc;
            accumulatedTip += tAlloc;

            payments.push({
              method: 'ONLINE_ACCOUNT',
              paymentAccountId: acc.id,
              paymentAccountName: `${acc.name} (${acc.accountIdentifier || acc.providerName})`,
              amount: opAmount,
              billAllocation: bAlloc,
              tipAllocation: tAlloc,
            });
          }
        }
      }

      // Check if partial or unpaid: customer name & phone are required
      const retainedTotal = roundCurrency(payments.reduce((sum, p) => sum + p.amount, 0));
      const isDueRemaining = (calculations.fullInvoiceTotal - retainedTotal) > 0.01;

      if (isDueRemaining) {
        const cleanName = (clientName || '').trim();
        const cleanPhone = (clientPhone || '').replace(/\D/g, '');
        if (!cleanName || cleanName.toLowerCase() === 'walk-in customer' || cleanName.toLowerCase() === 'walk-in' || isWalkIn) {
          throw new Error('A specific customer name is required for Partial or Unpaid invoices so dues are tracked in their Client Ledger.');
        }
        if (!cleanPhone || cleanPhone.length < 10) {
          throw new Error('A valid customer contact phone number (at least 10 digits) is required for Partial or Unpaid invoices.');
        }
      }

      // Sanitize cart items so lines without assigned staff fallback cleanly to 'house' (No Staff / Salon)
      const sanitizedCart = cart.map((ci) => {
        const lineTotal = getCatalogueSellingPrice(ci.item) * ci.quantity;
        const validAssigned = (ci.assignedStaff || []).filter(
          (as) => as.staffId && as.staffId !== 'unassigned'
        );

        let finalAssignedStaff = validAssigned;
        if (finalAssignedStaff.length === 0) {
          if (ci.staffId && ci.staffId !== 'house' && ci.staffId !== 'unassigned') {
            finalAssignedStaff = [
              {
                staffId: ci.staffId,
                staffName: ci.staffName || 'Stylist',
                staffCommissionRate: ci.staffCommissionRate || 0,
                allocatedAmount: lineTotal,
              },
            ];
          } else {
            finalAssignedStaff = [
              {
                staffId: 'house',
                staffName: 'House / Salon',
                staffCommissionRate: 0,
                allocatedAmount: lineTotal,
              },
            ];
          }
        } else {
          finalAssignedStaff = finalAssignedStaff.map((as) => ({
            ...as,
            allocatedAmount: typeof as.allocatedAmount === 'number' ? as.allocatedAmount : Math.floor(lineTotal / finalAssignedStaff.length),
          }));
        }

        const primary = finalAssignedStaff[0];
        return {
          ...ci,
          staffId: primary.staffId,
          staffName: finalAssignedStaff.map((s) => s.staffName).join(', '),
          staffCommissionRate: primary.staffCommissionRate || 0,
          assignedStaff: finalAssignedStaff,
        };
      });

      // Input payload
      const payload: CreatePOSInvoiceInput = {
        branchId: currentBranch.id,
        appointmentId: loadedAppointment?.id,
        clientId: selectedClientId,
        clientName: clientName?.trim() || selectedClient?.name || 'Walk-in Customer',
        clientPhone: clientPhone?.trim() || selectedClient?.phone || 'N/A',
        customerSource,
        customerSourceDetails: customerSourceDetails?.trim(),
        discountType,
        discountValue,
        tip: tipAmount,
        applyTax: applyBranchTax,
        cartItems: sanitizedCart,
        payments,
        idempotencyKey: idempotencyKey || `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        notes: invoiceNotes,
      };

      const result = await salonService.postPOSInvoice(payload, user);

      toast.success(`Invoice #${result.invoiceNumber} posted and completed successfully!`);
      setPostedInvoice(result);
      setIsCheckoutOpen(false);
      handleClearCart();
      setIsReceiptOpen(true);
      if (selectedBranchId) {
        loadBranchData(selectedBranchId);
        refreshQueueCount(selectedBranchId);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to post POS invoice. Please retry.';
      setPostingError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsPosting(false);
    }
  };

  const handlePayFull = () => {
    const total = calculations.fullInvoiceTotal;
    if (checkoutMode === 'CASH') {
      setCashTenderedInput(total);
    } else if (checkoutMode === 'ONLINE') {
      setOnlineAmountInput(total);
      if (!selectedOnlineAccountId && paymentAccounts.length > 0) {
        setSelectedOnlineAccountId(paymentAccounts[0].id);
      }
    } else if (checkoutMode === 'SPLIT') {
      setSplitCashAmount(total);
      setSplitCashTendered(total);
      setSplitOnlinePayments([]);
    }
  };

  const handleDirectSaleComplete = async () => {
    if (cart.length === 0) return;

    const unassignedService = cart.find(
      (ci) => ci.type === 'SERVICE' && (!ci.staffId || ci.staffId === 'unassigned')
    );
    if (unassignedService) {
      toast.warning(`Please select an assigned staff member for '${unassignedService.item.name}' before completing sale.`);
      return;
    }

    if (bookingPriceDiscrepancy && !acknowledgedPriceDiscrepancy) {
      toast.warning(
        `Price Quote Notice: Please acknowledge the price difference before checking out.`
      );
      return;
    }

    // Default tender if not entered
    if (checkoutMode === 'CASH' && (!cashTenderedInput || cashTenderedInput <= 0)) {
      setCashTenderedInput(calculations.fullInvoiceTotal);
    }
    if (checkoutMode === 'ONLINE' && (!onlineAmountInput || onlineAmountInput <= 0)) {
      setOnlineAmountInput(calculations.fullInvoiceTotal);
      if (!selectedOnlineAccountId && paymentAccounts.length > 0) {
        setSelectedOnlineAccountId(paymentAccounts[0].id);
      }
    }

    if (checkoutMode === 'SPLIT') {
      const totalSplit = (splitCashAmount || 0) + splitOnlinePayments.reduce((s, p) => s + (p.amount || 0), 0);
      if (totalSplit <= 0 && splitOnlinePayments.length === 0) {
        handleOpenCheckout();
        return;
      }
    }

    await handlePostInvoice();
  };

  const handleAddQuickCustomItem = () => {
    const name = window.prompt('Enter custom service / item name:');
    if (!name || !name.trim()) return;
    const priceStr = window.prompt('Enter price in PKR:', '1000');
    if (priceStr === null) return;
    const price = Number(priceStr);
    if (isNaN(price) || price < 0) {
      toast.error('Invalid price entered');
      return;
    }

    const customService: ServiceItem = {
      id: `custom-${Date.now()}`,
      branchId: activeBranchId,
      name: name.trim(),
      code: 'CUST-01',
      category: 'Custom Service',
      taxTreatment: 'BRANCH_DEFAULT',
      price: price,
      durationMinutes: 30,
      isActive: true,
    };
    handleAddServiceToCart(customService);
    toast.success(`Custom service '${name}' added to sale.`);
  };

  const currentCartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const renderCartPanel = (isMobileSheet = false) => (
    <div className="w-full h-full min-h-0 flex flex-col justify-between overflow-hidden">
      {/* Top Zone: Header + Cart Items */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Sale Card Header */}
        <div className="shrink-0 flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2254E1] to-blue-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">Current Sale</h3>
                <Badge variant="neutral" className="text-[10px] font-bold bg-blue-50 text-[#2254E1] border-blue-200 py-0.5 px-2">
                  {currentCartCount} item{currentCartCount !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {cart.length > 0 && staffList.length > 0 && (
              <Select onValueChange={(val) => handleAssignStaffToAll(val)}>
                <SelectTrigger className="text-[11px] h-7 px-2 bg-blue-50/70 border-blue-200 text-[#2254E1] font-semibold rounded-lg shadow-2xs">
                  <SelectValue placeholder="Assign all..." />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="house" className="text-xs font-semibold text-slate-700">
                    House / Salon (No Staff)
                  </SelectItem>
                  {staffList.map((st) => (
                    <SelectItem key={st.id} value={st.id} className="text-xs">
                      {st.name} ({st.roleTitle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCart}
                className="text-xs h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-lg cursor-pointer transition-colors"
                title="Clear Sale Card"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}

            {isMobileSheet && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileCartOpen(false)}
                className="h-7 w-7 text-slate-400 hover:text-slate-700 rounded-lg p-0 cursor-pointer"
                title="Close Cart"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Linked Appointment Badge */}
        {loadedAppointment && (
          <div className="shrink-0 p-2 my-2 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold">Linked:</span> {loadedAppointment.appointmentNumber || loadedAppointment.id}
                <span className="text-blue-700 block text-[10px]">{loadedAppointment.clientName} • {loadedAppointment.startTime || loadedAppointment.time || '10:00 AM'}</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoadedAppointment(null);
                setAcknowledgedPriceDiscrepancy(false);
              }}
              className="h-5 w-5 p-0 text-blue-500 hover:text-blue-800"
              title="Unlink Appointment"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Price Quote Discrepancy Banner */}
        {bookingPriceDiscrepancy && (
          <div className="shrink-0 p-2 my-2 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
            <div className="flex items-start gap-1.5 text-amber-900">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[11px]">Price Quote Discrepancy</span>
                <p className="text-[10px] text-amber-800">
                  Booking: {formatCurrency(bookingPriceDiscrepancy.quoted)}, active: {formatCurrency(bookingPriceDiscrepancy.canonical)}.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-900 cursor-pointer pt-0.5 border-t border-amber-200/60">
              <input
                type="checkbox"
                checked={acknowledgedPriceDiscrepancy}
                onChange={(e) => setAcknowledgedPriceDiscrepancy(e.target.checked)}
                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-3 w-3"
              />
              <span>Confirm adjustment</span>
            </label>
          </div>
        )}

        {/* Cart Items List OR Clean Empty State with Dedicated Scroller */}
        {cart.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200/90 text-xs my-2 py-6 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#2254E1] mb-2 border border-blue-100">
              <ShoppingCart className="w-5 h-5 opacity-75" />
            </div>
            <span className="font-bold text-slate-700 text-xs sm:text-sm">Sale Card is empty</span>
            <span className="text-[11px] text-slate-400 mt-0.5 max-w-[220px]">Click any service, product, or package on the catalogue to add</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2 pr-1 pos-cart-scroller">
            {cart.map((ci) => (
              <div
                key={ci.cartInstanceId}
                className="p-2.5 sm:p-3 rounded-xl border transition-all space-y-2 bg-slate-50/80 hover:bg-slate-50/95 border-slate-200/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 truncate text-xs sm:text-[13px]">{ci.item.name}</span>
                      {ci.type === 'PACKAGE' ? (
                        <Badge variant="neutral" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200 py-0 px-1.5 font-bold">
                          Pkg
                        </Badge>
                      ) : ci.type === 'PRODUCT' ? (
                        <Badge variant="neutral" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 py-0 px-1.5 font-bold">
                          Prd
                        </Badge>
                      ) : null}
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 font-medium">
                      {formatCurrency(getCatalogueSellingPrice(ci.item))}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Quantity Adjuster */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdateQuantity(ci.cartInstanceId, -1)}
                        className="w-5.5 h-5.5 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-mono font-bold px-1.5 text-xs text-slate-900 min-w-5 text-center">
                        {ci.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdateQuantity(ci.cartInstanceId, 1)}
                        className="w-5.5 h-5.5 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    <span className="font-mono font-bold text-slate-900 w-20 text-right text-xs sm:text-[13px]">
                      {formatCurrency(getCatalogueSellingPrice(ci.item) * ci.quantity)}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(ci.cartInstanceId)}
                      className="w-6 h-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md p-0 transition-colors"
                      title="Remove item"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Staff Assignment */}
                {ci.type === 'PRODUCT' ? (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5 shrink-0">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sales Staff:</span>
                    </span>
                    <Select
                      value={ci.staffId || 'unassigned'}
                      onValueChange={(val) => handleAssignStaff(ci.cartInstanceId, val)}
                    >
                      <SelectTrigger
                        className="flex-1 sm:w-[170px] text-xs h-7.5 bg-white border-slate-200 text-slate-700 rounded-lg shadow-2xs font-normal"
                      >
                        <SelectValue placeholder="Select Staff..." />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="unassigned" className="text-xs text-slate-400 italic">
                          Select Staff...
                        </SelectItem>
                        <SelectItem value="house" className="text-xs font-semibold text-slate-700">
                          House / Salon (No Staff)
                        </SelectItem>
                        {staffList.map((st) => (
                          <SelectItem key={st.id} value={st.id} className="text-xs">
                            {st.name} ({st.roleTitle})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  /* Package & Service Multi-Staff Allocation */
                  <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#2254E1]" />
                        <span>Staff ({ci.assignedStaff?.length || 0}):</span>
                      </span>

                      <div className="flex items-center gap-1">
                        {ci.assignedStaff && ci.assignedStaff.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEqualizeStaffPackageAmounts(ci.cartInstanceId)}
                            className="text-[10px] font-semibold text-[#2254E1] hover:underline cursor-pointer"
                          >
                            Split Evenly
                          </button>
                        )}
                      </div>
                    </div>

                    {ci.assignedStaff && ci.assignedStaff.length > 0 && (
                      <div className="space-y-1 bg-white p-1.5 rounded-lg border border-slate-200">
                        {ci.assignedStaff.map((st) => {
                          const lineTotalAmount = getCatalogueSellingPrice(ci.item) * ci.quantity;
                          const currentAmount = st.allocatedAmount ?? (ci.assignedStaff?.length === 1 ? lineTotalAmount : Math.round(lineTotalAmount / (ci.assignedStaff?.length || 1)));

                          return (
                            <div
                              key={st.staffId}
                              className="flex items-center justify-between gap-1.5 text-xs py-0.5"
                            >
                              <span className="font-semibold text-slate-800 truncate text-[11px]">{st.staffName}</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={lineTotalAmount}
                                  value={st.allocatedAmount ?? currentAmount}
                                  onChange={(e) =>
                                    handleUpdateStaffPackageAmount(
                                      ci.cartInstanceId,
                                      st.staffId,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  className="w-16 h-6 px-1.5 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-md"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaffFromPackage(ci.cartInstanceId, st.staffId)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {staffList.filter((s) => !ci.assignedStaff?.some((as) => as.staffId === s.id)).length > 0 && (
                      <div className="pt-0.5">
                        <Select
                          value=""
                          onValueChange={(val) => {
                            if (val) handleAddStaffToPackage(ci.cartInstanceId, val);
                          }}
                        >
                          <SelectTrigger className="text-xs h-6 bg-blue-50/60 border-blue-200 text-[#2254E1] px-2 font-medium rounded-md">
                            <div className="flex items-center gap-1 min-w-0">
                              <Plus className="w-3.5 h-3.5 text-[#2254E1] shrink-0" />
                              <SelectValue placeholder="Add Staff" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            {!ci.assignedStaff?.some((as) => as.staffId === 'house') && (
                              <SelectItem value="house" className="text-xs font-semibold text-slate-700">
                                House / Salon (No Staff)
                              </SelectItem>
                            )}
                            {staffList
                              .filter((s) => !ci.assignedStaff?.some((as) => as.staffId === s.id))
                              .map((st) => (
                                <SelectItem key={st.id} value={st.id} className="text-xs">
                                  {st.name} ({st.roleTitle})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Zone: Customer Attribution + Discount & Tip + Breakdown + Action */}
      {cart.length > 0 && (
        <div className="shrink-0 pt-2 border-t border-slate-200/90 space-y-2 bg-white">
          {/* Customer Attribution (Walk-in or Custom Name/Phone) */}
          {!selectedClient ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Customer Name (Walk-in)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="pl-8 text-xs h-8 bg-white border-slate-200 rounded-xl font-medium placeholder:text-slate-400 focus:border-[#2254E1]"
                />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  type="tel"
                  placeholder="Phone (Optional)"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="pl-8 text-xs h-8 bg-white border-slate-200 rounded-xl font-mono placeholder:text-slate-400 focus:border-[#2254E1]"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
              <div className="flex items-center gap-2 truncate">
                <UserCheck className="w-3.5 h-3.5 text-[#2254E1] shrink-0" />
                <span className="font-bold text-slate-800 truncate">{selectedClient.name}</span>
                <span className="text-[11px] text-slate-500 font-mono">{selectedClient.phone}</span>
              </div>
              <button
                type="button"
                onClick={handleSetWalkIn}
                className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* 1. Discount & Tip (Spaced Side-by-Side) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Discount Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#2254E1]" />
                  <span>Discount</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDiscountType(discountType === 'FIXED' ? 'PERCENTAGE' : 'FIXED')}
                  className="text-[10px] font-bold text-[#2254E1] hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                >
                  {discountType === 'FIXED' ? '% Switch' : 'PKR Switch'}
                </button>
              </div>
              <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs h-8 focus-within:border-[#2254E1] focus-within:ring-2 focus-within:ring-[#2254E1]/10 transition-all">
                <span className="px-2.5 text-[10px] font-bold bg-slate-50 text-slate-600 border-r border-slate-200 h-full flex items-center shrink-0">
                  {discountType === 'FIXED' ? 'PKR' : '%'}
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-full h-full text-right px-2.5 text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                />
              </div>
            </div>

            {/* Tip Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-600" />
                  <span>Staff Tip</span>
                </label>
                {tipAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setTipAmount(0)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs h-8 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all">
                <span className="px-2.5 text-[10px] font-bold bg-amber-50/70 text-amber-700 border-r border-slate-200 h-full flex items-center shrink-0">
                  PKR
                </span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={tipAmount || ''}
                  onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
                  className="w-full h-full text-right px-2.5 text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Itemized Breakdown */}
          <div className="space-y-1.5 py-1.5 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs sm:text-[13px] font-medium">Subtotal:</span>
              <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800">
                {formatCurrency(calculations.grossSubtotal)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs sm:text-[13px] font-medium">Discount:</span>
              <span className={`font-mono text-xs sm:text-sm font-semibold ${calculations.calculatedDiscount > 0 ? 'text-emerald-600 font-bold' : 'text-slate-800'}`}>
                {calculations.calculatedDiscount > 0 ? `- ${formatCurrency(calculations.calculatedDiscount)}` : formatCurrency(0)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs sm:text-[13px] font-medium">Staff Tip:</span>
              <span className={`font-mono text-xs sm:text-sm font-semibold ${calculations.cleanTip > 0 ? 'text-amber-700 font-bold' : 'text-slate-800'}`}>
                {calculations.cleanTip > 0 ? `+ ${formatCurrency(calculations.cleanTip)}` : formatCurrency(0)}
              </span>
            </div>

            {/* Integrated Interactive Tax Row */}
            <div className="flex items-center justify-between text-slate-600">
              <label htmlFor="pos-tax-toggle" className="flex items-center gap-1.5 cursor-pointer select-none hover:text-[#2254E1]">
                <input
                  id="pos-tax-toggle"
                  type="checkbox"
                  checked={applyBranchTax}
                  onChange={(e) => setApplyBranchTax(e.target.checked)}
                  className="rounded border-slate-300 text-[#2254E1] focus:ring-[#2254E1] h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-xs sm:text-[13px] font-medium">
                  Tax ({applyBranchTax && currentBranch?.taxRate ? `${currentBranch.taxRate}%` : '0%'}):
                </span>
              </label>
              <span className={`font-mono text-xs sm:text-sm font-semibold ${applyBranchTax && calculations.totalTax > 0 ? 'text-[#2254E1] font-bold' : 'text-slate-800'}`}>
                {applyBranchTax && calculations.totalTax > 0 ? `+${formatCurrency(calculations.totalTax)}` : formatCurrency(0)}
              </span>
            </div>
          </div>

          {/* Net Payable Highlight Box */}
          <div className="px-3.5 py-2 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/90 border border-blue-200/90 rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] font-extrabold text-blue-950 uppercase tracking-wider block">Net Payable</span>
              <span className="text-[10px] text-blue-600 font-medium">Total amount due</span>
            </div>
            <div className="text-right">
              <span className="font-mono font-extrabold text-xl text-[#2254E1] tracking-tight">
                {formatCurrency(calculations.fullInvoiceTotal)}
              </span>
            </div>
          </div>

          {/* Collect Payment & Complete Sale Button */}
          <Button
            onClick={() => {
              if (isMobileSheet) {
                const unassignedService = cart.find(
                  (ci) => ci.type === 'SERVICE' && (!ci.staffId || ci.staffId === 'unassigned')
                );
                if (unassignedService) {
                  toast.warning(`Please select an assigned staff member for '${unassignedService.item.name}' before checkout.`);
                  return;
                }
                setMobileCartOpen(false);
              }
              handleOpenCheckout();
            }}
            className="w-full bg-[#2254E1] hover:bg-[#1B44B8] active:scale-[0.99] text-white font-bold h-10 text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-between px-3.5 cursor-pointer transition-all shrink-0 mb-0.5"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Collect Payment & Complete Sale</span>
            </div>
            <span className="font-mono text-xs font-black bg-white/20 px-2.5 py-0.5 rounded-lg">
              {formatCurrency(calculations.fullInvoiceTotal)}
            </span>
          </Button>
        </div>
      )}
    </div>
  );

  if (isLoading && !currentBranch) {
    return (
      <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-8 bg-slate-50">
        <ScissorLoader size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-2 font-sans overflow-hidden">
      {/* 1. Consolidated Executive Top Header Bar */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-white px-3.5 py-2 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Left: Branding & Active Branch */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2254E1] to-blue-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-extrabold text-slate-900 tracking-tight">Point of Sale</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Counter
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {currentBranch?.code || 'LHE-01'}
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 leading-tight">
              {currentBranch?.name}
            </p>
          </div>
        </div>

        {/* Center: Client Attribution / Quick CRM Search */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-center">
          {selectedClient ? (
            <div className="flex items-center justify-between gap-2 bg-blue-50/90 border border-blue-200 px-3 py-1.5 rounded-xl text-xs w-full max-w-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5.5 h-5.5 rounded-full bg-[#2254E1] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  <UserCheck className="w-3 h-3" />
                </div>
                <div className="truncate">
                  <span className="font-bold text-slate-900 text-xs truncate block">{selectedClient.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">{selectedClient.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedClient.outstandingBalance && selectedClient.outstandingBalance > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenCollectionModal}
                    className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md hover:bg-amber-200 cursor-pointer transition-colors"
                  >
                    Due: {formatCurrency(selectedClient.outstandingBalance)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSetWalkIn}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                  title="Switch to Walk-in Customer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 w-full max-w-sm">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Lookup customer (name, phone)..."
                  value={customerSearchQuery}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  className="pl-8.5 pr-8 text-xs h-8.5 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border-slate-200 rounded-xl transition-all"
                />
                {isSearchingClients ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-100 border-t-[#2254E1] animate-spin absolute right-2.5 top-2.5" />
                ) : customerSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => setCustomerSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                {/* Client Dropdown Results */}
                {showClientDropdown && (
                  <div className="absolute left-0 right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto p-1">
                    {customerSearchResults.length > 0 ? (
                      <>
                        {customerSearchResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50/70 rounded-lg flex justify-between items-center text-xs transition-colors cursor-pointer"
                          >
                            <div>
                              <span className="font-bold text-slate-900 block">{client.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{client.phone}</span>
                            </div>
                            {client.outstandingBalance && client.outstandingBalance > 0 ? (
                              <Badge variant="warning" className="text-[10px] font-bold">
                                Due: {formatCurrency(client.outstandingBalance)}
                              </Badge>
                            ) : (
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Clear</span>
                            )}
                          </button>
                        ))}
                        <div className="p-1 border-t border-slate-100 mt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenAddClientModal(customerSearchQuery)}
                            className="w-full text-left px-2 py-1.5 text-xs text-[#2254E1] hover:bg-blue-50/60 rounded-md font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Register in CRM
                          </button>
                        </div>
                      </>
                    ) : customerSearchQuery.trim() ? (
                      <div className="p-3 text-center text-xs space-y-2">
                        <p className="text-slate-500 text-[11px]">No registered client matches "{customerSearchQuery}".</p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenAddClientModal(customerSearchQuery)}
                          className="h-7 text-xs bg-[#2254E1] hover:bg-[#1B44B8] text-white gap-1 w-full rounded-lg font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Register "{customerSearchQuery}"
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleOpenAddClientModal()}
                className="h-8.5 text-xs font-bold gap-1 text-[#2254E1] border-blue-200 hover:bg-blue-50 rounded-xl shrink-0"
                title="Register client in CRM"
              >
                <Plus className="w-3.5 h-3.5" />
                Client
              </Button>
            </div>
          )}
        </div>

        {/* Right: Actions, Branch Switcher & Queue */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          {/* Mobile Cart Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMobileCartOpen(true)}
            className="lg:hidden h-8.5 px-2.5 text-xs gap-1.5 font-bold border-blue-200 bg-blue-50/60 text-[#2254E1] hover:bg-blue-100 rounded-xl"
            title="Open Cart"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-[#2254E1]" />
            <span>Cart</span>
            {currentCartCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#2254E1] text-white">
                {currentCartCount}
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsQueueOpen(true)}
            className="h-8.5 px-2.5 sm:px-3 text-xs gap-1.5 font-bold border-blue-200 bg-blue-50/60 text-[#2254E1] hover:bg-blue-100 rounded-xl"
          >
            <Calendar className="w-3.5 h-3.5 text-[#2254E1]" />
            Queue
            {queueCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#2254E1] text-white">
                {queueCount}
              </span>
            )}
          </Button>

          {isSuperAdmin && (
            <Select
              value={selectedBranchId}
              onValueChange={(val) => {
                setSelectedBranchId(val);
                switchBranch(val);
              }}
            >
              <SelectTrigger className="w-36 text-xs h-8.5 font-semibold bg-slate-50 border-slate-200 rounded-xl">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {allBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              if (selectedBranchId) {
                loadBranchData(selectedBranchId);
                refreshQueueCount(selectedBranchId);
                toast.info('Refreshed');
              }
            }}
            className="h-8.5 w-8.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Refresh POS Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Main Desktop Grid: Left Catalogue (lg:col-span-7), Right Current Sale Card (lg:col-span-5) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-1 gap-2.5 overflow-hidden">
        {/* Left Column: Search, Category Filter Pills & Product Cards (lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden space-y-1.5">
          {/* Search Input Bar */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <Input
              ref={searchInputRef}
              placeholder="Search services, products, packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 text-xs h-9 bg-white border-slate-200 hover:border-slate-300 focus:border-[#2254E1] rounded-xl shadow-2xs font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills (Theme Royal Blue) with Horizontal Scroll & Arrow Controls */}
          <div className="relative shrink-0 flex items-center group">
            {/* Left Scroll Button */}
            <button
              type="button"
              onClick={() => {
                if (categoryScrollerRef.current) {
                  categoryScrollerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                }
              }}
              className="hidden sm:flex items-center justify-center w-6 h-6 rounded-lg bg-white border border-slate-200 shadow-2xs text-slate-500 hover:text-[#2254E1] hover:bg-slate-50 shrink-0 mr-1 cursor-pointer transition-colors"
              title="Scroll categories left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Scrollable Pills Container with Visible Scrollbar */}
            <div
              ref={categoryScrollerRef}
              onWheel={handleCategoryWheel}
              className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-1.5 pos-category-scroller"
            >
              {categoryPills.map((pill) => {
                const isActive = selectedCategory === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setSelectedCategory(pill.key)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#2254E1] text-white shadow-xs font-bold'
                        : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Scroll Button */}
            <button
              type="button"
              onClick={() => {
                if (categoryScrollerRef.current) {
                  categoryScrollerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                }
              }}
              className="hidden sm:flex items-center justify-center w-6 h-6 rounded-lg bg-white border border-slate-200 shadow-2xs text-slate-500 hover:text-[#2254E1] hover:bg-slate-50 shrink-0 ml-1 cursor-pointer transition-colors"
              title="Scroll categories right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Catalogue Items Grid Container */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between text-[10px] text-slate-400 px-1 pb-1">
              <span className="font-medium text-slate-600">
                Available Items ({filteredCatalogueItems.length})
              </span>
              <span>Click card to add directly</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-20 lg:pb-2">
              {filteredCatalogueItems.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs space-y-1">
                  <Search className="w-7 h-7 mx-auto text-slate-300 stroke-1" />
                  <p className="font-medium text-slate-600">No matching items found</p>
                  <p className="text-[11px] text-slate-400">Try adjusting your search query or category filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 pb-2">
                  {filteredCatalogueItems.map((item) => {
                    const isProd = item.type === 'PRODUCT';
                    const isPkg = item.type === 'PACKAGE';
                    const isOut = isProd && item.isOutOfStock;
                    const isLow = isProd && item.isLowStock;
                    const inCartQty = cart
                      .filter((ci) => ci.item.id === item.id)
                      .reduce((sum, ci) => sum + ci.quantity, 0);

                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        onClick={() => {
                          if (!isOut) handleItemCardClick(item);
                        }}
                        className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between gap-2 sm:gap-3 cursor-pointer group bg-white min-h-[115px] sm:min-h-[145px] ${
                          isOut
                            ? 'border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed'
                            : 'border-slate-200/90 bg-white hover:border-slate-300 shadow-2xs hover:shadow-xs hover:-translate-y-0.5'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-xs shrink-0">
                              {isProd ? (
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                  <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </div>
                              ) : isPkg ? (
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-50 text-[#2254E1] flex items-center justify-center">
                                  <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 flex-wrap justify-end">
                              {inCartQty > 0 && (
                                <span className="text-[9px] sm:text-[10px] font-semibold bg-blue-50 text-[#2254E1] border border-blue-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#2254E1]" />
                                  <span>{inCartQty} in cart</span>
                                </span>
                              )}
                              {isOut ? (
                                <span className="text-[9px] sm:text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-1.5 sm:px-2 py-0.5 rounded-full uppercase">
                                  Out
                                </span>
                              ) : isLow ? (
                                <span className="text-[9px] sm:text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 sm:px-2 py-0.5 rounded-full">
                                  {item.stock} left
                                </span>
                              ) : isPkg ? (
                                <span className="text-[9px] sm:text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-1.5 sm:px-2 py-0.5 rounded-full">
                                  {((item.raw as PackageItem).components || []).length} items
                                </span>
                              ) : (
                                <span className="text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 sm:px-2.5 py-0.5 rounded-full truncate max-w-[70px] sm:max-w-none">
                                  {item.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <h3 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight line-clamp-2 pt-1.5 sm:pt-2 group-hover:text-[#2254E1] transition-colors leading-snug">
                            {item.name}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-slate-100 text-xs mt-auto">
                          <div>
                            <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm group-hover:text-[#2254E1] transition-colors">
                              {formatCurrency(item.price)}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isOut}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isOut) handleItemCardClick(item);
                            }}
                            className={`w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 rounded-lg sm:rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                              isOut
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : inCartQty > 0
                                ? 'bg-blue-50 text-[#2254E1] border border-blue-200 hover:bg-[#2254E1] hover:text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title={isOut ? 'Out of Stock' : 'Add to Sale Card'}
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Current Sale Card (lg:col-span-5) */}
        <div id="pos-cart-panel" className="hidden lg:flex lg:col-span-5 flex-col h-full min-h-0 overflow-hidden">
          <Card className="w-full h-full min-h-0 flex flex-col justify-between p-3.5 bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden transition-all">
            {renderCartPanel(false)}
          </Card>
        </div>
      </div>

      {/* 4. Checkout & Payment Modal */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto font-sans p-4 sm:p-5">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#2254E1]" />
              Payment & Checkout
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Client & Invoice Summary Card */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-[#2254E1] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    {clientName?.trim() || selectedClient?.name || 'Walk-in Customer'}
                  </span>
                  {clientPhone?.trim() && clientPhone !== 'N/A' ? (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {clientPhone}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Walk-in</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Bill</span>
                <span className="font-mono font-extrabold text-base text-[#2254E1]">
                  {formatCurrency(calculations.fullInvoiceTotal)}
                </span>
              </div>
            </div>

            {/* Tip Quick Selector Row */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700 text-xs">Staff Tip:</span>
              <div className="flex items-center gap-1.5">
                {[50, 100, 200, 500].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const newTip = tipAmount === t ? 0 : t;
                      setTipAmount(newTip);
                      const newTotal = roundCurrency(calculations.billTotal + newTip);
                      setCashTenderedInput(newTotal);
                      setOnlineAmountInput(newTotal);
                    }}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-colors cursor-pointer ${
                      tipAmount === t
                        ? 'bg-[#2254E1] text-white border-[#2254E1]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    +{t}
                  </button>
                ))}
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={tipAmount || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setTipAmount(val);
                    const newTotal = roundCurrency(calculations.billTotal + val);
                    setCashTenderedInput(newTotal);
                    setOnlineAmountInput(newTotal);
                  }}
                  className="w-20 h-7 text-xs font-mono font-bold text-right bg-white"
                />
              </div>
            </div>

            {/* Live Settlement Calculations & Customer Credit Validation */}
            {(() => {
              const splitOnlineTotal = splitOnlinePayments.reduce((s, p) => s + (p.amount || 0), 0);
              const splitCashShare = splitCashAmount || 0;
              const splitCashGiven = splitCashTendered !== undefined && splitCashTendered !== null ? splitCashTendered : splitCashShare;
              const splitCashRetained = Math.min(splitCashShare, splitCashGiven);
              const splitTotalPaid = roundCurrency(splitOnlineTotal + splitCashRetained);

              const currentRetained = checkoutMode === 'CASH'
                ? Math.min(cashTenderedInput || 0, calculations.fullInvoiceTotal)
                : checkoutMode === 'ONLINE'
                ? Math.min(onlineAmountInput || 0, calculations.fullInvoiceTotal)
                : splitTotalPaid;

              const currentDue = Math.max(0, roundCurrency(calculations.fullInvoiceTotal - currentRetained));
              const currentChange = checkoutMode === 'CASH'
                ? Math.max(0, roundCurrency((cashTenderedInput || 0) - calculations.fullInvoiceTotal))
                : checkoutMode === 'ONLINE'
                ? 0
                : Math.max(0, roundCurrency(splitCashGiven - splitCashShare));

              const isNamedClientValid =
                !isWalkIn &&
                Boolean(clientName && clientName.trim() && clientName.trim().toLowerCase() !== 'walk-in customer' && clientName.trim().toLowerCase() !== 'walk-in') &&
                Boolean(clientPhone && clientPhone.replace(/\D/g, '').length >= 10);

              return (
                <div className="space-y-3">
                  {/* Customer Details when there are Remaining Dues */}
                  {currentDue > 0 && !isNamedClientValid && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Customer Details (Udhaar / Khata)</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                          Due: {formatCurrency(currentDue)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-amber-900 block mb-1">Customer Name *</label>
                          <Input
                            placeholder="e.g. Nadia Butt"
                            value={clientName === 'Walk-in Customer' ? '' : clientName}
                            onChange={(e) => {
                              setClientName(e.target.value);
                              setIsWalkIn(false);
                            }}
                            className="text-xs h-8 bg-white border-amber-300 font-medium focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-amber-900 block mb-1">Phone Number *</label>
                          <Input
                            placeholder="03001234567"
                            value={clientPhone === 'N/A' ? '' : clientPhone}
                            onChange={(e) => {
                              setClientPhone(e.target.value);
                              setIsWalkIn(false);
                            }}
                            className="text-xs h-8 bg-white border-amber-300 font-mono font-medium focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentDue > 0 && isNamedClientValid && (
                    <div className="p-2 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-bold text-blue-950 truncate">
                          Khata: <span className="font-normal text-blue-800">{clientName} ({clientPhone})</span>
                        </span>
                      </div>
                      <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-mono font-bold shrink-0">
                        Due: {formatCurrency(currentDue)}
                      </Badge>
                    </div>
                  )}

                  {/* Payment Method Selector Tabs */}
                  <Tabs value={checkoutMode} onValueChange={(val: any) => setCheckoutMode(val)}>
                    <TabsList className="grid grid-cols-3 bg-slate-100 p-1 h-9 w-full">
                      <TabsTrigger value="CASH" className="text-xs font-semibold cursor-pointer">
                        <Banknote className="w-3.5 h-3.5 mr-1" />
                        Cash
                      </TabsTrigger>
                      <TabsTrigger value="ONLINE" className="text-xs font-semibold cursor-pointer">
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Online
                      </TabsTrigger>
                      <TabsTrigger value="SPLIT" className="text-xs font-semibold cursor-pointer">
                        <Coins className="w-3.5 h-3.5 mr-1" />
                        Split Payment
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* CASH MODE */}
                  {checkoutMode === 'CASH' && (
                    <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Cash Received (PKR)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          value={cashTenderedInput || ''}
                          onChange={(e) => setCashTenderedInput(parseFloat(e.target.value) || 0)}
                          className="text-sm font-mono font-bold bg-white h-9"
                          placeholder="0"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200 text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">Paid Amount</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrency(Math.min(cashTenderedInput || 0, calculations.fullInvoiceTotal))}
                          </span>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                          <span className="text-[10px] text-emerald-700 block">Change</span>
                          <span className="font-mono font-bold text-emerald-800">
                            {formatCurrency(Math.max(0, (cashTenderedInput || 0) - calculations.fullInvoiceTotal))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ONLINE MODE */}
                  {checkoutMode === 'ONLINE' && (
                    <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Payment Account
                        </label>
                        <Select
                          value={selectedOnlineAccountId}
                          onValueChange={(val) => setSelectedOnlineAccountId(val)}
                        >
                          <SelectTrigger className="text-xs bg-white h-9">
                            <SelectValue placeholder="Select Account" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                {acc.name} ({acc.accountIdentifier || acc.providerName})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Amount Received (PKR)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max={calculations.fullInvoiceTotal}
                          value={onlineAmountInput || ''}
                          onChange={(e) => setOnlineAmountInput(parseFloat(e.target.value) || 0)}
                          className="text-sm font-mono font-bold bg-white h-9"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {/* SPLIT MODE */}
                  {checkoutMode === 'SPLIT' && (
                    <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">Cash Payment</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleAutoBalanceSplit}
                            className="text-[11px] h-6 px-2 text-[#2254E1] hover:bg-blue-50 cursor-pointer font-bold"
                            title="Auto-fill remaining balance into cash"
                          >
                            Auto-Balance
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Cash Share (PKR)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={splitCashAmount || ''}
                              onChange={(e) => setSplitCashAmount(parseFloat(e.target.value) || 0)}
                              className="text-xs h-8 bg-white font-mono font-bold"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">
                              Cash Received (PKR)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={splitCashTendered !== undefined && splitCashTendered !== null ? splitCashTendered : ''}
                              onChange={(e) => setSplitCashTendered(parseFloat(e.target.value) || 0)}
                              className="text-xs h-8 bg-white font-mono font-bold"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* If customer gave more physical cash than cash share */}
                        {(() => {
                          const cashShare = splitCashAmount || 0;
                          const cashGiven = splitCashTendered !== undefined && splitCashTendered !== null ? splitCashTendered : cashShare;
                          if (cashGiven > cashShare) {
                            return (
                              <div className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center justify-between">
                                <span>Change to return:</span>
                                <span className="font-mono font-bold">{formatCurrency(cashGiven - cashShare)}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Digital Splits */}
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">Digital / Bank Accounts</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleAddSplitOnlineRow}
                            className="text-xs h-6 px-2 font-semibold text-[#2254E1] border-blue-200 hover:bg-blue-50 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add Account
                          </Button>
                        </div>

                        {splitOnlinePayments.length === 0 && (
                          <div className="text-center py-2 text-[11px] text-slate-400 bg-white rounded-lg border border-dashed border-slate-200">
                            No digital accounts added.
                          </div>
                        )}

                        {splitOnlinePayments.map((op, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
                            <Select
                              value={op.paymentAccountId}
                              onValueChange={(val) => handleUpdateSplitOnlineRow(idx, 'paymentAccountId', val)}
                            >
                              <SelectTrigger className="text-xs h-8 flex-1">
                                <SelectValue placeholder="Select Account" />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                    {acc.name} ({acc.accountIdentifier || acc.providerName})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div className="relative w-28">
                              <span className="absolute left-2 top-2 text-[10px] font-bold text-slate-400">PKR</span>
                              <Input
                                type="number"
                                placeholder="0"
                                value={op.amount || ''}
                                onChange={(e) => handleUpdateSplitOnlineRow(idx, 'amount', e.target.value)}
                                className="pl-8 text-xs h-8 font-mono font-bold"
                              />
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveSplitOnlineRow(idx)}
                              className="w-7 h-7 text-rose-500 hover:bg-rose-50 p-0 cursor-pointer"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Settlement Summary */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span>Total Bill:</span>
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {formatCurrency(calculations.fullInvoiceTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span>Total Paid:</span>
                      <span className="font-mono font-bold text-emerald-700 text-xs">
                        {formatCurrency(currentRetained)}
                      </span>
                    </div>

                    {currentChange > 0 && (
                      <div className="flex items-center justify-between text-emerald-800 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Change to Return:
                        </span>
                        <span className="font-mono text-xs">{formatCurrency(currentChange)}</span>
                      </div>
                    )}

                    {currentDue > 0 && (
                      <div className="flex items-center justify-between text-amber-900 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Remaining Due (Udhaar):
                        </span>
                        <span className="font-mono text-xs">{formatCurrency(currentDue)}</span>
                      </div>
                    )}
                  </div>

                  {/* Posting Error Banner */}
                  {postingError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{postingError}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              disabled={isPosting}
              onClick={handlePostInvoice}
              className="bg-[#2254E1] hover:bg-[#1B44B8] text-white text-xs font-bold gap-1.5"
            >
              {isPosting ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Confirm & Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Dues & Previous Invoices Collection Modal */}
      <Dialog open={isCollectionModalOpen} onOpenChange={setIsCollectionModalOpen}>
        <DialogContent className="max-w-md font-sans p-4 sm:p-5 space-y-2.5">
          <DialogHeader className="pb-1 border-b border-slate-100">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-amber-600" />
              Collect Previous Outstanding Dues
            </DialogTitle>
            <DialogDescription className="text-xs">
              Customer: <span className="font-bold text-slate-900">{clientName || selectedClient?.name}</span>
            </DialogDescription>
          </DialogHeader>

          {isLoadingInvoices ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <ScissorLoader size="sm" />
            </div>
          ) : customerOutstandingInvoices.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No unpaid invoices found for this customer profile.
            </div>
          ) : (
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Select Original Invoice to Collect Against
                </label>
                <Select
                  value={selectedInvoiceForPayment?.id || ''}
                  onValueChange={(val) => {
                    const inv = customerOutstandingInvoices.find((i) => i.id === val) || null;
                    setSelectedInvoiceForPayment(inv);
                    if (inv) {
                      setCollectionAmountInput(inv.amountDue);
                      setCollectionCashTendered(inv.amountDue);
                    }
                  }}
                >
                  <SelectTrigger className="text-xs h-9 bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customerOutstandingInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id} className="text-xs">
                        {inv.invoiceNumber} ({inv.date}) — Due: {formatCurrency(inv.amountDue)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedInvoiceForPayment && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between text-xs pb-2 border-b border-slate-200">
                    <span className="text-slate-600">Original Invoice Total:</span>
                    <span className="font-mono font-bold">{formatCurrency(selectedInvoiceForPayment.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs pb-2 border-b border-slate-200">
                    <span className="text-slate-600">Current Outstanding Balance:</span>
                    <span className="font-mono font-bold text-amber-700">
                      {formatCurrency(selectedInvoiceForPayment.amountDue)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-slate-700 block">Payment Method</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        type="button"
                        variant={collectionPaymentMode === 'CASH' ? 'default' : 'outline'}
                        onClick={() => setCollectionPaymentMode('CASH')}
                        className={`text-xs h-8 ${collectionPaymentMode === 'CASH' ? 'bg-[#2254E1]' : ''}`}
                      >
                        Cash
                      </Button>
                      <Button
                        type="button"
                        variant={collectionPaymentMode === 'ONLINE' ? 'default' : 'outline'}
                        onClick={() => setCollectionPaymentMode('ONLINE')}
                        className={`text-xs h-8 ${collectionPaymentMode === 'ONLINE' ? 'bg-[#2254E1]' : ''}`}
                      >
                        Online
                      </Button>
                      <Button
                        type="button"
                        variant={collectionPaymentMode === 'SPLIT' ? 'default' : 'outline'}
                        onClick={() => {
                          setCollectionPaymentMode('SPLIT');
                          setSplitCollectionCashAmount(collectionAmountInput);
                          setSplitCollectionCashTendered(collectionAmountInput);
                          setSplitCollectionOnlinePayments([]);
                        }}
                        className={`text-xs h-8 ${collectionPaymentMode === 'SPLIT' ? 'bg-[#2254E1]' : ''}`}
                      >
                        Split
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Total Collection Amount (PKR)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedInvoiceForPayment.amountDue}
                      value={collectionAmountInput || ''}
                      onChange={(e) => setCollectionAmountInput(parseFloat(e.target.value) || 0)}
                      className="text-sm font-mono font-bold bg-white h-9"
                    />
                  </div>

                  {collectionPaymentMode === 'CASH' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Cash Tendered (PKR)
                      </label>
                      <Input
                        type="number"
                        min={collectionAmountInput}
                        value={collectionCashTendered || ''}
                        onChange={(e) => setCollectionCashTendered(parseFloat(e.target.value) || 0)}
                        className="text-sm font-mono font-bold bg-white h-9"
                      />
                    </div>
                  )}

                  {collectionPaymentMode === 'ONLINE' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Deposit Payment Account
                      </label>
                      <Select
                        value={collectionOnlineAccountId}
                        onValueChange={setCollectionOnlineAccountId}
                      >
                        <SelectTrigger className="text-xs h-9 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id} className="text-xs">
                              {acc.name} ({acc.accountIdentifier || acc.providerName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {collectionPaymentMode === 'SPLIT' && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">Retained Cash Portion (PKR)</label>
                        <Input
                          type="number"
                          value={splitCollectionCashAmount || ''}
                          onChange={(e) => setSplitCollectionCashAmount(parseFloat(e.target.value) || 0)}
                          className="text-xs h-8 font-mono bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-600">Digital Account Splits</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSplitCollectionOnlinePayments((prev) => [
                                ...prev,
                                { paymentAccountId: paymentAccounts[0]?.id || '', amount: 0 },
                              ])
                            }
                            className="text-[10px] h-6 px-2"
                          >
                            + Add Account Row
                          </Button>
                        </div>

                        {splitCollectionOnlinePayments.map((op, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white p-1.5 rounded border border-slate-200 text-xs">
                            <Select
                              value={op.paymentAccountId}
                              onValueChange={(val) => {
                                const updated = [...splitCollectionOnlinePayments];
                                updated[idx].paymentAccountId = val;
                                setSplitCollectionOnlinePayments(updated);
                              }}
                            >
                              <SelectTrigger className="text-xs h-7 flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentAccounts.map((acc) => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-xs">
                                    {acc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Input
                              type="number"
                              placeholder="Amount"
                              value={op.amount || ''}
                              onChange={(e) => {
                                const updated = [...splitCollectionOnlinePayments];
                                updated[idx].amount = parseFloat(e.target.value) || 0;
                                setSplitCollectionOnlinePayments(updated);
                              }}
                              className="w-24 text-xs h-7 font-mono"
                            />

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setSplitCollectionOnlinePayments((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="w-5 h-5 text-rose-500 hover:bg-rose-50 p-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCollectionModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              disabled={isPostingCollection || !selectedInvoiceForPayment || collectionAmountInput <= 0}
              onClick={handlePostCollectionPayment}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1.5"
            >
              {isPostingCollection ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
              ) : (
                <Banknote className="w-3.5 h-3.5" />
              )}
              Confirm Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Printable Receipt Modal */}
      {isReceiptOpen && postedInvoice && (
        <ReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => {
            setIsReceiptOpen(false);
            setPostedInvoice(null);
          }}
          invoice={postedInvoice}
          branch={currentBranch}
          onNewSale={() => {
            setIsReceiptOpen(false);
            setPostedInvoice(null);
          }}
        />
      )}

      {/* 7. Appointment Queue Sheet */}
      <AppointmentQueueSheet
        isOpen={isQueueOpen}
        onOpenChange={setIsQueueOpen}
        branchId={selectedBranchId}
        loadedAppointmentId={loadedAppointment?.id}
        onSelectAppointment={(appt) => handleOpenAppointmentInPOS(appt)}
      />

      {/* 8. Cart Overwrite Protection Prompt */}
      <CartOverwritePromptModal
        isOpen={isCartOverwritePromptOpen}
        onClose={() => {
          setIsCartOverwritePromptOpen(false);
          setPendingAppointmentToLoad(null);
        }}
        pendingAppointment={pendingAppointmentToLoad}
        currentCartCount={cart.length}
        onConfirmReplace={() => {
          if (pendingAppointmentToLoad) {
            handleOpenAppointmentInPOS(pendingAppointmentToLoad, true);
          }
        }}
      />

      {/* 9. Quick Client Registration Modal */}
      <ClientFormModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={handleClientCreated}
        activeBranchId={selectedBranchId}
        branches={allBranches}
        initialName={clientModalPrefill.name}
        initialPhone={clientModalPrefill.phone}
      />

      {/* 10. Mobile Sticky Quick Action Bar when cart has items */}
      {cart.length > 0 && (
        <div
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2254E1] flex items-center justify-center font-bold text-xs shrink-0">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold font-mono tracking-tight text-white">
                {formatCurrency(calculations.fullInvoiceTotal)}
              </p>
              <p className="text-[10px] text-slate-300">
                {currentCartCount} item{currentCartCount !== 1 ? 's' : ''} in cart
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setMobileCartOpen(true);
            }}
            className="h-8 px-3.5 text-xs font-bold bg-[#2254E1] hover:bg-blue-600 text-white rounded-xl shadow-xs cursor-pointer"
          >
            Review & Pay
          </Button>
        </div>
      )}

      {/* 11. Mobile Cart Drawer Sheet (strictly mobile only) */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="lg:hidden h-[92vh] max-h-[92vh] p-0 flex flex-col rounded-t-3xl overflow-hidden bg-white z-50 border-t border-slate-200 shadow-2xl">
          <div className="flex-1 min-h-0 flex flex-col p-3.5 sm:p-4 overflow-hidden">
            {renderCartPanel(true)}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
