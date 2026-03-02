import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import { ClienteAutocomplete } from "@/components/receitas/ClienteAutocomplete";
import { formatCurrency } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type PlataformaOrigem = Database["public"]["Enums"]["plataforma_origem"];
type ProdutoCategoria = Database["public"]["Enums"]["produto_categoria"];
type Periodicidade = Database["public"]["Enums"]["periodicidade"];

const PLATAFORMAS: PlataformaOrigem[] = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"];
const CATEGORIAS: ProdutoCategoria[] = ["Mentorias", "Renovações", "Digitais", "Físicos"];
const MENTORIA_CATS: ProdutoCategoria[] = ["Mentorias", "Renovações"];

interface ParcelaRow {
  numero: number;
  data: string;
  valor: number;
}

export function NovaReceitaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // === DADOS DO CLIENTE ===
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");

  // === DADOS DO PRODUTO ===
  const [produtoNome, setProdutoNome] = useState("");
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<ProdutoCategoria>("Digitais");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataInicioMentoria, setDataInicioMentoria] = useState("");
  const [dataFimMentoria, setDataFimMentoria] = useState("");
  const [observacao, setObservacao] = useState("");
  const [origensVenda, setOrigensVenda] = useState<string[]>([]);
  const [produtoEntradaId, setProdutoEntradaId] = useState<string | null>(null);

  // === DADOS DO PAGAMENTO ===
  const [valorContrato, setValorContrato] = useState(0);
  const [entradaValor, setEntradaValor] = useState(0);
  const [entradaFormaPagamento, setEntradaFormaPagamento] = useState("");
  const [plataforma, setPlataforma] = useState<PlataformaOrigem>("Direto Pix");
  const [taxaPercent, setTaxaPercent] = useState(0);
  const [taxaValor, setTaxaValor] = useState(0);
  const [valorLiquido, setValorLiquido] = useState(0);
  const [moeda, setMoeda] = useState("BRL");
  const [taxaCambio, setTaxaCambio] = useState(1);
  const [valorBrl, setValorBrl] = useState(0);
  const [recebeuTudo, setRecebeuTudo] = useState(false);
  const [formaPagamentoResto, setFormaPagamentoResto] = useState("");

  // === PARCELAMENTO (Step 2) ===
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("Semanal");
  const [quantParcelas, setQuantParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<ParcelaRow[]>([]);
  const [dataTerminoAnterior, setDataTerminoAnterior] = useState("");
  const [dataUltimoAcesso, setDataUltimoAcesso] = useState("");

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

  const isMentoria = MENTORIA_CATS.includes(categoria);
  const saldoRestante = valorContrato - entradaValor;
  const temSaldoParcelar = saldoRestante > 0 && !recebeuTudo;
  const showStep2 = isMentoria && temSaldoParcelar;

  // Auto-calc taxa sobre entrada
  useEffect(() => {
    const base = isMentoria ? entradaValor : valorContrato;
    const tv = base * (taxaPercent / 100);
    setTaxaValor(tv);
    setValorLiquido(base - tv);
  }, [entradaValor, valorContrato, taxaPercent, isMentoria]);

  // Auto-calc cambio
  useEffect(() => {
    const base = isMentoria ? entradaValor : valorContrato;
    if (moeda !== "BRL" && taxaCambio > 0) {
      setValorBrl(base * taxaCambio);
    } else {
      setValorBrl(base);
    }
  }, [entradaValor, valorContrato, taxaCambio, moeda, isMentoria]);

  // Auto-calc parcelas
  useEffect(() => {
    if (!showStep2 || quantParcelas < 1) return;
    const valorParcela = saldoRestante / quantParcelas;
    const rows: ParcelaRow[] = [];
    const baseDate = new Date(data + "T00:00:00");
    for (let i = 0; i < quantParcelas; i++) {
      let d: Date;
      if (periodicidade === "Semanal") d = addDays(baseDate, (i + 1) * 7);
      else if (periodicidade === "Quinzenal") d = addDays(baseDate, (i + 1) * 15);
      else d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i + 1, baseDate.getDate());
      rows.push({ numero: i + 1, data: format(d, "yyyy-MM-dd"), valor: Math.round(valorParcela * 100) / 100 });
    }
    setParcelas(rows);
  }, [showStep2, quantParcelas, saldoRestante, periodicidade, data]);

  // Auto-fill from catalogo
  const handleProdutoSelect = (id: string) => {
    const p = produtos?.find((x) => x.id === id);
    if (p) {
      setProdutoId(p.id);
      setProdutoNome(p.nome);
      setCategoria(p.categoria);
      setTaxaPercent(p.custo_direto_percentual ?? 0);
    }
  };

  const insertMutation = useMutation({
    mutationFn: async () => {
      // Para mentorias: valor_bruto = entrada (o que realmente recebeu)
      // Para digitais/físicos: valor_bruto = valor total da venda
      const valorBrutoReal = isMentoria ? entradaValor : valorContrato;
      const taxaValorReal = valorBrutoReal * (taxaPercent / 100);
      const valorLiquidoReal = valorBrutoReal - taxaValorReal;

      // Se mentoria recebeu tudo (entrada = contrato inteiro ou marcou "já recebeu")
      const valorBrutoFinal = isMentoria && recebeuTudo ? valorContrato : valorBrutoReal;
      const valorLiquidoFinal = isMentoria && recebeuTudo ? valorContrato - (valorContrato * (taxaPercent / 100)) : valorLiquidoReal;

      const { data: receita, error } = await supabase.from("receitas").insert({
        data,
        produto_nome: produtoNome,
        produto_id: produtoId,
        produto_categoria: categoria,
        plataforma,
        valor_bruto: valorBrutoFinal,
        taxa_plataforma_percentual: taxaPercent,
        taxa_plataforma_valor: valorBrutoFinal * (taxaPercent / 100),
        valor_liquido: valorLiquidoFinal,
        moeda_original: moeda,
        taxa_cambio: taxaCambio,
        valor_em_brl: moeda !== "BRL" ? valorBrutoFinal * taxaCambio : valorBrutoFinal,
        cliente_nome: clienteNome,
        cliente_email: clienteEmail,
        forma_pagamento: entradaFormaPagamento || formaPagamentoResto || null,
        origens_venda: origensVenda,
        produto_entrada_id: produtoEntradaId,
        is_ascensao: origensVenda.includes("Ascensão"),
        observacao,
        lancado_por: user?.id,
        valor_contrato: isMentoria ? valorContrato : null,
        data_inicio_mentoria: dataInicioMentoria || null,
        data_fim_mentoria: dataFimMentoria || null,
      }).select().single();
      if (error) throw error;

      // Create parcelas if mentorship with installments
      if (showStep2 && receita) {
        const { error: pmErr } = await supabase.from("parcelas_mentoria").insert({
          cliente_nome: clienteNome,
          cliente_email: clienteEmail,
          tipo_mentoria: categoria,
          produto_id: produtoId,
          valor_total: valorContrato,
          entrada_valor: entradaValor,
          entrada_data: entradaValor > 0 ? data : null,
          quant_parcelas: quantParcelas,
          periodicidade,
          data_inicio: data,
          data_fim_prevista: parcelas[parcelas.length - 1]?.data || null,
          is_renovacao: categoria === "Renovações",
          data_termino_mentoria_anterior: dataTerminoAnterior || null,
          data_ultimo_acesso_anterior: dataUltimoAcesso || null,
          receita_id: receita.id,
          status_geral: "Pendente",
        }).select().single();

        if (!pmErr) {
          const { data: pm } = await supabase.from("parcelas_mentoria").select("id").eq("receita_id", receita.id).single();
          if (pm) {
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      queryClient.invalidateQueries({ queryKey: ["receitas-mes"] });
      queryClient.invalidateQueries({ queryKey: ["ultimas-receitas"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });
      toast.success("Receita lançada com sucesso!");
      onClose();
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  const handleSubmit = () => {
    if (!produtoId || !clienteNome || !clienteEmail || origensVenda.length === 0) {
      toast.error("Preencha todos os campos obrigatórios (produto, cliente, email, origens)");
      return;
    }
    if (valorContrato <= 0) {
      toast.error("Informe o valor da venda");
      return;
    }
    if (categoria === "Renovações" && (!dataTerminoAnterior || !dataUltimoAcesso)) {
      toast.error("Preencha as datas da mentoria anterior");
      return;
    }
    insertMutation.mutate();
  };

  const canGoStep2 = () => {
    if (!produtoId || !clienteNome || !clienteEmail || origensVenda.length === 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return false;
    }
    if (valorContrato <= 0) {
      toast.error("Informe o valor da venda");
      return false;
    }
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Nova Receita {showStep2 && `— Etapa ${step}/2`}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-5">
            {/* ═══════════════════════════════════════ */}
            {/* SEÇÃO 1: DADOS DO CLIENTE              */}
            {/* ═══════════════════════════════════════ */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1.5">
                Dados do Cliente
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Nome *</Label>
                  <ClienteAutocomplete
                    value={clienteNome}
                    onChange={(nome, email) => {
                      setClienteNome(nome);
                      if (email) setClienteEmail(email);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Email *</Label>
                  <Input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className="bg-secondary/50 border-border" />
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════ */}
            {/* SEÇÃO 2: DADOS DO PRODUTO              */}
            {/* ═══════════════════════════════════════ */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1.5">
                Dados do Produto
              </h3>

              <div className="space-y-1.5">
                <Label className="text-foreground/80">Produto *</Label>
                <Select onValueChange={handleProdutoSelect} value={produtoId ?? ""}>
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue placeholder="Selecionar do catálogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(produtos ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} ({p.categoria})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Data da venda</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Plataforma</Label>
                  <Select value={plataforma} onValueChange={(v) => setPlataforma(v as PlataformaOrigem)}>
                    <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATAFORMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

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

              {/* Origens venda */}
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Origens da venda * (selecione uma ou mais)</Label>
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

              {origensVenda.includes("Ascensão") && (
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Produto anterior comprado</Label>
                  <Select onValueChange={(v) => setProdutoEntradaId(v)}>
                    <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Selecionar produto anterior" /></SelectTrigger>
                    <SelectContent>
                      {(produtos ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════ */}
            {/* SEÇÃO 3: DADOS DO PAGAMENTO            */}
            {/* ═══════════════════════════════════════ */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1.5">
                Dados do Pagamento
              </h3>

              <div className="space-y-1.5">
                <Label className="text-foreground/80">{isMentoria ? "Valor total do contrato" : "Valor da venda"}</Label>
                <Input type="number" step="0.01" value={valorContrato || ""} onChange={(e) => setValorContrato(Number(e.target.value))} className="bg-secondary/50 border-border" />
              </div>

              {isMentoria && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Valor da entrada (recebido na venda)</Label>
                      <Input type="number" step="0.01" value={entradaValor || ""} onChange={(e) => setEntradaValor(Number(e.target.value))} className="bg-secondary/50 border-border" placeholder="0 se não houve entrada" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Forma de pagamento da entrada</Label>
                      <Input value={entradaFormaPagamento} onChange={(e) => setEntradaFormaPagamento(e.target.value)} placeholder="Ex: Pix, Cartão..." className="bg-secondary/50 border-border" />
                    </div>
                  </div>

                  {saldoRestante > 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">Saldo restante: <strong className="text-primary">{formatCurrency(saldoRestante)}</strong></span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setRecebeuTudo(true)}
                          className={`flex-1 p-3 rounded-lg border text-sm text-left transition-colors ${recebeuTudo ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
                        >
                          <strong>Já recebeu tudo</strong>
                          <p className="text-xs mt-0.5">O restante foi pago por outra forma (Pix, transferência, etc)</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecebeuTudo(false)}
                          className={`flex-1 p-3 rounded-lg border text-sm text-left transition-colors ${!recebeuTudo ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50"}`}
                        >
                          <strong>Vai parcelar</strong>
                          <p className="text-xs mt-0.5">O restante será pago em parcelas (Pix parcelado, etc)</p>
                        </button>
                      </div>

                      {recebeuTudo && (
                        <div className="space-y-1.5">
                          <Label className="text-foreground/80">Forma de pagamento do restante</Label>
                          <Input value={formaPagamentoResto} onChange={(e) => setFormaPagamentoResto(e.target.value)} placeholder="Ex: Pix, Transferência..." className="bg-secondary/50 border-border" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {!isMentoria && (
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Forma de pagamento</Label>
                  <Input value={entradaFormaPagamento} onChange={(e) => setEntradaFormaPagamento(e.target.value)} placeholder="Ex: Pix, Cartão, Boleto" className="bg-secondary/50 border-border" />
                  {entradaFormaPagamento.toLowerCase().includes("cartão") && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Vendas por cartão geralmente entram via importação de planilha.
                    </div>
                  )}
                </div>
              )}

              {/* Taxa / Moeda — only show when there's actual money received */}
              {((isMentoria && entradaValor > 0) || !isMentoria) && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-foreground/80">Taxa plataforma %</Label>
                    <Input type="number" step="0.1" value={taxaPercent || ""} onChange={(e) => setTaxaPercent(Number(e.target.value))} className="bg-secondary/50 border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground/80">Valor taxa</Label>
                    <Input type="number" step="0.01" value={taxaValor.toFixed(2)} disabled className="bg-secondary/50 border-border opacity-60" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground/80">Valor líquido</Label>
                    <Input type="number" step="0.01" value={valorLiquido.toFixed(2)} disabled className="bg-secondary/50 border-border opacity-60" />
                  </div>
                </div>
              )}

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
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground/80">Observação</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="bg-secondary/50 border-border" rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">Cancelar</Button>
              {showStep2 ? (
                <Button onClick={() => { if (canGoStep2()) setStep(2); }} className="gold-gradient text-primary-foreground">
                  Próximo: Parcelamento <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={insertMutation.isPending} className="gold-gradient text-primary-foreground">
                  {insertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar receita
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Parcelamento — {formatCurrency(saldoRestante)}</h3>
                <span className="text-xs text-muted-foreground">
                  {entradaValor > 0 ? `Entrada: ${formatCurrency(entradaValor)}` : "Sem entrada"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Quantidade de parcelas</Label>
                  <Input type="number" min={1} value={quantParcelas} onChange={(e) => setQuantParcelas(Number(e.target.value))} className="bg-secondary/50 border-border" />
                </div>
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

            {categoria === "Renovações" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Data término mentoria anterior *</Label>
                  <Input type="date" value={dataTerminoAnterior} onChange={(e) => setDataTerminoAnterior(e.target.value)} className="bg-secondary/50 border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80">Data último acesso da aluna *</Label>
                  <Input type="date" value={dataUltimoAcesso} onChange={(e) => setDataUltimoAcesso(e.target.value)} className="bg-secondary/50 border-border" />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="border-border text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={insertMutation.isPending} className="gold-gradient text-primary-foreground">
                {insertMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar receita
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
