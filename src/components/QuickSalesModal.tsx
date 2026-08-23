import React, { useState } from 'react';
import { ShoppingCart, X, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Customer, Product, AppSettings, Company, SaleItem } from '../types';
import { StorageService } from '../lib/storage';

interface QuickSalesModalProps {
  customers: Customer[];
  products: Product[];
  settings: AppSettings;
  company?: Company;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const QuickSalesModal: React.FC<QuickSalesModalProps> = ({
  customers,
  products,
  settings,
  company,
  onClose,
  onSuccess,
  onError
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Item row draft
  const [selectedProdId, setSelectedProdId] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleSelectProduct = (prodId: string) => {
    setSelectedProdId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setUnitPrice(prod.sellingPrice);
    }
  };

  const handleAddItem = () => {
    if (!selectedProdId) return;
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod) return;

    const newItem: SaleItem = {
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      quantity: Number(qty) || 1,
      unitPrice: Number(unitPrice) || prod.sellingPrice,
      total: (Number(qty) || 1) * (Number(unitPrice) || prod.sellingPrice)
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedProdId('');
    setQty(1);
    setUnitPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = subtotal;

  const handleSave = async () => {
    if (!selectedCustomer) {
      onError('Please select a valid customer.');
      return;
    }
    if (items.length === 0) {
      onError('Please add at least one item to the invoice.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await StorageService.createSaleInvoiceAsync({
        companyId: company?.id || 'comp-1',
        date,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        type: paymentType === 'CREDIT' ? 'CREDIT' : 'CASH',
        items,
        subtotal,
        discount: 0,
        grandTotal,
        paidAmount: paymentType === 'CREDIT' ? 0 : (paidAmount > 0 ? paidAmount : grandTotal),
        dueAmount: paymentType === 'CREDIT' ? grandTotal : Math.max(0, grandTotal - paidAmount),
        notes
      });

      if (res.success && res.data) {
        onSuccess(`Quick Sales Invoice ${res.data.invoiceNumber} created successfully!`);
        onClose();
      } else {
        onError(res.error || 'Failed to save sales invoice.');
      }
    } catch (err: any) {
      onError(err.message || 'An unexpected error occurred while saving invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#2563EB] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-400 text-blue-900 font-bold rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Quick Sales Invoice (Ctrl + F8)</h3>
              <p className="text-xs text-blue-100">Create new sales invoice without navigating away</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) - Bal: {settings.currencySymbol} {c.outstandingBalance || 0}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Add Item Row */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <p className="font-bold text-xs uppercase tracking-wider text-slate-500">Add Item</p>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-6">
                <select
                  value={selectedProdId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="">Select Item / Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) - Stock: {p.currentStock} - {settings.currencySymbol} {p.sellingPrice}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  placeholder="Qty"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-center"
                />
              </div>

              <div className="sm:col-span-3">
                <input
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  placeholder="Rate"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-right"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProdId}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg flex items-center justify-center disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Price</th>
                  <th className="p-2.5 text-right">Total</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                      No items added yet. Select a product above to add.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-800">{it.productName}</td>
                      <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                      <td className="p-2.5 text-right">{settings.currencySymbol} {it.unitPrice.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">{settings.currencySymbol} {it.total.toFixed(2)}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as any)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CREDIT">Credit Sale</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount Paid ({settings.currencySymbol})</label>
              <input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                disabled={paymentType === 'CREDIT'}
                placeholder={grandTotal.toString()}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Grand Total</span>
            <span className="text-xl font-black text-blue-600 font-mono">
              {settings.currencySymbol} {grandTotal.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting || items.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Invoice (F2)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
