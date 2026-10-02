import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Eye, EyeOff, ExternalLink, KeyRound, LayoutDashboard, Loader2, Magnet, Pencil, Plus, Trash2, Users } from "lucide-react";

const TIPOS = ["Quiz", "Desafio", "Calculadora", "Página de captura", "IA de presente", "Aula / apresentação", "Material / PDF", "Artefato"];
const STATUS = ["Ativa", "Exclusiva", "Pausada", "Encerrada"];

type Isca = {
  id: string; titulo: string; tipo: string; descricao: string | null; url: string;
  painel_url: string | null; painel_senha: string | null; tabela_leads: string | null; onde_caem_leads: string | null;
  status: string; ordem: number;
};

type Form = {
  id?: string; titulo: string; tipo: string; descricao: string; url: string;
  painel_url: string; painel_senha: string; onde_caem_leads: string; status: string; ordem: string;
};
const vazio: Form = {
  titulo: "", tipo: TIPOS[0], descricao: "", url: "", painel_url: "", painel_senha: "", onde_caem_leads: "", status: "Ativa", ordem: "0",
};

const corStatus: Record<string, string> = {
  Ativa: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  Exclusiva: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  Pausada: "bg-muted text-muted-foreground border-border",
  Encerrada: "bg-muted text-muted-foreground border-border",
};

const dominio = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function Iscas() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [filtro, setFiltro] = useState<string>("Todas");
  const [senhaVisivel, setSenhaVisivel] = useState<Record<string, boolean>>({});

  const { data: iscas, isLoading } = useQuery({
    queryKey: ["iscas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("iscas").select("*").order("ordem").order("titulo");
      if (error) throw error;
      return (data ?? []) as Isca[];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["iscas-leads"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("iscas_contar_leads");
      const mapa: Record<string, number> = {};
      (data ?? []).forEach((r: { tabela: string; total: number }) => { mapa[r.tabela] = Number(r.total); });
      return mapa;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form?.titulo.trim()) throw new Error("Informe o nome da isca");
      if (!form.url.trim()) throw new Error("Informe o link");
      const payload = {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        descricao: form.descricao.trim() || null,
        url: form.url.trim(),
        painel_url: form.painel_url.trim() || null,
        painel_senha: form.painel_senha.trim() || null,
        onde_caem_leads: form.onde_caem_leads.trim() || null,
        status: form.status,
        ordem: Number(form.ordem) || 0,
      };
      const { error } = form.id
        ? await (supabase as any).from("iscas").update(payload).eq("id", form.id)
        : await (supabase as any).from("iscas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(null);
      qc.invalidateQueries({ queryKey: ["iscas"] });
      toast.success("Isca salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("iscas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["iscas"] }); toast.success("Isca excluída"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copiar = (texto: string, aviso = "Link copiado") => {
    navigator.clipboard.writeText(texto);
    toast.success(aviso);
  };

  const lista = iscas ?? [];
  const tiposUsados = Array.from(new Set(lista.map((i) => i.tipo)));
  const visiveis = filtro === "Todas" ? lista : lista.filter((i) => i.tipo === filtro);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Magnet className="h-6 w-6 text-primary" /> Iscas
          </h1>
          <p className="text-sm text-muted-foreground">Todas as iscas digitais no ar, com o link pra mandar.</p>
        </div>
        <Button onClick={() => setForm({ ...vazio })}>
          <Plus className="h-4 w-4 mr-1" /> Nova isca
        </Button>
      </div>

      {tiposUsados.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {["Todas", ...tiposUsados].map((t) => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filtro === t ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t} {t === "Todas" ? lista.length : lista.filter((i) => i.tipo === t).length}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma isca cadastrada ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((i) => {
            const total = i.tabela_leads ? leads?.[i.tabela_leads] : undefined;
            return (
              <div key={i.id} className="flex flex-col rounded-xl border border-border bg-card p-4 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="text-[11px]">{i.tipo}</Badge>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${corStatus[i.status] ?? corStatus.Pausada}`}>{i.status}</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold leading-tight">{i.titulo}</h3>
                  <a href={i.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">
                    {dominio(i.url)}
                  </a>
                </div>
                {i.descricao && <p className="text-sm text-muted-foreground flex-1">{i.descricao}</p>}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {total !== undefined
                    ? <span><strong className="text-foreground">{total}</strong> {total === 1 ? "lead" : "leads"} · {i.onde_caem_leads}</span>
                    : <span>{i.onde_caem_leads ?? "Leads: não informado"}</span>}
                </div>
                {i.painel_senha && (
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Senha do painel:</span>
                    <span className="font-mono text-foreground">{senhaVisivel[i.id] ? i.painel_senha : "••••••••"}</span>
                    <div className="ml-auto flex">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title={senhaVisivel[i.id] ? "Esconder" : "Mostrar"}
                        onClick={() => setSenhaVisivel({ ...senhaVisivel, [i.id]: !senhaVisivel[i.id] })}>
                        {senhaVisivel[i.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Copiar senha" onClick={() => copiar(i.painel_senha!, "Senha copiada")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" asChild>
                    <a href={i.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir</a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copiar(i.url)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                  </Button>
                  {i.painel_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={i.painel_url} target="_blank" rel="noreferrer"><LayoutDashboard className="h-3.5 w-3.5 mr-1" /> Painel</a>
                    </Button>
                  )}
                  <div className="ml-auto flex">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => setForm({
                      id: i.id, titulo: i.titulo, tipo: i.tipo, descricao: i.descricao ?? "", url: i.url,
                      painel_url: i.painel_url ?? "", painel_senha: i.painel_senha ?? "", onde_caem_leads: i.onde_caem_leads ?? "", status: i.status, ordem: String(i.ordem),
                    })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => {
                      if (confirm(`Excluir "${i.titulo}" da galeria? A isca continua no ar, só sai daqui.`)) excluir.mutate(i.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar isca" : "Nova isca"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link *</Label>
                <Input placeholder="https://" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
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
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pra que serve</Label>
                <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link do painel (opcional)</Label>
                <Input placeholder="https://" value={form.painel_url} onChange={(e) => setForm({ ...form, painel_url: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Senha do painel (opcional)</Label>
                <Input value={form.painel_senha} onChange={(e) => setForm({ ...form, painel_senha: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Onde caem os leads</Label>
                  <Input value={form.onde_caem_leads} onChange={(e) => setForm({ ...form, onde_caem_leads: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ordem</Label>
                  <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
