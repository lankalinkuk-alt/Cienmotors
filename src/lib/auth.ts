import {
  AppUser,
  Role,
  AuthSession,
  AuditLog,
  AuditAction,
  PermissionModule,
  PermissionKey,
  Company
} from '../types';
import { SYSTEM_ROLES, calculateEffectivePermissions, checkPermission } from './permissions';
import { generateSalt, generateUUID, hashPassword, verifyPassword } from './crypto';
import { StorageService } from './storage';
import { SupabaseSyncService } from './supabase';

const AUTH_STORAGE_KEYS = {
  USERS: 'busy_ufo_users',
  ROLES: 'busy_ufo_roles',
  SESSION: 'busy_ufo_session',
  AUDIT_LOGS: 'busy_ufo_audit_logs'
};

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading key ${key}:`, err);
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving key ${key}:`, err);
  }
}

export const AuthService = {
  // --- ROLES MANAGEMENT ---
  getRoles(): Role[] {
    const stored = getStored<Role[]>(AUTH_STORAGE_KEYS.ROLES, []);
    if (!stored || stored.length === 0) {
      setStored(AUTH_STORAGE_KEYS.ROLES, SYSTEM_ROLES);
      return SYSTEM_ROLES;
    }
    // Ensure all system roles exist
    const merged = [...stored];
    SYSTEM_ROLES.forEach((sysRole) => {
      if (!merged.some((r) => r.id === sysRole.id)) {
        merged.push(sysRole);
      }
    });
    return merged;
  },

  getRoleById(roleId: string): Role | undefined {
    const roles = this.getRoles();
    return roles.find((r) => r.id === roleId);
  },

  saveRole(roleData: Partial<Role>): Role {
    const roles = this.getRoles();
    const now = new Date().toISOString();

    if (roleData.id) {
      const idx = roles.findIndex((r) => r.id === roleData.id);
      if (idx !== -1) {
        const updated: Role = {
          ...roles[idx],
          ...roleData
        } as Role;
        roles[idx] = updated;
        setStored(AUTH_STORAGE_KEYS.ROLES, roles);
        this.recordAuditLog('ROLE_EDITED', 'roles', `Updated role: ${updated.name}`, updated.id);
        return updated;
      }
    }

    const newRole: Role = {
      id: `role-custom-${Date.now()}`,
      name: roleData.name?.trim() || 'New Custom Role',
      description: roleData.description?.trim() || 'Custom user rights role',
      isSystemRole: false,
      permissions: roleData.permissions || [],
      createdAt: now
    };

    roles.push(newRole);
    setStored(AUTH_STORAGE_KEYS.ROLES, roles);
    this.recordAuditLog('ROLE_CREATED', 'roles', `Created custom role: ${newRole.name}`, newRole.id);
    return newRole;
  },

  deleteRole(roleId: string): void {
    const roles = this.getRoles();
    const target = roles.find((r) => r.id === roleId);
    if (!target) return;
    if (target.isSystemRole) {
      throw new Error('System pre-defined roles cannot be deleted.');
    }

    // Check if any user is currently assigned to this role
    const users = this.getUsers();
    const inUse = users.some((u) => u.roleId === roleId);
    if (inUse) {
      throw new Error('Cannot delete role because one or more users are currently assigned to it.');
    }

    const filtered = roles.filter((r) => r.id !== roleId);
    setStored(AUTH_STORAGE_KEYS.ROLES, filtered);
    this.recordAuditLog('ROLE_DELETED', 'roles', `Deleted custom role: ${target.name}`, roleId);
  },

  // --- USERS MANAGEMENT ---
  getUsers(): AppUser[] {
    const deleted = StorageService.getDeletedIds ? StorageService.getDeletedIds() : new Set<string>();
    const users = getStored<AppUser[]>(AUTH_STORAGE_KEYS.USERS, []);
    return users.filter((u) => u && u.id && !deleted.has(u.id));
  },

  getUserById(userId: string): AppUser | undefined {
    const users = this.getUsers();
    return users.find((u) => u.id === userId);
  },

  getUserByUsername(username: string): AppUser | undefined {
    const clean = username.trim().toLowerCase();
    const users = this.getUsers();
    return users.find((u) => u.usernameNormalized === clean);
  },

  isInitialAdminSetupRequired(): boolean {
    const users = this.getUsers();
    return users.length === 0;
  },

  /**
   * Initializes the first administrator account safely on initial system setup.
   */
  async setupFirstAdmin(password: string, fullName = 'System Administrator'): Promise<AuthSession> {
    const users = this.getUsers();
    if (users.length > 0) {
      throw new Error('System already initialized. Please login with existing credentials.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = new Date().toISOString();

    const adminUser: AppUser = {
      id: `user-admin-${Date.now()}`,
      username: 'admin',
      usernameNormalized: 'admin',
      fullName: fullName.trim() || 'System Administrator',
      passwordHash,
      salt,
      roleId: 'role-admin',
      roleName: 'Administrator',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastLogin: now
    };

    setStored(AUTH_STORAGE_KEYS.USERS, [adminUser]);

    this.recordAuditLog(
      'USER_CREATED',
      'users',
      'First Administrator account created successfully during initial system setup.',
      adminUser.id,
      adminUser.id,
      adminUser.username
    );

    // Automatically create session for the first admin
    const adminRole = this.getRoleById('role-admin') || SYSTEM_ROLES[0];
    const effectivePermissions = calculateEffectivePermissions(adminRole);
    const allCompanies = StorageService.getCompanies();
    const activeCompany = allCompanies[0];

    const session: AuthSession = {
      user: {
        id: adminUser.id,
        username: adminUser.username,
        fullName: adminUser.fullName,
        roleId: adminUser.roleId,
        roleName: adminUser.roleName,
        isActive: true,
        isAdmin: true
      },
      company: activeCompany,
      assignedCompanies: allCompanies,
      effectivePermissions,
      token: `sess_${Date.now()}_${generateSalt(8)}`,
      loginTime: now
    };

    setStored(AUTH_STORAGE_KEYS.SESSION, session);
    this.recordAuditLog(
      'LOGIN',
      'auth',
      'Administrator logged in after initial setup.',
      undefined,
      adminUser.id,
      adminUser.username
    );

    return session;
  },

  /**
   * Creates a new user with validation rules.
   */
  async createUser(data: {
    username: string;
    fullName: string;
    password: string;
    roleId: string;
    isActive?: boolean;
  }): Promise<AppUser> {
    const cleanUsername = data.username.trim();
    const normalized = cleanUsername.toLowerCase();

    // 1. Username validations
    if (!cleanUsername) {
      throw new Error('Username is required.');
    }
    if (cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      throw new Error('Username can only contain letters, numbers, hyphens, and underscores.');
    }

    // 2. Check duplicate username (case-insensitive)
    const existing = this.getUserByUsername(normalized);
    if (existing) {
      throw new Error(`Username "${cleanUsername}" is already taken. Please choose another username.`);
    }

    // 3. Password validation
    if (!data.password || data.password.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    // 4. Role lookup
    const role = this.getRoleById(data.roleId);
    if (!role) {
      throw new Error('Selected role does not exist.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(data.password, salt);
    const now = new Date().toISOString();

    const newUser: AppUser = {
      id: generateUUID(),
      username: cleanUsername,
      usernameNormalized: normalized,
      fullName: data.fullName.trim() || cleanUsername,
      passwordHash,
      salt,
      roleId: role.id,
      roleName: role.name,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      updatedAt: now
    };

    const users = this.getUsers();
    users.push(newUser);
    setStored(AUTH_STORAGE_KEYS.USERS, users);
    StorageService.addPendingSyncId('users', newUser.id);
    SupabaseSyncService.syncUser(newUser).then((res) => {
      if (res?.success) StorageService.removePendingSyncId('users', newUser.id);
    }).catch(() => {});

    this.recordAuditLog(
      'USER_CREATED',
      'users',
      `Created new user account: ${newUser.username} (${newUser.roleName})`,
      newUser.id
    );

    return newUser;
  },

  /**
   * Updates user details (Full name, Role, Active status).
   */
  updateUser(
    userId: string,
    updates: {
      fullName?: string;
      roleId?: string;
      isActive?: boolean;
    }
  ): AppUser {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new Error('User not found.');
    }

    const targetUser = users[idx];

    // Prevent disabling or removing Administrator rights from the last active Administrator
    if (targetUser.roleId === 'role-admin' && updates.isActive === false) {
      const activeAdmins = users.filter((u) => u.roleId === 'role-admin' && u.isActive);
      if (activeAdmins.length <= 1) {
        throw new Error('Cannot disable the only active Administrator account in the system.');
      }
    }

    if (targetUser.roleId === 'role-admin' && updates.roleId && updates.roleId !== 'role-admin') {
      const activeAdmins = users.filter((u) => u.roleId === 'role-admin' && u.isActive);
      if (activeAdmins.length <= 1) {
        throw new Error('Cannot change the role of the only active Administrator account.');
      }
    }

    let roleName = targetUser.roleName;
    if (updates.roleId && updates.roleId !== targetUser.roleId) {
      const role = this.getRoleById(updates.roleId);
      if (role) {
        roleName = role.name;
        this.recordAuditLog(
          'ROLE_CHANGED',
          'users',
          `Changed role for ${targetUser.username} to ${role.name}`,
          userId
        );
      }
    }

    const wasActive = targetUser.isActive;
    const now = new Date().toISOString();

    const updatedUser: AppUser = {
      ...targetUser,
      fullName: updates.fullName !== undefined ? updates.fullName.trim() : targetUser.fullName,
      roleId: updates.roleId || targetUser.roleId,
      roleName,
      isActive: updates.isActive !== undefined ? updates.isActive : targetUser.isActive,
      updatedAt: now
    };

    users[idx] = updatedUser;
    setStored(AUTH_STORAGE_KEYS.USERS, users);
    StorageService.addPendingSyncId('users', updatedUser.id);
    SupabaseSyncService.syncUser(updatedUser).then((res) => {
      if (res?.success) StorageService.removePendingSyncId('users', updatedUser.id);
    }).catch(() => {});

    if (wasActive !== updatedUser.isActive) {
      this.recordAuditLog(
        updatedUser.isActive ? 'USER_ENABLED' : 'USER_DISABLED',
        'users',
        `${updatedUser.isActive ? 'Enabled' : 'Disabled'} user: ${updatedUser.username}`,
        userId
      );
    } else {
      this.recordAuditLog(
        'USER_EDITED',
        'users',
        `Updated profile details for user: ${updatedUser.username}`,
        userId
      );
    }

    return updatedUser;
  },

  /**
   * Administrator Reset Password for a user.
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new Error('User not found.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(newPassword, salt);
    const now = new Date().toISOString();

    users[idx] = {
      ...users[idx],
      passwordHash,
      salt,
      updatedAt: now
    };

    setStored(AUTH_STORAGE_KEYS.USERS, users);
    StorageService.addPendingSyncId('users', userId);
    SupabaseSyncService.syncUser(users[idx]).then((res) => {
      if (res?.success) StorageService.removePendingSyncId('users', userId);
    }).catch(() => {});

    this.recordAuditLog(
      'PASSWORD_RESET',
      'users',
      `Password reset for user: ${users[idx].username}`,
      userId
    );
  },

  /**
   * Logged-in user self password change.
   */
  async changeMyPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new Error('User not found.');
    }

    const user = users[idx];
    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash, user.salt);
    if (!isCurrentValid) {
      throw new Error('Current password is incorrect.');
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(newPassword, salt);
    const now = new Date().toISOString();

    users[idx] = {
      ...user,
      passwordHash,
      salt,
      updatedAt: now
    };

    setStored(AUTH_STORAGE_KEYS.USERS, users);
    StorageService.addPendingSyncId('users', userId);
    SupabaseSyncService.syncUser(users[idx]).then((res) => {
      if (res?.success) StorageService.removePendingSyncId('users', userId);
    }).catch(() => {});

    this.recordAuditLog(
      'PASSWORD_CHANGED',
      'auth',
      `User ${user.username} changed their account password.`,
      userId
    );
  },

  /**
   * Updates custom user permission overrides.
   */
  updateUserPermissions(userId: string, overrides: Partial<Record<PermissionKey, boolean>>): AppUser {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      throw new Error('User not found.');
    }

    const now = new Date().toISOString();
    const updatedUser: AppUser = {
      ...users[idx],
      permissionOverrides: overrides,
      updatedAt: now
    };

    users[idx] = updatedUser;
    setStored(AUTH_STORAGE_KEYS.USERS, users);
    StorageService.addPendingSyncId('users', userId);
    SupabaseSyncService.syncUser(updatedUser).then((res) => {
      if (res?.success) StorageService.removePendingSyncId('users', userId);
    }).catch(() => {});

    this.recordAuditLog(
      'RIGHTS_CHANGED',
      'roles',
      `Custom permissions updated for user: ${updatedUser.username}`,
      userId
    );

    // If this is the currently logged-in user, refresh session permissions immediately
    const session = this.getCurrentSession();
    if (session && session.user.id === userId) {
      const role = this.getRoleById(updatedUser.roleId) || SYSTEM_ROLES[0];
      const effectivePermissions = calculateEffectivePermissions(role, overrides as Record<PermissionKey, boolean>);
      const updatedSession: AuthSession = {
        ...session,
        effectivePermissions
      };
      setStored(AUTH_STORAGE_KEYS.SESSION, updatedSession);
    }

    return updatedUser;
  },

  /**
   * Deletes a user account (prevents deleting the last Administrator).
   */
  deleteUser(userId: string): void {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    if (target.roleId === 'role-admin') {
      const activeAdmins = users.filter((u) => u.roleId === 'role-admin' && u.isActive);
      if (activeAdmins.length <= 1) {
        throw new Error('Cannot delete the only Administrator account in the system.');
      }
    }

    StorageService.addDeletedId(userId);
    StorageService.removePendingSyncId('users', userId);

    const filtered = users.filter((u) => u.id !== userId);
    setStored(AUTH_STORAGE_KEYS.USERS, filtered);
    SupabaseSyncService.deleteUser(userId).catch(() => {});

    this.recordAuditLog(
      'USER_DISABLED',
      'users',
      `Deleted user account: ${target.username}`,
      userId
    );
  },

  getUserAssignedCompanies(user: AppUser): Company[] {
    const allCompanies = StorageService.getCompanies().filter((c) => c.isActive);
    if (user.roleId === 'role-admin' || user.username === 'admin' || user.roleName === 'Administrator') {
      return allCompanies;
    }
    if (user.assignedCompanyIds && user.assignedCompanyIds.length > 0) {
      const filtered = allCompanies.filter((c) => user.assignedCompanyIds?.includes(c.id));
      if (filtered.length > 0) return filtered;
    }
    return allCompanies;
  },

  switchCompany(targetCompanyId: string): AuthSession {
    const session = this.getCurrentSession();
    if (!session) throw new Error('No active session.');

    const user = this.getUserById(session.user.id);
    if (!user) throw new Error('User not found.');

    const assignedCompanies = this.getUserAssignedCompanies(user);
    const targetComp = assignedCompanies.find((c) => c.id === targetCompanyId);
    if (!targetComp) {
      throw new Error('You do not have authorization to access this company.');
    }

    const assignment = user.companyAssignments?.find((ca) => ca.companyId === targetCompanyId);
    const roleId = assignment?.roleId || user.roleId;
    const overrides = assignment?.permissionOverrides || user.permissionOverrides;
    const role = this.getRoleById(roleId) || SYSTEM_ROLES[0];
    const effectivePermissions = calculateEffectivePermissions(role, overrides);

    const updatedSession: AuthSession = {
      ...session,
      user: {
        ...session.user,
        roleId: role.id,
        roleName: role.name
      },
      company: targetComp,
      assignedCompanies,
      effectivePermissions
    };

    setStored(AUTH_STORAGE_KEYS.SESSION, updatedSession);
    this.recordAuditLog(
      'COMPANY_SWITCHED',
      'companies',
      `Switched active company context to: ${targetComp.companyName} (${targetComp.shortName})`,
      targetComp.id,
      user.id,
      user.username
    );

    return updatedSession;
  },

  // --- AUTHENTICATION LOGIN & LOGOUT ---
  /**
   * Validates username + password and issues session.
   * Case-insensitive matching on username.
   */
  async login(username: string, password: string): Promise<AuthSession> {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      throw new Error('Please enter both username and password.');
    }

    const normalized = cleanUsername.toLowerCase();
    const user = this.getUserByUsername(normalized);

    if (!user) {
      this.recordAuditLog(
        'LOGIN_FAILED',
        'auth',
        `Failed login attempt for username: ${cleanUsername}`
      );
      throw new Error('Invalid username or password.');
    }

    // Check if account is disabled
    if (!user.isActive) {
      this.recordAuditLog(
        'LOGIN_FAILED',
        'auth',
        `Login rejected for disabled user: ${user.username}`,
        user.id
      );
      throw new Error('This user account is disabled. Please contact the administrator.');
    }

    // Verify Password Hash
    const isValid = await verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      this.recordAuditLog(
        'LOGIN_FAILED',
        'auth',
        `Incorrect password for username: ${user.username}`,
        user.id
      );
      throw new Error('Invalid username or password.');
    }

    // Update Last Login timestamp
    const now = new Date().toISOString();
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      users[idx].lastLogin = now;
      users[idx].updatedAt = now;
      setStored(AUTH_STORAGE_KEYS.USERS, users);
      SupabaseSyncService.syncUser(users[idx]).catch(() => {});
    }

    const assignedCompanies = this.getUserAssignedCompanies(user);
    if (assignedCompanies.length === 0) {
      throw new Error('No active companies assigned to your user account.');
    }
    const activeCompany = assignedCompanies[0];

    const assignment = user.companyAssignments?.find((ca) => ca.companyId === activeCompany.id);
    const roleId = assignment?.roleId || user.roleId;
    const overrides = assignment?.permissionOverrides || user.permissionOverrides;
    const role = this.getRoleById(roleId) || SYSTEM_ROLES[0];
    const effectivePermissions = calculateEffectivePermissions(role, overrides);

    const session: AuthSession = {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId,
        roleName: user.roleName,
        isActive: true,
        isAdmin: user.roleId === 'role-admin'
      },
      company: activeCompany,
      assignedCompanies,
      effectivePermissions,
      token: `sess_${Date.now()}_${generateSalt(8)}`,
      loginTime: now
    };

    setStored(AUTH_STORAGE_KEYS.SESSION, session);

    this.recordAuditLog(
      'LOGIN',
      'auth',
      `User ${user.username} logged in successfully to company ${activeCompany.companyName}.`,
      activeCompany.id,
      user.id,
      user.username
    );

    return session;
  },

  logout(): void {
    const session = this.getCurrentSession();
    if (session) {
      this.recordAuditLog(
        'LOGOUT',
        'auth',
        `User ${session.user.username} logged out.`,
        undefined,
        session.user.id,
        session.user.username
      );
    }
    localStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
  },

  /**
   * Retrieves active session and securely re-validates against database.
   * If the user was disabled or removed, the session is immediately invalidated.
   */
  getCurrentSession(): AuthSession | null {
    const session = getStored<AuthSession | null>(AUTH_STORAGE_KEYS.SESSION, null);
    if (!session || !session.user || !session.user.id) {
      return null;
    }

    // Validate user still exists and isActive in database
    const user = this.getUserById(session.user.id);
    if (!user || !user.isActive) {
      localStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
      return null;
    }

    const assignedCompanies = this.getUserAssignedCompanies(user);
    let activeCompany = session.company;
    if (!activeCompany || !assignedCompanies.some((c) => c.id === activeCompany.id)) {
      activeCompany = assignedCompanies[0];
    }

    const assignment = user.companyAssignments?.find((ca) => ca.companyId === activeCompany.id);
    const roleId = assignment?.roleId || user.roleId;
    const overrides = assignment?.permissionOverrides || user.permissionOverrides;
    const role = this.getRoleById(roleId) || SYSTEM_ROLES[0];
    const effectivePermissions = calculateEffectivePermissions(role, overrides);

    return {
      ...session,
      user: {
        ...session.user,
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId,
        roleName: user.roleName,
        isActive: user.isActive,
        isAdmin: user.roleId === 'role-admin'
      },
      company: activeCompany,
      assignedCompanies,
      effectivePermissions
    };
  },

  // --- AUDIT LOGS ---
  getAuditLogs(): AuditLog[] {
    const logs = getStored<AuditLog[]>(AUTH_STORAGE_KEYS.AUDIT_LOGS, []);
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  recordAuditLog(
    action: AuditAction,
    module: PermissionModule | 'auth' | 'system',
    description: string,
    recordId?: string,
    customUserId?: string,
    customUsername?: string
  ): void {
    try {
      const session = getStored<AuthSession | null>(AUTH_STORAGE_KEYS.SESSION, null);
      const userId = customUserId || session?.user.id || 'system';
      const username = customUsername || session?.user.username || 'system';

      const newLog: AuditLog = {
        id: `audit-${Date.now()}-${generateSalt(4)}`,
        userId,
        username,
        action,
        module,
        recordId,
        description,
        createdAt: new Date().toISOString()
      };

      const logs = getStored<AuditLog[]>(AUTH_STORAGE_KEYS.AUDIT_LOGS, []);
      logs.unshift(newLog);

      // Keep last 1000 logs
      if (logs.length > 1000) {
        logs.length = 1000;
      }

      setStored(AUTH_STORAGE_KEYS.AUDIT_LOGS, logs);
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }
};
