import React, { useState } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Search,
  Calendar,
  Landmark,
  X,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Ban,
  Eye,
  Info,
  ShieldCheck
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
  const [onlyOverdueOrToday, setOnlyOverdueOrToday] = useState<boolean>(false);

  // Modal States
  const [depositModalPdc, setDepositModalPdc] = useState<PdcTransaction | null>(null);
  const [depositBankName, setDepositBankName] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [depositNotes, setDepositNotes] = useState<string>('');

  const [clearModalPdc, setClearModalPdc] = useState<PdcTransaction | null>(null);
  const [clearingBankName, setClearingBankName] = useState<string>('');
  const [clearedDate, setClearedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [bounceModalPdc, setBounceModalPdc] = useState<PdcTransaction | null>(null);
  const [bounceDate, setBounceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bounceReason, setBounceReason] = useState<string>('Insufficient Funds');
  const [bounceCharges, setBounceCharges] = useState<number>(0);

  const [cancelModalPdc, setCancelModalPdc] = useState<PdcTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isReturnAction, setIsReturnAction] = useState<boolean>(false);

  const [detailsModalPdc, setDetailsModalPdc] = useState<PdcTransaction | null>(null);

  // Form State for New PDC
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
  const todayStr = new Date().toISOString().split('T')[0];

  // Handlers
  const handleCreatePdc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      onError('Please select a customer or supplier.');
      return;
    }
    if (!chequeNumber.trim()) {
      onError('Please enter a cheque number.');
      return;
    }
    if (amount <= 0) {
      onError('Cheque amount must be greater than zero.');
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
        chequeNumber: chequeNumber.trim(),
        bankName: bankName || companyBankAccounts[0] || 'Commercial Bank',
        chequeDate,
        amount,
        status: 'PENDING',
        referenceVoucherNo,
        notes
      });

      if (res.success) {
        onSuccess(`PDC Cheque #${chequeNumber} registered in portfolio!`);
        onRefresh();
        setActiveTab('REGISTER');
        // Reset form
        setChequeNumber('');
        setAmount(0);
        setNotes('');
        setReferenceVoucherNo('');
      } else {
        onError(res.error || 'Failed to save PDC record.');
      }
    } catch (err: any) {
      onError(err.message || 'Error occurred while saving PDC.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositModalPdc) return;
    const targetBank = depositBankName || depositModalPdc.bankName || companyBankAccounts[0] || 'Commercial Bank';

    try {
      const res = await StorageService.depositPdcAsync(
        depositModalPdc.id,
        depositDate || todayStr,
        targetBank,
        depositNotes
      );
      if (res.success) {
        onSuccess(`Cheque #${depositModalPdc.chequeNumber} deposited to ${targetBank}!`);
        setDepositModalPdc(null);
        onRefresh();
      } else {
        onError(res.error || 'Failed to deposit cheque.');
      }
    } catch (err: any) {
      onError(err.message || 'Error depositing cheque.');
    }
  };

  const handleConfirmClear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearModalPdc) return;
    const chosenBank = clearingBankName || clearModalPdc.clearedBankName || clearModalPdc.bankName || companyBankAccounts[0] || 'Commercial Bank';

    try {
      const res = await StorageService.clearPdcAsync(
        clearModalPdc.id,
        clearedDate || todayStr,
        chosenBank
      );
      if (res.success) {
        onSuccess(`Cheque #${clearModalPdc.chequeNumber} marked CLEARED via ${chosenBank}! Ledger updated with Journal Voucher ${res.voucherNo || ''}.`);
        setClearModalPdc(null);
        onRefresh();
      } else {
        onError(res.error || 'Failed to clear cheque.');
      }
    } catch (err: any) {
      onError(err.message || 'Error clearing cheque.');
    }
  };

  const handleConfirmBounce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bounceModalPdc) return;
    const chosenBank = bounceModalPdc.clearedBankName || bounceModalPdc.bankName || companyBankAccounts[0] || 'Commercial Bank';

    try {
      const res = await StorageService.bouncePdcAsync(
        bounceModalPdc.id,
        bounceDate || todayStr,
        chosenBank,
        bounceReason,
        bounceCharges
      );
      if (res.success) {
        onSuccess(`Cheque #${bounceModalPdc.chequeNumber} marked BOUNCED! Balances reversed and dishonor recorded.`);
        setBounceModalPdc(null);
        onRefresh();
      } else {
        onError(res.error || 'Failed to bounce cheque.');
      }
    } catch (err: any) {
      onError(err.message || 'Error processing bounce.');
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalPdc) return;

    try {
      const res = await StorageService.cancelPdcAsync(
        cancelModalPdc.id,
        cancelReason,
        isReturnAction
      );
      if (res.success) {
        onSuccess(`Cheque #${cancelModalPdc.chequeNumber} marked as ${isReturnAction ? 'RETURNED' : 'CANCELLED'}.`);
        setCancelModalPdc(null);
        onRefresh();
      } else {
        onError(res.error || 'Failed to update cheque.');
      }
    } catch (err: any) {
      onError(err.message || 'Error updating cheque.');
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
    if (onlyOverdueOrToday) {
      const isDueOrOverdue = p.chequeDate <= todayStr && (p.status === 'PENDING' || p.status === 'DEPOSITED');
      if (!isDueOrOverdue) return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.partyName.toLowerCase().includes(q) ||
        p.chequeNumber.toLowerCase().includes(q) ||
        p.bankName.toLowerCase().includes(q) ||
        (p.referenceVoucherNo && p.referenceVoucherNo.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPendingReceived = pdcs
    .filter((p) => p.type === 'RECEIVED' && (p.status === 'PENDING' || p.status === 'DEPOSITED'))
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPendingIssued = pdcs
    .filter((p) => p.type === 'ISSUED' && (p.status === 'PENDING' || p.status === 'DEPOSITED'))
    .reduce((sum, p) => sum + p.amount, 0);

  const totalCleared = pdcs
    .filter((p) => p.status === 'CLEARED')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalBounced = pdcs
    .filter((p) => p.status === 'BOUNCED')
    .reduce((sum, p) => sum + p.amount, 0);

  const overdueCount = pdcs.filter(
    (p) => p.chequeDate <= todayStr && (p.status === 'PENDING' || p.status === 'DEPOSITED')
  ).length;

  const pdcSummaryText = [
    `🏦 *${settings.companyName || 'CIEN Motors'}*`,
    `*PDC Register Statement*`,
    `*Generated on:* ${todayStr}`,
    `--------------------------------------`,
    `• Total PDC Records: ${pdcs.length}`,
    `• Pending Received (Customer PDCs): ${settings.currencySymbol} ${totalPendingReceived.toFixed(2)}`,
    `• Pending Issued (Supplier PDCs): ${settings.currencySymbol} ${totalPendingIssued.toFixed(2)}`,
    `• Realized / Cleared: ${settings.currencySymbol} ${totalCleared.toFixed(2)}`,
    `• Bounced / Dishonored: ${settings.currencySymbol} ${totalBounced.toFixed(2)}`,
    `• Overdue / Due Today: ${overdueCount} cheque(s)`,
    `\n*Recent Cheques:*`,
    ...pdcs.slice(0, 8).map((p) => `• #${p.chequeNumber} (${p.partyName}) | ${p.type} | ${settings.currencySymbol}${p.amount.toFixed(2)} | Due: ${p.chequeDate} | Status: ${p.status}`)
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
            Production-grade atomic PDC workflow with dual-entry accounting ledger & bank synchronization
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
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Customer PDCs (In-Hand)
            </span>
            <span className="text-xl font-black text-emerald-900 block mt-1">
              {settings.currencySymbol} {totalPendingReceived.toFixed(2)}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold">
              {pdcs.filter((p) => p.type === 'RECEIVED' && (p.status === 'PENDING' || p.status === 'DEPOSITED')).length} cheques pending
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Supplier PDCs (Issued)
            </span>
            <span className="text-xl font-black text-amber-900 block mt-1">
              {settings.currencySymbol} {totalPendingIssued.toFixed(2)}
            </span>
            <span className="text-[11px] text-amber-700 font-semibold">
              {pdcs.filter((p) => p.type === 'ISSUED' && (p.status === 'PENDING' || p.status === 'DEPOSITED')).length} cheques pending
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Cleared & Realized</span>
            <span className="text-xl font-black text-blue-900 block mt-1">
              {settings.currencySymbol} {totalCleared.toFixed(2)}
            </span>
            <span className="text-[11px] text-blue-700 font-semibold">
              {pdcs.filter((p) => p.status === 'CLEARED').length} realized cheques
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-200 text-blue-800 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Bounced / Dishonored</span>
            <span className="text-xl font-black text-rose-900 block mt-1">
              {settings.currencySymbol} {totalBounced.toFixed(2)}
            </span>
            <span className="text-[11px] text-rose-700 font-semibold">
              {pdcs.filter((p) => p.status === 'BOUNCED').length} dishonored cheques
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-200 text-rose-800 flex items-center justify-center font-bold">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {activeTab === 'REGISTER' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-4 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search party, cheque no, bank, voucher..."
                  className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2 bg-white font-medium"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold text-slate-800"
                >
                  <option value="ALL">All Types (Received & Issued)</option>
                  <option value="RECEIVED">Received from Customers (In-Hand)</option>
                  <option value="ISSUED">Issued to Suppliers (Outbound)</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold text-slate-800"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending In-Hand</option>
                  <option value="DEPOSITED">Deposited in Bank</option>
                  <option value="CLEARED">Cleared / Realized</option>
                  <option value="BOUNCED">Bounced / Dishonored</option>
                  <option value="RETURNED">Returned</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center">
                <button
                  type="button"
                  onClick={() => setOnlyOverdueOrToday(!onlyOverdueOrToday)}
                  className={`w-full py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                    onlyOverdueOrToday
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${onlyOverdueOrToday ? 'text-white' : 'text-amber-500'}`} />
                  <span>Due Today ({overdueCount})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="p-3">Maturity Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Cheque No</th>
                  <th className="p-3">Bank Details</th>
                  <th className="p-3 text-right">Amount ({settings.currencySymbol})</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions & Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPdcs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      No PDC records found matching selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPdcs.map((pdc) => {
                    const isDueToday = pdc.chequeDate === todayStr;
                    const isOverdue = pdc.chequeDate < todayStr && (pdc.status === 'PENDING' || pdc.status === 'DEPOSITED');

                    return (
                      <tr key={pdc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 font-mono">{pdc.chequeDate}</div>
                          {isOverdue && (
                            <span className="text-[9px] font-bold text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-block mt-0.5">
                              Overdue
                            </span>
                          )}
                          {isDueToday && (
                            <span className="text-[9px] font-bold text-amber-700 uppercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                              Due Today
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 ${
                              pdc.type === 'RECEIVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {pdc.type === 'RECEIVED' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {pdc.type}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-900">{pdc.partyName}</div>
                          {pdc.referenceVoucherNo && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Ref: {pdc.referenceVoucherNo}
                            </div>
                          )}
                        </td>

                        <td className="p-3 font-mono font-bold text-blue-600">
                          {pdc.chequeNumber}
                        </td>

                        <td className="p-3 text-slate-700">
                          <div className="font-semibold text-xs text-slate-800">{pdc.bankName || '-'}</div>
                          {pdc.clearedBankName && (
                            <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex">
                              <Landmark className="w-3 h-3" />
                              <span>Cleared: {pdc.clearedBankName}</span>
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
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : pdc.status === 'DEPOSITED'
                                ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                                : pdc.status === 'BOUNCED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : pdc.status === 'RETURNED'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : pdc.status === 'CANCELLED'
                                ? 'bg-slate-200 text-slate-700 border border-slate-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {pdc.status === 'CLEARED' && <CheckCircle2 className="w-3 h-3" />}
                            {pdc.status === 'BOUNCED' && <XCircle className="w-3 h-3" />}
                            {pdc.status === 'DEPOSITED' && <Landmark className="w-3 h-3" />}
                            {pdc.status}
                          </span>
                        </td>

                        <td className="p-3 text-center whitespace-nowrap space-x-1">
                          {/* Details Button */}
                          <button
                            onClick={() => setDetailsModalPdc(pdc)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer"
                            title="View PDC Details & Accounting Audit"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* PENDING State Actions */}
                          {pdc.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setDepositModalPdc(pdc);
                                  setDepositBankName(pdc.bankName || companyBankAccounts[0] || 'Commercial Bank');
                                  setDepositDate(todayStr);
                                  setDepositNotes('');
                                }}
                                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1"
                                title="Deposit cheque to bank for clearing collection"
                              >
                                <Landmark className="w-3 h-3" />
                                Deposit
                              </button>

                              <button
                                onClick={() => {
                                  setClearModalPdc(pdc);
                                  setClearingBankName(pdc.bankName || companyBankAccounts[0] || 'Commercial Bank');
                                  setClearedDate(todayStr);
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1"
                                title="Clear cheque in bank (Posts journal & updates party balance)"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Clear
                              </button>

                              <button
                                onClick={() => {
                                  setBounceModalPdc(pdc);
                                  setBounceDate(todayStr);
                                  setBounceReason('Insufficient Funds');
                                  setBounceCharges(0);
                                }}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                                title="Mark as Bounced / Dishonored"
                              >
                                Bounce
                              </button>

                              <button
                                onClick={() => {
                                  setCancelModalPdc(pdc);
                                  setCancelReason('');
                                  setIsReturnAction(false);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                                title="Cancel / Return Cheque"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {/* DEPOSITED State Actions */}
                          {pdc.status === 'DEPOSITED' && (
                            <>
                              <button
                                onClick={() => {
                                  setClearModalPdc(pdc);
                                  setClearingBankName(pdc.clearedBankName || pdc.bankName || companyBankAccounts[0] || 'Commercial Bank');
                                  setClearedDate(todayStr);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1"
                                title="Clear cheque in bank"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Clear
                              </button>

                              <button
                                onClick={() => {
                                  setBounceModalPdc(pdc);
                                  setBounceDate(todayStr);
                                  setBounceReason('Insufficient Funds');
                                  setBounceCharges(0);
                                }}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                                title="Mark as Bounced / Dishonored"
                              >
                                Bounce
                              </button>

                              <button
                                onClick={() => {
                                  setCancelModalPdc(pdc);
                                  setCancelReason('');
                                  setIsReturnAction(true);
                                }}
                                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                                title="Return Cheque to Party"
                              >
                                Return
                              </button>
                            </>
                          )}

                          {/* CLEARED State Actions */}
                          {pdc.status === 'CLEARED' && (
                            <button
                              onClick={() => {
                                setBounceModalPdc(pdc);
                                setBounceDate(todayStr);
                                setBounceReason('Bank Dishonor Notice');
                                setBounceCharges(0);
                              }}
                              className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 font-bold rounded-lg text-[10px] cursor-pointer inline-flex items-center gap-1"
                              title="Dishonor Notice (Reverses balances and creates reversal journal)"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reverse Bounce
                            </button>
                          )}

                          {/* Delete Action */}
                          <button
                            onClick={() => handleDelete(pdc.id)}
                            className="p-1 text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Delete PDC Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* New PDC Form */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>Record New Post-Dated Cheque (PDC)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Register customer received cheque or supplier issued cheque in portfolio
              </p>
            </div>
            <button
              onClick={() => setActiveTab('REGISTER')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreatePdc} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-xs uppercase text-slate-700 mb-1">PDC Type *</label>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value as PdcType;
                    setType(newType);
                    const newPartyType = newType === 'RECEIVED' ? 'CUSTOMER' : 'SUPPLIER';
                    setPartyType(newPartyType);
                    setPartyId(newPartyType === 'CUSTOMER' ? customers[0]?.id || '' : suppliers[0]?.id || '');
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white font-semibold text-slate-900"
                >
                  <option value="RECEIVED">RECEIVED (Customer Cheque In-Hand)</option>
                  <option value="ISSUED">ISSUED (Supplier Cheque Outbound)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-xs uppercase text-slate-700 mb-1">
                  {partyType === 'CUSTOMER' ? 'Customer Name *' : 'Supplier Name *'}
                </label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white font-bold text-slate-900"
                >
                  {selectedPartyList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-xs uppercase text-slate-700 mb-1">Cheque Number *</label>
                <input
                  type="text"
                  required
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  placeholder="e.g. 001928"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-xs uppercase text-slate-700 mb-1 flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                  <span>Company Bank *</span>
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
                <label className="block font-bold text-xs uppercase text-slate-700 mb-1">Maturity Date *</label>
                <input
                  type="date"
                  required
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-xs uppercase text-slate-700 mb-1">Cheque Amount ({settings.currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white font-mono font-black text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-xs uppercase text-slate-700 mb-1">Ref Voucher / Bill No (Optional)</label>
                <input
                  type="text"
                  value={referenceVoucherNo}
                  onChange={(e) => setReferenceVoucherNo(e.target.value)}
                  placeholder="e.g. INV-1002 or REC-1004"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-xs uppercase text-slate-700 mb-1">Notes / Remarks</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Drawer bank, branch location, or handling instructions..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white text-xs"
              />
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Atomic Accounting Guarantee:</strong> Registering this PDC maintains it in the suspense portfolio. The customer/supplier ledger will be updated seamlessly upon bank clearance.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('REGISTER')}
                className="px-4 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Save PDC Record</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Deposit Modal */}
      {depositModalPdc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-cyan-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Deposit Cheque #{depositModalPdc.chequeNumber}
                </h3>
              </div>
              <button
                onClick={() => setDepositModalPdc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeposit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Party Name:</span>
                  <strong className="text-slate-900 font-bold">{depositModalPdc.partyName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cheque Date:</span>
                  <strong className="text-slate-900 font-mono">{depositModalPdc.chequeDate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cheque Amount:</span>
                  <strong className="text-cyan-800 font-mono font-black">{settings.currencySymbol} {depositModalPdc.amount.toFixed(2)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Deposit Date *
                </label>
                <input
                  type="date"
                  required
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Deposited to Company Bank Account *
                </label>
                <select
                  value={depositBankName || depositModalPdc.bankName || companyBankAccounts[0] || 'Commercial Bank'}
                  onChange={(e) => setDepositBankName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 bg-white"
                >
                  {companyBankAccounts.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tracking Notes / Slip Number (Optional)
                </label>
                <input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  placeholder="e.g. Deposit slip #88192"
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDepositModalPdc(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Landmark className="w-4 h-4" />
                  <span>Confirm Deposit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear Cheque Modal */}
      {clearModalPdc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Clear & Settle Cheque #{clearModalPdc.chequeNumber}
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
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Party:</span>
                  <strong className="text-slate-900 font-bold">{clearModalPdc.partyName} ({clearModalPdc.partyType})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Cheque Date:</span>
                  <strong className="text-slate-900 font-mono">{clearModalPdc.chequeDate}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Amount:</span>
                  <strong className="text-emerald-800 font-mono font-black">{settings.currencySymbol} {clearModalPdc.amount.toFixed(2)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Clearance Date *
                </label>
                <input
                  type="date"
                  required
                  value={clearedDate}
                  onChange={(e) => setClearedDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Settling / Clearing Bank Account *
                </label>
                <select
                  value={clearingBankName || clearModalPdc.clearedBankName || clearModalPdc.bankName || companyBankAccounts[0] || 'Commercial Bank'}
                  onChange={(e) => setClearingBankName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 bg-white"
                >
                  {companyBankAccounts.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Accounting Impact Preview */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                <div className="font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>Dual-Entry Accounting Impact:</span>
                </div>
                {clearModalPdc.type === 'RECEIVED' ? (
                  <>
                    <div className="text-emerald-700 font-semibold">• Debit: Bank Account (+{settings.currencySymbol}{clearModalPdc.amount.toFixed(2)})</div>
                    <div className="text-blue-700 font-semibold">• Credit: Customer ({clearModalPdc.partyName}) (-{settings.currencySymbol}{clearModalPdc.amount.toFixed(2)} receivable)</div>
                  </>
                ) : (
                  <>
                    <div className="text-blue-700 font-semibold">• Debit: Supplier ({clearModalPdc.partyName}) (-{settings.currencySymbol}{clearModalPdc.amount.toFixed(2)} payable)</div>
                    <div className="text-emerald-700 font-semibold">• Credit: Bank Account (-{settings.currencySymbol}{clearModalPdc.amount.toFixed(2)})</div>
                  </>
                )}
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

      {/* Bounce Modal */}
      {bounceModalPdc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Dishonor / Bounce Cheque #{bounceModalPdc.chequeNumber}
                </h3>
              </div>
              <button
                onClick={() => setBounceModalPdc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBounce} className="space-y-4">
              <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Party:</span>
                  <strong className="text-slate-900 font-bold">{bounceModalPdc.partyName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Cheque Amount:</span>
                  <strong className="text-rose-800 font-mono font-black">{settings.currencySymbol} {bounceModalPdc.amount.toFixed(2)}</strong>
                </div>
                {bounceModalPdc.status === 'CLEARED' && (
                  <div className="text-rose-700 font-bold text-[11px] pt-1 border-t border-rose-200">
                    ⚠️ Warning: This cheque was previously CLEARED. Bouncing will atomically reverse bank & customer balances via a Reversal Journal Voucher.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Bounce Date *
                </label>
                <input
                  type="date"
                  required
                  value={bounceDate}
                  onChange={(e) => setBounceDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Reason for Dishonor *
                </label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 bg-white"
                >
                  <option value="Insufficient Funds">Insufficient Funds</option>
                  <option value="Signature Mismatch">Signature Mismatch</option>
                  <option value="Payment Stopped by Drawer">Payment Stopped by Drawer</option>
                  <option value="Account Closed">Account Closed</option>
                  <option value="Date Expired / Stale Cheque">Date Expired / Stale Cheque</option>
                  <option value="Post-Dated Cheque Error">Post-Dated Cheque Error</option>
                  <option value="Technical Return">Technical Return</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Bank Bounce Penalty / Charges ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bounceCharges}
                  onChange={(e) => setBounceCharges(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBounceModalPdc(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Confirm Dishonor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel / Return Modal */}
      {cancelModalPdc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-slate-700" />
                <h3 className="font-bold text-base text-slate-900">
                  {isReturnAction ? 'Return' : 'Cancel'} Cheque #{cancelModalPdc.chequeNumber}
                </h3>
              </div>
              <button
                onClick={() => setCancelModalPdc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Party Name:</span>
                  <strong className="text-slate-900 font-bold">{cancelModalPdc.partyName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <strong className="text-slate-900 font-mono font-bold">{settings.currencySymbol} {cancelModalPdc.amount.toFixed(2)}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Reason for {isReturnAction ? 'Return' : 'Cancellation'}
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  placeholder="e.g. Replaced by cash payment or new cheque..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalPdc(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  Confirm {isReturnAction ? 'Return' : 'Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details & Accounting Audit Modal */}
      {detailsModalPdc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  PDC Lifecycle & Accounting Audit
                </h3>
              </div>
              <button
                onClick={() => setDetailsModalPdc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Cheque Number</span>
                  <strong className="font-mono font-bold text-slate-900 text-sm">{detailsModalPdc.chequeNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Amount</span>
                  <strong className="font-mono font-black text-emerald-800 text-sm">{settings.currencySymbol} {detailsModalPdc.amount.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Type</span>
                  <strong className="font-bold text-slate-900">{detailsModalPdc.type} ({detailsModalPdc.partyType})</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Party</span>
                  <strong className="font-bold text-slate-900">{detailsModalPdc.partyName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Cheque Date</span>
                  <strong className="font-mono text-slate-900">{detailsModalPdc.chequeDate}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <span className="font-bold text-blue-700">{detailsModalPdc.status}</span>
                </div>
              </div>

              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 space-y-1">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Audit Trail & Ledger Links</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-600">Company Bank:</span>
                  <span className="font-semibold text-slate-900">{detailsModalPdc.clearedBankName || detailsModalPdc.bankName || 'Not cleared'}</span>
                </div>
                {detailsModalPdc.clearedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cleared Timestamp:</span>
                    <span className="font-mono text-slate-900">{new Date(detailsModalPdc.clearedAt).toLocaleString()}</span>
                  </div>
                )}
                {detailsModalPdc.linkedJournalId && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Linked Journal Voucher ID:</span>
                    <span className="font-mono font-bold text-blue-800">{detailsModalPdc.linkedJournalId}</span>
                  </div>
                )}
                {detailsModalPdc.depositDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Deposit Date:</span>
                    <span className="font-mono text-slate-900">{detailsModalPdc.depositDate}</span>
                  </div>
                )}
                {detailsModalPdc.bounceDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Bounce Date:</span>
                    <span className="font-mono text-rose-700 font-bold">{detailsModalPdc.bounceDate}</span>
                  </div>
                )}
                {detailsModalPdc.bounceReason && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Bounce Reason:</span>
                    <span className="font-semibold text-rose-700">{detailsModalPdc.bounceReason}</span>
                  </div>
                )}
                {detailsModalPdc.notes && (
                  <div className="pt-1 border-t border-blue-200/60">
                    <span className="text-slate-600 block">Notes:</span>
                    <span className="text-slate-800 italic">{detailsModalPdc.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailsModalPdc(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
