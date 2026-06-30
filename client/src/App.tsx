import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Retry wrapper for dynamic imports - handles stale chunk errors after deploy
function lazyRetry(importFn: () => Promise<any>, retries = 2): ReturnType<typeof lazy> {
  return lazy(() =>
    importFn().catch((error: any) => {
      if (retries > 0 && (error?.message?.includes('Failed to fetch dynamically imported module') || error?.message?.includes('Loading chunk'))) {
        // Clear module cache by appending timestamp to force fresh fetch
        return new Promise<any>((resolve) => {
          setTimeout(() => resolve(lazyRetry(importFn, retries - 1)), 500);
        }).then((mod: any) => mod);
      }
      // If retries exhausted, force reload the page to get fresh assets
      if (error?.message?.includes('Failed to fetch dynamically imported module') || error?.message?.includes('Loading chunk')) {
        window.location.reload();
      }
      throw error;
    })
  );
}

// Lazy-loaded pages for code splitting (with retry for stale chunks)
const Home = lazyRetry(() => import("./pages/Home"));
const Login = lazyRetry(() => import("./pages/Login"));
const Customers = lazyRetry(() => import("./pages/Customers"));
const CustomerDetail = lazyRetry(() => import("./pages/CustomerDetail"));
const Surveys = lazyRetry(() => import("./pages/Surveys"));
const SurveyDetail = lazyRetry(() => import("./pages/SurveyDetail"));
const CalendarPage = lazyRetry(() => import("./pages/CalendarPage"));
const Notifications = lazyRetry(() => import("./pages/Notifications"));
const SharedSurvey = lazyRetry(() => import("./pages/SharedSurvey"));
const SharedSurveyField = lazyRetry(() => import("./pages/SharedSurveyField"));
const TeamManagement = lazyRetry(() => import("./pages/TeamManagement"));
const UserManagement = lazyRetry(() => import("./pages/UserManagement"));
const TeamPerformance = lazyRetry(() => import("./pages/TeamPerformance"));
const StatusManagement = lazyRetry(() => import("./pages/StatusManagement"));
const Installations = lazyRetry(() => import("./pages/Installations"));
const FileManagement = lazyRetry(() => import("./pages/FileManagement"));
const InstallerTeams = lazyRetry(() => import("./pages/InstallerTeams"));
const InstallerTeamReport = lazyRetry(() => import("./pages/InstallerTeamReport"));
const Gallery = lazyRetry(() => import("./pages/Gallery"));
const LineSettings = lazyRetry(() => import("./pages/LineSettings"));
const FollowUps = lazyRetry(() => import("./pages/FollowUps"));
const CompanySettings = lazyRetry(() => import("./pages/CompanySettings"));
const Approvals = lazyRetry(() => import("./pages/Approvals"));
const Finance = lazyRetry(() => import("./pages/Finance"));
const ChecklistTemplates = lazyRetry(() => import("./pages/ChecklistTemplates"));
const SurveyTemplates = lazyRetry(() => import("./pages/SurveyTemplates"));
const SourceManagement = lazyRetry(() => import("./pages/SourceManagement"));
const GroupDashboard = lazyRetry(() => import("./pages/GroupDashboard"));
const SalesPerformance = lazyRetry(() => import("./pages/SalesPerformance"));
const InstallationCalendar = lazyRetry(() => import("./pages/InstallationCalendar"));
const TechnicalFieldSettings = lazyRetry(() => import("./pages/TechnicalFieldSettings"));
const InstallationPrep = lazyRetry(() => import("./pages/InstallationPrep"));
const CancelledCases = lazyRetry(() => import("./pages/CancelledCases"));
const DocumentSettings = lazyRetry(() => import("./pages/DocumentSettings"));
const StorageSettings = lazyRetry(() => import("./pages/StorageSettings"));
const DeliveryForms = lazyRetry(() => import("./pages/DeliveryForms"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

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
        <Route path="/document-settings" component={DocumentSettings} />
        <Route path="/storage-settings" component={StorageSettings} />
        <Route path="/installation-prep" component={InstallationPrep} />
        <Route path="/cancelled-cases" component={CancelledCases} />
        <Route path="/survey-templates" component={SurveyTemplates} />
        <Route path="/checklist-templates" component={ChecklistTemplates} />
        <Route path="/delivery-forms" component={DeliveryForms} />
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
