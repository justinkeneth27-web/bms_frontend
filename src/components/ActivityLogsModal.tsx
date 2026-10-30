import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Shield,
  Search,
  Clock,
  Briefcase,
  AlertTriangle,
  UserCheck,
  Trash2,
  Edit3,
  PlusCircle,
  LogIn,
  LogOut,
  Package,
  Home,
  Printer,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Calendar,
  Layers,
  Flame,
  Radio,
  SlidersHorizontal,
  KeyRound,
  PhoneCall,
  User,
  Activity,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Building2,
  FileText,
  Maximize2,
  Minimize2,
  CheckCheck,
  Eye,
} from 'lucide-react';
import { AuditLogEntry, BarangayName, LogActionType } from '../types';
import { normalizeLogId, normalizeLogTimestamp } from '../utils/auditLogger';

export type LogScopeChoice = 'Barangay' | 'Resident';
export type SeverityLevel = 'ALL' | 'CRITICAL' | 'IMPORTANT' | 'ROUTINE' | 'INFO';

interface ActivityLogsModalProps {
  currentBarangay: BarangayName;
  logs: AuditLogEntry[];
  onClose: () => void;
  onClearLogs?: () => void;
  onMarkAllAsRead?: () => void;
  onMarkLogAsRead?: (id: string) => void;
}

// Classify log strictly into one of the 2 choices: "Barangay" or "Resident"
export const getLogScope = (log: AuditLogEntry): LogScopeChoice => {
  const role = (log.actorRole || '').toLowerCase();
  const name = (log.actorName || '').toLowerCase();
  const target = (log.target || '').toLowerCase();
  const details = (log.details || '').toLowerCase();

  // Explicit Resident signals:
  if (
    role.includes('resident') ||
    role.includes('household head') ||
    role.includes('citizen') ||
    role.includes('registrant') ||
    target.includes('resident portal') ||
    target.includes('citizen emergency status') ||
    details.includes('resident logged in') ||
    details.includes('citizen emergency status portal') ||
    details.includes('created new resident account')
  ) {
    return 'Resident';
  }

  // Official / Administrative Barangay signals:
  if (
    role.includes('official') ||
    role.includes('barangay') ||
    role.includes('punong') ||
    role.includes('captain') ||
    role.includes('kagawad') ||
    role.includes('secretary') ||
    role.includes('treasurer') ||
    role.includes('officer') ||
    role.includes('admin') ||
    role.includes('administrator') ||
    role.includes('drrm') ||
    role.includes('staff') ||
    role.includes('dispatch') ||
    target.includes('official') ||
    target.includes('drrm') ||
    target.includes('command')
  ) {
    return 'Barangay';
  }

  return 'Barangay';
};

// Categorize log severity based on impact
const getLogSeverity = (log: AuditLogEntry): {
  level: 'CRITICAL' | 'IMPORTANT' | 'ROUTINE' | 'INFO';
  label: string;
  dotColor: string;
  badgeClass: string;
} => {
  const detailsUpper = (log.details || '').toUpperCase();
  const isEmergencyEscalation =
    detailsUpper.includes('EMERGENCY') ||
    detailsUpper.includes('EVACUATE') ||
    detailsUpper.includes('BROADCAST') ||
    detailsUpper.includes('CRITICAL');

  if (log.actionType === 'DELETE' || isEmergencyEscalation) {
    return {
      level: 'CRITICAL',
      label: 'CRITICAL',
      dotColor: 'bg-red-500 animate-pulse',
      badgeClass: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60 ring-1 ring-red-300 dark:ring-red-500/30 font-black shadow-2xs',
    };
  }

  if (['EDIT', 'STATUS_CHANGE', 'CENTER_ASSIGNED', 'VERIFICATION_TOGGLE', 'PASSWORD_RESET'].includes(log.actionType)) {
    return {
      level: 'IMPORTANT',
      label: 'IMPORTANT',
      dotColor: 'bg-amber-500',
      badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 font-bold shadow-2xs',
    };
  }

  if (['CREATE', 'RELIEF_DISTRIBUTED'].includes(log.actionType)) {
    return {
      level: 'ROUTINE',
      label: 'ROUTINE',
      dotColor: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 font-bold shadow-2xs',
    };
  }

  return {
    level: 'INFO',
    label: 'INFO',
    dotColor: 'bg-blue-400',
    badgeClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 font-medium shadow-2xs',
  };
};

// Extract YYYY-MM-DD from timestamp
const getDateKey = (timestamp: string): string => {
  const match = (timestamp || '').match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '2026-10-08';
};

// Format Date key into a readable banner
const formatDateGroupHeader = (dateKey: string): string => {
  if (dateKey === 'General Records') return 'General Operational Records';
  const todayStr = new Date().toISOString().slice(0, 10);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestStr = yest.toISOString().slice(0, 10);

  const parts = dateKey.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const formatted = d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (dateKey === todayStr) return `Today • ${formatted}`;
    if (dateKey === yestStr) return `Yesterday • ${formatted}`;
    return formatted;
  }
  return dateKey;
};

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({
  currentBarangay,
  logs,
  onClose,
  onClearLogs,
  onMarkAllAsRead,
  onMarkLogAsRead,
}) => {
  // Navigation & Scope State (Choices: 2 only - "Barangay" or "Resident")
  const [activeChoice, setActiveChoice] = useState<LogScopeChoice>('Barangay');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [actorFilter, setActorFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel>('ALL');
  const [isGroupedByDate, setIsGroupedByDate] = useState<boolean>(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Local read map for optimistic and instant UI updates
  const [localReadMap, setLocalReadMap] = useState<Record<string, boolean>>({});
  const [justMarkedRead, setJustMarkedRead] = useState(false);

  // Sync fullscreen state with native browser fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (modalContainerRef.current?.requestFullscreen) {
          await modalContainerRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Logs strictly isolated to currentBarangay
  const barangayLogs = useMemo(() => {
    return logs.filter((log) => log.barangay === currentBarangay);
  }, [logs, currentBarangay]);

  // Total counts for the 2 choices: "Barangay" and "Resident"
  const { barangayCount, residentCount } = useMemo(() => {
    let bCount = 0;
    let rCount = 0;
    barangayLogs.forEach((l) => {
      if (getLogScope(l) === 'Resident') {
        rCount++;
      } else {
        bCount++;
      }
    });
    return { barangayCount: bCount, residentCount: rCount };
  }, [barangayLogs]);

  // Helper to check if a log entry is read
  const isLogRead = (log: AuditLogEntry) => {
    if (localReadMap[log.id] !== undefined) {
      return localReadMap[log.id];
    }
    return log.read === true;
  };

  // Unread logs count for Barangay
  const unreadLogsCount = useMemo(() => {
    return barangayLogs.filter((l) => !isLogRead(l)).length;
  }, [barangayLogs, localReadMap]);

  // Mark all activity logs as read
  const handleMarkAllAsRead = () => {
    const updated: Record<string, boolean> = { ...localReadMap };
    barangayLogs.forEach((l) => {
      updated[l.id] = true;
    });
    setLocalReadMap(updated);
    setJustMarkedRead(true);
    setTimeout(() => setJustMarkedRead(false), 2500);
    onMarkAllAsRead?.();
  };

  // Toggle read status of a specific log
  const handleToggleLogRead = (id: string) => {
    const log = barangayLogs.find((l) => l.id === id);
    const currentRead = log ? isLogRead(log) : false;
    setLocalReadMap((prev) => ({ ...prev, [id]: !currentRead }));
    if (!currentRead) {
      onMarkLogAsRead?.(id);
    }
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return barangayLogs.filter((log) => {
      // 1. Filter strictly by the active choice / actor filter: "Barangay" (All officers & actors) or "Resident" (residents)
      const targetScope = (actorFilter === 'RESIDENTS' || activeChoice === 'Resident') ? 'Resident' : 'Barangay';
      if (getLogScope(log) !== targetScope) {
        return false;
      }

      // 2. Action Type Dropdown
      if (actionFilter !== 'ALL') {
        if (actionFilter === 'MUTATIONS' && !['EDIT', 'DELETE', 'CREATE'].includes(log.actionType)) {
          return false;
        } else if (actionFilter === 'AUTH' && !['LOGIN', 'LOGOUT', 'PASSWORD_RESET'].includes(log.actionType)) {
          return false;
        } else if (actionFilter !== 'MUTATIONS' && actionFilter !== 'AUTH' && log.actionType !== actionFilter) {
          return false;
        }
      }

      // 3. Severity Filter
      if (severityFilter !== 'ALL') {
        const { level } = getLogSeverity(log);
        if (level !== severityFilter) return false;
      }

      // 5. Search Term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchActor = (log.actorName || '').toLowerCase().includes(query);
        const matchRole = (log.actorRole || '').toLowerCase().includes(query);
        const matchTarget = (log.target || '').toLowerCase().includes(query);
        const matchDetails = (log.details || '').toLowerCase().includes(query);
        const matchTime = (log.timestamp || '').toLowerCase().includes(query);
        const matchId = (log.id || '').toLowerCase().includes(query);
        const matchTerminal = (log.terminal || '').toLowerCase().includes(query);
        return matchActor || matchRole || matchTarget || matchDetails || matchTime || matchId || matchTerminal;
      }

      return true;
    });
  }, [
    barangayLogs,
    activeChoice,
    actionFilter,
    actorFilter,
    severityFilter,
    searchTerm,
  ]);

  // Grouped logs by date
  const groupedLogs = useMemo(() => {
    const map = new Map<string, AuditLogEntry[]>();

    filteredLogs.forEach((log) => {
      const key = getDateKey(log.timestamp);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(log);
    });

    const groups: { dateKey: string; label: string; logs: AuditLogEntry[] }[] = [];
    map.forEach((logsInGroup, dateKey) => {
      groups.push({
        dateKey,
        label: formatDateGroupHeader(dateKey),
        logs: logsInGroup,
      });
    });

    // Sort newest date first
    groups.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return groups;
  }, [filteredLogs]);

  // Metrics
  const currentScopeCount = activeChoice === 'Barangay' ? barangayCount : residentCount;

  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
    const log = barangayLogs.find((l) => l.id === id);
    if (log && !isLogRead(log)) {
      setLocalReadMap((prev) => ({ ...prev, [id]: true }));
      onMarkLogAsRead?.(id);
    }
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredLogs.forEach((l) => {
      next[l.id] = true;
    });
    setExpandedLogIds(next);
  };

  const collapseAll = () => {
    setExpandedLogIds({});
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setActionFilter('ALL');
    setActorFilter('ALL');
    setActiveChoice('Barangay');
    setSeverityFilter('ALL');
  };

  const getActionBadge = (type: LogActionType) => {
    switch (type) {
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/60 shadow-2xs">
            <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" /> DELETED
          </span>
        );
      case 'EDIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 shadow-2xs">
            <Edit3 className="w-3 h-3 text-amber-700 dark:text-amber-400" /> EDITED
          </span>
        );
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shadow-2xs">
            <PlusCircle className="w-3 h-3 text-emerald-700 dark:text-emerald-400" /> REGISTERED
          </span>
        );
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 shadow-2xs">
            <LogIn className="w-3 h-3 text-blue-700 dark:text-blue-400" /> AUTH SIGN-IN
          </span>
        );
      case 'LOGOUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs">
            <LogOut className="w-3 h-3 text-slate-600 dark:text-slate-400" /> SIGN-OUT
          </span>
        );
      case 'STATUS_CHANGE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60 shadow-2xs">
            <AlertTriangle className="w-3 h-3 text-rose-700 dark:text-rose-400" /> STATUS UPDATE
          </span>
        );
      case 'CENTER_ASSIGNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60 shadow-2xs">
            <Home className="w-3 h-3 text-purple-700 dark:text-purple-400" /> SHELTER ALLOCATION
          </span>
        );
      case 'RELIEF_DISTRIBUTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800/60 shadow-2xs">
            <Package className="w-3 h-3 text-teal-700 dark:text-teal-400" /> RELIEF ISSUED
          </span>
        );
      case 'VERIFICATION_TOGGLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/60 shadow-2xs">
            <UserCheck className="w-3 h-3 text-cyan-700 dark:text-cyan-400" /> VERIFIED
          </span>
        );
      case 'PASSWORD_RESET':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800/60 shadow-2xs">
            <KeyRound className="w-3 h-3 text-indigo-700 dark:text-indigo-400" /> CREDENTIALS RESET
          </span>
        );
      case 'HOTLINE_UPDATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800/60 shadow-2xs">
            <PhoneCall className="w-3 h-3 text-sky-700 dark:text-sky-400" /> HOTLINE UPDATED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {type}
          </span>
        );
    }
  };

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
    return `"${str}"`;
  };

  // Export as standard CSV with Excel-safe text formulas
  const handleExportCSV = () => {
    const headers = [
      'Audit Log ID',
      'Timestamp (PST)',
      'Scope (Barangay / Resident)',
      'Severity Level',
      'Working Hours / Shift',
      'Action Type',
      'Official / Actor Name',
      'Role / Position',
      'Barangay',
      'Target / Entity',
      'Activity Details',
      'Terminal / Station',
    ];

    const rows = filteredLogs.map((l, idx) => {
      const cleanId = normalizeLogId(l.id, idx);
      const cleanTimestamp = normalizeLogTimestamp(l.timestamp);
      const scope = getLogScope(l);
      const { level: severity } = getLogSeverity(l);
      const shiftTag = l.workShiftTag || (l.isWorkingHours ? 'Working Hours (8:00 AM - 5:00 PM)' : 'After-Hours Disaster Shift');

      return [
        `"=""${cleanId}"""`,
        `"=""${cleanTimestamp}"""`,
        escapeCSV(scope),
        escapeCSV(severity),
        escapeCSV(shiftTag),
        escapeCSV(l.actionType),
        escapeCSV(l.actorName),
        escapeCSV(l.actorRole),
        escapeCSV(l.barangay),
        escapeCSV(l.target),
        escapeCSV(l.details),
        escapeCSV(l.terminal || 'Command Terminal • Station 01'),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `DRRM_Audit_Logs_${currentBarangay}_${activeChoice}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  // Export as formatted Excel Spreadsheet (.xls)
  const handleExportExcel = () => {
    const headers = [
      'Audit Log ID',
      'Timestamp (PST)',
      'Scope (Barangay / Resident)',
      'Severity',
      'Working Hours / Shift',
      'Action Type',
      'Official / Actor Name',
      'Role / Position',
      'Barangay',
      'Target / Entity',
      'Activity Details',
      'Terminal / Station',
    ];

    const headerHtml = headers
      .map((h) => `<th style="background-color: #0f172a; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #cbd5e1; text-align: left;">${h}</th>`)
      .join('');

    const rowsHtml = filteredLogs
      .map((l, idx) => {
        const cleanId = normalizeLogId(l.id, idx);
        const cleanTimestamp = normalizeLogTimestamp(l.timestamp);
        const scope = getLogScope(l);
        const { level: severity } = getLogSeverity(l);
        const shiftTag = l.workShiftTag || (l.isWorkingHours ? 'Working Hours (8:00 AM - 5:00 PM)' : 'After-Hours Disaster Shift');
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        return `
          <tr style="background-color: ${rowBg};">
            <td style="mso-number-format:'\\@'; padding: 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #1e3a8a;">${cleanId}</td>
            <td style="mso-number-format:'\\@'; padding: 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${cleanTimestamp}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${scope}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${severity}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${shiftTag}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${l.actionType}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${l.actorName}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${l.actorRole}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${l.barangay}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${l.target}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0;">${l.details}</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #64748b;">${l.terminal || 'Command Terminal • Station 01'}</td>
          </tr>
        `;
      })
      .join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; }
          th { font-size: 11px; }
          td { font-size: 11px; }
        </style>
      </head>
      <body>
        <h2>BARANGAY ${currentBarangay.toUpperCase()} DRRM OPERATIONAL ACTIVITY & AUDIT LOGS</h2>
        <p>Export Date: ${new Date().toLocaleString()} | Jurisdiction: Barangay ${currentBarangay} | Isolation: Strict</p>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `DRRM_Audit_Logs_${currentBarangay}_${dateStr}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-[200] w-full h-full min-h-screen bg-white flex flex-col overflow-hidden animate-fade-in select-none privacy-protected-data"
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        zIndex: 200,
      }}
    >
      <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 select-none privacy-protected-data">
        {/* Government Compliance Printable Header (Visible only when printing) */}
        <div className="hidden print:block p-8 border-b-2 border-slate-900 text-center mb-6">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Republic of the Philippines • Department of the Interior and Local Government
          </div>
          <div className="text-xl font-black uppercase text-slate-900 tracking-tight mt-1">
            Barangay {currentBarangay} Disaster Risk Reduction & Management Council
          </div>
          <div className="text-xs font-semibold text-slate-600 mt-0.5">
            24/7 Disaster Operations Command Center • Emergency Dispatch Station 01
          </div>
          <div className="mt-3 py-1.5 px-6 bg-slate-100 inline-block rounded-md border border-slate-400 text-xs font-black uppercase tracking-wider text-slate-900">
            Official Operational Activity & Forensic Audit Ledger
          </div>
          <div className="mt-4 text-[10px] text-slate-600 flex justify-between px-2 font-mono border-t border-slate-200 pt-2">
            <span>Jurisdiction: Barangay {currentBarangay}</span>
            <span>Generated Date: {new Date().toLocaleString()}</span>
            <span>Total Operational Records: {filteredLogs.length}</span>
          </div>
        </div>

        {/* Executive Government Seal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 print:hidden shadow-md">
          <div className="flex items-center gap-3.5">
            {/* Seal Badge */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 via-indigo-900 to-slate-950 border border-blue-400/40 text-blue-300 flex items-center justify-center shadow-lg shadow-blue-900/30">
                <Shield className="w-6 h-6 text-blue-300 drop-shadow" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight uppercase text-white flex items-center gap-2">
                  <span>Barangay {currentBarangay} DRRM Command Center</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-400/40 tracking-wider uppercase">
                  Audit Ledger
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ISO 9001 / COA Standards
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Official forensic activity records, household transactions & emergency event logs for Barangay {currentBarangay}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullScreen}
              className="px-3.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-xs active:scale-98"
              title={isFullscreen ? 'Exit Full Screen' : 'Toggle Full Screen mode'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Full Screen</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-xs active:scale-98"
              title="Print official audit report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Ledger</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
              title="Close audit modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. Operational Choices Bar: 2 Choices Only ('All officers & actors' and 'residents') */}
        <div className="bg-slate-900/95 px-4 pt-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 overflow-x-auto print:hidden">
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Choice 1: All officers & actors */}
            <button
              type="button"
              id="tab-choice-barangay"
              onClick={() => {
                setActiveChoice('Barangay');
                setActorFilter('ALL');
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeChoice === 'Barangay'
                  ? 'bg-slate-800 text-white border-blue-500 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white border-transparent hover:bg-slate-800/50'
              }`}
              title="All officers & actors"
            >
              <Building2 className={`w-3.5 h-3.5 ${activeChoice === 'Barangay' ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>All officers & actors</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  activeChoice === 'Barangay' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {barangayCount}
              </span>
            </button>

            {/* Choice 2: residents */}
            <button
              type="button"
              id="tab-choice-household"
              onClick={() => {
                setActiveChoice('Resident');
                setActorFilter('RESIDENTS');
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                activeChoice === 'Resident'
                  ? 'bg-slate-800 text-white border-emerald-500 shadow-sm font-black'
                  : 'text-slate-300 hover:text-white border-transparent hover:bg-slate-800/50'
              }`}
              title="residents"
            >
              <Home className={`w-3.5 h-3.5 ${activeChoice === 'Resident' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>residents</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  activeChoice === 'Resident' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {residentCount}
              </span>
            </button>
          </div>

          {/* Functional Mark as Read Button */}
          <div className="pb-2 shrink-0 ml-auto flex items-center gap-2">
            <button
              type="button"
              id="btn-mark-logs-read"
              onClick={handleMarkAllAsRead}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm active:scale-98 ${
                justMarkedRead
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/40 ring-2 ring-emerald-400/40'
                  : unreadLogsCount > 0
                  ? 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white shadow-blue-900/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={
                unreadLogsCount > 0
                  ? `Mark all ${unreadLogsCount} unread activity log${unreadLogsCount > 1 ? 's' : ''} for Barangay ${currentBarangay} as read`
                  : `All activity logs for Barangay ${currentBarangay} are marked as read`
              }
            >
              {justMarkedRead ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Marked as Read!</span>
                </>
              ) : (
                <>
                  <CheckCheck className={`w-3.5 h-3.5 ${unreadLogsCount > 0 ? 'text-blue-200' : 'text-slate-400'}`} />
                  <span>Mark as Read</span>
                  {unreadLogsCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-blue-800 text-blue-200 text-[10px] font-mono rounded-full font-black">
                      {unreadLogsCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Command Search & Forensic Filter Toolbar */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2.5 items-center justify-between print:hidden">
          {/* Search Input */}
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Log ID, official name, resident, target ID, action or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-950 outline-none transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Structured Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Action Type */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
                title="Filter by Action Type"
              >
                <option value="ALL">All Action Types</option>
                <option value="CREATE">➕ Registered Record</option>
                <option value="EDIT">✏️ Edited Record</option>
                <option value="DELETE">🗑️ Deleted Record</option>
                <option value="STATUS_CHANGE">⚠️ Status Updates</option>
                <option value="CENTER_ASSIGNED">🏠 Shelter Assigned</option>
                <option value="RELIEF_DISTRIBUTED">📦 Relief Issued</option>
                <option value="LOGIN">🔐 Auth Sign-In</option>
                <option value="LOGOUT">🚪 Sign-Out</option>
                <option value="PASSWORD_RESET">🔑 Credentials Reset</option>
              </select>
            </div>

            {/* Filter by Officer / Actor */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <select
                id="actor-filter-select"
                value={actorFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setActorFilter(val);
                  if (val === 'RESIDENTS') {
                    setActiveChoice('Resident');
                  } else {
                    setActiveChoice('Barangay');
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
                title="Filter by Officer / Actor"
              >
                <option value="ALL">All officers & actors</option>
                <option value="RESIDENTS">residents</option>
              </select>
            </div>

            {/* Severity Level */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
              <Flame className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1"
                title="Filter by Severity"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">🔴 Critical Escalations</option>
                <option value="IMPORTANT">🟡 Important Edits</option>
                <option value="ROUTINE">🟢 Routine Events</option>
                <option value="INFO">🔵 Informational</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ledger View & Organization Control Bar */}
        <div className="bg-slate-100/90 dark:bg-slate-950/80 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs print:hidden">
          <div className="flex items-center gap-2">
            {(searchTerm || actionFilter !== 'ALL' || actorFilter !== 'ALL' || severityFilter !== 'ALL') && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                <span>Reset Active Filters</span>
              </button>
            )}
            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-200/90 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-300/50 dark:border-slate-700">
              Showing {filteredLogs.length} of {currentScopeCount} {activeChoice === 'Barangay' ? 'All officers & actors' : 'residents'} records
            </span>
          </div>

          {/* View Toggles */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGroupedByDate(!isGroupedByDate)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                isGroupedByDate
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-extrabold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Toggle grouping by calendar days"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isGroupedByDate ? 'Grouped by Day' : 'Flat Chronological'}</span>
            </button>

            <button
              type="button"
              onClick={Object.keys(expandedLogIds).length > 0 ? collapseAll : expandAll}
              className="px-3 py-1 rounded-md text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs"
            >
              {Object.keys(expandedLogIds).length > 0 ? 'Collapse All Details' : 'Expand All Details'}
            </button>
          </div>
        </div>

        {/* 3. Main Ledger Table / Feed */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Shield className="w-14 h-14 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 text-sm">No activity logs match the selected filter criteria</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Barangay {currentBarangay} audit entries are strictly isolated. Try resetting search keywords or selecting "All Operational Streams".
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div>
              {/* Grouped by Date View */}
              {isGroupedByDate ? (
                <div>
                  {groupedLogs.map((group) => (
                    <div key={group.dateKey} className="border-b border-slate-200/90 last:border-b-0">
                      {/* Date Group Banner */}
                      <div className="bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-xs px-4 py-2 border-y border-slate-200/90 dark:border-slate-800 sticky top-0 z-10 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
                            <Calendar className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                          </div>
                          <h2 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                            {group.label}
                          </h2>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700">
                            {group.logs.length} logged event{group.logs.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
                          Barangay {currentBarangay} DRRM Daily Record
                        </span>
                      </div>

                      {/* Group Rows */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                        {group.logs.map((log, idx) => renderLogRow(log, idx))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Flat Chronological View */
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                  {filteredLogs.map((log, idx) => renderLogRow(log, idx))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Official DILG / COA Compliance Sign-Off Block (Visible only when printing) */}
        <div className="hidden print:grid grid-cols-2 gap-12 mt-12 pt-8 border-t-2 border-slate-400 px-8 text-xs text-slate-900">
          <div>
            <p className="font-bold uppercase text-[10px] text-slate-500 mb-10">Prepared & Verified By (DRRM Duty Officer):</p>
            <div className="border-b border-slate-900 w-4/5 mb-1"></div>
            <p className="font-bold text-xs uppercase">Barangay DRRM Operations Officer</p>
            <p className="text-[10px] text-slate-600">Operations Dispatch Station 01 • Command Terminal</p>
          </div>
          <div>
            <p className="font-bold uppercase text-[10px] text-slate-500 mb-10">Attested & Certified By (Council Chairman):</p>
            <div className="border-b border-slate-900 w-4/5 mb-1"></div>
            <p className="font-bold text-xs uppercase">Punong Barangay / BDRRMC Chairman</p>
            <p className="text-[10px] text-slate-600">Barangay {currentBarangay} • Albay DRRM Council</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
            <span>
              Immutable Forensic Audit Ledger active • Barangay <strong>{currentBarangay}</strong> Isolation Enforced
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-98"
              title="Download clean CSV file with preserved timestamps and severity"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className={`px-3.5 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-98 ${
                downloadSuccess
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white'
              }`}
              title="Download formatted Excel workbook (Recommended for WPS Office & MS Excel)"
            >
              {downloadSuccess ? <Check className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>{downloadSuccess ? 'Downloaded!' : 'Export Excel (.xls)'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs active:scale-98"
            >
              Close Ledger
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Helper to render an individual log row with professional tabular appearance and expandable inspector
  function renderLogRow(log: AuditLogEntry, idx: number) {
    const cleanLogId = normalizeLogId(log.id, idx);
    const cleanTimestamp = normalizeLogTimestamp(log.timestamp);
    const scope = getLogScope(log);
    const severity = getLogSeverity(log);
    const isExpanded = !!expandedLogIds[log.id];

    return (
      <div
        key={log.id}
        onClick={() => toggleExpand(log.id)}
        className={`transition-colors cursor-pointer group ${
          isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50/90'
        }`}
      >
        {/* Main Row Summary */}
        <div className="p-3.5 sm:px-5 flex flex-wrap lg:flex-nowrap items-start justify-between gap-3 text-xs">
          {/* Reference ID & Timestamp Column */}
          <div className="min-w-[180px] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-black tracking-tight">
                {cleanLogId}
              </span>
              <button
                type="button"
                onClick={(e) => handleCopyId(cleanLogId, e)}
                className="text-slate-400 hover:text-blue-700 p-0.5 rounded cursor-pointer transition"
                title="Copy Reference ID"
              >
                {copiedId === cleanLogId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {!isLogRead(log) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs animate-pulse">
                  NEW
                </span>
              )}
            </div>

            <div className="font-black text-slate-900 font-mono text-[11px] mt-1.5 tracking-tight">
              {cleanTimestamp}
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              {log.isWorkingHours ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Day Shift (8-5)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                  {log.workShiftTag || 'Night Calamity Shift'}
                </span>
              )}
            </div>
          </div>

          {/* Action Type & Severity Badges */}
          <div className="min-w-[150px] shrink-0 space-y-1.5">
            <div>{getActionBadge(log.actionType)}</div>

            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border ${severity.badgeClass}`}
                title={`Severity classification: ${severity.label}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${severity.dotColor}`} />
                {severity.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border ${
                  scope === 'Resident'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
                title={`Scope: ${scope}`}
              >
                {scope === 'Resident' ? (
                  <Home className="w-2.5 h-2.5 text-emerald-600" />
                ) : (
                  <Building2 className="w-2.5 h-2.5 text-blue-600" />
                )}
                <span>{scope === 'Resident' ? 'Household' : 'Barangay Account'}</span>
              </span>
            </div>
          </div>

          {/* Duty Officer & Role */}
          <div className="min-w-[150px] shrink-0">
            <div className="font-black text-slate-900 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{log.actorName}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              {log.actorRole}
            </div>
          </div>

          {/* Target / Entity */}
          <div className="min-w-[130px] shrink-0">
            <div className="inline-block bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-300 font-mono text-slate-900 font-bold">
              {log.target}
            </div>
          </div>

          {/* Activity Narrative */}
          <div className="flex-1 min-w-[220px] text-slate-700 text-xs">
            <p className="line-clamp-2 leading-relaxed font-normal">{log.details}</p>
          </div>

          {/* Terminal & Expand Action */}
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded hidden xl:inline">
              {log.terminal ? log.terminal.replace('Command Terminal • ', '') : 'Station 01'}
            </span>
            <div className="flex items-center gap-1 text-slate-400 group-hover:text-blue-700 transition">
              <span className="text-[10px] font-bold hidden sm:inline">
                {isExpanded ? 'Hide' : 'Inspect'}
              </span>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-700" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Expandable Forensic Detail Drawer */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 bg-white border-t border-slate-200/90 animate-fade-in text-xs">
            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Activity className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                  <span className="font-black text-slate-900 uppercase tracking-tight text-xs">
                    Official Forensic Event Audit Breakdown
                  </span>
                  <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded font-mono font-bold text-slate-800">
                    ID: {cleanLogId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLogRead(log.id);
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition flex items-center gap-1 cursor-pointer ${
                      isLogRead(log)
                        ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-2xs'
                    }`}
                    title={isLogRead(log) ? 'Mark this log as unread' : 'Mark this log as read'}
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>{isLogRead(log) ? 'Mark as Unread' : 'Mark as Read'}</span>
                  </button>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                    <Laptop className="w-3 h-3 text-slate-400" />
                    <span>Workstation: <strong className="text-slate-800">{log.terminal || 'Command Terminal • Station 01'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Forensic Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                    Target Entity / Record Reference
                  </span>
                  <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs mt-0.5 block">{log.target}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 block">Jurisdiction: Brgy. {log.barangay}</span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                    Officer in Charge / Authorizing Duty
                  </span>
                  <span className="font-black text-slate-900 dark:text-slate-100 text-xs mt-0.5 block">{log.actorName}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 block">Role: {log.actorRole}</span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                    Chronology & Shift Authentication
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5 block">{cleanTimestamp}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 block">
                    {log.workShiftTag || 'Regular Government Shift'}
                  </span>
                </div>
              </div>

              {/* Full Action Narrative Box */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3 text-slate-400" /> Complete Audit Narrative
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`[${cleanLogId}] ${cleanTimestamp} - ${log.actorName} (${log.actorRole}) - ${log.details}`);
                      setCopiedId(cleanLogId);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedId === cleanLogId ? 'Copied Narrative' : 'Copy Record'}</span>
                  </button>
                </div>
                <p className="text-slate-900 dark:text-slate-100 leading-relaxed font-sans text-xs bg-slate-50/70 dark:bg-slate-950/80 p-2.5 rounded border border-slate-200/80 dark:border-slate-800">
                  {log.details}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};
