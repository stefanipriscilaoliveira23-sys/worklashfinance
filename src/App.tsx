import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import AdminRoute from "@/components/layout/AdminRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inicio from "./pages/Inicio";
import Receitas from "./pages/Receitas";
import ParcelasMentoria from "./pages/ParcelasMentoria";
import DespesasEmpresa from "./pages/DespesasEmpresa";
import DespesasPessoal from "./pages/DespesasPessoal";
import EventosEspeciais from "./pages/EventosEspeciais";
import ProdutosMargem from "./pages/ProdutosMargem";
import Projecao from "./pages/Projecao";
import BusinessIntelligence from "./pages/BusinessIntelligence";
import Configuracoes from "./pages/Configuracoes";
import PLDiario from "./pages/PLDiario";
import Clientes from "./pages/Clientes";
import Cofrinho from "./pages/Cofrinho";
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
              <Route path="/" element={<Inicio />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/receitas" element={<Receitas />} />
              <Route path="/parcelas" element={<ParcelasMentoria />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/despesas-empresa" element={<AdminRoute><DespesasEmpresa /></AdminRoute>} />
              <Route path="/despesas-pessoal" element={<AdminRoute><DespesasPessoal /></AdminRoute>} />
              <Route path="/eventos" element={<AdminRoute><EventosEspeciais /></AdminRoute>} />
              <Route path="/produtos" element={<AdminRoute><ProdutosMargem /></AdminRoute>} />
              <Route path="/projecao" element={<AdminRoute><Projecao /></AdminRoute>} />
              <Route path="/pl-diario" element={<AdminRoute><PLDiario /></AdminRoute>} />
              <Route path="/cofrinho" element={<AdminRoute><Cofrinho /></AdminRoute>} />
              <Route path="/bi" element={<AdminRoute><BusinessIntelligence /></AdminRoute>} />
              <Route path="/config" element={<AdminRoute><Configuracoes /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
