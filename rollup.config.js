import path from "node:path";
import { fileURLToPath } from "node:url";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, "dist");

const ENTRY_POINTS = [
  { input: "src/background/index.js", fileName: "background.js", format: "iife" },
  { input: "src/options/index.js", fileName: "options.js", format: "iife" },
  { input: "src/share/index.js", fileName: "share.js", format: "iife" }
];

export function createRollupConfig({ target = process.env.TARGET_BROWSER || "chrome", define = {} } = {}) {
  const replacements = {
    __TARGET_BROWSER__: JSON.stringify(target),
    __DOWNLOAD_STRATEGY__: JSON.stringify(define.DOWNLOAD_STRATEGY ?? "download"),
    __PLATFORM_NAME__: JSON.stringify(define.PLATFORM_NAME ?? target),
    ...(define.replacements ?? {})
  };

  const resolvedEntries = ENTRY_POINTS.map(({ input, fileName, format }) => ({
    input: path.resolve(__dirname, input),
    output: {
      file: path.join(OUTPUT_DIR, target, fileName),
      format,
      sourcemap: true,
      exports: "auto",
      name: "tabSidian"
    },
    treeshake: true,
    plugins: [
      replace({
        preventAssignment: true,
        values: replacements
      }),
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      json()
    ]
  }));

  return resolvedEntries;
}

export default createRollupConfig;
