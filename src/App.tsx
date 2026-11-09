import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertStatus,
  AppView,
  AuditLogEntry,
  BarangayConfig,
  BarangayName,
  EvacuationCenter,
  Household,
  HouseholdAccount,
  LogActionType,
  NotificationItem,
  OfficialAccount,
  ReliefDistribution,
} from './types';
import {
  BARANGAY_CONFIG,
  INITIAL_AUDIT_LOGS,
  INITIAL_CENTERS,
  INITIAL_HOUSEHOLDS,
  INITIAL_NOTIFICATIONS,
  INITIAL_RELIEF,
} from './data/initialData';
import { playNotificationSound } from './utils/audio';
import { buildAuditLog, normalizeLogId, normalizeLogTimestamp } from './utils/auditLogger';
import { BackendHealthResponse, laravelApi } from './utils/laravelApi';
import { ResidentLoginForm } from './components/ResidentLoginForm';
import { OfficialLoginForm } from './components/OfficialLoginForm';
import { BarangayDashboard } from './components/BarangayDashboard';
import { HouseholdDashboard } from './components/HouseholdDashboard';
import { HouseholdForm } from './components/HouseholdForm';
import { PrintMasterlistModal } from './components/PrintMasterlistModal';
import { CenterCapacityModal } from './components/CenterCapacityModal';
import { ReliefDistributionModal } from './components/ReliefDistributionModal';
import { HouseholdDetailsModal } from './components/HouseholdDetailsModal';
import { AccountsModal } from './components/AccountsModal';
import { ActivityLogsModal } from './components/ActivityLogsModal';
import { ResetPasswordView } from './components/ResetPasswordView';
import { CreateAccountModal } from './components/CreateAccountModal';
import { ManageAccountsModal } from './components/ManageAccountsModal';
import { Home } from 'lucide-react';

// STORAGE_KEYS removed – data now persisted via Laravel API (Supabase)

// Map URL hash or pathname to view
function getViewFromHash(hash: string): AppView {
  const hashClean = hash.replace(/^#\/?/, '').toLowerCase();
  const pathClean = (typeof window !== 'undefined' ? window.location.pathname.replace(/^\//, '') : '').toLowerCase();
  const clean = hashClean || pathClean;

  if (clean.startsWith('reset-password') || clean.startsWith('forgot-password')) {
    return 'reset-password';
  }
  if (clean.startsWith('official-login') || clean.startsWith('official/login') || clean.startsWith('admin-login')) {
    return 'official-login';
  }
  if (clean.startsWith('dashboard') || clean.startsWith('barangay') || clean.startsWith('admin')) {
    return 'barangay-dashboard';
  }
  if (clean.startsWith('resident-login') || clean.startsWith('citizen-login') || clean.startsWith('resident/login')) {
    return 'resident-login';
  }
  // Resident emergency status portal
  if (
    clean.startsWith('household/status') ||
    clean.startsWith('status') ||
    clean.startsWith('citizen/status') ||
    clean.startsWith('resident/status')
  ) {
    return 'household-dashboard';
  }
  if (clean.startsWith('login') || clean.startsWith('auth')) {
    return 'official-login';
  }
  // Household registration form (official access only)
  if (
    clean.startsWith('household/register') ||
    clean.startsWith('households/register') ||
    clean.startsWith('household/form') ||
    clean.startsWith('register') ||
    clean.startsWith('registration') ||
    clean === 'household' ||
    clean === 'households'
  ) {
    return 'household-form';
  }
  // Default to secure official login portal
  return 'official-login';
}

export default function App() {
  // Load state from localStorage or initial dataset with fallback seeding
  const [households, setHouseholds] = useState<Household[]>([]);

  const [centers, setCenters] = useState<EvacuationCenter[]>([]);

  const [reliefRecords, setReliefRecords] = useState<ReliefDistribution[]>([]);

  // Dynamic live notifications state (starts clean with zero static mock alerts; persisted per session)
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = sessionStorage.getItem('brgy_drrm_dynamic_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (n: NotificationItem) =>
              !n.householdName?.toLowerCase().includes('penduko') &&
              !n.message?.toLowerCase().includes('penduko') &&
              !n.message?.toLowerCase().includes('maria elena') &&
              !n.message?.toLowerCase().includes('juan dela cruz') &&
              !n.message?.toLowerCase().includes('danilo c. flores')
          );
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('brgy_drrm_dynamic_notifications', JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  const [barangayConfigs, setBarangayConfigs] = useState<Record<BarangayName, BarangayConfig>>(BARANGAY_CONFIG);

  const [currentBarangay, setCurrentBarangay] = useState<BarangayName>('Buang');

  // Live PostgreSQL + Laravel 11 Backend connectivity state
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  const [backendInfo, setBackendInfo] = useState<BackendHealthResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  // Official authentication state (session-persisted so legitimate officials can refresh and navigate)
  const [isOfficialLoggedIn, setIsOfficialLoggedIn] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('brgy_official_session_active') === 'true';
    } catch {
      return false;
    }
  });
  // Resident authentication state (session-persisted)
  const [isResidentLoggedIn, setIsResidentLoggedIn] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('brgy_resident_session_active') === 'true';
    } catch {
      return false;
    }
  });

  // Mutable refs to prevent stale closure race conditions on synchronous hashchange events
  const isOfficialLoggedInRef = useRef<boolean>(isOfficialLoggedIn);
  isOfficialLoggedInRef.current = isOfficialLoggedIn;

  const isResidentLoggedInRef = useRef<boolean>(isResidentLoggedIn);
  isResidentLoggedInRef.current = isResidentLoggedIn;

  // Unique browser tab identifier for cross-tab live synchronization
  const tabIdRef = useRef<string>(Math.random().toString(36).substring(2) + Date.now().toString(36));
  // Deduplication cache for cross-tab sync messages
  const processedSyncIdsRef = useRef<Set<string>>(new Set());
  // Synchronous in-memory deduplication cache for notifications to eliminate double-firing in StrictMode & multi-transport
  const recentNotifsRef = useRef<Map<string, number>>(new Map());
  // Tracks householdIds that were recently updated locally — polling must NOT override them for 8 seconds
  const recentlyUpdatedHouseholdsRef = useRef<Map<string, number>>(new Map());

  const [authSecurityNotice, setAuthSecurityNotice] = useState<string | null>(null);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<AppView | null>(null);

  // URL Hash routing with initial authentication gate
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const rawView = getViewFromHash(typeof window !== 'undefined' ? window.location.hash : '');
    const isInitiallyOfficialLoggedIn =
      typeof window !== 'undefined' && sessionStorage.getItem('brgy_official_session_active') === 'true';
    const isInitiallyResidentLoggedIn =
      typeof window !== 'undefined' && sessionStorage.getItem('brgy_resident_session_active') === 'true';

    // Route guard: Household registration and command dashboard require official authentication first
    if ((rawView === 'household-form' || rawView === 'barangay-dashboard') && !isInitiallyOfficialLoggedIn) {
      if (typeof window !== 'undefined' && window.location.hash !== '#/official-login') {
        window.location.hash = '#/official-login';
      }
      return 'official-login';
    }

    // Resident dashboard requires resident login
    if (rawView === 'household-dashboard' && !isInitiallyResidentLoggedIn) {
      if (typeof window !== 'undefined' && window.location.hash !== '#/resident-login') {
        window.location.hash = '#/resident-login';
      }
      return 'resident-login';
    }

    return rawView;
  });

  const [officialAccounts, setOfficialAccounts] = useState<Record<string, OfficialAccount>>({});

  const [currentOfficial, setCurrentOfficial] = useState<OfficialAccount>(() => {
    try {
      const saved = sessionStorage.getItem('brgy_official_session_account');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) return parsed;
      }
    } catch {
      // ignore
    }
    return {
      username: '',
      passwordHash: '',
      barangay: 'Buang',
      officialName: '',
      position: '',
      phone: '',
    };
  });
  const [recoveryUsername, setRecoveryUsername] = useState<string>('');
  const [activeHouseholdId, setActiveHouseholdId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('brgy_resident_session_id');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'hh-buang-1';
  });

  // Active household for resident dashboard
  const activeHousehold =
    households.find((h) => h.id === activeHouseholdId) || households[0] || INITIAL_HOUSEHOLDS[0];

  const assignedCenter = centers.find((c) => c.id === activeHousehold?.evacuationCenterId);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Global dark mode state (persisted across sessions)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('brgy_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

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

  // Household resident accounts loaded from backend database
  const [householdAccounts, setHouseholdAccounts] = useState<HouseholdAccount[]>([]);

  // Persistence of household accounts moved to backend; no localStorage sync here.

  // Modals state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCentersModal, setShowCentersModal] = useState(false);
  const [showReliefModal, setShowReliefModal] = useState(false);
  const [reliefPreSelectedHousehold, setReliefPreSelectedHousehold] = useState<Household | undefined>();
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [showManageAccountModal, setShowManageAccountModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedDetailsHousehold, setSelectedDetailsHousehold] = useState<Household | null>(null);
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);
  const [householdFormKey, setHouseholdFormKey] = useState(0);

  // Handle URL hash changes with strict route protection against bypassing login
  useEffect(() => {
    const handleHashChange = () => {
      const targetView = getViewFromHash(window.location.hash);
      const isOfficialAuth =
        isOfficialLoggedInRef.current ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('brgy_official_session_active') === 'true');
      const isResidentAuth =
        isResidentLoggedInRef.current ||
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('brgy_resident_session_active') === 'true');

      // Security Guard: Prevent URL bypass of official login
      if (targetView === 'household-form' && !isOfficialAuth) {
        setAuthSecurityNotice(
          '🔒 Authentication Required: You must log in as an authorized Barangay Official before accessing household registration.'
        );
        setRedirectAfterLogin('household-form');
        setCurrentView('official-login');
        if (window.location.hash !== '#/official-login') {
          window.location.hash = '#/official-login';
        }
        return;
      }

      if (targetView === 'barangay-dashboard' && !isOfficialAuth) {
        setAuthSecurityNotice('🔒 Authentication Required: Please log in to access the Barangay Command Center.');
        setRedirectAfterLogin('barangay-dashboard');
        setCurrentView('official-login');
        if (window.location.hash !== '#/official-login') {
          window.location.hash = '#/official-login';
        }
        return;
      }

      if (targetView === 'household-dashboard' && !isResidentAuth) {
        setCurrentView('resident-login');
        if (window.location.hash !== '#/resident-login') {
          window.location.hash = '#/resident-login';
        }
        return;
      }

      if (targetView === 'reset-password') {
        try {
          const savedRecovery = sessionStorage.getItem('brgy_recovery_username') || '';
          if (savedRecovery) {
            setRecoveryUsername(savedRecovery);
          }
        } catch {
          // ignore
        }
      }

      setCurrentView(targetView);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update hash when view changes
  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    const hashMap: Record<AppView, string> = {
      'household-form': '#/household/register',
      'barangay-dashboard': '#/barangay/dashboard',
      'household-dashboard': '#/household/status',
      login: '#/resident-login',
      'resident-login': '#/resident-login',
      'official-login': '#/official-login',
      'reset-password': '#/reset-password',
    };
    if (window.location.hash !== hashMap[view]) {
      window.location.hash = hashMap[view];
    }
  };

  // Clean legacy v1 localStorage items once on mount
  useEffect(() => {
    try {
      localStorage.removeItem('brgy_drrm_households_v1');
      localStorage.removeItem('brgy_drrm_centers_v1');
      localStorage.removeItem('brgy_drrm_relief_v1');
      localStorage.removeItem('brgy_drrm_notifications_v1');
      localStorage.removeItem('brgy_drrm_active_brgy_v1');
      localStorage.removeItem('brgy_drrm_audit_logs_v1');
    } catch (e) {
      console.warn('Storage cleanup error:', e);
    }
  }, []);


  // Official accounts now persisted via Laravel backend; localStorage sync removed

  // Households now persisted via Laravel backend; localStorage sync removed

  // Evacuation centers now persisted via Laravel backend; localStorage sync removed

  // Relief records now persisted via Laravel backend; localStorage sync removed

  // Notifications are transient UI state; persistence handled elsewhere if needed

  // Audit logs are stored in backend; localStorage sync removed

  // Active barangay state is managed in memory; no localStorage persistence required

  // Audit Log helper
  const addAuditLog = useCallback(
    ({
      actionType,
      actorName,
      actorRole,
      barangay,
      target,
      details,
    }: {
      actionType: LogActionType;
      actorName: string;
      actorRole: string;
      barangay: BarangayName;
      target: string;
      details: string;
    }) => {
      const entry = buildAuditLog({
        actionType,
        actorName,
        actorRole,
        barangay,
        target,
        details,
      });

      setAuditLogs((prev) => [entry, ...prev]);

      // Asynchronously sync with Laravel backend PostgreSQL database
      laravelApi
        .createActivityLog({
          actionType,
          actorName,
          actorRole,
          barangay,
          target,
          details,
        })
        .catch((err) => {
          console.warn('Backend activity log sync note:', err);
        });
    },
    []
  );

  // Recalculate Evacuation Center assigned counts whenever households change
  useEffect(() => {
    setCenters((prevCenters) =>
      prevCenters.map((center) => {
        const assigned = households.filter(
          (h) => h.barangay === center.barangay && h.evacuationCenterId === center.id
        ).length;
        return { ...center, assignedCount: assigned };
      })
    );
  }, [households]);

  // Notification helper with synchronous and stateful duplicate prevention
  const addNotification = useCallback(
    (
      title: string,
      message: string,
      barangay: BarangayName,
      type: 'emergency' | 'moderate' | 'safe' | 'info',
      householdId?: string,
      householdName?: string
    ) => {
      const now = Date.now();
      const trimmedMsg = message.trim();

      // 1. Synchronous Ref Deduplication (Instantly blocks React 18 StrictMode double runs and dual transports)
      // Key includes type so different status changes for same household are NOT blocked
      const primaryKey = householdId
        ? `hh_${householdId}_${type}`
        : `notif_${barangay}_${type}_${trimmedMsg}`;

      const lastFired = recentNotifsRef.current.get(primaryKey);
      if (lastFired && now - lastFired < 2500) {
        return;
      }

      // Track by message signature as well (2.5s window)
      const msgKey = householdId ? `hh_msg_${householdId}_${trimmedMsg}` : `msg_${barangay}_${trimmedMsg}`;
      const lastMsgFired = recentNotifsRef.current.get(msgKey);
      if (lastMsgFired && now - lastMsgFired < 2500) {
        return;
      }

      recentNotifsRef.current.set(primaryKey, now);
      recentNotifsRef.current.set(msgKey, now);

      // Keep cache small
      if (recentNotifsRef.current.size > 150) {
        const threshold = now - 30000;
        for (const [k, v] of recentNotifsRef.current.entries()) {
          if (v < threshold) recentNotifsRef.current.delete(k);
        }
      }

      let added = false;
      setNotifications((prev) => {
        // Prevent duplicate notification if identical notification already exists within the last 10 entries
        const recentSlice = prev.slice(0, 10);
        const alreadyExists = recentSlice.some((n) => {
          // Same household + same type + same message = true duplicate
          if (householdId && n.householdId === householdId && n.type === type && n.message.trim() === trimmedMsg) {
            return true;
          }
          // Same message + same type (broadcast-level dedup)
          if (!householdId && n.message.trim() === trimmedMsg && n.type === type) {
            return true;
          }
          return false;
        });

        if (alreadyExists) {
          return prev;
        }

        added = true;
        const newNotif: NotificationItem = {
          id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          title,
          message: trimmedMsg,
          barangay,
          type,
          timestamp: new Date().toISOString(),
          read: false,
          householdId,
          householdName,
        };

        // When a household updates status, replace any older notifications for this household
        // so that a single person never has duplicate or conflicting alerts (e.g. Critical Alert AND Safe at the same time)
        const cleanPrev = prev.filter((n) => {
          if (householdId && n.householdId === householdId) return false;
          if (householdName && n.householdName && n.householdName.toLowerCase().trim() === householdName.toLowerCase().trim()) return false;
          return true;
        });
        return [newNotif, ...cleanPrev];
      });

      if (soundEnabled) {
        playNotificationSound(type);
      }
    },
    [soundEnabled]
  );

  // Bidirectional Synchronization with Laravel 11 Backend & PostgreSQL
  const syncWithBackend = useCallback(
    async (silent = false, targetBarangay?: BarangayName) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setIsSyncing(true);
      try {
        const health = await laravelApi.checkHealth();
        if (health.connected) {
          setBackendStatus('connected');
          setBackendInfo(health);

          const activeBarangay = targetBarangay || currentBarangay;

          // Fetch latest households strictly scoped to active barangay jurisdiction (DPA / RA 10173)
          try {
            const remoteHouseholds = await laravelApi.getHouseholds({ barangay: activeBarangay });
            if (Array.isArray(remoteHouseholds)) {
              setHouseholds((prev) => {
                if (!prev || prev.length === 0) return remoteHouseholds;
                const now = Date.now();
                return remoteHouseholds.map((remoteH) => {
                  const recentTs = recentlyUpdatedHouseholdsRef.current.get(remoteH.id);
                  if (recentTs && now - recentTs < 20000) {
                    const localH = prev.find((h) => h.id === remoteH.id);
                    if (localH) {
                      return {
                        ...remoteH,
                        status: localH.status,
                        statusNote: localH.statusNote,
                        lastStatusUpdate: localH.lastStatusUpdate,
                        verificationStatus: localH.verificationStatus || remoteH.verificationStatus,
                      };
                    }
                  }
                  return remoteH;
                });
              });

              // Dynamically populate Live Incident Stream from active real households in database
              const activeIncidents = remoteHouseholds.filter(
                (h) => h.barangay === activeBarangay && (h.status === 'EMERGENCY' || h.status === 'MODERATE')
              );

              if (activeIncidents.length > 0) {
                setNotifications((prev) => {
                  const updated = [...prev];
                  activeIncidents.forEach((h) => {
                    const hasAlert = updated.some(
                      (n) => n.householdId === h.id || (n.householdName && n.householdName === h.headOfFamily)
                    );
                    if (!hasAlert) {
                      const isEmergency = h.status === 'EMERGENCY';
                      const dynamicTitle = isEmergency
                        ? `🚨 NEED EVACUATE Alert: ${h.headOfFamily}`
                        : `🏢 EVACUATED Status: ${h.headOfFamily}`;
                      const dynamicNote =
                        h.statusNote ||
                        (isEmergency ? 'Urgent evacuation assistance requested' : 'Evacuated to shelter / safe zone');
                      const dynamicMsg = `${h.headOfFamily} (${h.purok}, Brgy. ${h.barangay}): "${dynamicNote}"`;

                      updated.unshift({
                        id: `notif-dyn-${h.id}`,
                        title: dynamicTitle,
                        message: dynamicMsg,
                        barangay: h.barangay,
                        type: isEmergency ? 'emergency' : 'moderate',
                        timestamp: h.lastStatusUpdate || new Date().toISOString(),
                        read: false,
                        householdId: h.id,
                        householdName: h.headOfFamily,
                      });
                    }
                  });
                  return updated;
                });
              }
            }
          } catch (err) {
            console.warn('Failed to fetch remote households:', err);
          }

          // Fetch latest evacuation centers strictly scoped to active barangay jurisdiction
          try {
            const remoteCenters = await laravelApi.getEvacuationCenters(activeBarangay);
            if (Array.isArray(remoteCenters)) {
              setCenters(remoteCenters);
            }
          } catch (err) {
            console.warn('Failed to fetch remote centers:', err);
          }

          // Fetch relief records strictly scoped to active barangay jurisdiction
          try {
            const remoteRelief = await laravelApi.getReliefDistributions(activeBarangay);
            if (Array.isArray(remoteRelief)) {
              setReliefRecords(remoteRelief);
            }
          } catch (err) {
            console.warn('Failed to fetch remote relief:', err);
          }

          // Fetch activity logs strictly scoped to active barangay jurisdiction
          try {
            const remoteLogs = await laravelApi.getActivityLogs(activeBarangay);
            if (Array.isArray(remoteLogs)) {
              setAuditLogs(remoteLogs);
            }
          } catch (err) {
            console.warn('Failed to fetch remote logs:', err);
          }

          // Fetch registered officials for active barangay
          try {
            const remoteOfficials = await laravelApi.getOfficials(activeBarangay);
            if (Array.isArray(remoteOfficials) && remoteOfficials.length > 0) {
              setOfficialAccounts((prev) => {
                const updated = { ...prev };
                remoteOfficials.forEach((acc) => {
                  const key = `acc_${acc.username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                  updated[key] = acc;
                  if (acc.barangay === 'Buang' && !updated.Buang) updated.Buang = acc;
                  if (acc.barangay === 'Nagsipit' && !updated.Nagsipit) updated.Nagsipit = acc;
                });
                return updated;
              });
            }
          } catch (err) {
            console.warn('Failed to fetch remote officials:', err);
          }

          // Fetch registered household resident accounts for active barangay
          try {
            const remoteHouseholdAccounts = await laravelApi.getHouseholdAccounts(activeBarangay);
            if (Array.isArray(remoteHouseholdAccounts)) {
              setHouseholdAccounts(remoteHouseholdAccounts);
            }
          } catch (err) {
            console.warn('Failed to fetch remote household accounts:', err);
          }

          // Fetch barangay configurations from PostgreSQL
          try {
            const remoteConfigs = await laravelApi.getBarangayConfigs();
            if (remoteConfigs && typeof remoteConfigs === 'object' && Object.keys(remoteConfigs).length > 0) {
              setBarangayConfigs((prev) => ({
                ...prev,
                ...remoteConfigs,
              }));
            }
          } catch (err) {
            console.warn('Failed to fetch remote barangay configs:', err);
          }

          if (!silent) {
            addNotification(
              '🔗 Backend Database Synced',
              `Connected to PostgreSQL (Supabase). Master records for Barangay ${activeBarangay} synchronized.`,
              activeBarangay,
              'info'
            );
          }
        } else {
          setBackendStatus('offline');
          setBackendInfo(health);
        }
      } catch (err) {
        console.warn('Backend sync failed, running in offline cache mode:', err);
        setBackendStatus('offline');
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [addNotification, currentBarangay]
  );

  // Synchronize on initial mount and whenever active barangay jurisdiction changes
  useEffect(() => {
    syncWithBackend(true, currentBarangay);
  }, [currentBarangay, syncWithBackend]);

  // Handler for applying real-time status synchronization from resident actions across tabs / devices
  const applyHouseholdStatusSync = useCallback(
    (householdId: string, status: AlertStatus, note?: string) => {
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      let changedTarget: Household | null = null;

      // Protect this household from background polling overwrites across tabs
      recentlyUpdatedHouseholdsRef.current.set(householdId, Date.now());

      setHouseholds((prev) => {
        const target = prev.find((h) => h.id === householdId);
        if (!target) return prev;

        // Skip redundant update if already identical
        if (target.status === status && (note === undefined || target.statusNote === note)) {
          return prev;
        }

        changedTarget = target;
        const effectiveNote =
          note !== undefined
            ? note
            : status === 'SAFE'
            ? 'Safe at home • All clear'
            : status === 'EMERGENCY'
            ? 'Urgent evacuation assistance requested'
            : 'Evacuated to shelter / safe zone';

        const updated: Household = {
          ...target,
          status,
          statusNote: effectiveNote,
          lastStatusUpdate: nowIso,
        };

        return prev.map((h) => (h.id === householdId ? updated : h));
      });

      // Side effects (notifications & logs) executed ONCE outside setState
      if (changedTarget) {
        const target: Household = changedTarget;
        const typeMap = {
          EMERGENCY: 'emergency' as const,
          MODERATE: 'moderate' as const,
          SAFE: 'safe' as const,
        };

        const titleMap = {
          EMERGENCY: `🚨 NEED EVACUATE Alert: ${target.headOfFamily}`,
          MODERATE: `🏢 EVACUATED Status: ${target.headOfFamily}`,
          SAFE: `✅ Safe at Home Status: ${target.headOfFamily}`,
        };

        const effectiveNote =
          note !== undefined
            ? note
            : status === 'SAFE'
            ? 'Safe at home • All clear'
            : status === 'EMERGENCY'
            ? 'Urgent evacuation assistance requested'
            : 'Evacuated to shelter / safe zone';

        const msg = `${target.headOfFamily} (${target.purok}, Brgy. ${target.barangay}): "${effectiveNote}"`;

        addNotification(titleMap[status], msg, target.barangay, typeMap[status], target.id, target.headOfFamily);

        addAuditLog({
          actionType: 'STATUS_CHANGE',
          actorName: target.headOfFamily,
          actorRole: 'Resident (Self-Reported)',
          barangay: target.barangay,
          target: `Household #${target.id} (${target.headOfFamily})`,
          details: `Live resident self-report: alert status updated to "${status}". Note: ${note || 'Status updated via citizen portal.'}`,
        });
      }
    },
    [addNotification, addAuditLog]
  );

  // Handler for applying mass broadcast updates across tabs
  const applyBroadcastStatusSync = useCallback(
    (barangay: BarangayName, status: AlertStatus, note: string) => {
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const nowMs = Date.now();

      setHouseholds((prev) =>
        prev.map((h) => {
          if (h.barangay.toLowerCase() === barangay.toLowerCase()) {
            recentlyUpdatedHouseholdsRef.current.set(h.id, nowMs);
            return {
              ...h,
              status,
              statusNote: note,
              lastStatusUpdate: nowIso,
            };
          }
          return h;
        })
      );

      if (status === 'EMERGENCY') {
        addNotification(
          '🚨 MANDATORY EVACUATION ORDER ISSUED',
          `Command Center issued an official "Need evacuate" alert to all residents in Barangay ${barangay}. Emergency teams deployed.`,
          barangay,
          'emergency'
        );
      } else {
        addNotification(
          '✅ ALL HOUSEHOLDS MARKED SAFE',
          `All-clear status recorded for all households in Barangay ${barangay}.`,
          barangay,
          'safe'
        );
      }
    },
    [addNotification]
  );

  // Cross-tab real-time sync listeners (BroadcastChannel + Storage event with deduplication)
  useEffect(() => {
    const handleSyncMessage = (data: any) => {
      if (!data || data.sourceTabId === tabIdRef.current) return;

      // Deduplicate sync messages that arrive via both BroadcastChannel and Storage
      if (data.syncId) {
        if (processedSyncIdsRef.current.has(data.syncId)) return;
        processedSyncIdsRef.current.add(data.syncId);
        if (processedSyncIdsRef.current.size > 200) {
          const first = processedSyncIdsRef.current.values().next().value;
          if (first) processedSyncIdsRef.current.delete(first);
        }
      }

      if (data.type === 'HOUSEHOLD_STATUS_UPDATED') {
        applyHouseholdStatusSync(data.householdId, data.status, data.note);
      } else if (data.type === 'BROADCAST_STATUS_UPDATED') {
        applyBroadcastStatusSync(data.barangay, data.status, data.note);
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('brgy_status_live_sync');
        bc.onmessage = (event) => {
          handleSyncMessage(event.data);
        };
      }
    } catch {
      // ignore
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'brgy_status_live_sync' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          handleSyncMessage(data);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyHouseholdStatusSync, applyBroadcastStatusSync]);

  // Periodic background polling to sync live resident statuses from the PostgreSQL database
  useEffect(() => {
    if (currentView !== 'barangay-dashboard' && currentView !== 'household-dashboard') return;

    const interval = setInterval(async () => {
      if (isSyncingRef.current) return;
      try {
        const remoteHouseholds = await laravelApi.getHouseholds({ barangay: currentBarangay });
        if (Array.isArray(remoteHouseholds) && remoteHouseholds.length > 0) {
          const changedList: Household[] = [];
          const now = Date.now();

          // Clean up stale "recently updated" entries (older than 20s)
          for (const [id, ts] of recentlyUpdatedHouseholdsRef.current.entries()) {
            if (now - ts > 20000) recentlyUpdatedHouseholdsRef.current.delete(id);
          }

          setHouseholds((prev) => {
            let hasChanged = false;
            const updated = prev.map((localH) => {
              const remoteH = remoteHouseholds.find((rh) => rh.id === localH.id);

              // GUARD: If this household was updated locally/sync within the last 20s,
              // do NOT let stale backend data overwrite the local change.
              if (recentlyUpdatedHouseholdsRef.current.has(localH.id)) {
                return localH;
              }

              if (remoteH && remoteH.status !== localH.status) {
                hasChanged = true;
                changedList.push(remoteH);
                return { ...localH, ...remoteH };
              }
              // Only merge non-status fields from remote — preserve local status
              return remoteH ? { ...localH, ...remoteH, status: localH.status } : localH;
            });

            return hasChanged ? updated : prev;
          });

          // Trigger notifications once outside setState (only for barangay command dashboard)
          // and only for households that were NOT recently updated locally
          if (currentView === 'barangay-dashboard') {
            for (const remoteH of changedList) {
              if (recentlyUpdatedHouseholdsRef.current.has(remoteH.id)) {
                continue;
              }
              const statusTitle =
                remoteH.status === 'EMERGENCY'
                  ? `🚨 NEED EVACUATE Alert: ${remoteH.headOfFamily}`
                  : remoteH.status === 'MODERATE'
                  ? `🏢 EVACUATED Status: ${remoteH.headOfFamily}`
                  : `✅ Safe at Home Status: ${remoteH.headOfFamily}`;

              const typeMap = {
                EMERGENCY: 'emergency' as const,
                MODERATE: 'moderate' as const,
                SAFE: 'safe' as const,
              };

              const noteText = remoteH.statusNote
                ? `${remoteH.headOfFamily} (${remoteH.purok}, Brgy. ${remoteH.barangay}): "${remoteH.statusNote}"`
                : `${remoteH.headOfFamily} updated status to ${remoteH.status} (${remoteH.purok}, Brgy. ${remoteH.barangay})`;

              addNotification(
                statusTitle,
                noteText,
                remoteH.barangay,
                typeMap[remoteH.status],
                remoteH.id,
                remoteH.headOfFamily
              );
            }
          }
        }
      } catch {
        // Silent fail on minor network hiccup during polling
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [currentView, currentBarangay, addNotification]);

  // Handlers for Official Login
  const handleOfficialLogin = (account: OfficialAccount) => {
    isOfficialLoggedInRef.current = true;
    setIsOfficialLoggedIn(true);
    try {
      sessionStorage.setItem('brgy_official_session_active', 'true');
      sessionStorage.setItem('brgy_official_session_account', JSON.stringify(account));
      sessionStorage.setItem('brgy_last_active_time', Date.now().toString());
    } catch (e) {
      console.warn('Session save error:', e);
    }
    setCurrentOfficial(account);
    setCurrentBarangay(account.barangay);
    setAuthSecurityNotice(null);

    addAuditLog({
      actionType: 'LOGIN',
      actorName: account.officialName,
      actorRole: account.position,
      barangay: account.barangay,
      target: 'Official Command Session',
      details: `Official authenticated into Barangay ${account.barangay} command console.`,
    });

    if (redirectAfterLogin === 'household-form') {
      setRedirectAfterLogin(null);
      navigateTo('household-form');
    } else {
      setRedirectAfterLogin(null);
      navigateTo('barangay-dashboard');
    }
    if (soundEnabled) playNotificationSound('info');
  };

  // Official Logout Handler
  const handleOfficialLogout = useCallback(
    (isAutoLogout = false) => {
      isOfficialLoggedInRef.current = false;
      setIsOfficialLoggedIn(false);
      try {
        sessionStorage.removeItem('brgy_official_session_active');
        sessionStorage.removeItem('brgy_official_session_account');
        sessionStorage.removeItem('brgy_last_active_time');
      } catch {
        // ignore
      }
      setRedirectAfterLogin(null);
      setShowAccountsModal(false);
      setShowCreateAccountModal(false);
      setShowManageAccountModal(false);
      setShowLogsModal(false);
      setShowPrintModal(false);
      setShowCentersModal(false);
      setShowReliefModal(false);
      setSelectedDetailsHousehold(null);
      setEditingHousehold(null);

      if (isAutoLogout) {
        setAuthSecurityNotice(
          '⏱️ Session Expired: You were automatically logged out due to 15 minutes of inactivity to protect official data.'
        );
        addAuditLog({
          actionType: 'LOGOUT',
          actorName: currentOfficial.officialName || 'Barangay Official',
          actorRole: currentOfficial.position || 'Official',
          barangay: currentBarangay,
          target: 'Official Command Session',
          details: `Official session automatically logged out after 15 minutes of system inactivity.`,
        });
        if (soundEnabled) playNotificationSound('moderate');
      } else {
        setAuthSecurityNotice(null);
        addAuditLog({
          actionType: 'LOGOUT',
          actorName: currentOfficial.officialName,
          actorRole: currentOfficial.position,
          barangay: currentBarangay,
          target: 'Official Command Session',
          details: `Official logged out of Barangay ${currentBarangay} console.`,
        });
      }
      navigateTo('official-login');
    },
    [currentOfficial, currentBarangay, soundEnabled, addAuditLog]
  );

  // Resident Logout Handler
  const handleResidentLogout = useCallback((_isAutoLogout = false) => {
    isResidentLoggedInRef.current = false;
    setIsResidentLoggedIn(false);
    try {
      sessionStorage.removeItem('brgy_resident_session_active');
      sessionStorage.removeItem('brgy_resident_session_id');
      sessionStorage.removeItem('brgy_last_active_time');
    } catch {
      // ignore
    }
    navigateTo('resident-login');
  }, []);

  // 15-minute system inactivity auto-logout (15 minutes = 900,000 ms)
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isOfficialLoggedIn && !isResidentLoggedIn) {
      return;
    }

    lastActivityRef.current = Date.now();
    try {
      sessionStorage.setItem('brgy_last_active_time', Date.now().toString());
    } catch {
      // ignore
    }

    let lastThrottle = 0;
    const recordUserActivity = () => {
      const now = Date.now();
      // Throttle recording to once every 2 seconds to avoid CPU overhead
      if (now - lastThrottle > 2000) {
        lastThrottle = now;
        lastActivityRef.current = now;
        try {
          sessionStorage.setItem('brgy_last_active_time', now.toString());
        } catch {
          // ignore
        }
      }
    };

    const checkInactivityTimeout = () => {
      const now = Date.now();
      let lastActive = lastActivityRef.current;
      try {
        const stored = sessionStorage.getItem('brgy_last_active_time');
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed > lastActive) {
            lastActive = parsed;
            lastActivityRef.current = parsed;
          }
        }
      } catch {
        // ignore
      }

      if (now - lastActive >= INACTIVITY_TIMEOUT_MS) {
        if (isOfficialLoggedInRef.current) {
          handleOfficialLogout(true);
        } else if (isResidentLoggedInRef.current) {
          handleResidentLogout(true);
        }
      }
    };

    const events: (keyof WindowEventMap)[] = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, recordUserActivity, { passive: true });
    });

    // Check periodically every 10 seconds
    const timerId = window.setInterval(checkInactivityTimeout, 10000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivityTimeout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, recordUserActivity);
      });
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isOfficialLoggedIn, isResidentLoggedIn, handleOfficialLogout, handleResidentLogout]);

  // Handlers for Password Reset via Security Questions
  const handleResetOfficialPassword = (username: string, newPassword: string) => {
    const cleanUser = username.trim().toLowerCase();
    const accountEntry = (Object.entries(officialAccounts) as [string, OfficialAccount][]).find(
      ([_, acc]) =>
        acc.username.toLowerCase() === cleanUser ||
        acc.barangay.toLowerCase() === cleanUser ||
        cleanUser.includes(acc.barangay.toLowerCase())
    );
    const account: OfficialAccount = accountEntry
      ? accountEntry[1]
      : {
          username: username.trim(),
          passwordHash: '',
          barangay: currentBarangay,
          officialName: 'Barangay Official',
          position: 'DRRM Officer',
          phone: '',
        };

    const brgyKey = accountEntry ? accountEntry[0] : `acc_${cleanUser.replace(/[^a-z0-9]/g, '_')}`;
    const updatedAccount: OfficialAccount = {
      ...account,
      passwordHash: newPassword,
    };

    const updatedAccounts: Record<string, OfficialAccount> = {
      ...officialAccounts,
      [brgyKey]: updatedAccount,
    };

    setOfficialAccounts(updatedAccounts);
    try {
      // Updated official accounts persisted via backend; no localStorage sync.
    } catch (e) {
      console.warn('Storage save error:', e);
    }

    // Immediately grant console access
    isOfficialLoggedInRef.current = true;
    setIsOfficialLoggedIn(true);
    try {
      sessionStorage.setItem('brgy_official_session_active', 'true');
      sessionStorage.setItem('brgy_official_session_account', JSON.stringify(updatedAccount));
    } catch (e) {
      console.warn('Session save error:', e);
    }
    setCurrentOfficial(updatedAccount);
    setCurrentBarangay(account.barangay);
    setAuthSecurityNotice(null);

    addAuditLog({
      actionType: 'PASSWORD_RESET',
      actorName: account.officialName,
      actorRole: account.position,
      barangay: account.barangay,
      target: `Official Credentials (${account.username})`,
      details: `Password securely updated via 2-step verification. Immediate console access granted.`,
    });

    addNotification(
      '🔐 Password Reset Successful',
      `Official credentials for ${account.username} were updated in backend database. Access unlocked.`,
      account.barangay,
      'info'
    );

    if (redirectAfterLogin === 'household-form') {
      setRedirectAfterLogin(null);
      navigateTo('household-form');
    } else {
      setRedirectAfterLogin(null);
      navigateTo('barangay-dashboard');
    }
    if (soundEnabled) playNotificationSound('info');
  };

    // Create new official account for current barangay
  const handleCreateOfficialAccount = (newAccount: OfficialAccount) => {
    const primaryHeadUsername = (officialAccounts[currentBarangay]?.username || '').toLowerCase();
    const isCurrentOfficialPrimary =
      (primaryHeadUsername && currentOfficial.username.toLowerCase() === primaryHeadUsername) ||
      currentOfficial.position.toLowerCase().includes('punong barangay') ||
      currentOfficial.position.toLowerCase().includes('chief');

    if (!isCurrentOfficialPrimary) {
      addNotification(
        '⚠️ Access Denied',
        'Only the Primary DRRM Head has administrative authorization to create official accounts.',
        currentBarangay,
        'emergency'
      );
      return;
    }

    const accountKey = `acc_${newAccount.username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const updatedAccounts: Record<string, OfficialAccount> = {
      ...officialAccounts,
      [accountKey]: newAccount,
    };

    // Persist to backend first
    (async () => {
      try {
        await laravelApi.createOfficialAccount({
          username: newAccount.username,
          password: newAccount.passwordHash,
          barangay: newAccount.barangay,
          officialName: newAccount.officialName,
          position: newAccount.position,
          phone: newAccount.phone,
          email: newAccount.email,
        });
        // Backend succeeded – update UI state
        setOfficialAccounts(updatedAccounts);
        addAuditLog({
          actionType: 'CREATE',
          actorName: currentOfficial.officialName,
          actorRole: currentOfficial.position,
          barangay: newAccount.barangay,
          target: `Official Account (${newAccount.username})`,
          details: `Created new official command staff account for ${newAccount.officialName} (${newAccount.position}) in Barangay ${newAccount.barangay}.`,
        });
        addNotification(
          '👤 New Official Account Created',
          `Account "${newAccount.username}" created for ${newAccount.officialName} in Barangay ${newAccount.barangay}.`,
          newAccount.barangay,
          'info'
        );
        if (soundEnabled) playNotificationSound('info');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        addNotification(
          '⚠️ Official Account Creation Failed',
          message,
          currentBarangay,
          'emergency'
        );
        console.warn('Backend official account creation error:', err);
      }
    })();
  };

  // Update registered official account (profile, password, security questions)
  const handleUpdateOfficialAccount = (accountKey: string, updatedAccount: OfficialAccount) => {
    const primaryHeadUsername = (officialAccounts[currentBarangay]?.username || '').toLowerCase();
    const isCurrentOfficialPrimary =
      (primaryHeadUsername && currentOfficial.username.toLowerCase() === primaryHeadUsername) ||
      currentOfficial.position.toLowerCase().includes('punong barangay') ||
      currentOfficial.position.toLowerCase().includes('chief');

    // Non-primary personnel can ONLY update their own personal account
    if (!isCurrentOfficialPrimary && currentOfficial.username.toLowerCase() !== updatedAccount.username.toLowerCase()) {
      addNotification(
        '⚠️ Access Denied',
        'Only the Primary DRRM Head has administrative authority to modify other official accounts.',
        currentBarangay,
        'emergency'
      );
      return;
    }

    const updatedAccounts: Record<string, OfficialAccount> = {
      ...officialAccounts,
      [accountKey]: updatedAccount,
    };
    if (officialAccounts[updatedAccount.barangay]?.username.toLowerCase() === updatedAccount.username.toLowerCase()) {
      updatedAccounts[updatedAccount.barangay] = updatedAccount;
    }

    setOfficialAccounts(updatedAccounts);
    try {
      // Updated official accounts persisted via backend; no localStorage sync.
    } catch (e) {
      console.warn('Storage save error:', e);
    }

    // If currently logged in as this account, keep session in sync
    if (currentOfficial.username.toLowerCase() === updatedAccount.username.toLowerCase()) {
      setCurrentOfficial(updatedAccount);
    }

    const previousAccount = officialAccounts[accountKey];
    const isExplicitPasswordChange = Boolean(
      updatedAccount.passwordHash &&
      updatedAccount.passwordHash.trim().length >= 6 &&
      updatedAccount.passwordHash !== '••••••••'
    );
    const isPasswordChange =
      isExplicitPasswordChange ||
      (previousAccount && previousAccount.passwordHash && previousAccount.passwordHash !== updatedAccount.passwordHash);

    addAuditLog({
      actionType: isPasswordChange ? 'PASSWORD_RESET' : 'EDIT',
      actorName: currentOfficial.officialName,
      actorRole: currentOfficial.position,
      barangay: updatedAccount.barangay,
      target: `Official Account (@${updatedAccount.username})`,
      details: isPasswordChange
        ? `Security credential / password updated for @${updatedAccount.username} (${updatedAccount.officialName}).`
        : `Profile details updated for ${updatedAccount.officialName} (${updatedAccount.position}).`,
    });

    if (soundEnabled) playNotificationSound('info');

    // Automatically persist official account updates to PostgreSQL database
    laravelApi
      .updateOfficialAccount(
        updatedAccount.username,
        {
          officialName: updatedAccount.officialName,
          position: updatedAccount.position,
          phone: updatedAccount.phone,
          email: updatedAccount.email,
          password: isExplicitPasswordChange ? updatedAccount.passwordHash : undefined,
        },
        {
          name: currentOfficial?.officialName,
          role: currentOfficial?.position,
        }
      )
      .catch((err) => {
        console.warn('Backend official account update note:', err);
      });
  };

  // Delete registered official account
  const handleDeleteOfficialAccount = (accountKey: string, username: string) => {
    const primaryHeadUsername = (officialAccounts[currentBarangay]?.username || '').toLowerCase();
    const isCurrentOfficialPrimary =
      (primaryHeadUsername && currentOfficial.username.toLowerCase() === primaryHeadUsername) ||
      currentOfficial.position.toLowerCase().includes('punong barangay') ||
      currentOfficial.position.toLowerCase().includes('chief');

    if (!isCurrentOfficialPrimary) {
      addNotification(
        '⚠️ Access Denied',
        'Only the Primary DRRM Head has administrative authority to delete registered official accounts.',
        currentBarangay,
        'emergency'
      );
      return;
    }

    if (accountKey === 'Buang' || accountKey === 'Nagsipit') {
      return; // Protect primary accounts
    }

    const targetAccount = officialAccounts[accountKey];
    const { [accountKey]: removed, ...rest } = officialAccounts;

    setOfficialAccounts(rest);
    try {
      // Official accounts update persisted via backend; no localStorage sync.
    } catch (e) {
      console.warn('Storage save error:', e);
    }

    addAuditLog({
      actionType: 'DELETE',
      actorName: currentOfficial.officialName,
      actorRole: currentOfficial.position,
      barangay: currentBarangay,
      target: `Official Account (@${username})`,
      details: `Permanently removed registered account @${username} (${targetAccount?.officialName || 'Staff'}) from Barangay ${currentBarangay}.`,
    });

    addNotification(
      '🗑️ Official Account Removed',
      `Registered account @${username} was removed from Barangay ${currentBarangay}.`,
      currentBarangay,
      'info'
    );

    if (soundEnabled) playNotificationSound('info');

    // Automatically persist deletion to PostgreSQL database
    laravelApi
      .deleteOfficialAccount(username, {
        name: currentOfficial?.officialName,
        role: currentOfficial?.position,
      })
      .catch((err) => {
        console.warn('Backend official account deletion note:', err);
      });
  };

  // Handlers for Household Portal
  const handleHouseholdLogin = (householdId: string) => {
    setActiveHouseholdId(householdId);
    try {
      sessionStorage.setItem('brgy_resident_session_active', 'true');
      sessionStorage.setItem('brgy_resident_session_id', householdId);
    } catch (e) {
      console.warn('Resident session save error:', e);
    }
    const hh = households.find((h) => h.id === householdId);
    if (hh) {
      setCurrentBarangay(hh.barangay);
      isResidentLoggedInRef.current = true;
      setIsResidentLoggedIn(true);
      addAuditLog({
        actionType: 'LOGIN',
        actorName: hh.headOfFamily,
        actorRole: 'Resident / Household Head',
        barangay: hh.barangay,
        target: `Household #${hh.id}`,
        details: `Resident logged in to Citizen Emergency Status Portal from ${hh.purok}.`,
      });
    }
    navigateTo('household-dashboard');
    if (soundEnabled) playNotificationSound('info');
  };

  // Handle Household Status Update
  const handleUpdateHouseholdStatus = (householdId: string, status: AlertStatus, note?: string) => {
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let targetHousehold: Household | undefined;

    // Immediately protect this household from polling overwrites for the next 10 seconds
    recentlyUpdatedHouseholdsRef.current.set(householdId, Date.now());

    const effectiveNote =
      note !== undefined
        ? note
        : status === 'SAFE'
        ? 'Safe at home • All clear'
        : status === 'EMERGENCY'
        ? 'Urgent evacuation assistance requested'
        : 'Evacuated to shelter / safe zone';

    setHouseholds((prev) => {
      const target = prev.find((h) => h.id === householdId);
      if (!target) return prev;
      targetHousehold = target;

      const updated: Household = {
        ...target,
        status,
        statusNote: effectiveNote,
        lastStatusUpdate: nowIso,
        ...(status === 'SAFE' ? { verificationStatus: 'Verified' as const } : {}),
      };

      return prev.map((h) => (h.id === householdId ? updated : h));
    });

    const hh = targetHousehold || households.find((h) => h.id === householdId);
    if (hh) {
      const typeMap = {
        EMERGENCY: 'emergency' as const,
        MODERATE: 'moderate' as const,
        SAFE: 'safe' as const,
      };
      const titleMap = {
        EMERGENCY: `🚨 NEED EVACUATE Alert: ${hh.headOfFamily}`,
        MODERATE: `🏢 EVACUATED Status: ${hh.headOfFamily}`,
        SAFE: `✅ Safe at Home Status: ${hh.headOfFamily}`,
      };
      const msg = `${hh.headOfFamily} (${hh.purok}, Brgy. ${hh.barangay}): "${effectiveNote}"`;

      // Trigger notification and audit log ONCE outside setState to prevent StrictMode doubling
      addNotification(titleMap[status], msg, hh.barangay, typeMap[status], hh.id, hh.headOfFamily);

      addAuditLog({
        actionType: 'STATUS_CHANGE',
        actorName: currentOfficial ? currentOfficial.officialName : hh.headOfFamily,
        actorRole: currentOfficial ? currentOfficial.position : 'Resident (Self-Reported)',
        barangay: hh.barangay,
        target: `Household #${hh.id} (${hh.headOfFamily})`,
        details: `Alert status updated to "${status}" in ${hh.purok}. Note: ${effectiveNote}`,
      });
    }

    // 1. Instant cross-tab BroadcastChannel sync to Barangay Dashboard with unique syncId
    const syncId = `sync_${householdId}_${status}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    processedSyncIdsRef.current.add(syncId);

    const syncData = {
      syncId,
      type: 'HOUSEHOLD_STATUS_UPDATED',
      householdId,
      status,
      note: effectiveNote,
      sourceTabId: tabIdRef.current,
      timestamp: Date.now(),
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('brgy_status_live_sync');
        bc.postMessage(syncData);
        bc.close();
      }
    } catch {
      // ignore
    }

    // 2. Cross-tab storage event fallback (fires in all other open tabs/windows)
    try {
      localStorage.setItem('brgy_status_live_sync', JSON.stringify(syncData));
    } catch {
      // ignore
    }

    // 3. Asynchronously synchronize status update with Laravel backend database
    const targetHH = hh || households.find((h) => h.id === householdId);
    laravelApi
      .updateHouseholdStatus(
        householdId,
        status,
        effectiveNote,
        targetHH?.evacuationCenterId,
        {
          name: currentOfficial ? currentOfficial.officialName : (targetHH?.headOfFamily || 'Resident'),
          role: currentOfficial ? currentOfficial.position : 'Resident (Self-Reported)',
        },
        status === 'SAFE' ? 'Verified' : undefined
      )
      .then((savedHH) => {
        if (savedHH) {
          recentlyUpdatedHouseholdsRef.current.set(savedHH.id, Date.now());
          setHouseholds((prev) =>
            prev.map((h) => {
              if (h.id === savedHH.id) {
                // Keep the locally updated status and note to guarantee no revert race condition
                return {
                  ...h,
                  ...savedHH,
                  status: h.status,
                  statusNote: h.statusNote,
                  verificationStatus: h.verificationStatus || savedHH.verificationStatus,
                };
              }
              return h;
            })
          );
        }
      })
      .catch((err) => {
        console.warn('Backend household status sync note:', err);
      });
  };

  // Directive: Broadcast Need Evacuate to all households in current barangay
  const handleBroadcastMustEvacuate = () => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const nowMs = Date.now();

    // Protect all households in active barangay from polling overwrites
    setHouseholds((prev) => {
      const updated = prev.map((h) => {
        if (h.barangay.toLowerCase() === currentBarangay.toLowerCase()) {
          recentlyUpdatedHouseholdsRef.current.set(h.id, nowMs);
          return {
            ...h,
            status: 'EMERGENCY' as AlertStatus,
            statusNote: '🚨 Need evacuate: Immediate evacuation directive issued by Barangay DRRM Command',
            lastStatusUpdate: now,
          };
        }
        return h;
      });

      return updated;
    });

    // Broadcast across open tabs with deduplication ID
    const syncId = `broadcast_${currentBarangay}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    processedSyncIdsRef.current.add(syncId);

    const broadcastData = {
      syncId,
      type: 'BROADCAST_STATUS_UPDATED',
      barangay: currentBarangay,
      status: 'EMERGENCY' as AlertStatus,
      note: '🚨 Need evacuate: Immediate evacuation directive issued by Barangay DRRM Command',
      sourceTabId: tabIdRef.current,
      timestamp: Date.now(),
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('brgy_status_live_sync');
        bc.postMessage(broadcastData);
        bc.close();
      }
      localStorage.setItem('brgy_status_live_sync', JSON.stringify(broadcastData));
    } catch {
      // ignore
    }

    addAuditLog({
      actionType: 'STATUS_CHANGE',
      actorName: currentOfficial ? currentOfficial.officialName : 'DRRM Operations Head',
      actorRole: currentOfficial ? currentOfficial.position : 'Command Center',
      barangay: currentBarangay,
      target: `All Residents of Barangay ${currentBarangay}`,
      details: `Command Center clicked "Need evacuate" button. All household records set to NEED EVACUATE directive.`,
    });

    addNotification(
      '🚨 MANDATORY EVACUATION ORDER ISSUED',
      `Command Center issued an official "Need evacuate" alert to all residents in Barangay ${currentBarangay}. Emergency teams deployed.`,
      currentBarangay,
      'emergency'
    );

    // Asynchronously broadcast to Laravel backend
    laravelApi
      .broadcastStatus(
        currentBarangay,
        'EMERGENCY',
        '🚨 Need evacuate: Immediate evacuation directive issued by Barangay DRRM Command',
        {
          name: currentOfficial ? currentOfficial.officialName : 'DRRM Operations Head',
          role: currentOfficial ? currentOfficial.position : 'Command Center',
        }
      )
      .catch((err) => {
        console.warn('Backend broadcast status sync note:', err);
      });

    if (soundEnabled) playNotificationSound('emergency');
  };

  // Directive: Mark all household directory records as Safe
  const handleSafeAllHouseholds = () => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const nowMs = Date.now();

    setHouseholds((prev) => {
      const updated = prev.map((h) => {
        if (h.barangay.toLowerCase() === currentBarangay.toLowerCase()) {
          recentlyUpdatedHouseholdsRef.current.set(h.id, nowMs);
          return {
            ...h,
            status: 'SAFE' as AlertStatus,
            statusNote: 'All Clear: Marked Safe by Barangay DRRM Official',
            verificationStatus: 'Verified' as const,
            lastStatusUpdate: now,
          };
        }
        return h;
      });

      return updated;
    });

    // Broadcast across open tabs with deduplication ID
    const syncId = `broadcast_safe_${currentBarangay}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    processedSyncIdsRef.current.add(syncId);

    const safeBroadcastData = {
      syncId,
      type: 'BROADCAST_STATUS_UPDATED',
      barangay: currentBarangay,
      status: 'SAFE' as AlertStatus,
      note: 'All Clear: Marked Safe by Barangay DRRM Official',
      sourceTabId: tabIdRef.current,
      timestamp: Date.now(),
    };

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('brgy_status_live_sync');
        bc.postMessage(safeBroadcastData);
        bc.close();
      }
      localStorage.setItem('brgy_status_live_sync', JSON.stringify(safeBroadcastData));
    } catch {
      // ignore
    }

    addAuditLog({
      actionType: 'STATUS_CHANGE',
      actorName: currentOfficial ? currentOfficial.officialName : 'DRRM Operations Head',
      actorRole: currentOfficial ? currentOfficial.position : 'Command Center',
      barangay: currentBarangay,
      target: `All Household Directory Records (Barangay ${currentBarangay})`,
      details: `Command Center issued an "All Safe" directive. All household directory records in Barangay ${currentBarangay} set to Safe.`,
    });

    addNotification(
      '✅ ALL HOUSEHOLDS MARKED SAFE',
      `All-clear status recorded for all households in Barangay ${currentBarangay}.`,
      currentBarangay,
      'safe'
    );

    // Asynchronously broadcast all clear to Laravel backend
    laravelApi
      .broadcastStatus(
        currentBarangay,
        'SAFE',
        'All Clear: Marked Safe by Barangay DRRM Official',
        {
          name: currentOfficial ? currentOfficial.officialName : 'DRRM Operations Head',
          role: currentOfficial ? currentOfficial.position : 'Command Center',
        }
      )
      .catch((err) => {
        console.warn('Backend safe broadcast sync note:', err);
      });

    if (soundEnabled) playNotificationSound('info');
  };

  // Handle Assigning Center
  const handleAssignCenter = (householdId: string, centerId: string | undefined) => {
    setHouseholds((prev) =>
      prev.map((h) => {
        if (h.id === householdId) {
          const center = centers.find((c) => c.id === centerId);
          if (centerId && center) {
            addNotification(
              `🏢 Evacuation Center Assigned`,
              `${h.headOfFamily} assigned to ${center.name} (${center.purok})`,
              h.barangay,
              'info',
              h.id,
              h.headOfFamily
            );

            addAuditLog({
              actionType: 'CENTER_ASSIGNED',
              actorName: currentOfficial.officialName,
              actorRole: currentOfficial.position,
              barangay: h.barangay,
              target: `Household #${h.id} (${h.headOfFamily})`,
              details: `Assigned designated shelter: "${center.name}" (${center.purok}, Brgy. ${center.barangay}).`,
            });
          }
          return { ...h, evacuationCenterId: centerId };
        }
        return h;
      })
    );

    if (selectedDetailsHousehold && selectedDetailsHousehold.id === householdId) {
      setSelectedDetailsHousehold((prev) => (prev ? { ...prev, evacuationCenterId: centerId } : null));
    }

    // Asynchronously sync center assignment with Laravel backend
    if (centerId) {
      laravelApi
        .assignHouseholdToCenter(centerId, householdId, {
          name: currentOfficial?.officialName,
          role: currentOfficial?.position,
        })
        .catch((err) => {
          console.warn('Backend center assignment sync note:', err);
        });
    } else {
      laravelApi
        .updateHouseholdStatus(householdId, 'SAFE', undefined, '', {
          name: currentOfficial?.officialName,
          role: currentOfficial?.position,
        })
        .catch((err) => {
          console.warn('Backend center unassign sync note:', err);
        });
    }
  };

  // Toggle Verification
  const handleToggleVerification = (householdId: string) => {
    setHouseholds((prev) =>
      prev.map((h) => {
        if (h.id === householdId) {
          const nextStatus = h.verificationStatus === 'Verified' ? 'Pending' : 'Verified';

          addAuditLog({
            actionType: 'VERIFICATION_TOGGLE',
            actorName: currentOfficial.officialName,
            actorRole: currentOfficial.position,
            barangay: h.barangay,
            target: `Household #${h.id} (${h.headOfFamily})`,
            details: `Changed verification status to "${nextStatus}".`,
          });

          // Sync verification status to Laravel API
          laravelApi
            .updateHousehold(h.id, { verificationStatus: nextStatus }, {
              name: currentOfficial?.officialName,
              role: currentOfficial?.position,
            })
            .catch((err) => {
              console.warn('Backend verification sync note:', err);
            });

          return { ...h, verificationStatus: nextStatus };
        }
        return h;
      })
    );

    if (selectedDetailsHousehold && selectedDetailsHousehold.id === householdId) {
      setSelectedDetailsHousehold((prev) =>
        prev
          ? {
              ...prev,
              verificationStatus: prev.verificationStatus === 'Verified' ? 'Pending' : 'Verified',
            }
          : null
      );
    }
  };

  // Delete Household Record
  const handleDeleteHousehold = (householdId: string) => {
    const targetHH = households.find((h) => h.id === householdId);
    if (targetHH) {
      addAuditLog({
        actionType: 'DELETE',
        actorName: currentOfficial.officialName,
        actorRole: currentOfficial.position,
        barangay: targetHH.barangay,
        target: `Household #${targetHH.id} (${targetHH.headOfFamily})`,
        details: `Deleted household registration from database (${targetHH.purok}, ${targetHH.numberOfMembers} family members).`,
      });

      // Asynchronously delete household in Laravel backend
      laravelApi
        .deleteHousehold(householdId, {
          name: currentOfficial?.officialName,
          role: currentOfficial?.position,
        })
        .catch((err) => {
          console.warn('Backend household deletion note:', err);
        });
    }

    setHouseholds((prev) => prev.filter((h) => h.id !== householdId));
    if (selectedDetailsHousehold?.id === householdId) {
      setSelectedDetailsHousehold(null);
    }
  };

  // Save or Create Household from Form (Submitted directly to Barangay Command Center database)
  const handleSaveHousehold = (householdData: Household) => {
    // Protect newly registered/updated household from polling race conditions
    recentlyUpdatedHouseholdsRef.current.set(householdData.id, Date.now());

    const existingIndex = households.findIndex((h) => h.id === householdData.id);
    let updatedList: Household[];
    const isEdit = existingIndex >= 0;

    if (isEdit) {
      updatedList = [...households];
      updatedList[existingIndex] = householdData;
    } else {
      // Check if duplicate household already exists
      const isDuplicate = households.some(
        (h) =>
          h.id !== householdData.id &&
          h.barangay === householdData.barangay &&
          h.headOfFamily.trim().toLowerCase() === householdData.headOfFamily.trim().toLowerCase() &&
          (h.contactNumber.trim() === householdData.contactNumber.trim() ||
           h.completeAddress.trim().toLowerCase() === householdData.completeAddress.trim().toLowerCase())
      );
      if (isDuplicate) {
        updatedList = households.map((h) =>
          h.barangay === householdData.barangay &&
          h.headOfFamily.trim().toLowerCase() === householdData.headOfFamily.trim().toLowerCase()
            ? { ...householdData, id: h.id }
            : h
        );
      } else {
        updatedList = [householdData, ...households];
      }
    }

    const notifType =
      householdData.status === 'EMERGENCY'
        ? 'emergency'
        : householdData.status === 'MODERATE'
        ? 'moderate'
        : 'safe';

    const notifTitle =
      householdData.status === 'EMERGENCY'
        ? `🚨 EMERGENCY EVACUATION: ${householdData.headOfFamily}`
        : householdData.status === 'MODERATE'
        ? `⚠️ MODERATE ALERT REPORT: ${householdData.headOfFamily}`
        : `🏠 New Household Registered: ${householdData.headOfFamily}`;

    addNotification(
      notifTitle,
      `New submission from ${householdData.purok}, Brgy. ${householdData.barangay} (${householdData.numberOfMembers} members). Status: ${householdData.status}`,
      householdData.barangay,
      notifType,
      householdData.id,
      householdData.headOfFamily
    );

    addAuditLog({
      actionType: isEdit ? 'EDIT' : 'CREATE',
      actorName: currentOfficial ? currentOfficial.officialName : householdData.headOfFamily,
      actorRole: currentOfficial ? currentOfficial.position : 'Resident Registrant',
      barangay: householdData.barangay,
      target: `Household #${householdData.id} (${householdData.headOfFamily})`,
      details: isEdit
        ? `Updated household masterlist entry (${householdData.numberOfMembers} members, ${householdData.purok}, Status: ${householdData.status}).`
        : `Created new masterlist profile for ${householdData.headOfFamily} with ${householdData.numberOfMembers} members in ${householdData.purok}.`,
    });

    // Asynchronously save/update to Laravel PostgreSQL backend
    if (isEdit) {
      laravelApi
        .updateHousehold(householdData.id, householdData, {
          name: currentOfficial ? currentOfficial.officialName : householdData.headOfFamily,
          role: currentOfficial ? currentOfficial.position : 'Resident Registrant',
        })
        .catch((err) => {
          console.warn('Backend household update note:', err);
        });
    } else {
      laravelApi
        .createHousehold(householdData, {
          name: currentOfficial ? currentOfficial.officialName : householdData.headOfFamily,
          role: currentOfficial ? currentOfficial.position : 'Resident Registrant',
        })
        .catch((err) => {
          console.warn('Backend household creation note:', err);
        });
    }

    setHouseholds(updatedList);
    setActiveHouseholdId(householdData.id);
    setCurrentBarangay(householdData.barangay);
  };

  // Handle Resident Account Creation (WITHOUT Auto-Login: saves data and redirects to household/register)
  const handleCreateHouseholdAccount = async (savedHH: Household, account: HouseholdAccount) => {
    // 1. Save household to masterlist
    handleSaveHousehold(savedHH);

    // 2. Persist account to Laravel backend & PostgreSQL database
    let resolvedAccount: HouseholdAccount = account;
    try {
      const created = await laravelApi.createHouseholdAccount({
        email: account.email,
        password: account.passwordHash,
        householdId: savedHH.id,
        headOfFamily: savedHH.headOfFamily,
        barangay: savedHH.barangay,
        contactNumber: savedHH.contactNumber,
      });
      if (created) resolvedAccount = created;
    } catch (err) {
      console.warn('Backend household account creation sync note:', err);
    }

    // 3. Add account to registered household accounts state
    setHouseholdAccounts((prev) => {
      const filtered = prev.filter((a) => a.email !== resolvedAccount.email && a.householdId !== resolvedAccount.householdId);
      const updated = [resolvedAccount, ...filtered];
      try {
        // Household accounts update persisted via backend; no localStorage sync.
      } catch (e) {
        console.warn('Storage save error:', e);
      }
      return updated;
    });

    // 3. Record audit logs for account creation
    addAuditLog({
      actionType: 'CREATE',
      actorName: isOfficialLoggedIn ? currentOfficial.officialName : savedHH.headOfFamily,
      actorRole: isOfficialLoggedIn ? 'Barangay Official' : 'Resident Registrant',
      barangay: savedHH.barangay,
      target: `Household #${savedHH.id} (${account.email})`,
      details: `Created new resident account with password protection for ${savedHH.headOfFamily} in ${savedHH.purok}, Brgy. ${savedHH.barangay}.`,
    });

    // 4. Notify & play sound
    addNotification(
      `🎉 Household Account Created!`,
      `Resident account for ${savedHH.headOfFamily} (${account.email}) has been created successfully.`,
      savedHH.barangay,
      'safe',
      savedHH.id,
      savedHH.headOfFamily
    );

    if (soundEnabled) playNotificationSound('safe');

    // 5. DO NOT AUTO-LOGIN! Keep isResidentLoggedIn as false.
    // Preserve official login if official is active, and redirect back to household /register with blank form.
    setEditingHousehold(null);
    setHouseholdFormKey((prev) => prev + 1);
    navigateTo('household-form');
  };

  // Add Evacuation Center
  const handleSaveCenter = (newCenter: EvacuationCenter) => {
    setCenters((prev) => [...prev, newCenter]);
    addNotification(
      `🏢 New Evacuation Center Added`,
      `${newCenter.name} (${newCenter.capacityFamilies} capacity) opened in Brgy. ${newCenter.barangay}`,
      newCenter.barangay,
      'info'
    );

    addAuditLog({
      actionType: 'CREATE',
      actorName: currentOfficial.officialName,
      actorRole: currentOfficial.position,
      barangay: newCenter.barangay,
      target: `Evacuation Center: ${newCenter.name}`,
      details: `Added new designated evacuation facility in ${newCenter.purok} with capacity of ${newCenter.capacityFamilies} families.`,
    });

    // Automatically save new evacuation center to PostgreSQL database
    laravelApi
      .createEvacuationCenter(newCenter, {
        name: currentOfficial?.officialName,
        role: currentOfficial?.position,
      })
      .catch((err) => {
        console.warn('Backend evacuation center creation note:', err);
      });
  };

  // Delete Evacuation Center
  const handleDeleteCenter = (centerId: string) => {
    const centerToDelete = centers.find((c) => c.id === centerId);
    if (!centerToDelete) return;

    // Safety check: protect default Barangay Hall
    if (centerToDelete.name.trim().toLowerCase() === 'barangay hall') {
      return;
    }

    // Unassign any households assigned to this center
    setHouseholds((prev) =>
      prev.map((h) =>
        h.evacuationCenterId === centerId
          ? { ...h, evacuationCenterId: undefined }
          : h
      )
    );

    setCenters((prev) => prev.filter((c) => c.id !== centerId));

    addNotification(
      `🏢 Evacuation Center Removed`,
      `${centerToDelete.name} was removed from Brgy. ${centerToDelete.barangay}`,
      centerToDelete.barangay,
      'info'
    );

    addAuditLog({
      actionType: 'DELETE',
      actorName: currentOfficial.officialName,
      actorRole: currentOfficial.position,
      barangay: centerToDelete.barangay,
      target: `Evacuation Center: ${centerToDelete.name}`,
      details: `Deleted evacuation center in ${centerToDelete.purok}. Any assigned households were released to unassigned status.`,
    });

    // Automatically delete evacuation center from PostgreSQL database
    laravelApi
      .deleteEvacuationCenter(centerId, {
        name: currentOfficial?.officialName,
        role: currentOfficial?.position,
      })
      .catch((err) => {
        console.warn('Backend evacuation center deletion note:', err);
      });
  };

  // Add Relief Record
  const handleAddRelief = (relief: ReliefDistribution) => {
    setReliefRecords((prev) => [relief, ...prev]);
    addNotification(
      `📦 Relief Pack Distributed`,
      `Issued "${relief.item}" to ${relief.recipientName} at ${relief.location}`,
      relief.barangay,
      'info'
    );

    addAuditLog({
      actionType: 'RELIEF_DISTRIBUTED',
      actorName: relief.officerName || currentOfficial.officialName,
      actorRole: currentOfficial.position,
      barangay: relief.barangay,
      target: `Recipient: ${relief.recipientName}`,
      details: `Distributed ${relief.qty} of "${relief.item}" at ${relief.location} (${relief.purok}).`,
    });

    // Asynchronously sync relief distribution to Laravel backend
    laravelApi
      .createReliefDistribution({
        householdId: relief.householdId,
        item: relief.item,
        qty: relief.qty,
        location: relief.location,
        officerName: relief.officerName || (currentOfficial ? currentOfficial.officialName : 'Relief Operations Officer'),
        notes: relief.notes,
      })
      .catch((err) => {
        console.warn('Backend relief distribution sync note:', err);
      });
  };

  // Update Barangay Config (Hotline, Lead Officer, etc.)
  const handleUpdateBarangayConfig = (brgy: BarangayName, updates: Partial<BarangayConfig>) => {
    setBarangayConfigs((prev) => {
      const updated = {
        ...prev,
        [brgy]: {
          ...prev[brgy],
          ...updates,
        },
      };
      return updated;
    });

    if (updates.hotline) {
      addNotification(
        `📞 DRRM Hotline Updated`,
        `Barangay ${brgy} updated emergency dispatch line to ${updates.hotline}`,
        brgy,
        'info'
      );
    }

    addAuditLog({
      actionType: 'HOTLINE_UPDATE',
      actorName: currentOfficial ? currentOfficial.officialName : 'DRRM Admin',
      actorRole: currentOfficial ? currentOfficial.position : 'DRRM Official',
      barangay: brgy,
      target: `Brgy. ${brgy} DRRM Configuration`,
      details: `Updated Barangay ${brgy} hotline config: ${JSON.stringify(updates)}`,
    });

    // Automatically persist config updates to PostgreSQL database
    laravelApi
      .updateBarangayConfig(brgy, updates, {
        name: currentOfficial ? currentOfficial.officialName : undefined,
        role: currentOfficial ? currentOfficial.position : undefined,
      })
      .catch((err) => {
        console.warn('Backend barangay config update note:', err);
      });
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-200 ${isDarkMode ? 'dark bg-[#080c14] text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {currentView === 'reset-password' && (
          <ResetPasswordView
            initialUsername={recoveryUsername}
            officialAccounts={officialAccounts}
            onResetSuccess={handleResetOfficialPassword}
            onBackToLogin={() => navigateTo('official-login')}
          />
        )}

        {currentView === 'barangay-dashboard' && (
          isOfficialLoggedIn ? (
            <BarangayDashboard
              currentBarangay={currentBarangay}
              officialAccount={currentOfficial}
              backendStatus={backendStatus}
              backendInfo={backendInfo}
              onSyncBackend={() => syncWithBackend(false)}
              isSyncing={isSyncing}
              households={households}
              centers={centers}
              reliefRecords={reliefRecords}
              notifications={notifications}
              barangayConfigs={barangayConfigs}
              onUpdateBarangayConfig={handleUpdateBarangayConfig}
              logsCount={auditLogs.filter((l) => l.barangay === currentBarangay && !l.read).length}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
              onSwitchBarangay={(brgy) => {
                setCurrentBarangay(brgy);
                setCurrentOfficial(officialAccounts[brgy]);
              }}
              onUpdateHouseholdStatus={handleUpdateHouseholdStatus}
              onAssignCenter={handleAssignCenter}
              onToggleVerification={handleToggleVerification}
              onDeleteHousehold={handleDeleteHousehold}
              onAddNewHousehold={() => {
                setEditingHousehold(null);
                navigateTo('household-form');
              }}
              onBroadcastMustEvacuate={handleBroadcastMustEvacuate}
              onSafeAllHouseholds={handleSafeAllHouseholds}
              onEditHousehold={(hh) => {
                setEditingHousehold(hh);
                navigateTo('household-form');
              }}
              onSelectHouseholdDetails={(hh) => setSelectedDetailsHousehold(hh)}
              onOpenPrintModal={() => setShowPrintModal(true)}
              onOpenCentersModal={() => setShowCentersModal(true)}
              onOpenReliefModal={(hh) => {
                setReliefPreSelectedHousehold(hh);
                setShowReliefModal(true);
              }}
              onOpenAccountsModal={() => setShowAccountsModal(true)}
              onOpenLogsModal={() => setShowLogsModal(true)}
              onOpenCreateAccountModal={() => setShowCreateAccountModal(true)}
              onOpenManageAccountModal={() => setShowManageAccountModal(true)}
              onMarkNotificationRead={(id) => {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, read: true } : n))
                );
              }}
              onMarkAllNotificationsRead={() => {
                setNotifications((prev) =>
                  prev.map((n) =>
                    n.barangay === currentBarangay ? { ...n, read: true } : n
                  )
                );
              }}
              onClearAllNotifications={() => {
                setNotifications((prev) =>
                  prev.filter((n) => n.barangay !== currentBarangay)
                );
              }}
              onLogout={() => handleOfficialLogout(false)}
            />
          ) : (
            <OfficialLoginForm
              initialBarangay={currentBarangay}
              officialAccounts={officialAccounts}
              onLoginOfficial={handleOfficialLogin}
              securityNotice={authSecurityNotice}
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
              onLockoutTriggered={(attemptedUser) => {
                addAuditLog({
                  actionType: 'SECURITY_ALERT',
                  actorName: attemptedUser || 'Unknown User',
                  actorRole: 'Unauthorized Attacker',
                  barangay: currentBarangay,
                  target: 'Official Login Command Portal',
                  details: `Brute force protection triggered: 5 consecutive failed login attempts resulted in a 10-minute security lockout.`,
                });
              }}
            />
          )
        )}

        {currentView === 'official-login' && (
          <OfficialLoginForm
            initialBarangay={currentBarangay}
            officialAccounts={officialAccounts}
            onLoginOfficial={handleOfficialLogin}
            securityNotice={authSecurityNotice}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
            onLockoutTriggered={(attemptedUser) => {
              addAuditLog({
                actionType: 'SECURITY_ALERT',
                actorName: attemptedUser || 'Unknown User',
                actorRole: 'Unauthorized Attacker',
                barangay: currentBarangay,
                target: 'Official Login Command Portal',
                details: `Brute force protection triggered: 5 consecutive failed login attempts resulted in a 10-minute security lockout.`,
              });
            }}
          />
        )}

        {(currentView === 'resident-login' || currentView === 'login') && (
          <ResidentLoginForm
            householdAccounts={householdAccounts}
            onLoginHousehold={handleHouseholdLogin}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
            onNavigateToRegister={() => {
              setEditingHousehold(null);
              navigateTo('household-form');
            }}
            onLockoutTriggered={(attemptedEmail) => {
              addAuditLog({
                actionType: 'SECURITY_ALERT',
                actorName: attemptedEmail || 'Resident User',
                actorRole: 'Unauthorized Access Attempt',
                barangay: currentBarangay,
                target: 'Resident Portal Login',
                details: `Brute force protection triggered: 5 consecutive failed login attempts resulted in a 10-minute security lockout.`,
              });
            }}
          />
        )}

        {currentView === 'household-dashboard' &&
          (activeHousehold ? (
            <HouseholdDashboard
              household={activeHousehold}
              assignedCenter={assignedCenter}
              allCenters={centers}
              onUpdateStatus={handleUpdateHouseholdStatus}
              onLogout={() => handleResidentLogout(false)}
            />
          ) : (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
              <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-6 text-center border border-slate-800">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Home className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-1">No Household Record Found</h2>
                <p className="text-xs text-slate-500 mb-4">
                  There are currently no registered household profiles in the database. Please register your household to access the citizen status portal.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHousehold(null);
                      navigateTo('household-form');
                    }}
                    className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    + Register Household
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('resident-login')}
                    className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Back to Portal
                  </button>
                </div>
              </div>
            </div>
          ))}

        {currentView === 'household-form' && (
          !isOfficialLoggedIn ? (
            <OfficialLoginForm
              initialBarangay={currentBarangay}
              officialAccounts={officialAccounts}
              onLoginOfficial={handleOfficialLogin}
              securityNotice={
                authSecurityNotice ||
                '🔒 Authentication Required: You must log in as an authorized Barangay Official before accessing household registration.'
              }
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
              onLockoutTriggered={(attemptedUser) => {
                addAuditLog({
                  actionType: 'SECURITY_ALERT',
                  actorName: attemptedUser || 'Unknown User',
                  actorRole: 'Unauthorized Attacker',
                  barangay: currentBarangay,
                  target: 'Official Login Command Portal',
                  details: `Brute force protection triggered: 5 consecutive failed login attempts resulted in a 10-minute security lockout.`,
                });
              }}
            />
          ) : (
            <HouseholdForm
              key={householdFormKey}
              initialHousehold={editingHousehold}
              defaultBarangay={currentBarangay}
              barangayConfigs={barangayConfigs}
              centers={centers}
              existingHouseholds={households}
              isOfficialLoggedIn={isOfficialLoggedIn}
              isResidentLoggedIn={isResidentLoggedIn}
              onSave={(savedHH) => {
                handleSaveHousehold(savedHH);
              }}
              onAccountCreated={(savedHH, account) => {
                handleCreateHouseholdAccount(savedHH, account);
              }}
              onCancel={() => {
                setEditingHousehold(null);
                navigateTo('barangay-dashboard');
              }}
              onLogout={() => handleOfficialLogout(false)}
              onSwitchToOfficial={() => navigateTo('official-login')}
            />
          )
        )}
      </main>

      {/* Modals */}
      {showPrintModal && (
        <PrintMasterlistModal
          barangay={currentBarangay}
          households={households.filter((h) => h.barangay === currentBarangay)}
          centers={centers.filter((c) => c.barangay === currentBarangay)}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {showCentersModal && (
        <CenterCapacityModal
          barangay={currentBarangay}
          centers={centers.filter((c) => c.barangay === currentBarangay)}
          households={households.filter((h) => h.barangay === currentBarangay)}
          onSaveCenter={handleSaveCenter}
          onDeleteCenter={handleDeleteCenter}
          onAssignHouseholdCenter={handleAssignCenter}
          onClose={() => setShowCentersModal(false)}
        />
      )}

      {showReliefModal && (
        <ReliefDistributionModal
          barangay={currentBarangay}
          households={households.filter((h) => h.barangay === currentBarangay)}
          reliefRecords={reliefRecords.filter((r) => r.barangay === currentBarangay)}
          onAddRelief={handleAddRelief}
          onClose={() => {
            setShowReliefModal(false);
            setReliefPreSelectedHousehold(undefined);
          }}
          preSelectedHousehold={reliefPreSelectedHousehold}
        />
      )}

      {showAccountsModal && (
        <AccountsModal
          currentBarangay={currentBarangay}
          officialAccounts={officialAccounts}
          onSwitchBarangay={(brgy) => {
            setCurrentBarangay(brgy);
            if (officialAccounts[brgy]) {
              setCurrentOfficial(officialAccounts[brgy]);
            }
          }}
          onOpenCreateAccount={
            currentOfficial.position.toLowerCase().includes('punong barangay') ||
            currentOfficial.position.toLowerCase().includes('chief')
              ? () => setShowCreateAccountModal(true)
              : undefined
          }
          onOpenManageAccount={() => setShowManageAccountModal(true)}
          onClose={() => setShowAccountsModal(false)}
        />
      )}

      {showCreateAccountModal && (
        <CreateAccountModal
          isOpen={showCreateAccountModal}
          onClose={() => setShowCreateAccountModal(false)}
          currentBarangay={currentBarangay}
          currentOfficial={currentOfficial}
          existingAccounts={Array.from(new Map(Object.values(officialAccounts).map((a) => [(a.username || '').toLowerCase(), a])).values())}
          onCreateAccount={handleCreateOfficialAccount}
        />
      )}

      {showManageAccountModal && (
        <ManageAccountsModal
          isOpen={showManageAccountModal}
          onClose={() => setShowManageAccountModal(false)}
          currentBarangay={currentBarangay}
          currentOfficial={currentOfficial}
          allOfficialAccounts={officialAccounts}
          onUpdateAccount={handleUpdateOfficialAccount}
          onDeleteAccount={handleDeleteOfficialAccount}
          onOpenCreateAccount={() => setShowCreateAccountModal(true)}
        />
      )}

      {showLogsModal && (
        <ActivityLogsModal
          currentBarangay={currentBarangay}
          logs={auditLogs.filter((l) => l.barangay === currentBarangay)}
          onClose={() => setShowLogsModal(false)}
          onClearLogs={() =>
            setAuditLogs((prev) => prev.filter((l) => l.barangay !== currentBarangay))
          }
          onMarkAllAsRead={() => {
            setAuditLogs((prev) =>
              prev.map((l) =>
                l.barangay === currentBarangay ? { ...l, read: true } : l
              )
            );
          }}
          onMarkLogAsRead={(id) => {
            setAuditLogs((prev) =>
              prev.map((l) => (l.id === id ? { ...l, read: true } : l))
            );
          }}
        />
      )}

      {selectedDetailsHousehold && (
        <HouseholdDetailsModal
          household={selectedDetailsHousehold}
          centers={centers.filter((c) => c.barangay === selectedDetailsHousehold.barangay)}
          onClose={() => setSelectedDetailsHousehold(null)}
          onUpdateStatus={handleUpdateHouseholdStatus}
          onAssignCenter={handleAssignCenter}
          onToggleVerification={handleToggleVerification}
          onEditHousehold={(hh) => {
            setSelectedDetailsHousehold(null);
            setEditingHousehold(hh);
            navigateTo('household-form');
          }}
          onOpenRelief={(hh) => {
            setSelectedDetailsHousehold(null);
            setReliefPreSelectedHousehold(hh);
            setShowReliefModal(true);
          }}
        />
      )}
    </div>
  );
}
