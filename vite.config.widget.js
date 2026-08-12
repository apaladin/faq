import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Builds a single IIFE bundle for Shopify theme paste / CDN load. */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: path.join(__dirname, "public"),
    emptyOutDir: false,
    lib: {
      entry: path.join(__dirname, "widget-src/main.jsx"),
      name: "AiFaqShopify",
      formats: ["iife"],
      fileName: () => "ai-faq-bundle.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: "ai-faq-bundle.[ext]",
      },
    },
    cssCodeSplit: false,
    minify: true,
  },
});
