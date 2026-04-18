import type { TimePeriod } from '@/components/ui/TimePeriodFilter';

export interface DateRange {
    startDate: Date;
    endDate: Date;
}

/**
 * Calculate date range based on selected time period
 * @param period - The selected time period
 * @returns Object with startDate and endDate
 */
export function getDateRangeFromPeriod(period: TimePeriod): DateRange | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
        case 'today': {
            const startDate = new Date(today);
            const endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            return { startDate, endDate };
        }

        case 'week': {
            // Get start of week (Saturday in Egypt)
            const dayOfWeek = today.getDay();
            const daysToSaturday = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - daysToSaturday);

            const endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            return { startDate, endDate };
        }

        case 'month': {
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            const endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            return { startDate, endDate };
        }

        case 'year': {
            const startDate = new Date(now.getFullYear(), 0, 1);
            const endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            return { startDate, endDate };
        }

        case 'all': {
            // Return null to indicate no filtering needed
            return null;
        }

        default:
            return null;
    }
}

/**
 * Format date range for display
 */
export function formatDateRange(dateRange: DateRange | null): string {
    if (!dateRange) return 'جميع الفترات';

    const formatter = new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return `${formatter.format(dateRange.startDate)} - ${formatter.format(dateRange.endDate)}`;
}
