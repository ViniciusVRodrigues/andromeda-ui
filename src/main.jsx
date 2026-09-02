import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
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
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
