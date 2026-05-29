import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// The cloud entry source is index.cloud.html (the local build owns index.html),
// but static hosts serve index.html at "/" by default, so rename the emitted
// HTML to index.html in the dist-cloud output.
function emitIndexHtml(): Plugin {
  return {
    name: "zfiles-cloud-index-html",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = bundle["index.cloud.html"];
      if (html) {
        html.fileName = "index.html";
        delete bundle["index.cloud.html"];
        bundle["index.html"] = html;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), emitIndexHtml()],
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
