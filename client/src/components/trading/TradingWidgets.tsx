import { ArrowDownRight, ArrowUpRight, CircleHelp, Sparkles } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PricePoint } from "@shared/marketData";

export function MetricCard({ label, value, change, accent = "blue", hint }: { label: string; value: string; change?: string; accent?: "blue" | "green" | "purple" | "amber"; hint?: string }) {
  const accentClasses = { blue: "bg-[#6f7cff]", green: "bg-[#47c1a3]", purple: "bg-[#a981e7]", amber: "bg-[#e6a64a]" };
  return <Card className="border-0 shadow-[0_12px_40px_rgba(25,31,54,0.05)] overflow-hidden relative">
    <div className={cn("absolute top-0 left-0 right-0 h-1", accentClasses[accent])} />
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3"><p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">{label}</p>{hint && <CircleHelp className="h-4 w-4 text-muted-foreground" />}</div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {change && <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold", change.startsWith("+") ? "text-emerald-600" : "text-rose-500")}>
        {change.startsWith("+") ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{change}
      </div>}
    </CardContent>
  </Card>;
}

export function PriceChart({ data, positive = true, height = 240 }: { data: PricePoint[]; positive?: boolean; height?: number }) {
  const color = positive ? "#47c1a3" : "#f26a6a";
  return <div style={{ height }} className="w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
        <defs><linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.25} /><stop offset="100%" stopColor={color} stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} tickLine={false} axisLine={false} tick={{ fill: "#9aa1b1", fontSize: 10 }} minTickGap={28} />
        <YAxis domain={["dataMin - 50", "dataMax + 50"]} tickLine={false} axisLine={false} tick={{ fill: "#9aa1b1", fontSize: 10 }} tickFormatter={(value) => `₹${Math.round(value)}`} />
        <Tooltip formatter={(value: number) => [`₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, "Price"]} labelFormatter={(value) => new Date(value).toLocaleDateString("en-IN")} contentStyle={{ borderRadius: 12, border: "1px solid #edf0f4", boxShadow: "0 10px 24px rgba(25,31,54,.08)" }} />
        <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2.5} fill="url(#priceGradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function AllocationChart({ items }: { items: Array<{ symbol: string; value: number; color: string }> }) {
  return <div className="h-[220px] w-full relative"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={items} dataKey="value" nameKey="symbol" innerRadius={68} outerRadius={92} paddingAngle={4} stroke="none">{items.map((item) => <Cell key={item.symbol} fill={item.color} />)}</Pie><Tooltip formatter={(value: number) => [`₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, "Value"]} /></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><Sparkles className="h-4 w-4 text-[#a981e7] mb-1" /><span className="text-lg font-semibold text-slate-900">Allocation</span><span className="text-[10px] uppercase tracking-widest text-muted-foreground">portfolio mix</span></div></div>;
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="flex items-end justify-between gap-4 mb-5"><div>{eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7b8cff] mb-1">{eyebrow}</p>}<h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2></div>{action}</div>;
}
