import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-white" data-testid="auth-loading">
    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
  </div>
);

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "platform_admin") return <Navigate to="/dashboard" replace />;
  if (!adminOnly && user.role === "platform_admin") return <Navigate to="/admin" replace />;
  return children;
}
