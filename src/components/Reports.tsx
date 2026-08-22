import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Printer,
  Download,
  Users,
  Truck,
  Package,
  BookOpen,
  PieChart,
  MessageCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  CheckCircle2,
  Phone
} from 'lucide-react';
import {
  SaleInvoice,
  PurchaseInvoice,
  Product,
  Customer,
  Supplier,
  CustomerReceipt,
  SupplierPayment,
  Expense,
  AppSettings,
  AuthSession
} from '../types';
import { checkPermission } from '../lib/permissions';
import { shareReportViaWhatsApp } from '../lib/whatsapp';

interface ReportsProps {
  sales: SaleInvoice[];
  purchases: PurchaseInvoice[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  receipts: CustomerReceipt[];
  payments: SupplierPayment[];
  expenses: Expense[];
  settings: AppSettings;
  session?: AuthSession | null;
}

export const Reports: React.FC<ReportsProps> = ({
  sales,
  purchases,
  products,
  customers,
  suppliers,
  receipts,
  payments,
  expenses,
  settings
}) => {
  const [activeReport, setActiveReport] = useState<
    'SALES' | 'PURCHASES' | 'STOCK' | 'CUST_OUT' | 'SUPP_PAY' | 'CASH_BOOK' | 'PROFIT'
  >('SALES');

  // Customer Aging Report States
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [custAgingFilter, setCustAgingFilter] = useState<'ALL' | '0_30' | '31_60' | '61_90' | '90_PLUS'>('ALL');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // Supplier Aging Report States
  const [suppSearchQuery, setSuppSearchQuery] = useState('');
  const [suppAgingFilter, setSuppAgingFilter] = useState<'ALL' | '0_30' | '31_60' | '61_90' | '90_PLUS'>('ALL');
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  // CSV Export Helper
  const handleExportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to calculate days between invoice date and today
  const calculateAgeDays = (dateStr: string) => {
    const invDate = new Date(dateStr);
    const today = new Date();
    // Normalize to midnight
    invDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - invDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  // ==========================================
  // 1. CUSTOMER OUTSTANDING WITH AGING DATA
  // ==========================================
  const customerAgingData = useMemo(() => {
    return customers
      .map((cust) => {
        // Pending invoices for this customer
        const pendingInvoices = sales
          .filter((s) => s.customerId === cust.id && s.dueAmount > 0)
          .map((s) => {
            const ageDays = calculateAgeDays(s.date);
            let bucket: '0_30' | '31_60' | '61_90' | '90_PLUS' = '0_30';
            if (ageDays > 90) bucket = '90_PLUS';
            else if (ageDays > 60) bucket = '61_90';
            else if (ageDays > 30) bucket = '31_60';
            return {
              ...s,
              ageDays,
              bucket
            };
          })
          .sort((a, b) => b.ageDays - a.ageDays); // oldest first

        let bucket0_30 = 0;
        let bucket31_60 = 0;
        let bucket61_90 = 0;
        let bucket90Plus = 0;

        for (const inv of pendingInvoices) {
          if (inv.bucket === '0_30') bucket0_30 += inv.dueAmount;
          else if (inv.bucket === '31_60') bucket31_60 += inv.dueAmount;
          else if (inv.bucket === '61_90') bucket61_90 += inv.dueAmount;
          else if (inv.bucket === '90_PLUS') bucket90Plus += inv.dueAmount;
        }

        const invoiceDuesTotal = bucket0_30 + bucket31_60 + bucket61_90 + bucket90Plus;

        // If customer has an opening balance or extra balance not in invoice dues
        if (cust.outstandingBalance > invoiceDuesTotal) {
          const diff = cust.outstandingBalance - invoiceDuesTotal;
          bucket90Plus += diff; // categorize opening or unlinked due as >90d
        }

        const totalDue = cust.outstandingBalance > 0 ? cust.outstandingBalance : invoiceDuesTotal;

        return {
          customer: cust,
          totalDue: Number(totalDue.toFixed(2)),
          bucket0_30: Number(bucket0_30.toFixed(2)),
          bucket31_60: Number(bucket31_60.toFixed(2)),
          bucket61_90: Number(bucket61_90.toFixed(2)),
          bucket90Plus: Number(bucket90Plus.toFixed(2)),
          pendingInvoices
        };
      })
      .filter((item) => item.totalDue > 0);
  }, [customers, sales]);

  // Summary totals for customer aging
  const customerAgingTotals = useMemo(() => {
    const totalReceivables = customerAgingData.reduce((sum, item) => sum + item.totalDue, 0);
    const total0_30 = customerAgingData.reduce((sum, item) => sum + item.bucket0_30, 0);
    const total31_60 = customerAgingData.reduce((sum, item) => sum + item.bucket31_60, 0);
    const total61_90 = customerAgingData.reduce((sum, item) => sum + item.bucket61_90, 0);
    const total90Plus = customerAgingData.reduce((sum, item) => sum + item.bucket90Plus, 0);

    return {
      totalReceivables,
      total0_30,
      total31_60,
      total61_90,
      total90Plus,
      pct0_30: totalReceivables > 0 ? (total0_30 / totalReceivables) * 100 : 0,
      pct31_60: totalReceivables > 0 ? (total31_60 / totalReceivables) * 100 : 0,
      pct61_90: totalReceivables > 0 ? (total61_90 / totalReceivables) * 100 : 0,
      pct90Plus: totalReceivables > 0 ? (total90Plus / totalReceivables) * 100 : 0
    };
  }, [customerAgingData]);

  // Filtered customer aging list
  const filteredCustomerAging = useMemo(() => {
    return customerAgingData.filter((item) => {
      // Search
      const q = custSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.customer.name.toLowerCase().includes(q) ||
        item.customer.code.toLowerCase().includes(q) ||
        item.customer.phone.toLowerCase().includes(q) ||
        (item.customer.city && item.customer.city.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Filter bucket
      if (custAgingFilter === '0_30') return item.bucket0_30 > 0;
      if (custAgingFilter === '31_60') return item.bucket31_60 > 0;
      if (custAgingFilter === '61_90') return item.bucket61_90 > 0;
      if (custAgingFilter === '90_PLUS') return item.bucket90Plus > 0;
      return true;
    });
  }, [customerAgingData, custSearchQuery, custAgingFilter]);

  // ==========================================
  // 2. SUPPLIER PAYABLE WITH AGING DATA
  // ==========================================
  const supplierAgingData = useMemo(() => {
    return suppliers
      .map((supp) => {
        // Pending purchase bills for this supplier
        const pendingBills = purchases
          .filter((p) => p.supplierId === supp.id && p.dueAmount > 0)
          .map((p) => {
            const ageDays = calculateAgeDays(p.date);
            let bucket: '0_30' | '31_60' | '61_90' | '90_PLUS' = '0_30';
            if (ageDays > 90) bucket = '90_PLUS';
            else if (ageDays > 60) bucket = '61_90';
            else if (ageDays > 30) bucket = '31_60';
            return {
              ...p,
              ageDays,
              bucket
            };
          })
          .sort((a, b) => b.ageDays - a.ageDays);

        let bucket0_30 = 0;
        let bucket31_60 = 0;
        let bucket61_90 = 0;
        let bucket90Plus = 0;

        for (const bill of pendingBills) {
          if (bill.bucket === '0_30') bucket0_30 += bill.dueAmount;
          else if (bill.bucket === '31_60') bucket31_60 += bill.dueAmount;
          else if (bill.bucket === '61_90') bucket61_90 += bill.dueAmount;
          else if (bill.bucket === '90_PLUS') bucket90Plus += bill.dueAmount;
        }

        const billDuesTotal = bucket0_30 + bucket31_60 + bucket61_90 + bucket90Plus;

        if (supp.payableBalance > billDuesTotal) {
          const diff = supp.payableBalance - billDuesTotal;
          bucket90Plus += diff;
        }

        const totalPayable = supp.payableBalance > 0 ? supp.payableBalance : billDuesTotal;

        return {
          supplier: supp,
          totalPayable: Number(totalPayable.toFixed(2)),
          bucket0_30: Number(bucket0_30.toFixed(2)),
          bucket31_60: Number(bucket31_60.toFixed(2)),
          bucket61_90: Number(bucket61_90.toFixed(2)),
          bucket90Plus: Number(bucket90Plus.toFixed(2)),
          pendingBills
        };
      })
      .filter((item) => item.totalPayable > 0);
  }, [suppliers, purchases]);

  // Summary totals for supplier aging
  const supplierAgingTotals = useMemo(() => {
    const totalPayables = supplierAgingData.reduce((sum, item) => sum + item.totalPayable, 0);
    const total0_30 = supplierAgingData.reduce((sum, item) => sum + item.bucket0_30, 0);
    const total31_60 = supplierAgingData.reduce((sum, item) => sum + item.bucket31_60, 0);
    const total61_90 = supplierAgingData.reduce((sum, item) => sum + item.bucket61_90, 0);
    const total90Plus = supplierAgingData.reduce((sum, item) => sum + item.bucket90Plus, 0);

    return {
      totalPayables,
      total0_30,
      total31_60,
      total61_90,
      total90Plus,
      pct0_30: totalPayables > 0 ? (total0_30 / totalPayables) * 100 : 0,
      pct31_60: totalPayables > 0 ? (total31_60 / totalPayables) * 100 : 0,
      pct61_90: totalPayables > 0 ? (total61_90 / totalPayables) * 100 : 0,
      pct90Plus: totalPayables > 0 ? (total90Plus / totalPayables) * 100 : 0
    };
  }, [supplierAgingData]);

  // Filtered supplier aging list
  const filteredSupplierAging = useMemo(() => {
    return supplierAgingData.filter((item) => {
      const q = suppSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.supplier.name.toLowerCase().includes(q) ||
        item.supplier.code.toLowerCase().includes(q) ||
        item.supplier.phone.toLowerCase().includes(q) ||
        (item.supplier.companyName && item.supplier.companyName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (suppAgingFilter === '0_30') return item.bucket0_30 > 0;
      if (suppAgingFilter === '31_60') return item.bucket31_60 > 0;
      if (suppAgingFilter === '61_90') return item.bucket61_90 > 0;
      if (suppAgingFilter === '90_PLUS') return item.bucket90Plus > 0;
      return true;
    });
  }, [supplierAgingData, suppSearchQuery, suppAgingFilter]);

  // Send single customer WhatsApp reminder with aging breakdown
  const handleSendCustomerReminderWhatsApp = (custItem: typeof customerAgingData[0]) => {
    const text = [
      `*Payment Reminder from ${settings.companyName}*`,
      `Dear ${custItem.customer.name},`,
      `This is a gentle reminder regarding your outstanding balance with us.`,
      ``,
      `*Total Due Balance: ${settings.currencySymbol} ${custItem.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}*`,
      `---------------------------------`,
      `*Aging Breakdown:*`,
      custItem.bucket0_30 > 0 ? `• 0 - 30 Days (Current): ${settings.currencySymbol}${custItem.bucket0_30.toLocaleString('en-US')}` : null,
      custItem.bucket31_60 > 0 ? `• 31 - 60 Days: ${settings.currencySymbol}${custItem.bucket31_60.toLocaleString('en-US')}` : null,
      custItem.bucket61_90 > 0 ? `• 61 - 90 Days: ${settings.currencySymbol}${custItem.bucket61_90.toLocaleString('en-US')}` : null,
      custItem.bucket90Plus > 0 ? `• 90+ Days (Overdue): ${settings.currencySymbol}${custItem.bucket90Plus.toLocaleString('en-US')}` : null,
      `---------------------------------`,
      custItem.pendingInvoices.length > 0 ? `*Unpaid Invoices:*` : null,
      ...custItem.pendingInvoices.slice(0, 5).map((inv) => `• ${inv.invoiceNumber} (${inv.date}, ${inv.ageDays}d ago): Due ${settings.currencySymbol}${inv.dueAmount.toFixed(2)}`),
      ``,
      `Kindly arrange payment at your earliest convenience. Thank you for your business!`,
      `Tel: ${settings.companyPhone}`
    ].filter(Boolean).join('\n');

    let phone = custItem.customer.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '94' + phone.slice(1);
    }
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Calculations for Profit Report
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);

  // Estimate COGS based on costPrice of sold items
  let cogs = 0;
  sales.forEach((s) => {
    s.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId || p.code === item.productCode);
      const unitCost = prod ? prod.costPrice : item.unitPrice * 0.7;
      cogs += item.quantity * unitCost;
    });
  });

  const grossProfit = totalSalesRevenue - cogs;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  // Calculations for Stock
  const totalStockCostVal = products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
  const totalStockSalesVal = products.reduce((sum, p) => sum + p.currentStock * p.sellingPrice, 0);

  // Cash Book Entries
  const cashBookRows = [
    { date: 'Initial', ref: 'SETUP', desc: 'Initial Opening Cash', type: 'IN', amount: settings.initialCashBalance },
    ...sales.map((s) => ({ date: s.date, ref: s.invoiceNumber, desc: `Sale (${s.customerName})`, type: 'IN', amount: s.paidAmount })),
    ...receipts.filter((r) => r.paymentMode === 'CASH').map((r) => ({ date: r.date, ref: r.receiptNumber, desc: `Receipt (${r.customerName})`, type: 'IN', amount: r.amount })),
    ...purchases.map((p) => ({ date: p.date, ref: p.purchaseNumber, desc: `Purchase (${p.supplierName})`, type: 'OUT', amount: p.paidAmount })),
    ...payments.filter((pm) => pm.paymentMode === 'CASH').map((pm) => ({ date: pm.date, ref: pm.paymentNumber, desc: `Payment (${pm.supplierName})`, type: 'OUT', amount: pm.amount })),
    ...expenses.filter((e) => e.paymentMode === 'CASH').map((e) => ({ date: e.date, ref: e.expenseNumber, desc: `Expense (${e.category})`, type: 'OUT', amount: e.amount }))
  ].filter((row) => row.amount > 0);

  // WhatsApp Report Sharing (Overall)
  const handleShareReportWhatsApp = () => {
    let title = '';
    let lines: string[] = [];

    if (activeReport === 'SALES') {
      title = 'Sales Summary Report';
      const totalRev = sales.reduce((sum, s) => sum + s.grandTotal, 0);
      const totalPaid = sales.reduce((sum, s) => sum + s.paidAmount, 0);
      const totalDue = sales.reduce((sum, s) => sum + s.dueAmount, 0);
      lines = [
        `• Total Invoices: ${sales.length}`,
        `• Total Revenue: ${settings.currencySymbol} ${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Collected: ${settings.currencySymbol} ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Pending Due: ${settings.currencySymbol} ${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `\n*Recent Sales Invoices:*`,
        ...sales.slice(0, 5).map((s) => `• ${s.invoiceNumber} (${s.customerName}): ${settings.currencySymbol}${s.grandTotal}`)
      ];
    } else if (activeReport === 'PURCHASES') {
      title = 'Purchase Summary Report';
      const totalPur = purchases.reduce((sum, p) => sum + p.grandTotal, 0);
      const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
      const totalDue = purchases.reduce((sum, p) => sum + p.dueAmount, 0);
      lines = [
        `• Total Purchase Bills: ${purchases.length}`,
        `• Total Purchase Value: ${settings.currencySymbol} ${totalPur.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Paid to Suppliers: ${settings.currencySymbol} ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Supplier Payable: ${settings.currencySymbol} ${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `\n*Recent Purchase Bills:*`,
        ...purchases.slice(0, 5).map((p) => `• ${p.purchaseNumber} (${p.supplierName}): ${settings.currencySymbol}${p.grandTotal}`)
      ];
    } else if (activeReport === 'STOCK') {
      title = 'Stock Valuation & Inventory Report';
      const totalItems = products.reduce((sum, p) => sum + p.currentStock, 0);
      const lowStock = products.filter((p) => p.currentStock <= p.reorderLevel);
      lines = [
        `• Product Categories: ${Array.from(new Set(products.map((p) => p.category))).length}`,
        `• Total Item Types: ${products.length}`,
        `• Total In-Stock Units: ${totalItems}`,
        `• Stock Valuation (Cost): ${settings.currencySymbol} ${totalStockCostVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Stock Valuation (Retail): ${settings.currencySymbol} ${totalStockSalesVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Low Stock Items: ${lowStock.length}`
      ];
    } else if (activeReport === 'CUST_OUT') {
      title = 'Customer Outstanding & Aging Report';
      lines = [
        `• Customers with Balances: ${customerAgingData.length}`,
        `• Total Outstanding Receivables: ${settings.currencySymbol} ${customerAgingTotals.totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `\n*Aging Analysis Summary:*`,
        `🟢 0-30 Days (Current): ${settings.currencySymbol}${customerAgingTotals.total0_30.toLocaleString('en-US')} (${customerAgingTotals.pct0_30.toFixed(1)}%)`,
        `🔵 31-60 Days: ${settings.currencySymbol}${customerAgingTotals.total31_60.toLocaleString('en-US')} (${customerAgingTotals.pct31_60.toFixed(1)}%)`,
        `🟠 61-90 Days: ${settings.currencySymbol}${customerAgingTotals.total61_90.toLocaleString('en-US')} (${customerAgingTotals.pct61_90.toFixed(1)}%)`,
        `🔴 90+ Days (Critical): ${settings.currencySymbol}${customerAgingTotals.total90Plus.toLocaleString('en-US')} (${customerAgingTotals.pct90Plus.toFixed(1)}%)`,
        `\n*Top Outstanding Debtors:*`,
        ...customerAgingData.slice(0, 5).map((c) => `• ${c.customer.name}: ${settings.currencySymbol}${c.totalDue.toLocaleString('en-US')} (${c.customer.phone})`)
      ];
    } else if (activeReport === 'SUPP_PAY') {
      title = 'Supplier Payables & Aging Report';
      lines = [
        `• Suppliers with Balances: ${supplierAgingData.length}`,
        `• Total Vendor Payables: ${settings.currencySymbol} ${supplierAgingTotals.totalPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `\n*Aging Analysis Summary:*`,
        `🟢 0-30 Days: ${settings.currencySymbol}${supplierAgingTotals.total0_30.toLocaleString('en-US')} (${supplierAgingTotals.pct0_30.toFixed(1)}%)`,
        `🔵 31-60 Days: ${settings.currencySymbol}${supplierAgingTotals.total31_60.toLocaleString('en-US')} (${supplierAgingTotals.pct31_60.toFixed(1)}%)`,
        `🟠 61-90 Days: ${settings.currencySymbol}${supplierAgingTotals.total61_90.toLocaleString('en-US')} (${supplierAgingTotals.pct61_90.toFixed(1)}%)`,
        `🔴 90+ Days: ${settings.currencySymbol}${supplierAgingTotals.total90Plus.toLocaleString('en-US')} (${supplierAgingTotals.pct90Plus.toFixed(1)}%)`,
        `\n*Top Vendor Payables:*`,
        ...supplierAgingData.slice(0, 5).map((s) => `• ${s.supplier.name}: ${settings.currencySymbol}${s.totalPayable.toLocaleString('en-US')}`)
      ];
    } else if (activeReport === 'CASH_BOOK') {
      title = 'Cash Book Statement';
      const totalIn = cashBookRows.filter((r) => r.type === 'IN').reduce((sum, r) => sum + r.amount, 0);
      const totalOut = cashBookRows.filter((r) => r.type === 'OUT').reduce((sum, r) => sum + r.amount, 0);
      const closingCash = settings.initialCashBalance + totalIn - totalOut;
      lines = [
        `• Opening Cash: ${settings.currencySymbol} ${settings.initialCashBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Cash Inflow (+): ${settings.currencySymbol} ${totalIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Cash Outflow (-): ${settings.currencySymbol} ${totalOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Net Cash Balance: ${settings.currencySymbol} ${closingCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      ];
    } else if (activeReport === 'PROFIT') {
      title = 'Profit & Loss Statement';
      lines = [
        `• Total Sales Revenue: ${settings.currencySymbol} ${totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Cost of Goods Sold (COGS): -${settings.currencySymbol} ${cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Gross Profit: ${settings.currencySymbol} ${grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Operating Expenses: -${settings.currencySymbol} ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `------------------------------`,
        `*NET ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}:* ${settings.currencySymbol} ${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      ];
    }

    shareReportViaWhatsApp(title, lines, settings);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports & Financial Analytics</h2>
          <p className="text-xs text-slate-500">
            Generate financial reports, comprehensive aging analysis (30/60/90+ days), cash book, and P&L statements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareReportWhatsApp}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs cursor-pointer transition-colors"
            title="Share report via WhatsApp"
          >
            <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
            <span>Send Report via WhatsApp</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-xs cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4 text-yellow-400" />
            <span>Print Current Report</span>
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <button
          onClick={() => setActiveReport('SALES')}
          className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            activeReport === 'SALES'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          1. Sales Report
        </button>

        <button
          onClick={() => setActiveReport('PURCHASES')}
          className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            activeReport === 'PURCHASES'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          2. Purchase Report
        </button>

        <button
          onClick={() => setActiveReport('STOCK')}
          className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            activeReport === 'STOCK'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          3. Stock Valuation
        </button>

        <button
          onClick={() => setActiveReport('CUST_OUT')}
          className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
            activeReport === 'CUST_OUT'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>4. Customer Due</span>
          <span className="text-[10px] opacity-85 font-mono">(with Aging)</span>
        </button>

        <button
          onClick={() => setActiveReport('SUPP_PAY')}
          className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
            activeReport === 'SUPP_PAY'
              ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>5. Supplier Payable</span>
          <span className="text-[10px] opacity-85 font-mono">(with Aging)</span>
        </button>

        <button
          onClick={() => setActiveReport('CASH_BOOK')}
          className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            activeReport === 'CASH_BOOK'
              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          6. Cash Book
        </button>

        <button
          onClick={() => setActiveReport('PROFIT')}
          className={`p-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            activeReport === 'PROFIT'
              ? 'bg-slate-900 text-yellow-400 border-slate-900 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          7. Profit & Loss
        </button>
      </div>

      {/* REPORT CONTENT VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs" id="printable-report">
        {/* Document Header for All Printed Reports */}
        <div className="hidden print:block text-center pb-4 mb-4 border-b-2 border-slate-900">
          <div className="inline-flex items-center justify-center gap-1.5 mb-1">
            <span className="text-xl font-black text-blue-600 tracking-tight">Busy</span>
            <span className="text-xl font-black text-yellow-500 bg-yellow-100 px-1.5 py-0.2 rounded-md border border-yellow-300 text-xs">
              UFO
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
            {settings.companyName || 'Business Name'}
          </h1>
          <p className="text-xs text-slate-600">
            {settings.companyAddress}
          </p>
          <p className="text-xs text-slate-600 font-mono">
            Tel: {settings.companyPhone} {settings.companyEmail ? `| Email: ${settings.companyEmail}` : ''}
            {settings.taxRegistrationNo ? ` | VAT/TAX: ${settings.taxRegistrationNo}` : ''}
          </p>
          <div className="mt-3 pt-2 border-t border-slate-300 flex justify-between text-xs font-bold text-slate-800 uppercase font-mono">
            <span>
              REPORT:{' '}
              {activeReport === 'SALES'
                ? 'SALES & REVENUE STATEMENT'
                : activeReport === 'PURCHASES'
                ? 'PURCHASE & VENDOR BILLS STATEMENT'
                : activeReport === 'STOCK'
                ? 'STOCK VALUATION & INVENTORY REPORT'
                : activeReport === 'CUST_OUT'
                ? 'CUSTOMER OUTSTANDING BALANCES & AGING ANALYSIS'
                : activeReport === 'SUPP_PAY'
                ? 'SUPPLIER PAYABLES & AGING ANALYSIS'
                : activeReport === 'CASH_BOOK'
                ? 'CASH BOOK REGISTER'
                : 'PROFIT & LOSS STATEMENT'}
            </span>
            <span>GENERATED: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* 1. SALES REPORT */}
        {activeReport === 'SALES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Sales Report</h3>
                <p className="text-xs text-slate-500">Summary of total invoices & revenue</p>
              </div>
              <button
                onClick={() =>
                  handleExportCSV(
                    'SalesReport',
                    ['InvoiceNo', 'Customer', 'Date', 'Type', 'GrandTotal', 'Paid', 'Due'],
                    sales.map((s) => [s.invoiceNumber, s.customerName, s.date, s.type, s.grandTotal, s.paidAmount, s.dueAmount])
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="p-3 font-mono font-bold text-blue-600">{s.invoiceNumber}</td>
                      <td className="p-3 font-bold">{s.customerName}</td>
                      <td className="p-3 text-slate-500">{s.date}</td>
                      <td className="p-3 font-bold">{s.type}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        {settings.currencySymbol} {s.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. PURCHASE REPORT */}
        {activeReport === 'PURCHASES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Purchase Report</h3>
                <p className="text-xs text-slate-500">Inventory purchasing totals</p>
              </div>
              <button
                onClick={() =>
                  handleExportCSV(
                    'PurchaseReport',
                    ['PurchaseNo', 'Supplier', 'Date', 'Type', 'GrandTotal', 'Paid', 'Due'],
                    purchases.map((p) => [p.purchaseNumber, p.supplierName, p.date, p.type, p.grandTotal, p.paidAmount, p.dueAmount])
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="p-3">Purchase No</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3 font-mono font-bold text-purple-600">{p.purchaseNumber}</td>
                      <td className="p-3 font-bold">{p.supplierName}</td>
                      <td className="p-3 text-slate-500">{p.date}</td>
                      <td className="p-3 font-bold">{p.type}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        {settings.currencySymbol} {p.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. STOCK REPORT */}
        {activeReport === 'STOCK' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Stock Valuation Report</h3>
                <p className="text-xs text-slate-500">
                  Total Cost Value: {settings.currencySymbol}{totalStockCostVal.toLocaleString('en-US')} | Total Retail Value: {settings.currencySymbol}{totalStockSalesVal.toLocaleString('en-US')}
                </p>
              </div>
              <button
                onClick={() =>
                  handleExportCSV(
                    'StockReport',
                    ['Code', 'Product', 'Category', 'StockQty', 'CostPrice', 'SellingPrice', 'StockValueCost'],
                    products.map((p) => [p.code, p.name, p.category, p.currentStock, p.costPrice, p.sellingPrice, p.currentStock * p.costPrice])
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="p-3">Code</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Stock Qty</th>
                    <th className="p-3 text-right">Cost Value</th>
                    <th className="p-3 text-right">Retail Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3 font-mono font-bold">{p.code}</td>
                      <td className="p-3 font-bold">{p.name}</td>
                      <td className="p-3">{p.category}</td>
                      <td className="p-3 text-center font-bold font-mono">{p.currentStock}</td>
                      <td className="p-3 text-right font-mono">
                        {settings.currencySymbol} {(p.currentStock * p.costPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {settings.currencySymbol} {(p.currentStock * p.sellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. CUSTOMER OUTSTANDING WITH AGING REPORT */}
        {activeReport === 'CUST_OUT' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <span>Customer Outstanding & Aging Analysis Report</span>
                  <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    {customerAgingData.length} Debtors
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Accounts receivable aging grouped into 0-30, 31-60, 61-90, and 90+ days intervals
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleExportCSV(
                      'Customer_Aging_Report',
                      ['Code', 'CustomerName', 'Phone', 'City', '0_30_Days', '31_60_Days', '61_90_Days', '90_Plus_Days', 'TotalOutstanding'],
                      customerAgingData.map((c) => [
                        c.customer.code,
                        c.customer.name,
                        c.customer.phone,
                        c.customer.city || '',
                        c.bucket0_30,
                        c.bucket31_60,
                        c.bucket61_90,
                        c.bucket90Plus,
                        c.totalDue
                      ])
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" /> Export CSV with Aging
                </button>
              </div>
            </div>

            {/* Aging Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl col-span-2 sm:col-span-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Receivables</span>
                <div className="text-lg font-mono font-black text-emerald-400 mt-1">
                  {settings.currencySymbol} {customerAgingTotals.totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{customerAgingData.length} active customer accounts</div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase">0 - 30 Days</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                    {customerAgingTotals.pct0_30.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-emerald-800 mt-1">
                  {settings.currencySymbol} {customerAgingTotals.total0_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">Current / On-time</div>
              </div>

              <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-sky-800 font-bold uppercase">31 - 60 Days</span>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded font-mono">
                    {customerAgingTotals.pct31_60.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-sky-800 mt-1">
                  {settings.currencySymbol} {customerAgingTotals.total31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-sky-600 mt-0.5 font-medium">Follow-up due</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-800 font-bold uppercase">61 - 90 Days</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-mono">
                    {customerAgingTotals.pct61_90.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-amber-800 mt-1">
                  {settings.currencySymbol} {customerAgingTotals.total61_90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5 font-medium">Overdue grace</div>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-rose-800 font-bold uppercase">90+ Days</span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded font-mono">
                    {customerAgingTotals.pct90Plus.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-rose-800 mt-1">
                  {settings.currencySymbol} {customerAgingTotals.total90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-rose-600 mt-0.5 font-bold">Critical / Risk</div>
              </div>
            </div>

            {/* Visual Aging Bar */}
            {customerAgingTotals.totalReceivables > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-slate-600">
                  <span>Receivables Aging Distribution</span>
                  <span className="font-mono">{customerAgingTotals.totalReceivables.toLocaleString('en-US')} Total</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full flex overflow-hidden p-0.5 border border-slate-200">
                  {customerAgingTotals.pct0_30 > 0 && (
                    <div
                      style={{ width: `${customerAgingTotals.pct0_30}%` }}
                      className="bg-emerald-500 h-full rounded-xs transition-all"
                      title={`0-30 Days: ${customerAgingTotals.pct0_30.toFixed(1)}%`}
                    />
                  )}
                  {customerAgingTotals.pct31_60 > 0 && (
                    <div
                      style={{ width: `${customerAgingTotals.pct31_60}%` }}
                      className="bg-sky-500 h-full rounded-xs transition-all"
                      title={`31-60 Days: ${customerAgingTotals.pct31_60.toFixed(1)}%`}
                    />
                  )}
                  {customerAgingTotals.pct61_90 > 0 && (
                    <div
                      style={{ width: `${customerAgingTotals.pct61_90}%` }}
                      className="bg-amber-500 h-full rounded-xs transition-all"
                      title={`61-90 Days: ${customerAgingTotals.pct61_90.toFixed(1)}%`}
                    />
                  )}
                  {customerAgingTotals.pct90Plus > 0 && (
                    <div
                      style={{ width: `${customerAgingTotals.pct90Plus}%` }}
                      className="bg-rose-500 h-full rounded-xs transition-all"
                      title={`90+ Days: ${customerAgingTotals.pct90Plus.toFixed(1)}%`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer by name, code, phone, or city..."
                  value={custSearchQuery}
                  onChange={(e) => setCustSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs w-full focus:outline-hidden text-slate-800"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Bucket:
                </span>
                <button
                  onClick={() => setCustAgingFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    custAgingFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({customerAgingData.length})
                </button>
                <button
                  onClick={() => setCustAgingFilter('0_30')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    custAgingFilter === '0_30'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  0-30d
                </button>
                <button
                  onClick={() => setCustAgingFilter('31_60')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    custAgingFilter === '31_60'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-sky-800 border border-sky-200 hover:bg-sky-50'
                  }`}
                >
                  31-60d
                </button>
                <button
                  onClick={() => setCustAgingFilter('61_90')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    custAgingFilter === '61_90'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  61-90d
                </button>
                <button
                  onClick={() => setCustAgingFilter('90_PLUS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    custAgingFilter === '90_PLUS'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  90+d (Critical)
                </button>
              </div>
            </div>

            {/* Customer Aging Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="p-3 w-10"></th>
                    <th className="p-3">Code & Customer</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3 text-right text-emerald-800 bg-emerald-50/50">0 - 30 Days</th>
                    <th className="p-3 text-right text-sky-800 bg-sky-50/50">31 - 60 Days</th>
                    <th className="p-3 text-right text-amber-800 bg-amber-50/50">61 - 90 Days</th>
                    <th className="p-3 text-right text-rose-800 bg-rose-50/50">90+ Days</th>
                    <th className="p-3 text-right font-black text-slate-900">Total Outstanding</th>
                    <th className="p-3 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCustomerAging.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                        No outstanding customer records matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerAging.map((item) => {
                      const isExpanded = expandedCustomerId === item.customer.id;
                      return (
                        <React.Fragment key={item.customer.id}>
                          <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50/90' : ''}`}>
                            <td className="p-3 text-center">
                              {item.pendingInvoices.length > 0 && (
                                <button
                                  onClick={() => setExpandedCustomerId(isExpanded ? null : item.customer.id)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-sm cursor-pointer"
                                  title="Expand pending bills"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-[10px] text-slate-500 block font-bold">{item.customer.code}</span>
                              <span className="font-bold text-slate-900 text-sm">{item.customer.name}</span>
                              {item.customer.city && (
                                <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({item.customer.city})</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-600">{item.customer.phone || '-'}</td>
                            <td className="p-3 text-right font-mono font-bold bg-emerald-50/20 text-emerald-700">
                              {item.bucket0_30 > 0 ? `${settings.currencySymbol} ${item.bucket0_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold bg-sky-50/20 text-sky-700">
                              {item.bucket31_60 > 0 ? `${settings.currencySymbol} ${item.bucket31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold bg-amber-50/20 text-amber-700">
                              {item.bucket61_90 > 0 ? `${settings.currencySymbol} ${item.bucket61_90.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold bg-rose-50/20 text-rose-700">
                              {item.bucket90Plus > 0 ? `${settings.currencySymbol} ${item.bucket90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-slate-900 text-sm">
                              {settings.currencySymbol} {item.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {item.customer.phone && (
                                  <button
                                    onClick={() => handleSendCustomerReminderWhatsApp(item)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Send WhatsApp Reminder with Aging Breakdown"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>Remind</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Pending Invoices Sub-table */}
                          {isExpanded && item.pendingInvoices.length > 0 && (
                            <tr>
                              <td colSpan={9} className="p-0 bg-slate-100/70 border-y border-slate-200">
                                <div className="p-3.5 pl-12 space-y-2">
                                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Unpaid Bills Breakdown for {item.customer.name} ({item.pendingInvoices.length} Invoices)</span>
                                  </div>

                                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                          <th className="p-2.5">Invoice No</th>
                                          <th className="p-2.5">Date</th>
                                          <th className="p-2.5">Age in Days</th>
                                          <th className="p-2.5">Aging Category</th>
                                          <th className="p-2.5 text-right">Invoice Total</th>
                                          <th className="p-2.5 text-right">Paid</th>
                                          <th className="p-2.5 text-right font-bold text-slate-900">Pending Due</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-mono">
                                        {item.pendingInvoices.map((inv) => (
                                          <tr key={inv.id} className="hover:bg-slate-50">
                                            <td className="p-2.5 font-bold text-blue-600">{inv.invoiceNumber}</td>
                                            <td className="p-2.5 text-slate-500 font-sans">{inv.date}</td>
                                            <td className="p-2.5 font-bold text-slate-700">{inv.ageDays} days ago</td>
                                            <td className="p-2.5 font-sans">
                                              <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                  inv.bucket === '0_30'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : inv.bucket === '31_60'
                                                    ? 'bg-sky-100 text-sky-800'
                                                    : inv.bucket === '61_90'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-rose-100 text-rose-800 font-black'
                                                }`}
                                              >
                                                {inv.bucket === '0_30'
                                                  ? '0-30 Days'
                                                  : inv.bucket === '31_60'
                                                  ? '31-60 Days'
                                                  : inv.bucket === '61_90'
                                                  ? '61-90 Days'
                                                  : '90+ Days Overdue'}
                                              </span>
                                            </td>
                                            <td className="p-2.5 text-right text-slate-600">
                                              {settings.currencySymbol}{inv.grandTotal.toFixed(2)}
                                            </td>
                                            <td className="p-2.5 text-right text-slate-500">
                                              {settings.currencySymbol}{inv.paidAmount.toFixed(2)}
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-amber-700">
                                              {settings.currencySymbol}{inv.dueAmount.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. SUPPLIER PAYABLE WITH AGING REPORT */}
        {activeReport === 'SUPP_PAY' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <span>Supplier Payables & Aging Analysis Report</span>
                  <span className="text-xs font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                    {supplierAgingData.length} Vendors
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Accounts payable aging categorized into 0-30, 31-60, 61-90, and 90+ days intervals
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleExportCSV(
                      'Supplier_Aging_Report',
                      ['Code', 'SupplierName', 'Company', 'Phone', '0_30_Days', '31_60_Days', '61_90_Days', '90_Plus_Days', 'TotalPayable'],
                      supplierAgingData.map((s) => [
                        s.supplier.code,
                        s.supplier.name,
                        s.supplier.companyName || '',
                        s.supplier.phone,
                        s.bucket0_30,
                        s.bucket31_60,
                        s.bucket61_90,
                        s.bucket90Plus,
                        s.totalPayable
                      ])
                    )
                  }
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" /> Export CSV with Aging
                </button>
              </div>
            </div>

            {/* Supplier Aging Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl col-span-2 sm:col-span-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Payables</span>
                <div className="text-lg font-mono font-black text-purple-400 mt-1">
                  {settings.currencySymbol} {supplierAgingTotals.totalPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{supplierAgingData.length} vendor accounts</div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase">0 - 30 Days</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
                    {supplierAgingTotals.pct0_30.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-emerald-800 mt-1">
                  {settings.currencySymbol} {supplierAgingTotals.total0_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">Within terms</div>
              </div>

              <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-sky-800 font-bold uppercase">31 - 60 Days</span>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded font-mono">
                    {supplierAgingTotals.pct31_60.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-sky-800 mt-1">
                  {settings.currencySymbol} {supplierAgingTotals.total31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-sky-600 mt-0.5 font-medium">Pending schedule</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-800 font-bold uppercase">61 - 90 Days</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-mono">
                    {supplierAgingTotals.pct61_90.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-amber-800 mt-1">
                  {settings.currencySymbol} {supplierAgingTotals.total61_90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5 font-medium">Overdue payment</div>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-rose-800 font-bold uppercase">90+ Days</span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded font-mono">
                    {supplierAgingTotals.pct90Plus.toFixed(1)}%
                  </span>
                </div>
                <div className="text-base font-mono font-black text-rose-800 mt-1">
                  {settings.currencySymbol} {supplierAgingTotals.total90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-rose-600 mt-0.5 font-bold">Critical liability</div>
              </div>
            </div>

            {/* Visual Aging Bar */}
            {supplierAgingTotals.totalPayables > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-slate-600">
                  <span>Payables Aging Distribution</span>
                  <span className="font-mono">{supplierAgingTotals.totalPayables.toLocaleString('en-US')} Total</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full flex overflow-hidden p-0.5 border border-slate-200">
                  {supplierAgingTotals.pct0_30 > 0 && (
                    <div
                      style={{ width: `${supplierAgingTotals.pct0_30}%` }}
                      className="bg-emerald-500 h-full rounded-xs transition-all"
                      title={`0-30 Days: ${supplierAgingTotals.pct0_30.toFixed(1)}%`}
                    />
                  )}
                  {supplierAgingTotals.pct31_60 > 0 && (
                    <div
                      style={{ width: `${supplierAgingTotals.pct31_60}%` }}
                      className="bg-sky-500 h-full rounded-xs transition-all"
                      title={`31-60 Days: ${supplierAgingTotals.pct31_60.toFixed(1)}%`}
                    />
                  )}
                  {supplierAgingTotals.pct61_90 > 0 && (
                    <div
                      style={{ width: `${supplierAgingTotals.pct61_90}%` }}
                      className="bg-amber-500 h-full rounded-xs transition-all"
                      title={`61-90 Days: ${supplierAgingTotals.pct61_90.toFixed(1)}%`}
                    />
                  )}
                  {supplierAgingTotals.pct90Plus > 0 && (
                    <div
                      style={{ width: `${supplierAgingTotals.pct90Plus}%` }}
                      className="bg-rose-500 h-full rounded-xs transition-all"
                      title={`90+ Days: ${supplierAgingTotals.pct90Plus.toFixed(1)}%`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search supplier by name, code, phone, or company..."
                  value={suppSearchQuery}
                  onChange={(e) => setSuppSearchQuery(e.target.value)}
                  className="bg-transparent border-none text-xs w-full focus:outline-hidden text-slate-800"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Bucket:
                </span>
                <button
                  onClick={() => setSuppAgingFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    suppAgingFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({supplierAgingData.length})
                </button>
                <button
                  onClick={() => setSuppAgingFilter('0_30')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    suppAgingFilter === '0_30'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  0-30d
                </button>
                <button
                  onClick={() => setSuppAgingFilter('31_60')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    suppAgingFilter === '31_60'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-sky-800 border border-sky-200 hover:bg-sky-50'
                  }`}
                >
                  31-60d
                </button>
                <button
                  onClick={() => setSuppAgingFilter('61_90')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    suppAgingFilter === '61_90'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  61-90d
                </button>
                <button
                  onClick={() => setSuppAgingFilter('90_PLUS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    suppAgingFilter === '90_PLUS'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  90+d
                </button>
              </div>
            </div>

            {/* Supplier Aging Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="p-3 w-10"></th>
                    <th className="p-3">Code & Supplier</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3 text-right text-emerald-800 bg-emerald-50/50">0 - 30 Days</th>
                    <th className="p-3 text-right text-sky-800 bg-sky-50/50">31 - 60 Days</th>
                    <th className="p-3 text-right text-amber-800 bg-amber-50/50">61 - 90 Days</th>
                    <th className="p-3 text-right text-rose-800 bg-rose-50/50">90+ Days</th>
                    <th className="p-3 text-right font-black text-slate-900">Total Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSupplierAging.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        No payable records matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSupplierAging.map((item) => {
                      const isExpanded = expandedSupplierId === item.supplier.id;
                      return (
                        <React.Fragment key={item.supplier.id}>
                          <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50/90' : ''}`}>
                            <td className="p-3 text-center">
                              {item.pendingBills.length > 0 && (
                                <button
                                  onClick={() => setExpandedSupplierId(isExpanded ? null : item.supplier.id)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded-sm cursor-pointer"
                                  title="Expand pending bills"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-[10px] text-slate-500 block font-bold">{item.supplier.code}</span>
                              <span className="font-bold text-slate-900 text-sm">{item.supplier.name}</span>
                              {item.supplier.companyName && (
                                <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({item.supplier.companyName})</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-600">{item.supplier.phone || '-'}</td>
                            <td className="p-3 text-right font-mono font-bold bg-emerald-50/20 text-emerald-700">
                              {item.bucket0_30 > 0 ? `${settings.currencySymbol} ${item.bucket0_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold bg-sky-50/20 text-sky-700">
                              {item.bucket31_60 > 0 ? `${settings.currencySymbol} ${item.bucket31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold bg-amber-50/20 text-amber-700">
                              {item.bucket61_90 > 0 ? `${settings.currencySymbol} ${item.bucket61_90.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold bg-rose-50/20 text-rose-700">
                              {item.bucket90Plus > 0 ? `${settings.currencySymbol} ${item.bucket90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-rose-700 text-sm">
                              {settings.currencySymbol} {item.totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>

                          {/* Expanded Pending Purchase Bills Sub-table */}
                          {isExpanded && item.pendingBills.length > 0 && (
                            <tr>
                              <td colSpan={8} className="p-0 bg-slate-100/70 border-y border-slate-200">
                                <div className="p-3.5 pl-12 space-y-2">
                                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Unpaid Purchase Bills for {item.supplier.name} ({item.pendingBills.length} Bills)</span>
                                  </div>

                                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                          <th className="p-2.5">Purchase No</th>
                                          <th className="p-2.5">Date</th>
                                          <th className="p-2.5">Age in Days</th>
                                          <th className="p-2.5">Aging Category</th>
                                          <th className="p-2.5 text-right">Bill Total</th>
                                          <th className="p-2.5 text-right">Paid</th>
                                          <th className="p-2.5 text-right font-bold text-slate-900">Pending Due</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-mono">
                                        {item.pendingBills.map((pur) => (
                                          <tr key={pur.id} className="hover:bg-slate-50">
                                            <td className="p-2.5 font-bold text-purple-600">{pur.purchaseNumber}</td>
                                            <td className="p-2.5 text-slate-500 font-sans">{pur.date}</td>
                                            <td className="p-2.5 font-bold text-slate-700">{pur.ageDays} days ago</td>
                                            <td className="p-2.5 font-sans">
                                              <span
                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                  pur.bucket === '0_30'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : pur.bucket === '31_60'
                                                    ? 'bg-sky-100 text-sky-800'
                                                    : pur.bucket === '61_90'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-rose-100 text-rose-800 font-black'
                                                }`}
                                              >
                                                {pur.bucket === '0_30'
                                                  ? '0-30 Days'
                                                  : pur.bucket === '31_60'
                                                  ? '31-60 Days'
                                                  : pur.bucket === '61_90'
                                                  ? '61-90 Days'
                                                  : '90+ Days Overdue'}
                                              </span>
                                            </td>
                                            <td className="p-2.5 text-right text-slate-600">
                                              {settings.currencySymbol}{pur.grandTotal.toFixed(2)}
                                            </td>
                                            <td className="p-2.5 text-right text-slate-500">
                                              {settings.currencySymbol}{pur.paidAmount.toFixed(2)}
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-rose-700">
                                              {settings.currencySymbol}{pur.dueAmount.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. CASH BOOK */}
        {activeReport === 'CASH_BOOK' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Cash Book Statement</h3>
                <p className="text-xs text-slate-500">Chronological history of cash receipts and cash disbursements</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <th className="p-3">Date</th>
                    <th className="p-3">Ref No</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Cash In (+)</th>
                    <th className="p-3 text-right">Cash Out (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {cashBookRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-slate-500">{row.date}</td>
                      <td className="p-3 font-mono font-bold">{row.ref}</td>
                      <td className="p-3 font-bold">{row.desc}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {row.type === 'IN' ? `+ ${settings.currencySymbol}${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">
                        {row.type === 'OUT' ? `- ${settings.currencySymbol}${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. PROFIT REPORT */}
        {activeReport === 'PROFIT' && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="text-center pb-4 border-b border-slate-200">
              <h3 className="font-extrabold text-2xl text-slate-900">Profit & Loss Statement</h3>
              <p className="text-xs text-slate-500">Summary Income Statement for Busy UFO</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center text-slate-700 font-bold">
                <span>Total Sales Revenue:</span>
                <span className="text-emerald-700 text-base">
                  + {settings.currencySymbol} {totalSalesRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Less: Cost of Goods Sold (COGS):</span>
                <span className="text-rose-600">
                  - {settings.currencySymbol} {cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center font-extrabold text-slate-900 pt-2 border-t border-slate-300">
                <span>Gross Operating Profit:</span>
                <span>
                  {settings.currencySymbol} {grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 pt-2">
                <span>Less: Business Expenses:</span>
                <span className="text-rose-600">
                  - {settings.currencySymbol} {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-xl font-black pt-3 border-t-2 border-slate-900 text-slate-950">
                <span>Net Business Profit:</span>
                <span className={netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {settings.currencySymbol} {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
