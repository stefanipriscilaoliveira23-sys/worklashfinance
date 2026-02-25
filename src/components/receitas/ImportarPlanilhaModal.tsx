import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  AlertTriangle, Upload, Loader2, ArrowRight, ArrowLeft, CheckCircle,
  Pencil, Trash2, Eye, PackagePlus, AlertCircle, Link2
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { ImportRowEditDialog } from "./ImportRowEditDialog";
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
  // enrichment
  flag: "normal" | "produto_fisico" | "duplicata";
  selected: boolean;
  produto_id: string | null;
  produto_no_catalogo: boolean;
  duplicata_receita_id: string | null;
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
  const [importing, setImporting] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showDuplicataId, setShowDuplicataId] = useState<string | null>(null);

  // Existing receitas for duplicate check
  const { data: receitas } = useQuery({
    queryKey: ["receitas-all-import"],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("id, cliente_email, produto_nome, data, valor_bruto, cliente_nome");
      return data ?? [];
    },
    enabled: open,
  });

  // Existing clients
  const { data: clientes } = useQuery({
    queryKey: ["clientes-all-import"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome, email");
      return data ?? [];
    },
    enabled: open,
  });

  // Product catalog
  const { data: produtos } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true);
      return data ?? [];
    },
    enabled: open,
  });

  const matchProduct = (nome: string) => {
    if (!produtos) return { id: null, found: false };
    const lower = nome.toLowerCase().trim();
    const exact = produtos.find((p) => p.nome.toLowerCase().trim() === lower);
    if (exact) return { id: exact.id, found: true };
    const partial = produtos.find((p) => lower.includes(p.nome.toLowerCase().trim()) || p.nome.toLowerCase().trim().includes(lower));
    if (partial) return { id: partial.id, found: true };
    return { id: null, found: false };
  };

  const findDuplicate = (r: { cliente_email: string; produto_nome: string; data: string; valor_bruto: number }) => {
    if (!receitas || !r.cliente_email) return null;
    return receitas.find((ex) => {
      if (!ex.cliente_email) return false;
      const emailMatch = ex.cliente_email.toLowerCase() === r.cliente_email.toLowerCase();
      const prodMatch = ex.produto_nome.toLowerCase() === r.produto_nome.toLowerCase();
      if (!emailMatch || !prodMatch) return false;
      const exDate = new Date(ex.data);
      const rowDate = new Date(r.data);
      if (Math.abs(exDate.getTime() - rowDate.getTime()) > 86400000 * 3) return false;
      // Also check value similarity (within 10%)
      const valDiff = Math.abs((ex.valor_bruto ?? 0) - r.valor_bruto);
      if (r.valor_bruto > 0 && valDiff / r.valor_bruto > 0.1) return false;
      return true;
    }) ?? null;
  };

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
              const key = Object.keys(row).find((k) => k.trim() === srcCol || k.trim().toLowerCase().includes(srcCol.toLowerCase()));
              if (key) r[destCol] = row[key];
            });

            let dateStr = "";
            if (r.data) {
              const parsed = new Date(r.data);
              if (!isNaN(parsed.getTime())) dateStr = parsed.toISOString().split("T")[0];
              else dateStr = String(r.data);
            }

            const valorLiquido = parseFloat(String(r.valor_liquido ?? "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
            const taxaValor = parseFloat(String(r.taxa_plataforma_valor ?? "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
            const moeda = r.moeda_original || "BRL";
            const valorBruto = moeda === "USD" ? (valorLiquido + taxaValor) * taxaCambioUsd : valorLiquido + taxaValor;
            const valorLiqFinal = moeda === "USD" ? valorLiquido * taxaCambioUsd : valorLiquido;

            const nome = String(r.produto_nome ?? "").toLowerCase();
            const isProdutoFisico = nome.includes("worklash") || nome.includes("kit ");

            const prodMatch = matchProduct(String(r.produto_nome ?? ""));

            const dup = findDuplicate({
              cliente_email: String(r.cliente_email ?? ""),
              produto_nome: String(r.produto_nome ?? ""),
              data: dateStr,
              valor_bruto: valorBruto,
            });

            return {
              data: dateStr,
              produto_nome: String(r.produto_nome ?? ""),
              valor_bruto: valorBruto,
              taxa_plataforma_valor: taxaValor,
              valor_liquido: valorLiqFinal,
              cliente_nome: String(r.cliente_nome ?? ""),
              cliente_email: String(r.cliente_email ?? ""),
              forma_pagamento: String(r.forma_pagamento ?? ""),
              moeda_original: moeda,
              utm_source: r.utm_source ? String(r.utm_source) : undefined,
              flag: isProdutoFisico ? "produto_fisico" : dup ? "duplicata" : "normal",
              selected: !isProdutoFisico && !dup,
              produto_id: prodMatch.id,
              produto_no_catalogo: prodMatch.found,
              duplicata_receita_id: dup?.id ?? null,
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
    [plataforma, taxaCambioUsd, receitas, produtos]
  );

  const handleAddProductToCatalog = async (idx: number) => {
    const row = rows[idx];
    const { data, error } = await supabase.from("produtos_catalogo").insert({
      nome: row.produto_nome,
      categoria: "Outros",
      ativo: true,
    }).select().single();
    if (error) {
      toast.error("Erro ao adicionar produto: " + error.message);
      return;
    }
    toast.success(`Produto "${row.produto_nome}" adicionado ao catálogo!`);
    // Update all rows with same product name
    setRows((prev) => prev.map((r) => r.produto_nome === row.produto_nome ? { ...r, produto_id: data.id, produto_no_catalogo: true } : r));
    queryClient.invalidateQueries({ queryKey: ["produtos-catalogo"] });
  };

  const handleDeleteRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEditSave = (updatedRow: any) => {
    if (editIdx === null) return;
    setRows((prev) => {
      const updated = [...prev];
      updated[editIdx] = { ...updated[editIdx], ...updatedRow };
      return updated;
    });
  };

  const handleMergeDuplicate = (idx: number) => {
    // Mark as "merge" — we'll update the existing receita with platform info instead of inserting
    const updated = [...rows];
    updated[idx].flag = "normal";
    updated[idx].selected = true;
    setRows(updated);
    toast.info("A venda será mesclada com a receita existente ao importar.");
  };

  const handleImport = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma linha");
      return;
    }
    setImporting(true);
    try {
      // 1. Auto-create missing clients
      const existingEmails = new Set((clientes ?? []).map((c) => c.email?.toLowerCase()));
      const newClients = new Map<string, string>(); // email -> nome
      for (const r of selected) {
        if (r.cliente_email && !existingEmails.has(r.cliente_email.toLowerCase()) && !newClients.has(r.cliente_email.toLowerCase())) {
          newClients.set(r.cliente_email.toLowerCase(), r.cliente_nome);
        }
      }
      if (newClients.size > 0) {
        const clientInserts = Array.from(newClients.entries()).map(([email, nome]) => ({ nome, email }));
        await supabase.from("clientes").insert(clientInserts);
      }

      // 2. Handle duplicates that user chose to merge
      const toMerge = selected.filter((r) => r.duplicata_receita_id);
      for (const r of toMerge) {
        await supabase.from("receitas").update({
          plataforma,
          forma_pagamento: r.forma_pagamento || undefined,
          taxa_plataforma_valor: r.taxa_plataforma_valor,
          valor_liquido: r.valor_liquido,
          moeda_original: r.moeda_original,
        }).eq("id", r.duplicata_receita_id!);
      }

      // 3. Insert new (non-merge) receitas
      const toInsert = selected.filter((r) => !r.duplicata_receita_id);
      if (toInsert.length > 0) {
        const inserts = toInsert.map((r) => ({
          data: r.data,
          produto_nome: r.produto_nome,
          produto_id: r.produto_id,
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
      }

      queryClient.invalidateQueries({ queryKey: ["receitas-all"] });
      queryClient.invalidateQueries({ queryKey: ["receitas-mes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-all-import"] });
      const mergedCount = toMerge.length;
      const insertedCount = toInsert.length;
      const clientCount = newClients.size;
      let msg = `${insertedCount} receitas importadas`;
      if (mergedCount > 0) msg += `, ${mergedCount} mescladas`;
      if (clientCount > 0) msg += `, ${clientCount} clientes criados`;
      toast.success(msg + "!");
      onClose();
    } catch (e) {
      toast.error("Erro na importação: " + (e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const unknownProducts = rows.filter((r) => !r.produto_no_catalogo);
  const uniqueUnknownProducts = [...new Set(unknownProducts.map((r) => r.produto_nome))];
  const duplicateCount = rows.filter((r) => r.flag === "duplicata").length;
  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Importar Planilha — Passo {step}/3</DialogTitle>
        </DialogHeader>

        {/* STEP 1: Platform */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/80">De qual plataforma é essa planilha?</Label>
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

        {/* STEP 2: Upload */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12">
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">Arraste ou selecione um arquivo CSV, XLS ou XLSX</p>
              <Input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileUpload} className="max-w-xs bg-secondary/50 border-border" />
            </div>
            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setStep(1)} className="border-border text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview & Approve */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-secondary/50 text-foreground">{rows.length} vendas encontradas</span>
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400">{selectedCount} selecionadas</span>
              {duplicateCount > 0 && (
                <span className="px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />{duplicateCount} possíveis duplicatas
                </span>
              )}
              {uniqueUnknownProducts.length > 0 && (
                <span className="px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400">
                  <AlertCircle className="h-3 w-3 inline mr-1" />{uniqueUnknownProducts.length} produtos não catalogados
                </span>
              )}
            </div>

            {/* Unknown products alert */}
            {uniqueUnknownProducts.length > 0 && (
              <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 space-y-2">
                <p className="text-xs text-yellow-400 font-medium flex items-center gap-1.5">
                  <PackagePlus className="h-4 w-4" /> Produtos não encontrados no catálogo:
                </p>
                <div className="flex flex-wrap gap-2">
                  {uniqueUnknownProducts.map((name) => {
                    const idx = rows.findIndex((r) => r.produto_nome === name);
                    return (
                      <button
                        key={name}
                        onClick={() => handleAddProductToCatalog(idx)}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 transition-colors flex items-center gap-1"
                      >
                        <PackagePlus className="h-3 w-3" /> {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="p-2">
                        <Checkbox
                          checked={rows.length > 0 && rows.every((r) => r.selected)}
                          onCheckedChange={(v) => setRows(rows.map((r) => ({ ...r, selected: !!v })))}
                        />
                      </th>
                      <th className="p-2 text-left text-muted-foreground">Data</th>
                      <th className="p-2 text-left text-muted-foreground">Produto</th>
                      <th className="p-2 text-left text-muted-foreground">Cliente</th>
                      <th className="p-2 text-right text-muted-foreground">Bruto</th>
                      <th className="p-2 text-right text-muted-foreground">Líquido</th>
                      <th className="p-2 text-left text-muted-foreground">Status</th>
                      <th className="p-2 text-center text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={`border-b border-border/50 ${
                          r.flag === "produto_fisico"
                            ? "bg-yellow-500/5"
                            : r.flag === "duplicata"
                            ? "bg-orange-500/5"
                            : "hover:bg-surface-hover"
                        }`}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={r.selected}
                            onCheckedChange={(v) => {
                              const updated = [...rows];
                              updated[i].selected = !!v;
                              setRows(updated);
                            }}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatDate(r.data)}</td>
                        <td className="p-2 max-w-[160px]">
                          <div className="truncate">{r.produto_nome}</div>
                          {!r.produto_no_catalogo && (
                            <span className="text-[9px] text-yellow-400">Não catalogado</span>
                          )}
                        </td>
                        <td className="p-2 max-w-[120px]">
                          <div className="truncate">{r.cliente_nome}</div>
                          <div className="text-[9px] text-muted-foreground truncate">{r.cliente_email}</div>
                        </td>
                        <td className="p-2 text-right">{formatCurrency(r.valor_bruto)}</td>
                        <td className="p-2 text-right text-primary">{formatCurrency(r.valor_liquido)}</td>
                        <td className="p-2">
                          {r.flag === "produto_fisico" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px]">
                              <AlertTriangle className="h-3 w-3" /> Físico
                            </span>
                          )}
                          {r.flag === "duplicata" && (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px]">
                                <AlertTriangle className="h-3 w-3" /> Duplicata
                              </span>
                              <div className="flex gap-1">
                                {r.duplicata_receita_id && (
                                  <button
                                    onClick={() => setShowDuplicataId(r.duplicata_receita_id)}
                                    className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
                                  >
                                    <Eye className="h-3 w-3" /> Ver existente
                                  </button>
                                )}
                                <button
                                  onClick={() => handleMergeDuplicate(i)}
                                  className="text-[9px] text-emerald-400 hover:underline flex items-center gap-0.5"
                                >
                                  <Link2 className="h-3 w-3" /> Mesclar
                                </button>
                              </div>
                            </div>
                          )}
                          {r.flag === "normal" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">
                              <CheckCircle className="h-3 w-3" /> OK
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setEditIdx(i)}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(i)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep(2)} className="border-border text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing || selectedCount === 0} className="gold-gradient text-primary-foreground">
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Lançar no sistema ({selectedCount})
              </Button>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <ImportRowEditDialog
          open={editIdx !== null}
          onClose={() => setEditIdx(null)}
          row={editIdx !== null ? rows[editIdx] : null}
          onSave={handleEditSave}
        />

        {/* Duplicate viewer */}
        {showDuplicataId && (
          <DuplicateViewer
            receitaId={showDuplicataId}
            onClose={() => setShowDuplicataId(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DuplicateViewer({ receitaId, onClose }: { receitaId: string; onClose: () => void }) {
  const { data: receita } = useQuery({
    queryKey: ["receita-duplicata", receitaId],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("*").eq("id", receitaId).single();
      return data;
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm">Venda existente no sistema</DialogTitle>
        </DialogHeader>
        {receita ? (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground text-xs">Data:</span> <span className="text-foreground">{formatDate(receita.data)}</span></div>
              <div><span className="text-muted-foreground text-xs">Plataforma:</span> <span className="text-foreground">{receita.plataforma}</span></div>
              <div><span className="text-muted-foreground text-xs">Produto:</span> <span className="text-foreground">{receita.produto_nome}</span></div>
              <div><span className="text-muted-foreground text-xs">Valor bruto:</span> <span className="text-primary">{formatCurrency(receita.valor_bruto)}</span></div>
              <div><span className="text-muted-foreground text-xs">Cliente:</span> <span className="text-foreground">{receita.cliente_nome}</span></div>
              <div><span className="text-muted-foreground text-xs">Email:</span> <span className="text-foreground">{receita.cliente_email}</span></div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
