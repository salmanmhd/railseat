import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dist = path.join(here, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: {
    panel: path.join(here, "src/panel.tsx"),
    background: path.join(here, "src/background.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome116",
  jsx: "automatic",
  minify: true,
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

execSync(`npx @tailwindcss/cli -i extension/src/panel.css -o extension/dist/panel.css --minify`, {
  cwd: root,
  stdio: "inherit",
});

cpSync(path.join(here, "manifest.json"), path.join(dist, "manifest.json"));
cpSync(path.join(here, "sidepanel.html"), path.join(dist, "sidepanel.html"));
cpSync(path.join(here, "icons"), path.join(dist, "icons"), { recursive: true });
console.log("\nExtension built in extension/dist");
