import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");

async function clean() {
  await fs.remove(DIST_DIR);
  console.log(`Removed ${path.relative(ROOT_DIR, DIST_DIR) || "dist"} directory.`);
}

clean().catch((error) => {
  console.error("Failed to clean dist directory:", error);
  process.exitCode = 1;
});
