import { Bell, BookOpen, BriefcaseBusiness, ChevronDown, CircleDollarSign, Clock3, LayoutDashboard, LineChart, LogOut, Menu, Newspaper, Search, Settings2, Star, TrendingUp, WalletCards, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store/sessionStore";

const primary = [
  { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
  { label: "Markets", path: "/markets", icon: TrendingUp },
  { label: "Watchlist", path: "/watchlist", icon: Star },
  { label: "Portfolio", path: "/portfolio", icon: BriefcaseBusiness },
];
const activity = [
  { label: "Trade", path: "/trade", icon: CircleDollarSign },
  { label: "Orders", path: "/orders", icon: Clock3 },
  { label: "Transactions", path: "/transactions", icon: WalletCards },
];
const tools = [
  { label: "News", path: "/news", icon: Newspaper },
  { label: "Analytics", path: "/analytics", icon: LineChart },
  { label: "Alerts", path: "/alerts", icon: Bell },
];

export default function TradingLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, signOut } = useSessionStore();
  const active = (path: string) => location === path || (path !== "/dashboard" && location.startsWith(path));
  const NavGroup = ({ label, items }: { label: string; items: typeof primary }) => <div className="mb-6"><p className="px-3 mb-2 text-[9px] uppercase tracking-[0.24em] font-bold text-slate-400">{label}</p><div className="space-y-1">{items.map(({ label: itemLabel, path, icon: Icon }) => <Link key={path} href={path} onClick={() => setOpen(false)}><span className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${active(path) ? "bg-[#eef0ff] text-[#5867d8] font-semibold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Icon className={`h-[17px] w-[17px] ${active(path) ? "text-[#6f7cff]" : "text-slate-400 group-hover:text-slate-600"}`} />{itemLabel}</span></Link>)}</div></div>;

  return <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-slate-100 bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[76px] items-center justify-between border-b border-slate-100 px-6"><Link href="/dashboard" className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#202743] shadow-lg shadow-[#202743]/10"><LineChart className="h-5 w-5 text-[#9ba6ff]" /></div><div><p className="text-[15px] font-bold tracking-tight">vest<span className="text-[#6f7cff]">or</span></p><p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">paper terminal</p></div></Link><button onClick={() => setOpen(false)} className="lg:hidden text-slate-400"><X className="h-5 w-5" /></button></div>
      <div className="flex-1 overflow-y-auto px-4 py-7"><NavGroup label="Workspace" items={primary} /><NavGroup label="Activity" items={activity} /><NavGroup label="Insights" items={tools} /><div className="mb-6"><p className="px-3 mb-2 text-[9px] uppercase tracking-[0.24em] font-bold text-slate-400">Account</p><Link href="/settings"><span className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active("/settings") ? "bg-[#eef0ff] text-[#5867d8] font-semibold" : "text-slate-500 hover:bg-slate-50"}`}><Settings2 className="h-[17px] w-[17px] text-slate-400" />Settings</span></Link></div><div className="rounded-2xl bg-[#202743] p-4 text-white shadow-xl shadow-[#202743]/10"><div className="mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#9ba6ff]" /><span className="text-xs font-semibold">Learning mode</span></div><p className="text-[11px] leading-relaxed text-slate-300">Practice decisions with virtual money. No real trades are placed.</p><Link href="/trade"><Button className="mt-4 h-8 w-full bg-white/10 text-xs text-white hover:bg-white/20">Explore trading</Button></Link></div></div>
      <div className="border-t border-slate-100 p-4"><div className="flex items-center gap-3 rounded-xl px-2 py-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dfe3ff] text-xs font-bold text-[#5867d8]">{(user?.name || "Demo").slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{user?.name || "Demo Investor"}</p><p className="truncate text-[10px] text-slate-400">{user?.email || "demo@vestor.app"}</p></div><button aria-label="Log out" onClick={() => { signOut(); window.location.href = "/login"; }} className="text-slate-400 hover:text-rose-500"><LogOut className="h-4 w-4" /></button></div></div>
    </aside>
    {open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" />}
    <div className="lg:pl-[248px]"><header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur-xl sm:px-8"><div className="flex items-center gap-3"><button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-400 md:flex"><Search className="h-4 w-4" /><span>Search markets, orders, insights</span><kbd className="ml-10 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400">⌘ K</kbd></div><div className="flex items-center gap-2 md:hidden"><div className="h-8 w-8 rounded-lg bg-[#202743] flex items-center justify-center"><LineChart className="h-4 w-4 text-[#9ba6ff]" /></div><span className="font-bold">vestor</span></div></div><div className="flex items-center gap-3"><Badge className="hidden border-0 bg-[#fff4df] px-3 py-1.5 text-[10px] font-semibold text-[#a16e1d] sm:flex"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#e6a64a]" />Simulated market data</Badge><button className="relative rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><Bell className="h-[18px] w-[18px]" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#f26a6a]" /></button><button className="hidden items-center gap-2 rounded-xl py-1.5 pl-2 pr-1 text-left hover:bg-slate-50 sm:flex"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dfe3ff] text-[11px] font-bold text-[#5867d8]">{(user?.name || "D").slice(0, 1).toUpperCase()}</div><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button></div></header><main className="mx-auto max-w-[1440px] p-5 sm:p-8">{children}</main></div>
  </div>;
}
