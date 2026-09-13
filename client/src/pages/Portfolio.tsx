import {
  ArrowRight,
  BriefcaseBusiness,
  PieChart as PieIcon,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AllocationChart,
  MetricCard,
  SectionHeading,
} from "@/components/trading/TradingWidgets";
import { calculateHoldingMetrics } from "@shared/trading";
import { getStock } from "@shared/marketData";
import { trpc } from "@/lib/trpc";
import { formatINR, formatNumber, formatSigned } from "@/utils/format";
import { PortfolioRiskDashboard } from "@/components/trading/PortfolioRiskDashboard";
import { ScenarioDashboard } from "@/components/trading/ScenarioDashboard";

export default function Portfolio() {
  const { data: portfolio } = trpc.account.state.useQuery();
  const cashBalance = portfolio?.cashBalance ?? 0;
  const holdings = portfolio?.holdings ?? [];

  const { data: riskData } = trpc.risk.portfolio.useQuery();

  const details = holdings
    .map(holding => {
      const stock = getStock(holding.symbol)!;
      return {
        ...holding,
        stock,
        metrics: calculateHoldingMetrics(holding, stock.price),
      };
    })
    .filter(item => item.stock);
  const invested = details.reduce(
    (sum, item) => sum + item.metrics.investedValue,
    0
  );
  const current = details.reduce(
    (sum, item) => sum + item.metrics.currentValue,
    0
  );
  const pnl = current - invested;
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6f7cff]">
            Your positions
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#202743]">
            Portfolio
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A transparent view of holdings and derived performance.
          </p>
        </div>
        <Link href="/trade">
          <Button className="rounded-xl bg-[#6f7cff] text-xs shadow-lg shadow-[#6f7cff]/20 hover:bg-[#5968df]">
            Trade a stock <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Portfolio value"
          value={formatINR(cashBalance + current)}
          accent="blue"
        />
        <MetricCard
          label="Cash"
          value={formatINR(cashBalance)}
          accent="green"
        />
        <MetricCard
          label="Invested"
          value={formatINR(invested)}
          accent="purple"
        />
        <MetricCard
          label="Unrealized P&L"
          value={formatINR(pnl)}
          change={`${invested ? ((pnl / invested) * 100).toFixed(2) : "0.00"}% return`}
          accent="amber"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">
        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">Holdings</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-y border-slate-100 bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Stock</th>
                    <th className="py-3">Qty</th>
                    <th className="py-3">Average buy</th>
                    <th className="py-3">Current price</th>
                    <th className="py-3">Invested</th>
                    <th className="py-3">Current value</th>
                    <th className="px-6 py-3 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {details.length ? (
                    details.map(item => (
                      <tr
                        key={item.symbol}
                        className="border-b border-slate-50"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/stocks/${item.symbol}`}
                            className="flex items-center gap-3"
                          >
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold"
                              style={{
                                background: `${item.stock.accent}20`,
                                color: item.stock.accent,
                              }}
                            >
                              {item.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">
                                {item.symbol}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {item.stock.companyName}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="py-4 text-slate-600">
                          {formatNumber(item.quantity)}
                        </td>
                        <td className="py-4 text-slate-600">
                          {formatINR(item.averageBuyPrice)}
                        </td>
                        <td className="py-4 font-semibold text-slate-700">
                          {formatINR(item.stock.price)}
                        </td>
                        <td className="py-4 text-slate-600">
                          {formatINR(item.metrics.investedValue)}
                        </td>
                        <td className="py-4 text-slate-600">
                          {formatINR(item.metrics.currentValue)}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-semibold ${item.metrics.unrealizedPnl >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                        >
                          {formatSigned(item.metrics.unrealizedPnl)}
                          <span className="block text-[10px] font-normal">
                            {item.metrics.returnPercentage.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          No holdings yet
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Place your first paper trade to see the position here.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-[#6f7cff]" />
              <CardTitle className="text-lg">Allocation</CardTitle>
            </div>
            <p className="text-xs text-slate-400">
              Current value by stock. This is allocation, not risk contribution.
            </p>
          </CardHeader>
          <CardContent>
            {details.length ? (
              <AllocationChart
                items={details.map(item => ({
                  symbol: item.symbol,
                  value: item.metrics.currentValue,
                  color: item.stock.accent,
                }))}
              />
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Nothing to allocate
                </p>
                <p className="mt-1 max-w-[220px] text-xs leading-5 text-slate-400">
                  Your allocation will appear after you own a stock.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-12">
        {riskData && <PortfolioRiskDashboard riskData={riskData} />}
      </div>
      
      <div className="mt-8">
        {riskData?.portfolioId && <ScenarioDashboard portfolioId={riskData.portfolioId} />}
      </div>
    </div>
  );
}
