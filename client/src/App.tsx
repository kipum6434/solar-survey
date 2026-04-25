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
import TeamManagement from "./pages/TeamManagement";
import UserManagement from "./pages/UserManagement";
import TeamPerformance from "./pages/TeamPerformance";
import Login from "./pages/Login";
import StatusManagement from "./pages/StatusManagement";
import Installations from "./pages/Installations";
import FileManagement from "./pages/FileManagement";
import InstallerTeams from "./pages/InstallerTeams";
import InstallerTeamReport from "./pages/InstallerTeamReport";
import Gallery from "./pages/Gallery";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"} component={Home} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/customers/:id"} component={CustomerDetail} />
      <Route path={"/surveys"} component={Surveys} />
      <Route path={"/surveys/:id"} component={SurveyDetail} />
      <Route path={"/team"} component={TeamManagement} />
      <Route path={"/team-performance"} component={TeamPerformance} />
      <Route path={"/users"} component={UserManagement} />
      <Route path={"/calendar"} component={CalendarPage} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/status-management"} component={StatusManagement} />
      <Route path={"/installations"} component={Installations} />
      <Route path={"/file-management"} component={FileManagement} />
      <Route path={"/installer-teams"} component={InstallerTeams} />
      <Route path={"/installer-team-report"} component={InstallerTeamReport} />
      <Route path={"/gallery"} component={Gallery} />
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
