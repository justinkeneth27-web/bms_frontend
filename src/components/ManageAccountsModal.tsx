import React, { useState } from 'react';
import { BarangayName, OfficialAccount } from '../types';
import {
  UserCog,
  X,
  Search,
  UserPlus,
  Shield,
  KeyRound,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Phone,
  Briefcase,
  Copy,
  Check,
  Lock,
  User,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Mail,
} from 'lucide-react';

interface ManageAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBarangay: BarangayName;
  currentOfficial: OfficialAccount;
  allOfficialAccounts: Record<string, OfficialAccount>;
  onUpdateAccount: (accountKey: string, updatedAccount: OfficialAccount) => void;
  onDeleteAccount: (accountKey: string, username: string) => void;
  onOpenCreateAccount: () => void;
}

const COMMON_POSITIONS = [
  'Punong Barangay / DRRM Chief',
  'Barangay Kagawad / DRRM Committee',
  'Evacuation Camp Manager',
  'Barangay Health Worker (BHW)',
  'Barangay Tanod Executive Officer',
  'Relief Distribution Lead',
  'DRRM Operations Officer',
  'Barangay Secretary',
];

export const ManageAccountsModal: React.FC<ManageAccountsModalProps> = ({
  isOpen,
  onClose,
  currentBarangay,
  currentOfficial,
  allOfficialAccounts,
  onUpdateAccount,
  onDeleteAccount,
  onOpenCreateAccount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUser, setCopiedUser] = useState<string | null>(null);

  // Card sub-modes by accountKey: 'edit' | 'password' | null
  const [activeAction, setActiveAction] = useState<{
    key: string;
    type: 'edit' | 'password';
  } | null>(null);

  // Edit fields state
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Password fields state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Delete confirmation
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<{ key: string; username: string; name: string } | null>(null);

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  // Identify whether active user has administrative authorization (Punong Barangay, Chief, Admin)
  const primaryHeadUsername = (allOfficialAccounts[currentBarangay]?.username || '').toLowerCase();
  const isCurrentUserPrimaryHead =
    (primaryHeadUsername && currentOfficial.username.toLowerCase() === primaryHeadUsername) ||
    currentOfficial.position.toLowerCase().includes('punong barangay') ||
    currentOfficial.position.toLowerCase().includes('chief') ||
    currentOfficial.position.toLowerCase().includes('captain');

  // Filter accounts belonging strictly to currentBarangay
  const accountsList = (Object.entries(allOfficialAccounts || {}) as [string, OfficialAccount][])
    .filter(([_, acc]) => acc && acc.barangay === currentBarangay)
    .map(([key, acc]) => ({
      key,
      username: acc.username,
      passwordHash: acc.passwordHash,
      barangay: acc.barangay,
      officialName: acc.officialName,
      position: acc.position,
      phone: acc.phone,
      email: acc.email,
    }));

  const filteredAccounts = accountsList.filter((acc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      acc.officialName.toLowerCase().includes(q) ||
      acc.username.toLowerCase().includes(q) ||
      acc.position.toLowerCase().includes(q) ||
      acc.phone.toLowerCase().includes(q) ||
      (acc.email && acc.email.toLowerCase().includes(q))
    );
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUser(text);
    setTimeout(() => setCopiedUser(null), 2000);
  };

  const startEdit = (key: string, acc: OfficialAccount) => {
    // Only Primary Head or owner of the account can edit
    if (!isCurrentUserPrimaryHead && acc.username.toLowerCase() !== currentOfficial.username.toLowerCase()) {
      setStatusMessage({
        text: 'Access Denied: Registered personnel can only edit their own account profile.',
        type: 'error',
      });
      return;
    }
    setActiveAction({ key, type: 'edit' });
    setEditName(acc.officialName);
    setEditPosition(acc.position);
    setEditPhone(acc.phone);
    setEditEmail(acc.email || '');
    setStatusMessage(null);
  };

  const startPasswordChange = (key: string, acc: OfficialAccount) => {
    // Only Primary Head or owner of the account can change password
    if (!isCurrentUserPrimaryHead && acc.username.toLowerCase() !== currentOfficial.username.toLowerCase()) {
      setStatusMessage({
        text: 'Access Denied: Registered personnel can only change their own password.',
        type: 'error',
      });
      return;
    }
    setActiveAction({ key, type: 'password' });
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setStatusMessage(null);
  };

  const cancelSubAction = () => {
    setActiveAction(null);
    setStatusMessage(null);
  };

  const handleSaveProfile = (key: string, originalAccount: OfficialAccount) => {
    if (!isCurrentUserPrimaryHead && originalAccount.username.toLowerCase() !== currentOfficial.username.toLowerCase()) {
      setStatusMessage({ text: 'Permission Denied: Only Primary DRRM Head can edit other accounts.', type: 'error' });
      return;
    }

    const cleanName = editName.trim();
    const cleanPos = editPosition.trim();
    const cleanPhone = editPhone.trim();
    const cleanEmail = editEmail.trim();

    if (!cleanName) {
      setStatusMessage({ text: 'Official Name cannot be empty.', type: 'error' });
      return;
    }

    const updated: OfficialAccount = {
      ...originalAccount,
      officialName: cleanName,
      position: cleanPos || 'Barangay DRRM Officer',
      phone: cleanPhone || '0917-000-0000',
      email: cleanEmail || undefined,
    };

    onUpdateAccount(key, updated);
    setStatusMessage({ text: `Profile for ${cleanName} updated successfully!`, type: 'success' });
    setActiveAction(null);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSavePassword = (key: string, originalAccount: OfficialAccount) => {
    if (!isCurrentUserPrimaryHead && originalAccount.username.toLowerCase() !== currentOfficial.username.toLowerCase()) {
      setStatusMessage({ text: 'Permission Denied: Only Primary DRRM Head can reset other accounts.', type: 'error' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setStatusMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    const updated: OfficialAccount = {
      ...originalAccount,
      passwordHash: newPassword,
    };

    onUpdateAccount(key, updated);
    setStatusMessage({ text: `Password for @${originalAccount.username} changed successfully!`, type: 'success' });
    setActiveAction(null);
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const confirmDeleteAction = () => {
    if (!confirmDeleteKey) return;
    if (!isCurrentUserPrimaryHead) {
      setStatusMessage({
        text: 'Permission Denied: Only the Primary DRRM Head has authority to delete registered accounts.',
        type: 'error',
      });
      setConfirmDeleteKey(null);
      return;
    }
    onDeleteAccount(confirmDeleteKey.key, confirmDeleteKey.username);
    setStatusMessage({
      text: `Account @${confirmDeleteKey.username} (${confirmDeleteKey.name}) has been deleted.`,
      type: 'success',
    });
    setConfirmDeleteKey(null);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">Manage Registered Accounts</h2>
                <span className="px-2.5 py-0.5 bg-blue-500/20 border border-blue-400/40 text-blue-300 rounded-full text-xs font-bold">
                  Barangay {currentBarangay}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isCurrentUserPrimaryHead
                  ? 'Administrative management of command officials, staff accounts, and credentials'
                  : 'Account profile & credentials self-management for registered personnel'}
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

        {/* Action / Search Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, position, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <span className="text-xs text-slate-500 font-medium">
              <strong>{filteredAccounts.length}</strong> {filteredAccounts.length === 1 ? 'account' : 'accounts'}
            </span>
            {isCurrentUserPrimaryHead ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateAccount();
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Register New Account</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-slate-200/80 border border-slate-300/80 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Personnel Self-Service</span>
              </div>
            )}
          </div>
        </div>

        {/* Role-Based Access Notice Banner */}
        <div className="mx-4 sm:mx-6 mt-3.5 shrink-0">
          {!isCurrentUserPrimaryHead ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Registered Personnel Access:</strong> You are logged in as <strong>{currentOfficial.officialName}</strong>. You can view registered directory accounts and manage your own credentials. Modifying or resetting other official accounts is reserved exclusively for the <strong>Primary DRRM Head</strong>.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-blue-900 text-xs shadow-2xs">
              <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Primary DRRM Head Administrator:</strong> You have full administrative authority in Barangay {currentBarangay} to register accounts, update staff details, reset passwords, or remove personnel.
              </div>
            </div>
          )}
        </div>

        {/* Global Toast / Status Message */}
        {statusMessage && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Accounts List Container */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <UserCog className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <div className="font-bold text-slate-700 text-sm">No registered accounts found</div>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No official accounts matched "{searchQuery}". You can register a new account using the button above.
              </p>
            </div>
          ) : (
            filteredAccounts.map((acc) => {
              const isCurrentSession = acc.username.toLowerCase() === currentOfficial.username.toLowerCase();
              const isRootOfficial = acc.key === 'Buang' || acc.key === 'Nagsipit' || acc.username.toLowerCase() === primaryHeadUsername;
              const canModifyThisAccount = isCurrentUserPrimaryHead || isCurrentSession;
              const isEditing = activeAction?.key === acc.key && activeAction.type === 'edit';
              const isChangingPassword = activeAction?.key === acc.key && activeAction.type === 'password';

              return (
                <div
                  key={acc.key}
                  className={`bg-white border rounded-2xl transition shadow-xs overflow-hidden ${
                    isCurrentSession
                      ? 'border-blue-300 ring-1 ring-blue-100'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Account Main Header / Summary */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                          isCurrentSession
                            ? 'bg-blue-600 text-white'
                            : isRootOfficial
                            ? 'bg-slate-800 text-amber-300'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {acc.officialName.charAt(0)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">{acc.officialName}</span>

                          {isCurrentSession && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-full text-[10px] font-bold">
                              You (Active Session)
                            </span>
                          )}

                          {isRootOfficial ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                              <Shield className="w-3 h-3 text-amber-600" />
                              <span>Primary DRRM Head</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold">
                              Registered Personnel
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">{acc.position}</span>
                          <span className="text-slate-300">•</span>
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{acc.phone || 'No phone registered'}</span>
                          {acc.email && (
                            <>
                              <span className="text-slate-300">•</span>
                              <Mail className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-blue-700 font-medium">{acc.email}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-500 flex-wrap">
                          <span className="font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                            <span>@{acc.username}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(acc.username)}
                              title="Copy username"
                              className="text-blue-400 hover:text-blue-700 cursor-pointer ml-1"
                            >
                              {copiedUser === acc.username ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                            <span>{acc.email ? 'Gmail OTP Active' : 'No Gmail Linked'}</span>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>••••••••</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Buttons or Restricted View */}
                    {!canModifyThisAccount ? (
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs font-semibold shrink-0 self-end sm:self-center"
                        title="Only the Primary DRRM Head has administrative authority to modify other accounts"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Managed by Primary DRRM Head</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => (isEditing ? cancelSubAction() : startEdit(acc.key, acc))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                            isEditing
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                          title="Edit name, position, or phone"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{isEditing ? 'Close' : 'Edit Info'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => (isChangingPassword ? cancelSubAction() : startPasswordChange(acc.key, acc))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                            isChangingPassword
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                          title="Change login password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                          <span>{isChangingPassword ? 'Close' : 'Password'}</span>
                        </button>

                        {isCurrentUserPrimaryHead ? (
                          !isRootOfficial ? (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteKey({ key: acc.key, username: acc.username, name: acc.officialName })
                              }
                              className="p-1.5 bg-white text-red-600 border border-slate-200 hover:bg-red-50 hover:border-red-200 rounded-xl transition cursor-pointer"
                              title="Delete this official account"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          ) : (
                            <span
                              className="px-2 py-1 text-[10px] text-slate-400 font-bold bg-slate-100 rounded-lg border border-slate-200"
                              title="Primary Captain account cannot be deleted"
                            >
                              Protected
                            </span>
                          )
                        ) : (
                          <span
                            className="px-2 py-1 text-[10px] text-slate-400 font-bold bg-slate-100 rounded-lg border border-slate-200"
                            title="Active login session cannot be self-deleted"
                          >
                            Active Session
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sub-panel: Edit Profile Details */}
                  {isEditing && canModifyThisAccount && (
                    <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 space-y-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4 text-blue-600" />
                          <span>Edit Profile Information for @{acc.username}</span>
                        </span>
                        <span className="text-[11px] text-slate-400">Barangay {currentBarangay} Jurisdiction</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Official Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                            placeholder="e.g. Hon. Juan Dela Cruz"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Contact Phone / Mobile <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={11}
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                            placeholder="0917xxxxxxx"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Official Gmail Address <span className="text-slate-400 font-normal">(for Gmail OTP Reset)</span>
                          </label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                            placeholder="e.g. yourname.official@gmail.com"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Position / Designation <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editPosition}
                            onChange={(e) => setEditPosition(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs mb-2"
                            placeholder="e.g. Barangay Kagawad / DRRM Committee"
                          />

                          {/* Quick Position Select Badges */}
                          <div className="flex flex-wrap gap-1.5">
                            {COMMON_POSITIONS.map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => setEditPosition(pos)}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                                  editPosition === pos
                                    ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {pos}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={cancelSubAction}
                          className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveProfile(acc.key, acc)}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sub-panel: Change Password */}
                  {isChangingPassword && canModifyThisAccount && (
                    <div className="p-4 sm:p-5 bg-amber-50/50 border-t border-amber-200 space-y-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-amber-600" />
                          <span>Change Login Password for @{acc.username}</span>
                        </span>
                        <span className="text-[11px] text-amber-700 font-medium">Minimum 6 characters</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter new password"
                              className="w-full px-3 py-2 pr-9 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Confirm New Password
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-type new password"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                        <button
                          type="button"
                          onClick={cancelSubAction}
                          className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePassword(acc.key, acc)}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Update Password</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              All personnel accounts are isolated to <strong>Barangay {currentBarangay}</strong> and verified against official duty rosters.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {confirmDeleteKey && (
          <div className="fixed inset-0 z-[220] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2.5 bg-red-100 rounded-xl">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Delete Official Account?</h3>
                  <p className="text-xs text-slate-500">This action will remove their access to this console.</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-700">
                <p>
                  <strong>Official Name:</strong> {confirmDeleteKey.name}
                </p>
                <p>
                  <strong>Username:</strong> @{confirmDeleteKey.username}
                </p>
                <p>
                  <strong>Barangay:</strong> {currentBarangay}
                </p>
              </div>

              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete this registered official account? Any historical logs
                recorded by this account will be retained for audit trails.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteKey(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAction}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
