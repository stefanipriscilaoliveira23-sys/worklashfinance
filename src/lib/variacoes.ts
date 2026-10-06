/**
 * Campo que se escolhe na venda, vindo de produtos_catalogo.variacoes
 * (curvatura e caixinha dos fios). `quando` esconde o campo até outra escolha
 * bater: o Tamanho só aparece com Caixinha = Unitária.
 *
 * A janela de venda do CRM faz a mesma coisa com a mesma coluna: mudou a regra
 * aqui, muda lá também.
 */
export interface Variacao {
  nome: string;
  opcoes: string[];
  quando?: Record<string, string>;
}

export type Escolhas = Record<string, string>;

export type ComVariacoes = { nome: string; variacoes?: unknown } | null | undefined;

const lerVariacoes = (p: ComVariacoes): Variacao[] =>
  Array.isArray(p?.variacoes) ? (p!.variacoes as Variacao[]) : [];

export const variacoesVisiveis = (p: ComVariacoes, e: Escolhas) =>
  lerVariacoes(p).filter(
    (v) => !v.quando || Object.entries(v.quando).every(([k, val]) => e[k] === val),
  );

export const variacoesFaltando = (p: ComVariacoes, e: Escolhas) =>
  variacoesVisiveis(p, e)
    .filter((v) => !e[v.nome])
    .map((v) => v.nome);

/**
 * "Fio Volume Brasileiro (YY): Curvatura M, Caixinha Mix (8 a 15)".
 * Vai na observação, não no nome: o nome fica igual ao do catálogo pra
 * etiqueta "Comprou: ..." e o relatório por produto continuarem batendo.
 */
export const textoDaVariacao = (p: ComVariacoes, e: Escolhas) => {
  const partes = variacoesVisiveis(p, e)
    .filter((v) => e[v.nome])
    .map((v) => `${v.nome} ${e[v.nome]}`);
  return p && partes.length ? `${p.nome}: ${partes.join(", ")}` : "";
};
