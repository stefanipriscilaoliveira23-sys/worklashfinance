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
import { ClienteAutocomplete } from "@/components/receitas/ClienteAutocomplete";
import { format, addDays } from "date-fns";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type PlataformaOrigem = Database["public"]["Enums"]["plataforma_origem"];
type ProdutoCategoria = Database["public"]["Enums"]["produto_categoria"];
type Periodicidade = Database["public"]["Enums"]["periodicidade"];

const PLATAFORMAS: PlataformaOrigem[] = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"];
const MENTORIA_CATS: ProdutoCategoria[] = ["Mentorias", "Renovações"];

interface ParcelaRow {
  numero: number;
  data: string;
  valor: number;
}

interface EditarReceitaModalProps {
  receita: any;
  open: boolean;
  onClose: () => void;
}

export function EditarReceitaModal({ receita, open, onClose }: EditarReceitaModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const [data, setData] = useState("");
  const [produtoNome, setProdutoNome] = useState("");
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<ProdutoCategoria>("Digitais");
  const [plataforma, setPlataforma] = useState<PlataformaOrigem>("Hotmart");
  const [valorBruto, setValorBruto] = useState(0);
  const [valorContrato, setValorContrato] = useState(0);
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
  const [dataInicioMentoria, setDataInicioMentoria] = useState("");
  const [dataFimMentoria, setDataFimMentoria] = useState("");

  // Restante payment fields
  const [restanteForma, setRestanteForma] = useState<"pago" | "parcelas" | "">(""); 
  const [restantePagoForma, setRestantePagoForma] = useState("");

  // Step 2 - Parcelas inline
  const [entradaValor, setEntradaValor] = useState(0);
  const [entradaData, setEntradaData] = useState("");
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("Mensal");
  const [quantParcelas, setQuantParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<ParcelaRow[]>([]);

  const { data: produtos } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  const { data: origensOpcoes } = useQuery({
    queryKey: ["origens-venda-opcoes"],
    queryFn: async () => {
      const { data } = await supabase.from("origens_venda_opcoes").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  // Check if there's already a linked contract
  const { data: contratoExistente } = useQuery({
    queryKey: ["contrato-receita", receita?.id],
    queryFn: async () => {
      if (!receita?.id) return null;
      const { data } = await supabase.from("parcelas_mentoria").select("*").eq("receita_id", receita.id).maybeSingle();
      return data;
    },
    enabled: !!receita?.id,
  });

  useEffect(() => {
    if (receita) {
      setData(receita.data ?? "");
      setProdutoNome(receita.produto_nome ?? "");
      let matchedId = receita.produto_id ?? null;
      if (!matchedId && receita.produto_nome && produtos) {
        const match = produtos.find((p: any) => p.nome === receita.produto_nome);
        if (match) matchedId = match.id;
      }
      setProdutoId(matchedId);
      setCategoria(receita.produto_categoria ?? "Digitais");
      setPlataforma(receita.plataforma ?? "Hotmart");
      setValorBruto(receita.valor_bruto ?? 0);
      setValorContrato(receita.valor_contrato ?? receita.valor_bruto ?? 0);
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
      setDataInicioMentoria(receita.data_inicio_mentoria ?? "");
      setDataFimMentoria(receita.data_fim_mentoria ?? "");
      setStep(1);
      setRestanteForma("");
    }
  }, [receita, produtos]);

  const isMentoria = MENTORIA_CATS.includes(categoria);
  const valorRestante = isMentoria ? Math.max(0, valorContrato - valorBruto) : 0;
  const showStep2 = isMentoria && restanteForma === "parcelas" && !contratoExistente;

  // Auto-calc taxa — only recalculate when user changes percent, not on load
  const [taxaManual, setTaxaManual] = useState(false);
  useEffect(() => {
    if (!taxaManual) return;
    const tv = valorBruto * (taxaPercent / 100);
    setTaxaValor(tv);
    setValorLiquido(valorBruto - tv);
  }, [valorBruto, taxaPercent, taxaManual]);

  useEffect(() => {
    if (moeda !== "BRL" && taxaCambio > 0) {
      setValorBrl(valorBruto * taxaCambio);
    } else {
      setValorBrl(valorBruto);
    }
  }, [valorBruto, taxaCambio, moeda]);

  // Auto-calc parcelas
  useEffect(() => {
    if (!showStep2 || quantParcelas < 1) return;
    const valorParcela = valorRestante / quantParcelas;
    const rows: ParcelaRow[] = [];
    const baseDate = entradaData ? new Date(entradaData + "T00:00:00") : new Date();
    for (let i = 0; i < quantParcelas; i++) {
      let d: Date;
      if (periodicidade === "Semanal") d = addDays(baseDate, (i + 1) * 7);
      else if (periodicidade === "Quinzenal") d = addDays(baseDate, (i + 1) * 15);
      else d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i + 1, baseDate.getDate());
      rows.push({ numero: i + 1, data: format(d, "yyyy-MM-dd"), valor: Math.round(valorParcela * 100) / 100 });
    }
    setParcelas(rows);
  }, [showStep2, quantParcelas, valorRestante, periodicidade, entradaData]);

  const handleProdutoSelect = (id: string) => {
    const p = produtos?.find((x) => x.id === id);
    if (p) {
      setProdutoId(p.id);
      setProdutoNome(p.nome);
      setCategoria(p.categoria);
      // Don't override imported tax values
      if (!receita?.importado) {
        setTaxaPercent(p.custo_direto_percentual ?? 0);
        setTaxaManual(true);
      }
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      // When remaining balance was already paid (e.g. Pix), include it in revenue
      const restantePago = isMentoria && restanteForma === "pago" && valorRestante > 0;
      const valorBrutoFinal = restantePago ? valorContrato : valorBruto;
      const valorLiquidoFinal = restantePago ? valorLiquido + valorRestante : valorLiquido;
      const valorBrlFinal = restantePago ? (moeda !== "BRL" ? valorBrutoFinal * taxaCambio : valorBrutoFinal) : valorBrl;

      const { error } = await supabase.from("receitas").update({
        data,
        produto_nome: produtoNome,
        produto_id: produtoId,
        produto_categoria: categoria,
        plataforma,
        valor_bruto: valorBrutoFinal,
        valor_contrato: isMentoria ? valorContrato : null,
        taxa_plataforma_percentual: taxaPercent,
        taxa_plataforma_valor: taxaValor,
        valor_liquido: valorLiquidoFinal,
        moeda_original: moeda,
        taxa_cambio: taxaCambio,
        valor_em_brl: valorBrlFinal,
        cliente_nome: clienteNome,
        cliente_email: clienteEmail,
        forma_pagamento: restantePago ? `${formaPagamento}${formaPagamento ? " + " : ""}${restantePagoForma || "Pix"}` : formaPagamento,
        origens_venda: origensVenda,
        is_ascensao: origensVenda.includes("Ascensão"),
        observacao: restantePago ? `${observacao ? observacao + " | " : ""}Restante ${formatCurrency(valorRestante)} pago via ${restantePagoForma || "Pix"}` : observacao,
        
        data_inicio_mentoria: dataInicioMentoria || null,
        data_fim_mentoria: dataFimMentoria || null,
      }).eq("id", receita.id);
      if (error) throw error;

      // Create contract if parcelas selected and no existing contract
      if (showStep2 && parcelas.length > 0) {
        const { data: pm, error: pmErr } = await supabase.from("parcelas_mentoria").insert({
          cliente_nome: clienteNome,
          cliente_email: clienteEmail,
          tipo_mentoria: categoria,
          produto_id: produtoId,
          valor_total: valorContrato,
          entrada_valor: valorBruto,
          entrada_data: data || null,
          quant_parcelas: quantParcelas,
          periodicidade,
          data_inicio: dataInicioMentoria || data,
          data_fim_prevista: dataFimMentoria || parcelas[parcelas.length - 1]?.data || null,
          is_renovacao: categoria === "Renovações",
          receita_id: receita.id,
          status_geral: "Pendente",
        }).select().single();

        if (!pmErr && pm) {
          await supabase.from("parcelas_mentoria_detalhe").insert(
            parcelas.map((p) => ({
              parcela_mentoria_id: pm.id,
              numero_parcela: p.numero,
              data_vencimento: p.data,
              valor_sugerido: p.valor,
              valor_real: p.valor,
              saldo_parcela: p.valor,
              status: "Pendente" as const,
            }))
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      queryClient.invalidateQueries({ queryKey: ["receitas-mes"] });
      queryClient.invalidateQueries({ queryKey: ["ultimas-receitas"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-mentoria"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas-detalhe-all"] });
      toast.success("Receita atualizada!");
      onClose();
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Editar Receita {showStep2 && `— Etapa ${step}/2`}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
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

            {/* Produto from catalog */}
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Produto</Label>
              <Select value={produtoId ?? ""} onValueChange={handleProdutoSelect}>
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Selecionar do catálogo" />
                </SelectTrigger>
                <SelectContent>
                  {(produtos ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Mentoria-specific: Valor do contrato + valor pago na plataforma */}
            {isMentoria && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Valor do contrato</Label>
                  <Input type="number" step="0.01" value={valorContrato || ""} onChange={(e) => setValorContrato(Number(e.target.value))} className="bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Valor pago na plataforma</Label>
                  <Input type="number" step="0.01" value={valorBruto || ""} onChange={(e) => { setValorBruto(Number(e.target.value)); setTaxaManual(true); }} className="bg-secondary/50 border-border" />
                </div>
              </div>
            )}

            {/* Non-mentoria: valor bruto normal */}
            {!isMentoria && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Plataforma</Label>
                  <Select value={plataforma} onValueChange={(v) => setPlataforma(v as PlataformaOrigem)}>
                    <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATAFORMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Valor bruto</Label>
                  <Input type="number" step="0.01" value={valorBruto || ""} onChange={(e) => { setValorBruto(Number(e.target.value)); setTaxaManual(true); }} className="bg-secondary/50 border-border" />
                </div>
              </div>
            )}

            {isMentoria && (
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Plataforma</Label>
                <Select value={plataforma} onValueChange={(v) => setPlataforma(v as PlataformaOrigem)}>
                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATAFORMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Taxa %</Label>
                <Input type="number" step="0.1" value={taxaPercent || ""} onChange={(e) => { setTaxaPercent(Number(e.target.value)); setTaxaManual(true); }} className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Valor taxa</Label>
                <Input type="number" step="0.01" value={taxaValor || ""} readOnly className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Valor líquido</Label>
                <Input type="number" step="0.01" value={valorLiquido || ""} className="bg-secondary/50 border-border" readOnly />
              </div>
            </div>

            {/* Moeda */}
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

            {/* Mentoria: Início e Fim */}
            {isMentoria && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Início da mentoria</Label>
                  <Input type="date" value={dataInicioMentoria} onChange={(e) => setDataInicioMentoria(e.target.value)} className="bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Fim da mentoria</Label>
                  <Input type="date" value={dataFimMentoria} onChange={(e) => setDataFimMentoria(e.target.value)} className="bg-secondary/50 border-border" />
                </div>
              </div>
            )}

            {/* Restante do pagamento - only for mentoria with remaining balance and no existing contract */}
            {isMentoria && valorRestante > 0 && !contratoExistente && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Saldo restante do contrato</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(valorRestante)}</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 text-xs">Como será pago o restante?</Label>
                  <Select value={restanteForma} onValueChange={(v) => setRestanteForma(v as any)}>
                    <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Já foi pago (outra forma)</SelectItem>
                      <SelectItem value="parcelas">Parcelado (gerar parcelas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {restanteForma === "pago" && (
                  <div className="space-y-1.5">
                    <Label className="text-foreground/80 text-xs">Forma de pagamento do restante</Label>
                    <Input value={restantePagoForma} onChange={(e) => setRestantePagoForma(e.target.value)} placeholder="Ex: Pix direto" className="bg-secondary/50 border-border" />
                  </div>
                )}
              </div>
            )}

            {isMentoria && contratoExistente && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                ✅ Esta receita já possui um contrato de mentoria vinculado com {contratoExistente.quant_parcelas} parcela(s).
              </div>
            )}

            {/* Cliente with autocomplete */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Cliente nome</Label>
                <ClienteAutocomplete
                  value={clienteNome}
                  onChange={(nome, email) => {
                    setClienteNome(nome);
                    if (email) setClienteEmail(email);
                  }}
                />
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


            <div className="space-y-1.5">
              <Label className="text-foreground/80">Observação</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="bg-secondary/50 border-border" rows={2} />
            </div>

            {/* Origin info */}
            <p className="text-[11px] text-muted-foreground italic pt-2 border-t border-border">
              {receita?.importado
                ? `📥 Receita importada via planilha${receita?.plataforma ? ` (${receita.plataforma})` : ""}`
                : "✏️ Receita inserida manualmente"}
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">Cancelar</Button>
              {showStep2 ? (
                <Button onClick={() => setStep(2)}>
                  Próximo: Parcelas <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
              <h3 className="text-sm font-medium text-foreground">
                Parcelamento do saldo restante: {formatCurrency(valorRestante)}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Data base para parcelas</Label>
                  <Input type="date" value={entradaData || data} onChange={(e) => setEntradaData(e.target.value)} className="bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Periodicidade</Label>
                  <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as Periodicidade)}>
                    <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semanal">Semanal</SelectItem>
                      <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Quantidade de parcelas</Label>
                <Input type="number" min={1} value={quantParcelas} onChange={(e) => setQuantParcelas(Number(e.target.value))} className="bg-secondary/50 border-border" />
              </div>

              {parcelas.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/30 border-b border-border">
                        <th className="p-2 text-left text-xs text-muted-foreground">#</th>
                        <th className="p-2 text-left text-xs text-muted-foreground">Data</th>
                        <th className="p-2 text-right text-xs text-muted-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map((p, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="p-2 text-foreground">{p.numero}</td>
                          <td className="p-2">
                            <Input
                              type="date"
                              value={p.data}
                              onChange={(e) => {
                                const updated = [...parcelas];
                                updated[i].data = e.target.value;
                                setParcelas(updated);
                              }}
                              className="bg-secondary/50 border-border h-8 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={p.valor}
                              onChange={(e) => {
                                const updated = [...parcelas];
                                updated[i].valor = Number(e.target.value);
                                setParcelas(updated);
                              }}
                              className="bg-secondary/50 border-border h-8 text-xs text-right"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="border-border text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar receita e criar parcelas
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
