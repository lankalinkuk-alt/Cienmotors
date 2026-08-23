import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  Building2,
  DollarSign,
  PieChart,
  Clock,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { Customer, Supplier, Product, SaleInvoice, PurchaseInvoice, Expense, AppSettings, Company, PdcTransaction } from '../types';
import { StorageService } from '../lib/storage';
import { ReportActionsToolbar } from './ReportActionsToolbar';

interface MisReportsProps {
  sales: SaleInvoice[];
  purchases: PurchaseInvoice[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  expenses: Expense[];
  pdcs: PdcTransaction[];
  settings: AppSettings;
  company?: Company;
}

type MisCategory =
  | 'SALES'
  | 'PURCHASE'
  | 'INVENTORY'
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'PROFITABILITY'
  | 'CASH_BANK'
  | 'EXPENSE'
  | 'PDC';

export const MisReports: React.FC<MisReportsProps> = ({
  sales,
  purchases,
  customers,
  suppliers,
  products,
  expenses,
  pdcs,
  settings,
  company
}) => {
  const [activeCategory, setActiveCategory] = useState<MisCategory>('SALES');

  const categories: Array<{ id: MisCategory; label: string; icon: any; count: number }> = [
    { id: 'SALES', label: 'Sales MIS', icon: TrendingUp, count: sales.length },
    { id: 'PURCHASE', label: 'Purchase MIS', icon: ShoppingCart, count: purchases.length },
    { id: 'INVENTORY', label: 'Inventory MIS', icon: Package, count: products.length },
    { id: 'RECEIVABLE', label: 'Receivables Ageing', icon: Users, count: customers.length },
    { id: 'PAYABLE', label: 'Payables MIS', icon: Building2, count: suppliers.length },
    { id: 'PROFITABILITY', label: 'Profitability MIS', icon: BarChart3, count: sales.length },
    { id: 'CASH_BANK', label: 'Cash & Bank MIS', icon: DollarSign, count: 2 },
    { id: 'EXPENSE', label: 'Expense MIS', icon: PieChart, count: expenses.length },
    { id: 'PDC', label: 'PDC Register MIS', icon: Clock, count: pdcs.length }
  ];

  const { misTitle, misSummaryText } = useMemo(() => {
    let title = 'MIS Analytics Report';
    let lines: string[] = [
      `📊 *${settings.companyName || 'Company Name'}*`,
      `*Management Information System (MIS) Report*`,
      `*Category:* ${activeCategory}`,
      `*Date:* ${new Date().toISOString().split('T')[0]}`,
      `------------------------------`
    ];

    if (activeCategory === 'SALES') {
      title = 'Sales MIS Analytics';
      const totRev = sales.reduce((sum, s) => sum + s.grandTotal, 0);
      const totDue = sales.reduce((sum, s) => sum + s.dueAmount, 0);
      lines.push(
        `• Total Invoices: ${sales.length}`,
        `• Total Sales Revenue: ${settings.currencySymbol} ${totRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Outstanding Due: ${settings.currencySymbol} ${totDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
    } else if (activeCategory === 'PURCHASE') {
      title = 'Purchase MIS Analytics';
      const totPur = purchases.reduce((sum, p) => sum + p.grandTotal, 0);
      const totDue = purchases.reduce((sum, p) => sum + p.dueAmount, 0);
      lines.push(
        `• Total Purchase Bills: ${purchases.length}`,
        `• Total Purchase Cost: ${settings.currencySymbol} ${totPur.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `• Total Supplier Payables: ${settings.currencySymbol} ${totDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
    } else if (activeCategory === 'INVENTORY') {
      title = 'Inventory MIS Analytics';
      const totStock = products.reduce((sum, p) => sum + p.currentStock, 0);
      const totCostVal = products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
      lines.push(
        `• Total Item Types: ${products.length}`,
        `• Total In-Stock Quantity: ${totStock}`,
        `• Total Stock Cost Value: ${settings.currencySymbol} ${totCostVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
    } else if (activeCategory === 'RECEIVABLE') {
      title = 'Receivables Ageing MIS';
      const totDue = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);
      lines.push(
        `• Total Debtors: ${customers.length}`,
        `• Total Outstanding Receivables: ${settings.currencySymbol} ${totDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
    } else if (activeCategory === 'PAYABLE') {
      title = 'Payables MIS';
      const totPay = suppliers.reduce((sum, s) => sum + s.payableBalance, 0);
      lines.push(
        `• Total Vendors: ${suppliers.length}`,
        `• Total Vendor Payables: ${settings.currencySymbol} ${totPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
    } else if (activeCategory === 'EXPENSE') {
      title = 'Expense MIS';
      const totExp = expenses.reduce((sum, e) => sum + e.amount, 0);
      lines.push(
        `• Total Expense Entries: ${expenses.length}`,
        `• Total Operating Expenses: ${settings.currencySymbol} ${totExp.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      );
    } else if (activeCategory === 'PDC') {
      title = 'PDC Register MIS';
      const pendingReceived = pdcs.filter((p) => p.type === 'RECEIVED' && p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
      const pendingIssued = pdcs.filter((p) => p.type === 'ISSUED' && p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
      lines.push(
        `• Total PDC Transactions: ${pdcs.length}`,
        `• Pending Received PDCs: ${settings.currencySymbol} ${pendingReceived.toFixed(2)}`,
        `• Pending Issued PDCs: ${settings.currencySymbol} ${pendingIssued.toFixed(2)}`
      );
    } else {
      title = `${activeCategory} MIS Report`;
      lines.push(`• Record count: ${categories.find((c) => c.id === activeCategory)?.count || 0}`);
    }

    return {
      misTitle: title,
      misSummaryText: lines.join('\n')
    };
  }, [activeCategory, sales, purchases, products, customers, suppliers, expenses, pdcs, settings, categories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <span>Management Information System (MIS) Reports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Executive intelligence reports for sales, stock, margin, cash flow, and ageing analytics
          </p>
        </div>

        <ReportActionsToolbar
          reportTitle={misTitle}
          summaryText={misSummaryText}
          settings={settings}
        />
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Vertical Menu */}
        <div className="lg:col-span-3 space-y-1.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full text-left p-3.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                  <span>{cat.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Detail Pane */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 overflow-hidden">
          {activeCategory === 'SALES' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Sales Analytics & Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5 text-right">Grand Total ({settings.currencySymbol})</th>
                      <th className="p-2.5 text-right">Paid</th>
                      <th className="p-2.5 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold font-mono text-blue-600">{s.invoiceNumber}</td>
                        <td className="p-2.5">{s.date}</td>
                        <td className="p-2.5 font-medium">{s.customerName}</td>
                        <td className="p-2.5 text-right font-bold">{s.grandTotal.toFixed(2)}</td>
                        <td className="p-2.5 text-right text-emerald-600">{s.paidAmount.toFixed(2)}</td>
                        <td className="p-2.5 text-right text-rose-600 font-bold">{s.dueAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'PURCHASE' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Purchase Procurement MIS</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Bill #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Supplier</th>
                      <th className="p-2.5 text-right">Grand Total ({settings.currencySymbol})</th>
                      <th className="p-2.5 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold font-mono text-blue-600">{p.purchaseNumber}</td>
                        <td className="p-2.5">{p.date}</td>
                        <td className="p-2.5 font-medium">{p.supplierName}</td>
                        <td className="p-2.5 text-right font-bold">{p.grandTotal.toFixed(2)}</td>
                        <td className="p-2.5 text-right text-emerald-600">{p.paidAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'INVENTORY' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Stock Inventory Valuation MIS</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5">Item Name</th>
                      <th className="p-2.5 text-center">Stock</th>
                      <th className="p-2.5 text-right">Cost Price</th>
                      <th className="p-2.5 text-right">Selling Price</th>
                      <th className="p-2.5 text-right">Stock Valuation ({settings.currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-blue-600">{p.code}</td>
                        <td className="p-2.5 font-medium">{p.name}</td>
                        <td className="p-2.5 text-center font-bold">{p.currentStock} {p.unit}</td>
                        <td className="p-2.5 text-right font-mono">{p.costPrice.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono">{p.sellingPrice.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {(p.currentStock * p.costPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'RECEIVABLE' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Customer Receivables Ageing</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Customer Name</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5 text-right">Opening Bal</th>
                      <th className="p-2.5 text-right">Outstanding Bal ({settings.currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{c.name}</td>
                        <td className="p-2.5 text-slate-500">{c.phone || '-'}</td>
                        <td className="p-2.5 text-right font-mono">{c.openingBalance.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                          {c.outstandingBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'PAYABLE' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Supplier Payables MIS</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Supplier Name</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5 text-right">Opening Bal</th>
                      <th className="p-2.5 text-right">Payable Balance ({settings.currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{s.name}</td>
                        <td className="p-2.5 text-slate-500">{s.phone || '-'}</td>
                        <td className="p-2.5 text-right font-mono">{s.openingBalance.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-700">
                          {s.payableBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'PROFITABILITY' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Invoice-Level Profitability</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Invoice #</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5 text-right">Revenue</th>
                      <th className="p-2.5 text-right">Est. Cost</th>
                      <th className="p-2.5 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((s) => {
                      const estCost = (s.items || []).reduce((sum, item) => {
                        const prod = products.find((p) => p.id === item.productId);
                        return sum + (item.quantity * (prod?.costPrice || item.unitPrice * 0.7));
                      }, 0);
                      const grossMargin = s.grandTotal - estCost;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-blue-600">{s.invoiceNumber}</td>
                          <td className="p-2.5">{s.customerName}</td>
                          <td className="p-2.5 text-right font-mono">{s.grandTotal.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono text-slate-500">{estCost.toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                            {grossMargin.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'CASH_BANK' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Cash & Bank Position</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Cash in Hand</span>
                  <p className="text-2xl font-black font-mono text-slate-900 mt-1">
                    {settings.currencySymbol} {StorageService.calculateCashBalance(company?.id).toFixed(2)}
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <span className="text-xs uppercase tracking-wider text-blue-700 font-bold">Bank Balance (Books)</span>
                  <p className="text-2xl font-black font-mono text-blue-900 mt-1">
                    {settings.currencySymbol} 0.00
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'EXPENSE' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Expense Category Analytics</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Expense #</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Mode</th>
                      <th className="p-2.5 text-right">Amount ({settings.currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-blue-600">{e.expenseNumber}</td>
                        <td className="p-2.5">{e.date}</td>
                        <td className="p-2.5 font-bold">{e.category}</td>
                        <td className="p-2.5 text-slate-600">{e.paymentMode}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{e.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeCategory === 'PDC' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-200 pb-2">Post-Dated Cheques MIS</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">Cheque Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Party</th>
                      <th className="p-2.5">Cheque No</th>
                      <th className="p-2.5 text-right">Amount ({settings.currencySymbol})</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pdcs.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2.5">{p.chequeDate}</td>
                        <td className="p-2.5 font-bold">{p.type}</td>
                        <td className="p-2.5 font-medium">{p.partyName}</td>
                        <td className="p-2.5 font-mono font-bold text-blue-600">{p.chequeNumber}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{p.amount.toFixed(2)}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-800">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
