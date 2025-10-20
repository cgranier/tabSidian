import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { getTargetConfig } from "../../config/targets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const BASE_MANIFEST_PATH = path.join(ROOT_DIR, "src", "manifest.base.json");

let cachedBaseManifest;

function clone(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export async function loadBaseManifest() {
  if (!cachedBaseManifest) {
    cachedBaseManifest = await fs.readJson(BASE_MANIFEST_PATH);
  }
  return clone(cachedBaseManifest);
}

export async function generateManifest(targetName) {
  const baseManifest = await loadBaseManifest();
  const target = getTargetConfig(targetName);
  if (typeof target.manifest !== "function") {
    return { manifest: baseManifest, target };
  }
  const manifest = target.manifest(clone(baseManifest));
  return { manifest, target };
}

export const paths = {
  root: ROOT_DIR,
  baseManifest: BASE_MANIFEST_PATH
};
