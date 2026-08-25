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
  AppUser,
  PdcTransaction,
  PdcStatus,
  PdcType,
  JournalEntry,
  ItemHistoryRecord
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
let _inMemoryPdcs: PdcTransaction[] = [];
let _inMemoryJournalEntries: JournalEntry[] = [];

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

  getCompanyBankAccounts(): string[] {
    const settings = this.getSettings();
    if (settings.companyBankAccounts && settings.companyBankAccounts.length > 0) {
      return settings.companyBankAccounts;
    }
    return [
      'Commercial Bank',
      'Sampath Bank',
      'Hatton National Bank (HNB)',
      'Bank of Ceylon (BOC)'
    ];
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
    invoiceData: Omit<SaleInvoice, 'id' | 'invoiceNumber' | 'createdAt'> & { id?: string; invoiceNumber?: string },
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: SaleInvoice;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) return { success: false, error: 'Internet connection is required. The invoice was not saved.' };
    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) return { success: false, error: 'Supabase database is not configured.' };

    const targetCompId = invoiceData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    const requestId = invoiceData.requestId || generateUniqueRequestId('sale');

    const newSale: SaleInvoice = {
      ...invoiceData,
      requestId,
      companyId: targetCompId,
      id: invoiceData.id || `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      invoiceNumber: invoiceData.invoiceNumber || '',
      createdAt: now,
      updatedAt: now
    };

    const syncRes = await SupabaseSyncService.syncSaleInvoice(newSale);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Failed to save sale invoice to Supabase database.' };
    }

    const finalSale = syncRes.existingData || newSale;

    if (syncRes.isDuplicate) {
      const existsInMemory = _inMemorySales.some((s) => s.id === finalSale.id || s.requestId === finalSale.requestId);
      if (!existsInMemory) {
        _inMemorySales.unshift(finalSale);
      }
      return { success: true, data: finalSale, message: `Invoice ${finalSale.invoiceNumber} was already recorded.` };
    }

    for (const item of finalSale.items) {
      const pIdx = _inMemoryProducts.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) {
        _inMemoryProducts[pIdx] = {
          ..._inMemoryProducts[pIdx],
          currentStock: Math.max(0, Number(_inMemoryProducts[pIdx].currentStock || 0) - Number(item.quantity || 0)),
          updatedAt: now
        };
      }
    }

    if (finalSale.customerId && finalSale.dueAmount > 0) {
      const cIdx = _inMemoryCustomers.findIndex(c => c.id === finalSale.customerId && (c.companyId || DEFAULT_COMPANY_ID) === targetCompId);
      if (cIdx !== -1) {
        _inMemoryCustomers[cIdx] = {
          ..._inMemoryCustomers[cIdx],
          outstandingBalance: Number(_inMemoryCustomers[cIdx].outstandingBalance || 0) + Number(finalSale.dueAmount),
          updatedAt: now
        };
      }
    }

    _inMemorySales.unshift(finalSale);
    return { success: true, data: finalSale };
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
    purchaseData: Omit<PurchaseInvoice, 'id' | 'purchaseNumber' | 'createdAt'> & { id?: string; purchaseNumber?: string },
    companyId?: string
  ): Promise<{
    success: boolean;
    data?: PurchaseInvoice;
    message?: string;
    error?: string;
  }> {
    if (!checkOnline()) return { success: false, error: 'Internet connection is required.' };
    const creds = getActiveSupabaseCredentials();
    if (!creds.url || !creds.key) return { success: false, error: 'Supabase database is not configured.' };

    const targetCompId = purchaseData.companyId || companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();
    const requestId = purchaseData.requestId || generateUniqueRequestId('purchase');

    const newPur: PurchaseInvoice = {
      ...purchaseData,
      requestId,
      companyId: targetCompId,
      id: purchaseData.id || `pur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      purchaseNumber: purchaseData.purchaseNumber || '',
      createdAt: now,
      updatedAt: now
    };

    const syncRes = await SupabaseSyncService.syncPurchaseInvoice(newPur);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Failed to save purchase to database.' };
    }

    const finalPur = syncRes.existingData || newPur;

    if (syncRes.isDuplicate) {
      const existsInMemory = _inMemoryPurchases.some((s) => s.id === finalPur.id || s.requestId === finalPur.requestId);
      if (!existsInMemory) {
        _inMemoryPurchases.unshift(finalPur);
      }
      return { success: true, data: finalPur, message: `Purchase ${finalPur.purchaseNumber} was already recorded.` };
    }

    for (const item of finalPur.items) {
      const pIdx = _inMemoryProducts.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) {
        _inMemoryProducts[pIdx] = {
          ..._inMemoryProducts[pIdx],
          currentStock: Number(_inMemoryProducts[pIdx].currentStock || 0) + Number(item.quantity || 0),
          updatedAt: now
        };
      }
    }

    if (finalPur.supplierId && finalPur.dueAmount > 0) {
      const sIdx = _inMemorySuppliers.findIndex(s => s.id === finalPur.supplierId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId);
      if (sIdx !== -1) {
        _inMemorySuppliers[sIdx] = {
          ..._inMemorySuppliers[sIdx],
          payableBalance: Number(_inMemorySuppliers[sIdx].payableBalance || 0) + Number(finalPur.dueAmount),
          updatedAt: now
        };
      }
    }

    _inMemoryPurchases.unshift(finalPur);
    return { success: true, data: finalPur };
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
    receiptData: Omit<CustomerReceipt, 'id' | 'receiptNumber' | 'createdAt'> & { id?: string; receiptNumber?: string },
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
    const recNumber = receiptData.receiptNumber || "";
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

    // Handle Idempotency / Duplicate
    if (syncRes.isDuplicate) {
      const existing = syncRes.existingData || newReceipt;
      const existsInMemory = _inMemoryReceipts.some((r) => r.id === existing.id || r.requestId === existing.requestId);
      if (!existsInMemory) {
        _inMemoryReceipts.unshift(existing);
      }
      return {
        success: true,
        data: existing,
        message: `Customer receipt ${existing.receiptNumber} was already recorded and verified in database.`
      };
    }

    // Reduce Customer Outstanding in memory
    let cIndex = _inMemoryCustomers.findIndex(
      (c) => c.id === receiptData.customerId
    );
    if (cIndex === -1 && receiptData.customerName) {
      cIndex = _inMemoryCustomers.findIndex(
        (c) => c.name.toLowerCase() === receiptData.customerName?.toLowerCase()
      );
    }
    if (cIndex !== -1) {
      _inMemoryCustomers[cIndex].outstandingBalance = Math.max(
        0,
        Number(((_inMemoryCustomers[cIndex].outstandingBalance || 0) - Number(receiptData.amount)).toFixed(2))
      );
    }

    // Adjust allocated Sales Invoices (or auto FIFO if no manual allocations)
    if (receiptData.allocations && receiptData.allocations.length > 0) {
      for (const alloc of receiptData.allocations) {
        if (alloc.allocatedAmount > 0) {
          const sIndex = _inMemorySales.findIndex(
            (s) => s.id === alloc.invoiceId
          );
          if (sIndex !== -1) {
            _inMemorySales[sIndex].paidAmount = Number(((_inMemorySales[sIndex].paidAmount || 0) + alloc.allocatedAmount).toFixed(2));
            _inMemorySales[sIndex].dueAmount = Math.max(0, Number(((_inMemorySales[sIndex].grandTotal || 0) - _inMemorySales[sIndex].paidAmount).toFixed(2)));
          }
        }
      }
    } else if (receiptData.customerId) {
      let rem = Number(receiptData.amount || 0);
      const custSales = _inMemorySales
        .filter((s) => s.customerId === receiptData.customerId && (s.dueAmount || 0) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (const s of custSales) {
        if (rem <= 0) break;
        const sIndex = _inMemorySales.findIndex((x) => x.id === s.id);
        if (sIndex !== -1) {
          const settle = Math.min(rem, _inMemorySales[sIndex].dueAmount);
          _inMemorySales[sIndex].paidAmount = Number(((_inMemorySales[sIndex].paidAmount || 0) + settle).toFixed(2));
          _inMemorySales[sIndex].dueAmount = Math.max(0, Number(((_inMemorySales[sIndex].grandTotal || 0) - _inMemorySales[sIndex].paidAmount).toFixed(2)));
          rem = Number((rem - settle).toFixed(2));
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
      let cIndex = _inMemoryCustomers.findIndex((c) => c.id === target.customerId);
      if (cIndex === -1 && target.customerName) {
        cIndex = _inMemoryCustomers.findIndex((c) => c.name.toLowerCase() === target.customerName.toLowerCase());
      }
      if (cIndex !== -1) {
        _inMemoryCustomers[cIndex].outstandingBalance = Number(((_inMemoryCustomers[cIndex].outstandingBalance || 0) + Number(target.amount)).toFixed(2));
      }
      if (target.allocations && target.allocations.length > 0) {
        for (const alloc of target.allocations) {
          if (alloc.allocatedAmount > 0) {
            const sIndex = _inMemorySales.findIndex((s) => s.id === alloc.invoiceId);
            if (sIndex !== -1) {
              _inMemorySales[sIndex].paidAmount = Math.max(0, Number(((_inMemorySales[sIndex].paidAmount || 0) - alloc.allocatedAmount).toFixed(2)));
              _inMemorySales[sIndex].dueAmount = Math.max(0, Number(((_inMemorySales[sIndex].grandTotal || 0) - _inMemorySales[sIndex].paidAmount).toFixed(2)));
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
    paymentData: Omit<SupplierPayment, 'id' | 'paymentNumber' | 'createdAt'> & { id?: string; paymentNumber?: string },
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
    const payNumber = paymentData.paymentNumber || "";
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

    // Handle Idempotency / Duplicate
    if (syncRes.isDuplicate) {
      const existing = syncRes.existingData || newPayment;
      const existsInMemory = _inMemoryPayments.some((p) => p.id === existing.id || p.requestId === existing.requestId);
      if (!existsInMemory) {
        _inMemoryPayments.unshift(existing);
      }
      return {
        success: true,
        data: existing,
        message: `Supplier payment ${existing.paymentNumber} was already recorded and verified in database.`
      };
    }

    // Reduce Supplier Payable in memory
    let sIndex = _inMemorySuppliers.findIndex(
      (s) => s.id === paymentData.supplierId
    );
    if (sIndex === -1 && paymentData.supplierName) {
      sIndex = _inMemorySuppliers.findIndex(
        (s) => s.name.toLowerCase() === paymentData.supplierName?.toLowerCase()
      );
    }
    if (sIndex !== -1) {
      _inMemorySuppliers[sIndex].payableBalance = Math.max(
        0,
        Number(((_inMemorySuppliers[sIndex].payableBalance || 0) - Number(paymentData.amount)).toFixed(2))
      );
    }

    // Adjust allocated purchases (or auto FIFO if no manual allocations)
    if (paymentData.allocations && paymentData.allocations.length > 0) {
      for (const alloc of paymentData.allocations) {
        if (alloc.allocatedAmount > 0) {
          const pIndex = _inMemoryPurchases.findIndex(
            (p) => p.id === alloc.purchaseId
          );
          if (pIndex !== -1) {
            _inMemoryPurchases[pIndex].paidAmount = Number(((_inMemoryPurchases[pIndex].paidAmount || 0) + alloc.allocatedAmount).toFixed(2));
            _inMemoryPurchases[pIndex].dueAmount = Math.max(0, Number(((_inMemoryPurchases[pIndex].grandTotal || 0) - _inMemoryPurchases[pIndex].paidAmount).toFixed(2)));
          }
        }
      }
    } else if (paymentData.supplierId) {
      let rem = Number(paymentData.amount || 0);
      const supPurs = _inMemoryPurchases
        .filter((p) => p.supplierId === paymentData.supplierId && (p.dueAmount || 0) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (const p of supPurs) {
        if (rem <= 0) break;
        const pIndex = _inMemoryPurchases.findIndex((x) => x.id === p.id);
        if (pIndex !== -1) {
          const settle = Math.min(rem, _inMemoryPurchases[pIndex].dueAmount);
          _inMemoryPurchases[pIndex].paidAmount = Number(((_inMemoryPurchases[pIndex].paidAmount || 0) + settle).toFixed(2));
          _inMemoryPurchases[pIndex].dueAmount = Math.max(0, Number(((_inMemoryPurchases[pIndex].grandTotal || 0) - _inMemoryPurchases[pIndex].paidAmount).toFixed(2)));
          rem = Number((rem - settle).toFixed(2));
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
      let sIndex = _inMemorySuppliers.findIndex((s) => s.id === target.supplierId);
      if (sIndex === -1 && target.supplierName) {
        sIndex = _inMemorySuppliers.findIndex((s) => s.name.toLowerCase() === target.supplierName.toLowerCase());
      }
      if (sIndex !== -1) {
        _inMemorySuppliers[sIndex].payableBalance = Number(((_inMemorySuppliers[sIndex].payableBalance || 0) + Number(target.amount)).toFixed(2));
      }
      if (target.allocations && target.allocations.length > 0) {
        for (const alloc of target.allocations) {
          if (alloc.allocatedAmount > 0) {
            const pIndex = _inMemoryPurchases.findIndex((p) => p.id === alloc.purchaseId);
            if (pIndex !== -1) {
              _inMemoryPurchases[pIndex].paidAmount = Math.max(0, Number(((_inMemoryPurchases[pIndex].paidAmount || 0) - alloc.allocatedAmount).toFixed(2)));
              _inMemoryPurchases[pIndex].dueAmount = Math.max(0, Number(((_inMemoryPurchases[pIndex].grandTotal || 0) - _inMemoryPurchases[pIndex].paidAmount).toFixed(2)));
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
    expenseData: Omit<Expense, 'id' | 'expenseNumber' | 'createdAt'> & { id?: string; expenseNumber?: string },
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
    const now = new Date().toISOString();
    const requestId = expenseData.requestId || generateUniqueRequestId('exp');

    // Pre-calculate expense number if not provided
    let expNumber = expenseData.expenseNumber;
    if (!expNumber) {
      const year = new Date().getFullYear();
      const existingForComp = _inMemoryExpenses.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) === targetCompId);
      expNumber = `EXP-${year}-${String(existingForComp.length + 1).padStart(4, '0')}`;
    }

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

    if (syncRes.expenseNumber) {
      newExpense.expenseNumber = syncRes.expenseNumber;
    }

    // Handle Idempotency / Duplicate
    if (syncRes.isDuplicate) {
      const existing = syncRes.existingData || newExpense;
      const existsInMemory = _inMemoryExpenses.some((e) => e.id === existing.id || e.requestId === existing.requestId);
      if (!existsInMemory) {
        _inMemoryExpenses.unshift(existing);
      }
      return {
        success: true,
        data: existing,
        message: `Expense ${existing.expenseNumber} was already recorded and verified in database.`
      };
    }

    // Remove any duplicate if in-memory had same id or requestId
    const dupIdx = _inMemoryExpenses.findIndex((e) => e.id === newExpense.id || e.requestId === newExpense.requestId);
    if (dupIdx !== -1) {
      _inMemoryExpenses[dupIdx] = newExpense;
    } else {
      _inMemoryExpenses.unshift(newExpense);
    }

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

  // --- PDC MANAGEMENT ---
  getPdcs(companyId?: string): PdcTransaction[] {
    if (!companyId) return _inMemoryPdcs;
    return _inMemoryPdcs.filter((p) => p.companyId === companyId);
  },

  async savePdcAsync(
    pdcData: Partial<PdcTransaction>,
    companyId?: string
  ): Promise<{ success: boolean; data?: PdcTransaction; error?: string }> {
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to save PDC records.' };
    }
    const targetCompId = pdcData.companyId || companyId || DEFAULT_COMPANY_ID;
    const reqId = pdcData.requestId || generateUniqueRequestId('pdc');
    const now = new Date().toISOString();

    const pdcToSave: PdcTransaction = {
      id: pdcData.id || `pdc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      requestId: reqId,
      companyId: targetCompId,
      type: pdcData.type || 'RECEIVED',
      partyId: pdcData.partyId || '',
      partyType: pdcData.partyType || 'CUSTOMER',
      partyName: pdcData.partyName || 'Unknown Party',
      chequeNumber: pdcData.chequeNumber || '',
      bankName: pdcData.bankName || '',
      clearedBankName: pdcData.clearedBankName,
      chequeDate: pdcData.chequeDate || now.split('T')[0],
      amount: Number(pdcData.amount || 0),
      status: pdcData.status || 'PENDING',
      referenceVoucherNo: pdcData.referenceVoucherNo || '',
      notes: pdcData.notes || '',
      clearedAt: pdcData.clearedAt,
      depositDate: pdcData.depositDate,
      bounceDate: pdcData.bounceDate,
      bounceReason: pdcData.bounceReason,
      bounceCharges: pdcData.bounceCharges,
      linkedJournalId: pdcData.linkedJournalId,
      createdAt: pdcData.createdAt || now,
      updatedAt: now
    };

    const syncRes = await SupabaseSyncService.savePdcRpc(pdcToSave);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Database rejected PDC save.' };
    }

    const idx = _inMemoryPdcs.findIndex((p) => p.id === pdcToSave.id);
    if (idx !== -1) {
      _inMemoryPdcs[idx] = pdcToSave;
    } else {
      _inMemoryPdcs.unshift(pdcToSave);
    }

    return { success: true, data: pdcToSave };
  },

  async depositPdcAsync(
    id: string,
    depositDate: string,
    bankName: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to deposit PDC.' };
    }
    const pdc = _inMemoryPdcs.find((p) => p.id === id);
    if (!pdc) return { success: false, error: 'PDC record not found.' };

    const reqId = generateUniqueRequestId('pdc_dep');
    const syncRes = await SupabaseSyncService.depositPdcRpc(id, depositDate, bankName, notes, reqId);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Database rejected PDC deposit.' };
    }

    const updatedPdc: PdcTransaction = {
      ...pdc,
      status: 'DEPOSITED',
      depositDate,
      clearedBankName: bankName || pdc.bankName,
      notes: notes ? (pdc.notes ? `${pdc.notes} | ${notes}` : notes) : pdc.notes,
      updatedAt: new Date().toISOString()
    };

    const idx = _inMemoryPdcs.findIndex((p) => p.id === id);
    if (idx !== -1) _inMemoryPdcs[idx] = updatedPdc;

    return { success: true };
  },

  async clearPdcAsync(
    id: string,
    clearedDate: string,
    clearingBankName: string
  ): Promise<{ success: boolean; journalId?: string; voucherNo?: string; error?: string }> {
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to clear PDC.' };
    }
    const pdc = _inMemoryPdcs.find((p) => p.id === id);
    if (!pdc) return { success: false, error: 'PDC record not found.' };

    const reqId = generateUniqueRequestId('pdc_clr');
    const syncRes = await SupabaseSyncService.clearPdcRpc(pdc, clearedDate, clearingBankName, reqId);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Database rejected PDC clearance.' };
    }

    const nowIso = new Date().toISOString();
    const updatedPdc: PdcTransaction = {
      ...pdc,
      status: 'CLEARED',
      clearedAt: nowIso,
      clearedBankName: clearingBankName,
      linkedJournalId: syncRes.journalId,
      updatedAt: nowIso
    };

    const idx = _inMemoryPdcs.findIndex((p) => p.id === id);
    if (idx !== -1) _inMemoryPdcs[idx] = updatedPdc;

    // Update Customer / Supplier Outstanding Balance in memory
    if (pdc.type === 'RECEIVED' && pdc.partyId) {
      const cIdx = _inMemoryCustomers.findIndex((c) => c.id === pdc.partyId);
      if (cIdx !== -1) {
        _inMemoryCustomers[cIdx].outstandingBalance = Number((_inMemoryCustomers[cIdx].outstandingBalance - pdc.amount).toFixed(2));
      }
    } else if (pdc.type === 'ISSUED' && pdc.partyId) {
      const sIdx = _inMemorySuppliers.findIndex((s) => s.id === pdc.partyId);
      if (sIdx !== -1) {
        _inMemorySuppliers[sIdx].payableBalance = Number((_inMemorySuppliers[sIdx].payableBalance - pdc.amount).toFixed(2));
      }
    }

    // Add Journal Entry in memory
    const bankLedgerId = `bank_${clearingBankName.toLowerCase().replace(/\s+/g, '_')}`;
    const jvNo = syncRes.voucherNo || `JV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const jvId = syncRes.journalId || `jv-pdc-${Date.now()}`;
    const newJournal: JournalEntry = {
      id: jvId,
      requestId: `req_jrn_clr_${pdc.id}`,
      companyId: pdc.companyId || DEFAULT_COMPANY_ID,
      voucherNo: jvNo,
      voucherType: 'PDC',
      voucherDate: clearedDate,
      narration: `PDC Cleared: Cheque #${pdc.chequeNumber} (${pdc.partyName})`,
      debitTotal: pdc.amount,
      creditTotal: pdc.amount,
      lines: pdc.type === 'RECEIVED'
        ? [
            { id: `${jvId}_1`, ledgerId: bankLedgerId, ledgerName: clearingBankName, accountGroup: 'Bank Accounts', debit: pdc.amount, credit: 0, particulars: `PDC Cheque Cleared #${pdc.chequeNumber}` },
            { id: `${jvId}_2`, ledgerId: pdc.partyId, ledgerName: pdc.partyName, accountGroup: 'Sundry Debtors', debit: 0, credit: pdc.amount, particulars: `Customer Realized: #${pdc.chequeNumber}` }
          ]
        : [
            { id: `${jvId}_1`, ledgerId: pdc.partyId, ledgerName: pdc.partyName, accountGroup: 'Sundry Creditors', debit: pdc.amount, credit: 0, particulars: `Supplier Payment Cleared: #${pdc.chequeNumber}` },
            { id: `${jvId}_2`, ledgerId: bankLedgerId, ledgerName: clearingBankName, accountGroup: 'Bank Accounts', debit: 0, credit: pdc.amount, particulars: `Disbursement: Cheque #${pdc.chequeNumber}` }
          ],
      createdAt: nowIso
    };
    _inMemoryJournalEntries.unshift(newJournal);

    return { success: true, journalId: jvId, voucherNo: jvNo };
  },

  async bouncePdcAsync(
    id: string,
    bounceDate: string,
    bankName: string,
    reason?: string,
    charges?: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to bounce PDC.' };
    }
    const pdc = _inMemoryPdcs.find((p) => p.id === id);
    if (!pdc) return { success: false, error: 'PDC record not found.' };

    const wasCleared = pdc.status === 'CLEARED';
    const reqId = generateUniqueRequestId('pdc_bnc');
    const syncRes = await SupabaseSyncService.bouncePdcRpc(pdc, bounceDate, bankName, reason, charges, reqId);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Database rejected PDC bounce.' };
    }

    const nowIso = new Date().toISOString();
    const updatedPdc: PdcTransaction = {
      ...pdc,
      status: 'BOUNCED',
      bounceDate,
      bounceReason: reason || 'Dishonored by Bank',
      bounceCharges: Number(charges || 0),
      updatedAt: nowIso
    };

    const idx = _inMemoryPdcs.findIndex((p) => p.id === id);
    if (idx !== -1) _inMemoryPdcs[idx] = updatedPdc;

    // If previously cleared, restore Customer / Supplier Balance
    if (wasCleared) {
      if (pdc.type === 'RECEIVED' && pdc.partyId) {
        const cIdx = _inMemoryCustomers.findIndex((c) => c.id === pdc.partyId);
        if (cIdx !== -1) {
          _inMemoryCustomers[cIdx].outstandingBalance = Number((_inMemoryCustomers[cIdx].outstandingBalance + pdc.amount).toFixed(2));
        }
      } else if (pdc.type === 'ISSUED' && pdc.partyId) {
        const sIdx = _inMemorySuppliers.findIndex((s) => s.id === pdc.partyId);
        if (sIdx !== -1) {
          _inMemorySuppliers[sIdx].payableBalance = Number((_inMemorySuppliers[sIdx].payableBalance + pdc.amount).toFixed(2));
        }
      }
    }

    return { success: true };
  },

  async cancelPdcAsync(
    id: string,
    reason?: string,
    isReturned: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to cancel/return PDC.' };
    }
    const pdc = _inMemoryPdcs.find((p) => p.id === id);
    if (!pdc) return { success: false, error: 'PDC record not found.' };

    const reqId = generateUniqueRequestId('pdc_cnc');
    const syncRes = await SupabaseSyncService.cancelPdcRpc(id, reason, isReturned, reqId);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Database rejected PDC cancellation.' };
    }

    const targetStatus = isReturned ? 'RETURNED' : 'CANCELLED';
    const updatedPdc: PdcTransaction = {
      ...pdc,
      status: targetStatus,
      notes: reason ? (pdc.notes ? `${pdc.notes} | ${reason}` : reason) : pdc.notes,
      updatedAt: new Date().toISOString()
    };

    const idx = _inMemoryPdcs.findIndex((p) => p.id === id);
    if (idx !== -1) _inMemoryPdcs[idx] = updatedPdc;

    return { success: true };
  },

  async updatePdcStatusAsync(
    id: string,
    newStatus: PdcStatus,
    clearedBankName?: string,
    companyId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (newStatus === 'CLEARED') {
      const today = new Date().toISOString().split('T')[0];
      return this.clearPdcAsync(id, today, clearedBankName || 'Commercial Bank');
    }
    if (newStatus === 'BOUNCED') {
      const today = new Date().toISOString().split('T')[0];
      return this.bouncePdcAsync(id, today, clearedBankName || 'Commercial Bank');
    }
    if (newStatus === 'CANCELLED' || newStatus === 'RETURNED') {
      return this.cancelPdcAsync(id, undefined, newStatus === 'RETURNED');
    }
    if (newStatus === 'DEPOSITED') {
      const today = new Date().toISOString().split('T')[0];
      return this.depositPdcAsync(id, today, clearedBankName || 'Commercial Bank');
    }

    // Default sync fallback (e.g. returning to PENDING)
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to update PDC status.' };
    }
    const pdc = _inMemoryPdcs.find((p) => p.id === id);
    if (!pdc) return { success: false, error: 'PDC record not found.' };

    const updatedPdc: PdcTransaction = {
      ...pdc,
      status: newStatus,
      clearedBankName: clearedBankName || pdc.clearedBankName || pdc.bankName,
      clearedAt: undefined,
      updatedAt: new Date().toISOString()
    };

    const syncRes = await SupabaseSyncService.syncPdc(updatedPdc);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Failed to update PDC status in database.' };
    }

    const idx = _inMemoryPdcs.findIndex((p) => p.id === id);
    if (idx !== -1) {
      _inMemoryPdcs[idx] = updatedPdc;
    }

    return { success: true };
  },

  async deletePdcAsync(id: string): Promise<{ success: boolean; error?: string }> {
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to delete PDC.' };
    }
    const syncRes = await SupabaseSyncService.deletePdc(id);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Failed to delete PDC from database.' };
    }
    _inMemoryPdcs = _inMemoryPdcs.filter((p) => p.id !== id);
    return { success: true };
  },

  // --- JOURNAL ENTRIES & ACCOUNTING ---
  getJournalEntries(companyId?: string): JournalEntry[] {
    if (!companyId) return _inMemoryJournalEntries;
    return _inMemoryJournalEntries.filter((j) => j.companyId === companyId);
  },

  async createJournalEntryAsync(
    entryData: Omit<JournalEntry, 'id' | 'createdAt'>,
    companyId?: string
  ): Promise<{ success: boolean; data?: JournalEntry; error?: string }> {
    if (!checkOnline()) {
      return { success: false, error: 'Internet connection required to save Journal entry.' };
    }
    const targetCompId = entryData.companyId || companyId || DEFAULT_COMPANY_ID;
    const reqId = entryData.requestId || generateUniqueRequestId('jrn');
    const now = new Date().toISOString();

    const entryToSave: JournalEntry = {
      ...entryData,
      id: `jrn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      requestId: reqId,
      companyId: targetCompId,
      createdAt: now
    };

    const syncRes = await SupabaseSyncService.syncJournalEntry(entryToSave);
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Database rejected Journal entry.' };
    }

    _inMemoryJournalEntries.unshift(entryToSave);
    return { success: true, data: entryToSave };
  },

  // --- LEDGER STATEMENT COMPUTATION ---
  getLedgerStatement(
    partyOrLedgerId: string,
    fromDate?: string,
    toDate?: string,
    companyId?: string
  ) {
    const activeComp = companyId || DEFAULT_COMPANY_ID;
    const customers = this.getCustomers(activeComp);
    const suppliers = this.getSuppliers(activeComp);
    const sales = this.getSales(activeComp);
    const purchases = this.getPurchases(activeComp);
    const receipts = this.getReceipts(activeComp);
    const payments = this.getPayments(activeComp);
    const expenses = this.getExpenses(activeComp);
    const pdcs = this.getPdcs(activeComp);
    const journals = this.getJournalEntries(activeComp);

    // Identify account/party
    const customer = customers.find((c) => c.id === partyOrLedgerId || c.name.toLowerCase() === partyOrLedgerId.toLowerCase());
    const supplier = suppliers.find((s) => s.id === partyOrLedgerId || s.name.toLowerCase() === partyOrLedgerId.toLowerCase());

    let ledgerName = partyOrLedgerId;
    let accountGroup = 'General Ledger';
    let openingBal = 0; // positive = Dr, negative = Cr

    if (customer) {
      ledgerName = customer.name;
      accountGroup = customer.accountGroup || 'Sundry Debtors';
      openingBal = Number(customer.openingBalance || 0); // Customer Dr
    } else if (supplier) {
      ledgerName = supplier.name;
      accountGroup = supplier.accountGroup || 'Sundry Creditors';
      openingBal = -Number(supplier.openingBalance || 0); // Supplier Cr
    } else if (partyOrLedgerId.toLowerCase().includes('cash')) {
      ledgerName = 'Cash Account';
      accountGroup = 'Cash-in-Hand';
      const settings = this.getSettings();
      openingBal = Number(settings.initialCashBalance || 0);
    } else if (partyOrLedgerId.toLowerCase().includes('sales')) {
      ledgerName = 'Sales Account';
      accountGroup = 'Sales Accounts';
    } else if (partyOrLedgerId.toLowerCase().includes('purchase')) {
      ledgerName = 'Purchase Account';
      accountGroup = 'Purchase Accounts';
    }

    interface RawTx {
      id: string;
      date: string;
      voucherNo: string;
      voucherType: string;
      particulars: string;
      debit: number;
      credit: number;
    }

    const allTx: RawTx[] = [];

    // Customer / Sales transactions
    sales.forEach((s) => {
      const isThisParty = (customer && s.customerId === customer.id) || s.customerName.toLowerCase() === ledgerName.toLowerCase();
      const isSalesAccount = ledgerName.toLowerCase().includes('sales');

      if (isThisParty) {
        allTx.push({
          id: s.id,
          date: s.date,
          voucherNo: s.invoiceNumber,
          voucherType: 'Sale Invoice',
          particulars: `Sales Invoice to ${s.customerName}`,
          debit: Number(s.grandTotal || 0),
          credit: 0
        });
        if (s.paidAmount > 0) {
          allTx.push({
            id: `${s.id}_pay`,
            date: s.date,
            voucherNo: s.invoiceNumber,
            voucherType: 'Immediate Receipt',
            particulars: `Payment Received (${s.paymentType})`,
            debit: 0,
            credit: Number(s.paidAmount || 0)
          });
        }
      } else if (isSalesAccount) {
        allTx.push({
          id: s.id,
          date: s.date,
          voucherNo: s.invoiceNumber,
          voucherType: 'Sale Invoice',
          particulars: `Sales to ${s.customerName}`,
          debit: 0,
          credit: Number(s.subtotal || s.grandTotal || 0)
        });
      }
    });

    // Customer Receipts
    receipts.forEach((r) => {
      const isThisParty = (customer && r.customerId === customer.id) || r.customerName.toLowerCase() === ledgerName.toLowerCase();
      const isCashOrBank = (ledgerName.toLowerCase().includes('cash') && r.paymentMode === 'CASH') ||
        (ledgerName.toLowerCase().includes('bank') && r.paymentMode !== 'CASH');

      if (isThisParty) {
        allTx.push({
          id: r.id,
          date: r.date,
          voucherNo: r.receiptNumber,
          voucherType: 'Receipt Voucher',
          particulars: `Received via ${r.paymentMode} ${r.referenceNo ? `(Ref: ${r.referenceNo})` : ''}`,
          debit: 0,
          credit: Number(r.amount || 0)
        });
      } else if (isCashOrBank) {
        allTx.push({
          id: r.id,
          date: r.date,
          voucherNo: r.receiptNumber,
          voucherType: 'Receipt Voucher',
          particulars: `Receipt from ${r.customerName}`,
          debit: Number(r.amount || 0),
          credit: 0
        });
      }
    });

    // Supplier / Purchase transactions
    purchases.forEach((p) => {
      const isThisParty = (supplier && p.supplierId === supplier.id) || p.supplierName.toLowerCase() === ledgerName.toLowerCase();
      const isPurchaseAccount = ledgerName.toLowerCase().includes('purchase');

      if (isThisParty) {
        allTx.push({
          id: p.id,
          date: p.date,
          voucherNo: p.purchaseNumber,
          voucherType: 'Purchase Bill',
          particulars: `Purchase from ${p.supplierName}`,
          debit: 0,
          credit: Number(p.grandTotal || 0)
        });
        if (p.paidAmount > 0) {
          allTx.push({
            id: `${p.id}_pay`,
            date: p.date,
            voucherNo: p.purchaseNumber,
            voucherType: 'Immediate Payment',
            particulars: `Payment Issued (${p.paymentType})`,
            debit: Number(p.paidAmount || 0),
            credit: 0
          });
        }
      } else if (isPurchaseAccount) {
        allTx.push({
          id: p.id,
          date: p.date,
          voucherNo: p.purchaseNumber,
          voucherType: 'Purchase Bill',
          particulars: `Purchase from ${p.supplierName}`,
          debit: Number(p.subtotal || p.grandTotal || 0),
          credit: 0
        });
      }
    });

    // Supplier Payments
    payments.forEach((p) => {
      const isThisParty = (supplier && p.supplierId === supplier.id) || p.supplierName.toLowerCase() === ledgerName.toLowerCase();
      const isCashOrBank = (ledgerName.toLowerCase().includes('cash') && p.paymentMode === 'CASH') ||
        (ledgerName.toLowerCase().includes('bank') && p.paymentMode !== 'CASH');

      if (isThisParty) {
        allTx.push({
          id: p.id,
          date: p.date,
          voucherNo: p.paymentNumber,
          voucherType: 'Payment Voucher',
          particulars: `Paid via ${p.paymentMode} ${p.referenceNo ? `(Ref: ${p.referenceNo})` : ''}`,
          debit: Number(p.amount || 0),
          credit: 0
        });
      } else if (isCashOrBank) {
        allTx.push({
          id: p.id,
          date: p.date,
          voucherNo: p.paymentNumber,
          voucherType: 'Payment Voucher',
          particulars: `Payment to ${p.supplierName}`,
          debit: 0,
          credit: Number(p.amount || 0)
        });
      }
    });

    // Expenses
    expenses.forEach((e) => {
      const isThisCategory = e.category.toLowerCase() === ledgerName.toLowerCase();
      const isCashOrBank = (ledgerName.toLowerCase().includes('cash') && e.paymentMode === 'CASH') ||
        (ledgerName.toLowerCase().includes('bank') && e.paymentMode !== 'CASH');

      if (isThisCategory) {
        allTx.push({
          id: e.id,
          date: e.date,
          voucherNo: e.expenseNumber,
          voucherType: 'Expense Voucher',
          particulars: `${e.category} (${e.notes || 'Expense'})`,
          debit: Number(e.amount || 0),
          credit: 0
        });
      } else if (isCashOrBank) {
        allTx.push({
          id: e.id,
          date: e.date,
          voucherNo: e.expenseNumber,
          voucherType: 'Expense Voucher',
          particulars: `Expense: ${e.category}`,
          debit: 0,
          credit: Number(e.amount || 0)
        });
      }
    });

    // Journal lines
    journals.forEach((j) => {
      (j.lines || []).forEach((line) => {
        if (line.ledgerName.toLowerCase() === ledgerName.toLowerCase() || line.ledgerId === partyOrLedgerId) {
          allTx.push({
            id: line.id,
            date: j.voucherDate,
            voucherNo: j.voucherNo,
            voucherType: j.voucherType,
            particulars: line.particulars || j.narration || 'Journal Entry',
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0)
          });
        }
      });
    });

    // Sort chronologically
    allTx.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter by date range and calculate running balance
    let periodOpening = openingBal;
    const finalEntries: Array<{
      id: string;
      date: string;
      voucherNo: string;
      voucherType: string;
      particulars: string;
      debit: number;
      credit: number;
      runningBalance: number;
      runningType: 'Dr' | 'Cr';
    }> = [];

    let totalDr = 0;
    let totalCr = 0;

    allTx.forEach((tx) => {
      if (fromDate && tx.date < fromDate) {
        periodOpening += (tx.debit - tx.credit);
        return;
      }
      if (toDate && tx.date > toDate) {
        return;
      }

      periodOpening += (tx.debit - tx.credit);
      totalDr += tx.debit;
      totalCr += tx.credit;

      finalEntries.push({
        ...tx,
        runningBalance: Math.abs(periodOpening),
        runningType: periodOpening >= 0 ? 'Dr' : 'Cr'
      });
    });

    return {
      ledgerName,
      accountGroup,
      openingBalance: Math.abs(openingBal),
      openingType: openingBal >= 0 ? 'Dr' : 'Cr',
      totalDebit: totalDr,
      totalCredit: totalCr,
      closingBalance: Math.abs(periodOpening),
      closingType: periodOpening >= 0 ? 'Dr' : 'Cr',
      entries: finalEntries
    };
  },

  // --- ITEM HISTORY COMPUTATION ---
  getItemHistory(
    productId: string,
    fromDate?: string,
    toDate?: string,
    companyId?: string
  ): ItemHistoryRecord[] {
    const activeComp = companyId || DEFAULT_COMPANY_ID;
    const products = this.getProducts(activeComp);
    const purchases = this.getPurchases(activeComp);
    const sales = this.getSales(activeComp);

    const product = products.find((p) => p.id === productId || p.code === productId);
    if (!product) return [];

    interface RawMovement {
      date: string;
      voucherType: string;
      voucherNo: string;
      partyName: string;
      quantityIn: number;
      quantityOut: number;
      rate: number;
      amount: number;
      notes?: string;
    }

    const movements: RawMovement[] = [];

    // Opening Stock
    if (product.openingStock > 0) {
      movements.push({
        date: product.createdAt ? product.createdAt.split('T')[0] : '2026-01-01',
        voucherType: 'Opening Stock',
        voucherNo: 'INIT-STOCK',
        partyName: 'Master Product Profile',
        quantityIn: Number(product.openingStock || 0),
        quantityOut: 0,
        rate: Number(product.costPrice || 0),
        amount: Number(product.openingStock || 0) * Number(product.costPrice || 0),
        notes: 'Initial Opening Stock'
      });
    }

    // Purchases
    purchases.forEach((pur) => {
      (pur.items || []).forEach((item) => {
        if (item.productId === product.id || item.productCode === product.code) {
          movements.push({
            date: pur.date,
            voucherType: 'Purchase Invoice',
            voucherNo: pur.purchaseNumber,
            partyName: pur.supplierName,
            quantityIn: Number(item.quantity || 0),
            quantityOut: 0,
            rate: Number(item.unitCost || 0),
            amount: Number(item.total || 0),
            notes: `Purchase Bill ${pur.purchaseNumber}`
          });
        }
      });
    });

    // Sales
    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        if (item.productId === product.id || item.productCode === product.code) {
          movements.push({
            date: sale.date,
            voucherType: 'Sale Invoice',
            voucherNo: sale.invoiceNumber,
            partyName: sale.customerName,
            quantityIn: 0,
            quantityOut: Number(item.quantity || 0),
            rate: Number(item.unitPrice || 0),
            amount: Number(item.total || 0),
            notes: `Sales Invoice ${sale.invoiceNumber}`
          });
        }
      });
    });

    // Sort chronologically
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let stockAcc = 0;
    const history: ItemHistoryRecord[] = [];

    movements.forEach((m) => {
      stockAcc += (m.quantityIn - m.quantityOut);
      if (fromDate && m.date < fromDate) return;
      if (toDate && m.date > toDate) return;

      history.push({
        ...m,
        runningStock: stockAcc
      });
    });

    return history;
  },

  // --- TRIAL BALANCE COMPUTATION ---
  getTrialBalance(fromDate?: string, toDate?: string, companyId?: string) {
    const activeComp = companyId || DEFAULT_COMPANY_ID;
    const customers = this.getCustomers(activeComp);
    const suppliers = this.getSuppliers(activeComp);
    const sales = this.getSales(activeComp);
    const purchases = this.getPurchases(activeComp);
    const receipts = this.getReceipts(activeComp);
    const payments = this.getPayments(activeComp);
    const expenses = this.getExpenses(activeComp);
    const pdcs = this.getPdcs(activeComp);

    // Group-based ledger summaries
    interface TrialRow {
      accountGroup: string;
      ledgerName: string;
      nature: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
      openingDr: number;
      openingCr: number;
      periodDr: number;
      periodCr: number;
      closingDr: number;
      closingCr: number;
    }

    const rows: TrialRow[] = [];

    // 1. Debtors (Customers)
    customers.forEach((c) => {
      const stmt = this.getLedgerStatement(c.id, fromDate, toDate, activeComp);
      const openDr = stmt.openingType === 'Dr' ? stmt.openingBalance : 0;
      const openCr = stmt.openingType === 'Cr' ? stmt.openingBalance : 0;
      const closeDr = stmt.closingType === 'Dr' ? stmt.closingBalance : 0;
      const closeCr = stmt.closingType === 'Cr' ? stmt.closingBalance : 0;

      rows.push({
        accountGroup: c.accountGroup || 'Sundry Debtors',
        ledgerName: c.name,
        nature: 'ASSET',
        openingDr: openDr,
        openingCr: openCr,
        periodDr: stmt.totalDebit,
        periodCr: stmt.totalCredit,
        closingDr: closeDr,
        closingCr: closeCr
      });
    });

    // 2. Creditors (Suppliers)
    suppliers.forEach((s) => {
      const stmt = this.getLedgerStatement(s.id, fromDate, toDate, activeComp);
      const openDr = stmt.openingType === 'Dr' ? stmt.openingBalance : 0;
      const openCr = stmt.openingType === 'Cr' ? stmt.openingBalance : 0;
      const closeDr = stmt.closingType === 'Dr' ? stmt.closingBalance : 0;
      const closeCr = stmt.closingType === 'Cr' ? stmt.closingBalance : 0;

      rows.push({
        accountGroup: s.accountGroup || 'Sundry Creditors',
        ledgerName: s.name,
        nature: 'LIABILITY',
        openingDr: openDr,
        openingCr: openCr,
        periodDr: stmt.totalDebit,
        periodCr: stmt.totalCredit,
        closingDr: closeDr,
        closingCr: closeCr
      });
    });

    // 3. Cash Account
    const cashStmt = this.getLedgerStatement('Cash Account', fromDate, toDate, activeComp);
    rows.push({
      accountGroup: 'Cash-in-Hand',
      ledgerName: 'Cash Account',
      nature: 'ASSET',
      openingDr: cashStmt.openingType === 'Dr' ? cashStmt.openingBalance : 0,
      openingCr: cashStmt.openingType === 'Cr' ? cashStmt.openingBalance : 0,
      periodDr: cashStmt.totalDebit,
      periodCr: cashStmt.totalCredit,
      closingDr: cashStmt.closingType === 'Dr' ? cashStmt.closingBalance : 0,
      closingCr: cashStmt.closingType === 'Cr' ? cashStmt.closingBalance : 0
    });

    // 4. Sales Account
    const salesStmt = this.getLedgerStatement('Sales Account', fromDate, toDate, activeComp);
    rows.push({
      accountGroup: 'Sales Accounts',
      ledgerName: 'Sales Revenue',
      nature: 'INCOME',
      openingDr: 0,
      openingCr: 0,
      periodDr: salesStmt.totalDebit,
      periodCr: salesStmt.totalCredit,
      closingDr: salesStmt.closingType === 'Dr' ? salesStmt.closingBalance : 0,
      closingCr: salesStmt.closingType === 'Cr' ? salesStmt.closingBalance : 0
    });

    // 5. Purchase Account
    const purStmt = this.getLedgerStatement('Purchase Account', fromDate, toDate, activeComp);
    rows.push({
      accountGroup: 'Purchase Accounts',
      ledgerName: 'Purchase Cost',
      nature: 'EXPENSE',
      openingDr: 0,
      openingCr: 0,
      periodDr: purStmt.totalDebit,
      periodCr: purStmt.totalCredit,
      closingDr: purStmt.closingType === 'Dr' ? purStmt.closingBalance : 0,
      closingCr: purStmt.closingType === 'Cr' ? purStmt.closingBalance : 0
    });

    // 6. Expenses by Category
    const expCategories: string[] = Array.from(new Set(expenses.map((e) => e.category)));
    expCategories.forEach((cat: string) => {
      const expStmt = this.getLedgerStatement(cat, fromDate, toDate, activeComp);
      rows.push({
        accountGroup: 'Direct & Indirect Expenses',
        ledgerName: cat,
        nature: 'EXPENSE',
        openingDr: 0,
        openingCr: 0,
        periodDr: expStmt.totalDebit,
        periodCr: expStmt.totalCredit,
        closingDr: expStmt.closingType === 'Dr' ? expStmt.closingBalance : 0,
        closingCr: expStmt.closingType === 'Cr' ? expStmt.closingBalance : 0
      });
    });

    const totalOpeningDr = rows.reduce((sum, r) => sum + r.openingDr, 0);
    const totalOpeningCr = rows.reduce((sum, r) => sum + r.openingCr, 0);
    const totalPeriodDr = rows.reduce((sum, r) => sum + r.periodDr, 0);
    const totalPeriodCr = rows.reduce((sum, r) => sum + r.periodCr, 0);
    const totalClosingDr = rows.reduce((sum, r) => sum + r.closingDr, 0);
    const totalClosingCr = rows.reduce((sum, r) => sum + r.closingCr, 0);

    return {
      rows,
      totals: {
        openingDr: totalOpeningDr,
        openingCr: totalOpeningCr,
        periodDr: totalPeriodDr,
        periodCr: totalPeriodCr,
        closingDr: totalClosingDr,
        closingCr: totalClosingCr,
        isBalanced: Math.abs(totalClosingDr - totalClosingCr) < 0.01
      }
    };
  },

  // --- PROFIT & LOSS COMPUTATION ---
  getProfitAndLoss(fromDate?: string, toDate?: string, companyId?: string) {
    const activeComp = companyId || DEFAULT_COMPANY_ID;
    const sales = this.getSales(activeComp).filter((s) => (!fromDate || s.date >= fromDate) && (!toDate || s.date <= toDate));
    const purchases = this.getPurchases(activeComp).filter((p) => (!fromDate || p.date >= fromDate) && (!toDate || p.date <= toDate));
    const expenses = this.getExpenses(activeComp).filter((e) => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate));
    const products = this.getProducts(activeComp);

    // Sales Revenue
    const grossSales = sales.reduce((sum, s) => sum + Number(s.subtotal || s.grandTotal || 0), 0);
    const totalDiscounts = sales.reduce((sum, s) => sum + Number(s.discount || 0), 0);
    const netRevenue = grossSales - totalDiscounts;

    // COGS = Opening Stock Value + Total Purchases - Closing Stock Value
    const openingStockVal = products.reduce((sum, p) => sum + (Number(p.openingStock || 0) * Number(p.costPrice || 0)), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.grandTotal || 0), 0);
    const closingStockVal = products.reduce((sum, p) => sum + (Number(p.currentStock || 0) * Number(p.costPrice || 0)), 0);
    const cogs = Math.max(0, openingStockVal + totalPurchases - closingStockVal);

    const grossProfit = netRevenue - cogs;

    // Expenses breakdown
    const expenseBreakdown: Record<string, number> = {};
    expenses.forEach((e) => {
      expenseBreakdown[e.category] = (expenseBreakdown[e.category] || 0) + Number(e.amount || 0);
    });

    const totalOperatingExpenses = Object.values(expenseBreakdown).reduce((sum, val) => sum + val, 0);
    const netProfit = grossProfit - totalOperatingExpenses;

    return {
      grossSales,
      totalDiscounts,
      netRevenue,
      openingStockVal,
      totalPurchases,
      closingStockVal,
      cogs,
      grossProfit,
      expenseBreakdown,
      totalOperatingExpenses,
      netProfit,
      isProfit: netProfit >= 0
    };
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
        remoteUsers,
        remotePdcs,
        remoteJournals
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
        SupabaseSyncService.fetchAllRemoteUsers(),
        SupabaseSyncService.fetchAllRemotePdcs(companyId),
        SupabaseSyncService.fetchAllRemoteJournalEntries(companyId)
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

      if (remotePdcs !== null) {
        _inMemoryPdcs = remotePdcs;
        pulledCounts.pdcs = remotePdcs.length;
      }

      if (remoteJournals !== null) {
        _inMemoryJournalEntries = remoteJournals;
        pulledCounts.journals = remoteJournals.length;
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
