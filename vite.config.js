import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    fs: {
      deny: ["**/config.local.php"],
    },
    proxy: {
      "/api": {
        target: process.env.LARAGON_API_TARGET || "http://ISP_Management.test",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (request) => {
            request.removeHeader("origin");
          });
        },
      },
    },
  },
});
