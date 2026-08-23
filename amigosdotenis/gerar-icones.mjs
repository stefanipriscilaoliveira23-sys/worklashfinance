/* Gera os ícones PNG do app sem depender de biblioteca de imagem.
   Desenha uma bola de tênis (círculo lima + duas costuras) sobre fundo escuro.
   Rode com: node gerar-icones.mjs */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTabela = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = buf => {
  let c = ~0
  for (const b of buf) c = crcTabela[(c ^ b) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}
const pedaco = (tipo, dados) => {
  const t = Buffer.from(tipo, 'ascii')
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])))
  return Buffer.concat([tam, t, dados, crc])
}
const png = (largura, altura, rgba) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const linhas = Buffer.alloc((largura * 4 + 1) * altura)
  for (let y = 0; y < altura; y++) {
    linhas[y * (largura * 4 + 1)] = 0
    rgba.copy(linhas, y * (largura * 4 + 1) + 1, y * largura * 4, (y + 1) * largura * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(linhas, { level: 9 })),
    pedaco('IEND', Buffer.alloc(0)),
  ])
}

const LIMA   = [0xd9, 0xff, 0x3d]
const ESCURO = [0x0a, 0x0a, 0x12]
const ROXO   = [0x3a, 0x2a, 0x6e]

function icone(tam) {
  const S = 3                       // supersampling: 3x3 amostras por pixel
  const px = Buffer.alloc(tam * tam * 4)
  const c = tam / 2
  const R = tam * 0.295             // raio da bola (dentro da zona segura do maskable)
  // As costuras sao dois arcos: circulos deslocados pros lados, de raio maior
  // que a bola. O ponto mais proximo do centro fica a ~0.52R, que e o que da
  // o desenho classico — a costura encosta no meio e abre pras bordas.
  const Rc = R * 1.25               // raio das costuras
  const dc = R * 1.77               // deslocamento dos centros das costuras
  const esp = tam * 0.0135          // espessura da costura

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let r = 0, g = 0, b = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px_ = x + (sx + 0.5) / S
          const py_ = y + (sy + 0.5) / S
          // fundo: leve gradiente do roxo pro escuro na diagonal
          const t = Math.min(1, Math.max(0, (px_ + py_) / (2 * tam)))
          let cor = [
            Math.round(ROXO[0] + (ESCURO[0] - ROXO[0]) * t),
            Math.round(ROXO[1] + (ESCURO[1] - ROXO[1]) * t),
            Math.round(ROXO[2] + (ESCURO[2] - ROXO[2]) * t),
          ]
          const dist = Math.hypot(px_ - c, py_ - c)
          if (dist <= R) {
            cor = LIMA
            const d1 = Math.abs(Math.hypot(px_ - c - dc, py_ - c) - Rc)
            const d2 = Math.abs(Math.hypot(px_ - c + dc, py_ - c) - Rc)
            if (Math.min(d1, d2) < esp) cor = ESCURO
          }
          r += cor[0]; g += cor[1]; b += cor[2]
        }
      }
      const n = S * S, i = (y * tam + x) * 4
      px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n; px[i + 3] = 255
    }
  }
  return png(tam, tam, px)
}

for (const tam of [192, 512]) {
  writeFileSync(`public/icone-${tam}.png`, icone(tam))
  console.log(`public/icone-${tam}.png gerado`)
}
