import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getMonthRange } from "@/lib/format";
import { isParcelaFaturadaNoPeriodo, valorRecebidoParcela } from "@/lib/faturamento";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2 } from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function Linha({ label, valor, tom = "normal", sub }: { label: string; valor: number; tom?: "normal" | "positivo" | "negativo" | "forte"; sub?: string }) {
  const cor =
    tom === "positivo" ? "text-emerald-600"
    : tom === "negativo" ? "text-destructive"
    : "text-foreground";
  return (
    <div className={`flex items-start justify-between gap-4 py-2.5 ${tom === "forte" ? "border-t border-border pt-3" : ""}`}>
      <div className="min-w-0">
        <p className={`text-sm ${tom === "forte" ? "font-semibold" : ""}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className={`text-sm font-semibold shrink-0 ${cor} ${tom === "forte" ? "text-base" : ""}`}>{formatCurrency(valor)}</p>
    </div>
  );
}

export default function DRE() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const { start, end } = getMonthRange(ano, mes);

  const receitas = useQuery({
    queryKey: ["dre-receitas", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").gte("data", start).lte("data", end);
      return data ?? [];
    },
  });

  const parcelas = useQuery({
    queryKey: ["dre-parcelas"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria_detalhe").select("*");
      return data ?? [];
    },
  });

  const despEmpresa = useQuery({
    queryKey: ["dre-desp-emp", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*")
        .gte("data_vencimento", start).lte("data_vencimento", end);
      return data ?? [];
    },
  });

  const despPessoal = useQuery({
    queryKey: ["dre-desp-pes", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_pessoal").select("*")
        .gte("data_vencimento", start).lte("data_vencimento", end);
      return data ?? [];
    },
  });

  const carregando = receitas.isLoading || parcelas.isLoading || despEmpresa.isLoading || despPessoal.isLoading;

  const recVendas = (receitas.data ?? []).reduce((s, r: any) => s + (r.valor_em_brl ?? r.valor_bruto ?? 0), 0);
  const taxas = (receitas.data ?? []).reduce((s, r: any) => s + (r.taxa_plataforma_valor ?? 0), 0);
  const recParcelas = (parcelas.data ?? [])
    .filter((p: any) => isParcelaFaturadaNoPeriodo(p, start, end))
    .reduce((s, p: any) => s + valorRecebidoParcela(p), 0);

  const receitaBruta = recVendas + recParcelas;
  const receitaLiquida = receitaBruta - taxas;

  const empresa = (despEmpresa.data ?? []).reduce((s, d: any) => s + (d.valor_original ?? 0), 0);
  const impostos = (despEmpresa.data ?? [])
    .filter((d: any) => String(d.categoria ?? "").toLowerCase().includes("imposto"))
    .reduce((s, d: any) => s + (d.valor_original ?? 0), 0);
  const empresaSemImpostos = empresa - impostos;
  const pessoal = (despPessoal.data ?? []).reduce((s, d: any) => s + (d.valor_original ?? 0), 0);

  const totalCustos = empresa + pessoal;
  const lucro = receitaLiquida - totalCustos;
  const lucroEmpresa = receitaLiquida - empresa;

  const mudarMes = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" /> DRE
        </h1>
        <p className="text-sm text-muted-foreground">
          Quanto entrou, quanto saiu e quanto sobrou no mês, em linguagem simples.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => mudarMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2026, 2027, 2028].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={() => mudarMes(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {carregando ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dinheiro que entrou</p>
            <Linha label="Vendas do mês" valor={recVendas} tom="positivo" sub="Receitas lançadas e importadas" />
            <Linha label="Parcelas de mentoria recebidas" valor={recParcelas} tom="positivo" sub="Parcelas quitadas com data de pagamento no mês" />
            <Linha label="Receita bruta" valor={receitaBruta} tom="forte" />
            <Linha label="Taxas de plataforma" valor={-taxas} tom="negativo" />
            <Linha label="Receita líquida" valor={receitaLiquida} tom="forte" />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dinheiro que saiu</p>
            <Linha label="Despesas da empresa" valor={empresaSemImpostos} tom="negativo" />
            <Linha label="Impostos" valor={impostos} tom="negativo" sub="Despesas da empresa na categoria de impostos" />
            <Linha label="Despesas pessoais" valor={pessoal} tom="negativo" />
            <Linha label="Total de custos e despesas" valor={totalCustos} tom="forte" />
          </div>

          <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resultado do mês</p>
            <Linha label="Lucro da empresa (sem despesas pessoais)" valor={lucroEmpresa} tom={lucroEmpresa >= 0 ? "positivo" : "negativo"} />
            <Linha label="Sobrou no total (empresa e pessoal)" valor={lucro} tom="forte" />
          </div>
        </div>
      )}
    </div>
  );
}
