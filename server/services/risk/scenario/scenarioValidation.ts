import { z } from "zod";

export const marketShockSchema = z.object({
  type: z.literal("market_shock"),
  percentageDrop: z.number().min(0).max(100),
});

export const assetShockSchema = z.object({
  type: z.literal("asset_shock"),
  symbol: z.string().min(1),
  percentageDrop: z.number().min(0).max(100),
});

export const tradeValueSchema = z.object({
  type: z.literal("trade_value"),
  symbol: z.string().min(1),
  action: z.enum(["BUY", "SELL"]),
  amount: z.number().positive(),
});

export const tradePercentageSchema = z.object({
  type: z.literal("trade_percentage"),
  symbol: z.string().min(1),
  action: z.literal("SELL"),
  percentage: z.number().positive().max(100),
});

export const overrideWeightSchema = z.object({
  type: z.literal("override_weight"),
  symbol: z.string().min(1),
  newWeight: z.number().min(0).max(1),
});

export const scenarioTransformationSchema = z.discriminatedUnion("type", [
  marketShockSchema,
  assetShockSchema,
  tradeValueSchema,
  tradePercentageSchema,
  overrideWeightSchema,
]);

export const scenarioRequestSchema = z.object({
  portfolioId: z.number().positive(),
  transformations: z.array(scenarioTransformationSchema),
});
