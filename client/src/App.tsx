import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Connections from "./pages/Connections";
import ImportWizard from "./pages/ImportWizard";
import ImportHistory from "./pages/ImportHistory";
import DataCleanup from "./pages/DataCleanup";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/connections"} component={Connections} />
      <Route path={"/import"} component={ImportWizard} />
      <Route path={"/history"} component={ImportHistory} />
      <Route path={"/cleanup"} component={DataCleanup} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
