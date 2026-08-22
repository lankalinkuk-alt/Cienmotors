import React, { useState } from 'react';
import {
  Wallet,
  Sparkles,
  Menu,
  X,
  ArrowLeft,
  ArrowRight,
  User,
  LogOut,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  Lock,
  Building2,
  ChevronDown,
  Check,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { AppSettings, PageType, AuthSession } from '../types';
import { checkPermission } from '../lib/permissions';
import { AuthService } from '../lib/auth';

interface HeaderProps {
  settings: AppSettings;
  cashBalance: number;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  session?: AuthSession | null;
  onLogout?: () => void;
  onSwitchCompany?: (companyId: string) => void;
  showToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  isSyncingCloud?: boolean;
  onManualSync?: () => void;
  hasSupabaseConfigured?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  cashBalance,
  currentPage,
  onNavigate,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
  onToggleMobileMenu,
  isMobileMenuOpen,
  session,
  onLogout,
  onSwitchCompany,
  showToast,
  isSyncingCloud = false,
  onManualSync,
  hasSupabaseConfigured = false
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Self Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const pageTitles: Record<PageType, string> = {
    dashboard: 'Dashboard Overview',
    customers: 'Customer Directory',
    suppliers: 'Supplier Records',
    products: 'Inventory Catalog',
    sales: 'Sales Invoices',
    purchases: 'Purchase Bills',
    payments: 'Receipts & Expenses',
    reports: 'Financial Reports',
    settings: 'System Settings',
    users: 'Users & Rights Security',
    companies: 'Company Directory & Setup',
    data_import: 'BUSY Excel Migration & Import'
  };

  const canCreateInvoice = checkPermission(session?.effectivePermissions, 'sales', 'add');

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    if (newPassword.length < 4) {
      showToast?.('error', 'New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast?.('error', 'Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      await AuthService.changeMyPassword(session.user.id, currentPassword, newPassword);
      showToast?.('success', 'Password changed successfully!');
      setIsChangePasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password.';
      showToast?.('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-800" />
              ) : (
                <Menu className="w-5 h-5 text-slate-800" />
              )}
            </button>
          )}

          {/* Back / Forward Navigator */}
          <div className="flex items-center gap-1">
            <button
              onClick={onBack}
              disabled={!canGoBack}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                canGoBack
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  : 'bg-slate-50 text-slate-300 cursor-not-allowed'
              }`}
              title="Back to previous page"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onForward}
              disabled={!canGoForward}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                canGoForward
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  : 'bg-slate-50 text-slate-300 cursor-not-allowed'
              }`}
              title="Forward page"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-hidden"
          >
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#2563EB] shadow-md group-hover:scale-105 transition-transform shrink-0">
              <span className="text-base sm:text-lg font-black text-[#FACC15] tracking-wider font-mono">
                UFO
              </span>
              <Sparkles className="w-3 h-3 text-[#FACC15] absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-base sm:text-lg font-black text-[#2563EB] tracking-tight">
                  BUSY
                </span>
                <span className="text-base sm:text-lg font-black text-[#1E293B] tracking-tight">
                  <span className="text-[#2563EB]">U</span>
                  <span className="text-[#FACC15] bg-[#1E293B] px-1 py-0.5 rounded-md">FO</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold block sm:hidden leading-none">
                {pageTitles[currentPage]}
              </p>
            </div>
          </button>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          {/* Active Company Switcher */}
          {session?.company && (
            <div className="relative">
              <button
                onClick={() => setIsCompanyMenuOpen(!isCompanyMenuOpen)}
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Click to switch active company context"
              >
                <div className="p-1 bg-blue-600 text-white rounded-lg shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block leading-none">
                    Active Company
                  </span>
                  <span className="text-xs font-bold text-slate-900 block leading-tight max-w-[150px] truncate">
                    {session.company.companyName}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              </button>

              {isCompanyMenuOpen && (
                <>
                  <div
                    onClick={() => setIsCompanyMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Assigned Companies</span>
                      <button
                        onClick={() => {
                          setIsCompanyMenuOpen(false);
                          onNavigate('companies');
                        }}
                        className="text-[11px] text-blue-600 hover:underline font-semibold"
                      >
                        Manage All
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {session.assignedCompanies?.map((comp) => {
                        const isCurrent = comp.id === session.company.id;
                        return (
                          <button
                            key={comp.id}
                            onClick={() => {
                              setIsCompanyMenuOpen(false);
                              if (!isCurrent && onSwitchCompany) {
                                onSwitchCompany(comp.id);
                              }
                            }}
                            className={`w-full px-4 py-2.5 text-left flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${
                              isCurrent ? 'bg-blue-50/60 font-bold text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 uppercase font-bold">
                                {comp.shortName}
                              </span>
                              <span className="truncate max-w-[160px]">{comp.companyName}</span>
                            </div>
                            {isCurrent && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="hidden lg:block">
            <h1 className="text-base font-bold text-slate-800">{pageTitles[currentPage]}</h1>
            <p className="text-[11px] text-slate-400 font-medium">Sri Lanka Edition • Multi-Company Isolated</p>
          </div>
        </div>

        {/* Right side CTA & User Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Multi-Device Sync Indicator */}
          <button
            onClick={() => {
              if (!hasSupabaseConfigured) {
                onNavigate('settings');
                showToast?.('info', 'Please configure your Supabase URL and Key in Settings to enable Cloud sync across devices.');
              } else if (onManualSync) {
                onManualSync();
              }
            }}
            disabled={isSyncingCloud}
            title={
              isSyncingCloud
                ? 'Syncing latest records from Supabase Cloud...'
                : hasSupabaseConfigured
                ? 'Multi-Device Cloud Sync is Active. Click to sync instantly now.'
                : 'Cloud sync not configured on this device. Click to configure in Settings.'
            }
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
              isSyncingCloud
                ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                : hasSupabaseConfigured
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
            }`}
          >
            {isSyncingCloud ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Cloud className={`w-3.5 h-3.5 ${hasSupabaseConfigured ? 'text-emerald-600' : 'text-amber-600'}`} />
            )}
            <span className="hidden md:inline font-mono">
              {isSyncingCloud ? 'Syncing...' : hasSupabaseConfigured ? 'Cloud Live' : 'Connect Cloud'}
            </span>
          </button>

          {/* Cash Balance Widget */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-900 px-2.5 sm:px-3.5 py-1.5 rounded-xl shadow-2xs">
            <div className="p-1 bg-[#2563EB] text-[#FACC15] rounded-lg shrink-0">
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 block leading-none mb-0.5">
                Cash
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-600 block leading-none">
                {settings.currencySymbol}{' '}
                {cashBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                })}
              </span>
            </div>
          </div>

          {/* Quick Invoice CTA (Guarded by sales:add permission) */}
          {canCreateInvoice && (
            <button
              onClick={() => onNavigate('sales')}
              className="hidden sm:flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#eab308] text-[#1E293B] font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-xs transition-all cursor-pointer shrink-0"
            >
              <span>+ Create Invoice</span>
            </button>
          )}

          {/* User Profile & Security Badge */}
          {session && (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer border border-slate-200"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                  {session.user.username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold leading-tight text-slate-900 font-mono">
                    {session.user.username}
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold leading-tight flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" />
                    <span>{session.user.roleName}</span>
                  </span>
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <>
                  <div
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">{session.user.fullName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        @{session.user.username}
                      </p>
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md">
                          <Shield className="w-3 h-3" />
                          {session.user.roleName}
                        </span>
                      </div>
                    </div>

                    <div className="p-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsChangePasswordModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-slate-400" />
                        <span>Change My Password</span>
                      </button>

                      {session.user.isAdmin && (
                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            onNavigate('users');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Shield className="w-4 h-4 text-blue-500" />
                          <span>Users & Security Panel</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          if (onLogout) onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* MODAL: SELF CHANGE PASSWORD */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-lg text-slate-900">Change My Password</h3>
              </div>
              <button
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeMyPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 4 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
