import type { UserRole } from './roles';

// ============= Enums / Literals =============
export type MaterialType = 'titanium' | 'stainless';
export type ItemCategory =
  | 'screws' | 'plates' | 'rods' | 'wires'
  | 'nails' | 'instruments' | 'consumables';
export type SterilizationStatus = 'sterilized' | 'non_sterilized' | 'requires_sterilization';
export type PaymentType = 'cash' | 'credit';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type UserStatus = 'active' | 'inactive';
export type TransactionType =
  | 'purchase' | 'surgery' | 'sale' | 'adjustment'
  | 'transformation_out' | 'transformation_in' | 'surgery_return';
export type NotificationType =
  | 'low_stock' | 'dead_stock' | 'new_purchase'
  | 'new_surgery' | 'margin_warning' | 'system';

// ============= Label Maps =============
export const MATERIAL_LABELS: Record<MaterialType, string> = {
  titanium: 'تيتانيوم',
  stainless: 'ستانلس ستيل',
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  screws: 'براغي',
  plates: 'شرائح',
  rods: 'قضبان',
  wires: 'أسلاك',
  nails: 'مسامير نخاعية',
  instruments: 'أدوات جراحية',
  consumables: 'مستهلكات',
};

export const STERILIZATION_LABELS: Record<SterilizationStatus, string> = {
  sterilized: 'معقم',
  non_sterilized: 'غير معقم',
  requires_sterilization: 'يتطلب تعقيم',
};

export const DIAMETER_OPTIONS = [
  '2.0mm', '2.4mm', '2.7mm', '3.5mm', '4.0mm', '4.5mm', '5.0mm', '6.5mm',
] as const;

export const LENGTH_OPTIONS = [
  '12mm', '14mm', '16mm', '18mm', '20mm', '22mm', '24mm', '26mm',
  '28mm', '30mm', '32mm', '34mm', '36mm', '38mm', '40mm', '45mm', '50mm', '55mm', '60mm',
] as const;

export const PLATE_LENGTH_OPTIONS = [
  '4-hole', '6-hole', '8-hole', '10-hole', '12-hole', '14-hole', '16-hole',
] as const;

// ============= Users =============
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
}

// ============= Suppliers =============
export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

// ============= Doctors =============
export interface Doctor {
  id: string;
  name: string;
  specialty?: string;
  phone?: string;
}

// ============= Products (SKU Catalog) =============
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ItemCategory;
  material?: MaterialType;
  diameter?: string;
  length?: string;
  unit: string;
  minStock: number;
  sterilizationStatus: SterilizationStatus;
  sellingPrice: number;
  // Computed/cached — updated by DB trigger
  basePriceWac: number;
  totalQuantity: number;
  lastMovementAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// ============= Product Batches =============
export interface ProductBatch {
  id: string;
  productId: string;
  batchNo?: string;
  quantity: number;
  unitCost: number;
  receivedDate: Date;
  expiryDate?: Date;
  invoiceItemId?: string;
  notes?: string;
  createdAt: Date;
}

// ============= Invoices =============
export interface Invoice {
  id: string;
  supplierId: string;
  supplierName?: string;     // joined
  invoiceDate: Date;
  vendorInvoiceNumber?: string;
  paymentType: PaymentType;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  notes?: string;
  items?: InvoiceItem[];
  createdBy?: string;
  createdAt: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName?: string;   // joined
  quantity: number;
  unitCost: number;
  batchNo?: string;
  expiryDate?: Date;
  createdAt: Date;
}

export interface CreateInvoiceInput {
  supplierId: string;
  invoiceDate: Date;
  vendorInvoiceNumber?: string;
  notes?: string;
  totalAmount: number;
  paymentType: PaymentType;
  amountPaid?: number;
  items: {
    product_id: string;
    quantity: number;
    unit_cost: number;
    batch_no?: string;
    expiry_date?: string;
  }[];
  createdBy?: string;
}

// ============= Surgeries =============
export interface Surgery {
  id: string;
  doctorId: string;
  doctorName?: string;    // joined
  patientId?: string;
  patientName: string;
  date: Date;
  type: string;
  items: SurgeryItem[];
  totalBaseValue: number;
  totalSellingValue: number;
  profit: number;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface SurgeryItem {
  id?: string;
  surgeryId?: string;
  productId: string;
  sourceBatchId?: string;
  itemName: string;
  quantity: number;
  returnedQuantity: number;
  basePrice: number;
  sellingPrice: number;
  returnedAt?: Date;
  returnNotes?: string;
  sku?: string;
  batchNo?: string;
}

export interface CreateSurgeryInput {
  doctorId: string;
  patientId?: string;
  patientName: string;
  date: Date;
  type: string;
  notes?: string;
  items: {
    product_id: string;
    item_name: string;
    quantity: number;
    base_price: number;
    selling_price: number;
    source_batch_id?: string;
  }[];
  createdBy?: string;
}

// ============= Inventory Transactions =============
export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  batchId?: string;
  quantity: number;  // positive=in, negative=out
  transactionType: TransactionType;
  referenceId?: string;
  referenceType?: 'invoice' | 'surgery' | 'manual';
  unitCostSnapshot?: number;
  sellingPriceSnapshot?: number;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

// ============= Inventory Transformations =============
export interface InventoryTransformation {
  id: string;
  sourceProductId: string;
  targetProductId: string;
  sourceBatchId?: string;
  quantity: number;
  costDifference?: number;
  currentSourceCost?: number;
  currentTargetCost?: number;
  notes?: string;
  performedBy?: string;
  createdAt: Date;
}

export interface TransformItemInput {
  sourceProductId: string;
  targetProductId: string;
  quantity: number;
  sourceBatchId?: string;
  notes?: string;
}

// ============= Notifications =============
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

// ============= System Settings =============
export interface SystemSettings {
  id: string;
  deadStockThresholdMonths: number;
  lowStockAlertEnabled: boolean;
  marginWarningEnabled: boolean;
  deadStockAlertEnabled: boolean;
  newPurchaseAlertEnabled: boolean;
  newSurgeryAlertEnabled: boolean;
}

// ============= Dashboard =============
export interface DashboardStats {
  total_skus: number;
  total_quantity: number;
  low_stock_count: number;
  dead_stock_count: number;
  total_inventory_value: number | null;   // null if no permission
  total_purchases: number | null;
  total_profit: number | null;
  total_surgeries: number;
  unpaid_invoices_count: number | null;
}

// ============= Helpers =============
export type StockStatus = 'low' | 'medium' | 'good';

export function getStockStatus(quantity: number, minStock: number): StockStatus {
  if (quantity <= minStock) return 'low';
  if (quantity <= minStock * 2) return 'medium';
  return 'good';
}

export function isDeadStock(lastMovementAt: Date, thresholdMonths: number): boolean {
  const now = new Date();
  const diffMonths =
    (now.getFullYear() - lastMovementAt.getFullYear()) * 12 +
    (now.getMonth() - lastMovementAt.getMonth());
  return diffMonths >= thresholdMonths;
}

export function validateMargin(basePriceWac: number, sellingPrice: number) {
  const marginPct = basePriceWac > 0
    ? ((sellingPrice - basePriceWac) / basePriceWac) * 100
    : 0;
  return {
    isValid: sellingPrice >= basePriceWac,
    message: sellingPrice < basePriceWac
      ? 'تحذير: سعر البيع أقل من التكلفة!'
      : undefined,
    marginPercentage: marginPct,
  };
}

// Plate cutting cost helper (kept for compatibility)
export function calculatePlateCuttingCost(
  originalLength: string,
  newLength: string,
  basePrice: number,
): number {
  const origHoles = parseInt(originalLength.replace('-hole', ''));
  const newHoles = parseInt(newLength.replace('-hole', ''));
  if (isNaN(origHoles) || isNaN(newHoles) || newHoles >= origHoles) return basePrice;
  return Math.round((basePrice * newHoles / origHoles) * 100) / 100;
}

// ── Legacy aliases (so existing imports don't break during migration) ──
/** @deprecated Use Product instead */
export type InventoryItem = Product;
