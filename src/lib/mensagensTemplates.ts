// 7 templates de mensagens de cobrança/comprovante para clientes.
// O conteúdo abaixo é LITERAL (respeitar quebras de linha, emojis e espaços).

import { computeParcela, formatBRL, formatDataBR, primeiroNome, getInstallmentValue } from "./parcelaCalc";

export type TemplateKey =
  | "pre_vencimento"
  | "vencimento"
  | "atraso_1"
  | "atraso_2"
  | "advertencia"
  | "eduzz_falhou"
  | "comprovante";

export interface TemplateMeta {
  key: TemplateKey;
  titulo: string;
  preview: string;
  emoji: string;
}

export const TEMPLATES_META: TemplateMeta[] = [
  { key: "pre_vencimento", titulo: "Pré-vencimento",            preview: "Lembrete amigável 1 dia antes",     emoji: "📅" },
  { key: "vencimento",     titulo: "Vencimento (no dia)",       preview: "Confirmação no dia do vencimento",  emoji: "📆" },
  { key: "atraso_1",       titulo: "Atrasada — 1ª tentativa",   preview: "Cobrança com multa e juros",         emoji: "⏱️" },
  { key: "atraso_2",       titulo: "Atrasada — 2ª tentativa",   preview: "Cobrança setor financeiro",         emoji: "⚠️" },
  { key: "advertencia",    titulo: "Advertência cancelamento",  preview: "Risco de cancelamento (cláusula 2.4)", emoji: "🚨" },
  { key: "eduzz_falhou",   titulo: "Eduzz falhou no cartão",    preview: "Pedido de novo link de pagamento",  emoji: "💳" },
  { key: "comprovante",    titulo: "Comprovante de pagamento",  preview: "Recibo após pagamento confirmado",  emoji: "✅" },
];

export interface TemplateContext {
  // Cliente
  cliente_nome?: string | null;
  // Contrato
  produto?: string | null;
  num_contrato?: string | null;
  total_parcelas?: number | null;
  saldo_contrato?: number | null;
  // Parcela
  parcela_atual?: number | null;
  data_vencimento?: string | null;
  valor_parcela?: number | null;
  saldo_restante?: number | null;
  status?: string | null;
  // Pagamento (opcional — usado no comprovante)
  valor_pago?: number | null;
  data_pagamento?: string | null;
  desconto?: number | null;
  status_pagamento?: "Parcial" | "Total" | null;
}

export interface RenderedVars {
  nome: string;
  produto: string;
  num_contrato: string;
  parcela_atual: string;
  total_parcelas: string;
  parcelas_restantes: string;
  valor_parcela: string;
  saldo_restante: string;
  saldo_contrato: string;
  data_vencimento: string;
  dias_atraso: string;
  multa: string;
  juros: string;
  multa_juros: string;
  valor_total: string;
  valor_pago: string;
  status_pagamento: string;
  data_pagamento: string;
  desconto: string;
}

export function buildVars(ctx: TemplateContext): RenderedVars {
  const valorParcela = ctx.valor_parcela ?? 0;
  const calc = computeParcela(
    {
      valor_real: valorParcela,
      data_vencimento: ctx.data_vencimento ?? null,
      status: ctx.status ?? null,
    },
    ctx.desconto ?? 0
  );

  const totalParc = ctx.total_parcelas ?? 0;
  const parcAtual = ctx.parcela_atual ?? 0;
  const restantes = Math.max(0, totalParc - parcAtual);

  return {
    nome: primeiroNome(ctx.cliente_nome),
    produto: ctx.produto ?? "",
    num_contrato: ctx.num_contrato ?? "",
    parcela_atual: parcAtual ? String(parcAtual) : "",
    total_parcelas: totalParc ? String(totalParc) : "",
    parcelas_restantes: String(restantes),
    valor_parcela: formatBRL(valorParcela),
    saldo_restante: formatBRL(ctx.saldo_restante ?? 0),
    saldo_contrato: formatBRL(ctx.saldo_contrato ?? 0),
    data_vencimento: formatDataBR(ctx.data_vencimento),
    dias_atraso: String(calc.diasAtraso),
    multa: formatBRL(calc.multa),
    juros: formatBRL(calc.juros),
    multa_juros: formatBRL(calc.multaJuros),
    valor_total: formatBRL(calc.valorTotalAtualizado),
    valor_pago: formatBRL(ctx.valor_pago ?? 0),
    status_pagamento: ctx.status_pagamento ?? "",
    data_pagamento: formatDataBR(ctx.data_pagamento),
    desconto: formatBRL(ctx.desconto ?? 0),
  };
}

const TEMPLATES: Record<TemplateKey, string> = {
  pre_vencimento: `Oie {nome}, tudo bem? 💙

Passando pra te lembrar que amanhã vence sua parcela:

📦 Produto: {produto}
🔢 Contrato: {num_contrato}
🔢 Parcela: {parcela_atual}/{total_parcelas}
📆 Vencimento: {data_vencimento}
💵 Valor: R$ {valor_parcela}

Você prefere já deixar tudo certo hoje ou te aviso amanhã? 😊
Qualquer coisa, me chama! 💙`,

  vencimento: `{nome}, bom dia! 💙

Passando pra confirmar a parcela que vence hoje:

📦 Produto: {produto}
🔢 Contrato: {num_contrato}
🔢 Parcela: {parcela_atual}/{total_parcelas}
📆 Vencimento: {data_vencimento} (hoje)
💵 Valor: R$ {valor_parcela}

📊 Faltam {parcelas_restantes} parcelas pra quitar (saldo R$ {saldo_restante})

Qual opção fica melhor: pix ou link no cartão? ☺️`,

  atraso_1: `Oi, {nome}! 💙

Notei aqui que sua parcela ainda está em aberto. Entendo que a correria atrapalha, por isso passando pra te lembrar — e, conforme o contrato, já atualizei os valores:

📦 Produto: {produto}
🔢 Contrato: {num_contrato}
🔢 Parcela: {parcela_atual}/{total_parcelas}
📆 Vencimento: {data_vencimento}
⏱️ Dias em atraso: {dias_atraso}
💵 Valor original: R$ {valor_parcela}
💲 Multa (10%): R$ {multa}
💲 Juros: R$ {juros}
💰 Total atualizado: R$ {valor_total}

Consegue me retornar pra gente resolver? Pix ou link no cartão? 💙`,

  atraso_2: `{nome}, tentei falar com você nos últimos dias mas ainda não tive retorno. O setor financeiro está me cobrando uma posição sobre esta pendência:

📦 Produto: {produto}
🔢 Contrato: {num_contrato}
🔢 Parcela: {parcela_atual}/{total_parcelas}
📆 Vencimento: {data_vencimento}
⏱️ Dias em atraso: {dias_atraso}
💵 Valor original: R$ {valor_parcela}
💲 Multa (10%): R$ {multa}
💲 Juros: R$ {juros}
💰 Total atualizado: R$ {valor_total}

Estou aqui pra te ajudar da melhor forma. Consegue me dar um retorno por favor? 💙`,

  advertencia: `{nome}, estou preocupada em não conseguir falar com você. 💙

Preciso te avisar: conforme a cláusula 2.4 do seu contrato, atrasos superiores a 15 dias permitem o cancelamento do seu acesso à mentoria + cobrança integral do saldo remanescente.

Sua situação atual:

📦 Produto: {produto}
🔢 Contrato: {num_contrato}
🔢 Parcela: {parcela_atual}/{total_parcelas}
📆 Vencimento: {data_vencimento}
⏱️ Dias em atraso: {dias_atraso}
💵 Valor original: R$ {valor_parcela}
💲 Multa + juros: R$ {multa_juros}
💰 Total desta parcela: R$ {valor_total}
⚠️ Saldo restante do contrato: R$ {saldo_contrato}

Antes de escalar, quero muito resolver com você. Me chama aqui — pode ser hoje?`,

  eduzz_falhou: `Oi, {nome}! 💙

A Eduzz nos comunicou que não foi possível processar sua parcela no cartão:

📦 Produto: {produto}
🔢 Contrato: {num_contrato}
🔢 Parcela: {parcela_atual}/{total_parcelas}
📆 Vencimento: {data_vencimento}
💵 Valor: R$ {valor_parcela}

Quer que eu te envie um novo link de pagamento por aqui? 😊`,

  comprovante: `Oi, {nome}! 💙 Pagamento confirmado.

📋 Recibo de pagamento:

📦 Produto: {produto}
🔢 Contrato: {num_contrato}
🔢 Parcela: {parcela_atual}/{total_parcelas}
📆 Vencimento: {data_vencimento}
📆 Data do pagamento: {data_pagamento}
⏱️ Dias em atraso: {dias_atraso}
💵 Valor original: R$ {valor_parcela}
💲 Multa: R$ {multa}
💲 Juros: R$ {juros}
💲 Desconto: R$ {desconto}
💰 Valor total: R$ {valor_total}
✅ Valor pago: R$ {valor_pago}
📊 Status: {status_pagamento}
💙 Saldo restante do contrato: R$ {saldo_restante}

🧾 Guarde esta mensagem — ela serve como comprovante do pagamento.
Qualquer coisa, tô aqui 💙`,
};

export function renderTemplate(key: TemplateKey, ctx: TemplateContext): string {
  const tpl = TEMPLATES[key];
  const vars = buildVars(ctx);
  const lookup = vars as unknown as Record<string, string>;
  return tpl.replace(/\{(\w+)\}/g, (_, varName: string) => lookup[varName] ?? "");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Re-export utility used by callers
export { getInstallmentValue };
