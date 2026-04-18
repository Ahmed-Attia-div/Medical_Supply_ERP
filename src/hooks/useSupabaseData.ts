/**
 * useSupabaseData.ts — v2.0
 *
 * Replaces mock-data fallbacks with real service calls.
 * All hooks integrate React Query for caching + realtime invalidation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsService, type ProductFilters, type PaginationParams } from '@/services/productsService';
import { surgeriesService } from '@/services/surgeriesService';
import { dashboardService } from '@/services/dashboardService';
import { notificationsService } from '@/services/notificationsService';
import { settingsService } from '@/services/settingsService';

// ─── Products ─────────────────────────────────────────────────────────────────

/** Paginated, filtered product list — replaces old useInventory() */
export function useProducts(
    filters: ProductFilters = {},
    pagination: PaginationParams = { page: 1, pageSize: 25 },
) {
    return useQuery({
        queryKey: ['products', filters, pagination],
        queryFn: () => productsService.getPaginated(filters, pagination),
        staleTime: 30_000,  // 30 sec before considering stale
        placeholderData: (prev) => prev,  // keep old data while refetching (no flash)
    });
}

/** Lightweight product list for <Select> dropdowns */
export function useProductSelectList(search?: string) {
    return useQuery({
        queryKey: ['product-select-list', search ?? ''],
        queryFn: () => productsService.getSelectList(search),
        staleTime: 60_000,
    });
}

/** Single product by id */
export function useProduct(id: string | undefined) {
    return useQuery({
        queryKey: ['products', id],
        queryFn: () => productsService.getById(id!),
        enabled: Boolean(id),
        staleTime: 60_000,
    });
}

/** Batches for a product (for surgery source selection) */
export function useProductBatches(productId: string | undefined) {
    return useQuery({
        queryKey: ['product-batches', productId],
        queryFn: () => productsService.getBatches(productId!),
        enabled: Boolean(productId),
        staleTime: 30_000,
    });
}

// ─── Surgeries ────────────────────────────────────────────────────────────────

/** @deprecated use useSurgeriesList — kept for backward compat */
export const useSurgeries = () => useSurgeriesList();

export function useSurgeriesList(doctorId?: string) {
    return useQuery({
        queryKey: ['surgeries', doctorId ?? 'all'],
        queryFn: () =>
            doctorId
                ? surgeriesService.getByDoctor(doctorId)
                : surgeriesService.getAll(),
        staleTime: 30_000,
    });
}

export function useSurgery(id: string | undefined) {
    return useQuery({
        queryKey: ['surgeries', id],
        queryFn: () => surgeriesService.getById(id!),
        enabled: Boolean(id),
        staleTime: 60_000,
    });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => dashboardService.getStats(),
        staleTime: 60_000,
        refetchOnWindowFocus: true,
    });
}

export function useLowStockItems() {
    return useQuery({
        queryKey: ['low-stock'],
        queryFn: () => dashboardService.getLowStockItems(),
        staleTime: 60_000,
    });
}

export function useRecentSurgeries() {
    return useQuery({
        queryKey: ['recent-surgeries'],
        queryFn: () => dashboardService.getRecentSurgeries(),
        staleTime: 60_000,
    });
}

export function useExpiringBatches() {
    return useQuery({
        queryKey: ['expiring-batches'],
        queryFn: () => dashboardService.getExpiringBatches(),
        staleTime: 60_000,
    });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function useNotifications() {
    return useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationsService.getAll(),
        staleTime: 30_000,
    });
}

export function useUnreadCount() {
    return useQuery({
        queryKey: ['notifications-count'],
        queryFn: () => notificationsService.getUnreadCount(),
        staleTime: 10_000,
        refetchOnWindowFocus: true,
    });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useSystemSettings() {
    return useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsService.getSettings(),
        staleTime: 300_000,
    });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useMarkAllRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => notificationsService.markAllAsRead(),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-count'] });
        },
    });
}

/** @deprecated use useInventory from old code — kept for backward compat */
export const useInventory = () => useProducts();
