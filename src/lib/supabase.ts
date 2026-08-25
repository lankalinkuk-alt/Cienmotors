import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Product,
  Customer,
  Supplier,
  SaleInvoice,
  PurchaseInvoice,
  CustomerReceipt,
  SupplierPayment,
  Expense,
  Company,
  AppSettings,
  AppUser,
  PdcTransaction,
  JournalEntry
} from '../types';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

// Active in-flight request tracking to prevent concurrent double-submissions
const _inFlightRequests = new Set<string>();

/**
 * Generates ONE cryptographically unique request ID for transaction idempotency & database-level uniqueness.
 */
export function generateUniqueRequestId(prefix: string = 'req'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {}
  const rand = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function getActiveSupabaseCredentials(): { url: string; key: string } {
  let url = '';
  let key = '';

  // 1. Check localStorage settings
  try {
    const rawSettings = localStorage.getItem('busy_ufo_settings');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed.supabaseUrl) url = parsed.supabaseUrl.trim();
      if (parsed.supabaseAnonKey) key = parsed.supabaseAnonKey.trim();
    }
  } catch (e) {
    console.error('Error reading Supabase settings from storage:', e);
  }

  // 2. Fallback to Vite environment variables
  if (!url) {
    url = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  }
  if (!key) {
    key = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();
  }

  return { url, key };
}

export function getSupabaseClient(url?: string, key?: string): SupabaseClient | null {
  const finalUrl = url ? url.trim() : getActiveSupabaseCredentials().url;
  const finalKey = key ? key.trim() : getActiveSupabaseCredentials().key;

  if (!finalUrl || !finalKey) return null;

  if (cachedClient && cachedUrl === finalUrl && cachedKey === finalKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(finalUrl, finalKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    cachedUrl = finalUrl;
    cachedKey = finalKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  url: string;
  tableStatus?: {
    products: boolean;
    customers: boolean;
    suppliers: boolean;
    sales: boolean;
    users?: boolean;
  };
  details?: string;
}

export async function testSupabaseConnection(url?: string, key?: string): Promise<ConnectionTestResult> {
  const credentials = {
    url: url ? url.trim() : getActiveSupabaseCredentials().url,
    key: key ? key.trim() : getActiveSupabaseCredentials().key
  };

  if (!credentials.url || !credentials.key) {
    return {
      success: false,
      url: credentials.url,
      message: 'Supabase URL or Anon Public Key is missing.'
    };
  }

  if (!credentials.url.startsWith('https://')) {
    return {
      success: false,
      url: credentials.url,
      message: 'Supabase URL must start with https:// (e.g., https://your-project.supabase.co).'
    };
  }

  try {
    const client = createClient(credentials.url, credentials.key);
    
    // 1. Test product table READ query
    const { data: prodData, error: prodError } = await client
      .from('busy_ufo_products')
      .select('id')
      .limit(1);

    if (prodError) {
      if (prodError.code === 'PGRST116' || prodError.message.includes('relation') || prodError.message.includes('does not exist')) {
        return {
          success: false,
          url: credentials.url,
          message: 'Connected to Supabase, but tables have not been created yet. Please copy and execute the SQL Schema Script in the Supabase SQL Editor.',
          details: prodError.message
        };
      }
      if (prodError.message.includes('JWT') || prodError.code === 'PGRST301') {
        return {
          success: false,
          url: credentials.url,
          message: 'Invalid Anon Public Key. Please check the anon key copied from Supabase Project Settings -> API.',
          details: prodError.message
        };
      }
      return {
        success: false,
        url: credentials.url,
        message: `Supabase query returned error: ${prodError.message}`,
        details: prodError.message
      };
    }

    // 2. Ensure company record exists in Supabase so foreign key constraints pass
    const { data: existingComp } = await client.from('companies').select('id').eq('id', 'comp-1').maybeSingle();
    if (!existingComp) {
      await client.from('companies').insert({
        id: 'comp-1',
        company_name: 'Unnamed Company',
        short_name: 'CMP',
        is_active: true
      });
    }

    // 3. Test product table WRITE (upsert) permission to verify RLS is disabled or allows inserts
    const testPingId = '__connection_test_ping__';
    const { error: writeError } = await client
      .from('busy_ufo_products')
      .upsert({
        id: testPingId,
        code: 'TEST-PING',
        name: 'Supabase Sync Connection Test',
        cost_price: 0,
        selling_price: 0,
        current_stock: 0,
        reorder_level: 0,
        company_id: 'comp-1'
      }, { onConflict: 'id' });

    if (writeError) {
      if (writeError.message.includes('row-level security') || writeError.code === '42501') {
        return {
          success: false,
          url: credentials.url,
          message: 'Read access works, BUT Save/Write access is BLOCKED by Supabase Row Level Security (RLS). Please run "ALTER TABLE busy_ufo_products DISABLE ROW LEVEL SECURITY;" in your Supabase SQL Editor.',
          details: writeError.message
        };
      }
      return {
        success: false,
        url: credentials.url,
        message: `Read access works, but Write access failed: ${writeError.message}`,
        details: writeError.message
      };
    }

    // Clean up test ping record
    await client.from('busy_ufo_products').delete().eq('id', testPingId);

    return {
      success: true,
      url: credentials.url,
      message: 'Supabase connection verified! BOTH Read and Write (Save) access are fully active.',
      tableStatus: {
        products: true,
        customers: true,
        suppliers: true,
        sales: true,
        users: true
      }
    };
  } catch (err: any) {
    return {
      success: false,
      url: credentials.url,
      message: `Failed to connect to Supabase: ${err?.message || 'Network error'}`,
      details: String(err)
    };
  }
}

async function ensureCompanyExists(client: SupabaseClient, companyId?: string): Promise<void> {
  const compId = companyId || 'comp-1';
  try {
    // Check if the company already exists in Supabase
    const { data: existing, error } = await client
      .from('companies')
      .select('id')
      .eq('id', compId)
      .maybeSingle();

    if (error) {
      console.warn('Error checking if company exists:', error);
      return;
    }

    if (existing) {
      // Company already exists, DO NOT OVERWRITE
      return;
    }

    // Company does not exist, insert a placeholder to satisfy foreign keys
    let compName = 'Unnamed Company';
    let shortName = 'CMP';

    const rawCompanies = localStorage.getItem('busy_ufo_companies');
    if (rawCompanies) {
      const companies = JSON.parse(rawCompanies);
      const matched = companies.find((c: any) => c.id === compId);
      if (matched) {
        compName = matched.companyName || matched.company_name || compName;
        shortName = matched.shortName || matched.short_name || shortName;
      }
    }

    await client.from('companies').insert({
      id: compId,
      company_name: compName,
      short_name: shortName,
      is_active: true
    });
  } catch (e) {
    console.warn('Failed to ensure company row in Supabase:', e);
  }
}

// ==========================================
// SUPABASE REAL-TIME CLOUD SYNC ENGINE
// ==========================================

export type UserStatusCheckResult =
  | { status: 'USERS_EXIST'; users: AppUser[]; count: number }
  | { status: 'ZERO_USERS' }
  | { status: 'CONNECTION_ERROR'; error: string };

export const SupabaseSyncService = {
  // --- USER AUTHENTICATION & STATUS (Supabase is Single Source of Truth) ---
  async checkUsersStatus(): Promise<UserStatusCheckResult> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        status: 'CONNECTION_ERROR',
        error: 'Unable to connect to the server. Please check your internet connection and try again.'
      };
    }

    try {
      const { data, error } = await client
        .from('app_users')
        .select('*')
        .order('username');

      if (error) {
        console.warn('Supabase checkUsersStatus error:', error);
        return {
          status: 'CONNECTION_ERROR',
          error: error.message || 'Unable to connect to the server. Please check your internet connection and try again.'
        };
      }

      if (!data || data.length === 0) {
        return { status: 'ZERO_USERS' };
      }

      const users: AppUser[] = data.map((row: any) => ({
        id: String(row.id),
        username: row.username,
        usernameNormalized: row.username_normalized || (row.username ? row.username.toLowerCase() : ''),
        fullName: row.full_name || row.fullName || row.username,
        passwordHash: row.password_hash || row.passwordHash || '',
        salt: row.salt || '',
        roleId: row.role_id || row.roleId || 'role-sales',
        roleName: row.role_name || row.roleName || 'Sales User',
        isActive: row.is_active !== undefined ? row.is_active : (row.isActive !== undefined ? row.isActive : true),
        assignedCompanyIds: Array.isArray(row.assigned_company_ids)
          ? row.assigned_company_ids
          : (typeof row.assigned_company_ids === 'string' && row.assigned_company_ids ? JSON.parse(row.assigned_company_ids) : []),
        permissionOverrides: typeof row.permission_overrides === 'object' && row.permission_overrides !== null
          ? row.permission_overrides
          : (typeof row.permission_overrides === 'string' && row.permission_overrides ? JSON.parse(row.permission_overrides) : {}),
        lastLogin: row.last_login || row.lastLogin,
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
      }));

      return {
        status: 'USERS_EXIST',
        users,
        count: users.length
      };
    } catch (e: any) {
      console.error('Supabase checkUsersStatus exception:', e);
      return {
        status: 'CONNECTION_ERROR',
        error: 'Unable to connect to the server. Please check your internet connection and try again.'
      };
    }
  },
  // --- USERS ---
  async syncUser(user: AppUser): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase URL or Key is missing. Please configure Supabase in Settings.' };

    try {
      // Ensure role exists in 'roles' table first if role_id is specified
      if (user.roleId) {
        try {
          await client.from('roles').upsert([
            {
              id: user.roleId,
              role_name: user.roleName || user.roleId,
              description: `Role ${user.roleName || user.roleId}`
            }
          ], { onConflict: 'id' });
        } catch {
          // Non-blocking if roles table schema differs
        }
      }

      const payload = {
        id: user.id,
        username: user.username,
        username_normalized: user.usernameNormalized || user.username.toLowerCase(),
        full_name: user.fullName,
        password_hash: user.passwordHash,
        salt: user.salt,
        role_id: user.roleId,
        role_name: user.roleName || user.roleId,
        is_active: user.isActive !== undefined ? user.isActive : true,
        assigned_company_ids: user.assignedCompanyIds || [],
        permission_overrides: user.permissionOverrides || {},
        last_login: user.lastLogin || null,
        created_at: user.createdAt || new Date().toISOString(),
        updated_at: user.updatedAt || new Date().toISOString()
      };

      const { error } = await client
        .from('app_users')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase user sync error:', error);
        if (error.message?.includes('relation "app_users" does not exist') || error.code === '42P01') {
          return {
            success: false,
            error: 'Table "app_users" does not exist in Supabase. Please copy the SQL script from Settings -> Export SQL Schema and run it in your Supabase SQL Editor.'
          };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase user sync exception:', e);
      return { success: false, error: e?.message || 'Failed to sync user with Supabase' };
    }
  },

  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
      try {
        await client.from('user_company_assignments').delete().eq('user_id', userId);
      } catch {
        // Non-blocking
      }
      try {
        await client.from('user_permissions').delete().eq('user_id', userId);
      } catch {
        // Non-blocking
      }
      const { error } = await client.from('app_users').delete().eq('id', userId);
      if (error) {
        console.warn('Supabase user delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Error deleting user from Supabase:', e);
      return { success: false, error: e?.message };
    }
  },

  async fetchAllRemoteUsers(): Promise<AppUser[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('app_users')
        .select('*')
        .order('username');

      if (error) {
        console.warn('Fetch remote users error:', error);
        return null;
      }

      if (!data) return [];

      return data.map((row: any) => ({
        id: String(row.id),
        username: row.username,
        usernameNormalized: row.username_normalized || (row.username ? row.username.toLowerCase() : ''),
        fullName: row.full_name || row.fullName || row.username,
        passwordHash: row.password_hash || row.passwordHash || '',
        salt: row.salt || '',
        roleId: row.role_id || row.roleId || 'role-sales',
        roleName: row.role_name || row.roleName || 'Sales User',
        isActive: row.is_active !== undefined ? row.is_active : (row.isActive !== undefined ? row.isActive : true),
        assignedCompanyIds: Array.isArray(row.assigned_company_ids)
          ? row.assigned_company_ids
          : (typeof row.assigned_company_ids === 'string' && row.assigned_company_ids ? JSON.parse(row.assigned_company_ids) : []),
        permissionOverrides: typeof row.permission_overrides === 'object' && row.permission_overrides !== null
          ? row.permission_overrides
          : (typeof row.permission_overrides === 'string' && row.permission_overrides ? JSON.parse(row.permission_overrides) : {}),
        lastLogin: row.last_login || row.lastLogin,
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching users from Supabase:', e);
      return null;
    }
  },

  // --- COMPANIES ---
  async syncCompany(company: Company): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
      const payload = {
        id: company.id,
        company_name: company.companyName,
        short_name: company.shortName,
        address: company.address || '',
        city: company.city || 'Colombo',
        district: company.district || 'Colombo',
        country: company.country || 'Sri Lanka',
        telephone: company.telephone || '',
        mobile: company.mobile || '',
        company_email: company.companyEmail || '',
        tax_registration_no: company.taxRegistrationNo || '',
        currency: company.currency || 'Rs.',
        financial_year_start: company.financialYearStart || '2026-01-01',
        financial_year_end: company.financialYearEnd || '2026-12-31',
        invoice_prefix: company.invoicePrefix || 'INV',
        invoice_number: company.invoiceNumber || 1001,
        is_active: company.isActive !== undefined ? company.isActive : true,
        is_vat_enabled: company.isVatEnabled !== undefined ? company.isVatEnabled : true,
        vat_number: company.vatNumber || '',
        default_vat_rate: company.defaultVatRate || 0,
        vat_type: company.vatType || 'EXCLUSIVE',
        is_item_discount_enabled: company.isItemDiscountEnabled !== undefined ? company.isItemDiscountEnabled : true,
        default_discount_type: company.defaultDiscountType || 'PERCENT',
        created_at: company.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from('companies')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase company sync error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase company sync exception:', e);
      return { success: false, error: e?.message };
    }
  },

  async fetchAllRemoteCompanies(): Promise<Company[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      const { data, error } = await client
        .from('companies')
        .select('*')
        .order('created_at', { ascending: true });

      if (error || !data) return null;

      return data.map((row: any) => {
        let name = row.company_name || row.companyName || row.name || 'Unnamed Company';
        let short = row.short_name || row.shortName || row.short || 'COMP';

        return {
          id: row.id,
          companyName: name,
          shortName: short,
        address: row.address || '',
        city: row.city || 'Colombo',
        district: row.district || 'Colombo',
        country: row.country || 'Sri Lanka',
        telephone: row.telephone || '',
        mobile: row.mobile || '',
        companyEmail: row.company_email || row.companyEmail || '',
        taxRegistrationNo: row.tax_registration_no || row.taxRegistrationNo || '',
        currency: row.currency || 'Rs.',
        financialYearStart: row.financial_year_start || row.financialYearStart || '2026-01-01',
        financialYearEnd: row.financial_year_end || row.financialYearEnd || '2026-12-31',
        invoicePrefix: row.invoice_prefix || row.invoicePrefix || 'INV',
        invoiceNumber: row.invoice_number || row.invoiceNumber || 1001,
        isActive: row.is_active !== undefined ? row.is_active : (row.isActive !== undefined ? row.isActive : true),
        isVatEnabled: row.is_vat_enabled !== undefined ? row.is_vat_enabled : (row.isVatEnabled !== undefined ? row.isVatEnabled : true),
        vatNumber: row.vat_number || row.vatNumber || '',
        defaultVatRate: row.default_vat_rate !== undefined ? Number(row.default_vat_rate) : 0,
        vatType: row.vat_type || row.vatType || 'EXCLUSIVE',
        isItemDiscountEnabled: row.is_item_discount_enabled !== undefined ? row.is_item_discount_enabled : (row.isItemDiscountEnabled !== undefined ? row.isItemDiscountEnabled : true),
        defaultDiscountType: row.default_discount_type || row.defaultDiscountType || 'PERCENT',
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
      };
    });
    } catch (e) {
      console.error('Error fetching companies from Supabase:', e);
      return null;
    }
  },

  // --- PRODUCTS ---
  async syncProduct(product: Product): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
      await ensureCompanyExists(client, product.companyId || 'comp-1');

      const payload = {
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category || 'General',
        unit: product.unit || 'Pcs',
        cost_price: Number(product.costPrice || 0),
        selling_price: Number(product.sellingPrice || 0),
        current_stock: Number(product.currentStock || 0),
        reorder_level: Number(product.reorderLevel || 10),
        opening_stock: product.openingStock !== undefined ? Number(product.openingStock) : Number(product.currentStock || 0),
        opening_rate: product.openingRate !== undefined ? Number(product.openingRate) : Number(product.costPrice || 0),
        opening_value: product.openingValue !== undefined ? Number(product.openingValue) : Number(product.excelStockValue || 0),
        excel_stock_value: product.excelStockValue !== undefined ? Number(product.excelStockValue) : Number(product.openingValue || 0),
        calculated_stock_value: product.calculatedStockValue !== undefined ? Number(product.calculatedStockValue) : 0,
        value_difference: product.valueDifference !== undefined ? Number(product.valueDifference) : 0,
        import_source: product.importSource || null,
        import_batch_id: product.importBatchId || null,
        company_id: product.companyId || 'comp-1',
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from('busy_ufo_products')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase product sync error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase product sync exception:', e);
      return { success: false, error: e?.message };
    }
  },

  async deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      try {
        await client.from('busy_ufo_sale_items').update({ product_id: null }).eq('product_id', productId);
      } catch {}
      try {
        await client.from('busy_ufo_purchase_items').update({ product_id: null }).eq('product_id', productId);
      } catch {}
      const { error } = await client.from('busy_ufo_products').delete().eq('id', productId);
      if (error) {
        console.warn('Supabase product delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase product delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  // --- CUSTOMERS ---
  async syncCustomer(customer: Customer): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
      await ensureCompanyExists(client, customer.companyId || 'comp-1');

      const payload = {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        city: customer.city || 'Colombo',
        opening_balance: Number(customer.openingBalance || 0),
        current_balance: Number(customer.outstandingBalance || 0),
        company_id: customer.companyId || 'comp-1',
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from('busy_ufo_customers')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase customer sync error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase customer sync exception:', e);
      return { success: false, error: e?.message };
    }
  },

  async deleteCustomer(customerId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      try {
        await client.from('busy_ufo_sales').update({ customer_id: null }).eq('customer_id', customerId);
      } catch {}
      try {
        await client.from('busy_ufo_customer_receipts').update({ customer_id: null }).eq('customer_id', customerId);
      } catch {}
      const { error } = await client.from('busy_ufo_customers').delete().eq('id', customerId);
      if (error) {
        console.warn('Supabase customer delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase customer delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  // --- SUPPLIERS ---
  async syncSupplier(supplier: Supplier): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
      await ensureCompanyExists(client, supplier.companyId || 'comp-1');

      const payload = {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        city: supplier.city || 'Colombo',
        opening_balance: Number(supplier.openingBalance || 0),
        current_balance: Number(supplier.payableBalance || 0),
        company_id: supplier.companyId || 'comp-1',
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from('busy_ufo_suppliers')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase supplier sync error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase supplier sync exception:', e);
      return { success: false, error: e?.message };
    }
  },

  async deleteSupplier(supplierId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      try {
        await client.from('busy_ufo_purchases').update({ supplier_id: null }).eq('supplier_id', supplierId);
      } catch {}
      try {
        await client.from('busy_ufo_supplier_payments').update({ supplier_id: null }).eq('supplier_id', supplierId);
      } catch {}
      const { error } = await client.from('busy_ufo_suppliers').delete().eq('id', supplierId);
      if (error) {
        console.warn('Supabase supplier delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase supplier delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  // --- ATOMIC NUMBER GENERATION FROM SUPABASE DATABASE ---
  async generateNextSalesInvoiceNumber(companyId: string): Promise<string> {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client not initialized.");
    try {
      const { data, error } = await client.rpc('generate_next_sales_invoice_number_rpc', {
        p_company_id: companyId
      });
      if (!error && data) return data as string;
    } catch (err) {
      console.warn('RPC generate_next_sales_invoice_number_rpc error:', err);
    }
    const year = new Date().getFullYear();
    return `INV-${year}-${Date.now().toString().slice(-4)}`;
  },

  async generateNextPurchaseNumber(companyId: string): Promise<string> {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client not initialized.");
    try {
      const { data, error } = await client.rpc('generate_next_purchase_number_rpc', {
        p_company_id: companyId
      });
      if (!error && data) return data as string;
    } catch (err) {
      console.warn('RPC generate_next_purchase_number_rpc error:', err);
    }
    const year = new Date().getFullYear();
    return `PUR-${year}-${Date.now().toString().slice(-4)}`;
  },

  async generateNextReceiptNumber(companyId: string): Promise<string> {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client not initialized.");
    try {
      const { data, error } = await client.rpc('generate_next_receipt_number_rpc', {
        p_company_id: companyId
      });
      if (!error && data) return data as string;
    } catch (err) {
      console.warn('RPC generate_next_receipt_number_rpc error:', err);
    }
    const year = new Date().getFullYear();
    return `REC-${year}-${Date.now().toString().slice(-4)}`;
  },

  async generateNextPaymentNumber(companyId: string): Promise<string> {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client not initialized.");
    try {
      const { data, error } = await client.rpc('generate_next_payment_number_rpc', {
        p_company_id: companyId
      });
      if (!error && data) return data as string;
    } catch (err) {
      console.warn('RPC generate_next_payment_number_rpc error:', err);
    }
    const year = new Date().getFullYear();
    return `PAY-${year}-${Date.now().toString().slice(-4)}`;
  },

  async generateNextExpenseNumber(companyId: string): Promise<string> {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase client not initialized.");
    try {
      const { data, error } = await client.rpc('generate_next_expense_number_rpc', {
        p_company_id: companyId
      });
      if (!error && data) return data as string;
    } catch (err) {
      console.warn('RPC generate_next_expense_number_rpc error:', err);
    }
    const year = new Date().getFullYear();
    return `EXP-${year}-${Date.now().toString().slice(-4)}`;
  },
  async syncSaleInvoice(sale: SaleInvoice): Promise<{ success: boolean; error?: string; isDuplicate?: boolean; existingData?: SaleInvoice }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = sale.requestId || `req_sale_${sale.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, sale.companyId || 'comp-1');

      // 1. Try atomic PostgreSQL RPC first
      try {
        const { data, error } = await client.rpc('post_sale_invoice_rpc', {
          p_request_id: reqId,
          p_company_id: sale.companyId || 'comp-1',
          p_customer_id: sale.customerId || null,
          p_customer_name: sale.customerName,
          p_sale_type: sale.type,
          p_invoice_date: sale.date,
          p_total_amount: Number(sale.subtotal || 0),
          p_overall_discount: Number(sale.discount || 0),
          p_grand_total: Number(sale.grandTotal || 0),
          p_paid_amount: Number(sale.paidAmount || 0),
          p_due_amount: Number(sale.dueAmount || 0),
          p_notes: sale.notes || '',
          p_items: sale.items.map(item => ({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            discount: Number(item.discount || 0),
            discountType: item.discountType || 'PERCENT',
            total: Number(item.total || 0)
          }))
        });

        if (!error && data?.success) {
          const isDuplicate = data?.is_duplicate || false;
          const returnedData = data?.data;

          return { 
            success: true, 
            isDuplicate, 
            existingData: returnedData ? {
              ...sale,
              id: returnedData.id,
              invoiceNumber: returnedData.invoice_number,
              requestId: returnedData.request_id
            } : undefined
          };
        }
      } catch (rpcErr) {
        console.warn('RPC post_sale_invoice_rpc failed, falling back to direct table sync:', rpcErr);
      }

      // 2. Direct Table Fallback (if RPC is not installed or schema cache is refreshing)
      const { data: existingSale } = await client
        .from('busy_ufo_sales')
        .select('*')
        .eq('request_id', reqId)
        .maybeSingle();

      if (existingSale) {
        return {
          success: true,
          isDuplicate: true,
          existingData: {
            ...sale,
            id: existingSale.id,
            invoiceNumber: existingSale.invoice_number,
            requestId: existingSale.request_id
          }
        };
      }

      const finalInvNum = sale.invoiceNumber || await this.generateNextSalesInvoiceNumber(sale.companyId || 'comp-1');

      const salePayload: any = {
        id: sale.id,
        request_id: reqId,
        invoice_number: finalInvNum,
        invoice_date: sale.date,
        customer_id: sale.customerId || null,
        customer_name: sale.customerName,
        sale_type: sale.type,
        total_amount: Number(sale.subtotal || 0),
        overall_discount: Number(sale.discount || 0),
        grand_total: Number(sale.grandTotal || 0),
        paid_amount: Number(sale.paidAmount || 0),
        due_amount: Number(sale.dueAmount || 0),
        payment_status: Number(sale.dueAmount || 0) <= 0 ? 'PAID' : (Number(sale.paidAmount || 0) > 0 ? 'PARTIAL' : 'UNPAID'),
        company_id: sale.companyId || 'comp-1',
        notes: sale.notes || ''
      };

      const { error: saleErr } = await client.from('busy_ufo_sales').upsert(salePayload);
      if (saleErr) {
        // Retry without request_id if column not present yet
        delete salePayload.request_id;
        const { error: retryErr } = await client.from('busy_ufo_sales').upsert(salePayload);
        if (retryErr) {
          return { success: false, error: retryErr.message };
        }
      }

      // Upsert Sale Items
      if (sale.items && sale.items.length > 0) {
        const itemsPayload = sale.items.map(item => ({
          invoice_id: sale.id,
          product_id: item.productId,
          product_code: item.productCode || '',
          product_name: item.productName || '',
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unitPrice || 0),
          discount: Number(item.discount || 0),
          discount_type: item.discountType || 'PERCENT',
          total: Number(item.total || 0)
        }));
        await client.from('busy_ufo_sale_items').delete().eq('invoice_id', sale.id);
        await client.from('busy_ufo_sale_items').insert(itemsPayload);

        // Update product stocks
        for (const item of sale.items) {
          try {
            const { data: p } = await client.from('busy_ufo_products').select('current_stock').eq('id', item.productId).maybeSingle();
            if (p) {
              await client.from('busy_ufo_products').update({ current_stock: Math.max(0, (p.current_stock || 0) - Number(item.quantity || 0)) }).eq('id', item.productId);
            }
          } catch {}
        }
      }

      // Update customer balance
      if (sale.customerId && Number(sale.dueAmount || 0) > 0) {
        try {
          const { data: c } = await client.from('busy_ufo_customers').select('current_balance').eq('id', sale.customerId).maybeSingle();
          if (c) {
            await client.from('busy_ufo_customers').update({ current_balance: (c.current_balance || 0) + Number(sale.dueAmount || 0) }).eq('id', sale.customerId);
          }
        } catch {}
      }

      return {
        success: true,
        existingData: {
          ...sale,
          invoiceNumber: finalInvNum,
          requestId: reqId
        }
      };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },
  async deleteSaleInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      // 1. Delete child items first
      try {
        await client.from('busy_ufo_sale_items').delete().eq('invoice_id', invoiceId);
      } catch (err) {
        console.warn('Warning deleting sale items child rows:', err);
      }

      // 2. Unlink any receipts referencing this invoice
      try {
        await client.from('busy_ufo_customer_receipts').update({ invoice_id: null }).eq('invoice_id', invoiceId);
      } catch {}

      // 3. Delete parent sale invoice
      const { error } = await client.from('busy_ufo_sales').delete().eq('id', invoiceId);
      if (error) {
        console.warn('Supabase sale delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase sale delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  // --- PURCHASES ---
  async syncPurchaseInvoice(purchase: PurchaseInvoice): Promise<{ success: boolean; error?: string; isDuplicate?: boolean; existingData?: PurchaseInvoice }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = purchase.requestId || `req_pur_${purchase.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, purchase.companyId || 'comp-1');

      // 1. Try atomic PostgreSQL RPC first
      try {
        const { data, error } = await client.rpc('post_purchase_invoice_rpc', {
          p_request_id: reqId,
          p_company_id: purchase.companyId || 'comp-1',
          p_supplier_id: purchase.supplierId || null,
          p_supplier_name: purchase.supplierName,
          p_purchase_type: purchase.type,
          p_purchase_date: purchase.date,
          p_total_amount: Number(purchase.subtotal || 0),
          p_overall_discount: Number(purchase.discount || 0),
          p_grand_total: Number(purchase.grandTotal || 0),
          p_paid_amount: Number(purchase.paidAmount || 0),
          p_due_amount: Number(purchase.dueAmount || 0),
          p_notes: purchase.notes || '',
          p_items: purchase.items.map(item => ({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            quantity: Number(item.quantity || 0),
            unitCost: Number(item.unitCost || 0),
            discount: Number(item.discount || 0),
            discountType: item.discountType || 'PERCENT',
            total: Number(item.total || 0)
          }))
        });

        if (!error && data?.success) {
          const isDuplicate = data?.is_duplicate || false;
          const returnedData = data?.data;

          return { 
            success: true, 
            isDuplicate, 
            existingData: returnedData ? {
              ...purchase,
              id: returnedData.id,
              purchaseNumber: returnedData.purchase_number,
              requestId: returnedData.request_id
            } : undefined
          };
        }
      } catch (rpcErr) {
        console.warn('RPC post_purchase_invoice_rpc failed, falling back to direct table sync:', rpcErr);
      }

      // 2. Direct Table Fallback (if RPC is not installed or schema cache is refreshing)
      const { data: existingPur } = await client
        .from('busy_ufo_purchases')
        .select('*')
        .eq('request_id', reqId)
        .maybeSingle();

      if (existingPur) {
        return {
          success: true,
          isDuplicate: true,
          existingData: {
            ...purchase,
            id: existingPur.id,
            purchaseNumber: existingPur.purchase_number,
            requestId: existingPur.request_id
          }
        };
      }

      const finalPurNum = purchase.purchaseNumber || await this.generateNextPurchaseNumber(purchase.companyId || 'comp-1');

      const purPayload: any = {
        id: purchase.id,
        request_id: reqId,
        purchase_number: finalPurNum,
        purchase_date: purchase.date,
        supplier_id: purchase.supplierId || null,
        supplier_name: purchase.supplierName,
        purchase_type: purchase.type,
        total_amount: Number(purchase.subtotal || 0),
        overall_discount: Number(purchase.discount || 0),
        grand_total: Number(purchase.grandTotal || 0),
        paid_amount: Number(purchase.paidAmount || 0),
        due_amount: Number(purchase.dueAmount || 0),
        payment_status: Number(purchase.dueAmount || 0) <= 0 ? 'PAID' : (Number(purchase.paidAmount || 0) > 0 ? 'PARTIAL' : 'UNPAID'),
        company_id: purchase.companyId || 'comp-1',
        notes: purchase.notes || ''
      };

      const { error: purErr } = await client.from('busy_ufo_purchases').upsert(purPayload);
      if (purErr) {
        delete purPayload.request_id;
        const { error: retryErr } = await client.from('busy_ufo_purchases').upsert(purPayload);
        if (retryErr) {
          return { success: false, error: retryErr.message };
        }
      }

      // Upsert Purchase Items
      if (purchase.items && purchase.items.length > 0) {
        const itemsPayload = purchase.items.map(item => ({
          purchase_id: purchase.id,
          product_id: item.productId,
          product_code: item.productCode || '',
          product_name: item.productName || '',
          quantity: Number(item.quantity || 0),
          unit_cost: Number(item.unitCost || 0),
          discount: Number(item.discount || 0),
          discount_type: item.discountType || 'PERCENT',
          total: Number(item.total || 0)
        }));
        await client.from('busy_ufo_purchase_items').delete().eq('purchase_id', purchase.id);
        await client.from('busy_ufo_purchase_items').insert(itemsPayload);

        // Update product stocks (add stock)
        for (const item of purchase.items) {
          try {
            const { data: p } = await client.from('busy_ufo_products').select('current_stock').eq('id', item.productId).maybeSingle();
            if (p) {
              await client.from('busy_ufo_products').update({ current_stock: (p.current_stock || 0) + Number(item.quantity || 0) }).eq('id', item.productId);
            }
          } catch {}
        }
      }

      // Update supplier balance
      if (purchase.supplierId && Number(purchase.dueAmount || 0) > 0) {
        try {
          const { data: s } = await client.from('busy_ufo_suppliers').select('current_balance').eq('id', purchase.supplierId).maybeSingle();
          if (s) {
            await client.from('busy_ufo_suppliers').update({ current_balance: (s.current_balance || 0) + Number(purchase.dueAmount || 0) }).eq('id', purchase.supplierId);
          }
        } catch {}
      }

      return {
        success: true,
        existingData: {
          ...purchase,
          purchaseNumber: finalPurNum,
          requestId: reqId
        }
      };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },
  async deletePurchaseInvoice(purchaseId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      // 1. Delete child purchase items first
      try {
        await client.from('busy_ufo_purchase_items').delete().eq('purchase_id', purchaseId);
      } catch (err) {
        console.warn('Warning deleting purchase items child rows:', err);
      }

      // 2. Unlink any payments referencing this purchase
      try {
        await client.from('busy_ufo_supplier_payments').update({ purchase_id: null }).eq('purchase_id', purchaseId);
      } catch {}

      // 3. Delete parent purchase
      const { error } = await client.from('busy_ufo_purchases').delete().eq('id', purchaseId);
      if (error) {
        console.warn('Supabase purchase delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase purchase delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  // --- RECEIPTS, PAYMENTS & EXPENSES ---
  async syncReceipt(receipt: CustomerReceipt): Promise<{ success: boolean; error?: string; isDuplicate?: boolean; existingData?: CustomerReceipt }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = receipt.requestId || `req_rec_${receipt.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, receipt.companyId || 'comp-1');

      // 1. Try atomic PostgreSQL RPC first
      try {
        const { data: rpcData, error: rpcError } = await client.rpc('post_customer_receipt_rpc', {
          p_request_id: reqId,
          p_company_id: receipt.companyId || 'comp-1',
          p_customer_id: receipt.customerId || null,
          p_customer_name: receipt.customerName || 'Walk-in Customer',
          p_date: receipt.date || new Date().toISOString().split('T')[0],
          p_amount: Number(receipt.amount || 0),
          p_payment_method: receipt.paymentMode || 'CASH',
          p_reference_no: receipt.referenceNo || '',
          p_notes: receipt.notes || ''
        });

        if (!rpcError && rpcData?.success) {
          if (rpcData.is_duplicate) {
            return { success: true, isDuplicate: true };
          }
          return { success: true };
        }
      } catch (rpcErr) {
        console.warn('RPC post_customer_receipt_rpc failed, falling back to direct upsert:', rpcErr);
      }

      // 2. Fallback direct upsert
      const payload = {
        id: receipt.id,
        request_id: reqId,
        receipt_number: receipt.receiptNumber || `REC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        date: receipt.date,
        customer_id: receipt.customerId || null,
        customer_name: receipt.customerName,
        amount: Number(receipt.amount || 0),
        payment_method: receipt.paymentMode || 'CASH',
        reference_no: receipt.referenceNo || '',
        notes: receipt.notes || '',
        company_id: receipt.companyId || 'comp-1'
      };
      const { error } = await client.from('busy_ufo_customer_receipts').upsert(payload, { onConflict: 'id' });
      if (error) {
        if (error.message?.includes('request_id') || error.code === '23505') {
          return { success: true, isDuplicate: true };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async deleteReceipt(id: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      const { error } = await client.from('busy_ufo_customer_receipts').delete().eq('id', id);
      if (error) {
        console.warn('Supabase receipt delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase receipt delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  async syncPayment(payment: SupplierPayment): Promise<{ success: boolean; error?: string; isDuplicate?: boolean; existingData?: SupplierPayment }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = payment.requestId || `req_pay_${payment.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, payment.companyId || 'comp-1');

      // 1. Try atomic PostgreSQL RPC first
      try {
        const { data: rpcData, error: rpcError } = await client.rpc('post_supplier_payment_rpc', {
          p_request_id: reqId,
          p_company_id: payment.companyId || 'comp-1',
          p_supplier_id: payment.supplierId || null,
          p_supplier_name: payment.supplierName || 'General Supplier',
          p_date: payment.date || new Date().toISOString().split('T')[0],
          p_amount: Number(payment.amount || 0),
          p_payment_method: payment.paymentMode || 'CASH',
          p_reference_no: payment.referenceNo || '',
          p_notes: payment.notes || ''
        });

        if (!rpcError && rpcData?.success) {
          if (rpcData.is_duplicate) {
            return { success: true, isDuplicate: true };
          }
          return { success: true };
        }
      } catch (rpcErr) {
        console.warn('RPC post_supplier_payment_rpc failed, falling back to direct upsert:', rpcErr);
      }

      // 2. Fallback direct upsert
      const payload = {
        id: payment.id,
        request_id: reqId,
        payment_number: payment.paymentNumber || `PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        date: payment.date,
        supplier_id: payment.supplierId || null,
        supplier_name: payment.supplierName,
        amount: Number(payment.amount || 0),
        payment_method: payment.paymentMode || 'CASH',
        reference_no: payment.referenceNo || '',
        notes: payment.notes || '',
        company_id: payment.companyId || 'comp-1'
      };
      const { error } = await client.from('busy_ufo_supplier_payments').upsert(payload, { onConflict: 'id' });
      if (error) {
        if (error.message?.includes('request_id') || error.code === '23505') {
          return { success: true, isDuplicate: true };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async deletePayment(id: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      const { error } = await client.from('busy_ufo_supplier_payments').delete().eq('id', id);
      if (error) {
        console.warn('Supabase payment delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase payment delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  async syncExpense(expense: Expense): Promise<{ success: boolean; error?: string; isDuplicate?: boolean; existingData?: Expense; expenseNumber?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = expense.requestId || `req_exp_${expense.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, expense.companyId || 'comp-1');

      // 1. Try atomic PostgreSQL RPC first
      try {
        const { data: rpcData, error: rpcError } = await client.rpc('post_expense_rpc', {
          p_request_id: reqId,
          p_company_id: expense.companyId || 'comp-1',
          p_date: expense.date || new Date().toISOString().split('T')[0],
          p_category: expense.category || 'General',
          p_amount: Number(expense.amount || 0),
          p_paid_to: expense.paidTo || '',
          p_payment_method: expense.paymentMode || 'CASH',
          p_notes: expense.notes || ''
        });

        if (!rpcError && rpcData?.success) {
          if (rpcData.is_duplicate) {
            return { success: true, isDuplicate: true };
          }
          const savedData = rpcData.data;
          return { success: true, expenseNumber: savedData?.expense_number };
        }
      } catch (rpcErr) {
        console.warn('RPC post_expense_rpc failed, falling back to direct upsert:', rpcErr);
      }

      // 2. Fallback direct upsert
      const finalExpNum = expense.expenseNumber || `EXP-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const payloadWithPaidTo: any = {
        id: expense.id,
        request_id: reqId,
        expense_number: finalExpNum,
        date: expense.date,
        category: expense.category,
        amount: Number(expense.amount || 0),
        paid_to: expense.paidTo || null,
        payment_method: expense.paymentMode || 'CASH',
        notes: expense.notes || '',
        company_id: expense.companyId || 'comp-1'
      };

      let { error } = await client.from('busy_ufo_expenses').upsert(payloadWithPaidTo, { onConflict: 'id' });

      // If error is due to missing paid_to column in Postgres, retry without paid_to
      if (error && (error.message?.includes('paid_to') || error.code === '42703')) {
        const payloadFallback: any = {
          id: expense.id,
          request_id: reqId,
          expense_number: finalExpNum,
          date: expense.date,
          category: expense.category,
          amount: Number(expense.amount || 0),
          payment_method: expense.paymentMode || 'CASH',
          notes: expense.paidTo ? `Paid to: ${expense.paidTo}${expense.notes ? ' | ' + expense.notes : ''}` : (expense.notes || ''),
          company_id: expense.companyId || 'comp-1'
        };
        const fallbackRes = await client.from('busy_ufo_expenses').upsert(payloadFallback, { onConflict: 'id' });
        error = fallbackRes.error;
      }

      if (error) {
        if (error.message?.includes('request_id') || error.code === '23505') {
          return { success: true, isDuplicate: true, expenseNumber: finalExpNum };
        }
        return { success: false, error: error.message };
      }
      return { success: true, expenseNumber: finalExpNum };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      const { error } = await client.from('busy_ufo_expenses').delete().eq('id', id);
      if (error) {
        console.warn('Supabase expense delete error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.warn('Supabase expense delete exception:', e);
      return { success: false, error: e?.message };
    }
  },

  // --- BULK FETCH FROM SUPABASE ---
  async fetchAllRemoteProducts(companyId?: string): Promise<Product[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      let query = client.from('busy_ufo_products').select('*').order('name');
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query;

      if (error || !data) return null;

      return data.map((row: any) => ({
        id: row.id,
        companyId: row.company_id || 'comp-1',
        code: row.code,
        name: row.name,
        category: row.category || 'General',
        unit: row.unit || 'Pcs',
        costPrice: Number(row.cost_price || 0),
        sellingPrice: Number(row.selling_price || 0),
        currentStock: Number(row.current_stock || 0),
        reorderLevel: Number(row.reorder_level || 10),
        openingStock: row.opening_stock !== null && row.opening_stock !== undefined ? Number(row.opening_stock) : undefined,
        openingRate: row.opening_rate !== null && row.opening_rate !== undefined ? Number(row.opening_rate) : undefined,
        openingValue: row.opening_value !== null && row.opening_value !== undefined ? Number(row.opening_value) : undefined,
        excelStockValue: row.excel_stock_value !== null && row.excel_stock_value !== undefined ? Number(row.excel_stock_value) : undefined,
        calculatedStockValue: row.calculated_stock_value !== null && row.calculated_stock_value !== undefined ? Number(row.calculated_stock_value) : undefined,
        valueDifference: row.value_difference !== null && row.value_difference !== undefined ? Number(row.value_difference) : undefined,
        importSource: row.import_source || undefined,
        importBatchId: row.import_batch_id || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching products from Supabase:', e);
      return null;
    }
  },

  async fetchAllRemoteCustomers(companyId?: string): Promise<Customer[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      let query = client.from('busy_ufo_customers').select('*').order('name');
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query;

      if (error || !data) return null;

      return data.map((row: any) => ({
        id: row.id,
        companyId: row.company_id || 'comp-1',
        code: row.code,
        name: row.name,
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        city: row.city || 'Colombo',
        openingBalance: Number(row.opening_balance || 0),
        outstandingBalance: Number(row.current_balance || 0),
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching customers from Supabase:', e);
      return null;
    }
  },

  async fetchAllRemoteSuppliers(companyId?: string): Promise<Supplier[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      let query = client.from('busy_ufo_suppliers').select('*').order('name');
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query;

      if (error || !data) return null;

      return data.map((row: any) => ({
        id: row.id,
        companyId: row.company_id || 'comp-1',
        code: row.code,
        name: row.name,
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        city: row.city || 'Colombo',
        openingBalance: Number(row.opening_balance || 0),
        payableBalance: Number(row.current_balance || 0),
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching suppliers from Supabase:', e);
      return null;
    }
  },

  async fetchAllRemoteSales(companyId?: string): Promise<SaleInvoice[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      let query = client.from('busy_ufo_sales').select('*').order('invoice_date', { ascending: false });
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data: salesData, error: salesError } = await query;
      if (salesError || !salesData) return null;

      // Fetch all sale items
      const saleIds = salesData.map((s: any) => s.id);
      let itemsBySaleId: Record<string, any[]> = {};
      if (saleIds.length > 0) {
        const { data: itemsData } = await client
          .from('busy_ufo_sale_items')
          .select('*')
          .in('invoice_id', saleIds);
        
        if (itemsData) {
          itemsData.forEach((item: any) => {
            if (!itemsBySaleId[item.invoice_id]) itemsBySaleId[item.invoice_id] = [];
            itemsBySaleId[item.invoice_id].push({
              productId: item.product_id || '',
              productCode: item.product_code || '',
              productName: item.product_name || '',
              quantity: Number(item.quantity || 0),
              unitPrice: Number(item.unit_price || 0),
              discount: Number(item.discount || 0),
              discountType: item.discount_type || 'PERCENT',
              total: Number(item.total || 0)
            });
          });
        }
      }

      return salesData.map((row: any) => ({
        id: row.id,
        requestId: row.request_id || row.id,
        companyId: row.company_id || 'comp-1',
        invoiceNumber: row.invoice_number,
        date: row.invoice_date,
        customerId: row.customer_id || undefined,
        customerName: row.customer_name,
        type: row.sale_type as 'CASH' | 'CREDIT',
        items: itemsBySaleId[row.id] || [],
        subtotal: Number(row.total_amount || 0),
        discount: Number(row.overall_discount || 0),
        grandTotal: Number(row.grand_total || 0),
        paidAmount: Number(row.paid_amount || 0),
        dueAmount: Number(row.due_amount || 0),
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching sales from Supabase:', e);
      return null;
    }
  },

  async fetchAllRemotePurchases(companyId?: string): Promise<PurchaseInvoice[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      let query = client.from('busy_ufo_purchases').select('*').order('purchase_date', { ascending: false });
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data: purData, error: purError } = await query;
      if (purError || !purData) return null;

      const purIds = purData.map((p: any) => p.id);
      let itemsByPurId: Record<string, any[]> = {};
      if (purIds.length > 0) {
        const { data: itemsData } = await client
          .from('busy_ufo_purchase_items')
          .select('*')
          .in('purchase_id', purIds);
        
        if (itemsData) {
          itemsData.forEach((item: any) => {
            if (!itemsByPurId[item.purchase_id]) itemsByPurId[item.purchase_id] = [];
            itemsByPurId[item.purchase_id].push({
              productId: item.product_id || '',
              productCode: item.product_code || '',
              productName: item.product_name || '',
              quantity: Number(item.quantity || 0),
              unitCost: Number(item.unit_cost || 0),
              discount: Number(item.discount || 0),
              discountType: item.discount_type || 'PERCENT',
              total: Number(item.total || 0)
            });
          });
        }
      }

      return purData.map((row: any) => ({
        id: row.id,
        requestId: row.request_id || row.id,
        companyId: row.company_id || 'comp-1',
        purchaseNumber: row.purchase_number,
        date: row.purchase_date,
        supplierId: row.supplier_id || '',
        supplierName: row.supplier_name,
        type: row.purchase_type as 'CASH' | 'CREDIT',
        items: itemsByPurId[row.id] || [],
        subtotal: Number(row.total_amount || 0),
        discount: Number(row.overall_discount || 0),
        grandTotal: Number(row.grand_total || 0),
        paidAmount: Number(row.paid_amount || 0),
        dueAmount: Number(row.due_amount || 0),
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching purchases from Supabase:', e);
      return null;
    }
  },

  async fetchAllRemoteReceipts(companyId?: string): Promise<CustomerReceipt[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      let query = client.from('busy_ufo_customer_receipts').select('*').order('date', { ascending: false });
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((row: any) => ({
        id: row.id,
        requestId: row.request_id || row.id,
        companyId: row.company_id || 'comp-1',
        receiptNumber: row.receipt_number,
        date: row.date,
        customerId: row.customer_id || '',
        customerName: row.customer_name,
        amount: Number(row.amount || 0),
        paymentMode: (row.payment_method || 'CASH') as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE',
        referenceNo: row.reference_no || '',
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching receipts from Supabase:', e);
      return null;
    }
  },

  async fetchAllRemotePayments(companyId?: string): Promise<SupplierPayment[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      let query = client.from('busy_ufo_supplier_payments').select('*').order('date', { ascending: false });
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((row: any) => ({
        id: row.id,
        requestId: row.request_id || row.id,
        companyId: row.company_id || 'comp-1',
        paymentNumber: row.payment_number,
        date: row.date,
        supplierId: row.supplier_id || '',
        supplierName: row.supplier_name,
        amount: Number(row.amount || 0),
        paymentMode: (row.payment_method || 'CASH') as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE',
        referenceNo: row.reference_no || '',
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching payments from Supabase:', e);
      return null;
    }
  },

  async fetchAllRemoteExpenses(companyId?: string): Promise<Expense[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      let query = client.from('busy_ufo_expenses').select('*').order('date', { ascending: false });
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((row: any) => ({
        id: row.id,
        requestId: row.request_id || row.id,
        companyId: row.company_id || 'comp-1',
        expenseNumber: row.expense_number,
        date: row.date,
        category: row.category,
        amount: Number(row.amount || 0),
        paidTo: row.paid_to || '',
        paymentMode: (row.payment_method || 'CASH') as 'CASH' | 'BANK_TRANSFER',
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching expenses from Supabase:', e);
      return null;
    }
  },

  // --- PDC MANAGEMENT SYNC & ATOMIC RPC WORKFLOW ---
  async savePdcRpc(pdc: PdcTransaction): Promise<{ success: boolean; data?: any; error?: string; isDuplicate?: boolean }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = pdc.requestId || `req_pdc_save_${pdc.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, pdc.companyId || 'comp-1');

      // Try PostgreSQL RPC
      const { data, error } = await client.rpc('save_pdc_rpc', {
        p_request_id: reqId,
        p_company_id: pdc.companyId || 'comp-1',
        p_type: pdc.type,
        p_party_id: pdc.partyId || null,
        p_party_type: pdc.partyType,
        p_party_name: pdc.partyName,
        p_cheque_number: pdc.chequeNumber,
        p_bank_name: pdc.bankName,
        p_cheque_date: pdc.chequeDate,
        p_amount: Number(pdc.amount || 0),
        p_status: pdc.status || 'PENDING',
        p_reference_voucher_no: pdc.referenceVoucherNo || '',
        p_notes: pdc.notes || ''
      });

      if (!error && data) {
        if (typeof data === 'object' && data.success !== undefined) {
          return { success: data.success, isDuplicate: data.is_duplicate, data: data.data };
        }
        return { success: true, data };
      }

      // If RPC is missing or fails gracefully, fallback to direct upsert
      const payload = {
        id: pdc.id,
        request_id: reqId,
        company_id: pdc.companyId || 'comp-1',
        type: pdc.type,
        party_id: pdc.partyId || null,
        party_type: pdc.partyType,
        party_name: pdc.partyName,
        cheque_number: pdc.chequeNumber,
        bank_name: pdc.bankName,
        cleared_bank_name: pdc.clearedBankName || null,
        cheque_date: pdc.chequeDate,
        amount: Number(pdc.amount || 0),
        status: pdc.status || 'PENDING',
        reference_voucher_no: pdc.referenceVoucherNo || '',
        notes: pdc.notes || '',
        cleared_at: pdc.clearedAt || null,
        deposit_date: pdc.depositDate || null,
        bounce_date: pdc.bounceDate || null,
        bounce_reason: pdc.bounceReason || null,
        bounce_charges: pdc.bounceCharges || 0.00,
        linked_journal_id: pdc.linkedJournalId || null
      };

      const { error: upsertErr } = await client.from('busy_ufo_pdcs').upsert(payload, { onConflict: 'id' });
      if (upsertErr) {
        if (upsertErr.message?.includes('request_id') || upsertErr.code === '23505') {
          return { success: true, isDuplicate: true };
        }
        return { success: false, error: upsertErr.message };
      }
      return { success: true, data: payload };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async depositPdcRpc(
    pdcId: string,
    depositDate: string,
    bankName: string,
    notes?: string,
    requestId?: string
  ): Promise<{ success: boolean; data?: any; error?: string; isDuplicate?: boolean }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = requestId || `req_pdc_dep_${pdcId}_${Date.now()}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'Deposit request already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      const { data, error } = await client.rpc('deposit_pdc_rpc', {
        p_pdc_id: pdcId,
        p_request_id: reqId,
        p_deposit_date: depositDate,
        p_bank_name: bankName,
        p_notes: notes || ''
      });

      if (!error && data) {
        if (typeof data === 'object' && data.success !== undefined) {
          return { success: data.success, data: data.data, isDuplicate: data.is_duplicate };
        }
        return { success: true, data };
      }

      // Fallback direct update
      const { error: updErr } = await client
        .from('busy_ufo_pdcs')
        .update({
          status: 'DEPOSITED',
          deposit_date: depositDate,
          cleared_bank_name: bankName,
          notes: notes ? notes : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', pdcId);

      if (updErr) return { success: false, error: updErr.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async clearPdcRpc(
    pdc: PdcTransaction,
    clearedDate: string,
    clearingBankName: string,
    requestId?: string
  ): Promise<{ success: boolean; data?: any; journalId?: string; voucherNo?: string; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = requestId || `req_pdc_clr_${pdc.id}_${Date.now()}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'Clearance request already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      const bankLedgerId = `bank_${clearingBankName.toLowerCase().replace(/\s+/g, '_')}`;
      const partyLedgerId = pdc.partyId;

      const { data, error } = await client.rpc('clear_pdc_rpc', {
        p_pdc_id: pdc.id,
        p_request_id: reqId,
        p_cleared_date: clearedDate,
        p_bank_ledger_id: bankLedgerId,
        p_bank_ledger_name: clearingBankName,
        p_party_ledger_id: partyLedgerId,
        p_party_ledger_name: pdc.partyName
      });

      if (!error && data) {
        if (typeof data === 'object' && data.success !== undefined) {
          return {
            success: data.success,
            data: data.data,
            journalId: data.journal_id,
            voucherNo: data.voucher_no
          };
        }
        return { success: true, data };
      }

      // Fallback: Client-side atomic orchestration
      const nowIso = new Date().toISOString();
      const jvNo = `JV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const jvId = `jv-pdc-${Date.now()}`;

      // 1. Update PDC
      const { error: updErr } = await client
        .from('busy_ufo_pdcs')
        .update({
          status: 'CLEARED',
          cleared_at: nowIso,
          cleared_bank_name: clearingBankName,
          linked_journal_id: jvId,
          updated_at: nowIso
        })
        .eq('id', pdc.id);

      if (updErr) return { success: false, error: updErr.message };

      // 2. Update Customer / Supplier Outstanding Balance
      if (pdc.type === 'RECEIVED' && pdc.partyId) {
        const { data: cust } = await client.from('busy_ufo_customers').select('current_balance').eq('id', pdc.partyId).single();
        if (cust) {
          const newBal = Number(cust.current_balance || 0) - Number(pdc.amount || 0);
          await client.from('busy_ufo_customers').update({ current_balance: newBal, updated_at: nowIso }).eq('id', pdc.partyId);
        }
      } else if (pdc.type === 'ISSUED' && pdc.partyId) {
        const { data: supp } = await client.from('busy_ufo_suppliers').select('current_balance').eq('id', pdc.partyId).single();
        if (supp) {
          const newBal = Number(supp.current_balance || 0) - Number(pdc.amount || 0);
          await client.from('busy_ufo_suppliers').update({ current_balance: newBal, updated_at: nowIso }).eq('id', pdc.partyId);
        }
      }

      // 3. Post Journal Entry
      const lines = pdc.type === 'RECEIVED'
        ? [
            { id: `${jvId}_1`, journal_id: jvId, entry_id: jvId, ledger_id: bankLedgerId, ledger_name: clearingBankName, account_id: bankLedgerId, account_name: clearingBankName, account_group: 'Bank Accounts', debit: pdc.amount, credit: 0, particulars: `PDC Cheque Cleared #${pdc.chequeNumber}` },
            { id: `${jvId}_2`, journal_id: jvId, entry_id: jvId, ledger_id: pdc.partyId, ledger_name: pdc.partyName, account_id: pdc.partyId, account_name: pdc.partyName, account_group: 'Sundry Debtors', debit: 0, credit: pdc.amount, particulars: `Customer Realized: #${pdc.chequeNumber}` }
          ]
        : [
            { id: `${jvId}_1`, journal_id: jvId, entry_id: jvId, ledger_id: pdc.partyId, ledger_name: pdc.partyName, account_id: pdc.partyId, account_name: pdc.partyName, account_group: 'Sundry Creditors', debit: pdc.amount, credit: 0, particulars: `Supplier Payment Cleared: #${pdc.chequeNumber}` },
            { id: `${jvId}_2`, journal_id: jvId, entry_id: jvId, ledger_id: bankLedgerId, ledger_name: clearingBankName, account_id: bankLedgerId, account_name: clearingBankName, account_group: 'Bank Accounts', debit: 0, credit: pdc.amount, particulars: `Disbursement: Cheque #${pdc.chequeNumber}` }
          ];

      await client.from('busy_ufo_journal_entries').insert({
        id: jvId,
        request_id: `req_jrn_clr_${pdc.id}`,
        company_id: pdc.companyId || 'comp-1',
        entry_number: jvNo,
        voucher_no: jvNo,
        voucher_type: 'PDC',
        voucher_date: clearedDate,
        date: clearedDate,
        narration: `PDC Cleared: Cheque #${pdc.chequeNumber} (${pdc.partyName})`,
        debit_total: pdc.amount,
        credit_total: pdc.amount
      });
      await client.from('busy_ufo_journal_lines').insert(lines);

      return { success: true, journalId: jvId, voucherNo: jvNo };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async bouncePdcRpc(
    pdc: PdcTransaction,
    bounceDate: string,
    bankName: string,
    bounceReason?: string,
    bounceCharges?: number,
    requestId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = requestId || `req_pdc_bnc_${pdc.id}_${Date.now()}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'Bounce request already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      const bankLedgerId = `bank_${bankName.toLowerCase().replace(/\s+/g, '_')}`;
      const partyLedgerId = pdc.partyId;

      const { data, error } = await client.rpc('bounce_pdc_rpc', {
        p_pdc_id: pdc.id,
        p_request_id: reqId,
        p_bounce_date: bounceDate,
        p_bank_ledger_id: bankLedgerId,
        p_bank_ledger_name: bankName,
        p_party_ledger_id: partyLedgerId,
        p_party_ledger_name: pdc.partyName,
        p_bounce_charges: Number(bounceCharges || 0),
        p_notes: bounceReason || 'Dishonored by Bank'
      });

      if (!error && data) {
        if (typeof data === 'object' && data.success !== undefined) {
          return { success: data.success, data: data.data };
        }
        return { success: true, data };
      }

      // Fallback
      const nowIso = new Date().toISOString();
      const wasCleared = pdc.status === 'CLEARED';

      // 1. If previously cleared, reverse customer/supplier balance
      if (wasCleared) {
        if (pdc.type === 'RECEIVED' && pdc.partyId) {
          const { data: cust } = await client.from('busy_ufo_customers').select('current_balance').eq('id', pdc.partyId).single();
          if (cust) {
            const newBal = Number(cust.current_balance || 0) + Number(pdc.amount || 0);
            await client.from('busy_ufo_customers').update({ current_balance: newBal, updated_at: nowIso }).eq('id', pdc.partyId);
          }
        } else if (pdc.type === 'ISSUED' && pdc.partyId) {
          const { data: supp } = await client.from('busy_ufo_suppliers').select('current_balance').eq('id', pdc.partyId).single();
          if (supp) {
            const newBal = Number(supp.current_balance || 0) + Number(pdc.amount || 0);
            await client.from('busy_ufo_suppliers').update({ current_balance: newBal, updated_at: nowIso }).eq('id', pdc.partyId);
          }
        }
      }

      // 2. Update PDC
      const { error: updErr } = await client
        .from('busy_ufo_pdcs')
        .update({
          status: 'BOUNCED',
          bounce_date: bounceDate,
          bounce_reason: bounceReason || 'Dishonored by Bank',
          bounce_charges: Number(bounceCharges || 0),
          updated_at: nowIso
        })
        .eq('id', pdc.id);

      if (updErr) return { success: false, error: updErr.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async cancelPdcRpc(
    pdcId: string,
    reason?: string,
    isReturned: boolean = false,
    requestId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = requestId || `req_pdc_cnc_${pdcId}_${Date.now()}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'Cancellation request already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      const { data, error } = await client.rpc('cancel_pdc_rpc', {
        p_pdc_id: pdcId,
        p_request_id: reqId,
        p_reason: reason || '',
        p_is_returned: isReturned
      });

      if (!error && data) {
        if (typeof data === 'object' && data.success !== undefined) {
          return { success: data.success, data: data.data };
        }
        return { success: true, data };
      }

      // Fallback
      const targetStatus = isReturned ? 'RETURNED' : 'CANCELLED';
      const { error: updErr } = await client
        .from('busy_ufo_pdcs')
        .update({
          status: targetStatus,
          notes: reason ? reason : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', pdcId);

      if (updErr) return { success: false, error: updErr.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async syncPdc(pdc: PdcTransaction): Promise<{ success: boolean; error?: string; isDuplicate?: boolean }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = pdc.requestId || `req_pdc_${pdc.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, pdc.companyId || 'comp-1');

      const payload = {
        id: pdc.id,
        request_id: reqId,
        company_id: pdc.companyId || 'comp-1',
        type: pdc.type,
        party_id: pdc.partyId || null,
        party_type: pdc.partyType,
        party_name: pdc.partyName,
        cheque_number: pdc.chequeNumber,
        bank_name: pdc.bankName,
        cleared_bank_name: pdc.clearedBankName || null,
        cheque_date: pdc.chequeDate,
        amount: Number(pdc.amount || 0),
        status: pdc.status,
        reference_voucher_no: pdc.referenceVoucherNo || '',
        notes: pdc.notes || '',
        cleared_at: pdc.clearedAt || null,
        deposit_date: pdc.depositDate || null,
        bounce_date: pdc.bounceDate || null,
        bounce_reason: pdc.bounceReason || null,
        bounce_charges: pdc.bounceCharges || 0.00,
        linked_journal_id: pdc.linkedJournalId || null
      };

      const { error } = await client.from('busy_ufo_pdcs').upsert(payload, { onConflict: 'id' });
      if (error) {
        if (error.message?.includes('request_id') || error.code === '23505') {
          return { success: true, isDuplicate: true };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async deletePdc(id: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      const { error } = await client.from('busy_ufo_pdcs').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async fetchAllRemotePdcs(companyId?: string): Promise<PdcTransaction[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      let query = client.from('busy_ufo_pdcs').select('*').order('cheque_date', { ascending: true });
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((row: any) => ({
        id: row.id,
        requestId: row.request_id || row.id,
        companyId: row.company_id || 'comp-1',
        type: row.type as any,
        partyId: row.party_id || '',
        partyType: row.party_type as any,
        partyName: row.party_name,
        chequeNumber: row.cheque_number,
        bankName: row.bank_name,
        clearedBankName: row.cleared_bank_name || undefined,
        chequeDate: row.cheque_date,
        amount: Number(row.amount || 0),
        status: row.status as any,
        referenceVoucherNo: row.reference_voucher_no || '',
        notes: row.notes || '',
        clearedAt: row.cleared_at || undefined,
        depositDate: row.deposit_date || undefined,
        bounceDate: row.bounce_date || undefined,
        bounceReason: row.bounce_reason || undefined,
        bounceCharges: Number(row.bounce_charges || 0),
        linkedJournalId: row.linked_journal_id || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || undefined
      }));
    } catch (e) {
      console.error('Error fetching PDCs from Supabase:', e);
      return null;
    }
  },

  // --- JOURNAL ENTRIES SYNC ---
  async syncJournalEntry(entry: JournalEntry): Promise<{ success: boolean; error?: string; isDuplicate?: boolean }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    const reqId = entry.requestId || `req_jrn_${entry.id}`;
    if (_inFlightRequests.has(reqId)) {
      return { success: false, error: 'A transaction with this Request ID is already in-flight.' };
    }
    _inFlightRequests.add(reqId);

    try {
      await ensureCompanyExists(client, entry.companyId || 'comp-1');

      const entryPayload = {
        id: entry.id,
        request_id: reqId,
        company_id: entry.companyId || 'comp-1',
        voucher_no: entry.voucherNo,
        voucher_type: entry.voucherType,
        voucher_date: entry.voucherDate,
        narration: entry.narration || '',
        debit_total: Number(entry.debitTotal || 0),
        credit_total: Number(entry.creditTotal || 0)
      };

      const { error: entryError } = await client.from('busy_ufo_journal_entries').upsert(entryPayload, { onConflict: 'id' });
      if (entryError) {
        if (entryError.message?.includes('request_id') || entryError.code === '23505') {
          return { success: true, isDuplicate: true };
        }
        return { success: false, error: entryError.message };
      }

      if (entry.lines && entry.lines.length > 0) {
        const lineRows = entry.lines.map((l) => ({
          id: l.id || `${entry.id}_line_${Math.random()}`,
          entry_id: entry.id,
          ledger_id: l.ledgerId || null,
          ledger_name: l.ledgerName,
          account_group: l.accountGroup || 'General',
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          particulars: l.particulars || ''
        }));

        await client.from('busy_ufo_journal_lines').delete().eq('entry_id', entry.id);
        await client.from('busy_ufo_journal_lines').insert(lineRows);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    } finally {
      _inFlightRequests.delete(reqId);
    }
  },

  async fetchAllRemoteJournalEntries(companyId?: string): Promise<JournalEntry[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      let query = client.from('busy_ufo_journal_entries').select('*, lines:busy_ufo_journal_lines(*)').order('voucher_date', { ascending: false });
      if (companyId) query = query.eq('company_id', companyId);
      const { data, error } = await query;
      if (error || !data) return null;
      return data.map((row: any) => ({
        id: row.id,
        requestId: row.request_id || row.id,
        companyId: row.company_id || 'comp-1',
        voucherNo: row.voucher_no,
        voucherType: row.voucher_type as any,
        voucherDate: row.voucher_date,
        narration: row.narration || '',
        debitTotal: Number(row.debit_total || 0),
        creditTotal: Number(row.credit_total || 0),
        lines: (row.lines || []).map((l: any) => ({
          id: l.id,
          ledgerId: l.ledger_id || '',
          ledgerName: l.ledger_name,
          accountGroup: l.account_group,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          particulars: l.particulars || ''
        })),
        createdAt: row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching journal entries from Supabase:', e);
      return null;
    }
  },

  // --- SUPABASE REALTIME MULTI-DEVICE SUBSCRIPTION ---
  subscribeToRemoteChanges(callback: (table: string, eventType: string) => void): () => void {
    const client = getSupabaseClient();
    if (!client) return () => {};

    try {
      const channel = client
        .channel('ufo_realtime_sync')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          callback(payload.table, payload.eventType);
        })
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    } catch (e) {
      console.error('Failed to subscribe to Supabase realtime:', e);
      return () => {};
    }
  }
};
