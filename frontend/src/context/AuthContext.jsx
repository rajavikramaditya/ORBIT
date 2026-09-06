import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  api,
  formatApiErrorDetail,
  setStoredToken,
  clearStoredToken,
  setUnauthorizedHandler,
} from "@/lib/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // null = checking, false = unauthenticated, object = authenticated
  const [user, setUser] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      setUser(false);
    }
  }, []);

  // Any request that comes back 401 (see lib/api.js) ends the session here.
  // Dropping `user` to false is enough — ProtectedRoute redirects to /login on
  // its own, so we get a clean logout without a full page reload.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    // If returning from Google OAuth callback, skip the initial /me check.
    // AuthCallback exchanges the ticket and establishes the session first.
    if (
      window.location.hash?.includes("auth_ticket=") ||
      window.location.hash?.includes("session_id=")
    ) {
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data?.access_token) {
        setStoredToken(data.access_token);
      }
      setUser(data);
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      if (data?.access_token) {
        setStoredToken(data.access_token);
      }
      setUser(data);
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) };
    }
  };

  const exchangeGoogleTicket = async (ticket) => {
    const { data } = await api.post("/auth/google/exchange", { ticket });
    if (data?.access_token) {
      setStoredToken(data.access_token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      /* ignore */
    }
    clearStoredToken();
    setUser(false);
  };

  const googleLogin = () => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
    window.location.href = `${backendUrl}/api/auth/google/login`;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        register,
        logout,
        googleLogin,
        exchangeGoogleTicket,
        exchangeSession: exchangeGoogleTicket,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
