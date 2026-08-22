import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  Download,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Search,
  Check,
  History,
  Building2,
  Calendar,
  Package,
  Users,
  Sliders,
  FileText,
  BookOpen
} from 'lucide-react';
import {
  Company,
  ImportType,
  ImportHistoryRecord,
  AuthSession
} from '../types';
import { StorageService } from '../lib/storage';
import {
  ExcelImportService,
  ColumnMapping,
  ParsedMasterRow,
  ParsedStockRow,
  MASTER_TARGET_FIELDS,
  STOCK_TARGET_FIELDS
} from '../lib/excelImport';
import { STANDARD_ACCOUNT_GROUPS, detectMasterTypeFromGroup } from '../lib/accountGroups';
import { AccountGroupsModal } from './AccountGroupsModal';

interface DataImportProps {
  session: AuthSession;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onNavigateToReports?: () => void;
  onDataImported?: (companyId?: string) => void;
}

export const DataImport: React.FC<DataImportProps> = ({
  session,
  showToast,
  onNavigateToReports,
  onDataImported
}) => {
  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');

  // Multi-Company Selection
  const [companies, setCompanies] = useState<Company[]>(() => StorageService.getCompanies());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    session?.company?.id || companies[0]?.id || 'comp-abc-traders'
  );

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  // Wizard Steps
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [showAccountGroupsModal, setShowAccountGroupsModal] = useState(false);

  // Import Options
  const [importType, setImportType] = useState<ImportType>('MASTER_BALANCE');
  const [openingDate, setOpeningDate] = useState<string>(
    selectedCompany?.financialYearStart || new Date().toISOString().split('T')[0]
  );

  // File & Excel Data
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<{ sheetName: string; rows: Record<string, any>[] }[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);

  // Parsed Preview Rows
  const [masterRows, setMasterRows] = useState<ParsedMasterRow[]>([]);
  const [stockRows, setStockRows] = useState<ParsedStockRow[]>([]);

  // Configurable Rounding Tolerance (default Rs. 10.00)
  const [tolerance, setTolerance] = useState<number>(10.0);

  // Preview Filters
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'NEW' | 'DUPLICATES' | 'ERRORS'>('ALL');

  // Execution & Loading
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportHistoryRecord | null>(null);
  const [batchSelectedGroup, setBatchSelectedGroup] = useState<string>('');

  // Batch Apply Account Group to Checked Rows
  const handleBatchApplyGroup = () => {
    if (!batchSelectedGroup) return;
    const newType = detectMasterTypeFromGroup(batchSelectedGroup);
    setMasterRows((prev) =>
      prev.map((r) => {
        if (r.isSelected) {
          return {
            ...r,
            accountGroup: batchSelectedGroup,
            userSelectedType: newType
          };
        }
        return r;
      })
    );
    showToast('success', `Assigned Chart of Account Group "${batchSelectedGroup}" to all selected rows.`);
  };

  // History & Logs
  const [historyRecords, setHistoryRecords] = useState<ImportHistoryRecord[]>([]);

  // Load history records
  const refreshHistory = () => {
    setHistoryRecords(StorageService.getImportHistory(selectedCompanyId));
  };

  useEffect(() => {
    refreshHistory();
  }, [selectedCompanyId]);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    try {
      setIsProcessing(true);
      const readResult = await ExcelImportService.readExcelFile(uploadedFile);
      setFile(uploadedFile);
      setSheets(readResult);
      setSelectedSheetIndex(0);

      // Auto detect columns from first sheet
      const firstSheetRows = readResult[0]?.rows || [];
      if (firstSheetRows.length > 0) {
        const headers = Object.keys(firstSheetRows[0]);
        const suggested = ExcelImportService.suggestMappings(headers, importType);
        setColumnMappings(suggested);
      }

      showToast('success', `File "${uploadedFile.name}" uploaded. Detected ${readResult[0]?.rows.length || 0} rows.`);
      setStep(2);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to read Excel file.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-suggest mappings on sheet switch
  const handleSheetChange = (idx: number) => {
    setSelectedSheetIndex(idx);
    const rows = sheets[idx]?.rows || [];
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const suggested = ExcelImportService.suggestMappings(headers, importType);
      setColumnMappings(suggested);
    }
  };

  // Auto Detect Columns Button
  const handleAutoDetect = () => {
    const rows = sheets[selectedSheetIndex]?.rows || [];
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const suggested = ExcelImportService.suggestMappings(headers, importType);
      setColumnMappings(suggested);
      showToast('info', 'Auto column detection applied.');
    }
  };

  // Proceed to Step 3 (Preview)
  const handleProceedToPreview = () => {
    const rows = sheets[selectedSheetIndex]?.rows || [];
    if (rows.length === 0) {
      showToast('error', 'Selected sheet has no data rows.');
      return;
    }

    if (importType === 'MASTER_BALANCE') {
      const parsed = ExcelImportService.processMasterRows(rows, columnMappings, selectedCompanyId);
      if (parsed.length === 0) {
        showToast('error', 'No valid rows found. Please check column mappings.');
        return;
      }
      setMasterRows(parsed);
    } else {
      const parsed = ExcelImportService.processStockRows(rows, columnMappings, selectedCompanyId, tolerance);
      if (parsed.length === 0) {
        showToast('error', 'No valid stock rows found. Please check column mappings.');
        return;
      }
      setStockRows(parsed);
    }

    setStep(3);
  };

  // Bulk Duplicate Action update
  const handleBulkDuplicateAction = (action: 'SKIP' | 'UPDATE_MASTER' | 'UPDATE_OPENING_BALANCE' | 'MERGE') => {
    if (importType === 'MASTER_BALANCE') {
      setMasterRows((prev) =>
        prev.map((r) => (r.isDuplicate ? { ...r, duplicateAction: action } : r))
      );
    } else {
      setStockRows((prev) =>
        prev.map((r) => (r.isDuplicate ? { ...r, duplicateAction: action } : r))
      );
    }
    showToast('info', `Duplicate strategy updated to "${action}".`);
  };

  // Toggle selection for all or single row
  const handleToggleSelectAll = (checked: boolean) => {
    if (importType === 'MASTER_BALANCE') {
      setMasterRows((prev) => prev.map((r) => ({ ...r, isSelected: checked && !r.hasError })));
    } else {
      setStockRows((prev) => prev.map((r) => ({ ...r, isSelected: checked && !r.hasError })));
    }
  };

  // Execute Import (Step 4)
  const handleExecuteImport = async () => {
    if (!selectedCompany) {
      showToast('error', 'Please select a target company.');
      return;
    }

    try {
      setIsProcessing(true);
      let result: ImportHistoryRecord;

      if (importType === 'MASTER_BALANCE') {
        result = await ExcelImportService.executeMasterImport({
          company: selectedCompany,
          rows: masterRows,
          openingDate,
          fileName: file?.name || 'BUSY_Master_Balance.xlsx',
          importedBy: session?.user?.username || 'admin'
        });
      } else {
        result = await ExcelImportService.executeStockImport({
          company: selectedCompany,
          rows: stockRows,
          openingDate,
          fileName: file?.name || 'BUSY_Opening_Stock.xlsx',
          importedBy: session?.user?.username || 'admin',
          tolerance
        });
      }

      setImportResult(result);
      refreshHistory();
      onDataImported?.(selectedCompanyId);
      setStep(4);
      showToast('success', `Data import completed successfully for ${selectedCompany.companyName}.`);
    } catch (err: any) {
      showToast('error', `Import execution failed: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculations for Preview Summary
  const activeMasterRows = masterRows.filter((r) => r.isSelected);
  const activeStockRows = stockRows.filter((r) => r.isSelected);

  const masterNewCount = activeMasterRows.filter((r) => !r.isDuplicate).length;
  const masterDupCount = activeMasterRows.filter((r) => r.isDuplicate).length;

  const totalDebit = activeMasterRows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = activeMasterRows.reduce((sum, r) => sum + r.credit, 0);
  const isMasterBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const diffDebitCredit = Number((totalDebit - totalCredit).toFixed(2));

  const totalStockQty = activeStockRows.reduce((sum, r) => sum + r.openingQty, 0);
  const totalStockVal = activeStockRows.reduce((sum, r) => sum + r.excelStockValue, 0);
  const mismatchCount = activeStockRows.filter((r) => r.valueMismatch).length;
  const exceedsToleranceCount = activeStockRows.filter((r) => r.exceedsTolerance).length;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">BUSY Excel Migration & Data Import</h1>
              <p className="text-sm text-slate-500">
                Migrate master opening balances, customer ledgers, supplier balances, and opening stock seamlessly.
              </p>
            </div>
          </div>
        </div>

        {/* Company & Tab Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('wizard')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'wizard' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4" /> Import Wizard
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'history' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <History className="w-4 h-4" /> Import Logs
              </span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'wizard' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          {/* Wizard Steps Progress Bar */}
          <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-5">
            {[
              { num: 1, title: 'Configuration', sub: 'Select Company & File' },
              { num: 2, title: 'Column Mapping', sub: 'Match Excel Headers' },
              { num: 3, title: 'Preview & Validate', sub: 'Verify Balances & Values' },
              { num: 4, title: 'Complete', sub: 'Import Results Summary' }
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  step === s.num
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900'
                    : step > s.num
                    ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800'
                    : 'border-slate-100 bg-slate-50 text-slate-400'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                    step === s.num
                      ? 'bg-indigo-600 text-white'
                      : step > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold uppercase tracking-wider">{s.title}</div>
                  <div className="text-[11px] opacity-80">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* STEP 1: CONFIGURATION */}
          {step === 1 && (
            <div className="space-y-6 max-w-3xl mx-auto py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Target Company */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" /> Target Company
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.currency})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Imported records will be assigned exclusively to <strong className="text-slate-700">{selectedCompany?.companyName}</strong>.
                  </p>
                </div>

                {/* Opening Balance Date */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-600" /> Opening Balance Date
                  </label>
                  <input
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-500">
                    Effective date for opening accounting journal & stock records.
                  </p>
                </div>
              </div>

              {/* Import Type Selection */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Select Import Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label
                    onClick={() => setImportType('MASTER_BALANCE')}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-start gap-3 ${
                      importType === 'MASTER_BALANCE'
                        ? 'border-indigo-600 bg-indigo-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importType"
                      checked={importType === 'MASTER_BALANCE'}
                      onChange={() => setImportType('MASTER_BALANCE')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600" /> Master & Ledger Balances
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Import Customers, Suppliers, Debtors, Creditors, Bank, Cash, and General Ledger opening Dr/Cr balances.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportType('OPENING_STOCK')}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-start gap-3 ${
                      importType === 'OPENING_STOCK'
                        ? 'border-indigo-600 bg-indigo-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importType"
                      checked={importType === 'OPENING_STOCK'}
                      onChange={() => setImportType('OPENING_STOCK')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600" /> Item Opening Stock (Authoritative Source)
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Import Products, Quantities, Rates, and <strong>exact Excel Stock Values</strong> without forced recalculation.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sample Excel Models & Data Export Hub */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      Sample Excel Sheet Models & Data Export Hub
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Download pre-formatted Excel template models or export existing company records.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Master Template Card */}
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="font-bold text-xs text-slate-800">Master & Ledger Template</div>
                      <div className="text-[11px] text-slate-500">Customers, Suppliers, Debtors, Bank A/C</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => ExcelImportService.downloadMasterTemplate()}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Sample .xlsx
                    </button>
                  </div>

                  {/* Stock Template Card */}
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="font-bold text-xs text-slate-800">Item Opening Stock Template</div>
                      <div className="text-[11px] text-slate-500">Item Name, SKU, Rate, Qty, Stock Value</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => ExcelImportService.downloadStockTemplate()}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Sample .xlsx
                    </button>
                  </div>
                </div>

                {/* Company Export Buttons */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60">
                  <span className="text-xs font-semibold text-slate-500">Export & Reference Tools:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAccountGroupsModal(true)}
                      className="px-3 py-1 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> View 29 Account Groups Chart
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ExcelImportService.exportMasterDataToExcel(selectedCompanyId, selectedCompany?.companyName || 'Company');
                        showToast('success', `Exported Master Accounts for ${selectedCompany?.companyName}`);
                      }}
                      className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-600" /> Export Masters (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        ExcelImportService.exportStockDataToExcel(selectedCompanyId, selectedCompany?.companyName || 'Company');
                        showToast('success', `Exported Inventory Stock for ${selectedCompany?.companyName}`);
                      }}
                      className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5 text-emerald-600" /> Export Inventory (.xlsx)
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Upload BUSY Exported Excel File</span>
                </label>

                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/40 transition-all rounded-2xl p-8 text-center relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="font-semibold text-indigo-600 hover:underline">
                        Click to select BUSY Excel file
                      </span>{' '}
                      or drag and drop here
                      <p className="text-xs text-slate-400 mt-1">
                        Supports .xlsx, .xls, .csv files exported from BUSY Accounting Software.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Sheet selector if multiple */}
              {sheets.length > 1 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 text-sm">
                  <FileSpreadsheet className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="flex-1 font-medium">Multiple sheets detected in Excel file. Select Sheet:</div>
                  <select
                    value={selectedSheetIndex}
                    onChange={(e) => handleSheetChange(Number(e.target.value))}
                    className="px-3 py-1 bg-white border border-amber-300 rounded-md font-semibold text-sm"
                  >
                    {sheets.map((s, idx) => (
                      <option key={idx} value={idx}>
                        {s.sheetName} ({s.rows.length} rows)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Match Excel Columns to BUSY UFO Fields</h3>
                  <p className="text-xs text-slate-500">
                    Verify that each column in your BUSY Excel file is matched correctly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-Auto Detect
                </button>
              </div>

              {/* Mapping Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">BUSY Excel Header</th>
                      <th className="py-3 px-4">Sample Data (Row 1)</th>
                      <th className="py-3 px-4">BUSY UFO Target Field</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {columnMappings.map((m, idx) => {
                      const sampleVal = sheets[selectedSheetIndex]?.rows[0]?.[m.excelColumn] ?? '';
                      const isMatched = m.targetField !== 'IGNORE';

                      const fieldDefs = importType === 'MASTER_BALANCE' ? MASTER_TARGET_FIELDS : STOCK_TARGET_FIELDS;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 font-bold text-slate-800">{m.excelColumn}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-500 font-mono max-w-xs truncate">
                            {String(sampleVal) || <span className="italic text-slate-300">empty</span>}
                          </td>
                          <td className="py-2.5 px-4">
                            <select
                              value={m.targetField}
                              onChange={(e) => {
                                const newMappings = [...columnMappings];
                                newMappings[idx].targetField = e.target.value;
                                setColumnMappings(newMappings);
                              }}
                              className={`w-full px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 ${
                                isMatched
                                  ? 'border-indigo-300 bg-indigo-50/30 text-indigo-900 focus:ring-indigo-500'
                                  : 'border-slate-200 bg-slate-50 text-slate-500'
                              }`}
                            >
                              <option value="IGNORE">-- Ignore Column --</option>
                              {fieldDefs.map((fd) => (
                                <option key={fd.key} value={fd.key}>
                                  {fd.label} {fd.required ? '*' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {isMatched ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                <Check className="w-3 h-3" /> Mapped
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-400">
                                Ignored
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg text-sm flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Upload
                </button>
                <button
                  type="button"
                  onClick={handleProceedToPreview}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm flex items-center gap-2 shadow-sm"
                >
                  Proceed to Preview <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Authoritative Banner for Stock Import */}
              {importType === 'OPENING_STOCK' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-950">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-emerald-950 uppercase tracking-wide block">
                        Authoritative Source Mode Active
                      </span>
                      <span className="text-emerald-900">
                        Excel stock values are stored as the absolute authoritative source of truth. Calculated values (Qty × Rate) are generated for validation reporting.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-300 shrink-0 shadow-sm">
                    <span className="font-medium text-slate-700">Rounding Tolerance:</span>
                    <span className="font-bold text-indigo-700">Rs.</span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={tolerance}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setTolerance(val);
                        const rows = sheets[selectedSheetIndex]?.rows || [];
                        if (rows.length > 0) {
                          const parsed = ExcelImportService.processStockRows(rows, columnMappings, selectedCompanyId, val);
                          setStockRows(parsed);
                        }
                      }}
                      className="w-20 px-2 py-0.5 border border-slate-300 rounded font-mono font-bold text-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              {importType === 'MASTER_BALANCE' ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-medium">New Customers</div>
                    <div className="text-xl font-extrabold text-slate-800">{masterNewCount}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-medium">Duplicates Found</div>
                    <div className="text-xl font-extrabold text-amber-600">{masterDupCount}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-medium">Opening Debit</div>
                    <div className="text-lg font-bold text-emerald-700">
                      {selectedCompany.currency} {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-medium">Opening Credit</div>
                    <div className="text-lg font-bold text-rose-700">
                      {selectedCompany.currency} {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div
                    className={`border rounded-xl p-3 col-span-2 md:col-span-1 ${
                      isMasterBalanced
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider">Balance Status</div>
                    <div className="text-base font-extrabold flex items-center gap-1.5 mt-0.5">
                      {isMasterBalanced ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" /> BALANCED
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-rose-600" /> UNBALANCED
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-medium">Items to Import</div>
                    <div className="text-xl font-extrabold text-slate-800">{activeStockRows.length}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-medium">Total Quantity</div>
                    <div className="text-xl font-extrabold text-indigo-700">{totalStockQty}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 font-medium">Total Valuation (Authoritative)</div>
                    <div className="text-lg font-bold text-emerald-700">
                      {selectedCompany.currency} {totalStockVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div
                    className={`border rounded-xl p-3 ${
                      exceedsToleranceCount === 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider">Discrepancy Status</div>
                    <div className="text-base font-extrabold flex items-center gap-1.5 mt-0.5">
                      {mismatchCount === 0 ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" /> EXACT MATCH
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-amber-600" /> {mismatchCount} Discrepancies ({exceedsToleranceCount} Exceed Tolerance)
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Controls & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search preview rows..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-48 sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <select
                    value={previewFilter}
                    onChange={(e: any) => setPreviewFilter(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">All Rows</option>
                    <option value="NEW">New Records Only</option>
                    <option value="DUPLICATES">Duplicates Only</option>
                    <option value="ERRORS">Errors Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Duplicate Handling Strategy:</span>
                  <select
                    onChange={(e: any) => handleBulkDuplicateAction(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-900 rounded-lg text-xs font-semibold focus:outline-none"
                  >
                    <option value="UPDATE_OPENING_BALANCE">Update Opening Balances</option>
                    <option value="UPDATE_MASTER">Update Master & Details</option>
                    <option value="SKIP">Skip Duplicate Rows</option>
                  </select>
                </div>
              </div>

              {/* Batch Assign Account Group for Master Balances */}
              {importType === 'MASTER_BALANCE' && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Sliders className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Batch Assign Chart of Account Group to Checked Rows:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={batchSelectedGroup}
                      onChange={(e) => setBatchSelectedGroup(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium shadow-2xs focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Choose Account Group --</option>
                      {STANDARD_ACCOUNT_GROUPS.map((g) => (
                        <option key={g.no} value={g.name}>
                          {g.no}. {g.name} ({g.nature})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleBatchApplyGroup}
                      disabled={!batchSelectedGroup}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold rounded-lg shadow-2xs cursor-pointer transition-colors"
                    >
                      Apply to Selected
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                {importType === 'MASTER_BALANCE' ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={masterRows.length > 0 && masterRows.every((r) => r.isSelected)}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-3">Chart of Account Group</th>
                        <th className="py-2.5 px-3">Account Type</th>
                        <th className="py-2.5 px-3 text-right">Debit ({selectedCompany.currency})</th>
                        <th className="py-2.5 px-3 text-right">Credit ({selectedCompany.currency})</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {masterRows
                        .filter((r) => {
                          if (previewFilter === 'NEW' && r.isDuplicate) return false;
                          if (previewFilter === 'DUPLICATES' && !r.isDuplicate) return false;
                          if (previewFilter === 'ERRORS' && !r.hasError) return false;
                          if (previewSearch) {
                            return (
                              r.name.toLowerCase().includes(previewSearch.toLowerCase()) ||
                              r.accountGroup.toLowerCase().includes(previewSearch.toLowerCase())
                            );
                          }
                          return true;
                        })
                        .map((r, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50 ${
                              !r.isSelected ? 'opacity-40 bg-slate-50' : r.isDuplicate ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={r.isSelected}
                                onChange={(e) => {
                                  const updated = [...masterRows];
                                  updated[idx].isSelected = e.target.checked;
                                  setMasterRows(updated);
                                }}
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono">#{r.rowIndex}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{r.name}</td>
                            <td className="py-2 px-3">
                              <select
                                value={r.accountGroup || 'Sundry Debtors'}
                                onChange={(e) => {
                                  const newGroup = e.target.value;
                                  const newType = detectMasterTypeFromGroup(newGroup);
                                  const updated = [...masterRows];
                                  updated[idx].accountGroup = newGroup;
                                  updated[idx].userSelectedType = newType;
                                  setMasterRows(updated);
                                }}
                                className="px-2 py-1 border border-slate-300 rounded text-xs font-semibold bg-white max-w-[200px] text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500"
                              >
                                {!STANDARD_ACCOUNT_GROUPS.some((g) => g.name === r.accountGroup) && r.accountGroup && (
                                  <option value={r.accountGroup}>{r.accountGroup}</option>
                                )}
                                {STANDARD_ACCOUNT_GROUPS.map((g) => (
                                  <option key={g.no} value={g.name}>
                                    {g.no}. {g.name} ({g.nature})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={r.userSelectedType}
                                onChange={(e: any) => {
                                  const updated = [...masterRows];
                                  updated[idx].userSelectedType = e.target.value;
                                  setMasterRows(updated);
                                }}
                                className={`px-2 py-1 border rounded text-[11px] font-bold shadow-2xs ${
                                  r.userSelectedType === 'CUSTOMER'
                                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                                    : r.userSelectedType === 'SUPPLIER'
                                    ? 'bg-purple-50 border-purple-300 text-purple-800'
                                    : 'bg-amber-50 border-amber-300 text-amber-800'
                                }`}
                              >
                                <option value="CUSTOMER">Customer (Debtor)</option>
                                <option value="SUPPLIER">Supplier (Creditor)</option>
                                <option value="LEDGER">Other Ledger</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                              {r.debit > 0 ? r.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-rose-700 font-semibold">
                              {r.credit > 0 ? r.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {r.isDuplicate ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Duplicate
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  New
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={stockRows.length > 0 && stockRows.every((r) => r.isSelected)}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Group</th>
                        <th className="py-2.5 px-3">Warehouse</th>
                        <th className="py-2.5 px-3 text-right">Opening Qty</th>
                        <th className="py-2.5 px-3 text-right">Cost Rate</th>
                        <th className="py-2.5 px-3 text-right text-indigo-700">Sale Price</th>
                        <th className="py-2.5 px-3 text-right text-emerald-800">Excel Value (Preserved)</th>
                        <th className="py-2.5 px-3 text-right text-slate-500">Calculated (Qty×Rate)</th>
                        <th className="py-2.5 px-3 text-right">Difference</th>
                        <th className="py-2.5 px-3 text-center">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockRows
                        .filter((r) => {
                          if (previewFilter === 'NEW' && r.isDuplicate) return false;
                          if (previewFilter === 'DUPLICATES' && !r.isDuplicate) return false;
                          if (previewFilter === 'ERRORS' && !r.hasError) return false;
                          if (previewSearch) {
                            return (
                              r.itemName.toLowerCase().includes(previewSearch.toLowerCase()) ||
                              r.itemGroup.toLowerCase().includes(previewSearch.toLowerCase())
                            );
                          }
                          return true;
                        })
                        .map((r, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50 ${
                              !r.isSelected ? 'opacity-40 bg-slate-50' : r.exceedsTolerance ? 'bg-amber-50/60' : r.isDuplicate ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={r.isSelected}
                                onChange={(e) => {
                                  const updated = [...stockRows];
                                  updated[idx].isSelected = e.target.checked;
                                  setStockRows(updated);
                                }}
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono">#{r.rowIndex}</td>
                            <td className="py-2 px-3 font-bold text-slate-800">{r.itemName}</td>
                            <td className="py-2 px-3 text-slate-500">{r.itemGroup}</td>
                            <td className="py-2 px-3 text-slate-600 font-medium">{r.warehouseName}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                              {r.openingQty} {r.unit}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {selectedCompany.currency} {r.openingRate.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-indigo-700">
                              {r.sellingPrice > 0 ? `${selectedCompany.currency} ${r.sellingPrice.toFixed(2)}` : <span className="text-slate-400 italic">Auto (+15%)</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50">
                              {selectedCompany.currency} {r.excelStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                              {selectedCompany.currency} {r.calculatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold">
                              {r.valueMismatch ? (
                                r.exceedsTolerance ? (
                                  <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                                    Rs. {Math.abs(r.valueDifference).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                    Rs. {Math.abs(r.valueDifference).toFixed(2)}
                                  </span>
                                )
                              ) : (
                                <span className="text-emerald-600 text-[11px]">Rs. 0.00</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {r.valueMismatch ? (
                                r.exceedsTolerance ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 inline-flex items-center gap-1" title={r.warningMessage}>
                                    <AlertTriangle className="w-3 h-3" /> Review Required
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800" title="Within tolerance threshold">
                                    Preserved
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Exact Match
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Execution Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded-lg text-sm flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Mappings
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleExecuteImport}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Importing Data...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Execute Import Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT COMPLETED */}
          {step === 4 && importResult && (
            <div className="space-y-6 max-w-3xl mx-auto py-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-slate-800">DATA IMPORT COMPLETED</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Successfully imported records into <strong className="text-slate-800">{importResult.companyName}</strong> on {importResult.openingDate}.
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-4 border border-slate-200 rounded-2xl p-5 bg-slate-50 text-left">
                <div>
                  <div className="text-xs text-slate-500 font-medium uppercase">Records Created</div>
                  <div className="text-2xl font-extrabold text-emerald-700">{importResult.recordsCreated}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium uppercase">Records Updated</div>
                  <div className="text-2xl font-extrabold text-indigo-700">{importResult.recordsUpdated}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium uppercase">Records Skipped</div>
                  <div className="text-2xl font-extrabold text-slate-400">{importResult.recordsSkipped}</div>
                </div>
              </div>

              {/* Stock Discrepancy Audit Log */}
              {importResult.stockWarnings && importResult.stockWarnings.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 text-left space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                    <div className="font-extrabold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Stock Discrepancy Audit Log ({importResult.stockWarnings.length} Items Preserved)
                    </div>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Tolerance Threshold: Rs. {(importResult.toleranceSetting || tolerance).toFixed(2)}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="text-amber-800 border-b border-amber-200 font-bold uppercase text-[10px]">
                          <th className="py-1.5 px-2">Item Name</th>
                          <th className="py-1.5 px-2 text-right">Excel Value (Preserved)</th>
                          <th className="py-1.5 px-2 text-right">Calculated (Qty×Rate)</th>
                          <th className="py-1.5 px-2 text-right">Difference</th>
                          <th className="py-1.5 px-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100/80 text-[11px]">
                        {importResult.stockWarnings.map((w, idx) => (
                          <tr key={idx} className="hover:bg-amber-100/40">
                            <td className="py-1.5 px-2 font-bold text-amber-950 font-sans">{w.itemName}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-emerald-800">
                              Rs. {w.excelValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 px-2 text-right text-slate-600">
                              Rs. {w.calculatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-amber-900">
                              Rs. {Math.abs(w.difference).toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-center font-sans">
                              {w.exceedsTolerance ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                  Review Required – Excel Preserved
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Imported – Excel Preserved
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setMasterRows([]);
                    setStockRows([]);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> Import Another File
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-sm flex items-center gap-2 cursor-pointer"
                >
                  <History className="w-4 h-4 text-indigo-600" /> View Import History
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* IMPORT LOGS TAB */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Historical Import Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Audit logs for all Excel imports performed for {selectedCompany?.companyName}.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshHistory}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Import ID & Date</th>
                  <th className="py-3 px-4">Import Type</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4 text-center">Created / Updated</th>
                  <th className="py-3 px-4 text-right">Total Stock Value / Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No import logs found for this company.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 font-mono">{rec.id}</div>
                        <div className="text-[11px] text-slate-400">{new Date(rec.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700">
                          {rec.importType === 'MASTER_BALANCE' ? 'Master Balances' : 'Opening Stock'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{rec.fileName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-emerald-700">{rec.recordsCreated}</span> created /{' '}
                        <span className="font-bold text-indigo-700">{rec.recordsUpdated}</span> updated
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        Rs. {(rec.totalStockValue || rec.totalDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account Groups Modal */}
      {showAccountGroupsModal && (
        <AccountGroupsModal onClose={() => setShowAccountGroupsModal(false)} />
      )}
    </div>
  );
};
