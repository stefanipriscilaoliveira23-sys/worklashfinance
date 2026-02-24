import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { statusBadge } from "@/pages/ParcelasMentoria";
import EditarParcelaDialog from "@/components/parcelas/EditarParcelaDialog";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  selectedAluna: Tables<"parcelas_mentoria"> | null;
  onClose: () => void;
  onRegistrarPagamento: (d: Tables<"parcelas_mentoria_detalhe">) => void;
}

export default function ParcelaDetalheSheet({ selectedAluna, onClose, onRegistrarPagamento }: Props) {
  const [editParcela, setEditParcela] = useState<Tables<"parcelas_mentoria_detalhe"> | null>(null);
  const { data: detalhes } = useQuery({
    queryKey: ["parcelas-detalhe", selectedAluna?.id],
    enabled: !!selectedAluna,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("*")
        .eq("parcela_mentoria_id", selectedAluna!.id)
        .order("numero_parcela");
      if (error) throw error;
      return data;
    },
  });

  const { data: historicoPagamentos } = useQuery({
    queryKey: ["pagamentos-parciais-mentoria", selectedAluna?.id],
    enabled: !!selectedAluna && !!detalhes,
    queryFn: async () => {
      if (!detalhes) return [];
      const ids = detalhes.map(d => d.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("pagamentos_parciais")
        .select("*")
        .eq("referencia_tipo", "parcela_mentoria_detalhe")
        .in("referencia_id", ids)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate saldo restante do contrato
  const saldoContrato = (detalhes ?? []).reduce((acc, d) => acc + (d.saldo_parcela ?? 0), 0);
  const totalPago = (detalhes ?? []).reduce((acc, d) => acc + (d.valor_pago_parcial ?? 0), 0);

  return (
    <Sheet open={!!selectedAluna} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto">
        {selectedAluna && (
          <div className="space-y-6">
            <SheetHeader>
              <SheetTitle className="text-foreground">{selectedAluna.cliente_nome}</SheetTitle>
              <p className="text-sm text-muted-foreground">{selectedAluna.cliente_email}</p>
            </SheetHeader>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Valor Total", value: formatCurrency(selectedAluna.valor_total) },
                { label: "Entrada", value: formatCurrency(selectedAluna.entrada_valor) },
                { label: "Total Pago", value: formatCurrency(totalPago + (selectedAluna.entrada_valor ?? 0)) },
                { label: "Saldo Restante", value: formatCurrency(saldoContrato) },
                { label: "Periodicidade", value: selectedAluna.periodicidade },
                { label: "Data Início", value: formatDate(selectedAluna.data_inicio) },
              ].map(item => (
                <div key={item.label} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-medium text-foreground mt-1">{item.value || "—"}</p>
                </div>
              ))}
            </div>

            {/* Parcelas detail */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Parcelas</h3>
              <div className="space-y-2">
                {(detalhes ?? []).map(d => {
                  const pagamentos = (historicoPagamentos ?? []).filter(hp => hp.referencia_id === d.id);
                  return (
                    <div key={d.id} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-primary">#{d.numero_parcela}</span>
                          <span className="text-sm text-foreground">{formatCurrency(d.valor_real ?? d.valor_sugerido)}</span>
                          {statusBadge(d.status)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatDate(d.data_vencimento)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => setEditParcela(d)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {d.status !== "Quitado" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => onRegistrarPagamento(d)}
                            >
                              Registrar pgto
                            </Button>
                          )}
                        </div>
                      </div>
                      {(d.valor_pago_parcial ?? 0) > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Pago: {formatCurrency(d.valor_pago_parcial)}</span>
                          <span>Saldo: {formatCurrency(d.saldo_parcela)}</span>
                        </div>
                      )}
                      {d.data_pagamento && (
                        <p className="text-xs text-muted-foreground">Pago em: {formatDate(d.data_pagamento)}</p>
                      )}
                      {pagamentos.length > 0 && (
                        <div className="mt-1 pl-3 border-l-2 border-border space-y-1">
                          {pagamentos.map(pg => (
                            <p key={pg.id} className="text-[10px] text-muted-foreground">
                              {formatDate(pg.data_pagamento)} — {formatCurrency(pg.valor_pago)} {pg.observacao ? `• ${pg.observacao}` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedAluna.is_renovacao && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
                <p className="text-xs font-medium text-primary">Renovação de Mentoria</p>
                <p className="text-xs text-muted-foreground">Término anterior: {formatDate(selectedAluna.data_termino_mentoria_anterior)}</p>
                <p className="text-xs text-muted-foreground">Último acesso: {formatDate(selectedAluna.data_ultimo_acesso_anterior)}</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>

      <EditarParcelaDialog
        parcela={editParcela}
        onClose={() => setEditParcela(null)}
      />
    </Sheet>
  );
}
