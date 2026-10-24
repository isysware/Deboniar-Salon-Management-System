import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { salonService } from '@/services';
import { toast } from '@/context/ToastContext';
import {
  InventoryItem,
  InventoryBatch,
  ItemType,
  UnitOfMeasure,
  TaxTreatment,
} from '@/types/salon';
import { AccessDeniedView } from '@/features/scaffold/AccessDeniedView';
import { InventoryNavHeader } from './InventoryNavHeader';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Banknote,
  Package,
  Layers,
  Edit2,
  ArrowDownRight,
  Loader2,
  Barcode,
  X,
} from 'lucide-react';

const formatPKR = (amt: number) => {
  return (Number(amt) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const InventoryItemsPage: React.FC = () => {
  const { user, activeBranchId, allBranches } = useAuth();
  const { navigate } = useRouter();

  if (!user || user.role === 'STAFF') {
    return <AccessDeniedView attemptedPath="/operations/inventory" />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const defaultBranchId = isSuperAdmin
    ? (activeBranchId !== 'ALL' ? activeBranchId : allBranches[0]?.id || '')
    : (user.branchId || '');

  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, { currentStock: number; valuation: number }>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    sku: string;
    barcode: string;
    category: string;
    itemType: ItemType;
    purchaseUnit: UnitOfMeasure;
    issueUnit: UnitOfMeasure;
    defaultPurchaseCost: number;
    sellingPrice: number;
    minStockLevel: number;
    openingStock: number;
    openingCost: number;
  }>({
    name: '',
    sku: '',
    barcode: '',
    category: 'Hair Care',
    itemType: 'RETAIL_PRODUCT',
    purchaseUnit: 'BOTTLE',
    issueUnit: 'BOTTLE',
    defaultPurchaseCost: 0,
    sellingPrice: 0,
    minStockLevel: 5,
    openingStock: 0,
    openingCost: 0,
  });

  const loadData = useCallback(async (bId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [itemList, batchList] = await Promise.all([
        salonService.getInventoryItems(bId || 'ALL', user),
        salonService.getInventoryBatches(bId || 'ALL', undefined, user).catch(() => []),
      ]);
      setItems(itemList);
      setBatches(batchList);

      // Build stock map from batch quantities
      const smap: Record<string, { currentStock: number; valuation: number }> = {};
      itemList.forEach((it) => {
        const itemBatches = batchList.filter((b) => b.itemId === it.id && (bId === 'ALL' || b.branchId === bId));
        const currentQty = itemBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);
        const val = itemBatches.reduce(
          (sum, b) => sum + (b.remainingQuantity || 0) * (b.unitCostSnapshot || it.defaultPurchaseCost || 0),
          0
        );
        smap[it.id] = { currentStock: currentQty, valuation: val };
      });
      setStockMap(smap);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load inventory items.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData(selectedBranchId);
  }, [loadData, selectedBranchId]);

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.barcode && item.barcode.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      const currentStock = stockMap[item.id]?.currentStock ?? 0;
      if (stockStatusFilter === 'OUT_OF_STOCK' && currentStock > 0) return false;
      if (stockStatusFilter === 'LOW_STOCK' && (currentStock <= 0 || currentStock > item.minStockLevel)) return false;
      if (stockStatusFilter === 'IN_STOCK' && currentStock <= item.minStockLevel) return false;

      return true;
    });
  }, [items, searchQuery, selectedCategory, stockStatusFilter, stockMap]);

  // KPIs
  const kpis = useMemo(() => {
    let totalStockValuation = 0;
    let totalItems = items.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    items.forEach((it) => {
      const stock = stockMap[it.id]?.currentStock ?? 0;
      const cost = it.defaultPurchaseCost || 0;
      totalStockValuation += stock * cost;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= it.minStockLevel) {
        lowStockCount++;
      }
    });

    return {
      totalItems,
      inStockCount: totalItems - outOfStockCount,
      lowStockCount,
      outOfStockCount,
      totalStockValuation,
    };
  }, [items, stockMap]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      category: 'Hair Care',
      itemType: 'RETAIL_PRODUCT',
      purchaseUnit: 'BOTTLE',
      issueUnit: 'BOTTLE',
      defaultPurchaseCost: 0,
      sellingPrice: 0,
      minStockLevel: 5,
      openingStock: 0,
      openingCost: 0,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      barcode: item.barcode || '',
      category: item.category,
      itemType: item.itemType,
      purchaseUnit: item.purchaseUnit,
      issueUnit: item.issueUnit,
      defaultPurchaseCost: item.defaultPurchaseCost,
      sellingPrice: item.sellingPrice,
      minStockLevel: item.minStockLevel,
      openingStock: 0,
      openingCost: 0,
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error('Product name is required.');
      return;
    }

    try {
      if (editingItem) {
        await salonService.updateInventoryItem(
          editingItem.id,
          {
            name: formData.name,
            category: formData.category,
            itemType: formData.itemType,
            purchaseUnit: formData.purchaseUnit,
            issueUnit: formData.issueUnit,
            defaultPurchaseCost: Number(formData.defaultPurchaseCost) || 0,
            sellingPrice: Number(formData.sellingPrice) || 0,
            price: Number(formData.sellingPrice) || 0,
            minStockLevel: Number(formData.minStockLevel) || 1,
            barcode: formData.barcode || undefined,
          },
          user
        );
        const msg = `Product "${formData.name}" updated successfully.`;
        setSuccessMessage(msg);
        toast.success(msg);
      } else {
        const openingStock = Math.max(0, Number(formData.openingStock) || 0);
        const openingCost = Number(formData.openingCost || formData.defaultPurchaseCost || 0);

        await salonService.createInventoryItem(
          {
            branchAvailability: [selectedBranchId],
            name: formData.name,
            sku: formData.sku || '',
            code: formData.sku || '',
            barcode: formData.barcode || undefined,
            category: formData.category || 'General',
            itemType: formData.itemType,
            purchaseUnit: formData.purchaseUnit,
            issueUnit: formData.issueUnit,
            defaultPurchaseCost: Number(formData.defaultPurchaseCost) || 0,
            sellingPrice: Number(formData.sellingPrice) || 0,
            price: Number(formData.sellingPrice) || 0,
            minStockLevel: Number(formData.minStockLevel) || 5,
            openingStock,
            openingQuantity: openingStock,
            openingCost,
            branchId: selectedBranchId,
            taxTreatment: 'BRANCH_DEFAULT',
            trackBatch: true,
            trackExpiry: true,
            nearExpiryAlertDays: 60,
            isActive: true,
          },
          user
        );
        const stockNote = openingStock > 0 ? ` with opening stock of ${openingStock} ${formData.purchaseUnit}` : '';
        const msg = `New product "${formData.name}" added to catalogue${stockNote}.`;
        setSuccessMessage(msg);
        toast.success(msg);
      }
      setIsModalOpen(false);
      loadData(selectedBranchId);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to save product.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-6 md:px-8 max-w-7xl mx-auto font-['Inter',sans-serif]">
      {/* Shared Navigation Header */}
      <InventoryNavHeader
        title="Inventory & Stocks"
        subtitle="Manage product catalogue, current stock levels on hand, retail pricing and inventory valuation."
        activePath="/operations/inventory"
        selectedBranchId={selectedBranchId}
        onBranchChange={handleBranchChange}
        primaryAction={{
          label: 'Add New Product',
          icon: <Plus className="w-3.5 h-3.5" />,
          onClick: handleOpenAddModal,
        }}
        secondaryAction={{
          label: 'Stock In (Purchases)',
          icon: <ArrowDownRight className="w-3.5 h-3.5 text-[#0047AB]" />,
          onClick: () => navigate('/operations/stock-in'),
        }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Products
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0047AB] flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{kpis.totalItems}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {kpis.inStockCount} active in stock
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Stock Valuation
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            PKR {formatPKR(kpis.totalStockValuation)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">
            Cost value of stock on hand
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-xs bg-linear-to-br from-white to-amber-50/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-900">{kpis.lowStockCount}</div>
          <div className="text-[11px] text-amber-700 mt-1">
            At or below minimum threshold
          </div>
        </div>

        <div className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-xs bg-linear-to-br from-white to-rose-50/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
              Out of Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-900">{kpis.outOfStockCount}</div>
          <div className="text-[11px] text-rose-700 mt-1">
            Need urgent re-stocking
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Stock Level Filter */}
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden mb-8">
        <div className="bg-[#0047AB] text-white px-5 py-3 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <Boxes className="w-4 h-4 stroke-[2.5]" />
            <span>Product Catalogue & Stock Levels ({filteredItems.length})</span>
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="text-xs font-semibold px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-[#2254E1] animate-spin mb-3" />
            <p className="text-slate-600 text-sm font-medium">Loading inventory catalogue...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <Boxes className="w-12 h-12 stroke-[1.25] text-slate-400 mb-3" />
            <p className="text-slate-600 text-sm font-semibold mb-1">No products found</p>
            <p className="text-slate-400 text-xs mb-4">Add your first product to begin tracking salon inventory.</p>
            <button
              onClick={handleOpenAddModal}
              className="text-xs font-semibold px-4 py-2 bg-[#0047AB] text-white rounded-md hover:bg-[#003785] transition-colors"
            >
              Add Product Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="report-records w-full min-w-[1000px] text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#EAF2FB] border-b border-blue-100 text-[#475569] font-medium text-[13px]">
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Product Name & SKU</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Item Type</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Purchase Cost</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Retail Price</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap font-bold">Stock on Hand</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Stock Valuation</th>
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200">
                {filteredItems.map((item, idx) => {
                  const currentStock = stockMap[item.id]?.currentStock ?? 0;
                  const valuation = currentStock * (item.defaultPurchaseCost || 0);
                  const isOut = currentStock <= 0;
                  const isLow = currentStock > 0 && currentStock <= item.minStockLevel;

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-normal">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>SKU: {item.sku}</span>
                          {item.barcode && <span>• Barcode: {item.barcode}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {item.itemType === 'RETAIL_PRODUCT' ? (
                          <span className="text-emerald-700 font-medium">Retail Product</span>
                        ) : (
                          <span className="text-purple-700 font-medium">Salon Consumable</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700 whitespace-nowrap">
                        PKR {formatPKR(item.defaultPurchaseCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900 whitespace-nowrap">
                        PKR {formatPKR(item.sellingPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            0 {item.purchaseUnit} (Out of Stock)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            {currentStock} {item.purchaseUnit} (Low Stock)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            {currentStock} {item.purchaseUnit}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                        PKR {formatPKR(valuation)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            title="Edit Product"
                            className="p-1.5 text-slate-500 hover:text-[#0047AB] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/operations/stock-in')}
                            title="Quick Stock In"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          >
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingItem ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. L'Oreal Keratin Shampoo 500ml"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    placeholder="Assigned automatically on save"
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Barcode (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Scan or enter barcode"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hair Care, Skin Care"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Item Type
                  </label>
                  <select
                    value={formData.itemType}
                    onChange={(e) => setFormData({ ...formData, itemType: e.target.value as any })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden"
                  >
                    <option value="RETAIL_PRODUCT">Retail Product (Sell to Clients)</option>
                    <option value="SALON_CONSUMABLE">Salon Consumable (Used in Services)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={formData.purchaseUnit}
                    onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value as any, issueUnit: e.target.value as any })}
                    className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden"
                  >
                    <option value="BOTTLE">Bottle</option>
                    <option value="PIECE">Piece</option>
                    <option value="BOX">Box</option>
                    <option value="JAR">Jar</option>
                    <option value="TUBE">Tube</option>
                    <option value="PACKET">Packet</option>
                    <option value="ML">ML</option>
                    <option value="GRAM">Gram</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cost (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.defaultPurchaseCost || 0}
                    onChange={(e) => setFormData({ ...formData, defaultPurchaseCost: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Retail (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.sellingPrice || 0}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alert Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStockLevel || 5}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                  />
                </div>
              </div>

              {!editingItem && (
                <div className="bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-200/90 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0B2545] flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-[#0047AB]" />
                      <span>Opening Stock on Hand (Initial Inventory)</span>
                    </span>
                    <span className="text-[10px] font-semibold text-[#0047AB] bg-white px-2 py-0.5 rounded-md border border-blue-200">
                      Auto-initializes Stock
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Opening Quantity ({formData.purchaseUnit}) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0 (Units on shelf)"
                        value={formData.openingStock === 0 ? '' : formData.openingStock}
                        onChange={(e) => setFormData({ ...formData, openingStock: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        How many units are currently in stock?
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Opening Unit Cost (PKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(formData.defaultPurchaseCost || 0)}
                        value={formData.openingCost === 0 ? '' : formData.openingCost}
                        onChange={(e) => setFormData({ ...formData, openingCost: Number(e.target.value) || 0 })}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#0047AB]"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Unit purchase value (Default: PKR {formatPKR(formData.defaultPurchaseCost || 0)})
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0047AB] hover:bg-[#003785] rounded-lg shadow-xs cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default InventoryItemsPage;
