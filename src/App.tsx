import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import AdminRoute from "@/components/layout/AdminRoute";
import Auth from "./pages/Auth";
import RedefinirSenha from "./pages/RedefinirSenha";
import Dashboard from "./pages/Dashboard";
import Inicio from "./pages/Inicio";
import Receitas from "./pages/Receitas";
import ParcelasMentoria from "./pages/ParcelasMentoria";
import DespesasEmpresa from "./pages/DespesasEmpresa";
import DespesasPessoal from "./pages/DespesasPessoal";
import EventosEspeciais from "./pages/EventosEspeciais";
import ProdutosMargem from "./pages/ProdutosMargem";
import Projecao from "./pages/Projecao";
import Configuracoes from "./pages/Configuracoes";
import PLDiario from "./pages/PLDiario";
import Clientes from "./pages/Clientes";
import Pessoas from "./pages/Pessoas";
import Cofrinho from "./pages/Cofrinho";
import Dividas from "./pages/Dividas";
import Mentoria from "./pages/Mentoria";
import Visao from "./pages/Visao";
import Crm from "./pages/Crm";
import Agenda from "./pages/Agenda";
import AgendarPublico from "./pages/AgendarPublico";
import Scripts from "./pages/Scripts";
import Iscas from "./pages/Iscas";
import AgendaReels from "./pages/AgendaReels";
import Campanhas from "./pages/Campanhas";
import Formularios from "./pages/Formularios";
import BibliotecaProcessos from "./pages/BibliotecaProcessos";
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
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/agendar/:slug" element={<AgendarPublico />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Inicio />} />
              <Route path="/visao" element={<Visao />} />
              <Route path="/mentoria" element={<Mentoria />} />
              <Route path="/agenda" element={<Agenda />} />

              <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/biblioteca" element={<BibliotecaProcessos />} />
              <Route path="/scripts" element={<Scripts />} />
              <Route path="/iscas" element={<Iscas />} />
              <Route path="/agenda-reels" element={<AgendaReels />} />
              <Route path="/campanhas" element={<Campanhas />} />
              <Route path="/produtos-cursos" element={<ProdutosMargem />} />
              <Route path="/formularios" element={<Formularios />} />
              <Route path="/dre" element={<AdminRoute><DRE /></AdminRoute>} />


              <Route path="/receitas" element={<Receitas />} />
              <Route path="/parcelas" element={<ParcelasMentoria />} />
              <Route path="/pessoas" element={<Pessoas />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/crm" element={<Crm />} />

              <Route path="/despesas-empresa" element={<AdminRoute><DespesasEmpresa /></AdminRoute>} />
              <Route path="/despesas-pessoal" element={<AdminRoute><DespesasPessoal /></AdminRoute>} />
              <Route path="/eventos" element={<AdminRoute><EventosEspeciais /></AdminRoute>} />
              <Route path="/produtos" element={<ProdutosMargem />} />
              <Route path="/projecao" element={<AdminRoute><Projecao /></AdminRoute>} />
              <Route path="/pl-diario" element={<AdminRoute><PLDiario /></AdminRoute>} />
              <Route path="/cofrinho" element={<AdminRoute><Cofrinho /></AdminRoute>} />
              <Route path="/dividas" element={<AdminRoute><Dividas /></AdminRoute>} />
              {/* Business Intelligence virou a aba Inteligencia dentro do Painel. */}
              <Route path="/bi" element={<Navigate to="/dashboard" replace />} />
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
