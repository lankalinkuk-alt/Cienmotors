import React, { useState } from 'react';
import { Package, X, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Product, AppSettings } from '../types';
import { StorageService } from '../lib/storage';
import { ReportActionsToolbar } from './ReportActionsToolbar';

interface ItemHistoryModalProps {
  products: Product[];
  settings: AppSettings;
  initialProductId?: string | null;
  onClose: () => void;
}

export const ItemHistoryModal: React.FC<ItemHistoryModalProps> = ({
  products,
  settings,
  initialProductId,
  onClose
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || products[0]?.id || ''
  );
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const activeProduct = products.find((p) => p.id === selectedProductId || p.code === selectedProductId);

  const history = StorageService.getItemHistory(
    selectedProductId,
    fromDate || undefined,
    toDate || undefined
  );

  const totalIn = history.reduce((sum, h) => sum + h.quantityIn, 0);
  const totalOut = history.reduce((sum, h) => sum + h.quantityOut, 0);
  const currentStock = history.length > 0 ? history[history.length - 1].runningStock : (activeProduct?.currentStock || 0);

  const itemHistorySummaryText = [
    `📦 *${settings.companyName || 'Company Name'}*`,
    `*Item Stock Movement History: ${activeProduct?.name || 'Item'}* (${activeProduct?.code || ''})`,
    `*Period:* ${fromDate || 'Beginning'} to ${toDate || 'Present'}`,
    `------------------------------`,
    `• Total Quantity In (+): ${totalIn} ${activeProduct?.unit || 'Units'}`,
    `• Total Quantity Out (-): ${totalOut} ${activeProduct?.unit || 'Units'}`,
    `• Current Stock Balance: ${currentStock} ${activeProduct?.unit || 'Units'}`,
    `\n*Recent Item Movements:*`,
    ...history.slice(-5).map((h) => `• ${h.date} [${h.voucherType} ${h.voucherNo}]: ${h.partyName} - In:${h.quantityIn} Out:${h.quantityOut} [Bal:${h.runningStock}]`)
  ].join('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#2563EB] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-400 text-blue-900 font-bold rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Item Stock History (Ctrl + I)</h3>
              <p className="text-xs text-blue-100">Audit inventory movement, purchases (In) and sales (Out)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ReportActionsToolbar
              reportTitle={`Item Stock History - ${activeProduct?.name || ''}`}
              summaryText={itemHistorySummaryText}
              settings={settings}
              compact
            />
            <button
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs font-semibold">
          <div className="sm:col-span-6">
            <label className="block text-slate-600 mb-1">Select Product Item</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}) - Stock: {p.currentStock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-slate-600 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800"
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total Qty In</span>
                <span className="text-base font-black text-emerald-800">{totalIn} {activeProduct?.unit || 'Units'}</span>
              </div>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center font-bold">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-600 block">Total Qty Out</span>
                <span className="text-base font-black text-rose-800">{totalOut} {activeProduct?.unit || 'Units'}</span>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-200 text-blue-800 flex items-center justify-center font-bold">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 block">Current Stock Balance</span>
                <span className="text-base font-black text-blue-900">{currentStock} {activeProduct?.unit || 'Units'}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Voucher Type</th>
                  <th className="p-2.5">Voucher No</th>
                  <th className="p-2.5">Party / Source</th>
                  <th className="p-2.5 text-center">Qty In</th>
                  <th className="p-2.5 text-center">Qty Out</th>
                  <th className="p-2.5 text-right">Rate ({settings.currencySymbol})</th>
                  <th className="p-2.5 text-right">Running Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                      No stock movement history found for this product item.
                    </td>
                  </tr>
                ) : (
                  history.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-medium whitespace-nowrap text-slate-700">{row.date}</td>
                      <td className="p-2.5 font-semibold text-slate-600">{row.voucherType}</td>
                      <td className="p-2.5 font-bold font-mono text-blue-600">{row.voucherNo}</td>
                      <td className="p-2.5 text-slate-800">{row.partyName}</td>
                      <td className="p-2.5 text-center font-bold text-emerald-700">
                        {row.quantityIn > 0 ? `+${row.quantityIn}` : '-'}
                      </td>
                      <td className="p-2.5 text-center font-bold text-rose-700">
                        {row.quantityOut > 0 ? `-${row.quantityOut}` : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono">{row.rate.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono font-black text-slate-900 bg-slate-50">
                        {row.runningStock} {activeProduct?.unit || ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-semibold">
            Product: <strong className="text-slate-900">{activeProduct?.name || selectedProductId}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
