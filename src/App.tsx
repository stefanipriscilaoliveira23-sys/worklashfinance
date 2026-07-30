import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import AdminRoute from "@/components/layout/AdminRoute";
import RoleRoute from "@/components/layout/RoleRoute";
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
import Dividas from "./pages/Dividas";
import Mentoria from "./pages/Mentoria";
import Agenda from "./pages/Agenda";
import AgendarPublico from "./pages/AgendarPublico";
import Scripts from "./pages/Scripts";
import ProdutosCursos from "./pages/ProdutosCursos";
import Formularios from "./pages/Formularios";
import BibliotecaProcessos from "./pages/BibliotecaProcessos";
import Processos from "./pages/Processos";
import DRE from "./pages/DRE";
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
            <Route path="/agendar/:slug" element={<AgendarPublico />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Inicio />} />
              <Route path="/mentoria" element={<Mentoria />} />
              <Route path="/agenda" element={<Agenda />} />

              <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/processos" element={<Processos />} />
              <Route path="/biblioteca" element={<BibliotecaProcessos />} />
              <Route path="/scripts" element={<Scripts />} />
              <Route path="/produtos-cursos" element={<ProdutosCursos />} />
              <Route path="/formularios" element={<Formularios />} />
              <Route path="/dre" element={<AdminRoute><DRE /></AdminRoute>} />


              <Route path="/receitas" element={<Receitas />} />
              <Route path="/parcelas" element={<ParcelasMentoria />} />
              <Route path="/clientes" element={<Clientes />} />

              <Route path="/despesas-empresa" element={<AdminRoute><DespesasEmpresa /></AdminRoute>} />
              <Route path="/despesas-pessoal" element={<AdminRoute><DespesasPessoal /></AdminRoute>} />
              <Route path="/eventos" element={<AdminRoute><EventosEspeciais /></AdminRoute>} />
              <Route path="/produtos" element={<RoleRoute roles={["admin", "administrativo"]}><ProdutosMargem /></RoleRoute>} />
              <Route path="/projecao" element={<AdminRoute><Projecao /></AdminRoute>} />
              <Route path="/pl-diario" element={<AdminRoute><PLDiario /></AdminRoute>} />
              <Route path="/cofrinho" element={<AdminRoute><Cofrinho /></AdminRoute>} />
              <Route path="/dividas" element={<AdminRoute><Dividas /></AdminRoute>} />
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
