import React, { useState } from 'react';
import { BookOpen, X, Search, Calendar, Download, Printer } from 'lucide-react';
import { Customer, Supplier, AppSettings } from '../types';
import { StorageService } from '../lib/storage';
import { ReportActionsToolbar } from './ReportActionsToolbar';

interface LedgerModalProps {
  customers: Customer[];
  suppliers: Supplier[];
  settings: AppSettings;
  initialLedgerId?: string | null;
  onClose: () => void;
}

export const LedgerModal: React.FC<LedgerModalProps> = ({
  customers,
  suppliers,
  settings,
  initialLedgerId,
  onClose
}) => {
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>(
    initialLedgerId || customers[0]?.id || 'Cash Account'
  );
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const statement = StorageService.getLedgerStatement(
    selectedLedgerId,
    fromDate || undefined,
    toDate || undefined
  );

  const ledgerSummaryText = [
    `📖 *${settings.companyName || 'Company Name'}*`,
    `*Ledger Statement: ${statement.ledgerName}* (${statement.accountGroup})`,
    `*Period:* ${fromDate || 'Beginning'} to ${toDate || 'Present'}`,
    `------------------------------`,
    `• Opening Balance: ${settings.currencySymbol} ${statement.openingBalance.toFixed(2)} ${statement.openingType}`,
    `• Total Debit (+): ${settings.currencySymbol} ${statement.totalDebit.toFixed(2)}`,
    `• Total Credit (-): ${settings.currencySymbol} ${statement.totalCredit.toFixed(2)}`,
    `• Closing Balance: ${settings.currencySymbol} ${statement.closingBalance.toFixed(2)} ${statement.closingType}`,
    `\n*Recent Transactions:*`,
    ...statement.entries.slice(-5).map((e) => `• ${e.date} [${e.voucherType} ${e.voucherNo}]: ${e.particulars} - Dr:${e.debit} Cr:${e.credit}`)
  ].join('\n');

  // Check if selected ledger matches a customer or supplier to prefill phone
  const matchedCustomer = customers.find((c) => c.id === selectedLedgerId);
  const matchedSupplier = suppliers.find((s) => s.id === selectedLedgerId);
  const recipientPhone = matchedCustomer?.phone || matchedSupplier?.phone || '';
  const recipientName = matchedCustomer?.name || matchedSupplier?.name || statement.ledgerName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#2563EB] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-400 text-blue-900 font-bold rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Ledger Statement (Ctrl + L)</h3>
              <p className="text-xs text-blue-100">View complete debit / credit transaction ledger for any account</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ReportActionsToolbar
              reportTitle={`Ledger - ${statement.ledgerName}`}
              summaryText={ledgerSummaryText}
              settings={settings}
              recipientName={recipientName}
              recipientPhone={recipientPhone}
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

        {/* Filter Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs font-semibold">
          <div className="sm:col-span-6">
            <label className="block text-slate-600 mb-1">Select Account / Party Ledger</label>
            <select
              value={selectedLedgerId}
              onChange={(e) => setSelectedLedgerId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="Special Accounts">
                <option value="Cash Account">Cash Account (Cash-in-Hand)</option>
                <option value="Sales Account">Sales Account (Sales Revenue)</option>
                <option value="Purchase Account">Purchase Account (Purchase Cost)</option>
              </optgroup>
              <optgroup label="Customers (Sundry Debtors)">
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) - {c.accountGroup || 'Sundry Debtors'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Suppliers (Sundry Creditors)">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.accountGroup || 'Sundry Creditors'}
                  </option>
                ))}
              </optgroup>
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

        {/* Statement Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Header Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                Opening Balance
              </span>
              <span className="text-base font-black text-slate-800 font-mono">
                {settings.currencySymbol} {statement.openingBalance.toFixed(2)}{' '}
                <span className="text-xs font-bold text-blue-600">{statement.openingType}</span>
              </span>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 block">
                Total Debit
              </span>
              <span className="text-base font-black text-emerald-700 font-mono">
                {settings.currencySymbol} {statement.totalDebit.toFixed(2)}
              </span>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
              <span className="text-[10px] uppercase tracking-wider font-bold text-rose-600 block">
                Total Credit
              </span>
              <span className="text-base font-black text-rose-700 font-mono">
                {settings.currencySymbol} {statement.totalCredit.toFixed(2)}
              </span>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
              <span className="text-[10px] uppercase tracking-wider font-bold text-blue-600 block">
                Closing Balance
              </span>
              <span className="text-base font-black text-blue-900 font-mono">
                {settings.currencySymbol} {statement.closingBalance.toFixed(2)}{' '}
                <span className="text-xs font-bold text-blue-600">{statement.closingType}</span>
              </span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Voucher No</th>
                  <th className="p-2.5">Voucher Type</th>
                  <th className="p-2.5">Particulars</th>
                  <th className="p-2.5 text-right">Debit ({settings.currencySymbol})</th>
                  <th className="p-2.5 text-right">Credit ({settings.currencySymbol})</th>
                  <th className="p-2.5 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {statement.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                      No transaction records found for this ledger account in selected period.
                    </td>
                  </tr>
                ) : (
                  statement.entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-medium whitespace-nowrap text-slate-700">{entry.date}</td>
                      <td className="p-2.5 font-bold font-mono text-blue-600">{entry.voucherNo}</td>
                      <td className="p-2.5 font-semibold text-slate-600">{entry.voucherType}</td>
                      <td className="p-2.5 text-slate-800">{entry.particulars}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                        {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                        {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 bg-slate-50">
                        {entry.runningBalance.toFixed(2)} <span className="text-[10px] text-blue-600">{entry.runningType}</span>
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
            Showing ledger for: <strong className="text-slate-900">{statement.ledgerName}</strong> ({statement.accountGroup})
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
