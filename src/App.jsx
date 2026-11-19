import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Packages from "@/pages/Packages";
import Invoices from "@/pages/Invoices";
import Rapel from "@/pages/Rapel";
import CVDeposits from "@/pages/CVDeposits";
import CVPayouts from "@/pages/CVPayouts";
import CVDivisionReport from "@/pages/CVDivisionReport";
import Finance from "@/pages/Finance";
import RekeningSaya from "@/pages/RekeningSaya";
import NonCVIncome from "@/pages/NonCVIncome";
import Reports from "@/pages/Reports";
import AnnualReport from "@/pages/AnnualReport";
import WhatsAppPage from "@/pages/WhatsAppPage";
import ImportExport from "@/pages/ImportExport";
import SettingsPage from "@/pages/Settings";
import UserRoles from "@/pages/UserRoles";
import GajiTeknisi from "@/pages/GajiTeknisi";
import TechnicianReports from "@/pages/TechnicianReports";
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app (ProtectedRoute gates authenticated pages; auth pages are public)
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        element={
          <ProtectedRoute
            unauthenticatedElement={<Navigate to="/login" replace />}
          />
        }
      >
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pelanggan" element={<Customers />} />
          <Route path="/pelanggan/:id" element={<CustomerDetail />} />
          <Route path="/paket" element={<Packages />} />
          <Route path="/tagihan" element={<Invoices />} />
          <Route path="/rapel" element={<Rapel />} />
          <Route
            path="/pembayaran"
            element={<Navigate to="/tagihan" replace />}
          />
          <Route path="/setoran-cv" element={<CVDeposits />} />
          <Route path="/pembayaran-cv" element={<CVPayouts />} />
          <Route path="/laporan-cv" element={<CVDivisionReport />} />
          <Route path="/keuangan" element={<Finance />} />
          <Route path="/rekening-saya" element={<RekeningSaya />} />
          <Route path="/pendapatan-noncv" element={<NonCVIncome />} />
          <Route path="/teknisi" element={<TechnicianReports />} />
          <Route path="/gaji-teknisi" element={<GajiTeknisi />} />
          <Route path="/laporan" element={<Reports />} />
          <Route path="/laporan-tahunan" element={<AnnualReport />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/import-export" element={<ImportExport />} />
          <Route path="/pengaturan" element={<SettingsPage />} />
          <Route path="/pengguna" element={<UserRoles />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
