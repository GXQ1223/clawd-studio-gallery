import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import ProjectJournal from "./pages/ProjectJournal";
import ProjectWall from "./pages/ProjectWall";
import ProjectDeck from "./pages/ProjectDeck";
import NotFound from "./pages/NotFound";
import MvpCompare from "./pages/MvpCompare";
import SharedProject from "./pages/SharedProject";
import Library from "./pages/Library";
import Inspiration from "./pages/Inspiration";
import Sourcing from "./pages/Sourcing";
import ErrorBoundary from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><ErrorBoundary><Index /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute><ErrorBoundary><Library /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/inspiration" element={<ProtectedRoute><ErrorBoundary><Inspiration /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/sourcing" element={<ProtectedRoute><ErrorBoundary><Sourcing /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/project/:id" element={<ProtectedRoute><ErrorBoundary><ProjectWorkspace /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/workspace/journal/:id" element={<ProtectedRoute><ErrorBoundary><ProjectJournal /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/workspace/wall/:id" element={<ProtectedRoute><ErrorBoundary><ProjectWall /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/workspace/deck/:id" element={<ProtectedRoute><ErrorBoundary><ProjectDeck /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/share/:token" element={<ErrorBoundary><SharedProject /></ErrorBoundary>} />
              <Route path="/mvp" element={<ErrorBoundary><MvpCompare /></ErrorBoundary>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
