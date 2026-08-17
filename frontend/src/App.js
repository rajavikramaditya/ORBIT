import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import DashboardLayout from "@/layouts/DashboardLayout";
import Overview from "@/pages/tenant/Overview";
import AIEmployees from "@/pages/tenant/AIEmployees";
import Channels from "@/pages/tenant/Channels";
import Integrations from "@/pages/tenant/Integrations";
import Conversations from "@/pages/tenant/Conversations";
import Customization from "@/pages/tenant/Customization";
import Settings from "@/pages/tenant/Settings";
import AdminConsole from "@/pages/admin/AdminConsole";

function AppRoutes() {
  const location = useLocation();
  // Process Google OAuth callback synchronously during render (prevents race conditions).
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminConsole />
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
        <Route path="conversations" element={<Conversations />} />
        <Route path="customization" element={<Customization />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-center" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
