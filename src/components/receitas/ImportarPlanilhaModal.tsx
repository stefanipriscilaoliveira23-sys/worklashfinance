import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, Upload, Loader2, ArrowRight, ArrowLeft, CheckCircle,
  Pencil, Trash2, Eye, PackagePlus, AlertCircle, Link2, Plus
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { ImportRowEditDialog } from "./ImportRowEditDialog";
import type { Database } from "@/integrations/supabase/types";

type PlataformaOrigem = Database["public"]["Enums"]["plataforma_origem"];
type ProdutoCategoria = Database["public"]["Enums"]["produto_categoria"];

const CATEGORIAS: ProdutoCategoria[] = ["Mentorias", "Renovações", "Digitais", "Físicos"];

interface ImportRow {
  data: string;
  produto_nome: string;
  valor_bruto: number;
  valor_bruto_original: number;
  taxa_plataforma_valor: number;
  valor_liquido: number;
  valor_liquido_original: number;
  cliente_nome: string;
  cliente_email: string;
  forma_pagamento: string;
  moeda_original: string;
  taxa_cambio: number;
  utm_source?: string;
  src_checkout?: string;
  sck?: string;
  // enrichment
  flag: "normal" | "produto_fisico" | "duplicata";
  selected: boolean;
  produto_id: string | null;
  produto_no_catalogo: boolean;
  duplicata_receita_id: string | null;
}

// Flexible column matching with robust normalization (accents, spaces, underscores, symbols)
const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

function findColumnValue(row: Record<string, any>, patterns: string[]): any {
  const keys = Object.keys(row);
  const keyMeta = keys.map((k) => ({ raw: k, norm: normalizeKey(k) }));

  for (const pattern of patterns) {
    const pNorm = normalizeKey(pattern);
    if (!pNorm) continue;

    const exact = keyMeta.find((k) => k.norm === pNorm);
    if (exact) {
      const value = row[exact.raw];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  for (const pattern of patterns) {
    const pNorm = normalizeKey(pattern);
    if (!pNorm || pNorm.length < 4) continue;

    const partial = keyMeta.find((k) => {
      // Only allow partial match if the shorter string is at least 60% of the longer
      const shorter = Math.min(k.norm.length, pNorm.length);
      const longer = Math.max(k.norm.length, pNorm.length);
      if (shorter / longer < 0.5) return false;
      return k.norm.includes(pNorm) || pNorm.includes(k.norm);
    });
    if (partial) {
      const value = row[partial.raw];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return undefined;
}

function parseSpreadsheetDate(rawDate: any): string {
  if (rawDate === undefined || rawDate === null || rawDate === "") return "";

  if (typeof rawDate === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + rawDate * 86400000);
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  }

  const raw = String(rawDate).trim();
  if (!raw) return "";

  // Excel serial date as string (e.g. "45678" or "45678.25")
  if (/^\d{4,}(?:[.,]\d+)?$/.test(raw)) {
    const serial = Number(raw.replace(",", "."));
    if (!Number.isNaN(serial)) {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + serial * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
  }

  // DD/MM/YYYY (with optional time/timezone)
  const brMatch = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (brMatch) {
    let [, d, m, y] = brMatch;
    if (y.length === 2) y = `20${y}`;
    const day = Number(d);
    const month = Number(m);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // YYYY-MM-DD / YYYY/MM/DD
  const isoMatch = raw.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
}

const HOTMART_FIELDS: Record<string, string[]> = {
  data: [
    "Data de Venda", "Data da Venda", "Data transação", "Data Transação", "Data da transação", "Data da Transação",
    "Data de compra", "Data da compra", "Data Compra", "Transaction Date", "Sale Date", "data", "date"
  ],
  produto_nome: ["Produto", "Product", "Nome do Produto"],
  valor_liquido: ["Faturamento líquido do(a) Produtor(a)", "Faturamento líquido", "Net Revenue", "Valor Líquido", "Received Value"],
  valor_liquido_convertido: ["Valor que você recebeu convertido", "Valor recebido convertido", "Converted received value", "Valor recebido em BRL"],
  valor_bruto_original: ["Preço Total", "Preço total", "Total Price", "Valor Bruto", "Preço do Produto", "Valor da compra"],
  taxa_plataforma_valor: ["Taxa de processamento", "Processing Fee", "Taxa", "Fee"],
  cliente_nome: ["Nome", "Comprador(a)", "Comprador", "Buyer", "Nome do Comprador", "Nome Comprador"],
  cliente_email: ["Email", "Email do(a) Comprador(a)", "Email do Comprador", "Buyer Email", "E-mail"],
  forma_pagamento: ["Tipo de Pagamento", "Método de pagamento", "Payment Method", "Forma de Pagamento"],
  moeda_original: ["Moeda", "Moeda de compra", "Moeda da compra", "Purchase Currency", "Currency"],
  taxa_cambio: ["Taxa de Câmbio do valor recebido", "Taxa de Câmbio", "Taxa de Câmbio Real", "Taxa de cambio", "Cotação", "Cotacao", "Exchange Rate"],
  src_checkout: ["Origem de Checkout", "Origem da venda", "SRC Checkout", "Src Checkout", "Src", "src", "SRC", "src_checkout", "Source"],
  sck: ["Sck", "sck", "SCK", "Sck (User Agent)", "Checkout Key"],
  utm_source: ["Origem da venda", "utm_source", "UTM Source", "Origem", "Source"],
};

const KIWIFY_FIELDS: Record<string, string[]> = {
  data: ["Data de Criação", "Data", "Created At"],
  produto_nome: ["Produto", "Product"],
  valor_bruto_original: ["Valor da Compra", "Valor Bruto", "Valor Total", "Gross Value", "Preço"],
  valor_liquido: ["Valor líquido", "Valor Líquido", "Net Value"],
  taxa_plataforma_valor: ["Taxas", "Fees", "Taxa"],
  cliente_nome: ["Cliente", "Customer", "Nome"],
  cliente_email: ["Email", "E-mail"],
  forma_pagamento: ["Pagamento", "Payment", "Forma de Pagamento"],
};

const EDUZZ_FIELDS: Record<string, string[]> = {
  data: ["Data de Pagamento", "Data", "Payment Date"],
  produto_nome: ["Produto", "Product", "Nome do Produto"],
  valor_bruto_original: ["Valor da Venda", "Valor do Item", "Valor Bruto", "Sale Value"],
  valor_liquido: ["Ganho Liquido", "Ganho Líquido", "Net Gain"],
  taxa_plataforma_valor: ["Taxa Eduzz", "Taxa", "Fee"],
  cliente_nome: ["Cliente / Nome", "Cliente", "Customer", "Nome"],
  cliente_email: ["Cliente / E-mail", "Email", "E-mail"],
  forma_pagamento: ["Forma de Pagamento", "Payment"],
  utm_source: ["UTM Source", "utm_source"],
};

const PLATFORM_FIELDS: Record<string, Record<string, string[]>> = {
  Hotmart: HOTMART_FIELDS,
  Kiwify: KIWIFY_FIELDS,
  Eduzz: EDUZZ_FIELDS,
};

export function ImportarPlanilhaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [plataforma, setPlataforma] = useState<PlataformaOrigem>("Hotmart");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showDuplicataId, setShowDuplicataId] = useState<string | null>(null);
  const [addProdDialog, setAddProdDialog] = useState<{ nome: string; idx: number } | null>(null);
  const [addProdCategoria, setAddProdCategoria] = useState<ProdutoCategoria>("Digitais");
  const [addProdMode, setAddProdMode] = useState<"new" | "link">("link");
  const [addProdLinkId, setAddProdLinkId] = useState<string>("");

  const { data: receitas } = useQuery({
    queryKey: ["receitas-all-import"],
    queryFn: async () => {
      const { data } = await supabase.from("receitas").select("id, cliente_email, produto_nome, data, valor_bruto, cliente_nome");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-all-import"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome, email");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-catalogo"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_catalogo").select("*").eq("ativo", true);
      return data ?? [];
    },
    enabled: open,
  });

  const matchProduct = (nome: string) => {
    if (!produtos) return { id: null, found: false, catalogName: null };
    const lower = nome.toLowerCase().trim();
    const exact = produtos.find((p) => p.nome.toLowerCase().trim() === lower);
    if (exact) return { id: exact.id, found: true, catalogName: exact.nome };
    const partial = produtos.find((p) => lower.includes(p.nome.toLowerCase().trim()) || p.nome.toLowerCase().trim().includes(lower));
    if (partial) return { id: partial.id, found: true, catalogName: partial.nome };
    return { id: null, found: false, catalogName: null };
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

          const fields = PLATFORM_FIELDS[plataforma] ?? {};
          const mapped: ImportRow[] = json.map((row) => {
            const getField = (field: string) => findColumnValue(row, fields[field] ?? []);

            let dateStr = "";
            // Try mapped field first, then fallback: find any column with "data" or "date"
            let rawDate = getField("data");
            if (rawDate === undefined || rawDate === null || rawDate === "") {
              const dateKey = Object.keys(row).find((k) => {
                const kl = normalizeKey(k);
                return kl.includes("data") || kl.includes("date");
              });
              if (dateKey) rawDate = row[dateKey];
            }
            dateStr = parseSpreadsheetDate(rawDate);

            const parseNum = (v: any) => {
              if (v === undefined || v === null || v === "") return 0;
              if (typeof v === "number") return v;

              const raw = String(v).trim();
              if (!raw) return 0;
              const cleaned = raw.replace(/[^\d,.-]/g, "");
              if (!cleaned) return 0;

              // Both comma and dot present
              if (cleaned.includes(",") && cleaned.includes(".")) {
                const lastComma = cleaned.lastIndexOf(",");
                const lastDot = cleaned.lastIndexOf(".");
                if (lastComma > lastDot) {
                  // Brazilian: "5.500,00" → 5500
                  return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
                }
                // US: "5,500.00" → 5500
                return Number(cleaned.replace(/,/g, "")) || 0;
              }

              // Only dot, no comma — check for Brazilian thousand separator
              // Pattern: "5.500", "11.200", "1.234.567" (dot followed by exactly 3 digits)
              if (cleaned.includes(".") && !cleaned.includes(",")) {
                if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
                  // Brazilian thousands: "5.500" → 5500, "11.200" → 11200
                  return Number(cleaned.replace(/\./g, "")) || 0;
                }
              }

              // Only comma (Brazilian decimal): "5,50" → 5.5
              if (cleaned.includes(",")) {
                return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
              }

              return Number(cleaned) || 0;
            };

            const valorLiquidoOriginal = parseNum(getField("valor_liquido"));
            const taxaValor = parseNum(getField("taxa_plataforma_valor"));
            const moeda = String(getField("moeda_original") ?? "BRL").trim().toUpperCase();
            const precoTotalOriginal = parseNum(getField("valor_bruto_original"));
            const valorLiquidoConvertido = parseNum(getField("valor_liquido_convertido"));

            const liqOriginal = valorLiquidoOriginal;
            const brutoOriginal = precoTotalOriginal > 0 ? precoTotalOriginal : valorLiquidoOriginal + taxaValor;

            const genericCambio = parseNum(findColumnValue(row, ["taxa de cambio", "taxa de câmbio", "cotacao", "cotação", "exchange rate", "cambio"]));
            const taxaCambioBase = parseNum(getField("taxa_cambio")) || genericCambio;
            const taxaCambioDerivada = valorLiquidoConvertido > 0 && liqOriginal > 0 ? valorLiquidoConvertido / liqOriginal : 0;
            const taxaCambioRow = moeda !== "BRL"
              ? (taxaCambioBase > 1 ? taxaCambioBase : (taxaCambioDerivada > 1 ? taxaCambioDerivada : 1))
              : 1;

            let valorBruto: number;
            let valorLiqFinal: number;
            if (moeda !== "BRL") {
              valorBruto = brutoOriginal * taxaCambioRow;
              valorLiqFinal = valorLiquidoConvertido > 0 ? valorLiquidoConvertido : liqOriginal * taxaCambioRow;
            } else {
              valorBruto = brutoOriginal;
              valorLiqFinal = valorLiquidoConvertido > 0 ? valorLiquidoConvertido : liqOriginal;
            }

            const produtoNome = String(getField("produto_nome") ?? "").trim();
            const nome = produtoNome.toLowerCase();
            const isProdutoFisico = nome.includes("worklash") || nome.includes("kit ");

            const prodMatch = matchProduct(produtoNome);

            const genericSource = findColumnValue(row, ["src_checkout", "src", "utm_source", "utm source", "origem da venda", "origem", "source"]);
            const genericSck = findColumnValue(row, ["sck", "checkout key"]);
            const srcCheckout = getField("src_checkout") ? String(getField("src_checkout")).trim() : (genericSource ? String(genericSource).trim() : undefined);
            const sckValue = getField("sck") ? String(getField("sck")).trim() : (genericSck ? String(genericSck).trim() : undefined);
            const utmSource = getField("utm_source") ? String(getField("utm_source")).trim() : srcCheckout;

            const clienteNome = String(getField("cliente_nome") ?? "").trim();
            const clienteEmail = String(getField("cliente_email") ?? "").trim();

            const dup = findDuplicate({
              cliente_email: clienteEmail,
              produto_nome: produtoNome,
              data: dateStr,
              valor_bruto: valorBruto,
            });

            

            return {
              data: dateStr,
              produto_nome: prodMatch.catalogName ?? produtoNome,
              valor_bruto: valorBruto,
              valor_bruto_original: brutoOriginal,
              taxa_plataforma_valor: taxaValor,
              valor_liquido: valorLiqFinal,
              valor_liquido_original: liqOriginal,
              cliente_nome: clienteNome,
              cliente_email: clienteEmail,
              forma_pagamento: String(getField("forma_pagamento") ?? "").trim(),
              moeda_original: moeda,
              taxa_cambio: taxaCambioRow,
              utm_source: utmSource,
              src_checkout: srcCheckout,
              sck: sckValue,
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
    [plataforma, receitas, produtos]
  );

  const openAddProductDialog = (nome: string, idx: number) => {
    setAddProdCategoria("Digitais");
    setAddProdMode("link");
    setAddProdLinkId("");
    setAddProdDialog({ nome, idx });
  };

  const handleAddProductToCatalog = async () => {
    if (!addProdDialog) return;
    const { nome } = addProdDialog;

    if (addProdMode === "link" && addProdLinkId) {
      // Link to existing catalog product
      const prod = (produtos ?? []).find(p => p.id === addProdLinkId);
      if (!prod) return;
      toast.success(`"${nome}" vinculado a "${prod.nome}"!`);
      setRows((prev) => prev.map((r) => r.produto_nome === nome ? { ...r, produto_id: prod.id, produto_no_catalogo: true, produto_nome: prod.nome } : r));
      setAddProdDialog(null);
      return;
    }

    // Create new product
    const { data, error } = await supabase.from("produtos_catalogo").insert({
      nome,
      categoria: addProdCategoria,
      ativo: true,
    }).select().single();
    if (error) {
      toast.error("Erro ao adicionar produto: " + error.message);
      return;
    }
    toast.success(`Produto "${nome}" adicionado ao catálogo como ${addProdCategoria}!`);
    setRows((prev) => prev.map((r) => r.produto_nome === nome ? { ...r, produto_id: data.id, produto_no_catalogo: true } : r));
    queryClient.invalidateQueries({ queryKey: ["produtos-catalogo"] });
    setAddProdDialog(null);
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
      const newClients = new Map<string, string>();
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
        const inserts = toInsert.map((r) => {
          const hasUtm = !!(r.src_checkout || r.utm_source);
          return {
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
            taxa_cambio: r.taxa_cambio > 1 ? r.taxa_cambio : 1,
            valor_em_brl: r.valor_bruto,
            origens_venda: hasUtm ? ["Tráfego"] : [],
            src_checkout: r.src_checkout || null,
            sck: r.sck || null,
            lancado_por: user?.id,
            importado: true,
          };
        });
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
  const hasUsd = rows.some(r => r.moeda_original !== "BRL");

  const formatOriginal = (value: number, moeda: string) => {
    if (moeda === "USD") return `$ ${value.toFixed(2)}`;
    if (moeda === "EUR") return `€ ${value.toFixed(2)}`;
    return formatCurrency(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card border-border">
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
                  <PackagePlus className="h-4 w-4" /> Produtos não encontrados no catálogo — clique para vincular ou adicionar:
                </p>
                <div className="flex flex-wrap gap-2">
                  {uniqueUnknownProducts.map((name) => {
                    const idx = rows.findIndex((r) => r.produto_nome === name);
                    return (
                      <button
                        key={name}
                        onClick={() => openAddProductDialog(name, idx)}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 transition-colors flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> {name}
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
                      <th className="p-2 text-right text-muted-foreground">Líquido (R$)</th>
                      {hasUsd && (
                        <th className="p-2 text-right text-muted-foreground">Câmbio</th>
                      )}
                      <th className="p-2 text-left text-muted-foreground">Origem</th>
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
                        <td className="p-2 whitespace-nowrap">{r.data ? formatDate(r.data) : "—"}</td>
                        <td className="p-2 max-w-[160px]">
                          <div className="truncate">{r.produto_nome}</div>
                          {!r.produto_no_catalogo && (
                            <button
                              onClick={() => openAddProductDialog(r.produto_nome, i)}
                              className="text-[9px] text-yellow-400 hover:text-yellow-300 flex items-center gap-0.5 mt-0.5"
                            >
                              <Plus className="h-2.5 w-2.5" /> Adicionar ao catálogo
                            </button>
                          )}
                        </td>
                        <td className="p-2 max-w-[120px]">
                          <div className="truncate">{r.cliente_nome || "—"}</div>
                          {r.cliente_email && <div className="text-[9px] text-muted-foreground truncate">{r.cliente_email}</div>}
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {r.moeda_original !== "BRL"
                            ? formatOriginal(r.valor_bruto_original, r.moeda_original)
                            : formatCurrency(r.valor_bruto)
                          }
                        </td>
                        <td className="p-2 text-right text-primary whitespace-nowrap">
                          {formatCurrency(r.valor_liquido)}
                        </td>
                        {hasUsd && (
                          <td className="p-2 text-right text-muted-foreground whitespace-nowrap">
                            {r.moeda_original !== "BRL" && r.taxa_cambio > 1
                              ? `${r.taxa_cambio.toFixed(2)}`
                              : "—"
                            }
                          </td>
                        )}
                        <td className="p-2 max-w-[100px]">
                          {(r.src_checkout || r.utm_source) ? (
                            <div>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px]">Tráfego</span>
                              {r.src_checkout && <div className="text-[9px] text-muted-foreground truncate mt-0.5" title={r.src_checkout}>{r.src_checkout}</div>}
                              {r.sck && <div className="text-[9px] text-muted-foreground truncate" title={r.sck}>{r.sck}</div>}
                            </div>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">—</span>
                          )}
                        </td>
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
                                    <Eye className="h-3 w-3" /> Ver
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

        {/* Add Product Dialog */}
        {addProdDialog && (
          <Dialog open onOpenChange={() => setAddProdDialog(null)}>
            <DialogContent className="max-w-sm bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground text-sm">Vincular produto</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Produto na planilha</Label>
                  <p className="text-sm font-medium text-foreground">{addProdDialog.nome}</p>
                </div>

                {/* Mode selector */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddProdMode("link")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      addProdMode === "link"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Link2 className="h-3.5 w-3.5 inline mr-1" />
                    Vincular a existente
                  </button>
                  <button
                    onClick={() => setAddProdMode("new")}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      addProdMode === "new"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" />
                    Criar novo
                  </button>
                </div>

                {addProdMode === "link" ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Selecione o produto do catálogo</Label>
                    <Select value={addProdLinkId} onValueChange={setAddProdLinkId}>
                      <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Escolha um produto..." /></SelectTrigger>
                      <SelectContent>
                        {(produtos ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} <span className="text-muted-foreground ml-1">({p.categoria})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground">Categoria</Label>
                    <Select value={addProdCategoria} onValueChange={(v) => setAddProdCategoria(v as ProdutoCategoria)}>
                      <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddProdDialog(null)} className="border-border text-muted-foreground">Cancelar</Button>
                <Button
                  onClick={handleAddProductToCatalog}
                  disabled={addProdMode === "link" && !addProdLinkId}
                  className="gold-gradient text-primary-foreground"
                >
                  {addProdMode === "link" ? (
                    <><Link2 className="h-4 w-4 mr-1" /> Vincular</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-1" /> Adicionar</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

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
