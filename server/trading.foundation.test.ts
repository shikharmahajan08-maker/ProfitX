import { describe, expect, it } from "vitest";
import { generateHistory, getStock } from "@shared/marketData";
import { calculateAverageBuyPrice, calculateHoldingMetrics, calculatePortfolioSummary } from "./services/portfolioService";
import { validateQuantity, validateTradeBalance } from "./services/portfolioService";
import { developmentMarketDataProvider } from "./services/marketDataService";

describe("portfolio calculations", () => {
  it("calculates a weighted average buy price", () => { expect(calculateAverageBuyPrice(10, 100, 5, 130)).toBe(110); });
  it("calculates current value, P&L, and return safely", () => { expect(calculateHoldingMetrics({ symbol: "TCS", quantity: 10, averageBuyPrice: 100 }, 125)).toMatchObject({ investedValue: 1000, currentValue: 1250, unrealizedPnl: 250, returnPercentage: 25 }); expect(calculateHoldingMetrics({ symbol: "TCS", quantity: 0, averageBuyPrice: 0 }, 125).returnPercentage).toBe(0); });
  it("calculates a portfolio total from cash and positions", () => { expect(calculatePortfolioSummary(500, [{ symbol: "TCS", quantity: 2, averageBuyPrice: 100, currentPrice: 125 }])).toMatchObject({ totalValue: 750, investedValue: 200, currentValue: 250, pnl: 50 }); });
});

describe("trade validation", () => {
  it("rejects invalid quantities", () => { expect(() => validateQuantity(0)).toThrow("greater than zero"); expect(() => validateQuantity(-1)).toThrow("greater than zero"); });
  it("rejects insufficient cash and holdings", () => { expect(() => validateTradeBalance("BUY", 100, 0, 2, 75)).toThrow("Insufficient balance"); expect(() => validateTradeBalance("SELL", 100, 1, 2, 75)).toThrow("Insufficient holdings"); });
  it("accepts a valid trade", () => { expect(() => validateTradeBalance("BUY", 1000, 0, 2, 75)).not.toThrow(); expect(() => validateTradeBalance("SELL", 1000, 3, 2, 75)).not.toThrow(); });
});

describe("development market provider", () => {
  it("searches by symbol or company name", async () => { expect((await developmentMarketDataProvider.searchStocks("TCS"))[0]?.symbol).toBe("TCS"); expect((await developmentMarketDataProvider.searchStocks("pharma"))[0]?.symbol).toBe("SUNPHARMA"); });
  it("returns historical data for supported ranges", async () => { const stock = getStock("TCS")!; expect(generateHistory(stock, 30)).toHaveLength(30); expect((await developmentMarketDataProvider.getHistoricalPrices("TCS", "1Y")).length).toBe(52); });
});
