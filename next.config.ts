import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los E2E compilan en un directorio aparte (ver playwright.config.ts) para no
  // pisar el build normal ni mezclar la configuración ficticia del emulador.
  distDir: process.env.QUESTFLOW_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
