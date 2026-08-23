import React, { useState, useMemo } from 'react';
import { Scale, Calendar, CheckCircle2, AlertTriangle, Printer, Download } from 'lucide-react';
import { AppSettings, Company } from '../types';
import { StorageService } from '../lib/storage';
import { ReportActionsToolbar } from './ReportActionsToolbar';
import { getDateRangePresets } from '../lib/dateUtils';

interface TrialBalanceViewProps {
  settings: AppSettings;
  company?: Company;
}

export const TrialBalanceView: React.FC<TrialBalanceViewProps> = ({ settings, company }) => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const trialData = StorageService.getTrialBalance(
    fromDate || undefined,
    toDate || undefined,
    company?.id
  );

  const trialSummaryText = useMemo(() => {
    return [
      `⚖️ *${settings.companyName || 'Company Name'}*`,
      `*Trial Balance Statement*`,
      `*Period:* ${fromDate || 'Beginning'} to ${toDate || 'Present'}`,
      `------------------------------`,
      `• Total Accounts: ${trialData.rows.length}`,
      `• Total Debit: ${settings.currencySymbol} ${trialData.totals.closingDr.toFixed(2)}`,
      `• Total Credit: ${settings.currencySymbol} ${trialData.totals.closingCr.toFixed(2)}`,
      `• Status: ${trialData.totals.isBalanced ? '✅ BALANCED (0.00 Diff)' : `⚠️ UNBALANCED (Diff: ${settings.currencySymbol} ${Math.abs(trialData.totals.closingDr - trialData.totals.closingCr).toFixed(2)})`}`
    ].join('\n');
  }, [trialData, fromDate, toDate, settings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-600" />
            <span>Trial Balance Report</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-entry ledger debit & credit balance summary across all account groups
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
              placeholder="From"
              className="border border-slate-300 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-800"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To"
              className="border border-slate-300 rounded-xl px-2.5 py-1.5 bg-slate-50 text-slate-800"
            />
          </div>

          <ReportActionsToolbar
            reportTitle="Trial Balance Statement"
            summaryText={trialSummaryText}
            settings={settings}
            compact
          />
        </div>
      </div>

      {/* Balance Indicator Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
          trialData.totals.isBalanced
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}
      >
        <div className="flex items-center gap-2">
          {trialData.totals.isBalanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          )}
          <span>
            {trialData.totals.isBalanced
              ? 'Trial Balance is perfectly balanced! Total Closing Debit equals Total Closing Credit.'
              : 'Trial Balance discrepancy detected. Review ledger entries.'}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono font-black text-sm">
          <span>Closing Dr: {settings.currencySymbol} {trialData.totals.closingDr.toFixed(2)}</span>
          <span>Closing Cr: {settings.currencySymbol} {trialData.totals.closingCr.toFixed(2)}</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white font-bold">
              <tr>
                <th className="p-3">Account Group</th>
                <th className="p-3">Ledger Account</th>
                <th className="p-3 text-center">Nature</th>
                <th className="p-3 text-right">Opening Dr ({settings.currencySymbol})</th>
                <th className="p-3 text-right">Opening Cr ({settings.currencySymbol})</th>
                <th className="p-3 text-right">Period Dr ({settings.currencySymbol})</th>
                <th className="p-3 text-right">Period Cr ({settings.currencySymbol})</th>
                <th className="p-3 text-right">Closing Dr ({settings.currencySymbol})</th>
                <th className="p-3 text-right">Closing Cr ({settings.currencySymbol})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {trialData.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    No ledger account data available for trial balance.
                  </td>
                </tr>
              ) : (
                trialData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-slate-600">{row.accountGroup}</td>
                    <td className="p-3 font-bold text-slate-900">{row.ledgerName}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {row.nature}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">
                      {row.openingDr > 0 ? row.openingDr.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {row.openingCr > 0 ? row.openingCr.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-700">
                      {row.periodDr > 0 ? row.periodDr.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-rose-700">
                      {row.periodCr > 0 ? row.periodCr.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 bg-slate-50">
                      {row.closingDr > 0 ? row.closingDr.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 bg-slate-50">
                      {row.closingCr > 0 ? row.closingCr.toFixed(2) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-mono font-bold">
              <tr>
                <td colSpan={3} className="p-3.5 text-right uppercase tracking-wider font-sans text-xs">
                  Grand Totals:
                </td>
                <td className="p-3.5 text-right">{trialData.totals.openingDr.toFixed(2)}</td>
                <td className="p-3.5 text-right">{trialData.totals.openingCr.toFixed(2)}</td>
                <td className="p-3.5 text-right text-emerald-400">{trialData.totals.periodDr.toFixed(2)}</td>
                <td className="p-3.5 text-right text-rose-400">{trialData.totals.periodCr.toFixed(2)}</td>
                <td className="p-3.5 text-right text-yellow-400 text-sm">{trialData.totals.closingDr.toFixed(2)}</td>
                <td className="p-3.5 text-right text-yellow-400 text-sm">{trialData.totals.closingCr.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
