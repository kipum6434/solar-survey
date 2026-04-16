import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Surveys from "./pages/Surveys";
import SurveyDetail from "./pages/SurveyDetail";
import CalendarPage from "./pages/CalendarPage";
import Notifications from "./pages/Notifications";
import SharedSurvey from "./pages/SharedSurvey";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/customers/:id"} component={CustomerDetail} />
      <Route path={"/surveys"} component={Surveys} />
      <Route path={"/surveys/:id"} component={SurveyDetail} />
      <Route path={"/calendar"} component={CalendarPage} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/share/:token"} component={SharedSurvey} />
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
