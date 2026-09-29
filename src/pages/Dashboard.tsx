import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, ChevronLeft, ChevronRight, Loader2, Pencil, RefreshCw,
  ShoppingCart, Wallet, Receipt, LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isAdmin } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePainel, limitesDoMes, rotuloMes } from "@/hooks/usePainel";
import AbaVisaoGeral from "@/components/painel/AbaVisaoGeral";
import AbaFaturamento from "@/components/painel/AbaFaturamento";
import AbaVendas from "@/components/painel/AbaVendas";
import AbaRecebimentos from "@/components/painel/AbaRecebimentos";
import AbaDespesas from "@/components/painel/AbaDespesas";
import AbaRenovacoes from "@/components/painel/AbaRenovacoes";
import DashboardOperacional from "./DashboardOperacional";

function mesDeHoje(): string {
  return new Date().toISOString().slice(0, 7);
}

function deslocarMes(chave: string, passos: number): string {
  const [ano, mes] = chave.split("-").map(Number);
  const d = new Date(ano, mes - 1 + passos, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Dashboard() {
  const { role } = useAuth();
  if (!isAdmin(role)) return <DashboardOperacional />;
  return <PainelCompleto />;
}

const ABAS = [
  { valor: "visao", rotulo: "Visão geral", icone: LayoutDashboard },
  { valor: "faturamento", rotulo: "Faturamento", icone: Wallet },
  { valor: "vendas", rotulo: "Vendas", icone: ShoppingCart },
  { valor: "recebimentos", rotulo: "Recebimentos", icone: Receipt },
  { valor: "despesas", rotulo: "Despesas e resultado", icone: BarChart3 },
  { valor: "renovacoes", rotulo: "Renovações", icone: RefreshCw },
];

function PainelCompleto() {
  const clienteQuery = useQueryClient();
  const [mes, setMes] = useState(mesDeHoje());
  const [aba, setAba] = useState("visao");
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaDigitada, setMetaDigitada] = useState("");

  const d = usePainel(mes);

  const salvarMeta = useMutation({
    mutationFn: async (valor: number) => {
      const { mes: numeroMes, ano } = limitesDoMes(mes);
      const { data: existente } = await supabase
        .from("metas").select("id").eq("mes", numeroMes).eq("ano", ano).maybeSingle();
      if (existente) {
        const { error } = await supabase.from("metas").update({ valor_meta: valor }).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("metas").insert({ mes: numeroMes, ano, valor_meta: valor });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ["painel-metas"] });
      clienteQuery.invalidateQueries({ queryKey: ["meta-mes"] });
      toast.success("Meta atualizada.");
      setEditandoMeta(false);
    },
    onError: () => toast.error("Não consegui salvar a meta."),
  });

  if (d.carregando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (d.erro) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <p className="text-sm text-destructive">Não consegui carregar os números.</p>
        <p className="mt-1 text-xs text-muted-foreground">{(d.erro as Error).message}</p>
      </div>
    );
  }

  const ehMesDeHoje = mes === mesDeHoje();

  return (
    <div className="space-y-4">
      {/* Cabeçalho: mês, meta e atalho para voltar ao mês corrente */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Raio-X do Negócio</h1>
          <p className="text-xs text-muted-foreground">
            {d.ehMesCorrente
              ? `${rotuloMes(mes)} · dia ${d.diaDeHoje} de ${d.mes.diasNoMes}, faltam ${d.diasRestantes}`
              : `${rotuloMes(mes)} · mês fechado`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editandoMeta ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                type="number"
                value={metaDigitada}
                onChange={(e) => setMetaDigitada(e.target.value)}
                placeholder="meta do mês"
                className="h-8 w-32 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarMeta.mutate(Number(metaDigitada) || 0);
                  if (e.key === "Escape") setEditandoMeta(false);
                }}
              />
              <Button size="sm" className="h-8" onClick={() => salvarMeta.mutate(Number(metaDigitada) || 0)} disabled={salvarMeta.isPending}>
                {salvarMeta.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditandoMeta(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { setMetaDigitada(String(d.metaValor || "")); setEditandoMeta(true); }}
            >
              <Pencil className="mr-1.5 h-3 w-3" />
              Meta
            </Button>
          )}

          <div className="flex items-center rounded-lg border border-border bg-card">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMes(deslocarMes(mes, -1))} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[68px] px-1 text-center text-xs font-medium text-foreground">{rotuloMes(mes)}</span>
            <Button
              size="icon" variant="ghost" className="h-8 w-8"
              onClick={() => setMes(deslocarMes(mes, 1))}
              disabled={ehMesDeHoje}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {!ehMesDeHoje && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setMes(mesDeHoje())}>
              Hoje
            </Button>
          )}
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="flex h-auto flex-wrap justify-start border border-border bg-secondary/50">
          {ABAS.map(({ valor, rotulo, icone: Icone }) => (
            <TabsTrigger key={valor} value={valor} className="text-xs">
              <Icone className="mr-1.5 h-3.5 w-3.5" />
              {rotulo}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="visao" className="mt-4"><AbaVisaoGeral d={d} /></TabsContent>
        <TabsContent value="faturamento" className="mt-4"><AbaFaturamento d={d} /></TabsContent>
        <TabsContent value="vendas" className="mt-4"><AbaVendas d={d} /></TabsContent>
        <TabsContent value="recebimentos" className="mt-4"><AbaRecebimentos d={d} /></TabsContent>
        <TabsContent value="despesas" className="mt-4"><AbaDespesas d={d} /></TabsContent>
        <TabsContent value="renovacoes" className="mt-4"><AbaRenovacoes d={d} /></TabsContent>
      </Tabs>
    </div>
  );
}
