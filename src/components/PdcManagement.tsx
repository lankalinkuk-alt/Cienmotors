import React, { useState } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Filter,
  Search,
  Calendar,
  DollarSign,
  Landmark,
  X
} from 'lucide-react';
import { Customer, Supplier, AppSettings, Company, PdcTransaction, PdcStatus, PdcType } from '../types';
import { StorageService } from '../lib/storage';
import { ReportActionsToolbar } from './ReportActionsToolbar';

interface PdcManagementProps {
  pdcs: PdcTransaction[];
  customers: Customer[];
  suppliers: Supplier[];
  settings: AppSettings;
  company?: Company;
  onRefresh: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const PdcManagement: React.FC<PdcManagementProps> = ({
  pdcs,
  customers,
  suppliers,
  settings,
  company,
  onRefresh,
  onSuccess,
  onError
}) => {
  const companyBankAccounts = StorageService.getCompanyBankAccounts();

  const [activeTab, setActiveTab] = useState<'REGISTER' | 'NEW'>('REGISTER');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Clearance Modal State
  const [clearModalPdc, setClearModalPdc] = useState<PdcTransaction | null>(null);
  const [clearingBankName, setClearingBankName] = useState<string>('');

  // Form State
  const [type, setType] = useState<PdcType>('RECEIVED');
  const [partyType, setPartyType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [partyId, setPartyId] = useState<string>(customers[0]?.id || '');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>(companyBankAccounts[0] || 'Commercial Bank');
  const [chequeDate, setChequeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [referenceVoucherNo, setReferenceVoucherNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedPartyList = partyType === 'CUSTOMER' ? customers : suppliers;

  const handleCreatePdc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      onError('Please select a party.');
      return;
    }
    if (!chequeNumber.trim()) {
      onError('Please enter a cheque number.');
      return;
    }
    if (amount <= 0) {
      onError('Amount must be greater than zero.');
      return;
    }

    const party = selectedPartyList.find((p) => p.id === partyId);

    setIsSubmitting(true);
    try {
      const res = await StorageService.savePdcAsync({
        companyId: company?.id || 'comp-1',
        type,
        partyId,
        partyType,
        partyName: party?.name || 'Unknown',
        chequeNumber,
        bankName: bankName || companyBankAccounts[0] || 'Commercial Bank',
        chequeDate,
        amount,
        status: 'PENDING',
        referenceVoucherNo,
        notes
      });

      if (res.success) {
        onSuccess(`PDC Cheque ${chequeNumber} recorded successfully!`);
        onRefresh();
        setActiveTab('REGISTER');
        // Reset form
        setChequeNumber('');
        setBankName(companyBankAccounts[0] || 'Commercial Bank');
        setAmount(0);
        setNotes('');
      } else {
        onError(res.error || 'Failed to save PDC record.');
      }
    } catch (err: any) {
      onError(err.message || 'Error occurred while saving PDC.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmClear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearModalPdc) return;

    const chosenBank = clearingBankName || clearModalPdc.bankName || companyBankAccounts[0] || 'Commercial Bank';

    try {
      const res = await StorageService.updatePdcStatusAsync(clearModalPdc.id, 'CLEARED', chosenBank);
      if (res.success) {
        onSuccess(`Cheque #${clearModalPdc.chequeNumber} marked CLEARED via ${chosenBank}!`);
        setClearModalPdc(null);
        onRefresh();
      } else {
        onError(res.error || 'Failed to clear cheque.');
      }
    } catch (err: any) {
      onError(err.message || 'Error clearing cheque.');
    }
  };

  const handleUpdateStatus = async (id: string, status: PdcStatus) => {
    try {
      const res = await StorageService.updatePdcStatusAsync(id, status);
      if (res.success) {
        onSuccess(`PDC status updated to ${status}.`);
        onRefresh();
      } else {
        onError(res.error || 'Failed to update PDC status.');
      }
    } catch (err: any) {
      onError(err.message || 'Error updating PDC status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this PDC record?')) return;
    try {
      const res = await StorageService.deletePdcAsync(id);
      if (res.success) {
        onSuccess('PDC record deleted successfully.');
        onRefresh();
      } else {
        onError(res.error || 'Failed to delete PDC.');
      }
    } catch (err: any) {
      onError(err.message || 'Error deleting PDC.');
    }
  };

  const filteredPdcs = pdcs.filter((p) => {
    if (filterType !== 'ALL' && p.type !== filterType) return false;
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.partyName.toLowerCase().includes(q) ||
        p.chequeNumber.toLowerCase().includes(q) ||
        p.bankName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPendingReceived = pdcs
    .filter((p) => p.type === 'RECEIVED' && p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPendingIssued = pdcs
    .filter((p) => p.type === 'ISSUED' && p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  const pdcSummaryText = [
    `🏦 *${settings.companyName || 'Company Name'}*`,
    `*PDC Register Statement*`,
    `*Date:* ${new Date().toISOString().split('T')[0]}`,
    `------------------------------`,
    `• Total PDC Records: ${pdcs.length}`,
    `• Pending Received PDCs: ${settings.currencySymbol} ${totalPendingReceived.toFixed(2)}`,
    `• Pending Issued PDCs: ${settings.currencySymbol} ${totalPendingIssued.toFixed(2)}`,
    `\n*Recent PDCs:*`,
    ...pdcs.slice(0, 5).map((p) => `• ${p.chequeNumber} (${p.partyName}) - ${p.type} ${settings.currencySymbol}${p.amount.toFixed(2)} [Due: ${p.chequeDate}]`)
  ].join('\n');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <span>PDC Management (Post-Dated Cheques)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track received and issued post-dated cheques, clearance status, and due dates
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportActionsToolbar
            reportTitle="PDC Register Report"
            summaryText={pdcSummaryText}
            settings={settings}
            compact
          />

          <button
            onClick={() => setActiveTab('REGISTER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'REGISTER'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            PDC Register ({pdcs.length})
          </button>
          <button
            onClick={() => setActiveTab('NEW')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'NEW'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Record New PDC</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Pending Received PDCs</span>
            <span className="text-xl font-black text-emerald-900 block mt-1">
              {settings.currencySymbol} {totalPendingReceived.toFixed(2)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending Issued PDCs</span>
            <span className="text-xl font-black text-amber-900 block mt-1">
              {settings.currencySymbol} {totalPendingIssued.toFixed(2)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Cleared Cheques</span>
            <span className="text-xl font-black text-blue-900 block mt-1">
              {pdcs.filter((p) => p.status === 'CLEARED').length} records
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-200 text-blue-800 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Bounced Cheques</span>
            <span className="text-xl font-black text-rose-900 block mt-1">
              {pdcs.filter((p) => p.status === 'BOUNCED').length} records
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center font-bold">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {activeTab === 'REGISTER' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Controls */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search party, cheque no, bank name..."
                className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2 bg-white"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold"
              >
                <option value="ALL">All Types (Received & Issued)</option>
                <option value="RECEIVED">Received from Customers</option>
                <option value="ISSUED">Issued to Suppliers</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Clearance</option>
                <option value="CLEARED">Cleared</option>
                <option value="BOUNCED">Bounced / Dishonored</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="p-3">Cheque Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Cheque No</th>
                  <th className="p-3">Bank</th>
                  <th className="p-3 text-right">Amount ({settings.currencySymbol})</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPdcs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      No PDC records found matching selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPdcs.map((pdc) => (
                    <tr key={pdc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{pdc.chequeDate}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            pdc.type === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pdc.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{pdc.partyName}</td>
                      <td className="p-3 font-mono font-bold text-blue-600">{pdc.chequeNumber}</td>
                      <td className="p-3 text-slate-700">
                        <div className="font-semibold text-xs text-slate-800">{pdc.bankName || '-'}</div>
                        {pdc.clearedBankName && (
                          <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex">
                            <Landmark className="w-3 h-3" />
                            <span>Cleared via: {pdc.clearedBankName}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-900">
                        {pdc.amount.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 ${
                            pdc.status === 'CLEARED'
                              ? 'bg-blue-100 text-blue-800'
                              : pdc.status === 'BOUNCED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pdc.status}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap space-x-1">
                        {pdc.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => {
                                setClearModalPdc(pdc);
                                setClearingBankName(pdc.bankName || companyBankAccounts[0] || 'Commercial Bank');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1"
                              title="Settle / Clear Cheque in Bank"
                            >
                              <Landmark className="w-3 h-3" />
                              Clear
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(pdc.id, 'BOUNCED')}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                              title="Mark as Bounced"
                            >
                              Bounce
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(pdc.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                          title="Delete PDC"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* New PDC Form */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-2xl mx-auto">
          <h3 className="font-bold text-slate-900 text-lg border-b border-slate-200 pb-3 mb-4">
            Record New Post-Dated Cheque (PDC)
          </h3>

          <form onSubmit={handleCreatePdc} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PDC Type</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as PdcType;
                    setType(newType);
                    const newPartyType = newType === 'RECEIVED' ? 'CUSTOMER' : 'SUPPLIER';
                    setPartyType(newPartyType);
                    setPartyId(newPartyType === 'CUSTOMER' ? customers[0]?.id || '' : suppliers[0]?.id || '');
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                >
                  <option value="RECEIVED">RECEIVED (Customer Cheque In)</option>
                  <option value="ISSUED">ISSUED (Supplier Cheque Out)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Party</label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                >
                  {selectedPartyList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cheque Number</label>
                <input
                  type="text"
                  required
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="e.g. CHQ-990812"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                  <span>Company Bank Account</span>
                </label>
                <select
                  value={bankName || companyBankAccounts[0] || 'Commercial Bank'}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white font-semibold text-slate-800"
                >
                  {companyBankAccounts.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cheque Date</label>
                <input
                  type="date"
                  required
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cheque Amount ({settings.currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ref Voucher No (Optional)</label>
                <input
                  type="text"
                  value={referenceVoucherNo}
                  onChange={(e) => setReferenceVoucherNo(e.target.value)}
                  placeholder="e.g. INV-1002"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional details..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('REGISTER')}
                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                Save PDC Record (F2)
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Clear Cheque Modal */}
      {clearModalPdc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Settle & Clear Cheque #{clearModalPdc.chequeNumber}
                </h3>
              </div>
              <button
                onClick={() => setClearModalPdc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmClear} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Party Name:</span>
                  <strong className="text-slate-900 font-bold">{clearModalPdc.partyName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cheque Date:</span>
                  <strong className="text-slate-900 font-mono">{clearModalPdc.chequeDate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cheque Amount:</span>
                  <strong className="text-emerald-700 font-mono font-black">{settings.currencySymbol} {clearModalPdc.amount.toFixed(2)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Settling / Clearing Bank Account *
                </label>
                <select
                  value={clearingBankName || clearModalPdc.bankName || companyBankAccounts[0] || 'Commercial Bank'}
                  onChange={(e) => setClearingBankName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 bg-white"
                >
                  {companyBankAccounts.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Select which of your maintained company bank accounts settled this transaction.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setClearModalPdc(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Clearance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
