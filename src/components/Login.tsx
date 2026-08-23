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
  Lock,
  RefreshCw,
  ServerCrash,
  Loader2
} from 'lucide-react';
import { AuthService } from '../lib/auth';
import { AuthSession } from '../types';

interface LoginProps {
  onLoginSuccess: (session: AuthSession) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type AuthStatus = 'CHECKING' | 'LOGIN' | 'FIRST_ADMIN_SETUP' | 'CONNECTION_ERROR';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, showToast }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('CHECKING');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // First Admin Setup Fields
  const [adminFullName, setAdminFullName] = useState<string>('System Administrator');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const verifyAccountStatus = async () => {
    setAuthStatus('CHECKING');
    setErrorMessage(null);

    try {
      const result = await AuthService.checkAccountStatus();
      if (result.status === 'USERS_EXIST') {
        setAuthStatus('LOGIN');
      } else if (result.status === 'ZERO_USERS') {
        setAuthStatus('FIRST_ADMIN_SETUP');
        setUsername('admin');
      } else {
        setAuthStatus('CONNECTION_ERROR');
        setErrorMessage(
          result.error || 'Unable to connect to the server. Please check your internet connection and try again.'
        );
      }
    } catch (err: any) {
      setAuthStatus('CONNECTION_ERROR');
      setErrorMessage(
        err?.message || 'Unable to connect to the server. Please check your internet connection and try again.'
      );
    }
  };

  useEffect(() => {
    verifyAccountStatus();
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

        {/* Dynamic Card Content Based on authStatus */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* 1. CHECKING STATUS STATE */}
          {authStatus === 'CHECKING' && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Checking account...</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Connecting to secure database to verify credentials...
                </p>
              </div>
            </div>
          )}

          {/* 2. CONNECTION ERROR STATE */}
          {authStatus === 'CONNECTION_ERROR' && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <ServerCrash className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Server Connection Required
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {errorMessage || 'Unable to connect to the server. Please check your internet connection and try again.'}
                  </p>
                </div>
              </div>

              <div className="text-center text-xs text-slate-500">
                To safeguard user accounts, authentication requires an active connection to the database.
              </div>

              <button
                type="button"
                onClick={verifyAccountStatus}
                className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Connection</span>
              </button>
            </div>
          )}

          {/* 3. NORMAL LOGIN OR FIRST ADMIN SETUP FORM */}
          {(authStatus === 'LOGIN' || authStatus === 'FIRST_ADMIN_SETUP') && (
            <>
              {/* Title and Mode Description */}
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {authStatus === 'FIRST_ADMIN_SETUP' ? 'Create First Administrator' : 'Sign in to BUSY UFO'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {authStatus === 'FIRST_ADMIN_SETUP'
                    ? 'No user accounts currently exist in the database. Create the primary Administrator account to start.'
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

              {authStatus === 'FIRST_ADMIN_SETUP' ? (
                /* FIRST ADMINISTRATOR SETUP FORM (ONLY SHOWN IF EXACTLY 0 USERS IN SUPABASE) */
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
            </>
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

