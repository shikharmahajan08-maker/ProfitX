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
  cashBalance: number;
  holdings: Record<string, HoldingRecord>;
  orders: OrderRecord[];
  transactions: TransactionRecord[];
  watchlist: string[];
  alerts: AlertRecord[];

  // Trading actions
  buy: (symbol: string, quantity: number) => { ok: boolean; message: string };
  sell: (symbol: string, quantity: number) => { ok: boolean; message: string };

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
      cashBalance: INITIAL_CASH,
      holdings: {},
      orders: [],
      transactions: [],
      watchlist: [],
      alerts: [],

      // ── BUY ──────────────────────────────────────────────────────────
      buy: (symbol, quantity) => {
        const stock = getStock(symbol.toUpperCase());
        if (!stock) return { ok: false, message: "Stock not found in development provider." };
        if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, message: "Quantity must be greater than zero." };

        const total = stock.price * quantity;
        const { cashBalance, holdings, orders, transactions } = get();

        if (total > cashBalance) return { ok: false, message: "Insufficient virtual cash for this trade." };

        const now = new Date().toISOString();
        const existing = holdings[symbol] ?? { symbol, quantity: 0, averageBuyPrice: 0 };
        const newAvg = calculateAverageBuyPrice(existing.quantity, existing.averageBuyPrice, quantity, stock.price);

        set({
          cashBalance: cashBalance - total,
          holdings: {
            ...holdings,
            [symbol]: { symbol, quantity: existing.quantity + quantity, averageBuyPrice: newAvg },
          },
          orders: [
            { id: nextId("ORD"), symbol, side: "BUY", quantity, price: stock.price, total, status: "EXECUTED", createdAt: now },
            ...orders,
          ],
          transactions: [
            { id: nextId("TXN"), symbol, side: "BUY", quantity, price: stock.price, total, createdAt: now },
            ...transactions,
          ],
        });

        return { ok: true, message: `Bought ${quantity} shares of ${symbol} at ₹${stock.price.toLocaleString("en-IN")}.` };
      },

      // ── SELL ─────────────────────────────────────────────────────────
      sell: (symbol, quantity) => {
        const stock = getStock(symbol.toUpperCase());
        if (!stock) return { ok: false, message: "Stock not found in development provider." };
        if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, message: "Quantity must be greater than zero." };

        const { cashBalance, holdings, orders, transactions } = get();
        const existing = holdings[symbol];
        if (!existing || existing.quantity < quantity) return { ok: false, message: "Insufficient holdings for this trade." };

        const total = stock.price * quantity;
        const now = new Date().toISOString();
        const remainingQty = existing.quantity - quantity;

        const updatedHoldings = { ...holdings };
        if (remainingQty <= 0) {
          delete updatedHoldings[symbol];
        } else {
          updatedHoldings[symbol] = { ...existing, quantity: remainingQty };
        }

        set({
          cashBalance: cashBalance + total,
          holdings: updatedHoldings,
          orders: [
            { id: nextId("ORD"), symbol, side: "SELL", quantity, price: stock.price, total, status: "EXECUTED", createdAt: now },
            ...orders,
          ],
          transactions: [
            { id: nextId("TXN"), symbol, side: "SELL", quantity, price: stock.price, total, createdAt: now },
            ...transactions,
          ],
        });

        return { ok: true, message: `Sold ${quantity} shares of ${symbol} at ₹${stock.price.toLocaleString("en-IN")}.` };
      },

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
