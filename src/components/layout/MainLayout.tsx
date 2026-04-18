import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { SessionTimer } from '@/components/SessionTimer';
import {
  useProductsRealtime,
  useNotificationsRealtime,
  useSurgeriesRealtime,
  useInvoicesRealtime,
} from '@/hooks/useRealtime';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated } = useAuth();

  // ── Realtime subscriptions (active for all authenticated sessions) ──────
  // These hooks subscribe to Postgres CDC events and invalidate React Query
  // cache automatically — every page sees live data with zero polling.
  useProductsRealtime();
  useNotificationsRealtime();
  useSurgeriesRealtime();
  useInvoicesRealtime();
  // ────────────────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <main className="flex-1 lg:pr-0 overflow-auto flex flex-col">
        <div className="container mx-auto px-4 py-6 lg:px-8 max-w-7xl flex-1">
          {children}
        </div>
        <Footer />
      </main>
      <SessionTimer />
    </div>
  );
}
