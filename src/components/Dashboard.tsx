import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Truck,
  Package,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  ShoppingCart,
  ShoppingBag
} from 'lucide-react';
import { DashboardSummary, TransactionRecord, AppSettings, PageType } from '../types';

interface DashboardProps {
  summary: DashboardSummary;
  recentTransactions: TransactionRecord[];
  settings: AppSettings;
  onNavigate: (page: PageType) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  recentTransactions,
  settings,
  onNavigate
}) => {
  const formatCurrency = (amount: number) => {
    return `${settings.currencySymbol} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Quick Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Business Overview</h2>
          <p className="text-xs text-slate-500">Quick shortcuts to daily tasks & billing operations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('sales')}
            className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#eab308] text-[#1E293B] font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4 text-[#1E293B]" />
            <span>+ Create Invoice</span>
          </button>
          <button
            onClick={() => onNavigate('purchases')}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4 text-[#FACC15]" />
            <span>New Purchase</span>
          </button>
          <button
            onClick={() => onNavigate('payments')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>Customer Receipt</span>
          </button>
          <button
            onClick={() => onNavigate('products')}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
          >
            <Package className="w-4 h-4 text-slate-600" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="p-2 bg-blue-50 text-[#2563EB] rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#2563EB] font-mono">
            {formatCurrency(summary.todaySales)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Total revenue recorded today</p>
        </div>

        {/* Cash Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              Cash Balance
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {formatCurrency(summary.cashBalance)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Cash in drawer & bank</p>
        </div>

        {/* Customer Outstanding */}
        <div
          onClick={() => onNavigate('customers')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              Customer Outstanding
            </span>
            <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-500 font-mono">
            {formatCurrency(summary.customerOutstanding)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Total credit owed by customers</p>
        </div>

        {/* Low Stock Alert */}
        <div
          onClick={() => onNavigate('products')}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              Low Stock Items
            </span>
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-500 font-mono">
            {summary.lowStockCount < 10 && summary.lowStockCount > 0 ? `0${summary.lowStockCount}` : summary.lowStockCount} Items
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {summary.lowStockCount > 0 ? 'Items below reorder limit' : 'Stock level healthy'}
          </p>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
            Today's Purchases
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatCurrency(summary.todayPurchases)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
            Supplier Payable Balance
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatCurrency(summary.supplierPayable)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">
            Active Catalog Products
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {summary.totalProducts} Items
          </div>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Recent Transactions</h3>
            <p className="text-xs text-slate-500">
              Latest sales, purchases, receipts & expenses
            </p>
          </div>
          <button
            onClick={() => onNavigate('sales')}
            className="text-sm font-semibold text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No transactions recorded yet. Click '+ Create Invoice' to start!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-bold">
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4">Customer/Supplier</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentTransactions.map((tx) => {
                  const isPositive = tx.type === 'SALE' || tx.type === 'RECEIPT';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm font-bold text-[#2563EB]">
                        {tx.refNumber}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{tx.partyName}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">
                        {tx.type}
                      </td>
                      <td className="px-6 py-4 font-bold font-mono">
                        <span className={isPositive ? 'text-emerald-600' : 'text-slate-900'}>
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {tx.type === 'SALE' && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                            PAID
                          </span>
                        )}
                        {tx.type === 'PURCHASE' && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                            CREDIT
                          </span>
                        )}
                        {tx.type === 'RECEIPT' && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                            RECEIVED
                          </span>
                        )}
                        {tx.type === 'PAYMENT' && (
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                            PAID
                          </span>
                        )}
                        {tx.type === 'EXPENSE' && (
                          <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">
                            EXPENSE
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
