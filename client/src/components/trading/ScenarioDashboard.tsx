import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, formatNumber, formatSigned } from "@/utils/format";
// We use any for riskData and scenario transformations to simplify for V1
import { SectionHeading } from "./TradingWidgets";

export function ScenarioDashboard({ portfolioId }: { portfolioId: number }) {
  const [scenarioType, setScenarioType] = useState<string>("market_shock");
  const [percentage, setPercentage] = useState<string>("10");
  const [symbol, setSymbol] = useState<string>("");

  const scenarioMutation = trpc.risk.scenario.useMutation();

  const handleRunScenario = () => {
    let transformation: any = null;
    if (scenarioType === "market_shock") {
      transformation = { type: "market_shock", percentageDrop: Number(percentage) };
    } else if (scenarioType === "asset_shock") {
      transformation = { type: "asset_shock", symbol, percentageDrop: Number(percentage) };
    } else if (scenarioType === "trade_value") {
      transformation = { type: "trade_value", symbol, action: "BUY", amount: Number(percentage) };
    }

    if (transformation) {
      scenarioMutation.mutate({
        portfolioId,
        transformations: [transformation],
      });
    }
  };

  const result = scenarioMutation.data;

  return (
    <Card className="border-0 shadow-lg mt-8">
      <CardHeader>
        <CardTitle className="text-xl">What-If Scenario Analysis</CardTitle>
        <p className="text-sm text-slate-500">Test hypothetical changes to your portfolio instantly without real-money risk.</p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 items-end mb-8">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Scenario Type</label>
            <Select value={scenarioType} onValueChange={setScenarioType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market_shock">Market Shock</SelectItem>
                <SelectItem value="asset_shock">Asset Shock</SelectItem>
                <SelectItem value="trade_value">Hypothetical Buy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(scenarioType === "asset_shock" || scenarioType === "trade_value") && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Symbol</label>
              <Input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="e.g. RELIANCE" className="w-[120px]" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              {scenarioType === "trade_value" ? "Amount (₹)" : "Percentage (%)"}
            </label>
            <Input value={percentage} onChange={e => setPercentage(e.target.value)} type="number" className="w-[120px]" />
          </div>
          <Button onClick={handleRunScenario} disabled={scenarioMutation.isPending} className="bg-[#6f7cff] hover:bg-[#5968df]">
            {scenarioMutation.isPending ? "Analyzing..." : "Run Scenario"}
          </Button>
        </div>

        {scenarioMutation.error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium">
            Error: {scenarioMutation.error.message}
          </div>
        )}

        {result && (
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Value Impact</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {formatINR(result.hypothetical.totalPortfolioValue)}
              </p>
              <p className={`text-sm font-medium mt-1 ${result.delta.valueChangeAbsolute >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {formatSigned(result.delta.valueChangeAbsolute)} ({formatSigned(result.delta.valueChangePercentage)}%)
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Risk Score</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {result.hypothetical.score}
              </p>
              <p className="text-sm font-medium mt-1 text-slate-500">
                Delta: {formatSigned(result.delta.riskScoreChange)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Volatility</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {result.hypothetical.metrics.portfolioVolatility ? (result.hypothetical.metrics.portfolioVolatility * 100).toFixed(1) + "%" : "N/A"}
              </p>
              <p className="text-sm font-medium mt-1 text-slate-500">
                Delta: {result.delta.volatilityChange ? formatSigned(result.delta.volatilityChange * 100) + "%" : "N/A"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
