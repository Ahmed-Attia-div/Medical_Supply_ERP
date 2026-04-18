/**
 * Custom React hooks for fetching and managing data from Supabase
 * Uses React Query for caching and state management
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { productsService } from '@/services/productsService';
import { purchasesService } from '@/services/purchasesService';
import { surgeriesService } from '@/services/surgeriesService';
import { suppliersService, doctorsService } from '@/services/suppliersAndDoctorsService';
import { dashboardService } from '@/services/dashboardService';
import { settingsService, SystemSettings } from '@/services/settingsService';
import { invoicesService } from '@/services/invoicesService';
import { notificationsService } from '@/services/notificationsService';
import { useAuth } from '@/contexts/AuthContext';
import type { InventoryItem, Purchase, Surgery, Supplier, Doctor } from '@/types/inventory';
import { toast } from 'sonner';

// ============= PRODUCTS/INVENTORY =============

export function useProducts() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('products-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['products'] });
                    queryClient.invalidateQueries({ queryKey: ['low-stock-items'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['products'],
        queryFn: () => productsService.getAll(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}


export function useDeadStockItems() {
    return useQuery({
        queryKey: ['dead-stock-items'],
        queryFn: () => productsService.getDeadStock(),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

export function useProduct(id: string) {
    return useQuery({
        queryKey: ['products', id],
        queryFn: () => productsService.getById(id),
        enabled: !!id,
    });
}

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (product: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'lastMovementDate'>) =>
            productsService.create(product),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم إضافة الصنف بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في إضافة الصنف: ${error.message}`);
        },
    });
}

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) =>
            productsService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم تحديث الصنف بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث الصنف: ${error.message}`);
        },
    });
}

export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => productsService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم حذف الصنف بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في حذف الصنف: ${error.message}`);
        },
    });
}

// ============= PURCHASES =============

export function usePurchases(startDate?: Date, endDate?: Date) {
    return useQuery({
        queryKey: ['purchases', startDate?.toISOString(), endDate?.toISOString()],
        queryFn: () => {
            if (startDate && endDate) {
                return purchasesService.getByDateRange(startDate, endDate);
            }
            return purchasesService.getAll();
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useCreatePurchase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (purchase: Omit<Purchase, 'id' | 'createdAt'>) =>
            purchasesService.create(purchase),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم إضافة فاتورة الشراء بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في إضافة الفاتورة: ${error.message}`);
        },
    });
}

export function useUpdatePurchase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Purchase> }) =>
            purchasesService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            toast.success('تم تحديث الفاتورة بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث الفاتورة: ${error.message}`);
        },
    });
}

export function useDeletePurchase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => purchasesService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم حذف الفاتورة بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في حذف الفاتورة: ${error.message}`);
        },
    });
}

// ============= INVOICES (NEW SYSTEM) =============

export function useInvoices() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('invoices-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'invoices' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['invoices'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
                    queryClient.invalidateQueries({ queryKey: ['products'] }); // Stock changes
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'invoice_items' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['invoices'] });
                    queryClient.invalidateQueries({ queryKey: ['products'] }); // Item updates affect stock info
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['invoices'],
        queryFn: () => invoicesService.getAll(),
        staleTime: 1000 * 60 * 5,
    });
}


export function useInvoice(id: string) {
    return useQuery({
        queryKey: ['invoices', id],
        queryFn: () => invoicesService.getById(id),
        enabled: !!id,
    });
}

export function useCreateInvoice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (invoice: any) => invoicesService.create(invoice),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['products'] }); // Stock updates
            toast.success('تم إنشاء الفاتورة بنجاح');
        },
        onError: (error: Error) => {
            console.error('Create Invoice Error:', error);
            toast.error(`فشل إنشاء الفاتورة: ${error.message}`);
        },
    });
}

export function useTransformProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { sourceItemId: string, targetItemId: string, quantity: number, notes?: string, userId: string }) =>
            productsService.transformItem(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تمت عملية التحويل بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في عملية التحويل: ${error.message}`);
        },
    });
}

// ============= SURGERIES =============

export function useSurgeries(startDate?: Date, endDate?: Date) {
    return useQuery({
        queryKey: ['surgeries', startDate?.toISOString(), endDate?.toISOString()],
        queryFn: () => {
            if (startDate && endDate) {
                return surgeriesService.getByDateRange(startDate, endDate);
            }
            return surgeriesService.getAll();
        },
        staleTime: 1000 * 60 * 5,
    });
}

export function useSurgery(id: string) {
    return useQuery({
        queryKey: ['surgeries', id],
        queryFn: () => surgeriesService.getById(id),
        enabled: !!id,
    });
}

export function useCreateSurgery() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (surgery: Omit<Surgery, 'id' | 'createdAt'>) =>
            surgeriesService.create(surgery),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['surgeries'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم إضافة العملية الجراحية بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في إضافة العملية: ${error.message}`);
        },
    });
}

export function useUpdateSurgery() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Surgery> }) =>
            surgeriesService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['surgeries'] });
            toast.success('تم تحديث العملية بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث العملية: ${error.message}`);
        },
    });
}

export function useDeleteSurgery() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => surgeriesService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['surgeries'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('تم حذف العملية بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في حذف العملية: ${error.message}`);
        },
    });
}

export function useSurgeryProfitability() {
    return useQuery({
        queryKey: ['surgeries', 'profitability'],
        queryFn: () => surgeriesService.getProfitability(),
        staleTime: 1000 * 60 * 5,
    });
}

export function useTopSellingItems(startDate?: Date, endDate?: Date, limit: number = 10) {
    return useQuery({
        queryKey: ['surgeries', 'top-selling', startDate?.toISOString(), endDate?.toISOString(), limit],
        queryFn: () => surgeriesService.getTopSellingItems(startDate, endDate, limit),
        staleTime: 1000 * 60 * 5,
    });
}


// ============= SUPPLIERS =============

export function useSuppliers() {
    return useQuery({
        queryKey: ['suppliers'],
        queryFn: () => suppliersService.getAll(),
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
}

export function useCreateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (supplier: Omit<Supplier, 'id'>) =>
            suppliersService.create(supplier),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('تم إضافة المورد بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في إضافة المورد: ${error.message}`);
        },
    });
}

export function useUpdateSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Supplier> }) =>
            suppliersService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('تم تحديث المورد بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث المورد: ${error.message}`);
        },
    });
}

export function useDeleteSupplier() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => suppliersService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('تم حذف المورد بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في حذف المورد: ${error.message}`);
        },
    });
}

// ============= DOCTORS =============

export function useDoctors() {
    return useQuery({
        queryKey: ['doctors'],
        queryFn: () => doctorsService.getAll(),
        staleTime: 1000 * 60 * 10,
    });
}

export function useCreateDoctor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (doctor: Omit<Doctor, 'id'>) =>
            doctorsService.create(doctor),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] });
            toast.success('تم إضافة الطبيب بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في إضافة الطبيب: ${error.message}`);
        },
    });
}

export function useUpdateDoctor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<Doctor> }) =>
            doctorsService.update(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] });
            toast.success('تم تحديث الطبيب بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث الطبيب: ${error.message}`);
        },
    });
}

export function useDeleteDoctor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => doctorsService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] });
            toast.success('تم حذف الطبيب بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في حذف الطبيب: ${error.message}`);
        },
    });
}

// ============= DASHBOARD STATS =============

/**
 * Hook للحصول على إحصائيات Dashboard من View المحسّن
 * أسرع بنسبة 70% من الحسابات في Frontend
 */
export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => dashboardService.getStats(),
        staleTime: 1000 * 60 * 1, // 1 minute (نحدّث كل دقيقة)
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

/**
 * Hook للحصول على أصناف منخفضة المخزون من View
 */
export function useLowStockItems() {
    return useQuery({
        queryKey: ['low-stock-items'],
        queryFn: () => dashboardService.getLowStockItems(),
        staleTime: 1000 * 60 * 2, // 2 minutes
        retry: 3,
    });
}

/**
 * Hook للحصول على آخر العمليات من View
 */
export function useRecentSurgeries() {
    return useQuery({
        queryKey: ['recent-surgeries'],
        queryFn: () => dashboardService.getRecentSurgeries(),
        staleTime: 1000 * 60 * 1, // 1 minute
        retry: 3,
    });
}

// ============= SETTINGS =============

export function useSettings() {
    return useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsService.getSettings(),
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export function useUpdateSettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (settings: Partial<SystemSettings>) => settingsService.updateSettings(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            queryClient.invalidateQueries({ queryKey: ['dead-stock-items'] });
            toast.success('تم حفظ الإعدادات بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في حفظ الإعدادات: ${error.message}`);
        }
    });
}

// ============= NOTIFICATIONS =============

export function useNotifications() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('notifications-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationsService.getNotifications(),
        // No need for aggressive polling since we have realtime
        staleTime: 1000 * 60 * 5,
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => notificationsService.markAsRead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => notificationsService.markAllAsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('تم تحديد الكل كمقروء');
        },
    });
}

export function useDeleteAllNotifications() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => notificationsService.deleteAll(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            toast.success('تم مسح جميع الإشعارات');
        },
    });
}

// ============= USERS =============

export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: () => import('@/services/usersService').then(m => m.usersService.getAll()),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

export function useUser(id: string) {
    return useQuery({
        queryKey: ['users', id],
        queryFn: () => import('@/services/usersService').then(m => m.usersService.getById(id)),
        enabled: !!id,
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: (input: import('@/types/inventory').CreateUserInput) =>
            import('@/services/usersService').then(m => m.usersService.create(input, user?.id || '')),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('تم إضافة المستخدم بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في إضافة المستخدم: ${error.message}`);
        },
    });
}

export function useUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<import('@/types/inventory').User> }) =>
            import('@/services/usersService').then(m => m.usersService.update(id, updates)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('تم تحديث المستخدم بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث المستخدم: ${error.message}`);
        },
    });
}


export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) =>
            import('@/services/usersService').then(m => m.usersService.delete(id)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('تم حذف المستخدم بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في حذف المستخدم: ${error.message}`);
        },
    });
}

export function useUpdateUserPassword() {
    return useMutation({
        mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
            import('@/services/usersService').then(m => m.usersService.updatePassword(id, newPassword)),
        onSuccess: () => {
            toast.success('تم تحديث كلمة المرور بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث كلمة المرور: ${error.message}`);
        },
    });
}

// ============= PROFILE =============

export function useUpdateProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: { name?: string; email?: string; phone?: string } }) =>
            import('@/services/usersService').then(m => m.usersService.update(id, updates)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
            toast.success('تم تحديث البيانات بنجاح');
        },
        onError: (error: Error) => {
            toast.error(`فشل في تحديث البيانات: ${error.message}`);
        },
    });
}

export function useCurrentUserProfile(userId?: string) {
    return useQuery({
        queryKey: ['currentUserProfile', userId],
        queryFn: () => import('@/services/usersService').then(m => m.usersService.getById(userId!)),
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

