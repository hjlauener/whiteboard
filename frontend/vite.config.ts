import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the whiteboard as ES module into ../js/dist:
//   whiteboard.js   entry, loaded by ILIAS with <script type="module">
//   whiteboard.css  styles of Excalidraw
//   chunks/         parts loaded on demand (languages, export, ...)
export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  build: {
    outDir: "../js/dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: "src/main.tsx",
      preserveEntrySignatures: "strict",
      output: {
        entryFileNames: "whiteboard.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) =>
          (info.names ?? []).some((n) => n.endsWith(".css")) ? "whiteboard.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
