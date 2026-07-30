import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

const TIPOS = ["Contato", "Reunião", "WhatsApp", "Suporte", "Observação"];

export function ClienteInteracoes({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState("Contato");
  const [conteudo, setConteudo] = useState("");

  const { data: itens } = useQuery({
    queryKey: ["cliente-interacoes", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cliente_interacoes").select("*")
        .eq("cliente_id", clienteId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!conteudo.trim()) throw new Error("Escreva a interação");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("cliente_interacoes").insert({
        cliente_id: clienteId, tipo, conteudo: conteudo.trim(), criado_por: auth?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setConteudo("");
      qc.invalidateQueries({ queryKey: ["cliente-interacoes", clienteId] });
      toast.success("Interação registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cliente_interacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-interacoes", clienteId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-border p-3">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea rows={3} placeholder="O que aconteceu com essa cliente?" value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
        <Button size="sm" onClick={() => criar.mutate()} disabled={criar.isPending}>Registrar</Button>
      </div>

      {(itens ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>}
      {(itens ?? []).map((i) => (
        <div key={i.id} className="rounded-lg border border-border p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px]">{i.tipo}</Badge>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">{formatDate(i.created_at.slice(0, 10))}</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => remover.mutate(i.id)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap">{i.conteudo}</p>
        </div>
      ))}
    </div>
  );
}

export function ClienteDocumentos({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);

  const { data: docs } = useQuery({
    queryKey: ["cliente-documentos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cliente_documentos").select("*")
        .eq("cliente_id", clienteId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enviar = async (file: File) => {
    setEnviando(true);
    try {
      const path = `clientes/${clienteId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("cliente_documentos").insert({
        cliente_id: clienteId, nome: file.name, url: path,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["cliente-documentos", clienteId] });
      toast.success("Documento enviado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async (path: string) => {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("Não foi possível abrir o documento");
    window.open(data.signedUrl, "_blank");
  };

  const remover = useMutation({
    mutationFn: async (doc: { id: string; url: string }) => {
      await supabase.storage.from("documentos").remove([doc.url]);
      const { error } = await supabase.from("cliente_documentos").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-documentos", clienteId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Enviar documento (contrato, comprovante, etc.)</Label>
        <Input type="file" disabled={enviando} onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) enviar(f);
          e.target.value = "";
        }} />
        {enviando && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Enviando…</p>}
      </div>

      {(docs ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum documento enviado.</p>}
      {(docs ?? []).map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <button type="button" onClick={() => abrir(d.url)} className="flex items-center gap-2 text-sm text-primary hover:underline">
            <FileText className="h-4 w-4" /> {d.nome}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{formatDate(d.created_at.slice(0, 10))}</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => remover.mutate({ id: d.id, url: d.url })}>
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </div>
      ))}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Upload className="h-3 w-3" /> Arquivos ficam privados e só abrem por link temporário.
      </p>
    </div>
  );
}
