import React, { useState, useEffect } from 'react';
import { HouseholdAccount } from '../types';
import { laravelApi } from '../utils/laravelApi';
import { Home, Mail, Lock, Eye, EyeOff, AlertTriangle, Clock, Moon, Sun } from 'lucide-react';

const RESIDENT_LOCKOUT_UNTIL_KEY = 'brgy_resident_login_lockout_until';
const RESIDENT_FAILED_ATTEMPTS_KEY = 'brgy_resident_login_failed_attempts';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 10 * 60; // 10 minutes = 600s

interface ResidentLoginFormProps {
  householdAccounts?: HouseholdAccount[];
  onLoginHousehold?: (householdId: string) => void;
  onNavigateToOfficialLogin?: () => void;
  onNavigateToRegister?: () => void;
  onLockoutTriggered?: (enteredEmail: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const ResidentLoginForm: React.FC<ResidentLoginFormProps> = ({
  householdAccounts = [],
  onLoginHousehold,
  onNavigateToRegister,
  onLockoutTriggered,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Initialize lockout state from localStorage if active
  useEffect(() => {
    try {
      const storedUntil = localStorage.getItem(RESIDENT_LOCKOUT_UNTIL_KEY);
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
          localStorage.removeItem(RESIDENT_LOCKOUT_UNTIL_KEY);
          localStorage.removeItem(RESIDENT_FAILED_ATTEMPTS_KEY);
        }
      }

      const storedAttempts = localStorage.getItem(RESIDENT_FAILED_ATTEMPTS_KEY);
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
            localStorage.removeItem(RESIDENT_LOCKOUT_UNTIL_KEY);
            localStorage.removeItem(RESIDENT_FAILED_ATTEMPTS_KEY);
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
    setError(null);

    // 1. Check if currently locked out
    if (lockoutSeconds > 0) {
      setError(
        `Security Lockout Active: Too many failed login attempts (5 of 5). Please wait ${formatLockoutTime(lockoutSeconds)} before trying again.`
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPwd = password.trim();

    if (!cleanEmail || !cleanPwd) {
      setError('Please enter both your registered email address and account password.');
      return;
    }

    try {
      const res = await laravelApi.loginResident({ email: cleanEmail, password: cleanPwd });
      if (res && res.success && res.account) {
        // Success! Reset attempts and clear lockout
        setFailedAttempts(0);
        setLockoutSeconds(0);
        try {
          localStorage.removeItem(RESIDENT_LOCKOUT_UNTIL_KEY);
          localStorage.removeItem(RESIDENT_FAILED_ATTEMPTS_KEY);
        } catch {
          // ignore
        }

        const targetHouseholdId = res.account.householdId || res.household?.id;
        if (onLoginHousehold && targetHouseholdId) {
          onLoginHousehold(targetHouseholdId);
        }
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid resident credentials';
      console.warn('Resident authentication error:', msg);
    }

    // Handle failed login attempt
    const newAttempts = failedAttempts + 1;

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      // Trigger 10-minute lockout (600s)
      const untilTime = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
      try {
        localStorage.setItem(RESIDENT_LOCKOUT_UNTIL_KEY, untilTime.toString());
        localStorage.setItem(RESIDENT_FAILED_ATTEMPTS_KEY, MAX_FAILED_ATTEMPTS.toString());
      } catch {
        // ignore
      }
      setLockoutSeconds(LOCKOUT_DURATION_SECONDS);
      setFailedAttempts(MAX_FAILED_ATTEMPTS);
      setError(
        `🛑 Security Lockout: 5 consecutive failed login attempts reached. Portal is locked for 10 minutes (${formatLockoutTime(LOCKOUT_DURATION_SECONDS)}). Please try again later.`
      );
      onLockoutTriggered?.(email.trim());
    } else {
      setFailedAttempts(newAttempts);
      try {
        localStorage.setItem(RESIDENT_FAILED_ATTEMPTS_KEY, newAttempts.toString());
      } catch {
        // ignore
      }
      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      setError(
        `Invalid email or password. Attempt ${newAttempts} of ${MAX_FAILED_ATTEMPTS} (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before 10-minute lockout).`
      );
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
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400 shrink-0" /> : <Moon className="w-4 h-4 text-emerald-400 shrink-0" />}
            <span className="hidden sm:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      )}

      {/* Portal Header */}
      <div className="max-w-md w-full text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 text-white mb-3 shadow-lg shadow-emerald-600/30">
          <Home className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight uppercase">
          BARANGAY RESIDENT PORTAL
        </h1>
        <p className="text-emerald-400 text-xs mt-1 uppercase tracking-widest font-bold">
          Household Emergency Information & Status
        </p>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 sm:p-7 space-y-5">
          <div className="text-left border-b border-slate-100 pb-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Home className="w-4 h-4 text-emerald-600" />
              Resident Household Login
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Log in with your registered email and password to access your Citizen Emergency Status Portal.
            </p>
          </div>

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
                  5 consecutive failed attempts detected. Access is locked for 10 minutes to protect resident accounts from brute force attacks.
                </p>
              </div>
            </div>
          )}

          {error && lockoutSeconds <= 0 && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 font-medium animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  disabled={lockoutSeconds > 0}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. resident@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Account Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={lockoutSeconds > 0}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-resident-login-submit"
              disabled={lockoutSeconds > 0}
              className={`w-full py-3 font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 uppercase tracking-wider ${
                lockoutSeconds > 0
                  ? 'bg-red-950/80 border border-red-700 text-white cursor-not-allowed opacity-90'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/30 cursor-pointer'
              }`}
            >
              {lockoutSeconds > 0 ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-red-300" />
                  <span>Locked Out ({formatLockoutTime(lockoutSeconds)})</span>
                </>
              ) : (
                <>
                  <Home className="w-4 h-4" />
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
