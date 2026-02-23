import { useState } from "react";
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

export default function PagamentoDialog({ showPagamento, onClose, onSuccess }: Props) {
  const [pgValor, setPgValor] = useState("");
  const [pgData, setPgData] = useState(new Date().toISOString().split("T")[0]);
  const [pgObs, setPgObs] = useState("");

  // Reset form when opening
  const handleOpen = (open: boolean) => {
    if (!open) {
      onClose();
      setPgValor("");
      setPgObs("");
    }
  };

  // Set default value when showPagamento changes
  if (showPagamento && !pgValor) {
    setPgValor(String(showPagamento.saldo_parcela ?? showPagamento.valor_real ?? showPagamento.valor_sugerido ?? 0));
  }

  const registrarPagamento = useMutation({
    mutationFn: async () => {
      if (!showPagamento) return;
      const valor = parseFloat(pgValor);
      if (isNaN(valor) || valor <= 0) throw new Error("Valor inválido");

      const { error: pgError } = await supabase.from("pagamentos_parciais").insert({
        referencia_id: showPagamento.id,
        referencia_tipo: "parcela_mentoria_detalhe",
        valor_pago: valor,
        data_pagamento: pgData,
        observacao: pgObs || null,
      });
      if (pgError) throw pgError;

      const novoPago = (showPagamento.valor_pago_parcial ?? 0) + valor;
      const valorReal = showPagamento.valor_real ?? showPagamento.valor_sugerido ?? 0;
      const novoSaldo = Math.max(0, valorReal - novoPago);
      const novoStatus = novoSaldo <= 0 ? "Quitado" : "Parcialmente Pago";

      const { error: upError } = await supabase
        .from("parcelas_mentoria_detalhe")
        .update({
          valor_pago_parcial: novoPago,
          saldo_parcela: novoSaldo,
          status: novoStatus as any,
          data_pagamento: novoSaldo <= 0 ? pgData : showPagamento.data_pagamento,
        })
        .eq("id", showPagamento.id);
      if (upError) throw upError;

      const { data: allDetalhes } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("status")
        .eq("parcela_mentoria_id", showPagamento.parcela_mentoria_id);

      if (allDetalhes) {
        const allQuitado = allDetalhes.every(d => d.status === "Quitado");
        const anyAtraso = allDetalhes.some(d => d.status === "Atraso");
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
    <Dialog open={!!showPagamento} onOpenChange={handleOpen}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Valor</Label>
            <Input type="number" value={pgValor} onChange={e => setPgValor(e.target.value)} className="bg-secondary/50 border-border" />
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
