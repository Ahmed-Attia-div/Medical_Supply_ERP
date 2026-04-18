/**
 * User Management Component
 * Full CRUD interface for managing system users
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '@/services/usersService';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type UserRole } from '@/types/roles';
import type { User, CreateUserInput, UserStatus } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/DataTable';
import { UserPlus, Pencil, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserManagementProps {
    currentUserId?: string;
}

export function UserManagement({ currentUserId }: UserManagementProps) {
    const qc = useQueryClient();
    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersService.getAll(),
        staleTime: 300_000,
    });
    const createUser = useMutation({
        mutationFn: (data: any) => usersService.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    });
    const updateUser = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) => usersService.update(id, updates),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    });
    const deleteUser = useMutation({
        mutationFn: (id: string) => usersService.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    });
    const updatePassword = useMutation({
        mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
            usersService.updatePassword(id, newPassword),
    });

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Form state
    const [formData, setFormData] = useState<CreateUserInput>({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'storekeeper',
        status: 'active',
    });

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            password: '',
            role: 'storekeeper',
            status: 'active',
        });
        setShowPassword(false);
    };

    const handleAddUser = async () => {
        if (!formData.name || !formData.email || !formData.password) {
            toast.error('يرجى ملء جميع الحقول المطلوبة');
            return;
        }

        try {
            await createUser.mutateAsync(formData);
            setIsAddDialogOpen(false);
            resetForm();
        } catch (error) {
            // Error handled by mutation
        }
    };

    const handleEditUser = async () => {
        if (!selectedUser) return;

        try {
            await updateUser.mutateAsync({
                id: selectedUser.id,
                updates: {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    role: formData.role,
                    status: formData.status,
                },
            });

            // Update password if provided
            if (formData.password) {
                await updatePassword.mutateAsync({
                    id: selectedUser.id,
                    newPassword: formData.password,
                });
            }

            setIsEditDialogOpen(false);
            setSelectedUser(null);
            resetForm();
        } catch (error) {
            // Error handled by mutation
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (userId === currentUserId) {
            toast.error('لا يمكنك حذف حسابك الخاص');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

        try {
            await deleteUser.mutateAsync(userId);
        } catch (error) {
            // Error handled by mutation
        }
    };

    const openEditDialog = (user: User) => {
        setSelectedUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            password: '', // Don't show existing password
            role: user.role,
            status: user.status,
        });
        setIsEditDialogOpen(true);
    };

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case 'admin':
                return 'bg-red-500/10 text-red-600 dark:text-red-400';
            case 'storekeeper':
                return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
            case 'partner':
                return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
            default:
                return 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
        }
    };

    const getStatusBadgeColor = (status: UserStatus) => {
        return status === 'active'
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
    };

    const columns = [
        {
            key: 'name',
            header: 'الاسم',
            render: (user: User) => (
                <div>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-sm text-muted-foreground" dir="ltr">{user.email}</p>
                </div>
            ),
        },
        {
            key: 'phone',
            header: 'الهاتف',
            render: (user: User) => (
                <span className="text-muted-foreground" dir="ltr">{user.phone || '-'}</span>
            ),
        },
        {
            key: 'role',
            header: 'الدور',
            render: (user: User) => (
                <Badge className={cn('font-medium', getRoleBadgeColor(user.role))}>
                    {ROLE_LABELS[user.role as UserRole] || user.role}
                </Badge>
            ),
        },
        {
            key: 'status',
            header: 'الحالة',
            render: (user: User) => (
                <Badge className={cn('font-medium', getStatusBadgeColor(user.status))}>
                    {user.status === 'active' ? 'نشط' : 'غير نشط'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: 'الإجراءات',
            render: (user: User) => (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        className="h-8 w-8 p-0"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.id === currentUserId}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-foreground">إدارة المستخدمين</h3>
                    <p className="text-sm text-muted-foreground">
                        إضافة وتعديل وحذف مستخدمي النظام
                    </p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 ml-2" />
                    إضافة مستخدم
                </Button>
            </div>

            <DataTable
                data={users || []}
                columns={columns}
                keyExtractor={(user) => user.id}
                emptyMessage="لا يوجد مستخدمين"
            />

            {/* Add User Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>إضافة مستخدم جديد</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">الاسم الكامل *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="أدخل الاسم الكامل"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">البريد الإلكتروني *</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="example@hospital.com"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">رقم الهاتف</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="01xxxxxxxxx"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">كلمة المرور *</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="أدخل كلمة المرور"
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">الدور *</Label>
                            <select
                                id="role"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                {ROLE_DESCRIPTIONS[formData.role]}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
                            إلغاء
                        </Button>
                        <Button onClick={handleAddUser} disabled={createUser.isPending}>
                            {createUser.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                    جاري الإضافة...
                                </>
                            ) : (
                                'إضافة'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>تعديل المستخدم</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">الاسم الكامل *</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="أدخل الاسم الكامل"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">البريد الإلكتروني *</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="example@hospital.com"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-phone">رقم الهاتف</Label>
                            <Input
                                id="edit-phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="01xxxxxxxxx"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-password">كلمة المرور الجديدة (اختياري)</Label>
                            <div className="relative">
                                <Input
                                    id="edit-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="اتركها فارغة إذا لم ترد التغيير"
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-role">الدور *</Label>
                            <select
                                id="edit-role"
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                {ROLE_DESCRIPTIONS[formData.role]}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-status">الحالة *</Label>
                            <select
                                id="edit-status"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                                className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="active">نشط</option>
                                <option value="inactive">غير نشط</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setSelectedUser(null); resetForm(); }}>
                            إلغاء
                        </Button>
                        <Button onClick={handleEditUser} disabled={updateUser.isPending || updatePassword.isPending}>
                            {updateUser.isPending || updatePassword.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                    جاري الحفظ...
                                </>
                            ) : (
                                'حفظ التغييرات'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
