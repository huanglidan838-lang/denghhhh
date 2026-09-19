import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const repositoryBase = "/denghhhh/";

function prefixPublicAssets(): Plugin {
  return {
    name: "github-pages-public-asset-prefix",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(?:ts|tsx|css)$/.test(id)) return null;
      return code.replace(
        /(["'`(])\/(?=(?:portfolio|fonts)\/)/g,
        `$1${repositoryBase}`,
      );
    },
  };
}

export default defineConfig({
  root: "github-page",
  base: repositoryBase,
  publicDir: "../public",
  plugins: [prefixPublicAssets(), react()],
  build: {
    outDir: "../github-pages",
    emptyOutDir: true,
  },
});
