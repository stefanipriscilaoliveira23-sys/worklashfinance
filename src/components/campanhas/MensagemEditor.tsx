import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, CopyPlus, Loader2, Trash2, Upload, X } from "lucide-react";
import { WhatsAppPreview } from "./WhatsAppPreview";
import {
  BUCKET, Campanha, Grupo, MIDIA_TIPOS, Mensagem, STATUS_MSG, agoraBR, contatosDa, detectarTipo, hojeBR, rotuloContatos,
} from "./shared";

type Form = {
  campanha_id: string; dia: string; hora: string; titulo: string; texto: string;
  midia_url: string; midia_tipo: Mensagem["midia_tipo"]; grupos: string[] | null;
};

export type EditorAlvo = { mensagem?: Mensagem; campanha_id?: string; dia?: string } | null;

type Props = {
  alvo: EditorAlvo;
  onClose: () => void;
  onAbrir: (m: Mensagem) => void;
  campanhas: Campanha[];
  grupos: Grupo[];
  mensagens: Mensagem[];
};

const vazio = (alvo: NonNullable<EditorAlvo>): Form => {
  const m = alvo.mensagem;
  return {
    campanha_id: m?.campanha_id ?? alvo.campanha_id ?? "",
    dia: m?.dia ?? alvo.dia ?? hojeBR(),
    hora: (m?.hora ?? "09:00").slice(0, 5),
    titulo: m?.titulo ?? "",
    texto: m?.texto ?? "",
    midia_url: m?.midia_url ?? "",
    midia_tipo: m?.midia_tipo ?? null,
    grupos: m ? m.grupos : null,
  };
};

export function MensagemEditor({ alvo, onClose, onAbrir, campanhas, grupos, mensagens }: Props) {
  const qc = useQueryClient();
  const [f, setF] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [subindo, setSubindo] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => { setF(alvo ? vazio(alvo) : null); }, [alvo]);

  const m = alvo?.mensagem;
  const somenteLeitura = m?.status === "enviada";
  const set = (p: Partial<Form>) => setF((x) => (x ? { ...x, ...p } : x));
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["campanha-mensagens"] });
    qc.invalidateQueries({ queryKey: ["campanhas"] });
  };

  async function subir(file: File) {
    if (!f?.campanha_id) { toast.error("Escolha a campanha antes de subir a mídia"); return; }
    setSubindo(true);
    try {
      const nome = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-");
      const path = `${f.campanha_id}/${Date.now()}-${nome}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      set({ midia_url: url, midia_tipo: detectarTipo(file.name, file.type) });
      toast.success("Mídia enviada");
    } catch (e) {
      toast.error(`Não deu pra subir: ${(e as Error).message}`);
    } finally {
      setSubindo(false);
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  async function salvar(status: "rascunho" | "agendada") {
    if (!f) return;
    if (!f.campanha_id) return toast.error("Escolha a campanha");
    if (!f.dia || !f.hora) return toast.error("Preencha dia e hora");
    if (!f.texto.trim() && !f.midia_url.trim()) return toast.error("Escreva o texto ou coloque uma mídia");
    if (status === "agendada" && (f.dia < hojeBR() || (f.dia === hojeBR() && f.hora <= agoraBR())))
      return toast.error("Esse horário já passou. Escolha um horário no futuro para agendar.");
    if (f.grupos && f.grupos.length === 0) return toast.error("Marque pelo menos um grupo, ou deixe Todos os grupos ativos");

    setSalvando(status);
    const midia_url = f.midia_url.trim() || null;
    const dados = {
      campanha_id: f.campanha_id, dia: f.dia, hora: f.hora, titulo: f.titulo.trim(), texto: f.texto,
      midia_url, midia_tipo: midia_url ? f.midia_tipo ?? detectarTipo(midia_url) : null,
      grupos: f.grupos, status, erro: null, pausada: false,
    };
    try {
      if (m) {
        const { error } = await supabase.from("campanha_mensagens").update(dados).eq("id", m.id);
        if (error) throw error;
      } else {
        const ordem = mensagens.filter((x) => x.campanha_id === f.campanha_id && x.dia === f.dia).length;
        const { error } = await supabase.from("campanha_mensagens").insert({ ...dados, ordem });
        if (error) throw error;
      }
      // campanha que ainda era rascunho passa a agendada quando ganha a primeira mensagem agendada
      const c = campanhas.find((x) => x.id === f.campanha_id);
      if (status === "agendada" && c?.status === "rascunho")
        await supabase.from("campanhas").update({ status: "agendada" }).eq("id", c.id);
      toast.success(status === "agendada" ? "Mensagem agendada" : "Rascunho salvo");
      atualizar();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(null);
    }
  }

  async function duplicar() {
    if (!m) return;
    setSalvando("duplicar");
    const { id, criado_em, atualizado_em, enviado_em, erro, status, pausada, ...resto } = m;
    const { data, error } = await supabase.from("campanha_mensagens")
      .insert({ ...resto, ordem: m.ordem + 1, titulo: m.titulo ? `${m.titulo} (cópia)` : "", status: "rascunho" })
      .select().single();
    setSalvando(null);
    if (error) return toast.error(error.message);
    toast.success("Cópia criada como rascunho");
    atualizar();
    onAbrir(data);
  }

  async function excluir() {
    if (!m || !confirm("Excluir esta mensagem?")) return;
    const { error } = await supabase.from("campanha_mensagens").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Mensagem excluída");
    atualizar();
    onClose();
  }

  const copiar = async () => {
    if (!f?.texto) return;
    await navigator.clipboard.writeText(f.texto);
    toast.success("Texto copiado");
  };

  const ativos = grupos.filter((g) => g.ativo);
  // inativo não entra em "Todos os grupos", mas dá pra escolher à mão (ex.: grupo de teste)
  const outros = grupos.filter((g) => !g.ativo);

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {m ? "Mensagem" : "Nova mensagem"}
            {m && <Badge variant="outline" className={`text-[11px] ${STATUS_MSG[m.status]?.cor ?? ""}`}>{STATUS_MSG[m.status]?.rotulo ?? m.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {f && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <fieldset disabled={somenteLeitura} className="min-w-0 space-y-4">
              {somenteLeitura && (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                  Esta mensagem já foi enviada e não pode mais ser alterada. Use Duplicar para reaproveitar.
                </p>
              )}
              {m?.status === "erro" && m.erro && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">{m.erro}</p>
              )}

              <div className="grid gap-3 sm:grid-cols-[1fr_150px_110px]">
                <div className="space-y-1.5">
                  <Label>Campanha</Label>
                  <Select value={f.campanha_id} onValueChange={(v) => set({ campanha_id: v })} disabled={somenteLeitura}>
                    <SelectTrigger><SelectValue placeholder="Escolha a oferta" /></SelectTrigger>
                    <SelectContent>
                      {campanhas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />{c.oferta}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dia</Label>
                  <Input type="date" value={f.dia} onChange={(e) => set({ dia: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora</Label>
                  <Input type="time" value={f.hora} onChange={(e) => set({ hora: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Título interno</Label>
                <Input value={f.titulo} placeholder="Ex.: Abertura do carrinho" onChange={(e) => set({ titulo: e.target.value })} />
                <p className="text-xs text-muted-foreground">Só aparece aqui no Escritório, não vai para o grupo.</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Texto</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{f.texto.length} caracteres</span>
                </div>
                <Textarea rows={12} value={f.texto} onChange={(e) => set({ texto: e.target.value })}
                  placeholder={"Oie, meninas!\n\n*negrito*, _itálico_ e ~riscado~ funcionam como no WhatsApp."} />
              </div>

              <div className="space-y-1.5">
                <Label>Mídia</Label>
                <div className="flex flex-wrap gap-2">
                  <Input className="min-w-0 flex-1" placeholder="Cole um link ou suba um arquivo" value={f.midia_url}
                    onChange={(e) => set({ midia_url: e.target.value, midia_tipo: e.target.value ? detectarTipo(e.target.value) : null })} />
                  <input ref={arquivo} type="file" className="hidden" accept="image/*,video/*,audio/*,application/pdf"
                    onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
                  <Button type="button" variant="outline" onClick={() => arquivo.current?.click()} disabled={subindo || somenteLeitura}>
                    {subindo ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />} Subir
                  </Button>
                  {f.midia_url && (
                    <>
                      <Select value={f.midia_tipo ?? ""} onValueChange={(v) => set({ midia_tipo: v })} disabled={somenteLeitura}>
                        <SelectTrigger className="w-32"><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent>{MIDIA_TIPOS.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" title="Tirar mídia" onClick={() => set({ midia_url: "", midia_tipo: null })}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {alvo.mensagem && contatosDa(alvo.mensagem) ? (
              <div className="space-y-2">
                <Label>Disparo no privado · {rotuloContatos(contatosDa(alvo.mensagem)!)}</Label>
                <p className="text-xs text-muted-foreground">
                  Sai do WhatsApp da Worklash, uma conversa a cada 1 a 2 minutos. Não vai para os grupos.
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
                  {contatosDa(alvo.mensagem)!.map((c) => (
                    <div key={c.numero} className="flex justify-between gap-2">
                      <span className="truncate">{c.nome || "Sem nome"}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{c.numero.split("@")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
              ) : (
              <div className="space-y-2">
                <Label>Grupos</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.grupos === null} disabled={somenteLeitura}
                    onCheckedChange={(v) => set({ grupos: v ? null : [] })} />
                  Todos os grupos ativos <span className="text-xs text-muted-foreground">({ativos.length})</span>
                </label>
                {f.grupos !== null && (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
                    {[...ativos, ...outros].length === 0 && <p className="text-xs text-muted-foreground">Nenhum grupo cadastrado. Cadastre em Grupos.</p>}
                    {[...ativos, ...outros].map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={f.grupos!.includes(g.id)} disabled={somenteLeitura}
                          onCheckedChange={(v) => setF((x) => x && {
                            ...x, grupos: v ? [...(x.grupos ?? []), g.id] : (x.grupos ?? []).filter((id) => id !== g.id),
                          })} />
                        <span className="truncate">{g.nome}</span>
                        {!g.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}
                        {!g.jid && <span className="text-xs text-amber-500">sem JID</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              )}
            </fieldset>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Prévia no WhatsApp</Label>
                <Button type="button" size="sm" variant="ghost" onClick={copiar} disabled={!f.texto}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copiar texto
                </Button>
              </div>
              <WhatsAppPreview texto={f.texto} hora={f.hora} midiaUrl={f.midia_url || null} midiaTipo={f.midia_url ? f.midia_tipo : null} />
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            {m && !somenteLeitura && (
              <Button variant="ghost" className="text-red-500" onClick={excluir}><Trash2 className="mr-1 h-4 w-4" /> Excluir</Button>
            )}
            {m && (
              <Button variant="outline" onClick={duplicar} disabled={!!salvando}>
                {salvando === "duplicar" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CopyPlus className="mr-1 h-4 w-4" />} Duplicar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {!somenteLeitura && (
              <>
                <Button variant="secondary" onClick={() => salvar("rascunho")} disabled={!!salvando || subindo}>
                  {salvando === "rascunho" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Salvar rascunho
                </Button>
                <Button onClick={() => salvar("agendada")} disabled={!!salvando || subindo}>
                  {salvando === "agendada" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Agendar
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
