import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Menu
} from 'lucide-react';
import {
  Customer,
  Supplier,
  Product,
  SaleInvoice,
  PurchaseInvoice,
  CustomerReceipt,
  SupplierPayment,
  Expense,
  AppSettings,
  Company,
  PageType,
  DashboardSummary,
  TransactionRecord,
  AuthSession
} from './types';
import { StorageService } from './lib/storage';
import { AuthService } from './lib/auth';
import { checkPermission } from './lib/permissions';
import { SupabaseSyncService, getActiveSupabaseCredentials } from './lib/supabase';

import { Login } from './components/Login';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Customers } from './components/Customers';
import { Suppliers } from './components/Suppliers';
import { Products } from './components/Products';
import { Sales } from './components/Sales';
import { Purchases } from './components/Purchases';
import { Payments } from './components/Payments';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { UserManagement } from './components/UserManagement';
import { CompanyManagement } from './components/CompanyManagement';
import { DataImport } from './components/DataImport';
import { PrintInvoiceModal } from './components/PrintInvoiceModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ShortcutProvider, useShortcuts } from './lib/ShortcutContext';
import { QuickSalesModal } from './components/QuickSalesModal';
import { LedgerModal } from './components/LedgerModal';
import { ItemHistoryModal } from './components/ItemHistoryModal';
import { PdcManagement } from './components/PdcManagement';
import { TrialBalanceView } from './components/TrialBalanceView';
import { ProfitLossView } from './components/ProfitLossView';
import { MisReports } from './components/MisReports';
import { PdcTransaction } from './types';

// Component to render shortcut modals
function GlobalShortcutModals({
  customers,
  suppliers,
  products,
  settings,
  activeCompany,
  onRefresh,
  addToast
}: {
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  settings: AppSettings;
  activeCompany?: Company;
  onRefresh: () => void;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  const {
    isQuickSalesOpen,
    closeQuickSales,
    isLedgerOpen,
    selectedLedgerId,
    closeLedger,
    isItemHistoryOpen,
    selectedProductId,
    closeItemHistory
  } = useShortcuts();

  return (
    <>
      {isQuickSalesOpen && (
        <QuickSalesModal
          customers={customers}
          products={products}
          settings={settings}
          company={activeCompany}
          onClose={closeQuickSales}
          onSuccess={(msg) => {
            addToast('success', msg);
            onRefresh();
          }}
          onError={(msg) => addToast('error', msg)}
        />
      )}

      {isLedgerOpen && (
        <LedgerModal
          customers={customers}
          suppliers={suppliers}
          settings={settings}
          initialLedgerId={selectedLedgerId}
          onClose={closeLedger}
        />
      )}

      {isItemHistoryOpen && (
        <ItemHistoryModal
          products={products}
          settings={settings}
          initialProductId={selectedProductId}
          onClose={closeItemHistory}
        />
      )}
    </>
  );
}

function AppMain() {
  // Authentication & Session State
  const [session, setSession] = useState<AuthSession | null>(() => AuthService.getCurrentSession());

  // Page Routing State
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [history, setHistory] = useState<PageType[]>(['dashboard']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Application Data States
  const [companies, setCompanies] = useState<Company[]>(() => StorageService.getCompanies());
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [customers, setCustomers] = useState<Customer[]>(() => StorageService.getCustomers());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => StorageService.getSuppliers());
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [sales, setSales] = useState<SaleInvoice[]>(() => StorageService.getSales());
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(() => StorageService.getPurchases());
  const [receipts, setReceipts] = useState<CustomerReceipt[]>(() => StorageService.getReceipts());
  const [payments, setPayments] = useState<SupplierPayment[]>(() => StorageService.getPayments());
  const [expenses, setExpenses] = useState<Expense[]>(() => StorageService.getExpenses());
  const [pdcs, setPdcs] = useState<PdcTransaction[]>(() => StorageService.getPdcs());

  // Print Invoice Modal State
  const [printingDoc, setPrintingDoc] = useState<{
    doc: SaleInvoice | PurchaseInvoice;
    isPurchase: boolean;
  } | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    setCurrentPage('dashboard');
    addToast('success', `Welcome, ${newSession.user.fullName || newSession.user.username}!`);
  };

  const handleLogout = () => {
    AuthService.logout();
    setSession(null);
    addToast('info', 'Logged out successfully.');
  };

  const refreshSession = () => {
    const updated = AuthService.getCurrentSession();
    if (updated) {
      setSession(updated);
    }
  };

  const handleNavigate = (page: PageType) => {
    if (page === currentPage) return;

    // Guard page navigation if session exists
    if (session && page !== 'dashboard' && page !== 'settings' && page !== 'users') {
      const canView = checkPermission(session.effectivePermissions, page as any, 'view');
      if (!canView) {
        addToast('error', `Access Denied: Your account does not have permission to view ${page}.`);
        return;
      }
    }

    if (session && page === 'users' && !session.user.isSuperAdmin && session.user.role !== 'Administrator') {
      const canManageUsers = checkPermission(session.effectivePermissions, 'users', 'view');
      if (!canManageUsers) {
        addToast('error', 'Access Denied: Only Administrators can access User Rights Management.');
        return;
      }
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(page);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
    refreshAllStates();
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentPage(history[newIndex]);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentPage(history[newIndex]);
    }
  };

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  // Reload all states from Storage Engine (Company Isolated)
  const refreshAllStates = (compId?: string) => {
    const activeCompId = compId || session?.company?.id;
    setCompanies(StorageService.getCompanies());
    setSettings(StorageService.getSettings());
    setCustomers(StorageService.getCustomers(activeCompId));
    setSuppliers(StorageService.getSuppliers(activeCompId));
    setProducts(StorageService.getProducts(activeCompId));
    setSales(StorageService.getSales(activeCompId));
    setPurchases(StorageService.getPurchases(activeCompId));
    setReceipts(StorageService.getReceipts(activeCompId));
    setPayments(StorageService.getPayments(activeCompId));
    setExpenses(StorageService.getExpenses(activeCompId));
    setPdcs(StorageService.getPdcs(activeCompId));
  };

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const isPullingRef = useRef(false);
  const lastPullTimeRef = useRef(0);

  const performCloudPull = async (compId?: string, showToastNotice = false, force = false) => {
    const activeCompId = compId || session?.company?.id;
    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) return;

    const now = Date.now();
    if (isPullingRef.current) return;
    if (!force && now - lastPullTimeRef.current < 8000) return;

    isPullingRef.current = true;
    lastPullTimeRef.current = now;
    setIsSyncingCloud(true);

    try {
      const res = await StorageService.pullFromSupabase(activeCompId);
      if (res.success) {
        refreshAllStates(activeCompId);
        if (showToastNotice) {
          const totalPulled = Object.values(res.pulledCounts || {}).reduce((a, b) => a + b, 0);
          if (totalPulled > 0) {
            addToast('success', `Synced ${totalPulled} cloud records across devices.`);
          } else {
            addToast('info', 'Cloud is already in sync. No new records found.');
          }
        }
      }
    } catch (e) {
      console.warn('Cloud sync error:', e);
    } finally {
      isPullingRef.current = false;
      setIsSyncingCloud(false);
    }
  };

  useEffect(() => {
    document.title = 'UFO Tech solution';
  }, []);

  useEffect(() => {
    if (session?.company?.id) {
      refreshAllStates(session.company.id);
      // Auto-pull on company load
      performCloudPull(session.company.id, false, true);
    }
  }, [session?.company?.id]);

  // Real-time multi-device cloud listener & cross-tab local live sync
  useEffect(() => {
    // 1. Supabase Realtime WebSocket Subscription (Debounced to prevent cascades)
    let realtimeDebounceTimer: any = null;
    const unsubscribeSupabase = SupabaseSyncService.subscribeToRemoteChanges((table, eventType) => {
      console.log(`[Supabase Realtime] ${eventType} on ${table}`);
      if (session?.company?.id) {
        if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
        realtimeDebounceTimer = setTimeout(() => {
          performCloudPull(session.company.id, false, false);
        }, 2000);
      }
    });

    // 2. Cross-Tab & Same-Tab Local Storage Change Listeners (Debounced)
    let refreshTimeout: any = null;
    const handleLocalRefresh = (e?: any) => {
      // Ignore internal sync flags
      if (e?.detail?.key === 'busy_ufo_pending_sync' || e?.detail?.key === 'busy_ufo_deleted_ids') {
        return;
      }
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        if (session?.company?.id) {
          refreshAllStates(session.company.id);
        }
      }, 100);
    };

    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ufo_cross_tab_sync') : null;
    if (bc) {
      bc.onmessage = () => handleLocalRefresh();
    }

    window.addEventListener('storage', handleLocalRefresh);
    window.addEventListener('ufo_local_storage_change', handleLocalRefresh);

    // 3. Tab Visibility & Focus Pull
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && session?.company?.id) {
        performCloudPull(session.company.id, false, false);
      }
    };

    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);

    return () => {
      if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
      if (refreshTimeout) clearTimeout(refreshTimeout);
      unsubscribeSupabase();
      if (bc) bc.close();
      window.removeEventListener('storage', handleLocalRefresh);
      window.removeEventListener('ufo_local_storage_change', handleLocalRefresh);
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [session?.company?.id]);

  const handleSwitchCompany = (companyId: string) => {
    try {
      const updatedSession = AuthService.switchCompany(companyId);
      setSession(updatedSession);
      refreshAllStates(updatedSession.company.id);
      addToast('success', `Switched active company to ${updatedSession.company.companyName}`);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to switch company.');
    }
  };

  const handleSaveCompany = async (compData: Partial<Company>) => {
    const res = await StorageService.saveCompanyAsync(compData);
    setCompanies(StorageService.getCompanies());
    refreshSession();
    if (res.success) {
      addToast('success', res.message || `Company "${res.data?.companyName || 'Company'}" saved successfully.`);
    } else {
      addToast('error', res.error || 'Failed to save company to database.');
    }
  };

  const handleToggleCompanyStatus = (companyId: string, disable: boolean) => {
    StorageService.disableCompany(companyId, disable);
    setCompanies(StorageService.getCompanies());
    refreshSession();
    addToast('info', disable ? 'Company has been disabled.' : 'Company has been enabled.');
  };

  // Derived Dashboard Stats (Company Isolated)
  const activeCompId = session?.company?.id;
  const dashboardSummary: DashboardSummary = StorageService.getDashboardSummary(activeCompId);
  const recentTransactions: TransactionRecord[] = StorageService.getRecentTransactions(activeCompId);

  // Handlers for Customers
  const handleSaveCustomer = async (custData: Partial<Customer>) => {
    const res = await StorageService.saveCustomerAsync(custData, activeCompId);
    if (res.success) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          custData.id ? 'CUSTOMER_EDITED' : 'CUSTOMER_CREATED',
          'customers',
          `Saved customer record: ${custData.name}`,
          custData.id || res.data?.id
        );
      }
      addToast('success', res.message || 'Customer profile saved successfully.');
    } else {
      addToast('error', res.error || 'Failed to save customer to database.');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    const res = await StorageService.deleteCustomerAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('CUSTOMER_DELETED', 'customers', `Deleted customer record ${id}`, id);
      }
      addToast('info', res.message || 'Customer removed.');
    } else {
      addToast('error', res.error || 'Failed to delete customer.');
    }
  };

  // Handlers for Suppliers
  const handleSaveSupplier = async (suppData: Partial<Supplier>) => {
    const res = await StorageService.saveSupplierAsync(suppData, activeCompId);
    if (res.success) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          suppData.id ? 'SUPPLIER_EDITED' : 'SUPPLIER_CREATED',
          'suppliers',
          `Saved supplier record: ${suppData.name}`,
          suppData.id || res.data?.id
        );
      }
      addToast('success', res.message || 'Supplier profile saved successfully.');
    } else {
      addToast('error', res.error || 'Failed to save supplier to database.');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    const res = await StorageService.deleteSupplierAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('SUPPLIER_DELETED', 'suppliers', `Deleted supplier record ${id}`, id);
      }
      addToast('info', res.message || 'Supplier removed.');
    } else {
      addToast('error', res.error || 'Failed to delete supplier.');
    }
  };

  // Handlers for Products
  const handleSaveProduct = async (prodData: Partial<Product>) => {
    const res = await StorageService.saveProductAsync(prodData, activeCompId);
    if (res.success) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          prodData.id ? 'PRODUCT_EDITED' : 'PRODUCT_CREATED',
          'products',
          `Saved product: ${prodData.name} (${prodData.code})`,
          prodData.id || res.data?.id
        );
      }
      addToast('success', res.message || `Product "${prodData.name}" saved successfully.`);
    } else {
      addToast('error', res.error || 'Failed to save product to database.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await StorageService.deleteProductAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('PRODUCT_DELETED', 'products', `Deleted product ${id}`, id);
      }
      addToast('info', res.message || 'Product removed.');
    } else {
      addToast('error', res.error || 'Failed to delete product.');
    }
  };

  // Handlers for Invoices & Purchases
  const handleCreateSaleInvoice = async (
    invoiceData: Omit<SaleInvoice, 'id' | 'invoiceNumber' | 'createdAt'>
  ): Promise<SaleInvoice> => {
    const res = await StorageService.createSaleInvoiceAsync(invoiceData, activeCompId);
    if (res.success && res.data) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          'SALE_CREATED',
          'sales',
          `Created invoice ${res.data.invoiceNumber} for ${res.data.customerName} (${settings.currencySymbol} ${res.data.grandTotal})`,
          res.data.id
        );
      }
      return res.data;
    } else {
      throw new Error(res.error || 'Failed to save sale invoice.');
    }
  };

  const handleUpdateSaleInvoice = async (
    id: string,
    invoiceData: Partial<SaleInvoice>
  ): Promise<SaleInvoice> => {
    const res = await StorageService.updateSaleInvoiceAsync(id, invoiceData, activeCompId);
    if (res.success && res.data) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          'SALE_EDITED',
          'sales',
          `Modified sale invoice ${res.data.invoiceNumber} for ${res.data.customerName}`,
          res.data.id
        );
      }
      return res.data;
    } else {
      throw new Error(res.error || 'Failed to update sale invoice.');
    }
  };

  const handleDeleteSaleInvoice = async (id: string) => {
    const res = await StorageService.deleteSaleInvoiceAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('SALE_DELETED', 'sales', `Voided sale invoice ${id}`, id);
      }
      addToast('info', res.message || 'Sale invoice voided.');
    } else {
      addToast('error', res.error || 'Failed to void sale invoice.');
    }
  };

  const handleCreatePurchaseInvoice = async (
    purchaseData: Omit<PurchaseInvoice, 'id' | 'purchaseNumber' | 'createdAt'>
  ): Promise<PurchaseInvoice> => {
    const res = await StorageService.createPurchaseInvoiceAsync(purchaseData, activeCompId);
    if (res.success && res.data) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          'PURCHASE_CREATED',
          'purchases',
          `Recorded purchase ${res.data.purchaseNumber} from ${res.data.supplierName}`,
          res.data.id
        );
      }
      return res.data;
    } else {
      throw new Error(res.error || 'Failed to record purchase bill.');
    }
  };

  const handleUpdatePurchaseInvoice = async (
    id: string,
    purchaseData: Partial<PurchaseInvoice>
  ): Promise<PurchaseInvoice> => {
    const res = await StorageService.updatePurchaseInvoiceAsync(id, purchaseData, activeCompId);
    if (res.success && res.data) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          'PURCHASE_EDITED',
          'purchases',
          `Modified purchase ${res.data.purchaseNumber} from ${res.data.supplierName}`,
          res.data.id
        );
      }
      return res.data;
    } else {
      throw new Error(res.error || 'Failed to update purchase bill.');
    }
  };

  const handleDeletePurchaseInvoice = async (id: string) => {
    const res = await StorageService.deletePurchaseInvoiceAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('PURCHASE_DELETED', 'purchases', `Voided purchase bill ${id}`, id);
      }
      addToast('info', res.message || 'Purchase invoice voided.');
    } else {
      addToast('error', res.error || 'Failed to void purchase bill.');
    }
  };

  // Handlers for Payments
  const handleCreateReceipt = async (
    receiptData: Omit<CustomerReceipt, 'id' | 'receiptNumber' | 'createdAt'>
  ): Promise<CustomerReceipt> => {
    const res = await StorageService.createCustomerReceiptAsync(receiptData, activeCompId);
    if (res.success && res.data) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          'RECEIPT_CREATED',
          'customer_receipts',
          `Created receipt ${res.data.receiptNumber} (${settings.currencySymbol} ${res.data.amount})`,
          res.data.id
        );
      }
      return res.data;
    } else {
      throw new Error(res.error || 'Failed to record customer receipt.');
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    const res = await StorageService.deleteCustomerReceiptAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('RECEIPT_DELETED', 'customer_receipts', `Voided receipt ${id}`, id);
      }
      addToast('info', res.message || 'Receipt voided and customer balance adjusted.');
    } else {
      addToast('error', res.error || 'Failed to void receipt.');
    }
  };

  const handleCreatePayment = async (
    paymentData: Omit<SupplierPayment, 'id' | 'paymentNumber' | 'createdAt'>
  ): Promise<SupplierPayment> => {
    const res = await StorageService.createSupplierPaymentAsync(paymentData, activeCompId);
    if (res.success && res.data) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          'PAYMENT_CREATED',
          'supplier_payments',
          `Created payment ${res.data.paymentNumber} (${settings.currencySymbol} ${res.data.amount})`,
          res.data.id
        );
      }
      return res.data;
    } else {
      throw new Error(res.error || 'Failed to record supplier payment.');
    }
  };

  const handleDeletePayment = async (id: string) => {
    const res = await StorageService.deleteSupplierPaymentAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('PAYMENT_DELETED', 'supplier_payments', `Voided payment ${id}`, id);
      }
      addToast('info', res.message || 'Payment voided and supplier balance adjusted.');
    } else {
      addToast('error', res.error || 'Failed to void payment.');
    }
  };

  const handleCreateExpense = async (
    expenseData: Omit<Expense, 'id' | 'expenseNumber' | 'createdAt'>
  ): Promise<Expense> => {
    const res = await StorageService.createExpenseAsync(expenseData, activeCompId);
    if (res.success && res.data) {
      refreshAllStates(activeCompId);
      if (session) {
        AuthService.recordAuditLog(
          'EXPENSE_CREATED',
          'expenses',
          `Recorded expense ${res.data.expenseNumber} (${res.data.category}: ${settings.currencySymbol} ${res.data.amount})`,
          res.data.id
        );
      }
      return res.data;
    } else {
      throw new Error(res.error || 'Failed to record expense.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await StorageService.deleteExpenseAsync(id);
    refreshAllStates(activeCompId);
    if (res.success) {
      if (session) {
        AuthService.recordAuditLog('EXPENSE_DELETED', 'expenses', `Removed expense record ${id}`, id);
      }
      addToast('info', res.message || 'Expense entry removed.');
    } else {
      addToast('error', res.error || 'Failed to delete expense.');
    }
  };

  // Settings & Reset
  const handleSaveSettings = (newSettings: AppSettings) => {
    StorageService.saveSettings(newSettings);
    refreshAllStates();
    if (session) {
      AuthService.recordAuditLog('SETTINGS_UPDATED', 'settings', 'Updated company profile and application settings');
    }
    if (newSettings.supabaseUrl && newSettings.supabaseAnonKey) {
      performCloudPull(session?.company?.id, true);
    }
  };

  const handleResetToSample = () => {
    StorageService.resetDataToSample();
    refreshAllStates();
    if (session) {
      AuthService.recordAuditLog('SETTINGS_UPDATED', 'settings', 'Reset application database to Sri Lankan sample dataset');
    }
  };

  const handleClearAll = () => {
    StorageService.clearAllData();
    refreshAllStates();
    if (session) {
      AuthService.recordAuditLog('SETTINGS_UPDATED', 'settings', 'Cleared all operational data records');
    }
  };

  // IF NOT LOGGED IN, RENDER BUSY-STYLE LOGIN SCREEN
  if (!session) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} showToast={addToast} />
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </>
    );
  }

  const activeCompany = companies.find((c) => c.id === session?.activeCompanyId) || companies[0];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-yellow-300">
      {/* Header Bar */}
      <Header
        settings={settings}
        cashBalance={dashboardSummary.cashBalance}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        session={session}
        onLogout={handleLogout}
        onSwitchCompany={handleSwitchCompany}
        onRefreshSession={refreshSession}
        showToast={addToast}
        isSyncingCloud={isSyncingCloud}
        onManualSync={() => performCloudPull(undefined, true)}
        hasSupabaseConfigured={Boolean(getActiveSupabaseCredentials().url && getActiveSupabaseCredentials().key)}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Navigation Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          lowStockCount={dashboardSummary.lowStockCount}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          session={session}
        />

        {/* Dynamic Page View Container */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentPage === 'dashboard' && (
            <Dashboard
              summary={dashboardSummary}
              recentTransactions={recentTransactions}
              settings={settings}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'customers' && (
            <Customers
              customers={customers}
              settings={settings}
              sales={sales}
              receipts={receipts}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              session={session}
            />
          )}

          {currentPage === 'suppliers' && (
            <Suppliers
              suppliers={suppliers}
              settings={settings}
              purchases={purchases}
              payments={payments}
              onSaveSupplier={handleSaveSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              session={session}
            />
          )}

          {currentPage === 'products' && (
            <Products
              products={products}
              purchases={purchases}
              sales={sales}
              settings={settings}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onRecalculateStock={() => {
                const res = StorageService.recalculateProductStock(activeCompId);
                refreshAllStates(activeCompId);
                addToast('success', `Stock synchronized for ${res.updatedCount} products from all purchase & sale records.`);
              }}
              validateProduct={(code, name, excludeId) =>
                StorageService.validateProduct(code, name, excludeId)
              }
              showToast={addToast}
              session={session}
            />
          )}

          {currentPage === 'sales' && (
            <Sales
              sales={sales}
              customers={customers}
              products={products}
              settings={settings}
              activeCompany={activeCompany}
              onCreateInvoice={handleCreateSaleInvoice}
              onUpdateInvoice={handleUpdateSaleInvoice}
              onDeleteInvoice={handleDeleteSaleInvoice}
              onPrintInvoice={(inv) => setPrintingDoc({ doc: inv, isPurchase: false })}
              showToast={addToast}
              session={session}
            />
          )}

          {currentPage === 'purchases' && (
            <Purchases
              purchases={purchases}
              suppliers={suppliers}
              products={products}
              settings={settings}
              activeCompany={activeCompany}
              onCreatePurchase={handleCreatePurchaseInvoice}
              onUpdatePurchase={handleUpdatePurchaseInvoice}
              onDeletePurchase={handleDeletePurchaseInvoice}
              onPrintPurchase={(pur) => setPrintingDoc({ doc: pur, isPurchase: true })}
              showToast={addToast}
              session={session}
            />
          )}

          {currentPage === 'payments' && (
            <Payments
              receipts={receipts}
              payments={payments}
              expenses={expenses}
              customers={customers}
              suppliers={suppliers}
              sales={sales}
              purchases={purchases}
              settings={settings}
              onCreateReceipt={handleCreateReceipt}
              onDeleteReceipt={handleDeleteReceipt}
              onCreatePayment={handleCreatePayment}
              onDeletePayment={handleDeletePayment}
              onCreateExpense={handleCreateExpense}
              onDeleteExpense={handleDeleteExpense}
              showToast={addToast}
              session={session}
            />
          )}

          {currentPage === 'reports' && (
            <Reports
              sales={sales}
              purchases={purchases}
              products={products}
              customers={customers}
              suppliers={suppliers}
              receipts={receipts}
              payments={payments}
              expenses={expenses}
              settings={settings}
              session={session}
            />
          )}

          {currentPage === 'pdc' && (
            <PdcManagement
              pdcs={pdcs}
              customers={customers}
              suppliers={suppliers}
              settings={settings}
              company={session?.company}
              onRefresh={() => refreshAllStates(activeCompId)}
              onSuccess={(msg) => addToast('success', msg)}
              onError={(msg) => addToast('error', msg)}
            />
          )}

          {currentPage === 'trial_balance' && (
            <TrialBalanceView
              settings={settings}
              company={session?.company}
            />
          )}

          {currentPage === 'profit_loss' && (
            <ProfitLossView
              settings={settings}
              company={session?.company}
            />
          )}

          {currentPage === 'mis_reports' && (
            <MisReports
              sales={sales}
              purchases={purchases}
              customers={customers}
              suppliers={suppliers}
              products={products}
              expenses={expenses}
              pdcs={pdcs}
              settings={settings}
              company={session?.company}
            />
          )}

          {currentPage === 'settings' && (
            <Settings
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onResetToSample={handleResetToSample}
              onClearAll={handleClearAll}
              showToast={addToast}
              session={session}
              onNavigateToUsers={() => handleNavigate('users')}
              onNavigateToDataImport={() => handleNavigate('data_import')}
            />
          )}

          {currentPage === 'companies' && session?.company && (
            <CompanyManagement
              companies={companies}
              activeCompany={session.company}
              session={session}
              onSaveCompany={handleSaveCompany}
              onToggleCompanyStatus={handleToggleCompanyStatus}
              onSwitchCompany={handleSwitchCompany}
              showToast={addToast}
            />
          )}

          {currentPage === 'data_import' && (
            <DataImport
              session={session}
              showToast={addToast}
              onNavigateToReports={() => handleNavigate('reports')}
              onDataImported={(targetCompId) => refreshAllStates(targetCompId)}
            />
          )}

          {currentPage === 'users' && (
            <UserManagement
              currentUserId={session.user.id}
              showToast={addToast}
              onRefreshPermissions={refreshSession}
            />
          )}
        </main>
      </div>

      {/* Mobile Quick Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1.5 flex justify-around items-center shadow-lg">
        <button
          onClick={() => handleNavigate('dashboard')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
            currentPage === 'dashboard'
              ? 'text-[#2563EB]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => handleNavigate('sales')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
            currentPage === 'sales'
              ? 'text-[#2563EB]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className="w-5 h-5 mb-0.5" />
          <span>Sales</span>
        </button>

        <button
          onClick={() => handleNavigate('products')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-colors relative ${
            currentPage === 'products'
              ? 'text-[#2563EB]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-5 h-5 mb-0.5" />
          {dashboardSummary.lowStockCount > 0 && (
            <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />
          )}
          <span>Items</span>
        </button>

        <button
          onClick={() => handleNavigate('customers')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
            currentPage === 'customers'
              ? 'text-[#2563EB]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>Clients</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center py-1 px-3 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
            isMobileMenuOpen ? 'text-[#2563EB]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Printable Invoice Modal */}
      {printingDoc && (
        <PrintInvoiceModal
          invoice={printingDoc.doc}
          isPurchase={printingDoc.isPurchase}
          settings={settings}
          company={session?.company}
          onClose={() => setPrintingDoc(null)}
        />
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Global Keyboard Shortcut Overlays */}
      <GlobalShortcutModals
        customers={customers}
        suppliers={suppliers}
        products={products}
        settings={settings}
        activeCompany={session?.company}
        onRefresh={() => refreshAllStates(activeCompId)}
        addToast={addToast}
      />

      {/* Footer Quick Status Bar */}
      <footer className="hidden lg:flex h-10 bg-white border-t border-slate-200 px-4 lg:px-8 items-center justify-between text-xs font-semibold text-slate-500 shrink-0">
        <div className="flex items-center gap-3">
          <span>Logged in as:</span>
          <span className="text-slate-900 font-bold font-mono bg-slate-100 px-2 py-0.5 rounded-md">
            {session.user.username} ({session.user.role})
          </span>
          <span className="text-emerald-600 font-bold flex items-center gap-1 ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Security Active
          </span>
        </div>
        <div className="text-slate-400">
          Busy UFO • Sri Lanka Small Inventory & Accounting System
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ShortcutProvider>
      <AppMain />
    </ShortcutProvider>
  );
}
