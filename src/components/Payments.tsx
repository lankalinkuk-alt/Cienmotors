import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  DollarSign,
  User,
  Truck,
  CheckCircle2,
  Calendar,
  Trash2,
  AlertTriangle,
  FileText,
  Printer,
  Sparkles,
  RotateCcw,
  Layers,
  ChevronRight,
  Eye,
  X,
  Check
} from 'lucide-react';
import {
  CustomerReceipt,
  SupplierPayment,
  Expense,
  Customer,
  Supplier,
  SaleInvoice,
  PurchaseInvoice,
  AppSettings,
  InvoiceAllocation,
  BillAllocation,
  AuthSession
} from '../types';
import { checkPermission } from '../lib/permissions';
import { SearchableCustomerSelect, SearchableSupplierSelect } from './SearchableSelect';

interface PaymentsProps {
  receipts: CustomerReceipt[];
  payments: SupplierPayment[];
  expenses: Expense[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: SaleInvoice[];
  purchases: PurchaseInvoice[];
  settings: AppSettings;
  onCreateReceipt: (receipt: Omit<CustomerReceipt, 'id' | 'receiptNumber' | 'createdAt'>) => CustomerReceipt;
  onDeleteReceipt?: (id: string) => void;
  onCreatePayment: (payment: Omit<SupplierPayment, 'id' | 'paymentNumber' | 'createdAt'>) => SupplierPayment;
  onDeletePayment?: (id: string) => void;
  onCreateExpense: (expense: Omit<Expense, 'id' | 'expenseNumber' | 'createdAt'>) => Expense;
  onDeleteExpense?: (id: string) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  session?: AuthSession | null;
}

export const Payments: React.FC<PaymentsProps> = ({
  receipts,
  payments,
  expenses,
  customers,
  suppliers,
  sales,
  purchases,
  settings,
  onCreateReceipt,
  onDeleteReceipt,
  onCreatePayment,
  onDeletePayment,
  onCreateExpense,
  onDeleteExpense,
  showToast,
  session
}) => {
  const [activeTab, setActiveTab] = useState<'RECEIPTS' | 'PAYMENTS' | 'EXPENSES'>('RECEIPTS');

  const canAddReceipt = checkPermission(session?.effectivePermissions, 'customer_receipts', 'add');
  const canDeleteReceipt = checkPermission(session?.effectivePermissions, 'customer_receipts', 'delete');
  const canAddPayment = checkPermission(session?.effectivePermissions, 'supplier_payments', 'add');
  const canDeletePayment = checkPermission(session?.effectivePermissions, 'supplier_payments', 'delete');
  const canAddExpense = checkPermission(session?.effectivePermissions, 'expenses', 'add');
  const canDeleteExpense = checkPermission(session?.effectivePermissions, 'expenses', 'delete');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: 'RECEIPT' | 'PAYMENT' | 'EXPENSE';
  } | null>(null);

  // Voucher Print / View Modal
  const [viewVoucher, setViewVoucher] = useState<{
    type: 'RECEIPT' | 'PAYMENT';
    data: CustomerReceipt | SupplierPayment;
  } | null>(null);

  // --- Customer Receipt Modal State ---
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptCustomerId, setReceiptCustomerId] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMode, setReceiptMode] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  // Map of invoiceId -> allocated amount string/number
  const [invoiceAllocations, setInvoiceAllocations] = useState<Record<string, number>>({});

  // --- Supplier Payment Modal State ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  // Map of purchaseId -> allocated amount string/number
  const [billAllocations, setBillAllocations] = useState<Record<string, number>>({});

  // --- Expense Modal State ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Electricity / Utilities');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidTo, setExpensePaidTo] = useState('');
  const [expenseMode, setExpenseMode] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Pending Sales for selected customer in Receipt modal
  const customerPendingSales = React.useMemo(() => {
    if (!receiptCustomerId) return [];
    return sales
      .filter((s) => s.customerId === receiptCustomerId && s.dueAmount > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sales, receiptCustomerId]);

  // Total allocated for customer receipt
  const totalReceiptAllocated = React.useMemo(() => {
    return Object.values(invoiceAllocations).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
  }, [invoiceAllocations]);

  // Selected customer object
  const selectedCustomerObj = customers.find((c) => c.id === receiptCustomerId);

  // When customer changes in Receipt modal, reset allocations
  const handleReceiptCustomerChange = (custId: string) => {
    setReceiptCustomerId(custId);
    setInvoiceAllocations({});
  };

  // Auto Allocate FIFO for Customer Receipt
  const handleAutoAllocateReceiptFIFO = () => {
    const total = Number(receiptAmount) || 0;
    if (total <= 0) {
      showToast('error', 'Enter a receipt amount first to auto-allocate.');
      return;
    }
    let remainingToAllocate = total;
    const newAllocations: Record<string, number> = {};

    for (const inv of customerPendingSales) {
      if (remainingToAllocate <= 0) break;
      const alloc = Math.min(remainingToAllocate, inv.dueAmount);
      newAllocations[inv.id] = Number(alloc.toFixed(2));
      remainingToAllocate = Number((remainingToAllocate - alloc).toFixed(2));
    }

    setInvoiceAllocations(newAllocations);
    showToast('info', 'Auto-allocated receipt amount across previous bills in chronological FIFO order.');
  };

  const handleSettleFullInvoice = (invoiceId: string, dueAmount: number) => {
    setInvoiceAllocations((prev) => {
      const current = prev[invoiceId] || 0;
      // Toggle full settle or zero
      const newVal = current === dueAmount ? 0 : dueAmount;
      return { ...prev, [invoiceId]: newVal };
    });
  };

  const handleSetInvoiceAlloc = (invoiceId: string, val: string, maxDue: number) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setInvoiceAllocations((prev) => {
        const next = { ...prev };
        delete next[invoiceId];
        return next;
      });
    } else {
      const capped = Math.min(num, maxDue);
      setInvoiceAllocations((prev) => ({
        ...prev,
        [invoiceId]: Number(capped.toFixed(2))
      }));
    }
  };

  const handleSyncReceiptAmountFromAllocations = () => {
    if (totalReceiptAllocated > 0) {
      setReceiptAmount(totalReceiptAllocated.toFixed(2));
    }
  };

  // Pending Purchases for selected supplier in Payment modal
  const supplierPendingPurchases = React.useMemo(() => {
    if (!paymentSupplierId) return [];
    return purchases
      .filter((p) => p.supplierId === paymentSupplierId && p.dueAmount > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [purchases, paymentSupplierId]);

  // Total allocated for supplier payment
  const totalPaymentAllocated = React.useMemo(() => {
    return Object.values(billAllocations).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
  }, [billAllocations]);

  // Selected supplier object
  const selectedSupplierObj = suppliers.find((s) => s.id === paymentSupplierId);

  // When supplier changes in Payment modal, reset allocations
  const handlePaymentSupplierChange = (suppId: string) => {
    setPaymentSupplierId(suppId);
    setBillAllocations({});
  };

  // Auto Allocate FIFO for Supplier Payment
  const handleAutoAllocatePaymentFIFO = () => {
    const total = Number(paymentAmount) || 0;
    if (total <= 0) {
      showToast('error', 'Enter a payment amount first to auto-allocate.');
      return;
    }
    let remainingToAllocate = total;
    const newAllocations: Record<string, number> = {};

    for (const pur of supplierPendingPurchases) {
      if (remainingToAllocate <= 0) break;
      const alloc = Math.min(remainingToAllocate, pur.dueAmount);
      newAllocations[pur.id] = Number(alloc.toFixed(2));
      remainingToAllocate = Number((remainingToAllocate - alloc).toFixed(2));
    }

    setBillAllocations(newAllocations);
    showToast('info', 'Auto-allocated payment amount across previous bills in chronological FIFO order.');
  };

  const handleSettleFullPurchase = (purchaseId: string, dueAmount: number) => {
    setBillAllocations((prev) => {
      const current = prev[purchaseId] || 0;
      const newVal = current === dueAmount ? 0 : dueAmount;
      return { ...prev, [purchaseId]: newVal };
    });
  };

  const handleSetPurchaseAlloc = (purchaseId: string, val: string, maxDue: number) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setBillAllocations((prev) => {
        const next = { ...prev };
        delete next[purchaseId];
        return next;
      });
    } else {
      const capped = Math.min(num, maxDue);
      setBillAllocations((prev) => ({
        ...prev,
        [purchaseId]: Number(capped.toFixed(2))
      }));
    }
  };

  const handleSyncPaymentAmountFromAllocations = () => {
    if (totalPaymentAllocated > 0) {
      setPaymentAmount(totalPaymentAllocated.toFixed(2));
    }
  };

  // Handlers
  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptCustomerId) {
      showToast('error', 'Select a customer.');
      return;
    }

    let amt = Number(receiptAmount);
    if ((!amt || amt <= 0) && totalReceiptAllocated > 0) {
      amt = totalReceiptAllocated;
      setReceiptAmount(amt.toFixed(2));
    }

    if (!amt || amt <= 0) {
      showToast('error', 'Enter a valid receipt amount.');
      return;
    }

    if (totalReceiptAllocated > amt) {
      showToast('error', `Total bill allocation (${settings.currencySymbol}${totalReceiptAllocated}) cannot exceed receipt amount (${settings.currencySymbol}${amt}).`);
      return;
    }

    const cust = customers.find((c) => c.id === receiptCustomerId);

    // Build structured allocations
    const allocations: InvoiceAllocation[] = [];
    for (const [invId, rawAmt] of Object.entries(invoiceAllocations)) {
      const allocAmt = Number(rawAmt) || 0;
      if (allocAmt > 0) {
        const inv = sales.find((s) => s.id === invId);
        if (inv) {
          allocations.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.date,
            originalGrandTotal: inv.grandTotal,
            priorPaid: inv.paidAmount,
            priorDue: inv.dueAmount,
            allocatedAmount: allocAmt,
            remainingDueAfter: Math.max(0, Number((inv.dueAmount - allocAmt).toFixed(2)))
          });
        }
      }
    }

    const unallocated = Math.max(0, Number((amt - totalReceiptAllocated).toFixed(2)));

    const rec = onCreateReceipt({
      date: new Date().toISOString().split('T')[0],
      customerId: receiptCustomerId,
      customerName: cust ? cust.name : 'Customer',
      amount: amt,
      paymentMode: receiptMode,
      referenceNo: receiptRef,
      notes: receiptNotes,
      allocations: allocations.length > 0 ? allocations : undefined,
      unallocatedAmount: unallocated > 0 ? unallocated : undefined
    });

    const allocText = allocations.length > 0 ? ` & adjusted ${allocations.length} previous bill(s)` : '';
    showToast('success', `Receipt ${rec.receiptNumber} recorded! Customer balance updated${allocText}.`);
    setIsReceiptModalOpen(false);
    setInvoiceAllocations({});
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplierId) {
      showToast('error', 'Select a supplier.');
      return;
    }

    let amt = Number(paymentAmount);
    if ((!amt || amt <= 0) && totalPaymentAllocated > 0) {
      amt = totalPaymentAllocated;
      setPaymentAmount(amt.toFixed(2));
    }

    if (!amt || amt <= 0) {
      showToast('error', 'Enter a valid payment amount.');
      return;
    }

    if (totalPaymentAllocated > amt) {
      showToast('error', `Total bill allocation (${settings.currencySymbol}${totalPaymentAllocated}) cannot exceed payment amount (${settings.currencySymbol}${amt}).`);
      return;
    }

    const supp = suppliers.find((s) => s.id === paymentSupplierId);

    // Build structured allocations
    const allocations: BillAllocation[] = [];
    for (const [purId, rawAmt] of Object.entries(billAllocations)) {
      const allocAmt = Number(rawAmt) || 0;
      if (allocAmt > 0) {
        const pur = purchases.find((p) => p.id === purId);
        if (pur) {
          allocations.push({
            purchaseId: pur.id,
            purchaseNumber: pur.purchaseNumber,
            purchaseDate: pur.date,
            originalGrandTotal: pur.grandTotal,
            priorPaid: pur.paidAmount,
            priorDue: pur.dueAmount,
            allocatedAmount: allocAmt,
            remainingDueAfter: Math.max(0, Number((pur.dueAmount - allocAmt).toFixed(2)))
          });
        }
      }
    }

    const unallocated = Math.max(0, Number((amt - totalPaymentAllocated).toFixed(2)));

    const pay = onCreatePayment({
      date: new Date().toISOString().split('T')[0],
      supplierId: paymentSupplierId,
      supplierName: supp ? supp.name : 'Supplier',
      amount: amt,
      paymentMode: paymentMode,
      referenceNo: paymentRef,
      notes: paymentNotes,
      allocations: allocations.length > 0 ? allocations : undefined,
      unallocatedAmount: unallocated > 0 ? unallocated : undefined
    });

    const allocText = allocations.length > 0 ? ` & adjusted ${allocations.length} previous bill(s)` : '';
    showToast('success', `Payment ${pay.paymentNumber} recorded! Supplier payable updated${allocText}.`);
    setIsPaymentModalOpen(false);
    setBillAllocations({});
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount);
    if (!amt || amt <= 0) {
      showToast('error', 'Enter a valid expense amount.');
      return;
    }

    const exp = onCreateExpense({
      date: new Date().toISOString().split('T')[0],
      category: expenseCategory,
      amount: amt,
      paidTo: expensePaidTo,
      paymentMode: expenseMode,
      notes: expenseNotes
    });

    showToast('success', `Expense ${exp.expenseNumber} logged! Cash balance updated.`);
    setIsExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payments & Cash Desk</h2>
          <p className="text-xs text-slate-500">
            Customer Receipts with Bill-by-Bill Adjustment, Supplier Payments, and Business Expense entries
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-new-receipt"
            onClick={() => {
              setReceiptCustomerId(customers[0]?.id || '');
              setReceiptAmount('');
              setInvoiceAllocations({});
              setIsReceiptModalOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs cursor-pointer transition-all"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-200" />
            <span>+ Customer Receipt</span>
          </button>

          <button
            id="btn-new-payment"
            onClick={() => {
              setPaymentSupplierId(suppliers[0]?.id || '');
              setPaymentAmount('');
              setBillAllocations({});
              setIsPaymentModalOpen(true);
            }}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs cursor-pointer transition-all"
          >
            <ArrowUpRight className="w-4 h-4 text-purple-200" />
            <span>+ Supplier Payment</span>
          </button>

          <button
            id="btn-new-expense"
            onClick={() => {
              setExpenseAmount('');
              setIsExpenseModalOpen(true);
            }}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs cursor-pointer transition-all"
          >
            <TrendingDown className="w-4 h-4 text-rose-200" />
            <span>+ Expense Entry</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-3 rounded-2xl border shadow-xs gap-2">
        <button
          onClick={() => setActiveTab('RECEIPTS')}
          className={`pb-3 px-4 font-bold text-sm cursor-pointer flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'RECEIPTS'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Customer Receipts ({receipts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`pb-3 px-4 font-bold text-sm cursor-pointer flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'PAYMENTS'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Supplier Payments ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`pb-3 px-4 font-bold text-sm cursor-pointer flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'EXPENSES'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Expense Logs ({expenses.length})</span>
        </button>
      </div>

      {/* Tab 1: Receipts List */}
      {activeTab === 'RECEIPTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {receipts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No customer receipt records yet. Click '+ Customer Receipt' above to log payments and adjust against previous bills.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                    <th className="p-4">Receipt No</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Adjusted Bills</th>
                    <th className="p-4">Payment Mode</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4 text-right">Amount Received</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-emerald-600">{r.receiptNumber}</td>
                      <td className="p-4 font-bold text-slate-900">{r.customerName}</td>
                      <td className="p-4 text-xs text-slate-500">{r.date}</td>
                      <td className="p-4">
                        {r.allocations && r.allocations.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold text-[11px] px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {r.allocations.length} Bill{r.allocations.length > 1 ? 's' : ''} Adjusted
                            </span>
                            {r.unallocatedAmount && r.unallocatedAmount > 0 ? (
                              <span className="text-[10px] text-amber-700 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                +{settings.currencySymbol}{r.unallocatedAmount} Advance
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">On-Account / General</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs font-bold">{r.paymentMode}</td>
                      <td className="p-4 text-xs text-slate-500 font-mono">{r.referenceNo || '-'}</td>
                      <td className="p-4 text-right font-mono font-black text-emerald-600">
                        +{settings.currencySymbol} {r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewVoucher({ type: 'RECEIPT', data: r })}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-blue-600 rounded-lg cursor-pointer"
                            title="View / Print Receipt Voucher"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onDeleteReceipt && (
                            <button
                              onClick={() => setDeleteConfirm({ id: r.id, type: 'RECEIPT' })}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                              title="Void Receipt"
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
          )}
        </div>
      )}

      {/* Tab 2: Supplier Payments List */}
      {activeTab === 'PAYMENTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No supplier payment records yet. Click '+ Supplier Payment' above to record vendor settlements.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                    <th className="p-4">Payment No</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Adjusted Bills</th>
                    <th className="p-4">Payment Mode</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4 text-right">Amount Paid</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-purple-600">{p.paymentNumber}</td>
                      <td className="p-4 font-bold text-slate-900">{p.supplierName}</td>
                      <td className="p-4 text-xs text-slate-500">{p.date}</td>
                      <td className="p-4">
                        {p.allocations && p.allocations.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 font-bold text-[11px] px-2 py-0.5 rounded-md border border-purple-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {p.allocations.length} Bill{p.allocations.length > 1 ? 's' : ''} Adjusted
                            </span>
                            {p.unallocatedAmount && p.unallocatedAmount > 0 ? (
                              <span className="text-[10px] text-amber-700 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                +{settings.currencySymbol}{p.unallocatedAmount} Advance
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">On-Account / General</span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs font-bold">{p.paymentMode}</td>
                      <td className="p-4 text-xs text-slate-500 font-mono">{p.referenceNo || '-'}</td>
                      <td className="p-4 text-right font-mono font-black text-slate-900">
                        -{settings.currencySymbol} {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewVoucher({ type: 'PAYMENT', data: p })}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-purple-600 rounded-lg cursor-pointer"
                            title="View / Print Payment Voucher"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onDeletePayment && (
                            <button
                              onClick={() => setDeleteConfirm({ id: p.id, type: 'PAYMENT' })}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                              title="Void Payment"
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
          )}
        </div>
      )}

      {/* Tab 3: Expenses List */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No expense entries recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                    <th className="p-4">Expense No</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Paid To</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Mode</th>
                    <th className="p-4 text-right">Expense Amount</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80">
                      <td className="p-4 font-mono font-bold text-rose-600">{e.expenseNumber}</td>
                      <td className="p-4 font-bold text-slate-900">{e.category}</td>
                      <td className="p-4 text-xs text-slate-600">{e.paidTo || '-'}</td>
                      <td className="p-4 text-xs text-slate-500">{e.date}</td>
                      <td className="p-4 font-mono text-xs font-bold">{e.paymentMode}</td>
                      <td className="p-4 text-right font-mono font-black text-rose-600">
                        -{settings.currencySymbol} {e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        {onDeleteExpense && (
                          <button
                            onClick={() => setDeleteConfirm({ id: e.id, type: 'EXPENSE' })}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                            title="Delete Expense Log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER RECEIPT MODAL (WITH PREVIOUS BILLS ADJUSTMENT) */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 my-8 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <span>Record Customer Receipt</span>
                  <p className="text-xs text-slate-500 font-normal">Receive payment and adjust against outstanding bills</p>
                </div>
              </h3>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="space-y-4 overflow-y-auto pt-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <SearchableCustomerSelect
                    customers={customers}
                    selectedCustomerId={receiptCustomerId}
                    onSelect={(id) => handleReceiptCustomerChange(id)}
                    currencySymbol={settings.currencySymbol}
                    allowWalkIn={false}
                    required={true}
                    label="Customer"
                    placeholder="Search customer by name, code, phone..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Receipt Amount ({settings.currencySymbol}) *
                    </label>
                    {totalReceiptAllocated > 0 && (
                      <button
                        type="button"
                        onClick={handleSyncReceiptAmountFromAllocations}
                        className="text-[11px] text-emerald-600 font-bold hover:underline"
                      >
                        Set to Allocated ({settings.currencySymbol}{totalReceiptAllocated})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={receiptAmount}
                    onChange={(e) => setReceiptAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Customer Balance Summary Pill */}
              {selectedCustomerObj && (
                <div className="flex flex-wrap items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                  <div>
                    <span className="text-slate-500">Customer Total Outstanding: </span>
                    <span className="font-bold font-mono text-slate-900 ml-1">
                      {settings.currencySymbol} {selectedCustomerObj.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Unsettled Credit Invoices: </span>
                    <span className="font-bold text-emerald-700 ml-1">
                      {customerPendingSales.length} Bill{customerPendingSales.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )}

              {/* Previous Bills Allocation Section */}
              {receiptCustomerId && (
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Previous Invoices to Adjust
                      </span>
                    </div>

                    {customerPendingSales.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAutoAllocateReceiptFIFO}
                          className="flex items-center gap-1 text-[11px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>Auto-Allocate (FIFO)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceAllocations({})}
                          className="flex items-center gap-1 text-[11px] text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {customerPendingSales.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 italic bg-white rounded-xl border border-slate-100 p-3">
                      No unpaid credit bills found for this customer. Payment will be recorded as general on-account advance.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                            <th className="p-2">Bill No & Date</th>
                            <th className="p-2 text-right">Bill Total</th>
                            <th className="p-2 text-right">Already Paid</th>
                            <th className="p-2 text-right">Current Due</th>
                            <th className="p-2 text-right w-36">Settle Amount</th>
                            <th className="p-2 text-center w-16">Quick</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {customerPendingSales.map((inv) => {
                            const allocVal = invoiceAllocations[inv.id] || '';
                            const isFullySettled = Number(allocVal) === inv.dueAmount;
                            return (
                              <tr key={inv.id} className="hover:bg-slate-50">
                                <td className="p-2">
                                  <div className="font-mono font-bold text-blue-600">{inv.invoiceNumber}</div>
                                  <div className="text-[10px] text-slate-400">{inv.date}</div>
                                </td>
                                <td className="p-2 text-right font-mono text-slate-700">
                                  {settings.currencySymbol}{inv.grandTotal.toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-500">
                                  {settings.currencySymbol}{inv.paidAmount.toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-amber-700">
                                  {settings.currencySymbol}{inv.dueAmount.toFixed(2)}
                                </td>
                                <td className="p-2 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    max={inv.dueAmount}
                                    step="0.01"
                                    placeholder="0.00"
                                    value={allocVal}
                                    onChange={(e) => handleSetInvoiceAlloc(inv.id, e.target.value, inv.dueAmount)}
                                    className="w-full text-right p-1.5 rounded-lg border border-slate-300 font-mono font-bold text-emerald-700 text-xs focus:ring-1 focus:ring-emerald-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleSettleFullInvoice(inv.id, inv.dueAmount)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                      isFullySettled
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                    }`}
                                    title="Settle Full Bill Amount"
                                  >
                                    {isFullySettled ? 'Full ✓' : 'Full'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Allocation summary status */}
                  {customerPendingSales.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs gap-2">
                      <div>
                        <span className="text-slate-500">Allocated to Bills: </span>
                        <span className="font-bold font-mono text-emerald-700">
                          {settings.currencySymbol} {totalReceiptAllocated.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        {Number(receiptAmount) > 0 ? (
                          Number(receiptAmount) >= totalReceiptAllocated ? (
                            <span className="text-slate-600">
                              Unallocated (Advance):{' '}
                              <strong className="font-mono text-slate-900">
                                {settings.currencySymbol} {(Number(receiptAmount) - totalReceiptAllocated).toFixed(2)}
                              </strong>
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Allocated exceeds receipt amount by {settings.currencySymbol}{(totalReceiptAllocated - Number(receiptAmount)).toFixed(2)}
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={receiptMode}
                    onChange={(e) => setReceiptMode(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reference / Cheque No
                  </label>
                  <input
                    type="text"
                    placeholder="Ref / Chq #"
                    value={receiptRef}
                    onChange={(e) => setReceiptRef(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Additional memo or remarks..."
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 font-bold text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Receipt & Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER PAYMENT MODAL (WITH PREVIOUS BILLS ADJUSTMENT) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 my-8 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <span>Record Supplier Payment</span>
                  <p className="text-xs text-slate-500 font-normal">Pay vendor and settle against previous purchase bills</p>
                </div>
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4 overflow-y-auto pt-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <SearchableSupplierSelect
                    suppliers={suppliers}
                    selectedSupplierId={paymentSupplierId}
                    onSelect={(id) => handlePaymentSupplierChange(id)}
                    currencySymbol={settings.currencySymbol}
                    required={true}
                    label="Supplier"
                    placeholder="Search supplier by name, company, code..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Payment Amount ({settings.currencySymbol}) *
                    </label>
                    {totalPaymentAllocated > 0 && (
                      <button
                        type="button"
                        onClick={handleSyncPaymentAmountFromAllocations}
                        className="text-[11px] text-purple-600 font-bold hover:underline"
                      >
                        Set to Allocated ({settings.currencySymbol}{totalPaymentAllocated})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold text-purple-600 focus:ring-2 focus:ring-purple-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Supplier Balance Summary Pill */}
              {selectedSupplierObj && (
                <div className="flex flex-wrap items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                  <div>
                    <span className="text-slate-500">Total Vendor Payable: </span>
                    <span className="font-bold font-mono text-slate-900 ml-1">
                      {settings.currencySymbol} {selectedSupplierObj.payableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Unsettled Purchase Bills: </span>
                    <span className="font-bold text-purple-700 ml-1">
                      {supplierPendingPurchases.length} Bill{supplierPendingPurchases.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )}

              {/* Previous Bills Allocation Section */}
              {paymentSupplierId && (
                <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Previous Purchase Bills to Adjust
                      </span>
                    </div>

                    {supplierPendingPurchases.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAutoAllocatePaymentFIFO}
                          className="flex items-center gap-1 text-[11px] bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>Auto-Allocate (FIFO)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillAllocations({})}
                          className="flex items-center gap-1 text-[11px] text-slate-600 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {supplierPendingPurchases.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 italic bg-white rounded-xl border border-slate-100 p-3">
                      No unpaid purchase bills found for this supplier. Payment will be recorded as general vendor advance.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                            <th className="p-2">Purchase No & Date</th>
                            <th className="p-2 text-right">Bill Total</th>
                            <th className="p-2 text-right">Already Paid</th>
                            <th className="p-2 text-right">Current Due</th>
                            <th className="p-2 text-right w-36">Settle Amount</th>
                            <th className="p-2 text-center w-16">Quick</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {supplierPendingPurchases.map((pur) => {
                            const allocVal = billAllocations[pur.id] || '';
                            const isFullySettled = Number(allocVal) === pur.dueAmount;
                            return (
                              <tr key={pur.id} className="hover:bg-slate-50">
                                <td className="p-2">
                                  <div className="font-mono font-bold text-purple-600">{pur.purchaseNumber}</div>
                                  <div className="text-[10px] text-slate-400">{pur.date}</div>
                                </td>
                                <td className="p-2 text-right font-mono text-slate-700">
                                  {settings.currencySymbol}{pur.grandTotal.toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-500">
                                  {settings.currencySymbol}{pur.paidAmount.toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-rose-700">
                                  {settings.currencySymbol}{pur.dueAmount.toFixed(2)}
                                </td>
                                <td className="p-2 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    max={pur.dueAmount}
                                    step="0.01"
                                    placeholder="0.00"
                                    value={allocVal}
                                    onChange={(e) => handleSetPurchaseAlloc(pur.id, e.target.value, pur.dueAmount)}
                                    className="w-full text-right p-1.5 rounded-lg border border-slate-300 font-mono font-bold text-purple-700 text-xs focus:ring-1 focus:ring-purple-500"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleSettleFullPurchase(pur.id, pur.dueAmount)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                      isFullySettled
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                    }`}
                                    title="Settle Full Purchase Bill"
                                  >
                                    {isFullySettled ? 'Full ✓' : 'Full'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Allocation summary status */}
                  {supplierPendingPurchases.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs gap-2">
                      <div>
                        <span className="text-slate-500">Allocated to Bills: </span>
                        <span className="font-bold font-mono text-purple-700">
                          {settings.currencySymbol} {totalPaymentAllocated.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        {Number(paymentAmount) > 0 ? (
                          Number(paymentAmount) >= totalPaymentAllocated ? (
                            <span className="text-slate-600">
                              Unallocated (Advance):{' '}
                              <strong className="font-mono text-slate-900">
                                {settings.currencySymbol} {(Number(paymentAmount) - totalPaymentAllocated).toFixed(2)}
                              </strong>
                            </span>
                          ) : (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Allocated exceeds payment amount by {settings.currencySymbol}{(totalPaymentAllocated - Number(paymentAmount)).toFixed(2)}
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reference / Cheque No
                  </label>
                  <input
                    type="text"
                    placeholder="Ref / Chq #"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Additional notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 font-bold text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Payment & Settle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="font-bold text-lg text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-rose-600" />
              <span>Record Expense</span>
            </h3>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Category *
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium"
                >
                  <option value="Electricity / Utilities">Electricity / Utilities</option>
                  <option value="Rent & Premises">Rent & Premises</option>
                  <option value="Salaries & Wages">Salaries & Wages</option>
                  <option value="Transport & Delivery">Transport & Delivery</option>
                  <option value="Office Supplies & Stationery">Office Supplies & Stationery</option>
                  <option value="Tea & Refreshments">Tea & Refreshments</option>
                  <option value="Maintenance & Repairs">Maintenance & Repairs</option>
                  <option value="Other Misc Expenses">Other Misc Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Amount ({settings.currencySymbol}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold text-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Paid To (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Person or vendor name..."
                  value={expensePaidTo}
                  onChange={(e) => setExpensePaidTo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Payment Mode
                </label>
                <select
                  value={expenseMode}
                  onChange={(e) => setExpenseMode(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 font-bold text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-sm bg-rose-600 text-white rounded-xl"
                >
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW / PRINT VOUCHER MODAL */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 my-8 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-700" />
                <h3 className="font-bold text-lg text-slate-900">
                  {viewVoucher.type === 'RECEIPT' ? 'Customer Receipt Voucher' : 'Supplier Payment Voucher'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Voucher
                </button>
                <button
                  onClick={() => setViewVoucher(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto pt-4 space-y-6 print:p-0">
              {/* Company Header */}
              <div className="text-center pb-4 border-b border-slate-200">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{settings.companyName}</h2>
                <p className="text-xs text-slate-600 mt-0.5">{settings.address}</p>
                <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-600 mt-1">
                  <span>Phone: {settings.phone}</span>
                  {settings.email && <span>Email: {settings.email}</span>}
                  {settings.taxRegistrationNo && (
                    <span className="font-mono font-bold text-slate-800">
                      Tax/VAT: {settings.taxRegistrationNo}
                    </span>
                  )}
                </div>
                <div className="mt-2 inline-block px-3 py-0.5 bg-slate-100 text-slate-800 font-bold font-mono text-xs rounded-full uppercase tracking-wider">
                  {viewVoucher.type === 'RECEIPT' ? 'Official Money Receipt' : 'Official Payment Voucher'}
                </div>
              </div>

              {/* Voucher Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500">Voucher No:</span>{' '}
                  <strong className="font-mono text-slate-900">
                    {'receiptNumber' in viewVoucher.data ? viewVoucher.data.receiptNumber : viewVoucher.data.paymentNumber}
                  </strong>
                  <br />
                  <span className="text-slate-500">Date:</span>{' '}
                  <strong className="text-slate-900">{viewVoucher.data.date}</strong>
                </div>
                <div>
                  <span className="text-slate-500">
                    {viewVoucher.type === 'RECEIPT' ? 'Received From:' : 'Paid To:'}
                  </span>{' '}
                  <strong className="text-slate-900">
                    {'customerName' in viewVoucher.data ? viewVoucher.data.customerName : viewVoucher.data.supplierName}
                  </strong>
                  <br />
                  <span className="text-slate-500">Payment Mode:</span>{' '}
                  <strong className="font-mono text-slate-900">{viewVoucher.data.paymentMode}</strong>
                  {viewVoucher.data.referenceNo && (
                    <>
                      <br />
                      <span className="text-slate-500">Reference / Chq:</span>{' '}
                      <strong className="font-mono text-slate-900">{viewVoucher.data.referenceNo}</strong>
                    </>
                  )}
                </div>
              </div>

              {/* Allocations Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Adjusted Bill Details</h4>
                {viewVoucher.data.allocations && viewVoucher.data.allocations.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                        <th className="p-2 border-r border-slate-200">Bill #</th>
                        <th className="p-2 border-r border-slate-200">Date</th>
                        <th className="p-2 text-right border-r border-slate-200">Bill Total</th>
                        <th className="p-2 text-right border-r border-slate-200">Prior Due</th>
                        <th className="p-2 text-right border-r border-slate-200">Paid Now</th>
                        <th className="p-2 text-right">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {viewVoucher.data.allocations.map((alloc: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold text-blue-600 border-r border-slate-200">
                            {alloc.invoiceNumber || alloc.purchaseNumber}
                          </td>
                          <td className="p-2 text-slate-500 border-r border-slate-200 font-sans">
                            {alloc.invoiceDate || alloc.purchaseDate}
                          </td>
                          <td className="p-2 text-right border-r border-slate-200">
                            {settings.currencySymbol}{alloc.originalGrandTotal.toFixed(2)}
                          </td>
                          <td className="p-2 text-right border-r border-slate-200">
                            {settings.currencySymbol}{alloc.priorDue.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-bold text-emerald-600 border-r border-slate-200">
                            {settings.currencySymbol}{alloc.allocatedAmount.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-bold text-slate-700">
                            {settings.currencySymbol}{alloc.remainingDueAfter.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-100">
                    Payment was applied as general on-account transaction.
                  </p>
                )}
              </div>

              {/* Total Amount Box */}
              <div className="flex justify-end pt-2">
                <div className="bg-slate-900 text-white px-5 py-3 rounded-xl text-right">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Amount</div>
                  <div className="text-xl font-mono font-black text-emerald-400">
                    {settings.currencySymbol} {viewVoucher.data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs text-slate-500">
                <div>
                  <div className="border-t border-slate-300 pt-1 font-bold text-slate-700">Prepared / Authorized By</div>
                </div>
                <div>
                  <div className="border-t border-slate-300 pt-1 font-bold text-slate-700">Received By / Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Void Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-slate-900">
              Void {deleteConfirm.type === 'RECEIPT' ? 'Receipt' : deleteConfirm.type === 'PAYMENT' ? 'Payment' : 'Expense'}?
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              {deleteConfirm.type === 'RECEIPT'
                ? 'This will remove the receipt, revert settled invoice balances, and restore customer outstanding.'
                : deleteConfirm.type === 'PAYMENT'
                ? 'This will remove the payment, revert settled bill balances, and restore supplier payable.'
                : 'This will remove the expense log entry from cash book records.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'RECEIPT' && onDeleteReceipt) {
                    onDeleteReceipt(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'PAYMENT' && onDeletePayment) {
                    onDeletePayment(deleteConfirm.id);
                  } else if (deleteConfirm.type === 'EXPENSE' && onDeleteExpense) {
                    onDeleteExpense(deleteConfirm.id);
                  }
                  setDeleteConfirm(null);
                }}
                className="px-5 py-2 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700"
              >
                Yes, Void Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
