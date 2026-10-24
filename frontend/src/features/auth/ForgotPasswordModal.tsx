import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { PortalType } from '@/types/auth';
import { authService, PasswordResetResponse } from '@/services';
import { Mail, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  portal: PortalType;
  initialIdentifier?: string;
  onAutofill?: (email: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  portal,
  initialIdentifier = '',
  onAutofill,
}) => {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<PasswordResetResponse | null>(null);

  const portalNames: Record<PortalType, string> = {
    SUPER_ADMIN: 'Super Administrator',
    ADMIN: 'Branch Administrator',
    ACCOUNTANT: 'Sales and Billing',
    STAFF: 'Staff / Stylist',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await authService.requestPasswordReset(identifier, portal);
      setResult(res);
    } catch (err: any) {
      setResult({
        success: false,
        userEmail: identifier,
        message: err.message || 'Failed to simulate password recovery.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetModalClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleResetModalClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Account Password</DialogTitle>
          <DialogDescription>
            Account recovery request for {portalNames[portal]} portal
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-1">
            {result.success ? (
              <Alert variant="success" className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <AlertTitle className="text-emerald-800 text-sm">Recovery Request Processed</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                  {result.simulatedToken && (
                    <p className="mt-2 text-slate-700 bg-white/80 p-2 rounded border border-emerald-200/60 text-[11px]">
                      Security Verification Reference:{' '}
                      <span className="font-semibold">{result.simulatedToken}</span>
                    </p>
                  )}
                </div>
              </Alert>
            ) : (
              <Alert variant="destructive" className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <AlertTitle className="text-rose-800 text-sm">Account Lookup Failed</AlertTitle>
                  <AlertDescription className="mt-1">{result.message}</AlertDescription>
                </div>
              </Alert>
            )}

            <Alert variant="info" className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#2254E1] shrink-0 mt-0.5" />
              <div>
                <AlertTitle className="text-slate-900 text-xs font-semibold mb-0.5">
                  Account Security Notice
                </AlertTitle>
                <AlertDescription className="text-slate-600">
                  Password recovery details have been verified against your role portal directory.
                  You can now return to the login screen and sign in.
                </AlertDescription>
              </div>
            </Alert>

            <DialogFooter className="pt-2">
              <Button variant="default" size="sm" onClick={handleResetModalClose}>
                Return to Login
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Enter your registered email address or employee identifier. An account verification
              check will be performed against the {portalNames[portal]} directory.
            </p>

            <Input
              label="Email or Username"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. admin.gulberg@isysware.com"
              leftElement={<Mail className="w-4 h-4" />}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="default" size="sm" isLoading={isSubmitting}>
                Request Password Reset
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
