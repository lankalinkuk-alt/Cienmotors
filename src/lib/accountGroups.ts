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

/**
 * Standard 29 Chart of Account Groups (BUSY / Standard ERP Chart)
 */
export const STANDARD_ACCOUNT_GROUPS: AccountGroupDefinition[] = [
  {
    no: 1,
    name: 'Bank Accounts',
    nature: 'ASSET',
    parentGroup: 'Current Assets',
    category: 'Bank & Cash',
    normalBalance: 'Dr',
    description: 'Current and savings bank accounts maintained with commercial banks.'
  },
  {
    no: 2,
    name: 'Bank O/D Accounts',
    nature: 'LIABILITY',
    parentGroup: 'Loans (Liability)',
    category: 'Loans & Borrowings',
    normalBalance: 'Cr',
    description: 'Bank overdraft accounts, credit facilities, and short-term bank borrowings.'
  },
  {
    no: 3,
    name: 'Capital Account',
    nature: 'EQUITY',
    parentGroup: 'Capital & Equity',
    category: 'Capital & Equity',
    normalBalance: 'Cr',
    description: "Owner's capital, share capital, proprietor equity, and partner investments."
  },
  {
    no: 4,
    name: 'Cash-in-Hand',
    nature: 'ASSET',
    parentGroup: 'Current Assets',
    category: 'Bank & Cash',
    normalBalance: 'Dr',
    description: 'Physical cash balances, main cash register, and petty cash accounts.'
  },
  {
    no: 5,
    name: 'Current Assets',
    nature: 'ASSET',
    parentGroup: 'Assets',
    category: 'Current Assets',
    normalBalance: 'Dr',
    description: 'Short-term assets expected to be converted into cash within one fiscal year.'
  },
  {
    no: 6,
    name: 'Current Liabilities',
    nature: 'LIABILITY',
    parentGroup: 'Liabilities',
    category: 'Current Liabilities',
    normalBalance: 'Cr',
    description: 'Short-term financial obligations and debts payable within one fiscal year.'
  },
  {
    no: 7,
    name: 'Duties & Taxes',
    nature: 'LIABILITY',
    parentGroup: 'Current Liabilities',
    category: 'Duties & Taxes',
    normalBalance: 'Cr',
    description: 'Tax payables/receivables including VAT, SVAT, NBT, Income Tax, and Customs duties.'
  },
  {
    no: 8,
    name: 'Expenses (Direct / Mfg.)',
    nature: 'EXPENSE',
    parentGroup: 'Trading Account',
    category: 'Direct Expenses',
    normalBalance: 'Dr',
    description: 'Direct manufacturing costs, direct labor, factory freight, and production overheads.'
  },
  {
    no: 9,
    name: 'Expenses (Indirect / Admn.)',
    nature: 'EXPENSE',
    parentGroup: 'Profit & Loss Account',
    category: 'Indirect Expenses',
    normalBalance: 'Dr',
    description: 'Administrative, selling, distribution, office rent, utilities, and general expenses.'
  },
  {
    no: 10,
    name: 'Fixed Assets',
    nature: 'ASSET',
    parentGroup: 'Assets',
    category: 'Fixed Assets',
    normalBalance: 'Dr',
    description: 'Long-term tangible assets: Land & Buildings, Machinery, Vehicles, Computers, Furniture.'
  },
  {
    no: 11,
    name: 'Income (Direct / Opr.)',
    nature: 'INCOME',
    parentGroup: 'Trading Account',
    category: 'Direct Income',
    normalBalance: 'Cr',
    description: 'Operating revenues generated directly from primary business activities.'
  },
  {
    no: 12,
    name: 'Income (Indirect)',
    nature: 'INCOME',
    parentGroup: 'Profit & Loss Account',
    category: 'Indirect Income',
    normalBalance: 'Cr',
    description: 'Non-operating revenue: Interest received, discounts earned, commissions, exchange gains.'
  },
  {
    no: 13,
    name: 'Investments',
    nature: 'ASSET',
    parentGroup: 'Assets',
    category: 'Investments',
    normalBalance: 'Dr',
    description: 'Long-term and short-term financial investments, fixed deposits, bonds, and shares.'
  },
  {
    no: 14,
    name: 'Loans & Advances (Assets)',
    nature: 'ASSET',
    parentGroup: 'Current Assets',
    category: 'Loans & Advances',
    normalBalance: 'Dr',
    description: 'Loans given to employees, staff salary advances, and recoverable supplier deposits.'
  },
  {
    no: 15,
    name: 'Loans (Liability)',
    nature: 'LIABILITY',
    parentGroup: 'Liabilities',
    category: 'Loans & Borrowings',
    normalBalance: 'Cr',
    description: 'Long-term and medium-term loan borrowings from financial institutions and third parties.'
  },
  {
    no: 16,
    name: 'Pre-operative Expenses',
    nature: 'ASSET',
    parentGroup: 'Miscellaneous Expenses',
    category: 'Other Assets',
    normalBalance: 'Dr',
    description: 'Preliminary and pre-incorporation setup expenses amortized over time.'
  },
  {
    no: 17,
    name: 'Profit & Loss',
    nature: 'EQUITY',
    parentGroup: 'Reserves & Surplus',
    category: 'Capital & Equity',
    normalBalance: 'Cr',
    description: 'Cumulative retained earnings and profit/loss balance brought forward.'
  },
  {
    no: 18,
    name: 'Provisions / Expenses Payable',
    nature: 'LIABILITY',
    parentGroup: 'Current Liabilities',
    category: 'Provisions & Payables',
    normalBalance: 'Cr',
    description: 'Accrued expenses, audit fees payable, salary provisions, and utility bill accruals.'
  },
  {
    no: 19,
    name: 'Purchase',
    nature: 'EXPENSE',
    parentGroup: 'Trading Account',
    category: 'Purchase Accounts',
    normalBalance: 'Dr',
    description: 'Purchase of raw materials, merchandise trading inventory, and purchase returns.'
  },
  {
    no: 20,
    name: 'Reserves & Surplus',
    nature: 'EQUITY',
    parentGroup: 'Capital Account',
    category: 'Capital & Equity',
    normalBalance: 'Cr',
    description: 'General reserves, statutory reserves, revaluation reserves, and retained capital.'
  },
  {
    no: 21,
    name: 'Revenue Accounts',
    nature: 'INCOME',
    parentGroup: 'Trading / Profit & Loss',
    category: 'Sales & Revenue',
    normalBalance: 'Cr',
    description: 'General revenue streams, recurring contract services, and trading income.'
  },
  {
    no: 22,
    name: 'Sale',
    nature: 'INCOME',
    parentGroup: 'Trading Account',
    category: 'Sales & Revenue',
    normalBalance: 'Cr',
    description: 'Product sales, wholesale trading, retail cash sales, and sales returns accounts.'
  },
  {
    no: 23,
    name: 'Secured Loans',
    nature: 'LIABILITY',
    parentGroup: 'Loans (Liability)',
    category: 'Loans & Borrowings',
    normalBalance: 'Cr',
    description: 'Mortgages, bank term loans, and credit facilities backed by collateral or assets.'
  },
  {
    no: 24,
    name: 'Sundry Creditors',
    nature: 'LIABILITY',
    parentGroup: 'Current Liabilities',
    category: 'Trade Creditors (Suppliers)',
    normalBalance: 'Cr',
    description: 'Trade suppliers and vendors from whom goods or services are purchased on credit.'
  },
  {
    no: 25,
    name: 'Sundry Debtors',
    nature: 'ASSET',
    parentGroup: 'Current Assets',
    category: 'Trade Debtors (Customers)',
    normalBalance: 'Dr',
    description: 'Trade customers and clients to whom goods or services are sold on credit terms.'
  },
  {
    no: 26,
    name: 'Unsecured Loans',
    nature: 'LIABILITY',
    parentGroup: 'Loans (Liability)',
    category: 'Loans & Borrowings',
    normalBalance: 'Cr',
    description: 'Director loans, friend/family advances, and non-collateralized borrowing.'
  },
  {
    no: 27,
    name: 'Duties & Taxes – related subgroups',
    nature: 'LIABILITY',
    parentGroup: 'Duties & Taxes',
    category: 'Duties & Taxes',
    normalBalance: 'Cr',
    description: 'Subgroups under tax: VAT Output, VAT Input, WHT, Stamp Duty, Customs Tariff.',
    isSubgroup: true
  },
  {
    no: 28,
    name: 'Current Assets – related subgroups',
    nature: 'ASSET',
    parentGroup: 'Current Assets',
    category: 'Current Assets',
    normalBalance: 'Dr',
    description: 'Subgroups under Current Assets: Prepaid Expenses, Security Deposits, Temporary Advances.',
    isSubgroup: true
  },
  {
    no: 29,
    name: 'Current Liabilities – related subgroups',
    nature: 'LIABILITY',
    parentGroup: 'Current Liabilities',
    category: 'Current Liabilities',
    normalBalance: 'Cr',
    description: 'Subgroups under Current Liabilities: Customer Advance Deposits, Unearned Revenue.',
    isSubgroup: true
  }
];

/**
 * Finds an account group by number or exact/fuzzy name.
 */
export function findAccountGroup(noOrName: number | string): AccountGroupDefinition | undefined {
  if (typeof noOrName === 'number') {
    return STANDARD_ACCOUNT_GROUPS.find((g) => g.no === noOrName);
  }
  const clean = String(noOrName).trim().toLowerCase();
  // Check exact match
  const exact = STANDARD_ACCOUNT_GROUPS.find((g) => g.name.toLowerCase() === clean);
  if (exact) return exact;

  // Check numeric string
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 29) {
    return STANDARD_ACCOUNT_GROUPS.find((g) => g.no === num);
  }

  // Fuzzy match
  return STANDARD_ACCOUNT_GROUPS.find((g) => g.name.toLowerCase().includes(clean) || clean.includes(g.name.toLowerCase()));
}

/**
 * Detects whether an account group maps to a CUSTOMER, SUPPLIER, or general LEDGER.
 */
export function detectMasterTypeFromGroup(groupName: string): 'CUSTOMER' | 'SUPPLIER' | 'LEDGER' {
  const norm = (groupName || '').toLowerCase().trim();
  if (!norm) return 'LEDGER';

  // Sundry Debtors & Customers
  if (
    norm.includes('debtor') ||
    norm.includes('customer') ||
    norm.includes('receivable') ||
    norm.includes('client') ||
    norm === '25' ||
    norm === 'sundry debtors'
  ) {
    return 'CUSTOMER';
  }

  // Sundry Creditors & Suppliers
  if (
    norm.includes('creditor') ||
    norm.includes('supplier') ||
    norm.includes('payable') ||
    norm.includes('vendor') ||
    norm === '24' ||
    norm === 'sundry creditors'
  ) {
    return 'SUPPLIER';
  }

  return 'LEDGER';
}

/**
 * Returns nature color badges for Tailwind.
 */
export function getNatureBadgeClass(nature: AccountNature): { bg: string; text: string; border: string } {
  switch (nature) {
    case 'ASSET':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'LIABILITY':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'EQUITY':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'INCOME':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'EXPENSE':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  }
}
