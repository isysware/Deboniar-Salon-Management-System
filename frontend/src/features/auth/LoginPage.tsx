import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { PortalType } from '@/types/auth';
import { getDefaultRouteForRole } from '@/lib/permissions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { toast } from '@/context/ToastContext';
import {
  Scissors,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Building2,
  Coins,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { navigate } = useRouter();

  const [selectedPortal, setSelectedPortal] = useState<PortalType>('SUPER_ADMIN');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  // Restore remembered identifier on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const remembered = localStorage.getItem('isysware_salon_remembered_id');
      if (remembered) {
        setIdentifier(remembered);
        setRememberMe(true);
      }
    }
  }, []);

  const handlePortalChange = (newPortal: string) => {
    setSelectedPortal(newPortal as PortalType);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      const msg = 'Please enter your email or username.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }
    if (!password) {
      const msg = 'Please enter your password.';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await login({
        portal: selectedPortal,
        identifier: identifier.trim(),
        password,
        rememberMe,
      });

      toast.success('Signed in successfully!');
      const destination = getDefaultRouteForRole(session.user.role);
      navigate(destination);
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F5F7FB] font-sans">
      {/* LEFT BRANDING PANEL (~65% on Desktop) */}
      <div className="relative w-full lg:w-[60%] xl:w-[63%] bg-gradient-to-br from-[#2254E1] via-[#1B3FC5] to-[#122A8C] text-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between overflow-hidden">
        {/* Subtle Decorative Geometric Waves and Radial Glows */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />

        {/* Decorative Grid Lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>

        {/* Top Brand Lockup */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
              <Scissors className="w-5 h-5 text-white transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">iSysware</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/20 font-semibold text-white/95">
                  SalonOS
                </span>
              </div>
              <p className="text-[11px] text-blue-100 font-normal">Enterprise Management Suite</p>
            </div>
          </div>
        </div>

        {/* Hero Narrative */}
        <div className="relative z-10 my-6 lg:my-8 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-xs font-normal text-blue-100 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
            <span>Salon Management System · Multi-Branch Workspace</span>
          </div>

          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-semibold tracking-tight text-white leading-tight">
            Your salon. Every branch. One workspace.
          </h1>

          <p className="mt-3 text-sm sm:text-base text-blue-100 font-normal leading-relaxed">
            Unify appointments, POS billing, staff shifts, cash custody, and multi-location financial oversight into a single role-aware operating system.
          </p>

          {/* Three Short Benefit Rows */}
          <div className="mt-6 space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">Multi-Branch Consolidated Control</h4>
                <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
                  Toggle between high-level consolidated analytics and branch-specific operational drawers in real-time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <Coins className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">Audited Cash Custody & Shift Settlement</h4>
                <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
                  Segregate tips from salon revenue, enforce physical drawer balance accountability, and prevent self-approval.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-white">Strict Role & Privacy Isolation</h4>
                <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
                  Tailored portals for Executives, Branch Managers, Financial Cashiers, and Personal Stylist views.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="relative z-10 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-200">
          <p>© 2026 iSysware Technologies Inc. All rights reserved.</p>
          <p className="font-normal text-white/80">Powered by iSysware Enterprise</p>
        </div>
      </div>

      {/* RIGHT LOGIN PANEL (~38% on Desktop) */}
      <div className="w-full lg:w-[42%] xl:w-[38%] bg-white p-6 sm:p-10 lg:p-12 xl:p-14 flex flex-col justify-between shadow-xl lg:shadow-none min-h-screen overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#2254E1] text-xs font-semibold mb-3 border border-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-[#2254E1]" />
              <span>Secure Portal Access</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Select your role portal and authenticate to access your workspace.
            </p>
          </div>

          {/* Portal Selector Tabs using shadcn Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-700 mb-2 font-sans uppercase tracking-wider">
              Select Portal Target
            </label>
            <Tabs value={selectedPortal} onValueChange={handlePortalChange} className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-12 p-1.5 bg-slate-100/90 rounded-xl">
                <TabsTrigger value="SUPER_ADMIN" className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2254E1] data-[state=active]:shadow-xs">
                  Super Admin
                </TabsTrigger>
                <TabsTrigger value="ADMIN" className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2254E1] data-[state=active]:shadow-xs">
                  Admin
                </TabsTrigger>
                <TabsTrigger value="ACCOUNTANT" className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2254E1] data-[state=active]:shadow-xs" title="Sales & Billing Portal">
                  Sales & Billing
                </TabsTrigger>
                <TabsTrigger value="STAFF" className="text-xs sm:text-[12.5px] font-semibold py-2 px-1 truncate rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2254E1] data-[state=active]:shadow-xs">
                  Staff
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Error Banner using shadcn Alert */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-5 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <AlertTitle className="text-xs font-semibold text-rose-800">
                  Authentication Notice
                </AlertTitle>
                <AlertDescription className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                  {errorMessage}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Username or Email"
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. superadmin@isysware.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftElement={<Mail className="w-4 h-4" />}
              className="h-12 rounded-xl text-sm"
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Enter your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftElement={<Lock className="w-4 h-4" />}
              className="h-12 rounded-xl text-sm"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* Remember Me & Forgot Password using shadcn Checkbox & Label */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="remember-me" className="text-xs text-slate-600 cursor-pointer font-medium">
                  Remember identifier
                </Label>
              </div>

              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-xs font-semibold text-[#2254E1] hover:text-[#1B3FC5] transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button using shadcn Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="default"
                size="lg"
                isLoading={isSubmitting}
                className="w-full h-12.5 rounded-xl font-semibold text-sm shadow-md shadow-blue-600/20"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Login to Portal
              </Button>
            </div>
          </form>
        </div>

        {/* Bottom Security Footer */}
        <div className="w-full max-w-md mx-auto pt-6 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            256-bit Encrypted Session
          </span>
          <span>v2.1 · PRA / SRB Certified</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        portal={selectedPortal}
        initialIdentifier={identifier}
      />
    </div>
  );
};
