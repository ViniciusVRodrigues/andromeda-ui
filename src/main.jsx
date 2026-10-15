import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import { ErrorBoundary } from "./core/ui/ErrorBoundary.jsx";
/* Fontes servidas pelo próprio app (antes vinham do Google Fonts pela rede): mesmas
 * famílias e pesos de antes — DM Serif Display 400 normal e itálico, JetBrains Mono
 * 300–800 — com todos os subconjuntos (unicode-range) e font-display: swap. */
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource/jetbrains-mono/300.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/jetbrains-mono/800.css";
import "./styles/globals.css";

// Estado de servidor vive aqui, não em useState de componente (frontend-server-state).
// staleTime generoso: voltar a uma área renderiza do cache sem flash — o UX que a
// casca preservava ao nunca desmontar. 4xx não têm retry (são resposta, não falha).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !/\(4[0-9]{2}\)/.test(String(err?.message)) && count < 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary variant="root">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
