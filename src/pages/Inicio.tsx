import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isAdmin } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatCurrency, getMonthRange, getWeekRange } from "@/lib/format";
import {
  Loader2, DollarSign, CalendarClock, Building2, User,
  CalendarCheck, BookOpen, RefreshCw, ArrowRight, TrendingUp,
} from "lucide-react";

function Card({ label, value, sub, icon: Icon, tone = "default", onClick }: any) {
  const toneClasses =
    tone === "alert"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : tone === "primary"
      ? "border-primary/40 bg-primary/5"
      : "border-border bg-card";
  const valueClasses =
    tone === "alert" ? "text-destructive" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-5 transition-colors hover:border-primary/40 ${toneClasses}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </div>
      <p className={`text-2xl font-bold ${valueClasses}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </button>
  );
}

export default function Inicio() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(role);
  const now = new Date();

  const { start: mesStart, end: mesEnd } = getMonthRange(now.getFullYear(), now.getMonth());
  const { start: semStart, end: semEnd } = getWeekRange();

  const receitasMes = useQuery({
    queryKey: ["inicio-receitas-mes", mesStart, mesEnd],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").gte("data", mesStart).lte("data", mesEnd);
      return data ?? [];
    },
  });

  const detalhes = useQuery({
    queryKey: ["inicio-detalhes"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria_detalhe").select("*");
      return data ?? [];
    },
  });

  const despEmpresa = useQuery({
    queryKey: ["inicio-desp-emp", semStart, semEnd],
    enabled: admin,
    queryFn: async () => {
      const { data } = await supabase
        .from("despesas_empresa").select("*")
        .gte("data_vencimento", semStart).lte("data_vencimento", semEnd);
      return data ?? [];
    },
  });

  const despPessoal = useQuery({
    queryKey: ["inicio-desp-pes", semStart, semEnd],
    enabled: admin,
    queryFn: async () => {
      const { data } = await supabase
        .from("despesas_pessoal").select("*")
        .gte("data_vencimento", semStart).lte("data_vencimento", semEnd);
      return data ?? [];
    },
  });

  const isLoading = receitasMes.isLoading || detalhes.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rMes = receitasMes.data ?? [];
  const rSemana = rMes.filter(r => r.data >= semStart && r.data <= semEnd);
  const det = detalhes.data ?? [];

  // Faturamento (inclui parcelas quitadas no período)
  const parcQuitMes = det.filter(p => p.data_vencimento >= mesStart && p.data_vencimento <= mesEnd && p.status === "Quitado");
  const parcQuitSem = det.filter(p => (p.data_pagamento ?? p.data_vencimento) >= semStart && (p.data_pagamento ?? p.data_vencimento) <= semEnd && p.status === "Quitado");

  const fatMes = rMes.reduce((s, r) => s + (r.valor_bruto ?? 0), 0)
    + parcQuitMes.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
  const fatSemana = rSemana.reduce((s, r) => s + (r.valor_bruto ?? 0), 0)
    + parcQuitSem.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);

  // Parcelas a receber na semana
  const parcSemana = det.filter(p =>
    p.data_vencimento >= semStart && p.data_vencimento <= semEnd && p.status !== "Quitado"
  );
  const valorReceberSemana = parcSemana.reduce(
    (s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0
  );

  // Mentorias e renovações vendidas no mês (categorias do produto)
  const mentoriasMes = rMes.filter(r => r.produto_categoria === "Mentorias").length;
  const renovacoesMes = rMes.filter(r => r.produto_categoria === "Renovações").length;

  // Despesas vencendo essa semana (não pagas)
  const dEmpSem = (despEmpresa.data ?? []).filter(d => d.status !== "Pago");
  const dPesSem = (despPessoal.data ?? []).filter(d => d.status !== "Pago");
  const valorEmpSem = dEmpSem.reduce((s, d) => s + (d.saldo_pendente ?? d.valor_original ?? 0), 0);
  const valorPesSem = dPesSem.reduce((s, d) => s + (d.saldo_pendente ?? d.valor_original ?? 0), 0);

  const nome = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá{nome ? `, ${nome}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão rápida de hoje — {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
      </div>

      {/* Faturamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card label="Faturamento do mês" value={formatCurrency(fatMes)} icon={DollarSign} tone="primary" onClick={() => navigate("/receitas")} />
        <Card label="Faturamento da semana" value={formatCurrency(fatSemana)} icon={TrendingUp} onClick={() => navigate("/receitas")} />
      </div>

      {/* A receber e vendas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          label="A receber essa semana"
          value={formatCurrency(valorReceberSemana)}
          sub={`${parcSemana.length} parcela(s)`}
          icon={CalendarCheck}
          onClick={() => navigate("/parcelas")}
        />
        <Card
          label="Mentorias vendidas no mês"
          value={String(mentoriasMes)}
          icon={BookOpen}
          onClick={() => navigate("/receitas")}
        />
        <Card
          label="Renovações no mês"
          value={String(renovacoesMes)}
          icon={RefreshCw}
          onClick={() => navigate("/receitas")}
        />
      </div>

      {/* Despesas da semana — só admin */}
      {admin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            label="Despesas empresa — vencendo essa semana"
            value={formatCurrency(valorEmpSem)}
            sub={`${dEmpSem.length} conta(s)`}
            icon={Building2}
            tone={valorEmpSem > 0 ? "alert" : "default"}
            onClick={() => navigate("/despesas-empresa")}
          />
          <Card
            label="Despesas pessoais — vencendo essa semana"
            value={formatCurrency(valorPesSem)}
            sub={`${dPesSem.length} conta(s)`}
            icon={User}
            tone={valorPesSem > 0 ? "alert" : "default"}
            onClick={() => navigate("/despesas-pessoal")}
          />
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver dashboard completo <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
