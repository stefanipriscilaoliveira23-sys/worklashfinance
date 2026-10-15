import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Copy, ExternalLink, FileText, FolderSearch, Loader2, Paperclip, Pencil, Pin, PinOff, Plus, Search, Trash2, X,
} from "lucide-react";

const BUCKET = "pesquisas";
const TIPOS = ["Pesquisa de mercado", "Análise de perfil", "Pesquisa de leads", "Relatório interno", "Documento", "Planilha", "Apresentação", "Contrato", "Outro"];

type Item = {
  id: string; titulo: string; tipo: string; descricao: string | null; url: string | null;
  arquivo_path: string | null; arquivo_nome: string | null; tags: string[];
  data_referencia: string | null; fixado: boolean; created_at: string;
};

type Form = {
  id?: string; titulo: string; tipo: string; descricao: string; url: string; tags: string;
  data_referencia: string; fixado: boolean;
  arquivo_path: string | null; arquivo_nome: string | null; novoArquivo: File | null;
};
const hoje = () => new Date().toISOString().slice(0, 10);
const vazio = (): Form => ({
  titulo: "", tipo: TIPOS[0], descricao: "", url: "", tags: "", data_referencia: hoje(), fixado: false,
  arquivo_path: null, arquivo_nome: null, novoArquivo: null,
});

const dataBR = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nomeSeguro = (nome: string) => norm(nome).replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");

export default function Pesquisas() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [filtro, setFiltro] = useState<string>("Todos");
  const [busca, setBusca] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["pesquisas-documentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pesquisas_documentos").select("*")
        .order("fixado", { ascending: false })
        .order("data_referencia", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form?.titulo.trim()) throw new Error("Informe o nome");
      if (!form.url.trim() && !form.arquivo_path && !form.novoArquivo) throw new Error("Coloque um link ou envie um arquivo");

      let arquivo_path = form.arquivo_path;
      let arquivo_nome = form.arquivo_nome;
      const antigo = form.arquivo_path;
      if (form.novoArquivo) {
        const path = `${crypto.randomUUID()}/${nomeSeguro(form.novoArquivo.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, form.novoArquivo, { contentType: form.novoArquivo.type || undefined });
        if (error) throw new Error("Não consegui enviar o arquivo: " + error.message);
        arquivo_path = path;
        arquivo_nome = form.novoArquivo.name;
      }

      const payload = {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        descricao: form.descricao.trim() || null,
        url: form.url.trim() || null,
        arquivo_path,
        arquivo_nome,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        data_referencia: form.data_referencia || null,
        fixado: form.fixado,
      };
      const { error } = form.id
        ? await (supabase as any).from("pesquisas_documentos").update(payload).eq("id", form.id)
        : await (supabase as any).from("pesquisas_documentos").insert(payload);
      if (error) {
        if (form.novoArquivo && arquivo_path) await supabase.storage.from(BUCKET).remove([arquivo_path]);
        throw error;
      }
      // arquivo trocado ou removido: apaga o antigo do armazenamento
      if (antigo && antigo !== arquivo_path) await supabase.storage.from(BUCKET).remove([antigo]);
    },
    onSuccess: () => {
      setForm(null);
      qc.invalidateQueries({ queryKey: ["pesquisas-documentos"] });
      toast.success("Salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (item: Item) => {
      const { error } = await (supabase as any).from("pesquisas_documentos").delete().eq("id", item.id);
      if (error) throw error;
      if (item.arquivo_path) await supabase.storage.from(BUCKET).remove([item.arquivo_path]);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pesquisas-documentos"] }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fixar = useMutation({
    mutationFn: async (item: Item) => {
      const { error } = await (supabase as any).from("pesquisas_documentos").update({ fixado: !item.fixado }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pesquisas-documentos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirArquivo = async (path: string) => {
    // abre a aba antes do await, senão o navegador bloqueia como pop-up
    const aba = window.open("", "_blank");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      aba?.close();
      toast.error("Não consegui abrir o arquivo");
      return;
    }
    if (aba) aba.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  };

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Link copiado");
  };

  const lista = itens ?? [];
  const tiposUsados = Array.from(new Set(lista.map((i) => i.tipo)));
  const q = norm(busca.trim());
  const visiveis = lista
    .filter((i) => filtro === "Todos" || i.tipo === filtro)
    .filter((i) => !q || norm([i.titulo, i.descricao ?? "", i.tipo, i.tags.join(" "), i.arquivo_nome ?? ""].join(" ")).includes(q));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderSearch className="h-6 w-6 text-primary" /> Pesquisas e Documentos
          </h1>
          <p className="text-sm text-muted-foreground">Pesquisas de mercado, análises e documentos guardados num lugar só, por link ou arquivo.</p>
        </div>
        <Button onClick={() => setForm(vazio())}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome, tema ou etiqueta" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {tiposUsados.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {["Todos", ...tiposUsados].map((t) => (
              <button
                key={t}
                onClick={() => setFiltro(t)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  filtro === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t} {t === "Todos" ? lista.length : lista.filter((i) => i.tipo === t).length}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {lista.length === 0 ? "Nada guardado ainda. Toque em Novo para salvar a primeira pesquisa ou documento." : "Nada encontrado com esse filtro."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((i) => (
            <div key={i.id} className={`flex flex-col rounded-xl border bg-card p-4 gap-3 ${i.fixado ? "border-primary/50" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary" className="text-[11px]">{i.tipo}</Badge>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {i.fixado && <Pin className="h-3 w-3 text-primary" />}
                  {dataBR(i.data_referencia)}
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold leading-tight">{i.titulo}</h3>
                {i.arquivo_nome && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground truncate"><Paperclip className="h-3 w-3 shrink-0" /> {i.arquivo_nome}</p>
                )}
              </div>
              {i.descricao && <p className="text-sm text-muted-foreground flex-1">{i.descricao}</p>}
              {i.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {i.tags.map((t) => (
                    <button key={t} onClick={() => setBusca(t)} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {i.url && (
                  <Button size="sm" asChild>
                    <a href={i.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir</a>
                  </Button>
                )}
                {i.arquivo_path && (
                  <Button size="sm" variant={i.url ? "outline" : "default"} onClick={() => abrirArquivo(i.arquivo_path!)}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Arquivo
                  </Button>
                )}
                {i.url && (
                  <Button size="sm" variant="outline" onClick={() => copiar(i.url!)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                  </Button>
                )}
                <div className="ml-auto flex">
                  <Button size="icon" variant="ghost" className="h-8 w-8" title={i.fixado ? "Desafixar" : "Fixar no topo"} onClick={() => fixar.mutate(i)}>
                    {i.fixado ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => setForm({
                    id: i.id, titulo: i.titulo, tipo: i.tipo, descricao: i.descricao ?? "", url: i.url ?? "",
                    tags: i.tags.join(", "), data_referencia: i.data_referencia ?? "", fixado: i.fixado,
                    arquivo_path: i.arquivo_path, arquivo_nome: i.arquivo_nome, novoArquivo: null,
                  })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => {
                    const aviso = i.arquivo_path ? " O arquivo enviado também será apagado." : " O link continua existindo, só sai daqui.";
                    if (confirm(`Excluir "${i.titulo}"?${aviso}`)) excluir.mutate(i);
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Editar" : "Nova pesquisa ou documento"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set([...TIPOS, form.tipo])).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.data_referencia} onChange={(e) => setForm({ ...form, data_referencia: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link</Label>
                <Input placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Arquivo (PDF, planilha, imagem, até 50 MB)</Label>
                {form.novoArquivo || form.arquivo_nome ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{form.novoArquivo?.name ?? form.arquivo_nome}</span>
                    <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" title="Tirar arquivo"
                      onClick={() => setForm({ ...form, novoArquivo: null, arquivo_path: null, arquivo_nome: null })}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => arquivoRef.current?.click()}>
                    <Paperclip className="h-3.5 w-3.5 mr-1" /> Escolher arquivo
                  </Button>
                )}
                <input ref={arquivoRef} type="file" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 50 * 1024 * 1024) { toast.error("Arquivo maior que 50 MB"); return; }
                  if (f) setForm({ ...form, novoArquivo: f });
                  e.target.value = "";
                }} />
                <p className="text-[11px] text-muted-foreground">Pode ter link, arquivo ou os dois.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Do que se trata</Label>
                <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etiquetas (separe por vírgula)</Label>
                <Input placeholder="concorrentes, instagram" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="fixado" checked={form.fixado} onCheckedChange={(v) => setForm({ ...form, fixado: v })} />
                <Label htmlFor="fixado" className="text-sm">Fixar no topo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
