import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats, useLowStockItems, useRecentSurgeries } from '@/hooks/useSupabaseData';
import { getStockStatus } from '@/types/inventory';
import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@/services/invoicesService';
import { usersService } from '@/services/usersService';
import { useSurgeriesList } from '@/hooks/useSupabaseData';
import { TimePeriodFilter, TimePeriod } from '@/components/ui/TimePeriodFilter';
import { getDateRangeFromPeriod } from '@/utils/dateUtils';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Package,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Activity,
  Skull,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';



export default function Dashboard() {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const { hasPermission, roleLabel, user } = useAuth();
  const canViewPrices = hasPermission('canViewPrices');
  const canViewFinancials = hasPermission('canViewFinancials');

  // استخدام Hooks المحسّنة للحصول على البيانات من Views
  const { data: stats, isLoading: loadingStats, error: errorStats } = useDashboardStats();
  const { data: lowStockItems = [], isLoading: loadingLowStock, error: errorLowStock } = useLowStockItems();
  const { data: recentSurgeries = [], isLoading: loadingRecent, error: errorRecent } = useRecentSurgeries();

  // Custom queries for Audit Log feed
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');
  
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => usersService.getAll() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => invoicesService.getAll() });
  const { data: surgeries = [] } = useSurgeriesList();

  const activityFeed = useMemo(() => {
    const dateRange = getDateRangeFromPeriod(selectedPeriod);
    const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'غير معروف';
    let feed: any[] = [];
    
    invoices.forEach(inv => {
      feed.push({
        id: `inv-${inv.id}`,
        type: 'purchase',
        title: 'فاتورة مشتريات',
        description: `فاتورة للمورد (${inv.supplierName}) بقيمة ${new Intl.NumberFormat('en-EG').format(inv.totalAmount || 0)} ج.م`,
        date: inv.createdAt ? new Date(inv.createdAt) : new Date(inv.invoiceDate),
        user: getUserName(inv.createdBy || '')
      });
    });

    surgeries.forEach(s => {
      feed.push({
        id: `sur-${s.id}`,
        type: s.type === 'surgery' ? 'surgery' : 'sale',
        title: s.type === 'surgery' ? 'عملية جراحية' : 'مبيعات/استهلاك',
        description: `باسم (${s.patientName})`,
        date: s.createdAt ? new Date(s.createdAt) : new Date(s.date),
        user: getUserName(s.createdBy || '')
      });
    });

    feed.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (dateRange) {
      feed = feed.filter(item => item.date >= dateRange.startDate && item.date <= dateRange.endDate);
    }
    return feed;
  }, [invoices, surgeries, users, selectedPeriod]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value) + ' ج.م';
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-EG').format(value);
  };

  const maskedValue = (value: string) => {
    return isPrivacyMode ? '******' : value;
  };

  const isLoading = loadingStats || loadingLowStock || loadingRecent;
  const error = errorStats || errorLowStock || errorRecent;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">جارٍ تحميل البيانات...</span>
      </div>
    );
  }

  if (error) {
    console.error('Dashboard Error Details:', { errorStats, errorLowStock, errorRecent });
    return (
      <div className="p-8">
        <div className="flex flex-col gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            <span className="font-bold">حدث خطأ في تحميل البيانات:</span>
          </div>
          <ul className="list-disc list-inside text-sm space-y-1 mr-8 text-left" dir="ltr">
            {errorStats && <li>Stats Error: {errorStats.message}</li>}
            {errorLowStock && <li>Low Stock Error: {errorLowStock.message}</li>}
            {errorRecent && <li>Recent Surgeries Error: {errorRecent.message}</li>}
          </ul>
          <p className="text-sm mt-2 text-muted-foreground">
            تأكد من تنفيذ ملف SQL في Supabase ومن صحة ملف .env
          </p>
        </div>
      </div>
    );
  }

  // التحقق من وجود البيانات
  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <span className="mr-3 text-muted-foreground">لا توجد بيانات متاحة</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="شركة الدلتا للمستلزمات الطبية"
        description={`مرحباً بك - ${roleLabel}`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="عدد الأصناف"
          value={formatNumber(stats.total_skus)}
          icon={Package}
          variant="primary"
        />

        <StatsCard
          title="أصناف منخفضة المخزون"
          value={formatNumber(stats.low_stock_count)}
          icon={AlertTriangle}
          variant={stats.low_stock_count > 0 ? 'danger' : 'default'}
        />

        <StatsCard
          title="مخزون راكد"
          value={formatNumber(stats.dead_stock_count)}
          icon={Skull}
          variant={stats.dead_stock_count > 0 ? 'warning' : 'default'}
        />

        {canViewFinancials ? (
          <StatsCard
            title="إجمالي قيمة المخزون"
            value={maskedValue(formatCurrency(stats.total_inventory_value ?? 0))}
            icon={DollarSign}
            variant="success"
          />
        ) : (
          <StatsCard
            title="العمليات الجراحية"
            value={formatNumber(stats.total_surgeries)}
            icon={Activity}
          />
        )}
      </div>

      {/* Second Row Stats - Financial users only */}
      {canViewFinancials && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <StatsCard
            title="إجمالي المشتريات"
            value={maskedValue(formatCurrency(stats.total_purchases ?? 0))}
            icon={ShoppingCart}
          />
          <StatsCard
            title="إجمالي الأرباح"
            value={maskedValue(formatCurrency(stats.total_profit ?? 0))}
            icon={TrendingUp}
            variant="success"
            action={
              <button
                onClick={() => setIsPrivacyMode(!isPrivacyMode)}
                className="hover:bg-white/20 p-1 rounded-full transition-colors"
                title={isPrivacyMode ? 'إظهار الأرقام' : 'إخفاء الأرقام'}
              >
                {isPrivacyMode ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            }
          />
        </div>
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">
              أصناف منخفضة المخزون
            </h2>
          </div>
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'الصنف',
                render: (item) => (
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku}
                    </p>
                  </div>
                ),
              },
              {
                key: 'specs',
                header: 'المواصفات',
                render: (item) => (
                  <div className="text-xs text-muted-foreground">
                    {item.diameter && <span>{item.diameter}</span>}
                    {item.length && <span> × {item.length}</span>}
                  </div>
                ),
              },
              {
                key: 'quantity',
                header: 'الكمية',
                render: (item) => (
                  <div className="flex items-center gap-1">
                    <span className="num font-medium text-destructive">
                      {formatNumber(item.quantity)}
                    </span>
                    {item.unit && <span className="text-xs text-muted-foreground">({item.unit})</span>}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'الحالة',
                render: (item) => (
                  <StatusBadge
                    status={getStockStatus(item.quantity, item.min_stock)}
                  />
                ),
              },
            ]}
            data={lowStockItems}
            keyExtractor={(item) => item.id}
            emptyMessage="لا توجد أصناف منخفضة المخزون"
          />
        </div>

        {/* Recent Surgeries */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              آخر العمليات الجراحية
            </h2>
          </div>
          <DataTable
            columns={[
              {
                key: 'doctor',
                header: 'الطبيب',
                render: (item) => (
                  <p className="font-medium text-foreground truncate max-w-[120px]">
                    {item.doctor_name || 'غير محدد'}
                  </p>
                ),
              },
              {
                key: 'type',
                header: 'نوع العملية',
                render: (item) => (
                  <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {item.type}
                  </p>
                ),
              },
              {
                key: 'date',
                header: 'التاريخ',
                render: (item) => (
                  <span className="text-muted-foreground text-xs">
                    {format(new Date(item.date), 'dd MMM yyyy', { locale: ar })}
                  </span>
                ),
              },
              ...(canViewFinancials
                ? [
                  {
                    key: 'profit',
                    header: 'الربح',
                    render: (item: any) => (
                      <span className="num font-medium text-success">
                        {maskedValue(formatCurrency(item.profit))}
                      </span>
                    ),
                  },
                ]
                : []),
            ]}
            data={recentSurgeries}
            keyExtractor={(item) => item.id}
            emptyMessage="لا توجد عمليات"
          />
        </div>

        {/* Recent Activity (Audit Log) */}
        {user?.role === 'admin' && (
        <div className="bg-card rounded-xl border border-border p-6 lg:col-span-2 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                آخر نشاط (سجل حركات النظام)
              </h2>
            </div>
            <div className="max-w-full overflow-x-auto pb-2 sm:pb-0 hide-scrollbar mt-2 sm:mt-0">
              <TimePeriodFilter selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />
            </div>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {activityFeed.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                <Activity className="w-12 h-12 mb-3 opacity-20" />
                <span>لا يوجد نشاط في هذه الفترة المحددة</span>
              </div>
            ) : (
              activityFeed.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="flex items-start gap-4 p-4 rounded-xl bg-muted/20 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                  <div className={`p-3 rounded-full mt-1 ${item.type === 'purchase' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'}`}>
                    {item.type === 'purchase' ? <ShoppingCart className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                     <p className="font-semibold text-foreground text-sm">{item.title}</p>
                     <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">{item.description}</p>
                     <div className="flex items-center gap-3 mt-3">
                       <span className="text-[11px] bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {item.user}
                       </span>
                       <span className="text-[11px] text-muted-foreground font-mono bg-background px-2 py-1 rounded border border-border" dir="ltr">
                          {format(item.date, 'dd/MM/yyyy HH:mm')}
                       </span>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
