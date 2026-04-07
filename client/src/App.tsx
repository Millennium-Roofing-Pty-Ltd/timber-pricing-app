import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import TimberCatalog from "@/pages/timber-catalog";
import Suppliers from "@/pages/suppliers";
import SupplierDetail from "@/pages/supplier-detail";
import History from "@/pages/history";
import Reports from "@/pages/reports";
import SystemPricing from "@/pages/system-pricing";
import Stock from "@/pages/stock";
import StockDetail from "@/pages/stock-detail";
import StockNew from "@/pages/stock-new";
import Relations from "@/pages/settings/relations";
import Behaviours from "@/pages/settings/behaviours";
import Types from "@/pages/settings/types";
import Uoms from "@/pages/settings/uoms";
import Colours from "@/pages/settings/colours";
import Variants from "@/pages/settings/variants";
import MarkupGroups from "@/pages/settings/markup-groups";
import DiscountGroups from "@/pages/settings/discount-groups";
import MarginGroups from "@/pages/settings/margin-groups";
import Tallies from "@/pages/settings/tallies";
import Properties from "@/pages/settings/properties";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SystemPricing} />
      <Route path="/timber" component={TimberCatalog} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/suppliers/:id" component={SupplierDetail} />
      <Route path="/system-pricing" component={SystemPricing} />
      <Route path="/history" component={History} />
      <Route path="/reports" component={Reports} />
      <Route path="/stock/new" component={StockNew} />
      <Route path="/stock/:id" component={StockDetail} />
      <Route path="/stock" component={Stock} />
      <Route path="/settings/relations" component={Relations} />
      <Route path="/settings/behaviours" component={Behaviours} />
      <Route path="/settings/types" component={Types} />
      <Route path="/settings/uoms" component={Uoms} />
      <Route path="/settings/colours" component={Colours} />
      <Route path="/settings/variants" component={Variants} />
      <Route path="/settings/markup-groups" component={MarkupGroups} />
      <Route path="/settings/discount-groups" component={DiscountGroups} />
      <Route path="/settings/margin-groups" component={MarginGroups} />
      <Route path="/settings/tallies" component={Tallies} />
      <Route path="/settings/properties" component={Properties} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between p-4 border-b bg-background">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto p-6">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
