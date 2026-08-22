import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Copy,
  Check,
  Filter,
  FileSpreadsheet,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { STANDARD_ACCOUNT_GROUPS, getNatureBadgeClass } from '../lib/accountGroups';
import { AccountNature, AccountGroupDefinition } from '../types';

interface AccountGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountGroupsModal: React.FC<AccountGroupsModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedNature, setSelectedNature] = useState<string>('ALL');
  const [copiedGroupNo, setCopiedGroupNo] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const filteredGroups = useMemo(() => {
    return STANDARD_ACCOUNT_GROUPS.filter((group) => {
      const matchesNature =
        selectedNature === 'ALL' || group.nature === selectedNature;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        group.no.toString() === q ||
        group.name.toLowerCase().includes(q) ||
        group.parentGroup.toLowerCase().includes(q) ||
        group.category.toLowerCase().includes(q) ||
        (group.description && group.description.toLowerCase().includes(q));
      return matchesNature && matchesSearch;
    });
  }, [search, selectedNature]);

  const handleCopyGroupName = (group: AccountGroupDefinition) => {
    navigator.clipboard.writeText(group.name);
    setCopiedGroupNo(group.no);
    setTimeout(() => setCopiedGroupNo(null), 1800);
  };

  const handleCopyAll = () => {
    const text = STANDARD_ACCOUNT_GROUPS.map(
      (g) => `${g.no}\t${g.name}\t${g.nature}\t${g.parentGroup}\t${g.normalBalance}`
    ).join('\n');
    navigator.clipboard.writeText(`No.\tAccount Group\tNature\tParent Group\tNormal Balance\n` + text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900">
                  Standard Chart of Account Groups
                </h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                  {STANDARD_ACCOUNT_GROUPS.length} Groups
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official chart of 29 account groups for BUSY UFO accounting and master ledger categorization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
              title="Copy All 29 Groups (TSV/Excel format)"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied All!' : 'Copy Table'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by group number (e.g. 25), name, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedNature('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedNature === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All (29)
            </button>
            <button
              onClick={() => setSelectedNature('ASSET')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedNature === 'ASSET'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Assets (10)
            </button>
            <button
              onClick={() => setSelectedNature('LIABILITY')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedNature === 'LIABILITY'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Liabilities (9)
            </button>
            <button
              onClick={() => setSelectedNature('EQUITY')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedNature === 'EQUITY'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              Equity (3)
            </button>
            <button
              onClick={() => setSelectedNature('INCOME')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedNature === 'INCOME'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
              }`}
            >
              Income (4)
            </button>
            <button
              onClick={() => setSelectedNature('EXPENSE')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedNature === 'EXPENSE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              Expenses (3)
            </button>
          </div>
        </div>

        {/* Groups Table View */}
        <div className="flex-1 overflow-y-auto py-2 pr-1">
          {filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No account groups found matching "{search}".
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/75 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <th className="py-2.5 px-3 text-center w-12">No.</th>
                  <th className="py-2.5 px-3">Account Group</th>
                  <th className="py-2.5 px-3">Nature</th>
                  <th className="py-2.5 px-3">Parent Classification</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Normal</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map((group) => {
                  const isCopied = copiedGroupNo === group.no;
                  const isTradeMaster = group.no === 25 || group.no === 24;

                  return (
                    <tr
                      key={group.no}
                      className={`hover:bg-slate-50 transition-colors ${
                        isTradeMaster ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                        {group.no}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{group.name}</span>
                          {group.isSubgroup && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded font-normal">
                              Subgroup
                            </span>
                          )}
                          {group.no === 25 && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded font-bold">
                              Customers
                            </span>
                          )}
                          {group.no === 24 && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded font-bold">
                              Suppliers
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-[11px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                            {group.description}
                          </p>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 font-bold text-[10px] rounded-md border ${getNatureBadgeClass(
                            group.nature
                          )}`}
                        >
                          {group.nature}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">
                        {group.parentGroup}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {group.category}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold">
                        <span
                          className={
                            group.normalBalance === 'Dr'
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }
                        >
                          {group.normalBalance}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleCopyGroupName(group)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700 cursor-pointer"
                          title="Copy name to clipboard"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredGroups.length}</strong> of{' '}
            <strong>{STANDARD_ACCOUNT_GROUPS.length}</strong> account groups
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
