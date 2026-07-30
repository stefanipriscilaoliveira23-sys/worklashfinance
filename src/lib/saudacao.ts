export function saudacaoAgora(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function primeiroNome(nome?: string | null): string {
  const n = (nome ?? "").trim();
  if (!n) return "";
  return n.split(/[\s.@]/)[0].replace(/^./, (c) => c.toUpperCase());
}

export function dataPorExtenso(d = new Date()): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
