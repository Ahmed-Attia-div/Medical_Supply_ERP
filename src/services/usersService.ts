/**
 * Users Service — v2.0
 * Schema changes:
 *  - Roles: removed 'supervisor', now 4 roles only
 *  - assertOk/handleSupabaseError throughout
 *  - Proper camelCase mapping
 */

import { supabase } from '@/lib/supabase';
import { assertOk, handleSupabaseError } from '@/lib/supabaseError';
import type { User, CreateUserInput } from '@/types/inventory';
import type { UserRole } from '@/types/roles';

function fromDb(row: Record<string, unknown>): User {
    return {
        id: row.id as string,
        name: row.name as string,
        email: row.email as string,
        phone: row.phone as string | undefined,
        role: row.role as UserRole,
        status: (row.status as 'active' | 'inactive') ?? 'active',
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
        createdBy: row.created_by as string | undefined,
    };
}

export async function getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, role, status, created_at, updated_at, created_by')
        .order('created_at', { ascending: false });

    if (error) throw handleSupabaseError(error, 'جلب المستخدمين');
    return (data ?? []).map(fromDb);
}

export async function getUserById(id: string): Promise<User> {
    const { data } = assertOk(
        await supabase
            .from('users')
            .select('id, name, email, phone, role, status, created_at, updated_at, created_by')
            .eq('id', id)
            .single(),
        'جلب بيانات المستخدم',
    );
    return fromDb(data as any);
}

/** Creates a new user via direct insert + server-side password hashing */
export async function createUser(input: CreateUserInput): Promise<User> {
    // Hash the password server-side using a lightweight RPC
    const { data: hashed, error: hashErr } = await supabase.rpc('hash_password', {
        p_password: input.password,
    });

    if (hashErr) throw handleSupabaseError(hashErr, 'تشفير كلمة المرور');

    // Direct insert into users table
    const { data, error } = await supabase
        .from('users')
        .insert({
            email: input.email,
            password_hash: hashed as string,
            name: input.name,
            role: input.role,
            phone: input.phone || null,
            status: 'active',
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') throw new Error('البريد الإلكتروني مستخدم بالفعل');
        throw handleSupabaseError(error, 'إضافة المستخدم');
    }

    return fromDb(data as any);
}

export async function updateUser(
    id: string,
    updates: Partial<Pick<User, 'name' | 'email' | 'phone' | 'role' | 'status'>>,
): Promise<User> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.email !== undefined) row.email = updates.email;
    if (updates.phone !== undefined) row.phone = updates.phone || null;
    if (updates.role !== undefined) row.role = updates.role;
    if (updates.status !== undefined) row.status = updates.status;

    const { data } = assertOk(
        await supabase.from('users').update(row).eq('id', id).select().single(),
        'تحديث المستخدم',
    );
    return fromDb(data as any);
}

export async function deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
        if (error.code === '23503') throw new Error('لا يمكن حذف هذا المستخدم لارتباطه ببيانات أخرى');
        throw handleSupabaseError(error, 'حذف المستخدم');
    }
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const { error } = await supabase.rpc('update_user_password_secure', {
        p_user_id: userId,
        p_new_password: newPassword,
    });
    if (error) throw handleSupabaseError(error, 'تحديث كلمة المرور');
}

// Named export object for consistency with other services
export const usersService = {
    getAll: getAllUsers,
    getById: getUserById,
    create: createUser,
    update: updateUser,
    delete: deleteUser,
    updatePassword: updateUserPassword,
};
