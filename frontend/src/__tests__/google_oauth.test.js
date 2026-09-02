import { api, setStoredToken, clearStoredToken, getStoredToken, TOKEN_STORAGE_KEY } from "../lib/api";

describe("ORBIT Google OAuth Cross-Domain Frontend Auth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("stores and retrieves JWT token in localStorage", () => {
    expect(getStoredToken()).toBeNull();
    const mockToken = "orbit_jwt_mock_token_abc_123";
    setStoredToken(mockToken);
    expect(getStoredToken()).toBe(mockToken);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(mockToken);

    clearStoredToken();
    expect(getStoredToken()).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  test("Axios interceptor attaches Bearer token header when token is stored", async () => {
    const mockToken = "orbit_jwt_access_token_xyz";
    setStoredToken(mockToken);

    // Run the request interceptor directly
    const config = { headers: {} };
    // Find the interceptor function
    const interceptor = api.interceptors.request.handlers[0];
    const modifiedConfig = await interceptor.fulfilled(config);

    expect(modifiedConfig.headers.Authorization).toBe(`Bearer ${mockToken}`);
  });

  test("Axios interceptor does not attach Authorization header when no token is stored", async () => {
    clearStoredToken();

    const config = { headers: {} };
    const interceptor = api.interceptors.request.handlers[0];
    const modifiedConfig = await interceptor.fulfilled(config);

    expect(modifiedConfig.headers.Authorization).toBeUndefined();
  });
});
