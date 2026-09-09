export type MarketStock = {
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  industry: string;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  volume: number;
  marketCap: string;
  accent: string;
};

export type PricePoint = { date: string; price: number };

export const MARKET_STOCKS: MarketStock[] = [
  { symbol: "TCS", companyName: "Tata Consultancy Services", exchange: "NSE", sector: "IT", industry: "Information Technology", price: 3842.4, previousClose: 3778.2, dayHigh: 3868, dayLow: 3781, week52High: 4592.25, week52Low: 3031.55, volume: 2842100, marketCap: "₹13.9T", accent: "#47c1a3" },
  { symbol: "RELIANCE", companyName: "Reliance Industries", exchange: "NSE", sector: "Energy", industry: "Oil & Gas", price: 2948.75, previousClose: 2908.1, dayHigh: 2964.8, dayLow: 2898.1, week52High: 3217.9, week52Low: 2220.3, volume: 6214800, marketCap: "₹19.9T", accent: "#e6a64a" },
  { symbol: "HDFCBANK", companyName: "HDFC Bank", exchange: "NSE", sector: "Banking", industry: "Private Banks", price: 1764.35, previousClose: 1740.2, dayHigh: 1777.9, dayLow: 1728.4, week52High: 1880, week52Low: 1363.55, volume: 8043100, marketCap: "₹13.4T", accent: "#7b8cff" },
  { symbol: "INFY", companyName: "Infosys", exchange: "NSE", sector: "IT", industry: "Information Technology", price: 1668.2, previousClose: 1642.55, dayHigh: 1680.5, dayLow: 1634.2, week52High: 1978.9, week52Low: 1351.65, volume: 3785200, marketCap: "₹6.9T", accent: "#f26a6a" },
  { symbol: "SUNPHARMA", companyName: "Sun Pharmaceutical", exchange: "NSE", sector: "Healthcare", industry: "Pharmaceuticals", price: 1812.6, previousClose: 1798.3, dayHigh: 1825.9, dayLow: 1785.1, week52High: 1960, week52Low: 1218.2, volume: 1998100, marketCap: "₹4.3T", accent: "#b68cff" },
  { symbol: "TATAMOTORS", companyName: "Tata Motors", exchange: "NSE", sector: "Auto", industry: "Automobiles", price: 1005.1, previousClose: 981.4, dayHigh: 1018.2, dayLow: 976.8, week52High: 1179, week52Low: 668.3, volume: 9123500, marketCap: "₹3.7T", accent: "#4db8e8" },
  { symbol: "ICICIBANK", companyName: "ICICI Bank", exchange: "NSE", sector: "Banking", industry: "Private Banks", price: 1298.45, previousClose: 1289.6, dayHigh: 1310.2, dayLow: 1280.1, week52High: 1362.35, week52Low: 899.7, volume: 5231900, marketCap: "₹9.1T", accent: "#eb7eae" },
  { symbol: "LT", companyName: "Larsen & Toubro", exchange: "NSE", sector: "Infrastructure", industry: "Engineering & Construction", price: 3652.9, previousClose: 3612.2, dayHigh: 3674.8, dayLow: 3590.3, week52High: 3919.9, week52Low: 2540.5, volume: 1487000, marketCap: "₹5.0T", accent: "#7ecb78" },
];

export const DEV_NEWS = [
  { id: "n1", title: "IT leaders hold steady as enterprise cloud demand remains resilient", description: "A development-market brief tracking the technology sector's current momentum and earnings expectations.", source: "Market Desk", sector: "IT", publishedAt: "2 hours ago", symbol: "TCS" },
  { id: "n2", title: "Energy names gain as refining margins show early signs of recovery", description: "A simulated market-data headline for the paper-trading environment. Not investment advice.", source: "Research Wire", sector: "Energy", publishedAt: "5 hours ago", symbol: "RELIANCE" },
  { id: "n3", title: "Private banks remain in focus ahead of credit growth updates", description: "A development-only news item used to demonstrate the replaceable news provider boundary.", source: "Capital Brief", sector: "Banking", publishedAt: "Yesterday", symbol: "HDFCBANK" },
  { id: "n4", title: "Healthcare watch: large-cap pharma continues to attract defensive interest", description: "Mock data for interface development. Connect a real provider before production use.", source: "Sector Scan", sector: "Healthcare", publishedAt: "Yesterday", symbol: "SUNPHARMA" },
];

export function getStock(symbol: string) {
  return MARKET_STOCKS.find((stock) => stock.symbol === symbol);
}

export function generateHistory(stock: MarketStock, points = 30): PricePoint[] {
  const start = stock.price * 0.9;
  return Array.from({ length: points }, (_, index) => {
    const progress = index / (points - 1);
    const wave = Math.sin(index * 0.72) * stock.price * 0.018 + Math.cos(index * 0.21) * stock.price * 0.009;
    const price = start + (stock.price - start) * progress + wave;
    const date = new Date(Date.now() - (points - index) * 86400000).toISOString();
    return { date, price: Math.max(1, Number(price.toFixed(2))) };
  });
}
