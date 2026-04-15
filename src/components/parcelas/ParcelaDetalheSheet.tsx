import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, AlertTriangle } from "lucide-react";
import { statusBadge } from "@/pages/ParcelasMentoria";
import EditarParcelaDialog from "@/components/parcelas/EditarParcelaDialog";
import AdicionarParcelaDialog from "@/components/parcelas/AdicionarParcelaDialog";
import EditarContratoDialog from "@/components/parcelas/EditarContratoDialog";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  selectedAluna: Tables<"parcelas_mentoria"> | null;
  onClose: () => void;
  onRegistrarPagamento: (d: Tables<"parcelas_mentoria_detalhe">) => void;
}

export default function ParcelaDetalheSheet({ selectedAluna, onClose, onRegistrarPagamento }: Props) {
  const [editParcela, setEditParcela] = useState<Tables<"parcelas_mentoria_detalhe"> | null>(null);
  const [showAddParcela, setShowAddParcela] = useState(false);
  const [editContrato, setEditContrato] = useState<Tables<"parcelas_mentoria"> | null>(null);

  const { data: produtosCatalogo } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  const getProdutoNome = (parcela: any) => {
    if (parcela.produto_id) {
      const prod = (produtosCatalogo ?? []).find(p => p.id === parcela.produto_id);
      if (prod) return prod.nome;
    }
    const prod = (produtosCatalogo ?? []).find(p => p.categoria === parcela.tipo_mentoria);
    return prod?.nome ?? parcela.tipo_mentoria;
  };

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

  // Count overdue installments from previous months for this contract
  const primeiroDiaMes = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const atrasadasCount = (detalhes ?? []).filter(
    d => d.status === "Atraso" && d.data_vencimento < primeiroDiaMes
  ).length;

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

  const totalPago = (detalhes ?? []).reduce((acc, d) => acc + (d.valor_pago_parcial ?? 0), 0);
  const saldoContrato = (selectedAluna?.valor_total ?? 0) - (selectedAluna?.entrada_valor ?? 0) - totalPago;

  return (
    <Sheet open={!!selectedAluna} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-card border-border overflow-y-auto">
        {selectedAluna && (
          <div className="space-y-6">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-foreground">{selectedAluna.cliente_nome}</SheetTitle>
                  <p className="text-sm text-muted-foreground">{selectedAluna.cliente_email}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setEditContrato(selectedAluna)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Editar Contrato
                </Button>
              </div>
            </SheetHeader>

            {atrasadasCount > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive font-medium">
                  ⚠️ Atenção: esta aluna possui {atrasadasCount} parcela(s) em atraso de meses anteriores
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Produto", value: getProdutoNome(selectedAluna) },
                { label: "Valor Total", value: formatCurrency(selectedAluna.valor_total) },
                { label: "Entrada", value: formatCurrency(selectedAluna.entrada_valor) },
                { label: "Total Pago", value: formatCurrency(totalPago + (selectedAluna.entrada_valor ?? 0)) },
                { label: "Saldo Restante", value: formatCurrency(saldoContrato) },
                { label: "Periodicidade", value: selectedAluna.periodicidade },
                { label: "Data Início", value: formatDate(selectedAluna.data_inicio) },
                { label: "Parcelas", value: `${selectedAluna.quant_parcelas}x` },
              ].map(item => (
                <div key={item.label} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-medium text-foreground mt-1">{item.value || "—"}</p>
                </div>
              ))}
            </div>

            {/* Parcelas detail */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Parcelas</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setShowAddParcela(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
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

      <AdicionarParcelaDialog
        parcelaMentoriaId={showAddParcela && selectedAluna ? selectedAluna.id : null}
        onClose={() => setShowAddParcela(false)}
      />

      <EditarContratoDialog
        contrato={editContrato}
        onClose={() => {
          setEditContrato(null);
          // Close the sheet too if contract was deleted
        }}
      />
    </Sheet>
  );
}
