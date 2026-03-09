import browser from "webextension-polyfill";
import {
  DEFAULT_OBSIDIAN_NOTE_PATH,
  DEFAULT_VAULTS,
  DEFAULT_TEMPLATES
} from "./defaults.js";
import { resolveSaveTarget } from "./saveTarget.js";

export const STORAGE_KEYS = {
  VAULTS: "vaults",
  TEMPLATES: "templatePresets",
  LAST_SECTION: "options:lastSection",
  FRONTMATTER_TITLE: "frontmatterTitleTemplate",
  FRONTMATTER_TAGS: "frontmatterTagTemplates",
  FRONTMATTER_COLLECTIONS: "frontmatterCollectionTemplates",
  FRONTMATTER_ENABLED: "frontmatterEnabledFields",
  DATE_FORMAT: "exportDateFormat",
  TIME_FORMAT: "exportTimeFormat",
  SAVE_TARGET_DEFAULTS: "saveTargetDefaults",
  // Legacy keys to be migrated
  LEGACY_VAULT: "obsidianVault",
  LEGACY_NOTE_PATH: "obsidianNotePath"
};

let migrationPromise = null;

function getPrimaryStorageArea() {
  return browser?.storage?.sync ?? browser.storage.local;
}

function getSecondaryStorageArea() {
  if (!browser?.storage?.local || !browser?.storage?.sync) {
    return null;
  }
  return browser.storage.local;
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function normalizeVaults(vaults = []) {
  if (!Array.isArray(vaults)) {
    return [];
  }

  const normalized = vaults
    .map((vault) => {
      if (!vault || typeof vault !== "object") {
        return null;
      }
      const name = typeof vault.name === "string" ? vault.name.trim() : "";
      if (!name) {
        return null;
      }
      const id = typeof vault.id === "string" && vault.id.length > 0 ? vault.id : createId();
      return {
        id,
        name,
        isDefault: Boolean(vault.isDefault)
      };
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    return [];
  }

  const defaultIndex = normalized.findIndex((vault) => vault.isDefault);
  if (defaultIndex > 0) {
    const [defaultVault] = normalized.splice(defaultIndex, 1);
    normalized.unshift(defaultVault);
  }

  if (defaultIndex === -1) {
    normalized[0].isDefault = true;
  }

  return normalized.map((vault, index) => ({
    ...vault,
    isDefault: index === 0
  }));
}

function normalizeTemplates(templates = []) {
  if (!Array.isArray(templates)) {
    return [];
  }

  return templates
    .map((template) => {
      if (!template || typeof template !== "object") {
        return null;
      }
      const id = typeof template.id === "string" && template.id.length > 0 ? template.id : `custom:${createId()}`;
      const name = typeof template.name === "string" ? template.name.trim() : "";
      const body = typeof template.template === "string" ? template.template : "";
      if (!name || !body) {
        return null;
      }
      return {
        id,
        name,
        description: typeof template.description === "string" ? template.description : "",
        template: body,
        targetVault: typeof template.targetVault === "string" ? template.targetVault : "",
        targetFolder: typeof template.targetFolder === "string" ? template.targetFolder : "",
        filenamePattern: typeof template.filenamePattern === "string" ? template.filenamePattern : ""
      };
    })
    .filter(Boolean);
}

function buildVaultsFromLegacy(legacyVault) {
  if (typeof legacyVault !== "string" || legacyVault.trim().length === 0) {
    return [];
  }
  return [
    {
      id: createId(),
      name: legacyVault.trim(),
      isDefault: true
    }
  ];
}

function splitNotePath(value) {
  const fallback = {
    folder: "tabSidian",
    filenamePattern: "tab-export-{timestamp}.md"
  };

  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (normalized.length === 0) {
    return fallback;
  }

  const filenamePattern = normalized.pop() || fallback.filenamePattern;
  const folder = normalized.join("/");

  return {
    folder,
    filenamePattern
  };
}

function normalizeSaveTargetDefaults(raw) {
  const defaultsFromPath = splitNotePath(DEFAULT_OBSIDIAN_NOTE_PATH);
  if (!raw || typeof raw !== "object") {
    return defaultsFromPath;
  }

  const folder = typeof raw.folder === "string" ? raw.folder.trim() : defaultsFromPath.folder;
  const filenamePattern =
    typeof raw.filenamePattern === "string" && raw.filenamePattern.trim().length > 0
      ? raw.filenamePattern.trim()
      : defaultsFromPath.filenamePattern;

  return { folder, filenamePattern };
}

export async function ensureStorageMigration() {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    const primary = getPrimaryStorageArea();
    const secondary = getSecondaryStorageArea();

    const primaryValues = await primary.get([
      STORAGE_KEYS.VAULTS,
      STORAGE_KEYS.TEMPLATES,
      STORAGE_KEYS.SAVE_TARGET_DEFAULTS,
      STORAGE_KEYS.LEGACY_VAULT,
      STORAGE_KEYS.LEGACY_NOTE_PATH
    ]);

    let nextVaults = normalizeVaults(primaryValues[STORAGE_KEYS.VAULTS]);
    let nextTemplates = normalizeTemplates(primaryValues[STORAGE_KEYS.TEMPLATES]);
    let nextSaveTargetDefaults = normalizeSaveTargetDefaults(primaryValues[STORAGE_KEYS.SAVE_TARGET_DEFAULTS]);

    if (secondary) {
      const secondaryValues = await secondary.get([
        STORAGE_KEYS.VAULTS,
        STORAGE_KEYS.TEMPLATES,
        STORAGE_KEYS.SAVE_TARGET_DEFAULTS
      ]);
      if (nextVaults.length === 0) {
        nextVaults = normalizeVaults(secondaryValues[STORAGE_KEYS.VAULTS]);
      }
      if (nextTemplates.length === 0) {
        nextTemplates = normalizeTemplates(secondaryValues[STORAGE_KEYS.TEMPLATES]);
      }
      if (!primaryValues[STORAGE_KEYS.SAVE_TARGET_DEFAULTS]) {
        nextSaveTargetDefaults = normalizeSaveTargetDefaults(secondaryValues[STORAGE_KEYS.SAVE_TARGET_DEFAULTS]);
      }
    }

    if (nextVaults.length === 0) {
      nextVaults = buildVaultsFromLegacy(primaryValues[STORAGE_KEYS.LEGACY_VAULT]);
    }

    if (!primaryValues[STORAGE_KEYS.SAVE_TARGET_DEFAULTS]) {
      nextSaveTargetDefaults = normalizeSaveTargetDefaults(
        primaryValues[STORAGE_KEYS.LEGACY_NOTE_PATH]
          ? splitNotePath(primaryValues[STORAGE_KEYS.LEGACY_NOTE_PATH])
          : nextSaveTargetDefaults
      );
    }

    const updates = {};
    if (nextVaults.length > 0) {
      updates[STORAGE_KEYS.VAULTS] = nextVaults;
    }
    if (nextTemplates.length > 0) {
      updates[STORAGE_KEYS.TEMPLATES] = nextTemplates;
    }
    updates[STORAGE_KEYS.SAVE_TARGET_DEFAULTS] = nextSaveTargetDefaults;

    if (Object.keys(updates).length > 0) {
      await primary.set(updates);
    }
  })().catch((error) => {
    migrationPromise = null;
    throw error;
  });

  return migrationPromise;
}

export async function getStoredValues(keys) {
  await ensureStorageMigration();
  return getPrimaryStorageArea().get(keys);
}

export async function setStoredValues(values) {
  await ensureStorageMigration();
  return getPrimaryStorageArea().set(values);
}

export async function getVaults() {
  const result = await getStoredValues([STORAGE_KEYS.VAULTS]);
  return normalizeVaults(result[STORAGE_KEYS.VAULTS]) || DEFAULT_VAULTS;
}

export async function saveVaults(vaults) {
  return setStoredValues({ [STORAGE_KEYS.VAULTS]: normalizeVaults(vaults) });
}

export async function getTemplates() {
  const result = await getStoredValues([STORAGE_KEYS.TEMPLATES]);
  return normalizeTemplates(result[STORAGE_KEYS.TEMPLATES]) || DEFAULT_TEMPLATES;
}

export async function saveTemplates(templates) {
  return setStoredValues({ [STORAGE_KEYS.TEMPLATES]: normalizeTemplates(templates) });
}

export async function getSaveTargetDefaults() {
  const result = await getStoredValues([STORAGE_KEYS.SAVE_TARGET_DEFAULTS]);
  return normalizeSaveTargetDefaults(result[STORAGE_KEYS.SAVE_TARGET_DEFAULTS]);
}

export async function saveSaveTargetDefaults(value) {
  return setStoredValues({ [STORAGE_KEYS.SAVE_TARGET_DEFAULTS]: normalizeSaveTargetDefaults(value) });
}

export { resolveSaveTarget };
