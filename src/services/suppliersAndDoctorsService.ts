/**
 * Suppliers & Doctors Service — v2.0
 * Changes from v1: uses assertOk/handleSupabaseError, maps new `address`
 * and `phone` fields on suppliers and doctors.
 */

import { supabase } from '../lib/supabase';
import { assertOk, handleSupabaseError } from '../lib/supabaseError';
import type { Supplier, Doctor } from '../types/inventory';

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

function supplierFromDb(row: Record<string, unknown>): Supplier {
    return {
        id: row.id as string,
        name: row.name as string,
        phone: row.phone as string | undefined,
        email: row.email as string | undefined,
        address: row.address as string | undefined,
    };
}

function supplierToDb(s: Partial<Supplier>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (s.name !== undefined) row.name = s.name;
    if (s.phone !== undefined) row.phone = s.phone || null;
    if (s.email !== undefined) row.email = s.email || null;
    if (s.address !== undefined) row.address = s.address || null;
    return row;
}

export const suppliersService = {
    async getAll(): Promise<Supplier[]> {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('name');
        if (error) throw handleSupabaseError(error, 'جلب الموردين');
        return (data ?? []).map(supplierFromDb);
    },

    async getById(id: string): Promise<Supplier | null> {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw handleSupabaseError(error, 'جلب المورد');
        return data ? supplierFromDb(data) : null;
    },

    async create(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
        const { data } = assertOk(
            await supabase.from('suppliers').insert([supplierToDb(supplier)]).select().single(),
            'إضافة مورد',
        );
        return supplierFromDb(data as any);
    },

    async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
        const { data } = assertOk(
            await supabase.from('suppliers').update(supplierToDb(updates)).eq('id', id).select().single(),
            'تحديث المورد',
        );
        return supplierFromDb(data as any);
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw handleSupabaseError(error, 'حذف المورد');
    },
};

// ─── DOCTORS ──────────────────────────────────────────────────────────────────

function doctorFromDb(row: Record<string, unknown>): Doctor {
    return {
        id: row.id as string,
        name: row.name as string,
        specialty: row.specialty as string | undefined,
        phone: row.phone as string | undefined,
    };
}

function doctorToDb(d: Partial<Doctor>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (d.name !== undefined) row.name = d.name;
    if (d.specialty !== undefined) row.specialty = d.specialty || null;
    if (d.phone !== undefined) row.phone = d.phone || null;
    return row;
}

export const doctorsService = {
    async getAll(): Promise<Doctor[]> {
        const { data, error } = await supabase
            .from('doctors')
            .select('*')
            .order('name');
        if (error) throw handleSupabaseError(error, 'جلب الأطباء');
        return (data ?? []).map(doctorFromDb);
    },

    async getById(id: string): Promise<Doctor | null> {
        const { data, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw handleSupabaseError(error, 'جلب بيانات الطبيب');
        return data ? doctorFromDb(data) : null;
    },

    async create(doctor: Omit<Doctor, 'id'>): Promise<Doctor> {
        const { data } = assertOk(
            await supabase.from('doctors').insert([doctorToDb(doctor)]).select().single(),
            'إضافة طبيب',
        );
        return doctorFromDb(data as any);
    },

    async update(id: string, updates: Partial<Doctor>): Promise<Doctor> {
        const { data } = assertOk(
            await supabase.from('doctors').update(doctorToDb(updates)).eq('id', id).select().single(),
            'تحديث بيانات الطبيب',
        );
        return doctorFromDb(data as any);
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase.from('doctors').delete().eq('id', id);
        if (error) throw handleSupabaseError(error, 'حذف الطبيب');
    },
};
