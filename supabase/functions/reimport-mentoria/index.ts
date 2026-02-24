import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx";

type Periodicidade = "Semanal" | "Quinzenal" | "Mensal";
type StatusParcela = "Pendente" | "Quitado" | "Atraso" | "Parcialmente Pago";

type Detalhe = {
  numero_parcela: number;
  data_vencimento: string;
  valor: number;
  status: StatusParcela;
  data_pagamento: string | null;
  observacao: string | null;
};

type ContractAggregate = {
  cliente_nome: string;
  tipo_mentoria: string;
  valor_total: number;
  entrada_valor: number;
  quant_parcelas: number;
  periodicidade: Periodicidade;
  data_inicio: string;
  detalhes: Map<number, Detalhe>;
  fallback_valor_parcela: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_SCORE: Record<StatusParcela, number> = {
  Pendente: 1,
  Atraso: 2,
  "Parcialmente Pago": 3,
  Quitado: 4,
};

const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const parseMoney = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let s = String(value ?? "").trim();
  if (!s || s === "-") return 0;
  s = s.replace(/r\$/gi, "").replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const parseInteger = (value: unknown): number => {
  const n = Number(String(value ?? "").replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const formatYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDate = (value: unknown): string | null => {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return formatYMD(new Date(parsed.y, parsed.m - 1, parsed.d));
  }
  const s = String(value).trim();
  if (!s || s === "-") return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/").map(Number);
    if (yyyy > 1900 && yyyy < 2100) return formatYMD(new Date(yyyy, mm - 1, dd));
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split("/").map(Number);
    const [dd, mm, yyyy] = parts;
    if (yyyy > 1900 && yyyy < 2100) return formatYMD(new Date(yyyy, mm - 1, dd));
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : formatYMD(dt);
};

const addInstallmentInterval = (baseDate: string, index: number, periodicidade: Periodicidade): string => {
  const [year, month, day] = baseDate.split("-").map(Number);
  const dt = new Date(year, month - 1, day);
  if (periodicidade === "Semanal") dt.setDate(dt.getDate() + index * 7);
  if (periodicidade === "Quinzenal") dt.setDate(dt.getDate() + index * 14);
  if (periodicidade === "Mensal") dt.setMonth(dt.getMonth() + index);
  return formatYMD(dt);
};

const mapTipoMentoria = (raw: unknown): string => {
  const s = normalizeText(raw);
  if (s.includes("renovacao")) return "Renovação Mentoria";
  if (s.includes("digital beauty") || s.includes("mentoria db") || s === "db") return "Mentoria Digital Beauty";
  if (s.includes("consultoria premium")) return "Consultoria Premium";
  if (s.includes("consultoria express")) return "Consultoria Express";
  if (s.includes("consultoria")) return "Consultoria Premium";
  if (s.includes("outsider")) return "Mentoria Outsider";
  return "Outros";
};

const mapPeriodicidade = (raw: unknown): Periodicidade => {
  const s = normalizeText(raw);
  if (s.includes("quin")) return "Quinzenal";
  if (s.includes("sem")) return "Semanal";
  return "Mensal";
};

const mapStatus = (raw: unknown): StatusParcela => {
  const s = normalizeText(raw);
  if (s.includes("quit")) return "Quitado";
  if (s.includes("parcial")) return "Parcialmente Pago";
  if (s.includes("atras")) return "Atraso";
  if (s.includes("receber")) return "Pendente";
  return "Pendente";
};

const getCell = (row: Record<string, unknown>, ...headers: string[]) => {
  const normalized = Object.entries(row).reduce<Record<string, unknown>>((acc, [k, v]) => {
    acc[normalizeText(k)] = v;
    return acc;
  }, {});
  for (const h of headers) {
    const v = normalized[normalizeText(h)];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceRole) throw new Error("Missing env");

    const db = createClient(supabaseUrl, supabaseServiceRole);

    // Fetch xlsx from storage
    const storageUrl = `${supabaseUrl}/storage/v1/object/public/mentoria-imports/Parcelas_mentoria_WORKLASH-2.xlsx`;
    const fileResponse = await fetch(storageUrl);
    if (!fileResponse.ok) throw new Error(`Download failed: ${fileResponse.status}`);
    const fileBuffer = await fileResponse.arrayBuffer();
    const workbook = XLSX.read(fileBuffer, { type: "array" });

    const contracts = new Map<string, ContractAggregate>();

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

      for (const row of rows) {
        const cliente = String(getCell(row, "Cliente") ?? "").trim();
        if (!cliente) continue;

        const tipo_mentoria = mapTipoMentoria(getCell(row, "Tipo"));
        const valor_total = parseMoney(getCell(row, "Valor Total"));
        const entrada_valor = parseMoney(getCell(row, "Entrada"));
        const quant_parcelas = parseInteger(getCell(row, "Quant. parcela", "Quant parcela"));
        const periodicidade = mapPeriodicidade(getCell(row, "PAGAMENTO", "Pagamento"));
        const numero_parcela = parseInteger(getCell(row, "Numero parcela", "Número parcela"));
        // Handle different column names across tabs
        const data_vencimento = parseDate(getCell(row, "Data parcela", "Data Venda")) ?? parseDate(Object.values(row)[0]);
        const data_pagamento = parseDate(getCell(row, "Data de pagamento"));
        const valor_parcela = parseMoney(getCell(row, "Valor Parcela"));
        const observacaoRaw = String(getCell(row, "Observação", "Observacao") ?? "").trim();
        const observacao = observacaoRaw || null;
        const status = mapStatus(getCell(row, "Status"));

        if (!quant_parcelas || !data_vencimento || !numero_parcela) continue;

        const key = [
          normalizeText(cliente),
          tipo_mentoria,
          valor_total.toFixed(2),
          entrada_valor.toFixed(2),
          quant_parcelas,
          periodicidade,
        ].join("|");

        if (!contracts.has(key)) {
          contracts.set(key, {
            cliente_nome: cliente,
            tipo_mentoria,
            valor_total,
            entrada_valor,
            quant_parcelas,
            periodicidade,
            data_inicio: data_vencimento,
            detalhes: new Map(),
            fallback_valor_parcela: valor_parcela,
          });
        }

        const contract = contracts.get(key)!;
        if (data_vencimento < contract.data_inicio) contract.data_inicio = data_vencimento;
        if (valor_parcela > 0 && contract.fallback_valor_parcela === 0) contract.fallback_valor_parcela = valor_parcela;

        const candidate: Detalhe = { numero_parcela, data_vencimento, valor: valor_parcela, status, data_pagamento, observacao };
        const existing = contract.detalhes.get(numero_parcela);

        if (!existing) {
          contract.detalhes.set(numero_parcela, candidate);
        } else {
          const keepCandidate = STATUS_SCORE[candidate.status] > STATUS_SCORE[existing.status] ||
            (STATUS_SCORE[candidate.status] === STATUS_SCORE[existing.status] &&
              (candidate.data_pagamento ?? "") > (existing.data_pagamento ?? ""));
          if (keepCandidate) contract.detalhes.set(numero_parcela, candidate);
        }
      }
    }

    const today = formatYMD(new Date());

    // Delete old data
    await db.from("pagamentos_parciais").delete().eq("referencia_tipo", "parcela_mentoria_detalhe");
    await db.from("parcelas_mentoria_detalhe").delete().not("id", "is", null);
    await db.from("parcelas_mentoria").delete().not("id", "is", null);

    // Get clients
    const { data: clientes } = await db.from("clientes").select("id, nome");
    const clientesByNome = new Map<string, string>();
    (clientes ?? []).forEach((c: any) => clientesByNome.set(normalizeText(c.nome), c.id));

    // Prepare all contract inserts
    const contractInserts: any[] = [];
    const contractKeys: string[] = [];

    for (const [key, contract] of contracts) {
      const valorBase = contract.fallback_valor_parcela > 0
        ? contract.fallback_valor_parcela
        : Number(((contract.valor_total - contract.entrada_valor) / Math.max(contract.quant_parcelas, 1)).toFixed(2));

      // Fill missing parcelas
      for (let i = 1; i <= contract.quant_parcelas; i++) {
        if (!contract.detalhes.has(i)) {
          const data = addInstallmentInterval(contract.data_inicio, i - 1, contract.periodicidade);
          contract.detalhes.set(i, {
            numero_parcela: i,
            data_vencimento: data,
            valor: valorBase,
            status: data < today ? "Atraso" : "Pendente",
            data_pagamento: null,
            observacao: null,
          });
        }
      }

      const detalhes = Array.from(contract.detalhes.values());
      const hasAtraso = detalhes.some(d => d.status !== "Quitado" && d.data_vencimento < today);
      const allQuitado = detalhes.every(d => d.status === "Quitado");
      const status_geral: StatusParcela = allQuitado ? "Quitado" : hasAtraso ? "Atraso" : "Pendente";

      contractInserts.push({
        cliente_nome: contract.cliente_nome,
        cliente_id: clientesByNome.get(normalizeText(contract.cliente_nome)) ?? null,
        tipo_mentoria: contract.tipo_mentoria,
        valor_total: Number(contract.valor_total.toFixed(2)),
        entrada_valor: Number(contract.entrada_valor.toFixed(2)),
        quant_parcelas: contract.quant_parcelas,
        periodicidade: contract.periodicidade,
        data_inicio: contract.data_inicio,
        status_geral,
        is_renovacao: contract.tipo_mentoria === "Renovação Mentoria",
      });
      contractKeys.push(key);
    }

    // Batch insert contracts (in chunks of 50)
    const CHUNK = 50;
    const insertedIds: string[] = [];

    for (let i = 0; i < contractInserts.length; i += CHUNK) {
      const chunk = contractInserts.slice(i, i + CHUNK);
      const { data: inserted, error } = await db
        .from("parcelas_mentoria")
        .insert(chunk)
        .select("id");
      if (error) throw error;
      for (const row of inserted) insertedIds.push(row.id);
    }

    // Build all detalhe inserts
    const allDetalhesInsert: any[] = [];
    let idx = 0;
    for (const [key, contract] of contracts) {
      const parentId = insertedIds[idx++];
      const detalhes = Array.from(contract.detalhes.values()).sort((a, b) => a.numero_parcela - b.numero_parcela);

      for (const d of detalhes) {
        const statusFinal: StatusParcela = d.status === "Quitado"
          ? "Quitado"
          : d.data_vencimento < today ? "Atraso" : d.status;
        const valorPago = statusFinal === "Quitado" ? d.valor : 0;
        const saldoParcela = Math.max(0, Number((d.valor - valorPago).toFixed(2)));

        allDetalhesInsert.push({
          parcela_mentoria_id: parentId,
          numero_parcela: d.numero_parcela,
          data_vencimento: d.data_vencimento,
          valor_sugerido: Number(d.valor.toFixed(2)),
          valor_real: Number(d.valor.toFixed(2)),
          valor_pago_parcial: Number(valorPago.toFixed(2)),
          saldo_parcela: saldoParcela,
          status: statusFinal,
          data_pagamento: statusFinal === "Quitado" ? d.data_pagamento ?? d.data_vencimento : null,
          observacao: d.observacao,
        });
      }
    }

    // Batch insert detalhes
    for (let i = 0; i < allDetalhesInsert.length; i += CHUNK) {
      const chunk = allDetalhesInsert.slice(i, i + CHUNK);
      const { error } = await db.from("parcelas_mentoria_detalhe").insert(chunk);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, contratos: contractInserts.length, parcelas: allDetalhesInsert.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
