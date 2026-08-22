import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { AuthService } from '../lib/auth';
import { AuthSession } from '../types';

interface LoginProps {
  onLoginSuccess: (session: AuthSession) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, showToast }) => {
  const [isFirstSetup, setIsFirstSetup] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // First Admin Setup Fields
  const [adminFullName, setAdminFullName] = useState<string>('System Administrator');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  useEffect(() => {
    const checkSetup = () => {
      const needed = AuthService.isInitialAdminSetupRequired();
      setIsFirstSetup(needed);
      if (needed) {
        setUsername('admin');
      }
    };
    checkSetup();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const session = await AuthService.login(username, password);
      showToast('success', `Welcome back, ${session.user.fullName}!`);
      onLoginSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check credentials.';
      setErrorMessage(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (adminPassword.length < 4) {
      const msg = 'Password must be at least 4 characters long.';
      setErrorMessage(msg);
      showToast('error', msg);
      return;
    }

    if (adminPassword !== confirmPassword) {
      const msg = 'Passwords do not match. Please re-enter carefully.';
      setErrorMessage(msg);
      showToast('error', msg);
      return;
    }

    setLoading(true);
    try {
      const session = await AuthService.setupFirstAdmin(adminPassword, adminFullName);
      showToast('success', 'Administrator account created successfully! Welcome to BUSY UFO.');
      onLoginSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Setup failed.';
      setErrorMessage(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden selection:bg-yellow-400 selection:text-slate-900">
      {/* Background Accent Grids */}
      <div className="absolute inset-0 bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Banner Header */}
        <div className="bg-[#1D4ED8] p-6 sm:p-7 text-white flex items-center justify-between border-b border-blue-600">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 bg-[#FACC15] rounded-2xl flex items-center justify-center shadow-lg font-black text-[#1E3A8A] text-2xl shrink-0">
              U
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-white">BUSY</span>
                <span className="text-2xl font-black text-[#FACC15]">UFO</span>
                <Sparkles className="w-4 h-4 text-[#FACC15] animate-pulse" />
              </div>
              <span className="text-xs text-blue-200 font-bold tracking-wider uppercase block mt-0.5">
                Accounting & Inventory Security
              </span>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end text-[10px] text-blue-200 font-mono font-bold">
            <span className="px-2 py-0.5 bg-[#FACC15] text-[#1E293B] rounded font-black">
              SL EDITION
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Title and Mode Description */}
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {isFirstSetup ? 'Initial Administrator Setup' : 'Sign in to BUSY UFO'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isFirstSetup
                ? 'Create the primary Administrator account to configure security and user rights.'
                : 'Enter your assigned system username and password to access the ERP.'}
            </p>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {isFirstSetup ? (
            /* FIRST ADMINISTRATOR SETUP FORM */
            <form onSubmit={handleFirstAdminSetup} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Default Username is fixed as <strong>admin</strong>.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Administrator Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled
                    value="admin"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-mono text-sm font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Administrator"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Set Administrator Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter strong password (min 4 chars)"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 text-sm"
              >
                <span>{loading ? 'Configuring System...' : 'Create Administrator & Start'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* NORMAL USERNAME + PASSWORD LOGIN FORM */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder="e.g. admin or sales01"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-hidden"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Username is case-insensitive (e.g. SALES01 = sales01).
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'Hide Password' : 'Show Password'}</span>
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 text-sm"
              >
                <span>{loading ? 'Verifying Credentials...' : 'Login to Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Security Guarantee Footer Note */}
          <div className="pt-4 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>BUSY-Style Strict Role & Permission Security</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
