import React from 'react';
import { AlertStatus, EvacuationCenter, Household } from '../types';
import { InteractiveMap } from './InteractiveMap';
import { X, User, Phone, Calendar, MapPin, Users, AlertTriangle, CheckCircle, Edit, Building, ShieldCheck, HeartPulse } from 'lucide-react';

interface HouseholdDetailsModalProps {
  household: Household;
  centers: EvacuationCenter[];
  onClose: () => void;
  onUpdateStatus: (householdId: string, status: AlertStatus) => void;
  onAssignCenter: (householdId: string, centerId: string | undefined) => void;
  onToggleVerification: (householdId: string) => void;
  onEditHousehold: (household: Household) => void;
  onOpenRelief: (household: Household) => void;
}

export const HouseholdDetailsModal: React.FC<HouseholdDetailsModalProps> = ({
  household,
  centers,
  onClose,
  onUpdateStatus,
  onAssignCenter,
  onToggleVerification,
  onEditHousehold,
  onOpenRelief,
}) => {
  const currentCenter = centers.find((c) => c.id === household.evacuationCenterId);

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case 'EMERGENCY':
        return 'bg-red-600 text-white';
      case 'MODERATE':
        return 'bg-amber-500 text-white';
      case 'SAFE':
      default:
        return 'bg-emerald-600 text-white';
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
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] select-none privacy-protected-data">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg">
              🏠
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-lg">{household.headOfFamily}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(household.status)}`}>
                  {household.status === 'EMERGENCY' ? '🔴 MUST EVACUATE' : household.status === 'MODERATE' ? '🟡 MODERATE' : '🟢 SAFE'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${household.verificationStatus === 'Verified' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}`}>
                  {household.verificationStatus}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  <span>Privacy Protected • Copy Disabled</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {household.purok}, Barangay {household.barangay} • Total Members: {household.numberOfMembers}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Quick Action Bar for Barangay Official */}
          <div className="p-3 bg-slate-100 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Quick Change Status:</span>
              <button
                type="button"
                onClick={() => onUpdateStatus(household.id, 'SAFE')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  household.status === 'SAFE' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-slate-300 hover:bg-emerald-50'
                }`}
              >
                Safe
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(household.id, 'MODERATE')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  household.status === 'MODERATE' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-slate-300 hover:bg-amber-50'
                }`}
              >
                Moderate
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(household.id, 'EMERGENCY')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  household.status === 'EMERGENCY' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-slate-300 hover:bg-red-50'
                }`}
              >
                Must Evacuate
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleVerification(household.id)}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  household.verificationStatus === 'Verified'
                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mark {household.verificationStatus === 'Verified' ? 'Pending' : 'Verified'}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenRelief(household)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition cursor-pointer"
              >
                📦 Issue Relief
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Contact & Location Info */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-1">
                Contact & Address Details
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold font-mono text-slate-900 text-sm">{household.contactNumber}</span>
              </div>
              {household.birthday && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Birthday: <strong className="font-semibold text-slate-900">{household.birthday}</strong>
                    {household.age ? ` (${household.age} yrs old)` : ''}
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{household.purok}</strong>, Barangay {household.barangay}
                  <div className="text-slate-500">{household.completeAddress}</div>
                  {household.houseNumber && <div className="text-slate-500">House No: {household.houseNumber}</div>}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">Evacuation Center Assignment:</span>
                <select
                  value={household.evacuationCenterId || ''}
                  onChange={(e) => onAssignCenter(household.id, e.target.value || undefined)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-blue-800"
                >
                  <option value="">-- Not Assigned / Standby --</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      🏢 {c.name} ({c.assignedCount}/{c.capacityFamilies} Families)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Situation Message & Special Needs */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>Emergency Status & Special Needs</span>
                  <span className="text-[10px] text-slate-400 font-mono">{household.lastStatusUpdate}</span>
                </div>

                {household.specialNeeds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {household.specialNeeds.map((sn) => (
                      <span key={sn} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-xs">
                        ⚠️ {sn}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs mt-2">No special vulnerability tags reported.</div>
                )}

                {household.statusNote ? (
                  <div className="mt-3 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs italic">
                    <strong className="block text-slate-500 text-[10px] uppercase font-bold not-italic">
                      Resident Situation Note:
                    </strong>
                    "{household.statusNote}"
                  </div>
                ) : null}
              </div>

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => onEditHousehold(household)}
                  className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-1 justify-end"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Full Household Records</span>
                </button>
              </div>
            </div>
          </div>

          {/* Family Members Breakdown Table */}
          <div className="space-y-2">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Family Members List ({household.familyMembers.length} Members)</span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Relation</th>
                    <th className="p-2.5">Age</th>
                    <th className="p-2.5">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {household.familyMembers.map((mem) => (
                    <tr key={mem.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{mem.name}</td>
                      <td className="p-2.5 text-slate-600">{mem.relationship}</td>
                      <td className="p-2.5 font-mono text-slate-700">{mem.age} yrs old</td>
                      <td className="p-2.5">
                        {mem.specialCategory && mem.specialCategory !== 'None' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                            {mem.specialCategory}
                          </span>
                        ) : (
                          <span className="text-slate-400">Regular</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Pin Location Map */}
          <div className="space-y-2">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-red-600" />
              <span>Pinned House Coordinates</span>
            </div>
            <InteractiveMap
              barangay={household.barangay}
              households={[household]}
              centers={centers}
              highlightHouseholdId={household.id}
              className="h-[220px] w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
