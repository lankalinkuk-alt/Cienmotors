import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  DollarSign,
  AlertCircle,
  Globe
} from 'lucide-react';
import { Company, AuthSession } from '../types';
import { checkPermission } from '../lib/permissions';

interface CompanyManagementProps {
  companies: Company[];
  activeCompany: Company;
  session: AuthSession | null;
  onSaveCompany: (compData: Partial<Company>) => void;
  onToggleCompanyStatus: (companyId: string, disable: boolean) => void;
  onSwitchCompany: (companyId: string) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CompanyManagement: React.FC<CompanyManagementProps> = ({
  companies,
  activeCompany,
  session,
  onSaveCompany,
  onToggleCompanyStatus,
  onSwitchCompany,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const canAdd = checkPermission(session?.effectivePermissions, 'companies', 'add') || session?.user.isAdmin;
  const canEdit = checkPermission(session?.effectivePermissions, 'companies', 'edit') || session?.user.isAdmin;
  const canDisable = checkPermission(session?.effectivePermissions, 'companies', 'disable') || session?.user.isAdmin;

  // Form State
  const [formData, setFormData] = useState<Partial<Company>>({
    companyName: '',
    shortName: '',
    address: '',
    city: 'Colombo',
    district: 'Colombo',
    country: 'Sri Lanka',
    telephone: '',
    mobile: '',
    companyEmail: '',
    taxRegistrationNo: '',
    currency: 'Rs.',
    financialYearStart: '2026-01-01',
    financialYearEnd: '2026-12-31',
    invoicePrefix: 'INV',
    invoiceNumber: 1001,
    isActive: true,
    isVatEnabled: true,
    vatNumber: '',
    defaultVatRate: 18,
    vatType: 'EXCLUSIVE',
    isItemDiscountEnabled: true,
    defaultDiscountType: 'PERCENT'
  });

  const handleOpenAdd = () => {
    setEditingCompany(null);
    setFormData({
      companyName: '',
      shortName: '',
      address: '',
      city: 'Colombo',
      district: 'Colombo',
      country: 'Sri Lanka',
      telephone: '',
      mobile: '',
      companyEmail: '',
      taxRegistrationNo: '',
      currency: 'Rs.',
      financialYearStart: '2026-01-01',
      financialYearEnd: '2026-12-31',
      invoicePrefix: 'INV',
      invoiceNumber: 1001,
      isActive: true,
      isVatEnabled: true,
      vatNumber: '',
      defaultVatRate: 18,
      vatType: 'EXCLUSIVE',
      isItemDiscountEnabled: true,
      defaultDiscountType: 'PERCENT'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingCompany(comp);
    setFormData({ ...comp });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName?.trim()) {
      showToast('error', 'Company Name is required.');
      return;
    }
    if (!formData.shortName?.trim()) {
      showToast('error', 'Company Short Name is required.');
      return;
    }

    try {
      onSaveCompany({
        ...formData,
        id: editingCompany ? editingCompany.id : undefined
      });
      showToast('success', editingCompany ? 'Company details updated.' : 'New company created successfully!');
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save company.';
      showToast('error', msg);
    }
  };

  const filteredCompanies = (companies || []).filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      (c.companyEmail && c.companyEmail.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Company Master Directory</h1>
              <p className="text-sm text-slate-500">
                Manage multiple business companies, financial settings, and isolation rules.
              </p>
            </div>
          </div>
        </div>

        {canAdd && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Company</span>
          </button>
        )}
      </div>

      {/* Active Company Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-200 rounded-full text-xs font-semibold tracking-wide border border-blue-400/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Current Active Context
          </div>
          <h2 className="text-2xl font-bold">{activeCompany.companyName}</h2>
          <p className="text-blue-200/80 text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
            {activeCompany.address}, {activeCompany.city} | {activeCompany.telephone}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10">
          <div>
            <div className="text-xs text-blue-200">Invoice Prefix & Counter</div>
            <div className="font-mono font-bold text-lg text-white">
              {activeCompany.invoicePrefix} - {activeCompany.invoiceNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by company name, short code, city, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 text-sm shadow-xs"
        />
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((comp) => {
          const isActiveComp = comp.id === activeCompany.id;
          return (
            <div
              key={comp.id}
              className={`bg-white rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md ${
                isActiveComp ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase border border-blue-100">
                        {comp.shortName}
                      </span>
                      {isActiveComp && (
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                          Active Context
                        </span>
                      )}
                      {comp.isVatEnabled ? (
                        <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-0.5 rounded-full">
                          VAT {comp.defaultVatRate ?? 18}% ({comp.vatType || 'EXCLUSIVE'})
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                          VAT Exempt
                        </span>
                      )}
                      {comp.isItemDiscountEnabled !== false ? (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded-full">
                          Discount ({comp.defaultDiscountType === 'FIXED' ? comp.currency || 'Rs.' : '%'})
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                          Item Disc. Disabled
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{comp.companyName}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      comp.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {comp.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {comp.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {comp.address}, {comp.city}
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{comp.telephone}</span>
                  </p>
                  {comp.companyEmail && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{comp.companyEmail}</span>
                    </p>
                  )}
                  {comp.taxRegistrationNo && (
                    <p className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Tax ID: {comp.taxRegistrationNo}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                {!isActiveComp && comp.isActive ? (
                  <button
                    onClick={() => onSwitchCompany(comp.id)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Switch to this Company
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    {isActiveComp ? 'Currently Open' : 'Company Disabled'}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {canEdit && (
                    <button
                      onClick={() => handleOpenEdit(comp)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Company Details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDisable && !isActiveComp && (
                    <button
                      onClick={() => onToggleCompanyStatus(comp.id, comp.isActive)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        comp.isActive
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      {comp.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" />
                <span>{editingCompany ? 'Edit Company Profile' : 'Create New Company'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName || ''}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g. Kumar Hardware Store"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Short Name / Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.shortName || ''}
                    onChange={(e) => setFormData({ ...formData, shortName: e.target.value.toUpperCase() })}
                    placeholder="e.g. KHW"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="e.g. 124 Main Street, Pettah"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Colombo 11"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country || 'Sri Lanka'}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Telephone
                  </label>
                  <input
                    type="text"
                    value={formData.telephone || ''}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    placeholder="e.g. +94 11 234 5678"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Company Email
                  </label>
                  <input
                    type="email"
                    value={formData.companyEmail || ''}
                    onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                    placeholder="info@company.lk"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Tax / VAT Reg. No.
                  </label>
                  <input
                    type="text"
                    value={formData.taxRegistrationNo || ''}
                    onChange={(e) => setFormData({ ...formData, taxRegistrationNo: e.target.value })}
                    placeholder="e.g. VAT-10928374"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.invoicePrefix || 'INV'}
                    onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value.toUpperCase() })}
                    placeholder="e.g. INV"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-mono"
                  />
                </div>

                {/* VAT / Tax Configuration Box */}
                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider block">
                        VAT / Value Added Tax Configuration
                      </span>
                      <span className="text-xs text-slate-500">
                        Enable or disable VAT calculations and tax invoices for this company.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isVatEnabled ?? true}
                        onChange={(e) =>
                          setFormData({ ...formData, isVatEnabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {formData.isVatEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                          VAT Reg. Number
                        </label>
                        <input
                          type="text"
                          value={formData.vatNumber || formData.taxRegistrationNo || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              vatNumber: e.target.value,
                              taxRegistrationNo: e.target.value
                            })
                          }
                          placeholder="e.g. VAT-10928374"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                          Default VAT Rate (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.defaultVatRate ?? 18}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              defaultVatRate: parseFloat(e.target.value) || 0
                            })
                          }
                          placeholder="18"
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                          VAT Calculation Mode
                        </label>
                        <select
                          value={formData.vatType || 'EXCLUSIVE'}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              vatType: e.target.value as 'INCLUSIVE' | 'EXCLUSIVE'
                            })
                          }
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold"
                        >
                          <option value="EXCLUSIVE">Tax Exclusive (Added On Top)</option>
                          <option value="INCLUSIVE">Tax Inclusive (Included in Price)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item-wise Discount Configuration Box */}
                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider block">
                        Item-wise Discount Configuration
                      </span>
                      <span className="text-xs text-slate-500">
                        Enable or disable line-item level discount entry in Sales and Purchase invoices.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isItemDiscountEnabled ?? true}
                        onChange={(e) =>
                          setFormData({ ...formData, isItemDiscountEnabled: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {formData.isItemDiscountEnabled && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Default Discount Mode
                      </label>
                      <select
                        value={formData.defaultDiscountType || 'PERCENT'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultDiscountType: e.target.value as 'PERCENT' | 'FIXED'
                          })
                        }
                        className="w-full sm:w-1/2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-semibold"
                      >
                        <option value="PERCENT">Percentage Discount (%)</option>
                        <option value="FIXED">Fixed Amount Discount ({formData.currency || 'Rs.'})</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors cursor-pointer"
                >
                  {editingCompany ? 'Save Changes' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
