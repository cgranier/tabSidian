import browser from "webextension-polyfill";
import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_OBSIDIAN_NOTE_PATH,
  DEFAULT_RESTRICTED_URLS,
  DEFAULT_FRONTMATTER_FIELDS,
  DEFAULT_FRONTMATTER_ENABLED_FIELDS,
  DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  DEFAULT_FRONTMATTER_TAG_TEMPLATES,
  DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES,
  DEFAULT_EXPORT_DATE_FORMAT,
  DEFAULT_EXPORT_TIME_FORMAT
} from "../platform/defaults.js";
import {
  createSampleTemplateContext,
  resolveFrontmatterFields,
  resolveFrontmatterEnabled
} from "../platform/markdown.js";
import { renderTemplate, validateTemplate } from "../platform/templateEngine.js";
import { describePlatform, IS_SAFARI } from "../platform/runtime.js";
import { sanitizeRestrictedUrls } from "../platform/tabFilters.js";

const CURRENT_TEMPLATE_OPTION_ID = "custom:current";
const PRESET_STORAGE_KEY = "templatePresets";
const SECTION_STORAGE_KEY = "options:lastSection";
const FRONTMATTER_TITLE_STORAGE_KEY = "frontmatterTitleTemplate";
const FRONTMATTER_TAGS_STORAGE_KEY = "frontmatterTagTemplates";
const FRONTMATTER_COLLECTIONS_STORAGE_KEY = "frontmatterCollectionTemplates";
const FRONTMATTER_ENABLED_STORAGE_KEY = "frontmatterEnabledFields";
const TIMESTAMP_DATE_FORMAT_STORAGE_KEY = "exportDateFormat";
const TIMESTAMP_TIME_FORMAT_STORAGE_KEY = "exportTimeFormat";

const BUILT_IN_PRESETS = [
  {
    id: "builtin:default",
    name: "Default headings",
    description: "Frontmatter with level-two headings per tab.",
    template: DEFAULT_MARKDOWN_FORMAT
  },
  {
    id: "builtin:list",
    name: "Compact list",
    description: "Frontmatter followed by a bullet list of tabs.",
    template: `{{{frontmatter}}}
{{#tabs}}
- [{{title}}]({{url}})
{{/tabs}}`
  },
  {
    id: "builtin:metadata",
    name: "Metadata summary",
    description: "Adds hostname and timestamps under each tab entry.",
    template: `{{{frontmatter}}}
{{#tabs}}
## {{title}}
- URL: {{url}}
- Host: {{hostname}}
{{#favicon}}- Favicon: {{favicon}}{{/favicon}}
{{#timestamps.lastAccessed}}- Last visited: {{timestamps.lastAccessed}} ({{timestamps.lastAccessedRelative}}){{/timestamps.lastAccessed}}
{{^timestamps.lastAccessed}}- Last visited: unknown{{/timestamps.lastAccessed}}

{{/tabs}}`
  },
  {
    id: "builtin:grouped",
    name: "Grouped headings",
    description: "Organises output by tab group when available.",
    template: `{{{frontmatter}}}
{{#groups}}
## {{title}}
{{#tabs}}- [{{title}}]({{url}})
{{/tabs}}

{{/groups}}
{{#ungroupedTabs}}
## {{title}}
[{{url}}]({{url}})

{{/ungroupedTabs}}`
  }
];

const elements = {
  restrictedUrls: () => document.getElementById("restrictedUrls"),
  restrictedImport: () => document.getElementById("restrictedImport"),
  restrictedExport: () => document.getElementById("restrictedExport"),
  restrictedImportInput: () => document.getElementById("restrictedImportInput"),
  markdownFormat: () => document.getElementById("markdownFormat"),
  presetFormats: () => document.getElementById("presetFormats"),
  presetName: () => document.getElementById("presetName"),
  presetDescription: () => document.querySelector("[data-preset-description]"),
  presetImportInput: () => document.getElementById("presetImportInput"),
  applyPreset: () => document.getElementById("applyPreset"),
  resetTemplate: () => document.getElementById("resetTemplate"),
  savePreset: () => document.getElementById("savePreset"),
  deletePreset: () => document.getElementById("deletePreset"),
  importPresets: () => document.getElementById("importPresets"),
  exportPresets: () => document.getElementById("exportPresets"),
  templatePreview: () => document.querySelector("[data-template-preview]"),
  templateFeedback: () => document.querySelector("[data-template-feedback]"),
  templateDocs: () => document.querySelector("[data-template-docs]"),
  statusMessage: () => document.querySelector("[data-status-message]"),
  frontmatterInputs: () => document.querySelectorAll("[data-frontmatter-field]"),
  frontmatterFeedback: () => document.querySelector("[data-frontmatter-feedback]"),
  frontmatterToggles: () => document.querySelectorAll("[data-frontmatter-toggle]"),
  sectionTabs: () => document.querySelectorAll("[data-section]"),
  sectionPanels: () => document.querySelectorAll("[data-section-panel]"),
  frontmatterTitleTemplate: () => document.getElementById("frontmatterTitleTemplate"),
  frontmatterTags: () => document.getElementById("frontmatterTags"),
  frontmatterCollections: () => document.getElementById("frontmatterCollections"),
  frontmatterListFeedback: () => document.querySelector("[data-frontmatter-list-feedback]"),
  resetGeneral: () => document.getElementById("resetGeneral"),
  resetProperties: () => document.getElementById("resetProperties"),
  resetTemplates: () => document.getElementById("resetTemplates"),
  resetRestricted: () => document.getElementById("resetRestricted"),
  resetAll: () => document.getElementById("resetAll"),
  platformHint: () => document.querySelector("[data-platform-hint]"),
  obsidianVault: () => document.getElementById("obsidianVault"),
  obsidianNotePath: () => document.getElementById("obsidianNotePath"),
  timestampDateFormat: () => document.getElementById("timestampDateFormat"),
  timestampTimeFormat: () => document.getElementById("timestampTimeFormat")
};

const LEGACY_DEFAULT_RESTRICTED_URLS = [
  "chrome-extension://",
  "extension://",
  "moz-extension://",
  "safari-web-extension://",
  "edge://",
  "chrome://",
  "mail.google.com",
  "outlook.live.com"
];

const state = {
  customPresets: [],
  selectedPresetId: CURRENT_TEMPLATE_OPTION_ID,
  diagnostics: {
    errors: [],
    warnings: [],
    preview: "",
    previewError: null
  },
  frontmatterFields: { ...DEFAULT_FRONTMATTER_FIELDS },
  frontmatterEnabled: { ...DEFAULT_FRONTMATTER_ENABLED_FIELDS },
  frontmatterValidation: {
    hasErrors: false,
    messages: []
  },
  frontmatterTitleTemplate: DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  frontmatterTagTemplates: [...DEFAULT_FRONTMATTER_TAG_TEMPLATES],
  frontmatterCollectionTemplates: [...DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES],
  frontmatterListValidation: {
    hasErrors: false,
    messages: []
  },
  timestampFormats: {
    dateFormat: DEFAULT_EXPORT_DATE_FORMAT,
    timeFormat: DEFAULT_EXPORT_TIME_FORMAT
  },
  preferencesReady: false,
  pendingSilentSave: false
};

function getSectionCollections() {
  const tabs = Array.from(elements.sectionTabs() || []);
  const panels = Array.from(elements.sectionPanels() || []);
  return { tabs, panels };
}

function activateSection(sectionId, collections, { focusTab = true, storeSelection = false } = {}) {
  const { tabs, panels } = collections;
  if (tabs.length === 0 || panels.length === 0) {
    return;
  }

  const fallback = tabs[0]?.dataset.section ?? null;
  const available = new Set(panels.map((panel) => panel.dataset.sectionPanel));
  const target = sectionId && available.has(sectionId) ? sectionId : fallback;

  tabs.forEach((tab) => {
    const isActive = tab.dataset.section === target;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
    if (isActive && focusTab) {
      tab.focus();
    }
  });

  panels.forEach((panel) => {
    const isActive = panel.dataset.sectionPanel === target;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    panel.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  if (storeSelection && target && browser?.storage?.local) {
    browser.storage.local
      .set({ [SECTION_STORAGE_KEY]: target })
      .catch((error) => console.error("Unable to persist active section", error));
  }
}

function initializeSectionNavigation() {
  const collections = getSectionCollections();
  const { tabs } = collections;
  if (tabs.length === 0) {
    return Promise.resolve();
  }

  const focusByIndex = (index, { storeSelection = false } = {}) => {
    const normalized = (index + tabs.length) % tabs.length;
    const targetTab = tabs[normalized];
    if (!targetTab) {
      return;
    }
    activateSection(targetTab.dataset.section, collections, {
      focusTab: true,
      storeSelection
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateSection(tab.dataset.section, collections, {
        focusTab: true,
        storeSelection: true
      });
    });

    tab.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          focusByIndex(index - 1, { storeSelection: true });
          break;
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          focusByIndex(index + 1, { storeSelection: true });
          break;
        case "Home":
          event.preventDefault();
          focusByIndex(0, { storeSelection: true });
          break;
        case "End":
          event.preventDefault();
          focusByIndex(tabs.length - 1, { storeSelection: true });
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          activateSection(tab.dataset.section, collections, {
            focusTab: true,
            storeSelection: true
          });
          break;
        default:
          break;
      }
    });
  });

  const restore = () => activateSection(undefined, collections, { focusTab: false });

  if (!browser?.storage?.local) {
    restore();
    return Promise.resolve();
  }

  return browser.storage.local
    .get(SECTION_STORAGE_KEY)
    .then((stored) => {
      const saved = stored && typeof stored[SECTION_STORAGE_KEY] === "string" ? stored[SECTION_STORAGE_KEY] : undefined;
      activateSection(saved, collections, { focusTab: false });
    })
    .catch((error) => {
      console.error("Unable to restore last viewed section", error);
      restore();
    });
}

function createCustomPresetId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `custom:${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(16).slice(2);
  return `custom:${Date.now().toString(16)}-${random}`;
}

function normalizeCustomPreset(rawPreset) {
  if (!rawPreset || typeof rawPreset !== "object") {
    return null;
  }

  const template = typeof rawPreset.template === "string" ? rawPreset.template : "";
  const name = typeof rawPreset.name === "string" ? rawPreset.name.trim() : "";
  if (!template || !name) {
    return null;
  }

  const description = typeof rawPreset.description === "string" ? rawPreset.description.trim() : "";
  const id =
    typeof rawPreset.id === "string" && rawPreset.id.startsWith("custom:")
      ? rawPreset.id
      : createCustomPresetId();

  return { id, name, description, template };
}

function toMultilineValue(values) {
  return values.join("\n");
}

function parseMultiline(value) {
  return sanitizeRestrictedUrls(value.split("\n").map((entry) => entry.trim()));
}

function toTemplateMultiline(values = []) {
  return values.filter((value) => typeof value === "string" && value.trim().length > 0).join("\n");
}

function parseTemplateMultiline(value) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function debounce(fn, delay = 300) {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = undefined;
  };
  return debounced;
}

const FRONTMATTER_FIELD_KEYS = /** @type {Array<keyof typeof DEFAULT_FRONTMATTER_FIELDS>} */ (
  Object.keys(DEFAULT_FRONTMATTER_FIELDS)
);
const FRONTMATTER_FIELD_PATTERN = /^[A-Za-z0-9_\-]+$/;
const MAX_FRONTMATTER_LIST_ENTRIES = 50;

function sanitizeFrontmatterInput(value) {
  return (value ?? "").trim();
}

function setFrontmatterInputs(fieldMap = DEFAULT_FRONTMATTER_FIELDS) {
  const resolved = resolveFrontmatterFields(fieldMap);
  FRONTMATTER_FIELD_KEYS.forEach((key) => {
    const input = document.querySelector(`[data-frontmatter-field="${key}"]`);
    if (input instanceof HTMLInputElement) {
      input.value = resolved[key];
      input.setCustomValidity("");
    }
  });
  state.frontmatterFields = resolved;
  state.frontmatterValidation = {
    hasErrors: false,
    messages: []
  };
  updateFrontmatterFeedback();
}

function validateFrontmatterInputs() {
  /** @type {Record<string, string>} */
  const collected = {};
  const messages = [];
  let hasErrors = false;

  /** @type {Map<string, HTMLInputElement>} */
  const seen = new Map();

  FRONTMATTER_FIELD_KEYS.forEach((key) => {
    const input = document.querySelector(`[data-frontmatter-field="${key}"]`);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const trimmed = sanitizeFrontmatterInput(input.value);
    input.value = trimmed;
    let message = "";

    if (trimmed.length === 0) {
      message = "Field name is required.";
    } else if (!FRONTMATTER_FIELD_PATTERN.test(trimmed)) {
      message = "Use letters, numbers, hyphen, or underscore.";
    } else {
      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) {
        message = `Duplicate field name (“${trimmed}”).`;
        const other = seen.get(lower);
        if (other) {
          other.setCustomValidity(message);
        }
      } else {
        seen.set(lower, input);
        collected[key] = trimmed;
      }
    }

    if (message) {
      hasErrors = true;
      input.setCustomValidity(message);
      messages.push(message);
    } else {
      input.setCustomValidity("");
    }
  });

  const normalized = resolveFrontmatterFields(collected);
  return {
    hasErrors,
    messages,
    normalized
  };
}

function updateFrontmatterFeedback() {
  const feedbackElement = elements.frontmatterFeedback();
  if (!feedbackElement) {
    return;
  }

  const { hasErrors, messages } = state.frontmatterValidation;
  feedbackElement.textContent = "";
  feedbackElement.classList.remove("is-error", "is-ok", "is-warning");

  if (hasErrors) {
    const uniqueMessages = [...new Set(messages)];
    feedbackElement.textContent = uniqueMessages.join(" · ");
    feedbackElement.classList.add("is-error");
  }
}

function setFrontmatterToggles(flags = DEFAULT_FRONTMATTER_ENABLED_FIELDS) {
  const normalized = resolveFrontmatterEnabled(flags);
  elements.frontmatterToggles().forEach((toggle) => {
    if (!(toggle instanceof HTMLInputElement)) {
      return;
    }
    const key = toggle.dataset.frontmatterToggle;
    if (!key) {
      return;
    }
    const isEnabled = normalized[key] !== false;
    toggle.checked = isEnabled;
  });
  state.frontmatterEnabled = normalized;
}

function handleFrontmatterToggleChange(event) {
  if (!(event.currentTarget instanceof HTMLInputElement)) {
    return;
  }
  const toggle = event.currentTarget;
  const key = toggle.dataset.frontmatterToggle;
  if (!key) {
    return;
  }
  state.frontmatterEnabled = resolveFrontmatterEnabled({
    ...state.frontmatterEnabled,
    [key]: toggle.checked
  });
  updateTemplatePreview();
  queueSave({ silent: true });
}

function updateFrontmatterListsState({ sanitize = true } = {}) {
  const result = validateFrontmatterTemplateLists({ sanitize });
  if (sanitize && result.hasErrors) {
    scheduleSave.cancel();
    return;
  }
  if (sanitize && state.preferencesReady) {
    queueSave({ silent: true });
  }
  updateTemplatePreview();
}

function updateFrontmatterListFeedback() {
  const feedbackElement = elements.frontmatterListFeedback();
  if (!feedbackElement) {
    return;
  }

  const { hasErrors, messages } = state.frontmatterListValidation;
  feedbackElement.textContent = "";
  feedbackElement.classList.remove("is-error", "is-warning", "is-ok");

  if (messages.length > 0) {
    feedbackElement.textContent = [...new Set(messages)].join(" · ");
  }

  if (hasErrors) {
    feedbackElement.classList.add("is-error");
  } else if (messages.length > 0) {
    feedbackElement.classList.add("is-warning");
  }
}

function setFrontmatterTemplateInputs({
  titleTemplate = DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  tagTemplates = DEFAULT_FRONTMATTER_TAG_TEMPLATES,
  collectionTemplates = DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES
} = {}) {
  const normalizedTitle =
    typeof titleTemplate === "string" && titleTemplate.trim().length > 0
      ? titleTemplate.trim()
      : DEFAULT_FRONTMATTER_TITLE_TEMPLATE;
  const normalizedTags = Array.isArray(tagTemplates)
    ? tagTemplates
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [...DEFAULT_FRONTMATTER_TAG_TEMPLATES];
  const normalizedCollections = Array.isArray(collectionTemplates)
    ? collectionTemplates
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : [...DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES];

  const titleInput = elements.frontmatterTitleTemplate();
  if (titleInput instanceof HTMLTextAreaElement || titleInput instanceof HTMLInputElement) {
    titleInput.value = normalizedTitle;
    titleInput.setCustomValidity("");
  }

  const tagsInput = elements.frontmatterTags();
  if (tagsInput instanceof HTMLTextAreaElement) {
    tagsInput.value = toTemplateMultiline(normalizedTags);
    tagsInput.setCustomValidity("");
  }

  const collectionsInput = elements.frontmatterCollections();
  if (collectionsInput instanceof HTMLTextAreaElement) {
    collectionsInput.value = toTemplateMultiline(normalizedCollections);
    collectionsInput.setCustomValidity("");
  }

  state.frontmatterTitleTemplate = normalizedTitle;
  state.frontmatterTagTemplates = [...normalizedTags];
  state.frontmatterCollectionTemplates = [...normalizedCollections];
  state.frontmatterListValidation = { hasErrors: false, messages: [] };
  updateFrontmatterListFeedback();
}

function validateFrontmatterTemplateLists({ sanitize = true } = {}) {
  const tagsInput = elements.frontmatterTags();
  const collectionsInput = elements.frontmatterCollections();
  const messages = [];
  let hasErrors = false;

  const parseAndNormalize = (input) => {
    if (!(input instanceof HTMLTextAreaElement)) {
      return [];
    }

    const entries = parseTemplateMultiline(input.value);
    if (!sanitize) {
      input.setCustomValidity("");
      return entries;
    }

    if (entries.length !== 0 || input.value.trim().length === 0) {
      input.value = toTemplateMultiline(entries);
    }
    const unique = [];
    const seen = new Set();
    const duplicates = [];

    entries.forEach((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) {
        duplicates.push(entry);
        return;
      }
      seen.add(key);
      unique.push(entry);
    });

    if (unique.length > MAX_FRONTMATTER_LIST_ENTRIES) {
      const message = `Use ${MAX_FRONTMATTER_LIST_ENTRIES} or fewer entries.`;
      input.setCustomValidity(message);
      messages.push(message);
      hasErrors = true;
      const limited = unique.slice(0, MAX_FRONTMATTER_LIST_ENTRIES);
      input.value = toTemplateMultiline(limited);
      return limited;
    }

    input.setCustomValidity("");

    if (duplicates.length > 0) {
      messages.push(`Duplicates removed: ${duplicates.join(", ")}`);
    }

    if (duplicates.length > 0 || entries.length !== unique.length) {
      input.value = toTemplateMultiline(unique);
    }

    return unique;
  };

  const tagTemplates = parseAndNormalize(tagsInput);
  const collectionTemplates = parseAndNormalize(collectionsInput);

  state.frontmatterTagTemplates = [...tagTemplates];
  state.frontmatterCollectionTemplates = [...collectionTemplates];
  state.frontmatterListValidation = sanitize ? { hasErrors, messages } : { hasErrors: false, messages: [] };
  updateFrontmatterListFeedback();

  return { hasErrors };
}

const scheduleSave = debounce(() => {
  savePreferences().catch((error) => {
    console.error("Failed to persist preferences", error);
    setStatusMessage("Unable to save preferences. Check the console for details.", "error");
  });
}, 600);

function queueSave(options = {}) {
  const { silent = false } = options;
  if (!state.preferencesReady) {
    return;
  }

  if (state.frontmatterValidation.hasErrors) {
    scheduleSave.cancel();
    if (!silent) {
      setStatusMessage("Resolve frontmatter field errors before saving.", "error");
    }
    return;
  }

  if (state.frontmatterListValidation.hasErrors) {
    scheduleSave.cancel();
    if (!silent) {
      setStatusMessage("Resolve frontmatter list errors before saving.", "error");
    }
    return;
  }

  if (state.diagnostics.errors.length > 0) {
    scheduleSave.cancel();
    if (!silent) {
      setStatusMessage("Resolve template errors before saving.", "error");
    }
    return;
  }

  state.pendingSilentSave = silent;
  if (!silent) {
    setStatusMessage("Saving changes…", "saving");
  }
  scheduleSave();
}

function updateFrontmatterState() {
  const result = validateFrontmatterInputs();
  state.frontmatterValidation = {
    hasErrors: result.hasErrors,
    messages: result.messages
  };
  if (!result.hasErrors) {
    state.frontmatterFields = result.normalized;
  }
  updateFrontmatterFeedback();
  if (state.frontmatterValidation.hasErrors) {
    scheduleSave.cancel();
  } else {
    queueSave({ silent: true });
  }
  updateTemplatePreview();
}

const OBSIDIAN_NOTE_PATH_INVALID_SEGMENT = /(^|\/)(\.{1,2})(\/|$)/;
const OBSIDIAN_WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

function sanitizeTextInput(value) {
  return (value ?? "").trim();
}

function detectPlatform() {
  const uaData = (typeof navigator !== "undefined" && (navigator).userAgentData) || null;
  const platform =
    (uaData && Array.isArray(uaData.platforms) && uaData.platforms[0]) ||
    (uaData && uaData.platform) ||
    (typeof navigator !== "undefined" ? navigator.platform : "") ||
    "";
  const lower = platform.toLowerCase();
  return {
    isWindows: lower.includes("win"),
    isMac: lower.includes("mac")
  };
}

function sanitizeFileNameSegment(fileName, { isWindows, isMac }) {
  const base = typeof fileName === "string" ? fileName : "";

  let sanitized = base.replace(/[#|\^\[\]]/g, "");

  if (isWindows) {
    sanitized = sanitized
      .replace(/[<>:"/\\?*\x00-\x1F]/g, "")
      .replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i, "_$1$2")
      .replace(/[\s.]+$/g, "");
  } else if (isMac) {
    sanitized = sanitized
      .replace(/[/:\\x00-\\x1F]/g, "")
      .replace(/^\./, "_");
  } else {
    sanitized = sanitized
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/^\./, "_");
  }

  sanitized = sanitized
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 245);

  if (sanitized.length === 0) {
    sanitized = "Untitled";
  }

  return sanitized;
}

function sanitizeNotePathInput(value) {
  const normalized = (value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  const platformInfo = detectPlatform();
  const sanitizedSegments = normalized.map((segment, index) => {
    const sanitized = sanitizeFileNameSegment(segment, platformInfo);
    if (platformInfo.isWindows) {
      const base = sanitized.replace(/\\.[^.]+$/, "");
      if (OBSIDIAN_WINDOWS_RESERVED.test(base)) {
        const ext = sanitized.slice(base.length);
        return `_${base}${ext}`;
      }
    }
    return sanitized;
  });

  return sanitizedSegments.join("/");
}

function sanitizeFormatInput(value, fallback) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function resetValidity(...inputs) {
  inputs.forEach((input) => {
    if (input) {
      input.setCustomValidity("");
    }
  });
}

function validateObsidianPreferences() {
  const vaultInput = elements.obsidianVault();
  const notePathInput = elements.obsidianNotePath();

  resetValidity(vaultInput, notePathInput);

  const rawVault = sanitizeTextInput(vaultInput?.value);
  const rawNotePath = sanitizeTextInput(notePathInput?.value);

  const hasVault = rawVault.length > 0;
  const hasNotePath = rawNotePath.length > 0;

  if (!hasVault && !hasNotePath) {
    return {
      vault: "",
      notePath: ""
    };
  }

  if (!hasVault) {
    vaultInput.setCustomValidity("Vault name is required when configuring Obsidian exports.");
    vaultInput.reportValidity();
    return null;
  }

  const platformInfo = detectPlatform();
  const sanitizedVault = sanitizeFileNameSegment(rawVault, platformInfo);
  if (sanitizedVault !== rawVault) {
    vaultInput.setCustomValidity("Vault name contains characters Obsidian does not permit on this platform.");
    vaultInput.reportValidity();
    return null;
  }

  const fallbackTemplate = hasNotePath ? rawNotePath : DEFAULT_OBSIDIAN_NOTE_PATH;
  const sanitizedPath = sanitizeNotePathInput(fallbackTemplate);

  if (sanitizedPath.length === 0) {
    notePathInput.setCustomValidity("Provide a note path within your Obsidian vault.");
    notePathInput.reportValidity();
    return null;
  }

  if (!sanitizedPath.toLowerCase().endsWith(".md")) {
    notePathInput.setCustomValidity("Obsidian note paths must end with .md.");
    notePathInput.reportValidity();
    return null;
  }

  if (OBSIDIAN_NOTE_PATH_INVALID_SEGMENT.test(sanitizedPath)) {
    notePathInput.setCustomValidity("Note paths cannot traverse parent directories.");
    notePathInput.reportValidity();
    return null;
  }

  if (notePathInput) {
    notePathInput.value = sanitizedPath;
  }

  return {
    vault: rawVault,
    notePath: sanitizedPath
  };
}

function getAllPresets() {
  return [...BUILT_IN_PRESETS, ...state.customPresets];
}

function getPresetById(id) {
  if (!id) {
    return null;
  }

  return getAllPresets().find((preset) => preset.id === id) ?? null;
}

function findPresetMatchingTemplate(template) {
  return getAllPresets().find((preset) => preset.template === template) ?? null;
}

function setStatusMessage(message, type = "info") {
  const banner = elements.statusMessage();
  if (!banner) {
    return;
  }

  banner.textContent = message;
  banner.classList.remove("is-visible", "is-saving", "is-success", "is-error", "is-warning");

  if (!message) {
    return;
  }

  banner.classList.add("is-visible");

  if (type === "success") {
    banner.classList.add("is-success");
  } else if (type === "error") {
    banner.classList.add("is-error");
  } else if (type === "warning") {
    banner.classList.add("is-warning");
  } else if (type === "saving") {
    banner.classList.add("is-saving");
  }
}

function updateTemplateFeedback(diagnostics) {
  const feedbackElement = elements.templateFeedback();
  if (!feedbackElement) {
    return;
  }

  feedbackElement.textContent = "";
  feedbackElement.classList.remove("is-error", "is-warning", "is-ok");

  if (diagnostics.errors.length > 0) {
    feedbackElement.textContent = diagnostics.errors.join(" · ");
    feedbackElement.classList.add("is-error");
    return;
  }

  if (diagnostics.warnings.length > 0) {
    feedbackElement.textContent = diagnostics.warnings.join(" · ");
    feedbackElement.classList.add("is-warning");
    return;
  }

  feedbackElement.textContent = "Template ready.";
  feedbackElement.classList.add("is-ok");
}

function computeTemplateDiagnostics(template, sampleContext) {
  const validation = validateTemplate(template);
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];

  let preview = "";
  let previewError = null;

  if (errors.length === 0) {
    try {
      preview = renderTemplate(template, sampleContext);
    } catch (error) {
      previewError =
        error instanceof Error ? error.message : "Unknown template rendering error.";
      errors.push(`Preview failed: ${previewError}`);
    }
  } else {
    previewError = "Fix template errors to preview output.";
  }

  if (previewError && preview.length === 0) {
    preview = previewError;
  }

  return { errors, warnings, preview, previewError };
}

function refreshPresetPicker(selectedId = state.selectedPresetId) {
  const select = elements.presetFormats();
  select.innerHTML = "";

  const currentOption = document.createElement("option");
  currentOption.value = CURRENT_TEMPLATE_OPTION_ID;
  currentOption.textContent = "Current template (unsaved)";
  select.appendChild(currentOption);

  const builtInGroup = document.createElement("optgroup");
  builtInGroup.label = "Built-in presets";
  BUILT_IN_PRESETS.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    builtInGroup.appendChild(option);
  });
  select.appendChild(builtInGroup);

  if (state.customPresets.length > 0) {
    const customGroup = document.createElement("optgroup");
    customGroup.label = "Your presets";
    state.customPresets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      customGroup.appendChild(option);
    });
    select.appendChild(customGroup);
  }

  select.value = selectedId;
  if (select.value !== selectedId) {
    select.value = CURRENT_TEMPLATE_OPTION_ID;
    state.selectedPresetId = CURRENT_TEMPLATE_OPTION_ID;
  }

  updatePresetDescription();
  updatePresetButtons();
}

function updatePresetDescription() {
  const descriptionElement = elements.presetDescription();
  if (!descriptionElement) {
    return;
  }

  if (state.selectedPresetId === CURRENT_TEMPLATE_OPTION_ID) {
    descriptionElement.textContent =
      "Editing a custom template. Save it to reuse or export it as part of a preset library.";
    return;
  }

  const preset = getPresetById(state.selectedPresetId);
  if (!preset) {
    descriptionElement.textContent = "";
    return;
  }

  descriptionElement.textContent = preset.description || "Preset ready to load.";
}

function updatePresetButtons() {
  const applyPresetButton = elements.applyPreset();
  const savePresetButton = elements.savePreset();
  const deletePresetButton = elements.deletePreset();
  const presetNameInput = elements.presetName();

  const hasName = presetNameInput.value.trim().length > 0;
  const hasErrors = state.diagnostics.errors.length > 0;
  const hasFrontmatterErrors = state.frontmatterValidation.hasErrors;

  if (applyPresetButton) {
    applyPresetButton.disabled = state.selectedPresetId === CURRENT_TEMPLATE_OPTION_ID;
  }

  if (savePresetButton) {
    savePresetButton.disabled = hasErrors || !hasName;
  }

  if (deletePresetButton) {
    deletePresetButton.disabled =
      !state.selectedPresetId.startsWith("custom:") ||
      !state.customPresets.some((preset) => preset.id === state.selectedPresetId);
  }
}

function updateTemplatePreview() {
  const template = elements.markdownFormat().value ?? "";
  const sampleContext = createSampleTemplateContext(state.frontmatterFields, undefined, {
    frontmatterTitleTemplate: state.frontmatterTitleTemplate,
    frontmatterTagTemplates: state.frontmatterTagTemplates,
    frontmatterCollectionTemplates: state.frontmatterCollectionTemplates,
    frontmatterEnabled: state.frontmatterEnabled,
    timestampFormats: state.timestampFormats
  });
  const diagnostics = computeTemplateDiagnostics(template, sampleContext);
  state.diagnostics = diagnostics;

  const previewElement = elements.templatePreview();
  if (previewElement) {
    previewElement.textContent = diagnostics.preview;
    previewElement.classList.toggle("is-error", Boolean(diagnostics.previewError));
  }

  updateTemplateFeedback(diagnostics);
  updatePresetButtons();
}

function applySelectedPreset() {
  const preset = getPresetById(state.selectedPresetId);
  if (!preset) {
    return;
  }

  elements.markdownFormat().value = preset.template;
  state.selectedPresetId = preset.id;
  setStatusMessage(`Loaded preset "${preset.name}".`, "success");
  updateTemplatePreview();
  refreshPresetPicker(preset.id);

  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.value = preset.name;
  }

  queueSave();
}

function resetTemplateToDefault() {
  elements.markdownFormat().value = DEFAULT_MARKDOWN_FORMAT;
  state.selectedPresetId = "builtin:default";
  setStatusMessage("Template reset to the default layout.", "success");
  updateTemplatePreview();
  refreshPresetPicker(state.selectedPresetId);

  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.value = "";
  }

  queueSave();
}

async function persistCustomPresets() {
  await browser.storage.sync.set({
    [PRESET_STORAGE_KEY]: state.customPresets
  });
}

async function saveCustomPreset() {
  const nameInput = elements.presetName();
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    setStatusMessage("Enter a preset name before saving.", "error");
    return;
  }

  if (state.diagnostics.errors.length > 0) {
    setStatusMessage("Resolve template errors before saving the preset.", "error");
    return;
  }

  const template = elements.markdownFormat().value;
  const activeId = state.selectedPresetId;

  if (activeId.startsWith("custom:")) {
    const index = state.customPresets.findIndex((preset) => preset.id === activeId);
    if (index !== -1) {
      state.customPresets[index] = {
        ...state.customPresets[index],
        name,
        template
      };
      await persistCustomPresets();
      refreshPresetPicker(activeId);
      setStatusMessage("Preset updated.", "success");
      queueSave();
      return;
    }
  }

  const nameMatchIndex = state.customPresets.findIndex(
    (preset) => preset.name.toLowerCase() === name.toLowerCase()
  );

  if (nameMatchIndex !== -1) {
    state.customPresets[nameMatchIndex] = {
      ...state.customPresets[nameMatchIndex],
      name,
      template
    };
    state.selectedPresetId = state.customPresets[nameMatchIndex].id;
    await persistCustomPresets();
    refreshPresetPicker(state.selectedPresetId);
    setStatusMessage("Preset updated.", "success");
    queueSave();
    return;
  }

  const newPreset = {
    id: createCustomPresetId(),
    name,
    description: "",
    template
  };

  state.customPresets.push(newPreset);
  state.selectedPresetId = newPreset.id;
  await persistCustomPresets();
  refreshPresetPicker(newPreset.id);
  setStatusMessage("Preset saved.", "success");
  queueSave();
}

async function deleteCurrentPreset() {
  if (!state.selectedPresetId.startsWith("custom:")) {
    return;
  }

  const index = state.customPresets.findIndex((preset) => preset.id === state.selectedPresetId);
  if (index === -1) {
    return;
  }

  state.customPresets.splice(index, 1);
  state.selectedPresetId = CURRENT_TEMPLATE_OPTION_ID;
  await persistCustomPresets();
  refreshPresetPicker();
  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.value = "";
  }
  setStatusMessage("Preset removed.", "success");
  queueSave();
}

async function importCustomPresetsFromFileList(fileList) {
  if (!fileList || fileList.length === 0) {
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const file of fileList) {
    try {
      const contents = await file.text();
      const parsed = JSON.parse(contents);
      const presets = Array.isArray(parsed) ? parsed : parsed?.presets;
      if (!Array.isArray(presets)) {
        skipped += 1;
        continue;
      }

      presets.forEach((candidate) => {
        const preset = normalizeCustomPreset(candidate);
        if (!preset) {
          skipped += 1;
          return;
        }

        const existingIndex = state.customPresets.findIndex(
          (entry) => entry.id === preset.id || entry.name.toLowerCase() === preset.name.toLowerCase()
        );

        if (existingIndex !== -1) {
          state.customPresets[existingIndex] = {
            ...state.customPresets[existingIndex],
            ...preset
          };
        } else {
          state.customPresets.push(preset);
        }

        imported += 1;
      });
    } catch (error) {
      console.error("Failed to import presets", error);
      skipped += 1;
    }
  }

  if (imported > 0) {
    await persistCustomPresets();
    refreshPresetPicker();
    setStatusMessage(
      `${imported} preset${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} skipped.` : "."}`,
      "success"
    );
    queueSave();
  } else {
    setStatusMessage("No presets were imported. Check the file format and try again.", "error");
  }
}

function exportCustomPresets() {
  if (!state.customPresets.length) {
    setStatusMessage("There are no custom presets to export yet.", "error");
    return;
  }

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    presets: state.customPresets
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tabsidian-presets.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  setStatusMessage("Custom presets exported.", "success");
}

async function importRestrictedUrlsFromFileList(fileList) {
  if (!fileList || fileList.length === 0) {
    return;
  }

  const [file] = fileList;
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    let entries;

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        entries = parsed.map((value) => String(value));
      } else if (parsed && Array.isArray(parsed.restrictedUrls)) {
        entries = parsed.restrictedUrls.map((value) => String(value));
      }
    } catch (error) {
      // ignore, fallback to newline parsing
    }

    if (!entries) {
      entries = text
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }

    const sanitized = sanitizeRestrictedUrls(entries);
    elements.restrictedUrls().value = toMultilineValue(sanitized);
    setStatusMessage(`Imported ${sanitized.length} restricted entr${sanitized.length === 1 ? "y" : "ies"}.`, "success");
    queueSave();
  } catch (error) {
    console.error("Failed to import restricted URLs", error);
    setStatusMessage("Failed to import restricted URLs. See console for details.", "error");
  }
}

function exportRestrictedUrls() {
  const entries = parseMultiline(elements.restrictedUrls().value);
  if (entries.length === 0) {
    setStatusMessage("Restricted list is empty.", "error");
    return;
  }

  const blob = new Blob([entries.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tabsidian-restricted-urls.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  setStatusMessage("Restricted URLs exported.", "success");
}

function resetAllPreferences() {
  resetGeneralPreferences({ silent: true });
  resetPropertyPreferences({ silent: true });
  resetTemplatePreferences({ silent: true });
  resetRestrictedPreferences({ silent: true });
  queueSave();
  setStatusMessage("All settings restored to defaults.", "success");
}

function resetGeneralPreferences(options = {}) {
  const { silent = false } = options;
  elements.obsidianVault().value = "";
  elements.obsidianNotePath().value = DEFAULT_OBSIDIAN_NOTE_PATH;
  const dateFormatInput = elements.timestampDateFormat();
  const timeFormatInput = elements.timestampTimeFormat();
  if (dateFormatInput) {
    dateFormatInput.value = DEFAULT_EXPORT_DATE_FORMAT;
  }
  if (timeFormatInput) {
    timeFormatInput.value = DEFAULT_EXPORT_TIME_FORMAT;
  }
  state.timestampFormats = {
    dateFormat: DEFAULT_EXPORT_DATE_FORMAT,
    timeFormat: DEFAULT_EXPORT_TIME_FORMAT
  };
  resetValidity(elements.obsidianVault(), elements.obsidianNotePath());
  if (!silent) {
    setStatusMessage("General settings reset.", "success");
  }
  queueSave({ silent });
}

function resetPropertyPreferences(options = {}) {
  const { silent = false } = options;
  setFrontmatterInputs(DEFAULT_FRONTMATTER_FIELDS);
  setFrontmatterToggles(DEFAULT_FRONTMATTER_ENABLED_FIELDS);
  state.frontmatterFields = { ...DEFAULT_FRONTMATTER_FIELDS };
  state.frontmatterValidation = { hasErrors: false, messages: [] };
  setFrontmatterTemplateInputs({
    titleTemplate: DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
    tagTemplates: DEFAULT_FRONTMATTER_TAG_TEMPLATES,
    collectionTemplates: DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES
  });
  state.frontmatterListValidation = { hasErrors: false, messages: [] };
  updateTemplatePreview();
  if (!silent) {
    setStatusMessage("Properties reset.", "success");
  }
  queueSave({ silent });
}

function resetTemplatePreferences(options = {}) {
  const { silent = false } = options;
  elements.markdownFormat().value = DEFAULT_MARKDOWN_FORMAT;
  state.customPresets = [];
  state.selectedPresetId = "builtin:default";
  persistCustomPresets().catch((error) => {
    console.error("Failed to clear presets during reset", error);
  });
  refreshPresetPicker(state.selectedPresetId);
  updateTemplatePreview();
  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.value = "";
  }
  if (!silent) {
    setStatusMessage("Templates reset.", "success");
  }
  queueSave({ silent });
}

function resetRestrictedPreferences(options = {}) {
  const { silent = false } = options;
  elements.restrictedUrls().value = toMultilineValue(DEFAULT_RESTRICTED_URLS);
  if (!silent) {
    setStatusMessage("Restricted URLs reset.", "success");
  }
  queueSave({ silent });
}

async function loadPreferences() {
  const stored = await browser.storage.sync.get([
    "restrictedUrls",
    "markdownFormat",
    "obsidianVault",
    "obsidianNotePath",
    "frontmatterFieldNames",
    PRESET_STORAGE_KEY,
    FRONTMATTER_TITLE_STORAGE_KEY,
    FRONTMATTER_TAGS_STORAGE_KEY,
    FRONTMATTER_COLLECTIONS_STORAGE_KEY,
    FRONTMATTER_ENABLED_STORAGE_KEY,
    TIMESTAMP_DATE_FORMAT_STORAGE_KEY,
    TIMESTAMP_TIME_FORMAT_STORAGE_KEY
  ]);

  const storedRestrictedRaw = Array.isArray(stored.restrictedUrls)
    ? sanitizeRestrictedUrls(stored.restrictedUrls)
    : [];

  const legacyMatch =
    JSON.stringify(storedRestrictedRaw) === JSON.stringify(LEGACY_DEFAULT_RESTRICTED_URLS);

  const restrictedUrls =
    storedRestrictedRaw.length === 0 || legacyMatch
      ? DEFAULT_RESTRICTED_URLS
      : storedRestrictedRaw;

  const markdownFormat =
    typeof stored.markdownFormat === "string" && stored.markdownFormat.trim().length > 0
      ? stored.markdownFormat
      : DEFAULT_MARKDOWN_FORMAT;

  const storedVault = typeof stored.obsidianVault === "string" ? stored.obsidianVault : "";
  const storedPath =
    typeof stored.obsidianNotePath === "string" && stored.obsidianNotePath.trim().length > 0
      ? sanitizeNotePathInput(stored.obsidianNotePath)
      : "";

  const rawPresets = Array.isArray(stored[PRESET_STORAGE_KEY]) ? stored[PRESET_STORAGE_KEY] : [];
  state.customPresets = rawPresets
    .map((candidate) => normalizeCustomPreset(candidate))
    .filter((preset) => preset !== null);

  const matchedPreset = findPresetMatchingTemplate(markdownFormat);
  state.selectedPresetId = matchedPreset ? matchedPreset.id : CURRENT_TEMPLATE_OPTION_ID;

  elements.restrictedUrls().value = toMultilineValue(restrictedUrls);
  elements.markdownFormat().value = markdownFormat;
  elements.obsidianVault().value = storedVault;
  elements.obsidianNotePath().value = storedPath;
  const dateFormatInput = elements.timestampDateFormat();
  const timeFormatInput = elements.timestampTimeFormat();
  const storedDateFormatRaw =
    typeof stored[TIMESTAMP_DATE_FORMAT_STORAGE_KEY] === "string"
      ? stored[TIMESTAMP_DATE_FORMAT_STORAGE_KEY]
      : "";
  const storedTimeFormatRaw =
    typeof stored[TIMESTAMP_TIME_FORMAT_STORAGE_KEY] === "string"
      ? stored[TIMESTAMP_TIME_FORMAT_STORAGE_KEY]
      : "";
  const resolvedDateFormat = sanitizeFormatInput(storedDateFormatRaw, DEFAULT_EXPORT_DATE_FORMAT);
  const resolvedTimeFormat = sanitizeFormatInput(storedTimeFormatRaw, DEFAULT_EXPORT_TIME_FORMAT);
  if (dateFormatInput) {
    dateFormatInput.value = resolvedDateFormat;
  }
  if (timeFormatInput) {
    timeFormatInput.value = resolvedTimeFormat;
  }
  state.timestampFormats = {
    dateFormat: resolvedDateFormat,
    timeFormat: resolvedTimeFormat
  };
  setFrontmatterInputs(stored.frontmatterFieldNames ?? DEFAULT_FRONTMATTER_FIELDS);

  const storedTitleTemplate =
    typeof stored[FRONTMATTER_TITLE_STORAGE_KEY] === "string"
      ? stored[FRONTMATTER_TITLE_STORAGE_KEY]
      : DEFAULT_FRONTMATTER_TITLE_TEMPLATE;
  const storedTagTemplates = Array.isArray(stored[FRONTMATTER_TAGS_STORAGE_KEY])
    ? stored[FRONTMATTER_TAGS_STORAGE_KEY].filter((entry) => typeof entry === "string")
    : DEFAULT_FRONTMATTER_TAG_TEMPLATES;
  const storedCollectionTemplates = Array.isArray(stored[FRONTMATTER_COLLECTIONS_STORAGE_KEY])
    ? stored[FRONTMATTER_COLLECTIONS_STORAGE_KEY].filter((entry) => typeof entry === "string")
    : DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES;
  const storedEnabledFields =
    stored && typeof stored[FRONTMATTER_ENABLED_STORAGE_KEY] === "object"
      ? stored[FRONTMATTER_ENABLED_STORAGE_KEY]
      : DEFAULT_FRONTMATTER_ENABLED_FIELDS;

  setFrontmatterTemplateInputs({
    titleTemplate: storedTitleTemplate,
    tagTemplates: storedTagTemplates,
    collectionTemplates: storedCollectionTemplates
  });
  setFrontmatterToggles(storedEnabledFields);
  validateFrontmatterTemplateLists();

  refreshPresetPicker(state.selectedPresetId);
  if (matchedPreset) {
    const presetNameInput = elements.presetName();
    if (presetNameInput) {
      presetNameInput.value = matchedPreset.name;
    }
  }

  state.preferencesReady = true;
  updateTemplatePreview();
  setStatusMessage("");

  if (legacyMatch || storedRestrictedRaw.length === 0) {
    queueSave({ silent: true });
  }
}

async function savePreferences() {
  const restrictedUrls = parseMultiline(elements.restrictedUrls().value);
  const markdownFormat = elements.markdownFormat().value || DEFAULT_MARKDOWN_FORMAT;
  const obsidianPreferences = validateObsidianPreferences();
  if (!obsidianPreferences) {
    setStatusMessage("Fix vault and note path before saving.", "error");
    scheduleSave.cancel();
    return;
  }

  const dateFormatInput = elements.timestampDateFormat();
  const timeFormatInput = elements.timestampTimeFormat();
  const resolvedDateFormat = sanitizeFormatInput(dateFormatInput?.value, DEFAULT_EXPORT_DATE_FORMAT);
  const resolvedTimeFormat = sanitizeFormatInput(timeFormatInput?.value, DEFAULT_EXPORT_TIME_FORMAT);
  if (dateFormatInput) {
    dateFormatInput.value = resolvedDateFormat;
  }
  if (timeFormatInput) {
    timeFormatInput.value = resolvedTimeFormat;
  }
  state.timestampFormats = {
    dateFormat: resolvedDateFormat,
    timeFormat: resolvedTimeFormat
  };

  await browser.storage.sync.set({
    restrictedUrls,
    markdownFormat,
    obsidianVault: obsidianPreferences.vault,
    obsidianNotePath: obsidianPreferences.notePath,
    frontmatterFieldNames: state.frontmatterFields,
    [PRESET_STORAGE_KEY]: state.customPresets,
    [FRONTMATTER_TITLE_STORAGE_KEY]: state.frontmatterTitleTemplate,
    [FRONTMATTER_TAGS_STORAGE_KEY]: state.frontmatterTagTemplates,
    [FRONTMATTER_COLLECTIONS_STORAGE_KEY]: state.frontmatterCollectionTemplates,
    [FRONTMATTER_ENABLED_STORAGE_KEY]: state.frontmatterEnabled,
    [TIMESTAMP_DATE_FORMAT_STORAGE_KEY]: resolvedDateFormat,
    [TIMESTAMP_TIME_FORMAT_STORAGE_KEY]: resolvedTimeFormat
  });

  const wasSilent = state.pendingSilentSave;
  state.pendingSilentSave = false;
  if (!wasSilent) {
    setStatusMessage("Changes saved.", "success");
  }
}

function attachEvents() {
  elements.markdownFormat().addEventListener("input", () => {
    state.selectedPresetId = CURRENT_TEMPLATE_OPTION_ID;
    updateTemplatePreview();
    refreshPresetPicker();
    queueSave({ silent: true });
  });

  elements.frontmatterInputs().forEach((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.addEventListener("input", () => {
      updateFrontmatterState();
    });
    input.addEventListener("blur", () => {
      input.value = sanitizeFrontmatterInput(input.value);
      updateFrontmatterState();
    });
  });

  elements.frontmatterToggles().forEach((toggle) => {
    if (!(toggle instanceof HTMLInputElement)) {
      return;
    }
    toggle.addEventListener("change", handleFrontmatterToggleChange);
  });

  const titleTemplateInput = elements.frontmatterTitleTemplate();
  if (titleTemplateInput instanceof HTMLTextAreaElement || titleTemplateInput instanceof HTMLInputElement) {
    titleTemplateInput.addEventListener("input", () => {
      state.frontmatterTitleTemplate = titleTemplateInput.value;
      queueSave({ silent: true });
      updateTemplatePreview();
    });
    titleTemplateInput.addEventListener("blur", () => {
      state.frontmatterTitleTemplate = titleTemplateInput.value.trim() || DEFAULT_FRONTMATTER_TITLE_TEMPLATE;
      titleTemplateInput.value = state.frontmatterTitleTemplate;
      queueSave({ silent: true });
      updateTemplatePreview();
    });
  }

  const tagsInput = elements.frontmatterTags();
  if (tagsInput instanceof HTMLTextAreaElement) {
    tagsInput.addEventListener("input", () => {
      updateFrontmatterListsState({ sanitize: false });
    });
    tagsInput.addEventListener("blur", () => {
      updateFrontmatterListsState({ sanitize: true });
    });
  }

  const collectionsInput = elements.frontmatterCollections();
  if (collectionsInput instanceof HTMLTextAreaElement) {
    collectionsInput.addEventListener("input", () => {
      updateFrontmatterListsState({ sanitize: false });
    });
    collectionsInput.addEventListener("blur", () => {
      updateFrontmatterListsState({ sanitize: true });
    });
  }

  setFrontmatterToggles(state.frontmatterEnabled);

  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.addEventListener("input", () => {
      updatePresetButtons();
    });
  }

  elements.presetFormats().addEventListener("change", (event) => {
    const select = event.target;
    state.selectedPresetId = select.value;
    updatePresetDescription();
    updatePresetButtons();
  });

  elements.applyPreset().addEventListener("click", () => {
    applySelectedPreset();
  });

  elements.resetTemplate().addEventListener("click", () => {
    resetTemplateToDefault();
  });

  elements.savePreset().addEventListener("click", () => {
    saveCustomPreset().catch((error) => {
      console.error("Failed to save preset", error);
      setStatusMessage("Unable to save the preset. See console for details.", "error");
    });
  });

  elements.deletePreset().addEventListener("click", () => {
    deleteCurrentPreset().catch((error) => {
      console.error("Failed to remove preset", error);
      setStatusMessage("Unable to remove the preset. See console for details.", "error");
    });
  });

  elements.importPresets().addEventListener("click", () => {
    const input = elements.presetImportInput();
    if (input) {
      input.value = "";
      input.click();
    }
  });

  const importInput = elements.presetImportInput();
  if (importInput) {
    importInput.addEventListener("change", (event) => {
      const { files } = event.target;
      importCustomPresetsFromFileList(files).catch((error) => {
        console.error("Preset import failed", error);
        setStatusMessage("Preset import failed. See console for details.", "error");
      });
    });
  }

  elements.exportPresets().addEventListener("click", () => {
    exportCustomPresets();
  });

  const vaultInput = elements.obsidianVault();
  if (vaultInput) {
    vaultInput.addEventListener("input", () => {
      resetValidity(vaultInput);
    });
    vaultInput.addEventListener("blur", () => {
      const preferences = validateObsidianPreferences();
      if (preferences) {
        queueSave();
      }
    });
  }

  const notePathInput = elements.obsidianNotePath();
  if (notePathInput) {
    notePathInput.addEventListener("input", () => {
      resetValidity(notePathInput);
    });
    notePathInput.addEventListener("blur", () => {
      const preferences = validateObsidianPreferences();
      if (preferences) {
        queueSave();
      }
    });
  }

  const dateFormatInput = elements.timestampDateFormat();
  if (dateFormatInput) {
    dateFormatInput.addEventListener("input", () => {
      const value =
        dateFormatInput.value && dateFormatInput.value.trim().length > 0
          ? dateFormatInput.value.trim()
          : DEFAULT_EXPORT_DATE_FORMAT;
      state.timestampFormats.dateFormat = value;
      updateTemplatePreview();
      queueSave({ silent: true });
    });
    dateFormatInput.addEventListener("blur", () => {
      const value = sanitizeFormatInput(dateFormatInput.value, DEFAULT_EXPORT_DATE_FORMAT);
      dateFormatInput.value = value;
      state.timestampFormats.dateFormat = value;
      updateTemplatePreview();
      queueSave();
    });
  }

  const timeFormatInput = elements.timestampTimeFormat();
  if (timeFormatInput) {
    timeFormatInput.addEventListener("input", () => {
      const value =
        timeFormatInput.value && timeFormatInput.value.trim().length > 0
          ? timeFormatInput.value.trim()
          : DEFAULT_EXPORT_TIME_FORMAT;
      state.timestampFormats.timeFormat = value;
      updateTemplatePreview();
      queueSave({ silent: true });
    });
    timeFormatInput.addEventListener("blur", () => {
      const value = sanitizeFormatInput(timeFormatInput.value, DEFAULT_EXPORT_TIME_FORMAT);
      timeFormatInput.value = value;
      state.timestampFormats.timeFormat = value;
      updateTemplatePreview();
      queueSave();
    });
  }

  elements.restrictedUrls().addEventListener("input", () => {
    queueSave({ silent: true });
  });

  const generalReset = elements.resetGeneral();
  if (generalReset) {
    generalReset.addEventListener("click", () => {
      resetGeneralPreferences();
    });
  }

  const propertyReset = elements.resetProperties();
  if (propertyReset) {
    propertyReset.addEventListener("click", () => {
      resetPropertyPreferences();
    });
  }

  const templateReset = elements.resetTemplates();
  if (templateReset) {
    templateReset.addEventListener("click", () => {
      resetTemplatePreferences();
    });
  }

  const restrictedReset = elements.resetRestricted();
  if (restrictedReset) {
    restrictedReset.addEventListener("click", () => {
      resetRestrictedPreferences();
    });
  }

  const resetAllButton = elements.resetAll();
  if (resetAllButton) {
    resetAllButton.addEventListener("click", () => {
      resetAllPreferences();
    });
  }

  const restrictedImportButton = elements.restrictedImport();
  if (restrictedImportButton) {
    restrictedImportButton.addEventListener("click", () => {
      const input = elements.restrictedImportInput();
      if (input) {
        input.value = "";
        input.click();
      }
    });
  }

  const restrictedImportInput = elements.restrictedImportInput();
  if (restrictedImportInput) {
    restrictedImportInput.addEventListener("change", (event) => {
      importRestrictedUrlsFromFileList(event.target.files).catch((error) => {
        console.error("Restricted URL import failed", error);
        setStatusMessage("Restricted URL import failed. See console for details.", "error");
      });
    });
  }

  const restrictedExportButton = elements.restrictedExport();
  if (restrictedExportButton) {
    restrictedExportButton.addEventListener("click", () => {
      exportRestrictedUrls();
    });
  }
}

function renderPlatformHint() {
  const hintElement = elements.platformHint();
  if (!hintElement) {
    return;
  }

  if (IS_SAFARI) {
    hintElement.textContent =
      "Safari exports use the Share Sheet. File downloads remain available on other browsers.";
    hintElement.hidden = false;
    return;
  }

  hintElement.textContent = `Currently configured for ${describePlatform()}.`;
  hintElement.hidden = false;
}

document.addEventListener("DOMContentLoaded", () => {
  initializeSectionNavigation().catch((error) => {
    console.error("Unable to set up section navigation", error);
  });
  attachEvents();
  renderPlatformHint();
  loadPreferences().catch((error) => {
    console.error("Unable to load stored preferences", error);
    setStatusMessage("Unable to load stored preferences.", "error");
  });
});
