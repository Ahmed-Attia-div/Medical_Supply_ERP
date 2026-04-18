import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { productsService } from '@/services/productsService';
import { surgeriesService } from '@/services/surgeriesService';
import { purchasesService } from '@/services/purchasesService';
import { doctorsService } from '@/services/suppliersAndDoctorsService';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/types/roles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { UserManagement } from '@/components/UserManagement';
import {
  User,
  Lock,
  Bell,
  Shield,
  Database,
  HelpCircle,
  ChevronLeft,
  Check,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services/settingsService';
import { usersService } from '@/services/usersService';


interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  permission?: 'canManageSettings' | 'canManageUsers';
}

const sections: SettingSection[] = [
  {
    id: 'profile',
    title: 'الملف الشخصي',
    description: 'إدارة بيانات الحساب الشخصي',
    icon: User,
  },
  {
    id: 'security',
    title: 'الأمان',
    description: 'تغيير كلمة المرور وإعدادات الأمان',
    icon: Lock,
  },
  {
    id: 'notifications',
    title: 'الإشعارات',
    description: 'إدارة تنبيهات المخزون والنظام',
    icon: Bell,
  },
  {
    id: 'user_management',
    title: 'إدارة المستخدمين',
    description: 'إضافة وتعديل وحذف المستخدمين',
    icon: Shield,
    permission: 'canManageUsers',
  },
  {
    id: 'deadstock',
    title: 'المخزون الراكد',
    description: 'إعدادات حد المخزون الراكد',
    icon: Clock,
  },
  {
    id: 'data',
    title: 'البيانات',
    description: 'تصدير واستيراد البيانات',
    icon: Database,
  },
  {
    id: 'help',
    title: 'المساعدة',
    description: 'الدعم الفني والأسئلة الشائعة',
    icon: HelpCircle,
  },
];

export default function Settings() {
  const { user, roleLabel, hasPermission } = useAuth();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  const qc = useQueryClient();

  // Settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getSettings(),
    staleTime: 300_000,
  });
  const { mutate: updateSettings, isPending: isSaving } = useMutation({
    mutationFn: (payload: any) => settingsService.updateSettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('تم حفظ الإعدادات بنجاح');
    },
  });

  // Profile Management
  // initialData seeds from auth context immediately (zero latency) —
  // DB fetch only updates the `phone` field that auth context doesn't carry.
  const { data: userProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: () => usersService.getById(user!.id),
    enabled: !!user?.id,
    staleTime: Infinity,          // don't re-fetch if data is fresh from this session
    gcTime: 30 * 60_000,        // keep in cache for 30 min
    initialData: user ? {
      id: user.id, name: user.name, email: user.email, phone: undefined,
      role: user.role, status: 'active' as const,
      createdAt: new Date(), updatedAt: new Date()
    } : undefined,
  });
  const { mutate: updateProfile, isPending: isSavingProfile } = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => usersService.update(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-profile', user?.id] }),
  });

  // Local state for editing
  const [localSettings, setLocalSettings] = useState<any>({});
  // Seed profile form immediately from auth context — no loading spinner needed
  const [profileData, setProfileData] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
  });

  // Sync with fetched settings
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // When DB profile arrives, supplement with phone (name/email already pre-seeded)
  useEffect(() => {
    if (userProfile?.phone !== undefined) {
      setProfileData(prev => ({ ...prev, phone: userProfile.phone || '' }));
    }
  }, [userProfile?.phone]);



  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `Hospital_Data_Backup_${dateStr}.xlsx`;

      // Fetch Data in Parallel
      const [inventoryData, salesData, purchasesData, doctorsData] = await Promise.all([
        productsService.getPaginated({}, { page: 1, pageSize: 9999 }).then(r => r.data),
        surgeriesService.getAll(),
        purchasesService.getAll(),
        doctorsService.getAll()
      ]);

      // Create Workbook
      const wb = XLSX.utils.book_new();

      // 1. Inventory Sheet
      const inventoryRows = inventoryData.map(item => ({
        "اسم الصنف": item.name,
        "الكود": item.sku || '',
        "الفئة": item.category,
        "الكمية": item.totalQuantity,
        "سعر التكلفة": item.basePriceWac,
        "سعر البيع": item.sellingPrice,
      }));
      const wsInventory = XLSX.utils.json_to_sheet(inventoryRows);
      XLSX.utils.book_append_sheet(wb, wsInventory, "المخزون");

      // 2. Sales Sheet
      const salesRows = salesData.map(sale => {
        const doctor = doctorsData.find((d: any) => d.id === sale.doctorId);
        return {
          "رقم العملية": sale.id.substring(0, 8),
          "التاريخ": new Date(sale.date).toLocaleDateString('en-GB'),
          "اسم المريض": sale.patientName,
          "اسم الطبيب": doctor ? doctor.name : sale.doctorId,
          "الإجمالي": sale.totalSellingValue
        };
      });
      const wsSales = XLSX.utils.json_to_sheet(salesRows);
      XLSX.utils.book_append_sheet(wb, wsSales, "المبيعات");

      // 3. Purchases Sheet
      const purchasesRows = purchasesData.map(purchase => ({
        "رقم الفاتورة": purchase.id.substring(0, 8),
        "المورد": purchase.supplierName,
        "التاريخ": new Date(purchase.invoiceDate).toLocaleDateString('en-GB'),
        "الإجمالي": purchase.totalAmount
      }));
      const wsPurchases = XLSX.utils.json_to_sheet(purchasesRows);
      XLSX.utils.book_append_sheet(wb, wsPurchases, "المشتريات");

      // Write File
      XLSX.writeFile(wb, fileName);
      toast.success("تم تصدير البيانات بنجاح");
    } catch (error) {
      console.error("Export Error:", error);
      toast.error("حدث خطأ أثناء تصدير البيانات");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = () => {
    // Clean payload: Remove system fields and ensuring only valid settings are sent
    const { id, created_at, updated_at, updated_by, ...payload } = localSettings;
    updateSettings(payload);
  };

  const handleSaveProfile = () => {
    if (!user?.id) {
      toast.error('لم يتم العثور على معرف المستخدم');
      return;
    }

    // Validation
    if (!profileData.name.trim()) {
      toast.error('الرجاء إدخال الاسم');
      return;
    }

    if (!profileData.email.trim()) {
      toast.error('الرجاء إدخال البريد الإلكتروني');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileData.email)) {
      toast.error('البريد الإلكتروني غير صحيح');
      return;
    }

    updateProfile({
      id: user.id,
      updates: {
        name: profileData.name.trim(),
        email: profileData.email.trim(),
        phone: profileData.phone.trim() || undefined,
      },
    }, {
      onSuccess: () => {
        // Update local storage to reflect changes immediately
        const storedUser = localStorage.getItem('surgical_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          const updatedUser = {
            ...userData,
            name: profileData.name.trim(),
            email: profileData.email.trim()
          };
          localStorage.setItem('surgical_user', JSON.stringify(updatedUser));
        }

        // Reload page to update Sidebar and Header
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });
  };

  const toggleSetting = (key: string) => {
    setLocalSettings((prev: any) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateLocalSetting = (key: string, value: any) => {
    setLocalSettings((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        // profileData is pre-seeded from auth context — no spinner needed
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span className="text-2xl font-bold">{profileData.name.charAt(0) || user?.name.charAt(0)}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">{profileData.name || user?.name}</h3>
                <p className="text-muted-foreground" dir="ltr">{profileData.email || user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                  {roleLabel}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="أدخل الاسم الكامل"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  البريد الإلكتروني *
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="example@hospital.com"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ تغيير البريد الإلكتروني قد يؤثر على تسجيل الدخول
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  الدور الوظيفي
                </label>
                <div className="w-full h-10 px-3 rounded-lg border border-input bg-muted flex items-center text-muted-foreground">
                  {roleLabel}
                  <span className="mr-auto text-xs">لا يمكن تغيير الدور من هنا</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  كلمة المرور الحالية
                </label>
                <input
                  type="password"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        );

      case 'notifications':
        if (isLoadingSettings) return <div className="p-4"><Loader2 className="animate-spin" /> جارٍ التحميل...</div>;

        return (
          <div className="space-y-4">
            {[
              { id: 'lowStockAlertEnabled', label: 'تنبيه المخزون المنخفض' },
              { id: 'deadStockAlertEnabled', label: 'تنبيه المخزون الراكد' },
              { id: 'newPurchaseAlertEnabled', label: 'فاتورة شراء جديدة' },
              { id: 'newSurgeryAlertEnabled', label: 'عملية جراحية جديدة' },
              { id: 'marginWarningEnabled', label: 'تحذير هامش الربح' },
            ].map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <span className="font-medium text-foreground">{item.label}</span>
                <button
                  onClick={() => toggleSetting(item.id)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors relative',
                    localSettings[item.id] ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-primary-foreground transition-all',
                      localSettings[item.id] ? 'left-7' : 'left-1'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        );

      case 'user_management':
        return <UserManagement currentUserId={user?.id} />;

      case 'deadstock':
        const isStorekeeper = user?.role === 'storekeeper';
        if (isLoadingSettings) return <div className="p-4"><Loader2 className="animate-spin" /> جارٍ التحميل...</div>;

        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              تحديد فترة عدم الحركة التي يُعتبر بعدها الصنف مخزوناً راكداً
            </p>
            {isStorekeeper && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                <p className="text-sm">
                  📌 يمكنك عرض إعدادات المخزون الراكد فقط. لا يمكنك تغيير الحد العام.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                عدد الأشهر
              </label>
              <select
                value={localSettings.deadStockThresholdMonths || 6}
                onChange={(e) => updateLocalSetting('deadStockThresholdMonths', Number(e.target.value))}
                disabled={isStorekeeper}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {[3, 6, 9, 12].map((months) => (
                  <option key={months} value={months}>
                    {months} أشهر
                  </option>
                ))}
              </select>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                الأصناف التي لم تتحرك منذ <span className="font-bold text-foreground">{localSettings.deadStockThresholdMonths || 6}</span> أشهر ستظهر كمخزون راكد في التحليلات.
              </p>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-6">
            <div className="p-4 rounded-lg border border-border">
              <h4 className="font-medium text-foreground mb-2">تصدير البيانات</h4>
              <p className="text-sm text-muted-foreground mb-4">
                تصدير جميع بيانات المخزون والعمليات بصيغة Excel
              </p>
              <Button
                variant="outline"
                onClick={handleExportData}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التصدير...
                  </>
                ) : (
                  'تصدير الآن'
                )}
              </Button>
            </div>
            <div className="p-4 rounded-lg border border-border">
              <h4 className="font-medium text-foreground mb-2">استيراد البيانات</h4>
              <p className="text-sm text-muted-foreground mb-4">
                استيراد بيانات المخزون من ملف Excel
              </p>
              <Button variant="outline">رفع ملف</Button>
            </div>

          </div>
        );

      case 'help':
        return (
          <div className="space-y-6">
            {/* Support Section */}
            <div className="p-6 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-300">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-foreground mb-1">فريق الدعم الفني</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    نحن هنا لمساعدتك. لأي استفسار أو مشكلة، لا تتردد في التواصل معنا:
                  </p>
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono" dir="ltr">
                    wathqqcare@gmail.com
                  </p>
                </div>
              </div>
            </div>

            {/* System Features Guide */}
            <div className="space-y-4">
              <h4 className="font-bold text-xl text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                دليل مدير النظام (System Admin Guide)
              </h4>
              <p className="text-muted-foreground text-sm">
                تم تصميم نظام "وثق" ليمنحك سيطرة كاملة ورؤية واضحة لأعمالك. إليك أهم المميزات وكيف تخدمك كمدير للنظام:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {[
                  {
                    title: 'لوحة التحكم (Dashboard)',
                    desc: 'منطقتك المركزية لاتخاذ القرار. تراقب الأرباح اليومية، المخزون المنخفض، والأصناف الراكدة في شاشة واحدة.',
                    icon: '📊'
                  },
                  {
                    title: 'إدارة مخزون ذكية (Smart Inventory)',
                    desc: 'لا مجرد عد كميات. النظام يحسب "متوسط التكلفة المرجح" (WAC) تلقائياً مع كل فاتورة شراء، مما يضمن دقة حساب الأرباح 100%.',
                    icon: '📦'
                  },
                  {
                    title: 'العمليات الجراحية (Surgeries)',
                    desc: 'تسجيل استهلاك دقيق لكل عملية. تعرف بالضبط ربحية كل عملية، نصيب الطبيب، وتكلفة المواد المستهلكة بضغطة زر.',
                    icon: '🏥'
                  },
                  {
                    title: 'تحويل المخزون (Transactions)',
                    desc: 'ميزة حصرية لقطاع العظام. تتيح لك تسجيل عمليات "قطع الشرائح" أو تحويل المواد الخام لمنتجات نهائية مع ضبط التكلفة والكمية آلياً.',
                    icon: '🔄'
                  },
                  {
                    title: 'الصلاحيات والأمان (Security)',
                    desc: 'صمم النظام ليحمي أسرارك. "أمين المخزن" يرى الكميات فقط ولا يرى الأسعار. أنت تحدد من يرى ماذا.',
                    icon: '🛡️'
                  },
                  {
                    title: 'التقارير التحليلية (Analytics)',
                    desc: 'وداعاً للحسابات اليدوية. تقارير مفصلة تكشف لك أكثر الأصناف مبيعاً، هوامش الربح، وأداء الأطباء.',
                    icon: '📈'
                  }
                ].map((feature, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" role="img" aria-label="icon">{feature.icon}</span>
                      <div>
                        <h5 className="font-bold text-foreground mb-1">{feature.title}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Formulas */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span className="text-xl">🧮</span>
                المعادلات المالية (Financial Formulas)
              </h4>
              <div className="bg-muted/50 rounded-lg p-4 space-y-4 text-sm font-mono" dir="ltr">
                <div>
                  <p className="font-bold text-primary mb-1 text-right font-sans">1. متوسط التكلفة المرجح (WAC)</p>
                  <p className="bg-background p-2 rounded border border-border" dir="rtl">
                    ((الكمية الحالية × التكلفة الحالية) + (الكمية الجديدة × التكلفة الجديدة)) / (الكمية الحالية + الكمية الجديدة)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 text-right font-sans">
                    * يتم تحديث التكلفة تلقائياً عند كل عملية شراء جديدة لضمان دقة الأرباح.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-primary mb-1 text-right font-sans">2. هامش الربح (Profit Margin)</p>
                  <p className="bg-background p-2 rounded border border-border" dir="rtl">
                    إجمالي سعر البيع - إجمالي التكلفة الأساسية = صافي الربح
                  </p>
                </div>
                <div>
                  <p className="font-bold text-primary mb-1 text-right font-sans">3. نسبة المخزون (Stock Ratio)</p>
                  <p className="bg-background p-2 rounded border border-border" dir="rtl">
                    (الكمية الحالية / الحد الأدنى للمخزون) × 100
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 text-right font-sans leading-relaxed">
                    <span className="font-bold text-foreground">💡 الحد الأدنى للمخزون:</span> هو "حد الخطر" الذي تحدده أنت لكل صنف (مثلاً 10 قطع). عندما تنخفض الكمية لهذا الرقم، يبدأ النظام بإرسال تنبيهات لتشتري بضاعة جديدة قبل أن تنفذ تماماً وتعطل العمل.
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Scenario */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="font-bold text-lg text-foreground flex items-center gap-2">
                <span className="text-xl">🛤️</span>
                سيناريو دورة العمل (Workflow)
              </h4>
              <div className="relative border-r-2 border-primary/20 mr-3 pr-6 space-y-8 my-6">

                {/* Step 1 */}
                <div className="relative">
                  <span className="absolute -right-[31px] top-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold ring-4 ring-background">1</span>
                  <h5 className="font-bold text-foreground">استلام البضاعة (المشتريات)</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    عند وصول شحنة جديدة، اذهب إلى صفحة <strong>المشتريات</strong>. قم بإضافة فاتورة المورد. النظام سيقوم تلقائياً بزيادة المخزون وإعادة حساب "متوسط التكلفة" للأصناف الموجودة مسبقاً.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <span className="absolute -right-[31px] top-0 w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold ring-4 ring-background border border-border">2</span>
                  <h5 className="font-bold text-foreground">إدارة المخزون والتجهيز</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    راجع صفحة <strong>المخزون</strong>. إذا كنت بحاجة لقطع "شرائح" أو تحويل صنف لآخر، استخدم زر "التحويل" (الأيقونة الزرقاء). سيتم خصم الخام وإضافة المنتج الجديد وضبط التكلفة.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <span className="absolute -right-[31px] top-0 w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-bold ring-4 ring-background border border-border">3</span>
                  <h5 className="font-bold text-foreground">صرف البضاعة (العمليات الجراحية)</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    عند خروج بضاعة لعملية، اذهب لصفحة <strong>العمليات الجراحية</strong>. سجل اسم المريض والطبيب، واختر الأصناف المستهلكة فقط. النظام سيخصمها من المخزون فوراً ويحسب الربحية بناءً على تكلفتها الحالية.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="relative">
                  <span className="absolute -right-[31px] top-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold ring-4 ring-background">4</span>
                  <h5 className="font-bold text-foreground">التقارير واتخاذ القرار</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    في نهاية الشهر، زُر صفحة <strong>التحليلات</strong>. ستجد تقرير "أرباح العمليات" لتعرف أي الأطباء أكثر نشاطاً، وتقرير "المخزون الراكد" لتعرف البضاعة التي يجب تسييلها.
                  </p>
                </div>

              </div>
            </div>

            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800 flex gap-3 items-start">
              <span className="text-xl">💡</span>
              <div>
                <h5 className="font-bold text-yellow-800 dark:text-yellow-200 text-sm">نصيحة للمدير</h5>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  راجع تقرير "المخزون الراكد" شهرياً من قسم التحليلات لتسييل البضاعة المتوقفة وزيادة السيولة النقدية.
                </p>
              </div>
            </div>

          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="الإعدادات" description="إدارة إعدادات النظام والحساب" />

      {activeSection ? (
        <div className="bg-card rounded-xl border border-border">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <button
              onClick={() => setActiveSection(null)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-5 h-5 rtl-flip rotate-180" />
            </button>
            <h2 className="text-lg font-bold text-foreground">
              {sections.find((s) => s.id === activeSection)?.title}
            </h2>
          </div>
          <div className="p-6">{renderSectionContent()}</div>
          {/* Hide Save button for 'help', 'data', or 'user_management' as they have their own or no actions */}
          {!['data', 'help', 'user_management'].includes(activeSection) && (
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-secondary/30">
              <Button variant="outline" onClick={() => setActiveSection(null)}>
                {user?.role === 'storekeeper' && activeSection === 'deadstock' ? 'إغلاق' : 'إلغاء'}
              </Button>
              {!(user?.role === 'storekeeper' && activeSection === 'deadstock') && (
                <Button
                  onClick={activeSection === 'profile' ? handleSaveProfile : handleSave}
                  disabled={activeSection === 'profile' ? isSavingProfile : isSaving}
                >
                  {(activeSection === 'profile' ? isSavingProfile : isSaving) ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 ml-2" />
                      حفظ التغييرات
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections
            .filter((section) => {
              // Filter sections based on permissions
              if (section.permission && !hasPermission(section.permission)) {
                return false;
              }

              // Hide Data section for storekeepers
              if (user?.role === 'storekeeper' && section.id === 'data') {
                return false;
              }
              return true;
            })
            .map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="flex items-center gap-4 p-6 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all text-right w-full group"
                >
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground mb-1">
                      {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary rtl-flip" />
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
