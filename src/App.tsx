import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Purchases from "./pages/Purchases";
import CreateInvoice from "./pages/CreateInvoice";
import Sales from "./pages/Sales";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import SupplierDebts from "./pages/SupplierDebts";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/inventory"
                element={
                  <MainLayout>
                    <Inventory />
                  </MainLayout>
                }
              />
              <Route
                path="/purchases"
                element={
                  <MainLayout>
                    <Purchases />
                  </MainLayout>
                }
              />
              <Route
                path="/purchases/new"
                element={
                  <MainLayout>
                    <CreateInvoice />
                  </MainLayout>
                }
              />
              <Route
                path="/supplier-debts"
                element={
                  <MainLayout>
                    <SupplierDebts />
                  </MainLayout>
                }
              />
              <Route
                path="/sales"
                element={
                  <MainLayout>
                    <Sales />
                  </MainLayout>
                }
              />
              <Route element={<RoleGuard permission="canViewAnalytics" />}>
                <Route
                  path="/analytics"
                  element={
                    <MainLayout>
                      <Analytics />
                    </MainLayout>
                  }
                />
              </Route>
              <Route element={<RoleGuard permission="canViewFinancials" />}>
                <Route
                  path="/reports"
                  element={
                    <MainLayout>
                      <Reports />
                    </MainLayout>
                  }
                />
              </Route>
              <Route element={<RoleGuard permission="canManageSettings" />}>
                <Route
                  path="/settings"
                  element={
                    <MainLayout>
                      <Settings />
                    </MainLayout>
                  }
                />
              </Route>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
