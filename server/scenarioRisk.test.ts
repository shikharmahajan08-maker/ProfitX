import { describe, it, expect } from "vitest";
import { applyTransformations } from "./services/risk/scenario/scenarioTransforms";
import type { PortfolioSnapshot } from "./services/risk/portfolioTypes";
import type { ScenarioTransformation } from "./services/risk/scenario/scenarioTypes";

describe("Phase 4 Scenario Engine: Transformations", () => {
  const baseSnapshot: PortfolioSnapshot = {
    portfolioId: 1,
    cashBalance: 100000,
    holdings: [
      { symbol: "AAPL", quantity: 10, currentPrice: 150, marketValue: 1500, weight: 0 },
      { symbol: "TSLA", quantity: 5, currentPrice: 200, marketValue: 1000, weight: 0 },
    ],
    priceHistory: {
      AAPL: [
        { date: "2024-01-01", price: 150 }, { date: "2024-01-02", price: 152 },
        // padding to bypass length checks in risk metrics
        ...Array.from({ length: 30 }).map((_, i) => ({ date: `2024-01-${(i+3).toString().padStart(2, '0')}`, price: 150 + Math.random() }))
      ],
      TSLA: [
        { date: "2024-01-01", price: 200 }, { date: "2024-01-02", price: 198 },
        ...Array.from({ length: 30 }).map((_, i) => ({ date: `2024-01-${(i+3).toString().padStart(2, '0')}`, price: 200 + Math.random() }))
      ],
    },
  };

  it("Baseline immutability: transformations do not mutate original snapshot", () => {
    const txs: ScenarioTransformation[] = [{ type: "market_shock", percentageDrop: 10 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result).not.toBe(baseSnapshot);
    expect(result.cashBalance).toBe(100000); // unaffected by market shock
    
    // original must remain intact
    expect(baseSnapshot.holdings[0].marketValue).toBe(1500);
    expect(baseSnapshot.holdings[1].marketValue).toBe(1000);
  });

  it("Market shock: strictly applies to invested sleeve", () => {
    const txs: ScenarioTransformation[] = [{ type: "market_shock", percentageDrop: 20 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result.cashBalance).toBe(100000);
    expect(result.holdings[0].marketValue).toBeCloseTo(1200); // 1500 - 20%
    expect(result.holdings[1].marketValue).toBeCloseTo(800);  // 1000 - 20%
  });

  it("Asset shock: applies only to target asset", () => {
    const txs: ScenarioTransformation[] = [{ type: "asset_shock", symbol: "AAPL", percentageDrop: 50 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result.holdings[0].marketValue).toBeCloseTo(750); // 1500 - 50%
    expect(result.holdings[1].marketValue).toBe(1000); // TSLA unchanged
  });

  it("BUY: correctly deducts cash and increments market value", () => {
    const txs: ScenarioTransformation[] = [{ type: "trade_value", symbol: "AAPL", action: "BUY", amount: 50000 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result.cashBalance).toBe(50000); // 100000 - 50000
    expect(result.holdings[0].marketValue).toBe(51500); // 1500 + 50000
  });

  it("BUY: rejects if insufficient cash", () => {
    const txs: ScenarioTransformation[] = [{ type: "trade_value", symbol: "AAPL", action: "BUY", amount: 200000 }];
    expect(() => applyTransformations(baseSnapshot, txs)).toThrowError(/Insufficient cash/);
  });

  it("SELL: correctly increases cash and decrements market value", () => {
    const txs: ScenarioTransformation[] = [{ type: "trade_value", symbol: "TSLA", action: "SELL", amount: 500 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result.cashBalance).toBe(100500);
    expect(result.holdings[1].marketValue).toBe(500); // 1000 - 500
  });

  it("SELL: rejects if amount exceeds owned", () => {
    const txs: ScenarioTransformation[] = [{ type: "trade_value", symbol: "TSLA", action: "SELL", amount: 2000 }];
    expect(() => applyTransformations(baseSnapshot, txs)).toThrowError(/Cannot sell more than owned/);
  });

  it("SELL 100%: removes holding completely", () => {
    const txs: ScenarioTransformation[] = [{ type: "trade_value", symbol: "TSLA", action: "SELL", amount: 1000 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result.cashBalance).toBe(101000);
    expect(result.holdings.length).toBe(1);
    expect(result.holdings[0].symbol).toBe("AAPL");
  });

  it("Trade percentage: sells exactly half", () => {
    const txs: ScenarioTransformation[] = [{ type: "trade_percentage", symbol: "TSLA", action: "SELL", percentage: 50 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result.cashBalance).toBe(100500);
    expect(result.holdings[1].marketValue).toBe(500);
  });

  it("Override weight: rebalances using cash", () => {
    // Total portfolio value: 100,000 (cash) + 1500 + 1000 = 102,500
    // Target TSLA weight: 0.1 (10,250)
    // Difference: 10,250 - 1000 = +9,250 (Needs to BUY 9,250)
    const txs: ScenarioTransformation[] = [{ type: "override_weight", symbol: "TSLA", newWeight: 0.1 }];
    const result = applyTransformations(baseSnapshot, txs);

    expect(result.holdings[1].marketValue).toBeCloseTo(10250);
    expect(result.cashBalance).toBeCloseTo(100000 - 9250);
  });

  it("Sequential transformations apply properly", () => {
    const txs: ScenarioTransformation[] = [
      { type: "market_shock", percentageDrop: 10 }, // TSLA goes to 900
      { type: "trade_value", symbol: "TSLA", action: "BUY", amount: 10000 } // cash goes to 90,000, TSLA goes to 10,900
    ];
    const result = applyTransformations(baseSnapshot, txs);
    expect(result.cashBalance).toBe(90000);
    expect(result.holdings[1].marketValue).toBeCloseTo(10900);
  });
});

import { calculateRiskFromSnapshot } from "./services/risk/portfolioRiskEngine";

describe("Phase 4 Scenario Engine: Immutability & Pipeline", () => {
  const baseSnapshot: PortfolioSnapshot = {
    portfolioId: 1,
    cashBalance: 5000,
    holdings: [
      { symbol: "TCS", quantity: 100, currentPrice: 3500, marketValue: 350000, weight: 0 },
    ],
    priceHistory: {
      TCS: Array.from({ length: 35 }).map((_, i) => ({
        date: `2024-01-${(i+1).toString().padStart(2, '0')}`,
        price: 3500 + (Math.random() * 100 - 50)
      }))
    }
  };

  it("calculateRiskFromSnapshot does not mutate the supplied snapshot", () => {
    // Deep clone to verify against later
    const originalClone = JSON.parse(JSON.stringify(baseSnapshot));
    
    // Perform calculation
    calculateRiskFromSnapshot(baseSnapshot);

    // Verify snapshot is strictly unmodified
    expect(baseSnapshot).toEqual(originalClone);
    
    // Explicitly verify properties that were historically mutated
    expect(baseSnapshot.holdings[0].weight).toBe(0); // Should NOT become 1.0
  });

  it("Baseline snapshot remains unchanged after full scenario pipeline", () => {
    const originalClone = JSON.parse(JSON.stringify(baseSnapshot));
    
    // 1. Calculate baseline
    calculateRiskFromSnapshot(baseSnapshot);
    
    // 2. Apply transformations
    const txs: ScenarioTransformation[] = [{ type: "market_shock", percentageDrop: 10 }];
    const hypothetical = applyTransformations(baseSnapshot, txs);
    
    // 3. Calculate hypothetical risk
    calculateRiskFromSnapshot(hypothetical);

    // Verify base is untouched
    expect(baseSnapshot).toEqual(originalClone);
  });
});
