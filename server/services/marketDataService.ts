import { generateHistory, getStock, MARKET_STOCKS, type MarketStock, type PricePoint } from "@shared/marketData";

export interface MarketDataProvider {
  searchStocks(query?: string, sector?: string): Promise<MarketStock[]>;
  getQuote(symbol: string): Promise<MarketStock | undefined>;
  getHistoricalPrices(symbol: string, range?: string): Promise<PricePoint[]>;
}

/** Development provider. Replace this implementation with a real provider without changing callers. */
export const developmentMarketDataProvider: MarketDataProvider = {
  async searchStocks(query = "", sector = "all") {
    const normalized = query.trim().toLowerCase();
    return MARKET_STOCKS.filter((stock) => {
      const matchesQuery = !normalized || stock.symbol.toLowerCase().includes(normalized) || stock.companyName.toLowerCase().includes(normalized);
      const matchesSector = sector === "all" || stock.sector === sector;
      return matchesQuery && matchesSector;
    });
  },
  async getQuote(symbol) {
    return getStock(symbol.toUpperCase());
  },
  async getHistoricalPrices(symbol, range = "1M") {
    const stock = getStock(symbol.toUpperCase());
    if (!stock) return [];
    const pointsByRange: Record<string, number> = { "1D": 24, "1W": 14, "1M": 30, "6M": 42, "1Y": 52, "5Y": 60 };
    return generateHistory(stock, pointsByRange[range] ?? 30);
  },
};
