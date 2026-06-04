import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// The cloud entry source is index.cloud.html (the local build owns index.html),
// but static hosts serve index.html at "/" by default, so rename the emitted
// HTML to index.html in the dist-cloud output.
/** In dev, serve the cloud HTML for SPA navigations at `/` (not only `/index.cloud.html`). */
function cloudDevSpaFallback(): Plugin {
  return {
    name: "zfiles-cloud-dev-spa",
    enforce: "pre",
    configureServer(server) {
      // Must run before Vite's HTML middleware (do not use configureServer's
      // post-hook return callback — that runs too late and `/` keeps index.html).
      server.middlewares.use((req, _res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        const raw = req.url ?? "/";
        const path = raw.split("?")[0] ?? "/";
        if (
          path.startsWith("/@") ||
          path.startsWith("/node_modules/") ||
          path.startsWith("/src/") ||
          path.startsWith("/file-icons/") ||
          /\.[a-zA-Z0-9]+$/.test(path)
        ) {
          next();
          return;
        }
        if (path !== "/index.cloud.html") {
          const query = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
          req.url = `/index.cloud.html${query}`;
        }
        next();
      });
    },
  };
}

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
  plugins: [react(), tailwindcss(), cloudDevSpaFallback(), emitIndexHtml()],
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
    port: 5174,
    strictPort: true,
    open: "/",
  },
});
