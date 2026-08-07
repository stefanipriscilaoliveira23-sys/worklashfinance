import { useState, useEffect, useRef } from "react";
import { useTaxaCalculator } from "@/hooks/useTaxaCalculator";
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
import { AlertTriangle, Loader2, ArrowRight, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { ClienteAutocomplete } from "@/components/receitas/ClienteAutocomplete";
import { formatCurrency } from "@/lib/format";
import { addMeses, gerarTarefasDaEtapa } from "@/lib/mentoria";
import type { Database } from "@/integrations/supabase/types";

type PlataformaOrigem = Database["public"]["Enums"]["plataforma_origem"];
type ProdutoCategoria = Database["public"]["Enums"]["produto_categoria"];
type Periodicidade = Database["public"]["Enums"]["periodicidade"];

const PLATAFORMAS: PlataformaOrigem[] = ["Hotmart", "Kiwify", "Eduzz", "Direto Pix", "Outro"];
const CATEGORIAS: ProdutoCategoria[] = ["Mentorias", "Renovações", "Digitais", "Físicos"];
const MENTORIA_CATS: ProdutoCategoria[] = ["Mentorias", "Renovações"];

const FORMAS_PAGAMENTO = ["Pix", "Cartão", "Kiwify", "Hotmart", "Transferência", "Boleto", "Outro"];

const PROGRAMAS_MENTORIA = ["Educadora Outsider", "Digital Beauty", "Outro"];

interface ParcelaRow {
  numero: number;
  data: string;
  valor: number;
}

interface EntradaLinha {
  valor: number;
  forma: string;
  taxaPercent: number;
}

interface ItemExtra {
  produtoId: string | null;
  produtoNome: string;
  categoria: ProdutoCategoria;
  quantidade: number;
  valorUnit: number;
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
  const [vendedor, setVendedor] = useState("");
  const [descontoPercent, setDescontoPercent] = useState(0);
  const [descontoValor, setDescontoValor] = useState(0);
  const [freteValor, setFreteValor] = useState(0);

  const [origensVenda, setOrigensVenda] = useState<string[]>([]);
  const [produtoEntradaId, setProdutoEntradaId] = useState<string | null>(null);

  // === ITENS ADICIONAIS DA VENDA (ex: duas pinças diferentes) ===
  const [itensExtras, setItensExtras] = useState<ItemExtra[]>([]);


  // === DADOS DO PAGAMENTO ===
  const [valorContrato, setValorContrato] = useState(0);
  const [tipoPagamento, setTipoPagamento] = useState<"avista" | "entrada_parcelas" | "">(""); // mentoria only
  const [entradaLinhas, setEntradaLinhas] = useState<EntradaLinha[]>([{ valor: 0, forma: "Pix", taxaPercent: 0 }]);
  const [entradaFormaPagamento, setEntradaFormaPagamento] = useState(""); // legado (não usado no UI novo)
  const [plataforma, setPlataforma] = useState<PlataformaOrigem>("Direto Pix");
  const [taxaPercent, setTaxaPercent] = useState(0);
  const [taxaValor, setTaxaValor] = useState(0);
  const [valorLiquido, setValorLiquido] = useState(0);
  const [moeda, setMoeda] = useState("BRL");
  const [taxaCambio, setTaxaCambio] = useState(1);
  const [valorBrl, setValorBrl] = useState(0);
  const [formaPagamentoResto, setFormaPagamentoResto] = useState("Pix");

  // === PARCELAMENTO (Step 2) ===
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("Semanal");
  const [quantParcelas, setQuantParcelas] = useState(1);
  const [parcelas, setParcelas] = useState<ParcelaRow[]>([]);
  const [dataTerminoAnterior, setDataTerminoAnterior] = useState("");
  const [dataUltimoAcesso, setDataUltimoAcesso] = useState("");

  // === VENDA DE MENTORIA (cria a mentorada na aba Mentoria) ===
  const [vendaMentoria, setVendaMentoria] = useState(false);
  const [alunaNome, setAlunaNome] = useState("");
  const [alunaTelefone, setAlunaTelefone] = useState("");
  const [alunaPrograma, setAlunaPrograma] = useState(PROGRAMAS_MENTORIA[0]);
  const [alunaDuracao, setAlunaDuracao] = useState("3");
  const [alunaVendedor, setAlunaVendedor] = useState("");
  const [alunaForma, setAlunaForma] = useState("Pix");



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

  // Nova origem inline
  const [novaOrigemAtiva, setNovaOrigemAtiva] = useState(false);
  const [novaOrigemLabel, setNovaOrigemLabel] = useState("");
  const criarOrigem = useMutation({
    mutationFn: async () => {
      const label = novaOrigemLabel.trim();
      if (!label) throw new Error("Nome vazio");
      const { data, error } = await supabase.from("origens_venda_opcoes").insert({ label, ativo: true }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (nova: any) => {
      queryClient.invalidateQueries({ queryKey: ["origens-venda-opcoes"] });
      setOrigensVenda((prev) => [...prev, nova.label]);
      setNovaOrigemLabel("");
      setNovaOrigemAtiva(false);
      toast.success("Origem adicionada");
    },
    onError: (e: any) => toast.error("Erro ao criar origem: " + e.message),
  });

  const isMentoria = MENTORIA_CATS.includes(categoria);

  // Derived values for mentoria
  const entradaValorTotal = entradaLinhas.reduce((sum, l) => sum + (l.valor || 0), 0);
  const entradaFormaConcat = entradaLinhas
    .filter(l => l.valor > 0)
    .map(l => `${l.forma}: R$${l.valor.toFixed(2).replace('.', ',')}${l.taxaPercent > 0 ? ` (${l.taxaPercent}%)` : ""}`)
    .join(" + ");

  const isAvista = tipoPagamento === "avista";
  const saldoRestante = isAvista ? 0 : valorContrato - entradaValorTotal;
  const temSaldoParcelar = saldoRestante > 0 && tipoPagamento === "entrada_parcelas";
  const showStep2 = isMentoria && temSaldoParcelar;

  // Itens adicionais (somente venda comum, não mentoria)
  const extrasTotal = isMentoria
    ? 0
    : itensExtras.reduce((s, i) => s + (i.quantidade || 0) * (i.valorUnit || 0), 0);
  const totalVenda = valorContrato + extrasTotal;

  // For à vista, the "entrada" is the full contract value
  const valorRecebido = isMentoria
    ? (isAvista ? valorContrato : entradaValorTotal)
    : totalVenda;


  // Taxa total: calculada a partir das linhas de forma de pagamento
  const taxaValorLinhas = entradaLinhas.reduce((s, l) => s + ((l.valor || 0) * (l.taxaPercent || 0)) / 100, 0);
  const taxaPercentEfetivo = valorRecebido > 0 ? (taxaValorLinhas / valorRecebido) * 100 : 0;
  const valorLiquidoLinhas = valorRecebido - taxaValorLinhas;

  // Sincroniza os campos globais com as linhas
  useEffect(() => {
    setTaxaValor(taxaValorLinhas);
    setValorLiquido(valorLiquidoLinhas);
    setTaxaPercent(taxaPercentEfetivo);
  }, [taxaValorLinhas, valorLiquidoLinhas, taxaPercentEfetivo]);

  // Auto-calc cambio
  useEffect(() => {
    const base = valorRecebido;
    if (moeda !== "BRL" && taxaCambio > 0) {
      setValorBrl(base * taxaCambio);
    } else {
      setValorBrl(base);
    }
  }, [valorRecebido, taxaCambio, moeda]);

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

  // Entrada lines management
  const addEntradaLinha = () => {
    setEntradaLinhas([...entradaLinhas, { valor: 0, forma: "Pix", taxaPercent: 0 }]);
  };
  const removeEntradaLinha = (idx: number) => {
    if (entradaLinhas.length <= 1) return;
    setEntradaLinhas(entradaLinhas.filter((_, i) => i !== idx));
  };
  const updateEntradaLinha = (idx: number, field: keyof EntradaLinha, value: any) => {
    const updated = [...entradaLinhas];
    updated[idx] = { ...updated[idx], [field]: value };
    setEntradaLinhas(updated);
  };

  // Itens extras management
  const addItemExtra = () =>
    setItensExtras([...itensExtras, { produtoId: null, produtoNome: "", categoria, quantidade: 1, valorUnit: 0 }]);
  const removeItemExtra = (idx: number) => setItensExtras(itensExtras.filter((_, i) => i !== idx));
  const updateItemExtra = (idx: number, patch: Partial<ItemExtra>) => {
    const updated = [...itensExtras];
    updated[idx] = { ...updated[idx], ...patch };
    setItensExtras(updated);
  };

  const insertMutation = useMutation({
    mutationFn: async () => {
      const extrasValidos = isMentoria ? [] : itensExtras.filter((i) => i.produtoId && i.quantidade > 0);
      const valorBrutoFinal = extrasValidos.length > 0 ? valorContrato : valorRecebido;
      const taxaValorFinal = valorRecebido > 0 ? taxaValorLinhas * (valorBrutoFinal / valorRecebido) : 0;
      const valorLiquidoFinal = valorBrutoFinal - taxaValorFinal;


      // forma_pagamento: sempre concatenar as linhas (com taxa quando > 0)
      const formaPagamentoFinal = entradaFormaConcat || entradaLinhas[0]?.forma || null;

      // Build observacao with payment details
      let obsCompleta = observacao;
      if (isMentoria && tipoPagamento === "entrada_parcelas" && entradaLinhas.length > 0) {
        const detalhes = `Entrada: ${entradaFormaConcat}. Restante (${formatCurrency(saldoRestante)}): ${formaPagamentoResto} em ${quantParcelas}x.`;
        obsCompleta = obsCompleta ? `${obsCompleta}\n${detalhes}` : detalhes;
      }

      const { data: receita, error } = await supabase.from("receitas").insert({
        data,
        produto_nome: produtoNome,
        produto_id: produtoId,
        produto_categoria: categoria,
        plataforma,
        valor_bruto: valorBrutoFinal,
        taxa_plataforma_percentual: taxaPercentEfetivo,
        taxa_plataforma_valor: taxaValorFinal,
        valor_liquido: valorLiquidoFinal,
        moeda_original: moeda,
        taxa_cambio: taxaCambio,
        valor_em_brl: moeda !== "BRL" ? valorBrutoFinal * taxaCambio : valorBrutoFinal,
        cliente_nome: clienteNome,
        cliente_email: clienteEmail,
        forma_pagamento: formaPagamentoFinal,
        origens_venda: origensVenda,
        produto_entrada_id: produtoEntradaId,
        is_ascensao: origensVenda.includes("Ascensão"),
        observacao: obsCompleta,
        vendedor: vendedor || alunaVendedor || null,
        desconto_percentual: descontoPercent || null,
        desconto_valor: descontoValor || null,
        frete_valor: freteValor || null,

        lancado_por: user?.id,
        valor_contrato: isMentoria ? valorContrato : null,
        data_inicio_mentoria: dataInicioMentoria || null,
        data_fim_mentoria: dataFimMentoria || null,
      }).select().single();
      if (error) throw error;

      // Itens adicionais: uma receita por item
      if (extrasValidos.length > 0) {
        const rows = extrasValidos.map((it) => {
          const bruto = (it.quantidade || 0) * (it.valorUnit || 0);
          const taxa = valorRecebido > 0 ? taxaValorLinhas * (bruto / valorRecebido) : 0;
          return {
            data,
            produto_nome: it.quantidade > 1 ? `${it.produtoNome} (x${it.quantidade})` : it.produtoNome,
            produto_id: it.produtoId,
            produto_categoria: it.categoria,
            plataforma,
            valor_bruto: bruto,
            taxa_plataforma_percentual: bruto > 0 ? (taxa / bruto) * 100 : 0,
            taxa_plataforma_valor: taxa,
            valor_liquido: bruto - taxa,
            moeda_original: moeda,
            taxa_cambio: taxaCambio,
            valor_em_brl: moeda !== "BRL" ? bruto * taxaCambio : bruto,
            cliente_nome: clienteNome,
            cliente_email: clienteEmail,
            forma_pagamento: formaPagamentoFinal,
            origens_venda: origensVenda,
            is_ascensao: origensVenda.includes("Ascensão"),
            observacao: obsCompleta,
            vendedor: vendedor || alunaVendedor || null,
            lancado_por: user?.id,
          };
        });
        const { error: extrasErr } = await supabase.from("receitas").insert(rows as any);
        if (extrasErr) throw extrasErr;
      }


      // Create parcelas if mentorship with installments
      if (showStep2 && receita) {
        const { error: pmErr } = await supabase.from("parcelas_mentoria").insert({
          cliente_nome: clienteNome,
          cliente_email: clienteEmail,
          tipo_mentoria: categoria,
          produto_id: produtoId,
          valor_total: valorContrato,
          entrada_valor: entradaValorTotal,
          entrada_data: entradaValorTotal > 0 ? data : null,
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
            // Calculate saldo_parcela correctly in chain
            let acumulado = entradaValorTotal;
            const valorTotalEfetivo = Math.max(valorContrato, entradaValorTotal + parcelas.reduce((s, p) => s + p.valor, 0));

            await supabase.from("parcelas_mentoria_detalhe").insert(
              parcelas.map((p) => {
                acumulado += p.valor;
                const saldo = Math.max(0, valorTotalEfetivo - acumulado);
                return {
                  parcela_mentoria_id: pm.id,
                  numero_parcela: p.numero,
                  data_vencimento: p.data,
                  valor_sugerido: p.valor,
                  valor_real: p.valor,
                  saldo_parcela: saldo,
                  status: "Pendente" as const,
                };
              })
            );
          }
        }
      }

      // If mentoria à vista, create contract with status Quitado (no installments needed)
      if (isMentoria && isAvista && receita) {
        await supabase.from("parcelas_mentoria").insert({
          cliente_nome: clienteNome,
          cliente_email: clienteEmail,
          tipo_mentoria: categoria,
          produto_id: produtoId,
          valor_total: valorContrato,
          entrada_valor: valorContrato,
          entrada_data: data,
          quant_parcelas: 0,
          periodicidade: "Mensal",
          data_inicio: data,
          is_renovacao: categoria === "Renovações",
          data_termino_mentoria_anterior: dataTerminoAnterior || null,
          data_ultimo_acesso_anterior: dataUltimoAcesso || null,
          receita_id: receita.id,
          status_geral: "Quitado",
        });
      }

      // Venda de mentoria: cria a mentorada na pipeline (etapa Onboarding)
      if (vendaMentoria && receita) {
        const nomeAluna = (alunaNome || clienteNome).trim();
        const telefone = alunaTelefone.trim();
        const { data: existentes } = await supabase
          .from("mentoradas").select("id, nome, telefone");
        const jaExiste = (existentes ?? []).find(
          (mm) =>
            mm.nome.trim().toLowerCase() === nomeAluna.toLowerCase() ||
            (!!telefone && (mm.telefone ?? "").trim() === telefone)
        );
        if (!jaExiste) {
          const meses = Number(alunaDuracao) || 0;
          const inicio = dataInicioMentoria || data;
          const { data: nova, error: mErr } = await supabase.from("mentoradas").insert({
            nome: nomeAluna,
            email: clienteEmail || null,
            telefone: telefone || null,
            programa: alunaPrograma,
            prazo_meses: meses,
            data_inicio: inicio,
            data_termino: dataFimMentoria || (inicio ? addMeses(inicio, meses) : null),
            valor_mentoria: valorContrato || valorRecebido,
            vendedor: alunaVendedor || null,
            forma_pagamento: alunaForma ? [alunaForma] : null,
            status_jornada: "Onboarding",
            receita_id: receita.id,
          }).select("id").single();
          if (mErr) throw mErr;
          await gerarTarefasDaEtapa(nova.id, "Onboarding");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      queryClient.invalidateQueries({ queryKey: ["receitas-mes"] });
      queryClient.invalidateQueries({ queryKey: ["ultimas-receitas"] });
      queryClient.invalidateQueries({ queryKey: ["parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["mentoradas"] });
      queryClient.invalidateQueries({ queryKey: ["mentorada-tarefas-todas"] });
      toast.success(vendaMentoria ? "Receita lançada e mentorada criada!" : "Receita lançada com sucesso!");
      onClose();
    },

    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });

  const handleSubmit = () => {
    const erros: string[] = [];
    if (!produtoId) erros.push("Produto");
    if (!clienteNome) erros.push("Nome do cliente");
    if (!clienteEmail) erros.push("Email do cliente");
    if (erros.length > 0) {
      toast.error("Campos obrigatórios faltando: " + erros.join(", "));
      return;
    }
    if (valorContrato <= 0) {
      toast.error("Informe o valor da venda");
      return;
    }
    if (isMentoria && !tipoPagamento) {
      toast.error("Selecione o tipo de pagamento");
      return;
    }
    if (isMentoria && tipoPagamento === "entrada_parcelas" && entradaValorTotal <= 0) {
      toast.error("Informe ao menos um valor de entrada");
      return;
    }
    if (isMentoria && tipoPagamento === "entrada_parcelas" && entradaValorTotal >= valorContrato) {
      toast.error("O valor da entrada é igual ou maior que o contrato. Use 'À vista' nesse caso.");
      return;
    }
    if (categoria === "Renovações" && (!dataTerminoAnterior || !dataUltimoAcesso)) {
      toast.error("Preencha as datas da mentoria anterior");
      return;
    }
    insertMutation.mutate();
  };

  const canGoStep2 = () => {
    const erros: string[] = [];
    if (!produtoId) erros.push("Produto");
    if (!clienteNome) erros.push("Nome do cliente");
    if (!clienteEmail) erros.push("Email do cliente");
    if (erros.length > 0) {
      toast.error("Campos obrigatórios faltando: " + erros.join(", "));
      return false;
    }
    if (valorContrato <= 0) {
      toast.error("Informe o valor da venda");
      return false;
    }
    if (tipoPagamento === "entrada_parcelas" && entradaValorTotal <= 0) {
      toast.error("Informe ao menos um valor de entrada");
      return false;
    }
    if (tipoPagamento === "entrada_parcelas" && entradaValorTotal >= valorContrato) {
      toast.error("O valor da entrada é igual ou maior que o contrato. Use 'À vista' nesse caso.");
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

              {/* Venda de mentoria: cria a aluna na pipeline */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={vendaMentoria}
                    onChange={(e) => {
                      setVendaMentoria(e.target.checked);
                      if (e.target.checked && !alunaNome) setAlunaNome(clienteNome);
                    }}
                  />
                  <span className="font-medium">Venda de mentoria</span>
                  <span className="text-xs text-muted-foreground">cria a aluna na aba Mentoria</span>
                </label>

                {vendaMentoria && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Nome da aluna</Label>
                      <Input value={alunaNome} onChange={(e) => setAlunaNome(e.target.value)}
                        placeholder={clienteNome} className="bg-secondary/50 border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Telefone</Label>
                      <Input value={alunaTelefone} onChange={(e) => setAlunaTelefone(e.target.value)} className="bg-secondary/50 border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Programa</Label>
                      <Select value={alunaPrograma} onValueChange={setAlunaPrograma}>
                        <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROGRAMAS_MENTORIA.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Duração (meses)</Label>
                      <Input type="number" min={1} value={alunaDuracao}
                        onChange={(e) => setAlunaDuracao(e.target.value)} className="bg-secondary/50 border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Vendedor</Label>
                      <Input value={alunaVendedor} onChange={(e) => setAlunaVendedor(e.target.value)} className="bg-secondary/50 border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/80">Forma de pagamento</Label>
                      <Select value={alunaForma} onValueChange={setAlunaForma}>
                        <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>



              {/* Origens venda */}
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Origens da venda (opcional)</Label>
                <div className="flex flex-wrap gap-2 items-center">
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
                  {!novaOrigemAtiva ? (
                    <button
                      type="button"
                      onClick={() => setNovaOrigemAtiva(true)}
                      className="px-3 py-1.5 text-xs rounded-full border border-dashed border-primary/50 text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Nova origem
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={novaOrigemLabel}
                        onChange={(e) => setNovaOrigemLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); criarOrigem.mutate(); } if (e.key === "Escape") { setNovaOrigemAtiva(false); setNovaOrigemLabel(""); } }}
                        placeholder="Nome da origem"
                        className="h-7 text-xs bg-secondary/50 border-border w-40"
                      />
                      <Button type="button" size="sm" onClick={() => criarOrigem.mutate()} disabled={criarOrigem.isPending || !novaOrigemLabel.trim()} className="h-7 px-2 gold-gradient text-primary-foreground text-xs">
                        {criarOrigem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setNovaOrigemAtiva(false); setNovaOrigemLabel(""); }} className="h-7 px-2 text-xs">
                        ✕
                      </Button>
                    </div>
                  )}
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

              {/* === MENTORIA: TIPO DE PAGAMENTO === */}
              {isMentoria && valorContrato > 0 && (
                <div className="space-y-3">
                  <Label className="text-foreground/80">Como foi o pagamento?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoPagamento("avista");
                        setEntradaLinhas([{ valor: valorContrato, forma: "Pix", taxaPercent: 0 }]);
                      }}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                        tipoPagamento === "avista"
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <strong className="block">💰 À Vista</strong>
                      <p className="text-xs mt-0.5 opacity-70">Pagou o valor total de uma vez</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoPagamento("entrada_parcelas");
                        setEntradaLinhas([{ valor: 0, forma: "Pix", taxaPercent: 0 }]);
                      }}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                        tipoPagamento === "entrada_parcelas"
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <strong className="block">📋 Entrada + Parcelas</strong>
                      <p className="text-xs mt-0.5 opacity-70">Deu uma entrada e vai parcelar o resto</p>
                    </button>
                  </div>

                  {/* === À VISTA: como pagou === */}
                  {tipoPagamento === "avista" && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                      <Label className="text-foreground/80 text-sm">Como foi pago? (Pix, Link de crédito, Hotmart, Kiwify...)</Label>
                      {entradaLinhas.map((linha, idx) => {
                        const liquidoLinha = linha.valor - (linha.valor * (linha.taxaPercent || 0)) / 100;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex gap-2 items-end">
                              <div className="flex-[1.2] space-y-1">
                                {idx === 0 && <Label className="text-xs text-muted-foreground">Forma</Label>}
                                <Select value={linha.forma} onValueChange={(v) => updateEntradaLinha(idx, "forma", v)}>
                                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1 space-y-1">
                                {idx === 0 && <Label className="text-xs text-muted-foreground">Valor</Label>}
                                <Input type="number" step="0.01" value={linha.valor || ""} onChange={(e) => updateEntradaLinha(idx, "valor", Number(e.target.value))} className="bg-secondary/50 border-border" placeholder="0,00" />
                              </div>
                              <div className="w-20 space-y-1">
                                {idx === 0 && <Label className="text-xs text-muted-foreground">Taxa %</Label>}
                                <Input type="number" step="0.01" value={linha.taxaPercent || ""} onChange={(e) => updateEntradaLinha(idx, "taxaPercent", Number(e.target.value))} className="bg-secondary/50 border-border" placeholder="0" />
                              </div>
                              {entradaLinhas.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeEntradaLinha(idx)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {(linha.valor > 0 && linha.taxaPercent > 0) && (
                              <p className="text-[10px] text-muted-foreground ml-1">Líquido dessa forma: <strong className="text-primary">{formatCurrency(liquidoLinha)}</strong></p>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between">
                        <Button type="button" variant="ghost" size="sm" onClick={addEntradaLinha} className="text-xs text-primary">
                          <Plus className="h-3 w-3 mr-1" /> Adicionar forma de pagamento
                        </Button>
                        {entradaLinhas.length > 1 && (
                          <span className="text-xs text-muted-foreground">
                            Total: <strong className="text-foreground">{formatCurrency(entradaValorTotal)}</strong>
                            {Math.abs(entradaValorTotal - valorContrato) > 0.01 && (
                              <span className="text-destructive ml-1">(diferença: {formatCurrency(valorContrato - entradaValorTotal)})</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* === ENTRADA + PARCELAS === */}
                  {tipoPagamento === "entrada_parcelas" && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                      <Label className="text-foreground/80 text-sm">Detalhe da entrada</Label>
                      {entradaLinhas.map((linha, idx) => {
                        const liquidoLinha = linha.valor - (linha.valor * (linha.taxaPercent || 0)) / 100;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex gap-2 items-end">
                              <div className="flex-[1.2] space-y-1">
                                {idx === 0 && <Label className="text-xs text-muted-foreground">Forma</Label>}
                                <Select value={linha.forma} onValueChange={(v) => updateEntradaLinha(idx, "forma", v)}>
                                  <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1 space-y-1">
                                {idx === 0 && <Label className="text-xs text-muted-foreground">Valor</Label>}
                                <Input type="number" step="0.01" value={linha.valor || ""} onChange={(e) => updateEntradaLinha(idx, "valor", Number(e.target.value))} className="bg-secondary/50 border-border" placeholder="0,00" />
                              </div>
                              <div className="w-20 space-y-1">
                                {idx === 0 && <Label className="text-xs text-muted-foreground">Taxa %</Label>}
                                <Input type="number" step="0.01" value={linha.taxaPercent || ""} onChange={(e) => updateEntradaLinha(idx, "taxaPercent", Number(e.target.value))} className="bg-secondary/50 border-border" placeholder="0" />
                              </div>
                              {entradaLinhas.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeEntradaLinha(idx)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {(linha.valor > 0 && linha.taxaPercent > 0) && (
                              <p className="text-[10px] text-muted-foreground ml-1">Líquido dessa forma: <strong className="text-primary">{formatCurrency(liquidoLinha)}</strong></p>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between">
                        <Button type="button" variant="ghost" size="sm" onClick={addEntradaLinha} className="text-xs text-primary">
                          <Plus className="h-3 w-3 mr-1" /> Adicionar forma de pagamento
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Entrada: <strong className="text-foreground">{formatCurrency(entradaValorTotal)}</strong>
                        </span>
                      </div>

                      {saldoRestante > 0 && (
                        <div className="pt-2 border-t border-border/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">Saldo restante: <strong className="text-primary">{formatCurrency(saldoRestante)}</strong></span>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Como será pago o restante?</Label>
                            <Select value={formaPagamentoResto} onValueChange={setFormaPagamentoResto}>
                              <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Non-mentoria payment — mesmas linhas multi-forma */}
              {!isMentoria && valorContrato > 0 && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                  <Label className="text-foreground/80 text-sm">Forma(s) de pagamento</Label>
                  {entradaLinhas.map((linha, idx) => {
                    const liquidoLinha = linha.valor - (linha.valor * (linha.taxaPercent || 0)) / 100;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex gap-2 items-end">
                          <div className="flex-[1.2] space-y-1">
                            {idx === 0 && <Label className="text-xs text-muted-foreground">Forma</Label>}
                            <Select value={linha.forma} onValueChange={(v) => updateEntradaLinha(idx, "forma", v)}>
                              <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-1">
                            {idx === 0 && <Label className="text-xs text-muted-foreground">Valor</Label>}
                            <Input type="number" step="0.01" value={linha.valor || ""} onChange={(e) => updateEntradaLinha(idx, "valor", Number(e.target.value))} className="bg-secondary/50 border-border" placeholder="0,00" />
                          </div>
                          <div className="w-20 space-y-1">
                            {idx === 0 && <Label className="text-xs text-muted-foreground">Taxa %</Label>}
                            <Input type="number" step="0.01" value={linha.taxaPercent || ""} onChange={(e) => updateEntradaLinha(idx, "taxaPercent", Number(e.target.value))} className="bg-secondary/50 border-border" placeholder="0" />
                          </div>
                          {entradaLinhas.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeEntradaLinha(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {(linha.valor > 0 && linha.taxaPercent > 0) && (
                          <p className="text-[10px] text-muted-foreground ml-1">Líquido dessa forma: <strong className="text-primary">{formatCurrency(liquidoLinha)}</strong></p>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between">
                    <Button type="button" variant="ghost" size="sm" onClick={addEntradaLinha} className="text-xs text-primary">
                      <Plus className="h-3 w-3 mr-1" /> Adicionar forma de pagamento
                    </Button>
                    {entradaLinhas.length > 1 && (
                      <span className="text-xs text-muted-foreground">
                        Total: <strong className="text-foreground">{formatCurrency(entradaValorTotal)}</strong>
                        {Math.abs(entradaValorTotal - valorContrato) > 0.01 && (
                          <span className="text-destructive ml-1">(diferença: {formatCurrency(valorContrato - entradaValorTotal)})</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Resumo de Taxa / Líquido (calculado das linhas) */}
              {valorRecebido > 0 && (
                <div className="grid grid-cols-3 gap-4 p-3 rounded-lg bg-secondary/30 border border-border">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxa efetiva</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{taxaPercentEfetivo.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total taxas</p>
                    <p className="text-sm font-semibold text-destructive mt-1">{formatCurrency(taxaValorLinhas)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Líquido total</p>
                    <p className="text-sm font-semibold text-primary mt-1">{formatCurrency(valorLiquidoLinhas)}</p>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Vendedor</Label>
                <Input value={vendedor} onChange={(e) => setVendedor(e.target.value)} placeholder="Quem vendeu" className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Desconto (%)</Label>
                <Input type="number" step="0.01" value={descontoPercent || ""}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    setDescontoPercent(p);
                    setDescontoValor(Number(((valorRecebido * p) / 100).toFixed(2)));
                  }}
                  className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Desconto (R$)</Label>
                <Input type="number" step="0.01" value={descontoValor || ""}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setDescontoValor(v);
                    setDescontoPercent(valorRecebido > 0 ? Number(((v / valorRecebido) * 100).toFixed(2)) : 0);
                  }}
                  className="bg-secondary/50 border-border" />
              </div>
            </div>

            {(categoria ?? "").toLowerCase().includes("f") && (categoria ?? "").toLowerCase().includes("sic") && (
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Frete (R$)</Label>
                <Input type="number" step="0.01" value={freteValor || ""} onChange={(e) => setFreteValor(Number(e.target.value))} className="bg-secondary/50 border-border" />
              </div>
            )}

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
                  Entrada: {formatCurrency(entradaValorTotal)} · Restante via {formaPagamentoResto}
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
