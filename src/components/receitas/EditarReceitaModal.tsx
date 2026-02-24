import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type PlataformaOrigem = Database["public"]["Enums"]["plataforma_origem"];
type ProdutoCategoria = Database["public"]["Enums"]["produto_categoria"];

const PLATAFORMAS: PlataformaOrigem[] = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"];
const CATEGORIAS: ProdutoCategoria[] = [
  "Mentoria Outsider", "Mentoria Digital Beauty", "Consultoria Premium", "Consultoria Express",
  "Curso/Formação", "Ferramenta", "Apostila", "Produto Físico", "Renovação Mentoria", "Outros"
];

interface EditarReceitaModalProps {
  receita: any;
  open: boolean;
  onClose: () => void;
}

export function EditarReceitaModal({ receita, open, onClose }: EditarReceitaModalProps) {
  const queryClient = useQueryClient();

  const [data, setData] = useState("");
  const [produtoNome, setProdutoNome] = useState("");
  const [categoria, setCategoria] = useState<ProdutoCategoria>("Outros");
  const [plataforma, setPlataforma] = useState<PlataformaOrigem>("Hotmart");
  const [valorBruto, setValorBruto] = useState(0);
  const [taxaPercent, setTaxaPercent] = useState(0);
  const [taxaValor, setTaxaValor] = useState(0);
  const [valorLiquido, setValorLiquido] = useState(0);
  const [moeda, setMoeda] = useState("BRL");
  const [taxaCambio, setTaxaCambio] = useState(1);
  const [valorBrl, setValorBrl] = useState(0);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [origensVenda, setOrigensVenda] = useState<string[]>([]);
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState("ativo");
  const [dataFimMentoria, setDataFimMentoria] = useState("");

  const { data: origensOpcoes } = useQuery({
    queryKey: ["origens-venda-opcoes"],
    queryFn: async () => {
      const { data } = await supabase.from("origens_venda_opcoes").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  // Populate form when receita changes
  useEffect(() => {
    if (receita) {
      setData(receita.data ?? "");
      setProdutoNome(receita.produto_nome ?? "");
      setCategoria(receita.produto_categoria ?? "Outros");
      setPlataforma(receita.plataforma ?? "Hotmart");
      setValorBruto(receita.valor_bruto ?? 0);
      setTaxaPercent(receita.taxa_plataforma_percentual ?? 0);
      setTaxaValor(receita.taxa_plataforma_valor ?? 0);
      setValorLiquido(receita.valor_liquido ?? 0);
      setMoeda(receita.moeda_original ?? "BRL");
      setTaxaCambio(receita.taxa_cambio ?? 1);
      setValorBrl(receita.valor_em_brl ?? receita.valor_bruto ?? 0);
      setClienteNome(receita.cliente_nome ?? "");
      setClienteEmail(receita.cliente_email ?? "");
      setFormaPagamento(receita.forma_pagamento ?? "");
      setOrigensVenda(receita.origens_venda ?? []);
      setObservacao(receita.observacao ?? "");
      setStatus(receita.status ?? "ativo");
      setDataFimMentoria(receita.data_fim_mentoria ?? "");
    }
  }, [receita]);

  // Auto-calc taxa
  useEffect(() => {
    const tv = valorBruto * (taxaPercent / 100);
    setTaxaValor(tv);
    setValorLiquido(valorBruto - tv);
  }, [valorBruto, taxaPercent]);

  // Auto-calc cambio
  useEffect(() => {
    if (moeda !== "BRL" && taxaCambio > 0) {
      setValorBrl(valorBruto * taxaCambio);
    } else {
      setValorBrl(valorBruto);
    }
  }, [valorBruto, taxaCambio, moeda]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("receitas").update({
        data,
        produto_nome: produtoNome,
        produto_categoria: categoria,
        plataforma,
        valor_bruto: valorBruto,
        taxa_plataforma_percentual: taxaPercent,
        taxa_plataforma_valor: taxaValor,
        valor_liquido: valorLiquido,
        moeda_original: moeda,
        taxa_cambio: taxaCambio,
        valor_em_brl: valorBrl,
        cliente_nome: clienteNome,
        cliente_email: clienteEmail,
        forma_pagamento: formaPagamento,
        origens_venda: origensVenda,
        is_ascensao: origensVenda.includes("Ascensão"),
        observacao,
        status,
        data_fim_mentoria: dataFimMentoria || null,
      }).eq("id", receita.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      queryClient.invalidateQueries({ queryKey: ["receitas-mes"] });
      queryClient.invalidateQueries({ queryKey: ["ultimas-receitas"] });
      toast.success("Receita atualizada!");
      onClose();
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Editar Receita</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Data da venda</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Forma de pagamento</Label>
              <Input value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground/80">Produto</Label>
            <Input value={produtoNome} onChange={(e) => setProdutoNome(e.target.value)} className="bg-secondary/50 border-border" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as ProdutoCategoria)}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Plataforma</Label>
              <Select value={plataforma} onValueChange={(v) => setPlataforma(v as PlataformaOrigem)}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATAFORMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Valor bruto</Label>
              <Input type="number" step="0.01" value={valorBruto || ""} onChange={(e) => setValorBruto(Number(e.target.value))} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Taxa %</Label>
              <Input type="number" step="0.1" value={taxaPercent || ""} onChange={(e) => setTaxaPercent(Number(e.target.value))} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Valor líquido</Label>
              <Input type="number" step="0.01" value={valorLiquido || ""} onChange={(e) => setValorLiquido(Number(e.target.value))} className="bg-secondary/50 border-border" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Moeda</Label>
              <Select value={moeda} onValueChange={setMoeda}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {moeda !== "BRL" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Taxa de câmbio</Label>
                  <Input type="number" step="0.01" value={taxaCambio || ""} onChange={(e) => setTaxaCambio(Number(e.target.value))} className="bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Valor em BRL</Label>
                  <Input type="number" value={valorBrl.toFixed(2)} disabled className="bg-secondary/50 border-border opacity-60" />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Cliente nome</Label>
              <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Cliente email</Label>
              <Input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground/80">Origens da venda</Label>
            <div className="flex flex-wrap gap-2">
              {(origensOpcoes ?? []).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setOrigensVenda((prev) =>
                      prev.includes(o.label) ? prev.filter((x) => x !== o.label) : [...prev, o.label]
                    );
                  }}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    origensVenda.includes(o.label)
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="reembolsado">Reembolsado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Fim da mentoria</Label>
              <Input type="date" value={dataFimMentoria} onChange={(e) => setDataFimMentoria(e.target.value)} className="bg-secondary/50 border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground/80">Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="bg-secondary/50 border-border" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">Cancelar</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
