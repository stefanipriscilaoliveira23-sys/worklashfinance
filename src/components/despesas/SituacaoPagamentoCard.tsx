import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";

/**
 * Situação do pagamento de uma despesa, com o botão de desfazer.
 *
 * Existe porque acontece de lançar pagamento no mês errado (aconteceu em
 * 23/08/2026: um salário de agosto foi lançado como pago em setembro). Antes
 * disso não havia caminho de volta: uma vez marcada como paga, ficava paga.
 *
 * Todos os relatórios (DRE, Dashboard, P&L, Início, Projeção) leem o status e
 * os valores DA PRÓPRIA DESPESA, não a tabela de pagamentos. Então corrigir a
 * despesa aqui já corrige tudo, sem precisar mexer em relatório nenhum.
 */

type Tabela = "despesas_empresa" | "despesas_pessoal";

type Despesa = {
  id: string;
  descricao: string;
  valor_original: number | null;
  valor_pago_total: number | null;
  saldo_pendente: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string | null;
};

export default function SituacaoPagamentoCard({
  despesa, tabela, onMudou,
}: {
  despesa: Despesa;
  tabela: Tabela;
  onMudou?: () => void;
}) {
  const qc = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);

  const referenciaTipo = tabela === "despesas_empresa" ? "despesa_empresa" : "despesa_pessoal";

  const { data: pagamentos } = useQuery({
    queryKey: ["pagamentos-despesa", despesa.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos_parciais")
        .select("*")
        .eq("referencia_id", despesa.id)
        .eq("referencia_tipo", referenciaTipo)
        .order("data_pagamento");
      return data ?? [];
    },
  });

  const valor = despesa.valor_original ?? 0;
  const pago = despesa.valor_pago_total ?? 0;
  const saldo = despesa.saldo_pendente ?? Math.max(0, valor - pago);
  const estaPaga = despesa.status === "Pago";
  const temPagamento = pago > 0 || (pagamentos?.length ?? 0) > 0;

  /** Se ainda não venceu é "A Vencer"; se já passou da data, é "Em Atraso". */
  const statusEmAberto = () => {
    if (!despesa.data_vencimento) return "A Vencer";
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(despesa.data_vencimento + "T00:00:00");
    return venc < hoje ? "Em Atraso" : "A Vencer";
  };

  const voltarParaNaoPaga = useMutation({
    mutationFn: async () => {
      // 1. a despesa volta a ficar em aberto
      const { error } = await supabase
        .from(tabela)
        .update({
          status: statusEmAberto() as never,
          valor_pago_total: 0,
          saldo_pendente: valor,
          data_pagamento: null,
        })
        .eq("id", despesa.id);
      if (error) throw error;

      // 2. some com o registro dos pagamentos desfeitos, senão fica history
      // dizendo que foi pago algo que não foi
      if (pagamentos?.length) {
        const { error: errPg } = await supabase
          .from("pagamentos_parciais")
          .delete()
          .eq("referencia_id", despesa.id)
          .eq("referencia_tipo", referenciaTipo);
        if (errPg) throw errPg;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Despesa voltou para em aberto");
      setConfirmando(false);
      onMudou?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarComoPaga = useMutation({
    mutationFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from(tabela)
        .update({
          status: "Pago" as never,
          valor_pago_total: valor,
          saldo_pendente: 0,
          data_pagamento: despesa.data_pagamento ?? hoje,
        })
        .eq("id", despesa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Despesa marcada como paga");
      onMudou?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">Situação do pagamento</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            estaPaga
              ? "bg-primary/15 text-primary"
              : despesa.status === "Em Atraso"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {despesa.status ?? "—"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">Valor</p>
          <p className="text-foreground">{formatCurrency(valor)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Pago</p>
          <p className="text-foreground">{formatCurrency(pago)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Falta</p>
          <p className="text-foreground">{formatCurrency(saldo)}</p>
        </div>
      </div>

      {despesa.data_pagamento && (
        <p className="text-[11px] text-muted-foreground">
          Pagamento registrado em {formatDate(despesa.data_pagamento)}
        </p>
      )}

      {!!pagamentos?.length && (
        <div className="space-y-0.5 border-l-2 border-border pl-2">
          {pagamentos.map((pg) => (
            <p key={pg.id} className="text-[10px] text-muted-foreground">
              {formatDate(pg.data_pagamento)} — {formatCurrency(pg.valor_pago)}
              {pg.observacao ? ` • ${pg.observacao}` : ""}
            </p>
          ))}
        </div>
      )}

      {/* Confirmação: desfazer pagamento mexe em relatório, então não é um clique só */}
      {confirmando ? (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
          <p className="flex items-start gap-1.5 text-[11px] text-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <span>
              Esta despesa volta para <strong>{statusEmAberto()}</strong>
              {pagamentos?.length
                ? ` e ${pagamentos.length} registro(s) de pagamento serão apagados.`
                : "."}
              {" "}Os relatórios e o dashboard mudam junto.
            </span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => voltarParaNaoPaga.mutate()}
              disabled={voltarParaNaoPaga.isPending}
            >
              {voltarParaNaoPaga.isPending
                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                : <RotateCcw className="mr-1 h-3 w-3" />}
              Sim, voltar para em aberto
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(estaPaga || temPagamento) && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmando(true)}>
              <RotateCcw className="mr-1 h-3 w-3" />
              Voltar para não paga
            </Button>
          )}
          {!estaPaga && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => marcarComoPaga.mutate()}
              disabled={marcarComoPaga.isPending}
            >
              {marcarComoPaga.isPending
                ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                : <CheckCircle2 className="mr-1 h-3 w-3" />}
              Marcar como paga
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
