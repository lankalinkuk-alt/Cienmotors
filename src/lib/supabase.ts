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
  AppUser
} from '../types';

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

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
    await client.from('companies').upsert({
      id: 'comp-1',
      company_name: 'Default Company',
      short_name: 'DEFAULT',
      is_active: true
    }, { onConflict: 'id' });

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
    const rawCompanies = localStorage.getItem('busy_ufo_companies');
    let compName = 'Default Company';
    let shortName = 'DEFAULT';
    if (rawCompanies) {
      const companies = JSON.parse(rawCompanies);
      const matched = companies.find((c: any) => c.id === compId);
      if (matched) {
        compName = matched.companyName || matched.company_name || compName;
        shortName = matched.shortName || matched.short_name || shortName;
      }
    }
    await client.from('companies').upsert({
      id: compId,
      company_name: compName,
      short_name: shortName,
      is_active: true
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Failed to ensure company row in Supabase:', e);
  }
}

// ==========================================
// SUPABASE REAL-TIME CLOUD SYNC ENGINE
// ==========================================

export const SupabaseSyncService = {
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

      return data.map((row: any) => ({
        id: row.id,
        companyName: row.company_name || row.companyName || 'Unnamed Company',
        shortName: row.short_name || row.shortName || 'COMP',
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
      }));
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

  // --- SALES INVOICES ---
  async syncSaleInvoice(sale: SaleInvoice): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
      await ensureCompanyExists(client, sale.companyId || 'comp-1');

      const salePayload = {
        id: sale.id,
        invoice_number: sale.invoiceNumber,
        invoice_date: sale.date,
        customer_id: sale.customerId || null,
        customer_name: sale.customerName,
        sale_type: sale.type,
        total_amount: Number(sale.subtotal || 0),
        overall_discount: Number(sale.discount || 0),
        vat_amount: 0,
        grand_total: Number(sale.grandTotal || 0),
        paid_amount: Number(sale.paidAmount || 0),
        due_amount: Number(sale.dueAmount || 0),
        payment_status: sale.dueAmount <= 0 ? 'PAID' : (sale.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'),
        company_id: sale.companyId || 'comp-1',
        notes: sale.notes || ''
      };

      const { error: saleError } = await client
        .from('busy_ufo_sales')
        .upsert(salePayload, { onConflict: 'id' });

      if (saleError) {
        console.warn('Supabase sale sync error:', saleError);
        return { success: false, error: saleError.message };
      }

      // Upsert Items
      if (sale.items && sale.items.length > 0) {
        const itemRows = sale.items.map((item) => ({
          invoice_id: sale.id,
          product_id: item.productId || null,
          product_code: item.productCode || '',
          product_name: item.productName || '',
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unitPrice || 0),
          discount: Number(item.discount || 0),
          discount_type: item.discountType || 'PERCENT',
          total: Number(item.total || 0)
        }));

        await client.from('busy_ufo_sale_items').delete().eq('invoice_id', sale.id);
        await client.from('busy_ufo_sale_items').insert(itemRows);
      }

      return { success: true };
    } catch (e: any) {
      console.warn('Supabase sale sync exception:', e);
      return { success: false, error: e?.message };
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
  async syncPurchaseInvoice(purchase: PurchaseInvoice): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };

    try {
      await ensureCompanyExists(client, purchase.companyId || 'comp-1');

      const purchasePayload = {
        id: purchase.id,
        purchase_number: purchase.purchaseNumber,
        purchase_date: purchase.date,
        supplier_id: purchase.supplierId || null,
        supplier_name: purchase.supplierName,
        purchase_type: purchase.type,
        total_amount: Number(purchase.subtotal || 0),
        overall_discount: Number(purchase.discount || 0),
        vat_amount: 0,
        grand_total: Number(purchase.grandTotal || 0),
        paid_amount: Number(purchase.paidAmount || 0),
        due_amount: Number(purchase.dueAmount || 0),
        payment_status: purchase.dueAmount <= 0 ? 'PAID' : (purchase.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'),
        company_id: purchase.companyId || 'comp-1',
        notes: purchase.notes || ''
      };

      const { error: purError } = await client
        .from('busy_ufo_purchases')
        .upsert(purchasePayload, { onConflict: 'id' });

      if (purError) {
        console.warn('Supabase purchase sync error:', purError);
        return { success: false, error: purError.message };
      }

      if (purchase.items && purchase.items.length > 0) {
        const itemRows = purchase.items.map((item) => ({
          purchase_id: purchase.id,
          product_id: item.productId || null,
          product_code: item.productCode || '',
          product_name: item.productName || '',
          quantity: Number(item.quantity || 0),
          unit_cost: Number(item.unitCost || 0),
          discount: Number(item.discount || 0),
          discount_type: item.discountType || 'PERCENT',
          total: Number(item.total || 0)
        }));

        await client.from('busy_ufo_purchase_items').delete().eq('purchase_id', purchase.id);
        await client.from('busy_ufo_purchase_items').insert(itemRows);
      }

      return { success: true };
    } catch (e: any) {
      console.warn('Supabase purchase sync exception:', e);
      return { success: false, error: e?.message };
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
  async syncReceipt(receipt: CustomerReceipt): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      await ensureCompanyExists(client, receipt.companyId || 'comp-1');
      const payload = {
        id: receipt.id,
        receipt_number: receipt.receiptNumber,
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
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
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

  async syncPayment(payment: SupplierPayment): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      await ensureCompanyExists(client, payment.companyId || 'comp-1');
      const payload = {
        id: payment.id,
        payment_number: payment.paymentNumber,
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
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
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

  async syncExpense(expense: Expense): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not configured' };
    try {
      await ensureCompanyExists(client, expense.companyId || 'comp-1');
      const payload = {
        id: expense.id,
        expense_number: expense.expenseNumber,
        date: expense.date,
        category: expense.category,
        amount: Number(expense.amount || 0),
        payment_method: expense.paymentMode || 'CASH',
        notes: expense.notes || '',
        company_id: expense.companyId || 'comp-1'
      };
      const { error } = await client.from('busy_ufo_expenses').upsert(payload, { onConflict: 'id' });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
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
        companyId: row.company_id || 'comp-1',
        expenseNumber: row.expense_number,
        date: row.date,
        category: row.category,
        amount: Number(row.amount || 0),
        paymentMode: (row.payment_method || 'CASH') as 'CASH' | 'BANK_TRANSFER',
        notes: row.notes || '',
        createdAt: row.created_at || new Date().toISOString()
      }));
    } catch (e) {
      console.error('Error fetching expenses from Supabase:', e);
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
