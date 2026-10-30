import React, { useState, useEffect } from 'react';
import { AlertStatus, EvacuationCenter, Household } from '../types';
import { BARANGAY_CONFIG } from '../data/initialData';
import { InteractiveMap } from './InteractiveMap';
import {
  Home,
  AlertTriangle,
  CheckCircle,
  Building,
  PhoneCall,
  LogOut,
  MapPin,
  CheckCircle2,
  Phone,
  Shield,
  Moon,
  Sun,
} from 'lucide-react';

interface HouseholdDashboardProps {
  household: Household;
  assignedCenter?: EvacuationCenter;
  allCenters?: EvacuationCenter[];
  onUpdateStatus: (householdId: string, status: AlertStatus, note?: string) => void;
  onEditHouseholdInfo?: () => void;
  onSwitchToOfficialLogin?: () => void;
  onLogout: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const HouseholdDashboard: React.FC<HouseholdDashboardProps> = ({
  household,
  assignedCenter,
  allCenters = [],
  onUpdateStatus,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [currentStatus, setCurrentStatus] = useState<AlertStatus>(household.status);
  const [statusNote, setStatusNote] = useState<string>(household.statusNote || '');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentStatus(household.status);
  }, [household.status]);

  const barangayInfo = BARANGAY_CONFIG[household.barangay];

  const handleSelectStatus = (newStatus: AlertStatus, defaultNote: string) => {
    setCurrentStatus(newStatus);
    const noteToSend = statusNote.trim() || defaultNote;
    onUpdateStatus(household.id, newStatus, noteToSend);

    const labels: Record<AlertStatus, string> = {
      SAFE: 'Safe',
      EMERGENCY: 'Evacuate',
      MODERATE: 'Evacuated',
    };

    setFeedbackMessage(`Status updated to "${labels[newStatus]}" and live-synced to Barangay ${household.barangay} Command Center.`);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case 'EMERGENCY':
        return {
          label: 'Evacuate',
          badgeText: '🚨 Need Evacuation',
          badgeClass: 'bg-red-600 text-white',
          borderClass: 'border-red-500',
          bgClass: 'bg-red-50',
        };
      case 'MODERATE':
        return {
          label: 'Evacuated',
          badgeText: '🏢 Evacuated to Center',
          badgeClass: 'bg-blue-600 text-white',
          borderClass: 'border-blue-500',
          bgClass: 'bg-blue-50',
        };
      case 'SAFE':
      default:
        return {
          label: 'Safe',
          badgeText: '✅ Safe at Home',
          badgeClass: 'bg-emerald-600 text-white',
          borderClass: 'border-emerald-500',
          bgClass: 'bg-emerald-50',
        };
    }
  };

  const statusInfo = getStatusBadge(currentStatus);

  return (
    <div
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none privacy-protected-data"
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
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Header */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm shadow-blue-600/30">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-xs sm:text-sm uppercase tracking-wide text-white">
                BARANGAY RESIDENT PORTAL
              </h1>
              <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded uppercase">
                Brgy. {household.barangay}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Household Head: <strong className="text-slate-200">{household.headOfFamily}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dark Mode Switch */}
          {onToggleDarkMode && (
            <button
              type="button"
              id="btn-resident-dark-mode"
              onClick={onToggleDarkMode}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-800/90 hover:bg-slate-700/80 text-amber-300 border-amber-500/30 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Logout Button */}
          <button
            type="button"
            id="btn-resident-logout"
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Log out of resident session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Live Sync Confirmation Toast */}
        {feedbackMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-wider">
              Live Synced
            </span>
          </div>
        )}

        {/* Urgent Mandatory Evacuation Order Alert for Residents */}
        {currentStatus === 'EMERGENCY' && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-xl shadow-red-600/30 border-2 border-red-400 flex items-start sm:items-center gap-3.5 animate-pulse">
            <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-white text-red-700 rounded text-[10px] font-black uppercase tracking-wider">
                  URGENT DIRECTIVE
                </span>
                <h2 className="text-sm font-black uppercase tracking-wide">
                  YOU NEED TO EVACUATE IMMEDIATELY
                </h2>
              </div>
              <p className="text-xs text-red-100 mt-1 font-medium leading-relaxed">
                Barangay {household.barangay} DRRM Command Center has issued a mandatory evacuation order. Please proceed to the nearest evacuation shelter right away.
              </p>
            </div>
          </div>
        )}

        {/* 1. Emergency Status Action Card */}
        <div className="bg-slate-950 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Current Safety Status
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${statusInfo.badgeClass}`}>
                  {statusInfo.badgeText}
                </span>
                <span className="text-xs text-slate-400">
                  Tap a button below to update your status instantly.
                </span>
              </div>
            </div>

            {household.lastStatusUpdate && (
              <span className="text-[10px] text-slate-400 font-mono">
                Updated: {household.lastStatusUpdate}
              </span>
            )}
          </div>

          {/* The 3 Required Action Buttons: Safe, Evacuate, Evacuated */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            {/* 1. SAFE */}
            <button
              type="button"
              id="btn-status-safe"
              onClick={() => handleSelectStatus('SAFE', 'Safe at Home')}
              className={`p-4 rounded-xl font-black text-sm border-2 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                currentStatus === 'SAFE'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/40'
                  : 'bg-slate-900 text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/60 hover:border-emerald-400'
              }`}
            >
              <CheckCircle className="w-6 h-6 text-emerald-300" />
              <span className="uppercase tracking-wider text-base">Safe</span>
              <span className="text-[11px] font-normal opacity-90">Safe at home • No immediate danger</span>
            </button>

            {/* 2. EVACUATE */}
            <button
              type="button"
              id="btn-status-evacuate"
              onClick={() => handleSelectStatus('EMERGENCY', 'Needs Immediate Evacuation')}
              className={`p-4 rounded-xl font-black text-sm border-2 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                currentStatus === 'EMERGENCY'
                  ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/40 ring-2 ring-red-400/40 animate-pulse'
                  : 'bg-slate-900 text-red-400 border-red-500/40 hover:bg-red-950/60 hover:border-red-400'
              }`}
            >
              <AlertTriangle className="w-6 h-6 text-red-300" />
              <span className="uppercase tracking-wider text-base">Evacuate</span>
              <span className="text-[11px] font-normal opacity-90">Needs evacuation • Send rescue assistance</span>
            </button>

            {/* 3. EVACUATED */}
            <button
              type="button"
              id="btn-status-evacuated"
              onClick={() => handleSelectStatus('MODERATE', 'Evacuated at Center')}
              className={`p-4 rounded-xl font-black text-sm border-2 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center ${
                currentStatus === 'MODERATE'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/40'
                  : 'bg-slate-900 text-blue-400 border-blue-500/40 hover:bg-blue-950/60 hover:border-blue-400'
              }`}
            >
              <Building className="w-6 h-6 text-blue-300" />
              <span className="uppercase tracking-wider text-base">Evacuated</span>
              <span className="text-[11px] font-normal opacity-90">Relocated to evacuation shelter / safe zone</span>
            </button>
          </div>
        </div>

        {/* 2. Barangay Hotline Card */}
        <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-blue-400">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-black uppercase tracking-wider text-white">
                Barangay {household.barangay} DRRM Emergency Hotline
              </h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              ● 24/7 Live Dispatch
            </span>
          </div>

          <div className={`grid grid-cols-1 ${assignedCenter ? 'md:grid-cols-2' : ''} gap-3 items-center`}>
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide block">
                Direct Emergency Contact Number
              </span>
              <div className="text-lg font-black font-mono text-emerald-400 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{barangayInfo?.hotline || '(052) 742-1088 / 0917-555-0101'}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Officer in Charge: <strong className="text-slate-200">{barangayInfo?.evacuationLead || 'DRRM Operations Head'}</strong>
              </p>
            </div>

            {assignedCenter && (
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide block">
                  Assigned Evacuation Center
                </span>
                <div className="text-base font-bold text-blue-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{assignedCenter.name}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Location: <strong className="text-slate-200">{assignedCenter.purok}</strong> • Capacity: <span className="text-slate-300">{assignedCenter.capacityFamilies} families</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Interactive Map */}
        <div className="bg-slate-950 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200">
              <MapPin className="w-4 h-4 text-red-500" />
              <span>Evacuation Map • Barangay {household.barangay}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Purok: {household.purok}
            </span>
          </div>

          <InteractiveMap
            barangay={household.barangay}
            households={[household]}
            centers={allCenters.filter((c) => c.barangay === household.barangay)}
            highlightHouseholdId={household.id}
            className="h-[320px] sm:h-[380px] w-full rounded-xl overflow-hidden border border-slate-800"
          />
        </div>
      </main>
    </div>
  );
};
