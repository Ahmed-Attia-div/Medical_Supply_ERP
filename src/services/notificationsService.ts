/**
 * Notifications Service — v2.0
 * Changes: proper camelCase mapping, uses standardized error handler,
 * type-safe Notification interface.
 */

import { supabase } from '../lib/supabase';
import { handleSupabaseError } from '../lib/supabaseError';
import type { Notification, NotificationType } from '../types/inventory';

function fromDb(row: Record<string, unknown>): Notification {
    return {
        id: row.id as string,
        type: row.type as NotificationType,
        title: row.title as string,
        message: row.message as string,
        link: row.link as string | undefined,
        isRead: Boolean(row.is_read),
        createdAt: new Date(row.created_at as string),
    };
}

export const notificationsService = {

    /** Fetch all notifications, newest first */
    async getAll(): Promise<Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw handleSupabaseError(error, 'جلب الإشعارات');
        return (data ?? []).map(fromDb);
    },

    /** Get unread count only (lightweight) */
    async getUnreadCount(): Promise<number> {
        const { count, error } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('is_read', false);

        if (error) return 0;
        return count ?? 0;
    },

    /** Mark a single notification as read */
    async markAsRead(id: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) throw handleSupabaseError(error, 'تحديث الإشعار');
    },

    /** Mark all unread as read */
    async markAllAsRead(): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('is_read', false);

        if (error) throw handleSupabaseError(error, 'تحديث الإشعارات');
    },

    /** Delete all notifications */
    async deleteAll(): Promise<void> {
        // Use neq against a nil UUID as a safe "delete all" workaround
        const { error } = await supabase
            .from('notifications')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) throw handleSupabaseError(error, 'مسح الإشعارات');
    },

    /** Create a notification (fire-and-forget — never throws) */
    async create(
        notification: Pick<Notification, 'type' | 'title' | 'message' | 'link'>,
    ): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .insert({
                type: notification.type,
                title: notification.title,
                message: notification.message,
                link: notification.link ?? null,
                is_read: false,
            });

        // Intentionally swallow error — notifications must never block the main flow
        if (error) console.warn('[notificationsService.create]', error.message);
    },

    /** Delete notifications older than N days */
    async cleanup(olderThanDays = 30): Promise<void> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);

        const { error } = await supabase
            .from('notifications')
            .delete()
            .lt('created_at', cutoff.toISOString());

        if (error) throw handleSupabaseError(error, 'تنظيف الإشعارات القديمة');
    },
};
