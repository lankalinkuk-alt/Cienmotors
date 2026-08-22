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
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_RECEIPTS,
  INITIAL_PAYMENTS,
  INITIAL_EXPENSES,
  INITIAL_COMPANIES
} from './sampleData';
import { SupabaseSyncService } from './supabase';

const STORAGE_KEYS = {
  COMPANIES: 'busy_ufo_companies',
  SETTINGS: 'busy_ufo_settings',
  CUSTOMERS: 'busy_ufo_customers',
  SUPPLIERS: 'busy_ufo_suppliers',
  PRODUCTS: 'busy_ufo_products',
  SALES: 'busy_ufo_sales',
  PURCHASES: 'busy_ufo_purchases',
  RECEIPTS: 'busy_ufo_receipts',
  PAYMENTS: 'busy_ufo_payments',
  EXPENSES: 'busy_ufo_expenses',
  LEDGERS: 'busy_ufo_ledgers',
  OPENING_JOURNALS: 'busy_ufo_opening_journals',
  WAREHOUSES: 'busy_ufo_warehouses',
  IMPORT_HISTORY: 'busy_ufo_import_history',
  USERS: 'busy_ufo_users',
  DELETED_IDS: 'busy_ufo_deleted_ids',
  PENDING_SYNC: 'busy_ufo_pending_sync'
};

const DEFAULT_COMPANY_ID = 'comp-1';

function getDeletedIds(): Set<string> {
  const raw = getItem<string[]>(STORAGE_KEYS.DELETED_IDS, []);
  return new Set(Array.isArray(raw) ? raw : []);
}

function addDeletedId(id: string): void {
  if (!id) return;
  const set = getDeletedIds();
  if (!set.has(id)) {
    set.add(id);
    setItem(STORAGE_KEYS.DELETED_IDS, Array.from(set));
  }
}

function getPendingSyncIds(type: string): Set<string> {
  const raw = getItem<Record<string, string[]>>(STORAGE_KEYS.PENDING_SYNC, {});
  return new Set(Array.isArray(raw[type]) ? raw[type] : []);
}

function addPendingSyncId(type: string, id: string): void {
  if (!id) return;
  const raw = getItem<Record<string, string[]>>(STORAGE_KEYS.PENDING_SYNC, {});
  const list = Array.isArray(raw[type]) ? raw[type] : [];
  if (!list.includes(id)) {
    list.push(id);
    raw[type] = list;
    setItem(STORAGE_KEYS.PENDING_SYNC, raw);
  }
}

function removePendingSyncId(type: string, id: string): void {
  if (!id) return;
  const raw = getItem<Record<string, string[]>>(STORAGE_KEYS.PENDING_SYNC, {});
  if (Array.isArray(raw[type])) {
    raw[type] = raw[type].filter((item) => item !== id);
    setItem(STORAGE_KEYS.PENDING_SYNC, raw);
  }
}

// One-time purge of legacy demo records if detected
function purgeLegacyDemoData(): void {
  try {
    const rawComp = localStorage.getItem(STORAGE_KEYS.COMPANIES);
    if (rawComp && (rawComp.includes('comp-abc-traders') || rawComp.includes('ABC Traders'))) {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    // Ignore storage access errors in restricted iframe sandbox
  }
}
purgeLegacyDemoData();

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error loading key ${key}:`, e);
    return defaultValue;
  }
}

const syncBroadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ufo_cross_tab_sync') : null;

function setItem<T>(key: string, value: T, silent = false): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (!silent) {
      if (syncBroadcastChannel) {
        try {
          syncBroadcastChannel.postMessage({ key, timestamp: Date.now() });
        } catch {
          // Ignore BroadcastChannel errors in restricted contexts
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ufo_local_storage_change', { detail: { key } }));
      }
    }
  } catch (e) {
    console.error(`Error saving key ${key}:`, e);
  }
}

function dedupeItems<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return items;
  const seen = new Set<string>();
  const result: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || !item.id) {
      result.push(item);
      continue;
    }
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    } else {
      const uniqueId = `${item.id}-${i}-${Math.random().toString(36).substring(2, 6)}`;
      const fixedItem = { ...item, id: uniqueId };
      seen.add(uniqueId);
      result.push(fixedItem);
    }
  }
  return result;
}

export const StorageService = {
  // --- COMPANIES ---
  getCompanies(): Company[] {
    const stored = getItem<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
    if (!stored || stored.length === 0) {
      setItem(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
      return INITIAL_COMPANIES;
    }
    return stored;
  },

  getCompanyById(companyId: string): Company | null {
    const companies = this.getCompanies();
    return companies.find((c) => c.id === companyId) || null;
  },

  saveCompany(compData: Partial<Company>): Company {
    const companies = this.getCompanies();
    const now = new Date().toISOString();

    if (compData.id) {
      const index = companies.findIndex((c) => c.id === compData.id);
      if (index !== -1) {
        const updated: Company = {
          ...companies[index],
          ...compData,
          updatedAt: now
        } as Company;
        companies[index] = updated;
        setItem(STORAGE_KEYS.COMPANIES, companies);
        addPendingSyncId('companies', updated.id);
        SupabaseSyncService.syncCompany(updated).then((res) => {
          if (res?.success) removePendingSyncId('companies', updated.id);
        }).catch(() => {});
        return updated;
      }
    }

    const newCompany: Company = {
      id: compData.id || `comp-${Date.now()}`,
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
      financialYearStart: compData.financialYearStart || '2026-01-01',
      financialYearEnd: compData.financialYearEnd || '2026-12-31',
      invoicePrefix: compData.invoicePrefix?.trim() || 'INV',
      invoiceNumber: compData.invoiceNumber || 1001,
      isActive: compData.isActive !== undefined ? compData.isActive : true,
      isVatEnabled: compData.isVatEnabled !== undefined ? compData.isVatEnabled : true,
      vatNumber: compData.vatNumber?.trim() || compData.taxRegistrationNo?.trim() || '',
      defaultVatRate: compData.defaultVatRate !== undefined ? compData.defaultVatRate : 18,
      vatType: compData.vatType || 'EXCLUSIVE',
      isItemDiscountEnabled: compData.isItemDiscountEnabled !== undefined ? compData.isItemDiscountEnabled : true,
      defaultDiscountType: compData.defaultDiscountType || 'PERCENT',
      createdAt: now,
      updatedAt: now
    };

    companies.push(newCompany);
    setItem(STORAGE_KEYS.COMPANIES, companies);
    addPendingSyncId('companies', newCompany.id);
    SupabaseSyncService.syncCompany(newCompany).then((res) => {
      if (res?.success) removePendingSyncId('companies', newCompany.id);
    }).catch(() => {});
    return newCompany;
  },

  disableCompany(companyId: string, disable: boolean): void {
    const companies = this.getCompanies();
    const idx = companies.findIndex((c) => c.id === companyId);
    if (idx !== -1) {
      companies[idx].isActive = !disable;
      companies[idx].updatedAt = new Date().toISOString();
      setItem(STORAGE_KEYS.COMPANIES, companies);
      addPendingSyncId('companies', companies[idx].id);
      SupabaseSyncService.syncCompany(companies[idx]).then((res) => {
        if (res?.success) removePendingSyncId('companies', companies[idx].id);
      }).catch(() => {});
    }
  },
  // --- SETTINGS ---
  getSettings(): AppSettings {
    return getItem<AppSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  },

  saveSettings(settings: AppSettings): void {
    setItem(STORAGE_KEYS.SETTINGS, settings);
  },

  // --- CUSTOMERS ---
  getCustomers(companyId?: string): Customer[] {
    const raw = getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((c) => c && c.id && !deleted.has(c.id));
    if (!companyId) return all;
    return all.filter((c) => (c.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  saveCustomer(customer: Partial<Customer>, companyId?: string): Customer {
    const all = getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    const targetCompId = companyId || customer.companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    if (customer.id) {
      // Edit
      const index = all.findIndex((c) => c.id === customer.id);
      if (index !== -1) {
        const updated: Customer = {
          ...all[index],
          ...customer,
          companyId: targetCompId
        } as Customer;
        all[index] = updated;
        setItem(STORAGE_KEYS.CUSTOMERS, all);
        addPendingSyncId('customers', updated.id);
        SupabaseSyncService.syncCustomer(updated).then((res) => {
          if (res?.success) removePendingSyncId('customers', updated.id);
        }).catch(() => {});
        return updated;
      }
    }

    // Add
    const compCustomers = all.filter((c) => (c.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const codeCount = compCustomers.length + 1;
    const autoCode = `CUST-${String(codeCount).padStart(3, '0')}`;

    const newCust: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: targetCompId,
      code: customer.code?.trim() || autoCode,
      name: customer.name?.trim() || 'New Customer',
      companyName: customer.companyName?.trim() || customer.name?.trim() || '',
      phone: customer.phone?.trim() || customer.mobile?.trim() || '',
      mobile: customer.mobile?.trim() || customer.phone?.trim() || '',
      email: customer.email?.trim() || '',
      address: customer.address?.trim() || '',
      city: customer.city?.trim() || 'Colombo',
      accountGroup: customer.accountGroup?.trim() || 'Sundry Debtors',
      taxNumber: customer.taxNumber?.trim() || '',
      openingBalance: Number(customer.openingBalance || 0),
      openingBalanceType: customer.openingBalanceType || 'Dr',
      outstandingBalance: Number(customer.outstandingBalance !== undefined ? customer.outstandingBalance : (customer.openingBalance || 0)),
      createdAt: now
    };

    all.unshift(newCust);
    setItem(STORAGE_KEYS.CUSTOMERS, all);
    addPendingSyncId('customers', newCust.id);
    SupabaseSyncService.syncCustomer(newCust).then((res) => {
      if (res?.success) removePendingSyncId('customers', newCust.id);
    }).catch(() => {});
    return newCust;
  },

  deleteCustomer(id: string): void {
    addDeletedId(id);
    removePendingSyncId('customers', id);
    const all = getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS).filter((c) => c.id !== id);
    setItem(STORAGE_KEYS.CUSTOMERS, all);
    SupabaseSyncService.deleteCustomer(id).catch(() => {});
  },

  // --- SUPPLIERS ---
  getSuppliers(companyId?: string): Supplier[] {
    const raw = getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((s) => s && s.id && !deleted.has(s.id));
    if (!companyId) return all;
    return all.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  saveSupplier(supplier: Partial<Supplier>, companyId?: string): Supplier {
    const all = getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    const targetCompId = companyId || supplier.companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    if (supplier.id) {
      const index = all.findIndex((s) => s.id === supplier.id);
      if (index !== -1) {
        const updated: Supplier = {
          ...all[index],
          ...supplier,
          companyId: targetCompId
        } as Supplier;
        all[index] = updated;
        setItem(STORAGE_KEYS.SUPPLIERS, all);
        addPendingSyncId('suppliers', updated.id);
        SupabaseSyncService.syncSupplier(updated).then((res) => {
          if (res?.success) removePendingSyncId('suppliers', updated.id);
        }).catch(() => {});
        return updated;
      }
    }

    const compSuppliers = all.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const codeCount = compSuppliers.length + 1;
    const autoCode = `SUPP-${String(codeCount).padStart(3, '0')}`;

    const newSupp: Supplier = {
      id: `supp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: targetCompId,
      code: supplier.code?.trim() || autoCode,
      name: supplier.name?.trim() || 'New Supplier',
      companyName: supplier.companyName?.trim() || supplier.name?.trim() || '',
      phone: supplier.phone?.trim() || supplier.mobile?.trim() || '',
      mobile: supplier.mobile?.trim() || supplier.phone?.trim() || '',
      email: supplier.email?.trim() || '',
      address: supplier.address?.trim() || '',
      city: supplier.city?.trim() || 'Colombo',
      accountGroup: supplier.accountGroup?.trim() || 'Sundry Creditors',
      taxNumber: supplier.taxNumber?.trim() || '',
      openingBalance: Number(supplier.openingBalance || 0),
      openingBalanceType: supplier.openingBalanceType || 'Cr',
      payableBalance: Number(supplier.payableBalance !== undefined ? supplier.payableBalance : (supplier.openingBalance || 0)),
      createdAt: now
    };

    all.unshift(newSupp);
    setItem(STORAGE_KEYS.SUPPLIERS, all);
    addPendingSyncId('suppliers', newSupp.id);
    SupabaseSyncService.syncSupplier(newSupp).then((res) => {
      if (res?.success) removePendingSyncId('suppliers', newSupp.id);
    }).catch(() => {});
    return newSupp;
  },

  deleteSupplier(id: string): void {
    addDeletedId(id);
    removePendingSyncId('suppliers', id);
    const all = getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS).filter((s) => s.id !== id);
    setItem(STORAGE_KEYS.SUPPLIERS, all);
    SupabaseSyncService.deleteSupplier(id).catch(() => {});
  },

  // --- PRODUCTS ---
  getProducts(companyId?: string): Product[] {
    const raw = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((p) => p && p.id && !deleted.has(p.id));
    if (!companyId) return all;
    return all.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  // Duplicate Check
  validateProduct(code: string, name: string, excludeId?: string, companyId?: string): string | null {
    const products = this.getProducts(companyId);
    const cleanCode = code.trim().toLowerCase();
    const cleanName = name.trim().toLowerCase();

    const codeMatch = products.find(
      (p) => p.code.trim().toLowerCase() === cleanCode && p.id !== excludeId
    );
    if (codeMatch) {
      return `Product Code "${code}" is already in use by another product!`;
    }

    const nameMatch = products.find(
      (p) => p.name.trim().toLowerCase() === cleanName && p.id !== excludeId
    );
    if (nameMatch) {
      return `Product Name "${name}" already exists in the inventory!`;
    }

    return null;
  },

  saveProduct(product: Partial<Product>, companyId?: string): Product {
    const all = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const targetCompId = companyId || product.companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    if (product.id) {
      const index = all.findIndex((p) => p.id === product.id);
      if (index !== -1) {
        const updated: Product = {
          ...all[index],
          ...product,
          companyId: targetCompId
        } as Product;
        all[index] = updated;
        setItem(STORAGE_KEYS.PRODUCTS, all);
        addPendingSyncId('products', updated.id);
        SupabaseSyncService.syncProduct(updated).then((res) => {
          if (res?.success) removePendingSyncId('products', updated.id);
        }).catch(() => {});
        return updated;
      }
    }

    const compProducts = all.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const codeCount = compProducts.length + 1;
    const autoCode = `PROD-${String(codeCount).padStart(3, '0')}`;

    const newProd: Product = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      companyId: targetCompId,
      code: product.code?.trim() || autoCode,
      name: product.name?.trim() || 'New Product',
      category: product.category?.trim() || 'General',
      unit: product.unit || 'Nos',
      costPrice: Number(product.costPrice || 0),
      sellingPrice: Number(product.sellingPrice || 0),
      currentStock: Number(product.currentStock || 0),
      reorderLevel: Number(product.reorderLevel || 10),
      openingStock: product.openingStock !== undefined ? Number(product.openingStock) : undefined,
      openingRate: product.openingRate !== undefined ? Number(product.openingRate) : undefined,
      openingValue: product.openingValue !== undefined ? Number(product.openingValue) : undefined,
      excelStockValue: product.excelStockValue !== undefined ? Number(product.excelStockValue) : undefined,
      calculatedStockValue: product.calculatedStockValue !== undefined ? Number(product.calculatedStockValue) : undefined,
      valueDifference: product.valueDifference !== undefined ? Number(product.valueDifference) : undefined,
      importSource: product.importSource,
      importBatchId: product.importBatchId,
      warehouseId: product.warehouseId,
      warehouseName: product.warehouseName,
      createdAt: now
    };

    all.unshift(newProd);
    setItem(STORAGE_KEYS.PRODUCTS, all);
    addPendingSyncId('products', newProd.id);
    SupabaseSyncService.syncProduct(newProd).then((res) => {
      if (res?.success) removePendingSyncId('products', newProd.id);
    }).catch(() => {});
    return newProd;
  },

  deleteProduct(id: string): void {
    addDeletedId(id);
    removePendingSyncId('products', id);
    const all = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS).filter((p) => p.id !== id);
    setItem(STORAGE_KEYS.PRODUCTS, all);
    SupabaseSyncService.deleteProduct(id).catch(() => {});
  },

  // Recalculate and synchronize product currentStock based on Opening Stock + Total Purchases - Total Sales
  recalculateProductStock(companyId?: string): {
    updatedCount: number;
    details: Array<{
      id: string;
      code: string;
      name: string;
      openingStock: number;
      totalPurchased: number;
      totalSold: number;
      currentStock: number;
    }>;
  } {
    const allProducts = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    const allPurchases = getItem<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASES, INITIAL_PURCHASES);
    const allSales = getItem<SaleInvoice[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    const deletedIds = getDeletedIds();
    const settings = this.getSettings();

    const validPurchases = allPurchases.filter((p) => p && p.id && !deletedIds.has(p.id));
    const validSales = allSales.filter((s) => s && s.id && !deletedIds.has(s.id));

    const targetCompId = companyId || DEFAULT_COMPANY_ID;
    const details: Array<{
      id: string;
      code: string;
      name: string;
      openingStock: number;
      totalPurchased: number;
      totalSold: number;
      currentStock: number;
    }> = [];

    for (let i = 0; i < allProducts.length; i++) {
      const prod = allProducts[i];
      if (!prod || !prod.id || deletedIds.has(prod.id)) continue;
      if (companyId && (prod.companyId || DEFAULT_COMPANY_ID) !== targetCompId) continue;

      const prodCompId = prod.companyId || DEFAULT_COMPANY_ID;
      const cleanCode = (prod.code || '').trim().toLowerCase();
      const cleanName = (prod.name || '').trim().toLowerCase();

      // Total purchased for this product in the target company
      let totalPurchased = 0;
      for (const pu of validPurchases) {
        if ((pu.companyId || DEFAULT_COMPANY_ID) !== prodCompId) continue;
        for (const item of (pu.items || [])) {
          const matchId = Boolean(item.productId && item.productId === prod.id);
          const matchCode = Boolean(cleanCode && item.productCode && item.productCode.trim().toLowerCase() === cleanCode);
          const matchName = Boolean(cleanName && item.productName && item.productName.trim().toLowerCase() === cleanName);
          if (matchId || matchCode || matchName) {
            totalPurchased += Number(item.quantity || 0);
          }
        }
      }

      // Total sold for this product in the target company
      let totalSold = 0;
      for (const sa of validSales) {
        if ((sa.companyId || DEFAULT_COMPANY_ID) !== prodCompId) continue;
        for (const item of (sa.items || [])) {
          const matchId = Boolean(item.productId && item.productId === prod.id);
          const matchCode = Boolean(cleanCode && item.productCode && item.productCode.trim().toLowerCase() === cleanCode);
          const matchName = Boolean(cleanName && item.productName && item.productName.trim().toLowerCase() === cleanName);
          if (matchId || matchCode || matchName) {
            totalSold += Number(item.quantity || 0);
          }
        }
      }

      const opening = Number(
        prod.openingStock !== undefined && prod.openingStock !== null
          ? prod.openingStock
          : prod.currentStock !== undefined
          ? prod.currentStock
          : 0
      );

      // Ensure openingStock field is saved
      if (prod.openingStock === undefined || prod.openingStock === null) {
        prod.openingStock = opening;
      }

      const calculatedStock = opening + totalPurchased - totalSold;
      const finalStock = settings.allowNegativeStock ? calculatedStock : Math.max(0, calculatedStock);

      const hasChanged = prod.currentStock !== finalStock || prod.openingStock !== opening;

      if (hasChanged) {
        prod.currentStock = finalStock;
        prod.updatedAt = new Date().toISOString();
        addPendingSyncId('products', prod.id);
        SupabaseSyncService.syncProduct(prod).then((res) => {
          if (res?.success) removePendingSyncId('products', prod.id);
        }).catch(() => {});
      }

      details.push({
        id: prod.id,
        code: prod.code,
        name: prod.name,
        openingStock: opening,
        totalPurchased,
        totalSold,
        currentStock: finalStock
      });
    }

    setItem(STORAGE_KEYS.PRODUCTS, allProducts);
    return { updatedCount: details.length, details };
  },

  // --- SALES & INVOICES ---
  getSales(companyId?: string): SaleInvoice[] {
    const raw = getItem<SaleInvoice[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((s) => s && s.id && !deleted.has(s.id));
    if (!companyId) return all;
    return all.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  createSaleInvoice(
    invoiceData: Omit<SaleInvoice, 'id' | 'invoiceNumber' | 'createdAt'>,
    companyId?: string
  ): SaleInvoice {
    const sales = this.getSales();
    const targetCompId = invoiceData.companyId || companyId || DEFAULT_COMPANY_ID;
    const products = this.getProducts();
    const customers = this.getCustomers();
    const settings = this.getSettings();

    // 1. Stock Check if negative stock disabled
    if (!settings.allowNegativeStock) {
      for (const item of invoiceData.items) {
        const prod = products.find(
          (p) =>
            (p.id === item.productId || p.code === item.productCode) &&
            (p.companyId || DEFAULT_COMPANY_ID) === targetCompId
        );
        if (prod) {
          if (prod.currentStock < item.quantity) {
            throw new Error(
              `Insufficient stock for "${prod.name}". Available: ${prod.currentStock}, Requested: ${item.quantity}. Enable 'Allow Negative Stock' in Settings to override.`
            );
          }
        }
      }
    }

    // 2. Generate Invoice Number for this company
    const compSales = sales.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compSales.length + 1;
    const invNumber = `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newInvoice: SaleInvoice = {
      ...invoiceData,
      companyId: targetCompId,
      id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      invoiceNumber: invNumber,
      createdAt: new Date().toISOString()
    };

    // 3. Reduce Product Stock
    for (const item of invoiceData.items) {
      let pIndex = -1;
      if (item.productId) {
        pIndex = products.findIndex((p) => p.id === item.productId);
      }
      if (pIndex === -1 && item.productCode) {
        const cleanCode = item.productCode.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
      }
      if (pIndex === -1 && item.productName) {
        const cleanName = item.productName.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
      }

      if (pIndex !== -1) {
        products[pIndex].currentStock = Math.max(0, Number(products[pIndex].currentStock || 0) - Number(item.quantity || 0));
        products[pIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('products', products[pIndex].id);
        SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
          if (res?.success) removePendingSyncId('products', products[pIndex].id);
        }).catch(() => {});
      }
    }
    setItem(STORAGE_KEYS.PRODUCTS, products);

    // 4. Update Customer Outstanding if credit or remaining due
    if (invoiceData.customerId && invoiceData.dueAmount > 0) {
      const cIndex = customers.findIndex(
        (c) => c.id === invoiceData.customerId && (c.companyId || DEFAULT_COMPANY_ID) === targetCompId
      );
      if (cIndex !== -1) {
        customers[cIndex].outstandingBalance = Number(customers[cIndex].outstandingBalance || 0) + Number(invoiceData.dueAmount);
        customers[cIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('customers', customers[cIndex].id);
        SupabaseSyncService.syncCustomer(customers[cIndex]).then((res) => {
          if (res?.success) removePendingSyncId('customers', customers[cIndex].id);
        }).catch(() => {});
        setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    // 5. Save Sales
    sales.unshift(newInvoice);
    setItem(STORAGE_KEYS.SALES, sales);
    addPendingSyncId('sales', newInvoice.id);
    SupabaseSyncService.syncSaleInvoice(newInvoice).then((res) => {
      if (res?.success) removePendingSyncId('sales', newInvoice.id);
    }).catch(() => {});

    return newInvoice;
  },

  updateSaleInvoice(
    id: string,
    invoiceData: Partial<SaleInvoice>,
    companyId?: string
  ): SaleInvoice {
    const sales = getItem<SaleInvoice[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    const products = this.getProducts();
    const customers = this.getCustomers();
    const settings = this.getSettings();

    const targetIndex = sales.findIndex((s) => s.id === id);
    if (targetIndex === -1) {
      throw new Error('Sale invoice not found.');
    }

    const oldSale = sales[targetIndex];
    const targetCompId = oldSale.companyId || companyId || DEFAULT_COMPANY_ID;

    // 1. Revert old stock reductions
    for (const oldItem of oldSale.items) {
      let pIndex = -1;
      if (oldItem.productId) {
        pIndex = products.findIndex((p) => p.id === oldItem.productId);
      }
      if (pIndex === -1 && oldItem.productCode) {
        const cleanCode = oldItem.productCode.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
      }
      if (pIndex === -1 && oldItem.productName) {
        const cleanName = oldItem.productName.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName);
      }

      if (pIndex !== -1) {
        products[pIndex].currentStock = Number(products[pIndex].currentStock || 0) + Number(oldItem.quantity || 0);
        products[pIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('products', products[pIndex].id);
        SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
          if (res?.success) removePendingSyncId('products', products[pIndex].id);
        }).catch(() => {});
      }
    }

    // 2. Revert old customer outstanding
    if (oldSale.customerId && oldSale.dueAmount > 0) {
      const cIndex = customers.findIndex((c) => c.id === oldSale.customerId);
      if (cIndex !== -1) {
        customers[cIndex].outstandingBalance = Math.max(
          0,
          Number(customers[cIndex].outstandingBalance || 0) - Number(oldSale.dueAmount)
        );
        customers[cIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('customers', customers[cIndex].id);
        SupabaseSyncService.syncCustomer(customers[cIndex]).then((res) => {
          if (res?.success) removePendingSyncId('customers', customers[cIndex].id);
        }).catch(() => {});
        setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    // 3. Stock check for new items if negative stock is disallowed
    const newItems = invoiceData.items || oldSale.items;
    if (!settings.allowNegativeStock) {
      for (const item of newItems) {
        let prod = products.find((p) => p.id === item.productId);
        if (!prod && item.productCode) {
          const cleanCode = item.productCode.trim().toLowerCase();
          prod = products.find((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        }
        if (!prod && item.productName) {
          const cleanName = item.productName.trim().toLowerCase();
          prod = products.find((p) => p.name?.trim().toLowerCase() === cleanName && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        }
        if (prod && prod.currentStock < item.quantity) {
          throw new Error(
            `Cannot save sale. Insufficient stock for "${prod.name}". Available: ${prod.currentStock}, Requested: ${item.quantity}.`
          );
        }
      }
    }

    // 4. Apply new stock reductions
    for (const newItem of newItems) {
      let pIndex = -1;
      if (newItem.productId) {
        pIndex = products.findIndex((p) => p.id === newItem.productId);
      }
      if (pIndex === -1 && newItem.productCode) {
        const cleanCode = newItem.productCode.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
      }
      if (pIndex === -1 && newItem.productName) {
        const cleanName = newItem.productName.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName);
      }

      if (pIndex !== -1) {
        products[pIndex].currentStock = Math.max(0, Number(products[pIndex].currentStock || 0) - Number(newItem.quantity || 0));
        products[pIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('products', products[pIndex].id);
        SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
          if (res?.success) removePendingSyncId('products', products[pIndex].id);
        }).catch(() => {});
      }
    }
    setItem(STORAGE_KEYS.PRODUCTS, products);

    // 5. Apply new customer outstanding
    const newCustomerId = invoiceData.customerId !== undefined ? invoiceData.customerId : oldSale.customerId;
    const newDueAmount = invoiceData.dueAmount !== undefined ? invoiceData.dueAmount : oldSale.dueAmount;

    if (newCustomerId && Number(newDueAmount) > 0) {
      const cIndex = customers.findIndex(
        (c) => c.id === newCustomerId && (c.companyId || DEFAULT_COMPANY_ID) === targetCompId
      );
      if (cIndex !== -1) {
        customers[cIndex].outstandingBalance = Number(customers[cIndex].outstandingBalance || 0) + Number(newDueAmount);
        customers[cIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('customers', customers[cIndex].id);
        SupabaseSyncService.syncCustomer(customers[cIndex]).then((res) => {
          if (res?.success) removePendingSyncId('customers', customers[cIndex].id);
        }).catch(() => {});
        setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    // 6. Update sale record
    const updatedSale: SaleInvoice = {
      ...oldSale,
      ...invoiceData,
      items: newItems,
      companyId: targetCompId,
      id: oldSale.id,
      invoiceNumber: oldSale.invoiceNumber,
      createdAt: oldSale.createdAt,
      updatedAt: new Date().toISOString()
    };

    sales[targetIndex] = updatedSale;
    setItem(STORAGE_KEYS.SALES, sales);
    addPendingSyncId('sales', updatedSale.id);
    SupabaseSyncService.syncSaleInvoice(updatedSale).then((res) => {
      if (res?.success) removePendingSyncId('sales', updatedSale.id);
    }).catch(() => {});

    return updatedSale;
  },

  deleteSaleInvoice(id: string): void {
    addDeletedId(id);
    removePendingSyncId('sales', id);
    const sales = getItem<SaleInvoice[]>(STORAGE_KEYS.SALES, INITIAL_SALES);
    const products = this.getProducts();
    const customers = this.getCustomers();

    const targetIndex = sales.findIndex((s) => s.id === id);
    if (targetIndex !== -1) {
      const target = sales[targetIndex];

      // Restore stock
      for (const item of target.items) {
        let pIndex = -1;
        if (item.productId) {
          pIndex = products.findIndex((p) => p.id === item.productId);
        }
        if (pIndex === -1 && item.productCode) {
          const cleanCode = item.productCode.trim().toLowerCase();
          pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === (target.companyId || DEFAULT_COMPANY_ID));
          if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
        }
        if (pIndex !== -1) {
          products[pIndex].currentStock = Number(products[pIndex].currentStock || 0) + Number(item.quantity || 0);
          products[pIndex].updatedAt = new Date().toISOString();
          addPendingSyncId('products', products[pIndex].id);
          SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
            if (res?.success) removePendingSyncId('products', products[pIndex].id);
          }).catch(() => {});
        }
      }
      setItem(STORAGE_KEYS.PRODUCTS, products);

      // Revert Customer Outstanding
      if (target.customerId && target.dueAmount > 0) {
        const cIndex = customers.findIndex((c) => c.id === target.customerId);
        if (cIndex !== -1) {
          customers[cIndex].outstandingBalance = Math.max(
            0,
            Number(customers[cIndex].outstandingBalance || 0) - Number(target.dueAmount)
          );
          customers[cIndex].updatedAt = new Date().toISOString();
          addPendingSyncId('customers', customers[cIndex].id);
          SupabaseSyncService.syncCustomer(customers[cIndex]).then((res) => {
            if (res?.success) removePendingSyncId('customers', customers[cIndex].id);
          }).catch(() => {});
          setItem(STORAGE_KEYS.CUSTOMERS, customers);
        }
      }

      sales.splice(targetIndex, 1);
    }

    const cleanSales = sales.filter((s) => s.id !== id);
    setItem(STORAGE_KEYS.SALES, cleanSales);
    SupabaseSyncService.deleteSaleInvoice(id).catch(() => {});
  },

  // --- PURCHASES ---
  getPurchases(companyId?: string): PurchaseInvoice[] {
    const raw = getItem<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASES, INITIAL_PURCHASES);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((p) => p && p.id && !deleted.has(p.id));
    if (!companyId) return all;
    return all.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  createPurchaseInvoice(
    purchaseData: Omit<PurchaseInvoice, 'id' | 'purchaseNumber' | 'createdAt'>,
    companyId?: string
  ): PurchaseInvoice {
    const purchases = this.getPurchases();
    const targetCompId = purchaseData.companyId || companyId || DEFAULT_COMPANY_ID;
    const products = this.getProducts();
    const suppliers = this.getSuppliers();

    // 1. Generate Purchase Number for target company
    const compPurchases = purchases.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compPurchases.length + 1;
    const purNumber = `PUR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newPurchase: PurchaseInvoice = {
      ...purchaseData,
      companyId: targetCompId,
      id: `pur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      purchaseNumber: purNumber,
      createdAt: new Date().toISOString()
    };

    // 2. Increase Product Stock
    for (const item of purchaseData.items) {
      let pIndex = -1;
      if (item.productId) {
        pIndex = products.findIndex((p) => p.id === item.productId);
      }
      if (pIndex === -1 && item.productCode) {
        const cleanCode = item.productCode.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
      }
      if (pIndex === -1 && item.productName) {
        const cleanName = item.productName.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName);
      }

      if (pIndex !== -1) {
        products[pIndex].currentStock = Number(products[pIndex].currentStock || 0) + Number(item.quantity || 0);
        // Update cost price if provided
        if (Number(item.unitCost) > 0) {
          products[pIndex].costPrice = Number(item.unitCost);
        }
        products[pIndex].updatedAt = new Date().toISOString();
        item.productId = products[pIndex].id;
        item.productCode = products[pIndex].code;
        item.productName = products[pIndex].name;
        addPendingSyncId('products', products[pIndex].id);
        SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
          if (res?.success) removePendingSyncId('products', products[pIndex].id);
        }).catch(() => {});
      } else if (item.productName || item.productCode) {
        // Auto-create product if it did not exist
        const newAutoProd: Product = {
          id: item.productId || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          companyId: targetCompId,
          code: item.productCode || `PROD-${String(products.length + 1).padStart(3, '0')}`,
          name: item.productName || 'New Product',
          category: 'General',
          unit: item.unit || 'Nos',
          costPrice: Number(item.unitCost || 0),
          sellingPrice: Number(item.unitCost || 0) > 0 ? Number(item.unitCost || 0) * 1.2 : 0,
          currentStock: Number(item.quantity || 0),
          reorderLevel: 10,
          openingStock: 0,
          openingRate: Number(item.unitCost || 0),
          openingValue: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        products.push(newAutoProd);
        item.productId = newAutoProd.id;
        item.productCode = newAutoProd.code;
        item.productName = newAutoProd.name;
        addPendingSyncId('products', newAutoProd.id);
        SupabaseSyncService.syncProduct(newAutoProd).then((res) => {
          if (res?.success) removePendingSyncId('products', newAutoProd.id);
        }).catch(() => {});
      }
    }
    setItem(STORAGE_KEYS.PRODUCTS, products);

    // 3. Update Supplier Payable
    if (purchaseData.supplierId && purchaseData.dueAmount > 0) {
      const sIndex = suppliers.findIndex(
        (s) => s.id === purchaseData.supplierId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId
      );
      if (sIndex !== -1) {
        suppliers[sIndex].payableBalance = Number(suppliers[sIndex].payableBalance || 0) + Number(purchaseData.dueAmount);
        suppliers[sIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('suppliers', suppliers[sIndex].id);
        SupabaseSyncService.syncSupplier(suppliers[sIndex]).then((res) => {
          if (res?.success) removePendingSyncId('suppliers', suppliers[sIndex].id);
        }).catch(() => {});
        setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
      }
    }

    purchases.unshift(newPurchase);
    setItem(STORAGE_KEYS.PURCHASES, purchases);
    addPendingSyncId('purchases', newPurchase.id);
    SupabaseSyncService.syncPurchaseInvoice(newPurchase).then((res) => {
      if (res?.success) removePendingSyncId('purchases', newPurchase.id);
    }).catch(() => {});

    return newPurchase;
  },

  updatePurchaseInvoice(
    id: string,
    purchaseData: Partial<PurchaseInvoice>,
    companyId?: string
  ): PurchaseInvoice {
    const purchases = getItem<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASES, INITIAL_PURCHASES);
    const products = this.getProducts();
    const suppliers = this.getSuppliers();

    const targetIndex = purchases.findIndex((p) => p.id === id);
    if (targetIndex === -1) {
      throw new Error('Purchase invoice not found.');
    }

    const oldPurchase = purchases[targetIndex];
    const targetCompId = oldPurchase.companyId || companyId || DEFAULT_COMPANY_ID;

    // 1. Revert old stock additions
    for (const oldItem of oldPurchase.items) {
      let pIndex = -1;
      if (oldItem.productId) {
        pIndex = products.findIndex((p) => p.id === oldItem.productId);
      }
      if (pIndex === -1 && oldItem.productCode) {
        const cleanCode = oldItem.productCode.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
      }
      if (pIndex === -1 && oldItem.productName) {
        const cleanName = oldItem.productName.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName);
      }

      if (pIndex !== -1) {
        products[pIndex].currentStock = Math.max(0, Number(products[pIndex].currentStock || 0) - Number(oldItem.quantity || 0));
        products[pIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('products', products[pIndex].id);
        SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
          if (res?.success) removePendingSyncId('products', products[pIndex].id);
        }).catch(() => {});
      }
    }

    // 2. Revert old supplier payable
    if (oldPurchase.supplierId && oldPurchase.dueAmount > 0) {
      const sIndex = suppliers.findIndex(
        (s) => s.id === oldPurchase.supplierId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId
      );
      if (sIndex !== -1) {
        suppliers[sIndex].payableBalance = Math.max(
          0,
          Number(suppliers[sIndex].payableBalance || 0) - Number(oldPurchase.dueAmount)
        );
        suppliers[sIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('suppliers', suppliers[sIndex].id);
        SupabaseSyncService.syncSupplier(suppliers[sIndex]).then((res) => {
          if (res?.success) removePendingSyncId('suppliers', suppliers[sIndex].id);
        }).catch(() => {});
      }
    }

    // 3. Apply new stock additions
    const newItems = purchaseData.items || oldPurchase.items;
    for (const newItem of newItems) {
      let pIndex = -1;
      if (newItem.productId) {
        pIndex = products.findIndex((p) => p.id === newItem.productId);
      }
      if (pIndex === -1 && newItem.productCode) {
        const cleanCode = newItem.productCode.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
      }
      if (pIndex === -1 && newItem.productName) {
        const cleanName = newItem.productName.trim().toLowerCase();
        pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
        if (pIndex === -1) pIndex = products.findIndex((p) => p.name?.trim().toLowerCase() === cleanName);
      }

      if (pIndex !== -1) {
        products[pIndex].currentStock = Number(products[pIndex].currentStock || 0) + Number(newItem.quantity || 0);
        if (Number(newItem.unitCost) > 0) {
          products[pIndex].costPrice = Number(newItem.unitCost);
        }
        products[pIndex].updatedAt = new Date().toISOString();
        newItem.productId = products[pIndex].id;
        newItem.productCode = products[pIndex].code;
        newItem.productName = products[pIndex].name;
        addPendingSyncId('products', products[pIndex].id);
        SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
          if (res?.success) removePendingSyncId('products', products[pIndex].id);
        }).catch(() => {});
      } else if (newItem.productName || newItem.productCode) {
        // Auto-create product if new
        const newAutoProd: Product = {
          id: newItem.productId || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          companyId: targetCompId,
          code: newItem.productCode || `PROD-${String(products.length + 1).padStart(3, '0')}`,
          name: newItem.productName || 'New Product',
          category: 'General',
          unit: newItem.unit || 'Nos',
          costPrice: Number(newItem.unitCost || 0),
          sellingPrice: Number(newItem.unitCost || 0) > 0 ? Number(newItem.unitCost || 0) * 1.2 : 0,
          currentStock: Number(newItem.quantity || 0),
          reorderLevel: 10,
          openingStock: 0,
          openingRate: Number(newItem.unitCost || 0),
          openingValue: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        products.push(newAutoProd);
        newItem.productId = newAutoProd.id;
        newItem.productCode = newAutoProd.code;
        newItem.productName = newAutoProd.name;
        addPendingSyncId('products', newAutoProd.id);
        SupabaseSyncService.syncProduct(newAutoProd).then((res) => {
          if (res?.success) removePendingSyncId('products', newAutoProd.id);
        }).catch(() => {});
      }
    }
    setItem(STORAGE_KEYS.PRODUCTS, products);

    // 4. Apply new supplier payable
    const newSupplierId = purchaseData.supplierId !== undefined ? purchaseData.supplierId : oldPurchase.supplierId;
    const newDueAmount = purchaseData.dueAmount !== undefined ? purchaseData.dueAmount : oldPurchase.dueAmount;

    if (newSupplierId && Number(newDueAmount) > 0) {
      const sIndex = suppliers.findIndex(
        (s) => s.id === newSupplierId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId
      );
      if (sIndex !== -1) {
        suppliers[sIndex].payableBalance = Number(suppliers[sIndex].payableBalance || 0) + Number(newDueAmount);
        suppliers[sIndex].updatedAt = new Date().toISOString();
        addPendingSyncId('suppliers', suppliers[sIndex].id);
        SupabaseSyncService.syncSupplier(suppliers[sIndex]).then((res) => {
          if (res?.success) removePendingSyncId('suppliers', suppliers[sIndex].id);
        }).catch(() => {});
      }
    }
    setItem(STORAGE_KEYS.SUPPLIERS, suppliers);

    // 5. Update purchase record
    const updatedPurchase: PurchaseInvoice = {
      ...oldPurchase,
      ...purchaseData,
      items: newItems,
      id: oldPurchase.id,
      purchaseNumber: oldPurchase.purchaseNumber,
      companyId: targetCompId,
      updatedAt: new Date().toISOString()
    };

    purchases[targetIndex] = updatedPurchase;
    setItem(STORAGE_KEYS.PURCHASES, purchases);

    addPendingSyncId('purchases', updatedPurchase.id);
    SupabaseSyncService.syncPurchaseInvoice(updatedPurchase).then((res) => {
      if (res?.success) removePendingSyncId('purchases', updatedPurchase.id);
    }).catch(() => {});

    return updatedPurchase;
  },

  deletePurchaseInvoice(id: string): void {
    addDeletedId(id);
    removePendingSyncId('purchases', id);
    const purchases = getItem<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASES, INITIAL_PURCHASES);
    const products = this.getProducts();
    const suppliers = this.getSuppliers();

    const targetIndex = purchases.findIndex((p) => p.id === id);
    if (targetIndex !== -1) {
      const target = purchases[targetIndex];

      // Revert stock (subtract added stock)
      for (const item of target.items) {
        let pIndex = -1;
        if (item.productId) {
          pIndex = products.findIndex((p) => p.id === item.productId);
        }
        if (pIndex === -1 && item.productCode) {
          const cleanCode = item.productCode.trim().toLowerCase();
          pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode && (p.companyId || DEFAULT_COMPANY_ID) === (target.companyId || DEFAULT_COMPANY_ID));
          if (pIndex === -1) pIndex = products.findIndex((p) => p.code?.trim().toLowerCase() === cleanCode);
        }
        if (pIndex !== -1) {
          products[pIndex].currentStock = Math.max(0, Number(products[pIndex].currentStock || 0) - Number(item.quantity || 0));
          products[pIndex].updatedAt = new Date().toISOString();
          addPendingSyncId('products', products[pIndex].id);
          SupabaseSyncService.syncProduct(products[pIndex]).then((res) => {
            if (res?.success) removePendingSyncId('products', products[pIndex].id);
          }).catch(() => {});
        }
      }
      setItem(STORAGE_KEYS.PRODUCTS, products);

      // Revert Supplier Payable
      if (target.supplierId && target.dueAmount > 0) {
        const sIndex = suppliers.findIndex((s) => s.id === target.supplierId);
        if (sIndex !== -1) {
          suppliers[sIndex].payableBalance = Math.max(
            0,
            Number(suppliers[sIndex].payableBalance || 0) - Number(target.dueAmount)
          );
          suppliers[sIndex].updatedAt = new Date().toISOString();
          addPendingSyncId('suppliers', suppliers[sIndex].id);
          SupabaseSyncService.syncSupplier(suppliers[sIndex]).then((res) => {
            if (res?.success) removePendingSyncId('suppliers', suppliers[sIndex].id);
          }).catch(() => {});
          setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
        }
      }

      purchases.splice(targetIndex, 1);
    }

    const cleanPurchases = purchases.filter((p) => p.id !== id);
    setItem(STORAGE_KEYS.PURCHASES, cleanPurchases);
    SupabaseSyncService.deletePurchaseInvoice(id).catch(() => {});
  },

  // --- CUSTOMER RECEIPTS ---
  getReceipts(companyId?: string): CustomerReceipt[] {
    const raw = getItem<CustomerReceipt[]>(STORAGE_KEYS.RECEIPTS, INITIAL_RECEIPTS);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((r) => r && r.id && !deleted.has(r.id));
    if (!companyId) return all;
    return all.filter((r) => (r.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  createCustomerReceipt(
    receiptData: Omit<CustomerReceipt, 'id' | 'receiptNumber' | 'createdAt'>,
    companyId?: string
  ): CustomerReceipt {
    const receipts = this.getReceipts();
    const targetCompId = receiptData.companyId || companyId || DEFAULT_COMPANY_ID;
    const customers = this.getCustomers();
    const sales = this.getSales();

    const compReceipts = receipts.filter((r) => (r.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compReceipts.length + 1;
    const recNumber = `REC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newReceipt: CustomerReceipt = {
      ...receiptData,
      companyId: targetCompId,
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      receiptNumber: recNumber,
      createdAt: new Date().toISOString()
    };

    // 1. Reduce Customer Outstanding
    const cIndex = customers.findIndex(
      (c) => c.id === receiptData.customerId && (c.companyId || DEFAULT_COMPANY_ID) === targetCompId
    );
    if (cIndex !== -1) {
      customers[cIndex].outstandingBalance = Math.max(
        0,
        customers[cIndex].outstandingBalance - Number(receiptData.amount)
      );
      setItem(STORAGE_KEYS.CUSTOMERS, customers);
    }

    // 2. Adjust specific allocated Sales Invoices if provided
    if (receiptData.allocations && receiptData.allocations.length > 0) {
      for (const alloc of receiptData.allocations) {
        if (alloc.allocatedAmount > 0) {
          const sIndex = sales.findIndex(
            (s) => s.id === alloc.invoiceId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId
          );
          if (sIndex !== -1) {
            sales[sIndex].paidAmount = Number((sales[sIndex].paidAmount + alloc.allocatedAmount).toFixed(2));
            sales[sIndex].dueAmount = Math.max(0, Number((sales[sIndex].grandTotal - sales[sIndex].paidAmount).toFixed(2)));
          }
        }
      }
      setItem(STORAGE_KEYS.SALES, sales);
    }

    receipts.unshift(newReceipt);
    setItem(STORAGE_KEYS.RECEIPTS, receipts);
    addPendingSyncId('receipts', newReceipt.id);
    SupabaseSyncService.syncReceipt(newReceipt).then((res) => {
      if (res?.success) removePendingSyncId('receipts', newReceipt.id);
    }).catch(() => {});

    return newReceipt;
  },

  deleteCustomerReceipt(id: string): void {
    addDeletedId(id);
    removePendingSyncId('receipts', id);
    const receipts = getItem<CustomerReceipt[]>(STORAGE_KEYS.RECEIPTS, INITIAL_RECEIPTS);
    const customers = this.getCustomers();
    const sales = this.getSales();

    const targetIndex = receipts.findIndex((r) => r.id === id);
    if (targetIndex !== -1) {
      const target = receipts[targetIndex];

      // Revert Customer Outstanding (add back received amount)
      const cIndex = customers.findIndex((c) => c.id === target.customerId);
      if (cIndex !== -1) {
        customers[cIndex].outstandingBalance += Number(target.amount);
        setItem(STORAGE_KEYS.CUSTOMERS, customers);
      }

      // Revert invoice allocations
      if (target.allocations && target.allocations.length > 0) {
        for (const alloc of target.allocations) {
          if (alloc.allocatedAmount > 0) {
            const sIndex = sales.findIndex((s) => s.id === alloc.invoiceId);
            if (sIndex !== -1) {
              sales[sIndex].paidAmount = Math.max(0, Number((sales[sIndex].paidAmount - alloc.allocatedAmount).toFixed(2)));
              sales[sIndex].dueAmount = Math.max(0, Number((sales[sIndex].grandTotal - sales[sIndex].paidAmount).toFixed(2)));
            }
          }
        }
        setItem(STORAGE_KEYS.SALES, sales);
      }

      receipts.splice(targetIndex, 1);
    }

    const cleanReceipts = receipts.filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.RECEIPTS, cleanReceipts);
    SupabaseSyncService.deleteReceipt(id).catch(() => {});
  },

  // --- SUPPLIER PAYMENTS ---
  getPayments(companyId?: string): SupplierPayment[] {
    const raw = getItem<SupplierPayment[]>(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((p) => p && p.id && !deleted.has(p.id));
    if (!companyId) return all;
    return all.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  createSupplierPayment(
    paymentData: Omit<SupplierPayment, 'id' | 'paymentNumber' | 'createdAt'>,
    companyId?: string
  ): SupplierPayment {
    const payments = this.getPayments();
    const targetCompId = paymentData.companyId || companyId || DEFAULT_COMPANY_ID;
    const suppliers = this.getSuppliers();
    const purchases = this.getPurchases();

    const compPayments = payments.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compPayments.length + 1;
    const payNumber = `PAY-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newPayment: SupplierPayment = {
      ...paymentData,
      companyId: targetCompId,
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      paymentNumber: payNumber,
      createdAt: new Date().toISOString()
    };

    // 1. Reduce Supplier Payable
    const sIndex = suppliers.findIndex(
      (s) => s.id === paymentData.supplierId && (s.companyId || DEFAULT_COMPANY_ID) === targetCompId
    );
    if (sIndex !== -1) {
      suppliers[sIndex].payableBalance = Math.max(
        0,
        suppliers[sIndex].payableBalance - Number(paymentData.amount)
      );
      setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
    }

    // 2. Adjust specific allocated Purchase Bills if provided
    if (paymentData.allocations && paymentData.allocations.length > 0) {
      for (const alloc of paymentData.allocations) {
        if (alloc.allocatedAmount > 0) {
          const pIndex = purchases.findIndex(
            (p) => p.id === alloc.purchaseId && (p.companyId || DEFAULT_COMPANY_ID) === targetCompId
          );
          if (pIndex !== -1) {
            purchases[pIndex].paidAmount = Number((purchases[pIndex].paidAmount + alloc.allocatedAmount).toFixed(2));
            purchases[pIndex].dueAmount = Math.max(0, Number((purchases[pIndex].grandTotal - purchases[pIndex].paidAmount).toFixed(2)));
          }
        }
      }
      setItem(STORAGE_KEYS.PURCHASES, purchases);
    }

    payments.unshift(newPayment);
    setItem(STORAGE_KEYS.PAYMENTS, payments);
    addPendingSyncId('payments', newPayment.id);
    SupabaseSyncService.syncPayment(newPayment).then((res) => {
      if (res?.success) removePendingSyncId('payments', newPayment.id);
    }).catch(() => {});

    return newPayment;
  },

  deleteSupplierPayment(id: string): void {
    addDeletedId(id);
    removePendingSyncId('payments', id);
    const payments = getItem<SupplierPayment[]>(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
    const suppliers = this.getSuppliers();
    const purchases = this.getPurchases();

    const targetIndex = payments.findIndex((p) => p.id === id);
    if (targetIndex !== -1) {
      const target = payments[targetIndex];

      // Revert Supplier Payable (add back paid amount)
      const sIndex = suppliers.findIndex((s) => s.id === target.supplierId);
      if (sIndex !== -1) {
        suppliers[sIndex].payableBalance += Number(target.amount);
        setItem(STORAGE_KEYS.SUPPLIERS, suppliers);
      }

      // Revert purchase bill allocations
      if (target.allocations && target.allocations.length > 0) {
        for (const alloc of target.allocations) {
          if (alloc.allocatedAmount > 0) {
            const pIndex = purchases.findIndex((p) => p.id === alloc.purchaseId);
            if (pIndex !== -1) {
              purchases[pIndex].paidAmount = Math.max(0, Number((purchases[pIndex].paidAmount - alloc.allocatedAmount).toFixed(2)));
              purchases[pIndex].dueAmount = Math.max(0, Number((purchases[pIndex].grandTotal - purchases[pIndex].paidAmount).toFixed(2)));
            }
          }
        }
        setItem(STORAGE_KEYS.PURCHASES, purchases);
      }

      payments.splice(targetIndex, 1);
    }

    const cleanPayments = payments.filter((p) => p.id !== id);
    setItem(STORAGE_KEYS.PAYMENTS, cleanPayments);
    SupabaseSyncService.deletePayment(id).catch(() => {});
  },

  // --- EXPENSES ---
  getExpenses(companyId?: string): Expense[] {
    const raw = getItem<Expense[]>(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
    const deleted = getDeletedIds();
    const all = dedupeItems(raw).filter((e) => e && e.id && !deleted.has(e.id));
    if (!companyId) return all;
    return all.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  createExpense(
    expenseData: Omit<Expense, 'id' | 'expenseNumber' | 'createdAt'>,
    companyId?: string
  ): Expense {
    const expenses = this.getExpenses();
    const targetCompId = expenseData.companyId || companyId || DEFAULT_COMPANY_ID;

    const compExpenses = expenses.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    const count = compExpenses.length + 1;
    const expNumber = `EXP-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const newExpense: Expense = {
      ...expenseData,
      companyId: targetCompId,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      expenseNumber: expNumber,
      createdAt: new Date().toISOString()
    };

    expenses.unshift(newExpense);
    setItem(STORAGE_KEYS.EXPENSES, expenses);
    addPendingSyncId('expenses', newExpense.id);
    SupabaseSyncService.syncExpense(newExpense).then((res) => {
      if (res?.success) removePendingSyncId('expenses', newExpense.id);
    }).catch(() => {});

    return newExpense;
  },

  deleteExpense(id: string): void {
    addDeletedId(id);
    removePendingSyncId('expenses', id);
    const expenses = getItem<Expense[]>(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
    const cleanExpenses = expenses.filter((e) => e.id !== id);
    setItem(STORAGE_KEYS.EXPENSES, cleanExpenses);
    SupabaseSyncService.deleteExpense(id).catch(() => {});
  },

  // --- CASH BALANCE & DASHBOARD STATS ---
  calculateCashBalance(companyId?: string): number {
    const settings = this.getSettings();
    let balance = Number(settings.initialCashBalance || 0);

    // Add Cash Sales paid amounts
    const sales = this.getSales(companyId);
    sales.forEach((s) => {
      balance += Number(s.paidAmount || 0);
    });

    // Add Customer Receipts
    const receipts = this.getReceipts(companyId);
    receipts.forEach((r) => {
      if (r.paymentMode === 'CASH') {
        balance += Number(r.amount || 0);
      }
    });

    // Subtract Cash Purchases paid amounts
    const purchases = this.getPurchases(companyId);
    purchases.forEach((p) => {
      balance -= Number(p.paidAmount || 0);
    });

    // Subtract Supplier Payments
    const payments = this.getPayments(companyId);
    payments.forEach((p) => {
      if (p.paymentMode === 'CASH') {
        balance -= Number(p.amount || 0);
      }
    });

    // Subtract Expenses
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

  // --- LEDGER ACCOUNTS ---
  getLedgers(companyId?: string): LedgerAccount[] {
    const all = getItem<LedgerAccount[]>(STORAGE_KEYS.LEDGERS, []);
    if (!companyId) return all;
    return all.filter((l) => (l.companyId || DEFAULT_COMPANY_ID) === companyId);
  },

  saveLedger(ledgerData: Partial<LedgerAccount>, companyId?: string): LedgerAccount {
    const all = getItem<LedgerAccount[]>(STORAGE_KEYS.LEDGERS, []);
    const targetCompId = companyId || ledgerData.companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    if (ledgerData.id) {
      const idx = all.findIndex((l) => l.id === ledgerData.id);
      if (idx !== -1) {
        const updated: LedgerAccount = {
          ...all[idx],
          ...ledgerData,
          companyId: targetCompId
        } as LedgerAccount;
        all[idx] = updated;
        setItem(STORAGE_KEYS.LEDGERS, all);
        return updated;
      }
    }

    const newLedger: LedgerAccount = {
      id: `ledg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: targetCompId,
      code: ledgerData.code || `ACC-${String(all.length + 1).padStart(4, '0')}`,
      name: ledgerData.name || 'General Ledger',
      accountGroup: ledgerData.accountGroup || 'General Expenses',
      accountType: ledgerData.accountType || 'GENERAL',
      openingDebit: Number(ledgerData.openingDebit || 0),
      openingCredit: Number(ledgerData.openingCredit || 0),
      currentBalance: Number((ledgerData.openingDebit || 0) - (ledgerData.openingCredit || 0)),
      createdAt: now
    };

    all.unshift(newLedger);
    setItem(STORAGE_KEYS.LEDGERS, all);
    return newLedger;
  },

  // --- WAREHOUSES / MATERIAL CENTERS ---
  getWarehouses(companyId?: string): Warehouse[] {
    const all = getItem<Warehouse[]>(STORAGE_KEYS.WAREHOUSES, []);
    const targetCompId = companyId || DEFAULT_COMPANY_ID;
    const compWarehouses = all.filter((w) => (w.companyId || DEFAULT_COMPANY_ID) === targetCompId);
    if (compWarehouses.length === 0) {
      // Create Default Main Warehouse for this company
      const defaultWh: Warehouse = {
        id: `wh-main-${targetCompId}`,
        companyId: targetCompId,
        code: 'WH-MAIN',
        name: 'Main Warehouse',
        location: 'Main Branch',
        isDefault: true,
        createdAt: new Date().toISOString()
      };
      all.push(defaultWh);
      setItem(STORAGE_KEYS.WAREHOUSES, all);
      return [defaultWh];
    }
    return compWarehouses;
  },

  saveWarehouse(warehouseData: Partial<Warehouse>, companyId?: string): Warehouse {
    const all = getItem<Warehouse[]>(STORAGE_KEYS.WAREHOUSES, []);
    const targetCompId = companyId || warehouseData.companyId || DEFAULT_COMPANY_ID;
    const now = new Date().toISOString();

    if (warehouseData.id) {
      const idx = all.findIndex((w) => w.id === warehouseData.id);
      if (idx !== -1) {
        const updated: Warehouse = {
          ...all[idx],
          ...warehouseData,
          companyId: targetCompId
        } as Warehouse;
        all[idx] = updated;
        setItem(STORAGE_KEYS.WAREHOUSES, all);
        return updated;
      }
    }

    const newWh: Warehouse = {
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      companyId: targetCompId,
      code: warehouseData.code || `WH-${String(all.length + 1).padStart(3, '0')}`,
      name: warehouseData.name || 'Branch Warehouse',
      location: warehouseData.location || '',
      isDefault: Boolean(warehouseData.isDefault),
      createdAt: now
    };

    all.unshift(newWh);
    setItem(STORAGE_KEYS.WAREHOUSES, all);
    return newWh;
  },

  // --- OPENING JOURNALS ---
  getOpeningJournals(companyId?: string): OpeningJournalVoucher[] {
    const all = getItem<OpeningJournalVoucher[]>(STORAGE_KEYS.OPENING_JOURNALS, []);
    if (!companyId) return all;
    return all.filter((j) => j.companyId === companyId);
  },

  saveOpeningJournal(journal: OpeningJournalVoucher): void {
    const all = getItem<OpeningJournalVoucher[]>(STORAGE_KEYS.OPENING_JOURNALS, []);
    const idx = all.findIndex((j) => j.id === journal.id);
    if (idx !== -1) {
      all[idx] = journal;
    } else {
      all.unshift(journal);
    }
    setItem(STORAGE_KEYS.OPENING_JOURNALS, all);
  },

  // --- IMPORT HISTORY ---
  getImportHistory(companyId?: string): ImportHistoryRecord[] {
    const all = getItem<ImportHistoryRecord[]>(STORAGE_KEYS.IMPORT_HISTORY, []);
    if (!companyId) return all;
    return all.filter((h) => h.companyId === companyId);
  },

  saveImportHistory(record: ImportHistoryRecord): void {
    const all = getItem<ImportHistoryRecord[]>(STORAGE_KEYS.IMPORT_HISTORY, []);
    all.unshift(record);
    setItem(STORAGE_KEYS.IMPORT_HISTORY, all);
  },

  // --- SEED & RESET ---
  resetDataToSample(): void {
    setItem(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    setItem(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    setItem(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    setItem(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
    setItem(STORAGE_KEYS.SALES, INITIAL_SALES);
    setItem(STORAGE_KEYS.PURCHASES, INITIAL_PURCHASES);
    setItem(STORAGE_KEYS.RECEIPTS, INITIAL_RECEIPTS);
    setItem(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
    setItem(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES);
  },

  clearAllData(): void {
    setItem(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    setItem(STORAGE_KEYS.CUSTOMERS, []);
    setItem(STORAGE_KEYS.SUPPLIERS, []);
    setItem(STORAGE_KEYS.PRODUCTS, []);
    setItem(STORAGE_KEYS.SALES, []);
    setItem(STORAGE_KEYS.PURCHASES, []);
    setItem(STORAGE_KEYS.RECEIPTS, []);
    setItem(STORAGE_KEYS.PAYMENTS, []);
    setItem(STORAGE_KEYS.EXPENSES, []);
  },

  // --- SYNC & DELETION TRACKING ---
  getDeletedIds(): Set<string> {
    return getDeletedIds();
  },

  addDeletedId(id: string): void {
    addDeletedId(id);
  },

  getPendingSyncIds(type: string): Set<string> {
    return getPendingSyncIds(type);
  },

  addPendingSyncId(type: string, id: string): void {
    addPendingSyncId(type, id);
  },

  removePendingSyncId(type: string, id: string): void {
    removePendingSyncId(type, id);
  },

  // --- MULTI-DEVICE CLOUD PULL ---
  async pullFromSupabase(companyId?: string): Promise<{ success: boolean; pulledCounts?: Record<string, number>; error?: string }> {
    if ((this as any)._isPulling) {
      return { success: false, error: 'Pull already in progress' };
    }
    (this as any)._isPulling = true;
    try {
      const [rawCompanies, rawProducts, rawCustomers, rawSuppliers, rawSales, rawPurchases, rawReceipts, rawPayments, rawExpenses, rawUsers] = await Promise.all([
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

      const deletedIds = getDeletedIds();

      // Clean up any remotely returned records that have been deleted locally
      if (rawSales) {
        rawSales.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deleteSaleInvoice(r.id).catch(() => {}));
      }
      if (rawPurchases) {
        rawPurchases.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deletePurchaseInvoice(r.id).catch(() => {}));
      }
      if (rawProducts) {
        rawProducts.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deleteProduct(r.id).catch(() => {}));
      }
      if (rawCustomers) {
        rawCustomers.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deleteCustomer(r.id).catch(() => {}));
      }
      if (rawSuppliers) {
        rawSuppliers.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deleteSupplier(r.id).catch(() => {}));
      }
      if (rawReceipts) {
        rawReceipts.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deleteReceipt(r.id).catch(() => {}));
      }
      if (rawPayments) {
        rawPayments.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deletePayment(r.id).catch(() => {}));
      }
      if (rawExpenses) {
        rawExpenses.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deleteExpense(r.id).catch(() => {}));
      }
      if (rawUsers) {
        rawUsers.filter((r) => deletedIds.has(r.id)).forEach((r) => SupabaseSyncService.deleteUser(r.id).catch(() => {}));
      }

      const remoteCompanies = rawCompanies ? rawCompanies.filter((r) => !deletedIds.has(r.id)) : null;
      const remoteProducts = rawProducts ? rawProducts.filter((r) => !deletedIds.has(r.id)) : null;
      const remoteCustomers = rawCustomers ? rawCustomers.filter((r) => !deletedIds.has(r.id)) : null;
      const remoteSuppliers = rawSuppliers ? rawSuppliers.filter((r) => !deletedIds.has(r.id)) : null;
      const remoteSales = rawSales ? rawSales.filter((r) => !deletedIds.has(r.id)) : null;
      const remotePurchases = rawPurchases ? rawPurchases.filter((r) => !deletedIds.has(r.id)) : null;
      const remoteReceipts = rawReceipts ? rawReceipts.filter((r) => !deletedIds.has(r.id)) : null;
      const remotePayments = rawPayments ? rawPayments.filter((r) => !deletedIds.has(r.id)) : null;
      const remoteExpenses = rawExpenses ? rawExpenses.filter((r) => !deletedIds.has(r.id)) : null;
      const remoteUsers = rawUsers ? rawUsers.filter((r) => !deletedIds.has(r.id)) : null;

      const pulledCounts: Record<string, number> = {};

      if (remoteCompanies !== null) {
        const localComp = getItem<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES).filter((c) => !deletedIds.has(c.id));
        const pendingComp = getPendingSyncIds('companies');
        const mergedCompMap = new Map<string, Company>();
        remoteCompanies.forEach((r) => mergedCompMap.set(r.id, r));

        localComp.forEach((loc) => {
          const rem = mergedCompMap.get(loc.id);
          if (!rem) {
            if (pendingComp.has(loc.id)) {
              mergedCompMap.set(loc.id, loc);
              SupabaseSyncService.syncCompany(loc).then((res) => {
                if (res?.success) removePendingSyncId('companies', loc.id);
              }).catch(() => {});
            }
          } else {
            const locTime = new Date(loc.updatedAt || 0).getTime();
            const remTime = new Date(rem.updatedAt || 0).getTime();
            if (locTime > remTime && pendingComp.has(loc.id)) {
              mergedCompMap.set(loc.id, loc);
              SupabaseSyncService.syncCompany(loc).then((res) => {
                if (res?.success) removePendingSyncId('companies', loc.id);
              }).catch(() => {});
            }
          }
        });

        const mergedComp = Array.from(mergedCompMap.values());
        setItem(STORAGE_KEYS.COMPANIES, mergedComp, true);
        pulledCounts.companies = mergedComp.length;
      }

      if (remoteProducts !== null) {
        const local = getItem<Product[]>(STORAGE_KEYS.PRODUCTS, []).filter((p) => !deletedIds.has(p.id));
        const pendingProducts = getPendingSyncIds('products');
        const targetComp = companyId ? local.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const mergedMap = new Map<string, Product>();
        remoteProducts.forEach((r) => mergedMap.set(r.id, r));

        targetComp.forEach((loc) => {
          const rem = mergedMap.get(loc.id);
          if (!rem) {
            if (pendingProducts.has(loc.id)) {
              mergedMap.set(loc.id, loc);
              SupabaseSyncService.syncProduct(loc).then((res) => {
                if (res?.success) removePendingSyncId('products', loc.id);
              }).catch(() => {});
            }
          } else {
            const locTime = new Date(loc.updatedAt || loc.createdAt || 0).getTime();
            const remTime = new Date(rem.updatedAt || rem.createdAt || 0).getTime();
            if (pendingProducts.has(loc.id) || locTime > remTime) {
              mergedMap.set(loc.id, loc);
              SupabaseSyncService.syncProduct(loc).then((res) => {
                if (res?.success) removePendingSyncId('products', loc.id);
              }).catch(() => {});
            }
          }
        });

        const mergedCompProducts = Array.from(mergedMap.values());
        setItem(STORAGE_KEYS.PRODUCTS, [...mergedCompProducts, ...otherComp], true);
        pulledCounts.products = mergedCompProducts.length;
      }

      if (remoteCustomers !== null) {
        const local = getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, []).filter((c) => !deletedIds.has(c.id));
        const pendingCustomers = getPendingSyncIds('customers');
        const targetComp = companyId ? local.filter((c) => (c.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((c) => (c.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const mergedMap = new Map<string, Customer>();
        remoteCustomers.forEach((r) => mergedMap.set(r.id, r));

        targetComp.forEach((loc) => {
          const rem = mergedMap.get(loc.id);
          if (!rem) {
            if (pendingCustomers.has(loc.id)) {
              mergedMap.set(loc.id, loc);
              SupabaseSyncService.syncCustomer(loc).then((res) => {
                if (res?.success) removePendingSyncId('customers', loc.id);
              }).catch(() => {});
            }
          } else {
            const locTime = new Date(loc.updatedAt || loc.createdAt || 0).getTime();
            const remTime = new Date(rem.updatedAt || rem.createdAt || 0).getTime();
            if (pendingCustomers.has(loc.id) || locTime > remTime) {
              mergedMap.set(loc.id, loc);
              SupabaseSyncService.syncCustomer(loc).then((res) => {
                if (res?.success) removePendingSyncId('customers', loc.id);
              }).catch(() => {});
            }
          }
        });

        const mergedCompCustomers = Array.from(mergedMap.values());
        setItem(STORAGE_KEYS.CUSTOMERS, [...mergedCompCustomers, ...otherComp], true);
        pulledCounts.customers = mergedCompCustomers.length;
      }

      if (remoteSuppliers !== null) {
        const local = getItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []).filter((s) => !deletedIds.has(s.id));
        const pendingSuppliers = getPendingSyncIds('suppliers');
        const targetComp = companyId ? local.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const mergedMap = new Map<string, Supplier>();
        remoteSuppliers.forEach((r) => mergedMap.set(r.id, r));

        targetComp.forEach((loc) => {
          const rem = mergedMap.get(loc.id);
          if (!rem) {
            if (pendingSuppliers.has(loc.id)) {
              mergedMap.set(loc.id, loc);
              SupabaseSyncService.syncSupplier(loc).then((res) => {
                if (res?.success) removePendingSyncId('suppliers', loc.id);
              }).catch(() => {});
            }
          } else {
            const locTime = new Date(loc.updatedAt || loc.createdAt || 0).getTime();
            const remTime = new Date(rem.updatedAt || rem.createdAt || 0).getTime();
            if (pendingSuppliers.has(loc.id) || locTime > remTime) {
              mergedMap.set(loc.id, loc);
              SupabaseSyncService.syncSupplier(loc).then((res) => {
                if (res?.success) removePendingSyncId('suppliers', loc.id);
              }).catch(() => {});
            }
          }
        });

        const mergedCompSuppliers = Array.from(mergedMap.values());
        setItem(STORAGE_KEYS.SUPPLIERS, [...mergedCompSuppliers, ...otherComp], true);
        pulledCounts.suppliers = mergedCompSuppliers.length;
      }

      if (remoteSales !== null) {
        const local = getItem<SaleInvoice[]>(STORAGE_KEYS.SALES, []).filter((s) => !deletedIds.has(s.id));
        const pendingSales = getPendingSyncIds('sales');
        const targetComp = companyId ? local.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((s) => (s.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const remoteIds = new Set(remoteSales.map((r) => r.id));
        const mergedCompSales: SaleInvoice[] = [...remoteSales];
        targetComp.forEach((loc) => {
          if (!remoteIds.has(loc.id) && pendingSales.has(loc.id)) {
            mergedCompSales.push(loc);
            SupabaseSyncService.syncSaleInvoice(loc).then((res) => {
              if (res?.success) removePendingSyncId('sales', loc.id);
            }).catch(() => {});
          }
        });

        setItem(STORAGE_KEYS.SALES, [...mergedCompSales, ...otherComp], true);
        pulledCounts.sales = mergedCompSales.length;
      }

      if (remotePurchases !== null) {
        const local = getItem<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASES, []).filter((p) => !deletedIds.has(p.id));
        const pendingPurchases = getPendingSyncIds('purchases');
        const targetComp = companyId ? local.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const remoteIds = new Set(remotePurchases.map((r) => r.id));
        const mergedCompPurchases: PurchaseInvoice[] = [...remotePurchases];
        targetComp.forEach((loc) => {
          if (!remoteIds.has(loc.id) && pendingPurchases.has(loc.id)) {
            mergedCompPurchases.push(loc);
            SupabaseSyncService.syncPurchaseInvoice(loc).then((res) => {
              if (res?.success) removePendingSyncId('purchases', loc.id);
            }).catch(() => {});
          }
        });

        setItem(STORAGE_KEYS.PURCHASES, [...mergedCompPurchases, ...otherComp], true);
        pulledCounts.purchases = mergedCompPurchases.length;
      }

      if (remoteReceipts !== null) {
        const local = getItem<CustomerReceipt[]>(STORAGE_KEYS.RECEIPTS, []).filter((r) => !deletedIds.has(r.id));
        const pendingReceipts = getPendingSyncIds('receipts');
        const targetComp = companyId ? local.filter((r) => (r.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((r) => (r.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const remoteIds = new Set(remoteReceipts.map((r) => r.id));
        const mergedCompReceipts: CustomerReceipt[] = [...remoteReceipts];
        targetComp.forEach((loc) => {
          if (!remoteIds.has(loc.id) && pendingReceipts.has(loc.id)) {
            mergedCompReceipts.push(loc);
            SupabaseSyncService.syncReceipt(loc).then((res) => {
              if (res?.success) removePendingSyncId('receipts', loc.id);
            }).catch(() => {});
          }
        });

        setItem(STORAGE_KEYS.RECEIPTS, [...mergedCompReceipts, ...otherComp], true);
        pulledCounts.receipts = mergedCompReceipts.length;
      }

      if (remotePayments !== null) {
        const local = getItem<SupplierPayment[]>(STORAGE_KEYS.PAYMENTS, []).filter((p) => !deletedIds.has(p.id));
        const pendingPayments = getPendingSyncIds('payments');
        const targetComp = companyId ? local.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((p) => (p.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const remoteIds = new Set(remotePayments.map((r) => r.id));
        const mergedCompPayments: SupplierPayment[] = [...remotePayments];
        targetComp.forEach((loc) => {
          if (!remoteIds.has(loc.id) && pendingPayments.has(loc.id)) {
            mergedCompPayments.push(loc);
            SupabaseSyncService.syncPayment(loc).then((res) => {
              if (res?.success) removePendingSyncId('payments', loc.id);
            }).catch(() => {});
          }
        });

        setItem(STORAGE_KEYS.PAYMENTS, [...mergedCompPayments, ...otherComp], true);
        pulledCounts.payments = mergedCompPayments.length;
      }

      if (remoteExpenses !== null) {
        const local = getItem<Expense[]>(STORAGE_KEYS.EXPENSES, []).filter((e) => !deletedIds.has(e.id));
        const pendingExpenses = getPendingSyncIds('expenses');
        const targetComp = companyId ? local.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) === companyId) : local;
        const otherComp = companyId ? local.filter((e) => (e.companyId || DEFAULT_COMPANY_ID) !== companyId) : [];

        const remoteIds = new Set(remoteExpenses.map((r) => r.id));
        const mergedCompExpenses: Expense[] = [...remoteExpenses];
        targetComp.forEach((loc) => {
          if (!remoteIds.has(loc.id) && pendingExpenses.has(loc.id)) {
            mergedCompExpenses.push(loc);
            SupabaseSyncService.syncExpense(loc).then((res) => {
              if (res?.success) removePendingSyncId('expenses', loc.id);
            }).catch(() => {});
          }
        });

        setItem(STORAGE_KEYS.EXPENSES, [...mergedCompExpenses, ...otherComp], true);
        pulledCounts.expenses = mergedCompExpenses.length;
      }

      if (remoteUsers !== null) {
        const localUsers = getItem<AppUser[]>(STORAGE_KEYS.USERS, []).filter((u) => !deletedIds.has(u.id));
        const pendingUsers = getPendingSyncIds('users');
        const mergedUserMap = new Map<string, AppUser>();
        remoteUsers.forEach((r) => mergedUserMap.set(r.id, r));

        localUsers.forEach((loc) => {
          const rem = mergedUserMap.get(loc.id);
          if (!rem) {
            if (pendingUsers.has(loc.id)) {
              mergedUserMap.set(loc.id, loc);
              SupabaseSyncService.syncUser(loc).then((res) => {
                if (res?.success) removePendingSyncId('users', loc.id);
              }).catch(() => {});
            }
          } else {
            const locTime = new Date(loc.updatedAt || 0).getTime();
            const remTime = new Date(rem.updatedAt || 0).getTime();
            if (locTime > remTime && pendingUsers.has(loc.id)) {
              mergedUserMap.set(loc.id, loc);
              SupabaseSyncService.syncUser(loc).then((res) => {
                if (res?.success) removePendingSyncId('users', loc.id);
              }).catch(() => {});
            }
          }
        });

        const mergedUsers = Array.from(mergedUserMap.values());
        setItem(STORAGE_KEYS.USERS, mergedUsers, true);
        pulledCounts.users = mergedUsers.length;
      }

      return { success: true, pulledCounts };
    } catch (err: any) {
      console.error('Error pulling from Supabase:', err);
      return { success: false, error: err?.message };
    } finally {
      (this as any)._isPulling = false;
    }
  }
};
