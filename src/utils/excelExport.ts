/**
 * Excel Export Utility for Financial Reports
 * Uses SheetJS (xlsx) to create multi-sheet Excel files
 */

import * as XLSX from 'xlsx';
import type { InventoryItem } from '@/types/inventory';

interface ExportStats {
    totalValue: number;
    totalPurchases: number;
    totalSales: number;
    totalProfit: number;
    lowStockValue: number;
}

interface CategoryData {
    category: string;
    count: number;
    quantity: number;
    value: number;
}

interface TopItemData {
    name: string;
    totalQuantity: number;
    totalRevenue: number;
}

interface DateRange {
    startDate: Date;
    endDate: Date;
}

/**
 * Format currency for Excel
 */
function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-EG', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value) + ' ج.م';
}

/**
 * Format number for Excel
 */
function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-EG').format(value);
}

/**
 * Format date for filename
 */
function formatDateForFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Export financial reports to Excel
 */
export function exportFinancialReportsToExcel(
    stats: ExportStats,
    categoryData: CategoryData[],
    topItems: TopItemData[],
    inventory: InventoryItem[],
    dateRange: DateRange | null,
    selectedPeriod: string
) {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // ============= SHEET 1: Financial Summary =============
    const summaryData = [
        ['التقرير المالي الشامل'],
        [''],
        ['الفترة الزمنية:', selectedPeriod],
        dateRange ? ['من:', new Date(dateRange.startDate).toLocaleDateString('ar-EG')] : [],
        dateRange ? ['إلى:', new Date(dateRange.endDate).toLocaleDateString('ar-EG')] : [],
        [''],
        ['الإحصائيات المالية'],
        ['البيان', 'القيمة'],
        ['إجمالي قيمة المخزون', formatCurrency(stats.totalValue)],
        ['إجمالي المشتريات', formatCurrency(stats.totalPurchases)],
        ['إجمالي المبيعات', formatCurrency(stats.totalSales)],
        ['إجمالي الأرباح', formatCurrency(stats.totalProfit)],
        ['قيمة المخزون المنخفض', formatCurrency(stats.lowStockValue)],
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths for summary sheet
    summarySheet['!cols'] = [
        { wch: 25 }, // Column A
        { wch: 20 }, // Column B
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص المالي');

    // ============= SHEET 2: Inventory by Category =============
    const categoryHeaders = [['الفئة', 'عدد الأصناف', 'إجمالي الكميات', 'القيمة']];
    const categoryRows = categoryData.map(item => [
        item.category,
        formatNumber(item.count),
        formatNumber(item.quantity),
        formatCurrency(item.value),
    ]);

    const categorySheet = XLSX.utils.aoa_to_sheet([
        ['المخزون حسب الفئة'],
        [''],
        ...categoryHeaders,
        ...categoryRows,
    ]);

    // Set column widths for category sheet
    categorySheet['!cols'] = [
        { wch: 20 }, // Category
        { wch: 15 }, // Count
        { wch: 18 }, // Quantity
        { wch: 20 }, // Value
    ];

    XLSX.utils.book_append_sheet(workbook, categorySheet, 'المخزون حسب الفئة');

    // ============= SHEET 3: Best Selling Items (Revenue) =============
    const topItemsHeaders = [['الصنف', 'إجمالي الكمية المباعة', 'إجمالي الإيرادات']];
    const topItemsRows = topItems.map(item => [
        item.name,
        formatNumber(item.totalQuantity),
        formatCurrency(item.totalRevenue),
    ]);

    const topItemsSheet = XLSX.utils.aoa_to_sheet([
        ['الأصناف الأكثر مبيعاً (إيرادات)'],
        [''],
        ...topItemsHeaders,
        ...topItemsRows,
    ]);

    // Set column widths for top items sheet
    topItemsSheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 20 }, // Total Quantity
        { wch: 20 }, // Total Revenue
    ];

    XLSX.utils.book_append_sheet(workbook, topItemsSheet, 'الأكثر مبيعاً');

    // ============= SHEET 4: Complete Inventory =============
    const inventoryHeaders = [
        ['الصنف', 'رمز SKU', 'الفئة', 'الكمية', 'السعر الأساسي', 'سعر البيع', 'القيمة الإجمالية']
    ];
    const inventoryRows = inventory.map(item => [
        item.name,
        item.sku,
        item.category,
        formatNumber(item.quantity),
        formatCurrency(item.basePrice),
        formatCurrency(item.sellingPrice),
        formatCurrency(item.quantity * item.basePrice),
    ]);

    const inventorySheet = XLSX.utils.aoa_to_sheet([
        ['الملخص المالي الشامل'],
        [''],
        ...inventoryHeaders,
        ...inventoryRows,
    ]);

    // Set column widths for inventory sheet
    inventorySheet['!cols'] = [
        { wch: 25 }, // Name
        { wch: 15 }, // SKU
        { wch: 15 }, // Category
        { wch: 12 }, // Quantity
        { wch: 18 }, // Base Price
        { wch: 18 }, // Selling Price
        { wch: 20 }, // Total Value
    ];

    XLSX.utils.book_append_sheet(workbook, inventorySheet, 'المخزون الكامل');

    // ============= Generate filename =============
    let filename = 'Financial_Report';

    if (dateRange) {
        const startStr = formatDateForFilename(dateRange.startDate);
        const endStr = formatDateForFilename(dateRange.endDate);
        filename = `Financial_Report_${startStr}_${endStr}`;
    } else {
        const today = formatDateForFilename(new Date());
        filename = `Financial_Report_All_Time_${today}`;
    }

    // ============= Write and download the file =============
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}
