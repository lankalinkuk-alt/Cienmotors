import React from 'react';
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  ShoppingCart,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Settings as SettingsIcon,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  ChevronRight,
  X
} from 'lucide-react';
import { PageType, AuthSession, PermissionModule } from '../types';
import { checkPermission } from '../lib/permissions';

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  lowStockCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  session?: AuthSession | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  lowStockCount,
  isOpenMobile = false,
  onCloseMobile,
  session
}) => {
  const perms = session?.effectivePermissions;

  const allNavItems: {
    id: PageType;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    requiredModule?: PermissionModule;
    customCheck?: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      requiredModule: 'dashboard'
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: <Users className="w-5 h-5" />,
      requiredModule: 'customers'
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      icon: <Truck className="w-5 h-5" />,
      requiredModule: 'suppliers'
    },
    {
      id: 'products',
      label: 'Products',
      icon: <Package className="w-5 h-5" />,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      requiredModule: 'products'
    },
    {
      id: 'sales',
      label: 'Sales (Invoices)',
      icon: <ShoppingCart className="w-5 h-5" />,
      requiredModule: 'sales'
    },
    {
      id: 'purchases',
      label: 'Purchases',
      icon: <ShoppingBag className="w-5 h-5" />,
      requiredModule: 'purchases'
    },
    {
      id: 'payments',
      label: 'Payments & Expenses',
      icon: <CreditCard className="w-5 h-5" />,
      customCheck:
        checkPermission(perms, 'customer_receipts', 'view') ||
        checkPermission(perms, 'supplier_payments', 'view') ||
        checkPermission(perms, 'expenses', 'view')
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <BarChart3 className="w-5 h-5" />,
      requiredModule: 'reports'
    },
    {
      id: 'users',
      label: 'Users & Rights',
      icon: <ShieldCheck className="w-5 h-5 text-yellow-300" />,
      customCheck:
        checkPermission(perms, 'users', 'view') ||
        checkPermission(perms, 'roles', 'view') ||
        checkPermission(perms, 'audit_logs', 'view')
    },
    {
      id: 'companies',
      label: 'Companies',
      icon: <Building2 className="w-5 h-5 text-blue-200" />,
      requiredModule: 'companies'
    },
    {
      id: 'data_import',
      label: 'Data Import',
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-200" />,
      requiredModule: 'data_import'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon className="w-5 h-5" />,
      requiredModule: 'settings'
    }
  ];

  // Filter items based on security rights
  const visibleNavItems = allNavItems.filter((item) => {
    if (!perms) return true;
    if (item.customCheck !== undefined) return item.customCheck;
    if (item.requiredModule) {
      return checkPermission(perms, item.requiredModule, 'view');
    }
    return true;
  });

  const handleNavClick = (id: PageType) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#2563EB] text-white">
      {/* Brand Header Banner */}
      <div className="p-5 flex items-center justify-between bg-[#1D4ED8]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#FACC15] rounded-xl flex items-center justify-center shadow-lg font-black text-[#2563EB] text-lg">
            U
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white block leading-none">
              BUSY <span className="text-[#FACC15]">UFO</span>
            </span>
            <span className="text-[10px] text-blue-200 font-bold tracking-wider uppercase block mt-1">
              Sri Lanka Billing
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-xl text-blue-100 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Sidebar Nav Items */}
      <nav className="p-4 space-y-1.5 overflow-y-auto flex-1">
        <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-200/80">
          Main Navigation
        </p>

        {visibleNavItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white/15 text-white font-bold border-l-4 border-[#FACC15] shadow-xs'
                  : 'hover:bg-white/10 text-white/90 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-[#FACC15]' : 'text-blue-200'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-xs font-black rounded-full ${
                      isActive
                        ? 'bg-[#FACC15] text-[#1E293B]'
                        : 'bg-rose-500 text-white shadow-xs'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-4 h-4 text-[#FACC15]" />}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer User Info & Tagline */}
      <div className="p-4 border-t border-blue-500/30 text-xs text-blue-100/80 bg-[#1D4ED8]/50 shrink-0">
        <div className="flex items-center justify-between font-bold">
          <span>BUSY UFO v1.0</span>
          <span className="px-2 py-0.5 bg-[#FACC15] text-[#1E293B] rounded-md font-mono text-[10px] font-black">
            SL EDITION
          </span>
        </div>
        {session && (
          <p className="mt-1.5 text-[11px] text-blue-200/90 font-medium truncate">
            Logged in as: <strong className="text-white">{session.user.username}</strong>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-64 text-white shrink-0 shadow-xl z-20 flex-col">
        {navContent}
      </aside>

      {/* Mobile Drawer Slide-over */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in transition-opacity"
          />

          {/* Drawer Sheet */}
          <aside className="fixed inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
