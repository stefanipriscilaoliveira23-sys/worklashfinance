import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Film, Mic, PauseCircle, Users } from "lucide-react";
import { Campanha, Grupo, Mensagem, STATUS_MSG, hhmm, rotuloGrupos } from "./shared";

type Props = { m: Mensagem; campanha?: Campanha; grupos: Grupo[]; onClick: () => void };

function Miniatura({ m }: { m: Mensagem }) {
  if (!m.midia_url) return null;
  const caixa = "h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted";
  if (m.midia_tipo === "imagem") return <div className={caixa}><img src={m.midia_url} alt="" className="h-full w-full object-cover" /></div>;
  const Icone = m.midia_tipo === "video" ? Film : m.midia_tipo === "audio" ? Mic : FileText;
  return <div className={`${caixa} flex items-center justify-center`}><Icone className="h-6 w-6 text-muted-foreground" /></div>;
}

/** Cartão de uma mensagem agendada. `campanha` aparece como chip quando a lista mistura ofertas. */
export function MensagemCard({ m, campanha, grupos, onClick }: Props) {
  const st = STATUS_MSG[m.status] ?? { rotulo: m.status, cor: "" };
  const nomesGrupos = m.grupos?.map((id) => grupos.find((g) => g.id === id)?.nome ?? "grupo removido");
  const badge = <Badge variant="outline" className={`text-[11px] ${st.cor}`}>{st.rotulo}</Badge>;

  return (
    <button type="button" onClick={onClick}
      className={`flex w-full gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 ${m.status === "cancelada" ? "opacity-60" : ""}`}>
      <span className="w-12 shrink-0 pt-0.5 text-lg font-bold tabular-nums">{hhmm(m.hora)}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {campanha && (
            <span className="max-w-[220px] truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: campanha.cor }}>
              {campanha.oferta}
            </span>
          )}
          {m.status === "erro" && m.erro ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
                <TooltipContent className="max-w-xs">{m.erro}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : badge}
          {m.pausada && (
            <span className="flex items-center gap-1 text-[11px] text-amber-500"><PauseCircle className="h-3 w-3" /> pausada</span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title={nomesGrupos?.join(", ")}>
            <Users className="h-3 w-3" /> {rotuloGrupos(m.grupos)}
          </span>
        </div>
        {m.titulo && <h3 className={`font-semibold leading-tight ${m.status === "cancelada" ? "line-through" : ""}`}>{m.titulo}</h3>}
        {m.texto ? (
          <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{m.texto.replace(/\n\s*\n/g, "\n")}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Sem texto</p>
        )}
      </div>
      <Miniatura m={m} />
    </button>
  );
}
