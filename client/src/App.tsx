import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Lazy-loaded pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Surveys = lazy(() => import("./pages/Surveys"));
const SurveyDetail = lazy(() => import("./pages/SurveyDetail"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Notifications = lazy(() => import("./pages/Notifications"));
const SharedSurvey = lazy(() => import("./pages/SharedSurvey"));
const SharedSurveyField = lazy(() => import("./pages/SharedSurveyField"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const TeamPerformance = lazy(() => import("./pages/TeamPerformance"));
const StatusManagement = lazy(() => import("./pages/StatusManagement"));
const Installations = lazy(() => import("./pages/Installations"));
const FileManagement = lazy(() => import("./pages/FileManagement"));
const InstallerTeams = lazy(() => import("./pages/InstallerTeams"));
const InstallerTeamReport = lazy(() => import("./pages/InstallerTeamReport"));
const Gallery = lazy(() => import("./pages/Gallery"));
const LineSettings = lazy(() => import("./pages/LineSettings"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const CompanySettings = lazy(() => import("./pages/CompanySettings"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Finance = lazy(() => import("./pages/Finance"));
const ChecklistTemplates = lazy(() => import("./pages/ChecklistTemplates"));
const SurveyTemplates = lazy(() => import("./pages/SurveyTemplates"));
const SourceManagement = lazy(() => import("./pages/SourceManagement"));
const GroupDashboard = lazy(() => import("./pages/GroupDashboard"));
const SalesPerformance = lazy(() => import("./pages/SalesPerformance"));
const InstallationCalendar = lazy(() => import("./pages/InstallationCalendar"));
const TechnicalFieldSettings = lazy(() => import("./pages/TechnicalFieldSettings"));
const InstallationPrep = lazy(() => import("./pages/InstallationPrep"));
const CancelledCases = lazy(() => import("./pages/CancelledCases"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/"} component={Home} />
        <Route path={"/customers"} component={Customers} />
        <Route path={"/customers/:id"} component={CustomerDetail} />
        <Route path={"/surveys"} component={Surveys} />
        <Route path={"/surveys/:id"} component={SurveyDetail} />
        <Route path={"/team"} component={TeamManagement} />
        <Route path={"/team-performance"} component={TeamPerformance} />
        <Route path={"/sales-performance"} component={SalesPerformance} />
        <Route path={"/users"} component={UserManagement} />
        <Route path={"/calendar"} component={CalendarPage} />
        <Route path={"/installation-calendar"} component={InstallationCalendar} />
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
        <Route path="/technical-field-settings" component={TechnicalFieldSettings} />
        <Route path="/installation-prep" component={InstallationPrep} />
        <Route path="/cancelled-cases" component={CancelledCases} />
        <Route path="/survey-templates" component={SurveyTemplates} />
        <Route path="/checklist-templates" component={ChecklistTemplates} />
        <Route path="/share/:token" component={SharedSurvey} />
        <Route path="/survey-field/:token" component={SharedSurveyField} />
        <Route path="/404" component={NotFound} />
        {/* Dynamic group routes - MUST be after all specific routes to avoid catching them */}
        <Route path="/:group/dashboard" component={GroupDashboard} />
        <Route path="/:group/customers" component={Customers} />
        <Route path="/:group/customers/:id" component={CustomerDetail} />
        <Route path="/:group/surveys" component={Surveys} />
        <Route path="/:group/surveys/:id" component={SurveyDetail} />
        <Route path="/:group/follow-ups" component={FollowUps} />
        <Route path="/:group/installations" component={Installations} />
        <Route path="/:group/cancelled-cases" component={CancelledCases} />
        <Route path="/:group/finance">{(params) => <Finance sourceMode={params.group} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
