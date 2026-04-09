import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider, useAuth } from "./lib/auth";
import { initAnalytics, trackPageview } from "./lib/analytics";
import Library from "./pages/Library";
import Collections from "./pages/Collections";
import Snap from "./pages/Snap";
import RecipeEditor from "./pages/RecipeEditor";
import RecipeDetail from "./pages/RecipeDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import NotFound from "./pages/not-found";

// Init PostHog once
initAnalytics();

/** Fires a pageview on every hash-route change */
function PageviewTracker() {
  const [loc] = useHashLocation();
  useEffect(() => { trackPageview(loc); }, [loc]);
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [loc] = useHashLocation();

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const publicRoutes = ["/login", "/signup"];
  if (!user && !publicRoutes.includes(loc)) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router hook={useHashLocation}>
            <PageviewTracker />
            <AuthGate>
              <Switch>
                <Route path="/login" component={Login} />
                <Route path="/signup" component={Signup} />
                <Route path="/" component={Library} />
                <Route path="/collections" component={Collections} />
                <Route path="/snap" component={Snap} />
                <Route path="/recipe/new" component={RecipeEditor} />
                <Route path="/recipe/:id/edit" component={RecipeEditor} />
                <Route path="/recipe/:id" component={RecipeDetail} />
                <Route path="/profile" component={Profile} />
                <Route component={NotFound} />
              </Switch>
            </AuthGate>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
