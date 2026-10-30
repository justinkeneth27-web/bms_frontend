import React, { useState, useEffect } from 'react';
import { BarangayName, OfficialAccount } from '../types';
import { laravelApi } from '../utils/laravelApi';
import { Shield, Building2, Lock, User, Clock, AlertTriangle, ArrowRight, Eye, EyeOff, Moon, Sun } from 'lucide-react';

const OFFICIAL_LOCKOUT_UNTIL_KEY = 'brgy_official_login_lockout_until';
const OFFICIAL_FAILED_ATTEMPTS_KEY = 'brgy_official_login_failed_attempts';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 10 * 60; // 10 minutes = 600s

interface OfficialLoginFormProps {
  initialBarangay?: BarangayName;
  officialAccounts?: Record<string, OfficialAccount>;
  onLoginOfficial: (account: OfficialAccount) => void;
  onLockoutTriggered?: (enteredUsername: string) => void;
  securityNotice?: string | null;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const OfficialLoginForm: React.FC<OfficialLoginFormProps> = ({
  initialBarangay,
  officialAccounts,
  onLoginOfficial,
  onLockoutTriggered,
  securityNotice,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Initialize lockout state from localStorage if active
  useEffect(() => {
    try {
      const storedUntil = localStorage.getItem(OFFICIAL_LOCKOUT_UNTIL_KEY);
      if (storedUntil) {
        const untilTime = parseInt(storedUntil, 10);
        const now = Date.now();
        if (untilTime > now) {
          const remaining = Math.ceil((untilTime - now) / 1000);
          setLockoutSeconds(remaining);
          setFailedAttempts(MAX_FAILED_ATTEMPTS);
          return;
        } else {
          // Lockout expired
          localStorage.removeItem(OFFICIAL_LOCKOUT_UNTIL_KEY);
          localStorage.removeItem(OFFICIAL_FAILED_ATTEMPTS_KEY);
        }
      }

      const storedAttempts = localStorage.getItem(OFFICIAL_FAILED_ATTEMPTS_KEY);
      if (storedAttempts) {
        const count = parseInt(storedAttempts, 10);
        if (!isNaN(count) && count > 0) {
          setFailedAttempts(count);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFailedAttempts(0);
          setError(null);
          try {
            localStorage.removeItem(OFFICIAL_LOCKOUT_UNTIL_KEY);
            localStorage.removeItem(OFFICIAL_FAILED_ATTEMPTS_KEY);
          } catch {
            // ignore
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatLockoutTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    // 1. Check if account is currently locked out
    if (lockoutSeconds > 0) {
      setError(
        `Security Lockout Active: Too many failed login attempts (5 of 5). Please wait ${formatLockoutTime(lockoutSeconds)} before trying again.`
      );
      return;
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Please enter both your official username and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Authenticate through Laravel API backend against PostgreSQL database
      let authenticatedAccount: OfficialAccount | null = null;

      try {
        const res = await laravelApi.login({
          username: cleanUsername,
          password: cleanPassword,
        });
        if (res && res.success && res.official) {
          authenticatedAccount = {
            username: res.official.username,
            passwordHash: '', // Password is never kept in frontend state
            barangay: res.official.barangay,
            officialName: res.official.officialName,
            position: res.official.position,
            phone: res.official.phone || '',
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid credentials';
        console.warn('Backend authentication failed:', msg);
      }

      if (!authenticatedAccount) {
        const newAttempts = failedAttempts + 1;

        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          // Trigger 10-minute lockout (600s)
          const untilTime = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
          try {
            localStorage.setItem(OFFICIAL_LOCKOUT_UNTIL_KEY, untilTime.toString());
            localStorage.setItem(OFFICIAL_FAILED_ATTEMPTS_KEY, MAX_FAILED_ATTEMPTS.toString());
          } catch {
            // ignore
          }
          setLockoutSeconds(LOCKOUT_DURATION_SECONDS);
          setFailedAttempts(MAX_FAILED_ATTEMPTS);
          setError(
            `🛑 Security Lockout: 5 consecutive failed login attempts reached. System is locked for 10 minutes (${formatLockoutTime(LOCKOUT_DURATION_SECONDS)}). Please try again later.`
          );
          onLockoutTriggered?.(cleanUsername);
        } else {
          setFailedAttempts(newAttempts);
          try {
            localStorage.setItem(OFFICIAL_FAILED_ATTEMPTS_KEY, newAttempts.toString());
          } catch {
            // ignore
          }
          const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
          setError(
            `Invalid official credentials. Attempt ${newAttempts} of ${MAX_FAILED_ATTEMPTS} (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before 10-minute lockout).`
          );
        }
        setIsSubmitting(false);
        return;
      }

      // Success! Reset attempts and clear lockout
      setFailedAttempts(0);
      setLockoutSeconds(0);
      try {
        localStorage.removeItem(OFFICIAL_LOCKOUT_UNTIL_KEY);
        localStorage.removeItem(OFFICIAL_FAILED_ATTEMPTS_KEY);
      } catch {
        // ignore
      }
      onLoginOfficial(authenticatedAccount);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative">
      {/* Top right theme toggle */}
      {onToggleDarkMode && (
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-sm active:scale-95"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400 shrink-0" /> : <Moon className="w-4 h-4 text-blue-300 shrink-0" />}
            <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      )}

      {/* Portal Header */}
      <div className="max-w-md w-full text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3 shadow-lg shadow-blue-600/30">
          <Building2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight uppercase">
          BARANGAY MONITORING SYSTEM
        </h1>
        <p className="text-blue-400 text-xs mt-1 uppercase tracking-widest font-bold">
          Disaster Risk Reduction & Evacuation Command Center
        </p>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 sm:p-7 space-y-5">
          {/* Lockout Warning Box */}
          {lockoutSeconds > 0 && (
            <div className="p-4 rounded-xl bg-red-100 border-2 border-red-500 text-red-950 text-xs flex items-start gap-3 font-bold shadow-xs">
              <Clock className="w-5 h-5 text-red-700 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="uppercase tracking-wide font-black text-red-900 text-xs">
                    Security Lockout Active
                  </p>
                  <span className="px-2.5 py-0.5 bg-red-800 text-white rounded font-mono text-xs font-black shadow-xs">
                    {formatLockoutTime(lockoutSeconds)}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-red-900 mt-1">
                  5 consecutive failed login attempts detected. Access is locked for 10 minutes to protect official accounts from brute force attacks.
                </p>
              </div>
            </div>
          )}

          {/* Security Notice / Route Protection Banner */}
          {securityNotice && !error && lockoutSeconds <= 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5 font-medium shadow-xs">
              <Shield className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-amber-950 uppercase tracking-wide text-[11px]">Protected Portal</p>
                <p className="text-amber-900 mt-0.5 text-xs leading-relaxed">{securityNotice}</p>
              </div>
            </div>
          )}

          {error && lockoutSeconds <= 0 && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 font-medium animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Official Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Buang.admin.gov"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Official Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={lockoutSeconds > 0 || isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    sessionStorage.clear();
                    window.location.hash = '#/reset-password';
                  }}
                  className="text-sm text-blue-500 hover:underline disabled:opacity-50"
                  id="btn-forgot-password"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-official-login-submit"
              disabled={lockoutSeconds > 0 || isSubmitting}
              className={`w-full py-3 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 uppercase tracking-wider ${
                lockoutSeconds > 0
                  ? 'bg-red-950/80 border border-red-700 cursor-not-allowed opacity-90'
                  : isSubmitting
                  ? 'bg-blue-700 opacity-90 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-600/30 cursor-pointer'
              }`}
            >
              {lockoutSeconds > 0 ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-red-300" />
                  <span>Locked Out ({formatLockoutTime(lockoutSeconds)})</span>
                </>
              ) : isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Log In</span>
                </>
              )}
            </button>
 
          </form>
        </div>
      </div>
    </div>
  );
};
