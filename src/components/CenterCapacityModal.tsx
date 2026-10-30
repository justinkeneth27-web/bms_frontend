import React, { useState } from 'react';
import { BarangayName, EvacuationCenter, Household } from '../types';
import { Building, Plus, Users, MapPin, Check, X, AlertCircle, Trash2, ArrowLeft } from 'lucide-react';

interface CenterCapacityModalProps {
  barangay: BarangayName;
  centers: EvacuationCenter[];
  households: Household[];
  onSaveCenter: (center: EvacuationCenter) => void;
  onDeleteCenter?: (centerId: string) => void;
  onAssignHouseholdCenter: (householdId: string, centerId: string | undefined) => void;
  onClose: () => void;
}

export const CenterCapacityModal: React.FC<CenterCapacityModalProps> = ({
  barangay,
  centers,
  households,
  onSaveCenter,
  onDeleteCenter,
  onAssignHouseholdCenter,
  onClose,
}) => {
  // Always default to Barangay Hall if available, else first center
  const defaultCenter = centers.find(
    (c) => c.name.trim().toLowerCase() === 'barangay hall'
  ) || centers[0];

  const [selectedCenterId, setSelectedCenterId] = useState<string>(defaultCenter?.id || '');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // New center form fields
  const [newName, setNewName] = useState('');
  const [newPurok, setNewPurok] = useState('Purok 1');
  const [newCapacity, setNewCapacity] = useState<number>(20);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerContact, setNewManagerContact] = useState('');

  // Keep selectedCenterId valid if current selection is deleted
  const activeCenterId = centers.some((c) => c.id === selectedCenterId)
    ? selectedCenterId
    : defaultCenter?.id || centers[0]?.id || '';

  const currentCenter = centers.find((c) => c.id === activeCenterId);
  const assignedHouseholds = households.filter((h) => h.evacuationCenterId === activeCenterId);
  const unassignedEmergencyHouseholds = households.filter(
    (h) => h.status === 'EMERGENCY' && (!h.evacuationCenterId || h.evacuationCenterId !== activeCenterId)
  );

  const handleCreateCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newCenter: EvacuationCenter = {
      id: 'center-' + barangay.toLowerCase() + '-' + Date.now(),
      name: newName.trim(),
      barangay,
      purok: newPurok,
      capacityFamilies: Number(newCapacity) || 15,
      assignedCount: 0,
      location: { lat: 13.3440, lng: 123.7000 },
      managerName: newManagerName.trim() || 'Barangay Kagawad',
      managerContact: newManagerContact.trim() || '0917-000-0000',
      status: 'Open',
      facilities: ['Water Supply', 'First Aid', 'Restrooms'],
    };

    onSaveCenter(newCenter);
    setIsAddingNew(false);
    setSelectedCenterId(newCenter.id);
    setNewName('');
    setNewManagerName('');
    setNewManagerContact('');
  };

  const isDefaultCenter = (center: EvacuationCenter) => {
    return center.name.trim().toLowerCase() === 'barangay hall';
  };

  const handleDelete = (center: EvacuationCenter) => {
    if (isDefaultCenter(center)) return;
    if (onDeleteCenter) {
      onDeleteCenter(center.id);
      setConfirmDeleteId(null);
      const remaining = centers.filter((c) => c.id !== center.id);
      if (remaining.length > 0) {
        setSelectedCenterId(remaining[0].id);
      }
    }
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
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">Evacuation Center Capacity Tracking</h2>
              <p className="text-xs text-slate-400">Manage shelters & family room assignments for Barangay {barangay}</p>
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
          {/* Centers List / Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {centers.map((c) => {
                const isSelected = c.id === activeCenterId;
                const isDefault = isDefaultCenter(c);
                const liveAssigned = households.filter((h) => h.evacuationCenterId === c.id).length;
                const assigned = households.length > 0 ? liveAssigned : (c.assignedCount ?? 0);
                const percent = c.capacityFamilies > 0 ? Math.min(100, Math.round((assigned / c.capacityFamilies) * 100)) : 0;
                return (
                  <div key={c.id} className="relative group flex items-center">
                    <button
                      type="button"
                      onClick={() => { setSelectedCenterId(c.id); setIsAddingNew(false); }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>🏢 {c.name}</span>
                      {isDefault && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wide ${isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'}`}>
                          Default
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-800'}`}>
                        {assigned}/{c.capacityFamilies} ({percent}%)
                      </span>
                    </button>
                    {!isDefault && onDeleteCenter && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(c.id);
                        }}
                        title={`Delete ${c.name}`}
                        className="ml-1 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Evac Center</span>
            </button>
          </div>

          {/* Add Center Form */}
          {isAddingNew ? (
            <form onSubmit={handleCreateCenter} className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-4">
              <div className="font-bold text-sm text-blue-900 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Register New Evacuation Center for Barangay {barangay}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Center Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Community Center / Parish Hall"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Purok Location</label>
                  <input
                    type="text"
                    value={newPurok}
                    onChange={(e) => setNewPurok(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Capacity (Families)</label>
                  <input
                    type="number"
                    min="1"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Manager / Contact Person</label>
                  <input
                    type="text"
                    value={newManagerName}
                    onChange={(e) => setNewManagerName(e.target.value)}
                    placeholder="Kagawad in charge"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={newManagerContact}
                    onChange={(e) => setNewManagerContact(e.target.value)}
                    placeholder="0917xxxxxxx"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow"
                >
                  Save Center
                </button>
              </div>
            </form>
          ) : currentCenter ? (
            <div className="space-y-4">
              {/* Selected Center Capacity Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>🏢 {currentCenter.name}</span>
                        <span className="text-xs font-medium text-slate-500">({currentCenter.purok})</span>
                      </h3>
                      {isDefaultCenter(currentCenter) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Official Default Shelter
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          Additional Evac Center
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Center Manager: <strong>{currentCenter.managerName}</strong> ({currentCenter.managerContact})
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-black text-blue-700">
                        {assignedHouseholds.length} / {currentCenter.capacityFamilies} Families
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {Math.max(0, currentCenter.capacityFamilies - assignedHouseholds.length)} slots remaining
                      </span>
                    </div>

                    {!isDefaultCenter(currentCenter) && onDeleteCenter && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(currentCenter.id)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Delete this evacuation center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Center</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      assignedHouseholds.length === 0 ? 'opacity-0' : 'opacity-100'
                    } ${
                      assignedHouseholds.length >= currentCenter.capacityFamilies
                        ? 'bg-red-600'
                        : assignedHouseholds.length > currentCenter.capacityFamilies * 0.7
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                    }`}
                    style={{
                      width: `${assignedHouseholds.length === 0 ? 0 : Math.min(100, Math.round((assignedHouseholds.length / currentCenter.capacityFamilies) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Assigned Families Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Currently Assigned Families ({assignedHouseholds.length}):
                </h4>
                {assignedHouseholds.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No families assigned to this center yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {assignedHouseholds.map((hh) => (
                      <div
                        key={hh.id}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{hh.headOfFamily}</span>
                          <span className="text-slate-500 font-mono">({hh.contactNumber})</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">
                            {hh.numberOfMembers} Members
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAssignHouseholdCenter(hh.id, undefined)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1 hover:bg-red-50 rounded"
                        >
                          Remove Assignment
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unassigned Emergency Families Quick Assignment */}
              {unassignedEmergencyHouseholds.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Households needing Evacuation Center Assignment ({unassignedEmergencyHouseholds.length}):</span>
                  </h4>
                  <div className="space-y-1.5">
                    {unassignedEmergencyHouseholds.map((hh) => (
                      <div
                        key={hh.id}
                        className="p-2.5 bg-red-50/50 border border-red-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{hh.headOfFamily}</span>
                          <span className="text-slate-500 ml-2">({hh.purok}, {hh.numberOfMembers} members)</span>
                          {hh.specialNeeds.length > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                              {hh.specialNeeds.join(', ')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onAssignHouseholdCenter(hh.id, currentCenter.id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
                        >
                          + Assign to {currentCenter.name}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Confirmation Modal for Deleting Center */}
        {confirmDeleteId && (() => {
          const centerToDelete = centers.find((c) => c.id === confirmDeleteId);
          if (!centerToDelete) return null;
          const assignedCount = households.filter((h) => h.evacuationCenterId === confirmDeleteId).length;

          return (
            <div className="fixed inset-0 z-[220] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="p-2.5 bg-red-100 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Delete Evacuation Center?</h3>
                    <p className="text-xs text-slate-500">This action cannot be undone.</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-700">
                  <p><strong>Center:</strong> {centerToDelete.name}</p>
                  <p><strong>Location:</strong> {centerToDelete.purok}, Brgy. {centerToDelete.barangay}</p>
                  <p><strong>Capacity:</strong> {centerToDelete.capacityFamilies} families</p>
                  {assignedCount > 0 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>
                        <strong>{assignedCount}</strong> family currently assigned will be safely unassigned.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(centerToDelete)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
