import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

/**
 * Build da app (TanStack Start + Nitro).
 * O Nitro deteta sozinho onde está a ser publicado (Vercel, Netlify, Cloudflare…)
 * e gera o formato certo; no computador gera um servidor Node normal.
 */
export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // O ficheiro de entrada do servidor é src/server.ts (devolve uma página de erro em vez de um 500 vazio).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
}));
