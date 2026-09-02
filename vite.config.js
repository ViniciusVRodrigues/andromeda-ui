import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // e2e no Docker (npm run e2e:docker) acessa o dev server via host.docker.internal
    allowedHosts: ["host.docker.internal"],
    // Proxy de desenvolvimento para o futuro backend Spring Boot.
    // O frontend chama "/api/..." e o Vite encaminha para o Spring em :8080.
    proxy: {
      "/api": {
        target: "http://localhost:9090",
        changeOrigin: true,
      },
    },
  },
});
