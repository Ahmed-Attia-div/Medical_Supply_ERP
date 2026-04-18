// ============= User Roles =============
// 4 roles only — matches database CHECK constraint exactly
export type UserRole = 'admin' | 'storekeeper' | 'doctor' | 'partner';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدير النظام',
  storekeeper: 'أمين مخزن',
  doctor: 'طبيب',
  partner: 'شريك',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'صلاحيات كاملة — إدارة المستخدمين والإعدادات والبيانات',
  storekeeper: 'عمليات المخزون — الاستلام والصرف. لا يرى البيانات المالية',
  doctor: 'تسجيل العمليات الجراحية فقط',
  partner: 'قراءة فقط — لا يمكنه إضافة أو تعديل أو حذف أي بيانات',
};

// ============= Permission Types =============
export interface RolePermissions {
  // Inventory & Catalog
  canViewInventory: boolean;
  canCreateInventory: boolean;  // Add new SKU
  canEditInventory: boolean;  // Edit existing SKU
  canDeleteInventory: boolean;
  canViewPrices: boolean;
  canEditBasePrice: boolean;
  canEditSellingPrice: boolean;

  // Stock Operations
  canCreateStockIn: boolean;  // Create purchase invoice
  canCreateStockOut: boolean;  // Record surgery / sale
  canProcessReturn: boolean;  // Return surgery items
  canEditAfterSubmit: boolean;
  canDeleteRecords: boolean;
  canPerformTransformation: boolean; // Scrap / cut / convert

  // Financial
  canViewFinancials: boolean;
  canViewProfit: boolean;
  canViewAnalytics: boolean;

  // Admin
  canManageUsers: boolean;
  canManageSettings: boolean;
}

// ============= Role Permission Matrix =============
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canViewInventory: true,
    canCreateInventory: true,
    canEditInventory: true,
    canDeleteInventory: true,
    canViewPrices: true,
    canEditBasePrice: true,
    canEditSellingPrice: true,

    canCreateStockIn: true,
    canCreateStockOut: true,
    canProcessReturn: true,
    canEditAfterSubmit: true,
    canDeleteRecords: true,
    canPerformTransformation: true,

    canViewFinancials: true,
    canViewProfit: true,
    canViewAnalytics: true,

    canManageUsers: true,
    canManageSettings: true,
  },

  storekeeper: {
    canViewInventory: true,
    canCreateInventory: true,
    canEditInventory: false,
    canDeleteInventory: false,
    canViewPrices: true,
    canEditBasePrice: true,   // enters WAC cost on purchase
    canEditSellingPrice: true,   // enters selling price on purchase

    canCreateStockIn: true,
    canCreateStockOut: true,
    canProcessReturn: true,
    canEditAfterSubmit: false,
    canDeleteRecords: false,
    canPerformTransformation: true,

    canViewFinancials: false,
    canViewProfit: false,
    canViewAnalytics: false,

    canManageUsers: false,
    canManageSettings: false,
  },

  doctor: {
    canViewInventory: true,
    canCreateInventory: false,
    canEditInventory: false,
    canDeleteInventory: false,
    canViewPrices: false,  // doctors don't see cost/price
    canEditBasePrice: false,
    canEditSellingPrice: false,

    canCreateStockIn: false,
    canCreateStockOut: true,   // record surgeries
    canProcessReturn: false,
    canEditAfterSubmit: false,
    canDeleteRecords: false,
    canPerformTransformation: false,

    canViewFinancials: false,
    canViewProfit: false,
    canViewAnalytics: false,

    canManageUsers: false,
    canManageSettings: false,
  },

  // STRICTLY READ-ONLY — zero write permissions
  partner: {
    canViewInventory: true,
    canCreateInventory: false,
    canEditInventory: false,
    canDeleteInventory: false,
    canViewPrices: true,
    canEditBasePrice: false,
    canEditSellingPrice: false,

    canCreateStockIn: false,
    canCreateStockOut: false,
    canProcessReturn: false,
    canEditAfterSubmit: false,
    canDeleteRecords: false,
    canPerformTransformation: false,

    canViewFinancials: true,
    canViewProfit: true,
    canViewAnalytics: true,

    canManageUsers: false,
    canManageSettings: false,
  },
};

// ============= Helper Functions =============
export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

export function isReadOnly(role: UserRole): boolean {
  return role === 'partner';
}
