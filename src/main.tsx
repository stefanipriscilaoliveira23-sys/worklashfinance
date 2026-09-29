import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { registrarServiceWorker } from "@/lib/push";
import "./index.css";

// Registra o service worker (necessário pra instalar na tela de início e pra
// receber push). Não pede permissão nenhuma aqui: isso só acontece quando a
// pessoa toca no botão em Configurações > Minha conta.
registrarServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
