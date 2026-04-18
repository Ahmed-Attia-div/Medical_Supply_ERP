/**
 * useRealtime.ts
 *
 * Supabase Realtime hooks for products and notifications.
 * Use these in Dashboard and Inventory instead of plain useQuery.
 *
 * Features:
 *  - Subscribes to Postgres CDC changes on the given table
 *  - Automatically invalidates React Query cache on any change
 *  - Cleans up subscription on unmount
 *  - Shows a toast when a relevant change arrives (optional)
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOptions {
    /** Which query keys to invalidate when a change arrives */
    invalidateKeys: string[][];
    /** Postgres schema — almost always 'public' */
    schema?: string;
    /** Optional filter e.g. "status=eq.active" */
    filter?: string;
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Automatically invalidates React Query cache on INSERT/UPDATE/DELETE.
 *
 * @example
 * useTableRealtime('products', { invalidateKeys: [['products']] });
 */
export function useTableRealtime(
    table: string,
    options: UseRealtimeOptions,
) {
    const queryClient = useQueryClient();
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        const channelName = `realtime:${table}:${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: options.schema ?? 'public',
                    table,
                    filter: options.filter,
                },
                () => {
                    // Invalidate all specified query keys so data refetches
                    options.invalidateKeys.forEach(key => {
                        queryClient.invalidateQueries({ queryKey: key });
                    });
                },
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table]);
}

// ─── Pre-built hooks for common tables ───────────────────────────────────────

/**
 * Enables realtime sync for the `products` table.
 * Call this once inside Dashboard or Inventory page.
 * Any INSERT/UPDATE/DELETE on products will refetch the products list
 * and dashboard stats automatically.
 */
export function useProductsRealtime() {
    useTableRealtime('products', {
        invalidateKeys: [
            ['products'],
            ['dashboard-stats'],
            ['low-stock'],
        ],
    });
}

/**
 * Enables realtime sync for the `notifications` table.
 * Call this once at the layout level (MainLayout).
 */
export function useNotificationsRealtime() {
    useTableRealtime('notifications', {
        invalidateKeys: [
            ['notifications'],
            ['notifications-count'],
        ],
    });
}

/**
 * Enables realtime sync for `surgeries` table.
 * Dashboard refreshes on new surgeries automatically.
 */
export function useSurgeriesRealtime() {
    useTableRealtime('surgeries', {
        invalidateKeys: [
            ['surgeries'],
            ['dashboard-stats'],
            ['recent-surgeries'],
        ],
    });
}

/**
 * Enables realtime sync for `invoices` table.
 * Dashboard and purchases page refresh on new purchases.
 */
export function useInvoicesRealtime() {
    useTableRealtime('invoices', {
        invalidateKeys: [
            ['invoices'],
            ['dashboard-stats'],
            ['open-invoices'],
        ],
    });
}
