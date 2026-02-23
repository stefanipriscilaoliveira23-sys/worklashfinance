import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Receitas from "./pages/Receitas";
import ParcelasMentoria from "./pages/ParcelasMentoria";
import DespesasEmpresa from "./pages/DespesasEmpresa";
import DespesasPessoal from "./pages/DespesasPessoal";
import EventosEspeciais from "./pages/EventosEspeciais";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/receitas" element={<Receitas />} />
              <Route path="/parcelas" element={<ParcelasMentoria />} />
              <Route path="/despesas-empresa" element={<DespesasEmpresa />} />
              <Route path="/despesas-pessoal" element={<DespesasPessoal />} />
              <Route path="/eventos" element={<EventosEspeciais />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
