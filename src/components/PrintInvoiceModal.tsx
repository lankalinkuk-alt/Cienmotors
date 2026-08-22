import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  MessageCircle,
  Sliders,
  FileText,
  Receipt,
  RotateCcw,
  Check
} from 'lucide-react';
import {
  SaleInvoice,
  PurchaseInvoice,
  AppSettings,
  InvoicePrintFormat,
  Company
} from '../types';
import { StorageService } from '../lib/storage';
import { shareInvoiceViaWhatsApp } from '../lib/whatsapp';

interface PrintInvoiceModalProps {
  invoice: SaleInvoice | PurchaseInvoice | null;
  isPurchase?: boolean;
  settings: AppSettings;
  company?: Company | null;
  onClose: () => void;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({
  invoice,
  isPurchase = false,
  settings,
  company: companyProp,
  onClose
}) => {
  if (!invoice) return null;

  // Print Format State initialized from settings
  const [printFormat, setPrintFormat] = useState<InvoicePrintFormat>(
    settings.defaultPrintFormat || 'A4'
  );
  const [fontSize, setFontSize] = useState<'compact' | 'normal' | 'large'>(
    settings.printFontSize || 'normal'
  );
  const [customWidthMm, setCustomWidthMm] = useState<number>(
    settings.customPageWidthMm || (settings.defaultPrintFormat === 'A5' ? 148 : settings.defaultPrintFormat === 'THERMAL_80' ? 80 : settings.defaultPrintFormat === 'THERMAL_58' ? 58 : 210)
  );
  const [isDotMatrixDashed, setIsDotMatrixDashed] = useState<boolean>(
    settings.dotMatrixDashedBorders ?? true
  );
  const [showCustomControls, setShowCustomControls] = useState<boolean>(false);

  // Sync format changes with sensible width defaults
  const handleSelectFormat = (fmt: InvoicePrintFormat) => {
    setPrintFormat(fmt);
    if (fmt === 'A4') setCustomWidthMm(210);
    else if (fmt === 'A5') setCustomWidthMm(148);
    else if (fmt === 'DOT_MATRIX') setCustomWidthMm(215); // 8.5" standard tractor
    else if (fmt === 'THERMAL_80') setCustomWidthMm(80);
    else if (fmt === 'THERMAL_58') setCustomWidthMm(58);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    shareInvoiceViaWhatsApp(invoice, isPurchase, settings);
  };

  const sale = !isPurchase ? (invoice as SaleInvoice) : null;
  const purchase = isPurchase ? (invoice as PurchaseInvoice) : null;

  const docNumber = sale ? sale.invoiceNumber : purchase?.purchaseNumber;
  const partyName = sale ? sale.customerName : purchase?.supplierName;
  const docTitle = isPurchase ? 'PURCHASE VOUCHER' : 'INVOICE';

  // Resolve active company details for print header
  const targetCompany: Company | null =
    companyProp ||
    (invoice.companyId ? StorageService.getCompanyById(invoice.companyId) : null) ||
    StorageService.getCompanies().find((c) => c.isActive) ||
    StorageService.getCompanies()[0] ||
    null;

  const companyName = targetCompany?.companyName || settings.companyName || 'BUSINESS NAME';

  const addressParts = targetCompany
    ? [targetCompany.address, targetCompany.city, targetCompany.district, targetCompany.country].filter(Boolean)
    : [settings.companyAddress].filter(Boolean);
  const companyAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Address Not Specified';

  const phoneParts = targetCompany
    ? [targetCompany.telephone, targetCompany.mobile].filter(Boolean)
    : [settings.companyPhone].filter(Boolean);
  const companyPhone = phoneParts.length > 0 ? phoneParts.join(' / ') : 'N/A';

  const companyEmail = targetCompany?.companyEmail || settings.companyEmail || '';
  const taxRegistrationNo = targetCompany?.taxRegistrationNo || targetCompany?.vatNumber || settings.taxRegistrationNo || '';

  // Party Contact Info lookup
  const customer = sale?.customerId ? StorageService.getCustomers().find((c) => c.id === sale.customerId) : null;
  const supplier = purchase?.supplierId ? StorageService.getSuppliers().find((s) => s.id === purchase.supplierId) : null;

  const partyPhone = customer?.phone || customer?.mobile || supplier?.phone || supplier?.mobile || '';
  const partyAddress = customer?.address || customer?.city || supplier?.address || supplier?.city || '';

  const hasAnyItemDiscount = invoice.items.some(
    (item) => item.discount && item.discount > 0
  );

  // Build dynamic print page CSS
  let pageStyle = '@page { size: A4 portrait; margin: 10mm; }';
  let containerMaxWidth = 'max-w-2xl';
  let fontScaleClass = 'text-xs';

  if (fontSize === 'compact') fontScaleClass = 'text-[11px] leading-tight';
  else if (fontSize === 'large') fontScaleClass = 'text-sm leading-normal';

  if (printFormat === 'A4') {
    pageStyle = '@page { size: A4 portrait; margin: 8mm; }';
    containerMaxWidth = 'max-w-3xl';
  } else if (printFormat === 'A5') {
    pageStyle = '@page { size: A5 landscape; margin: 6mm; }';
    containerMaxWidth = 'max-w-xl';
  } else if (printFormat === 'DOT_MATRIX') {
    // 8.5 x 5.5 half-sheet continuous or 8.5 x 11
    pageStyle = '@page { size: auto; margin: 4mm; }';
    containerMaxWidth = 'max-w-2xl';
  } else if (printFormat === 'THERMAL_80') {
    pageStyle = '@page { size: 80mm auto; margin: 2mm; }';
    containerMaxWidth = 'max-w-[340px]';
  } else if (printFormat === 'THERMAL_58') {
    pageStyle = '@page { size: 58mm auto; margin: 1mm; }';
    containerMaxWidth = 'max-w-[260px]';
  } else if (printFormat === 'CUSTOM') {
    pageStyle = `@page { size: ${customWidthMm}mm auto; margin: 4mm; }`;
    containerMaxWidth = 'w-full';
  }

  // Effect to add body class for modal printing
  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => {
      document.body.classList.remove('has-print-modal');
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto" id="print-modal-container">
      {/* Injected Print Media Styling */}
      <style>
        {`
          @media print {
            ${pageStyle}
            #printable-invoice {
              width: ${
                printFormat === 'THERMAL_80'
                  ? '76mm'
                  : printFormat === 'THERMAL_58'
                  ? '54mm'
                  : printFormat === 'CUSTOM'
                  ? `${customWidthMm}mm`
                  : '100%'
              } !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: white !important;
              color: black !important;
            }
          }
        `}
      </style>

      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full p-4 sm:p-6 animate-in fade-in zoom-in-95 my-6 ${
          printFormat === 'THERMAL_80' || printFormat === 'THERMAL_58'
            ? 'max-w-md'
            : 'max-w-4xl'
        }`}
      >
        {/* Top Action Bar (Hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">
                {isPurchase ? 'Purchase Voucher Print' : 'Sales Invoice Print'}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {docNumber} • {invoice.date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCustomControls(!showCustomControls)}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showCustomControls
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Customize Print Size & Fonts"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Page Setup</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-2xs cursor-pointer transition-colors"
              title="Send via WhatsApp"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-2xs cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4 text-yellow-300" />
              <span>Print Now</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Format Selector Tabs (Hidden when printing) */}
        <div className="pt-3 pb-2 border-b border-slate-100 print:hidden space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
              Printer Format & Paper Size:
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              Active: <strong className="text-slate-800">{printFormat}</strong> ({customWidthMm}mm)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectFormat('A4')}
              className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-all ${
                printFormat === 'A4'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-sm">📄</span>
              <span className="text-[11px]">A4 Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectFormat('A5')}
              className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-all ${
                printFormat === 'A5'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-sm">📑</span>
              <span className="text-[11px]">A5 Half Page</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectFormat('DOT_MATRIX')}
              className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-all ${
                printFormat === 'DOT_MATRIX'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-sm">🖨️</span>
              <span className="text-[11px]">Dot Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectFormat('THERMAL_80')}
              className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-all ${
                printFormat === 'THERMAL_80'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-sm">🧾</span>
              <span className="text-[11px]">80mm POS</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectFormat('THERMAL_58')}
              className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-all ${
                printFormat === 'THERMAL_58'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-sm">🧾</span>
              <span className="text-[11px]">58mm Mini</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectFormat('CUSTOM')}
              className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-all ${
                printFormat === 'CUSTOM'
                  ? 'bg-slate-900 text-yellow-400 border-slate-900 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-sm">📐</span>
              <span className="text-[11px]">Custom Size</span>
            </button>
          </div>

          {/* Collapsible Custom Page Setup Toolbar */}
          {showCustomControls && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Page Width ({customWidthMm} mm)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="50"
                    max="220"
                    value={customWidthMm}
                    onChange={(e) => {
                      setCustomWidthMm(Number(e.target.value));
                      setPrintFormat('CUSTOM');
                    }}
                    className="w-full h-1.5 bg-slate-300 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min="50"
                    max="250"
                    value={customWidthMm}
                    onChange={(e) => {
                      setCustomWidthMm(Number(e.target.value));
                      setPrintFormat('CUSTOM');
                    }}
                    className="w-16 p-1 border border-slate-300 bg-white rounded-md text-center font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Font Density
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['compact', 'normal', 'large'] as const).map((fs) => (
                    <button
                      key={fs}
                      type="button"
                      onClick={() => setFontSize(fs)}
                      className={`p-1 text-[10px] font-bold rounded-lg border capitalize ${
                        fontSize === fs
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {fs}
                    </button>
                  ))}
                </div>
              </div>

              {printFormat === 'DOT_MATRIX' && (
                <div className="flex items-center justify-between sm:justify-start gap-2 pt-4">
                  <label className="text-[11px] font-bold text-slate-700 cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isDotMatrixDashed}
                      onChange={(e) => setIsDotMatrixDashed(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>Dashed Monospace Borders</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PRINTABLE DOCUMENT AREA (Auto adapts to selected format & printer type) */}
        {/* ========================================================================= */}
        <div className="overflow-x-auto py-4 max-h-[70vh] flex justify-center bg-slate-100/60 rounded-xl p-2 sm:p-4 print:max-h-none print:overflow-visible print:bg-transparent print:p-0 print:m-0 print:border-none print:shadow-none">
          {/* 1. DOT MATRIX / CONTINUOUS PAPER VIEW */}
          {printFormat === 'DOT_MATRIX' ? (
            <div
              id="printable-invoice"
              className={`bg-white text-black font-mono p-4 sm:p-6 shadow-md border-2 border-dashed border-black ${containerMaxWidth} w-full ${fontScaleClass}`}
              style={{
                fontFamily:
                  "'Courier New', Courier, Consolas, Monaco, monospace",
                lineHeight: '1.3'
              }}
            >
              {/* Dot Matrix Header */}
              <div className="text-center pb-2 border-b-2 border-dashed border-black">
                <p className="text-base sm:text-lg font-black uppercase tracking-wider">
                  *** {companyName} ***
                </p>
                <p className="text-[11px] font-semibold">
                  {companyAddress}
                </p>
                <p className="text-[11px]">
                  TEL: {companyPhone}
                  {companyEmail ? ` | EMAIL: ${companyEmail}` : ''}
                  {taxRegistrationNo ? ` | VAT/TAX: ${taxRegistrationNo}` : ''}
                </p>
                <p className="text-xs font-bold mt-1 uppercase">
                  ================ {docTitle} ================
                </p>
              </div>

              {/* Dot Matrix Doc Info */}
              <div className="grid grid-cols-2 gap-2 py-2 border-b border-dashed border-black text-[11px]">
                <div>
                  <span className="font-bold">
                    {isPurchase ? 'SUPPLIER: ' : 'CUSTOMER: '}
                  </span>
                  <span className="font-black">{partyName}</span>
                  {partyAddress && <div className="text-[10px]">{partyAddress}</div>}
                  {partyPhone && <div className="text-[10px]">TEL: {partyPhone}</div>}
                </div>
                <div className="text-right">
                  <span>DOC NO: </span>
                  <span className="font-bold">{docNumber}</span>
                </div>
                <div>
                  <span>DATE: </span>
                  <span className="font-bold">{invoice.date}</span>
                </div>
                <div className="text-right">
                  <span>TERMS: </span>
                  <span className="font-bold">[{invoice.type}]</span>
                </div>
              </div>

              {/* Dot Matrix Items Table */}
              <div className="py-2">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-dashed border-black font-bold uppercase">
                      <th className="py-1">#</th>
                      <th className="py-1">DESCRIPTION</th>
                      <th className="py-1 text-center">QTY</th>
                      <th className="py-1 text-right">RATE</th>
                      {hasAnyItemDiscount && (
                        <th className="py-1 text-right">DISC</th>
                      )}
                      <th className="py-1 text-right">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-black/40">
                    {invoice.items.map((item, idx) => {
                      const qty = item.quantity;
                      const price =
                        'unitPrice' in item ? item.unitPrice : item.unitCost;
                      const lineTotal = item.total;
                      const hasDiscount = Boolean(
                        item.discount && item.discount > 0
                      );

                      return (
                        <tr key={idx}>
                          <td className="py-1 align-top">{idx + 1}</td>
                          <td className="py-1 align-top">
                            <span className="font-bold">{item.productName}</span>
                          </td>
                          <td className="py-1 text-center align-top">{qty}</td>
                          <td className="py-1 text-right align-top">
                            {price.toFixed(2)}
                          </td>
                          {hasAnyItemDiscount && (
                            <td className="py-1 text-right align-top">
                              {hasDiscount
                                ? item.discountType === 'FIXED'
                                  ? `${item.discount?.toFixed(2)}`
                                  : `${item.discount}%`
                                : '-'}
                            </td>
                          )}
                          <td className="py-1 text-right font-bold align-top">
                            {lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Dot Matrix Totals */}
              <div className="border-t-2 border-dashed border-black pt-2 flex justify-end">
                <div className="w-56 space-y-0.5 text-[11px]">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>
                      {settings.currencySymbol} {invoice.subtotal.toFixed(2)}
                    </span>
                  </div>
                  {invoice.discount > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>DISCOUNT:</span>
                      <span>
                        - {settings.currencySymbol} {invoice.discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-dashed border-black">
                    <span>GRAND TOTAL:</span>
                    <span>
                      {settings.currencySymbol} {invoice.grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>PAID AMT:</span>
                    <span>
                      {settings.currencySymbol} {invoice.paidAmount.toFixed(2)}
                    </span>
                  </div>
                  {invoice.dueAmount > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>BALANCE DUE:</span>
                      <span>
                        {settings.currencySymbol} {invoice.dueAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dot Matrix Footer */}
              <div className="mt-4 pt-2 border-t border-dashed border-black text-center text-[10px]">
                <p className="uppercase">{settings.invoiceNote}</p>
                <p className="mt-1 opacity-70">
                  *** THANK YOU FOR YOUR BUSINESS ***
                </p>
              </div>
            </div>
          ) : printFormat === 'THERMAL_80' || printFormat === 'THERMAL_58' ? (
            /* 2. THERMAL POS RECEIPT VIEW (80mm / 58mm) */
            <div
              id="printable-invoice"
              className={`bg-white text-black font-mono p-3 sm:p-4 shadow-md border border-slate-300 ${containerMaxWidth} w-full ${fontScaleClass}`}
              style={{
                fontFamily:
                  "'Courier New', Courier, Consolas, Monaco, monospace"
              }}
            >
              {/* Thermal Header with Prominent Company Name & Details */}
              <div className="text-center pb-2 border-b border-dashed border-black">
                <h1 className="text-sm sm:text-base font-black uppercase tracking-tight">
                  {companyName}
                </h1>
                <p className="text-[10px] font-medium">{companyAddress}</p>
                <p className="text-[10px] font-mono">Tel: {companyPhone}</p>
                {companyEmail && <p className="text-[10px] font-mono">Email: {companyEmail}</p>}
                {taxRegistrationNo && (
                  <p className="text-[10px] font-mono">VAT/Tax: {taxRegistrationNo}</p>
                )}
                <div className="text-[11px] font-bold mt-1 uppercase border-t border-b border-black py-0.5">
                  {docTitle}
                </div>
              </div>

              {/* Thermal Meta */}
              <div className="py-2 text-[10px] space-y-0.5 border-b border-dashed border-black">
                <div className="flex justify-between">
                  <span>Doc #:</span>
                  <span className="font-bold">{docNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{invoice.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isPurchase ? 'Supplier:' : 'Customer:'}</span>
                  <span className="font-bold truncate max-w-[140px] text-right">
                    {partyName}
                  </span>
                </div>
                {partyPhone && (
                  <div className="flex justify-between text-[9px] text-slate-700 font-mono">
                    <span>Contact:</span>
                    <span>{partyPhone}</span>
                  </div>
                )}
                {partyAddress && (
                  <div className="flex justify-between text-[9px] text-slate-700">
                    <span>Address:</span>
                    <span className="truncate max-w-[130px] text-right">{partyAddress}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <span>{invoice.type}</span>
                </div>
              </div>

              {/* Thermal Items List */}
              <div className="py-2 border-b border-dashed border-black space-y-1.5 text-[11px]">
                {invoice.items.map((item, idx) => {
                  const qty = item.quantity;
                  const price =
                    'unitPrice' in item ? item.unitPrice : item.unitCost;
                  const lineTotal = item.total;
                  const hasDiscount = Boolean(item.discount && item.discount > 0);

                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="font-bold flex justify-between">
                        <span className="truncate pr-1">
                          {idx + 1}. {item.productName}
                        </span>
                        <span className="shrink-0">{lineTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600 pl-3">
                        <span>
                          {qty} x {price.toFixed(2)}
                          {hasDiscount && (
                            <span className="text-rose-600 font-bold ml-1">
                              (Disc:{' '}
                              {item.discountType === 'FIXED'
                                ? `${settings.currencySymbol}${item.discount}`
                                : `${item.discount}%`}
                              )
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Thermal Totals */}
              <div className="py-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>
                    {settings.currencySymbol} {invoice.subtotal.toFixed(2)}
                  </span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Discount:</span>
                    <span>
                      - {settings.currencySymbol} {invoice.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black pt-1 border-t border-dashed border-black">
                  <span>TOTAL:</span>
                  <span>
                    {settings.currencySymbol} {invoice.grandTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Paid:</span>
                  <span>
                    {settings.currencySymbol} {invoice.paidAmount.toFixed(2)}
                  </span>
                </div>
                {invoice.dueAmount > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Balance Due:</span>
                    <span>
                      {settings.currencySymbol} {invoice.dueAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Thermal Footer */}
              <div className="mt-3 pt-2 border-t border-dashed border-black text-center text-[10px] space-y-1">
                <p className="italic">{settings.invoiceNote}</p>
                <p className="font-bold">*** THANK YOU ***</p>
                <p className="text-[9px] tracking-widest font-mono">
                  ||| | | |||| | ||| |||| |
                </p>
              </div>
            </div>
          ) : (
            /* 3. STANDARD MODERN FORMAT (A4 / A5 / Custom) */
            <div
              id="printable-invoice"
              className={`bg-white text-slate-800 p-6 sm:p-8 shadow-md border border-slate-200 ${containerMaxWidth} w-full ${fontScaleClass}`}
            >
              {/* Header with Prominent Company Details */}
              <div className="pb-5 border-b-2 border-slate-900 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 mb-1.5">
                    <span className="text-xl font-black text-blue-600 tracking-tight">
                      Busy
                    </span>
                    <span className="text-xl font-black text-yellow-500 bg-yellow-100 px-1.5 py-0.2 rounded-md border border-yellow-300 text-xs">
                      UFO
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide">
                    {companyName}
                  </h1>
                  <p className="text-xs text-slate-700 font-semibold mt-0.5">
                    {companyAddress}
                  </p>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    Tel: <strong className="text-slate-800">{companyPhone}</strong>
                    {companyEmail ? ` | Email: ${companyEmail}` : ''}
                  </p>
                  {taxRegistrationNo && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      Tax / VAT Reg No: <strong>{taxRegistrationNo}</strong>
                    </p>
                  )}
                </div>

                <div className="sm:text-right space-y-1 shrink-0">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white font-extrabold text-xs tracking-wider uppercase rounded-lg">
                    {docTitle}
                  </span>
                  <div className="font-mono text-xs pt-1">
                    <div>
                      <span className="text-slate-500 mr-1">No:</span>
                      <strong className="text-slate-900">{docNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 mr-1">Date:</span>
                      <span className="text-slate-800">{invoice.date}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 mr-1">Terms:</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded font-bold">
                        {invoice.type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Party Information */}
              <div className="py-4 border-b border-slate-200 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    {isPurchase ? 'SUPPLIER / VENDOR:' : 'BILL TO CUSTOMER:'}
                  </span>
                  <p className="font-bold text-sm text-slate-900">{partyName}</p>
                  {partyAddress && (
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{partyAddress}</p>
                  )}
                  {partyPhone && (
                    <p className="text-xs text-slate-600 font-mono mt-0.5">Tel: {partyPhone}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    STATUS / PAYMENT:
                  </span>
                  <p className="font-bold text-xs">
                    {invoice.dueAmount === 0 ? (
                      <span className="text-emerald-700 font-extrabold">PAID IN FULL</span>
                    ) : (
                      <span className="text-amber-700 font-extrabold">
                        PARTIAL / DUE ({settings.currencySymbol}{' '}
                        {invoice.dueAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2
                        })}
                        )
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="py-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 text-slate-900 font-bold uppercase">
                      <th className="py-2 px-1">#</th>
                      <th className="py-2 px-2">Item Description</th>
                      <th className="py-2 px-2 text-center">Qty</th>
                      <th className="py-2 px-2 text-right">Price</th>
                      {hasAnyItemDiscount && (
                        <th className="py-2 px-2 text-right">Disc</th>
                      )}
                      <th className="py-2 px-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {invoice.items.map((item, idx) => {
                      const qty = item.quantity;
                      const price =
                        'unitPrice' in item ? item.unitPrice : item.unitCost;
                      const lineTotal = item.total;
                      const hasDiscount = Boolean(
                        item.discount && item.discount > 0
                      );

                      return (
                        <tr key={idx}>
                          <td className="py-2.5 px-1 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-2">
                            <div className="font-bold">{item.productName}</div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold font-mono">
                            {qty}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            {settings.currencySymbol}{' '}
                            {price.toLocaleString('en-US', {
                              minimumFractionDigits: 2
                            })}
                          </td>
                          {hasAnyItemDiscount && (
                            <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                              {hasDiscount
                                ? item.discountType === 'FIXED'
                                  ? `${settings.currencySymbol} ${item.discount?.toLocaleString(
                                      'en-US',
                                      { minimumFractionDigits: 2 }
                                    )}`
                                  : `${item.discount}%`
                                : '-'}
                            </td>
                          )}
                          <td className="py-2.5 px-2 text-right font-mono font-bold">
                            {settings.currencySymbol}{' '}
                            {lineTotal.toLocaleString('en-US', {
                              minimumFractionDigits: 2
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary Totals */}
              <div className="border-t-2 border-slate-900 pt-3 flex justify-end">
                <div className="w-64 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-600">
                    <span>Gross Subtotal:</span>
                    <span>
                      {settings.currencySymbol}{' '}
                      {invoice.subtotal.toLocaleString('en-US', {
                        minimumFractionDigits: 2
                      })}
                    </span>
                  </div>

                  {invoice.discount > 0 && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>Discount:</span>
                      <span>
                        - {settings.currencySymbol}{' '}
                        {invoice.discount.toLocaleString('en-US', {
                          minimumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-300">
                    <span>Grand Total:</span>
                    <span>
                      {settings.currencySymbol}{' '}
                      {invoice.grandTotal.toLocaleString('en-US', {
                        minimumFractionDigits: 2
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-700">
                    <span>Paid Amount:</span>
                    <span className="text-emerald-700 font-bold">
                      {settings.currencySymbol}{' '}
                      {invoice.paidAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2
                      })}
                    </span>
                  </div>

                  {invoice.dueAmount > 0 && (
                    <div className="flex justify-between text-amber-700 font-bold">
                      <span>Balance Due:</span>
                      <span>
                        {settings.currencySymbol}{' '}
                        {invoice.dueAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes & Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                <p className="italic font-medium">{settings.invoiceNote}</p>
                <p className="text-[10px] text-slate-400 mt-2">
                  Generated by Busy UFO • Software for Sri Lankan Small Businesses
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
