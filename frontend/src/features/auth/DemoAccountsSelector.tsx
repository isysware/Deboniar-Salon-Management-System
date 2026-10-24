import React from 'react';
import { DEMO_CREDENTIALS } from '../../config/constants';
import { PortalType, DemoCredential } from '../../types/auth';
import { ShieldCheck, UserCheck, Calculator, Scissors, ArrowRight, Sparkles } from 'lucide-react';

interface DemoAccountsSelectorProps {
  currentPortal: PortalType;
  onSelectCredential: (cred: DemoCredential) => void;
}

export const DemoAccountsSelector: React.FC<DemoAccountsSelectorProps> = ({
  currentPortal,
  onSelectCredential,
}) => {
  const getIcon = (portal: PortalType) => {
    switch (portal) {
      case 'SUPER_ADMIN':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'ADMIN':
        return <UserCheck className="w-4 h-4 text-[#2254E1]" />;
      case 'ACCOUNTANT':
        return <Calculator className="w-4 h-4 text-emerald-600" />;
      case 'STAFF':
        return <Scissors className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#2254E1]" />
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Quick Login Portals
          </h4>
        </div>
        <span className="text-[11px] text-slate-400">Role accounts</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DEMO_CREDENTIALS.map((cred) => {
          const isSelected = cred.portal === currentPortal;
          return (
            <button
              key={cred.portal}
              type="button"
              onClick={() => onSelectCredential(cred)}
              className={`text-left p-3 rounded-lg border transition-all duration-150 cursor-pointer group relative ${
                isSelected
                  ? 'border-[#2254E1] bg-blue-50/50 shadow-xs ring-1 ring-[#2254E1]/30'
                  : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-white border border-slate-200/80 shadow-2xs">
                    {getIcon(cred.portal)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-[#2254E1] transition-colors flex items-center gap-1">
                      <span>{cred.label}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all text-[#2254E1]" />
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[170px]">
                      {cred.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                <span className="truncate max-w-[130px] font-medium text-slate-600">
                  {cred.branchName.split('(')[0]}
                </span>
                <span className="font-mono text-[10px] text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
                  {cred.password}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
