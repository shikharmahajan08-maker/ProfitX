import { calculateAverageBuyPrice, calculateHoldingMetrics, calculatePortfolioSummary } from "@shared/trading";

export { calculateAverageBuyPrice, calculateHoldingMetrics, calculatePortfolioSummary };

export function validateQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }
}

export function validateTradeBalance(side: "BUY" | "SELL", cashBalance: number, holdingQuantity: number, quantity: number, price: number) {
  validateQuantity(quantity);
  if (price <= 0) throw new Error("Price must be greater than zero");
  if (side === "BUY" && cashBalance < quantity * price) throw new Error("Insufficient balance");
  if (side === "SELL" && holdingQuantity < quantity) throw new Error("Insufficient holdings");
}
