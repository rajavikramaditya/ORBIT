import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import DashboardLayout from "@/layouts/DashboardLayout";
import OnboardingWelcome from "@/pages/tenant/OnboardingWelcome";
import Overview from "@/pages/tenant/Overview";
import AIEmployees from "@/pages/tenant/AIEmployees";
import Channels from "@/pages/tenant/Channels";
import Integrations from "@/pages/tenant/Integrations";
import Conversations from "@/pages/tenant/Conversations";
import Leads from "@/pages/tenant/Leads";
import Customization from "@/pages/tenant/Customization";
import Billing from "@/pages/tenant/Billing";
import Settings from "@/pages/tenant/Settings";
import BusinessData from "@/pages/tenant/BusinessData";
import AdminConsole from "@/pages/admin/AdminConsole";
import Legal from "@/pages/Legal";

function AppRoutes() {
  const location = useLocation();
  // Process Google OAuth callback synchronously during render (prevents race conditions).
  if (location.hash?.includes("auth_ticket=") || location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    // Route-scoped so a crash on one page doesn't follow the user to the next.
    <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/terms" element={<Legal page="terms" />} />
        <Route path="/privacy" element={<Legal page="privacy" />} />
        <Route path="/ai-disclosure" element={<Legal page="disclosure" />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminConsole />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingWelcome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="ai-employees" element={<AIEmployees />} />
          <Route path="channels" element={<Channels />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="live-data" element={<BusinessData />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="leads" element={<Leads />} />
          <Route path="customization" element={<Customization />} />
          <Route path="billing" element={<Billing />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/reset-password" element={<Login resetMode />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

function App() {
  return (
    // Outer net: catches anything that breaks above the router (auth boot,
    // provider setup) — the one place a blank screen used to be unavoidable.
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-center" richColors closeButton />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
