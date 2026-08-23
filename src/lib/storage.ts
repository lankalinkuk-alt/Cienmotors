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
  DashboardSummary,
  TransactionRecord,
  Company,
  LedgerAccount,
  OpeningJournalVoucher,
  Warehouse,
  ImportHistoryRecord,
  AppUser
} from '../types';
import {
  INITIAL_SETTINGS,
  INITIAL_COMPANIES,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_RECEIPTS,
  INITIAL_PAYMENTS,
  INITIAL_EXPENSES
} from './sampleData';
import { SupabaseSyncService, getActiveSupabaseCredentials, generateUniqueRequestId } from './supabase';

const STORAGE_KEYS = {
  SETTINGS: 'busy_ufo_settings'
};

const DEFAULT_COMPANY_ID = 'comp-1';

// Clean up any legacy localStorage ERP business keys if present
if (typeof localStorage !== 'undefined') {
  try {
    const legacyKeys = [
      'busy_ufo_companies',
      'busy_ufo_customers',
      'busy_ufo_suppliers',
      'busy_ufo_products',
      'busy_ufo_sales',
      'busy_ufo_purchases',
      'busy_ufo_receipts',
      'busy_ufo_payments',
      'busy_ufo_expenses',
      'busy_ufo_ledgers',
      'busy_ufo_opening_journals',
      'busy_ufo_warehouses',
      'busy_ufo_import_history',
      'busy_ufo_deleted_ids',
      'busy_ufo_pending_sync'
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    // Ignore storage access errors
  }
}

// IN-MEMORY STORAGE STATE FOR ERP BUSINESS DATA (Zero Local Persistence)
let _inMemoryCompanies: Company[] = [...INITIAL_COMPANIES];
let _inMemoryProducts: Product[] = [];
let _inMemoryCustomers: Customer[] = [];
let _inMemorySuppliers: Supplier[] = [];
let _inMemorySales: SaleInvoice[] = [];
let _inMemoryPurchases: PurchaseInvoice[] = [];
let _inMemoryReceipts: CustomerReceipt[] = [];
let _inMemoryPayments: SupplierPayment[] = [];
let _inMemoryExpenses: Expense[] = [];
let _inMemoryLedgers: LedgerAccount[] = [];
let _inMemoryWarehouses: Warehouse[] = [];
let _inMemoryOpeningJournals: OpeningJournalVoucher[] = [];
let _inMemoryImportHistory: ImportHistoryRecord[] = [];
let _inMemoryUsers: AppUser[] = [];

function getSettingsFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return INITIAL_SETTINGS;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading settings:', e);
    return INITIAL_SETTINGS;
  }
}

function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ufo_settings_change', { detail: settings }));
    }
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

function checkOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true;
}

export const StorageService = {
  // --- SETTINGS (Allowed in localStorage as local client preference) ---
  getSettings(): AppSettings {
    return getSettingsFromStorage();
  },

  saveSettings(settings: AppSettings): void {
    saveSettingsToStorage(settings);
  },

  // --- COMPANIES ---
  getCompanies(): Company[] {
    return _inMemoryCompanies;
  },

  getCompanyById(companyId: string): Company | null {
    return _inMemoryCompanies.find((c) => c.id === companyId) || null;
  },

  async saveCompanyAsync(
    compData: Partial<Company>
  ): Promise<{
    success: boolean;
    data?: Company;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The company was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured. Please configure database credentials.'
      };
    }

    const now = new Date().toISOString();
    let companyToSave: Company;

    if (compData.id) {
      const existing = _inMemoryCompanies.find((c) => c.id === compData.id);
      companyToSave = {
        ...(existing || {}),
        ...compData,
        id: compData.id,
        updatedAt: now
      } as Company;
    } else {
      companyToSave = {
        id: `comp-${Date.now()}`,
        companyName: compData.companyName?.trim() || 'New Company',
        shortName: compData.shortName?.trim().toUpperCase() || 'NEW',
        address: compData.address?.trim() || '',
        city: compData.city?.trim() || 'Colombo',
        district: compData.district?.trim() || 'Colombo',
        country: compData.country?.trim() || 'Sri Lanka',
        telephone: compData.telephone?.trim() || '',
        mobile: compData.mobile?.trim() || '',
        companyEmail: compData.companyEmail?.trim() || '',
        taxRegistrationNo: compData.taxRegistrationNo?.trim() || '',
        currency: compData.currency?.trim() || 'Rs.',
        financialYearStart: compData.financialYearStart || `${new Date().getFullYear()}-01-01`,
        financialYearEnd: compData.financialYearEnd || `${new Date().getFullYear()}-12-31`,
        invoicePrefix: compData.invoicePrefix?.trim() || 'INV',
        invoiceNumber: compData.invoiceNumber || 1001,
        logoUrl: compData.logoUrl,
        isActive: compData.isActive !== undefined ? compData.isActive : true,
        isVatEnabled: Boolean(compData.isVatEnabled),
        vatNumber: compData.vatNumber || '',
        defaultVatRate: Number(compData.defaultVatRate || 0),
        vatType: compData.vatType || 'EXCLUSIVE',
        isItemDiscountEnabled: compData.isItemDiscountEnabled !== undefined ? compData.isItemDiscountEnabled : true,
        defaultDiscountType: compData.defaultDiscountType || 'PERCENT',
        createdAt: now,
        updatedAt: now
      };
    }

    const syncRes = await SupabaseSyncService.syncCompany(companyToSave);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to save company to Supabase database.'
      };
    }

    const idx = _inMemoryCompanies.findIndex((c) => c.id === companyToSave.id);
    if (idx !== -1) {
      _inMemoryCompanies[idx] = companyToSave;
    } else {
      _inMemoryCompanies.push(companyToSave);
    }

    return {
      success: true,
      data: companyToSave,
      message: `Company "${companyToSave.companyName}" saved successfully.`
    };
  },

  disableCompany(companyId: string, disable: boolean): void {
    const idx = _inMemoryCompanies.findIndex((c) => c.id === companyId);
    if (idx !== -1) {
      _inMemoryCompanies[idx] = {
        ..._inMemoryCompanies[idx],
        isActive: !disable,
        updatedAt: new Date().toISOString()
      };
      if (checkOnline()) {
        SupabaseSyncService.syncCompany(_inMemoryCompanies[idx]).catch(() => {});
      }
    }
  },

  // --- CUSTOMERS ---
  getCustomers(companyId?: string): Customer[] {
    if (!companyId) return _inMemoryCustomers;
    return _inMemoryCustomers.filter((c) => (c.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  saveCustomer(customerData: Partial<Customer>, companyId?: string): Customer {
    const targetCompId = customerData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    let customerToSave: Customer;

    if (customerData.id) {
      const existing = _inMemoryCustomers.find((c) => c.id === customerData.id);
      customerToSave = {
        ...(existing || {
          code: `CUST-${String(_inMemoryCustomers.length + 1).padStart(3, '0')}`,
          name: '',
          phone: '',
          outstandingBalance: 0,
          openingBalance: 0,
          createdAt: now
        }),
        ...customerData,
        id: customerData.id,
        companyId: targetCompId,
        updatedAt: now
      } as Customer;
    } else {
      customerToSave = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        companyId: targetCompId,
        code: customerData.code || `CUST-${String(_inMemoryCustomers.length + 1).padStart(3, '0')}`,
        name: customerData.name?.trim() || '',
        phone: customerData.phone?.trim() || '',
        email: customerData.email?.trim() || '',
        address: customerData.address?.trim() || '',
        city: customerData.city?.trim() || 'Colombo',
        accountGroup: customerData.accountGroup || 'Sundry Debtors',
        openingBalance: Number(customerData.openingBalance || 0),
        outstandingBalance: Number(customerData.openingBalance || 0),
        createdAt: now,
        updatedAt: now
      };
    }

    const idx = _inMemoryCustomers.findIndex((c) => c.id === customerToSave.id);
    if (idx !== -1) {
      _inMemoryCustomers[idx] = customerToSave;
    } else {
      _inMemoryCustomers.push(customerToSave);
    }

    if (checkOnline()) {
      SupabaseSyncService.syncCustomer(customerToSave).catch(() => {});
    }

    return customerToSave;
  },

  async saveCustomerAsync(
    customerData: Partial<Customer>,
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: Customer;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The customer was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured. Please configure database credentials in Settings.'
      };
    }

    const targetCompId = customerData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    let customerToSave: Customer;

    if (customerData.id) {
      const existing = _inMemoryCustomers.find((c) => c.id === customerData.id);
      customerToSave = {
        ...(existing || {
          code: `CUST-${String(_inMemoryCustomers.length + 1).padStart(3, '0')}`,
          name: '',
          phone: '',
          outstandingBalance: 0,
          openingBalance: 0,
          createdAt: now
        }),
        ...customerData,
        id: customerData.id,
        companyId: targetCompId,
        updatedAt: now
      } as Customer;
    } else {
      customerToSave = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        companyId: targetCompId,
        code: customerData.code || `CUST-${String(_inMemoryCustomers.length + 1).padStart(3, '0')}`,
        name: customerData.name?.trim() || '',
        phone: customerData.phone?.trim() || '',
        email: customerData.email?.trim() || '',
        address: customerData.address?.trim() || '',
        city: customerData.city?.trim() || 'Colombo',
        accountGroup: customerData.accountGroup || 'Sundry Debtors',
        openingBalance: Number(customerData.openingBalance || 0),
        outstandingBalance: Number(customerData.openingBalance || 0),
        createdAt: now,
        updatedAt: now
      };
    }

    const syncRes = await SupabaseSyncService.syncCustomer(customerToSave);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to save customer to Supabase database.'
      };
    }

    const idx = _inMemoryCustomers.findIndex((c) => c.id === customerToSave.id);
    if (idx !== -1) {
      _inMemoryCustomers[idx] = customerToSave;
    } else {
      _inMemoryCustomers.push(customerToSave);
    }

    return {
      success: true,
      data: customerToSave,
      message: `Customer profile for "${customerToSave.name}" saved successfully.`
    };
  },

  async deleteCustomerAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The customer was not deleted.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deleteCustomer(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete customer from Supabase database.'
      };
    }

    _inMemoryCustomers = _inMemoryCustomers.filter((c) => c.id !== id);
    return { success: true, message: 'Customer profile deleted from database.' };
  },

  // --- SUPPLIERS ---
  getSuppliers(companyId?: string): Supplier[] {
    if (!companyId) return _inMemorySuppliers;
    return _inMemorySuppliers.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  saveSupplier(supplierData: Partial<Supplier>, companyId?: string): Supplier {
    const targetCompId = supplierData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    let supplierToSave: Supplier;

    if (supplierData.id) {
      const existing = _inMemorySuppliers.find((s) => s.id === supplierData.id);
      supplierToSave = {
        ...(existing || {
          code: `SUP-${String(_inMemorySuppliers.length + 1).padStart(3, '0')}`,
          name: '',
          phone: '',
          payableBalance: 0,
          openingBalance: 0,
          createdAt: now
        }),
        ...supplierData,
        id: supplierData.id,
        companyId: targetCompId,
        updatedAt: now
      } as Supplier;
    } else {
      supplierToSave = {
        id: `supp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        companyId: targetCompId,
        code: supplierData.code || `SUP-${String(_inMemorySuppliers.length + 1).padStart(3, '0')}`,
        name: supplierData.name?.trim() || '',
        companyName: supplierData.companyName?.trim() || '',
        phone: supplierData.phone?.trim() || '',
        email: supplierData.email?.trim() || '',
        address: supplierData.address?.trim() || '',
        city: supplierData.city?.trim() || 'Colombo',
        accountGroup: supplierData.accountGroup || 'Sundry Creditors',
        openingBalance: Number(supplierData.openingBalance || 0),
        payableBalance: Number(supplierData.openingBalance || 0),
        createdAt: now,
        updatedAt: now
      };
    }

    const idx = _inMemorySuppliers.findIndex((s) => s.id === supplierToSave.id);
    if (idx !== -1) {
      _inMemorySuppliers[idx] = supplierToSave;
    } else {
      _inMemorySuppliers.push(supplierToSave);
    }

    if (checkOnline()) {
      SupabaseSyncService.syncSupplier(supplierToSave).catch(() => {});
    }

    return supplierToSave;
  },

  async saveSupplierAsync(
    supplierData: Partial<Supplier>,
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: Supplier;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The supplier was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured. Please configure database credentials in Settings.'
      };
    }

    const targetCompId = supplierData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    let supplierToSave: Supplier;

    if (supplierData.id) {
      const existing = _inMemorySuppliers.find((s) => s.id === supplierData.id);
      supplierToSave = {
        ...(existing || {
          code: `SUP-${String(_inMemorySuppliers.length + 1).padStart(3, '0')}`,
          name: '',
          phone: '',
          payableBalance: 0,
          openingBalance: 0,
          createdAt: now
        }),
        ...supplierData,
        id: supplierData.id,
        companyId: targetCompId,
        updatedAt: now
      } as Supplier;
    } else {
      supplierToSave = {
        id: `supp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        companyId: targetCompId,
        code: supplierData.code || `SUP-${String(_inMemorySuppliers.length + 1).padStart(3, '0')}`,
        name: supplierData.name?.trim() || '',
        companyName: supplierData.companyName?.trim() || '',
        phone: supplierData.phone?.trim() || '',
        email: supplierData.email?.trim() || '',
        address: supplierData.address?.trim() || '',
        city: supplierData.city?.trim() || 'Colombo',
        accountGroup: supplierData.accountGroup || 'Sundry Creditors',
        openingBalance: Number(supplierData.openingBalance || 0),
        payableBalance: Number(supplierData.openingBalance || 0),
        createdAt: now,
        updatedAt: now
      };
    }

    const syncRes = await SupabaseSyncService.syncSupplier(supplierToSave);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to save supplier to Supabase database.'
      };
    }

    const idx = _inMemorySuppliers.findIndex((s) => s.id === supplierToSave.id);
    if (idx !== -1) {
      _inMemorySuppliers[idx] = supplierToSave;
    } else {
      _inMemorySuppliers.push(supplierToSave);
    }

    return {
      success: true,
      data: supplierToSave,
      message: `Supplier profile for "${supplierToSave.name}" saved successfully.`
    };
  },

  async deleteSupplierAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The supplier was not deleted.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deleteSupplier(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete supplier from Supabase database.'
      };
    }

    _inMemorySuppliers = _inMemorySuppliers.filter((s) => s.id !== id);
    return { success: true, message: 'Supplier profile deleted from database.' };
  },

  // --- PRODUCTS ---
  getProducts(companyId?: string): Product[] {
    if (!companyId) return _inMemoryProducts;
    return _inMemoryProducts.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  validateProduct(code: string, name: string, excludeId?: string, companyId?: string): string | null {
    const products = this.getProducts(companyId);
    const cleanCode = code.trim().toLowerCase();
    const cleanName = name.trim().toLowerCase();

    if (!cleanCode) return 'Product Code is required.';
    if (!cleanName) return 'Product Name is required.';

    const duplicateCode = products.find(
      (p) => p.id !== excludeId && p.code.toLowerCase() === cleanCode
    );
    if (duplicateCode) {
      return `Product Code "${code}" is already in use by "${duplicateCode.name}".`;
    }

    const duplicateName = products.find(
      (p) => p.id !== excludeId && p.name.toLowerCase() === cleanName
    );
    if (duplicateName) {
      return `Product with name "${name}" already exists (${duplicateName.code}).`;
    }

    return null;
  },

  saveProduct(prodData: Partial<Product>, companyId?: string): Product {
    const targetCompId = prodData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    let prodToSave: Product;

    if (prodData.id) {
      const existing = _inMemoryProducts.find((p) => p.id === prodData.id);
      prodToSave = {
        ...(existing || {
          code: `PROD-${String(_inMemoryProducts.length + 1).padStart(3, '0')}`,
          name: '',
          category: 'General',
          unit: 'Nos',
          costPrice: 0,
          sellingPrice: 0,
          currentStock: 0,
          reorderLevel: 10,
          openingStock: 0,
          openingRate: 0,
          openingValue: 0,
          createdAt: now
        }),
        ...prodData,
        id: prodData.id,
        companyId: targetCompId,
        updatedAt: now
      } as Product;
    } else {
      const opStock = Number(prodData.openingStock || 0);
      const opRate = Number(prodData.openingRate || prodData.costPrice || 0);
      prodToSave = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        companyId: targetCompId,
        code: prodData.code?.trim().toUpperCase() || `PROD-${String(_inMemoryProducts.length + 1).padStart(3, '0')}`,
        name: prodData.name?.trim() || '',
        category: prodData.category?.trim() || 'General',
        unit: prodData.unit || 'Nos',
        primaryUnit: prodData.unit || 'Nos',
        secondaryUnit: prodData.secondaryUnit,
        conversionFactor: prodData.conversionFactor,
        costPrice: Number(prodData.costPrice || 0),
        sellingPrice: Number(prodData.sellingPrice || 0),
        currentStock: Number(prodData.currentStock ?? opStock),
        reorderLevel: Number(prodData.reorderLevel || 10),
        openingStock: opStock,
        openingRate: opRate,
        openingValue: opStock * opRate,
        createdAt: now,
        updatedAt: now
      };
    }

    const idx = _inMemoryProducts.findIndex((p) => p.id === prodToSave.id);
    if (idx !== -1) {
      _inMemoryProducts[idx] = prodToSave;
    } else {
      _inMemoryProducts.push(prodToSave);
    }

    if (checkOnline()) {
      SupabaseSyncService.syncProduct(prodToSave).catch(() => {});
    }

    return prodToSave;
  },

  async saveProductAsync(
    prodData: Partial<Product>,
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: Product;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The product was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured. Please configure database credentials in Settings.'
      };
    }

    const targetCompId = prodData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    let prodToSave: Product;

    if (prodData.id) {
      const existing = _inMemoryProducts.find((p) => p.id === prodData.id);
      prodToSave = {
        ...(existing || {
          code: `PROD-${String(_inMemoryProducts.length + 1).padStart(3, '0')}`,
          name: '',
          category: 'General',
          unit: 'Nos',
          costPrice: 0,
          sellingPrice: 0,
          currentStock: 0,
          reorderLevel: 10,
          openingStock: 0,
          openingRate: 0,
          openingValue: 0,
          createdAt: now
        }),
        ...prodData,
        id: prodData.id,
        companyId: targetCompId,
        updatedAt: now
      } as Product;
    } else {
      const opStock = Number(prodData.openingStock || 0);
      const opRate = Number(prodData.openingRate || prodData.costPrice || 0);
      prodToSave = {
        id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        companyId: targetCompId,
        code: prodData.code?.trim().toUpperCase() || `PROD-${String(_inMemoryProducts.length + 1).padStart(3, '0')}`,
        name: prodData.name?.trim() || '',
        category: prodData.category?.trim() || 'General',
        unit: prodData.unit || 'Nos',
        primaryUnit: prodData.unit || 'Nos',
        secondaryUnit: prodData.secondaryUnit,
        conversionFactor: prodData.conversionFactor,
        costPrice: Number(prodData.costPrice || 0),
        sellingPrice: Number(prodData.sellingPrice || 0),
        currentStock: Number(prodData.currentStock ?? opStock),
        reorderLevel: Number(prodData.reorderLevel || 10),
        openingStock: opStock,
        openingRate: opRate,
        openingValue: opStock * opRate,
        createdAt: now,
        updatedAt: now
      };
    }

    const syncRes = await SupabaseSyncService.syncProduct(prodToSave);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to save product to Supabase database.'
      };
    }

    const idx = _inMemoryProducts.findIndex((p) => p.id === prodToSave.id);
    if (idx !== -1) {
      _inMemoryProducts[idx] = prodToSave;
    } else {
      _inMemoryProducts.push(prodToSave);
    }

    return {
      success: true,
      data: prodToSave,
      message: `Product "${prodToSave.name}" (${prodToSave.code}) saved successfully.`
    };
  },

  async deleteProductAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The product was not deleted.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deleteProduct(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete product from Supabase database.'
      };
    }

    _inMemoryProducts = _inMemoryProducts.filter((p) => p.id !== id);
    return { success: true, message: 'Product deleted from database.' };
  },

  recalculateProductStock(companyId?: string): { updatedCount: number } {
    const prods = this.getProducts(companyId);
    const purchases = this.getPurchases(companyId);
    const sales = this.getSales(companyId);

    let updatedCount = 0;
    for (const prod of prods) {
      let calcStock = Number(prod.openingStock || 0);

      // Add purchases
      purchases.forEach((pur) => {
        pur.items.forEach((item) => {
          if (item.productId === prod.id) {
            calcStock += Number(item.quantity || 0);
          }
        });
      });

      // Deduct sales
      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          if (item.productId === prod.id) {
            calcStock -= Number(item.quantity || 0);
          }
        });
      });

      calcStock = Math.max(0, calcStock);
      if (prod.currentStock !== calcStock) {
        prod.currentStock = calcStock;
        prod.updatedAt = new Date().toISOString();
        updatedCount++;
        if (checkOnline()) {
          SupabaseSyncService.syncProduct(prod).catch(() => {});
        }
      }
    }

    return { updatedCount };
  },

  // --- SALES INVOICES ---
  getSales(companyId?: string): SaleInvoice[] {
    if (!companyId) return _inMemorySales;
    return _inMemorySales.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  async createSaleInvoiceAsync(
    invoiceData: Omit<SaleInvoice, 'id' | 'invoiceNumber' | 'createdAt'> & { id?: string },
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: SaleInvoice;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The invoice was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured. Please configure database credentials in Settings.'
      };
    }

    const targetCompId = invoiceData.companyId || companyId || DEFAULT_COMPANY_ID;
    const compSales = _inMemorySales.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compSales.length + 1;
    const invNumber = `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const requestId = invoiceData.requestId || generateUniqueRequestId('sale');

    const newSale: SaleInvoice = {
      ...invoiceData,
      requestId,
      companyId: targetCompId,
      id: invoiceData.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      invoiceNumber: invNumber,
      createdAt: now,
      updatedAt: now
    };

    const syncRes = await SupabaseSyncService.syncSaleInvoice(newSale);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to save sale invoice to Supabase database.'
      };
    }

    // On Supabase success, update in-memory products (deduct stock) and customer outstanding
    for (const item of newSale.items) {
      const pIdx = _inMemoryProducts.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) {
        _inMemoryProducts[pIdx] = {
          ..._inMemoryProducts[pIdx],
          currentStock: Math.max(0, Number(_inMemoryProducts[pIdx].currentStock || 0) - Number(item.quantity || 0)),
          updatedAt: now
        };
      }
    }

    if (newSale.customerId && newSale.dueAmount > 0) {
      const cIdx = _inMemoryCustomers.findIndex(
        (c) => c.id === newSale.customerId && (c.companyId || DEFAULT_COMPANY_ID) === targetCompId
      );
      if (cIdx !== -1) {
        _inMemoryCustomers[cIdx] = {
          ..._inMemoryCustomers[cIdx],
          outstandingBalance: Number(_inMemoryCustomers[cIdx].outstandingBalance || 0) + Number(newSale.dueAmount),
          updatedAt: now
        };
      }
    }

    _inMemorySales.unshift(newSale);

    return {
      success: true,
      data: newSale,
      message: `Invoice ${newSale.invoiceNumber} recorded and verified in database.`
    };
  },

  async updateSaleInvoiceAsync(
    id: string,
    invoiceData: Partial<SaleInvoice>,
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: SaleInvoice;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The invoice was not updated.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const targetIndex = _inMemorySales.findIndex((s) => s.id === id);
    if (targetIndex === -1) {
      return { success: false, error: 'Sale invoice not found in memory.' };
    }

    const oldSale = _inMemorySales[targetIndex];
    const targetCompId = oldSale.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    const updatedSale: SaleInvoice = {
      ...oldSale,
      ...invoiceData,
      id: oldSale.id,
      invoiceNumber: oldSale.invoiceNumber,
      companyId: targetCompId,
      updatedAt: now
    };

    const syncRes = await SupabaseSyncService.syncSaleInvoice(updatedSale);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to update invoice in Supabase database.'
      };
    }

    // Revert old stock deductions and apply new stock deductions in memory
    for (const oldItem of oldSale.items) {
      const pIdx = _inMemoryProducts.findIndex((p) => p.id === oldItem.productId);
      if (pIdx !== -1) {
        _inMemoryProducts[pIdx].currentStock = Number(_inMemoryProducts[pIdx].currentStock || 0) + Number(oldItem.quantity || 0);
      }
    }
    const newItems = updatedSale.items || oldSale.items;
    for (const newItem of newItems) {
      const pIdx = _inMemoryProducts.findIndex((p) => p.id === newItem.productId);
      if (pIdx !== -1) {
        _inMemoryProducts[pIdx].currentStock = Math.max(0, Number(_inMemoryProducts[pIdx].currentStock || 0) - Number(newItem.quantity || 0));
      }
    }

    // Revert old customer outstanding and apply new
    if (oldSale.customerId && oldSale.dueAmount > 0) {
      const cIdx = _inMemoryCustomers.findIndex((c) => c.id === oldSale.customerId);
      if (cIdx !== -1) {
        _inMemoryCustomers[cIdx].outstandingBalance = Math.max(0, Number(_inMemoryCustomers[cIdx].outstandingBalance || 0) - Number(oldSale.dueAmount));
      }
    }
    const newCustomerId = updatedSale.customerId;
    const newDueAmount = updatedSale.dueAmount;
    if (newCustomerId && Number(newDueAmount) > 0) {
      const cIdx = _inMemoryCustomers.findIndex((c) => c.id === newCustomerId);
      if (cIdx !== -1) {
        _inMemoryCustomers[cIdx].outstandingBalance = Number(_inMemoryCustomers[cIdx].outstandingBalance || 0) + Number(newDueAmount);
      }
    }

    _inMemorySales[targetIndex] = updatedSale;

    return {
      success: true,
      data: updatedSale,
      message: `Invoice ${updatedSale.invoiceNumber} updated in database.`
    };
  },

  async deleteSaleInvoiceAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The invoice was not voided.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deleteSaleInvoice(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to void invoice in Supabase database.'
      };
    }

    const targetIndex = _inMemorySales.findIndex((s) => s.id === id);
    if (targetIndex !== -1) {
      const target = _inMemorySales[targetIndex];
      for (const item of target.items) {
        const pIdx = _inMemoryProducts.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) {
          _inMemoryProducts[pIdx].currentStock = Number(_inMemoryProducts[pIdx].currentStock || 0) + Number(item.quantity || 0);
        }
      }
      if (target.customerId && target.dueAmount > 0) {
        const cIdx = _inMemoryCustomers.findIndex((c) => c.id === target.customerId);
        if (cIdx !== -1) {
          _inMemoryCustomers[cIdx].outstandingBalance = Math.max(0, Number(_inMemoryCustomers[cIdx].outstandingBalance || 0) - Number(target.dueAmount));
        }
      }
      _inMemorySales.splice(targetIndex, 1);
    }

    return { success: true, message: 'Sale invoice voided in database.' };
  },

  // --- PURCHASES INVOICES ---
  getPurchases(companyId?: string): PurchaseInvoice[] {
    if (!companyId) return _inMemoryPurchases;
    return _inMemoryPurchases.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  async createPurchaseInvoiceAsync(
    purchaseData: Omit<PurchaseInvoice, 'id' | 'purchaseNumber' | 'createdAt'> & { id?: string },
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: PurchaseInvoice;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The purchase bill was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured. Please configure database credentials in Settings.'
      };
    }

    const targetCompId = purchaseData.companyId || companyId || DEFAULT_COMPANY_ID;
    const compPurchases = _inMemoryPurchases.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compPurchases.length + 1;
    const purNumber = `PUR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const requestId = purchaseData.requestId || generateUniqueRequestId('pur');

    const newPurchase: PurchaseInvoice = {
      ...purchaseData,
      requestId,
      companyId: targetCompId,
      id: purchaseData.id || `pur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      purchaseNumber: purNumber,
      createdAt: now,
      updatedAt: now
    };

    const syncRes = await SupabaseSyncService.syncPurchaseInvoice(newPurchase);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to record purchase bill in database.'
      };
    }

    // Update in-memory product stock and cost prices
    for (const item of newPurchase.items) {
      let pIndex = _inMemoryProducts.findIndex((p) => p.id === item.productId);
      if (pIndex !== -1) {
        _inMemoryProducts[pIndex] = {
          ..._inMemoryProducts[pIndex],
          currentStock: Number(_inMemoryProducts[pIndex].currentStock || 0) + Number(item.quantity || 0),
          costPrice: Number(item.unitCost) > 0 ? Number(item.unitCost) : _inMemoryProducts[pIndex].costPrice,
          updatedAt: now
        };
      }
    }

    // Update supplier payable
    if (newPurchase.supplierId && newPurchase.dueAmount > 0) {
      const sIndex = _inMemorySuppliers.findIndex((s) => s.id === newPurchase.supplierId);
      if (sIndex !== -1) {
        _inMemorySuppliers[sIndex] = {
          ..._inMemorySuppliers[sIndex],
          payableBalance: Number(_inMemorySuppliers[sIndex].payableBalance || 0) + Number(newPurchase.dueAmount),
          updatedAt: now
        };
      }
    }

    _inMemoryPurchases.unshift(newPurchase);

    return {
      success: true,
      data: newPurchase,
      message: `Purchase bill ${newPurchase.purchaseNumber} recorded and verified in database.`
    };
  },

  async updatePurchaseInvoiceAsync(
    id: string,
    purchaseData: Partial<PurchaseInvoice>,
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: PurchaseInvoice;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The purchase bill was not updated.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const targetIndex = _inMemoryPurchases.findIndex((p) => p.id === id);
    if (targetIndex === -1) {
      return { success: false, error: 'Purchase invoice not found.' };
    }

    const oldPur = _inMemoryPurchases[targetIndex];
    const targetCompId = oldPur.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    const updatedPurchase: PurchaseInvoice = {
      ...oldPur,
      ...purchaseData,
      id: oldPur.id,
      purchaseNumber: oldPur.purchaseNumber,
      companyId: targetCompId,
      updatedAt: now
    };

    const syncRes = await SupabaseSyncService.syncPurchaseInvoice(updatedPurchase);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to update purchase bill in database.'
      };
    }

    // Revert old additions & apply new additions
    for (const oldItem of oldPur.items) {
      const pIdx = _inMemoryProducts.findIndex((p) => p.id === oldItem.productId);
      if (pIdx !== -1) {
        _inMemoryProducts[pIdx].currentStock = Math.max(0, Number(_inMemoryProducts[pIdx].currentStock || 0) - Number(oldItem.quantity || 0));
      }
    }
    const newItems = updatedPurchase.items || oldPur.items;
    for (const newItem of newItems) {
      const pIdx = _inMemoryProducts.findIndex((p) => p.id === newItem.productId);
      if (pIdx !== -1) {
        _inMemoryProducts[pIdx].currentStock = Number(_inMemoryProducts[pIdx].currentStock || 0) + Number(newItem.quantity || 0);
      }
    }

    // Revert supplier payable
    if (oldPur.supplierId && oldPur.dueAmount > 0) {
      const sIdx = _inMemorySuppliers.findIndex((s) => s.id === oldPur.supplierId);
      if (sIdx !== -1) {
        _inMemorySuppliers[sIdx].payableBalance = Math.max(0, Number(_inMemorySuppliers[sIdx].payableBalance || 0) - Number(oldPur.dueAmount));
      }
    }
    if (updatedPurchase.supplierId && updatedPurchase.dueAmount > 0) {
      const sIdx = _inMemorySuppliers.findIndex((s) => s.id === updatedPurchase.supplierId);
      if (sIdx !== -1) {
        _inMemorySuppliers[sIdx].payableBalance = Number(_inMemorySuppliers[sIdx].payableBalance || 0) + Number(updatedPurchase.dueAmount);
      }
    }

    _inMemoryPurchases[targetIndex] = updatedPurchase;

    return {
      success: true,
      data: updatedPurchase,
      message: `Purchase bill ${updatedPurchase.purchaseNumber} updated in database.`
    };
  },

  async deletePurchaseInvoiceAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The purchase bill was not voided.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deletePurchaseInvoice(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to void purchase bill in database.'
      };
    }

    const targetIndex = _inMemoryPurchases.findIndex((p) => p.id === id);
    if (targetIndex !== -1) {
      const target = _inMemoryPurchases[targetIndex];
      for (const item of target.items) {
        const pIdx = _inMemoryProducts.findIndex((p) => p.id === item.productId);
        if (pIdx !== -1) {
          _inMemoryProducts[pIdx].currentStock = Math.max(0, Number(_inMemoryProducts[pIdx].currentStock || 0) - Number(item.quantity || 0));
        }
      }
      if (target.supplierId && target.dueAmount > 0) {
        const sIdx = _inMemorySuppliers.findIndex((s) => s.id === target.supplierId);
        if (sIdx !== -1) {
          _inMemorySuppliers[sIdx].payableBalance = Math.max(0, Number(_inMemorySuppliers[sIdx].payableBalance || 0) - Number(target.dueAmount));
        }
      }
      _inMemoryPurchases.splice(targetIndex, 1);
    }

    return { success: true, message: 'Purchase bill voided and stock reversed in database.' };
  },

  // --- CUSTOMER RECEIPTS ---
  getReceipts(companyId?: string): CustomerReceipt[] {
    if (!companyId) return _inMemoryReceipts;
    return _inMemoryReceipts.filter((r) => (r.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  async createCustomerReceiptAsync(
    receiptData: Omit<CustomerReceipt, 'id' | 'receiptNumber' | 'createdAt'> & { id?: string },
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: CustomerReceipt;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The customer receipt was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const targetCompId = receiptData.companyId || companyId || DEFAULT_COMPANY_ID;
    const compReceipts = _inMemoryReceipts.filter((r) => (r.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compReceipts.length + 1;
    const recNumber = `REC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const requestId = receiptData.requestId || generateUniqueRequestId('rec');

    const newReceipt: CustomerReceipt = {
      ...receiptData,
      requestId,
      companyId: targetCompId,
      id: receiptData.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      receiptNumber: recNumber,
      createdAt: now
    };

    const syncRes = await SupabaseSyncService.syncReceipt(newReceipt);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to record customer receipt in database.'
      };
    }

    // Reduce Customer Outstanding in memory
    const cIndex = _inMemoryCustomers.findIndex(
      (c) => c.id === receiptData.customerId && (c.companyId || DEFAULT_COMPANY_ID) === targetCompId
    );
    if (cIndex !== -1) {
      _inMemoryCustomers[cIndex].outstandingBalance = Math.max(
        0,
        _inMemoryCustomers[cIndex].outstandingBalance - Number(receiptData.amount)
      );
    }

    // Adjust allocated Sales Invoices
    if (receiptData.allocations && receiptData.allocations.length > 0) {
      for (const alloc of receiptData.allocations) {
        if (alloc.allocatedAmount > 0) {
          const sIndex = _inMemorySales.findIndex(
            (s) => s.id === alloc.invoiceId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId
          );
          if (sIndex !== -1) {
            _inMemorySales[sIndex].paidAmount = Number((_inMemorySales[sIndex].paidAmount + alloc.allocatedAmount).toFixed(2));
            _inMemorySales[sIndex].dueAmount = Math.max(0, Number((_inMemorySales[sIndex].grandTotal - _inMemorySales[sIndex].paidAmount).toFixed(2)));
          }
        }
      }
    }

    _inMemoryReceipts.unshift(newReceipt);

    return {
      success: true,
      data: newReceipt,
      message: `Customer receipt ${newReceipt.receiptNumber} recorded in database.`
    };
  },

  async deleteCustomerReceiptAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The receipt was not voided.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deleteReceipt(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to void receipt in database.'
      };
    }

    const targetIndex = _inMemoryReceipts.findIndex((r) => r.id === id);
    if (targetIndex !== -1) {
      const target = _inMemoryReceipts[targetIndex];
      const cIndex = _inMemoryCustomers.findIndex((c) => c.id === target.customerId);
      if (cIndex !== -1) {
        _inMemoryCustomers[cIndex].outstandingBalance += Number(target.amount);
      }
      if (target.allocations && target.allocations.length > 0) {
        for (const alloc of target.allocations) {
          if (alloc.allocatedAmount > 0) {
            const sIndex = _inMemorySales.findIndex((s) => s.id === alloc.invoiceId);
            if (sIndex !== -1) {
              _inMemorySales[sIndex].paidAmount = Math.max(0, Number((_inMemorySales[sIndex].paidAmount - alloc.allocatedAmount).toFixed(2)));
              _inMemorySales[sIndex].dueAmount = Math.max(0, Number((_inMemorySales[sIndex].grandTotal - _inMemorySales[sIndex].paidAmount).toFixed(2)));
            }
          }
        }
      }
      _inMemoryReceipts.splice(targetIndex, 1);
    }

    return { success: true, message: 'Receipt voided and customer balance adjusted in database.' };
  },

  // --- SUPPLIER PAYMENTS ---
  getPayments(companyId?: string): SupplierPayment[] {
    if (!companyId) return _inMemoryPayments;
    return _inMemoryPayments.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  async createSupplierPaymentAsync(
    paymentData: Omit<SupplierPayment, 'id' | 'paymentNumber' | 'createdAt'> & { id?: string },
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: SupplierPayment;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The supplier payment was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const targetCompId = paymentData.companyId || companyId || DEFAULT_COMPANY_ID;
    const compPayments = _inMemoryPayments.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compPayments.length + 1;
    const payNumber = `PAY-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const requestId = paymentData.requestId || generateUniqueRequestId('pay');

    const newPayment: SupplierPayment = {
      ...paymentData,
      requestId,
      companyId: targetCompId,
      id: paymentData.id || `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      paymentNumber: payNumber,
      createdAt: now
    };

    const syncRes = await SupabaseSyncService.syncPayment(newPayment);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to record supplier payment in database.'
      };
    }

    // Reduce Supplier Payable in memory
    const sIndex = _inMemorySuppliers.findIndex(
      (s) => s.id === paymentData.supplierId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId
    );
    if (sIndex !== -1) {
      _inMemorySuppliers[sIndex].payableBalance = Math.max(
        0,
        _inMemorySuppliers[sIndex].payableBalance - Number(paymentData.amount)
      );
    }

    // Adjust allocated purchases
    if (paymentData.allocations && paymentData.allocations.length > 0) {
      for (const alloc of paymentData.allocations) {
        if (alloc.allocatedAmount > 0) {
          const pIndex = _inMemoryPurchases.findIndex(
            (p) => p.id === alloc.purchaseId && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId
          );
          if (pIndex !== -1) {
            _inMemoryPurchases[pIndex].paidAmount = Number((_inMemoryPurchases[pIndex].paidAmount + alloc.allocatedAmount).toFixed(2));
            _inMemoryPurchases[pIndex].dueAmount = Math.max(0, Number((_inMemoryPurchases[pIndex].grandTotal - _inMemoryPurchases[pIndex].paidAmount).toFixed(2)));
          }
        }
      }
    }

    _inMemoryPayments.unshift(newPayment);

    return {
      success: true,
      data: newPayment,
      message: `Supplier payment ${newPayment.paymentNumber} recorded in database.`
    };
  },

  async deleteSupplierPaymentAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The payment was not voided.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deletePayment(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to void supplier payment in database.'
      };
    }

    const targetIndex = _inMemoryPayments.findIndex((p) => p.id === id);
    if (targetIndex !== -1) {
      const target = _inMemoryPayments[targetIndex];
      const sIndex = _inMemorySuppliers.findIndex((s) => s.id === target.supplierId);
      if (sIndex !== -1) {
        _inMemorySuppliers[sIndex].payableBalance += Number(target.amount);
      }
      if (target.allocations && target.allocations.length > 0) {
        for (const alloc of target.allocations) {
          if (alloc.allocatedAmount > 0) {
            const pIndex = _inMemoryPurchases.findIndex((p) => p.id === alloc.purchaseId);
            if (pIndex !== -1) {
              _inMemoryPurchases[pIndex].paidAmount = Math.max(0, Number((_inMemoryPurchases[pIndex].paidAmount - alloc.allocatedAmount).toFixed(2)));
              _inMemoryPurchases[pIndex].dueAmount = Math.max(0, Number((_inMemoryPurchases[pIndex].grandTotal - _inMemoryPurchases[pIndex].paidAmount).toFixed(2)));
            }
          }
        }
      }
      _inMemoryPayments.splice(targetIndex, 1);
    }

    return { success: true, message: 'Supplier payment voided and balance adjusted in database.' };
  },

  // --- EXPENSES ---
  getExpenses(companyId?: string): Expense[] {
    if (!companyId) return _inMemoryExpenses;
    return _inMemoryExpenses.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  async createExpenseAsync(
    expenseData: Omit<Expense, 'id' | 'expenseNumber' | 'createdAt'> & { id?: string },
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: Expense;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The expense was not saved.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const targetCompId = expenseData.companyId || companyId || DEFAULT_COMPANY_ID;
    const compExpenses = _inMemoryExpenses.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compExpenses.length + 1;
    const expNumber = `EXP-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const now = new Date().toISOString();
    const requestId = expenseData.requestId || generateUniqueRequestId('exp');

    const newExpense: Expense = {
      ...expenseData,
      requestId,
      companyId: targetCompId,
      id: expenseData.id || `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      expenseNumber: expNumber,
      createdAt: now
    };

    const syncRes = await SupabaseSyncService.syncExpense(newExpense);
    if (!syncRes.success) {
      return {
        success: false,
        error: syncRes.error || 'Failed to record expense in database.'
      };
    }

    _inMemoryExpenses.unshift(newExpense);

    return {
      success: true,
      data: newExpense,
      message: `Expense ${newExpense.expenseNumber} recorded in database.`
    };
  },

  async deleteExpenseAsync(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!checkOnline()) {
      return {
        success: false,
        error: 'Internet connection is required. The expense was not deleted.'
      };
    }

    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) {
      return {
        success: false,
        error: 'Supabase database is not configured.'
      };
    }

    const res = await SupabaseSyncService.deleteExpense(id);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete expense from database.'
      };
    }

    _inMemoryExpenses = _inMemoryExpenses.filter((e) => e.id !== id);
    return { success: true, message: 'Expense deleted from database.' };
  },

  // --- LEDGERS ---
  getLedgers(companyId?: string): LedgerAccount[] {
    if (!companyId) return _inMemoryLedgers;
    return _inMemoryLedgers.filter((l) => (l.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  saveLedger(ledgerData: Partial<LedgerAccount>, companyId?: string): LedgerAccount {
    const targetCompId = companyId || ledgerData.companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    if (ledgerData.id) {
      const idx = _inMemoryLedgers.findIndex((l) => l.id === ledgerData.id);
      if (idx !== -1) {
        const updated: LedgerAccount = {
          ..._inMemoryLedgers[idx],
          ...ledgerData,
          companyId: targetCompId
        } as LedgerAccount;
        _inMemoryLedgers[idx] = updated;
        return updated;
      }
    }

    const newLedger: LedgerAccount = {
      id: `ledg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: targetCompId,
      code: ledgerData.code || `ACC-${String(_inMemoryLedgers.length + 1).padStart(4, '0')}`,
      name: ledgerData.name || 'General Ledger',
      accountGroup: ledgerData.accountGroup || 'General Expenses',
      accountType: ledgerData.accountType || 'GENERAL',
      openingDebit: Number(ledgerData.openingDebit || 0),
      openingCredit: Number(ledgerData.openingCredit || 0),
      currentBalance: Number((ledgerData.openingDebit || 0) - (ledgerData.openingCredit || 0)),
      createdAt: now
    };

    _inMemoryLedgers.unshift(newLedger);
    return newLedger;
  },

  // --- WAREHOUSES ---
  getWarehouses(companyId?: string): Warehouse[] {
    const targetCompId = companyId || DEFAULT_COMPANY_ID;
    const compWh = _inMemoryWarehouses.filter((w) => (w.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    if (compWh.length === 0) {
      const defaultWh: Warehouse = {
        id: `wh-main-${targetCompId}`,
        companyId: targetCompId,
        code: 'WH-MAIN',
        name: 'Main Warehouse',
        location: 'Main Branch',
        isDefault: true,
        createdAt: new Date().toISOString()
      };
      _inMemoryWarehouses.push(defaultWh);
      return [defaultWh];
    }
    return compWh;
  },

  saveWarehouse(warehouseData: Partial<Warehouse>, companyId?: string): Warehouse {
    const targetCompId = companyId || warehouseData.companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    if (warehouseData.id) {
      const idx = _inMemoryWarehouses.findIndex((w) => w.id === warehouseData.id);
      if (idx !== -1) {
        const updated: Warehouse = {
          ..._inMemoryWarehouses[idx],
          ...warehouseData,
          companyId: targetCompId
        } as Warehouse;
        _inMemoryWarehouses[idx] = updated;
        return updated;
      }
    }

    const newWh: Warehouse = {
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: targetCompId,
      code: warehouseData.code || `WH-${String(_inMemoryWarehouses.length + 1).padStart(3, '0')}`,
      name: warehouseData.name || 'Branch Warehouse',
      location: warehouseData.location || '',
      isDefault: Boolean(warehouseData.isDefault),
      createdAt: now
    };

    _inMemoryWarehouses.unshift(newWh);
    return newWh;
  },

  // --- OPENING JOURNALS ---
  getOpeningJournals(companyId?: string): OpeningJournalVoucher[] {
    if (!companyId) return _inMemoryOpeningJournals;
    return _inMemoryOpeningJournals.filter((j) => j.companyId === companyId);
  },

  saveOpeningJournal(journal: OpeningJournalVoucher): void {
    const idx = _inMemoryOpeningJournals.findIndex((j) => j.id === journal.id);
    if (idx !== -1) {
      _inMemoryOpeningJournals[idx] = journal;
    } else {
      _inMemoryOpeningJournals.unshift(journal);
    }
  },

  // --- IMPORT HISTORY ---
  getImportHistory(companyId?: string): ImportHistoryRecord[] {
    if (!companyId) return _inMemoryImportHistory;
    return _inMemoryImportHistory.filter((h) => h.companyId === companyId);
  },

  saveImportHistory(record: ImportHistoryRecord): void {
    _inMemoryImportHistory.unshift(record);
  },

  // --- USERS IN-MEMORY ---
  getUsers(): AppUser[] {
    return _inMemoryUsers;
  },

  setUsers(users: AppUser[]): void {
    _inMemoryUsers = users;
  },

  // --- SEED & RESET ---
  resetDataToSample(): void {
    _inMemoryCompanies = [...INITIAL_COMPANIES];
    _inMemoryCustomers = [...INITIAL_CUSTOMERS];
    _inMemorySuppliers = [...INITIAL_SUPPLIERS];
    _inMemoryProducts = [...INITIAL_PRODUCTS];
    _inMemorySales = [...INITIAL_SALES];
    _inMemoryPurchases = [...INITIAL_PURCHASES];
    _inMemoryReceipts = [...INITIAL_RECEIPTS];
    _inMemoryPayments = [...INITIAL_PAYMENTS];
    _inMemoryExpenses = [...INITIAL_EXPENSES];
  },

  clearAllData(): void {
    _inMemoryCustomers = [];
    _inMemorySuppliers = [];
    _inMemoryProducts = [];
    _inMemorySales = [];
    _inMemoryPurchases = [];
    _inMemoryReceipts = [];
    _inMemoryPayments = [];
    _inMemoryExpenses = [];
  },

  // --- CASH BALANCE & DASHBOARD STATS ---
  calculateCashBalance(companyId?: string): number {
    const settings = this.getSettings();
    let balance = Number(settings.initialCashBalance || 0);

    const sales = this.getSales(companyId);
    sales.forEach((s) => {
      balance += Number(s.paidAmount || 0);
    });

    const receipts = this.getReceipts(companyId);
    receipts.forEach((r) => {
      if (r.paymentMode === 'CASH') {
        balance += Number(r.amount || 0);
      }
    });

    const purchases = this.getPurchases(companyId);
    purchases.forEach((p) => {
      balance -= Number(p.paidAmount || 0);
    });

    const payments = this.getPayments(companyId);
    payments.forEach((p) => {
      if (p.paymentMode === 'CASH') {
        balance -= Number(p.amount || 0);
      }
    });

    const expenses = this.getExpenses(companyId);
    expenses.forEach((e) => {
      if (e.paymentMode === 'CASH') {
        balance -= Number(e.amount || 0);
      }
    });

    return balance;
  },

  getDashboardSummary(companyId?: string): DashboardSummary {
    const todayStr = new Date().toISOString().split('T')[0];

    const sales = this.getSales(companyId);
    const purchases = this.getPurchases(companyId);
    const customers = this.getCustomers(companyId);
    const suppliers = this.getSuppliers(companyId);
    const products = this.getProducts(companyId);

    const todaySalesTotal = sales
      .filter((s) => s.date === todayStr)
      .reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);

    const todayPurchasesTotal = purchases
      .filter((p) => p.date === todayStr)
      .reduce((sum, p) => sum + Number(p.grandTotal || 0), 0);

    const totalCustOutstanding = customers.reduce(
      (sum, c) => sum + Number(c.outstandingBalance || 0),
      0
    );

    const totalSuppPayable = suppliers.reduce(
      (sum, s) => sum + Number(s.payableBalance || 0),
      0
    );

    const lowStockItems = products.filter(
      (p) => p.currentStock <= p.reorderLevel
    );

    return {
      todaySales: todaySalesTotal,
      todayPurchases: todayPurchasesTotal,
      cashBalance: this.calculateCashBalance(companyId),
      customerOutstanding: totalCustOutstanding,
      supplierPayable: totalSuppPayable,
      totalProducts: products.length,
      lowStockCount: lowStockItems.length
    };
  },

  getRecentTransactions(companyId?: string): TransactionRecord[] {
    const transactions: TransactionRecord[] = [];

    const sales = this.getSales(companyId);
    sales.forEach((s) => {
      transactions.push({
        id: s.id,
        type: 'SALE',
        refNumber: s.invoiceNumber,
        partyName: s.customerName,
        date: s.date,
        amount: s.grandTotal,
        paymentType: s.type
      });
    });

    const purchases = this.getPurchases(companyId);
    purchases.forEach((p) => {
      transactions.push({
        id: p.id,
        type: 'PURCHASE',
        refNumber: p.purchaseNumber,
        partyName: p.supplierName,
        date: p.date,
        amount: p.grandTotal,
        paymentType: p.type
      });
    });

    const receipts = this.getReceipts(companyId);
    receipts.forEach((r) => {
      transactions.push({
        id: r.id,
        type: 'RECEIPT',
        refNumber: r.receiptNumber,
        partyName: r.customerName,
        date: r.date,
        amount: r.amount,
        paymentType: r.paymentMode
      });
    });

    const payments = this.getPayments(companyId);
    payments.forEach((p) => {
      transactions.push({
        id: p.id,
        type: 'PAYMENT',
        refNumber: p.paymentNumber,
        partyName: p.supplierName,
        date: p.date,
        amount: p.amount,
        paymentType: p.paymentMode
      });
    });

    const expenses = this.getExpenses(companyId);
    expenses.forEach((e) => {
      transactions.push({
        id: e.id,
        type: 'EXPENSE',
        refNumber: e.expenseNumber,
        partyName: e.category,
        date: e.date,
        amount: e.amount,
        paymentType: e.paymentMode
      });
    });

    return transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  },

  // --- SUPABASE DATA PULL (Database is the Only Source of Truth) ---
  async pullFromSupabase(
    companyId?: string
  ): Promise<{ success: boolean; pulledCounts?: Record<string, number>; error?: string }> {
    if ((this as any)._isPulling) {
      return { success: false, error: 'Pull already in progress' };
    }
    (this as any)._isPulling = true;
    try {
      const [
        remoteCompanies,
        remoteProducts,
        remoteCustomers,
        remoteSuppliers,
        remoteSales,
        remotePurchases,
        remoteReceipts,
        remotePayments,
        remoteExpenses,
        remoteUsers
      ] = await Promise.all([
        SupabaseSyncService.fetchAllRemoteCompanies(),
        SupabaseSyncService.fetchAllRemoteProducts(companyId),
        SupabaseSyncService.fetchAllRemoteCustomers(companyId),
        SupabaseSyncService.fetchAllRemoteSuppliers(companyId),
        SupabaseSyncService.fetchAllRemoteSales(companyId),
        SupabaseSyncService.fetchAllRemotePurchases(companyId),
        SupabaseSyncService.fetchAllRemoteReceipts(companyId),
        SupabaseSyncService.fetchAllRemotePayments(companyId),
        SupabaseSyncService.fetchAllRemoteExpenses(companyId),
        SupabaseSyncService.fetchAllRemoteUsers()
      ]);

      const pulledCounts: Record<string, number> = {};

      if (remoteCompanies !== null) {
        _inMemoryCompanies = remoteCompanies.length > 0 ? remoteCompanies : [...INITIAL_COMPANIES];
        pulledCounts.companies = _inMemoryCompanies.length;
      }

      if (remoteProducts !== null) {
        _inMemoryProducts = remoteProducts;
        pulledCounts.products = remoteProducts.length;
      }

      if (remoteCustomers !== null) {
        _inMemoryCustomers = remoteCustomers;
        pulledCounts.customers = remoteCustomers.length;
      }

      if (remoteSuppliers !== null) {
        _inMemorySuppliers = remoteSuppliers;
        pulledCounts.suppliers = remoteSuppliers.length;
      }

      if (remoteSales !== null) {
        _inMemorySales = remoteSales;
        pulledCounts.sales = remoteSales.length;
      }

      if (remotePurchases !== null) {
        _inMemoryPurchases = remotePurchases;
        pulledCounts.purchases = remotePurchases.length;
      }

      if (remoteReceipts !== null) {
        _inMemoryReceipts = remoteReceipts;
        pulledCounts.receipts = remoteReceipts.length;
      }

      if (remotePayments !== null) {
        _inMemoryPayments = remotePayments;
        pulledCounts.payments = remotePayments.length;
      }

      if (remoteExpenses !== null) {
        _inMemoryExpenses = remoteExpenses;
        pulledCounts.expenses = remoteExpenses.length;
      }

      if (remoteUsers !== null) {
        _inMemoryUsers = remoteUsers;
        pulledCounts.users = remoteUsers.length;
      }

      return { success: true, pulledCounts };
    } catch (err: any) {
      console.error('Error pulling from Supabase:', err);
      return { success: false, error: err?.message || 'Failed to pull data from Supabase.' };
    } finally {
      (this as any)._isPulling = false;
    }
  }
};
