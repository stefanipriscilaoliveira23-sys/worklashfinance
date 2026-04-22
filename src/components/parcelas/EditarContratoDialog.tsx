import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  contrato: Tables<"parcelas_mentoria"> | null;
  onClose: () => void;
}

export default function EditarContratoDialog({ contrato, onClose }: Props) {
  const queryClient = useQueryClient();
  const [produtoId, setProdutoId] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [entradaValor, setEntradaValor] = useState("");
  const [quantParcelas, setQuantParcelas] = useState("");
  const [periodicidade, setPeriodicidade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");

  const { data: produtos } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (contrato) {
      // Set produto_id if available, otherwise try to find by category
      const pid = (contrato as any).produto_id;
      if (pid) {
        setProdutoId(pid);
      } else {
        const match = (produtos ?? []).find(p => p.categoria === contrato.tipo_mentoria);
        setProdutoId(match?.id ?? "");
      }
      setValorTotal(String(contrato.valor_total ?? ""));
      setEntradaValor(String(contrato.entrada_valor ?? ""));
      setQuantParcelas(String(contrato.quant_parcelas ?? ""));
      setPeriodicidade(contrato.periodicidade);
      setDataInicio(contrato.data_inicio ?? "");
      setClienteNome(contrato.cliente_nome ?? "");
      setClienteEmail(contrato.cliente_email ?? "");
    }
  }, [contrato, produtos]);

  const selectedProduto = (produtos ?? []).find(p => p.id === produtoId);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!contrato) return;
      const tipoMentoria = selectedProduto?.categoria ?? contrato.tipo_mentoria;
      const { error } = await supabase
        .from("parcelas_mentoria")
        .update({
          tipo_mentoria: tipoMentoria as any,
          produto_id: produtoId || null,
          valor_total: Number(valorTotal) || 0,
          entrada_valor: Number(entradaValor) || 0,
          quant_parcelas: Number(quantParcelas) || 1,
          periodicidade: periodicidade as any,
          data_inicio: dataInicio,
          cliente_nome: clienteNome,
          cliente_email: clienteEmail || null,
        } as any)
        .eq("id", contrato.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato atualizado");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria-all"] });
      onClose();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!contrato) return;
      // Fetch all installments for this contract
      const { data: detalhes, error: fetchErr } = await supabase
        .from("parcelas_mentoria_detalhe")
        .select("id, status")
        .eq("parcela_mentoria_id", contrato.id);
      if (fetchErr) throw fetchErr;

      // Identify installments to cancel: only those NOT paid (Pendente or Atraso)
      const idsParaCancelar = (detalhes ?? [])
        .filter(d => d.status === "Pendente" || d.status === "Atraso")
        .map(d => d.id);

      if (idsParaCancelar.length > 0) {
        const { error: delErr } = await supabase
          .from("parcelas_mentoria_detalhe")
          .delete()
          .in("id", idsParaCancelar);
        if (delErr) throw delErr;
      }

      // Count remaining (paid/partial) installments to update quant_parcelas
      const restantes = (detalhes ?? []).length - idsParaCancelar.length;

      // Update parent contract: mark as cancelado in observacao, adjust quant_parcelas, recalculate valor_total
      const obsAtual = (contrato as any).observacao ?? "";
      const novaObs = obsAtual.includes("[CANCELADO]")
        ? obsAtual
        : `[CANCELADO em ${new Date().toLocaleDateString("pt-BR")}] ${obsAtual}`.trim();

      const { error: updErr } = await supabase
        .from("parcelas_mentoria")
        .update({
          quant_parcelas: Math.max(restantes, 1),
          status_geral: "Quitado" as any,
        } as any)
        .eq("id", contrato.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Contrato cancelado. Parcelas pagas foram preservadas.");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria-all"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-atrasadas-anteriores"] });
      onClose();
    },
    onError: (e: any) => toast.error("Erro ao cancelar: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!contrato) return;
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
      await supabase
        .from("parcelas_mentoria_detalhe")
        .delete()
        .eq("parcela_mentoria_id", contrato.id);
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
              <Label className="text-xs text-muted-foreground">Produto</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {(produtos ?? []).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
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
        <DialogFooter className="flex justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { if (confirm("Excluir este contrato e TODAS as parcelas (inclusive pagas)?")) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              Excluir Contrato
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-warning/40 text-warning hover:bg-warning/10"
              onClick={() => { if (confirm("Cancelar contrato? As parcelas pagas serão preservadas e apenas as parcelas pendentes/atrasadas serão removidas.")) cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}
            >
              Cancelar Contrato
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
