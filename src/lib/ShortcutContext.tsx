import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

interface ShortcutContextType {
  registerSaveHandler: (handler: (() => void) | null) => void;
  registerToggleListHandler: (handler: (() => void) | null) => void;
  registerSelectedProduct: (productId: string | null) => void;
  isQuickSalesOpen: boolean;
  openQuickSales: () => void;
  closeQuickSales: () => void;
  isLedgerOpen: boolean;
  selectedLedgerId: string | null;
  openLedger: (ledgerId?: string) => void;
  closeLedger: () => void;
  isItemHistoryOpen: boolean;
  selectedProductId: string | null;
  openItemHistory: (productId?: string) => void;
  closeItemHistory: () => void;
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined);

export const ShortcutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const saveHandlerRef = useRef<(() => void) | null>(null);
  const toggleListHandlerRef = useRef<(() => void) | null>(null);
  const selectedProductRef = useRef<string | null>(null);

  const [isQuickSalesOpen, setIsQuickSalesOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  const [isItemHistoryOpen, setIsItemHistoryOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const registerSaveHandler = (handler: (() => void) | null) => {
    saveHandlerRef.current = handler;
  };

  const registerToggleListHandler = (handler: (() => void) | null) => {
    toggleListHandlerRef.current = handler;
  };

  const registerSelectedProduct = (productId: string | null) => {
    selectedProductRef.current = productId;
  };

  const openQuickSales = () => setIsQuickSalesOpen(true);
  const closeQuickSales = () => setIsQuickSalesOpen(false);

  const openLedger = (ledgerId?: string) => {
    if (ledgerId) setSelectedLedgerId(ledgerId);
    setIsLedgerOpen(true);
  };
  const closeLedger = () => {
    setIsLedgerOpen(false);
    setSelectedLedgerId(null);
  };

  const openItemHistory = (productId?: string) => {
    const targetId = productId || selectedProductRef.current || null;
    setSelectedProductId(targetId);
    setIsItemHistoryOpen(true);
  };
  const closeItemHistory = () => {
    setIsItemHistoryOpen(false);
    setSelectedProductId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + F8 (Quick Sales Modal)
      if (e.ctrlKey && e.key === 'F8') {
        e.preventDefault();
        openQuickSales();
        return;
      }

      // Ctrl + L (Ledger Modal)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        openLedger();
        return;
      }

      // Ctrl + I (Item History Modal)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        openItemHistory();
        return;
      }

      // F2 (Save)
      if (e.key === 'F2') {
        e.preventDefault();
        if (saveHandlerRef.current) {
          saveHandlerRef.current();
        } else {
          // Fallback: search for active submit button
          const submitBtn = document.querySelector<HTMLButtonElement>('button[type="submit"], [data-shortcut="f2-save"]');
          if (submitBtn) {
            submitBtn.click();
          }
        }
        return;
      }

      // F5 (Toggle List/Browse)
      if (e.key === 'F5') {
        e.preventDefault();
        if (toggleListHandlerRef.current) {
          toggleListHandlerRef.current();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ShortcutContext.Provider
      value={{
        registerSaveHandler,
        registerToggleListHandler,
        registerSelectedProduct,
        isQuickSalesOpen,
        openQuickSales,
        closeQuickSales,
        isLedgerOpen,
        selectedLedgerId,
        openLedger,
        closeLedger,
        isItemHistoryOpen,
        selectedProductId,
        openItemHistory,
        closeItemHistory
      }}
    >
      {children}
    </ShortcutContext.Provider>
  );
};

export const useShortcuts = () => {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutProvider');
  }
  return context;
};
