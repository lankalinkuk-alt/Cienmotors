import * as XLSX from 'xlsx';
import {
  Company,
  Customer,
  Supplier,
  Product,
  LedgerAccount,
  OpeningJournalVoucher,
  JournalEntryLine,
  Warehouse,
  ImportHistoryRecord,
  ImportType,
  ImportStatus
} from '../types';
import { StorageService } from './storage';
import { AuthService } from './auth';
import { detectMasterTypeFromGroup } from './accountGroups';

export interface ColumnMapping {
  excelColumn: string;
  targetField: string;
  sampleValue?: string;
}

export interface ParsedMasterRow {
  rowIndex: number;
  originalRow: Record<string, any>;
  name: string;
  code: string;
  accountGroup: string;
  detectedType: 'CUSTOMER' | 'SUPPLIER' | 'LEDGER';
  userSelectedType: 'CUSTOMER' | 'SUPPLIER' | 'LEDGER';
  debit: number;
  credit: number;
  phone: string;
  mobile: string;
  address: string;
  taxNumber: string;
  email: string;
  isDuplicate: boolean;
  duplicateAction: 'SKIP' | 'UPDATE_MASTER' | 'UPDATE_OPENING_BALANCE' | 'MERGE';
  matchedExistingId?: string;
  isSelected: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export interface ParsedStockRow {
  rowIndex: number;
  originalRow: Record<string, any>;
  itemCode: string;
  itemName: string;
  itemGroup: string;
  unit: string;
  warehouseName: string;
  openingQty: number;
  openingRate: number;
  sellingPrice: number;
  excelStockValue: number;
  openingValue: number;
  calculatedValue: number;
  valueDifference: number;
  valueMismatch: boolean;
  valueMismatchDiff: number;
  exceedsTolerance: boolean;
  toleranceSetting: number;
  warningMessage?: string;
  isDuplicate: boolean;
  duplicateAction: 'SKIP' | 'UPDATE_MASTER' | 'UPDATE_OPENING_BALANCE' | 'MERGE';
  matchedExistingId?: string;
  isSelected: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export function safeMultiply(a: number, b: number): number {
  return Number((Math.round(a * b * 10000) / 10000).toFixed(2));
}

export function safeSubtract(a: number, b: number): number {
  return Number((Math.round((a - b) * 100) / 100).toFixed(2));
}

// Field mapping definitions
export const MASTER_TARGET_FIELDS = [
  { key: 'name', label: 'Account / Party Name', required: true, keywords: ['account name', 'party name', 'ledger name', 'customer name', 'supplier name', 'name', 'account'] },
  { key: 'code', label: 'Account / Party Code', required: false, keywords: ['account code', 'party code', 'ledger code', 'code', 'cust code', 'supp code'] },
  { key: 'group', label: 'Account Group / Category', required: false, keywords: ['group', 'account group', 'category', 'ledger group', 'parent group'] },
  { key: 'debit', label: 'Opening Debit Amount', required: false, keywords: ['debit', 'dr', 'opening debit', 'debit amount', 'dr amount'] },
  { key: 'credit', label: 'Opening Credit Amount', required: false, keywords: ['credit', 'cr', 'opening credit', 'credit amount', 'cr amount'] },
  { key: 'balance', label: 'Opening Balance (Combined)', required: false, keywords: ['opening balance', 'balance', 'op bal', 'amount'] },
  { key: 'drcr', label: 'Dr / Cr Indicator', required: false, keywords: ['dr/cr', 'drcr', 'type', 'sign', 'dr/cr type'] },
  { key: 'address', label: 'Address', required: false, keywords: ['address', 'street', 'location', 'city'] },
  { key: 'phone', label: 'Phone Number', required: false, keywords: ['phone', 'telephone', 'tel', 'contact', 'phone no'] },
  { key: 'mobile', label: 'Mobile Number', required: false, keywords: ['mobile', 'mobile no', 'cell', 'whatsapp'] },
  { key: 'taxNumber', label: 'Tax / VAT / TIN No', required: false, keywords: ['tax number', 'vat no', 'tin no', 'tin', 'vat', 'gst', 'tax no'] },
  { key: 'email', label: 'Email Address', required: false, keywords: ['email', 'email address', 'e-mail'] }
];

export const STOCK_TARGET_FIELDS = [
  { key: 'itemName', label: 'Item / Product Name', required: true, keywords: ['item name', 'product name', 'description', 'particulars', 'item', 'product'] },
  { key: 'itemCode', label: 'Item Code / SKU / Barcode', required: false, keywords: ['item code', 'product code', 'sku', 'barcode', 'part no', 'code'] },
  { key: 'itemGroup', label: 'Item Group / Category', required: false, keywords: ['item group', 'group', 'category', 'product group'] },
  { key: 'unit', label: 'Unit of Measure (UOM)', required: false, keywords: ['unit', 'uom', 'unit of measure', 'unit name', 'qty unit'] },
  { key: 'openingQty', label: 'Opening Quantity', required: false, keywords: ['opening qty', 'opening quantity', 'qty', 'stock qty', 'quantity', 'op qty'] },
  { key: 'openingRate', label: 'Opening Cost / Rate', required: false, keywords: ['opening rate', 'cost rate', 'purchase rate', 'cost price', 'cost', 'unit price', 'opening price'] },
  { key: 'sellingPrice', label: 'Sales Price / Selling Price / MRP', required: false, keywords: ['sales price', 'selling price', 'sale price', 'sale rate', 'mrp', 'selling rate', 'sales rate', 'price', 'retail price'] },
  { key: 'openingValue', label: 'Opening Stock Value', required: false, keywords: ['opening value', 'stock value', 'total value', 'value', 'amount', 'op value'] },
  { key: 'warehouse', label: 'Warehouse / Branch / Location', required: false, keywords: ['warehouse', 'branch', 'location', 'store', 'material center', 'godown'] }
];

/**
 * Utility to parse numeric values handling currency symbols, commas, and negative indicators.
 */
export function parseNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (!str) return 0;

  // Remove currency signs (Rs, $, LKR, etc.)
  str = str.replace(/[Rs\$LKR₹,]/gi, '').trim();

  // Handle trailing Dr / Cr if in numeric field
  if (/dr$/i.test(str)) {
    str = str.replace(/dr$/i, '').trim();
  } else if (/cr$/i.test(str)) {
    str = '-' + str.replace(/cr$/i, '').trim();
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Auto detects master type based on standard 29 BUSY account group names.
 */
export function detectMasterType(groupName: string): 'CUSTOMER' | 'SUPPLIER' | 'LEDGER' {
  return detectMasterTypeFromGroup(groupName);
}

export const ExcelImportService = {
  /**
   * Reads uploaded File object and returns parsed raw sheets.
   */
  async readExcelFile(file: File): Promise<{ sheetName: string; rows: Record<string, any>[] }[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const results: { sheetName: string; rows: Record<string, any>[] }[] = [];

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
            if (jsonRows.length > 0) {
              results.push({ sheetName, rows: jsonRows });
            }
          });

          if (results.length === 0) {
            reject(new Error('The uploaded Excel file contains no readable data rows.'));
          } else {
            resolve(results);
          }
        } catch (err: any) {
          reject(new Error(`Failed to parse Excel file: ${err.message || err}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read uploaded file.'));
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Suggests best auto column mappings.
   */
  suggestMappings(headers: string[], importType: ImportType): ColumnMapping[] {
    const definitions = importType === 'MASTER_BALANCE' ? MASTER_TARGET_FIELDS : STOCK_TARGET_FIELDS;
    
    return headers.map((header) => {
      const hNorm = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      let matchedKey = '';

      for (const def of definitions) {
        for (const kw of def.keywords) {
          const kwNorm = kw.replace(/[^a-z0-9]/g, '');
          if (hNorm === kwNorm || hNorm.includes(kwNorm) || kwNorm.includes(hNorm)) {
            matchedKey = def.key;
            break;
          }
        }
        if (matchedKey) break;
      }

      return {
        excelColumn: header,
        targetField: matchedKey || 'IGNORE'
      };
    });
  },

  /**
   * Processes and validates Master / Ledger Opening Balance rows.
   */
  processMasterRows(
    rows: Record<string, any>[],
    mappings: ColumnMapping[],
    companyId: string
  ): ParsedMasterRow[] {
    const existingCustomers = StorageService.getCustomers(companyId);
    const existingSuppliers = StorageService.getSuppliers(companyId);
    const existingLedgers = StorageService.getLedgers(companyId);

    const getCol = (key: string) => mappings.find((m) => m.targetField === key)?.excelColumn;

    const colName = getCol('name');
    const colCode = getCol('code');
    const colGroup = getCol('group');
    const colDebit = getCol('debit');
    const colCredit = getCol('credit');
    const colBalance = getCol('balance');
    const colDrCr = getCol('drcr');
    const colAddress = getCol('address');
    const colPhone = getCol('phone');
    const colMobile = getCol('mobile');
    const colTaxNumber = getCol('taxNumber');
    const colEmail = getCol('email');

    return rows.map((r, idx) => {
      const name = String(colName ? r[colName] : '').trim();
      const code = String(colCode ? r[colCode] : '').trim();
      const group = String(colGroup ? r[colGroup] : '').trim();
      const address = String(colAddress ? r[colAddress] : '').trim();
      const phone = String(colPhone ? r[colPhone] : '').trim();
      const mobile = String(colMobile ? r[colMobile] : '').trim();
      const taxNumber = String(colTaxNumber ? r[colTaxNumber] : '').trim();
      const email = String(colEmail ? r[colEmail] : '').trim();

      let debit = parseNumeric(colDebit ? r[colDebit] : 0);
      let credit = parseNumeric(colCredit ? r[colCredit] : 0);

      // Handle combined balance + Dr/Cr indicator if separate debit/credit not provided
      if (!debit && !credit && colBalance) {
        const balVal = parseNumeric(r[colBalance]);
        const drcrVal = String(colDrCr ? r[colDrCr] : '').toLowerCase().trim();

        if (drcrVal.includes('cr') || drcrVal === 'c' || balVal < 0) {
          credit = Math.abs(balVal);
        } else {
          debit = Math.abs(balVal);
        }
      }

      const type = detectMasterType(group);
      let isDuplicate = false;
      let matchedExistingId: string | undefined;

      const normName = name.toLowerCase().replace(/\s+/g, ' ');

      if (type === 'CUSTOMER') {
        const match = existingCustomers.find(
          (c) =>
            (c.name.toLowerCase().replace(/\s+/g, ' ') === normName && normName.length > 0) ||
            (code && c.code.toLowerCase() === code.toLowerCase())
        );
        if (match) {
          isDuplicate = true;
          matchedExistingId = match.id;
        }
      } else if (type === 'SUPPLIER') {
        const match = existingSuppliers.find(
          (s) =>
            (s.name.toLowerCase().replace(/\s+/g, ' ') === normName && normName.length > 0) ||
            (code && s.code.toLowerCase() === code.toLowerCase())
        );
        if (match) {
          isDuplicate = true;
          matchedExistingId = match.id;
        }
      } else {
        const match = existingLedgers.find(
          (l) =>
            (l.name.toLowerCase().replace(/\s+/g, ' ') === normName && normName.length > 0) ||
            (code && l.code.toLowerCase() === code.toLowerCase())
        );
        if (match) {
          isDuplicate = true;
          matchedExistingId = match.id;
        }
      }

      const hasError = !name;
      const errorMessage = !name ? 'Account / Party name is missing.' : undefined;

      return {
        rowIndex: idx + 1,
        originalRow: r,
        name,
        code,
        accountGroup: group || (type === 'CUSTOMER' ? 'Sundry Debtors' : type === 'SUPPLIER' ? 'Sundry Creditors' : 'General Accounts'),
        detectedType: type,
        userSelectedType: type,
        debit,
        credit,
        phone,
        mobile,
        address,
        taxNumber,
        email,
        isDuplicate,
        duplicateAction: (isDuplicate ? 'UPDATE_OPENING_BALANCE' : 'SKIP') as 'SKIP' | 'UPDATE_MASTER' | 'UPDATE_OPENING_BALANCE' | 'MERGE',
        matchedExistingId,
        isSelected: !hasError,
        hasError,
        errorMessage
      };
    }).filter((r) => r.name || r.debit || r.credit);
  },

  /**
   * Processes and validates Item Opening Stock rows with exact Authoritative Excel Stock Value preservation.
   */
  processStockRows(
    rows: Record<string, any>[],
    mappings: ColumnMapping[],
    companyId: string,
    tolerance: number = 10.0
  ): ParsedStockRow[] {
    const existingProducts = StorageService.getProducts(companyId);

    const getCol = (key: string) => mappings.find((m) => m.targetField === key)?.excelColumn;

    const colItemName = getCol('itemName');
    const colItemCode = getCol('itemCode');
    const colItemGroup = getCol('itemGroup');
    const colUnit = getCol('unit');
    const colOpeningQty = getCol('openingQty');
    const colOpeningRate = getCol('openingRate');
    const colSellingPrice = getCol('sellingPrice');
    const colOpeningValue = getCol('openingValue');
    const colWarehouse = getCol('warehouse');

    return rows.map((r, idx) => {
      const itemName = String(colItemName ? r[colItemName] : '').trim();
      const itemCode = String(colItemCode ? r[colItemCode] : '').trim();
      const itemGroup = String(colItemGroup ? r[colItemGroup] : 'General').trim();
      const unit = String(colUnit ? r[colUnit] : 'Nos').trim();
      const warehouseName = String(colWarehouse ? r[colWarehouse] : 'Main Warehouse').trim();

      const openingQty = Math.max(0, parseNumeric(colOpeningQty ? r[colOpeningQty] : 0));
      const openingRate = Math.max(0, parseNumeric(colOpeningRate ? r[colOpeningRate] : 0));
      const sellingPrice = Math.max(0, parseNumeric(colSellingPrice ? r[colSellingPrice] : 0));

      // Read exact Excel stock value if column exists and contains a value
      const rawVal = colOpeningValue ? r[colOpeningValue] : undefined;
      const hasRawVal = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';

      let excelStockValue = 0;
      if (hasRawVal) {
        // Authoritative source: read exact number from Excel without recalculation or modification
        excelStockValue = parseNumeric(rawVal);
      } else {
        // Fallback calculation only if Stock Value column is absent
        excelStockValue = safeMultiply(openingQty, openingRate);
      }

      // Calculate Qty x Rate ONLY for comparison and reporting
      const calculatedValue = safeMultiply(openingQty, openingRate);
      const valueDifference = safeSubtract(calculatedValue, excelStockValue);
      const absDiff = Math.abs(valueDifference);

      const valueMismatch = (openingQty > 0 || openingRate > 0) && absDiff > 0.001;
      const exceedsTolerance = valueMismatch && absDiff > tolerance;

      let warningMessage: string | undefined = undefined;
      if (valueMismatch) {
        if (exceedsTolerance) {
          warningMessage = `Review Required: Excel Stock Value (Rs. ${excelStockValue.toFixed(2)}) differs from calculated Qty × Rate (Rs. ${calculatedValue.toFixed(2)}) by Rs. ${absDiff.toFixed(2)}, exceeding Rs. ${tolerance.toFixed(2)} tolerance. The Excel value has been preserved.`;
        } else {
          warningMessage = `Stock value differs from calculated Qty × Rate by Rs. ${absDiff.toFixed(2)}. The Excel value (Rs. ${excelStockValue.toFixed(2)}) has been preserved.`;
        }
      }

      const normName = itemName.toLowerCase().replace(/\s+/g, ' ');
      const match = existingProducts.find(
        (p) =>
          (p.name.toLowerCase().replace(/\s+/g, ' ') === normName && normName.length > 0) ||
          (itemCode && p.code.toLowerCase() === itemCode.toLowerCase())
      );

      const isDuplicate = Boolean(match);
      const matchedExistingId = match?.id;

      const hasError = !itemName;
      const errorMessage = !itemName ? 'Item name is missing.' : undefined;

      return {
        rowIndex: idx + 1,
        originalRow: r,
        itemCode,
        itemName,
        itemGroup,
        unit,
        warehouseName,
        openingQty,
        openingRate,
        sellingPrice,
        excelStockValue,
        openingValue: excelStockValue,
        calculatedValue,
        valueDifference,
        valueMismatch,
        valueMismatchDiff: absDiff,
        exceedsTolerance,
        toleranceSetting: tolerance,
        warningMessage,
        isDuplicate,
        duplicateAction: (isDuplicate ? 'UPDATE_OPENING_BALANCE' : 'SKIP') as 'SKIP' | 'UPDATE_MASTER' | 'UPDATE_OPENING_BALANCE' | 'MERGE',
        matchedExistingId,
        isSelected: !hasError,
        hasError,
        errorMessage
      };
    }).filter((r) => r.itemName || r.openingQty);
  },

  /**
   * Executes Master Opening Balance import in a single atomic database batch.
   */
  async executeMasterImport(params: {
    company: Company;
    rows: ParsedMasterRow[];
    openingDate: string;
    fileName: string;
    importedBy: string;
  }): Promise<ImportHistoryRecord> {
    const { company, rows, openingDate, fileName, importedBy } = params;
    const activeRows = rows.filter((r) => r.isSelected && !r.hasError);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = rows.length - activeRows.length;
    let totalDebit = 0;
    let totalCredit = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    const journalLines: JournalEntryLine[] = [];

    for (const row of activeRows) {
      try {
        const type = row.userSelectedType;
        totalDebit += row.debit;
        totalCredit += row.credit;

        if (type === 'CUSTOMER') {
          let customerId = row.matchedExistingId;
          const netBalance = row.debit - row.credit; // Dr = positive outstanding
          const balType = netBalance >= 0 ? 'Dr' : 'Cr';

          if (row.isDuplicate && customerId && row.duplicateAction !== 'SKIP') {
            StorageService.saveCustomer({
              id: customerId,
              name: row.name,
              code: row.code,
              accountGroup: row.accountGroup,
              phone: row.phone || row.mobile,
              address: row.address,
              taxNumber: row.taxNumber,
              email: row.email,
              openingBalance: Math.abs(netBalance),
              openingBalanceType: balType,
              outstandingBalance: Math.abs(netBalance)
            }, company.id);
            updatedCount++;
          } else if (!row.isDuplicate) {
            const newCust = StorageService.saveCustomer({
              companyId: company.id,
              name: row.name,
              code: row.code,
              accountGroup: row.accountGroup,
              phone: row.phone || row.mobile,
              address: row.address,
              taxNumber: row.taxNumber,
              email: row.email,
              openingBalance: Math.abs(netBalance),
              openingBalanceType: balType,
              outstandingBalance: Math.abs(netBalance)
            }, company.id);
            customerId = newCust.id;
            createdCount++;
          } else {
            skippedCount++;
          }

          journalLines.push({
            accountName: row.name,
            accountGroup: row.accountGroup || 'Sundry Debtors',
            accountType: 'CUSTOMER',
            refId: customerId,
            debit: row.debit,
            credit: row.credit,
            narration: `Opening balance migration from BUSY for ${row.name}`
          });
        } else if (type === 'SUPPLIER') {
          let supplierId = row.matchedExistingId;
          const netBalance = row.credit - row.debit; // Cr = positive payable
          const balType = netBalance >= 0 ? 'Cr' : 'Dr';

          if (row.isDuplicate && supplierId && row.duplicateAction !== 'SKIP') {
            StorageService.saveSupplier({
              id: supplierId,
              name: row.name,
              companyName: row.name,
              code: row.code,
              accountGroup: row.accountGroup,
              phone: row.phone || row.mobile,
              address: row.address,
              taxNumber: row.taxNumber,
              email: row.email,
              openingBalance: Math.abs(netBalance),
              openingBalanceType: balType,
              payableBalance: Math.abs(netBalance)
            }, company.id);
            updatedCount++;
          } else if (!row.isDuplicate) {
            const newSupp = StorageService.saveSupplier({
              companyId: company.id,
              name: row.name,
              companyName: row.name,
              code: row.code,
              accountGroup: row.accountGroup,
              phone: row.phone || row.mobile,
              address: row.address,
              taxNumber: row.taxNumber,
              email: row.email,
              openingBalance: Math.abs(netBalance),
              openingBalanceType: balType,
              payableBalance: Math.abs(netBalance)
            }, company.id);
            supplierId = newSupp.id;
            createdCount++;
          } else {
            skippedCount++;
          }

          journalLines.push({
            accountName: row.name,
            accountGroup: row.accountGroup || 'Sundry Creditors',
            accountType: 'SUPPLIER',
            refId: supplierId,
            debit: row.debit,
            credit: row.credit,
            narration: `Opening balance migration from BUSY for ${row.name}`
          });
        } else {
          // Other General Ledger
          let ledgerId = row.matchedExistingId;
          if (row.isDuplicate && ledgerId && row.duplicateAction !== 'SKIP') {
            StorageService.saveLedger({
              id: ledgerId,
              name: row.name,
              code: row.code,
              accountGroup: row.accountGroup,
              openingDebit: row.debit,
              openingCredit: row.credit,
              currentBalance: row.debit - row.credit
            }, company.id);
            updatedCount++;
          } else if (!row.isDuplicate) {
            const newLedger = StorageService.saveLedger({
              companyId: company.id,
              name: row.name,
              code: row.code,
              accountGroup: row.accountGroup,
              openingDebit: row.debit,
              openingCredit: row.credit,
              currentBalance: row.debit - row.credit
            }, company.id);
            ledgerId = newLedger.id;
            createdCount++;
          } else {
            skippedCount++;
          }

          journalLines.push({
            ledgerId,
            accountName: row.name,
            accountGroup: row.accountGroup || 'General Accounts',
            accountType: 'LEDGER',
            refId: ledgerId,
            debit: row.debit,
            credit: row.credit,
            narration: `Opening ledger balance from BUSY for ${row.name}`
          });
        }
      } catch (err: any) {
        errors.push(`Row ${row.rowIndex} (${row.name}): ${err.message || err}`);
      }
    }

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    const diffAmount = Number((totalDebit - totalCredit).toFixed(2));

    if (!isBalanced) {
      warnings.push(`Opening balances are unbalanced by ${company.currency || 'Rs.'} ${Math.abs(diffAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
    }

    // Save Opening Journal Voucher
    const openingVoucher: OpeningJournalVoucher = {
      id: `op-vouch-${Date.now()}`,
      companyId: company.id,
      voucherNumber: `OPJ-${openingDate.replace(/-/g, '')}`,
      openingDate,
      voucherType: 'MASTER_OPENING_BALANCE',
      debitTotal: totalDebit,
      creditTotal: totalCredit,
      isBalanced,
      differenceAmount: diffAmount,
      lines: journalLines,
      createdAt: new Date().toISOString()
    };
    StorageService.saveOpeningJournal(openingVoucher);

    const historyRecord: ImportHistoryRecord = {
      id: `imp-${Date.now()}`,
      companyId: company.id,
      companyName: company.companyName,
      fileName,
      importType: 'MASTER_BALANCE',
      openingDate,
      importedBy,
      recordsCreated: createdCount,
      recordsUpdated: updatedCount,
      recordsSkipped: skippedCount,
      totalDebit,
      totalCredit,
      isBalanced,
      status: errors.length > 0 ? (createdCount > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED',
      errors,
      warnings,
      createdAt: new Date().toISOString()
    };

    StorageService.saveImportHistory(historyRecord);

    AuthService.recordAuditLog(
      'DATA_IMPORTED',
      'data_import',
      `Imported Master Opening Balances for ${company.companyName} (${createdCount} created, ${updatedCount} updated). Total Dr: ${totalDebit}, Total Cr: ${totalCredit}.`,
      company.id
    );

    return historyRecord;
  },

  /**
   * Executes Item Opening Stock import preserving authoritative Excel stock values.
   */
  async executeStockImport(params: {
    company: Company;
    rows: ParsedStockRow[];
    openingDate: string;
    fileName: string;
    importedBy: string;
    tolerance?: number;
  }): Promise<ImportHistoryRecord> {
    const { company, rows, openingDate, fileName, importedBy, tolerance = 10.0 } = params;
    const activeRows = rows.filter((r) => r.isSelected && !r.hasError);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = rows.length - activeRows.length;
    let totalStockValue = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    const stockWarnings: any[] = [];

    // Ensure Warehouse exists
    const warehouses = StorageService.getWarehouses(company.id);

    for (const row of activeRows) {
      try {
        let warehouse = warehouses.find(
          (w) => w.name.toLowerCase().trim() === row.warehouseName.toLowerCase().trim()
        );
        if (!warehouse) {
          warehouse = StorageService.saveWarehouse({
            companyId: company.id,
            name: row.warehouseName,
            location: 'Imported Location'
          }, company.id);
        }

        const authoritativeVal = row.excelStockValue;
        totalStockValue = safeSubtract(totalStockValue, -authoritativeVal);

        const prodData: Partial<Product> = {
          companyId: company.id,
          name: row.itemName,
          code: row.itemCode,
          category: row.itemGroup,
          unit: row.unit,
          costPrice: row.openingRate,
          sellingPrice: row.sellingPrice > 0 ? row.sellingPrice : safeMultiply(row.openingRate, 1.15),
          currentStock: row.openingQty,
          reorderLevel: 10,
          openingStock: row.openingQty,
          openingRate: row.openingRate,
          openingValue: authoritativeVal, // Exact Authoritative Excel Value preserved
          excelStockValue: authoritativeVal,
          calculatedStockValue: row.calculatedValue,
          valueDifference: row.valueDifference,
          importSource: 'BUSY_EXCEL',
          warehouseId: warehouse.id,
          warehouseName: warehouse.name
        };

        if (row.isDuplicate && row.matchedExistingId && row.duplicateAction !== 'SKIP') {
          prodData.id = row.matchedExistingId;
          StorageService.saveProduct(prodData, company.id);
          updatedCount++;
        } else if (!row.isDuplicate) {
          StorageService.saveProduct(prodData, company.id);
          createdCount++;
        } else {
          skippedCount++;
        }

        if (row.valueMismatch) {
          const absDiff = Math.abs(row.valueDifference);
          const statusText = row.exceedsTolerance
            ? 'Review Required – Excel value preserved'
            : 'Imported – Excel value preserved';

          const warningMessage = `${row.itemName} | Excel Value: Rs. ${authoritativeVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Calculated Value: Rs. ${row.calculatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Difference: Rs. ${absDiff.toFixed(2)} | Status: ${statusText}`;

          warnings.push(warningMessage);

          stockWarnings.push({
            itemName: row.itemName,
            excelValue: authoritativeVal,
            calculatedValue: row.calculatedValue,
            difference: row.valueDifference,
            status: statusText,
            exceedsTolerance: row.exceedsTolerance,
            reason: row.exceedsTolerance
              ? `Difference of Rs. ${absDiff.toFixed(2)} exceeds Rs. ${tolerance.toFixed(2)} tolerance.`
              : `Difference of Rs. ${absDiff.toFixed(2)} is within Rs. ${tolerance.toFixed(2)} tolerance.`
          });
        }
      } catch (err: any) {
        errors.push(`Row ${row.rowIndex} (${row.itemName}): ${err.message || err}`);
      }
    }

    // Save Opening Stock Journal Voucher
    const openingVoucher: OpeningJournalVoucher = {
      id: `op-stock-${Date.now()}`,
      companyId: company.id,
      voucherNumber: `OPS-${openingDate.replace(/-/g, '')}`,
      openingDate,
      voucherType: 'ITEM_OPENING_STOCK',
      debitTotal: totalStockValue,
      creditTotal: totalStockValue,
      isBalanced: true,
      differenceAmount: 0,
      lines: activeRows.map((r) => ({
        accountName: r.itemName,
        accountGroup: r.itemGroup,
        accountType: 'STOCK',
        debit: r.excelStockValue,
        credit: 0,
        narration: `Opening stock: ${r.openingQty} ${r.unit} @ ${r.openingRate} in ${r.warehouseName} (Excel Value: ${r.excelStockValue})`
      })),
      createdAt: new Date().toISOString()
    };
    StorageService.saveOpeningJournal(openingVoucher);

    const historyRecord: ImportHistoryRecord = {
      id: `imp-stk-${Date.now()}`,
      companyId: company.id,
      companyName: company.companyName,
      fileName,
      importType: 'OPENING_STOCK',
      openingDate,
      importedBy,
      recordsCreated: createdCount,
      recordsUpdated: updatedCount,
      recordsSkipped: skippedCount,
      totalDebit: totalStockValue,
      totalCredit: totalStockValue,
      totalStockValue,
      isBalanced: true,
      status: errors.length > 0 ? (createdCount > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED',
      errors,
      warnings,
      stockWarnings,
      toleranceSetting: tolerance,
      createdAt: new Date().toISOString()
    };

    StorageService.saveImportHistory(historyRecord);

    AuthService.recordAuditLog(
      'DATA_IMPORTED',
      'data_import',
      `Imported Opening Stock for ${company.companyName} (${createdCount} items created, ${updatedCount} updated). Total Stock Value: ${totalStockValue} (Excel Authoritative).`,
      company.id
    );

    return historyRecord;
  },

  /**
   * Generates and triggers download of BUSY UFO Master Balance Excel Template.
   */
  downloadMasterTemplate(): void {
    const data = [
      {
        'Account Code': 'CUST-001',
        'Account Name': 'Lanka Hardware Suppliers',
        'Account Group': 'Sundry Debtors',
        'Opening Debit': 125000,
        'Opening Credit': 0,
        'Address': '123 Main Street, Colombo 03',
        'Phone': '0112345678',
        'Mobile': '0771234567',
        'Tax Number': 'VAT-987654321',
        'Email': 'info@lankahardware.lk'
      },
      {
        'Account Code': 'SUPP-001',
        'Account Name': 'Colombo Cement Industries',
        'Account Group': 'Sundry Creditors',
        'Opening Debit': 0,
        'Opening Credit': 85000,
        'Address': '45 Industrial Zone, Kaduwela',
        'Phone': '0119876543',
        'Mobile': '0719876543',
        'Tax Number': 'TIN-123456789',
        'Email': 'sales@colombocement.lk'
      },
      {
        'Account Code': 'ACC-001',
        'Account Name': 'Commercial Bank Current A/C',
        'Account Group': 'Bank Accounts',
        'Opening Debit': 450000,
        'Opening Credit': 0,
        'Address': 'Fort Branch, Colombo',
        'Phone': '0112000000',
        'Mobile': '',
        'Tax Number': '',
        'Email': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Opening Balances');
    XLSX.writeFile(workbook, 'BUSY_UFO_Master_Opening_Balance_Template.xlsx');
  },

  /**
   * Generates and triggers download of BUSY UFO Opening Stock Excel Template.
   */
  downloadStockTemplate(): void {
    const data = [
      {
        'Item Code': 'KB-001',
        'Item Name': 'Logitech Wireless Keyboard K380',
        'Item Group': 'Computer Accessories',
        'Unit': 'Nos',
        'Opening Quantity': 50,
        'Opening Rate': 4500,
        'Opening Value': 225000,
        'Sales Price': 5200,
        'Warehouse': 'Main Warehouse'
      },
      {
        'Item Code': 'MS-002',
        'Item Name': 'Dell Optical Mouse MS116',
        'Item Group': 'Computer Accessories',
        'Unit': 'Nos',
        'Opening Quantity': 100,
        'Opening Rate': 1200,
        'Opening Value': 120000,
        'Sales Price': 1500,
        'Warehouse': 'Main Warehouse'
      },
      {
        'Item Code': 'MON-003',
        'Item Name': 'Samsung 24-inch IPS Monitor',
        'Item Group': 'Monitors & Displays',
        'Unit': 'Pcs',
        'Opening Quantity': 15,
        'Opening Rate': 38000,
        'Opening Value': 570000,
        'Sales Price': 44000,
        'Warehouse': 'Branch 1'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Item Opening Stock');
    XLSX.writeFile(workbook, 'BUSY_UFO_Opening_Stock_Template.xlsx');
  },

  /**
   * Exports existing Company Customers, Suppliers, and Ledgers to Excel.
   */
  exportMasterDataToExcel(companyId: string, companyName: string): void {
    const customers = StorageService.getCustomers(companyId);
    const suppliers = StorageService.getSuppliers(companyId);
    const ledgers = StorageService.getLedgers(companyId);

    const rows: any[] = [];

    customers.forEach((c) => {
      const isDr = c.openingBalanceType !== 'Cr';
      rows.push({
        'Account Code': c.code,
        'Account Name': c.name,
        'Account Group': c.accountGroup || 'Sundry Debtors',
        'Account Type': 'Customer',
        'Opening Debit': isDr ? c.openingBalance || 0 : 0,
        'Opening Credit': !isDr ? c.openingBalance || 0 : 0,
        'Current Outstanding': c.outstandingBalance || 0,
        'Address': c.address || '',
        'Phone': c.phone || '',
        'Tax Number': c.taxNumber || '',
        'Email': c.email || ''
      });
    });

    suppliers.forEach((s) => {
      const isCr = s.openingBalanceType !== 'Dr';
      rows.push({
        'Account Code': s.code,
        'Account Name': s.name,
        'Account Group': s.accountGroup || 'Sundry Creditors',
        'Account Type': 'Supplier',
        'Opening Debit': !isCr ? s.openingBalance || 0 : 0,
        'Opening Credit': isCr ? s.openingBalance || 0 : 0,
        'Current Payable': s.payableBalance || 0,
        'Address': s.address || '',
        'Phone': s.phone || '',
        'Tax Number': s.taxNumber || '',
        'Email': s.email || ''
      });
    });

    ledgers.forEach((l) => {
      rows.push({
        'Account Code': l.code,
        'Account Name': l.name,
        'Account Group': l.accountGroup || 'General Accounts',
        'Account Type': 'General Ledger',
        'Opening Debit': l.openingDebit || 0,
        'Opening Credit': l.openingCredit || 0,
        'Current Balance': l.currentBalance || 0,
        'Address': '',
        'Phone': '',
        'Tax Number': '',
        'Email': ''
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{'Note': 'No records found for this company.'}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Accounts');
    const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeName}_Master_Accounts_Export.xlsx`);
  },

  /**
   * Exports existing Company Products and Opening Stock to Excel.
   */
  exportStockDataToExcel(companyId: string, companyName: string): void {
    const products = StorageService.getProducts(companyId);

    const rows = products.map((p) => ({
      'Item Code': p.code,
      'Item Name': p.name,
      'Item Group': p.category || 'General',
      'Unit': p.unit || 'Nos',
      'Opening Quantity': p.openingStock || p.currentStock || 0,
      'Opening Rate': p.openingRate || p.costPrice || 0,
      'Opening Value': p.openingValue || (p.currentStock * p.costPrice) || 0,
      'Selling Price': p.sellingPrice || 0,
      'Current Stock Qty': p.currentStock || 0,
      'Warehouse': p.warehouseName || 'Main Warehouse'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{'Note': 'No inventory items found for this company.'}]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Stock');
    const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeName}_Inventory_Stock_Export.xlsx`);
  }
};
