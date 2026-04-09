import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest, API_BASE } from "./queryClient";
import type { UserPreferences, DEFAULT_PREFERENCES } from "@shared/schema";
import { DEFAULT_PREFERENCES as PREFS_DEFAULT } from "@shared/schema";
import { identifyUser, resetUser, Analytics } from "./analytics";

export type { UserPreferences };

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  plan: "free" | "premium";
  recipeCount: number;
  preferences: UserPreferences;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, name: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
  updateName(name: string): Promise<void>;
  updatePreferences(prefs: Partial<UserPreferences>): Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => {}, register: async () => {},
  logout: async () => {}, refresh: async () => {},
  updateName: async () => {}, updatePreferences: async () => {},
});

function mergePrefs(raw: any): UserPreferences {
  return {
    units: raw?.units ?? PREFS_DEFAULT.units,
    defaultServes: raw?.defaultServes ?? PREFS_DEFAULT.defaultServes,
    dietary: Array.isArray(raw?.dietary) ? raw.dietary : [],
    cuisines: Array.isArray(raw?.cuisines) ? raw.cuisines : [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        const u = { ...d, preferences: mergePrefs(d.preferences) };
        setUser(u);
        identifyUser(u.id, u.email, u.plan);
      } else setUser(null);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const d = await res.json();
    const u = { ...d, preferences: mergePrefs(d.preferences) };
    setUser(u);
    identifyUser(u.id, u.email, u.plan);
    Analytics.loggedIn();
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { email, password, name });
    const d = await res.json();
    const u = { ...d, preferences: mergePrefs(d.preferences) };
    setUser(u);
    identifyUser(u.id, u.email, u.plan);
    Analytics.signedUp(u.plan);
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    Analytics.loggedOut();
    resetUser();
    setUser(null);
  };

  const updateName = async (name: string) => {
    const res = await apiRequest("PATCH", "/api/auth/profile", { name });
    const d = await res.json();
    setUser(u => u ? { ...u, name: d.name } : null);
  };

  const updatePreferences = async (prefs: Partial<UserPreferences>) => {
    const merged = mergePrefs({ ...user?.preferences, ...prefs });
    // Optimistic update
    setUser(u => u ? { ...u, preferences: merged } : null);
    await apiRequest("PATCH", "/api/auth/preferences", merged);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, updateName, updatePreferences }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
