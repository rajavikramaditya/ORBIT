import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const TOKEN_STORAGE_KEY = "orbit_access_token";

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function clearStoredToken() {
  setStoredToken(null);
}

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ------------------------------------------------------------------ *
 * Expired sessions
 *
 * Without this, an expired token left the app in its worst state: the
 * in-memory `user` object stayed truthy, so ProtectedRoute kept rendering
 * the dashboard while every single request came back 401. Every list went
 * empty and every button "did nothing" — which is exactly what a broken
 * app looks like from the outside.
 *
 * Now one 401 ends the session cleanly: token cleared, AuthContext told,
 * ProtectedRoute sends the user to /login.
 * ------------------------------------------------------------------ */

// Endpoints where a 401 is a normal answer, not an expired session:
//  - /auth/me     → a logged-out visitor on the landing page. Reacting here
//                   would bounce every anonymous visitor to /login.
//  - login/register/reset/exchange → wrong password etc. The form shows it.
const AUTH_EXEMPT = /\/auth\/(me|login|register|logout|forgot-password|reset-password|google\/exchange)$/;

let unauthorizedHandler = null;
let handling = false;

/** AuthContext registers here so a 401 anywhere can end the session. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

api.interceptors.response.use(
  (response) => {
    handling = false;
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";

    if (status === 401 && !AUTH_EXEMPT.test(url) && !handling) {
      // A dashboard load fires several requests at once; they all 401
      // together. Only the first one should tear down the session.
      handling = true;
      clearStoredToken();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      } else if (!window.location.pathname.startsWith("/login")) {
        // No React tree listening (very early boot) — fall back to a redirect.
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  },
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
