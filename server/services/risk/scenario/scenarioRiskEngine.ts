import { getPortfolioSnapshot, calculateRiskFromSnapshot } from "../portfolioRiskEngine";
import { applyTransformations } from "./scenarioTransforms";
import type { ScenarioRequest, ScenarioResult, ScenarioComparison } from "./scenarioTypes";

export async function analyzeScenario(
  userId: number,
  request: ScenarioRequest
): Promise<ScenarioResult> {
  // 1. Fetch DB baseline snapshot ONCE
  // In a real multi-user scenario, we'd also verify portfolioId belongs to userId.
  // getPortfolioSnapshot currently fetches by userId, so portfolioId in request is just for matching.
  const baselineSnapshot = await getPortfolioSnapshot(userId);
  
  if (baselineSnapshot.portfolioId !== request.portfolioId) {
    throw new Error("Portfolio ID mismatch or unauthorized access.");
  }

  // 2. Calculate baseline risk
  const baselineResult = calculateRiskFromSnapshot(baselineSnapshot);

  // 3. Apply transformations sequentially
  const hypotheticalSnapshot = applyTransformations(baselineSnapshot, request.transformations);

  // 4. Calculate hypothetical risk
  const hypotheticalResult = calculateRiskFromSnapshot(hypotheticalSnapshot);

  // 5. Generate Delta comparison
  const delta: ScenarioComparison = {
    valueChangeAbsolute: hypotheticalResult.totalPortfolioValue - baselineResult.totalPortfolioValue,
    valueChangePercentage: baselineResult.totalPortfolioValue > 0
      ? ((hypotheticalResult.totalPortfolioValue - baselineResult.totalPortfolioValue) / baselineResult.totalPortfolioValue) * 100
      : 0,
    riskScoreChange: hypotheticalResult.score - baselineResult.score,
    volatilityChange: (hypotheticalResult.metrics.portfolioVolatility !== null && baselineResult.metrics.portfolioVolatility !== null)
      ? (hypotheticalResult.metrics.portfolioVolatility as number) - (baselineResult.metrics.portfolioVolatility as number)
      : null,
    maxDrawdownChange: (hypotheticalResult.metrics.maxDrawdown !== null && baselineResult.metrics.maxDrawdown !== null)
      ? (hypotheticalResult.metrics.maxDrawdown as any).percentage - (baselineResult.metrics.maxDrawdown as any).percentage
      : null,
    concentrationChangeHHI: hypotheticalResult.diversification.hhi - baselineResult.diversification.hhi,
  };

  return {
    baseline: baselineResult,
    hypothetical: hypotheticalResult,
    delta,
  };
}
