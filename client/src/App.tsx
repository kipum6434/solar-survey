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
import SharedSurveyField from "./pages/SharedSurveyField";
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
import LineSettings from "./pages/LineSettings";
import FollowUps from "./pages/FollowUps";
import CompanySettings from "./pages/CompanySettings";
import Approvals from "./pages/Approvals";
import Finance from "./pages/Finance";
import ChecklistTemplates from "./pages/ChecklistTemplates";
import SourceManagement from "./pages/SourceManagement";

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
      <Route path={"/approvals"} component={Approvals} />
      <Route path={"/file-management"} component={FileManagement} />
      <Route path={"/installer-teams"} component={InstallerTeams} />
      <Route path={"/installer-team-report"} component={InstallerTeamReport} />
      <Route path={"/gallery"} component={Gallery} />
      <Route path={"/follow-ups"} component={FollowUps} />
      <Route path={"/line-settings"} component={LineSettings} />
      <Route path={"/company-settings"} component={CompanySettings} />
      <Route path="/finance">{() => <Finance sourceMode="tcs" />}</Route>
      <Route path="/finance/:group">{(params) => <Finance sourceMode={params.group} />}</Route>
      <Route path="/source-management" component={SourceManagement} />
      <Route path="/survey-templates" component={ChecklistTemplates} />
      <Route path="/checklist-templates" component={ChecklistTemplates} />
      <Route path="/share/:token" component={SharedSurvey} />
      <Route path="/survey-field/:token" component={SharedSurveyField} />
      <Route path="/404" component={NotFound} />
      {/* Dynamic group routes - MUST be after all specific routes to avoid catching them */}
      <Route path="/:group/dashboard" component={Customers} />
      <Route path="/:group/customers" component={Customers} />
      <Route path="/:group/customers/:id" component={CustomerDetail} />
      <Route path="/:group/surveys" component={Surveys} />
      <Route path="/:group/surveys/:id" component={SurveyDetail} />
      <Route path="/:group/follow-ups" component={FollowUps} />
      <Route path="/:group/installations" component={Installations} />
      <Route path="/:group/finance">{(params) => <Finance sourceMode={params.group} />}</Route>
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
