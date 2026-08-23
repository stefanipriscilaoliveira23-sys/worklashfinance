import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O Amigos do Tênis é um app independente dentro deste repositório.
// `postcss: { plugins: [] }` impede o Vite de subir a árvore de pastas
// e carregar a config de PostCSS/Tailwind do app financeiro na raiz.
export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  build: { outDir: 'dist' },
})
