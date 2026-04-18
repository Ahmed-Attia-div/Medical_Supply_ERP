import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts, useSurgeriesList } from '@/hooks/useSupabaseData';
import { invoicesService } from '@/services/invoicesService';
import { surgeriesService } from '@/services/surgeriesService';
import { useQuery } from '@tanstack/react-query';
import { Product, CATEGORY_LABELS, MATERIAL_LABELS } from '@/types/inventory';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import { TimePeriodFilter, TimePeriod } from '@/components/ui/TimePeriodFilter';
import { ExportButton } from '@/components/ui/ExportButton';
import { getDateRangeFromPeriod } from '@/utils/dateUtils';
import { exportFinancialReportsToExcel } from '@/utils/excelExport';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  BarChart3,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function Reports() {
  const { hasPermission } = useAuth();
  const canViewFinancials = hasPermission('canViewFinancials');

  // Time period filter state
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const dateRange = getDateRangeFromPeriod(selectedPeriod);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Products — server-side paginated, fetch all for report (large page size)
  const { data: pagedResult, isLoading: loadingInventory, error: errorInventory } =
    useProducts({}, { page: 1, pageSize: 500 });
  const inventory = pagedResult?.data ?? [];

  // Invoices
  const { data: allInvoices = [], isLoading: loadingInvoices, error: errorInvoices } = useQuery({
    queryKey: ['invoices', 'all'],
    queryFn: () => invoicesService.getAll(),
    staleTime: 60_000,
  });

  const invoices = useMemo(() => {
    if (!dateRange || !allInvoices.length) return allInvoices;
    return allInvoices.filter(inv =>
      inv.invoiceDate >= dateRange.startDate && inv.invoiceDate <= dateRange.endDate
    );
  }, [allInvoices, dateRange]);

  // Surgeries
  const { data: surgeries = [], isLoading: loadingSurgeries, error: errorSurgeries } =
    useSurgeriesList();

  const filteredSurgeries = useMemo(() => {
    if (!dateRange || !surgeries.length) return surgeries;
    return surgeries.filter((s: any) =>
      s.date >= dateRange.startDate && s.date <= dateRange.endDate
    );
  }, [surgeries, dateRange]);

  // Top selling items
  const { data: topSellingItems = [] } = useQuery({
    queryKey: ['top-selling', dateRange?.startDate?.toISOString(), dateRange?.endDate?.toISOString()],
    queryFn: () => surgeriesService.getTopSellingItems(dateRange?.startDate, dateRange?.endDate, 10),
    staleTime: 60_000,
  });

  // Redirect users without financial access
  if (!canViewFinancials) {
    return <Navigate to="/dashboard" replace />;
  }

  const stats = useMemo(() => {
    const totalValue = inventory.reduce(
      (sum, item) => sum + item.totalQuantity * item.basePriceWac, 0
    );
    const totalPurchases = invoices.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);
    const totalPaidPurchases = invoices.reduce((sum, inv) => sum + (inv.amountPaid ?? 0), 0);
    const totalCreditPurchases = invoices.reduce((sum, inv) => sum + ((inv.totalAmount ?? 0) - (inv.amountPaid ?? 0)), 0);
    const totalSales = filteredSurgeries.reduce((sum, s) => sum + ((s as any).totalSellingValue ?? 0), 0);
    const totalProfit = filteredSurgeries.reduce((sum, s) => sum + ((s as any).profit ?? 0), 0);
    const lowStockValue = 0; // computed server-side via dashboard-stats RPC

    return { totalValue, totalPurchases, totalPaidPurchases, totalCreditPurchases, totalSales, totalProfit, lowStockValue };
  }, [inventory, invoices, filteredSurgeries]);

  const inventoryByCategory = useMemo(() => {
    const categories: Record<string, { count: number; value: number; quantity: number }> = {};
    inventory.forEach((item: Product) => {
      const catLabel = CATEGORY_LABELS[item.category];
      if (!categories[catLabel]) categories[catLabel] = { count: 0, value: 0, quantity: 0 };
      categories[catLabel].count++;
      categories[catLabel].quantity += item.totalQuantity;
      categories[catLabel].value += item.totalQuantity * item.basePriceWac;
    });
    return Object.entries(categories).map(([category, data]) => ({ category, ...data }));
  }, [inventory]);

  // Top selling items are now fetched directly from the hook

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

  const getItemSpecs = (item: Product) => {
    const parts = [];
    if (item.material) parts.push(MATERIAL_LABELS[item.material as string] ?? item.material);
    if (item.diameter) parts.push(item.diameter);
    if (item.length) parts.push(item.length);
    return parts.join(' × ') || '-';
  };

  // Export handler
  const handleExport = () => {
    try {
      setIsExporting(true);

      // Prepare data for export
      const categoryData = inventoryByCategory.map(cat => ({
        category: cat.category,
        count: cat.count,
        quantity: cat.quantity,
        value: cat.value,
      }));

      const topItemsData = topSellingItems.map(item => ({
        name: item.itemName,
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
      }));

      // Get period label
      const periodLabels: Record<TimePeriod, string> = {
        today: 'اليوم',
        week: 'هذا الأسبوع',
        month: 'هذا الشهر',
        year: 'هذا العام',
        all: 'الكل',
      };

      // Export to Excel
      exportFinancialReportsToExcel(
        stats,
        categoryData,
        topItemsData,
        inventory,
        dateRange,
        periodLabels[selectedPeriod]
      );

      toast.success('تم تصدير التقرير بنجاح');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('فشل في تصدير التقرير');
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = loadingInventory || loadingInvoices || loadingSurgeries;
  const error = errorInventory || errorInvoices || errorSurgeries;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-muted-foreground">جارٍ تحميل البيانات...</span>
      </div>
    );
  }

  if (error) {
    console.error('[Reports] Data error:', error);
    return (
      <div className="p-8">
        <div className="flex flex-col gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <span className="font-bold">حدث خطأ في تحميل البيانات</span>
          </div>
          <p className="text-sm mr-8 text-destructive/80">{(error as any)?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="التقارير المالية"
        description="نظرة شاملة على الوضع المالي للمخزون"
      />

      {/* Time Period Filter and Export Button */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1">
          <TimePeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        </div>
        <ExportButton
          onClick={handleExport}
          disabled={isLoading || !!error}
          isExporting={isExporting}
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatsCard
          title="إجمالي قيمة المخزون"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          variant="primary"
        />
        <StatsCard
          title="مشتريات مسددة"
          value={formatCurrency(stats.totalPaidPurchases)}
          icon={TrendingUp}
          variant="warning"
        />
        <StatsCard
          title="مشتريات آجلة (مديونيات)"
          value={formatCurrency(stats.totalCreditPurchases)}
          icon={TrendingDown}
          variant="danger"
        />
        <StatsCard
          title="إجمالي المبيعات"
          value={formatCurrency(stats.totalSales)}
          icon={TrendingUp}
        />
        <StatsCard
          title="إجمالي الأرباح"
          value={formatCurrency(stats.totalProfit)}
          icon={DollarSign}
          variant="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory by Category */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              المخزون حسب الفئة
            </h2>
          </div>
          <DataTable
            columns={[
              {
                key: 'category',
                header: 'الفئة',
                render: (item) => (
                  <span className="font-medium text-foreground">
                    {item.category}
                  </span>
                ),
              },
              {
                key: 'count',
                header: 'عدد الأصناف',
                render: (item) => (
                  <span className="num">{formatNumber(item.count)}</span>
                ),
              },
              {
                key: 'quantity',
                header: 'إجمالي الكميات',
                render: (item) => (
                  <span className="num">{formatNumber(item.quantity)}</span>
                ),
              },
              {
                key: 'value',
                header: 'القيمة',
                render: (item) => (
                  <span className="num font-medium text-primary">
                    {formatCurrency(item.value)}
                  </span>
                ),
              },
            ]}
            data={inventoryByCategory}
            keyExtractor={(item) => item.category}
            emptyMessage="لا توجد بيانات"
          />
        </div>

        {/* Top Selling Items (Revenue) */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              الأصناف الأكثر مبيعاً (إيرادات)
            </h2>
          </div>
          <DataTable
            columns={[
              {
                key: 'itemName',
                header: 'الصنف',
                render: (item) => (
                  <div>
                    <p className="font-medium text-foreground">{item.itemName}</p>
                  </div>
                ),
              },
              {
                key: 'totalQuantity',
                header: 'إجمالي الكمية المباعة',
                render: (item) => (
                  <span className="num">{formatNumber(item.totalQuantity)}</span>
                ),
              },
              {
                key: 'totalRevenue',
                header: 'إجمالي الإيرادات',
                render: (item) => (
                  <span className="num font-medium text-primary">
                    {formatCurrency(item.totalRevenue)}
                  </span>
                ),
              },
            ]}
            data={topSellingItems}
            keyExtractor={(item) => item.productId ?? item.itemName}
            emptyMessage="لا توجد مبيعات في هذه الفترة"
          />
        </div>
      </div>

      {/* Financial Summary Table */}
      <div className="mt-6 bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">
            الملخص المالي الشامل
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
                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'الفئة',
              render: (item) => (
                <span className="text-muted-foreground">{CATEGORY_LABELS[item.category]}</span>
              ),
            },
            {
              key: 'quantity',
              header: 'الكمية',
              render: (item: Product) => (
                <span className="num">{formatNumber(item.totalQuantity)}</span>
              ),
            },
            {
              key: 'basePrice',
              header: 'السعر الأساسي',
              render: (item: Product) => (
                <span className="num">({formatCurrency(item.basePriceWac)})</span>
              ),
            },
            {
              key: 'sellingPrice',
              header: 'سعر البيع',
              render: (item) => (
                <span className="num text-primary">{formatCurrency(item.sellingPrice)}</span>
              ),
            },
            {
              key: 'totalValue',
              header: 'القيمة الإجمالية',
              render: (item: Product) => (
                <span className="num font-medium text-success">
                  {formatCurrency(item.totalQuantity * item.basePriceWac)}
                </span>
              ),
            },
          ]}
          data={inventory}
          keyExtractor={(item: Product) => item.id}
          emptyMessage="لا توجد أصناف"
        />
      </div>
    </div>
  );
}
