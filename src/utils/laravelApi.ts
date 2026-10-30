/**
 * Laravel 11 + PostgreSQL API Client Adapter
 * Enables bidirectional communication between React frontend and Laravel API.
 */

import {
  AuditLogEntry,
  BarangayConfig,
  BarangayName,
  EvacuationCenter,
  Household,
  HouseholdAccount,
  OfficialAccount,
  ReliefDistribution,
} from '../types';

// Resolve API base URL: environment variable, or proxy fallback
const rawEnv = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_LARAVEL_API_URL;
// Normalize localhost to 127.0.0.1 to avoid Windows IPv6 (::1) lookup hangs on php artisan serve
const ENV_URL = rawEnv ? rawEnv.replace('//localhost:', '//127.0.0.1:') : undefined;
const API_BASE_URL = ENV_URL && ENV_URL.trim() !== '' ? ENV_URL.trim() : '/api/v1';

export interface BackendHealthResponse {
  connected: boolean;
  framework?: string;
  database?: {
    connected: boolean;
    message: string;
    driver?: string;
    database?: string;
  };
  counts?: {
    households: number;
    evacuationCenters: number;
    reliefDistributions: number;
    activityLogs: number;
    officialAccounts: number;
  };
  timestamp?: string;
  error?: string;
}

export const isLaravelApiConfigured = (): boolean => {
  return Boolean(API_BASE_URL && API_BASE_URL.trim() !== '');
};

export const getApiBaseUrl = (): string => API_BASE_URL;

const getHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  const authToken =
    token ||
    localStorage.getItem('barangay_auth_token') ||
    sessionStorage.getItem('barangay_resident_auth_token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export const laravelApi = {
  /**
   * Ping Laravel backend and check PostgreSQL connectivity.
   */
  async checkHealth(): Promise<BackendHealthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
        headers: getHeaders(),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { connected: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const json = await res.json();
      return {
        connected: Boolean(json.status === 'ok'),
        framework: json.framework,
        database: json.database,
        counts: json.counts,
        timestamp: json.timestamp,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, error: msg };
    }
  },

  // --------------------------------------------------------------------------
  // AUTHENTICATION & ROSTERS (VERIFIED AGAINST BACKEND DATABASE)
  // --------------------------------------------------------------------------

  async login(payload: { username: string; password: string; barangay?: string }) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid official credentials');
    }
    if (data.token) {
      localStorage.setItem('barangay_auth_token', data.token);
    }
    return data;
  },

  async loginResident(payload: { email: string; password: string }) {
    const res = await fetch(`${API_BASE_URL}/auth/resident/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid resident credentials');
    }
    if (data.token) {
      sessionStorage.setItem('barangay_resident_auth_token', data.token);
    }
    return data;
  },

  async createHouseholdAccount(payload: {
    email: string;
    password: string;
    householdId?: string;
    headOfFamily: string;
    barangay: string;
    contactNumber?: string;
  }): Promise<HouseholdAccount> {
    const res = await fetch(`${API_BASE_URL}/household-accounts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to register resident account');
    }
    return data.data;
  },

  async getHouseholdAccounts(barangay?: string): Promise<HouseholdAccount[]> {
    const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE_URL}/household-accounts${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch household accounts from backend');
    const data = await res.json();
    return data.data || [];
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } finally {
      localStorage.removeItem('barangay_auth_token');
      sessionStorage.removeItem('barangay_resident_auth_token');
    }
  },

  async lookupOfficial(username: string): Promise<{
    barangay: BarangayName;
    officialName?: string;
    position?: string;
    username?: string;
    hasEmail?: boolean;
    email?: string;
    emailMasked?: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/auth/security-question`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Account not found');
    }
    return {
      barangay: data.barangay,
      officialName: data.officialName || undefined,
      position: data.position || undefined,
      username: data.username || undefined,
      hasEmail: Boolean(data.hasEmail),
      email: data.email || undefined,
      emailMasked: data.emailMasked || undefined,
    };
  },

  async getSecurityQuestion(username: string) {
    return this.lookupOfficial(username);
  },

  async sendResetOtp(payload: { username: string; email?: string; linkEmail?: boolean; link_email?: boolean }): Promise<{
    success: boolean;
    message: string;
    email?: string;
    email_masked?: string;
    has_email?: boolean;
    need_email?: boolean;
    smtp_configured?: boolean;
    mail_sent?: boolean;
  }> {
    const res = await fetch(`${API_BASE_URL}/auth/send-reset-otp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ...payload,
        link_email: payload.linkEmail ?? payload.link_email ?? true,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to generate/send recovery OTP.');
    }
    return data;
  },

  async verifyResetOtp(payload: { username: string; otp: string }): Promise<boolean> {
    const res = await fetch(`${API_BASE_URL}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Invalid or expired OTP code.');
    }
    return true;
  },

  async resetPasswordWithOtp(payload: { username: string; otp: string; newPassword: string }) {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password-with-otp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Password reset with OTP failed.');
    }
    return data;
  },

  async getOfficials(barangay?: string): Promise<OfficialAccount[]> {
    const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE_URL}/officials${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch officials from backend');
    const data = await res.json();
    return data.data;
  },

  async createOfficialAccount(payload: {
    username: string;
    password: string;
    barangay: string;
    officialName: string;
    position: string;
    phone?: string;
    email?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/officials`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to create official account');
    }
    return data;
  },

  async updateOfficialAccount(
    username: string,
    payload: {
      officialName?: string;
      position?: string;
      phone?: string;
      email?: string;
      password?: string;
    },
    officerInfo?: { name?: string; role?: string }
  ) {
    const res = await fetch(`${API_BASE_URL}/officials/${encodeURIComponent(username)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        ...payload,
        officerName: officerInfo?.name,
        officerRole: officerInfo?.role,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to update official account');
    }
    return data;
  },

  async deleteOfficialAccount(username: string, officerInfo?: { name?: string; role?: string }): Promise<boolean> {
    const body = officerInfo ? JSON.stringify({ officerName: officerInfo.name, officerRole: officerInfo.role }) : undefined;
    const res = await fetch(`${API_BASE_URL}/officials/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: getHeaders(),
      body,
    });
    return res.ok;
  },

  // --------------------------------------------------------------------------
  // HOUSEHOLDS CRUD & BROADCAST
  // --------------------------------------------------------------------------

  async getHouseholds(params?: { barangay?: string; purok?: string; status?: string; search?: string }): Promise<Household[]> {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    const res = await fetch(`${API_BASE_URL}/households${query}`, { credentials: 'omit', headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch households: ${res.statusText}`);
    const data = await res.json();
    return data.data;
  },

  async createHousehold(payload: Partial<Household>, officerInfo?: { name?: string; role?: string }): Promise<Household> {
    const body = {
      ...payload,
      officerName: officerInfo?.name,
      officerRole: officerInfo?.role,
    };
    const res = await fetch(`${API_BASE_URL}/households`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to register household');
    }
    return data.data;
  },

  async updateHousehold(id: string, payload: Partial<Household>, officerInfo?: { name?: string; role?: string }): Promise<Household> {
    const body = {
      ...payload,
      officerName: officerInfo?.name,
      officerRole: officerInfo?.role,
    };
    const res = await fetch(`${API_BASE_URL}/households/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to update household');
    }
    return data.data;
  },

  async updateHouseholdStatus(
    id: string,
    status: string,
    statusNote?: string,
    evacuationCenterId?: string,
    officerInfo?: { name?: string; role?: string }
  ): Promise<Household> {
    const res = await fetch(`${API_BASE_URL}/households/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        status,
        statusNote,
        evacuationCenterId,
        officerName: officerInfo?.name,
        officerRole: officerInfo?.role,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to update household status');
    }
    return data.data;
  },

  async broadcastStatus(
    barangay: BarangayName,
    status: string,
    statusNote?: string,
    officerInfo?: { name?: string; role?: string }
  ) {
    const res = await fetch(`${API_BASE_URL}/households/broadcast-status`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        barangay,
        status,
        statusNote,
        officerName: officerInfo?.name,
        officerRole: officerInfo?.role,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to broadcast status');
    }
    return data;
  },

  async deleteHousehold(id: string, officerInfo?: { name?: string; role?: string }): Promise<boolean> {
    const body = officerInfo ? JSON.stringify({ officerName: officerInfo.name, officerRole: officerInfo.role }) : undefined;
    const res = await fetch(`${API_BASE_URL}/households/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(),
      body,
    });
    return res.ok;
  },

  // --------------------------------------------------------------------------
  // EVACUATION CENTERS
  // --------------------------------------------------------------------------

  async getEvacuationCenters(barangay?: string): Promise<EvacuationCenter[]> {
    const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE_URL}/evacuation-centers${query}`, { credentials: 'omit', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch evacuation centers');
    const data = await res.json();
    return data.data;
  },

  async assignHouseholdToCenter(
    centerId: string,
    householdId: string,
    officerInfo?: { name?: string; role?: string }
  ) {
    const res = await fetch(`${API_BASE_URL}/evacuation-centers/${encodeURIComponent(centerId)}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        householdId,
        officerName: officerInfo?.name,
        officerRole: officerInfo?.role,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to assign household to center');
    }
    return data;
  },

  async createEvacuationCenter(
    center: Partial<EvacuationCenter>,
    officerInfo?: { name?: string; role?: string }
  ): Promise<EvacuationCenter> {
    const res = await fetch(`${API_BASE_URL}/evacuation-centers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ...center,
        officerName: officerInfo?.name,
        officerRole: officerInfo?.role,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to save evacuation center');
    }
    return data.data;
  },

  async deleteEvacuationCenter(id: string, officerInfo?: { name?: string; role?: string }): Promise<boolean> {
    const body = officerInfo ? JSON.stringify({ officerName: officerInfo.name, officerRole: officerInfo.role }) : undefined;
    const res = await fetch(`${API_BASE_URL}/evacuation-centers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(),
      body,
    });
    return res.ok;
  },

  // --------------------------------------------------------------------------
  // RELIEF DISTRIBUTIONS
  // --------------------------------------------------------------------------

  async getReliefDistributions(barangay?: string): Promise<ReliefDistribution[]> {
    const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE_URL}/relief-distributions${query}`, { credentials: 'omit', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch relief distributions');
    const data = await res.json();
    return data.data;
  },

  async createReliefDistribution(payload: {
    householdId: string;
    item: string;
    qty: string;
    location: string;
    officerName: string;
    notes?: string;
  }): Promise<ReliefDistribution> {
    const res = await fetch(`${API_BASE_URL}/relief-distributions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to record relief distribution');
    }
    return data.data;
  },

  // --------------------------------------------------------------------------
  // BARANGAY CONFIGURATIONS
  // --------------------------------------------------------------------------

  async getBarangayConfigs(): Promise<Record<BarangayName, BarangayConfig>> {
    const res = await fetch(`${API_BASE_URL}/barangay-configs`, { credentials: 'omit', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch barangay configurations');
    const data = await res.json();
    return data.data || {};
  },

  async updateBarangayConfig(
    name: BarangayName,
    payload: Partial<BarangayConfig>,
    officerInfo?: { name?: string; role?: string }
  ): Promise<BarangayConfig> {
    const res = await fetch(`${API_BASE_URL}/barangay-configs/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        ...payload,
        officerName: officerInfo?.name,
        officerRole: officerInfo?.role,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to update barangay configuration');
    }
    return data.data;
  },

  // --------------------------------------------------------------------------
  // ACTIVITY & AUDIT LOGS
  // --------------------------------------------------------------------------

  async getActivityLogs(barangay?: string): Promise<AuditLogEntry[]> {
    const query = barangay ? `?barangay=${encodeURIComponent(barangay)}` : '';
    const res = await fetch(`${API_BASE_URL}/activity-logs${query}`, { credentials: 'omit', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch activity logs');
    const data = await res.json();
    return data.data;
  },

  async createActivityLog(payload: {
    actionType: string;
    actorName: string;
    actorRole: string;
    barangay: BarangayName;
    target: string;
    details: string;
    terminal?: string;
  }): Promise<AuditLogEntry> {
    const res = await fetch(`${API_BASE_URL}/activity-logs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to record audit log');
    }
    return data.data;
  },
};
