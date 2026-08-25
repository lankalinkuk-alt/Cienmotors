import React, { useState } from 'react';
import { Company, Product, AppSettings } from '../types';

interface IntercompanyProps {
  companies: Company[];
  products: Product[];
  settings: AppSettings;
}

export function Intercompany({ companies, products, settings }: IntercompanyProps) {
  const [activeTab, setActiveTab] = useState<'stock' | 'cash' | 'register' | 'recon'>('stock');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Intercompany Transfers</h1>
      </div>
      
      <div className="flex space-x-4 border-b border-slate-200">
        <button className={`px-4 py-2 ${activeTab === 'stock' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`} onClick={() => setActiveTab('stock')}>Stock Transfer</button>
        <button className={`px-4 py-2 ${activeTab === 'cash' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`} onClick={() => setActiveTab('cash')}>Cash/Bank Transfer</button>
        <button className={`px-4 py-2 ${activeTab === 'register' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`} onClick={() => setActiveTab('register')}>Transfer Register</button>
        <button className={`px-4 py-2 ${activeTab === 'recon' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`} onClick={() => setActiveTab('recon')}>Reconciliation</button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        {activeTab === 'stock' && <div><h3 className="text-lg font-medium mb-4">New Stock Transfer</h3><p>Select source and destination companies to transfer inventory.</p></div>}
        {activeTab === 'cash' && <div><h3 className="text-lg font-medium mb-4">New Cash/Bank Transfer</h3><p>Transfer funds between company ledgers.</p></div>}
        {activeTab === 'register' && <div><h3 className="text-lg font-medium mb-4">Transfer Register</h3><p>View historical intercompany transactions.</p></div>}
        {activeTab === 'recon' && <div><h3 className="text-lg font-medium mb-4">Intercompany Reconciliation</h3><p>Reconcile Due To / Due From balances.</p></div>}
      </div>
    </div>
  );
}
