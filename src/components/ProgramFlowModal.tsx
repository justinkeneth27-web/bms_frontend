import React from 'react';
import { FileText, X, AlertTriangle } from 'lucide-react';

interface ProgramFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProgramFlowModal: React.FC<ProgramFlowModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">Program Flow</h2>
              <p className="text-xs text-slate-400">How the System Works</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs leading-relaxed">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            This guide explains how the system works.
          </p>

          {/* Step 1 */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1 space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Create or Register an Account
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  A Barangay official creates a household record for the family. This gives the family a login ID and password.
                </p>
                <div className="pt-0.5">
                  <span className="inline-block px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-md text-xs font-mono font-bold">
                    https://&lt;example.com&gt;/#/household/register
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1 space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Resident Logs In
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  The resident opens the Citizen Emergency Status Portal and enters their login ID and password.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  At the end of the .com or .dev add &quot;resident-login&quot;
                </p>
                <div className="pt-0.5">
                  <span className="inline-block px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-md text-xs font-mono font-bold">
                    https://&lt;example.com&gt;/#/resident-login
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div className="flex-1 space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  View Household Status
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  The resident sees their household status. The status can be Safe, Moderate, or Emergency.
                </p>
                <div className="pt-0.5">
                  <span className="inline-block px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-md text-xs font-mono font-bold">
                    https://&lt;example.com&gt;/#/household/status
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                4
              </div>
              <div className="flex-1 space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Receive Barangay Alerts
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  The resident receives important updates from the Barangay. This includes evacuation orders and emergency notices.
                </p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 pt-1">
                  Shown on the resident dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Note Box */}
          <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong className="font-bold text-amber-950 dark:text-amber-100">Note:</strong> The addresses above are written in simple form. The exact address depends on the website address used by your Barangay. Use the address shown by your official when using the system.
            </div>
          </div>

          {/* Help Contact */}
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-1">
            For questions, contact the Barangay DRRM Office.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs transition cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

