import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getMonthRange, getDaysInMonth } from "@/lib/format";
import { Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORY_COLS: { key: string; label: string; cats: string[] }[] = [
  { key: "parcelas", label: "Parcelas", cats: [] }, // special: from parcelas_mentoria_detalhe
  { key: "mentorias", label: "Mentorias", cats: ["Mentoria Outsider", "Mentoria Digital Beauty"] },
  { key: "cursos", label: "Cursos Digitais", cats: ["Curso/Formação", "Ferramenta", "Apostila"] },
  { key: "renovacoes", label: "Renovações", cats: ["Renovação Mentoria"] },
  { key: "fisicos", label: "Produtos Físicos", cats: ["Produto Físico"] },
  { key: "outras", label: "Outras Entradas", cats: ["Consultoria Premium", "Consultoria Express", "Outros"] },
];

const FIXED_CATEGORIES: { key: string; label: string; cats: string[] }[] = [
  { key: "aluguel", label: "Aluguel", cats: ["Aluguel Comercial"] },
  { key: "salarios", label: "Salários", cats: ["Salário Funcionário"] },
  { key: "assinaturas", label: "Assinaturas", cats: ["Plataforma Digital", "IA", "Internet"] },
  { key: "outrosFixos", label: "Outros Fixos", cats: ["Contabilidade", "Energia", "Planos e Benefícios", "Transportadora", "Serviços Terceiros"] },
];

export default function PLDiario() {
  const queryClient = useQueryClient();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());

  const { start, end } = getMonthRange(ano, mes);
  const diasMes = getDaysInMonth(ano, mes);
  const mesLabel = new Date(ano, mes).toLocaleString("pt-BR", { month: "long", year: "numeric" });

  const { data: receitas, isLoading: lr } = useQuery({
    queryKey: ["pl-receitas", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").gte("data", start).lte("data", end);
      return data ?? [];
    },
  });

  const { data: parcelasDetalhe } = useQuery({
    queryKey: ["pl-parcelas-det", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria_detalhe").select("*").gte("data_pagamento", start).lte("data_pagamento", end).eq("status", "Quitado");
      return data ?? [];
    },
  });

  const { data: despesasEmp } = useQuery({
    queryKey: ["pl-desp-emp", start, end],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*");
      return data ?? [];
    },
  });

  const { data: meta } = useQuery({
    queryKey: ["pl-meta", mes + 1, ano],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").eq("mes", mes + 1).eq("ano", ano).maybeSingle();
      return data;
    },
  });

  const [observacoes, setObservacoes] = useState<Record<string, string>>({});

  const allReceitas = receitas ?? [];
  const allParcelas = parcelasDetalhe ?? [];
  const allDespEmp = despesasEmp ?? [];
  const proLabore = meta?.pro_labore ?? 30000;

  // Fixed expenses (monthly) rationed daily
  const fixosMap = useMemo(() => {
    const fixas = allDespEmp.filter(d => d.tipo_despesa === "Fixa");
    const result: Record<string, number> = { aluguel: 0, salarios: 0, assinaturas: 0, outrosFixos: 0 };
    fixas.forEach(d => {
      const fc = FIXED_CATEGORIES.find(fc => fc.cats.includes(d.categoria));
      if (fc) result[fc.key] += (d.valor_original ?? 0);
      else result.outrosFixos += (d.valor_original ?? 0);
    });
    // Add pro-labore to salarios
    result.salarios += proLabore;
    return result;
  }, [allDespEmp, proLabore]);

  const fixosDiarios = useMemo(() => {
    const r: Record<string, number> = {};
    Object.entries(fixosMap).forEach(([k, v]) => { r[k] = v / diasMes; });
    return r;
  }, [fixosMap, diasMes]);

  const totalFixoDiario = Object.values(fixosDiarios).reduce((s, v) => s + v, 0);

  // Variable costs by day
  const variavelPorDia = useMemo(() => {
    const map: Record<string, { impostos: number; comissoes: number; trafego: number; taxas: number; outros: number }> = {};
    const variaveis = allDespEmp.filter(d => d.tipo_despesa === "Variável");
    variaveis.forEach(d => {
      const dia = d.data_pagamento ?? d.data_vencimento;
      if (!dia || dia < start || dia > end) return;
      if (!map[dia]) map[dia] = { impostos: 0, comissoes: 0, trafego: 0, taxas: 0, outros: 0 };
      if (d.categoria === "Tráfego Pago") map[dia].trafego += (d.valor_pago_total ?? 0);
      else map[dia].outros += (d.valor_pago_total ?? 0);
    });
    // Taxas from receitas
    allReceitas.forEach(r => {
      if (!map[r.data]) map[r.data] = { impostos: 0, comissoes: 0, trafego: 0, taxas: 0, outros: 0 };
      map[r.data].taxas += (r.taxa_plataforma_valor ?? 0);
    });
    return map;
  }, [allDespEmp, allReceitas, start, end]);

  // Build rows
  const rows = useMemo(() => {
    let saldoAcumulado = 0;
    const result = [];
    for (let dia = 1; dia <= diasMes; dia++) {
      const ds = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const receitasDia = allReceitas.filter(r => r.data === ds);
      const parcelasDia = allParcelas.filter(p => p.data_pagamento === ds);

      const rev: Record<string, number> = {};
      CATEGORY_COLS.forEach(c => { rev[c.key] = 0; });
      rev.parcelas = parcelasDia.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
      receitasDia.forEach(r => {
        const cat = r.produto_categoria ?? "Outros";
        const col = CATEGORY_COLS.find(c => c.cats.includes(cat));
        if (col) rev[col.key] += (r.valor_bruto ?? 0);
        else rev.outras += (r.valor_bruto ?? 0);
      });
      const totalReceita = Object.values(rev).reduce((s, v) => s + v, 0);

      const vc = variavelPorDia[ds] ?? { impostos: 0, comissoes: 0, trafego: 0, taxas: 0, outros: 0 };
      const totalCustosVar = vc.impostos + vc.comissoes + vc.trafego + vc.taxas + vc.outros;
      const lucroBruto = totalReceita - totalCustosVar;
      const lucroLiquido = lucroBruto - totalFixoDiario;
      saldoAcumulado += lucroLiquido;

      result.push({
        dia, ds, ...rev, totalReceita,
        impostos: vc.impostos, comissoes: vc.comissoes, trafego: vc.trafego, taxas: vc.taxas, outrosVar: vc.outros,
        totalCustosVar, lucroBruto,
        ...Object.fromEntries(Object.entries(fixosDiarios).map(([k, v]) => [`fix_${k}`, v])),
        totalFixoDiario, lucroLiquido, saldoAcumulado,
      });
    }
    return result;
  }, [allReceitas, allParcelas, variavelPorDia, fixosDiarios, totalFixoDiario, diasMes, ano, mes]);

  // Totals
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    if (rows.length === 0) return t;
    const numKeys = Object.keys(rows[0]).filter(k => k !== "dia" && k !== "ds" && typeof rows[0][k as keyof typeof rows[0]] === "number");
    numKeys.forEach(k => { t[k] = rows.reduce((s, r) => s + ((r as any)[k] ?? 0), 0); });
    return t;
  }, [rows]);

  const exportCSV = () => {
    const headers = ["Data", "Parcelas", "Mentorias", "Cursos Digitais", "Renovações", "Produtos Físicos", "Outras Entradas", "Total Receita", "Impostos", "Comissões", "Tráfego Pago", "Taxas Plataformas", "Outros Custos Var.", "Total Custos Var.", "Lucro Bruto", "Aluguel", "Salários", "Assinaturas", "Outros Fixos", "Total Fixos", "Lucro Líquido", "Saldo Acumulado", "Observações"];
    const csvRows = rows.map(r => [
      r.ds, r.parcelas, r.mentorias, r.cursos, r.renovacoes, r.fisicos, r.outras, r.totalReceita,
      r.impostos, r.comissoes, r.trafego, r.taxas, r.outrosVar, r.totalCustosVar, r.lucroBruto,
      (r as any).fix_aluguel, (r as any).fix_salarios, (r as any).fix_assinaturas, (r as any).fix_outrosFixos,
      r.totalFixoDiario, r.lucroLiquido, r.saldoAcumulado, observacoes[r.ds] ?? ""
    ].map(v => typeof v === "number" ? v.toFixed(2) : `"${v}"`).join(","));
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pl-diario-${ano}-${mes + 1}.csv`;
    a.click();
  };

  const prevMonth = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const nextMonth = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

  if (lr) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const cellCls = "px-2 py-1.5 text-xs text-right whitespace-nowrap";
  const hCls = "px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">P&L Diário</h1>
        <Button onClick={exportCSV} variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground">
          <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="text-muted-foreground"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium text-foreground capitalize">{mesLabel}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="text-muted-foreground"><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-2 py-2 text-[10px] font-medium text-muted-foreground text-left whitespace-nowrap sticky left-0 bg-secondary/30 z-10">Data</th>
                {CATEGORY_COLS.map(c => <th key={c.key} className={hCls}>{c.label}</th>)}
                <th className={`${hCls} text-primary`}>Total Receita</th>
                <th className={hCls}>Impostos</th>
                <th className={hCls}>Comissões</th>
                <th className={hCls}>Tráfego</th>
                <th className={hCls}>Taxas Plat.</th>
                <th className={hCls}>Outros Var.</th>
                <th className={`${hCls} text-destructive/70`}>Total Var.</th>
                <th className={`${hCls} text-primary`}>Lucro Bruto</th>
                {FIXED_CATEGORIES.map(f => <th key={f.key} className={hCls}>{f.label}</th>)}
                <th className={`${hCls} text-destructive/70`}>Total Fixos</th>
                <th className={`${hCls} font-bold`}>Lucro Líq.</th>
                <th className={`${hCls} font-bold`}>Saldo Acum.</th>
                <th className="px-2 py-2 text-[10px] font-medium text-muted-foreground text-left whitespace-nowrap">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.dia} className="border-b border-border/30 hover:bg-surface-hover transition-colors">
                  <td className="px-2 py-1.5 text-xs font-medium text-foreground sticky left-0 bg-card z-10">{String(r.dia).padStart(2, "0")}/{String(mes + 1).padStart(2, "0")}</td>
                  {CATEGORY_COLS.map(c => <td key={c.key} className={cellCls}>{(r as any)[c.key] ? formatCurrency((r as any)[c.key]) : "—"}</td>)}
                  <td className={`${cellCls} text-primary font-medium`}>{formatCurrency(r.totalReceita)}</td>
                  <td className={cellCls}>{r.impostos ? formatCurrency(r.impostos) : "—"}</td>
                  <td className={cellCls}>{r.comissoes ? formatCurrency(r.comissoes) : "—"}</td>
                  <td className={cellCls}>{r.trafego ? formatCurrency(r.trafego) : "—"}</td>
                  <td className={cellCls}>{r.taxas ? formatCurrency(r.taxas) : "—"}</td>
                  <td className={cellCls}>{r.outrosVar ? formatCurrency(r.outrosVar) : "—"}</td>
                  <td className={`${cellCls} text-destructive`}>{formatCurrency(r.totalCustosVar)}</td>
                  <td className={`${cellCls} text-primary`}>{formatCurrency(r.lucroBruto)}</td>
                  {FIXED_CATEGORIES.map(f => <td key={f.key} className={`${cellCls} text-muted-foreground`}>{formatCurrency((r as any)[`fix_${f.key}`])}</td>)}
                  <td className={`${cellCls} text-destructive`}>{formatCurrency(r.totalFixoDiario)}</td>
                  <td className={`${cellCls} font-bold ${r.lucroLiquido >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatCurrency(r.lucroLiquido)}</td>
                  <td className={`${cellCls} font-bold ${r.saldoAcumulado >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatCurrency(r.saldoAcumulado)}</td>
                  <td className="px-1 py-1">
                    <Input
                      value={observacoes[r.ds] ?? ""}
                      onChange={e => setObservacoes(o => ({ ...o, [r.ds]: e.target.value }))}
                      className="h-6 text-[10px] bg-transparent border-border/50 w-24"
                      placeholder="..."
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-secondary/40 font-bold">
                <td className="px-2 py-2 text-xs text-foreground sticky left-0 bg-secondary/40 z-10">TOTAL</td>
                {CATEGORY_COLS.map(c => <td key={c.key} className={cellCls}>{formatCurrency(totals[c.key] ?? 0)}</td>)}
                <td className={`${cellCls} text-primary`}>{formatCurrency(totals.totalReceita ?? 0)}</td>
                <td className={cellCls}>{formatCurrency(totals.impostos ?? 0)}</td>
                <td className={cellCls}>{formatCurrency(totals.comissoes ?? 0)}</td>
                <td className={cellCls}>{formatCurrency(totals.trafego ?? 0)}</td>
                <td className={cellCls}>{formatCurrency(totals.taxas ?? 0)}</td>
                <td className={cellCls}>{formatCurrency(totals.outrosVar ?? 0)}</td>
                <td className={`${cellCls} text-destructive`}>{formatCurrency(totals.totalCustosVar ?? 0)}</td>
                <td className={`${cellCls} text-primary`}>{formatCurrency(totals.lucroBruto ?? 0)}</td>
                {FIXED_CATEGORIES.map(f => <td key={f.key} className={`${cellCls} text-muted-foreground`}>{formatCurrency(fixosMap[f.key] ?? 0)}</td>)}
                <td className={`${cellCls} text-destructive`}>{formatCurrency(Object.values(fixosMap).reduce((s, v) => s + v, 0))}</td>
                <td className={`${cellCls} ${(totals.lucroLiquido ?? 0) >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatCurrency(totals.lucroLiquido ?? 0)}</td>
                <td className={`${cellCls} ${(totals.saldoAcumulado ?? 0) >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatCurrency(rows[rows.length - 1]?.saldoAcumulado ?? 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
