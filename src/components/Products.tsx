import React, { useState } from 'react';
import {
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  AlertTriangle,
  Tag,
  Boxes,
  X,
  AlertCircle,
  ArrowRightLeft,
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calculator,
  Info
} from 'lucide-react';
import { Product, AppSettings, AuthSession, PurchaseInvoice, SaleInvoice } from '../types';
import { checkPermission } from '../lib/permissions';
import { STANDARD_SIMPLE_UNITS, UnitService } from '../lib/units';
import { UnitManagement } from './UnitManagement';

interface ProductsProps {
  products: Product[];
  purchases?: PurchaseInvoice[];
  sales?: SaleInvoice[];
  settings: AppSettings;
  onSaveProduct: (product: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  onRecalculateStock?: () => void;
  validateProduct: (code: string, name: string, excludeId?: string) => string | null;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  session?: AuthSession | null;
}

export const Products: React.FC<ProductsProps> = ({
  products,
  purchases = [],
  sales = [],
  settings,
  onSaveProduct,
  onDeleteProduct,
  onRecalculateStock,
  validateProduct,
  showToast,
  session
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUnitManagerOpen, setIsUnitManagerOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canAdd = checkPermission(session?.effectivePermissions, 'products', 'add');
  const canEdit = checkPermission(session?.effectivePermissions, 'products', 'edit');
  const canDelete = checkPermission(session?.effectivePermissions, 'products', 'delete');
  const canAdjustStock = checkPermission(session?.effectivePermissions, 'products', 'edit');

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'General',
    unit: 'Nos',
    hasSecondaryUnit: false,
    secondaryUnit: 'Pcs',
    conversionFactor: '12',
    costPrice: '0',
    sellingPrice: '0',
    currentStock: '0',
    reorderLevel: '10'
  });

  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const codeCount = products.length + 1;
    setFormData({
      code: `PROD-${String(codeCount).padStart(3, '0')}`,
      name: '',
      category: 'General',
      unit: 'Nos',
      hasSecondaryUnit: false,
      secondaryUnit: 'Pcs',
      conversionFactor: '12',
      costPrice: '',
      sellingPrice: '',
      currentStock: '0',
      reorderLevel: '10'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    const hasSec = Boolean(prod.secondaryUnit && prod.conversionFactor && prod.conversionFactor > 1);
    setFormData({
      code: prod.code,
      name: prod.name,
      category: prod.category || 'General',
      unit: prod.unit || prod.primaryUnit || 'Nos',
      hasSecondaryUnit: hasSec,
      secondaryUnit: prod.secondaryUnit || 'Pcs',
      conversionFactor: prod.conversionFactor ? prod.conversionFactor.toString() : '12',
      costPrice: prod.costPrice.toString(),
      sellingPrice: prod.sellingPrice.toString(),
      currentStock: prod.currentStock.toString(),
      reorderLevel: prod.reorderLevel.toString()
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const costNum = Number(formData.costPrice || 0);
    const sellNum = Number(formData.sellingPrice || 0);
    const stockNum = Number(formData.currentStock || 0);
    const reorderNum = Number(formData.reorderLevel || 0);
    const factorNum = formData.hasSecondaryUnit ? Number(formData.conversionFactor || 1) : 1;

    if (sellNum < costNum) {
      if (
        !window.confirm(
          `Warning: Selling price (${settings.currencySymbol} ${sellNum}) is less than Cost price (${settings.currencySymbol} ${costNum}). Continue?`
        )
      ) {
        return;
      }
    }

    const validationError = validateProduct(formData.code, formData.name, editingProduct?.id);
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    onSaveProduct({
      id: editingProduct?.id,
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      category: formData.category.trim() || 'General',
      unit: formData.unit,
      primaryUnit: formData.unit,
      secondaryUnit: formData.hasSecondaryUnit ? formData.secondaryUnit : undefined,
      conversionFactor: formData.hasSecondaryUnit ? factorNum : undefined,
      costPrice: costNum,
      sellingPrice: sellNum,
      currentStock: stockNum,
      reorderLevel: reorderNum
    });

    showToast(
      'success',
      editingProduct
        ? `Product "${formData.name.trim()}" updated.`
        : `Product "${formData.name.trim()}" added to inventory catalog.`
    );
    setIsModalOpen(false);
  };

  // Filtering
  const filteredProducts = products.filter((prod) => {
    const q = searchTerm.toLowerCase().trim();
    let matchesQuery = true;
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      matchesQuery = terms.every((t) =>
        [prod.name, prod.code, prod.category].join(' ').toLowerCase().includes(t)
      );
    }
    const matchesCategory = categoryFilter === 'ALL' || prod.category === categoryFilter;

    let matchesStock = true;
    if (stockFilter === 'LOW') {
      matchesStock = prod.currentStock <= prod.reorderLevel && prod.currentStock > 0;
    } else if (stockFilter === 'OUT') {
      matchesStock = prod.currentStock <= 0;
    }

    return matchesQuery && matchesCategory && matchesStock;
  });

  const lowStockCount = products.filter(
    (p) => p.currentStock <= p.reorderLevel && p.currentStock > 0
  ).length;

  // Calculate inward (purchases) and outward (sales) for each product
  const getProductStockFlow = (prod: Product) => {
    const cleanCode = (prod.code || '').trim().toLowerCase();
    const cleanName = (prod.name || '').trim().toLowerCase();

    let totalPurchased = 0;
    for (const pu of purchases) {
      for (const item of pu.items || []) {
        const matchId = Boolean(item.productId && item.productId === prod.id);
        const matchCode = Boolean(cleanCode && item.productCode && item.productCode.trim().toLowerCase() === cleanCode);
        const matchName = Boolean(cleanName && item.productName && item.productName.trim().toLowerCase() === cleanName);
        if (matchId || matchCode || matchName) {
          totalPurchased += Number(item.quantity || 0);
        }
      }
    }

    let totalSold = 0;
    for (const sa of sales) {
      for (const item of sa.items || []) {
        const matchId = Boolean(item.productId && item.productId === prod.id);
        const matchCode = Boolean(cleanCode && item.productCode && item.productCode.trim().toLowerCase() === cleanCode);
        const matchName = Boolean(cleanName && item.productName && item.productName.trim().toLowerCase() === cleanName);
        if (matchId || matchCode || matchName) {
          totalSold += Number(item.quantity || 0);
        }
      }
    }

    const opening = Number(
      prod.openingStock !== undefined && prod.openingStock !== null
        ? prod.openingStock
        : Math.max(0, Number(prod.currentStock || 0) - totalPurchased + totalSold)
    );

    return {
      opening,
      purchased: totalPurchased,
      sold: totalSold,
      calculated: opening + totalPurchased - totalSold,
      current: prod.currentStock
    };
  };

  const handleTriggerRecalculate = () => {
    setIsRecalculating(true);
    if (onRecalculateStock) {
      onRecalculateStock();
    }
    setTimeout(() => {
      setIsRecalculating(false);
      showToast('success', 'Stock recalculated from all purchases (+) and sales (-).');
    }, 400);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Product Inventory</h2>
          <p className="text-xs text-slate-500">
            Catalog of products, prices, stock levels & live purchase/sales inventory tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTriggerRecalculate}
            disabled={isRecalculating}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-2 rounded-xl text-xs border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
            title="Recalculate inventory from all purchase additions and sales deductions"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Recalculating...' : 'Sync Stock'}</span>
          </button>

          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold px-3 py-2 rounded-xl text-xs border border-indigo-200 transition-all cursor-pointer"
            title="View Opening, Purchases (+), Sales (-) breakdown"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            <span>Stock Audit Flow</span>
          </button>

          <button
            onClick={() => setIsUnitManagerOpen(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs border border-slate-300 transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>Units & Conversions</span>
          </button>

          <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl text-right">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Low Stock</span>
            <span className="text-base font-black text-amber-900 font-mono">
              {lowStockCount} items
            </span>
          </div>

          {canAdd && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
            >
              <Plus className="w-4 h-4 text-yellow-400" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search code, name, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700 focus:outline-hidden focus:border-blue-500 font-medium"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Stock Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStockFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                stockFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All Stock
            </button>
            <button
              onClick={() => setStockFilter('LOW')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                stockFilter === 'LOW' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setStockFilter('OUT')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                stockFilter === 'OUT' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No products found in catalog matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200 tracking-wider">
                  <th className="p-4">Code</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-center">UOM / Unit</th>
                  <th className="p-4 text-right">Cost Price</th>
                  <th className="p-4 text-right">Selling Price</th>
                  <th className="p-4 text-center">Stock Level</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((prod, idx) => {
                  const isLow = prod.currentStock <= prod.reorderLevel && prod.currentStock > 0;
                  const isOut = prod.currentStock <= 0;
                  const unitLabel = prod.unit || prod.primaryUnit || 'Nos';
                  const hasSec = Boolean(prod.secondaryUnit && prod.conversionFactor && prod.conversionFactor > 1);

                  let stockDisplay = `${prod.currentStock} ${unitLabel}`;
                  if (hasSec && prod.secondaryUnit && prod.conversionFactor) {
                    const secQty = prod.currentStock * prod.conversionFactor;
                    stockDisplay = `${prod.currentStock} ${unitLabel} (${secQty} ${prod.secondaryUnit})`;
                  }

                  return (
                    <tr key={`${prod.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900">{prod.code}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{prod.name}</div>
                        <div className="text-xs text-slate-400">Reorder Level: {prod.reorderLevel} {unitLabel}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                          {prod.category}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-mono text-xs font-bold border border-blue-200">
                          {unitLabel}
                        </span>
                        {hasSec && (
                          <span className="block text-[10px] text-slate-500 font-medium mt-0.5">
                            1 {unitLabel} = {prod.conversionFactor} {prod.secondaryUnit}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono">
                        {settings.currencySymbol} {prod.costPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-slate-400 block font-sans">/{unitLabel}</span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900">
                        {settings.currencySymbol} {prod.sellingPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-slate-400 block font-sans font-normal">/{unitLabel}</span>
                      </td>
                      <td className="p-4 text-center">
                        {(() => {
                          const flow = getProductStockFlow(prod);
                          return (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-black font-mono border ${
                                  isOut
                                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}
                                title={`Opening: ${flow.opening} + Purchases: ${flow.purchased} - Sales: ${flow.sold} = Current: ${flow.current}`}
                              >
                                {stockDisplay}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono font-semibold">
                                <span
                                  className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200"
                                  title={`Total Units Purchased: ${flow.purchased}`}
                                >
                                  +{flow.purchased}
                                </span>
                                <span
                                  className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200"
                                  title={`Total Units Sold: ${flow.sold}`}
                                >
                                  -{flow.sold}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(prod)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                              title="Edit Product"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirmId(prod.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">
                {editingProduct ? 'Edit Product Item' : 'Add New Inventory Product'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Product Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PROD-001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold uppercase focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rice & Grains"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samba Rice 5kg Bag"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 font-bold"
                />
              </div>

              {/* Unit Selection & Compound Unit Conversion */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Primary Unit (UOM) *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white font-bold text-blue-700 focus:border-blue-500"
                    >
                      {STANDARD_SIMPLE_UNITS.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.code} ({u.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 pb-2">
                      <input
                        type="checkbox"
                        checked={formData.hasSecondaryUnit}
                        onChange={(e) => setFormData({ ...formData, hasSecondaryUnit: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span>Enable Alternate Unit</span>
                    </label>
                  </div>
                </div>

                {formData.hasSecondaryUnit && (
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        1 {formData.unit} = Factor (X)
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="e.g. 12"
                        value={formData.conversionFactor}
                        onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                        className="w-full p-2 rounded-xl border border-slate-200 text-xs font-mono font-bold bg-white focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Secondary Unit
                      </label>
                      <select
                        value={formData.secondaryUnit}
                        onChange={(e) => setFormData({ ...formData, secondaryUnit: e.target.value })}
                        className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white font-bold text-slate-800 focus:border-blue-500"
                      >
                        {STANDARD_SIMPLE_UNITS.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.code} ({u.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 text-[11px] font-medium text-blue-900 bg-blue-100/60 p-2 rounded-lg text-center">
                      Conversion Formula: <strong>1 {formData.unit} = {formData.conversionFactor || 1} {formData.secondaryUnit}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Cost / Purchase Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold text-blue-600 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {editingProduct ? 'Current Stock' : 'Initial Stock Qty'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={editingProduct !== null && !canAdjustStock}
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-xs"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Delete Product Item?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure? This item will be removed from your catalog. Past invoices will preserve historic record.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteProduct(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Stock Flow Audit Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Inventory Stock Audit & Formula Flow</h3>
                  <p className="text-xs text-slate-500">
                    Live mathematical formula: <span className="font-mono font-bold text-indigo-700">Current Stock = Opening Stock + Total Purchases (Inward) - Total Sales (Outward)</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerRecalculate}
                  disabled={isRecalculating}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                  <span>{isRecalculating ? 'Recalculating...' : 'Sync & Recalculate Now'}</span>
                </button>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Catalog Items</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{products.length}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Total Units Inward (Purchased)</span>
                  <span className="text-xl font-bold font-mono text-blue-900">
                    +{products.reduce((acc, p) => acc + getProductStockFlow(p).purchased, 0)}
                  </span>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-rose-700 uppercase block">Total Units Outward (Sold)</span>
                  <span className="text-xl font-bold font-mono text-rose-900">
                    -{products.reduce((acc, p) => acc + getProductStockFlow(p).sold, 0)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Physical On-Hand</span>
                  <span className="text-xl font-bold font-mono text-emerald-900">
                    {products.reduce((acc, p) => acc + Number(p.currentStock || 0), 0)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="p-3">Item Code</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-right">Opening Stock</th>
                      <th className="p-3 text-right text-emerald-700">+ Purchases</th>
                      <th className="p-3 text-right text-rose-700">- Sales</th>
                      <th className="p-3 text-right font-black">= Current Stock</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {products.map((p) => {
                      const flow = getProductStockFlow(p);
                      const unit = p.unit || p.primaryUnit || 'Nos';
                      return (
                        <tr key={`audit-${p.id}`} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-900">{p.code}</td>
                          <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                          <td className="p-3 text-right font-mono text-slate-600">{flow.opening} {unit}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50">+{flow.purchased} {unit}</td>
                          <td className="p-3 text-right font-mono font-bold text-rose-700 bg-rose-50/50">-{flow.sold} {unit}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900 bg-slate-50">
                            {flow.current} {unit}
                          </td>
                          <td className="p-3 text-center">
                            {flow.current <= 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Out of Stock</span>
                            ) : flow.current <= p.reorderLevel ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Low Stock</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 text-slate-400" />
                <span>Any created, edited, or voided purchases and sales are immediately synced and audited.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Management Modal */}
      <UnitManagement
        settings={settings}
        isOpen={isUnitManagerOpen}
        onClose={() => setIsUnitManagerOpen(false)}
        showToast={showToast}
      />
    </div>
  );
};
