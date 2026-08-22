export interface Company {
  id: string;
  companyName: string;
  shortName: string;
  address: string;
  city: string;
  district?: string;
  country: string;
  telephone: string;
  mobile?: string;
  companyEmail?: string;
  taxRegistrationNo?: string;
  currency: string;
  financialYearStart: string;
  financialYearEnd: string;
  invoicePrefix: string;
  invoiceNumber: number;
  logoUrl?: string;
  isActive: boolean;
  // VAT / Tax Configuration
  isVatEnabled?: boolean;
  vatNumber?: string;
  defaultVatRate?: number;
  vatType?: 'INCLUSIVE' | 'EXCLUSIVE';
  // Item-wise Discount Configuration
  isItemDiscountEnabled?: boolean;
  defaultDiscountType?: 'PERCENT' | 'FIXED';
  createdAt: string;
  updatedAt: string;
}

export interface UserCompanyAssignment {
  id: string;
  userId: string;
  companyId: string;
  roleId: string; // role for this specific company
  permissionOverrides?: Partial<Record<PermissionKey, boolean>>; // company-specific rights overrides
  isActive: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  companyName?: string;
  phone: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  accountGroup?: string;
  openingBalance: number; // amount
  openingBalanceType?: 'Dr' | 'Cr'; // Dr = Customer owes us, Cr = We owe customer (advance)
  outstandingBalance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  companyName?: string;
  phone: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  accountGroup?: string;
  openingBalance: number; // amount
  openingBalanceType?: 'Dr' | 'Cr'; // Cr = We owe supplier, Dr = Advance to supplier
  payableBalance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface UnitDefinition {
  code: string; // e.g. "Nos", "Pcs", "Kg", "Box", "Ctn"
  name: string; // e.g. "Numbers", "Pieces", "Kilograms", "Box", "Carton"
  category: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'PACKAGING';
  isSystem?: boolean;
}

export interface UnitConversionRule {
  id: string;
  companyId?: string;
  mainUnit: string;
  secondaryUnit: string;
  conversionFactor: number; // 1 mainUnit = conversionFactor * secondaryUnit
  description?: string;
  isSystem?: boolean;
}

export interface Product {
  id: string;
  companyId?: string;
  code: string; // Must be unique per company
  name: string; // Must be unique per company
  category: string;
  unit?: string; // Main Unit e.g. Pcs, Nos, Kg, Box, Ctn
  primaryUnit?: string;
  secondaryUnit?: string; // Alternate Unit e.g. Gm, Pcs, Nos
  conversionFactor?: number; // e.g. 1 Box = 12 Pcs
  secondarySellingPrice?: number;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  reorderLevel: number;
  openingStock?: number;
  openingRate?: number;
  openingValue?: number;
  excelStockValue?: number;
  calculatedStockValue?: number;
  valueDifference?: number;
  importSource?: string;
  importBatchId?: string;
  warehouseId?: string;
  warehouseName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SaleItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit?: string;
  secondaryUnit?: string;
  conversionFactor?: number;
  baseQuantity?: number;
  unitPrice: number;
  discount?: number;
  discountType?: 'PERCENT' | 'FIXED';
  total: number;
}

export interface SaleInvoice {
  id: string;
  companyId?: string;
  invoiceNumber: string; // e.g., INV-2026-0001
  date: string; // YYYY-MM-DD
  customerId?: string;
  customerName: string;
  type: 'CASH' | 'CREDIT';
  items: SaleItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  notes?: string;
  updatedAt?: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit?: string;
  secondaryUnit?: string;
  conversionFactor?: number;
  baseQuantity?: number;
  unitCost: number;
  discount?: number;
  discountType?: 'PERCENT' | 'FIXED';
  total: number;
}

export interface PurchaseInvoice {
  id: string;
  companyId?: string;
  purchaseNumber: string; // e.g., PUR-2026-0001
  date: string;
  supplierId: string;
  supplierName: string;
  type: 'CASH' | 'CREDIT';
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  notes?: string;
  updatedAt?: string;
  createdAt: string;
}

export interface InvoiceAllocation {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  originalGrandTotal: number;
  priorPaid: number;
  priorDue: number;
  allocatedAmount: number;
  remainingDueAfter: number;
}

export interface BillAllocation {
  purchaseId: string;
  purchaseNumber: string;
  purchaseDate: string;
  originalGrandTotal: number;
  priorPaid: number;
  priorDue: number;
  allocatedAmount: number;
  remainingDueAfter: number;
}

export interface CustomerReceipt {
  id: string;
  companyId?: string;
  receiptNumber: string; // REC-2026-0001
  date: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNo?: string;
  notes?: string;
  allocations?: InvoiceAllocation[];
  unallocatedAmount?: number;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  companyId?: string;
  paymentNumber: string; // PAY-2026-0001
  date: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMode: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNo?: string;
  notes?: string;
  allocations?: BillAllocation[];
  unallocatedAmount?: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  companyId?: string;
  expenseNumber: string; // EXP-2026-0001
  date: string;
  category: string;
  amount: number;
  paidTo?: string;
  paymentMode: 'CASH' | 'BANK_TRANSFER';
  notes?: string;
  createdAt: string;
}

export type InvoicePrintFormat = 'A4' | 'A5' | 'DOT_MATRIX' | 'THERMAL_80' | 'THERMAL_58' | 'CUSTOM';

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  taxRegistrationNo?: string;
  currencySymbol: string;
  currencyCode: string;
  allowNegativeStock: boolean;
  initialCashBalance: number;
  invoiceNote: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  defaultPrintFormat?: InvoicePrintFormat;
  printFontSize?: 'compact' | 'normal' | 'large';
  dotMatrixDashedBorders?: boolean;
  customPageWidthMm?: number;
  importTolerance?: number; // Configurable rounding tolerance for Excel imports (default 10.00)
}

export type PageType =
  | 'dashboard'
  | 'customers'
  | 'suppliers'
  | 'products'
  | 'sales'
  | 'purchases'
  | 'payments'
  | 'reports'
  | 'settings'
  | 'users'
  | 'companies'
  | 'data_import';

export type PermissionModule =
  | 'dashboard'
  | 'customers'
  | 'suppliers'
  | 'products'
  | 'sales'
  | 'purchases'
  | 'customer_receipts'
  | 'supplier_payments'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'users'
  | 'roles'
  | 'companies'
  | 'data_import'
  | 'audit_logs';

export type PermissionAction =
  | 'view'
  | 'add'
  | 'edit'
  | 'delete'
  | 'print'
  | 'export'
  | 'approve'
  | 'stock_adjustment'
  | 'disable'
  | 'execute';

export type PermissionKey = `${PermissionModule}:${PermissionAction}`;

export interface ModulePermissionDefinition {
  module: PermissionModule;
  label: string;
  actions: { action: PermissionAction; label: string }[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  permissions: PermissionKey[];
  createdAt: string;
}

export interface UserPermissionOverride {
  permissionKey: PermissionKey;
  allowed: boolean; // true = grant override, false = deny override
}

export interface AppUser {
  id: string;
  username: string; // e.g. "sales01"
  usernameNormalized: string; // e.g. "sales01" (lowercase for case-insensitive matching)
  fullName: string; // e.g. "Sales Staff"
  passwordHash: string; // Salted SHA-256 hash
  salt: string;
  roleId: string; // Default role
  roleName: string;
  isActive: boolean;
  assignedCompanyIds?: string[]; // List of company IDs user can access
  companyAssignments?: UserCompanyAssignment[]; // Per-company roles & overrides
  permissionOverrides?: Partial<Record<PermissionKey, boolean>>; // fallback overrides
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: {
    id: string;
    username: string;
    fullName: string;
    roleId: string;
    roleName: string;
    isActive: boolean;
    isAdmin: boolean;
  };
  company: Company; // Active company context
  assignedCompanies: Company[]; // All assigned companies
  effectivePermissions: Record<PermissionKey, boolean>;
  token: string;
  loginTime: string;
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'USER_CREATED'
  | 'USER_EDITED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'RIGHTS_CHANGED'
  | 'ROLE_CREATED'
  | 'ROLE_EDITED'
  | 'ROLE_DELETED'
  | 'COMPANY_CREATED'
  | 'COMPANY_EDITED'
  | 'COMPANY_DISABLED'
  | 'COMPANY_SWITCHED'
  | 'SALE_CREATED'
  | 'SALE_EDITED'
  | 'SALE_DELETED'
  | 'PURCHASE_CREATED'
  | 'PURCHASE_EDITED'
  | 'PURCHASE_DELETED'
  | 'RECEIPT_CREATED'
  | 'RECEIPT_DELETED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_DELETED'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_DELETED'
  | 'STOCK_ADJUSTED'
  | 'SETTINGS_UPDATED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_EDITED'
  | 'CUSTOMER_DELETED'
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_EDITED'
  | 'SUPPLIER_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_EDITED'
  | 'PRODUCT_DELETED'
  | 'DATA_IMPORTED';

export interface LedgerAccount {
  id: string;
  companyId?: string;
  code: string;
  name: string;
  accountGroup: string; // e.g. Sundry Debtors, Sundry Creditors, Cash-in-Hand, Bank Accounts, Fixed Assets, Capital Account, Expenses, Income
  accountType: 'CUSTOMER' | 'SUPPLIER' | 'BANK' | 'CASH' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE' | 'GENERAL';
  openingDebit: number;
  openingCredit: number;
  currentBalance: number;
  createdAt: string;
}

export interface JournalEntryLine {
  ledgerId?: string;
  accountName: string;
  accountGroup: string;
  accountType: 'CUSTOMER' | 'SUPPLIER' | 'LEDGER' | 'STOCK';
  refId?: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface OpeningJournalVoucher {
  id: string;
  companyId: string;
  voucherNumber: string;
  openingDate: string; // YYYY-MM-DD
  voucherType: 'MASTER_OPENING_BALANCE' | 'ITEM_OPENING_STOCK';
  debitTotal: number;
  creditTotal: number;
  isBalanced: boolean;
  differenceAmount: number;
  lines: JournalEntryLine[];
  createdAt: string;
}

export interface Warehouse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  location?: string;
  isDefault?: boolean;
  createdAt: string;
}

export type ImportType = 'MASTER_BALANCE' | 'OPENING_STOCK';
export type ImportStatus = 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface StockWarningDetail {
  itemName: string;
  excelValue: number;
  calculatedValue: number;
  difference: number;
  status: string;
  exceedsTolerance: boolean;
  reason?: string;
}

export interface ImportHistoryRecord {
  id: string;
  companyId: string;
  companyName: string;
  fileName: string;
  importType: ImportType;
  openingDate: string;
  importedBy: string;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  totalDebit: number;
  totalCredit: number;
  totalStockValue?: number;
  isBalanced: boolean;
  status: ImportStatus;
  errors: string[];
  warnings: string[];
  stockWarnings?: StockWarningDetail[];
  toleranceSetting?: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  companyId?: string;
  username: string;
  action: AuditAction;
  module: PermissionModule | 'auth' | 'system';
  recordId?: string;
  description: string;
  createdAt: string;
}

export interface DashboardSummary {
  todaySales: number;
  todayPurchases: number;
  cashBalance: number;
  customerOutstanding: number;
  supplierPayable: number;
  totalProducts: number;
  lowStockCount: number;
}

export interface TransactionRecord {
  id: string;
  type: 'SALE' | 'PURCHASE' | 'RECEIPT' | 'PAYMENT' | 'EXPENSE';
  refNumber: string;
  partyName: string;
  date: string;
  amount: number;
  paymentType: string;
}

export type AccountNature = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface AccountGroupDefinition {
  no: number;
  name: string;
  nature: AccountNature;
  parentGroup?: string;
  category: string;
  normalBalance: 'Dr' | 'Cr';
  description: string;
  isSubgroup?: boolean;
}

