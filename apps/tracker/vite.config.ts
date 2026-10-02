import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    // Vite's dev CORS middleware answers preflights itself; let the browser extension through
    // (in addition to Vite's default localhost origins) so dev matches production.
    cors: {
      origin: [
        /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
        /^chrome-extension:\/\//,
        /^moz-extension:\/\//,
      ],
    },
  },
});
