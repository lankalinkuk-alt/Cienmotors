import {
  PermissionKey,
  PermissionModule,
  PermissionAction,
  ModulePermissionDefinition,
  Role
} from '../types';

export const MODULE_PERMISSIONS: ModulePermissionDefinition[] = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    actions: [{ action: 'view', label: 'View Dashboard & Analytics' }]
  },
  {
    module: 'customers',
    label: 'Customers',
    actions: [
      { action: 'view', label: 'View Customer Directory' },
      { action: 'add', label: 'Add New Customer' },
      { action: 'edit', label: 'Edit Customer Profile' },
      { action: 'delete', label: 'Delete Customer' },
      { action: 'export', label: 'Export Customer List' }
    ]
  },
  {
    module: 'suppliers',
    label: 'Suppliers',
    actions: [
      { action: 'view', label: 'View Supplier Directory' },
      { action: 'add', label: 'Add New Supplier' },
      { action: 'edit', label: 'Edit Supplier Profile' },
      { action: 'delete', label: 'Delete Supplier' }
    ]
  },
  {
    module: 'products',
    label: 'Products & Inventory',
    actions: [
      { action: 'view', label: 'View Product List' },
      { action: 'add', label: 'Add New Product' },
      { action: 'edit', label: 'Edit Product Details' },
      { action: 'delete', label: 'Delete Product' },
      { action: 'stock_adjustment', label: 'Manual Stock Adjustment' },
      { action: 'export', label: 'Export Catalog' }
    ]
  },
  {
    module: 'sales',
    label: 'Sales (Invoices)',
    actions: [
      { action: 'view', label: 'View Sales Invoices' },
      { action: 'add', label: 'Create Sale Invoice' },
      { action: 'edit', label: 'Edit Sale Invoice' },
      { action: 'delete', label: 'Void / Delete Invoice' },
      { action: 'print', label: 'Print Invoice Receipt' },
      { action: 'export', label: 'Export Sales History' }
    ]
  },
  {
    module: 'purchases',
    label: 'Purchases (Bills)',
    actions: [
      { action: 'view', label: 'View Purchase Bills' },
      { action: 'add', label: 'Record Purchase Bill' },
      { action: 'edit', label: 'Edit Purchase Bill' },
      { action: 'delete', label: 'Void / Delete Purchase' },
      { action: 'print', label: 'Print Purchase Bill' },
      { action: 'export', label: 'Export Purchase Log' }
    ]
  },
  {
    module: 'customer_receipts',
    label: 'Customer Receipts',
    actions: [
      { action: 'view', label: 'View Customer Receipts' },
      { action: 'add', label: 'Receive Customer Payment' },
      { action: 'edit', label: 'Edit Receipt Voucher' },
      { action: 'delete', label: 'Void Customer Receipt' },
      { action: 'print', label: 'Print Receipt Slip' }
    ]
  },
  {
    module: 'supplier_payments',
    label: 'Supplier Payments',
    actions: [
      { action: 'view', label: 'View Supplier Payments' },
      { action: 'add', label: 'Make Supplier Payment' },
      { action: 'edit', label: 'Edit Payment Voucher' },
      { action: 'delete', label: 'Void Supplier Payment' },
      { action: 'print', label: 'Print Payment Voucher' }
    ]
  },
  {
    module: 'expenses',
    label: 'Expenses',
    actions: [
      { action: 'view', label: 'View Expenses' },
      { action: 'add', label: 'Record New Expense' },
      { action: 'edit', label: 'Edit Expense' },
      { action: 'delete', label: 'Delete Expense' }
    ]
  },
  {
    module: 'reports',
    label: 'Financial & Stock Reports',
    actions: [
      { action: 'view', label: 'View Reports' },
      { action: 'print', label: 'Print Reports' },
      { action: 'export', label: 'Export Excel/PDF Reports' }
    ]
  },
  {
    module: 'settings',
    label: 'System Settings',
    actions: [
      { action: 'view', label: 'View Settings' },
      { action: 'edit', label: 'Edit Business Information & Database' }
    ]
  },
  {
    module: 'users',
    label: 'Users Management',
    actions: [
      { action: 'view', label: 'View User Directory' },
      { action: 'add', label: 'Create New User' },
      { action: 'edit', label: 'Edit User & Reset Password' },
      { action: 'disable', label: 'Enable / Disable User' },
      { action: 'delete', label: 'Delete User' }
    ]
  },
  {
    module: 'roles',
    label: 'Roles & User Rights',
    actions: [
      { action: 'view', label: 'View Roles & Rights Matrix' },
      { action: 'edit', label: 'Assign & Customize Rights' }
    ]
  },
  {
    module: 'companies',
    label: 'Company Management',
    actions: [
      { action: 'view', label: 'View Companies' },
      { action: 'add', label: 'Create New Company' },
      { action: 'edit', label: 'Edit Company Profile' },
      { action: 'disable', label: 'Enable / Disable Company' }
    ]
  },
  {
    module: 'data_import',
    label: 'Data Import & Migration',
    actions: [
      { action: 'view', label: 'Access Data Import Wizard & Preview' },
      { action: 'execute', label: 'Execute BUSY Excel Import Jobs' }
    ]
  },
  {
    module: 'audit_logs',
    label: 'Audit Security Logs',
    actions: [{ action: 'view', label: 'View System Audit Logs' }]
  }
];

// All possible permission keys
export const ALL_PERMISSION_KEYS: PermissionKey[] = MODULE_PERMISSIONS.flatMap((mod) =>
  mod.actions.map((act) => `${mod.module}:${act.action}` as PermissionKey)
);

// Pre-defined System Roles
export const SYSTEM_ROLES: Role[] = [
  {
    id: 'role-admin',
    name: 'Administrator',
    description: 'Full unrestricted access to all business operations, settings, users, and security controls.',
    isSystemRole: true,
    permissions: [...ALL_PERMISSION_KEYS],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Full business operations access (sales, inventory, purchases, accounts, reports), without user management rights.',
    isSystemRole: true,
    permissions: ALL_PERMISSION_KEYS.filter(
      (pk) => !pk.startsWith('users:') && !pk.startsWith('roles:') && pk !== 'settings:edit'
    ),
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role-sales',
    name: 'Sales User',
    description: 'Dedicated POS & Sales role. Create invoices, view products & clients, issue receipts, and print sales documents.',
    isSystemRole: true,
    permissions: [
      'dashboard:view',
      'customers:view',
      'customers:add',
      'customers:edit',
      'products:view',
      'sales:view',
      'sales:add',
      'sales:edit',
      'sales:print',
      'customer_receipts:view',
      'customer_receipts:add',
      'customer_receipts:print',
      'reports:view',
      'reports:print'
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role-purchase',
    name: 'Purchase User',
    description: 'Procurement role. Manage suppliers, record purchases, and issue vendor payments.',
    isSystemRole: true,
    permissions: [
      'dashboard:view',
      'suppliers:view',
      'suppliers:add',
      'suppliers:edit',
      'products:view',
      'products:add',
      'products:edit',
      'purchases:view',
      'purchases:add',
      'purchases:edit',
      'purchases:print',
      'supplier_payments:view',
      'supplier_payments:add',
      'supplier_payments:print',
      'reports:view',
      'reports:print'
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role-inventory',
    name: 'Inventory User',
    description: 'Warehouse & stock role. Manage product items, stock adjustment, and stock reports.',
    isSystemRole: true,
    permissions: [
      'dashboard:view',
      'products:view',
      'products:add',
      'products:edit',
      'products:stock_adjustment',
      'products:export',
      'reports:view'
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role-accounts',
    name: 'Accounts User',
    description: 'Financial accounting role. Manage payments, receipts, expenses, view transactions, and generate financial reports.',
    isSystemRole: true,
    permissions: [
      'dashboard:view',
      'customers:view',
      'suppliers:view',
      'sales:view',
      'purchases:view',
      'customer_receipts:view',
      'customer_receipts:add',
      'customer_receipts:edit',
      'customer_receipts:print',
      'supplier_payments:view',
      'supplier_payments:add',
      'supplier_payments:edit',
      'supplier_payments:print',
      'expenses:view',
      'expenses:add',
      'expenses:edit',
      'reports:view',
      'reports:print',
      'reports:export'
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role-report',
    name: 'Report User',
    description: 'Analytical read-only role. View and print reports across all business modules.',
    isSystemRole: true,
    permissions: [
      'dashboard:view',
      'customers:view',
      'suppliers:view',
      'products:view',
      'sales:view',
      'purchases:view',
      'customer_receipts:view',
      'supplier_payments:view',
      'expenses:view',
      'reports:view',
      'reports:print',
      'reports:export'
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Strict read-only viewer role without creation, modification, or printing rights.',
    isSystemRole: true,
    permissions: [
      'dashboard:view',
      'customers:view',
      'suppliers:view',
      'products:view',
      'sales:view',
      'purchases:view',
      'customer_receipts:view',
      'supplier_payments:view',
      'expenses:view',
      'reports:view'
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

/**
 * Calculates effective permissions for a user given their role and individual overrides.
 * Effective Permission = Role Default Rights + User-Specific Overrides (Allow or Deny).
 */
export function calculateEffectivePermissions(
  role: Role,
  userOverrides?: Record<PermissionKey, boolean>
): Record<PermissionKey, boolean> {
  const effective: Record<PermissionKey, boolean> = {} as Record<PermissionKey, boolean>;

  // 1. Initialize all possible permissions as false
  ALL_PERMISSION_KEYS.forEach((key) => {
    effective[key] = false;
  });

  // 2. Apply Role Defaults
  if (role && Array.isArray(role.permissions)) {
    role.permissions.forEach((key) => {
      effective[key] = true;
    });
  }

  // 3. Apply User-Specific Overrides (if any)
  if (userOverrides) {
    Object.entries(userOverrides).forEach(([key, allowed]) => {
      effective[key as PermissionKey] = Boolean(allowed);
    });
  }

  return effective;
}

/**
 * Helper to check whether an action is permitted on a module.
 */
export function checkPermission(
  effectivePermissions: Record<PermissionKey, boolean> | undefined,
  module: PermissionModule | string,
  action: PermissionAction
): boolean {
  if (!effectivePermissions) return false;

  // 1. Handle composite or aliased modules (e.g. 'payments' page in navigation)
  if (module === 'payments') {
    return (
      Boolean(effectivePermissions[`customer_receipts:${action}` as PermissionKey]) ||
      Boolean(effectivePermissions[`supplier_payments:${action}` as PermissionKey]) ||
      Boolean(effectivePermissions[`expenses:${action}` as PermissionKey])
    );
  }

  if (module === 'companies' || module === 'company') {
    return Boolean(effectivePermissions[`companies:${action}` as PermissionKey]);
  }

  if (module === 'data_import' || module === 'import') {
    return Boolean(effectivePermissions[`data_import:${action}` as PermissionKey]);
  }

  if (module === 'users') {
    return (
      Boolean(effectivePermissions[`users:${action}` as PermissionKey]) ||
      Boolean(effectivePermissions[`roles:${action}` as PermissionKey]) ||
      Boolean(effectivePermissions[`audit_logs:${action}` as PermissionKey])
    );
  }

  const key: PermissionKey = `${module as PermissionModule}:${action}`;
  return Boolean(effectivePermissions[key]);
}
