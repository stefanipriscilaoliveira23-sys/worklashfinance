import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Scale, Plus, Trash2, MoreHorizontal, MessageSquarePlus, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const SITUACOES = [
  "Identificada, mas ainda não apurada",
  "Aguardando consulta ao credor",
  "Sem negociação",
  "Negociação pendente",
  "Em negociação",
  "Acordo realizado",
  "Parcelada",
  "Em pagamento",
  "Em atraso após acordo",
  "Contestada",
  "Prescrita ou em análise jurídica",
  "Quitada",
] as const;

const PRECISOES = ["Exato", "Aproximado", "Desatualizado", "Desconhecido", "Aguardando confirmação do credor"] as const;

const PROXIMAS_ACOES = [
  "Identificar o credor atual", "Consultar saldo atualizado", "Solicitar contrato", "Solicitar memória de cálculo",
  "Verificar juros e multas", "Consultar possibilidade de desconto", "Solicitar proposta de negociação",
  "Comparar propostas", "Negociar", "Aguardar recursos", "Buscar orientação jurídica", "Outra",
] as const;

const CANAIS = ["Telefone", "WhatsApp", "E-mail", "Presencial", "Portal do credor", "Carta", "Outro"] as const;

const TIPOS = [
  "Empréstimo bancário", "Financiamento", "Cartão de crédito", "Cheque especial",
  "Fornecedor", "Imposto", "Pessoa física", "Outro",
] as const;

const PRIORIDADES = ["Alta", "Média", "Baixa"] as const;

const PRIORIDADE_STYLE: Record<string, string> = {
  "Alta": "bg-red-100 text-red-800",
  "Média": "bg-amber-100 text-amber-800",
  "Baixa": "bg-slate-100 text-slate-700",
};

// Situação → agrupamento
const A_APURAR = new Set(["Identificada, mas ainda não apurada", "Aguardando consulta ao credor", "Sem negociação", "Negociação pendente"]);
const EM_NEG = new Set(["Em negociação"]);
const ACORDO_ATIVO = new Set(["Acordo realizado", "Parcelada", "Em pagamento", "Em atraso após acordo"]);
const QUITADAS = new Set(["Quitada"]);

const SITUACAO_STYLE: Record<string, string> = {
  "Identificada, mas ainda não apurada": "bg-slate-200 text-slate-800",
  "Aguardando consulta ao credor": "bg-amber-100 text-amber-800",
  "Sem negociação": "bg-orange-100 text-orange-800",
  "Negociação pendente": "bg-orange-100 text-orange-800",
  "Em negociação": "bg-blue-100 text-blue-800",
  "Acordo realizado": "bg-violet-100 text-violet-800",
  "Parcelada": "bg-violet-100 text-violet-800",
  "Em pagamento": "bg-emerald-100 text-emerald-800",
  "Em atraso após acordo": "bg-red-100 text-red-800",
  "Contestada": "bg-yellow-100 text-yellow-800",
  "Prescrita ou em análise jurídica": "bg-zinc-200 text-zinc-800",
  "Quitada": "bg-emerald-200 text-emerald-900",
};

type DividaRow = any;

const emptyForm = {
  descricao: "",
  credor: "",
  credor_nao_identificado: false,
  valor_aproximado: "",
  valor_precisao: "Desconhecido" as (typeof PRECISOES)[number],
  data_valor_informado: "",
  situacao: "Identificada, mas ainda não apurada" as (typeof SITUACOES)[number],
  responsavel: "",
  observacoes: "",
  documentos_disponiveis: "",
  dados_faltando: "",
  proxima_acao: "" as string,
  proxima_acao_prazo: "",
  situacao_contato: "",
  // Gestão ativa
  tipo: "" as string,
  prioridade: "" as string,
  juros_mensal_percentual: "",
  qtd_parcelas_contratadas: "",
  valor_parcela_mensal: "",
  garantia: "",
  saldo_atual: "",
  proximo_vencimento: "",
  despesa_empresa_id: "" as string,
};

const emptyAmort = {
  data_pagamento: new Date().toISOString().split("T")[0],
  valor_pago: "",
  juros_periodo: "",
  observacao: "",
};

const emptyHistorico = {
  data_contato: new Date().toISOString().split("T")[0],
  canal: "" as string,
  pessoa_contatada: "",
  saldo_informado: "",
  desconto_oferecido: "",
  valor_a_vista: "",
  entrada_solicitada: "",
  qtd_parcelas: "",
  valor_parcela: "",
  validade_proposta: "",
  protocolo: "",
  observacoes: "",
};

export default function Dividas() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("todas");

  const { data: dividas, isLoading } = useQuery({
    queryKey: ["dividas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("dividas").select("*").order("criado_em", { ascending: true });
      if (error) throw error;
      return data as DividaRow[];
    },
  });

  const selected = useMemo(() => dividas?.find(d => d.id === selectedId), [dividas, selectedId]);

  const { data: historico } = useQuery({
    queryKey: ["dividas_historico", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("dividas_historico").select("*").eq("divida_id", selectedId).order("data_contato", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createDivida = useMutation({
    mutationFn: async () => {
      if (!form.descricao.trim()) throw new Error("Descrição é obrigatória");
      const payload: any = {
        descricao: form.descricao.trim(),
        credor: form.credor_nao_identificado ? null : (form.credor.trim() || null),
        credor_nao_identificado: form.credor_nao_identificado,
        valor_aproximado: form.valor_aproximado ? Number(form.valor_aproximado) : null,
        valor_precisao: form.valor_precisao,
        data_valor_informado: form.data_valor_informado || null,
        situacao: form.situacao,
        responsavel: form.responsavel.trim() || null,
        observacoes: form.observacoes.trim() || null,
        documentos_disponiveis: form.documentos_disponiveis.trim() || null,
        dados_faltando: form.dados_faltando.trim() || null,
        proxima_acao: form.proxima_acao || null,
        proxima_acao_prazo: form.proxima_acao_prazo || null,
        situacao_contato: form.situacao_contato.trim() || null,
        tipo: form.tipo || null,
        prioridade: form.prioridade || null,
        juros_mensal_percentual: form.juros_mensal_percentual ? Number(form.juros_mensal_percentual) : null,
        qtd_parcelas_contratadas: form.qtd_parcelas_contratadas ? parseInt(form.qtd_parcelas_contratadas) : null,
        valor_parcela_mensal: form.valor_parcela_mensal ? Number(form.valor_parcela_mensal) : null,
        garantia: form.garantia.trim() || null,
        saldo_atual: form.saldo_atual ? Number(form.saldo_atual) : (form.valor_aproximado ? Number(form.valor_aproximado) : null),
        proximo_vencimento: form.proximo_vencimento || null,
        despesa_empresa_id: form.despesa_empresa_id || null,
      };
      const { error } = await (supabase as any).from("dividas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividas"] });
      toast.success("Dívida cadastrada");
      setShowNew(false);
      setForm({ ...emptyForm });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateDivida = useMutation({
    mutationFn: async (patch: any) => {
      if (!selectedId) return;
      const { error } = await (supabase as any).from("dividas").update(patch).eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividas"] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDivida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("dividas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividas"] });
      toast.success("Dívida excluída");
      setSelectedId(null);
    },
  });

  // Indicators
  const list = dividas ?? [];
  const totalConfirmado = list.filter(d => ["Exato"].includes(d.valor_precisao)).reduce((s, d) => s + (Number(d.valor_aproximado) || 0), 0);
  const totalAproximado = list.filter(d => ["Aproximado", "Desatualizado", "Aguardando confirmação do credor"].includes(d.valor_precisao)).reduce((s, d) => s + (Number(d.valor_aproximado) || 0), 0);
  const semValor = list.filter(d => d.valor_precisao === "Desconhecido" || d.valor_aproximado == null).length;

  const naoNegociadas = list.filter(d => A_APURAR.has(d.situacao)).length;
  const emNegociacao = list.filter(d => EM_NEG.has(d.situacao)).length;
  const comAcordo = list.filter(d => ACORDO_ATIVO.has(d.situacao)).length;
  const quitadas = list.filter(d => QUITADAS.has(d.situacao)).length;

  const filtered = useMemo(() => {
    if (tab === "todas") return list;
    if (tab === "apurar") return list.filter(d => A_APURAR.has(d.situacao));
    if (tab === "negociacao") return list.filter(d => EM_NEG.has(d.situacao));
    if (tab === "acordo") return list.filter(d => ACORDO_ATIVO.has(d.situacao));
    if (tab === "quitadas") return list.filter(d => QUITADAS.has(d.situacao));
    return list;
  }, [list, tab]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" /> Dívidas
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Inventário completo — cadastre mesmo sem valor ou credor definido.</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova dívida
        </Button>
      </div>

      {/* Indicadores separados */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <IndicatorCard title="Saldo devedor confirmado" hint="Somente valores marcados como Exato" value={formatCurrency(totalConfirmado)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} highlight />
        <IndicatorCard title="Saldo sujeito à confirmação" hint="Aproximado, desatualizado ou aguardando credor" value={formatCurrency(totalAproximado)} icon={<AlertCircle className="h-4 w-4 text-amber-600" />} />
        <IndicatorCard title="Dívidas sem valor conhecido" hint="Aparecem por quantidade — não somam como zero" value={`${semValor} dívida${semValor === 1 ? "" : "s"}`} icon={<HelpCircle className="h-4 w-4 text-slate-500" />} />
        <IndicatorCard title="Total de credores" value={`${new Set(list.filter(d => d.credor).map(d => d.credor!.toLowerCase())).size}`} hint={`${list.filter(d => d.credor_nao_identificado).length} sem credor identificado`} />
        <IndicatorCard title="Ainda não negociadas" value={String(naoNegociadas)} hint="A apurar / consultar / sem negociação" />
        <IndicatorCard title="Em negociação" value={String(emNegociacao)} />
        <IndicatorCard title="Com acordo ativo" value={String(comAcordo)} />
        <IndicatorCard title="Quitadas" value={String(quitadas)} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({list.length})</TabsTrigger>
          <TabsTrigger value="apurar">A apurar ou negociar ({naoNegociadas})</TabsTrigger>
          <TabsTrigger value="negociacao">Em negociação ({emNegociacao})</TabsTrigger>
          <TabsTrigger value="acordo">Acordos ativos ({comAcordo})</TabsTrigger>
          <TabsTrigger value="quitadas">Quitadas ({quitadas})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              Nenhuma dívida nesta categoria.
            </div>
          ) : tab === "apurar" ? (
            <ApurarTable rows={filtered} onSelect={setSelectedId} onDelete={id => { if (confirm("Excluir esta dívida?")) deleteDivida.mutate(id); }} />
          ) : (
            <StandardTable rows={filtered} onSelect={setSelectedId} onDelete={id => { if (confirm("Excluir esta dívida?")) deleteDivida.mutate(id); }} />
          )}
        </TabsContent>
      </Tabs>

      {/* Nova dívida - cadastro mínimo */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova dívida</DialogTitle>
            <p className="text-xs text-muted-foreground">Só descrição é obrigatória. Preencha o que souber — o resto pode vir depois.</p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome ou descrição da dívida *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Cartão Nubank 2023" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Credor</Label>
                <Input value={form.credor} disabled={form.credor_nao_identificado} onChange={e => setForm(f => ({ ...f, credor: e.target.value }))} placeholder="Banco / empresa" />
                <label className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Checkbox checked={form.credor_nao_identificado} onCheckedChange={v => setForm(f => ({ ...f, credor_nao_identificado: !!v, credor: v ? "" : f.credor }))} />
                  Credor não identificado
                </label>
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Quem cuida" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Valor aproximado (R$)</Label>
                <Input type="number" value={form.valor_aproximado} onChange={e => setForm(f => ({ ...f, valor_aproximado: e.target.value }))} placeholder="Opcional" />
              </div>
              <div>
                <Label>Precisão do valor</Label>
                <Select value={form.valor_precisao} onValueChange={v => setForm(f => ({ ...f, valor_precisao: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRECISOES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data desse valor</Label>
                <Input type="date" value={form.data_valor_informado} onChange={e => setForm(f => ({ ...f, data_valor_informado: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Situação atual</Label>
              <Select value={form.situacao} onValueChange={v => setForm(f => ({ ...f, situacao: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">"Prescrita" e "Em análise jurídica" são classificações informativas — o sistema não conclui que a dívida deixou de ser exigível.</p>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={() => createDivida.mutate()} disabled={createDivida.isPending} className="gold-gradient text-primary-foreground">
              {createDivida.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar dívida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet detalhe */}
      <DetalheSheet
        divida={selected}
        historico={historico ?? []}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        onUpdate={patch => updateDivida.mutate(patch)}
      />
    </div>
  );
}

function IndicatorCard({ title, value, hint, icon, highlight }: { title: string; value: string; hint?: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">{icon}{title}</div>
      <p className={`text-lg font-bold mt-1 ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function ValorCell({ divida }: { divida: DividaRow }) {
  if (divida.valor_aproximado == null) return <span className="text-muted-foreground italic text-xs">Sem valor conhecido</span>;
  const badge = divida.valor_precisao === "Exato"
    ? "bg-emerald-100 text-emerald-800"
    : divida.valor_precisao === "Desconhecido"
    ? "bg-slate-100 text-slate-700"
    : "bg-amber-100 text-amber-800";
  return (
    <div className="flex flex-col">
      <span className="font-medium text-foreground">{formatCurrency(Number(divida.valor_aproximado))}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded w-fit ${badge}`}>{divida.valor_precisao}</span>
    </div>
  );
}

function StandardTable({ rows, onSelect, onDelete }: { rows: DividaRow[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Dívida</th>
              <th className="text-left px-4 py-2 font-medium">Credor</th>
              <th className="text-left px-4 py-2 font-medium">Valor</th>
              <th className="text-left px-4 py-2 font-medium">Situação</th>
              <th className="text-left px-4 py-2 font-medium">Responsável</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(d => (
              <tr key={d.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => onSelect(d.id)}>
                <td className="px-4 py-3 font-medium text-foreground">{d.descricao}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.credor_nao_identificado ? <em>Não identificado</em> : (d.credor || "—")}</td>
                <td className="px-4 py-3"><ValorCell divida={d} /></td>
                <td className="px-4 py-3"><Badge variant="secondary" className={SITUACAO_STYLE[d.situacao] || ""}>{d.situacao}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{d.responsavel || "—"}</td>
                <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><button className="p-1 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelect(d.id)}>Abrir</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(d.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApurarTable({ rows, onSelect, onDelete }: { rows: DividaRow[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">Dívidas a apurar ou negociar</h3>
        <p className="text-xs text-muted-foreground mt-1">Foco em identificar credor, saldo e próxima ação antes de qualquer acordo.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Dívida</th>
              <th className="text-left px-4 py-2 font-medium">Credor</th>
              <th className="text-left px-4 py-2 font-medium">Último valor</th>
              <th className="text-left px-4 py-2 font-medium">Data informado</th>
              <th className="text-left px-4 py-2 font-medium">Responsável</th>
              <th className="text-left px-4 py-2 font-medium">Documentos</th>
              <th className="text-left px-4 py-2 font-medium">Faltando</th>
              <th className="text-left px-4 py-2 font-medium">Próxima ação</th>
              <th className="text-left px-4 py-2 font-medium">Prazo</th>
              <th className="text-left px-4 py-2 font-medium">Contato</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(d => (
              <tr key={d.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => onSelect(d.id)}>
                <td className="px-4 py-3 font-medium text-foreground">{d.descricao}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.credor_nao_identificado ? <em>Não identificado</em> : (d.credor || "—")}</td>
                <td className="px-4 py-3"><ValorCell divida={d} /></td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(d.data_valor_informado)}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.responsavel || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{d.documentos_disponiveis || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{d.dados_faltando || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{d.proxima_acao || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(d.proxima_acao_prazo)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">{d.situacao_contato || "—"}</td>
                <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><button className="p-1 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelect(d.id)}>Abrir</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(d.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalheSheet({ divida, historico, open, onClose, onUpdate }: {
  divida: DividaRow | undefined; historico: any[]; open: boolean; onClose: () => void; onUpdate: (patch: any) => void;
}) {
  const qc = useQueryClient();
  const [showHist, setShowHist] = useState(false);
  const [hist, setHist] = useState({ ...emptyHistorico });

  const addHist = useMutation({
    mutationFn: async () => {
      if (!divida) return;
      const payload: any = {
        divida_id: divida.id,
        data_contato: hist.data_contato,
        canal: hist.canal || null,
        pessoa_contatada: hist.pessoa_contatada.trim() || null,
        saldo_informado: hist.saldo_informado ? Number(hist.saldo_informado) : null,
        desconto_oferecido: hist.desconto_oferecido ? Number(hist.desconto_oferecido) : null,
        valor_a_vista: hist.valor_a_vista ? Number(hist.valor_a_vista) : null,
        entrada_solicitada: hist.entrada_solicitada ? Number(hist.entrada_solicitada) : null,
        qtd_parcelas: hist.qtd_parcelas ? parseInt(hist.qtd_parcelas) : null,
        valor_parcela: hist.valor_parcela ? Number(hist.valor_parcela) : null,
        validade_proposta: hist.validade_proposta || null,
        protocolo: hist.protocolo.trim() || null,
        observacoes: hist.observacoes.trim() || null,
      };
      const { error } = await (supabase as any).from("dividas_historico").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividas_historico", divida?.id] });
      toast.success("Contato registrado — a dívida não foi alterada. Use 'Aceitar e registrar acordo' para oficializar.");
      setShowHist(false);
      setHist({ ...emptyHistorico });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeHist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("dividas_historico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividas_historico", divida?.id] });
    },
  });

  const aceitarAcordo = (h: any) => {
    if (!confirm("Registrar este contato como acordo aceito? A situação da dívida passará para 'Acordo realizado' e o saldo será atualizado.")) return;
    const patch: any = { situacao: "Acordo realizado" };
    if (h.saldo_informado != null) {
      patch.valor_aproximado = h.saldo_informado;
      patch.valor_precisao = "Exato";
      patch.data_valor_informado = h.data_contato;
    }
    onUpdate(patch);
  };

  if (!divida) return null;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{divida.descricao}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Editar campos principais */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldText label="Credor" value={divida.credor || ""} disabled={divida.credor_nao_identificado} onSave={v => onUpdate({ credor: v || null })} placeholder={divida.credor_nao_identificado ? "Não identificado" : ""} />
              <FieldText label="Responsável" value={divida.responsavel || ""} onSave={v => onUpdate({ responsavel: v || null })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FieldText label="Valor aproximado" type="number" value={divida.valor_aproximado ?? ""} onSave={v => onUpdate({ valor_aproximado: v ? Number(v) : null })} />
              <FieldSelect label="Precisão" value={divida.valor_precisao} options={PRECISOES as any} onSave={v => onUpdate({ valor_precisao: v })} />
              <FieldText label="Data do valor" type="date" value={divida.data_valor_informado || ""} onSave={v => onUpdate({ data_valor_informado: v || null })} />
            </div>
            <FieldSelect label="Situação" value={divida.situacao} options={SITUACOES as any} onSave={v => onUpdate({ situacao: v })} />
            <FieldText label="Documentos disponíveis" value={divida.documentos_disponiveis || ""} onSave={v => onUpdate({ documentos_disponiveis: v || null })} />
            <FieldText label="Dados que ainda faltam" value={divida.dados_faltando || ""} onSave={v => onUpdate({ dados_faltando: v || null })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldSelect label="Próxima ação" value={divida.proxima_acao || ""} options={PROXIMAS_ACOES as any} onSave={v => onUpdate({ proxima_acao: v || null })} allowEmpty />
              <FieldText label="Prazo da próxima ação" type="date" value={divida.proxima_acao_prazo || ""} onSave={v => onUpdate({ proxima_acao_prazo: v || null })} />
            </div>
            <FieldText label="Situação do contato com o credor" value={divida.situacao_contato || ""} onSave={v => onUpdate({ situacao_contato: v || null })} />
            <FieldTextarea label="Observações" value={divida.observacoes || ""} onSave={v => onUpdate({ observacoes: v || null })} />
          </div>

          {/* Histórico */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Histórico de contatos e propostas</h3>
              <Button size="sm" variant="outline" onClick={() => setShowHist(true)}><MessageSquarePlus className="h-4 w-4 mr-2" />Registrar contato</Button>
            </div>
            {historico.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum contato registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {historico.map(h => (
                  <div key={h.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{formatDate(h.data_contato)}</span>
                        {h.canal && <Badge variant="secondary" className="text-[10px]">{h.canal}</Badge>}
                        {h.pessoa_contatada && <span className="text-xs text-muted-foreground">com {h.pessoa_contatada}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="text-emerald-700 hover:text-emerald-800" onClick={() => aceitarAcordo(h)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aceitar e registrar acordo
                        </Button>
                        <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => removeHist.mutate(h.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                      {h.saldo_informado != null && <div>Saldo informado: <span className="text-foreground font-medium">{formatCurrency(Number(h.saldo_informado))}</span></div>}
                      {h.desconto_oferecido != null && <div>Desconto: <span className="text-foreground font-medium">{formatCurrency(Number(h.desconto_oferecido))}</span></div>}
                      {h.valor_a_vista != null && <div>À vista: <span className="text-foreground font-medium">{formatCurrency(Number(h.valor_a_vista))}</span></div>}
                      {h.entrada_solicitada != null && <div>Entrada: <span className="text-foreground font-medium">{formatCurrency(Number(h.entrada_solicitada))}</span></div>}
                      {h.qtd_parcelas != null && <div>Parcelas: <span className="text-foreground font-medium">{h.qtd_parcelas}x {h.valor_parcela != null ? formatCurrency(Number(h.valor_parcela)) : ""}</span></div>}
                      {h.validade_proposta && <div>Validade: <span className="text-foreground font-medium">{formatDate(h.validade_proposta)}</span></div>}
                      {h.protocolo && <div>Protocolo: <span className="text-foreground font-medium">{h.protocolo}</span></div>}
                    </div>
                    {h.observacoes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{h.observacoes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dialog adicionar contato */}
        <Dialog open={showHist} onOpenChange={setShowHist}>
          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar contato / proposta</DialogTitle>
              <p className="text-xs text-muted-foreground">Registro informativo. Não altera a dívida automaticamente.</p>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={hist.data_contato} onChange={e => setHist(h => ({ ...h, data_contato: e.target.value }))} /></div>
                <div><Label>Canal</Label>
                  <Select value={hist.canal} onValueChange={v => setHist(h => ({ ...h, canal: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{CANAIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Pessoa/empresa contatada</Label><Input value={hist.pessoa_contatada} onChange={e => setHist(h => ({ ...h, pessoa_contatada: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Saldo informado (R$)</Label><Input type="number" value={hist.saldo_informado} onChange={e => setHist(h => ({ ...h, saldo_informado: e.target.value }))} /></div>
                <div><Label>Desconto oferecido (R$)</Label><Input type="number" value={hist.desconto_oferecido} onChange={e => setHist(h => ({ ...h, desconto_oferecido: e.target.value }))} /></div>
                <div><Label>Valor à vista (R$)</Label><Input type="number" value={hist.valor_a_vista} onChange={e => setHist(h => ({ ...h, valor_a_vista: e.target.value }))} /></div>
                <div><Label>Entrada (R$)</Label><Input type="number" value={hist.entrada_solicitada} onChange={e => setHist(h => ({ ...h, entrada_solicitada: e.target.value }))} /></div>
                <div><Label>Qtd. parcelas</Label><Input type="number" value={hist.qtd_parcelas} onChange={e => setHist(h => ({ ...h, qtd_parcelas: e.target.value }))} /></div>
                <div><Label>Valor da parcela (R$)</Label><Input type="number" value={hist.valor_parcela} onChange={e => setHist(h => ({ ...h, valor_parcela: e.target.value }))} /></div>
                <div><Label>Validade da proposta</Label><Input type="date" value={hist.validade_proposta} onChange={e => setHist(h => ({ ...h, validade_proposta: e.target.value }))} /></div>
                <div><Label>Protocolo</Label><Input value={hist.protocolo} onChange={e => setHist(h => ({ ...h, protocolo: e.target.value }))} /></div>
              </div>
              <div><Label>Observações</Label><Textarea rows={3} value={hist.observacoes} onChange={e => setHist(h => ({ ...h, observacoes: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHist(false)}>Cancelar</Button>
              <Button onClick={() => addHist.mutate()} disabled={addHist.isPending} className="gold-gradient text-primary-foreground">
                {addHist.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar contato"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function FieldText({ label, value, onSave, type = "text", disabled, placeholder }: { label: string; value: any; onSave: (v: string) => void; type?: string; disabled?: boolean; placeholder?: string }) {
  const [v, setV] = useState(String(value ?? ""));
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={v} disabled={disabled} placeholder={placeholder} onChange={e => setV(e.target.value)} onBlur={() => { if (String(value ?? "") !== v) onSave(v); }} />
    </div>
  );
}

function FieldTextarea({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value || "");
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={3} value={v} onChange={e => setV(e.target.value)} onBlur={() => { if ((value || "") !== v) onSave(v); }} />
    </div>
  );
}

function FieldSelect({ label, value, options, onSave, allowEmpty }: { label: string; value: string; options: readonly string[]; onSave: (v: string) => void; allowEmpty?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || undefined} onValueChange={v => onSave(v === "__none__" ? "" : v)}>
        <SelectTrigger><SelectValue placeholder={allowEmpty ? "—" : ""} /></SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value="__none__">—</SelectItem>}
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
