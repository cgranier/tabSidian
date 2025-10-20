import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import fs from "fs-extra";
import { rollup } from "rollup";
import createRollupConfig from "../rollup.config.js";
import { getTargetConfig, listTargets } from "../config/targets.js";
import { generateManifest } from "./utils/manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");

const STATIC_FILES = [
  { from: "src/options/options.html", to: "options.html" },
  { from: "src/options/options.css", to: "options.css" },
  { from: "src/assets/icons/icon48.png", to: "icon48.png" },
  { from: "src/assets/icons/icon128.png", to: "icon128.png" },
  { from: "src/share/index.html", to: "share.html" }
];

function getTargetsFromCli() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const explicitTargets = args.filter((arg) => !arg.startsWith("--"));

  if (flags.has("--all")) {
    return listTargets();
  }

  if (explicitTargets.length > 0) {
    return explicitTargets;
  }

  if (process.env.TARGET_BROWSER) {
    return [process.env.TARGET_BROWSER];
  }

  return ["chrome"];
}

async function copyStaticAssets(targetDir) {
  await Promise.all(
    STATIC_FILES.map(async ({ from, to }) => {
      const source = path.join(PROJECT_ROOT, from);
      const destination = path.join(targetDir, to);
      await fs.copy(source, destination);
    })
  );
}

async function writeManifest(targetName, targetDir) {
  const { manifest } = await generateManifest(targetName);
  await fs.writeJson(path.join(targetDir, "manifest.json"), manifest, {
    spaces: 2
  });
}

async function bundleScripts(target) {
  const configs = createRollupConfig({
    target: target.name,
    define: {
      DOWNLOAD_STRATEGY: target.downloadStrategy,
      PLATFORM_NAME: target.name,
      replacements: target.rollup?.replacements ?? {}
    }
  });

  for (const config of configs) {
    const bundle = await rollup(config);
    await bundle.write(config.output);
    await bundle.close();
  }
}

async function buildTarget(targetName) {
  const target = getTargetConfig(targetName);
  const targetDir = path.join(DIST_ROOT, target.name);

  await fs.remove(targetDir);
  await fs.ensureDir(targetDir);

  await bundleScripts(target);
  await copyStaticAssets(targetDir);
  await writeManifest(target.name, targetDir);

  console.log(`Built ${target.name} → ${path.relative(PROJECT_ROOT, targetDir)}`);
}

async function run() {
  const targets = getTargetsFromCli();
  for (const targetName of targets) {
    await buildTarget(targetName);
  }
}

run().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
