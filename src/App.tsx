import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import ProjectJournal from "./pages/ProjectJournal";
import ProjectWall from "./pages/ProjectWall";
import ProjectDeck from "./pages/ProjectDeck";
import NotFound from "./pages/NotFound";
import MvpCompare from "./pages/MvpCompare";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/project/:id" element={<ProjectWorkspace />} />
          <Route path="/workspace/journal/:id" element={<ProjectJournal />} />
          <Route path="/workspace/wall/:id" element={<ProjectWall />} />
          <Route path="/workspace/deck/:id" element={<ProjectDeck />} />
          <Route path="/mvp" element={<MvpCompare />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
