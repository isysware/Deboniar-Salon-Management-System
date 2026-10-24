import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { getDefaultRouteForRole } from '@/lib/permissions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface AccessDeniedViewProps {
  attemptedPath: string;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({ attemptedPath }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const handleReturn = () => {
    if (user) {
      navigate(getDefaultRouteForRole(user.role));
    } else {
      navigate('/');
    }
  };

  return (
    <div className="py-12 flex items-center justify-center font-sans">
      <Card padding="lg" className="max-w-xl w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600 shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
            Access Restricted
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-3">
            Insufficient Role Permissions
          </h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Your current account role (<span className="font-semibold text-slate-800">{user?.role}</span>) is not authorized to access <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-medium">{attemptedPath}</code>.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Security Architecture Standard:</p>
          <p>
            SalonOS enforces strict multi-role isolation. Staff members have private, personal read-only views, while financial, reporting, and operational consoles are isolated to authorized Branch Administrators and Financial Custodians.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Button
            variant="default"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={handleReturn}
          >
            Return to Authorized Workspace
          </Button>
        </div>
      </Card>
    </div>
  );
};
