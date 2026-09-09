import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import TradingLayout from "./components/TradingLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Markets from "./pages/Markets";
import StockDetail from "./pages/StockDetail";
import Portfolio from "./pages/Portfolio";
import Trade from "./pages/Trade";
import Activity from "./pages/Activity";
import Watchlist from "./pages/Watchlist";
import News from "./pages/News";
import Alerts from "./pages/Alerts";
import SimplePage from "./pages/SimplePage";
import { useSessionStore } from "./store/sessionStore";

function Protected({ children }: { children: React.ReactNode }) {
  const user = useSessionStore((state) => state.user);
  return user ? <TradingLayout>{children}</TradingLayout> : <Redirect to="/login" />;
}

function AppRoutes() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/login"><Auth mode="login" /></Route>
    <Route path="/register"><Auth mode="register" /></Route>
    <Route path="/dashboard"><Protected><Dashboard /></Protected></Route>
    <Route path="/markets"><Protected><Markets /></Protected></Route>
    <Route path="/stocks/:symbol"><Protected><StockDetail /></Protected></Route>
    <Route path="/portfolio"><Protected><Portfolio /></Protected></Route>
    <Route path="/trade"><Protected><Trade /></Protected></Route>
    <Route path="/orders"><Protected><Activity type="orders" /></Protected></Route>
    <Route path="/transactions"><Protected><Activity type="transactions" /></Protected></Route>
    <Route path="/watchlist"><Protected><Watchlist /></Protected></Route>
    <Route path="/news"><Protected><News /></Protected></Route>
    <Route path="/alerts"><Protected><Alerts /></Protected></Route>
    <Route path="/analytics"><Protected><SimplePage title="Analytics" eyebrow="Next version" copy="Risk scores, correlation analysis, stress testing, and deeper portfolio intelligence will arrive in the next engineering phase." icon="chart" /></Protected></Route>
    <Route path="/settings"><Protected><SimplePage title="Settings" eyebrow="Account" copy="Profile, preferences, and notification controls are planned for the next release. Your demo session is stored locally for this review." icon="settings" /></Protected></Route>
    <Route><Redirect to="/" /></Route>
  </Switch>;
}

export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><AppRoutes /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
