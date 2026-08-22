import { SaleInvoice, PurchaseInvoice, AppSettings } from '../types';

export const formatInvoiceWhatsAppText = (
  invoice: SaleInvoice | PurchaseInvoice,
  isPurchase: boolean,
  settings: AppSettings,
  templateStyle: 'standard' | 'compact' | 'reminder' = 'standard'
): string => {
  const sale = !isPurchase ? (invoice as SaleInvoice) : null;
  const purchase = isPurchase ? (invoice as PurchaseInvoice) : null;

  const docType = isPurchase ? 'Purchase Voucher' : 'Sales Invoice';
  const docNo = sale ? sale.invoiceNumber : purchase?.purchaseNumber;
  const partyLabel = isPurchase ? 'Supplier' : 'Customer';
  const partyName = sale ? sale.customerName : purchase?.supplierName;
  const companyTitle = settings.companyName || 'UFO Tech solution';
  const sym = settings.currencySymbol || 'Rs.';

  if (templateStyle === 'compact') {
    let text = `🧾 *${companyTitle}* - ${docType}\n`;
    text += `*Doc #:* ${docNo} | *Date:* ${invoice.date}\n`;
    text += `*${partyLabel}:* ${partyName}\n`;
    text += `*Total:* ${sym} ${invoice.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    text += `*Paid:* ${sym} ${invoice.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    if (invoice.dueAmount > 0) {
      text += `*Balance Due:* ${sym} ${invoice.dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    }
    if (settings.companyPhone) {
      text += `\nTel: ${settings.companyPhone}`;
    }
    return text;
  }

  if (templateStyle === 'reminder') {
    let text = `⚠️ *Payment Reminder - ${companyTitle}*\n\n`;
    text += `Dear *${partyName}*,\n`;
    text += `This is a friendly reminder regarding ${docType} *${docNo}* dated *${invoice.date}*.\n\n`;
    text += `*Invoice Total:* ${sym} ${invoice.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    text += `*Amount Paid:* ${sym} ${invoice.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    text += `*Outstanding Due:* ${sym} ${invoice.dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n`;
    text += `Kindly arrange settlement at your earliest convenience.\n`;
    if (settings.companyPhone) {
      text += `Contact: ${settings.companyPhone}`;
    }
    return text;
  }

  // Standard detailed breakdown
  const itemsText = (invoice.items || [])
    .map((item, idx) => {
      const price = 'unitPrice' in item ? (item as any).unitPrice : (item as any).unitCost;
      return `${idx + 1}. ${item.productName} (x${item.quantity}) @ ${sym}${Number(price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} = ${sym}${Number(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    })
    .join('\n');

  let text = `🧾 *${companyTitle}*\n`;
  text += `*${docType}:* ${docNo}\n`;
  text += `*Date:* ${invoice.date}\n`;
  text += `*${partyLabel}:* ${partyName}\n`;
  text += `*Payment Type:* ${invoice.type}\n`;
  text += `------------------------------\n`;
  text += `*Items:*\n${itemsText || 'N/A'}\n`;
  text += `------------------------------\n`;
  text += `*Subtotal:* ${sym} ${Number(invoice.subtotal || invoice.grandTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  if (invoice.discount > 0) {
    text += `*Discount:* -${sym} ${Number(invoice.discount).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  }
  text += `*Grand Total:* ${sym} ${invoice.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  text += `*Paid Amount:* ${sym} ${invoice.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  if (invoice.dueAmount > 0) {
    text += `*Balance Due:* ${sym} ${invoice.dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
  }
  if (invoice.notes) {
    text += `\n*Note:* ${invoice.notes}\n`;
  }
  if (settings.invoiceNote) {
    text += `\n_${settings.invoiceNote}_\n`;
  }
  if (settings.companyPhone) {
    text += `\nContact: ${settings.companyPhone}`;
  }

  return text;
};

export const sendWhatsAppMessage = (phone?: string, text?: string) => {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const messageText = text || '';
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
  window.open(url, '_blank');
};

export const shareInvoiceViaWhatsApp = (
  invoice: SaleInvoice | PurchaseInvoice,
  isPurchase: boolean,
  settings: AppSettings,
  phone?: string
) => {
  const text = formatInvoiceWhatsAppText(invoice, isPurchase, settings);
  sendWhatsAppMessage(phone, text);
};

export const shareReportViaWhatsApp = (
  reportTitle: string,
  summaryLines: string[],
  settings: AppSettings,
  phone?: string
) => {
  let text = `📊 *${settings.companyName || 'UFO Tech solution'}*\n`;
  text += `*${reportTitle}*\n`;
  text += `*Date:* ${new Date().toISOString().split('T')[0]}\n`;
  text += `------------------------------\n`;
  text += summaryLines.join('\n');
  text += `\n------------------------------\n`;
  text += `_Generated by UFO Tech solution_`;

  sendWhatsAppMessage(phone, text);
};
