import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getStock } from "@shared/marketData";
import { calculateAverageBuyPrice } from "@shared/trading";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HoldingRecord = {
  symbol: string;
  quantity: number;
  averageBuyPrice: number;
};

export type OrderRecord = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  status: "EXECUTED";
  createdAt: string;
};

export type TransactionRecord = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  createdAt: string;
};

export type AlertRecord = {
  id: string;
  symbol: string;
  type: "PRICE_ABOVE" | "PRICE_BELOW";
  target: number;
  active: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

type TradingState = {
  watchlist: string[];
  alerts: AlertRecord[];

  // Watchlist actions
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;

  // Alert actions
  createAlert: (symbol: string, type: "PRICE_ABOVE" | "PRICE_BELOW", target: number) => void;
  toggleAlert: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Initial state — ₹10,00,000 virtual cash
// ---------------------------------------------------------------------------

const INITIAL_CASH = 1_000_000;

let orderCounter = 0;
function nextId(prefix: string) {
  orderCounter += 1;
  return `${prefix}-${Date.now()}-${orderCounter}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTradingStore = create<TradingState>()(
  persist(
    (set, get) => ({
      watchlist: [],
      alerts: [],



      // ── Watchlist ────────────────────────────────────────────────────
      addToWatchlist: (symbol) => {
        const { watchlist } = get();
        if (!watchlist.includes(symbol)) {
          set({ watchlist: [...watchlist, symbol] });
        }
      },
      removeFromWatchlist: (symbol) => {
        set({ watchlist: get().watchlist.filter((s) => s !== symbol) });
      },

      // ── Alerts ───────────────────────────────────────────────────────
      createAlert: (symbol, type, target) => {
        set({
          alerts: [
            ...get().alerts,
            { id: nextId("ALT"), symbol, type, target, active: true, createdAt: new Date().toISOString() },
          ],
        });
      },
      toggleAlert: (id) => {
        set({
          alerts: get().alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
        });
      },
    }),
    { name: "tradingapp-paper-account" },
  ),
);
