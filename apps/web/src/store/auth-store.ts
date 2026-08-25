import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthenticatedUser, AuthTokens } from "@gs-workhub/shared";

interface AuthState {
  user: AuthenticatedUser | null;
  tokens: AuthTokens | null;
  setSession: (user: AuthenticatedUser, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      setSession: (user, tokens) => set({ user, tokens }),
      setTokens: (tokens) => set({ tokens }),
      clearSession: () => set({ user: null, tokens: null }),
    }),
    { name: "gs-workhub-auth" },
  ),
);
