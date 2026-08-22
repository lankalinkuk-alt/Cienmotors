import React, { useState } from 'react';
import {
  Plus,
  Search,
  ShoppingBag,
  Printer,
  X,
  Trash2,
  CheckCircle2,
  Truck,
  MessageCircle,
  DollarSign,
  Package,
  Edit3
} from 'lucide-react';
import {
  PurchaseInvoice,
  Supplier,
  Product,
  AppSettings,
  PurchaseItem,
  AuthSession,
  Company
} from '../types';
import { checkPermission } from '../lib/permissions';
import { shareInvoiceViaWhatsApp } from '../lib/whatsapp';
import { SearchableSupplierSelect, SearchableProductSelect } from './SearchableSelect';
import { handleEnterKeyNavigation } from '../lib/keyboardNav';
import { WhatsAppMessageModal } from './WhatsAppMessageModal';

interface PurchasesProps {
  purchases: PurchaseInvoice[];
  suppliers: Supplier[];
  products: Product[];
  settings: AppSettings;
  activeCompany?: Company;
  onCreatePurchase: (purchase: Omit<PurchaseInvoice, 'id' | 'purchaseNumber' | 'createdAt'>) => PurchaseInvoice;
  onUpdatePurchase?: (id: string, purchase: Partial<PurchaseInvoice>) => PurchaseInvoice;
  onDeletePurchase?: (id: string) => void;
  onPrintPurchase: (purchase: PurchaseInvoice) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  session?: AuthSession | null;
}

export const Purchases: React.FC<PurchasesProps> = ({
  purchases,
  suppliers,
  products,
  settings,
  activeCompany,
  onCreatePurchase,
  onUpdatePurchase,
  onDeletePurchase,
  onPrintPurchase,
  showToast,
  session
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseInvoice | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [whatsAppModalData, setWhatsAppModalData] = useState<{
    isOpen: boolean;
    purchase: PurchaseInvoice | null;
    phone: string;
    recipientName: string;
  }>({
    isOpen: false,
    purchase: null,
    phone: '',
    recipientName: ''
  });

  const handleOpenWhatsAppModal = (p: PurchaseInvoice) => {
    const supp = suppliers.find((s) => s.id === p.supplierId);
    setWhatsAppModalData({
      isOpen: true,
      purchase: p,
      phone: supp?.phone || '',
      recipientName: p.supplierName || 'Supplier'
    });
  };

  const canAdd = checkPermission(session?.effectivePermissions, 'purchases', 'add');
  const canEdit = checkPermission(session?.effectivePermissions, 'purchases', 'edit');
  const canDelete = checkPermission(session?.effectivePermissions, 'purchases', 'delete');
  const canPrint = checkPermission(session?.effectivePermissions, 'purchases', 'print');

  // Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('Cash Supplier / Spot Purchase');
  const [purchaseType, setPurchaseType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState('0');
  const [paidAmountInput, setPaidAmountInput] = useState('0');
  const [notes, setNotes] = useState('');

  // Items
  const [lineItems, setLineItems] = useState<
    {
      productId: string;
      productCode: string;
      productName: string;
      quantity: string;
      unitCost: string;
      discount: string;
      discountType: 'PERCENT' | 'FIXED';
    }[]
  >([
    {
      productId: '',
      productCode: '',
      productName: '',
      quantity: '1',
      unitCost: '0',
      discount: '0',
      discountType: 'PERCENT'
    }
  ]);

  const handleSupplierSelect = (id: string, name?: string) => {
    setSelectedSupplierId(id);
    if (name) {
      setCustomSupplierName(name);
    }
    setTimeout(() => {
      const firstProductInput = document.getElementById('purchase-product-search-0') as HTMLInputElement | null;
      if (firstProductInput) {
        firstProductInput.focus();
      }
    }, 60);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    const newItems = [...lineItems];
    if (prod) {
      newItems[index] = {
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        quantity: '1',
        unitCost: prod.costPrice.toString(),
        discount: '0',
        discountType: 'PERCENT'
      };
      // Move focus to quantity field for rapid data entry
      setTimeout(() => {
        const qtyInput = document.getElementById(`purchase-qty-input-${index}`) as HTMLInputElement | null;
        if (qtyInput) {
          qtyInput.focus();
          qtyInput.select();
        }
      }, 60);
    } else {
      newItems[index] = {
        productId: '',
        productCode: '',
        productName: '',
        quantity: '1',
        unitCost: '0',
        discount: '0',
        discountType: 'PERCENT'
      };
    }
    setLineItems(newItems);
  };

  const handleItemChange = (
    index: number,
    field: 'quantity' | 'unitCost' | 'discount',
    value: string
  ) => {
    const newItems = [...lineItems];
    newItems[index][field] = value;
    setLineItems(newItems);
  };

  const isItemDiscountEnabled = activeCompany?.isItemDiscountEnabled !== false;
  const defaultDiscountType = activeCompany?.defaultDiscountType || 'PERCENT';

  const handleToggleDiscountType = (index: number) => {
    if (!isItemDiscountEnabled) return;
    const newItems = [...lineItems];
    newItems[index].discountType =
      newItems[index].discountType === 'FIXED' ? 'PERCENT' : 'FIXED';
    setLineItems(newItems);
  };

  const handleAddLine = () => {
    const nextIdx = lineItems.length;
    setLineItems([
      ...lineItems,
      {
        productId: '',
        productCode: '',
        productName: '',
        quantity: '1',
        unitCost: '0',
        discount: '0',
        discountType: defaultDiscountType
      }
    ]);
    setTimeout(() => {
      const nextProductInput = document.getElementById(`purchase-product-search-${nextIdx}`) as HTMLInputElement | null;
      if (nextProductInput) {
        nextProductInput.focus();
      }
    }, 60);
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedItems: PurchaseItem[] = lineItems
    .filter((item) => item.productId !== '')
    .map((item) => {
      const qty = Number(item.quantity || 0);
      const cost = Number(item.unitCost || 0);
      const gross = qty * cost;
      const disc = isItemDiscountEnabled ? Number(item.discount || 0) : 0;
      const discType = item.discountType || defaultDiscountType;
      let itemDiscountAmount = 0;
      if (disc > 0) {
        if (discType === 'PERCENT') {
          itemDiscountAmount = (gross * disc) / 100;
        } else {
          itemDiscountAmount = disc;
        }
      }
      itemDiscountAmount = Math.min(gross, Math.max(0, itemDiscountAmount));
      const lineTotal = Math.max(0, gross - itemDiscountAmount);

      return {
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        quantity: qty,
        unitCost: cost,
        discount: disc,
        discountType: discType,
        total: lineTotal
      };
    });

  const grossSubtotal = lineItems
    .filter((item) => item.productId !== '')
    .reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
      0
    );

  const totalItemDiscountAmount = calculatedItems.reduce((sum, item) => {
    const gross = item.quantity * item.unitCost;
    return sum + (gross - item.total);
  }, 0);

  const itemsTotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);
  const extraDiscountVal = Number(discount || 0);
  const totalDiscount = totalItemDiscountAmount + extraDiscountVal;
  const grandTotal = Math.max(0, itemsTotal - extraDiscountVal);

  const finalPaidAmount =
    purchaseType === 'CASH'
      ? grandTotal
      : Math.min(grandTotal, Number(paidAmountInput || 0));

  const dueAmount = Math.max(0, grandTotal - finalPaidAmount);

  const handleOpenModal = () => {
    setEditingPurchase(null);
    setSelectedSupplierId('');
    setCustomSupplierName('Cash Supplier / Spot Purchase');
    setPurchaseType('CASH');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setDiscount('0');
    setPaidAmountInput('0');
    setNotes('');
    setLineItems([
      {
        productId: '',
        productCode: '',
        productName: '',
        quantity: '1',
        unitCost: '0',
        discount: '0',
        discountType: defaultDiscountType
      }
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pur: PurchaseInvoice) => {
    setEditingPurchase(pur);
    setSelectedSupplierId(pur.supplierId || '');
    setCustomSupplierName(pur.supplierName || 'Cash Supplier / Spot Purchase');
    setPurchaseType(pur.type || 'CASH');
    setPurchaseDate(pur.date || new Date().toISOString().split('T')[0]);
    
    // Calculate extra discount (total discount minus item discounts)
    const itemDiscSum = (pur.items || []).reduce((sum, it) => {
      const gross = (Number(it.quantity) || 0) * (Number(it.unitCost) || 0);
      return sum + Math.max(0, gross - (Number(it.total) || 0));
    }, 0);
    const extraDisc = Math.max(0, (Number(pur.discount) || 0) - itemDiscSum);
    setDiscount(extraDisc > 0 ? String(extraDisc) : '0');

    setPaidAmountInput(String(pur.paidAmount || 0));
    setNotes(pur.notes || '');

    if (pur.items && pur.items.length > 0) {
      setLineItems(
        pur.items.map((item) => ({
          productId: item.productId || '',
          productCode: item.productCode || '',
          productName: item.productName || '',
          quantity: String(item.quantity || 1),
          unitCost: String(item.unitCost || 0),
          discount: String(item.discount || 0),
          discountType: (item.discountType || defaultDiscountType) as 'PERCENT' | 'FIXED'
        }))
      );
    } else {
      setLineItems([
        {
          productId: '',
          productCode: '',
          productName: '',
          quantity: '1',
          unitCost: '0',
          discount: '0',
          discountType: defaultDiscountType
        }
      ]);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (purchaseType === 'CREDIT' && !selectedSupplierId) {
      showToast('error', 'Please select a registered supplier for credit purchases.');
      return;
    }

    if (calculatedItems.length === 0) {
      showToast('error', 'Please select at least one product item.');
      return;
    }

    const supp = selectedSupplierId ? suppliers.find((s) => s.id === selectedSupplierId) : null;
    const supplierNameToUse = supp ? supp.name : (customSupplierName || 'Cash Supplier / Spot Purchase');

    try {
      if (editingPurchase && onUpdatePurchase) {
        const updated = onUpdatePurchase(editingPurchase.id, {
          date: purchaseDate,
          supplierId: selectedSupplierId || undefined,
          supplierName: supplierNameToUse,
          type: purchaseType,
          items: calculatedItems,
          subtotal: grossSubtotal,
          discount: totalDiscount,
          grandTotal,
          paidAmount: finalPaidAmount,
          dueAmount,
          notes
        });

        showToast(
          'success',
          `Purchase ${updated.purchaseNumber} modified successfully! Inventory stock and supplier ledger adjusted.`
        );
        setIsModalOpen(false);
        setEditingPurchase(null);
      } else {
        const newPurchase = onCreatePurchase({
          date: purchaseDate,
          supplierId: selectedSupplierId || undefined,
          supplierName: supplierNameToUse,
          type: purchaseType,
          items: calculatedItems,
          subtotal: grossSubtotal,
          discount: totalDiscount,
          grandTotal,
          paidAmount: finalPaidAmount,
          dueAmount,
          notes
        });

        showToast(
          'success',
          `Purchase ${newPurchase.purchaseNumber} recorded! Stock increased.`
        );
        setIsModalOpen(false);
        onPrintPurchase(newPurchase);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save purchase bill';
      showToast('error', msg);
    }
  };

  // Filtered
  const filteredPurchases = purchases.filter((p) => {
    return (
      p.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Purchases & Stock In</h2>
          <p className="text-xs text-slate-500">
            Record inventory bills from suppliers with automatic stock addition & payables
          </p>
        </div>

        {canAdd && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4 text-yellow-400" />
            <span>Record New Purchase</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search purchase number, supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* Purchases List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No purchase records found.
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200 tracking-wider">
                    <th className="p-4">Purchase No</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 text-right">Payable Due</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-purple-600">{p.purchaseNumber}</td>
                      <td className="p-4 font-bold text-slate-900">{p.supplierName}</td>
                      <td className="p-4 text-xs text-slate-500">{p.date}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            p.type === 'CASH'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.type} PUR
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900">
                        {settings.currencySymbol} {p.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono">
                        {p.dueAmount > 0 ? (
                          <span className="text-rose-600 font-bold">
                            {settings.currencySymbol} {p.dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">PAID</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 ml-auto">
                          {onUpdatePurchase && canEdit && (
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-xl cursor-pointer flex items-center gap-1 text-xs font-bold"
                              title="Modify / Edit Purchase Bill"
                            >
                              <Edit3 className="w-4 h-4 text-blue-600" />
                              <span className="hidden md:inline">Edit</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenWhatsAppModal(p)}
                            className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-xl cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="Modify & Send WhatsApp Message"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                            <span className="hidden md:inline">WhatsApp</span>
                          </button>
                          {canPrint && (
                            <button
                              onClick={() => onPrintPurchase(p)}
                              className="p-1.5 hover:bg-slate-100 text-slate-700 rounded-xl cursor-pointer flex items-center gap-1 text-xs font-bold"
                              title="Print Purchase Bill"
                            >
                              <Printer className="w-4 h-4 text-purple-600" />
                              <span className="hidden md:inline">Print</span>
                            </button>
                          )}
                          {onDeletePurchase && canDelete && (
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-xl cursor-pointer"
                              title="Void Purchase Bill"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredPurchases.map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-purple-600 text-sm">{p.purchaseNumber}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${p.type === 'CASH' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {p.type} PUR
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-slate-900 text-sm">{p.supplierName}</span>
                    <span className="text-xs text-slate-400">{p.date}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                    <div>
                      <div className="text-xs font-bold text-slate-900 font-mono">
                        {settings.currencySymbol} {p.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      {p.dueAmount > 0 && (
                        <div className="text-[10px] text-rose-600 font-bold font-mono">
                          Payable: {settings.currencySymbol} {p.dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onUpdatePurchase && canEdit && (
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                          title="Modify Purchase Bill"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenWhatsAppModal(p)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                        title="Modify & Send WhatsApp Message"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-200" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        onClick={() => onPrintPurchase(p)}
                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                      {onDeletePurchase && canDelete && (
                        <button
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-xl cursor-pointer"
                          title="Void Purchase Bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Void Purchase Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <Trash2 className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-slate-900">Void Purchase Invoice?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              This will remove the purchase bill, adjust supplier payable balances, and reverse the added stock quantity from inventory.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeletePurchase && deleteConfirmId) {
                    onDeletePurchase(deleteConfirmId);
                  }
                  setDeleteConfirmId(null);
                }}
                className="px-5 py-2 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700"
              >
                Yes, Void Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Purchase Modal - Spacious & Easy-to-use Layout */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full p-4 sm:p-6 md:p-8 animate-in fade-in zoom-in-95 my-2 sm:my-6 max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editingPurchase ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                  {editingPurchase ? <Edit3 className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xl sm:text-2xl text-slate-900">
                      {editingPurchase ? `Modify Purchase Bill: ${editingPurchase.purchaseNumber}` : 'Record Purchase Bill'}
                    </h3>
                    {editingPurchase && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Editing Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-normal">
                    {editingPurchase
                      ? 'Update vendor, dates, item details, cost prices, quantities, and payment terms'
                      : 'Receive stock inventory, record vendor costs, item-wise discounts, and update accounts payable'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPurchase(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pt-4 overflow-y-auto flex-1 pr-1">
              {/* Top Row: Supplier, Bill Type, Date */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                {/* Supplier (5 cols) */}
                <div className="md:col-span-5">
                  <SearchableSupplierSelect
                    suppliers={suppliers}
                    selectedSupplierId={selectedSupplierId}
                    customSupplierName={customSupplierName}
                    onSelect={handleSupplierSelect}
                    currencySymbol={settings.currencySymbol}
                    allowSpotSupplier={purchaseType === 'CASH'}
                    required={purchaseType === 'CREDIT'}
                    label="Supplier Vendor"
                    placeholder="Search vendor by name, company, code..."
                  />
                </div>

                {/* Purchase Type (4 cols) */}
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>Payment Term / Bill Type</span>
                    <span className="text-[11px] font-normal text-slate-500 lowercase">
                      {purchaseType === 'CASH' ? 'cash paid out' : 'added to payable ledger'}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 min-h-[42px]">
                    <button
                      type="button"
                      onClick={() => setPurchaseType('CASH')}
                      className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 border shadow-2xs ${
                        purchaseType === 'CASH'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Cash Purchase</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchaseType('CREDIT')}
                      className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 border shadow-2xs ${
                        purchaseType === 'CREDIT'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-purple-200'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>Credit Purchase</span>
                    </button>
                  </div>
                </div>

                {/* Purchase Date (3 cols) */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Bill / GRN Date
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white font-mono font-medium focus:ring-2 focus:ring-purple-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Items Table Container */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800">
                      Stock Items to Receive ({lineItems.length} {lineItems.length === 1 ? 'line' : 'lines'})
                    </h4>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Item discounts support Percentage (<span className="font-mono">%</span>) or Fixed Amount (<span className="font-mono">{settings.currencySymbol}</span>)
                  </span>
                </div>

                {/* Desktop Column Header */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-3 py-2 bg-slate-100/80 rounded-xl text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <div className="col-span-5">Product Item / Barcode</div>
                  <div className="col-span-2 text-center">Received Qty</div>
                  <div className="col-span-2 text-right">Unit Cost ({settings.currencySymbol})</div>
                  <div className="col-span-2 text-right">Discount (% / {settings.currencySymbol})</div>
                  <div className="col-span-1 text-right">Line Total</div>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 p-1">
                  {lineItems.map((item, idx) => {
                    const qty = Number(item.quantity || 0);
                    const cost = Number(item.unitCost || 0);
                    const gross = qty * cost;
                    const disc = Number(item.discount || 0);
                    const discType = item.discountType || 'PERCENT';
                    let discAmt = 0;
                    if (disc > 0) {
                      discAmt = discType === 'PERCENT' ? (gross * disc) / 100 : disc;
                    }
                    discAmt = Math.min(gross, Math.max(0, discAmt));
                    const lineTotal = Math.max(0, gross - discAmt);

                    return (
                      <div
                        key={idx}
                        className="bg-slate-50/90 hover:bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 text-xs flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:items-center transition-colors"
                      >
                        {/* Select Product (5 cols) */}
                        <div className="lg:col-span-5 flex items-center justify-between gap-2">
                          <div className="w-full">
                            <SearchableProductSelect
                              id={`purchase-product-search-${idx}`}
                              products={products}
                              selectedProductId={item.productId}
                              onSelect={(prodId) => handleProductSelect(idx, prodId)}
                              currencySymbol={settings.currencySymbol}
                              priceType="COST"
                              placeholder="Search item name, code, barcode..."
                            />
                          </div>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lineItems.length === 1}
                            className="lg:hidden text-rose-500 p-2 hover:bg-rose-50 rounded-lg shrink-0 disabled:opacity-30"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Qty (2 cols) */}
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 lg:hidden uppercase mb-1">Received Qty</label>
                          <input
                            id={`purchase-qty-input-${idx}`}
                            type="number"
                            min="1"
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            onKeyDown={(e) => handleEnterKeyNavigation(e)}
                            className="w-full min-h-[38px] p-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-center text-sm focus:ring-2 focus:ring-purple-500 outline-hidden"
                          />
                        </div>

                        {/* Unit Cost (2 cols) */}
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 lg:hidden uppercase mb-1">Unit Cost ({settings.currencySymbol})</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.unitCost}
                            onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (!isItemDiscountEnabled) {
                                  e.preventDefault();
                                  if (idx < lineItems.length - 1) {
                                    const nextInput = document.getElementById(`purchase-product-search-${idx + 1}`) as HTMLInputElement | null;
                                    if (nextInput) nextInput.focus();
                                  } else {
                                    handleAddLine();
                                  }
                                } else {
                                  handleEnterKeyNavigation(e);
                                }
                              }
                            }}
                            className="w-full min-h-[38px] p-2 rounded-xl border border-slate-200 bg-white font-mono text-right text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-hidden"
                          />
                        </div>

                        {/* Item Discount (2 cols) */}
                        <div className="lg:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 lg:hidden uppercase mb-1">Item Discount</label>
                          <div className={`flex rounded-xl border border-slate-200 overflow-hidden min-h-[38px] ${
                            isItemDiscountEnabled ? 'bg-white focus-within:ring-2 focus-within:ring-purple-500' : 'bg-slate-100 opacity-60'
                          }`}>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder={isItemDiscountEnabled ? "0" : "Disabled"}
                              disabled={!isItemDiscountEnabled}
                              value={isItemDiscountEnabled ? item.discount : '0'}
                              onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (idx < lineItems.length - 1) {
                                    const nextInput = document.getElementById(`purchase-product-search-${idx + 1}`) as HTMLInputElement | null;
                                    if (nextInput) nextInput.focus();
                                  } else {
                                    handleAddLine();
                                  }
                                }
                              }}
                              className="w-full p-2 text-right font-mono text-xs font-semibold outline-hidden disabled:cursor-not-allowed"
                              title={isItemDiscountEnabled ? "Item discount value" : "Item discount disabled in Company Configuration"}
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => handleToggleDiscountType(idx)}
                              disabled={!isItemDiscountEnabled}
                              className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border-l border-slate-200 shrink-0 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={
                                isItemDiscountEnabled
                                  ? `Switch discount type: ${item.discountType === 'FIXED' ? 'Fixed Currency' : 'Percentage (%)'}`
                                  : 'Item discount disabled in Company Configuration'
                              }
                            >
                              {item.discountType === 'FIXED' ? settings.currencySymbol : '%'}
                            </button>
                          </div>
                        </div>

                        {/* Line Total & Desktop Delete (1 col) */}
                        <div className="lg:col-span-1 flex items-center justify-between lg:justify-end gap-2">
                          <div className="text-right">
                            <label className="block text-[10px] font-bold text-slate-500 lg:hidden uppercase mb-0.5">Line Total</label>
                            <span className="font-mono font-bold text-sm text-slate-900">
                              {lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleRemoveLine(idx)}
                            disabled={lineItems.length === 1}
                            className="hidden lg:flex p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Item Line Button */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 cursor-pointer border border-purple-200/80 shadow-2xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Product Line</span>
                  </button>

                  <span className="text-xs text-slate-500 font-mono">
                    Total Items Count: {calculatedItems.length}
                  </span>
                </div>
              </div>

              {/* Totals & Notes Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 border-t border-slate-200 pt-5">
                {/* Notes & Terms (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Purchase Notes & Vendor Invoice / GRN Reference
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Supplier invoice number, batch details, delivery notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500 outline-hidden"
                    />
                  </div>

                  {purchaseType === 'CREDIT' && (
                    <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-purple-900 uppercase block flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-purple-600" />
                        <span>Supplier Credit Terms Quick Settlement</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setPaidAmountInput('0')}
                          className="px-3 py-1.5 bg-white border border-purple-300 font-bold text-purple-800 rounded-lg hover:bg-purple-100 cursor-pointer shadow-2xs"
                        >
                          Zero Advance (Full Credit Payable)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaidAmountInput(grandTotal.toString())}
                          className="px-3 py-1.5 bg-white border border-purple-300 font-bold text-purple-800 rounded-lg hover:bg-purple-100 cursor-pointer shadow-2xs"
                        >
                          Full Paid Now ({settings.currencySymbol}{grandTotal.toLocaleString('en-US')})
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Financial Summary Card (5 cols) */}
                <div className="lg:col-span-5 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2.5 text-xs font-mono shadow-2xs">
                  <div className="flex justify-between text-slate-600 text-sm">
                    <span className="font-sans font-medium">Gross Subtotal:</span>
                    <span className="font-bold">
                      {settings.currencySymbol} {grossSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {totalItemDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold text-sm">
                      <span className="font-sans">Item Discounts:</span>
                      <span>
                        - {settings.currencySymbol} {totalItemDiscountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 py-1">
                    <span className="font-sans text-slate-600 text-sm">Extra Vendor Discount:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-mono text-xs">{settings.currencySymbol}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="w-32 p-1.5 rounded-lg border border-slate-300 bg-white text-right font-mono font-bold text-rose-600 text-sm focus:ring-2 focus:ring-rose-400 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-lg font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span className="font-sans font-bold">Grand Total:</span>
                    <span className="text-purple-700">
                      {settings.currencySymbol} {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {purchaseType === 'CREDIT' && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <span className="font-sans font-bold text-slate-700 text-sm">Initial Paid Amount:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-mono text-xs">{settings.currencySymbol}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={paidAmountInput}
                          onChange={(e) => setPaidAmountInput(e.target.value)}
                          className="w-32 p-1.5 rounded-lg border border-slate-300 bg-white text-right font-mono font-bold text-emerald-600 text-sm focus:ring-2 focus:ring-emerald-400 outline-hidden"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200">
                    <span className="font-sans">Net Payable Due:</span>
                    <span className={`text-base font-mono ${dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {settings.currencySymbol} {dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingPurchase(null);
                  }}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
                    editingPurchase
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                      : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                  <span>{editingPurchase ? 'Update Purchase Bill' : 'Confirm & Save Purchase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Message Customization & Preview Modal */}
      {whatsAppModalData.isOpen && whatsAppModalData.purchase && (
        <WhatsAppMessageModal
          isOpen={whatsAppModalData.isOpen}
          onClose={() => setWhatsAppModalData((prev) => ({ ...prev, isOpen: false }))}
          title={`Modify WhatsApp Message: ${whatsAppModalData.purchase.purchaseNumber}`}
          recipientName={whatsAppModalData.recipientName}
          defaultPhone={whatsAppModalData.phone}
          invoice={whatsAppModalData.purchase}
          isPurchase={true}
          settings={settings}
          showToast={showToast}
        />
      )}
    </div>
  );
};
