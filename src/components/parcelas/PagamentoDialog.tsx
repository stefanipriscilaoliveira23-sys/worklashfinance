import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  showPagamento: Tables<"parcelas_mentoria_detalhe"> | null;
  onClose: () => void;
  onSuccess: () => void;
}

const parseMoneyInput = (value: string) => {
  const cleaned = value.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return NaN;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", "."));
  }

  return Number(cleaned);
};

export default function PagamentoDialog({ showPagamento, onClose, onSuccess }: Props) {
  const [pgValor, setPgValor] = useState("");
  const [pgData, setPgData] = useState(new Date().toISOString().split("T")[0]);
  const [pgObs, setPgObs] = useState("");

  useEffect(() => {
    if (!showPagamento) return;

    const valorParcela = showPagamento.valor_real ?? showPagamento.valor_sugerido ?? 0;
    const jaPagoNaParcela = showPagamento.valor_pago_parcial ?? 0;
    const saldoDaParcela = Math.max(0, valorParcela - jaPagoNaParcela);

    setPgValor(String(saldoDaParcela));
  }, [showPagamento]);
  const registrarPagamento = useMutation({
    mutationFn: async () => {
      if (!showPagamento) return;

      const valorParcela = showPagamento.valor_real ?? showPagamento.valor_sugerido ?? 0;
      const jaPagoNaParcela = showPagamento.valor_pago_parcial ?? 0;
      const restanteParcela = Math.max(0, valorParcela - jaPagoNaParcela);

      const valor = parseMoneyInput(pgValor);
      if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor inválido");
      if (valor > restanteParcela + 0.01) {
        throw new Error(`Valor acima do restante da parcela (${restanteParcela.toFixed(2)})`);
      }

      // 1. Insert partial payment record
      const { error: pgError } = await supabase.from("pagamentos_parciais").insert({
        referencia_id: showPagamento.id,
        referencia_tipo: "parcela_mentoria_detalhe",
        valor_pago: valor,
        data_pagamento: pgData,
        observacao: pgObs || null,
      });
      if (pgError) throw pgError;

      // 2. Update the current installment's paid amount and status
      const novoPago = jaPagoNaParcela + valor;
      const parcelaQuitada = novoPago >= valorParcela;
      const novoStatus = parcelaQuitada ? "Quitado" : "Parcialmente Pago";

      const { error: upError } = await supabase
        .from("parcelas_mentoria_detalhe")
        .update({
          valor_pago_parcial: novoPago,
          status: novoStatus as any,
          data_pagamento: parcelaQuitada ? pgData : showPagamento.data_pagamento,
        })
        .eq("id", showPagamento.id);
      if (upError) throw upError;

      // 3. Fetch parent contract to get valor_total and entrada_valor
      const { data: parentContract } = await supabase
        .from("parcelas_mentoria")
        .select("valor_total, entrada_valor")
        .eq("id", showPagamento.parcela_mentoria_id)
        .single();

      // 4. Fetch ALL installments to recalculate saldo_parcela for each
      const { data: allDetalhes } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("*")
        .eq("parcela_mentoria_id", showPagamento.parcela_mentoria_id)
        .order("numero_parcela");

      if (allDetalhes && parentContract) {
        const valorTotal = parentContract.valor_total ?? 0;
        const entrada = parentContract.entrada_valor ?? 0;
        let acumuladoPago = entrada;

        // Recalculate saldo_parcela for each installment in order
        for (const det of allDetalhes) {
          const valorDet = det.valor_real ?? det.valor_sugerido ?? 0;
          const pagoDet = det.id === showPagamento.id ? novoPago : (det.valor_pago_parcial ?? 0);
          const contribuicao = Math.max(0, Math.min(valorDet, pagoDet));
          acumuladoPago += contribuicao;
          const saldoRestante = Math.max(0, valorTotal - acumuladoPago);

          await supabase
            .from("parcelas_mentoria_detalhe")
            .update({ saldo_parcela: saldoRestante })
            .eq("id", det.id);
        }

        // 5. Update parent contract status
        const updatedStatuses = allDetalhes.map(d =>
          d.id === showPagamento.id ? novoStatus : d.status
        );
        const allQuitado = updatedStatuses.every(s => s === "Quitado");
        const anyAtraso = updatedStatuses.some(s => s === "Atraso");
        const parentStatus = allQuitado ? "Quitado" : anyAtraso ? "Atraso" : "Pendente";
        await supabase.from("parcelas_mentoria").update({ status_geral: parentStatus as any }).eq("id", showPagamento.parcela_mentoria_id);
      }
    },
    onSuccess: () => {
      onSuccess();
      toast.success("Pagamento registrado");
      onClose();
      setPgValor("");
      setPgObs("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar pagamento"),
  });

  return (
    <Dialog
      open={!!showPagamento}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setPgValor("");
          setPgObs("");
        }
      }}
    >
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Valor</Label>
            <Input type="text" inputMode="decimal" value={pgValor} onChange={e => setPgValor(e.target.value)} className="bg-secondary/50 border-border" />
          </div>
          <div>
            <Label className="text-muted-foreground">Data do Pagamento</Label>
            <Input type="date" value={pgData} onChange={e => setPgData(e.target.value)} className="bg-secondary/50 border-border" />
          </div>
          <div>
            <Label className="text-muted-foreground">Observação</Label>
            <Textarea value={pgObs} onChange={e => setPgObs(e.target.value)} className="bg-secondary/50 border-border" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">Cancelar</Button>
          <Button onClick={() => registrarPagamento.mutate()} disabled={registrarPagamento.isPending} className="gold-gradient text-primary-foreground">
            {registrarPagamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
