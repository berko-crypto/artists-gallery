import * as esbuild from "esbuild";
import { mkdirSync, cpSync, rmSync, existsSync } from "fs";

const outdir = "dist";
if (existsSync(outdir)) rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: `${outdir}/bundle.js`,
  loader: { ".jsx": "jsx", ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  target: ["es2019"],
});

cpSync("public/index.html", `${outdir}/index.html`);
cpSync("public/storage-shim.js", `${outdir}/storage-shim.js`);

console.log("Built to ./dist");
