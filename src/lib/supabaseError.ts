import type { PostgrestError } from '@supabase/supabase-js';

// ─── AppError ────────────────────────────────────────────────────────────────
// Typed error class that all service calls throw.
// Consumers can inspect `code` for programmatic handling.
export class AppError extends Error {
    constructor(
        public readonly message: string,
        public readonly code: string,
        public readonly originalError?: unknown,
    ) {
        super(message);
        this.name = 'AppError';
    }
}

// ─── PostgreSQL / Supabase error code map ────────────────────────────────────
const PG_MESSAGES: Record<string, string> = {
    '23505': 'هذا السجل موجود مسبقاً (قيمة مكررة)',              // unique_violation
    '23503': 'لا يمكن حذف هذا السجل لارتباطه ببيانات أخرى',     // foreign_key_violation
    '23514': 'البيانات المدخلة لا تستوفي القيود المطلوبة',       // check_violation
    '42501': 'ليس لديك صلاحية لتنفيذ هذا الإجراء',             // insufficient_privilege
    'PGRST116': 'السجل المطلوب غير موجود',                      // row not found (Supabase)
    'PGRST301': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً', // JWT expired
};

/**
 * Converts any Supabase/Postgres error into a typed AppError.
 *
 * @example
 * const { data, error } = await supabase.from('products').select('*');
 * if (error) throw handleSupabaseError(error, 'جلب المنتجات');
 */
export function handleSupabaseError(
    error: PostgrestError | null | unknown,
    context = 'العملية',
): AppError {
    if (!error) {
        return new AppError(`فشل في ${context}`, 'UNKNOWN_ERROR');
    }

    const pgError = error as PostgrestError;
    const code = pgError.code ?? 'UNKNOWN';
    const known = PG_MESSAGES[code];
    const message = known ?? `فشل في ${context}: ${pgError.message ?? 'خطأ غير معروف'}`;

    return new AppError(message, code, error);
}

// ─── Safe service call wrapper ───────────────────────────────────────────────
/**
 * Wraps any async service call. Returns { data, error } so callers
 * can choose to throw or just display the error message.
 *
 * @example
 * const { data, error } = await safeCall(() => productsService.getAll(params));
 * if (error) toast.error(error.message);
 */
export async function safeCall<T>(
    fn: () => Promise<T>,
): Promise<{ data: T | null; error: AppError | null }> {
    try {
        const data = await fn();
        return { data, error: null };
    } catch (err) {
        if (err instanceof AppError) {
            return { data: null, error: err };
        }
        // Wrap unknown errors
        const message =
            err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
        return {
            data: null,
            error: new AppError(message, 'RUNTIME_ERROR', err),
        };
    }
}

// ─── Supabase result helper ───────────────────────────────────────────────────
/**
 * Throws AppError if the Supabase query returned an error.
 * Use this inline to keep service code DRY.
 *
 * @example
 * const { data } = assertOk(
 *   await supabase.from('products').select('*'),
 *   'جلب المنتجات'
 * );
 */
export function assertOk<T>(
    result: { data: T | null; error: PostgrestError | null },
    context = 'العملية',
): { data: T } {
    if (result.error) throw handleSupabaseError(result.error, context);
    return { data: result.data as T };
}
