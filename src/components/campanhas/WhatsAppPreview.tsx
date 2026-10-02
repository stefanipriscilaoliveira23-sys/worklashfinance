import { FileText, Mic } from "lucide-react";
import { formatarWhatsApp, hhmm } from "./shared";

type Props = { texto: string; hora: string; midiaUrl?: string | null; midiaTipo?: string | null };

/** Balão de mensagem como aparece no grupo, pra conferir a formatação antes de agendar. */
export function WhatsAppPreview({ texto, hora, midiaUrl, midiaTipo }: Props) {
  const vazio = !texto.trim() && !midiaUrl;
  return (
    <div className="rounded-xl bg-[#efeae2] p-4 dark:bg-[#0b141a]">
      {vazio ? (
        <p className="py-10 text-center text-xs text-[#667781] dark:text-[#8696a0]">A prévia aparece aqui.</p>
      ) : (
        <div className="ml-auto w-fit max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] p-1 shadow-sm dark:bg-[#005c4b]">
          {midiaUrl && midiaTipo === "imagem" && (
            <img src={midiaUrl} alt="" className="max-h-72 w-full rounded-md object-cover" />
          )}
          {midiaUrl && midiaTipo === "video" && (
            <video src={midiaUrl} controls className="max-h-72 w-full rounded-md bg-black" />
          )}
          {midiaUrl && midiaTipo === "audio" && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Mic className="h-4 w-4 shrink-0 text-[#00a884]" />
              <audio src={midiaUrl} controls className="h-8 max-w-[240px]" />
            </div>
          )}
          {midiaUrl && midiaTipo === "documento" && (
            <a href={midiaUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-md bg-black/5 px-3 py-2 text-xs text-[#111b21] dark:bg-white/10 dark:text-[#e9edef]">
              <FileText className="h-5 w-5 shrink-0" />
              <span className="truncate">{decodeURIComponent(midiaUrl.split("/").pop()?.split("?")[0] ?? "Documento")}</span>
            </a>
          )}
          <div className="px-1.5 pb-0.5 pt-1">
            {texto.trim() && (
              <p
                className="whitespace-pre-wrap break-words text-[14px] leading-[19px] text-[#111b21] dark:text-[#e9edef] [&_code]:font-mono [&_code]:text-[13px]"
                dangerouslySetInnerHTML={{ __html: formatarWhatsApp(texto) }}
              />
            )}
            <p className="mt-0.5 text-right text-[11px] text-[#667781] dark:text-[#8696a0]">{hhmm(hora || "09:00")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
