export const SUPABASE_SQL_SCHEMA = `-- ============================================================
-- BUSY UFO - ERP & INVENTORY BILLING SYSTEM
-- Complete PostgreSQL / Supabase SQL Schema & Initial Seed Script
-- ============================================================

-- Enable pgcrypto extension for UUID generation and cryptographic hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- 1. COMPANIES & MULTI-TENANCY CONFIGURATION
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(50) PRIMARY KEY,
    company_name TEXT NOT NULL,
    short_name VARCHAR(20) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    district VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Sri Lanka',
    telephone VARCHAR(50),
    mobile VARCHAR(50),
    company_email VARCHAR(100),
    tax_registration_no VARCHAR(100),
    currency VARCHAR(20) DEFAULT 'Rs.',
    financial_year_start DATE DEFAULT '2026-01-01',
    financial_year_end DATE DEFAULT '2026-12-31',
    invoice_prefix VARCHAR(20) DEFAULT 'INV',
    invoice_number INT DEFAULT 1001,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    -- VAT / Tax Configuration
    is_vat_enabled BOOLEAN DEFAULT TRUE,
    vat_number VARCHAR(100),
    default_vat_rate NUMERIC(5, 2) DEFAULT 18.00,
    vat_type VARCHAR(20) DEFAULT 'EXCLUSIVE' CHECK (vat_type IN ('INCLUSIVE', 'EXCLUSIVE')),
    -- Item-wise Discount Configuration
    is_item_discount_enabled BOOLEAN DEFAULT TRUE,
    default_discount_type VARCHAR(20) DEFAULT 'PERCENT' CHECK (default_discount_type IN ('PERCENT', 'FIXED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Upgrade existing companies table if created in earlier versions
ALTER TABLE companies ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Sri Lanka';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_vat_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vat_number VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(5, 2) DEFAULT 18.00;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vat_type VARCHAR(20) DEFAULT 'EXCLUSIVE';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_item_discount_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_discount_type VARCHAR(20) DEFAULT 'PERCENT';

-- ------------------------------------------------------------
-- 2. USERS & ROLES SECURITY TABLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(50) PRIMARY KEY,
    permission_key VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS app_users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    username_normalized VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role_id VARCHAR(50) NOT NULL,
    role_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    assigned_company_ids JSONB DEFAULT '[]',
    permission_overrides JSONB DEFAULT '{}',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add any newly introduced columns and convert id type from UUID to VARCHAR(100) if table pre-existed
ALTER TABLE IF EXISTS user_company_assignments DROP CONSTRAINT IF EXISTS user_company_assignments_user_id_fkey;
ALTER TABLE IF EXISTS user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;
ALTER TABLE IF EXISTS audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE IF EXISTS app_users ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS app_users ADD COLUMN IF NOT EXISTS role_name VARCHAR(100);
ALTER TABLE IF EXISTS app_users ADD COLUMN IF NOT EXISTS assigned_company_ids JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS app_users ADD COLUMN IF NOT EXISTS permission_overrides JSONB DEFAULT '{}';
ALTER TABLE IF EXISTS app_users DROP CONSTRAINT IF EXISTS app_users_role_id_fkey;

CREATE TABLE IF NOT EXISTS user_company_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role_id VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_user_company UNIQUE (user_id, company_id)
);
ALTER TABLE IF EXISTS user_company_assignments ALTER COLUMN user_id TYPE VARCHAR(100) USING user_id::text;
ALTER TABLE IF EXISTS user_company_assignments DROP CONSTRAINT IF EXISTS user_company_assignments_role_id_fkey;

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id VARCHAR(100) NOT NULL,
    permission_id VARCHAR(50) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, permission_id)
);
ALTER TABLE IF EXISTS user_permissions ALTER COLUMN user_id TYPE VARCHAR(100) USING user_id::text;

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(150) NOT NULL,
    user_email VARCHAR(150),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    details TEXT NOT NULL,
    target_id VARCHAR(100),
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- 3. CHART OF ACCOUNT GROUPS & MASTER DATA TABLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS busy_ufo_account_groups (
    no INT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    nature VARCHAR(50) NOT NULL CHECK (nature IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
    parent_group VARCHAR(150),
    category VARCHAR(100),
    normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('Dr', 'Cr')),
    description TEXT,
    is_subgroup BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed standard 29 Account Groups
INSERT INTO busy_ufo_account_groups (no, name, nature, parent_group, category, normal_balance, description, is_subgroup)
VALUES
(1, 'Bank Accounts', 'ASSET', 'Current Assets', 'Bank & Cash', 'Dr', 'Current and savings bank accounts maintained with commercial banks.', FALSE),
(2, 'Bank O/D Accounts', 'LIABILITY', 'Loans (Liability)', 'Loans & Borrowings', 'Cr', 'Bank overdraft accounts, credit facilities, and short-term bank borrowings.', FALSE),
(3, 'Capital Account', 'EQUITY', 'Capital & Equity', 'Capital & Equity', 'Cr', 'Owner''s capital, share capital, proprietor equity, and partner investments.', FALSE),
(4, 'Cash-in-Hand', 'ASSET', 'Current Assets', 'Bank & Cash', 'Dr', 'Physical cash balances, main cash register, and petty cash accounts.', FALSE),
(5, 'Current Assets', 'ASSET', 'Assets', 'Current Assets', 'Dr', 'Short-term assets expected to be converted into cash within one fiscal year.', FALSE),
(6, 'Current Liabilities', 'LIABILITY', 'Liabilities', 'Current Liabilities', 'Cr', 'Short-term financial obligations and debts payable within one fiscal year.', FALSE),
(7, 'Duties & Taxes', 'LIABILITY', 'Current Liabilities', 'Duties & Taxes', 'Cr', 'Tax payables/receivables including VAT, SVAT, NBT, Income Tax, and Customs duties.', FALSE),
(8, 'Expenses (Direct / Mfg.)', 'EXPENSE', 'Trading Account', 'Direct Expenses', 'Dr', 'Direct manufacturing costs, direct labor, factory freight, and production overheads.', FALSE),
(9, 'Expenses (Indirect / Admn.)', 'EXPENSE', 'Profit & Loss Account', 'Indirect Expenses', 'Dr', 'Administrative, selling, distribution, office rent, utilities, and general expenses.', FALSE),
(10, 'Fixed Assets', 'ASSET', 'Assets', 'Fixed Assets', 'Dr', 'Long-term tangible assets: Land & Buildings, Machinery, Vehicles, Computers, Furniture.', FALSE),
(11, 'Income (Direct / Opr.)', 'INCOME', 'Trading Account', 'Direct Income', 'Cr', 'Operating revenues generated directly from primary business activities.', FALSE),
(12, 'Income (Indirect)', 'INCOME', 'Profit & Loss Account', 'Indirect Income', 'Cr', 'Non-operating revenue: Interest received, discounts earned, commissions, exchange gains.', FALSE),
(13, 'Investments', 'ASSET', 'Assets', 'Investments', 'Dr', 'Long-term and short-term financial investments, fixed deposits, bonds, and shares.', FALSE),
(14, 'Loans & Advances (Assets)', 'ASSET', 'Current Assets', 'Loans & Advances', 'Dr', 'Loans given to employees, staff salary advances, and recoverable supplier deposits.', FALSE),
(15, 'Loans (Liability)', 'LIABILITY', 'Liabilities', 'Loans & Borrowings', 'Cr', 'Long-term and medium-term loan borrowings from financial institutions and third parties.', FALSE),
(16, 'Pre-operative Expenses', 'ASSET', 'Miscellaneous Expenses', 'Other Assets', 'Dr', 'Preliminary and pre-incorporation setup expenses amortized over time.', FALSE),
(17, 'Profit & Loss', 'EQUITY', 'Reserves & Surplus', 'Capital & Equity', 'Cr', 'Cumulative retained earnings and profit/loss balance brought forward.', FALSE),
(18, 'Provisions / Expenses Payable', 'LIABILITY', 'Current Liabilities', 'Provisions & Payables', 'Cr', 'Accrued expenses, audit fees payable, salary provisions, and utility bill accruals.', FALSE),
(19, 'Purchase', 'EXPENSE', 'Trading Account', 'Purchase Accounts', 'Dr', 'Purchase of raw materials, merchandise trading inventory, and purchase returns.', FALSE),
(20, 'Reserves & Surplus', 'EQUITY', 'Capital Account', 'Capital & Equity', 'Cr', 'General reserves, statutory reserves, revaluation reserves, and retained capital.', FALSE),
(21, 'Revenue Accounts', 'INCOME', 'Trading / Profit & Loss', 'Sales & Revenue', 'Cr', 'General revenue streams, recurring contract services, and trading income.', FALSE),
(22, 'Sale', 'INCOME', 'Trading Account', 'Sales & Revenue', 'Cr', 'Product sales, wholesale trading, retail cash sales, and sales returns accounts.', FALSE),
(23, 'Secured Loans', 'LIABILITY', 'Loans (Liability)', 'Loans & Borrowings', 'Cr', 'Mortgages, bank term loans, and credit facilities backed by collateral or assets.', FALSE),
(24, 'Sundry Creditors', 'LIABILITY', 'Current Liabilities', 'Trade Creditors (Suppliers)', 'Cr', 'Trade suppliers and vendors from whom goods or services are purchased on credit.', FALSE),
(25, 'Sundry Debtors', 'ASSET', 'Current Assets', 'Trade Debtors (Customers)', 'Dr', 'Trade customers and clients to whom goods or services are sold on credit terms.', FALSE),
(26, 'Unsecured Loans', 'LIABILITY', 'Loans (Liability)', 'Loans & Borrowings', 'Cr', 'Director loans, friend/family advances, and non-collateralized borrowing.', FALSE),
(27, 'Duties & Taxes – related subgroups', 'LIABILITY', 'Duties & Taxes', 'Duties & Taxes', 'Cr', 'Subgroups under tax: VAT Output, VAT Input, WHT, Stamp Duty, Customs Tariff.', TRUE),
(28, 'Current Assets – related subgroups', 'ASSET', 'Current Assets', 'Current Assets', 'Dr', 'Subgroups under Current Assets: Prepaid Expenses, Security Deposits, Temporary Advances.', TRUE),
(29, 'Current Liabilities – related subgroups', 'LIABILITY', 'Current Liabilities', 'Current Liabilities', 'Cr', 'Subgroups under Current Liabilities: Customer Advance Deposits, Unearned Revenue.', TRUE)
ON CONFLICT (no) DO UPDATE SET
    name = EXCLUDED.name,
    nature = EXCLUDED.nature,
    parent_group = EXCLUDED.parent_group,
    category = EXCLUDED.category,
    normal_balance = EXCLUDED.normal_balance,
    description = EXCLUDED.description,
    is_subgroup = EXCLUDED.is_subgroup;

CREATE TABLE IF NOT EXISTS busy_ufo_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default_settings',
    company_name TEXT NOT NULL DEFAULT 'Colombo Retailers & Wholesalers',
    company_address TEXT DEFAULT '124 Main Street, Pettah, Colombo 11, Sri Lanka',
    company_phone TEXT DEFAULT '+94 11 234 5678',
    company_email TEXT DEFAULT 'info@colombotraders.lk',
    tax_registration_no VARCHAR(100),
    currency_symbol VARCHAR(20) DEFAULT 'Rs.',
    currency_code VARCHAR(20) DEFAULT 'LKR',
    allow_negative_stock BOOLEAN DEFAULT FALSE,
    initial_cash_balance NUMERIC(12, 2) DEFAULT 50000.00,
    invoice_note TEXT DEFAULT 'Thank you for your business! Goods sold are non-refundable.',
    default_print_format VARCHAR(20) DEFAULT 'A4',
    print_font_size VARCHAR(20) DEFAULT 'normal',
    dot_matrix_dashed_borders BOOLEAN DEFAULT TRUE,
    custom_page_width_mm NUMERIC(6, 2) DEFAULT 210.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS busy_ufo_customers (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Colombo',
    district VARCHAR(100) DEFAULT 'Colombo',
    account_group VARCHAR(100) DEFAULT 'Sundry Debtors',
    opening_balance NUMERIC(12, 2) DEFAULT 0.00,
    current_balance NUMERIC(12, 2) DEFAULT 0.00,
    credit_limit NUMERIC(12, 2) DEFAULT 100000.00,
    is_active BOOLEAN DEFAULT TRUE,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE busy_ufo_customers ADD COLUMN IF NOT EXISTS district VARCHAR(100) DEFAULT 'Colombo';
ALTER TABLE busy_ufo_customers ADD COLUMN IF NOT EXISTS account_group VARCHAR(100) DEFAULT 'Sundry Debtors';

CREATE TABLE IF NOT EXISTS busy_ufo_suppliers (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100) DEFAULT 'Colombo',
    district VARCHAR(100) DEFAULT 'Colombo',
    account_group VARCHAR(100) DEFAULT 'Sundry Creditors',
    opening_balance NUMERIC(12, 2) DEFAULT 0.00,
    current_balance NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE busy_ufo_suppliers ADD COLUMN IF NOT EXISTS district VARCHAR(100) DEFAULT 'Colombo';
ALTER TABLE busy_ufo_suppliers ADD COLUMN IF NOT EXISTS account_group VARCHAR(100) DEFAULT 'Sundry Creditors';

CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS busy_ufo_products (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    unit VARCHAR(20) DEFAULT 'Pcs',
    cost_price NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    selling_price NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    vat_rate NUMERIC(5, 2) DEFAULT 0.00,
    current_stock NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    reorder_level NUMERIC(18, 4) NOT NULL DEFAULT 10.0000,
    opening_stock NUMERIC(18, 4) DEFAULT 0.0000,
    opening_rate NUMERIC(18, 4) DEFAULT 0.0000,
    opening_value NUMERIC(18, 2) DEFAULT 0.00,
    excel_stock_value NUMERIC(18, 2) DEFAULT 0.00,
    calculated_stock_value NUMERIC(18, 2) DEFAULT 0.00,
    value_difference NUMERIC(18, 2) DEFAULT 0.00,
    import_source VARCHAR(50) DEFAULT 'BUSY_EXCEL',
    import_batch_id VARCHAR(50),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 0.00;
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS opening_stock NUMERIC(18, 4) DEFAULT 0.0000;
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS opening_rate NUMERIC(18, 4) DEFAULT 0.0000;
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS opening_value NUMERIC(18, 2) DEFAULT 0.00;
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS excel_stock_value NUMERIC(18, 2) DEFAULT 0.00;
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS calculated_stock_value NUMERIC(18, 2) DEFAULT 0.00;
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS value_difference NUMERIC(18, 2) DEFAULT 0.00;
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS import_source VARCHAR(50) DEFAULT 'BUSY_EXCEL';
ALTER TABLE busy_ufo_products ADD COLUMN IF NOT EXISTS import_batch_id VARCHAR(50);

-- ------------------------------------------------------------
-- 4. INVOICES & TRANSACTIONS TABLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS busy_ufo_sales (
    id VARCHAR(50) PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    customer_id VARCHAR(50) REFERENCES busy_ufo_customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('CASH', 'CREDIT')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    item_discount_total NUMERIC(12, 2) DEFAULT 0.00,
    overall_discount NUMERIC(12, 2) DEFAULT 0.00,
    vat_amount NUMERIC(12, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID')),
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS busy_ufo_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(50) NOT NULL REFERENCES busy_ufo_sales(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES busy_ufo_products(id) ON DELETE SET NULL,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00,
    discount_type VARCHAR(20) DEFAULT 'PERCENT' CHECK (discount_type IN ('PERCENT', 'FIXED')),
    total NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS busy_ufo_purchases (
    id VARCHAR(50) PRIMARY KEY,
    purchase_number VARCHAR(50) NOT NULL,
    purchase_date DATE NOT NULL,
    supplier_id VARCHAR(50) REFERENCES busy_ufo_suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(150) NOT NULL,
    purchase_type VARCHAR(20) NOT NULL CHECK (purchase_type IN ('CASH', 'CREDIT')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    item_discount_total NUMERIC(12, 2) DEFAULT 0.00,
    overall_discount NUMERIC(12, 2) DEFAULT 0.00,
    vat_amount NUMERIC(12, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID')),
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS busy_ufo_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id VARCHAR(50) NOT NULL REFERENCES busy_ufo_purchases(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES busy_ufo_products(id) ON DELETE SET NULL,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00,
    discount_type VARCHAR(20) DEFAULT 'PERCENT' CHECK (discount_type IN ('PERCENT', 'FIXED')),
    total NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS busy_ufo_customer_receipts (
    id VARCHAR(50) PRIMARY KEY,
    receipt_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    customer_id VARCHAR(50) REFERENCES busy_ufo_customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE')),
    reference_no VARCHAR(100),
    invoice_id VARCHAR(50) REFERENCES busy_ufo_sales(id) ON DELETE SET NULL,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS busy_ufo_supplier_payments (
    id VARCHAR(50) PRIMARY KEY,
    payment_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    supplier_id VARCHAR(50) REFERENCES busy_ufo_suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(150) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE')),
    reference_no VARCHAR(100),
    purchase_id VARCHAR(50) REFERENCES busy_ufo_purchases(id) ON DELETE SET NULL,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS busy_ufo_expenses (
    id VARCHAR(50) PRIMARY KEY,
    expense_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER')),
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 5. INITIAL SAMPLE SEED DATA
-- ------------------------------------------------------------

-- Seed Companies
INSERT INTO companies (
    id, company_name, short_name, address, city, district, country, telephone, mobile, company_email, tax_registration_no, currency, financial_year_start, financial_year_end, invoice_prefix, invoice_number, is_active, is_vat_enabled, vat_number, default_vat_rate, vat_type, is_item_discount_enabled, default_discount_type
) VALUES
('comp-abc-traders', 'ABC Traders Ltd', 'ABC', '124 Main Street, Pettah, Colombo 11, Sri Lanka', 'Colombo 11', 'Colombo', 'Sri Lanka', '+94 11 234 5678', '+94 77 123 4567', 'sales@abctraders.lk', 'VAT-10928374-7000', 'Rs.', '2026-01-01', '2026-12-31', 'INV', 1001, TRUE, TRUE, 'VAT-10928374-7000', 18.00, 'EXCLUSIVE', TRUE, 'PERCENT'),
('comp-xyz-enterprises', 'XYZ Enterprises', 'XYZ', '45 Galle Road, Bambalapitiya, Colombo 04, Sri Lanka', 'Colombo 04', 'Colombo', 'Sri Lanka', '+94 11 567 8900', '+94 71 987 6543', 'contact@xyzenterprises.lk', 'VAT-88371920-5000', 'Rs.', '2026-01-01', '2026-12-31', 'XYZ-INV', 501, TRUE, TRUE, 'VAT-88371920-5000', 15.00, 'INCLUSIVE', TRUE, 'FIXED'),
('comp-kumar-hardware', 'Kumar Hardware', 'KHW', '88 Kandy Road, Kiribathgoda, Sri Lanka', 'Kiribathgoda', 'Gampaha', 'Sri Lanka', '+94 33 221 1000', '+94 70 334 4556', 'sales@kumarhardware.lk', 'VAT-55112233-1000', 'Rs.', '2026-01-01', '2026-12-31', 'KHW-INV', 101, TRUE, FALSE, '', 0.00, 'EXCLUSIVE', TRUE, 'PERCENT')
ON CONFLICT (id) DO NOTHING;

-- Seed System Roles
INSERT INTO roles (id, role_name, description, is_system_role) VALUES
('role-admin', 'Administrator', 'Full unrestricted access to all business operations, settings, users, and security controls.', TRUE),
('role-manager', 'Manager', 'Full business operations access without user management rights.', TRUE),
('role-sales', 'Sales User', 'Dedicated POS & Sales role. Create invoices, view clients, and print sales documents.', TRUE),
('role-purchase', 'Purchase User', 'Procurement role. Manage suppliers, record purchases, and issue vendor payments.', TRUE),
('role-inventory', 'Inventory User', 'Warehouse & stock role. Manage product items and stock adjustments.', TRUE),
('role-accounts', 'Accounts User', 'Financial accounting role. Manage payments, receipts, and expenses.', TRUE),
('role-report', 'Report User', 'Analytical read-only role. View and export reports.', TRUE),
('role-viewer', 'Viewer', 'Strict read-only viewer role without creation or editing rights.', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Admin User (Password: admin123)
INSERT INTO app_users (
    id, username, username_normalized, full_name, email, password_hash, salt, role_id, is_active, is_super_admin
) VALUES (
    'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6', 'admin', 'admin', 'Administrator', 'admin@busy.com',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'salt123456', 'role-admin', TRUE, TRUE
) ON CONFLICT (username) DO NOTHING;

-- Assign Admin User to All Companies
INSERT INTO user_company_assignments (user_id, company_id, role_id, is_active) VALUES
('a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6', 'comp-abc-traders', 'role-admin', TRUE),
('a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6', 'comp-xyz-enterprises', 'role-admin', TRUE),
('a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6', 'comp-kumar-hardware', 'role-admin', TRUE)
ON CONFLICT DO NOTHING;

-- Seed Customers
INSERT INTO busy_ufo_customers (id, code, name, phone, email, address, city, district, opening_balance, current_balance, credit_limit, company_id) VALUES
('cust-1', 'CUST-001', 'Perera Electronics Store', '+94 11 289 1000', 'info@pereraelec.lk', '12 Station Road, Nugegoda', 'Nugegoda', 'Colombo', 0.00, 45000.00, 150000.00, 'comp-abc-traders'),
('cust-2', 'CUST-002', 'Liyanage Supermart', '+94 31 223 4567', 'orders@liyanagesuper.lk', '45 Main Street, Negombo', 'Negombo', 'Gampaha', 10000.00, 28500.00, 200000.00, 'comp-abc-traders'),
('cust-3', 'CUST-003', 'Silva Hardware & Tools', '+94 81 222 3344', 'contact@silvahardware.lk', '78 Dalada Veediya, Kandy', 'Kandy', 'Kandy', 0.00, 0.00, 100000.00, 'comp-abc-traders')
ON CONFLICT (id) DO NOTHING;

-- Seed Suppliers
INSERT INTO busy_ufo_suppliers (id, code, name, phone, email, address, city, district, opening_balance, current_balance, company_id) VALUES
('supp-1', 'SUPP-001', 'Lanka Wholesalers Pvt Ltd', '+94 11 456 7890', 'sales@lankawholesale.lk', '256 Goods Shed Road, Pettah', 'Colombo 11', 'Colombo', 0.00, 62000.00, 'comp-abc-traders'),
('supp-2', 'SUPP-002', 'Singer Lanka Distributors', '+94 11 231 6000', 'b2b@singersl.com', '112 Havelock Road, Colombo 05', 'Colombo 05', 'Colombo', 0.00, 0.00, 'comp-abc-traders')
ON CONFLICT (id) DO NOTHING;

-- Seed Products
INSERT INTO busy_ufo_products (id, code, barcode, name, description, category, unit, cost_price, selling_price, vat_rate, current_stock, reorder_level, company_id) VALUES
('prod-1', 'PRD-001', '4791234567890', 'LED TV 32 Inch Smart', 'Full HD Smart TV with Wi-Fi', 'Electronics', 'Pcs', 38000.00, 48500.00, 18.00, 14.00, 5.00, 'comp-abc-traders'),
('prod-2', 'PRD-002', '4791234567891', 'Electric Rice Cooker 1.8L', 'Non-stick warm keeping rice cooker', 'Appliances', 'Pcs', 6500.00, 8900.00, 18.00, 28.00, 8.00, 'comp-abc-traders'),
('prod-3', 'PRD-003', '4791234567892', 'Refrigerators Dual Door 210L', 'Energy efficient inverter refrigerator', 'Appliances', 'Pcs', 92000.00, 115000.00, 18.00, 6.00, 2.00, 'comp-abc-traders'),
('prod-4', 'PRD-004', '4791234567893', 'Ceiling Fan 56 Inch White', 'Heavy duty copper motor fan', 'Electricals', 'Pcs', 7200.00, 9800.00, 18.00, 45.00, 10.00, 'comp-abc-traders'),
('prod-5', 'PRD-005', '4791234567894', 'Stand Fan 16 Inch Remote', '3-speed oscillation stand fan', 'Electricals', 'Pcs', 8100.00, 11200.00, 18.00, 18.00, 5.00, 'comp-abc-traders')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 6. INDEXES FOR FAST QUERYING
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_username_norm ON app_users(username_normalized);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_products_code ON busy_ufo_products(code);
CREATE INDEX IF NOT EXISTS idx_customers_code ON busy_ufo_customers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON busy_ufo_suppliers(code);
CREATE INDEX IF NOT EXISTS idx_sales_date ON busy_ufo_sales(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON busy_ufo_purchases(purchase_date);

-- ------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) & PUBLIC ACCESS PERMISSIONS
-- ------------------------------------------------------------
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_account_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_customer_receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_supplier_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE busy_ufo_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Companies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow all on companies') THEN
        CREATE POLICY "Allow all on companies" ON companies FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Account Groups
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_account_groups' AND policyname = 'Allow all on busy_ufo_account_groups') THEN
        CREATE POLICY "Allow all on busy_ufo_account_groups" ON busy_ufo_account_groups FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Settings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_settings' AND policyname = 'Allow all on busy_ufo_settings') THEN
        CREATE POLICY "Allow all on busy_ufo_settings" ON busy_ufo_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Products
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_products' AND policyname = 'Allow all on busy_ufo_products') THEN
        CREATE POLICY "Allow all on busy_ufo_products" ON busy_ufo_products FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Customers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_customers' AND policyname = 'Allow all on busy_ufo_customers') THEN
        CREATE POLICY "Allow all on busy_ufo_customers" ON busy_ufo_customers FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Suppliers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_suppliers' AND policyname = 'Allow all on busy_ufo_suppliers') THEN
        CREATE POLICY "Allow all on busy_ufo_suppliers" ON busy_ufo_suppliers FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Sales
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_sales' AND policyname = 'Allow all on busy_ufo_sales') THEN
        CREATE POLICY "Allow all on busy_ufo_sales" ON busy_ufo_sales FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Sale items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_sale_items' AND policyname = 'Allow all on busy_ufo_sale_items') THEN
        CREATE POLICY "Allow all on busy_ufo_sale_items" ON busy_ufo_sale_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Purchases
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_purchases' AND policyname = 'Allow all on busy_ufo_purchases') THEN
        CREATE POLICY "Allow all on busy_ufo_purchases" ON busy_ufo_purchases FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Purchase items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_purchase_items' AND policyname = 'Allow all on busy_ufo_purchase_items') THEN
        CREATE POLICY "Allow all on busy_ufo_purchase_items" ON busy_ufo_purchase_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Receipts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_customer_receipts' AND policyname = 'Allow all on busy_ufo_customer_receipts') THEN
        CREATE POLICY "Allow all on busy_ufo_customer_receipts" ON busy_ufo_customer_receipts FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Payments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_supplier_payments' AND policyname = 'Allow all on busy_ufo_supplier_payments') THEN
        CREATE POLICY "Allow all on busy_ufo_supplier_payments" ON busy_ufo_supplier_payments FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Expenses
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'busy_ufo_expenses' AND policyname = 'Allow all on busy_ufo_expenses') THEN
        CREATE POLICY "Allow all on busy_ufo_expenses" ON busy_ufo_expenses FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Users & Roles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_users' AND policyname = 'Allow all on app_users') THEN
        CREATE POLICY "Allow all on app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roles' AND policyname = 'Allow all on roles') THEN
        CREATE POLICY "Allow all on roles" ON roles FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'permissions' AND policyname = 'Allow all on permissions') THEN
        CREATE POLICY "Allow all on permissions" ON permissions FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'Allow all on role_permissions') THEN
        CREATE POLICY "Allow all on role_permissions" ON role_permissions FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_company_assignments' AND policyname = 'Allow all on user_company_assignments') THEN
        CREATE POLICY "Allow all on user_company_assignments" ON user_company_assignments FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_permissions' AND policyname = 'Allow all on user_permissions') THEN
        CREATE POLICY "Allow all on user_permissions" ON user_permissions FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Allow all on audit_logs') THEN
        CREATE POLICY "Allow all on audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;
