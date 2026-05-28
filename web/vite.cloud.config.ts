import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_BOOT_MODE": JSON.stringify("cloud"),
  },
  build: {
    outDir: "dist-cloud",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(rootDir, "index.cloud.html"),
    },
  },
  server: {
    strictPort: true,
    open: "/index.cloud.html",
  },
});
