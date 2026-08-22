import { Customer, Supplier, Product, SaleInvoice, PurchaseInvoice, CustomerReceipt, SupplierPayment, Expense, AppSettings, Company } from '../types';

export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'comp-1',
    companyName: 'CIEN Motors',
    shortName: 'CIEN',
    address: '',
    city: 'Colombo',
    district: 'Colombo',
    country: 'Sri Lanka',
    telephone: '',
    mobile: '',
    companyEmail: '',
    taxRegistrationNo: '',
    currency: 'Rs.',
    financialYearStart: `${new Date().getFullYear()}-01-01`,
    financialYearEnd: `${new Date().getFullYear()}-12-31`,
    invoicePrefix: 'INV',
    invoiceNumber: 1001,
    isActive: true,
    isVatEnabled: false,
    vatNumber: '',
    defaultVatRate: 0,
    vatType: 'EXCLUSIVE',
    isItemDiscountEnabled: true,
    defaultDiscountType: 'PERCENT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_SETTINGS: AppSettings = {
  companyName: 'CIEN Motors',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  taxRegistrationNo: '',
  currencySymbol: 'Rs.',
  currencyCode: 'LKR',
  allowNegativeStock: false,
  initialCashBalance: 0,
  invoiceNote: 'Thank you for your business!',
  supabaseUrl: '',
  supabaseAnonKey: '',
  defaultPrintFormat: 'A4',
  printFontSize: 'normal',
  dotMatrixDashedBorders: true,
  customPageWidthMm: 210
};

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_SALES: SaleInvoice[] = [];

export const INITIAL_PURCHASES: PurchaseInvoice[] = [];

export const INITIAL_RECEIPTS: CustomerReceipt[] = [];

export const INITIAL_PAYMENTS: SupplierPayment[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

