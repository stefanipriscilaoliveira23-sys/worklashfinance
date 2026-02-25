import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMonthRange, getWeekRange, getDaysInMonth } from "@/lib/format";

export function useDashboardData(periodStart?: string, periodEnd?: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.toISOString().split("T")[0];

  // Use provided period or default to current month
  const { start: defaultStart, end: defaultEnd } = getMonthRange(year, month);
  const mesInicio = periodStart ?? defaultStart;
  const mesFim = periodEnd ?? defaultEnd;

  const receitas = useQuery({
    queryKey: ["receitas-mes", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").gte("data", mesInicio).lte("data", mesFim);
      return data ?? [];
    },
  });

  // Derive month/year from period for meta lookup
  const periodDate = new Date(mesInicio + "T00:00:00");
  const metaMonth = periodDate.getMonth() + 1;
  const metaYear = periodDate.getFullYear();

  const meta = useQuery({
    queryKey: ["meta-mes", metaMonth, metaYear],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").eq("mes", metaMonth).eq("ano", metaYear).maybeSingle();
      return data;
    },
  });

  const despesasEmpresa = useQuery({
    queryKey: ["despesas-empresa-mes", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_empresa").select("*").gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim);
      return data ?? [];
    },
  });

  const despesasPessoal = useQuery({
    queryKey: ["despesas-pessoal-mes", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas_pessoal").select("*").gte("data_vencimento", mesInicio).lte("data_vencimento", mesFim);
      return data ?? [];
    },
  });

  const parcelas = useQuery({
    queryKey: ["parcelas-detalhe-mes", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria_detalhe").select("*, parcelas_mentoria(*)");
      return data ?? [];
    },
  });

  const parcelasGeral = useQuery({
    queryKey: ["parcelas-mentoria-all"],
    queryFn: async () => {
      const { data } = await supabase.from("parcelas_mentoria").select("*");
      return data ?? [];
    },
  });

  const ultimasReceitas = useQuery({
    queryKey: ["ultimas-receitas", mesInicio, mesFim],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").gte("data", mesInicio).lte("data", mesFim).order("data", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  // Compute values
  const receitasMes = receitas.data ?? [];
  const allParcelasDet = parcelas.data ?? [];
  const parcelasMesQuitadas = allParcelasDet.filter(p => 
    p.data_vencimento >= mesInicio && p.data_vencimento <= mesFim && p.status === "Quitado"
  );
  const receitaParcelasMes = parcelasMesQuitadas.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);

  const totalBrutoReceitas = receitasMes.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const totalLiquidoReceitas = receitasMes.reduce((s, r) => s + (r.valor_liquido ?? 0), 0);
  const totalBruto = totalBrutoReceitas + receitaParcelasMes;
  const totalLiquido = totalLiquidoReceitas + receitaParcelasMes;

  const metaValor = meta.data?.valor_meta ?? 0;
  const metaPercent = metaValor > 0 ? (totalBruto / metaValor) * 100 : 0;
  const metaFaltante = Math.max(0, metaValor - totalBruto);

  const allDespEmp = despesasEmpresa.data ?? [];
  const allDespPes = despesasPessoal.data ?? [];

  // Fixas do mês
  const fixasEmpresa = allDespEmp
    .filter(d => d.tipo_despesa === "Fixa")
    .reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const proLabore = meta.data?.pro_labore ?? 30000;
  const diasMes = getDaysInMonth(periodDate.getFullYear(), periodDate.getMonth());
  const custoDiario = (fixasEmpresa + proLabore) / diasMes;
  const diaAtual = now.getDate();
  const queimadoHoje = custoDiario * diaAtual;

  // Total de despesas do mês (valor comprometido, não apenas o pago)
  const totalDespesasMes = allDespEmp.reduce((s, d) => s + (d.valor_original ?? 0), 0) +
    allDespPes.reduce((s, d) => s + (d.valor_original ?? 0), 0) + proLabore;
  const lucroProjetado = totalLiquido - totalDespesasMes;

  // Alertas
  const contasAtrasoEmp = allDespEmp.filter(d => d.status === "Em Atraso");
  const contasAtrasoPes = allDespPes.filter(d => d.status === "Em Atraso");
  const totalAtraso = [...contasAtrasoEmp, ...contasAtrasoPes].reduce((s, d) => s + (d.saldo_pendente ?? 0), 0);

  const { start: semInicio, end: semFim } = getWeekRange();
  const vencendoSemana = [...allDespEmp, ...allDespPes].filter(
    d => d.data_vencimento && d.data_vencimento >= semInicio && d.data_vencimento <= semFim && d.status !== "Pago"
  );

  const allParcelas = allParcelasDet;
  const parcelasAtraso = allParcelas.filter(p => p.status === "Atraso" || (p.data_vencimento < today && p.status === "Pendente"));
  const alunosInadimplentes = new Set(parcelasAtraso.map(p => {
    const pm = p.parcelas_mentoria as any;
    return pm?.cliente_email || pm?.cliente_nome;
  }));
  const totalInadimplente = parcelasAtraso.reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);

  // Gráfico faturamento diário (within selected period)
  const faturamentoDiario: { data: string; valor: number }[] = [];
  const startD = new Date(mesInicio + "T00:00:00");
  const endD = new Date(mesFim + "T00:00:00");
  const diffDays = Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  for (let i = 0; i < diffDays; i++) {
    const d = new Date(startD);
    d.setDate(startD.getDate() + i);
    const ds = d.toISOString().split("T")[0];
    const totalReceitas = receitasMes.filter(r => r.data === ds).reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const totalParcelasDia = parcelasMesQuitadas.filter(p => (p.data_pagamento ?? p.data_vencimento) === ds).reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
    faturamentoDiario.push({ data: ds, valor: totalReceitas + totalParcelasDia });
  }

  // Composição por categoria (receitas + parcelas quitadas)
  const composicaoPorCategoria: { name: string; value: number }[] = [];
  const catMap = new Map<string, number>();
  receitasMes.forEach(r => {
    const cat = r.produto_categoria || "Outros";
    catMap.set(cat, (catMap.get(cat) ?? 0) + (r.valor_bruto ?? 0));
  });
  parcelasMesQuitadas.forEach(p => {
    const pm = p.parcelas_mentoria as any;
    const cat = pm?.tipo_mentoria || "Parcelas Mentoria";
    catMap.set(cat, (catMap.get(cat) ?? 0) + (p.valor_real ?? p.valor_sugerido ?? 0));
  });
  catMap.forEach((value, name) => composicaoPorCategoria.push({ name, value }));

  // Métricas mentoria
  const parcelasMes2 = allParcelas.filter(p => p.data_vencimento >= mesInicio && p.data_vencimento <= mesFim);
  const previstaMes = parcelasMes2.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
  const recebidaMes = parcelasMes2.filter(p => p.status === "Quitado").reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
  const saldoReceberMes = previstaMes - recebidaMes;
  const saldoTotalFuturo = allParcelas
    .filter(p => p.data_vencimento > today && p.status !== "Quitado")
    .reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);

  const allParcelasGeral = parcelasGeral.data ?? [];
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixStr = sixMonthsAgo.toISOString().split("T")[0];
  const encerradas = allParcelasGeral.filter(p => p.data_fim_prevista && p.data_fim_prevista >= sixStr && p.data_fim_prevista <= today);
  const renovacoes = allParcelasGeral.filter(p => p.is_renovacao && p.criado_em >= sixStr);
  const taxaRenovacao = encerradas.length > 0 ? (renovacoes.length / encerradas.length) * 100 : 0;

  const totalReceberMes = parcelasMes2.reduce((s, p) => s + (p.valor_real ?? p.valor_sugerido ?? 0), 0);
  const totalAtrasoMentoria = parcelasMes2
    .filter(p => p.status === "Atraso" || (p.data_vencimento < today && p.status === "Pendente"))
    .reduce((s, p) => s + ((p.valor_real ?? p.valor_sugerido ?? 0) - (p.valor_pago_parcial ?? 0)), 0);
  const taxaInadimplencia = totalReceberMes > 0 ? (totalAtrasoMentoria / totalReceberMes) * 100 : 0;

  const isLoading = receitas.isLoading || meta.isLoading || despesasEmpresa.isLoading || despesasPessoal.isLoading || parcelas.isLoading;

  return {
    isLoading,
    totalBruto, totalLiquido,
    metaValor, metaPercent, metaFaltante,
    custoDiario, queimadoHoje,
    lucroProjetado,
    contasAtrasoQtd: contasAtrasoEmp.length + contasAtrasoPes.length,
    totalAtraso,
    vencendoSemana,
    alunosInadimplentesQtd: alunosInadimplentes.size,
    totalInadimplente,
    faturamentoDiario,
    composicaoPorCategoria,
    previstaMes, recebidaMes, saldoReceberMes, saldoTotalFuturo,
    taxaRenovacao, taxaInadimplencia,
    ultimasReceitas: ultimasReceitas.data ?? [],
    qtdParcelasQuitadasMes: parcelasMesQuitadas.length,
    receitaParcelasMes,
    qtdReceitasMes: receitasMes.length,
    mesInicio, mesFim,
  };
}
