import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

const TIPOS_MENTORIA = [
  "Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium",
  "Consultoria Express", "Renovação Mentoria"
] as const;

interface Props {
  contrato: Tables<"parcelas_mentoria"> | null;
  onClose: () => void;
}

export default function EditarContratoDialog({ contrato, onClose }: Props) {
  const queryClient = useQueryClient();
  const [tipoMentoria, setTipoMentoria] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [entradaValor, setEntradaValor] = useState("");
  const [quantParcelas, setQuantParcelas] = useState("");
  const [periodicidade, setPeriodicidade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");

  useEffect(() => {
    if (contrato) {
      setTipoMentoria(contrato.tipo_mentoria);
      setValorTotal(String(contrato.valor_total ?? ""));
      setEntradaValor(String(contrato.entrada_valor ?? ""));
      setQuantParcelas(String(contrato.quant_parcelas ?? ""));
      setPeriodicidade(contrato.periodicidade);
      setDataInicio(contrato.data_inicio ?? "");
      setClienteNome(contrato.cliente_nome ?? "");
      setClienteEmail(contrato.cliente_email ?? "");
    }
  }, [contrato]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!contrato) return;
      const { error } = await supabase
        .from("parcelas_mentoria")
        .update({
          tipo_mentoria: tipoMentoria as any,
          valor_total: Number(valorTotal) || 0,
          entrada_valor: Number(entradaValor) || 0,
          quant_parcelas: Number(quantParcelas) || 1,
          periodicidade: periodicidade as any,
          data_inicio: dataInicio,
          cliente_nome: clienteNome,
          cliente_email: clienteEmail || null,
        })
        .eq("id", contrato.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato atualizado");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!contrato) return;
      // Delete related payments
      const { data: detalhes } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("id")
        .eq("parcela_mentoria_id", contrato.id);
      if (detalhes && detalhes.length > 0) {
        const ids = detalhes.map(d => d.id);
        await supabase
          .from("pagamentos_parciais")
          .delete()
          .eq("referencia_tipo", "parcela_mentoria_detalhe")
          .in("referencia_id", ids);
      }
      // Delete installments
      await supabase
        .from("parcelas_mentoria_detalhe")
        .delete()
        .eq("parcela_mentoria_id", contrato.id);
      // Delete contract
      const { error } = await supabase
        .from("parcelas_mentoria")
        .delete()
        .eq("id", contrato.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato excluído");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return (
    <Dialog open={!!contrato} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Contrato</DialogTitle>
        </DialogHeader>
        {contrato && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Nome da Cliente</Label>
                <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className="bg-secondary/50" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de Mentoria</Label>
              <Select value={tipoMentoria} onValueChange={setTipoMentoria}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MENTORIA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor Total</Label>
                <Input type="number" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} className="bg-secondary/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Entrada</Label>
                <Input type="number" step="0.01" value={entradaValor} onChange={(e) => setEntradaValor(e.target.value)} className="bg-secondary/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Qtd. Parcelas</Label>
                <Input type="number" min="1" value={quantParcelas} onChange={(e) => setQuantParcelas(e.target.value)} className="bg-secondary/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Periodicidade</Label>
                <Select value={periodicidade} onValueChange={setPeriodicidade}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Semanal">Semanal</SelectItem>
                    <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="Mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data de Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-secondary/50" />
            </div>
          </div>
        )}
        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { if (confirm("Excluir este contrato e todas as parcelas?")) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
          >
            Excluir Contrato
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
