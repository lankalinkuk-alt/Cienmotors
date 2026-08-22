import React, { useState } from 'react';
import {
  Plus,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Trash2,
  FileText,
  DollarSign,
  X,
  AlertCircle,
  Printer
} from 'lucide-react';
import { Customer, AppSettings, SaleInvoice, CustomerReceipt, AuthSession } from '../types';
import { checkPermission } from '../lib/permissions';
import { STANDARD_ACCOUNT_GROUPS } from '../lib/accountGroups';

interface CustomersProps {
  customers: Customer[];
  settings: AppSettings;
  sales: SaleInvoice[];
  receipts: CustomerReceipt[];
  onSaveCustomer: (customer: Partial<Customer>) => void;
  onDeleteCustomer: (id: string) => void;
  session?: AuthSession | null;
}

export const Customers: React.FC<CustomersProps> = ({
  customers,
  settings,
  sales,
  receipts,
  onSaveCustomer,
  onDeleteCustomer,
  session
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState<Customer | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canAdd = checkPermission(session?.effectivePermissions, 'customers', 'add');
  const canEdit = checkPermission(session?.effectivePermissions, 'customers', 'edit');
  const canDelete = checkPermission(session?.effectivePermissions, 'customers', 'delete');

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    city: 'Colombo',
    openingBalance: '0'
  });

  const [formError, setFormError] = useState('');

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormError('');
    const codeCount = customers.length + 1;
    setFormData({
      code: `CUST-${String(codeCount).padStart(3, '0')}`,
      name: '',
      phone: '',
      email: '',
      address: '',
      city: 'Colombo',
      accountGroup: 'Sundry Debtors',
      openingBalance: '0'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormError('');
    setFormData({
      code: cust.code,
      name: cust.name,
      phone: cust.phone,
      email: cust.email || '',
      address: cust.address || '',
      city: cust.city || 'Colombo',
      accountGroup: cust.accountGroup || 'Sundry Debtors',
      openingBalance: cust.openingBalance.toString()
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Customer Name is required.');
      return;
    }

    if (!formData.phone.trim()) {
      setFormError('Phone Number is required.');
      return;
    }

    // Check duplicate customer name or phone
    const duplicate = customers.find(
      (c) =>
        c.id !== editingCustomer?.id &&
        (c.name.trim().toLowerCase() === formData.name.trim().toLowerCase() ||
          c.phone.trim() === formData.phone.trim())
    );

    if (duplicate) {
      if (duplicate.name.trim().toLowerCase() === formData.name.trim().toLowerCase()) {
        setFormError(`A customer named "${formData.name.trim()}" already exists.`);
        return;
      }
      if (duplicate.phone.trim() === formData.phone.trim()) {
        setFormError(`A customer with phone number "${formData.phone.trim()}" already exists.`);
        return;
      }
    }

    onSaveCustomer({
      id: editingCustomer?.id,
      code: formData.code,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      accountGroup: formData.accountGroup || 'Sundry Debtors',
      openingBalance: Number(formData.openingBalance || 0)
    });

    setIsModalOpen(false);
  };

  // Filtered customers
  const filteredCustomers = customers.filter((c) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) {
      return onlyOutstanding ? c.outstandingBalance > 0 : true;
    }
    const terms = q.split(/\s+/).filter(Boolean);
    const searchable = `${c.name || ''} ${c.code || ''} ${c.phone || ''} ${c.city || ''} ${c.address || ''} ${c.email || ''}`.toLowerCase();
    const rawPhone = (c.phone || '').replace(/[^0-9]/g, '');

    const matchesSearch = terms.every((t) => {
      const cleanTerm = t.replace(/[^0-9a-z]/g, '');
      return searchable.includes(t) || (cleanTerm.length > 2 && rawPhone.includes(cleanTerm));
    });

    if (onlyOutstanding) {
      return matchesSearch && c.outstandingBalance > 0;
    }
    return matchesSearch;
  });

  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0);

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Stats Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customer Management</h2>
          <p className="text-xs text-slate-500">Add, manage, and track customer outstanding balances</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Total Outstanding</span>
            <span className="text-lg font-black text-amber-900 font-mono">
              {settings.currencySymbol} {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {canAdd && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
            >
              <Plus className="w-4 h-4 text-yellow-400" />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, code, phone, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyOutstanding}
            onChange={(e) => setOnlyOutstanding(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
          />
          <span>Show Only Customers With Outstanding Balance</span>
        </label>
      </div>

      {/* Customer Cards Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
          No customers found matching your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-xs font-bold rounded-md">
                        {cust.code}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200">
                        {cust.accountGroup || 'Sundry Debtors'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mt-1.5">{cust.name}</h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Outstanding</span>
                    <span
                      className={`font-mono font-extrabold text-sm ${
                        cust.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {settings.currencySymbol} {cust.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mb-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{cust.phone}</span>
                  </div>
                  {cust.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.email}</span>
                    </div>
                  )}
                  {cust.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {cust.address}
                        {cust.city ? `, ${cust.city}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <button
                  onClick={() => setSelectedLedgerCustomer(cust)}
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Statement</span>
                </button>

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={() => handleOpenEdit(cust)}
                      className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                      title="Edit Customer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setDeleteConfirmId(cust.id)}
                      className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Customer Code
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Customer / Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Perera Retail Store"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0771234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    City / Area
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kandy"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="customer@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Account Group (Chart of Accounts)
                </label>
                <select
                  value={formData.accountGroup}
                  onChange={(e) => setFormData({ ...formData, accountGroup: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500 bg-white"
                >
                  <optgroup label="Assets / Trade Receivables (Default)">
                    {STANDARD_ACCOUNT_GROUPS.filter((g) => g.nature === 'ASSET').map((g) => (
                      <option key={g.no} value={g.name}>
                        {g.no}. {g.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Account Groups">
                    {STANDARD_ACCOUNT_GROUPS.filter((g) => g.nature !== 'ASSET').map((g) => (
                      <option key={g.no} value={g.name}>
                        {g.no}. {g.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default: 25. Sundry Debtors (Trade Customers)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="Street / Building No."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Opening Balance ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Enter positive amount if customer already owes money before starting.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl shadow-xs hover:bg-blue-700"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-slate-900">Delete Customer?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Are you sure you want to remove this customer record? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteCustomer(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-5 py-2 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {selectedLedgerCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col" id="printable-statement">
            {/* Printed Header with Company Name */}
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
              <p className="text-xs text-slate-600">{settings.companyAddress}</p>
              <p className="text-xs text-slate-600 font-mono">
                Tel: {settings.companyPhone} {settings.companyEmail ? `| Email: ${settings.companyEmail}` : ''}
                {settings.taxRegistrationNo ? ` | VAT: ${settings.taxRegistrationNo}` : ''}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-300 flex justify-between text-xs font-bold text-slate-800">
                <span>CUSTOMER STATEMENT: {selectedLedgerCustomer.name} ({selectedLedgerCustomer.code})</span>
                <span>DATE: {new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-slate-100 print:hidden">
              <div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-md font-mono">
                  {selectedLedgerCustomer.code}
                </span>
                <h3 className="font-bold text-xl text-slate-900 mt-1">
                  {selectedLedgerCustomer.name} - Statement
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-yellow-300" />
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={() => setSelectedLedgerCustomer(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="my-4 bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs font-bold border border-slate-200">
              <span>Current Outstanding:</span>
              <span className="text-base font-mono text-amber-600 font-extrabold">
                {settings.currencySymbol} {selectedLedgerCustomer.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Ref No</th>
                    <th className="p-3 text-right">Debit / Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {sales
                    .filter((s) => s.customerId === selectedLedgerCustomer.id)
                    .map((s) => (
                      <tr key={s.id}>
                        <td className="p-3">{s.date}</td>
                        <td className="p-3 font-bold text-blue-600">Sale Invoice</td>
                        <td className="p-3 font-mono">{s.invoiceNumber}</td>
                        <td className="p-3 text-right font-mono text-amber-600 font-bold">
                          +{settings.currencySymbol} {s.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}

                  {receipts
                    .filter((r) => r.customerId === selectedLedgerCustomer.id)
                    .map((r) => (
                      <tr key={r.id}>
                        <td className="p-3">{r.date}</td>
                        <td className="p-3 font-bold text-emerald-600">Receipt Paid</td>
                        <td className="p-3 font-mono">{r.receiptNumber}</td>
                        <td className="p-3 text-right font-mono text-emerald-600 font-bold">
                          -{settings.currencySymbol} {r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end print:hidden">
              <button
                onClick={() => setSelectedLedgerCustomer(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-sm rounded-xl"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
