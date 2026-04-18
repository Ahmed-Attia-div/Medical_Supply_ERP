import { useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSurgeriesList, useSystemSettings } from '@/hooks/useSupabaseData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product, Surgery, MATERIAL_LABELS } from '@/types/inventory';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatsCardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/SkeletonLoader';
import {
  User,
  Skull,
  TrendingUp,
  Activity,
  DollarSign,
  Settings as SettingsIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';


export default function Analytics() {
  const { hasPermission } = useAuth();
  const canViewAnalytics = hasPermission('canViewAnalytics');

  const { data: doctorsData, isLoading: isLoadingDoctors } = useQuery<{ id: string; name: string; specialty: string }[]>({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data } = await supabase.from('doctors').select('id,name,specialty');
      return (data ?? []) as { id: string; name: string; specialty: string }[];
    },
    staleTime: 300_000,
  });

  // Dashboard & Settings
  const { data: settings } = useSystemSettings();
  const thresholdMonths = settings?.deadStockThresholdMonths ?? 6;

  const { data: deadStockData, isLoading: isLoadingDeadStock } = useQuery<Product[]>({
    queryKey: ['dead-stock', thresholdMonths],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .lt('last_movement_at', new Date(Date.now() - (thresholdMonths * 30) * 86_400_000).toISOString())
        .gt('total_quantity', 0);
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
    staleTime: 120_000,
  });

  const { data: surgeriesData, isLoading: isLoadingSurgeries } = useSurgeriesList();
  const surgeries = (surgeriesData || []) as Surgery[];
  const fetchedDeadStock = (deadStockData || []) as Product[];
  const doctors = (doctorsData || []) as { id: string; name: string; specialty: string }[];

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

  // Surgeon Portfolio - Consumption per Doctor
  const surgeonPortfolio = useMemo(() => {
    const portfolio: Record<string, {
      doctorId: string;
      doctorName: string;
      specialty: string;
      surgeryCount: number;
      totalBaseValue: number;
      totalSellingValue: number;
      totalProfit: number;
    }> = {};

    surgeries.forEach((surgery) => {
      // Find doctor from real data
      if (!surgery.doctorId) return;

      const doctor = doctors.find((d) => d.id === surgery.doctorId);
      const doctorName = doctor ? doctor.name : (surgery.doctorName || 'طبيب غير معروف');
      const specialty = doctor ? doctor.specialty : '-';

      if (!portfolio[surgery.doctorId]) {
        portfolio[surgery.doctorId] = {
          doctorId: surgery.doctorId,
          doctorName: doctorName,
          specialty: specialty,
          surgeryCount: 0,
          totalBaseValue: 0,
          totalSellingValue: 0,
          totalProfit: 0,
        };
      }

      portfolio[surgery.doctorId].surgeryCount++;
      portfolio[surgery.doctorId].totalBaseValue += surgery.totalBaseValue;
      portfolio[surgery.doctorId].totalSellingValue += surgery.totalSellingValue;
      portfolio[surgery.doctorId].totalProfit += (surgery.profit || 0);
    });

    return Object.values(portfolio).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [surgeries, doctors]);

  // Dead Stock Items (Processed)
  const deadStockItems = useMemo(() => {
    return fetchedDeadStock
      .map((item: Product) => ({
        ...item,
        daysSinceMovement: Math.floor(
          (Date.now() - new Date(item.lastMovementAt ?? 0).getTime()) / 86_400_000
        ),
        totalValue: item.totalQuantity * item.basePriceWac,
      }))
      .sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);
  }, [fetchedDeadStock]);

  // Top 10 Dead Stock Items for Chart
  const top10DeadStock = useMemo(() => {
    return deadStockItems
      .slice(0, 10)
      .map((item) => ({
        name: `${item.name} ${item.diameter || ''} ${item.length || ''}`.trim(),
        days: item.daysSinceMovement,
        value: item.totalValue,
        quantity: item.totalQuantity,
      }));
  }, [deadStockItems]);

  // Profitability per Surgery
  const surgeryProfitability = useMemo(() => {
    return [...surgeries]
      .map((surgery) => ({
        ...surgery,
        // Use Profit Margin formula: (Profit / Selling Price) * 100
        profitMargin: surgery.totalSellingValue > 0
          ? ((surgery.profit / surgery.totalSellingValue) * 100).toFixed(1)
          : '0',
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [surgeries]);

  // Summary Stats
  const stats = useMemo(() => {
    const totalProfit = surgeries.reduce((sum, s) => sum + (s.profit || 0), 0);
    const avgProfitPerSurgery = surgeries.length > 0
      ? totalProfit / surgeries.length
      : 0;
    const deadStockValue = deadStockItems.reduce((sum, item) => sum + item.totalValue, 0);
    const topDoctor = surgeonPortfolio[0];

    return {
      totalProfit,
      avgProfitPerSurgery,
      deadStockValue,
      deadStockCount: deadStockItems.length,
      topDoctorName: topDoctor?.doctorName || '-',
      topDoctorProfit: topDoctor?.totalProfit || 0,
    };
  }, [surgeries, deadStockItems, surgeonPortfolio]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg text-right" dir="rtl">
          <p className="font-bold text-foreground mb-2 border-b border-border pb-2">{label}</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">فترة الركود:</span>
              <span className="font-bold text-destructive">{data.days} يوم</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">الكمية:</span>
              <span className="font-medium text-foreground">{formatNumber(data.quantity)}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-muted-foreground">القيمة:</span>
              <span className="font-medium text-foreground">{formatCurrency(data.value)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Redirect users without analytics access
  if (!canViewAnalytics) {
    return <Navigate to="/dashboard" replace />;
  }

  const isLoading = isLoadingSurgeries || isLoadingDeadStock || isLoadingDoctors;

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="التحليلات المتقدمة"
          description="تحليل الاستهلاك والأرباح والمخزون الراكد"
        />

        {/* Skeleton Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>

        {/* Skeleton Chart */}
        <ChartSkeleton />

        <div className="mt-6">
          <ChartSkeleton />
        </div>

        {/* Skeleton Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <TableSkeleton rows={5} />
          <TableSkeleton rows={5} />
        </div>
      </div>
    );
  }

  const getItemSpecs = (item: Product) => {
    const parts = [];
    if (item.material) parts.push(MATERIAL_LABELS[item.material]);
    if (item.diameter) parts.push(item.diameter);
    if (item.length) parts.push(item.length);
    return parts.join(' × ') || '-';
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="التحليلات المتقدمة"
        description="تحليل الاستهلاك والأرباح والمخزون الراكد"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="إجمالي الأرباح"
          value={formatCurrency(stats.totalProfit)}
          icon={DollarSign}
          variant="success"
        />
        <StatsCard
          title="متوسط الربح/عملية"
          value={formatCurrency(stats.avgProfitPerSurgery)}
          icon={TrendingUp}
        />
        <StatsCard
          title="قيمة المخزون الراكد"
          value={formatCurrency(stats.deadStockValue)}
          icon={Skull}
          variant={stats.deadStockCount > 0 ? 'warning' : 'default'}
        />
        <StatsCard
          title="أفضل طبيب (أرباح)"
          value={stats.topDoctorName}
          icon={User}
          variant="primary"
        />
      </div>

      {/* Top 10 Dead Stock Chart */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Skull className="w-5 h-5 text-destructive" />
          <h2 className="text-lg font-bold text-foreground">
            أعلى 10 أصناف راكدة ({thresholdMonths} أشهر)
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          الأصناف الأكثر ركوداً بناءً على إعدادات النظام الحالية
        </p>
        {top10DeadStock.length > 0 ? (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10DeadStock}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={true} vertical={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={230}
                  tick={({ x, y, payload }) => (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={-5}
                        y={0}
                        dy={4}
                        textAnchor="end"
                        fill="#000000"
                        fontSize={12}
                        fontWeight={600}
                      >
                        {payload.value && payload.value.length > 35
                          ? `${payload.value.substring(0, 35)}...`
                          : payload.value}
                      </text>
                    </g>
                  )}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                <Bar dataKey="days" radius={[4, 0, 0, 4]} barSize={32}>
                  {top10DeadStock.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.days > (thresholdMonths * 30) ? 'hsl(var(--destructive))' : 'hsl(var(--warning))'}
                    />
                  ))}
                </Bar>

              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            <p>🎉 لا توجد أصناف راكدة</p>
          </div>
        )}
      </div>

      {/* Surgeon Portfolio */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">
            محفظة الأطباء (Surgeon Portfolio)
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          تحليل استهلاك ومساهمة كل طبيب في الأرباح
        </p>
        <DataTable
          columns={[
            {
              key: 'doctor',
              header: 'الطبيب',
              render: (item) => (
                <div>
                  <p className="font-medium text-foreground">{item.doctorName}</p>
                  <p className="text-xs text-muted-foreground">{item.specialty}</p>
                </div>
              ),
            },
            {
              key: 'surgeryCount',
              header: 'عدد العمليات',
              render: (item) => (
                <span className="num font-medium">{formatNumber(item.surgeryCount)}</span>
              ),
            },
            {
              key: 'totalBaseValue',
              header: 'قيمة التكلفة',
              render: (item) => (
                <span className="num text-muted-foreground">
                  {formatCurrency(item.totalBaseValue)}
                </span>
              ),
            },
            {
              key: 'totalSellingValue',
              header: 'قيمة البيع',
              render: (item) => (
                <span className="num">{formatCurrency(item.totalSellingValue)}</span>
              ),
            },
            {
              key: 'profit',
              header: 'الربح',
              render: (item) => (
                <span className="num font-medium text-success">
                  {formatCurrency(item.totalProfit)}
                </span>
              ),
            },
          ]}
          data={surgeonPortfolio}
          keyExtractor={(item) => item.doctorId}
          emptyMessage="لا توجد بيانات"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dead Stock */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skull className="w-5 h-5 text-warning" />
              <h2 className="text-lg font-bold text-foreground">
                المخزون الراكد (Dead Stock)
              </h2>
            </div>
            <Link to="/settings" className="text-xs text-primary hover:underline flex items-center gap-1">
              <SettingsIcon className="w-3 h-3" />
              تعديل الإعدادات ({thresholdMonths} أشهر)
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            أصناف لم تتحرك منذ {thresholdMonths} أشهر أو أكثر
          </p>
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'الصنف',
                render: (item) => (
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{getItemSpecs(item)}</p>
                  </div>
                ),
              },
              {
                key: 'quantity',
                header: 'الكمية',
                render: (item) => (
                  <span className="num">{formatNumber(item.totalQuantity)}</span>
                ),
              },
              {
                key: 'days',
                header: 'أيام بدون حركة',
                render: (item) => (
                  <span className="num text-warning font-medium">{formatNumber(item.daysSinceMovement)} يوم</span>
                ),
              },
              {
                key: 'value',
                header: 'القيمة',
                render: (item) => (
                  <span className="num text-destructive">
                    {formatCurrency(item.totalValue)}
                  </span>
                ),
              },
            ]}
            data={deadStockItems}
            keyExtractor={(item) => item.id}
            emptyMessage="لا يوجد مخزون راكد 🎉"
          />
        </div>

        {/* Surgery Profitability */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-success" />
            <h2 className="text-lg font-bold text-foreground">
              ربحية العمليات الجراحية
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            تحليل الربح لكل عملية جراحية
          </p>
          <DataTable
            columns={[
              {
                key: 'doctor',
                header: 'الطبيب',
                render: (item) => (
                  <div>
                    <p className="font-medium text-foreground">{item.doctorName}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
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
              {
                key: 'sellingValue',
                header: 'قيمة البيع',
                render: (item) => (
                  <span className="num">{formatCurrency(item.totalSellingValue)}</span>
                ),
              },
              {
                key: 'profit',
                header: 'الربح',
                render: (item) => (
                  <div>
                    <span className="num font-medium text-success">
                      {formatCurrency(item.profit)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      ({item.profitMargin}%)
                    </p>
                  </div>
                ),
              },
            ]}
            data={surgeryProfitability}
            keyExtractor={(item) => item.id}
            emptyMessage="لا توجد عمليات"
          />
        </div>
      </div>
    </div>
  );
}
