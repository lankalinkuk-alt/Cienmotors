import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Database,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Sliders,
  Building,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Printer,
  Receipt,
  FileSpreadsheet,
  CloudUpload,
  CloudDownload,
  Activity,
  BookOpen
} from 'lucide-react';
import { AppSettings, InvoicePrintFormat, AuthSession } from '../types';
import { SUPABASE_SQL_SCHEMA } from '../lib/sqlExport';
import { testSupabaseConnection, ConnectionTestResult, SupabaseSyncService } from '../lib/supabase';
import { StorageService } from '../lib/storage';
import { AuthService } from '../lib/auth';
import { AccountGroupsModal } from './AccountGroupsModal';

interface SettingsProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onResetToSample?: () => void;
  onClearAll: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigateToUsers?: () => void;
  onNavigateToDataImport?: () => void;
  session?: AuthSession | null;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onSaveSettings,
  onResetToSample,
  onClearAll,
  showToast,
  onNavigateToUsers,
  onNavigateToDataImport,
  session
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showAccountGroupsModal, setShowAccountGroupsModal] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isPulling, setIsPulling] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    showToast('success', 'Settings updated successfully!');
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(formData.supabaseUrl, formData.supabaseAnonKey);
      setTestResult(result);
      if (result.success) {
        showToast('success', 'Connected to Supabase successfully!');
      } else {
        showToast('error', result.message);
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        url: formData.supabaseUrl || '',
        message: e?.message || 'Failed to connect to Supabase.'
      });
      showToast('error', 'Supabase connection failed.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handlePushAllToCloud = async () => {
    if (!formData.supabaseUrl || !formData.supabaseAnonKey) {
      showToast('error', 'Please enter your Supabase URL and Key and save settings first.');
      return;
    }
    setIsSyncing(true);
    try {
      const prods = StorageService.getProducts();
      const custs = StorageService.getCustomers();
      const supps = StorageService.getSuppliers();
      const sales = StorageService.getSales();
      const purchases = StorageService.getPurchases();
      const receipts = StorageService.getReceipts();
      const payments = StorageService.getPayments();
      const expenses = StorageService.getExpenses();
      const users = AuthService.getUsers();

      let syncedCount = 0;
      let errorCount = 0;
      let lastErrorMessage = '';

      for (const u of users) {
        const res = await SupabaseSyncService.syncUser(u);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'User sync failed'; }
      }
      for (const p of prods) {
        const res = await SupabaseSyncService.syncProduct(p);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Product sync failed'; }
      }
      for (const c of custs) {
        const res = await SupabaseSyncService.syncCustomer(c);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Customer sync failed'; }
      }
      for (const s of supps) {
        const res = await SupabaseSyncService.syncSupplier(s);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Supplier sync failed'; }
      }
      for (const sale of sales) {
        const res = await SupabaseSyncService.syncSaleInvoice(sale);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Sale sync failed'; }
      }
      for (const pur of purchases) {
        const res = await SupabaseSyncService.syncPurchaseInvoice(pur);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Purchase sync failed'; }
      }
      for (const rec of receipts) {
        const res = await SupabaseSyncService.syncReceipt(rec);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Receipt sync failed'; }
      }
      for (const pay of payments) {
        const res = await SupabaseSyncService.syncPayment(pay);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Payment sync failed'; }
      }
      for (const exp of expenses) {
        const res = await SupabaseSyncService.syncExpense(exp);
        if (res.success) syncedCount++;
        else { errorCount++; lastErrorMessage = res.error || 'Expense sync failed'; }
      }

      if (errorCount > 0) {
        showToast('error', `Synced ${syncedCount} items, but ${errorCount} items failed to save in Supabase: ${lastErrorMessage}`);
      } else {
        showToast('success', `Successfully pushed ${syncedCount} records to Supabase Cloud!`);
      }
    } catch (err: any) {
      showToast('error', `Sync failed: ${err?.message || 'Check database connection'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullAllFromCloud = async () => {
    if (!formData.supabaseUrl || !formData.supabaseAnonKey) {
      showToast('error', 'Please enter your Supabase URL and Key and save settings first.');
      return;
    }
    setIsPulling(true);
    try {
      const result = await StorageService.pullFromSupabase();
      if (result.success) {
        const total = Object.values(result.pulledCounts || {}).reduce((a, b) => a + b, 0);
        showToast('success', `Pulled ${total} records from Supabase cloud into this device!`);
        window.location.reload();
      } else {
        showToast('error', `Cloud pull failed: ${result.error || 'Check Supabase connection'}`);
      }
    } catch (err: any) {
      showToast('error', `Cloud pull failed: ${err?.message || 'Check connection'}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    showToast('success', 'Supabase SQL DDL script copied to clipboard!');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Application Settings</h2>
          <p className="text-xs text-slate-500">
            Configure business information, inventory policies, and Supabase database connection
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToDataImport && (
            <button
              type="button"
              onClick={onNavigateToDataImport}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Data Import</span>
            </button>
          )}

          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-sm"
          >
            <Save className="w-4 h-4 text-yellow-400" />
            <span>Save All Settings</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Profile */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">Business Profile & Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Company Name
              </label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.companyPhone}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Company Address
              </label>
              <input
                type="text"
                value={formData.companyAddress}
                onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.companyEmail}
                onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                VAT / Tax / Business Reg No (Printed on Document Headers)
              </label>
              <input
                type="text"
                placeholder="e.g. VAT-11928374-7000"
                value={formData.taxRegistrationNo || ''}
                onChange={(e) => setFormData({ ...formData, taxRegistrationNo: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Invoice Note / Footer Terms
              </label>
              <input
                type="text"
                value={formData.invoiceNote}
                onChange={(e) => setFormData({ ...formData, invoiceNote: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Printer & Document Layout Settings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Printer className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Printer & Document Layout Settings
              </h3>
              <p className="text-xs text-slate-500">
                Optimize invoice printing for Dot Matrix continuous stationery, Thermal POS rolls, and custom sheet sizes
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Default Invoice Print Format
              </label>
              <select
                value={formData.defaultPrintFormat || 'A4'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultPrintFormat: e.target.value as InvoicePrintFormat
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium focus:border-blue-500"
              >
                <option value="A4">📄 A4 Full Sheet (210mm × 297mm)</option>
                <option value="A5">📑 A5 Half Sheet (148mm × 210mm)</option>
                <option value="DOT_MATRIX">🖨️ Dot Matrix / Continuous Tractor Paper (8.5" × 5.5" / 8.5" × 11")</option>
                <option value="THERMAL_80">🧾 80mm Thermal POS Receipt (3 inch)</option>
                <option value="THERMAL_58">🧾 58mm Mini Thermal Receipt (2 inch / Bluetooth)</option>
                <option value="CUSTOM">📐 Custom Page Size</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Default Print Font Density
              </label>
              <select
                value={formData.printFontSize || 'normal'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    printFontSize: e.target.value as 'compact' | 'normal' | 'large'
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium focus:border-blue-500"
              >
                <option value="compact">Compact (Dense fit for smaller papers)</option>
                <option value="normal">Standard / Regular (Recommended)</option>
                <option value="large">Large (High legibility)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Dot Matrix Monospace Styling</h4>
                <p className="text-xs text-slate-500">
                  Use ribbon-saving dashed ASCII lines and clean monospace font for impact printers
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.dotMatrixDashedBorders ?? true}
                  onChange={(e) =>
                    setFormData({ ...formData, dotMatrixDashedBorders: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Custom Paper Width (mm)
              </label>
              <input
                type="number"
                min="50"
                max="300"
                value={formData.customPageWidthMm || 210}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customPageWidthMm: Number(e.target.value || 210)
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:border-blue-500"
                placeholder="210"
              />
            </div>
          </div>
        </div>

        {/* Inventory Rules & Currency */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900">Inventory Policy & Currency</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                required
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Currency Code
              </label>
              <input
                type="text"
                required
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono uppercase font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Initial Opening Cash
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.initialCashBalance}
                onChange={(e) =>
                  setFormData({ ...formData, initialCashBalance: Number(e.target.value || 0) })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold"
              />
            </div>
          </div>

          {/* Negative Stock Toggle */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Allow Negative Stock</h4>
              <p className="text-xs text-slate-500">
                When enabled, sales invoices can be created even if current stock is zero or less.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.allowNegativeStock}
                onChange={(e) =>
                  setFormData({ ...formData, allowNegativeStock: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Users, Roles & Security Management Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                U
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Users, Roles & Security Rights</h3>
                <p className="text-xs text-slate-500">
                  Manage login users, password resets, role rights templates, and audit security logs
                </p>
              </div>
            </div>

            {onNavigateToUsers && (
              <button
                type="button"
                onClick={onNavigateToUsers}
                className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
              >
                <span>Open Users & Rights Panel</span>
              </button>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-900">BUSY-Style Strict Security System Active:</p>
            <p>• Username + Password login with cryptographic salt and SHA-256 password hashing.</p>
            <p>• Built-in roles (Administrator, Manager, Sales, Purchase, Inventory, Accounts, Report, Viewer) with individual user override permissions.</p>
            <p>• Complete audit security logs tracking all user logins, record modifications, and permission updates.</p>
          </div>
        </div>

        {/* Standard Chart of Account Groups Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Chart of Account Groups (29 Standard Groups)</h3>
                <p className="text-xs text-slate-500">
                  Inspect the official 29 account groups, balance sheet classifications, normal balances (Dr/Cr), and trade mappings.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAccountGroupsModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>View 29 Account Groups</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="font-bold text-emerald-800 text-sm">10 Groups</div>
              <div className="text-emerald-600 text-[11px]">Assets (Dr)</div>
            </div>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
              <div className="font-bold text-rose-800 text-sm">9 Groups</div>
              <div className="text-rose-600 text-[11px]">Liabilities (Cr)</div>
            </div>
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="font-bold text-purple-800 text-sm">3 Groups</div>
              <div className="text-purple-600 text-[11px]">Equity / Capital (Cr)</div>
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="font-bold text-blue-800 text-sm">4 Groups</div>
              <div className="text-blue-600 text-[11px]">Income / Sales (Cr)</div>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl col-span-2 sm:col-span-1">
              <div className="font-bold text-amber-800 text-sm">3 Groups</div>
              <div className="text-amber-600 text-[11px]">Expenses / Purchase (Dr)</div>
            </div>
          </div>
        </div>

        {/* Supabase Integration & Database Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Supabase PostgreSQL Cloud Database
                </h3>
                <p className="text-xs text-slate-500">
                  Connect your remote Supabase PostgreSQL database to sync products, customers, suppliers, and transactions in real-time.
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 font-mono text-xs font-bold rounded-lg border ${
              formData.supabaseUrl && formData.supabaseAnonKey
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {formData.supabaseUrl && formData.supabaseAnonKey
                ? 'Supabase Configured'
                : 'Local Offline Mode'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Supabase Project URL
              </label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={formData.supabaseUrl}
                onChange={(e) => setFormData({ ...formData, supabaseUrl: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Found in Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Supabase Anon / Public API Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={formData.supabaseAnonKey}
                onChange={(e) => setFormData({ ...formData, supabaseAnonKey: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Found in Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project API keys (anon public)
              </span>
            </div>
          </div>

          {/* Test Connection & Cloud Diagnostics */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800">Connection & Cloud Sync Engine</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isTestingConnection}
                  onClick={handleTestConnection}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs border border-blue-200 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                  <span>{isTestingConnection ? 'Testing Connection...' : 'Test Supabase Connection'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncing || !formData.supabaseUrl || !formData.supabaseAnonKey}
                  onClick={handlePushAllToCloud}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs border border-emerald-200 cursor-pointer disabled:opacity-50 transition-all"
                  title="Upload all local records to Supabase Cloud"
                >
                  <CloudUpload className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Pushing...' : 'Push Local to Cloud'}</span>
                </button>

                <button
                  type="button"
                  disabled={isPulling || !formData.supabaseUrl || !formData.supabaseAnonKey}
                  onClick={handlePullAllFromCloud}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs border border-indigo-200 cursor-pointer disabled:opacity-50 transition-all"
                  title="Fetch and pull all records from Supabase Cloud to this device"
                >
                  <CloudDownload className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                  <span>{isPulling ? 'Pulling...' : 'Pull Cloud to Device'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border text-xs ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold">{testResult.message}</p>
                    {testResult.details && (
                      <p className="font-mono text-[11px] mt-1 text-slate-600 bg-white/70 p-1.5 rounded border border-slate-200">
                        {testResult.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SQL Copy & Database Tools */}
          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-2xs cursor-pointer"
              >
                {copiedSql ? <Check className="w-4 h-4 text-yellow-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'Copied SQL Script!' : 'Copy Supabase SQL Schema Script'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-slate-500" />
                <span>View Schema DDL</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('ARE YOU SURE? This clears all operational data (sales, purchases, inventory, customers, suppliers) and resets to a clean empty state.')) {
                    onClearAll();
                    showToast('info', 'All operational data cleared successfully.');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Clear All Data</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* SQL Script View Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-lg text-slate-900">Supabase DDL Creation Script</h3>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Copy and paste this SQL script directly into your Supabase project's SQL Editor to create tables with foreign keys and unique constraints:
            </p>

            <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-96 border border-slate-800">
              {SUPABASE_SQL_SCHEMA}
            </pre>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'busy_ufo_schema.sql';
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('success', 'Downloaded busy_ufo_schema.sql successfully!');
                }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer transition-all"
              >
                <FileCode className="w-4 h-4 text-yellow-400" />
                <span>Download .sql File</span>
              </button>

              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer transition-all"
              >
                <Copy className="w-4 h-4" />
                <span>{copiedSql ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Groups Table Modal */}
      <AccountGroupsModal
        isOpen={showAccountGroupsModal}
        onClose={() => setShowAccountGroupsModal(false)}
      />
    </div>
  );
};
