import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  // Absolute, so the dev server can be started from any working directory.
  root: fileURLToPath(new URL("./web", import.meta.url)),
  // Relative asset URLs so the build works from any path.
  base: "./",
  server: {
    // The engine lives outside the web root.
    fs: { allow: [".."] },
  },
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
    // three.js alone is about 600 kB minified; one chunk is fine for a single-page tool.
    chunkSizeWarningLimit: 800,
  },
});
