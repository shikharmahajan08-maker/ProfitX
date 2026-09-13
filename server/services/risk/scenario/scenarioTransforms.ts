import type { PortfolioSnapshot } from "../portfolioTypes";
import type { ScenarioTransformation } from "./scenarioTypes";

export function applyTransformation(
  baseline: PortfolioSnapshot,
  transformation: ScenarioTransformation
): PortfolioSnapshot {
  // Deep clone holdings to ensure immutability.
  // Price history is strictly read-only so reference is fine.
  const snap: PortfolioSnapshot = {
    portfolioId: baseline.portfolioId,
    cashBalance: baseline.cashBalance,
    holdings: baseline.holdings.map((h) => ({ ...h })),
    priceHistory: baseline.priceHistory,
  };

  switch (transformation.type) {
    case "market_shock": {
      const shockFactor = 1 - transformation.percentageDrop / 100;
      for (const h of snap.holdings) {
        h.marketValue *= shockFactor;
        h.currentPrice *= shockFactor;
      }
      break;
    }

    case "asset_shock": {
      const holding = snap.holdings.find((h) => h.symbol === transformation.symbol);
      if (holding) {
        const shockFactor = 1 - transformation.percentageDrop / 100;
        holding.marketValue *= shockFactor;
        holding.currentPrice *= shockFactor;
      }
      break;
    }

    case "trade_value": {
      const holding = snap.holdings.find((h) => h.symbol === transformation.symbol);
      if (!holding) {
        throw new Error(`Asset ${transformation.symbol} not in portfolio. V1 scenarios do not support buying new assets.`);
      }

      if (transformation.action === "BUY") {
        if (snap.cashBalance < transformation.amount) {
          throw new Error("Insufficient cash for BUY scenario.");
        }
        snap.cashBalance -= transformation.amount;
        holding.marketValue += transformation.amount;
        holding.quantity += transformation.amount / holding.currentPrice;
      } else {
        // SELL
        if (holding.marketValue < transformation.amount) {
          throw new Error(`Cannot sell more than owned for ${transformation.symbol}.`);
        }
        snap.cashBalance += transformation.amount;
        holding.marketValue -= transformation.amount;
        holding.quantity -= transformation.amount / holding.currentPrice;
      }
      break;
    }

    case "trade_percentage": {
      const holding = snap.holdings.find((h) => h.symbol === transformation.symbol);
      if (!holding) {
        throw new Error(`Asset ${transformation.symbol} not in portfolio.`);
      }

      const sellAmount = holding.marketValue * (transformation.percentage / 100);
      snap.cashBalance += sellAmount;
      holding.marketValue -= sellAmount;
      holding.quantity -= sellAmount / holding.currentPrice;
      break;
    }

    case "override_weight": {
      const totalValue =
        snap.cashBalance + snap.holdings.reduce((sum, h) => sum + h.marketValue, 0);
      const holding = snap.holdings.find((h) => h.symbol === transformation.symbol);
      if (!holding) {
        throw new Error(`Asset ${transformation.symbol} not in portfolio.`);
      }

      const targetMarketValue = totalValue * transformation.newWeight;
      const difference = targetMarketValue - holding.marketValue;

      if (difference > 0) {
        // We need to BUY
        if (snap.cashBalance < difference) {
          throw new Error("Insufficient cash to reach target weight.");
        }
        snap.cashBalance -= difference;
      } else {
        // We need to SELL
        snap.cashBalance += -difference;
      }

      holding.marketValue = targetMarketValue;
      holding.quantity = targetMarketValue / holding.currentPrice;
      break;
    }

    default:
      throw new Error("Unsupported scenario transformation");
  }

  // Cleanup: Remove any holdings that dropped to zero or effectively zero
  snap.holdings = snap.holdings.filter((h) => h.quantity > 1e-6 && h.marketValue > 1e-6);

  return snap;
}

export function applyTransformations(
  baseline: PortfolioSnapshot,
  transformations: ScenarioTransformation[]
): PortfolioSnapshot {
  let current = baseline;
  for (const tx of transformations) {
    current = applyTransformation(current, tx);
  }
  return current;
}
