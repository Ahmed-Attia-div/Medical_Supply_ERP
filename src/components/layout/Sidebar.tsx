import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/types/roles';
import { useNotifications, useMarkAllRead } from '@/hooks/useSupabaseData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/notificationsService';

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingDown,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Bone,
  ChevronLeft,
  BarChart3,
  Bell,
  Check,
  Trash2,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  permission?: keyof import('@/types/roles').RolePermissions;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { path: '/inventory', label: 'المخزون', icon: Package },
  { path: '/purchases', label: 'المشتريات', icon: ShoppingCart },
  { path: '/supplier-debts', label: 'مديونية الموردين', icon: Wallet },
  { path: '/sales', label: 'العمليات الجراحية', icon: TrendingDown },
  { path: '/analytics', label: 'التحليلات', icon: BarChart3, permission: 'canViewAnalytics' },
  { path: '/reports', label: 'التقارير', icon: FileText, permission: 'canViewFinancials' },
  { path: '/settings', label: 'الإعدادات', icon: Settings, permission: 'canManageSettings' },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, hasPermission, roleLabel, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: notifications = [] } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();
  const qc = useQueryClient();
  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const { mutate: deleteAll } = useMutation({
    mutationFn: () => notificationsService.deleteAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Explicit counter calculation
  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const handleNotificationClick = (n: any) => {
    markRead(n.id);
    if (n.link) {
      navigate(n.link);
      setShowNotifications(false);
    }
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
          <Bone className="w-5 h-5" />
        </div>
        {!isCollapsed && (
          <div className="animate-fade-in">
            <h1 className="font-bold text-foreground text-sm">شركة الدلتا للمستلزمات الطبية</h1>
            <p className="text-xs text-muted-foreground">نظام إدارة المخزون</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'animate-pulse-soft')} />
              {!isCollapsed && (
                <span className="font-medium animate-fade-in">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Section (with Notifications) */}
      <div className="border-t border-sidebar-border p-4 relative">
        {/* Notification Popover */}
        {showNotifications && (
          <div className={`absolute bottom-full ${isCollapsed ? 'left-14' : 'left-0 right-0 mx-4'} mb-3 max-h-96 overflow-y-auto bg-card border border-border shadow-2xl rounded-xl z-50 flex flex-col ring-1 ring-black/5`}>
            <div className="p-3 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10">
              <h3 className="font-bold text-sm">الإشعارات ({unreadCount})</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    title="تحديد الكل كمقروء"
                  >
                    <Check className="w-3 h-3" /> تم
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => deleteAll()}
                    className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    title="مسح الكل"
                  >
                    <Trash2 className="w-3 h-3" /> مسح
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[100px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center justify-center min-h-[150px]">
                  <Bell className="w-10 h-10 mb-3 opacity-20" />
                  <p>لا توجد تنبيهات حالياً</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifications.map((n: any) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        "p-3 cursor-pointer transition-colors relative group",
                        !n.is_read
                          ? "bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          : "bg-card hover:bg-secondary/50"
                      )}
                    >
                      {/* Unread Indicator Dot */}
                      {!n.is_read && (
                        <span className="absolute top-4 left-3 w-2 h-2 rounded-full bg-blue-500 shadow-sm ring-2 ring-background" />
                      )}

                      <div className={cn("pr-1 transition-all", !n.is_read && "pl-4")}>
                        <p className={cn("text-sm mb-1", !n.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mb-2 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60">
                          {format(new Date(n.created_at), 'dd MMM, HH:mm', { locale: ar })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!isCollapsed && (
          <div className="flex items-center gap-3 mb-3 animate-fade-in">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
              <span className="font-bold text-sm">
                {user?.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                {user?.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {roleLabel}
              </p>
            </div>
            {/* Bell Icon Trigger */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors outline-none focus:ring-2 focus:ring-ring"
              title="الإشعارات"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background animate-pulse" />
              )}
            </button>
          </div>
        )}

        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span className="font-medium">تسجيل الخروج</span>}
        </button>
      </div>

      {/* Collapse Button (Desktop) */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="hidden lg:flex absolute top-20 -left-3 items-center justify-center w-6 h-6 rounded-lg bg-card border border-border shadow-sm hover:bg-secondary transition-colors z-20"
      >
        <ChevronLeft className={cn('w-4 h-4 transition-transform', isCollapsed && 'rotate-180')} />
      </button>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 flex items-center justify-center w-10 h-10 rounded-lg bg-card border border-border shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 right-0 z-50 w-72 bg-sidebar transform transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 left-4 p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col h-full">
          <NavContent />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col fixed inset-y-0 right-0 bg-sidebar border-l border-sidebar-border transition-all duration-300 z-30',
          isCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <NavContent />
      </aside>

      {/* Spacer for main content */}
      <div className={cn('hidden lg:block flex-shrink-0 transition-all duration-300', isCollapsed ? 'w-20' : 'w-64')} />
    </>
  );
}
