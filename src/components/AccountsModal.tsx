import React from 'react';
import { BarangayName, OfficialAccount } from '../types';
import { OFFICIAL_ACCOUNTS } from '../data/initialData';
import { Shield, Key, CheckCircle, X, ArrowRight, UserCheck, UserPlus, Users, UserCog } from 'lucide-react';

interface AccountsModalProps {
  currentBarangay: BarangayName;
  officialAccounts?: Record<string, OfficialAccount>;
  onSwitchBarangay: (barangay: BarangayName) => void;
  onOpenCreateAccount?: () => void;
  onOpenManageAccount?: () => void;
  onClose: () => void;
}

export const AccountsModal: React.FC<AccountsModalProps> = ({
  currentBarangay,
  officialAccounts,
  onSwitchBarangay,
  onOpenCreateAccount,
  onOpenManageAccount,
  onClose,
}) => {
  const allAccounts = Object.values(officialAccounts || {}) as OfficialAccount[];
  const buangAcc = (officialAccounts && officialAccounts.Buang) || allAccounts.find((a) => a.barangay === 'Buang');
  const nagsipitAcc = (officialAccounts && officialAccounts.Nagsipit) || allAccounts.find((a) => a.barangay === 'Nagsipit');

  const buangStaff = allAccounts.filter(
    (a) => a.barangay === 'Buang' && a.username.toLowerCase() !== buangAcc?.username?.toLowerCase()
  );
  const nagsipitStaff = allAccounts.filter(
    (a) => a.barangay === 'Nagsipit' && a.username.toLowerCase() !== nagsipitAcc?.username?.toLowerCase()
  );
  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">Barangay Official Credentials & Accounts</h2>
              <p className="text-xs text-slate-400">Authenticated personnel roster registered in database</p>
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

        <div className="p-6 space-y-6 text-xs text-slate-700">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 leading-relaxed">
            <strong>Security Notice:</strong> Each Barangay has separate fixed official login credentials to strictly isolate administrative dashboards, household monitoring lists, and evacuation center capacity.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Barangay Buang */}
            <div
              className={`p-5 rounded-2xl border-2 transition space-y-3 ${
                currentBarangay === 'Buang'
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <span>📍 Barangay Buang</span>
                </span>
                {currentBarangay === 'Buang' && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">
                    Active Session
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div>Official: <strong>{buangAcc?.officialName || 'Hon. Rolando M. Santos'}</strong></div>
                <div>Position: <span className="text-slate-500">{buangAcc?.position || 'Punong Barangay / DRRM Chief'}</span></div>
                <div>Contact: <span className="font-mono">{buangAcc?.phone || '0917-555-0101'}</span></div>
                <div>Username: <span className="font-mono font-bold text-blue-700">{buangAcc?.username || 'Buangadmin.gov'}</span></div>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Access Level:</span>
                  <strong className="text-slate-800">DRRM Barangay Administrator</strong>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Credentials Status:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Secure & Encrypted
                  </span>
                </div>
              </div>

              {buangStaff.length > 0 && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    <span>Additional Staff Accounts ({buangStaff.length})</span>
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {buangStaff.map((staff) => (
                      <div key={staff.username} className="p-1.5 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[10px]">
                        <div>
                          <div className="font-bold text-slate-800">{staff.officialName}</div>
                          <div className="text-slate-500 text-[9px]">{staff.position}</div>
                        </div>
                        <span className="font-mono text-blue-600 font-semibold">{staff.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentBarangay !== 'Buang' && (
                <button
                  type="button"
                  onClick={() => {
                    onSwitchBarangay('Buang');
                    onClose();
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Switch to Barangay Buang</span>
                </button>
              )}
            </div>

            {/* Barangay Nagsipit */}
            <div
              className={`p-5 rounded-2xl border-2 transition space-y-3 ${
                currentBarangay === 'Nagsipit'
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <span>📍 Barangay Nagsipit</span>
                </span>
                {currentBarangay === 'Nagsipit' && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">
                    Active Session
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div>Official: <strong>{nagsipitAcc?.officialName || 'Hon. Cynthia P. Ramos'}</strong></div>
                <div>Position: <span className="text-slate-500">{nagsipitAcc?.position || 'Disaster Risk Reduction Officer'}</span></div>
                <div>Contact: <span className="font-mono">{nagsipitAcc?.phone || '0918-777-0202'}</span></div>
                <div>Username: <span className="font-mono font-bold text-blue-700">{nagsipitAcc?.username || 'Nagsipitadmin.gov'}</span></div>
              </div>

              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Access Level:</span>
                  <strong className="text-slate-800">DRRM Barangay Administrator</strong>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Credentials Status:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Secure & Encrypted
                  </span>
                </div>
              </div>

              {nagsipitStaff.length > 0 && (
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    <span>Additional Staff Accounts ({nagsipitStaff.length})</span>
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {nagsipitStaff.map((staff) => (
                      <div key={staff.username} className="p-1.5 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[10px]">
                        <div>
                          <div className="font-bold text-slate-800">{staff.officialName}</div>
                          <div className="text-slate-500 text-[9px]">{staff.position}</div>
                        </div>
                        <span className="font-mono text-blue-600 font-semibold">{staff.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentBarangay !== 'Nagsipit' && (
                <button
                  type="button"
                  onClick={() => {
                    onSwitchBarangay('Nagsipit');
                    onClose();
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Switch to Barangay Nagsipit</span>
                </button>
              )}
            </div>
          </div>

          {(onOpenCreateAccount || onOpenManageAccount) && (
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <span className="text-[11px] text-slate-500">
                Official and personnel account directory for Barangay {currentBarangay}
              </span>
              <div className="flex items-center gap-2">
                {onOpenManageAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenManageAccount();
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    <span>Manage Accounts</span>
                  </button>
                )}
                {onOpenCreateAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCreateAccount();
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ New Account</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
