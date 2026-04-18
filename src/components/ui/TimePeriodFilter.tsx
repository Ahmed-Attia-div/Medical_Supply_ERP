import { Calendar } from 'lucide-react';
import { formatDateRange, getDateRangeFromPeriod } from '@/utils/dateUtils';

export type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

interface TimePeriodFilterProps {
    selectedPeriod: TimePeriod;
    onPeriodChange: (period: TimePeriod) => void;
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
    today: 'اليوم',
    week: 'هذا الأسبوع',
    month: 'هذا الشهر',
    year: 'هذا العام',
    all: 'الكل',
};

export function TimePeriodFilter({ selectedPeriod, onPeriodChange }: TimePeriodFilterProps) {
    const periods: TimePeriod[] = ['today', 'week', 'month', 'year', 'all'];
    const dateRange = getDateRangeFromPeriod(selectedPeriod);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 bg-card rounded-xl border border-border p-2">
                <div className="flex items-center gap-2 px-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">الفترة:</span>
                </div>
                <div className="flex gap-1">
                    {periods.map((period) => (
                        <button
                            key={period}
                            onClick={() => onPeriodChange(period)}
                            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${selectedPeriod === period
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                }
            `}
                        >
                            {PERIOD_LABELS[period]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Date Range Display */}
            {dateRange && (
                <div className="text-sm text-muted-foreground text-center">
                    <span className="font-medium">الفترة المحددة: </span>
                    <span className="num">{formatDateRange(dateRange)}</span>
                </div>
            )}
        </div>
    );
}
