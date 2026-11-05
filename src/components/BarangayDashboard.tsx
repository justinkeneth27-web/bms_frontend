import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertStatus,
  BarangayConfig,
  BarangayName,
  EvacuationCenter,
  Household,
  NotificationItem,
  OfficialAccount,
  ReliefDistribution,
  SpecialCategory,
} from '../types';
import { BARANGAY_CONFIG, OFFICIAL_ACCOUNTS } from '../data/initialData';
import { InteractiveMap } from './InteractiveMap';
import {
  Printer,
  Home,
  Package,
  Plus,
  Users,
  Bell,
  LogOut,
  Search,
  RotateCcw,
  Building,
  AlertTriangle,
  CheckCircle,
  Eye,
  Edit2,
  Trash2,
  Phone,
  Shield,
  Volume2,
  VolumeX,
  MapPin,
  FileText,
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldAlert,
  ClipboardList,
  Menu,
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Smartphone,
  Send,
  Save,
  UserPlus,
  UserCog,
  Moon,
  Sun,
  Database,
} from 'lucide-react';
import { BackendHealthResponse } from '../utils/laravelApi';

export const formatIncidentTime = (timestamp?: string): { relativeTime: string; clockTime: string } => {
  if (!timestamp) return { relativeTime: 'Just now', clockTime: '' };

  let date: Date;

  if (timestamp.endsWith('Z') || timestamp.includes('+')) {
    date = new Date(timestamp);
  } else if (timestamp.includes('T') || timestamp.includes(' ')) {
    const normalized = timestamp.replace(' ', 'T');
    const localDate = new Date(normalized);
    const utcDate = new Date(normalized + 'Z');
    const now = Date.now();

    // If treating as UTC is significantly closer to now than local (e.g. UTC string saved without Z),
    // use UTC to correct the timezone offset
    if (!isNaN(utcDate.getTime()) && Math.abs(now - utcDate.getTime()) < Math.abs(now - localDate.getTime())) {
      date = utcDate;
    } else {
      date = localDate;
    }
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) {
    return {
      relativeTime: 'Just now',
      clockTime: timestamp.length >= 16 ? timestamp.substring(11, 16) : timestamp,
    };
  }

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  let relativeTime = 'Just now';
  if (diffSec < 45) {
    relativeTime = 'Just now';
  } else if (diffSec < 3600) {
    relativeTime = `${Math.floor(diffSec / 60)}m ago`;
  } else if (diffSec < 86400) {
    relativeTime = `${Math.floor(diffSec / 3600)}h ago`;
  } else {
    relativeTime = `${Math.floor(diffSec / 86400)}d ago`;
  }

  const clockTime = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return { relativeTime, clockTime };
};

interface BarangayDashboardProps {
  currentBarangay: BarangayName;
  officialAccount: OfficialAccount;
  backendStatus?: 'connected' | 'offline' | 'checking';
  backendInfo?: BackendHealthResponse | null;
  onSyncBackend?: () => void;
  isSyncing?: boolean;
  households: Household[];
  centers: EvacuationCenter[];
  reliefRecords: ReliefDistribution[];
  notifications: NotificationItem[];
  barangayConfigs?: Record<BarangayName, BarangayConfig>;
  onUpdateBarangayConfig?: (brgy: BarangayName, updates: Partial<BarangayConfig>) => void;
  logsCount?: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSwitchBarangay: (barangay: BarangayName) => void;
  onUpdateHouseholdStatus: (householdId: string, status: AlertStatus, note?: string) => void;
  onAssignCenter: (householdId: string, centerId: string | undefined) => void;
  onToggleVerification: (householdId: string) => void;
  onDeleteHousehold: (householdId: string) => void;
  onAddNewHousehold: () => void;
  onBroadcastMustEvacuate?: () => void;
  onSafeAllHouseholds?: () => void;
  onEditHousehold: (household: Household) => void;
  onSelectHouseholdDetails: (household: Household) => void;
  onOpenPrintModal: () => void;
  onOpenCentersModal: () => void;
  onOpenReliefModal: (household?: Household) => void;
  onOpenAccountsModal: () => void;
  onOpenLogsModal: () => void;
  onOpenCreateAccountModal?: () => void;
  onOpenManageAccountModal?: () => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onClearAllNotifications: () => void;
  onLogout: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const BarangayDashboard: React.FC<BarangayDashboardProps> = ({
  currentBarangay,
  officialAccount,
  backendStatus = 'checking',
  backendInfo = null,
  onSyncBackend,
  isSyncing = false,
  households,
  centers,
  reliefRecords,
  notifications,
  barangayConfigs,
  onUpdateBarangayConfig,
  logsCount = 0,
  soundEnabled,
  onToggleSound,
  onSwitchBarangay,
  onUpdateHouseholdStatus,
  onAssignCenter,
  onToggleVerification,
  onDeleteHousehold,
  onAddNewHousehold,
  onBroadcastMustEvacuate,
  onSafeAllHouseholds,
  onEditHousehold,
  onSelectHouseholdDetails,
  onOpenPrintModal,
  onOpenCentersModal,
  onOpenReliefModal,
  onOpenAccountsModal,
  onOpenLogsModal,
  onOpenCreateAccountModal,
  onOpenManageAccountModal,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onLogout,
  isDarkMode: propIsDarkMode,
  onToggleDarkMode,
}) => {
  // Active dynamic hotline
  const activeBarangayConfig = (barangayConfigs && barangayConfigs[currentBarangay]) || BARANGAY_CONFIG[currentBarangay];
  const activeHotline = activeBarangayConfig.hotline;

  // Dark mode state with persistent localStorage
  const [internalDarkMode, setInternalDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('brgy_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  const isDarkMode = propIsDarkMode !== undefined ? propIsDarkMode : internalDarkMode;

  const handleToggleDarkMode = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else {
      setInternalDarkMode((prev) => !prev);
    }
  };

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        localStorage.setItem('brgy_dark_mode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        localStorage.setItem('brgy_dark_mode', 'false');
      }
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  // Hotline edit modal state
  const [showHotlineModal, setShowHotlineModal] = useState(false);
  const [hotlineInput, setHotlineInput] = useState(activeHotline);
  const [leadOfficerInput, setLeadOfficerInput] = useState(activeBarangayConfig.evacuationLead || '');
  const [altHotlineInput, setAltHotlineInput] = useState(activeBarangayConfig.alternateHotline || '');

  // Check if active user is the Primary DRRM Head (Punong Barangay)
  const primaryHeadUsername = OFFICIAL_ACCOUNTS[currentBarangay]?.username?.toLowerCase() || '';
  const isPrimaryHead =
    officialAccount.username.toLowerCase() === primaryHeadUsername ||
    officialAccount.position.toLowerCase().includes('punong barangay') ||
    officialAccount.position.toLowerCase().includes('chief');

  // Keep inputs synced if barangay changes
  useEffect(() => {
    const config = (barangayConfigs && barangayConfigs[currentBarangay]) || BARANGAY_CONFIG[currentBarangay];
    setHotlineInput(config.hotline);
    setLeadOfficerInput(config.evacuationLead || '');
    setAltHotlineInput(config.alternateHotline || '');
  }, [currentBarangay, barangayConfigs]);

  const handleSaveHotline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotlineInput.trim()) return;

    if (onUpdateBarangayConfig) {
      onUpdateBarangayConfig(currentBarangay, {
        hotline: hotlineInput.trim(),
        evacuationLead: leadOfficerInput.trim() || activeBarangayConfig.evacuationLead,
        alternateHotline: altHotlineInput.trim() || undefined,
      });
    }
    setShowHotlineModal(false);
    setToastMessage(`Barangay ${currentBarangay} DRRM Hotline updated!`);
    setTimeout(() => setToastMessage(null), 3000);
  };
  // Navigation & Sidebar drawer
  const [activeNavTab, setActiveNavTab] = useState<'dashboard' | 'directory' | 'centers' | 'relief'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [evacuationFilter, setEvacuationFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [specialFilter, setSpecialFilter] = useState<'ANY' | SpecialCategory>('ANY');

  // Notification dropdown
  const [showNotifications, setShowNotifications] = useState(false);

  // Map focus
  const [selectedMapHouseholdId, setSelectedMapHouseholdId] = useState<string | undefined>();

  // Share Citizen Link Modal & Toast State
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [householdToDelete, setHouseholdToDelete] = useState<Household | null>(null);

  const privacyToastTimeoutRef = React.useRef<any>(null);

  const showPrivacyToast = (msg: string) => {
    setToastMessage(msg);
    if (privacyToastTimeoutRef.current) {
      clearTimeout(privacyToastTimeoutRef.current);
    }
    privacyToastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handlePreventCopy = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.clearData();
    }
    showPrivacyToast('🛡️ Data Privacy Notice: Copying household records and dashboard information is restricted.');
  };

  const handlePreventCut = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData) {
      e.clipboardData.clearData();
    }
    showPrivacyToast('🛡️ Data Privacy Notice: Cutting citizen information is disabled.');
  };

  const handlePreventPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      showPrivacyToast('🛡️ Data Privacy Notice: Pasting data into dashboard views is restricted.');
    }
  };

  const handlePreventContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    showPrivacyToast('🛡️ Security Notice: Right-click context actions on citizen data are disabled.');
  };

  // Enforce Data Privacy Act copy/cut/paste restriction across the dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      // Block Ctrl+C (Copy), Ctrl+X (Cut), Ctrl+U (View Source)
      if (key === 'c' || key === 'x' || key === 'u') {
        e.preventDefault();
        showPrivacyToast('🛡️ Data Privacy Notice: Copying citizen records & dashboard data is disabled.');
      }
      // Block Ctrl+A (Select All) outside form inputs
      if (key === 'a' && !isInput) {
        e.preventDefault();
        showPrivacyToast('🛡️ Data Privacy Notice: Selecting all data on dashboard is restricted.');
      }
      // Block Ctrl+V (Paste) outside form inputs
      if (key === 'v' && !isInput) {
        e.preventDefault();
        showPrivacyToast('🛡️ Data Privacy Notice: Pasting data into dashboard views is restricted.');
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.clearData();
      }
      showPrivacyToast('🛡️ Data Privacy Notice: Copying citizen records is restricted.');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.clearData();
      }
      showPrivacyToast('🛡️ Data Privacy Notice: Cutting citizen records is disabled.');
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.clearData();
      }
      showPrivacyToast('🛡️ Data Privacy Notice: Pasting data into dashboard is restricted.');
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.privacy-protected-dashboard, .privacy-protected-data')) {
        e.preventDefault();
        showPrivacyToast('🛡️ Security Notice: Right-click context actions on citizen data are disabled.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const getCitizenUrl = () => {
    return `${window.location.origin}${window.location.pathname}#/household/register`;
  };

  const copyToClipboard = (text: string, isTemplate = false) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      if (isTemplate) {
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 2500);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
      }
      setToastMessage(isTemplate ? 'SMS announcement template copied!' : 'Registration URL copied to clipboard!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  // Live Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' GMT+8'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter households by current barangay
  const barangayHouseholds = useMemo(() => {
    return households.filter((h) => h.barangay === currentBarangay);
  }, [households, currentBarangay]);

  const barangayCenters = useMemo(() => {
    return centers.filter((c) => c.barangay === currentBarangay);
  }, [centers, currentBarangay]);

  const barangayRelief = useMemo(() => {
    return reliefRecords.filter((r) => r.barangay === currentBarangay);
  }, [reliefRecords, currentBarangay]);

  const barangayNotifications = useMemo(() => {
    const raw = notifications.filter((n) => n.barangay === currentBarangay);
    const seenHouseholds = new Set<string>();
    const seenMessages = new Set<string>();
    const deduplicated: NotificationItem[] = [];

    for (const n of raw) {
      // 1. If notification belongs to a specific household, only keep the LATEST status/alert for that household
      // so a single resident never has double or conflicting entries in the stream
      if (n.householdId) {
        if (seenHouseholds.has(n.householdId)) {
          continue;
        }
        seenHouseholds.add(n.householdId);
      } else {
        // 2. Broadcast / system messages: deduplicate identical messages
        const normMsg = n.message.trim().toLowerCase();
        if (seenMessages.has(normMsg)) {
          continue;
        }
        seenMessages.add(normMsg);
      }

      deduplicated.push(n);
    }

    return deduplicated;
  }, [notifications, currentBarangay]);

  const unreadNotifCount = barangayNotifications.filter((n) => !n.read).length;

  // Filtered Households list
  const filteredHouseholds = useMemo(() => {
    return barangayHouseholds.filter((hh) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = hh.headOfFamily.toLowerCase().includes(q);
        const matchesContact = hh.contactNumber.includes(q);
        const matchesPurok = hh.purok.toLowerCase().includes(q);
        const matchesAddress = hh.completeAddress.toLowerCase().includes(q);
        if (!matchesName && !matchesContact && !matchesPurok && !matchesAddress) {
          return false;
        }
      }

      if (statusFilter !== 'ALL' && hh.status !== statusFilter) {
        return false;
      }

      if (evacuationFilter === 'ASSIGNED' && !hh.evacuationCenterId) return false;
      if (evacuationFilter === 'UNASSIGNED' && hh.evacuationCenterId) return false;

      if (specialFilter !== 'ANY' && !hh.specialNeeds.includes(specialFilter)) {
        return false;
      }

      return true;
    });
  }, [barangayHouseholds, searchQuery, statusFilter, evacuationFilter, specialFilter]);

  // Metric Totals
  const totalHouseholdsCount = barangayHouseholds.length;
  const needEvacCount = barangayHouseholds.filter((h) => h.status === 'EMERGENCY').length;
  const moderateCount = barangayHouseholds.filter((h) => h.status === 'MODERATE').length;
  const safeCount = barangayHouseholds.filter((h) => h.status === 'SAFE').length;
  const totalPopulation = barangayHouseholds.reduce((acc, h) => acc + h.numberOfMembers, 0);
  const pwdAndSpecialCount = barangayHouseholds.filter((h) => h.specialNeeds.length > 0).length;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setEvacuationFilter('ALL');
    setSpecialFilter('ANY');
  };

  const renderSidebarContent = () => (
    <>
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
              BM
            </div>
            <h1 className="text-base font-black tracking-tight">BRGY {currentBarangay.toUpperCase()}</h1>
          </div>
          <p className="text-[10px] text-blue-400 mt-0.5 uppercase tracking-wider font-bold">
            Disaster Command Center
          </p>
        </div>

        <button
          type="button"
          id="btn-sidebar-close"
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Close Navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {/* Quick Action: Fill Up Form */}
        <button
          type="button"
          id="btn-sidebar-fillup-form"
          onClick={() => {
            onAddNewHousehold();
            setSidebarOpen(false);
          }}
          className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Add Household Information</span>
        </button>

        <div className="text-[10px] font-bold text-slate-500 px-2 uppercase tracking-wider mb-1">
          Command Views
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveNavTab('dashboard');
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeNavTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <span className={`w-2 h-2 rounded-full ${activeNavTab === 'dashboard' ? 'bg-white' : 'bg-slate-600'}`}></span>
            <span>Dashboard Home</span>
          </div>
          {needEvacCount > 0 && (
            <span className="px-1.5 py-0.2 bg-red-500 text-white text-[10px] font-bold rounded">
              {needEvacCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenCentersModal();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Building className="w-4 h-4" />
          <span>Evacuation Centers</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenReliefModal();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Package className="w-4 h-4" />
          <span>Relief Distribution</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenPrintModal();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print Masterlist</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenLogsModal();
          }}
          className="w-full flex items-center justify-between px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer group"
        >
          <div className="flex items-center space-x-2.5">
            <ClipboardList className="w-4 h-4 text-blue-400 group-hover:text-blue-300" />
            <span>Activity & Audit Logs</span>
          </div>
          {logsCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-900/60 text-blue-300 border border-blue-700/50 text-[10px] font-bold rounded">
              {logsCount}
            </span>
          )}
        </button>

        {isPrimaryHead && (
          <button
            type="button"
            id="btn-sidebar-create-account"
            onClick={() => {
              onOpenCreateAccountModal?.();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer group"
          >
            <UserPlus className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
            <span>Create Account</span>
          </button>
        )}

        <button
          type="button"
          id="btn-sidebar-manage-account"
          onClick={() => {
            onOpenManageAccountModal?.();
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer group"
        >
          <UserCog className="w-4 h-4 text-sky-400 group-hover:text-sky-300" />
          <span>Manage Account</span>
        </button>
      </nav>

      {/* Sidebar Footer with Prominent Logout */}
      <div className="p-3 border-t border-slate-800 space-y-2.5">
        <div className="flex items-center space-x-2 px-1 text-[11px] text-slate-300 font-medium">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px] text-blue-400">
            {officialAccount.officialName.charAt(0)}
          </div>
          <div className="truncate">
            <div className="font-bold text-white truncate">{officialAccount.officialName}</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{officialAccount.position}</div>
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onToggleSound}
            className={`flex-1 py-1.5 px-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition ${
              soundEnabled ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-red-950 text-red-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-red-400" />}
            <span>{soundEnabled ? 'Audio ON' : 'Muted'}</span>
          </button>
        </div>

        <button
          type="button"
          id="btn-sidebar-logout-large"
          onClick={() => {
            setSidebarOpen(false);
            onLogout();
          }}
          className="w-full py-2 px-3 bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
          title="Log Out of Barangay Command Center"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out Session</span>
        </button>
      </div>
    </>
  );

  return (
    <div
      className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden relative select-none privacy-protected-dashboard"
      onCopy={handlePreventCopy}
      onCut={handlePreventCut}
      onPaste={handlePreventPaste}
      onContextMenu={handlePreventContextMenu}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Smooth Sliding Navigation Drawer / Sidebar (appears when clicking the navbar button beside Barangay) */}
      <div
        className={`fixed inset-0 z-[100] flex transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'pointer-events-auto opacity-100 visible' : 'pointer-events-none opacity-0 invisible'
        }`}
      >
        <div
          className={`fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 ease-in-out cursor-pointer ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={`relative w-72 sm:w-80 max-w-[85vw] bg-slate-900 text-white flex flex-col h-full z-[101] shadow-2xl border-r border-slate-800 transform transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarContent()}
        </aside>
      </div>

      {/* Main High Density Command Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* High Density Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 shrink-0 z-10">
          {/* Left info & navbar menu toggle button beside Barangay */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              type="button"
              id="btn-navbar-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 bg-slate-900 hover:bg-blue-600 text-white rounded-lg shadow-sm border border-slate-700/80 transition-all flex items-center justify-center cursor-pointer group"
              title="Open Barangay Navigation Menu"
              aria-label="Open Barangay Navigation Menu"
            >
              <Menu className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>

            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 tracking-tight truncate max-w-[200px] sm:max-w-none flex items-center gap-1.5">
                <span>Barangay {currentBarangay} DRRM Command Center</span>
              </h1>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded uppercase tracking-wider hidden lg:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Console</span>
              </span>

              {/* Resident Live Auto-Sync Status Indicator */}
              <span
                title="Resident status clicks ('Safe', 'Need Evacuate', 'Evacuated') automatically synchronize to this console in real time."
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider hidden md:inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 select-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                <span>Resident Auto-Sync</span>
              </span>

              {/* PostgreSQL Automatic Save Indicator */}
              <div
                title={
                  backendStatus === 'connected'
                    ? `PostgreSQL Connected (${backendInfo?.database?.database || 'barangay_drrm'}). All updates are automatically saved to the database in real time.`
                    : 'Working in offline cache mode. Changes will automatically sync to database when reconnected.'
                }
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1.5 border select-none ${
                  backendStatus === 'connected'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : backendStatus === 'checking'
                    ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {backendStatus === 'connected'
                    ? 'Auto-Saved'
                    : backendStatus === 'checking'
                    ? 'Connecting...'
                    : 'Offline Cache'}
                </span>
              </div>
            </div>
          </div>

          {/* Right actions and metrics */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {/* Professional Dark / Light Mode Switch */}
            <button
              type="button"
              id="btn-header-dark-mode"
              onClick={handleToggleDarkMode}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all duration-150 cursor-pointer whitespace-nowrap border active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-800/90 hover:bg-slate-700/80 text-amber-300 border-amber-500/30 shadow-sm shadow-amber-500/10 ring-1 ring-amber-400/20'
                  : 'bg-slate-100 hover:bg-slate-200/90 text-slate-700 border-slate-200/90 shadow-2xs'
              }`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden md:inline">Light Mode</span>
                  <span className="md:hidden">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="hidden md:inline">Dark Mode</span>
                  <span className="md:hidden">Dark</span>
                </>
              )}
            </button>

            {/* Quick Action: Fill Up Form / Register Household */}
            <button
              type="button"
              id="btn-header-fillup-household"
              onClick={onAddNewHousehold}
              className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer whitespace-nowrap"
              title="Add Household Information & Register Response"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Household Information</span>
              <span className="sm:hidden">+ Add Household</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                id="btn-hd-notifications"
                onClick={() => {
                  const opening = !showNotifications;
                  setShowNotifications(opening);
                  if (opening) onMarkAllNotificationsRead();
                }}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-2xs animate-bounce">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 text-slate-800 overflow-hidden">
                  <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-red-400" />
                      Live Incident Notifications
                    </span>
                    <button
                      type="button"
                      onClick={onClearAllNotifications}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {barangayNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No active incident notifications.
                      </div>
                    ) : (
                      barangayNotifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            onMarkNotificationRead(n.id);
                            if (n.householdId) {
                              const target = households.find((h) => h.id === n.householdId);
                              if (target) onSelectHouseholdDetails(target);
                            }
                          }}
                          className={`p-3 text-xs transition cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                            !n.read ? 'bg-blue-50/60 font-semibold' : ''
                          }`}
                        >
                          <span className="text-base shrink-0">
                            {n.type === 'emergency' ? '🚨' : n.type === 'moderate' ? '⚠️' : '✅'}
                          </span>
                          <div className="flex-1">
                            <div className="font-bold text-slate-900">{n.title}</div>
                            <div className="text-slate-600 text-[11px] mt-0.5">{n.message}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                              <span>{formatIncidentTime(n.timestamp).relativeTime}</span>
                              <span>•</span>
                              <span>{formatIncidentTime(n.timestamp).clockTime}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Prominent Header Logout Button */}
            <button
              type="button"
              id="btn-header-logout"
              onClick={onLogout}
              className="px-2.5 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              title="Log out of session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>

            {/* Date & Live Time */}
            <div className="text-right border-l border-slate-200 pl-3 hidden md:block">
              <p className="text-xs font-bold text-slate-800">{currentDate}</p>
              <p className="text-[10px] text-slate-500 font-mono tracking-tight">{currentTime}</p>
            </div>
          </div>
        </header>

        {/* Scrollable High Density Dashboard Canvas */}
        <section className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 8-Columns: Map Overview + Filters + Household Table */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              {/* High Density Map Card */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Barangay Monitoring Map
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1 text-red-600">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                      {needEvacCount} Emergency
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-600">● {moderateCount} Moderate</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-600">● {safeCount} Safe</span>
                  </div>
                </div>

                <InteractiveMap
                  barangay={currentBarangay}
                  households={filteredHouseholds}
                  centers={barangayCenters}
                  highlightHouseholdId={selectedMapHouseholdId}
                  onSelectHousehold={(hh) => onSelectHouseholdDetails(hh)}
                  onAssignCenter={(hh) => onSelectHouseholdDetails(hh)}
                  className="h-[260px] sm:h-[320px] w-full rounded-lg overflow-hidden border border-slate-200"
                />
              </div>

              {/* High Density Filter Bar */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-end">
                  {/* Search Input */}
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Search Directory
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        id="input-hd-search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Name, Contact, Purok..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'ALL' | AlertStatus)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    >
                      <option value="ALL">All Status</option>
                      <option value="SAFE">Safe</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="EMERGENCY">Need evacuate</option>
                    </select>
                  </div>

                  {/* Evac Assignment */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Evacuation
                    </label>
                    <select
                      value={evacuationFilter}
                      onChange={(e) => setEvacuationFilter(e.target.value as 'ALL' | 'ASSIGNED' | 'UNASSIGNED')}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    >
                      <option value="ALL">All Centers</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="UNASSIGNED">Unassigned</option>
                    </select>
                  </div>

                  {/* Special Needs */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Vulnerability
                    </label>
                    <select
                      value={specialFilter}
                      onChange={(e) => setSpecialFilter(e.target.value as 'ANY' | SpecialCategory)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white outline-none"
                    >
                      <option value="ANY">Any</option>
                      <option value="Senior">Senior (60+)</option>
                      <option value="PWD">PWD</option>
                      <option value="Infant">Infant/Child</option>
                      <option value="Pregnant">Pregnant</option>
                      <option value="Medical">Medical</option>
                    </select>
                  </div>

                  {/* Reset */}
                  <div className="md:col-span-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* High Density Household Responses Table */}
              <div id="household-directory-section" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col privacy-protected-data select-none">
                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Household Directory
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">
                      {filteredHouseholds.length} Records
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold hidden sm:inline-flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-600" />
                      <span>Data Protected • Copying Restricted</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-broadcast-need-evacuate"
                      onClick={() => {
                        if (onBroadcastMustEvacuate) {
                          onBroadcastMustEvacuate();
                        }
                      }}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer animate-pulse hover:animate-none"
                      title="Broadcast Need evacuate directive to all household directory records"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Need evacuate</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={onAddNewHousehold}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Household Information</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={onOpenPrintModal}
                      className="text-xs text-slate-600 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                <div
                  className="overflow-x-auto privacy-protected-data select-none"
                  onCopy={handlePreventCopy}
                  onCut={handlePreventCut}
                  onPaste={handlePreventPaste}
                  onContextMenu={handlePreventContextMenu}
                >
                  <table className="w-full text-left text-xs border-collapse select-none">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3.5 py-2.5">Household Head</th>
                        <th className="px-3 py-2.5">Purok / Contact</th>
                        <th className="px-3 py-2.5">Status Alert</th>
                        <th className="px-3 py-2.5">Assigned Center</th>
                        <th className="px-3 py-2.5">Members</th>
                        <th className="px-3 py-2.5">Special Needs</th>
                        <th className="px-3 py-2.5 text-center">Verify</th>
                        <th className="px-3 py-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHouseholds.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                            No household responses match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredHouseholds.map((hh) => {
                          const center = centers.find((c) => c.id === hh.evacuationCenterId);
                          const isEmergency = hh.status === 'EMERGENCY';
                          const isModerate = hh.status === 'MODERATE';

                          return (
                            <tr
                              key={hh.id}
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                if (!target.closest('button') && !target.closest('select') && !target.closest('input')) {
                                  onSelectHouseholdDetails(hh);
                                }
                              }}
                              onMouseEnter={() => setSelectedMapHouseholdId(hh.id)}
                              title="Click row to inspect full household response & location"
                              className={`transition cursor-pointer ${
                                isEmergency
                                  ? 'bg-red-50/50 hover:bg-red-100/60'
                                  : isModerate
                                  ? 'bg-amber-50/50 hover:bg-amber-100/60'
                                  : 'hover:bg-slate-50/90'
                              }`}
                            >
                              <td className="px-3.5 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => onSelectHouseholdDetails(hh)}
                                  className="font-bold text-slate-900 text-xs hover:text-blue-600 text-left transition cursor-pointer"
                                  title="Click to view full household information"
                                >
                                  {hh.headOfFamily}
                                </button>
                                {hh.statusNote && (
                                  <div className="text-[10px] text-red-600 font-medium truncate max-w-[180px]">
                                    "{hh.statusNote}"
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-2.5">
                                <div className="font-bold text-slate-800">{hh.purok}</div>
                                <div className="text-[10px] font-mono text-slate-500">{hh.contactNumber}</div>
                                {hh.birthday && (
                                  <div className="text-[10px] text-slate-400 font-medium">Bday: {hh.birthday}</div>
                                )}
                              </td>

                              <td className="px-3 py-2.5">
                                {isEmergency ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white inline-block shadow-2xs">
                                    NEED EVACUATE
                                  </span>
                                ) : isModerate ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white inline-block shadow-2xs">
                                    MODERATE
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white inline-block shadow-2xs">
                                    SAFE
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-2.5">
                                {center ? (
                                  <span className="text-blue-700 font-semibold text-[11px] flex items-center gap-1">
                                    <Building className="w-3 h-3" />
                                    <span>{center.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">Unassigned</span>
                                )}
                              </td>

                              <td className="px-3 py-2.5">
                                <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-800 font-bold rounded text-[10px]">
                                  {hh.numberOfMembers} pax
                                </span>
                              </td>

                              <td className="px-3 py-2.5">
                                {hh.specialNeeds.length > 0 ? (
                                  <div className="flex flex-wrap gap-0.5">
                                    {hh.specialNeeds.map((sn) => (
                                      <span
                                        key={sn}
                                        className="px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded text-[9px] font-bold"
                                      >
                                        {sn}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  id={`btn-household-safe-${hh.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateHouseholdStatus(hh.id, 'SAFE', 'Marked Safe by Barangay DRRM Official');
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs ${
                                    hh.status === 'SAFE'
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                                      : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white'
                                  }`}
                                  title="Click to mark this household as Safe"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Safe</span>
                                </button>
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onSelectHouseholdDetails(hh)}
                                    className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded transition cursor-pointer"
                                    title="View Full Household Information & Map"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onEditHousehold(hh)}
                                    className="p-1 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded transition cursor-pointer"
                                    title="Open / Edit Household Fill-up Form"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenReliefModal(hh)}
                                    className="p-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded transition cursor-pointer"
                                    title="Issue Relief"
                                  >
                                    <Package className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    id={`btn-delete-${hh.id}`}
                                    onClick={() => setHouseholdToDelete(hh)}
                                    className="p-1 bg-slate-100 hover:bg-red-100 text-slate-700 hover:text-red-700 rounded transition cursor-pointer"
                                    title="Delete Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right 4-Columns: Live Notifications + Metric Bento + Center Capacity + Crisis Tips */}
            <div className="lg:col-span-4 flex flex-col space-y-4">
              {/* High Density Metric Cards Bento */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Active Alerts */}
                <div
                  onClick={() => setStatusFilter(statusFilter === 'EMERGENCY' ? 'ALL' : 'EMERGENCY')}
                  title="Click to filter households that need to evacuate"
                  className={`p-3.5 rounded-xl border transition cursor-pointer shadow-xs ${
                    statusFilter === 'EMERGENCY'
                      ? 'bg-red-100/90 border-red-500 ring-2 ring-red-400'
                      : 'bg-white hover:bg-red-50/50 border-slate-200'
                  }`}
                >
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight flex items-center justify-between">
                    <span>Active Alerts</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  </p>
                  <p className="text-2xl font-black text-red-600 mt-0.5">{needEvacCount}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Requires Action • Click to filter</p>
                </div>

                {/* Moderate */}
                <div
                  onClick={() => setStatusFilter(statusFilter === 'MODERATE' ? 'ALL' : 'MODERATE')}
                  title="Click to filter households needing moderate help"
                  className={`p-3.5 rounded-xl border transition cursor-pointer shadow-xs ${
                    statusFilter === 'MODERATE'
                      ? 'bg-amber-100/90 border-amber-500 ring-2 ring-amber-400'
                      : 'bg-white hover:bg-amber-50/50 border-slate-200'
                  }`}
                >
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight flex items-center justify-between">
                    <span>Moderate</span>
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  </p>
                  <p className="text-2xl font-black text-amber-500 mt-0.5">{moderateCount}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Monitoring • Click to filter</p>
                </div>

                {/* Safe Households */}
                <div
                  onClick={() => setStatusFilter(statusFilter === 'SAFE' ? 'ALL' : 'SAFE')}
                  title="Click to filter safe households"
                  className={`p-3.5 rounded-xl border transition cursor-pointer shadow-xs ${
                    statusFilter === 'SAFE'
                      ? 'bg-emerald-100/90 border-emerald-500 ring-2 ring-emerald-400'
                      : 'bg-white hover:bg-emerald-50/50 border-slate-200'
                  }`}
                >
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Safe at Home</p>
                  <p className="text-2xl font-black text-emerald-600 mt-0.5">{safeCount}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{totalHouseholdsCount} Total Records • Filter</p>
                </div>

                {/* Total Population */}
                <div
                  onClick={() => setSpecialFilter(specialFilter === 'ANY' ? 'Senior' : 'ANY')}
                  title="Click to toggle vulnerable filter"
                  className="bg-white hover:bg-cyan-50/40 p-3.5 rounded-xl border border-slate-200 shadow-xs cursor-pointer transition"
                >
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Population</p>
                  <p className="text-2xl font-black text-cyan-600 mt-0.5">{totalPopulation}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{pwdAndSpecialCount} PWD/Senior/Infant</p>
                </div>
              </div>

              {/* Live Notifications Feed */}
              <div className="bg-white dark:bg-slate-900/90 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Live Incident Stream</span>
                    {barangayNotifications.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {barangayNotifications.length}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-clear-incident-stream"
                      onClick={onClearAllNotifications}
                      disabled={barangayNotifications.length === 0}
                      className="text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-800 transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:border-slate-200 flex items-center gap-1"
                      title={barangayNotifications.length === 0 ? 'No alerts to clear' : 'Clear all alerts in stream'}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                    {barangayNotifications.some((n) => n.type === 'emergency') ? (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" title="Active emergency alerts" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live stream connected" />
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                  {barangayNotifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No recent incoming alerts.
                    </div>
                  ) : (
                    barangayNotifications.slice(0, 4).map((n) => {
                      const isEmergency = n.type === 'emergency';
                      const isModerate = n.type === 'moderate';
                      const isSafe = n.type === 'safe';
                      const text = (n.title + ' ' + n.message).toLowerCase();
                      const targetHH = n.householdId ? households.find((h) => h.id === n.householdId) : undefined;

                      let category = 'DATA UPDATE';
                      let badgeClasses = 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
                      let cardClasses = 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-blue-500 hover:bg-blue-100/60 dark:hover:bg-blue-950/60';
                      let messageClasses = 'text-blue-950 dark:text-blue-100';
                      let dotColor = 'bg-blue-500';

                      if (isEmergency) {
                        if (text.includes('mandatory') || text.includes('order') || text.includes('directive') || !n.householdId) {
                          category = 'MANDATORY EVACUATION DIRECTIVE';
                        } else {
                          category = 'CRITICAL ALERT • NEED EVACUATE';
                        }
                        badgeClasses = 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 border-red-200 dark:border-red-800 animate-pulse';
                        cardClasses = 'bg-red-50/80 dark:bg-red-950/50 border-l-4 border-red-500 hover:bg-red-100/70 dark:hover:bg-red-950/70';
                        messageClasses = 'text-red-950 dark:text-red-100';
                        dotColor = 'bg-red-500';
                      } else if (isSafe) {
                        category = 'VERIFIED SAFE • AT HOME';
                        badgeClasses = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
                        cardClasses = 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-emerald-500 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60';
                        messageClasses = 'text-emerald-950 dark:text-emerald-100';
                        dotColor = 'bg-emerald-500';
                      } else if (isModerate) {
                        category = 'MODERATE ALERT • EVACUATED';
                        badgeClasses = 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
                        cardClasses = 'bg-amber-50/80 dark:bg-amber-950/40 border-l-4 border-amber-500 hover:bg-amber-100/70 dark:hover:bg-amber-950/60';
                        messageClasses = 'text-amber-950 dark:text-amber-100';
                        dotColor = 'bg-amber-500';
                      } else if (text.includes('relief') || text.includes('food pack') || text.includes('pack')) {
                        category = 'RELIEF GOODS DISPATCH';
                        badgeClasses = 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
                        cardClasses = 'bg-purple-50/70 dark:bg-purple-950/40 border-l-4 border-purple-500 hover:bg-purple-100/60 dark:hover:bg-purple-950/60';
                        messageClasses = 'text-purple-950 dark:text-purple-100';
                        dotColor = 'bg-purple-500';
                      } else if (text.includes('register') || text.includes('submission') || text.includes('new household')) {
                        category = 'NEW RESIDENT REGISTRATION';
                        badgeClasses = 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
                        cardClasses = 'bg-cyan-50/70 dark:bg-cyan-950/40 border-l-4 border-cyan-500 hover:bg-cyan-100/60 dark:hover:bg-cyan-950/60';
                        messageClasses = 'text-cyan-950 dark:text-cyan-100';
                        dotColor = 'bg-cyan-500';
                      } else if (text.includes('assigned') || text.includes('center') || text.includes('shelter')) {
                        category = 'EVACUATION SHELTER ASSIGNMENT';
                        badgeClasses = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
                        cardClasses = 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-500 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/60';
                        messageClasses = 'text-indigo-950 dark:text-indigo-100';
                        dotColor = 'bg-indigo-500';
                      }

                      // Dynamic relative time formatting with accurate local timezone correction
                      const { relativeTime, clockTime } = formatIncidentTime(n.timestamp);

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            onMarkNotificationRead(n.id);
                            if (n.householdId) {
                              const target = households.find((h) => h.id === n.householdId);
                              if (target) onSelectHouseholdDetails(target);
                            }
                          }}
                          className={`p-2.5 rounded-lg text-xs transition cursor-pointer shadow-2xs border ${cardClasses}`}
                          title={n.householdId ? 'Click to inspect household details' : 'Click to mark as read'}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${!n.read ? 'animate-ping' : ''}`} />
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 border ${badgeClasses}`}>
                                {category}
                              </span>
                              {targetHH && (
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
                                  {targetHH.purok}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <Clock className="w-2.5 h-2.5 opacity-60" />
                              <span className="font-semibold">{relativeTime}</span>
                              <span className="opacity-50 hidden sm:inline">({clockTime})</span>
                            </div>
                          </div>

                          <p className={`text-[11px] mt-1.5 font-medium leading-relaxed ${messageClasses}`}>
                            {n.message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Barangay DRRM Hotline & Command Dispatch Card */}
              <div className="bg-white rounded-xl shadow-xs border border-blue-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Brgy. {currentBarangay} DRRM Hotline</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowHotlineModal(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Hotline</span>
                  </button>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1.5">
                  <div className="text-[11px] text-blue-700 font-medium flex items-center justify-between">
                    <span>Active Emergency Line:</span>
                    <span className="text-[9px] bg-blue-200 text-blue-900 font-bold px-1.5 py-0.5 rounded">Live Dispatch</span>
                  </div>
                  <div className="font-mono font-black text-sm text-blue-950">
                    {activeHotline}
                  </div>
                  {activeBarangayConfig.evacuationLead && (
                    <div className="text-[10px] text-slate-600 pt-0.5">
                      DRRM Lead: <strong>{activeBarangayConfig.evacuationLead}</strong>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 italic pt-0.5">
                    Displayed live to residents on the Barangay {currentBarangay} registration page.
                  </div>
                </div>
              </div>

              {/* Center Capacity Tracking */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    <span>Shelter Capacities</span>
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenCentersModal}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Manage &rarr;
                  </button>
                </div>

                <div className="space-y-2.5">
                  {barangayCenters.map((center) => {
                    const liveAssigned = barangayHouseholds.filter((h) => h.evacuationCenterId === center.id).length;
                    const assigned = households.length > 0 ? liveAssigned : (center.assignedCount ?? 0);
                    const capacity = center.capacityFamilies;
                    const percent = capacity > 0 ? Math.min(100, Math.round((assigned / capacity) * 100)) : 0;
                    const isFull = capacity > 0 && assigned >= capacity;

                    return (
                      <div
                        key={center.id}
                        onClick={onOpenCentersModal}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800 truncate max-w-[160px]">{center.name}</span>
                          <span className="font-mono font-bold text-slate-600">
                            {assigned} / {capacity}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              assigned === 0 ? 'opacity-0' : 'opacity-100'
                            } ${
                              isFull ? 'bg-red-600' : percent > 60 ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${assigned === 0 ? 0 : Math.max(percent, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Crisis Protocols Dark Card */}
              <div className="bg-slate-900 rounded-xl p-4 text-white flex flex-col justify-between space-y-3 border border-slate-800">
                <div>
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Crisis Protocols & Directives</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Prioritize households tagged with Senior Citizens and PWDs for immediate evacuation transport.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onOpenPrintModal}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-[10px] font-bold uppercase tracking-wider transition border border-slate-700 text-center cursor-pointer"
                  >
                    Print Masterlist
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenReliefModal()}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded text-[10px] font-bold uppercase tracking-wider transition text-center cursor-pointer"
                  >
                    Issue Relief
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[300] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500/40 flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Share Citizen Registration Link Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Share Resident Registration Link
                  </h3>
                  <p className="text-xs text-slate-300">
                    Direct public access link for citizens & families
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Direct Link Box */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Public Resident Portal URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getCitizenUrl()}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 select-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(getCitizenUrl())}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-white" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <span>📱 Residents can open this link on their smartphones without needing an official password.</span>
                </p>
              </div>

              {/* Ready-made SMS / Viber Announcement Template */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    <span>SMS / Viber Announcement Template</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const template = `📢 BARANGAY DISASTER ADVISORY (${currentBarangay}):\nAll residents and household heads are requested to register and update their household safety and evacuation status online at:\n👉 ${getCitizenUrl()}\n\nPlease indicate senior citizens, PWDs, and children in your family so emergency teams can assist you promptly.`;
                      copyToClipboard(template, true);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedTemplate ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied text!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Text</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans select-none privacy-protected-data">
                  📢 <strong>BARANGAY DISASTER ADVISORY ({currentBarangay}):</strong><br />
                  All residents and household heads are requested to register and update their household safety and evacuation status online at:<br />
                  👉 <span className="font-mono text-emerald-700">{getCitizenUrl()}</span><br />
                  Please indicate senior citizens, PWDs, and children in your family so emergency teams can assist you promptly.
                </div>
              </div>

              {/* Data Flow Guarantee */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Automatic Real-Time Sync:</strong> Once a citizen submits the registration form, their data is instantly stored in the barangay database, their location is pinned on the hazard map, and an emergency audio chime will sound on this dashboard.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <a
                href="#/household/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Open Form in New Tab</span>
              </a>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {householdToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-red-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-700/80 flex items-center justify-center text-white">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Confirm Delete Record</h3>
                  <p className="text-[11px] text-red-100">Barangay Disaster Database Management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHouseholdToDelete(null)}
                className="w-7 h-7 rounded-lg bg-red-700/60 hover:bg-red-800 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete the household registration record for:
              </p>
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-black text-sm text-slate-900">{householdToDelete.headOfFamily}</div>
                <div className="text-xs text-slate-600 font-medium">
                  {householdToDelete.purok}, Barangay {householdToDelete.barangay}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded text-[10px] font-bold">
                    {householdToDelete.numberOfMembers} family members
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    householdToDelete.status === 'EMERGENCY'
                      ? 'bg-red-100 text-red-700'
                      : householdToDelete.status === 'MODERATE'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {householdToDelete.status}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                This will remove the household pin from the hazard map and purge the family from the active disaster masterlist.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setHouseholdToDelete(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-household"
                onClick={() => {
                  const name = householdToDelete.headOfFamily;
                  onDeleteHousehold(householdToDelete.id);
                  setHouseholdToDelete(null);
                  setToastMessage(`Record for "${name}" was permanently deleted.`);
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Record</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DRRM Hotline Configuration Modal */}
      {showHotlineModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Configure Barangay {currentBarangay} DRRM Hotline
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Update emergency contacts shown to registering residents
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHotlineModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveHotline} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
                  Primary Emergency Hotline *
                </label>
                <input
                  type="text"
                  required
                  value={hotlineInput}
                  onChange={(e) => setHotlineInput(e.target.value)}
                  placeholder="e.g. (052) 742-1088 / 0917-555-0101"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This number is prominently displayed on the citizen response form.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
                  DRRM Evacuation Lead / Officer Name
                </label>
                <input
                  type="text"
                  value={leadOfficerInput}
                  onChange={(e) => setLeadOfficerInput(e.target.value)}
                  placeholder="e.g. Barangay Captain Rolando Santos"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
                  Alternate Contact / Radio Frequency (Optional)
                </label>
                <input
                  type="text"
                  value={altHotlineInput}
                  onChange={(e) => setAltHotlineInput(e.target.value)}
                  placeholder="e.g. VHF 145.500 MHz / 0918-000-0000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHotlineModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Hotline Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
