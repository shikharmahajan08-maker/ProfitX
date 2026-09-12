import { AlertTriangle, Activity, Info, BarChart3, TrendingDown, Target, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Component for displaying Portfolio Risk Engine output
export function PortfolioRiskDashboard({ riskData }: { riskData: any }) {
  if (!riskData || riskData.holdings.length === 0) {
    return (
      <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
        <CardContent className="flex h-40 flex-col items-center justify-center text-center">
          <Activity className="h-8 w-8 text-slate-300" />
          <p className="mt-4 text-sm font-semibold text-slate-700">No Risk Data</p>
          <p className="mt-1 text-xs text-slate-500">Add holdings to see your portfolio risk profile.</p>
        </CardContent>
      </Card>
    );
  }

  const { score, classification, metrics, contributions, diversification, stressTests, explanations, dataQuality, cashBalance, totalPortfolioValue, cashWeight, investedWeight } = riskData;

  const isInsufficient = !dataQuality.hasSufficientData;

  return (
    <div className="space-y-6">
      <SectionHeading title="Portfolio Risk Engine" subtitle="Deterministic risk analysis based on historical asset variance and correlations." />

      {isInsufficient && (
        <div className="rounded-lg bg-amber-50 p-4 border border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Engine Paused: Insufficient Data
          </div>
          <p className="text-sm text-amber-700">
            {explanations[0] || dataQuality.warnings[0]}
          </p>
        </div>
      )}

      {/* Main Score & Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)] md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-500">RISK SCORE</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[8px] border-slate-50" style={{ borderColor: `${classification.hex}20` }}>
              <div className="absolute inset-0 rounded-full border-[8px] border-transparent" style={{ borderTopColor: classification.hex, borderRightColor: score > 50 ? classification.hex : 'transparent', transform: 'rotate(-45deg)' }} />
              <div className="text-center">
                <span className="text-4xl font-bold tracking-tighter text-slate-800">{score}</span>
                <span className="block text-[10px] font-semibold text-slate-400">/ 100</span>
              </div>
            </div>
            <div className={`mt-4 rounded-full px-3 py-1 text-xs font-bold ${classification.color}`} style={{ backgroundColor: `${classification.hex}15` }}>
              {classification.label}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)] md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-500">AGGREGATE METRICS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <RiskMetric label="Volatility" value={metrics.portfolioVolatility ? `${(metrics.portfolioVolatility * 100).toFixed(2)}%` : "N/A"} icon={<Activity className="h-4 w-4" />} />
              <RiskMetric label="Max Drawdown" value={metrics.maxDrawdown ? `${metrics.maxDrawdown.maxDrawdownPercent.toFixed(2)}%` : "N/A"} icon={<TrendingDown className="h-4 w-4" />} />
              <RiskMetric label="Sharpe Ratio" value={metrics.sharpe ? metrics.sharpe.sharpeRatio.toFixed(2) : "N/A"} icon={<Target className="h-4 w-4" />} />
              <RiskMetric label="VaR (95%)" value={metrics.var ? `${metrics.var.varPercent.toFixed(2)}%` : "N/A"} icon={<AlertTriangle className="h-4 w-4" />} />
            </div>
            
            <div className="mt-6 rounded-lg bg-slate-50 p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Engine Insights</h4>
              <ul className="space-y-1">
                {explanations.map((exp: string, i: number) => (
                  <li key={i} className="flex items-start text-xs text-slate-700">
                    <Info className="mr-2 mt-0.5 h-3 w-3 shrink-0 text-[#6f7cff]" />
                    {exp}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Risk Contributors */}
        <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <BarChart3 className="h-4 w-4" /> RISK CONTRIBUTORS
            </CardTitle>
            <CardDescription className="text-xs">Percentage contribution to total portfolio risk. Cash ({cashWeight ? (cashWeight * 100).toFixed(1) : 0}%) acts as a zero-volatility buffer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contributions.sort((a: any, b: any) => b.percentageRiskContribution - a.percentageRiskContribution).map((c: any) => (
              <div key={c.symbol} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">{c.symbol}</span>
                  <span className="font-medium text-slate-500">{c.percentageRiskContribution.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-rose-400" style={{ width: `${Math.min(100, c.percentageRiskContribution)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Weight: {(c.weight * 100).toFixed(1)}%</span>
                  <span>Standalone Vol: {c.standaloneVolatility.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Diversification & Stress Test */}
        <div className="space-y-6">
          <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-500">DIVERSIFICATION</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <RiskMetric label="Holdings" value={diversification.numberOfHoldings} />
                <RiskMetric label="Effective Holdings" value={diversification.effectiveNumberOfHoldings.toFixed(1)} />
                <RiskMetric label="HHI (Concentration)" value={diversification.hhi.toFixed(2)} />
                <RiskMetric label="Top 3 Conc." value={`${(diversification.top3Concentration * 100).toFixed(1)}%`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Zap className="h-4 w-4 text-amber-500" /> STRESS TESTS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stressTests.map((test: any) => (
                <div key={test.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{test.name}</p>
                    <p className="text-[10px] text-slate-500">{test.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-rose-500">-{test.percentageLoss.toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-400">₹{test.absoluteLoss.toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {dataQuality && dataQuality.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-4 text-xs text-amber-800">
          <strong>Data Quality Warning:</strong> {dataQuality.warnings[0]}
        </div>
      )}
      <p className="text-center text-[10px] text-slate-400">Risk analysis uses deterministic simulated market data.</p>
    </div>
  );
}

function RiskMetric({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
        {icon} {label}
      </span>
      <span className="mt-1 text-lg font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold tracking-tight text-slate-800">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
