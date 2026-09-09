export type HoldingPosition = { symbol: string; quantity: number; averageBuyPrice: number };

export type PortfolioMetrics = {
  investedValue: number;
  currentValue: number;
  unrealizedPnl: number;
  returnPercentage: number;
};

export type OrderSide = "BUY" | "SELL";
export type AlertType = "PRICE_ABOVE" | "PRICE_BELOW";

export function calculateHoldingMetrics(holding: HoldingPosition, currentPrice: number): PortfolioMetrics {
  const investedValue = holding.quantity * holding.averageBuyPrice;
  const currentValue = holding.quantity * currentPrice;
  const unrealizedPnl = currentValue - investedValue;
  return {
    investedValue,
    currentValue,
    unrealizedPnl,
    returnPercentage: investedValue > 0 ? (unrealizedPnl / investedValue) * 100 : 0,
  };
}

export function calculateAverageBuyPrice(oldQuantity: number, oldAveragePrice: number, newQuantity: number, newPrice: number) {
  const totalQuantity = oldQuantity + newQuantity;
  return totalQuantity > 0 ? ((oldQuantity * oldAveragePrice) + (newQuantity * newPrice)) / totalQuantity : 0;
}

export function calculatePortfolioSummary(cashBalance: number, positions: Array<HoldingPosition & { currentPrice: number }>) {
  const details = positions.map((position) => ({ ...position, ...calculateHoldingMetrics(position, position.currentPrice) }));
  const investedValue = details.reduce((sum, item) => sum + item.investedValue, 0);
  const currentValue = details.reduce((sum, item) => sum + item.currentValue, 0);
  const totalValue = cashBalance + currentValue;
  const pnl = currentValue - investedValue;
  return { details, cashBalance, investedValue, currentValue, totalValue, pnl, returnPercentage: investedValue > 0 ? (pnl / investedValue) * 100 : 0 };
}
