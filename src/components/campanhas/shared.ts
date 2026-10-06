import type { Tables } from "@/integrations/supabase/types";

// Campanhas dos grupos de WhatsApp da Worklash. Dia e hora são sempre de Brasília.
export type Campanha = Tables<"campanhas">;
export type Mensagem = Tables<"campanha_mensagens">;
export type Grupo = Tables<"campanha_grupos">;

export const TZ = "America/Sao_Paulo";
export const BUCKET = "campanhas";

export const STATUS_MSG: Record<string, { rotulo: string; cor: string }> = {
  rascunho: { rotulo: "Rascunho", cor: "bg-muted text-muted-foreground border-border" },
  agendada: { rotulo: "Agendada", cor: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  enviada: { rotulo: "Enviada", cor: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  erro: { rotulo: "Erro", cor: "bg-red-500/15 text-red-500 border-red-500/30" },
  cancelada: { rotulo: "Cancelada", cor: "bg-muted text-muted-foreground border-border line-through" },
};

export const STATUS_CAMPANHA: Record<string, { rotulo: string; cor: string }> = {
  rascunho: { rotulo: "Rascunho", cor: "bg-muted text-muted-foreground border-border" },
  agendada: { rotulo: "Agendada", cor: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  em_andamento: { rotulo: "Em andamento", cor: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  concluida: { rotulo: "Concluída", cor: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  pausada: { rotulo: "Pausada", cor: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  cancelada: { rotulo: "Cancelada", cor: "bg-muted text-muted-foreground border-border line-through" },
};

export const MIDIA_TIPOS = [
  { valor: "imagem", rotulo: "Imagem" },
  { valor: "video", rotulo: "Vídeo" },
  { valor: "audio", rotulo: "Áudio" },
  { valor: "documento", rotulo: "Documento" },
] as const;

/** "AAAA-MM-DD" de hoje em Brasília */
export const hojeBR = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
/** "HH:MM" de agora em Brasília */
export const agoraBR = () => new Date().toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const meioDia = (d: string) => new Date(`${d}T12:00:00`);

/** "Segunda, 05/10" */
export const rotuloDia = (d: string) => {
  const sem = meioDia(d).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${ddmm(d)}`;
};
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const hhmm = (t: string) => t.slice(0, 5);

export const somarDias = (d: string, n: number) => {
  const x = meioDia(d);
  x.setDate(x.getDate() + n);
  return x.toLocaleDateString("en-CA");
};
export const diferencaDias = (de: string, ate: string) => Math.round((meioDia(ate).getTime() - meioDia(de).getTime()) / 86400000);

export const ordenarMensagens = (a: Mensagem, b: Mensagem) =>
  a.dia.localeCompare(b.dia) || a.hora.localeCompare(b.hora) || a.ordem - b.ordem;

/** período da campanha: o cadastrado ou, sem ele, o primeiro e o último dia das mensagens */
export function periodo(c: Campanha, msgs: Mensagem[]) {
  const dias = msgs.map((m) => m.dia).sort();
  const inicio = c.data_inicio ?? dias[0] ?? null;
  const fim = c.data_fim ?? dias[dias.length - 1] ?? null;
  return { inicio, fim };
}

export function rotuloPeriodo(c: Campanha, msgs: Mensagem[]) {
  const { inicio, fim } = periodo(c, msgs);
  if (!inicio) return "Sem datas";
  if (!fim || fim === inicio) return ddmm(inicio);
  return `${ddmm(inicio)} a ${ddmm(fim)}`;
}

export const rotuloGrupos = (g: string[] | null) =>
  !g ? "Todos os grupos" : `${g.length} ${g.length === 1 ? "grupo" : "grupos"}`;

export type ContatoPrivado = { nome: string; numero: string };

/** Disparo no privado: a mensagem vai para esta lista em vez dos grupos */
export const contatosDa = (m: Pick<Mensagem, "contatos">): ContatoPrivado[] | null =>
  Array.isArray(m.contatos) ? (m.contatos as ContatoPrivado[]) : null;

export const rotuloContatos = (c: ContatoPrivado[]) => `${c.length} ${c.length === 1 ? "contato" : "contatos"} no privado`;

export function detectarTipo(nomeOuUrl: string, mime?: string): Mensagem["midia_tipo"] {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "imagem";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m) return "documento";
  const ext = nomeOuUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "avif"].includes(ext)) return "imagem";
  if (["mp4", "mov", "webm", "m4v", "3gp"].includes(ext)) return "video";
  if (["mp3", "ogg", "opus", "m4a", "wav", "aac"].includes(ext)) return "audio";
  return "documento";
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Formatação do WhatsApp: *negrito*, _itálico_, ~riscado~ e ```mono```. Quebra de linha fica no CSS (pre-wrap). */
export function formatarWhatsApp(texto: string) {
  return escapar(texto)
    .replace(/```([^`]+?)```/g, "<code>$1</code>")
    .replace(/\*([^\s*](?:[^*\n]*?[^\s*])?)\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])_([^\s_](?:[^_\n]*?[^\s_])?)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~([^\s~](?:[^~\n]*?[^\s~])?)~/g, "<s>$1</s>");
}
