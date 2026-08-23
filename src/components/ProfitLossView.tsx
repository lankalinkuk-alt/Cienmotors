import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, DollarSign, PieChart } from 'lucide-react';
import { AppSettings, Company } from '../types';
import { StorageService } from '../lib/storage';
import { ReportActionsToolbar } from './ReportActionsToolbar';
import { getDateRangePresets } from '../lib/dateUtils';

interface ProfitLossViewProps {
  settings: AppSettings;
  company?: Company;
}

export const ProfitLossView: React.FC<ProfitLossViewProps> = ({ settings, company }) => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const pnl = StorageService.getProfitAndLoss(
    fromDate || undefined,
    toDate || undefined,
    company?.id
  );

  const pnlSummaryText = useMemo(() => {
    return [
      `📊 *${settings.companyName || 'Company Name'}*`,
      `*Profit & Loss Statement*`,
      `*Period:* ${fromDate || 'Beginning'} to ${toDate || 'Present'}`,
      `------------------------------`,
      `• Total Sales Revenue: ${settings.currencySymbol} ${pnl.netRevenue.toFixed(2)}`,
      `• Cost of Goods Sold (COGS): -${settings.currencySymbol} ${pnl.cogs.toFixed(2)}`,
      `• Gross Profit: ${settings.currencySymbol} ${pnl.grossProfit.toFixed(2)}`,
      `• Total Operating Expenses: -${settings.currencySymbol} ${pnl.totalOperatingExpenses.toFixed(2)}`,
      `------------------------------`,
      `*NET ${pnl.isProfit ? 'PROFIT' : 'LOSS'}:* ${settings.currencySymbol} ${Math.abs(pnl.netProfit).toFixed(2)}`
    ].join('\n');
  }, [pnl, fromDate, toDate, settings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-blue-600" />
            <span>Profit & Loss Statement (Income Statement)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Financial performance summary including revenue, COGS, operating expenses, and net income
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {Object.entries(getDateRangePresets()).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFromDate(p.from);
                  setToDate(p.to);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  fromDate === p.from && toDate === p.to
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-800"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-800"
            />
          </div>

          <ReportActionsToolbar
            reportTitle="Profit & Loss Statement"
            summaryText={pnlSummaryText}
            settings={settings}
            compact
          />
        </div>
      </div>

      {/* Net Profit Banner */}
      <div
        className={`p-6 rounded-2xl border flex items-center justify-between shadow-xs ${
          pnl.isProfit
            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500'
            : 'bg-gradient-to-r from-rose-600 to-red-700 text-white border-rose-500'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-bold">
            {pnl.isProfit ? <TrendingUp className="w-7 h-7" /> : <TrendingDown className="w-7 h-7" />}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white/80 block">
              {pnl.isProfit ? 'Net Operating Profit' : 'Net Operating Loss'}
            </span>
            <span className="text-3xl font-black font-mono">
              {settings.currencySymbol} {Math.abs(pnl.netProfit).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="text-right text-xs text-white/80 space-y-1">
          <div>Gross Margin: <strong className="text-white">{pnl.netRevenue > 0 ? ((pnl.grossProfit / pnl.netRevenue) * 100).toFixed(1) : '0.0'}%</strong></div>
          <div>Net Profit Margin: <strong className="text-white">{pnl.netRevenue > 0 ? ((pnl.netProfit / pnl.netRevenue) * 100).toFixed(1) : '0.0'}%</strong></div>
        </div>
      </div>

      {/* Structured P&L Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trading Account (Revenue & COGS) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white p-4 font-bold text-sm">
            I. Trading Account (Sales & Cost of Sales)
          </div>

          <div className="p-4 space-y-4 text-xs flex-1">
            {/* Sales Revenue */}
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-2">Operating Revenue</p>
              <div className="space-y-1.5 pl-2">
                <div className="flex justify-between text-slate-700">
                  <span>Gross Sales Invoices</span>
                  <span className="font-mono">{settings.currencySymbol} {pnl.grossSales.toFixed(2)}</span>
                </div>
                {pnl.totalDiscounts > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Less: Discounts Allowed</span>
                    <span className="font-mono">- {settings.currencySymbol} {pnl.totalDiscounts.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Net Operating Revenue</span>
                  <span className="font-mono">{settings.currencySymbol} {pnl.netRevenue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* COGS */}
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-2">Cost of Goods Sold (COGS)</p>
              <div className="space-y-1.5 pl-2">
                <div className="flex justify-between text-slate-700">
                  <span>Opening Stock Valuation</span>
                  <span className="font-mono">{settings.currencySymbol} {pnl.openingStockVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Add: Total Purchase Invoices</span>
                  <span className="font-mono">+ {settings.currencySymbol} {pnl.totalPurchases.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Less: Closing Stock Valuation</span>
                  <span className="font-mono">- {settings.currencySymbol} {pnl.closingStockVal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                  <span>Total Cost of Goods Sold</span>
                  <span className="font-mono">{settings.currencySymbol} {pnl.cogs.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between font-black text-sm text-slate-900">
            <span>Gross Operating Profit</span>
            <span className="font-mono text-emerald-700">{settings.currencySymbol} {pnl.grossProfit.toFixed(2)}</span>
          </div>
        </div>

        {/* Operating Expenses & Net Income */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="bg-slate-800 text-white p-4 font-bold text-sm">
            II. Income Statement (Operating Expenses)
          </div>

          <div className="p-4 space-y-4 text-xs flex-1">
            <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">Administrative & Operating Expenses</p>
            {Object.keys(pnl.expenseBreakdown).length === 0 ? (
              <p className="text-slate-400 italic py-4">No operating expense vouchers logged in period.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(pnl.expenseBreakdown).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-slate-700 p-2 rounded-lg bg-slate-50">
                    <span className="font-medium">{cat}</span>
                    <span className="font-mono font-bold text-slate-900">{settings.currencySymbol} {amt.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-100 p-4 border-t border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 font-bold">
              <span>Total Operating Expenses</span>
              <span className="font-mono text-rose-700">{settings.currencySymbol} {pnl.totalOperatingExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-base text-slate-900 pt-2 border-t border-slate-300">
              <span>Net Profit / (Loss)</span>
              <span className={`font-mono ${pnl.isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                {settings.currencySymbol} {pnl.netProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
