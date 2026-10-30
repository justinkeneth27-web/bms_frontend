import React, { useState } from 'react';
import { BarangayName, Household, ReliefDistribution } from '../types';
import { Package, Plus, X, Calendar, User, CheckCircle, ArrowLeft } from 'lucide-react';

interface ReliefDistributionModalProps {
  barangay: BarangayName;
  households: Household[];
  reliefRecords: ReliefDistribution[];
  onAddRelief: (relief: ReliefDistribution) => void;
  onClose: () => void;
  preSelectedHousehold?: Household;
}

export const ReliefDistributionModal: React.FC<ReliefDistributionModalProps> = ({
  barangay,
  households,
  reliefRecords,
  onAddRelief,
  onClose,
  preSelectedHousehold,
}) => {
  const [isLoggingNew, setIsLoggingNew] = useState(Boolean(preSelectedHousehold));
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>(
    preSelectedHousehold?.id || households[0]?.id || ''
  );
  const [item, setItem] = useState('Family Food Pack (Rice, Canned Goods, Water)');
  const [qty, setQty] = useState('1 Box (10kg Rice + 8 Canned Goods)');
  const [location, setLocation] = useState('Barangay Hall Evacuation Center');
  const [officerName, setOfficerName] = useState(
    barangay === 'Buang' ? 'Hon. Rolando M. Santos' : 'Hon. Cynthia P. Ramos'
  );
  const [notes, setNotes] = useState('');

  const currentRecords = reliefRecords.filter((r) => r.barangay === barangay);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hh = households.find((h) => h.id === selectedHouseholdId);
    if (!hh) return;

    const newRecord: ReliefDistribution = {
      id: 'rel-' + Date.now(),
      householdId: hh.id,
      recipientName: hh.headOfFamily,
      barangay,
      purok: hh.purok,
      item,
      qty,
      location,
      timestamp: new Date().toLocaleString(),
      officerName,
      notes: notes.trim() || undefined,
    };

    onAddRelief(newRecord);
    setIsLoggingNew(false);
    setNotes('');
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none privacy-protected-data"
      onCopy={(e) => {
        e.preventDefault();
        if (e.clipboardData) e.clipboardData.clearData();
      }}
      onCut={(e) => {
        e.preventDefault();
        if (e.clipboardData) e.clipboardData.clearData();
      }}
      onPaste={(e) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] select-none privacy-protected-data">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="mr-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 hover:text-white rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold border border-slate-700 shadow-xs cursor-pointer group"
              title="Back to Navigation Menu"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-300 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">Relief Goods Distribution Log</h2>
              <p className="text-xs text-slate-400">Track and issue relief assistance for Barangay {barangay}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">
              Relief Records ({currentRecords.length} Distributions)
            </h3>
            <button
              type="button"
              onClick={() => setIsLoggingNew(!isLoggingNew)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isLoggingNew ? 'Close Form' : '+ Record New Relief Distribution'}</span>
            </button>
          </div>

          {/* New Relief Form */}
          {isLoggingNew && (
            <form onSubmit={handleSubmit} className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-4">
              <div className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-700" />
                <span>Log Relief Distribution Entry</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select Recipient Household *
                  </label>
                  <select
                    value={selectedHouseholdId}
                    onChange={(e) => setSelectedHouseholdId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    {households.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.headOfFamily} ({h.purok} - {h.numberOfMembers} Members) - [{h.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Relief Item / Pack Type *
                  </label>
                  <input
                    type="text"
                    required
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="e.g. Food Pack, Hygiene Kit, Sleeping Mat"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Quantity & Contents
                  </label>
                  <input
                    type="text"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="e.g. 2 Packs + 10L Water"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Distribution Venue / Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Barangay Hall / Door-to-door"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Distributing Official
                  </label>
                  <input
                    type="text"
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Recipient has infant requiring additional milk formula."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoggingNew(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Record Distribution
                </button>
              </div>
            </form>
          )}

          {/* History Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Item Provided</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Officer</th>
                  <th className="p-3">Date / Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      No relief distributions recorded today.
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">
                        {r.recipientName}
                        <span className="block text-[10px] text-slate-500 font-normal">{r.purok}</span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">{r.item}</td>
                      <td className="p-3 font-mono text-emerald-700 font-bold">{r.qty}</td>
                      <td className="p-3 text-slate-600">{r.location}</td>
                      <td className="p-3 text-slate-700">{r.officerName}</td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{r.timestamp}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
