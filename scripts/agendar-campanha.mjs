#!/usr/bin/env node
// Agenda uma mensagem da aba Campanhas (Escritório) direto do terminal.
// Quem dispara depois é o robô campanhas-disparo, na hora marcada, pelo WhatsApp da Worklash (1388).
//
// Uso:
//   node scripts/agendar-campanha.mjs agendar --oferta "Nome da oferta" --dia 2026-10-03 --hora 16:00 \
//        --texto copy.txt [--imagem arte.jpg] [--titulo "..."] [--grupos todos|teste|"Nome 1;Nome 2"] [--rascunho]
//   node scripts/agendar-campanha.mjs listar
//   node scripts/agendar-campanha.mjs cancelar <mensagem_id>
//
// --texto é o caminho de um arquivo com a copy (preserva quebra de linha e emoji).
// A senha fica em ~/.config/worklash/campanhas.json (fora do repositório, que é público).
import { readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

const cfg = JSON.parse(readFileSync(join(homedir(), ".config/worklash/campanhas.json"), "utf8"));
const [acao, ...resto] = process.argv.slice(2);

const args = {};
for (let i = 0; i < resto.length; i++) {
  if (!resto[i].startsWith("--")) continue;
  const k = resto[i].slice(2);
  const prox = resto[i + 1];
  if (prox === undefined || prox.startsWith("--")) args[k] = true;
  else { args[k] = prox; i++; }
}

async function chamar(corpo) {
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-segredo": cfg.segredo },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({ erro: `HTTP ${r.status}` }));
  if (!r.ok || j.erro) { console.error("ERRO:", j.erro ?? j); process.exit(1); }
  return j;
}

/** WhatsApp lida melhor com jpg/png; webp, heic etc. viram jpg pelo sips do Mac */
function prepararImagem(caminho) {
  const ext = extname(caminho).toLowerCase();
  let arquivo = caminho;
  if (![".jpg", ".jpeg", ".png"].includes(ext) && [".webp", ".heic", ".heif", ".tiff", ".gif", ".bmp"].includes(ext)) {
    arquivo = join(mkdtempSync(join(tmpdir(), "campanha-")), basename(caminho, ext) + ".jpg");
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", caminho, "--out", arquivo], { stdio: "ignore" });
  }
  const e = extname(arquivo).toLowerCase();
  const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".mov": "video/quicktime", ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" }[e] ?? "application/octet-stream";
  return { base64: readFileSync(arquivo).toString("base64"), nome: basename(arquivo), mime };
}

if (acao === "listar") {
  const { mensagens } = await chamar({ acao: "listar" });
  if (!mensagens.length) console.log("Nada agendado de hoje em diante.");
  for (const m of mensagens) {
    console.log(`${m.dia} ${m.hora.slice(0, 5)}  [${m.status}]  ${m.campanhas?.oferta}  ${m.titulo ? `· ${m.titulo}` : ""}  ${m.grupos ? `${m.grupos.length} grupo(s)` : "todos os grupos"}  ${m.midia_tipo ?? "só texto"}  id=${m.id}`);
  }
} else if (acao === "cancelar") {
  const id = resto[0];
  if (!id) { console.error("Uso: cancelar <mensagem_id>"); process.exit(1); }
  const r = await chamar({ acao: "cancelar", mensagem_id: id });
  console.log("Cancelada:", r.cancelada);
} else if (acao === "agendar") {
  for (const k of ["oferta", "dia", "hora", "texto"]) if (!args[k]) { console.error(`Falta --${k}`); process.exit(1); }
  const grupos = !args.grupos || args.grupos === "todos" ? "todos" : args.grupos === "teste" ? "teste" : String(args.grupos).split(";").map((s) => s.trim()).filter(Boolean);
  const r = await chamar({
    acao: "agendar",
    oferta: args.oferta,
    texto: readFileSync(args.texto, "utf8").replace(/\s+$/, ""),
    dia: args.dia,
    hora: args.hora,
    titulo: args.titulo ?? "",
    descricao: args.descricao ?? "",
    grupos,
    rascunho: !!args.rascunho,
    ...(args.imagem ? { imagem: prepararImagem(args.imagem) } : {}),
  });
  console.log(`${r.status === "agendada" ? "AGENDADA" : "RASCUNHO"}: "${r.campanha}" em ${r.dia} às ${r.hora}`);
  console.log(`Grupos (${r.grupos.length}): ${r.grupos.join(", ")}`);
  if (r.midia_url) console.log(`Mídia: ${r.midia_url}`);
  console.log(`mensagem_id=${r.mensagem_id}`);
} else {
  console.error("Ações: agendar | listar | cancelar");
  process.exit(1);
}
