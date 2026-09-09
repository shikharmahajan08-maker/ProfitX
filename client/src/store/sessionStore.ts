import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionUser = { name: string; email: string };
type SessionState = { user: SessionUser | null; signIn: (user: SessionUser) => void; signOut: () => void };

export const useSessionStore = create<SessionState>()(persist((set) => ({
  user: null,
  signIn: (user) => set({ user }),
  signOut: () => set({ user: null }),
}), { name: "tradingapp-demo-session" }));
