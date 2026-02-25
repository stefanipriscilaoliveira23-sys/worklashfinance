import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIPOS_MENTORIA = ["Mentorias", "Renovações"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NovoContratoDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [tipoMentoria, setTipoMentoria] = useState<string>("Mentorias");
  const [valorTotal, setValorTotal] = useState("");
  const [entradaValor, setEntradaValor] = useState("");
  const [quantParcelas, setQuantParcelas] = useState("1");
  const [periodicidade, setPeriodicidade] = useState("Mensal");
  const [dataInicio, setDataInicio] = useState("");

  const resetForm = () => {
    setClienteNome("");
    setClienteEmail("");
    setTipoMentoria("Mentorias");
    setValorTotal("");
    setEntradaValor("");
    setQuantParcelas("1");
    setPeriodicidade("Mensal");
    setDataInicio("");
  };

  const insertMutation = useMutation({
    mutationFn: async () => {
      if (!clienteNome || !dataInicio) throw new Error("Nome e data de início são obrigatórios");
      const { error } = await supabase.from("parcelas_mentoria").insert({
        cliente_nome: clienteNome,
        cliente_email: clienteEmail || null,
        tipo_mentoria: tipoMentoria as any,
        valor_total: Number(valorTotal) || 0,
        entrada_valor: Number(entradaValor) || 0,
        quant_parcelas: Number(quantParcelas) || 1,
        periodicidade: periodicidade as any,
        data_inicio: dataInicio,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato criado! Adicione as parcelas pelo detalhe.");
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      resetForm();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}>
      <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contrato de Mentoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nome da Cliente *</Label>
            <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} className="bg-secondary/50" placeholder="Nome completo" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className="bg-secondary/50" placeholder="email@exemplo.com" />
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
            <Label className="text-xs text-muted-foreground">Data de Início *</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-secondary/50" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
          <Button onClick={() => insertMutation.mutate()} disabled={insertMutation.isPending}>Criar Contrato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
