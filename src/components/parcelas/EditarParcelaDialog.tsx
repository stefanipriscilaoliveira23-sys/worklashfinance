import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  parcela: Tables<"parcelas_mentoria_detalhe"> | null;
  onClose: () => void;
}

export default function EditarParcelaDialog({ parcela, onClose }: Props) {
  const queryClient = useQueryClient();
  const [numeroParcela, setNumeroParcela] = useState("");
  const [valorReal, setValorReal] = useState("");
  const [valorSugerido, setValorSugerido] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [status, setStatus] = useState("");
  const [observacao, setObservacao] = useState("");

  // Sync state when parcela changes
  const initForm = (p: Tables<"parcelas_mentoria_detalhe">) => {
    setNumeroParcela(String(p.numero_parcela ?? ""));
    setValorReal(String(p.valor_real ?? ""));
    setValorSugerido(String(p.valor_sugerido ?? ""));
    setDataVencimento(p.data_vencimento ?? "");
    setStatus(p.status ?? "Pendente");
    setObservacao(p.observacao ?? "");
  };

  const recalcSaldos = async (parcelaMentoriaId: string) => {
    const { data: parent } = await supabase
      .from("parcelas_mentoria")
      .select("valor_total, entrada_valor")
      .eq("id", parcelaMentoriaId)
      .single();
    if (!parent) return;

    const { data: allDet } = await supabase
      .from("parcelas_mentoria_detalhe")
      .select("*")
      .eq("parcela_mentoria_id", parcelaMentoriaId)
      .order("numero_parcela");
    if (!allDet) return;

    const entrada = parent.entrada_valor ?? 0;
    const somaParcelas = allDet.reduce((acc, d) => acc + (d.valor_real ?? d.valor_sugerido ?? 0), 0);
    const valorTotalEfetivo = Math.max(parent.valor_total ?? 0, entrada + somaParcelas);

    let acumuladoPago = entrada;
    for (const det of allDet) {
      const valorDet = det.valor_real ?? det.valor_sugerido ?? 0;
      const pagoDet = det.valor_pago_parcial ?? 0;
      const contribuicao = Math.max(0, Math.min(valorDet, pagoDet));
      acumuladoPago += contribuicao;
      const saldoRestante = Math.max(0, valorTotalEfetivo - acumuladoPago);
      await supabase
        .from("parcelas_mentoria_detalhe")
        .update({ saldo_parcela: saldoRestante })
        .eq("id", det.id);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!parcela) return;
      const { error } = await supabase
        .from("parcelas_mentoria_detalhe")
        .update({
          valor_real: valorReal ? Number(valorReal) : null,
          valor_sugerido: valorSugerido ? Number(valorSugerido) : null,
          numero_parcela: numeroParcela ? Number(numeroParcela) : parcela.numero_parcela,
          data_vencimento: dataVencimento,
          status: status as any,
          observacao: observacao || null,
        })
        .eq("id", parcela.id);
      if (error) throw error;

      // Recalculate saldo_parcela for all installments in this contract
      await recalcSaldos(parcela.parcela_mentoria_id);
    },
    onSuccess: () => {
      toast.success("Parcela atualizada");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      onClose();
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!parcela) return;
      // Delete related payments first
      await supabase
        .from("pagamentos_parciais")
        .delete()
        .eq("referencia_id", parcela.id)
        .eq("referencia_tipo", "parcela_mentoria_detalhe");
      const { error } = await supabase
        .from("parcelas_mentoria_detalhe")
        .delete()
        .eq("id", parcela.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela excluída");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      onClose();
    },
    onError: (e) => toast.error("Erro ao excluir: " + e.message),
  });

  return (
    <Dialog
      open={!!parcela}
      onOpenChange={(open) => {
        if (!open) onClose();
        else if (parcela) initForm(parcela);
      }}
    >
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Editar Parcela #{parcela?.numero_parcela}</DialogTitle>
        </DialogHeader>
        {parcela && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nº da Parcela</Label>
              <Input
                type="number"
                min="1"
                value={numeroParcela}
                onChange={(e) => setNumeroParcela(e.target.value)}
                className="bg-secondary/50"
                placeholder="Ex: 2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor Sugerido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorSugerido}
                  onChange={(e) => setValorSugerido(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor Real</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorReal}
                  onChange={(e) => setValorReal(e.target.value)}
                  className="bg-secondary/50"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data Vencimento</Label>
              <Input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Quitado">Quitado</SelectItem>
                  <SelectItem value="Atraso">Atrasada</SelectItem>
                  <SelectItem value="Parcialmente Pago">Parcialmente Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="bg-secondary/50"
                rows={2}
              />
            </div>
          </div>
        )}
        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Excluir esta parcela?")) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
