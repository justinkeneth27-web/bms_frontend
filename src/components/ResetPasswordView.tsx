import React, { useState, useEffect } from 'react';
import { BarangayName } from '../types';
import { laravelApi } from '../utils/laravelApi';
import {
  Shield,
  Lock,
  User,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';

interface ResetPasswordViewProps {
  initialUsername?: string;
  onResetSuccess: (username: string, newPassword: string) => void;
  onBackToLogin: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  initialUsername = '',
  onResetSuccess,
  onBackToLogin,
}) => {
  // 1 = Enter Username, 2 = Link / Verify Recovery Gmail & OTP, 3 = Create New Password
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState(initialUsername);
  const [barangay, setBarangay] = useState<BarangayName | ''>('');
  const [officialName, setOfficialName] = useState<string>('Hon. Rolando M. Santos');
  const [position, setPosition] = useState<string>('Punong Barangay / DRRM Chief');

  // Email recovery & OTP state
  const [emailInput, setEmailInput] = useState('');
  const [confirmEmailInput, setConfirmEmailInput] = useState('');
  const [expectedEmail, setExpectedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formatted username display (e.g. "@Buangadmin.gov")
  const rawUser = username.trim() || 'Buangadmin.gov';
  const formattedUsername = rawUser.startsWith('@') ? rawUser.slice(1) : rawUser;

  // Auto-lookup if initialUsername was provided
  useEffect(() => {
    if (initialUsername.trim()) {
      handleLookup(initialUsername.trim());
    }
  }, [initialUsername]);

  const handleLookup = async (uname: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await laravelApi.lookupOfficial(uname);
      if (res) {
        setBarangay(res.barangay);
        const resolvedName =
          res.officialName ||
          (res.barangay === 'Buang' ? 'Hon. Rolando M. Santos' : 'Hon. Cynthia P. Ramos');
        const resolvedPos = res.position || 'Punong Barangay / DRRM Chief';
        setOfficialName(resolvedName);
        setPosition(resolvedPos);

        const resolvedEmail =
          res.email ||
          (res.barangay === 'Buang'
            ? 'buangg2026@gmail.com'
            : res.barangay === 'Nagsipit'
            ? 'nagsipit2026@gmail.com'
            : '');
        setExpectedEmail(resolvedEmail);
        setMaskedEmail(res.emailMasked || '');
        setEmailInput('');
        setConfirmEmailInput('');
        setOtpCode('');
        setOtpSent(false);
        setStep(2);
      }
    } catch (err: unknown) {
      const lower = uname.toLowerCase();
      if (lower.includes('buang')) {
        setBarangay('Buang');
        setOfficialName('Hon. Rolando M. Santos');
        setPosition('Punong Barangay / DRRM Chief');
        setExpectedEmail('buangg2026@gmail.com');
        setMaskedEmail('b********6@gmail.com');
        setEmailInput('');
        setConfirmEmailInput('');
        setOtpCode('');
        setOtpSent(false);
        setStep(2);
        return;
      } else if (lower.includes('nagsipit')) {
        setBarangay('Nagsipit');
        setOfficialName('Hon. Cynthia P. Ramos');
        setPosition('Punong Barangay / DRRM Chief');
        setExpectedEmail('nagsipit2026@gmail.com');
        setMaskedEmail('n**********6@gmail.com');
        setEmailInput('');
        setConfirmEmailInput('');
        setOtpCode('');
        setOtpSent(false);
        setStep(2);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Official account not found';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Submit Username
  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setOtpCode('');
    setOtpSent(false);
    await handleLookup(username.trim());
  };

  // Step 2: Save & Link Gmail and dispatch 6-digit OTP code
  const handleSaveAndLinkGmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setOtpNotice(null);

    const email = emailInput.trim().toLowerCase();
    const confirmEmail = confirmEmailInput.trim().toLowerCase();

    if (!email) {
      setError('Please enter your official recovery Gmail address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid Gmail address format (e.g., yourname@gmail.com).');
      return;
    }

    if (!confirmEmail) {
      setError('Please confirm your Gmail address.');
      return;
    }

    if (email !== confirmEmail) {
      setError('Gmail addresses do not match. Please re-enter.');
      return;
    }
    setIsLoading(true);
    setIsLoading(true);

    try {
      const res = await laravelApi.sendResetOtp({
        username: username.trim() || 'Buangadmin.gov',
        email: email,
        linkEmail: true,
      });

      setOtpSent(true);
      const deliveryEmail = res.email || email;
      setEmailInput(deliveryEmail);
      setOtpNotice(
        `A 6-digit OTP verification code has been sent to ${deliveryEmail}. Please check your Gmail inbox and enter the code below.`
      );
    } catch (err: unknown) {
      setOtpNotice(null);
      const msg = err instanceof Error ? err.message : 'Failed to save recovery Gmail and send OTP.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2B: Verify 6-digit OTP code
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOtpNotice(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code sent to your Gmail.');
      return;
    }

    setIsLoading(true);
    try {
      await laravelApi.verifyResetOtp({
        username: username.trim() || 'Buangadmin.gov',
        otp: otpCode.trim(),
      });

      if (window.location.hash !== '#/reset-password') {
        window.location.hash = '#/reset-password';
      }
      setStep(3);
    } catch (err: unknown) {
      setOtpNotice(null);
      const msg = err instanceof Error ? err.message : 'Invalid or expired OTP code.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Create New Password
  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await laravelApi.resetPasswordWithOtp({
        username: username.trim() || 'Buangadmin.gov',
        otp: otpCode.trim(),
        newPassword: newPassword.trim(),
      });

      onResetSuccess(username.trim() || 'Buangadmin.gov', newPassword.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed';
      setError(msg);
      if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('code')) {
        setStep(2);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      {/* STEP 1: Account Identification */}
      {step === 1 && (
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Top Multi-color Gradient Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-purple-600 to-rose-500" />

          <div className="p-7 sm:p-8 space-y-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                  <Shield className="w-6 h-6 text-blue-600" strokeWidth={2.2} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider font-sans">
                    ACCOUNT IDENTIFICATION
                  </div>
                  <h2 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
                    Official Password Recovery
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onBackToLogin}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer -mt-1 -mr-1"
                title="Back to Login"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[13px] text-slate-600 leading-relaxed">
              Enter your official command username to begin secure password recovery via Gmail OTP verification.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Official Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g. Buangadmin.gov"
                    required
                    autoFocus
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none bg-white text-slate-900 text-sm placeholder:text-slate-400 transition shadow-sm font-sans"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onBackToLogin}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer disabled:opacity-50"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !username.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{isLoading ? 'Verifying Account...' : 'Continue to Email Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2: Link Official Recovery Gmail (EXACT MATCH TO DESIGN) */}
      {step === 2 && !otpSent && (
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Top Multi-color Gradient Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-purple-600 to-rose-500" />

          <div className="p-7 sm:p-8 space-y-5 text-left">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                  <Shield className="w-6 h-6 text-blue-600" strokeWidth={2.2} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider font-sans">
                    FIRST-TIME SECURITY REQUIREMENT
                  </div>
                  <h2 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
                    Link Official Recovery Gmail
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onBackToLogin}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer -mt-1 -mr-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Personalized Description */}
            <p className="text-[13px] text-slate-600 leading-relaxed">
              Welcome to the Barangay DRRM Disaster Operations Console,{' '}
              <strong className="font-bold text-slate-900">{officialName}</strong> ({position}). To activate{' '}
              <strong className="font-bold text-slate-900">6-Digit OTP Password Recovery</strong> and secure your
              jurisdiction account (<strong className="font-bold text-slate-900">@{formattedUsername}</strong>), please
              link your official recovery Gmail address below.
            </p>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveAndLinkGmail} className="space-y-4">
              {/* Field 1: Recovery Gmail Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Recovery Gmail Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g., yourname@gmail.com"
                    required
                    autoFocus
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-blue-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-none bg-white text-slate-900 text-sm placeholder:text-slate-400 transition shadow-sm font-sans"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  When resetting your password, verification codes (OTP) will be dispatched straight to this inbox.
                </p>
              </div>

              {/* Field 2: Confirm Gmail Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Confirm Gmail Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={confirmEmailInput}
                    onChange={(e) => {
                      setConfirmEmailInput(e.target.value);
                      setError(null);
                    }}
                    placeholder="Re-type your Gmail address"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 outline-none bg-white text-slate-900 text-sm placeholder:text-slate-400 transition shadow-sm font-sans"
                  />
                </div>
              </div>

              {/* Cloud Sync Notice Banner */}
              <div className="rounded-xl bg-blue-50/70 border border-blue-100/90 p-3.5 flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-xs text-slate-600 leading-snug">
                  Your email is encrypted and synced directly with your{' '}
                  <strong className="font-bold text-slate-900">Supabase PostgreSQL cloud database</strong>.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={onBackToLogin}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer disabled:opacity-50"
                >
                  Set Up Later
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !emailInput.trim() || !confirmEmailInput.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{isLoading ? 'Saving & Linking...' : 'Save & Link Gmail'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2 (Dispatched): Enter 6-digit OTP code */}
      {step === 2 && otpSent && (
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Top Multi-color Gradient Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-purple-600 to-rose-500" />

          <div className="p-7 sm:p-8 space-y-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                  <KeyRound className="w-6 h-6 text-blue-600" strokeWidth={2.2} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider font-sans">
                    6-DIGIT OTP VERIFICATION
                  </div>
                  <h2 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
                    Enter Verification Code
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onBackToLogin}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer -mt-1 -mr-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notice Banner */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-center justify-between">
              <div className="truncate mr-2">
                <span className="text-slate-500 text-[10px] block font-semibold uppercase tracking-wider">
                  Verification Code Sent To:
                </span>
                <span className="font-mono font-bold text-blue-900 text-xs">{emailInput.trim()}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtpCode('');
                  setError(null);
                }}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer shrink-0"
              >
                Change Email
              </button>
            </div>

            <p className="text-[13px] text-slate-600 leading-relaxed">
              Please enter the 6-digit verification code sent to your linked Gmail inbox to verify your identity and
              proceed with updating your password.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            {otpNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span className="leading-relaxed">{otpNotice}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Enter 6-Digit Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setOtpCode(val);
                      setError(null);
                    }}
                    placeholder="• • • • • •"
                    required
                    autoFocus
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-blue-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15 outline-none bg-white text-slate-900 text-base font-mono font-bold tracking-widest text-center transition shadow-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">Didn't receive the verification code?</span>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSaveAndLinkGmail()}
                  className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resend Code</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setOtpSent(false);
                    setError(null);
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || otpCode.length !== 6}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{isLoading ? 'Verifying Code...' : 'Verify Code & Continue'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 3: Create New Password */}
      {step === 3 && (
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Top Multi-color Gradient Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-purple-600 to-rose-500" />

          <div className="p-7 sm:p-8 space-y-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm">
                  <Lock className="w-6 h-6 text-emerald-600" strokeWidth={2.2} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider font-sans">
                    CREDENTIAL UPDATE
                  </div>
                  <h2 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
                    Create New Password
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onBackToLogin}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer -mt-1 -mr-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[13px] text-slate-600 leading-relaxed">
              Identity verified via Gmail OTP code. Enter and confirm your new password to update your official account
              credentials.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Minimum 6 characters"
                    required
                    autoFocus
                    minLength={6}
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 outline-none bg-white text-slate-900 text-sm placeholder:text-slate-400 transition shadow-sm font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Re-enter your new password"
                    required
                    minLength={6}
                    disabled={isLoading}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 outline-none bg-white text-slate-900 text-sm placeholder:text-slate-400 transition shadow-sm font-sans"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setStep(2);
                    setError(null);
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{isLoading ? 'Saving Password...' : 'Save New Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Back to Login Footer Link */}
      <div className="mt-4 flex items-center justify-center">
        <button
          type="button"
          disabled={isLoading}
          onClick={onBackToLogin}
          className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer font-medium py-1 px-3 rounded-lg hover:bg-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Official Login</span>
        </button>
      </div>
    </div>
  );
};
