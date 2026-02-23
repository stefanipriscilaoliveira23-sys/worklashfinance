import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Upload, Loader2, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type PlataformaOrigem = Database["public"]["Enums"]["plataforma_origem"];

interface ImportRow {
  data: string;
  produto_nome: string;
  valor_bruto: number;
  taxa_plataforma_valor: number;
  valor_liquido: number;
  cliente_nome: string;
  cliente_email: string;
  forma_pagamento: string;
  moeda_original: string;
  utm_source?: string;
  flag: "normal" | "produto_fisico" | "duplicata";
  selected: boolean;
}

const COLUMN_MAPS: Record<string, Record<string, string>> = {
  Hotmart: {
    "Data transação": "data",
    "Produto": "produto_nome",
    "Faturamento líquido do(a) Produtor(a)": "valor_liquido",
    "Taxa de processamento": "taxa_plataforma_valor",
    "Comprador(a)": "cliente_nome",
    "Email do(a) Comprador(a)": "cliente_email",
    "Método de pagamento": "forma_pagamento",
    "Moeda de compra": "moeda_original",
  },
  Kiwify: {
    "Data de Criação": "data",
    "Produto": "produto_nome",
    "Valor líquido": "valor_liquido",
    "Taxas": "taxa_plataforma_valor",
    "Cliente": "cliente_nome",
    "Email": "cliente_email",
    "Pagamento": "forma_pagamento",
  },
  Eduzz: {
    "Data de Pagamento": "data",
    "Produto": "produto_nome",
    "Ganho Liquido": "valor_liquido",
    "Taxa Eduzz": "taxa_plataforma_valor",
    "Cliente / Nome": "cliente_nome",
    "Cliente / E-mail": "cliente_email",
    "Forma de Pagamento": "forma_pagamento",
    "UTM Source": "utm_source",
  },
};

export function ImportarPlanilhaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [plataforma, setPlataforma] = useState<PlataformaOrigem>("Hotmart");
  const [taxaCambioUsd, setTaxaCambioUsd] = useState(5.5);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [origensMap, setOrigensMap] = useState<Record<number, string[]>>({});
  const [importing, setImporting] = useState(false);

  const { data: receitas } = useQuery({
    queryKey: ["receitas-all-import"],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("cliente_email, produto_nome, data");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: origensOpcoes } = useQuery({
    queryKey: ["origens-venda-opcoes"],
    queryFn: async () => {
      const { data } = await supabase.from("origens_venda_opcoes").select("*").eq("ativo", true);
      return data ?? [];
    },
  });

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

          const colMap = COLUMN_MAPS[plataforma] ?? {};
          const mapped: ImportRow[] = json.map((row) => {
            const r: any = {};
            Object.entries(colMap).forEach(([srcCol, destCol]) => {
              // Try exact match first, then partial
              const key = Object.keys(row).find((k) => k.trim() === srcCol || k.trim().toLowerCase().includes(srcCol.toLowerCase()));
              if (key) r[destCol] = row[key];
            });

            // Parse date
            let dateStr = "";
            if (r.data) {
              const parsed = new Date(r.data);
              if (!isNaN(parsed.getTime())) {
                dateStr = parsed.toISOString().split("T")[0];
              } else {
                dateStr = String(r.data);
              }
            }

            const valorLiquido = parseFloat(String(r.valor_liquido ?? "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
            const taxaValor = parseFloat(String(r.taxa_plataforma_valor ?? "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
            const valorBruto = valorLiquido + taxaValor;
            const moeda = r.moeda_original || "BRL";

            // Check for produto fisico
            const nome = String(r.produto_nome ?? "").toLowerCase();
            const isProdutoFisico = nome.includes("worklash") || nome.includes("kit ");

            // Check for duplicate
            const isDup = (receitas ?? []).some((ex) => {
              if (!ex.cliente_email || !r.cliente_email) return false;
              const emailMatch = ex.cliente_email.toLowerCase() === String(r.cliente_email).toLowerCase();
              const prodMatch = ex.produto_nome.toLowerCase() === nome;
              if (!emailMatch || !prodMatch) return false;
              const exDate = new Date(ex.data);
              const rowDate = new Date(dateStr);
              return Math.abs(exDate.getTime() - rowDate.getTime()) <= 86400000;
            });

            return {
              data: dateStr,
              produto_nome: String(r.produto_nome ?? ""),
              valor_bruto: moeda === "USD" ? valorBruto * taxaCambioUsd : valorBruto,
              taxa_plataforma_valor: taxaValor,
              valor_liquido: moeda === "USD" ? valorLiquido * taxaCambioUsd : valorLiquido,
              cliente_nome: String(r.cliente_nome ?? ""),
              cliente_email: String(r.cliente_email ?? ""),
              forma_pagamento: String(r.forma_pagamento ?? ""),
              moeda_original: moeda,
              utm_source: r.utm_source ? String(r.utm_source) : undefined,
              flag: isProdutoFisico ? "produto_fisico" : isDup ? "duplicata" : "normal",
              selected: !isProdutoFisico && !isDup,
            };
          });

          setRows(mapped);
          setStep(3);
        } catch (err) {
          toast.error("Erro ao ler o arquivo");
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [plataforma, taxaCambioUsd, receitas]
  );

  const handleImport = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma linha");
      return;
    }
    setImporting(true);
    try {
      const inserts = selected.map((r) => ({
        data: r.data,
        produto_nome: r.produto_nome,
        plataforma,
        valor_bruto: r.valor_bruto,
        taxa_plataforma_valor: r.taxa_plataforma_valor,
        valor_liquido: r.valor_liquido,
        cliente_nome: r.cliente_nome,
        cliente_email: r.cliente_email,
        forma_pagamento: r.forma_pagamento,
        moeda_original: r.moeda_original,
        valor_em_brl: r.valor_bruto,
        lancado_por: user?.id,
      }));

      const { error } = await supabase.from("receitas").insert(inserts);
      if (error) throw error;

      // Check which rows need origin
      const needOrigins = selected.filter((r) => !r.utm_source);
      if (needOrigins.length > 0) {
        setStep(4);
      } else {
        queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
        queryClient.invalidateQueries({ queryKey: ["receitas-mes"] });
        toast.success(`${selected.length} receitas importadas!`);
        onClose();
      }
    } catch (e) {
      toast.error("Erro na importação: " + (e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleFinishOrigins = () => {
    queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
    queryClient.invalidateQueries({ queryKey: ["receitas-mes"] });
    toast.success("Importação concluída!");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Importar Planilha — Passo {step}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Plataforma</Label>
              <Select value={plataforma} onValueChange={(v) => setPlataforma(v as PlataformaOrigem)}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hotmart">Hotmart</SelectItem>
                  <SelectItem value="Kiwify">Kiwify</SelectItem>
                  <SelectItem value="Eduzz">Eduzz</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {plataforma === "Hotmart" && (
              <div className="space-y-1.5">
                <Label className="text-foreground/80">Taxa de câmbio para vendas em USD</Label>
                <Input type="number" step="0.01" value={taxaCambioUsd} onChange={(e) => setTaxaCambioUsd(Number(e.target.value))} className="bg-secondary/50 border-border" />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">Cancelar</Button>
              <Button onClick={() => setStep(2)} className="gold-gradient text-primary-foreground">
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">Arraste ou selecione um arquivo CSV, XLS ou XLSX</p>
              <Input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileUpload}
                className="max-w-xs bg-secondary/50 border-border"
              />
            </div>
            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setStep(1)} className="border-border text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{rows.length} linhas encontradas. Revise e selecione:</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="p-2"><Checkbox checked={rows.every(r => r.selected)} onCheckedChange={(v) => setRows(rows.map(r => ({ ...r, selected: !!v })))} /></th>
                      <th className="p-2 text-left text-muted-foreground">Data</th>
                      <th className="p-2 text-left text-muted-foreground">Produto</th>
                      <th className="p-2 text-left text-muted-foreground">Cliente</th>
                      <th className="p-2 text-right text-muted-foreground">Líquido</th>
                      <th className="p-2 text-left text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b border-border/50 ${
                          r.flag === "produto_fisico" ? "bg-yellow-500/5" : r.flag === "duplicata" ? "bg-orange-500/5" : "hover:bg-surface-hover"
                        }`}
                      >
                        <td className="p-2">
                          <Checkbox checked={r.selected} onCheckedChange={(v) => {
                            const updated = [...rows];
                            updated[i].selected = !!v;
                            setRows(updated);
                          }} />
                        </td>
                        <td className="p-2">{r.data}</td>
                        <td className="p-2 truncate max-w-[140px]">{r.produto_nome}</td>
                        <td className="p-2 truncate max-w-[120px]">{r.cliente_nome}</td>
                        <td className="p-2 text-right text-primary">{formatCurrency(r.valor_liquido)}</td>
                        <td className="p-2">
                          {r.flag === "produto_fisico" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px]">
                              <AlertTriangle className="h-3 w-3" /> Produto Físico
                            </span>
                          )}
                          {r.flag === "duplicata" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px]">
                              <AlertTriangle className="h-3 w-3" /> Possível duplicata
                            </span>
                          )}
                          {r.flag === "normal" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">
                              <CheckCircle className="h-3 w-3" /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="border-border text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing} className="gold-gradient text-primary-foreground">
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar selecionadas ({rows.filter(r => r.selected).length})
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Preencha as origens de venda para as receitas importadas (opcional):</p>
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {rows.filter(r => r.selected && !r.utm_source).map((r, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-secondary/20">
                  <p className="text-xs text-foreground mb-2">{r.produto_nome} — {r.cliente_nome}</p>
                  <div className="flex flex-wrap gap-1">
                    {(origensOpcoes ?? []).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setOrigensMap((prev) => {
                            const cur = prev[i] ?? [];
                            return {
                              ...prev,
                              [i]: cur.includes(o.label) ? cur.filter(x => x !== o.label) : [...cur, o.label],
                            };
                          });
                        }}
                        className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${
                          (origensMap[i] ?? []).includes(o.label)
                            ? "bg-primary/20 border-primary text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleFinishOrigins} className="border-border text-muted-foreground">Pular todas</Button>
              <Button onClick={handleFinishOrigins} className="gold-gradient text-primary-foreground">Concluir</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
