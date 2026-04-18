/**
 * purchasesService.ts — MIGRATION REDIRECT
 *
 * The old `purchase_invoices` flat table has been REMOVED in schema v2.0.
 * All purchase functionality now flows through `invoicesService` which
 * uses the proper `invoices` + `invoice_items` + `product_batches` tables.
 *
 * This file provides backward-compatible re-exports so any page that still
 * imports from 'purchasesService' continues to compile without changes.
 *
 * ACTION REQUIRED: Pages using purchasesService should be updated to use
 * invoicesService directly. This file will be removed in the next cleanup.
 */

export { invoicesService as purchasesService } from './invoicesService';

// Re-export type alias for backward compat
export type { Invoice as Purchase } from '../types/inventory';
