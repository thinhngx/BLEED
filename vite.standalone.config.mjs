// Standalone build: one self-contained BLEED.html that opens by double-click (file://).
// Extends the protected vite.config.ts without editing it. Run: npm run build:standalone
import { mergeConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

import baseConfig from "./vite.config.ts";

// A file:// URL is a filesystem path, not "/". BLEED has a single route, so the
// router gets an in-memory history pinned to "/". Build-time transform only.
const memoryRouter = {
  enforce: "pre",
  name: "bleed-standalone-memory-router",
  transform(code, id) {
    if (!id.endsWith("/src/router.tsx")) return null;
    const out = code
      .replace('import { createRouter } from "@tanstack/react-router";', 'import { createMemoryHistory, createRouter } from "@tanstack/react-router";')
      .replace("basepath: routerBasePath,", 'history: createMemoryHistory({ initialEntries: ["/"] }),');
    if (!out.includes("createMemoryHistory({")) throw new Error("Standalone router transform did not apply; check src/router.tsx.");
    return out;
  },
};

export default async (env) => {
  const base = typeof baseConfig === "function" ? await baseConfig(env) : baseConfig;
  return mergeConfig(base, {
    base: "./",
    build: { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000, emptyOutDir: true, outDir: "dist-standalone" },
    plugins: [memoryRouter, viteSingleFile({ removeViteModuleLoader: true })],
  });
};
