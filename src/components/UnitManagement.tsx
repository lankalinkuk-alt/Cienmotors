import React, { useState } from 'react';
import {
  Layers,
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  Calculator,
  Search,
  Scale,
  Package,
  Sparkles,
  X
} from 'lucide-react';
import { UnitDefinition, UnitConversionRule, AppSettings } from '../types';
import { STANDARD_SIMPLE_UNITS, DEFAULT_CONVERSION_RULES, UnitService } from '../lib/units';

interface UnitManagementProps {
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const UnitManagement: React.FC<UnitManagementProps> = ({
  settings,
  isOpen,
  onClose,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'SIMPLE' | 'CONVERSION' | 'CALCULATOR'>('CONVERSION');
  const [searchTerm, setSearchTerm] = useState('');

  // Rules state
  const [conversionRules, setConversionRules] = useState<UnitConversionRule[]>(() => {
    const saved = localStorage.getItem('ufo_custom_unit_rules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_CONVERSION_RULES;
      }
    }
    return DEFAULT_CONVERSION_RULES;
  });

  // Simple Units state
  const [customUnits, setCustomUnits] = useState<UnitDefinition[]>(() => {
    const saved = localStorage.getItem('ufo_custom_simple_units');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // New Rule Form State
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    mainUnit: 'Box',
    secondaryUnit: 'Nos',
    conversionFactor: '12',
    description: ''
  });

  // Calculator state
  const [calcAmount, setCalcAmount] = useState('1');
  const [calcFromUnit, setCalcFromUnit] = useState('Dz');
  const [calcToUnit, setCalcToUnit] = useState('Nos');

  if (!isOpen) return null;

  const allUnits = [...STANDARD_SIMPLE_UNITS, ...customUnits];

  const handleSaveRules = (updated: UnitConversionRule[]) => {
    setConversionRules(updated);
    localStorage.setItem('ufo_custom_unit_rules', JSON.stringify(updated));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const factorNum = Number(newRule.conversionFactor);
    if (!factorNum || factorNum <= 0) {
      showToast('error', 'Please enter a valid conversion factor greater than 0');
      return;
    }
    if (newRule.mainUnit === newRule.secondaryUnit) {
      showToast('error', 'Main Unit and Secondary Unit cannot be the same');
      return;
    }

    const createdRule: UnitConversionRule = {
      id: `rule-${Date.now()}`,
      mainUnit: newRule.mainUnit,
      secondaryUnit: newRule.secondaryUnit,
      conversionFactor: factorNum,
      description: newRule.description || `1 ${newRule.mainUnit} = ${factorNum} ${newRule.secondaryUnit}`,
      isSystem: false
    };

    const updated = [createdRule, ...conversionRules];
    handleSaveRules(updated);
    showToast('success', `Conversion Rule created: 1 ${newRule.mainUnit} = ${factorNum} ${newRule.secondaryUnit}`);
    setIsAddRuleOpen(false);
    setNewRule({ mainUnit: 'Box', secondaryUnit: 'Nos', conversionFactor: '12', description: '' });
  };

  const handleDeleteRule = (id: string) => {
    const ruleToDelete = conversionRules.find((r) => r.id === id);
    if (ruleToDelete?.isSystem) {
      showToast('info', 'System standard rules cannot be deleted.');
      return;
    }
    const updated = conversionRules.filter((r) => r.id !== id);
    handleSaveRules(updated);
    showToast('success', 'Conversion rule deleted.');
  };

  // Calculator Logic
  const calculatedFactor = UnitService.getConversionFactor(calcFromUnit, calcToUnit);
  const calculatedResult = Number(calcAmount || 0) * calculatedFactor;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md">
              <ArrowRightLeft className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Units & Conversion Manager</h2>
              <p className="text-xs text-slate-400">
                Simple units, compound conversions, and automatic inventory calculations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('CONVERSION')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'CONVERSION' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Compound Conversions ({conversionRules.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('SIMPLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'SIMPLE' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Simple Units ({allUnits.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('CALCULATOR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'CALCULATOR' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Live Converter Widget</span>
            </button>
          </div>

          {activeTab === 'CONVERSION' && (
            <button
              onClick={() => setIsAddRuleOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-yellow-300" />
              <span>Add Custom Conversion</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: COMPOUND CONVERSIONS */}
          {activeTab === 'CONVERSION' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950">
                  <span className="font-bold block mb-0.5">Automated Unit Conversion Engine:</span>
                  Define relationship between Main Units (e.g. Dozen, Box, Carton) and Sub-Units (e.g. Nos, Pcs). These factors automatically calculate prices, stock levels, and invoice totals.
                </div>
              </div>

              {/* Add New Rule Drawer */}
              {isAddRuleOpen && (
                <form onSubmit={handleAddRule} className="bg-slate-50 border border-blue-300 p-4 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-xs text-slate-800 uppercase flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-blue-600" /> Add Compound Unit Rule
                    </h3>
                    <button type="button" onClick={() => setIsAddRuleOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">1 Main Unit</label>
                      <select
                        value={newRule.mainUnit}
                        onChange={(e) => setNewRule({ ...newRule, mainUnit: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                      >
                        {allUnits.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.code} ({u.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">= Factor (X)</label>
                      <input
                        type="number"
                        required
                        min="0.001"
                        step="any"
                        placeholder="e.g. 12"
                        value={newRule.conversionFactor}
                        onChange={(e) => setNewRule({ ...newRule, conversionFactor: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Sub / Secondary Unit</label>
                      <select
                        value={newRule.secondaryUnit}
                        onChange={(e) => setNewRule({ ...newRule, secondaryUnit: e.target.value })}
                        className="w-full p-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                      >
                        {allUnits.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.code} ({u.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddRuleOpen(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow-2xs"
                    >
                      Save Rule
                    </button>
                  </div>
                </form>
              )}

              {/* Conversion Rules Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Main Unit</th>
                      <th className="py-2.5 px-4 text-center">Conversion Formula</th>
                      <th className="py-2.5 px-4">Secondary Unit</th>
                      <th className="py-2.5 px-4 text-center">Type</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {conversionRules.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-blue-700">
                          1 {r.mainUnit}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 bg-slate-50/80">
                          = {r.conversionFactor} {r.secondaryUnit}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">
                          {r.secondaryUnit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {r.isSystem ? (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                              Standard System
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              Custom Rule
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!r.isSystem && (
                            <button
                              onClick={() => handleDeleteRule(r.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                              title="Delete custom rule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SIMPLE UNITS */}
          {activeTab === 'SIMPLE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Supported Simple Base Units</h3>
                  <p className="text-xs text-slate-500">20 Default Standard Units of Measurement for Inventory</p>
                </div>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search unit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {allUnits
                  .filter((u) => u.code.toLowerCase().includes(searchTerm.toLowerCase()) || u.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((u) => (
                    <div
                      key={u.code}
                      className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-black text-sm text-blue-700 block">{u.code}</span>
                        <span className="text-[11px] font-medium text-slate-500">{u.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">
                        {u.category}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 3: LIVE CONVERTER CALCULATOR */}
          {activeTab === 'CALCULATOR' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-6 rounded-2xl text-white shadow-lg space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-bold text-base">Unit Conversion Calculator</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-lg font-bold focus:border-blue-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 mb-1">From Unit</label>
                    <select
                      value={calcFromUnit}
                      onChange={(e) => setCalcFromUnit(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      {allUnits.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.code} - {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-300 mb-1">To Unit</label>
                    <select
                      value={calcToUnit}
                      onChange={(e) => setCalcToUnit(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      {allUnits.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.code} - {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-center space-y-1">
                  <span className="text-xs text-slate-400 font-bold uppercase block">Conversion Result</span>
                  <div className="text-2xl font-black text-yellow-400 font-mono">
                    {calcAmount || '0'} {calcFromUnit} = {calculatedResult.toLocaleString('en-US', { maximumFractionDigits: 4 })} {calcToUnit}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-2xs"
          >
            Close Manager
          </button>
        </div>
      </div>
    </div>
  );
};
