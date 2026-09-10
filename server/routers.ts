import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { developmentMarketDataProvider } from "./services/marketDataService";
import { validateQuantity, validateTradeBalance, getUserPortfolioState } from "./services/portfolioService";
import { registerUser, loginUser } from "./services/authService";
import { executeMarketOrder, getUserOrders, getUserTransactions } from "./services/tradingService";
import { DEV_NEWS, MARKET_STOCKS } from "@shared/marketData";

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const marketSearchInput = z.object({
  query: z.string().max(80).optional(),
  sector: z.string().max(80).optional(),
});

const symbolInput = z.object({
  symbol: z.string().min(1).max(16).regex(/^[A-Za-z0-9]+$/),
});

// ---------------------------------------------------------------------------
// App router
// ---------------------------------------------------------------------------

export const appRouter = router({
  system: systemRouter,

  // ═══════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          email: z.string().email().max(320),
          password: z.string().min(8).max(128),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const result = await registerUser(input.name, input.email, input.password);
        if (!result.success) return result;

        // Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, result.token, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        return result;
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          password: z.string().min(1).max(128),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const result = await loginUser(input.email, input.password);
        if (!result.success) return result;

        // Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, result.token, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        return result;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════
  // ACCOUNT
  // ═══════════════════════════════════════════════════════════════════════

  account: router({
    bootstrap: protectedProcedure.query(({ ctx }) => ({
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
      initialVirtualCash: Number(process.env.INITIAL_VIRTUAL_CASH ?? 1000000),
      dataMode: "development-simulated" as const,
    })),

    state: protectedProcedure.query(async ({ ctx }) => {
      const portfolioState = await getUserPortfolioState(ctx.user.id);
      return portfolioState;
    }),

    orders: protectedProcedure.query(async ({ ctx }) => {
      return getUserOrders(ctx.user.id);
    }),

    transactions: protectedProcedure.query(async ({ ctx }) => {
      return getUserTransactions(ctx.user.id);
    }),
  }),

  // ═══════════════════════════════════════════════════════════════════════
  // MARKET DATA
  // ═══════════════════════════════════════════════════════════════════════

  market: router({
    search: publicProcedure
      .input(marketSearchInput)
      .query(({ input }) =>
        developmentMarketDataProvider.searchStocks(
          input.query,
          input.sector === "all" ? undefined : input.sector,
        ),
      ),

    quote: publicProcedure
      .input(symbolInput)
      .query(({ input }) => developmentMarketDataProvider.getQuote(input.symbol)),

    history: publicProcedure
      .input(
        symbolInput.extend({
          range: z.enum(["1D", "1W", "1M", "6M", "1Y", "5Y"]).default("1M"),
        }),
      )
      .query(({ input }) =>
        developmentMarketDataProvider.getHistoricalPrices(input.symbol, input.range),
      ),

    sectors: publicProcedure.query(() =>
      Array.from(new Set(MARKET_STOCKS.map((stock) => stock.sector))).sort(),
    ),
  }),

  // ═══════════════════════════════════════════════════════════════════════
  // NEWS
  // ═══════════════════════════════════════════════════════════════════════

  news: router({
    list: publicProcedure
      .input(z.object({ sector: z.string().optional() }).optional())
      .query(({ input }) =>
        input?.sector
          ? DEV_NEWS.filter((item) => item.sector === input.sector)
          : DEV_NEWS,
      ),
  }),

  // ═══════════════════════════════════════════════════════════════════════
  // TRADING
  // ═══════════════════════════════════════════════════════════════════════

  trading: router({
    validate: protectedProcedure
      .input(
        z.object({
          symbol: symbolInput.shape.symbol,
          side: z.enum(["BUY", "SELL"]),
          quantity: z.number().positive(),
        }),
      )
      .mutation(({ input }) => {
        validateQuantity(input.quantity);
        const quote = MARKET_STOCKS.find(
          (stock) => stock.symbol === input.symbol.toUpperCase(),
        );
        if (!quote) throw new Error("Stock is not available in the development provider");
        return {
          valid: true,
          symbol: quote.symbol,
          side: input.side,
          quantity: input.quantity,
          price: quote.price,
          estimatedTotal: quote.price * input.quantity,
        };
      }),

    execute: protectedProcedure
      .input(
        z.object({
          symbol: symbolInput.shape.symbol,
          side: z.enum(["BUY", "SELL"]),
          quantity: z.number().positive(),
          idempotencyKey: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        validateQuantity(input.quantity);
        const result = await executeMarketOrder(
          ctx.user.id,
          input.symbol,
          input.side,
          input.quantity,
          input.idempotencyKey,
        );
        if (!result.success) {
          throw new Error(result.error);
        }
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
