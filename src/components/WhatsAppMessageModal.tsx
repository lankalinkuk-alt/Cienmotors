import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Copy,
  RotateCcw,
  Sparkles,
  Phone,
  User,
  FileText,
  Check,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { SaleInvoice, PurchaseInvoice, AppSettings } from '../types';
import { formatInvoiceWhatsAppText, sendWhatsAppMessage } from '../lib/whatsapp';

export interface WhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  recipientName?: string;
  defaultPhone?: string;
  initialMessage?: string;
  invoice?: SaleInvoice | PurchaseInvoice;
  isPurchase?: boolean;
  settings: AppSettings;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({
  isOpen,
  onClose,
  title,
  recipientName,
  defaultPhone = '',
  initialMessage = '',
  invoice,
  isPurchase = false,
  settings,
  showToast
}) => {
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone);
  const [message, setMessage] = useState(initialMessage);
  const [activeTemplate, setActiveTemplate] = useState<'standard' | 'compact' | 'reminder' | 'custom'>('standard');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPhoneNumber(defaultPhone || '');
      if (invoice) {
        setMessage(formatInvoiceWhatsAppText(invoice, isPurchase, settings, 'standard'));
        setActiveTemplate('standard');
      } else {
        setMessage(initialMessage || '');
        setActiveTemplate('custom');
      }
      setIsCopied(false);
    }
  }, [isOpen, defaultPhone, initialMessage, invoice, isPurchase, settings]);

  if (!isOpen) return null;

  const handleTemplateChange = (tmpl: 'standard' | 'compact' | 'reminder') => {
    if (invoice) {
      setActiveTemplate(tmpl);
      setMessage(formatInvoiceWhatsAppText(invoice, isPurchase, settings, tmpl));
    }
  };

  const handleAppendSnippet = (snippet: string) => {
    setMessage((prev) => `${prev.trim()}\n\n${snippet}`);
    setActiveTemplate('custom');
  };

  const handleReset = () => {
    if (invoice) {
      setMessage(formatInvoiceWhatsAppText(invoice, isPurchase, settings, 'standard'));
      setActiveTemplate('standard');
    } else {
      setMessage(initialMessage || '');
    }
    showToast('info', 'Message reset to default template.');
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = message;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      showToast('success', 'Message copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast('error', 'Failed to copy message to clipboard.');
    }
  };

  const handleSend = () => {
    if (!message.trim()) {
      showToast('error', 'Message cannot be empty.');
      return;
    }
    sendWhatsAppMessage(phoneNumber, message);
    showToast('success', 'WhatsApp opened with customized message!');
    onClose();
  };

  const docNo = invoice
    ? !isPurchase
      ? (invoice as SaleInvoice).invoiceNumber
      : (invoice as PurchaseInvoice).purchaseNumber
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-4 sm:p-6 animate-in fade-in zoom-in-95 my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 fill-emerald-100" />
            </div>
            <div>
              <h3 className="font-bold text-lg sm:text-xl text-slate-900">
                {title || (isPurchase ? 'Modify Purchase Message' : 'Modify WhatsApp Message')}
              </h3>
              <p className="text-xs text-slate-500">
                Edit message text, recipient contact, or choose a template before sending
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Recipient & Document info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                {isPurchase ? 'Supplier Name' : 'Customer Name'}
              </label>
              <div className="text-sm font-semibold text-slate-800 truncate">
                {recipientName || (invoice ? (!isPurchase ? (invoice as SaleInvoice).customerName : (invoice as PurchaseInvoice).supplierName) : 'N/A')}
              </div>
              {docNo && (
                <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                  Doc #: {docNo}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-600" />
                WhatsApp Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +94771234567 or 0771234567"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Template Selector (if invoice provided) */}
          {invoice && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Select Message Template:
                </label>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  title="Reset to default text"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Default
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleTemplateChange('standard')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                    activeTemplate === 'standard'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🧾 Detailed Bill
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateChange('compact')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                    activeTemplate === 'compact'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  📋 Compact Summary
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateChange('reminder')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                    activeTemplate === 'reminder'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ⚠️ Due Reminder
                </button>
              </div>
            </div>
          )}

          {/* Quick Snippet Insertions */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              Quick Add Snippets:
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleAppendSnippet(`*Bank Transfer Details:*\nBank: Commercial Bank\nAccount: 1000234567\nName: ${settings.companyName || 'UFO Tech'}`)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-500" />
                Bank Details
              </button>
              <button
                type="button"
                onClick={() => handleAppendSnippet('Thank you for your business and partnership! 🙏')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-500" />
                Thank You Note
              </button>
              <button
                type="button"
                onClick={() => handleAppendSnippet('Goods received in good order and condition. ✔️')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-500" />
                Delivery Note
              </button>
            </div>
          </div>

          {/* Editable Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Editable Message Content:
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {message.length} chars
              </span>
            </div>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setActiveTemplate('custom');
              }}
              placeholder="Type or modify your WhatsApp message here..."
              className="w-full p-3 text-xs sm:text-sm font-mono bg-emerald-50/20 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 leading-relaxed shadow-inner"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 mt-3 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{isCopied ? 'Copied!' : 'Copy Message'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-200 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Send via WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
