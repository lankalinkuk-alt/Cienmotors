import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Trash2,
  Edit2,
  FileText,
  Search,
  Check,
  X,
  Sliders,
  History,
  RotateCcw,
  Plus,
  CloudUpload,
  RefreshCw
} from 'lucide-react';
import { AppUser, Role, PermissionKey, PermissionModule, AuditLog } from '../types';
import { AuthService } from '../lib/auth';
import { SupabaseSyncService } from '../lib/supabase';
import { MODULE_PERMISSIONS, ALL_PERMISSION_KEYS } from '../lib/permissions';

interface UserManagementProps {
  currentUserId: string;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onRefreshPermissions?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUserId,
  showToast,
  onRefreshPermissions
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'rights' | 'roles' | 'audit'>('users');
  const [users, setUsers] = useState<AppUser[]>(() => AuthService.getUsers());
  const [roles, setRoles] = useState<Role[]>(() => AuthService.getRoles());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => AuthService.getAuditLogs());

  // User Search & Filters
  const [userSearch, setUserSearch] = useState<string>('');

  // Selected User for Rights Management
  const [selectedUserForRights, setSelectedUserForRights] = useState<AppUser | null>(() => {
    const list = AuthService.getUsers();
    return list[0] || null;
  });

  // Modal States
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<AppUser | null>(null);
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState<boolean>(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // New User Form State (NO EMAIL)
  const [newUsername, setNewUsername] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newConfirmPassword, setNewConfirmPassword] = useState<string>('');
  const [newRoleId, setNewRoleId] = useState<string>('role-sales');
  const [newIsActive, setNewIsActive] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Reset Password Form State
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [confirmResetPassword, setConfirmResetPassword] = useState<string>('');

  // New/Edit Role Form State
  const [roleFormName, setRoleFormName] = useState<string>('');
  const [roleFormDesc, setRoleFormDesc] = useState<string>('');
  const [roleFormPermissions, setRoleFormPermissions] = useState<PermissionKey[]>([]);

  // Audit Logs Filter
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>('ALL');
  const [isSyncingUsers, setIsSyncingUsers] = useState<boolean>(false);

  const reloadData = () => {
    const updatedUsers = AuthService.getUsers();
    setUsers(updatedUsers);
    setRoles(AuthService.getRoles());
    setAuditLogs(AuthService.getAuditLogs());

    if (selectedUserForRights) {
      const refreshedSelected = updatedUsers.find((u) => u.id === selectedUserForRights.id);
      setSelectedUserForRights(refreshedSelected || updatedUsers[0] || null);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleSyncAllUsersToSupabase = async () => {
    setIsSyncingUsers(true);
    const allUsers = AuthService.getUsers();
    let successCount = 0;
    let lastError: string | undefined = undefined;

    for (const u of allUsers) {
      const res = await SupabaseSyncService.syncUser(u);
      if (res.success) {
        successCount++;
      } else {
        lastError = res.error;
      }
    }

    setIsSyncingUsers(false);
    if (successCount === allUsers.length) {
      showToast('success', `All ${successCount} user accounts synced successfully to Supabase!`);
    } else if (successCount > 0) {
      showToast('warning', `Synced ${successCount}/${allUsers.length} users. Error: ${lastError}`);
    } else {
      showToast('error', `Supabase user sync failed: ${lastError || 'Please check Supabase configuration in Settings'}`);
    }
  };

  // --- USER CRUD HANDLERS ---
  const handleOpenCreateUser = () => {
    setNewUsername('');
    setNewFullName('');
    setNewPassword('');
    setNewConfirmPassword('');
    setNewRoleId(roles[1]?.id || 'role-sales');
    setNewIsActive(true);
    setShowPassword(false);
    setIsNewUserModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== newConfirmPassword) {
      showToast('error', 'Passwords do not match. Please re-enter.');
      return;
    }

    try {
      const created = await AuthService.createUser({
        username: newUsername,
        fullName: newFullName,
        password: newPassword,
        roleId: newRoleId,
        isActive: newIsActive
      });

      const syncResult = await SupabaseSyncService.syncUser(created);
      if (syncResult.error) {
        showToast('warning', `User "${created.username}" created locally. Supabase: ${syncResult.error}`);
      } else {
        showToast('success', `User account "${created.username}" created and saved to Supabase!`);
      }

      setIsNewUserModalOpen(false);
      reloadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user.';
      showToast('error', msg);
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updated = AuthService.updateUser(editingUser.id, {
        fullName: editingUser.fullName,
        roleId: editingUser.roleId,
        isActive: editingUser.isActive
      });

      const syncResult = await SupabaseSyncService.syncUser(updated);
      if (syncResult.error) {
        showToast('warning', `User "${editingUser.username}" profile updated locally. Supabase: ${syncResult.error}`);
      } else {
        showToast('success', `User "${editingUser.username}" profile updated and synced with Supabase.`);
      }

      setEditingUser(null);
      reloadData();
      if (onRefreshPermissions) onRefreshPermissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user.';
      showToast('error', msg);
    }
  };

  const handleToggleUserActive = async (user: AppUser) => {
    try {
      const updated = AuthService.updateUser(user.id, {
        isActive: !user.isActive
      });
      await SupabaseSyncService.syncUser(updated);
      showToast(
        updated.isActive ? 'success' : 'info',
        `User "${user.username}" is now ${updated.isActive ? 'Active' : 'Disabled'}.`
      );
      reloadData();
      if (onRefreshPermissions) onRefreshPermissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      showToast('error', msg);
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (user.id === currentUserId) {
      showToast('error', 'You cannot delete your own logged-in account.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      try {
        AuthService.deleteUser(user.id);
        await SupabaseSyncService.deleteUser(user.id);
        showToast('info', `User "${user.username}" deleted from local database and Supabase.`);
        reloadData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Cannot delete user.';
        showToast('error', msg);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    if (newResetPassword !== confirmResetPassword) {
      showToast('error', 'Passwords do not match.');
      return;
    }

    try {
      await AuthService.resetPassword(resetPasswordUser.id, newResetPassword);
      const refreshedUser = AuthService.getUserById(resetPasswordUser.id);
      if (refreshedUser) {
        await SupabaseSyncService.syncUser(refreshedUser);
      }
      showToast('success', `Password for user "${resetPasswordUser.username}" has been reset and saved to Supabase.`);
      setResetPasswordUser(null);
      setNewResetPassword('');
      setConfirmResetPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password.';
      showToast('error', msg);
    }
  };

  // --- USER RIGHTS MATRIX HANDLERS ---
  const handleTogglePermissionOverride = (key: PermissionKey) => {
    if (!selectedUserForRights) return;

    const userRole = roles.find((r) => r.id === selectedUserForRights.roleId);
    const roleHasKey = Boolean(userRole?.permissions?.includes(key));
    const currentOverrides = { ...(selectedUserForRights.permissionOverrides || {}) };

    // If override exists, flip it or clear it
    if (key in currentOverrides) {
      const currentVal = currentOverrides[key];
      if (currentVal === roleHasKey) {
        // Toggle away from role default
        currentOverrides[key] = !roleHasKey;
      } else {
        // Revert back to role default by removing override key
        delete currentOverrides[key];
      }
    } else {
      // Create explicit override opposing the role default
      currentOverrides[key] = !roleHasKey;
    }

    try {
      const updated = AuthService.updateUserPermissions(selectedUserForRights.id, currentOverrides);
      setSelectedUserForRights(updated);
      reloadData();
      if (onRefreshPermissions) onRefreshPermissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update rights.';
      showToast('error', msg);
    }
  };

  const handleResetUserToRoleDefault = () => {
    if (!selectedUserForRights) return;
    try {
      const updated = AuthService.updateUserPermissions(selectedUserForRights.id, {});
      setSelectedUserForRights(updated);
      reloadData();
      showToast('info', `Permissions for ${selectedUserForRights.username} reset to ${selectedUserForRights.roleName} defaults.`);
      if (onRefreshPermissions) onRefreshPermissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset rights.';
      showToast('error', msg);
    }
  };

  const handleGrantAllPermissionsToUser = () => {
    if (!selectedUserForRights) return;
    const overrides: Partial<Record<PermissionKey, boolean>> = {};
    ALL_PERMISSION_KEYS.forEach((k) => {
      overrides[k] = true;
    });
    try {
      const updated = AuthService.updateUserPermissions(selectedUserForRights.id, overrides);
      setSelectedUserForRights(updated);
      reloadData();
      showToast('success', `All permissions granted to ${selectedUserForRights.username}.`);
      if (onRefreshPermissions) onRefreshPermissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update rights.';
      showToast('error', msg);
    }
  };

  // --- ROLE CRUD HANDLERS ---
  const handleOpenCreateRole = () => {
    setRoleFormName('');
    setRoleFormDesc('');
    setRoleFormPermissions([]);
    setIsNewRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleFormName(role.name);
    setRoleFormDesc(role.description);
    setRoleFormPermissions([...role.permissions]);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        AuthService.saveRole({
          id: editingRole.id,
          name: roleFormName,
          description: roleFormDesc,
          permissions: roleFormPermissions
        });
        showToast('success', `Role "${roleFormName}" updated.`);
        setEditingRole(null);
      } else {
        AuthService.saveRole({
          name: roleFormName,
          description: roleFormDesc,
          permissions: roleFormPermissions
        });
        showToast('success', `New role "${roleFormName}" created.`);
        setIsNewRoleModalOpen(false);
      }
      reloadData();
      if (onRefreshPermissions) onRefreshPermissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save role.';
      showToast('error', msg);
    }
  };

  const handleDeleteRole = (role: Role) => {
    if (window.confirm(`Are you sure you want to delete role "${role.name}"?`)) {
      try {
        AuthService.deleteRole(role.id);
        showToast('info', `Role "${role.name}" removed.`);
        reloadData();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Cannot delete role.';
        showToast('error', msg);
      }
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.roleName.toLowerCase().includes(q)
    );
  });

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    if (auditModuleFilter !== 'ALL' && log.module !== auditModuleFilter) {
      return false;
    }
    const q = auditSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      log.username.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-md text-white shrink-0">
            <ShieldCheck className="w-6 h-6 text-yellow-300" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Users & Rights Security
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              BUSY-style username & password credentials, role templates, individual overrides, and audit trails
            </p>
          </div>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rights')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rights'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>User Rights Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Roles ({roles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Logs</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Action Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search username, full name, role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-100 outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSyncAllUsersToSupabase}
                disabled={isSyncingUsers}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold px-3.5 py-2 rounded-xl text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Synchronize all user accounts to Supabase database"
              >
                <CloudUpload className={`w-4 h-4 ${isSyncingUsers ? 'animate-bounce text-emerald-600' : 'text-emerald-600'}`} />
                <span>{isSyncingUsers ? 'Syncing...' : 'Sync to Supabase'}</span>
              </button>

              <button
                onClick={handleOpenCreateUser}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-yellow-300" />
                <span>+ New User</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3.5 sm:p-4">User Name</th>
                  <th className="p-3.5 sm:p-4">Full Name</th>
                  <th className="p-3.5 sm:p-4">Assigned Role</th>
                  <th className="p-3.5 sm:p-4 text-center">Status</th>
                  <th className="p-3.5 sm:p-4">Last Login</th>
                  <th className="p-3.5 sm:p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUserId;
                  const isOverrideActive = Boolean(
                    user.permissionOverrides && Object.keys(user.permissionOverrides).length > 0
                  );

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {user.username}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-extrabold rounded">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 sm:p-4 font-semibold text-slate-800">
                        {user.fullName}
                      </td>

                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 ${
                              user.roleId === 'role-admin'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{user.roleName}</span>
                          </span>
                          {isOverrideActive && (
                            <span
                              className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded"
                              title="User has custom permission overrides"
                            >
                              Custom Rights
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 sm:p-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            user.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      <td className="p-3.5 sm:p-4 text-slate-500 font-mono">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Never'}
                      </td>

                      <td className="p-3.5 sm:p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit User Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedUserForRights(user);
                              setActiveTab('rights');
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer font-bold text-[11px] flex items-center gap-1"
                            title="Manage User Rights & Overrides"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Rights</span>
                          </button>

                          <button
                            onClick={() => {
                              setResetPasswordUser(user);
                              setNewResetPassword('');
                              setConfirmResetPassword('');
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Reset User Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleUserActive(user)}
                            disabled={user.roleId === 'role-admin' && users.filter((u) => u.roleId === 'role-admin' && u.isActive).length <= 1 && user.isActive}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                              user.isActive
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={user.isActive ? 'Disable User' : 'Enable User'}
                          >
                            {user.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isCurrent || (user.roleId === 'role-admin' && users.filter((u) => u.roleId === 'role-admin').length <= 1)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-25"
                            title="Delete User Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No user accounts found matching "{userSearch}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: USER RIGHTS MATRIX */}
      {activeTab === 'rights' && selectedUserForRights && (
        <div className="space-y-4">
          {/* User Selector & Matrix Controls */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center font-black">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Target User:</label>
                  <select
                    value={selectedUserForRights.id}
                    onChange={(e) => {
                      const found = users.find((u) => u.id === e.target.value);
                      if (found) setSelectedUserForRights(found);
                    }}
                    className="font-bold text-sm text-slate-900 border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.fullName}) — Role: {u.roleName}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Base Role: <strong>{selectedUserForRights.roleName}</strong>. Checkbox overrides apply exclusively to this user.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleResetUserToRoleDefault}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Role Defaults</span>
              </button>

              <button
                onClick={handleGrantAllPermissionsToUser}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Grant All Permissions</span>
              </button>
            </div>
          </div>

          {/* Module Rights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULE_PERMISSIONS.map((mod) => {
              const userRole = roles.find((r) => r.id === selectedUserForRights.roleId);
              const overrides = selectedUserForRights.permissionOverrides || {};

              return (
                <div
                  key={mod.module}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      <span>{mod.label}</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {mod.actions.length} {mod.actions.length === 1 ? 'action' : 'actions'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {mod.actions.map((act) => {
                      const key: PermissionKey = `${mod.module}:${act.action}`;
                      const roleHasKey = Boolean(userRole?.permissions?.includes(key));
                      const isOverridden = key in overrides;
                      const effectiveAllowed = isOverridden ? overrides[key] : roleHasKey;

                      return (
                        <label
                          key={key}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer select-none transition-all ${
                            effectiveAllowed
                              ? 'bg-blue-50/60 hover:bg-blue-50 border border-blue-200/60'
                              : 'bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={effectiveAllowed}
                              onChange={() => handleTogglePermissionOverride(key)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                            />
                            <span className={`font-semibold ${effectiveAllowed ? 'text-slate-900' : 'text-slate-500'}`}>
                              {act.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isOverridden ? (
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                  overrides[key]
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {overrides[key] ? 'OVERRIDE (+)' : 'OVERRIDE (-)'}
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-medium">
                                {roleHasKey ? 'Role' : 'Denied'}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ROLES MANAGEMENT */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleOpenCreateRole}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Custom Role</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => {
              const assignedUserCount = users.filter((u) => u.roleId === role.id).length;

              return (
                <div
                  key={role.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          role.isSystemRole
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {role.isSystemRole ? 'System Built-in' : 'Custom Role'}
                      </span>

                      <span className="text-xs text-slate-400 font-bold">
                        {assignedUserCount} {assignedUserCount === 1 ? 'user' : 'users'}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900">{role.name}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{role.description}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">
                      {role.permissions.length} granted rights
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditRole(role)}
                        className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                      >
                        {role.isSystemRole ? 'View Rights' : 'Edit Role'}
                      </button>

                      {!role.isSystemRole && (
                        <button
                          onClick={() => handleDeleteRole(role)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Custom Role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit descriptions, username, actions..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-100 outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold text-slate-500">Module:</span>
              <select
                value={auditModuleFilter}
                onChange={(e) => setAuditModuleFilter(e.target.value)}
                className="text-xs font-bold p-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="ALL">All Modules</option>
                <option value="auth">Authentication</option>
                <option value="users">Users</option>
                <option value="roles">Roles & Rights</option>
                <option value="sales">Sales</option>
                <option value="purchases">Purchases</option>
                <option value="products">Products</option>
                <option value="customers">Customers</option>
                <option value="suppliers">Suppliers</option>
                <option value="customer_receipts">Receipts</option>
                <option value="supplier_payments">Payments</option>
                <option value="expenses">Expenses</option>
                <option value="settings">Settings</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3.5 sm:p-4">Timestamp</th>
                  <th className="p-3.5 sm:p-4">User</th>
                  <th className="p-3.5 sm:p-4">Action</th>
                  <th className="p-3.5 sm:p-4">Module</th>
                  <th className="p-3.5 sm:p-4">Description & Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 sm:p-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="p-3.5 sm:p-4 font-bold text-slate-900">
                      {log.username}
                    </td>
                    <td className="p-3.5 sm:p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 sm:p-4 uppercase text-[11px] font-bold text-blue-600">
                      {log.module}
                    </td>
                    <td className="p-3.5 sm:p-4 font-sans font-medium text-slate-800">
                      {log.description}
                      {log.recordId && (
                        <span className="ml-2 font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                          ID: {log.recordId}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                      No audit security logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: + NEW USER (NO EMAIL) */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-lg text-slate-900">Create New User</h3>
              </div>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  User Name (Login ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sales01"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Must be unique and at least 3 characters. Case-insensitive.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Staff"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-600 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 uppercase">Password</label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] text-blue-600 font-bold cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 4 chars"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Confirm password"
                    value={newConfirmPassword}
                    onChange={(e) => setNewConfirmPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Assigned Security Role
                </label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium focus:border-blue-600 outline-hidden"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isSystemRole ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Account Status</span>
                  <span className="text-[11px] text-slate-500">
                    {newIsActive ? 'User can log in immediately' : 'User account is disabled'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newIsActive}
                    onChange={(e) => setNewIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-lg text-slate-900">
                  Edit User: {editingUser.username}
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">User Name</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.username}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-mono font-bold cursor-not-allowed text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Role</label>
                <select
                  value={editingUser.roleId}
                  onChange={(e) => setEditingUser({ ...editingUser, roleId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium focus:border-blue-600 outline-hidden"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Account Status</span>
                  <span className="text-[11px] text-slate-500">
                    {editingUser.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingUser.isActive}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, isActive: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-lg text-slate-900">
                  Reset Password: {resetPasswordUser.username}
                </h3>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Existing passwords are encrypted and cannot be viewed. Set a new password for user{' '}
              <strong>{resetPasswordUser.username}</strong> below:
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password (min 4 chars)"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-blue-600 outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ROLE */}
      {(isNewRoleModalOpen || editingRole) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-lg text-slate-900">
                  {editingRole ? `Role: ${editingRole.name}` : 'Create Custom Role'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsNewRoleModalOpen(false);
                  setEditingRole(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Role Name</label>
                  <input
                    type="text"
                    required
                    disabled={editingRole?.isSystemRole}
                    placeholder="e.g. Counter Cashier"
                    value={roleFormName}
                    onChange={(e) => setRoleFormName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:border-blue-600 outline-hidden disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Description</label>
                  <input
                    type="text"
                    disabled={editingRole?.isSystemRole}
                    placeholder="e.g. Access to counter sales and billing"
                    value={roleFormDesc}
                    onChange={(e) => setRoleFormDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-blue-600 outline-hidden disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-2">
                  Role Default Permissions
                </label>
                <div className="space-y-3 max-h-80 overflow-y-auto p-1">
                  {MODULE_PERMISSIONS.map((mod) => (
                    <div
                      key={mod.module}
                      className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2"
                    >
                      <span className="font-bold text-slate-900 block text-xs uppercase tracking-wide">
                        {mod.label}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {mod.actions.map((act) => {
                          const key: PermissionKey = `${mod.module}:${act.action}`;
                          const isChecked = roleFormPermissions.includes(key);

                          return (
                            <label
                              key={key}
                              className="flex items-center gap-2 text-slate-700 text-xs cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                disabled={editingRole?.isSystemRole}
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRoleFormPermissions([...roleFormPermissions, key]);
                                  } else {
                                    setRoleFormPermissions(
                                      roleFormPermissions.filter((k) => k !== key)
                                    );
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer disabled:opacity-50"
                              />
                              <span>{act.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewRoleModalOpen(false);
                    setEditingRole(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Close
                </button>
                {!editingRole?.isSystemRole && (
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Save Role
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
