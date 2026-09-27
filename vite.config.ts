import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    // three is stable across releases, so it never needs a re-download. Splitting
    // it out also keeps it out of the entry chunk's gzip window, which means a
    // style-only rebuild re-downloads ~4KB instead of the whole renderer.
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("node_modules/three") ? "three" : undefined),
      },
    },
    assetsInlineLimit: 2048,
  },
});
