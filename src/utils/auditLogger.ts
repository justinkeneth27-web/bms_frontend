import { AuditLogEntry, BarangayName, LogActionType } from '../types';

/**
 * Checks if a given Date (or current time) is within standard Philippine government office/working hours:
 * Regular Working Hours: Monday to Friday, 8:00 AM (08:00) to 5:00 PM (17:00).
 * Outside this window is categorized as "After-Hours / Emergency Duty Shift".
 */
export function evaluateWorkingHours(date: Date = new Date()): { isWorkingHours: boolean; workShiftTag: string } {
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  const isWeekday = day >= 1 && day <= 5;
  const isWithinEightToFive = timeInMinutes >= 8 * 60 && timeInMinutes <= 17 * 60; // 08:00 - 17:00

  if (isWeekday && isWithinEightToFive) {
    return {
      isWorkingHours: true,
      workShiftTag: 'Working Hours (8:00 AM - 5:00 PM)',
    };
  }

  const shiftLabel = !isWeekday ? 'Weekend Emergency Duty' : hour < 8 ? 'Early Morning Shift' : 'After-Hours Disaster Shift';
  return {
    isWorkingHours: false,
    workShiftTag: shiftLabel,
  };
}

export function formatLogTimestamp(date: Date = new Date()): string {
  const validDate = isNaN(date.getTime()) ? new Date() : date;
  const yyyy = validDate.getFullYear();
  const mm = String(validDate.getMonth() + 1).padStart(2, '0');
  const dd = String(validDate.getDate()).padStart(2, '0');

  let hours = validDate.getHours();
  const minutes = String(validDate.getMinutes()).padStart(2, '0');
  const seconds = String(validDate.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  const strHours = String(hours).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${strHours}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Normalizes any timestamp string into standard PST format (YYYY-MM-DD hh:mm:ss AM/PM).
 * Guards against NaN, missing timestamps, or non-standard ISO formats.
 */
export function normalizeLogTimestamp(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string' || raw.includes('NaN')) {
    return formatLogTimestamp(new Date());
  }
  const trimmed = raw.trim();
  // If it already matches YYYY-MM-DD hh:mm:ss AM/PM
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} (?:AM|PM)$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  // If it matches 24h YYYY-MM-DD HH:MM:SS
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return formatLogTimestamp(d);
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return formatLogTimestamp(parsed);
  }
  return trimmed;
}

/**
 * Generates an official, human-readable, professional Audit Record ID.
 * Format: AUD-YYYYMMDD-HHMMSS-XXXX (e.g. AUD-20260928-143015-K8X2).
 * Prevents scientific notation issues in Excel and ensures collision resistance.
 */
export function generateAuditLogId(date: Date = new Date()): string {
  const validDate = isNaN(date.getTime()) ? new Date() : date;
  const yyyy = validDate.getFullYear();
  const mm = String(validDate.getMonth() + 1).padStart(2, '0');
  const dd = String(validDate.getDate()).padStart(2, '0');
  const hours = String(validDate.getHours()).padStart(2, '0');
  const mins = String(validDate.getMinutes()).padStart(2, '0');
  const secs = String(validDate.getSeconds()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AUD-${yyyy}${mm}${dd}-${hours}${mins}${secs}-${rand}`;
}

/**
 * Normalizes any legacy or runtime ID so that it exports cleanly into spreadsheets
 * without being corrupted into formulas or scientific notation.
 */
export function normalizeLogId(id: string | undefined | null, fallbackIndex: number = 0): string {
  if (!id || id === 'undefined' || id === 'null') {
    return `AUD-${String(fallbackIndex + 1).padStart(4, '0')}`;
  }
  if (id.startsWith('AUD-')) {
    return id;
  }
  if (id.startsWith('log-init-')) {
    return id.replace('log-init-', 'AUD-INIT-').toUpperCase();
  }
  // Match legacy log-<timestamp>-<hash>
  const epochMatch = id.match(/^log-(\d{10,})(?:-(.*))?$/);
  if (epochMatch) {
    const epoch = parseInt(epochMatch[1], 10);
    const date = new Date(epoch);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const suffix = (epochMatch[2] || String(fallbackIndex + 1)).toUpperCase();
      return `AUD-${yyyy}${mm}${dd}-${suffix}`;
    }
  }
  return id.replace(/^log-/, 'AUD-').toUpperCase();
}

export function buildAuditLog({
  actionType,
  actorName,
  actorRole,
  barangay,
  target,
  details,
  timestamp,
  customDate,
}: {
  actionType: LogActionType;
  actorName: string;
  actorRole: string;
  barangay: BarangayName;
  target: string;
  details: string;
  timestamp?: string;
  customDate?: Date;
}): AuditLogEntry {
  const now = customDate || new Date();
  const { isWorkingHours, workShiftTag } = evaluateWorkingHours(now);

  return {
    id: generateAuditLogId(now),
    timestamp: timestamp ? normalizeLogTimestamp(timestamp) : formatLogTimestamp(now),
    actionType,
    actorName,
    actorRole,
    barangay,
    target,
    details,
    isWorkingHours,
    workShiftTag,
    terminal: 'Command Terminal • Station 01',
    read: false,
  };
}
