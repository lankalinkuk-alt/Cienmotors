import React, { useState } from 'react';
import { MessageCircle, Printer, Download, FileText } from 'lucide-react';
import { AppSettings } from '../types';
import { WhatsAppMessageModal } from './WhatsAppMessageModal';

interface ReportActionsToolbarProps {
  reportTitle: string;
  summaryText: string;
  settings: AppSettings;
  recipientPhone?: string;
  recipientName?: string;
  showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  compact?: boolean;
}

export const ReportActionsToolbar: React.FC<ReportActionsToolbarProps> = ({
  reportTitle,
  summaryText,
  settings,
  recipientPhone = '',
  recipientName = '',
  showToast,
  compact = false
}) => {
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (showToast) {
      showToast('info', 'Opening Print dialog. Choose "Save as PDF" as Destination to download PDF.');
    }
    window.print();
  };

  const handleShowToast = (type: 'success' | 'error' | 'info', msg: string) => {
    if (showToast) {
      showToast(type, msg);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-2 no-print ${compact ? 'text-xs' : ''}`}>
        <button
          type="button"
          onClick={() => setIsWhatsAppModalOpen(true)}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer shrink-0"
          title="Send report summary via WhatsApp"
        >
          <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer shrink-0"
          title="Download report as PDF (Save as PDF)"
        >
          <Download className="w-4 h-4" />
          <span>PDF</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer shrink-0"
          title="Print report using local printer"
        >
          <Printer className="w-4 h-4 text-amber-400" />
          <span>Print</span>
        </button>
      </div>

      {isWhatsAppModalOpen && (
        <WhatsAppMessageModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          title={`Send ${reportTitle} via WhatsApp`}
          recipientName={recipientName}
          defaultPhone={recipientPhone}
          initialMessage={summaryText}
          settings={settings}
          showToast={handleShowToast}
        />
      )}
    </>
  );
};
