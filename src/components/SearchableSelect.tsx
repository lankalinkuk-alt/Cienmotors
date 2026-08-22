import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, User, Truck, Package, Check, Plus, AlertCircle } from 'lucide-react';
import { Customer, Supplier, Product } from '../types';
import { handleEnterKeyNavigation } from '../lib/keyboardNav';

// ============================================================================
// 1. SEARCHABLE CUSTOMER SELECT COMPONENT
// ============================================================================
interface SearchableCustomerSelectProps {
  customers: Customer[];
  selectedCustomerId: string;
  customCustomerName?: string;
  onSelect: (customerId: string, customerName?: string) => void;
  currencySymbol: string;
  allowWalkIn?: boolean;
  placeholder?: string;
  required?: boolean;
  label?: string;
  id?: string;
  autoFocus?: boolean;
}

export const SearchableCustomerSelect: React.FC<SearchableCustomerSelectProps> = ({
  customers,
  selectedCustomerId,
  customCustomerName,
  onSelect,
  currencySymbol,
  allowWalkIn = true,
  placeholder = 'Type to search customer name, code, phone, city...',
  required = false,
  label,
  id,
  autoFocus = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Robust multi-term fuzzy filter
  const filteredCustomers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return customers;

    const terms = trimmed.split(/\s+/).filter(Boolean);

    return customers.filter((c) => {
      const searchableString = `${c.name || ''} ${c.code || ''} ${c.phone || ''} ${c.city || ''} ${c.address || ''} ${c.email || ''}`.toLowerCase();
      const rawPhone = (c.phone || '').replace(/[^0-9]/g, '');
      
      return terms.every((term) => {
        const cleanTerm = term.replace(/[^0-9a-z]/g, '');
        return (
          searchableString.includes(term) ||
          (cleanTerm.length > 2 && rawPhone.includes(cleanTerm))
        );
      });
    });
  }, [customers, query]);

  // Check positioning relative to viewport to avoid hiding in bottom
  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If space below is limited (< 280px) and there's more space above, open upward
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      wrapperRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpen, filteredCustomers.length]);

  // Sync displayed text when selected customer or custom name changes
  useEffect(() => {
    if (!isOpen) {
      if (selectedCustomer) {
        setQuery(selectedCustomer.name);
      } else if (customCustomerName && customCustomerName !== 'Walk-in Cash Customer') {
        setQuery(customCustomerName);
      } else if (allowWalkIn && !selectedCustomerId) {
        setQuery('');
      }
    }
  }, [selectedCustomerId, selectedCustomer, customCustomerName, isOpen, allowWalkIn]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset query text to current selection on blur
        if (selectedCustomer) {
          setQuery(selectedCustomer.name);
        } else if (customCustomerName && customCustomerName !== 'Walk-in Cash Customer') {
          setQuery(customCustomerName);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedCustomer, customCustomerName]);

  const handleSelectCustomer = (cust: Customer) => {
    onSelect(cust.id, cust.name);
    setQuery(cust.name);
    setIsOpen(false);
  };

  const handleSelectWalkIn = () => {
    onSelect('', 'Walk-in Cash Customer');
    setQuery('');
    setIsOpen(false);
  };

  const handleUseCustomName = (nameToUse: string) => {
    const clean = nameToUse.trim() || 'Walk-in Cash Customer';
    onSelect('', clean);
    setQuery(clean);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect('', 'Walk-in Cash Customer');
    setQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightIndex((prev) => Math.min(prev + 1, filteredCustomers.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        if (highlightIndex >= 0 && highlightIndex < filteredCustomers.length) {
          handleSelectCustomer(filteredCustomers[highlightIndex]);
        } else if (filteredCustomers.length > 0) {
          handleSelectCustomer(filteredCustomers[0]);
        } else if (query.trim()) {
          handleUseCustomName(query.trim());
        }
      }
      setTimeout(() => {
        handleEnterKeyNavigation(e);
      }, 50);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-[90]' : 'z-10'}`} ref={wrapperRef}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-slate-700 uppercase">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {selectedCustomer && (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                selectedCustomer.outstandingBalance > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Due: {currencySymbol} {selectedCustomer.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

      {/* Input container */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full min-h-[42px] px-3 py-1.5 rounded-xl border bg-white flex items-center justify-between gap-2 transition-all cursor-text ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          
          <input
            id={id}
            ref={inputRef}
            autoFocus={autoFocus}
            type="text"
            value={query}
            onFocus={() => {
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedCustomer
                ? `${selectedCustomer.name} (${selectedCustomer.code})`
                : customCustomerName && customCustomerName !== 'Walk-in Cash Customer'
                ? customCustomerName
                : placeholder
            }
            className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {(query || selectedCustomerId) && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown Results List with Smart Positioning */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } bg-white rounded-2xl border border-slate-200 shadow-2xl z-[100] max-h-80 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95`}
        >
          {/* Walk-in Cash Customer option */}
          {allowWalkIn && (
            <div
              onClick={handleSelectWalkIn}
              className={`p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors ${
                !selectedCustomerId && (!customCustomerName || customCustomerName === 'Walk-in Cash Customer')
                  ? 'bg-blue-50/80 font-bold'
                  : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900">Walk-in Cash Customer</span>
                  <p className="text-[11px] text-slate-400">Immediate cash billing without ledger account</p>
                </div>
              </div>
              {!selectedCustomerId && (!customCustomerName || customCustomerName === 'Walk-in Cash Customer') && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </div>
          )}

          {/* If user typed a custom customer name that does not match exact master */}
          {query.trim() && (
            <div
              onClick={() => handleUseCustomName(query)}
              className="p-2.5 bg-blue-50/60 hover:bg-blue-100/80 cursor-pointer flex items-center justify-between text-blue-700 font-bold text-xs border-y border-blue-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>Use "{query.trim()}" as Customer Name</span>
              </span>
              <span className="text-[11px] font-normal text-blue-600">Press Enter ↵</span>
            </div>
          )}

          {/* Filtered Master Customers List */}
          {filteredCustomers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              <p className="font-semibold text-slate-600 mb-1">No registered customer matches "{query}"</p>
              <p className="text-[11px] text-slate-400">
                You can still type the name above to bill them as a walk-in, or add them from Customer Management.
              </p>
            </div>
          ) : (
            filteredCustomers.map((cust, idx) => {
              const isSelected = cust.id === selectedCustomerId;
              const isHighlighted = idx === highlightIndex;

              return (
                <div
                  key={cust.id}
                  onClick={() => handleSelectCustomer(cust)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={`p-3 hover:bg-blue-50/90 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-blue-50 font-semibold' : ''
                  } ${isHighlighted ? 'bg-slate-100' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">{cust.name}</span>
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {cust.code}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1 font-mono">
                      {cust.phone && <span>Tel: {cust.phone}</span>}
                      {cust.city && <span className="font-sans text-slate-400">📍 {cust.city}</span>}
                      {cust.address && <span className="font-sans text-slate-400 truncate max-w-[200px]">{cust.address}</span>}
                    </div>
                  </div>

                  {/* Customer Outstanding Balance Badge */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-1 rounded-lg inline-block ${
                        cust.outstandingBalance > 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {cust.outstandingBalance > 0
                        ? `Due: ${currencySymbol} ${cust.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : `Balance: ${currencySymbol} 0.00`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. SEARCHABLE SUPPLIER SELECT COMPONENT
// ============================================================================
interface SearchableSupplierSelectProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  customSupplierName?: string;
  onSelect: (supplierId: string, supplierName?: string) => void;
  currencySymbol: string;
  allowSpotSupplier?: boolean;
  placeholder?: string;
  required?: boolean;
  label?: string;
  id?: string;
  autoFocus?: boolean;
}

export const SearchableSupplierSelect: React.FC<SearchableSupplierSelectProps> = ({
  suppliers,
  selectedSupplierId,
  customSupplierName,
  onSelect,
  currencySymbol,
  allowSpotSupplier = true,
  placeholder = 'Type to search supplier name, company, code, phone...',
  required = false,
  label,
  id,
  autoFocus = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const filteredSuppliers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return suppliers;

    const terms = trimmed.split(/\s+/).filter(Boolean);

    return suppliers.filter((s) => {
      const searchable = `${s.name || ''} ${s.companyName || ''} ${s.code || ''} ${s.phone || ''} ${s.email || ''}`.toLowerCase();
      const rawPhone = (s.phone || '').replace(/[^0-9]/g, '');

      return terms.every((term) => {
        const cleanTerm = term.replace(/[^0-9a-z]/g, '');
        return searchable.includes(term) || (cleanTerm.length > 2 && rawPhone.includes(cleanTerm));
      });
    });
  }, [suppliers, query]);

  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      wrapperRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpen, filteredSuppliers.length]);

  // Sync displayed text when selected supplier or custom name changes
  useEffect(() => {
    if (!isOpen) {
      if (selectedSupplier) {
        setQuery(selectedSupplier.name);
      } else if (customSupplierName && customSupplierName !== 'Cash Supplier / Spot Purchase') {
        setQuery(customSupplierName);
      } else if (allowSpotSupplier && !selectedSupplierId) {
        setQuery('');
      }
    }
  }, [selectedSupplierId, selectedSupplier, customSupplierName, isOpen, allowSpotSupplier]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedSupplier) {
          setQuery(selectedSupplier.name);
        } else if (customSupplierName && customSupplierName !== 'Cash Supplier / Spot Purchase') {
          setQuery(customSupplierName);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedSupplier, customSupplierName]);

  const handleSelectSupplier = (supp: Supplier) => {
    onSelect(supp.id, supp.name);
    setQuery(supp.name);
    setIsOpen(false);
  };

  const handleSelectSpotSupplier = () => {
    onSelect('', 'Cash Supplier / Spot Purchase');
    setQuery('');
    setIsOpen(false);
  };

  const handleUseCustomSupplierName = (nameToUse: string) => {
    const clean = nameToUse.trim() || 'Cash Supplier / Spot Purchase';
    onSelect('', clean);
    setQuery(clean);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect('', 'Cash Supplier / Spot Purchase');
    setQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightIndex((prev) => Math.min(prev + 1, filteredSuppliers.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        if (highlightIndex >= 0 && highlightIndex < filteredSuppliers.length) {
          handleSelectSupplier(filteredSuppliers[highlightIndex]);
        } else if (filteredSuppliers.length > 0) {
          handleSelectSupplier(filteredSuppliers[0]);
        } else if (query.trim()) {
          handleUseCustomSupplierName(query.trim());
        }
      }
      setTimeout(() => {
        handleEnterKeyNavigation(e);
      }, 50);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-[90]' : 'z-10'}`} ref={wrapperRef}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-slate-700 uppercase">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {selectedSupplier && (
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                selectedSupplier.payableBalance > 0
                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Payable: {currencySymbol} {selectedSupplier.payableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

      {/* Trigger Box */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full min-h-[42px] px-3 py-1.5 rounded-xl border bg-white flex items-center justify-between gap-2 transition-all cursor-text ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-100 shadow-sm'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Truck className="w-4 h-4 text-slate-400 shrink-0" />
          
          <input
            id={id}
            ref={inputRef}
            autoFocus={autoFocus}
            type="text"
            value={query}
            onFocus={() => {
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedSupplier
                ? `${selectedSupplier.name} (${selectedSupplier.code})`
                : placeholder
            }
            className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(query || selectedSupplierId) && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-purple-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown with Smart Up/Down Placement */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } bg-white rounded-2xl border border-slate-200 shadow-2xl z-[100] max-h-80 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95`}
        >
          {/* Spot / Cash Supplier option */}
          {allowSpotSupplier && (
            <div
              onClick={handleSelectSpotSupplier}
              className={`p-3 hover:bg-purple-50 cursor-pointer flex items-center justify-between transition-colors ${
                !selectedSupplierId && (!customSupplierName || customSupplierName === 'Cash Supplier / Spot Purchase')
                  ? 'bg-purple-50/80 font-bold'
                  : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900">Cash Supplier / Spot Purchase</span>
                  <p className="text-[11px] text-slate-400">Immediate cash purchase without ledger account</p>
                </div>
              </div>
              {!selectedSupplierId && (!customSupplierName || customSupplierName === 'Cash Supplier / Spot Purchase') && (
                <Check className="w-4 h-4 text-purple-600" />
              )}
            </div>
          )}

          {/* If user typed a custom supplier name that does not match exact master */}
          {query.trim() && (
            <div
              onClick={() => handleUseCustomSupplierName(query)}
              className="p-2.5 bg-purple-50/60 hover:bg-purple-100/80 cursor-pointer flex items-center justify-between text-purple-700 font-bold text-xs border-y border-purple-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>Use "{query.trim()}" as Supplier Name</span>
              </span>
              <span className="text-[11px] font-normal text-purple-600">Press Enter ↵</span>
            </div>
          )}

          {filteredSuppliers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              <p className="font-semibold text-slate-600 mb-1">No registered supplier matches "{query}"</p>
              <p className="text-[11px] text-slate-400">
                You can still type the name above to record as spot cash purchase, or add them in Suppliers.
              </p>
            </div>
          ) : (
            filteredSuppliers.map((supp, idx) => {
              const isSelected = supp.id === selectedSupplierId;
              const isHighlighted = idx === highlightIndex;

              return (
                <div
                  key={supp.id}
                  onClick={() => handleSelectSupplier(supp)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={`p-3 hover:bg-purple-50/90 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-purple-50 font-semibold' : ''
                  } ${isHighlighted ? 'bg-slate-100' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">{supp.name}</span>
                      {supp.companyName && (
                        <span className="text-xs text-slate-600 font-medium">
                          • {supp.companyName}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {supp.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                      {supp.phone && <span>Tel: {supp.phone}</span>}
                    </div>
                  </div>

                  {/* Supplier Payable Balance */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-1 rounded-lg inline-block ${
                        supp.payableBalance > 0
                          ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {supp.payableBalance > 0
                        ? `Payable: ${currencySymbol} ${supp.payableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : `Balance: ${currencySymbol} 0.00`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 3. SEARCHABLE PRODUCT SELECT COMPONENT (WITH STOCK & PRICE)
// ============================================================================
interface SearchableProductSelectProps {
  products: Product[];
  selectedProductId: string;
  onSelect: (productId: string) => void;
  currencySymbol: string;
  priceType?: 'SELLING' | 'COST';
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products,
  selectedProductId,
  onSelect,
  currencySymbol,
  priceType = 'SELLING',
  placeholder = 'Type product name, code, barcode...',
  id,
  autoFocus = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const filteredProducts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return products;

    const terms = trimmed.split(/\s+/).filter(Boolean);

    return products.filter((p) => {
      const searchable = `${p.name || ''} ${p.code || ''} ${p.category || ''} ${p.barcode || ''}`.toLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
  }, [products, query]);

  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If space below is less than 240px and space above is greater, open above
      if (spaceBelow < 240 && spaceAbove > spaceBelow) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      wrapperRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpen, filteredProducts.length]);

  useEffect(() => {
    if (!isOpen) {
      if (selectedProduct) {
        setQuery(selectedProduct.name);
      } else {
        setQuery('');
      }
    }
  }, [selectedProductId, selectedProduct, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedProduct) {
          setQuery(selectedProduct.name);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedProduct]);

  const handleSelectProduct = (prod: Product) => {
    onSelect(prod.id);
    setQuery(prod.name);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect('');
    setQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightIndex((prev) => Math.min(prev + 1, filteredProducts.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredProducts.length > 0) {
        const target = highlightIndex >= 0 ? filteredProducts[highlightIndex] : filteredProducts[0];
        handleSelectProduct(target);
      }
      setTimeout(() => {
        handleEnterKeyNavigation(e);
      }, 50);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-[90]' : 'z-10'}`} ref={wrapperRef}>
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full min-h-[38px] px-2.5 py-1 rounded-lg border bg-white flex items-center justify-between gap-1.5 transition-all cursor-text ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          
          <input
            id={id}
            ref={inputRef}
            autoFocus={autoFocus}
            type="text"
            value={query}
            onFocus={() => {
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedProduct
                ? `${selectedProduct.name} (${selectedProduct.code})`
                : placeholder
            }
            className="w-full bg-transparent text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(query || selectedProductId) && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown with Smart Up/Down Placement */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          } bg-white rounded-xl border border-slate-200 shadow-2xl z-[100] max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95`}
        >
          {filteredProducts.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 italic">
              No matching items found for "{query}".
            </div>
          ) : (
            filteredProducts.map((prod, idx) => {
              const isSelected = prod.id === selectedProductId;
              const isHighlighted = idx === highlightIndex;
              const price = priceType === 'SELLING' ? prod.sellingPrice : prod.costPrice;
              const isOutOfStock = prod.currentStock <= 0;
              const isLowStock = prod.currentStock > 0 && prod.currentStock <= prod.reorderLevel;

              return (
                <div
                  key={prod.id}
                  onClick={() => handleSelectProduct(prod)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={`p-2.5 hover:bg-blue-50/90 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                    isSelected ? 'bg-blue-50 font-semibold' : ''
                  } ${isHighlighted ? 'bg-slate-100' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900">{prod.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                        {prod.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span>{prod.category}</span>
                      {prod.barcode && <span className="font-mono text-slate-400">| BC: {prod.barcode}</span>}
                    </div>
                  </div>

                  {/* Stock Quantity & Price Badge */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {currencySymbol} {price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isOutOfStock
                        ? 'Out of Stock (0)'
                        : isLowStock
                        ? `Low Stock: ${prod.currentStock}`
                        : `Stock: ${prod.currentStock}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
