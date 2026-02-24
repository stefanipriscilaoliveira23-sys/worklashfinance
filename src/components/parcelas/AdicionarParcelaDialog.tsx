import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  parcelaMentoriaId: string | null;
  onClose: () => void;
}

export default function AdicionarParcelaDialog({ parcelaMentoriaId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [numeroParcela, setNumeroParcela] = useState("");
  const [valorSugerido, setValorSugerido] = useState("");
  const [valorReal, setValorReal] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [status, setStatus] = useState("Pendente");
  const [observacao, setObservacao] = useState("");

  const resetForm = () => {
    setNumeroParcela("");
    setValorSugerido("");
    setValorReal("");
    setDataVencimento("");
    setStatus("Pendente");
    setObservacao("");
  };

  const insertMutation = useMutation({
    mutationFn: async () => {
      if (!parcelaMentoriaId) return;
      if (!numeroParcela || !dataVencimento) {
        throw new Error("Nº da parcela e data de vencimento são obrigatórios");
      }
      const { error } = await supabase
        .from("parcelas_mentoria_detalhe")
        .insert({
          parcela_mentoria_id: parcelaMentoriaId,
          numero_parcela: Number(numeroParcela),
          data_vencimento: dataVencimento,
          valor_sugerido: valorSugerido ? Number(valorSugerido) : 0,
          valor_real: valorReal ? Number(valorReal) : 0,
          status: status as any,
          observacao: observacao || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parcela adicionada");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      resetForm();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog
      open={!!parcelaMentoriaId}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Adicionar Parcela</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nº da Parcela</Label>
            <Input
              type="number"
              min="1"
              value={numeroParcela}
              onChange={(e) => setNumeroParcela(e.target.value)}
              className="bg-secondary/50"
              placeholder="Ex: 5"
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
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
          <Button onClick={() => insertMutation.mutate()} disabled={insertMutation.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
