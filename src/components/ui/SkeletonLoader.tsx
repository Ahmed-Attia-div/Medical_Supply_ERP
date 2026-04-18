import { Skeleton } from '@/components/ui/skeleton';

export function StatsCardSkeleton() {
    return (
        <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="bg-card rounded-xl border border-border p-6">
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-6 w-48" />
                </div>
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-80 w-full" />
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="bg-card rounded-xl border border-border p-6">
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-6 w-48" />
                </div>
                <Skeleton className="h-4 w-64" />
                <div className="space-y-3 mt-4">
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-12 flex-1" />
                            <Skeleton className="h-12 w-24" />
                            <Skeleton className="h-12 w-32" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
