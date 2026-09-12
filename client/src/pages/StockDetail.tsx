import { ArrowLeft, BellPlus, ChartNoAxesCombined, ChevronDown, ShieldAlert, Star, StarOff, TrendingDown, TrendingUp, Info as InfoIcon, AlertTriangle, CheckCircle2, XCircle, Activity, BarChart3 } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceChart } from "@/components/trading/TradingWidgets";
import { generateHistory, getStock } from "@shared/marketData";
import { trpc } from "@/lib/trpc";
import { formatINR, formatNumber } from "@/utils/format";

export default function StockDetail() {
  const [, params] = useRoute("/stocks/:symbol");
  const symbol = params?.symbol?.toUpperCase() ?? "TCS";
  const stock = getStock(symbol) ?? getStock("TCS")!;
  const [range, setRange] = useState("1M");
  
  const utils = trpc.useUtils();
  const { data: watchlist = [] } = trpc.account.watchlist.useQuery();
  const addToWatchlist = trpc.account.addToWatchlist.useMutation({ onSuccess: () => utils.account.watchlist.invalidate() });
  const removeFromWatchlist = trpc.account.removeFromWatchlist.useMutation({ onSuccess: () => utils.account.watchlist.invalidate() });
  
  // Risk analysis query
  const { data: riskData, isLoading: riskLoading, error: riskError } = trpc.risk.stock.useQuery(
    { symbol: stock.symbol },
    { retry: false, staleTime: 60_000 },
  );

  const isWatching = watchlist.includes(stock.symbol);
  const change = stock.price - stock.previousClose;
  const history = useMemo(
    () => generateHistory(stock, { "1D": 24, "1W": 14, "1M": 30, "6M": 42, "1Y": 52, "5Y": 60 }[range] ?? 30),
    [stock, range],
  );

  return (
    <div className="space-y-7">
      <Link href="/markets" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" />Back to markets
      </Link>

      {/* Header */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-base font-bold" style={{ background: `${stock.accent}1b`, color: stock.accent }}>
            {stock.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-[#202743]">{stock.companyName}</h1>
              <Badge className="border-0 bg-slate-100 text-[10px] text-slate-500">{stock.exchange}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{stock.symbol} · {stock.sector} · {stock.industry}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => isWatching ? removeFromWatchlist.mutate({ symbol: stock.symbol }) : addToWatchlist.mutate({ symbol: stock.symbol })} className={`flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${isWatching ? "bg-[#e6a64a]/10 text-[#e6a64a] hover:bg-[#e6a64a]/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            <Star className={`h-4 w-4 ${isWatching ? "fill-current" : ""}`} />{isWatching ? "Watching" : "Watch"}
          </button>
          <Link href={`/trade?symbol=${stock.symbol}`}>
            <Button className="rounded-xl bg-[#6f7cff] text-xs shadow-lg shadow-[#6f7cff]/20 hover:bg-[#5968df]">Trade {stock.symbol}</Button>
          </Link>
        </div>
      </div>

      {/* Chart + Market Info */}
      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.8fr]">
        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <div className="flex items-baseline gap-3">
                <CardTitle className="text-3xl">{formatINR(stock.price)}</CardTitle>
                <span className={`flex items-center text-sm font-semibold ${change >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {change >= 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                  {change >= 0 ? "+" : ""}{change.toFixed(2)} ({((change / stock.previousClose) * 100).toFixed(2)}%)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">As of 24 Jun 2026, 15:30 IST · Development quote</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1">
              {["1D", "1W", "1M", "6M", "1Y", "5Y"].map((item) => (
                <button key={item} onClick={() => setRange(item)} className={`rounded-md px-2 py-1.5 text-[10px] font-semibold ${range === item ? "bg-white text-[#6f7cff] shadow-sm" : "text-slate-400"}`}>{item}</button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <PriceChart data={history} positive={change >= 0} height={320} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
            <CardHeader><CardTitle className="text-base">Market information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-5 text-xs">
              <MetricInfo label="Day high" value={formatINR(stock.dayHigh)} />
              <MetricInfo label="Day low" value={formatINR(stock.dayLow)} />
              <MetricInfo label="52-week high" value={formatINR(stock.week52High)} />
              <MetricInfo label="52-week low" value={formatINR(stock.week52Low)} />
              <MetricInfo label="Volume" value={formatNumber(stock.volume)} />
              <MetricInfo label="Market cap" value={stock.marketCap} />
            </CardContent>
          </Card>
          <Card className="border-0 bg-[#202743] text-white shadow-[0_12px_40px_rgba(25,31,54,0.12)]">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[#9ba6ff]">
                <ChartNoAxesCombined className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Paper signal</span>
              </div>
              <p className="mt-3 text-sm font-semibold">This is a development quote, not investment advice.</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">Use it to learn the workflow: research → decide → paper trade → review.</p>
              <Link href={`/trade?symbol=${stock.symbol}`}>
                <Button className="mt-4 h-9 w-full bg-white/10 text-xs text-white hover:bg-white/20">Open order ticket <ChevronDown className="ml-2 h-3.5 w-3.5 -rotate-90" /></Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ Risk Analysis Section ═══ */}
      <RiskAnalysis data={riskData} loading={riskLoading} error={riskError} />

      {/* Alert CTA */}
      <Card className="border-0 bg-[#fff4df] shadow-none">
        <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <BellPlus className="h-5 w-5 text-[#b17a21]" />
            <div>
              <p className="text-xs font-semibold text-[#7e5c20]">Want to keep an eye on {stock.symbol}?</p>
              <p className="text-[11px] text-[#a58245]">Create a basic price alert from the Alerts page.</p>
            </div>
          </div>
          <Link href="/alerts">
            <Button variant="outline" className="border-[#e9c987] bg-transparent text-xs text-[#8a6728]">Set alert</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Risk Analysis Component
// ───────────────────────────────────────────────────────────────────────────

function RiskAnalysis({ data, loading, error }: { data: any; loading: boolean; error: any }) {
  if (loading) {
    return (
      <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Activity className="h-6 w-6 animate-pulse text-[#6f7cff]" />
            <p className="text-sm text-slate-400">Calculating risk metrics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[#6f7cff]" />
            <CardTitle className="text-lg">Risk Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-xs font-semibold text-amber-700">Risk analysis unavailable</p>
              <p className="mt-1 text-[11px] text-amber-600">
                {error?.message || "Historical data may not yet be seeded. Risk metrics require a database connection and seeded market data."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scoreColor = data.score <= 20 ? "#22c55e" : data.score <= 40 ? "#47c1a3" : data.score <= 60 ? "#e6a64a" : data.score <= 80 ? "#f97316" : "#ef4444";

  return (
    <div className="space-y-4">
      {/* Score Header */}
      <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#6f7cff]" />
              <CardTitle className="text-lg">Risk Analysis</CardTitle>
            </div>
            <Badge className="border-0 bg-[#f1f3ff] text-[10px] font-semibold text-[#6f7cff]">Deterministic Engine</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            {/* Score Gauge */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full" style={{ background: `conic-gradient(${scoreColor} ${data.score * 3.6}deg, #f1f5f9 0deg)` }}>
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-3xl font-bold text-[#202743]">{data.score}</span>
                  <span className="text-[10px] text-slate-400">/ 100</span>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold" style={{ color: scoreColor }}>{data.classification}</p>
            </div>

            {/* Components Breakdown */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Score components</p>
              {data.components.map((comp: any) => (
                <div key={comp.name} className="flex items-center gap-3">
                  <div className="w-[120px] shrink-0">
                    <p className="text-xs font-medium text-slate-700">{comp.name}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: comp.available ? `${Math.min(comp.rawScore, 100)}%` : "0%",
                          backgroundColor: comp.available
                            ? comp.rawScore > 70 ? "#ef4444" : comp.rawScore > 40 ? "#f97316" : comp.rawScore > 20 ? "#e6a64a" : "#22c55e"
                            : "#e2e8f0",
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-14 text-right">
                    {comp.available ? (
                      <span className="text-xs font-semibold text-slate-700">{comp.rawScore.toFixed(0)}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400">N/A</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Volatility"
          value={data.metrics.volatility ? `${(data.metrics.volatility.annualizedVolatility * 100).toFixed(1)}%` : null}
          subtitle="Annualized"
          detail={data.metrics.volatility ? `${data.metrics.volatility.observationCount} observations, ${data.metrics.volatility.frequency}` : undefined}
        />
        <MetricCard
          title="Max Drawdown"
          value={data.metrics.maxDrawdown ? `${data.metrics.maxDrawdown.maxDrawdownPercent.toFixed(1)}%` : null}
          subtitle="Peak to trough"
          detail={data.metrics.maxDrawdown ? `Peak: ${formatINR(data.metrics.maxDrawdown.peakPrice)} → Trough: ${formatINR(data.metrics.maxDrawdown.troughPrice)}` : undefined}
        />
        <MetricCard
          title="Sharpe Ratio"
          value={data.metrics.sharpe ? data.metrics.sharpe.sharpeRatio.toFixed(2) : null}
          subtitle={data.metrics.sharpe ? `Rf: ${(data.metrics.sharpe.riskFreeRate * 100).toFixed(1)}%` : "Risk-adjusted return"}
        />
        <MetricCard
          title="Sortino Ratio"
          value={data.metrics.sortino ? data.metrics.sortino.sortinoRatio.toFixed(2) : null}
          subtitle="Downside risk-adjusted"
          detail={data.metrics.sortino ? `Downside dev: ${(data.metrics.sortino.downsideDeviation * 100).toFixed(1)}%` : undefined}
        />
        <MetricCard
          title="Value at Risk"
          value={data.metrics.var ? `${data.metrics.var.varPercent.toFixed(2)}%` : null}
          subtitle={data.metrics.var ? `${(data.metrics.var.confidenceLevel * 100).toFixed(0)}% confidence, daily` : "Historical VaR"}
          detail={data.metrics.cvar ? `CVaR: ${data.metrics.cvar.cvarPercent.toFixed(2)}%` : undefined}
        />
        <MetricCard
          title="Beta"
          value={data.metrics.beta ? data.metrics.beta.beta.toFixed(2) : null}
          subtitle="Market sensitivity"
          unavailableReason="No benchmark index available"
        />
      </div>

      {/* Explanations + Data Quality */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Explanations */}
        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#6f7cff]" />
              <CardTitle className="text-sm">Risk Interpretation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.explanations.map((text: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f1f3ff] text-[8px] font-bold text-[#6f7cff]">{i + 1}</span>
                <p className="text-xs leading-5 text-slate-600">{text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Data Quality */}
        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4 text-slate-400" />
              <CardTitle className="text-sm">Data Quality</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <MetricInfo label="Observations" value={String(data.dataQuality.observationCount)} />
              <MetricInfo label="Frequency" value={data.dataQuality.frequency} />
              <MetricInfo label="Start date" value={data.dataQuality.startDate || "N/A"} />
              <MetricInfo label="End date" value={data.dataQuality.endDate || "N/A"} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              {data.dataQuality.sufficientHistory ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-[11px] text-slate-600">Sufficient history for reliable analysis</span></>
              ) : (
                <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /><span className="text-[11px] text-amber-700">Limited history may reduce reliability</span></>
              )}
            </div>
            {data.dataQuality.unavailableMetrics.length > 0 && (
              <div className="space-y-1.5">
                {data.dataQuality.unavailableMetrics.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                    <p className="text-[10px] text-slate-500"><span className="font-semibold">{item.metric}:</span> {item.reason}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-dashed border-slate-200 p-3">
              <p className="text-[10px] font-semibold text-slate-500">Data source</p>
              <p className="mt-1 text-[10px] text-slate-400">{data.assumptions.dataSource}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Metric Card
// ───────────────────────────────────────────────────────────────────────────

function MetricCard({ title, value, subtitle, detail, unavailableReason }: {
  title: string;
  value: string | null;
  subtitle: string;
  detail?: string;
  unavailableReason?: string;
}) {
  return (
    <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
      <CardContent className="p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{title}</p>
        {value !== null ? (
          <>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[#202743]">{value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
            {detail && <p className="mt-2 text-[10px] text-slate-400">{detail}</p>}
          </>
        ) : (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-500">Not available</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{unavailableReason || "Insufficient data for this metric."}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-700">{value}</p>
    </div>
  );
}
