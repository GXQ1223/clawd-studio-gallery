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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/project/:id" element={<ProtectedRoute><ProjectWorkspace /></ProtectedRoute>} />
            <Route path="/workspace/journal/:id" element={<ProtectedRoute><ProjectJournal /></ProtectedRoute>} />
            <Route path="/workspace/wall/:id" element={<ProtectedRoute><ProjectWall /></ProtectedRoute>} />
            <Route path="/workspace/deck/:id" element={<ProtectedRoute><ProjectDeck /></ProtectedRoute>} />
            <Route path="/mvp" element={<MvpCompare />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
