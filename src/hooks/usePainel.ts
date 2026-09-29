import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Motor de cálculo do Painel.
 *
 * Definições que a Stéfani usa (e que valem para o app inteiro):
 *
 *  - **Venda nova**: uma linha em `receitas`, contada pela data da venda.
 *  - **Total vendido**: o contrato fechado. Numa mentoria parcelada o
 *    `valor_bruto` guarda só a entrada, e o contrato inteiro fica em
 *    `valor_contrato`. Então vendido = coalesce(valor_contrato, valor_bruto).
 *  - **Total recebido**: dinheiro que caiu na conta = entradas e vendas à vista
 *    (valor_bruto das receitas) + parcelas quitadas com data de pagamento.
 *  - **Bruto x líquido**: `valor_bruto` está sempre em real, inclusive nas
 *    vendas importadas em dólar. `valor_liquido` é o que sobrou depois da taxa
 *    da plataforma. A diferença entre os dois é a taxa.
 *
 * O campo `valor_em_brl` existe na tabela mas NÃO deve ser usado: é cópia do
 * bruto e seis lançamentos antigos vieram zerados.
 */

const DIA = 86400000;

export type LinhaReceita = {
  id: string; data: string; produto_nome: string | null;
  produto_categoria: string | null; plataforma: string | null;
  valor_bruto: number | null; valor_liquido: number | null;
  valor_contrato: number | null; taxa_plataforma_valor: number | null;
  cliente_nome: string | null; cliente_email: string | null;
  origens_venda: string[] | null; vendedor: string | null;
  data_fim_mentoria: string | null; forma_pagamento: string | null;
};

export type LinhaParcela = {
  id: string; numero_parcela: number; data_vencimento: string;
  valor_sugerido: number | null; valor_real: number | null;
  valor_pago_parcial: number | null; status: string | null;
  data_pagamento: string | null; encargos_isentos: boolean | null;
  parcelas_mentoria: {
    cliente_nome: string | null; cliente_email: string | null;
    tipo_mentoria: string | null; quant_parcelas: number | null;
    is_renovacao: boolean | null; numero_contrato: string | null;
    status_geral: string | null; valor_total: number | null;
  } | null;
};

/** Uma linha de `parcelas_mentoria`: o contrato, não a parcela. */
export type LinhaContrato = {
  id: string; cliente_nome: string | null; cliente_email: string | null;
  tipo_mentoria: string | null; valor_total: number | null;
  quant_parcelas: number | null; is_renovacao: boolean | null;
  data_inicio: string | null; data_fim_prevista: string | null;
  data_termino_mentoria_anterior: string | null;
  status_geral: string | null; receita_id: string | null;
  numero_contrato: string | null;
};

export type LinhaDespesa = {
  id: string; descricao: string | null; categoria: string | null;
  tipo_despesa: string | null; valor_original: number | null;
  valor_pago_total: number | null; saldo_pendente: number | null;
  data_vencimento: string | null; data_pagamento: string | null;
  status: string | null;
};

/** O Supabase devolve no máximo 1000 linhas por vez. Receitas já passa disso. */
async function buscarTudo<T>(tabela: string, colunas: string): Promise<T[]> {
  const passo = 1000;
  const acumulado: T[] = [];
  for (let inicio = 0; ; inicio += passo) {
    const { data, error } = await supabase
      .from(tabela as never)
      .select(colunas)
      .range(inicio, inicio + passo - 1);
    if (error) throw error;
    const lote = (data ?? []) as unknown as T[];
    acumulado.push(...lote);
    if (lote.length < passo) break;
  }
  return acumulado;
}

export function chaveMes(d: Date | string): string {
  const s = typeof d === "string" ? d : d.toISOString().slice(0, 10);
  return s.slice(0, 7);
}

export function limitesDoMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${chave}-01`,
    fim: `${chave}-${String(ultimo).padStart(2, "0")}`,
    ano, mes, diasNoMes: ultimo,
  };
}

export function mesAnterior(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

export function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[mes - 1]}/${String(ano).slice(2)}`;
}

export function valorDaParcela(p: LinhaParcela): number {
  return p.valor_real ?? p.valor_sugerido ?? 0;
}

/**
 * Quanto a venda vale como contrato fechado.
 *
 * Numa mentoria parcelada, `valor_bruto` guarda só a entrada e o contrato
 * inteiro fica em `valor_contrato`. Só que a importação das plataformas grava
 * `valor_contrato = 0` em vez de deixar vazio (1.383 linhas assim), e uma
 * linha antiga ficou com contrato menor que a própria entrada. Pegar o maior
 * dos dois resolve os dois defeitos de uma vez: o contrato nunca pode ser
 * menor que o que já foi pago dele.
 */
export function valorVendido(r: { valor_bruto: number | null; valor_contrato: number | null }): number {
  return Math.max(r.valor_contrato ?? 0, r.valor_bruto ?? 0);
}

/** Quanto ainda falta receber de uma parcela em aberto. */
export function saldoDaParcela(p: LinhaParcela): number {
  return Math.max(0, valorDaParcela(p) - (p.valor_pago_parcial ?? 0));
}

export type Bloco = {
  vendasQtd: number;
  vendasBruto: number;
  vendasLiquido: number;
  vendido: number;
  parcelasQtd: number;
  parcelasValor: number;
  recebidoBruto: number;
  recebidoLiquido: number;
  taxas: number;
};

function montarBloco(receitas: LinhaReceita[], parcelas: LinhaParcela[]): Bloco {
  const vendasBruto = receitas.reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
  const vendasLiquido = receitas.reduce((s, r) => s + (r.valor_liquido ?? r.valor_bruto ?? 0), 0);
  const vendido = receitas.reduce((s, r) => s + valorVendido(r), 0);
  const parcelasValor = parcelas.reduce((s, p) => s + valorDaParcela(p), 0);
  return {
    vendasQtd: receitas.length,
    vendasBruto,
    vendasLiquido,
    vendido,
    parcelasQtd: parcelas.length,
    parcelasValor,
    recebidoBruto: vendasBruto + parcelasValor,
    // Parcela de mentoria é PIX/transferência direta, não passa por plataforma:
    // entra igual no bruto e no líquido.
    recebidoLiquido: vendasLiquido + parcelasValor,
    taxas: vendasBruto - vendasLiquido,
  };
}

export function usePainel(mesSelecionado: string) {
  const receitasQ = useQuery({
    queryKey: ["painel-receitas"],
    queryFn: () => buscarTudo<LinhaReceita>(
      "receitas",
      "id,data,produto_nome,produto_categoria,plataforma,valor_bruto,valor_liquido,valor_contrato,taxa_plataforma_valor,cliente_nome,cliente_email,origens_venda,vendedor,data_fim_mentoria,forma_pagamento",
    ),
    staleTime: 60_000,
  });

  const parcelasQ = useQuery({
    queryKey: ["painel-parcelas"],
    queryFn: () => buscarTudo<LinhaParcela>(
      "parcelas_mentoria_detalhe",
      "id,numero_parcela,data_vencimento,valor_sugerido,valor_real,valor_pago_parcial,status,data_pagamento,encargos_isentos,parcelas_mentoria(cliente_nome,cliente_email,tipo_mentoria,quant_parcelas,is_renovacao,numero_contrato,status_geral,valor_total)",
    ),
    staleTime: 60_000,
  });

  const contratosQ = useQuery({
    queryKey: ["painel-contratos"],
    queryFn: () => buscarTudo<LinhaContrato>(
      "parcelas_mentoria",
      "id,cliente_nome,cliente_email,tipo_mentoria,valor_total,quant_parcelas,is_renovacao,data_inicio,data_fim_prevista,data_termino_mentoria_anterior,status_geral,receita_id,numero_contrato",
    ),
    staleTime: 60_000,
  });

  const despEmpresaQ = useQuery({
    queryKey: ["painel-despesas-empresa"],
    queryFn: () => buscarTudo<LinhaDespesa>(
      "despesas_empresa",
      "id,descricao,categoria,tipo_despesa,valor_original,valor_pago_total,saldo_pendente,data_vencimento,data_pagamento,status",
    ),
    staleTime: 60_000,
  });

  const despPessoalQ = useQuery({
    queryKey: ["painel-despesas-pessoal"],
    queryFn: () => buscarTudo<LinhaDespesa>(
      "despesas_pessoal",
      "id,descricao,categoria,tipo_despesa,valor_original,valor_pago_total,saldo_pendente,data_vencimento,data_pagamento,status",
    ),
    staleTime: 60_000,
  });

  const metasQ = useQuery({
    queryKey: ["painel-metas"],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const carregando = receitasQ.isLoading || parcelasQ.isLoading || contratosQ.isLoading
    || despEmpresaQ.isLoading || despPessoalQ.isLoading || metasQ.isLoading;
  const erro = receitasQ.error ?? parcelasQ.error ?? contratosQ.error
    ?? despEmpresaQ.error ?? despPessoalQ.error ?? metasQ.error;

  const receitas = receitasQ.data ?? [];
  const parcelas = parcelasQ.data ?? [];
  const contratos = contratosQ.data ?? [];
  const despEmpresa = despEmpresaQ.data ?? [];
  const despPessoal = despPessoalQ.data ?? [];
  const metas = metasQ.data ?? [];

  const hojeISO = new Date().toISOString().slice(0, 10);
  const m = limitesDoMes(mesSelecionado);
  const anterior = limitesDoMes(mesAnterior(mesSelecionado));

  // ---- recortes -----------------------------------------------------------
  const noMes = (chave: string) => receitas.filter(r => r.data?.slice(0, 7) === chave);
  const parcelasPagasEm = (chave: string) => parcelas.filter(
    p => p.status === "Quitado" && !!p.data_pagamento && p.data_pagamento.slice(0, 7) === chave,
  );

  const chaveAnterior = mesAnterior(mesSelecionado);
  const receitasMes = noMes(mesSelecionado);
  const parcelasMes = parcelasPagasEm(mesSelecionado);
  const mesAtual = montarBloco(receitasMes, parcelasMes);
  const mesPassado = montarBloco(noMes(chaveAnterior), parcelasPagasEm(chaveAnterior));

  // Comparação justa: o mês passado até o mesmo dia do mês. Comparar um mês
  // pela metade com um mês inteiro só serve para assustar à toa.
  const ehMesCorrente = mesSelecionado === hojeISO.slice(0, 7);
  const diaDeHoje = ehMesCorrente ? Number(hojeISO.slice(8, 10)) : m.diasNoMes;
  const corteAnterior = `${chaveAnterior}-${String(Math.min(diaDeHoje, anterior.diasNoMes)).padStart(2, "0")}`;
  const mesPassadoAteAqui = montarBloco(
    noMes(chaveAnterior).filter(r => r.data <= corteAnterior),
    parcelasPagasEm(chaveAnterior).filter(p => (p.data_pagamento ?? "") <= corteAnterior),
  );

  // ---- categorias ---------------------------------------------------------
  // `vendido` é contrato fechado no mês (só venda nova conta).
  // `recebido` é dinheiro que entrou no mês, e aqui a parcela TEM que entrar:
  // os R$ 9.000 da consultoria da Alana caíram em 16/09 como parcela, e sem
  // isso a categoria Consultorias mostrava R$ 9.000 a menos do que entrou.
  // A parcela sabe a que categoria pertence pelo `tipo_mentoria` do contrato,
  // que usa os mesmos nomes de `produto_categoria`.
  type Cat = { qtd: number; bruto: number; liquido: number; vendido: number; recebido: number; deParcela: number };
  const vazioCat = (): Cat => ({ qtd: 0, bruto: 0, liquido: 0, vendido: 0, recebido: 0, deParcela: 0 });
  const porCategoria = new Map<string, Cat>();
  receitasMes.forEach(r => {
    const chave = r.produto_categoria || "Sem categoria";
    const atual = porCategoria.get(chave) ?? vazioCat();
    atual.qtd += 1;
    atual.bruto += r.valor_bruto ?? 0;
    atual.liquido += r.valor_liquido ?? r.valor_bruto ?? 0;
    atual.vendido += valorVendido(r);
    atual.recebido += r.valor_bruto ?? 0;
    porCategoria.set(chave, atual);
  });
  parcelasMes.forEach(p => {
    const chave = p.parcelas_mentoria?.tipo_mentoria || "Parcelas de mentoria";
    const atual = porCategoria.get(chave) ?? vazioCat();
    atual.recebido += valorDaParcela(p);
    atual.deParcela += valorDaParcela(p);
    porCategoria.set(chave, atual);
  });
  const categorias = [...porCategoria.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => Math.max(b.vendido, b.recebido) - Math.max(a.vendido, a.recebido));

  // ---- produtos e clientes ------------------------------------------------
  const porProduto = new Map<string, { qtd: number; valor: number }>();
  receitasMes.forEach(r => {
    const chave = r.produto_nome || "Sem produto";
    const atual = porProduto.get(chave) ?? { qtd: 0, valor: 0 };
    atual.qtd += 1;
    atual.valor += valorVendido(r);
    porProduto.set(chave, atual);
  });
  const produtos = [...porProduto.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.valor - a.valor);

  // Dependência de cliente: últimos 12 meses de dinheiro recebido.
  const corte12 = new Date(Date.now() - 365 * DIA).toISOString().slice(0, 10);
  const recebidoPorCliente = new Map<string, number>();
  receitas.filter(r => r.data >= corte12).forEach(r => {
    const chave = (r.cliente_nome || "Sem nome").trim();
    recebidoPorCliente.set(chave, (recebidoPorCliente.get(chave) ?? 0) + (r.valor_bruto ?? 0));
  });
  parcelas.filter(p => p.status === "Quitado" && (p.data_pagamento ?? "") >= corte12).forEach(p => {
    const chave = (p.parcelas_mentoria?.cliente_nome || "Sem nome").trim();
    recebidoPorCliente.set(chave, (recebidoPorCliente.get(chave) ?? 0) + valorDaParcela(p));
  });
  const clientes12m = [...recebidoPorCliente.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  const total12m = clientes12m.reduce((s, c) => s + c.valor, 0);
  const top5Clientes = clientes12m.slice(0, 5);
  const concentracaoTop5 = total12m > 0 ? (top5Clientes.reduce((s, c) => s + c.valor, 0) / total12m) * 100 : 0;

  // ---- carteira contratada (o que ainda vai vencer) -----------------------
  const emAberto = parcelas.filter(p => p.status !== "Quitado" && p.status !== "Cancelado");
  const aVencer = emAberto.filter(p => p.data_vencimento >= hojeISO);
  const vencidas = emAberto.filter(p => p.data_vencimento < hojeISO);
  const carteiraFutura = aVencer.reduce((s, p) => s + saldoDaParcela(p), 0);
  const emAtrasoValor = vencidas.reduce((s, p) => s + saldoDaParcela(p), 0);
  const alunasEmAtraso = new Set(vencidas.map(p => p.parcelas_mentoria?.cliente_email || p.parcelas_mentoria?.cliente_nome)).size;

  // O atraso total é de todos os meses, porque parcela vencida em julho continua
  // vencida hoje. Mas numa tela navegada por mês isso confunde, então existe
  // também o recorte do mês escolhido.
  const vencidasDoMes = vencidas.filter(p => p.data_vencimento.slice(0, 7) === mesSelecionado);
  const emAtrasoDoMes = vencidasDoMes.reduce((s, p) => s + saldoDaParcela(p), 0);
  const alunasEmAtrasoDoMes = new Set(
    vencidasDoMes.map(p => p.parcelas_mentoria?.cliente_email || p.parcelas_mentoria?.cliente_nome),
  ).size;

  /**
   * Dependência que importa: só quem tem ENTREGA ATIVA.
   *
   * Cliente que já terminou a mentoria não é risco de perder: ela já foi. O que
   * assusta é a aluna que ainda está sendo atendida e ainda tem parcela para
   * pagar, porque é dela que o dinheiro dos próximos meses depende.
   *
   * "Ativa" = tem contrato de mentoria ou consultoria com data de término em
   * aberto (hoje ou no futuro).
   */
  const chaveCliente = (nome: string | null | undefined, email: string | null | undefined) =>
    (email || nome || "sem nome").toLowerCase().trim();

  type Ativo = {
    nome: string; servico: string; termina: string | null;
    jaRecebido: number; aReceber: number; contrato: number;
  };
  const ativos = new Map<string, Ativo>();

  // Pela venda: data_fim_mentoria ainda no futuro.
  receitas
    .filter(r => r.data_fim_mentoria && r.data_fim_mentoria >= hojeISO)
    .forEach(r => {
      const chave = chaveCliente(r.cliente_nome, r.cliente_email);
      const atual = ativos.get(chave) ?? {
        nome: r.cliente_nome ?? "Sem nome",
        servico: r.produto_nome ?? r.produto_categoria ?? "Sem produto",
        termina: r.data_fim_mentoria, jaRecebido: 0, aReceber: 0, contrato: 0,
      };
      atual.jaRecebido += r.valor_bruto ?? 0;
      atual.contrato += valorVendido(r);
      if (!atual.termina || (r.data_fim_mentoria ?? "") > atual.termina) atual.termina = r.data_fim_mentoria;
      ativos.set(chave, atual);
    });

  // Pelo contrato: data_fim_prevista ainda no futuro.
  contratos
    .filter(c => c.data_fim_prevista && c.data_fim_prevista >= hojeISO)
    .forEach(c => {
      const chave = chaveCliente(c.cliente_nome, c.cliente_email);
      const atual = ativos.get(chave) ?? {
        nome: c.cliente_nome ?? "Sem nome",
        servico: c.tipo_mentoria ?? "Mentoria",
        termina: c.data_fim_prevista, jaRecebido: 0, aReceber: 0, contrato: c.valor_total ?? 0,
      };
      if (!atual.termina || (c.data_fim_prevista ?? "") > atual.termina) atual.termina = c.data_fim_prevista;
      ativos.set(chave, atual);
    });

  // Quanto cada ativa ainda vai pagar.
  aVencer.forEach(p => {
    const chave = chaveCliente(p.parcelas_mentoria?.cliente_nome, p.parcelas_mentoria?.cliente_email);
    const atual = ativos.get(chave);
    if (atual) atual.aReceber += saldoDaParcela(p);
  });

  const clientesAtivos = [...ativos.values()]
    .map(a => ({ ...a, peso: a.jaRecebido + a.aReceber }))
    .sort((a, b) => b.peso - a.peso);
  const totalAtivos = clientesAtivos.reduce((s, c) => s + c.peso, 0);
  const top5Ativos = clientesAtivos.slice(0, 5);
  const concentracaoAtivos = totalAtivos > 0
    ? (top5Ativos.reduce((s, c) => s + c.peso, 0) / totalAtivos) * 100 : 0;

  /**
   * Dependência por SERVIÇO: qual produto sustenta o faturamento.
   *
   * Conta 12 meses de dinheiro que entrou, somando venda e parcela. A parcela
   * é atribuída pelo `tipo_mentoria` do contrato, igual nas categorias.
   */
  const porServico = new Map<string, { recebido: number; clientes: Set<string> }>();
  receitas.filter(r => r.data >= corte12).forEach(r => {
    const nome = r.produto_nome || r.produto_categoria || "Sem produto";
    const atual = porServico.get(nome) ?? { recebido: 0, clientes: new Set<string>() };
    atual.recebido += r.valor_bruto ?? 0;
    atual.clientes.add(chaveCliente(r.cliente_nome, r.cliente_email));
    porServico.set(nome, atual);
  });
  parcelas
    .filter(p => p.status === "Quitado" && (p.data_pagamento ?? "") >= corte12)
    .forEach(p => {
      const nome = p.parcelas_mentoria?.tipo_mentoria || "Parcelas de mentoria";
      const atual = porServico.get(nome) ?? { recebido: 0, clientes: new Set<string>() };
      atual.recebido += valorDaParcela(p);
      atual.clientes.add(chaveCliente(p.parcelas_mentoria?.cliente_nome, p.parcelas_mentoria?.cliente_email));
      porServico.set(nome, atual);
    });
  const totalServicos = [...porServico.values()].reduce((s, v) => s + v.recebido, 0);
  const servicos12m = [...porServico.entries()]
    .map(([nome, v]) => ({
      nome, recebido: v.recebido, clientes: v.clientes.size,
      pct: totalServicos > 0 ? (v.recebido / totalServicos) * 100 : 0,
    }))
    .sort((a, b) => b.recebido - a.recebido);

  // Todo mês que ainda tem parcela para vencer, sem cortar em 6.
  // Se cortasse, a soma das barras não bateria com o cartão da carteira
  // contratada, e a diferença ficaria sem explicação na tela.
  const mapaProximos = new Map<string, { valor: number; qtd: number }>();
  aVencer.forEach(p => {
    const chave = p.data_vencimento.slice(0, 7);
    const atual = mapaProximos.get(chave) ?? { valor: 0, qtd: 0 };
    atual.valor += saldoDaParcela(p);
    atual.qtd += 1;
    mapaProximos.set(chave, atual);
  });
  const proximosMeses = [...mapaProximos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([chave, v]) => ({ mes: chave, rotulo: rotuloMes(chave), ...v }));

  // Concentração de vencimento: em que dia do mês o dinheiro está amontoado.
  // Conta o mês INTEIRO, inclusive os dias que já passaram, senão no fim do mês
  // sobra só o resto e parece que não havia nada para receber.
  type DiaVenc = { dia: number; recebido: number; aReceber: number; total: number };
  const porDiaVencimento = new Map<number, DiaVenc>();
  const pegaDia = (iso: string) => {
    const dia = Number(iso.slice(8, 10));
    const atual = porDiaVencimento.get(dia) ?? { dia, recebido: 0, aReceber: 0, total: 0 };
    porDiaVencimento.set(dia, atual);
    return atual;
  };
  parcelas
    .filter(p => p.data_vencimento?.slice(0, 7) === mesSelecionado && p.status !== "Cancelado")
    .forEach(p => {
      const d = pegaDia(p.data_vencimento);
      if (p.status === "Quitado") {
        d.recebido += valorDaParcela(p);
      } else {
        d.aReceber += saldoDaParcela(p);
      }
      d.total = d.recebido + d.aReceber;
    });
  const diasVencimento = [...porDiaVencimento.values()].sort((a, b) => b.total - a.total);
  const diasVencimentoOrdenados = [...porDiaVencimento.values()].sort((a, b) => a.dia - b.dia);

  // ---- despesas e resultado ----------------------------------------------
  const despesasDoMes = (lista: LinhaDespesa[]) =>
    lista.filter(d => d.data_vencimento?.slice(0, 7) === mesSelecionado);
  const empMes = despesasDoMes(despEmpresa);
  const pesMes = despesasDoMes(despPessoal);

  const totalEmpresa = empMes.reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const totalPessoal = pesMes.reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const fixasEmpresa = empMes.filter(d => d.tipo_despesa === "Fixa").reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const pagoEmpresa = empMes.filter(d => d.status === "Pago").reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const aPagarEmpresa = empMes.filter(d => d.status !== "Pago").reduce((s, d) => s + (d.saldo_pendente ?? d.valor_original ?? 0), 0);
  const atrasadasEmpresa = empMes.filter(d => d.status === "Em Atraso");
  const venceHoje = [...empMes, ...pesMes].filter(d => d.data_vencimento === hojeISO && d.status !== "Pago");

  /**
   * Empresa e vida pessoal, separadas sem contar nada duas vezes.
   *
   * O pró-labore é uma despesa FIXA de verdade da empresa (categoria
   * "Pró-labore", lançada pela função `sincronizar_pro_labore`), com valor
   * igual ao TOTAL das despesas pessoais do mês, fixas mais variáveis: é quanto
   * ela tirou da empresa, e ela tirou tudo que gastou. Então ele já está dentro
   * de `totalEmpresa`.
   *
   * Isso obriga um cuidado: se a gente descontasse os gastos pessoais em cima
   * de um custo de empresa que já inclui o pró-labore, o mesmo dinheiro sairia
   * duas vezes. Por isso a conta combinada usa o custo OPERACIONAL, sem o
   * pró-labore, e aí desconta a vida pessoal inteira.
   *
   *   EMPRESA   entrou − (operacional + pró-labore) = resultado da empresa
   *   VOCÊ      pró-labore − gastos pessoais        = sobra pessoal
   *   OS DOIS   entrou − operacional − gastos pessoais = sobrou de verdade
   */
  const proLaboreLancado = empMes
    .filter(d => d.categoria === "Pró-labore")
    .reduce((s, d) => s + (d.valor_original ?? 0), 0);

  const custosEmpresa = totalEmpresa;                             // com pró-labore
  const custosOperacionais = totalEmpresa - proLaboreLancado;      // sem pró-labore
  const retiradaSocios = proLaboreLancado > 0 ? proLaboreLancado : totalPessoal;
  const gastoPessoal = totalPessoal;

  // Para onde a retirada foi. É o detalhe que ela pediu na conta da vida:
  // quanto do que tirou foi para compromisso que repete e quanto foi para gasto
  // do dia a dia.
  const pessoalFixas = pesMes
    .filter(d => d.tipo_despesa === "Fixa")
    .reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const pessoalVariaveis = gastoPessoal - pessoalFixas;

  // O pago precisa vir separado por fatia. Mostrar só o pago do total, embaixo
  // da linha das fixas, faz parecer que o pago é das fixas: em setembro dava
  // "fixas R$ 20.241" com "pago R$ 22.683" logo abaixo, que é impossível.
  const somaPaga = (lista: LinhaDespesa[]) => lista
    .filter(d => d.status === "Pago")
    .reduce((s, d) => s + (d.valor_original ?? 0), 0);
  const pessoalFixasPago = somaPaga(pesMes.filter(d => d.tipo_despesa === "Fixa"));
  const pessoalVariaveisPago = somaPaga(pesMes.filter(d => d.tipo_despesa !== "Fixa"));
  const pessoalPago = pessoalFixasPago + pessoalVariaveisPago;
  const pessoalEmAberto = gastoPessoal - pessoalPago;

  const resultadoEmpresa = mesAtual.recebidoLiquido - custosEmpresa;
  // Quando o pró-labore está lançado ele é igual ao gasto pessoal, então
  // `sobraPessoal` fica zero por construção e não serve de leitura. Só tem
  // sentido nos meses antigos, sem pró-labore lançado.
  const sobraPessoal = proLaboreLancado - gastoPessoal;
  const sobrouDeVerdade = mesAtual.recebidoLiquido - custosOperacionais - gastoPessoal;

  const margemEmpresa = mesAtual.recebidoLiquido > 0 ? (resultadoEmpresa / mesAtual.recebidoLiquido) * 100 : 0;
  const margemReal = mesAtual.recebidoLiquido > 0 ? (sobrouDeVerdade / mesAtual.recebidoLiquido) * 100 : 0;
  const pesoDaRetirada = mesAtual.recebidoLiquido > 0 ? (retiradaSocios / mesAtual.recebidoLiquido) * 100 : 0;
  // Quanto do pró-labore ela já consumiu. Passar de 100% significa que gastou
  // mais do que combinou tirar.
  const usoDoProLabore = proLaboreLancado > 0 ? (gastoPessoal / proLaboreLancado) * 100 : 0;
  // Nome antigo mantido para não quebrar nada que ainda leia `resultado`.
  const resultado = sobrouDeVerdade;
  const margem = margemReal;

  const despesasPorCategoria = new Map<string, number>();
  empMes.forEach(d => {
    const chave = d.categoria || "Sem categoria";
    despesasPorCategoria.set(chave, (despesasPorCategoria.get(chave) ?? 0) + (d.valor_original ?? 0));
  });
  const categoriasDespesa = [...despesasPorCategoria.entries()]
    .map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);

  /**
   * Para onde o dinheiro da empresa vai.
   *
   * Quando o pró-labore está lançado, ele já aparece em `categoriasDespesa`
   * como categoria de verdade, e não pode ser injetado de novo. Só nos meses
   * antigos, que não têm pró-labore lançado, a gente mostra o gasto pessoal
   * como uma linha estimada para a conta não ficar mentirosa.
   */
  const saidasDaEmpresa = (proLaboreLancado > 0
    ? categoriasDespesa.map(c => ({ ...c, ehRetirada: c.nome === "Pró-labore" }))
    : [
        ...(gastoPessoal > 0 ? [{ nome: "Pró-labore (estimado pelo gasto pessoal)", valor: gastoPessoal, ehRetirada: true }] : []),
        ...categoriasDespesa.map(c => ({ ...c, ehRetirada: false })),
      ]
  ).sort((a, b) => b.valor - a.valor);
  const totalSaidas = custosOperacionais + gastoPessoal;

  // Gasto pessoal por categoria, a visão dela da própria vida.
  const pessoalPorCategoria = new Map<string, number>();
  pesMes.forEach(d => {
    const chave = d.categoria || "Sem categoria";
    pessoalPorCategoria.set(chave, (pessoalPorCategoria.get(chave) ?? 0) + (d.valor_original ?? 0));
  });
  const categoriasPessoal = [...pessoalPorCategoria.entries()]
    .map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);

  // Ponto de equilíbrio: quanto do mês já está pago pelo que entrou.
  const ticketMedio = mesAtual.vendasQtd > 0 ? mesAtual.vendido / mesAtual.vendasQtd : 0;
  const faltaParaEmpatar = Math.max(0, custosOperacionais - mesAtual.recebidoLiquido);
  const faltaParaEmpatarComRetirada = Math.max(0, totalSaidas - mesAtual.recebidoLiquido);
  const vendasParaEmpatar = ticketMedio > 0 ? Math.ceil(faltaParaEmpatar / ticketMedio) : 0;
  const diaDoEquilibrio = (() => {
    if (totalEmpresa <= 0) return null;
    const ordenado = [
      ...receitasMes.map(r => ({ data: r.data, valor: r.valor_liquido ?? r.valor_bruto ?? 0 })),
      ...parcelasMes.map(p => ({ data: p.data_pagamento as string, valor: valorDaParcela(p) })),
    ].sort((a, b) => a.data.localeCompare(b.data));
    let acumulado = 0;
    for (const e of ordenado) {
      acumulado += e.valor;
      if (acumulado >= totalEmpresa) return e.data;
    }
    return null;
  })();

  // ---- meta e projeção ----------------------------------------------------
  const metaLinha = metas.find((x: any) => x.mes === m.mes && x.ano === m.ano) as any;
  const metaValor = metaLinha?.valor_meta ?? 0;
  const metaPercent = metaValor > 0 ? (mesAtual.recebidoBruto / metaValor) * 100 : 0;
  const metaFalta = Math.max(0, metaValor - mesAtual.recebidoBruto);
  const diasRestantes = ehMesCorrente ? Math.max(0, m.diasNoMes - diaDeHoje) : 0;
  const precisaPorDia = diasRestantes > 0 ? metaFalta / diasRestantes : 0;
  const ritmoDiario = diaDeHoje > 0 ? mesAtual.recebidoBruto / diaDeHoje : 0;
  const projecaoFimDoMes = ehMesCorrente ? ritmoDiario * m.diasNoMes : mesAtual.recebidoBruto;

  // ---- histórico de 12 meses ---------------------------------------------
  const historico: {
    mes: string; rotulo: string; recebido: number; vendido: number;
    despesas: number; pessoal: number; proLabore: number;
    resultado: number; sobrouDeVerdade: number;
  }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(m.ano, m.mes - 1 - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = montarBloco(noMes(chave), parcelasPagasEm(chave));
    const soma = (lista: LinhaDespesa[]) => lista
      .filter(x => x.data_vencimento?.slice(0, 7) === chave)
      .reduce((s, x) => s + (x.valor_original ?? 0), 0);
    const desp = soma(despEmpresa);
    const pes = soma(despPessoal);
    // Mesmo cuidado do mês atual: a barra de custo da empresa não pode conter o
    // pró-labore, senão ele apareceria duas vezes junto com a barra do pessoal.
    const proLab = despEmpresa
      .filter(x => x.data_vencimento?.slice(0, 7) === chave && x.categoria === "Pró-labore")
      .reduce((s, x) => s + (x.valor_original ?? 0), 0);
    const operacional = desp - proLab;
    historico.push({
      mes: chave, rotulo: rotuloMes(chave),
      recebido: b.recebidoBruto, vendido: b.vendido,
      despesas: operacional, pessoal: pes, proLabore: proLab,
      resultado: b.recebidoLiquido - desp,
      sobrouDeVerdade: b.recebidoLiquido - operacional - pes,
    });
  }

  // ---- entrada de dinheiro dia a dia no mês -------------------------------
  const porDia: { dia: string; rotulo: string; vendas: number; parcelas: number; total: number; acumulado: number }[] = [];
  let acumulado = 0;
  for (let i = 1; i <= m.diasNoMes; i++) {
    const dia = `${mesSelecionado}-${String(i).padStart(2, "0")}`;
    const v = receitasMes.filter(r => r.data === dia).reduce((s, r) => s + (r.valor_bruto ?? 0), 0);
    const p = parcelasMes.filter(x => x.data_pagamento === dia).reduce((s, x) => s + valorDaParcela(x), 0);
    acumulado += v + p;
    porDia.push({ dia, rotulo: String(i), vendas: v, parcelas: p, total: v + p, acumulado });
  }

  // ---- inadimplência: como as alunas pagam de verdade ---------------------
  // Olha 12 meses de parcelas que JÁ VENCERAM. Uma parcela que ainda não venceu
  // não diz nada sobre pontualidade.
  const inicio12 = new Date(Date.now() - 365 * DIA).toISOString().slice(0, 10);
  const jaVenceram = parcelas.filter(
    p => p.data_vencimento >= inicio12 && p.data_vencimento <= hojeISO && p.status !== "Cancelado",
  );
  const diasEntre = (de: string, ate: string) =>
    Math.round((new Date(ate + "T00:00:00").getTime() - new Date(de + "T00:00:00").getTime()) / DIA);

  const pagasEmDia = jaVenceram.filter(p => p.status === "Quitado" && (p.data_pagamento ?? "") <= p.data_vencimento);
  const pagasAtrasadas = jaVenceram.filter(p => p.status === "Quitado" && (p.data_pagamento ?? "") > p.data_vencimento);
  const naoPagas = jaVenceram.filter(p => p.status !== "Quitado");
  const atrasos = pagasAtrasadas
    .map(p => diasEntre(p.data_vencimento, p.data_pagamento as string))
    .sort((a, b) => a - b);
  const medianaAtraso = atrasos.length ? atrasos[Math.floor(atrasos.length / 2)] : 0;
  const mediaAtraso = atrasos.length ? atrasos.reduce((a, b) => a + b, 0) / atrasos.length : 0;

  const chaveAluna = (p: LinhaParcela) =>
    (p.parcelas_mentoria?.cliente_email || p.parcelas_mentoria?.cliente_nome || "sem nome").toLowerCase().trim();
  const alunasNoPeriodo = new Set(jaVenceram.map(chaveAluna));
  const alunasQueAtrasaram = new Set(pagasAtrasadas.map(chaveAluna));
  // Parou de pagar = tem parcela vencida há mais de 30 dias e ainda aberta.
  const paradas = naoPagas.filter(p => diasEntre(p.data_vencimento, hojeISO) > 30);
  const alunasQuePararam = new Set(paradas.map(chaveAluna));

  const inadimplencia = {
    parcelasQueVenceram: jaVenceram.length,
    pagasEmDia: pagasEmDia.length,
    pagasAtrasadas: pagasAtrasadas.length,
    naoPagas: naoPagas.length,
    pctEmDia: jaVenceram.length ? (pagasEmDia.length / jaVenceram.length) * 100 : 0,
    pctAtrasada: jaVenceram.length ? (pagasAtrasadas.length / jaVenceram.length) * 100 : 0,
    pctNaoPaga: jaVenceram.length ? (naoPagas.length / jaVenceram.length) * 100 : 0,
    mediaAtraso, medianaAtraso,
    piorAtraso: atrasos.length ? atrasos[atrasos.length - 1] : 0,
    atrasouAte7: pagasAtrasadas.filter(p => diasEntre(p.data_vencimento, p.data_pagamento as string) <= 7).length,
    atrasou8a30: pagasAtrasadas.filter(p => {
      const d = diasEntre(p.data_vencimento, p.data_pagamento as string);
      return d > 7 && d <= 30;
    }).length,
    atrasouMais30: pagasAtrasadas.filter(p => diasEntre(p.data_vencimento, p.data_pagamento as string) > 30).length,
    alunas: alunasNoPeriodo.size,
    alunasQueAtrasaram: alunasQueAtrasaram.size,
    alunasQuePararam: alunasQuePararam.size,
    pctAlunasQueAtrasaram: alunasNoPeriodo.size ? (alunasQueAtrasaram.size / alunasNoPeriodo.size) * 100 : 0,
    pctAlunasQuePararam: alunasNoPeriodo.size ? (alunasQuePararam.size / alunasNoPeriodo.size) * 100 : 0,
    valorParado: paradas.reduce((s, p) => s + saldoDaParcela(p), 0),
    desde: inicio12,
  };

  // ---- renovações ---------------------------------------------------------
  const renovacoesMes = receitasMes.filter(
    r => r.produto_categoria === "Renovações" || /renova/i.test(r.produto_nome ?? ""),
  );

  /**
   * A esteira de renovação, contrato por contrato.
   *
   * A regra é simples e dá para conferir na mão: para cada aluna, os contratos
   * são colocados em ordem de início. Um contrato conta como RENOVADO quando
   * existe, para a mesma aluna, um contrato posterior marcado como renovação.
   * Esse contrato posterior é a renovação dele.
   *
   * "Dias para renovar" conta do fim do contrato antigo até o início da
   * renovação. Número negativo é bom: ela renovou ANTES de terminar.
   */
  const receitaPorId = new Map(receitas.map(r => [r.id, r]));
  const porAluna = new Map<string, LinhaContrato[]>();
  contratos.forEach(c => {
    const chave = (c.cliente_email || c.cliente_nome || "sem nome").toLowerCase().trim();
    const lista = porAluna.get(chave) ?? [];
    lista.push(c);
    porAluna.set(chave, lista);
  });

  const fimDoContrato = (c: LinhaContrato): string | null =>
    c.data_fim_prevista ?? (c.receita_id ? receitaPorId.get(c.receita_id)?.data_fim_mentoria ?? null : null);

  type Esteira = {
    id: string; aluna: string; produto: string; categoria: string;
    valor: number; inicio: string | null; fim: string | null;
    renovado: boolean; dataRenovacao: string | null; valorRenovacao: number;
    diasParaRenovar: number | null; diasQueFaltam: number | null;
    ehRenovacao: boolean;
  };

  const esteiraRenovacao: Esteira[] = [];
  porAluna.forEach(lista => {
    const ordenada = [...lista].sort((a, b) =>
      (a.data_inicio ?? "9999").localeCompare(b.data_inicio ?? "9999"));
    ordenada.forEach((c, i) => {
      const renovacao = ordenada.slice(i + 1).find(x => x.is_renovacao === true) ?? null;
      const fim = fimDoContrato(c);
      const receita = c.receita_id ? receitaPorId.get(c.receita_id) : undefined;
      esteiraRenovacao.push({
        id: c.id,
        aluna: c.cliente_nome ?? "Sem nome",
        produto: receita?.produto_nome ?? c.tipo_mentoria ?? "Mentoria",
        categoria: c.tipo_mentoria ?? "Sem categoria",
        valor: c.valor_total ?? 0,
        inicio: c.data_inicio,
        fim,
        renovado: !!renovacao,
        dataRenovacao: renovacao?.data_inicio ?? null,
        valorRenovacao: renovacao?.valor_total ?? 0,
        diasParaRenovar: renovacao?.data_inicio && fim
          ? diasEntre(fim, renovacao.data_inicio)
          : null,
        diasQueFaltam: fim && fim >= hojeISO ? diasEntre(hojeISO, fim) : null,
        ehRenovacao: c.is_renovacao === true,
      });
    });
  });

  // Elegível = contrato que já terminou (ou termina em até 60 dias) e ainda não
  // tem renovação. É essa a base do "quantas podem renovar".
  const limiteElegivel = new Date(Date.now() + 60 * DIA).toISOString().slice(0, 10);
  const elegiveis = esteiraRenovacao.filter(
    e => !e.renovado && e.fim && e.fim <= limiteElegivel,
  ).sort((a, b) => (a.fim ?? "").localeCompare(b.fim ?? ""));

  const jaVencidosSemRenovar = elegiveis.filter(e => (e.fim ?? "") < hojeISO);
  const renovados12m = esteiraRenovacao.filter(
    e => e.renovado && (e.dataRenovacao ?? "") >= inicio12,
  );
  const terminaram12m = esteiraRenovacao.filter(
    e => e.fim && e.fim >= inicio12 && e.fim <= hojeISO,
  );
  const taxaRenovacao12m = terminaram12m.length
    ? (terminaram12m.filter(e => e.renovado).length / terminaram12m.length) * 100
    : 0;
  const diasRenovacao = renovados12m
    .map(e => e.diasParaRenovar)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const tempoMedioRenovar = diasRenovacao.length
    ? diasRenovacao.reduce((a, b) => a + b, 0) / diasRenovacao.length
    : 0;
  const tempoMedianoRenovar = diasRenovacao.length
    ? diasRenovacao[Math.floor(diasRenovacao.length / 2)]
    : 0;

  const renovacao = {
    esteira: esteiraRenovacao.sort((a, b) => (b.fim ?? "").localeCompare(a.fim ?? "")),
    elegiveis, jaVencidosSemRenovar,
    renovados12m, terminaram12m, taxaRenovacao12m,
    tempoMedioRenovar, tempoMedianoRenovar,
    valorRenovado12m: renovados12m.reduce((s, e) => s + e.valorRenovacao, 0),
    valorPerdido: jaVencidosSemRenovar.reduce((s, e) => s + e.valor, 0),
    desde: inicio12,
  };
  // Mentorias que terminam nos próximos 60 dias: janela real de renovação.
  const limite60 = new Date(Date.now() + 60 * DIA).toISOString().slice(0, 10);
  const vencendoEm60 = receitas
    .filter(r => r.data_fim_mentoria && r.data_fim_mentoria >= hojeISO && r.data_fim_mentoria <= limite60)
    .sort((a, b) => (a.data_fim_mentoria ?? "").localeCompare(b.data_fim_mentoria ?? ""));

  // ---- origem da venda ----------------------------------------------------
  const porOrigem = new Map<string, { qtd: number; valor: number }>();
  receitasMes.forEach(r => {
    const origens = r.origens_venda?.length ? r.origens_venda : ["Sem origem"];
    origens.forEach(o => {
      const atual = porOrigem.get(o) ?? { qtd: 0, valor: 0 };
      atual.qtd += 1;
      atual.valor += valorVendido(r);
      porOrigem.set(o, atual);
    });
  });
  const totalPorOrigem = [...porOrigem.values()].reduce((s, v) => s + v.valor, 0);
  const origens = [...porOrigem.entries()]
    .map(([nome, v]) => ({
      nome, ...v,
      ticket: v.qtd > 0 ? v.valor / v.qtd : 0,
      pct: totalPorOrigem > 0 ? (v.valor / totalPorOrigem) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  return {
    carregando, erro,
    hojeISO, ehMesCorrente, diaDeHoje, diasRestantes,
    mes: m, rotuloMesAtual: rotuloMes(mesSelecionado), rotuloMesAnterior: rotuloMes(mesAnterior(mesSelecionado)),
    mesAtual, mesPassado, mesPassadoAteAqui,
    categorias, produtos, origens,
    top5Clientes, concentracaoTop5, total12m,
    clientesAtivos, top5Ativos, concentracaoAtivos, totalAtivos,
    servicos12m, totalServicos,
    carteiraFutura, emAtrasoValor, alunasEmAtraso, aVencer, vencidas,
    vencidasDoMes, emAtrasoDoMes, alunasEmAtrasoDoMes,
    proximosMeses, diasVencimento, diasVencimentoOrdenados,
    totalEmpresa, totalPessoal, fixasEmpresa, pagoEmpresa, aPagarEmpresa,
    atrasadasEmpresa, venceHoje, categoriasDespesa, categoriasPessoal,
    custosEmpresa, custosOperacionais, proLaboreLancado, retiradaSocios, gastoPessoal,
    pessoalFixas, pessoalVariaveis, pessoalPago, pessoalEmAberto,
    pessoalFixasPago, pessoalVariaveisPago,
    resultadoEmpresa, sobraPessoal, sobrouDeVerdade,
    margemEmpresa, margemReal, pesoDaRetirada, usoDoProLabore,
    saidasDaEmpresa, totalSaidas,
    inadimplencia, renovacao,
    resultado, margem, ticketMedio, faltaParaEmpatar, faltaParaEmpatarComRetirada,
    vendasParaEmpatar, diaDoEquilibrio,
    metaValor, metaPercent, metaFalta, precisaPorDia, ritmoDiario, projecaoFimDoMes,
    historico, porDia,
    renovacoesMes, vencendoEm60,
    receitasMes, parcelasMes,
  };
}

export type Painel = ReturnType<typeof usePainel>;
