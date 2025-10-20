import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import fs from "fs-extra";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { listTargets, getTargetConfig } from "../config/targets.js";
import { generateManifest } from "./utils/manifest.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATHS = {
  default: path.join(PROJECT_ROOT, "schemas", "manifest.v3.base.json"),
  firefox: path.join(PROJECT_ROOT, "schemas", "manifest.firefox.v2.json")
};

const validatorCache = new Map();

function createValidator(schema) {
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

async function loadValidator(name) {
  if (validatorCache.has(name)) {
    return validatorCache.get(name);
  }

  const schemaPath = SCHEMA_PATHS[name];
  if (!schemaPath) {
    throw new Error(`Unknown schema name "${name}"`);
  }

  const schema = await fs.readJson(schemaPath);
  const validator = createValidator(schema);
  validatorCache.set(name, validator);
  return validator;
}

function reportValidationErrors(target, errors) {
  const details = errors
    .map((error) => `${error.instancePath || "<root>"} ${error.message}`)
    .join("\n");

  throw new Error(`Manifest validation failed for ${target}:\n${details}`);
}

function assertTargetSpecifics(target, manifest) {
  const permissions = manifest.permissions ?? [];
  if (target === "safari") {
    if (permissions.includes("downloads")) {
      throw new Error("Safari manifest must not request the downloads permission.");
    }
    return;
  }

  if (!permissions.includes("downloads")) {
    throw new Error(`${target} manifest must include the downloads permission.`);
  }
}

async function validateTarget(targetName) {
  const { manifest } = await generateManifest(targetName);
  const schemaName = targetName === "firefox" && manifest.manifest_version === 2 ? "firefox" : "default";
  const validate = await loadValidator(schemaName);
  const isValid = validate(manifest);

  if (!isValid) {
    reportValidationErrors(targetName, validate.errors ?? []);
  }

  assertTargetSpecifics(targetName, manifest);
  return manifest;
}

async function run() {
  const targets = listTargets();

  for (const targetName of targets) {
    const manifest = await validateTarget(targetName);
    const { downloadStrategy } = getTargetConfig(targetName);
    console.log(
      `Validated ${targetName} manifest (${downloadStrategy} mode) – version ${manifest.version}`
    );
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
