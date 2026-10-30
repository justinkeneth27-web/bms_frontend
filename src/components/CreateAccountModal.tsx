import React, { useState } from 'react';
import { BarangayName, OfficialAccount } from '../types';
import {
  Shield,
  X,
  User,
  Lock,
  Phone,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Building2,
  Mail,
} from 'lucide-react';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBarangay: BarangayName;
  currentOfficial: OfficialAccount;
  existingAccounts: OfficialAccount[];
  onCreateAccount: (newAccount: OfficialAccount) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  currentBarangay,
  currentOfficial,
  existingAccounts,
  onCreateAccount,
}) => {
  const [officialName, setOfficialName] = useState('');
  const [position, setPosition] = useState('Kagawad / DRRM Committee');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanName = officialName.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError('Please provide the full name of the official.');
      return;
    }

    if (!cleanUsername) {
      setError('Please provide an official username.');
      return;
    }

    // Check username uniqueness
    const lowerUser = cleanUsername.toLowerCase();
    const isTaken = existingAccounts.some(
      (acc) => acc.username.toLowerCase() === lowerUser
    );
    if (isTaken) {
      setError(`The username "${cleanUsername}" is already registered. Please choose another username.`);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    // Strict isolation: The new account is automatically and permanently created for currentBarangay
    const newAccount: OfficialAccount = {
      username: cleanUsername,
      passwordHash: password,
      barangay: currentBarangay,
      officialName: cleanName,
      position: position.trim() || 'Barangay DRRM Officer',
      phone: cleanPhone || '0917-000-0000',
      email: email.trim() || undefined,
    };

    onCreateAccount(newAccount);
    setSuccessMsg(`Official account "${cleanUsername}" for Barangay ${currentBarangay} created successfully!`);

    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
      // Reset form
      setOfficialName('');
      setPosition('Kagawad / DRRM Committee');
      setPhone('');
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>Create Official Account</span>
                <span className="px-2 py-0.5 bg-blue-500/30 border border-blue-400/40 text-blue-300 rounded text-[11px] font-bold">
                  {currentBarangay}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Authorized DRRM command staff account registration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs">
          {/* Jurisdiction Notice - Locked to Current Barangay */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-blue-900">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Strict Jurisdiction Isolation:</strong> Because you are currently logged in to{' '}
              <span className="font-bold underline">Barangay {currentBarangay}</span>, this new official account will automatically be created in and bound to{' '}
              <strong className="text-blue-700">Barangay {currentBarangay}</strong>.
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span className="leading-relaxed font-medium">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Assigned Barangay (Read-Only) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Barangay Jurisdiction (Auto-Locked)
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                disabled
                value={`Barangay ${currentBarangay} (Active Session)`}
                className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-bold text-xs cursor-not-allowed select-none"
              />
              <span className="absolute right-3 top-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Isolated
              </span>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Official Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={officialName}
                onChange={(e) => setOfficialName(e.target.value)}
                placeholder="e.g. Kagawad Juan A. Dela Cruz"
                required
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Position & Contact Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Official Position / Role <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. DRRM Kagawad / Camp Manager"
                  required
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Contact / Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="09175550199"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Official Gmail Address for OTP */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Official Gmail Address <span className="text-slate-400 font-normal">(For Gmail SMTP Password Reset OTP)</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. official.name@gmail.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Official Username <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={`e.g. ${currentBarangay.toLowerCase()}.officer1 or ${currentBarangay}admin2.gov`}
                required
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Will be used to log in directly to the Barangay {currentBarangay} Disaster Command Center.
            </p>
          </div>

          {/* Password & Confirm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!successMsg}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg ? 'Account Created!' : `Create Account in Barangay ${currentBarangay}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
