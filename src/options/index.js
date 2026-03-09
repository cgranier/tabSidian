import browser from "webextension-polyfill";
import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_RESTRICTED_URLS,
  DEFAULT_FRONTMATTER_FIELDS,
  DEFAULT_FRONTMATTER_ENABLED_FIELDS,
  DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  DEFAULT_FRONTMATTER_TAG_TEMPLATES,
  DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES,
  DEFAULT_EXPORT_DATE_FORMAT,
  DEFAULT_EXPORT_TIME_FORMAT,
  DEFAULT_VAULTS,
  BUILT_IN_PRESETS
} from "../platform/defaults.js";

import {
  createSampleTemplateContext,
  resolveFrontmatterFields,
  resolveFrontmatterEnabled
} from "../platform/markdown.js";
import { renderFrontmatterFields, renderFrontmatterToggleInputs } from "./frontmatterView.js";
import {
  DEFAULT_GLOBAL_TARGET_FOLDER,
  DEFAULT_GLOBAL_TARGET_FILENAME,
  applyGeneralSettingsToInputs,
  readGeneralSettingsFromInputs,
  resetGeneralSettingsInputs
} from "./sections/general.js";
import { createGeneralController } from "./sections/generalController.js";
import {
  parseRestrictedUrlsImportText,
  createRestrictedUrlsBlob,
  resolveRestrictedUrlsOnLoad
} from "./sections/restricted.js";
import { createRestrictedController } from "./sections/restrictedController.js";
import {
  createCustomTemplateId,
  createDraftCustomTemplate,
  normalizeCustomTemplatePreset,
  upsertCustomTemplatePresets,
  removeCustomTemplatePresetById
} from "./sections/templates.js";
import {
  applyTemplateToEditorForm,
  populateTemplateVaultSelect,
  renderTemplateSidebarItems
} from "./sections/templateEditorView.js";
import { createTemplateEditorController } from "./sections/templateEditorController.js";
import { createFrontmatterController } from "./sections/frontmatterController.js";
import { createFrontmatterStateApi } from "./sections/frontmatterState.js";
import {
  findTemplatePresetById,
  findTemplatePresetByTemplate,
  listTemplatePresets
} from "./sections/templatesController.js";
import { createPresetsController } from "./sections/presetsController.js";
import { createResetController } from "./sections/resetController.js";
import { createPreferencesController } from "./sections/preferencesController.js";
import { createBootstrapController } from "./sections/bootstrapController.js";
import {
  buildVault,
  appendVault,
  removeVaultAtIndex,
  setDefaultVaultByIndex,
  moveVaultByIndex
} from "./sections/vaults.js";
import { createVaultController } from "./sections/vaultsController.js";
import {
  MAX_FRONTMATTER_LIST_ENTRIES,
  normalizeTemplateEntries,
  parseTemplateMultiline,
  sanitizeFrontmatterInput,
  toTemplateMultiline,
  validateFrontmatterFieldName
} from "./sections/properties.js";
import { setupSectionNavigation } from "./sections/navigation.js";
import { renderTemplate, validateTemplate } from "../platform/templateEngine.js";
import { describePlatform, IS_SAFARI } from "../platform/runtime.js";
import { sanitizeRestrictedUrls } from "../platform/tabFilters.js";
import {
  STORAGE_KEYS,
  ensureStorageMigration,
  getSaveTargetDefaults,
  getStoredValues,
  saveSaveTargetDefaults,
  setStoredValues,
  getVaults,
  saveVaults,
  saveTemplates
} from "../platform/storage.js";

const CURRENT_TEMPLATE_OPTION_ID = "custom:current";
const SECTION_STORAGE_KEY = "options:lastSection";
const FRONTMATTER_TITLE_STORAGE_KEY = "frontmatterTitleTemplate";
const FRONTMATTER_TAGS_STORAGE_KEY = "frontmatterTagTemplates";
const FRONTMATTER_COLLECTIONS_STORAGE_KEY = "frontmatterCollectionTemplates";
const FRONTMATTER_ENABLED_STORAGE_KEY = "frontmatterEnabledFields";
const TIMESTAMP_DATE_FORMAT_STORAGE_KEY = "exportDateFormat";
const TIMESTAMP_TIME_FORMAT_STORAGE_KEY = "exportTimeFormat";

const elements = {
  restrictedUrls: () => document.getElementById("restrictedUrls"),
  restrictedImport: () => document.getElementById("restrictedImport"),
  restrictedExport: () => document.getElementById("restrictedExport"),
  restrictedImportInput: () => document.getElementById("restrictedImportInput"),
  markdownFormat: () => document.getElementById("template-content"),
  presetName: () => document.getElementById("template-name"),
  presetImportInput: () => null,
  importPresets: () => null,
  exportPresets: () => null,
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
  extensionVersion: () => document.querySelector("[data-extension-version]"),
  timestampDateFormat: () => document.getElementById("timestampDateFormat"),
  timestampTimeFormat: () => document.getElementById("timestampTimeFormat"),
  globalDefaultFolder: () => document.getElementById("globalDefaultFolder"),
  globalDefaultFilename: () => document.getElementById("globalDefaultFilename"),
  vaultList: () => document.getElementById("vault-list"),
  newVaultInput: () => document.getElementById("new-vault-input"),
  addVaultBtn: () => document.getElementById("add-vault-btn"),
  templateName: () => document.getElementById("template-name"),
  templateFilename: () => document.getElementById("template-filename"),
  templateFolder: () => document.getElementById("template-folder"),
  templateVault: () => document.getElementById("template-vault"),
  templateContent: () => document.getElementById("template-content"),
  sidebarTemplateList: () => document.getElementById("sidebar-template-list"),
  templateList: () => document.getElementById("sidebar-template-items"),
  createTemplateBtn: () => document.getElementById("create-template-btn"),
  saveTemplateBtn: () => document.getElementById("save-template-btn"),
  deleteTemplateBtn: () => document.getElementById("delete-template-btn"),
  frontmatterFieldsContainer: () => document.getElementById("frontmatter-fields-container"),
  frontmatterTogglesContainer: () => document.getElementById("frontmatter-toggles-container")
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
  saveTargetDefaults: {
    folder: DEFAULT_GLOBAL_TARGET_FOLDER,
    filenamePattern: DEFAULT_GLOBAL_TARGET_FILENAME
  },
  preferencesReady: false,
  pendingSilentSave: false,
  vaults: [...DEFAULT_VAULTS]
};

const vaultController = createVaultController({
  elements,
  state,
  buildVault,
  appendVault,
  removeVaultAtIndex,
  setDefaultVaultByIndex,
  moveVaultByIndex,
  getVaults,
  saveVaults,
  populateVaultSelect: (select) => populateTemplateVaultSelect(select, state.vaults),
  setStatusMessage
});

const templateEditorController = createTemplateEditorController({
  elements,
  state,
  getAllPresets,
  getPresetById,
  createCustomTemplateId,
  createDraftCustomTemplate,
  upsertCustomTemplatePresets,
  removeCustomTemplatePresetById,
  applyTemplateToEditorForm,
  renderTemplateSidebarItems,
  persistCustomPresets,
  updateTemplatePreview,
  setStatusMessage,
  defaultMarkdownFormat: DEFAULT_MARKDOWN_FORMAT
});

const restrictedController = createRestrictedController({
  elements,
  parseMultiline,
  toMultilineValue,
  parseRestrictedUrlsImportText,
  createRestrictedUrlsBlob,
  sanitizeRestrictedUrls,
  queueSave,
  setStatusMessage
});

const presetsController = createPresetsController({
  elements,
  state,
  normalizeCustomPreset,
  persistCustomPresets,
  refreshPresetPicker,
  queueSave,
  setStatusMessage
});

const generalController = createGeneralController({
  elements,
  state,
  defaults: {
    exportDateFormat: DEFAULT_EXPORT_DATE_FORMAT,
    exportTimeFormat: DEFAULT_EXPORT_TIME_FORMAT,
    globalTargetFilename: DEFAULT_GLOBAL_TARGET_FILENAME
  },
  resetGeneralSettingsInputs,
  resetValidity,
  sanitizeFormatInput,
  updateTemplatePreview,
  queueSave,
  setStatusMessage
});

const resetController = createResetController({
  elements,
  state,
  defaults: {
    markdownFormat: DEFAULT_MARKDOWN_FORMAT,
    restrictedUrls: DEFAULT_RESTRICTED_URLS,
    frontmatterFields: DEFAULT_FRONTMATTER_FIELDS,
    frontmatterEnabledFields: DEFAULT_FRONTMATTER_ENABLED_FIELDS,
    frontmatterTitleTemplate: DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
    frontmatterTagTemplates: DEFAULT_FRONTMATTER_TAG_TEMPLATES,
    frontmatterCollectionTemplates: DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES
  },
  generalController,
  setFrontmatterInputs,
  setFrontmatterToggles,
  setFrontmatterTemplateInputs,
  updateTemplatePreview,
  persistCustomPresets,
  refreshPresetPicker,
  toMultilineValue,
  queueSave,
  setStatusMessage
});

const preferencesController = createPreferencesController({
  elements,
  state,
  constants: {
    currentTemplateOptionId: CURRENT_TEMPLATE_OPTION_ID,
    storageKeys: STORAGE_KEYS,
    frontmatterTitleStorageKey: FRONTMATTER_TITLE_STORAGE_KEY,
    frontmatterTagsStorageKey: FRONTMATTER_TAGS_STORAGE_KEY,
    frontmatterCollectionsStorageKey: FRONTMATTER_COLLECTIONS_STORAGE_KEY,
    frontmatterEnabledStorageKey: FRONTMATTER_ENABLED_STORAGE_KEY,
    timestampDateFormatStorageKey: TIMESTAMP_DATE_FORMAT_STORAGE_KEY,
    timestampTimeFormatStorageKey: TIMESTAMP_TIME_FORMAT_STORAGE_KEY,
    defaultRestrictedUrls: DEFAULT_RESTRICTED_URLS,
    legacyDefaultRestrictedUrls: LEGACY_DEFAULT_RESTRICTED_URLS,
    defaultMarkdownFormat: DEFAULT_MARKDOWN_FORMAT,
    defaultExportDateFormat: DEFAULT_EXPORT_DATE_FORMAT,
    defaultExportTimeFormat: DEFAULT_EXPORT_TIME_FORMAT,
    defaultGlobalTargetFilename: DEFAULT_GLOBAL_TARGET_FILENAME,
    defaultFrontmatterFields: DEFAULT_FRONTMATTER_FIELDS,
    defaultFrontmatterTitleTemplate: DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
    defaultFrontmatterTagTemplates: DEFAULT_FRONTMATTER_TAG_TEMPLATES,
    defaultFrontmatterCollectionTemplates: DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES,
    defaultFrontmatterEnabledFields: DEFAULT_FRONTMATTER_ENABLED_FIELDS
  },
  deps: {
    ensureStorageMigration,
    getSaveTargetDefaults,
    getStoredValues,
    setStoredValues,
    saveSaveTargetDefaults,
    sanitizeRestrictedUrls,
    resolveRestrictedUrlsOnLoad,
    normalizeCustomPreset,
    findPresetMatchingTemplate,
    toMultilineValue,
    parseMultiline,
    sanitizeFormatInput,
    applyGeneralSettingsToInputs,
    readGeneralSettingsFromInputs,
    renderFrontmatterSettings,
    renderFrontmatterToggles,
    setFrontmatterInputs,
    setFrontmatterTemplateInputs,
    setFrontmatterToggles,
    validateFrontmatterTemplateLists,
    refreshPresetPicker
  },
  setStatusMessage,
  queueSave,
  updateTemplatePreview
});

const bootstrapController = createBootstrapController({
  initializeSectionNavigation,
  attachEvents,
  renderPlatformHint,
  renderExtensionVersion,
  preferencesController,
  vaultController,
  templateEditorController,
  restrictedController,
  presetsController,
  state,
  setStatusMessage
});

const frontmatterController = createFrontmatterController({
  elements,
  state,
  defaults: {
    frontmatterTitleTemplate: DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
    sanitizeFrontmatterInput
  },
  setFrontmatterToggles,
  updateFrontmatterState,
  handleFrontmatterToggleChange,
  updateFrontmatterListsState,
  queueSave,
  updateTemplatePreview
});

function initializeSectionNavigation() {
  const tabs = Array.from(elements.sectionTabs() || []);
  const panels = Array.from(elements.sectionPanels() || []);

  return setupSectionNavigation({
    tabs,
    panels,
    initialSection: undefined,
    readLastSection: () => {
      if (!browser?.storage?.local) {
        return Promise.resolve(undefined);
      }
      return browser.storage.local
        .get(SECTION_STORAGE_KEY)
        .then((stored) =>
          stored && typeof stored[SECTION_STORAGE_KEY] === "string" ? stored[SECTION_STORAGE_KEY] : undefined
        );
    },
    writeLastSection: (target) => {
      if (!browser?.storage?.local) {
        return;
      }
      browser.storage.local
        .set({ [SECTION_STORAGE_KEY]: target })
        .catch((error) => console.error("Unable to persist active section", error));
    },
    onSectionChange: (target) => {
      const sidebarList = elements.sidebarTemplateList();
      if (sidebarList) {
        sidebarList.classList.toggle("hidden", target !== "templates");
      }
    }
  });
}

function normalizeCustomPreset(rawPreset) {
  return normalizeCustomTemplatePreset(rawPreset, createCustomTemplateId);
}

function toMultilineValue(values) {
  return values.join("\n");
}

function parseMultiline(value) {
  return sanitizeRestrictedUrls(value.split("\n").map((entry) => entry.trim()));
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

const frontmatterStateApi = createFrontmatterStateApi({
  elements,
  state,
  frontmatterFieldKeys: FRONTMATTER_FIELD_KEYS,
  defaults: {
    frontmatterFields: DEFAULT_FRONTMATTER_FIELDS,
    frontmatterEnabledFields: DEFAULT_FRONTMATTER_ENABLED_FIELDS,
    frontmatterTitleTemplate: DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
    frontmatterTagTemplates: DEFAULT_FRONTMATTER_TAG_TEMPLATES,
    frontmatterCollectionTemplates: DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES
  },
  resolveFrontmatterFields,
  resolveFrontmatterEnabled,
  renderFrontmatterFields,
  renderFrontmatterToggleInputs,
  sanitizeFrontmatterInput,
  validateFrontmatterFieldName,
  parseTemplateMultiline,
  normalizeTemplateEntries,
  toTemplateMultiline,
  maxFrontmatterListEntries: MAX_FRONTMATTER_LIST_ENTRIES,
  queueSave,
  updateTemplatePreview,
  cancelPendingSave: () => scheduleSave.cancel()
});

function renderFrontmatterSettings() {
  return frontmatterStateApi.renderFrontmatterSettings();
}

function renderFrontmatterToggles() {
  return frontmatterStateApi.renderFrontmatterToggles();
}

function setFrontmatterInputs(fieldMap = DEFAULT_FRONTMATTER_FIELDS) {
  return frontmatterStateApi.setFrontmatterInputs(fieldMap);
}

function validateFrontmatterInputs() {
  return frontmatterStateApi.validateFrontmatterInputs();
}

function updateFrontmatterFeedback() {
  return frontmatterStateApi.updateFrontmatterFeedback();
}

function setFrontmatterToggles(flags = DEFAULT_FRONTMATTER_ENABLED_FIELDS) {
  return frontmatterStateApi.setFrontmatterToggles(flags);
}

function handleFrontmatterToggleChange(event) {
  return frontmatterStateApi.handleFrontmatterToggleChange(event);
}

function updateFrontmatterListsState({ sanitize = true } = {}) {
  return frontmatterStateApi.updateFrontmatterListsState({ sanitize });
}

function updateFrontmatterListFeedback() {
  return frontmatterStateApi.updateFrontmatterListFeedback();
}

function setFrontmatterTemplateInputs({
  titleTemplate = DEFAULT_FRONTMATTER_TITLE_TEMPLATE,
  tagTemplates = DEFAULT_FRONTMATTER_TAG_TEMPLATES,
  collectionTemplates = DEFAULT_FRONTMATTER_COLLECTION_TEMPLATES
} = {}) {
  return frontmatterStateApi.setFrontmatterTemplateInputs({
    titleTemplate,
    tagTemplates,
    collectionTemplates
  });
}

function validateFrontmatterTemplateLists({ sanitize = true } = {}) {
  return frontmatterStateApi.validateFrontmatterTemplateLists({ sanitize });
}

const scheduleSave = debounce(() => {
  preferencesController.savePreferences().catch((error) => {
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
  return frontmatterStateApi.updateFrontmatterState();
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

function getAllPresets() {
  return listTemplatePresets(BUILT_IN_PRESETS, state.customPresets);
}

function getPresetById(id) {
  return findTemplatePresetById(getAllPresets(), id);
}

function findPresetMatchingTemplate(template) {
  return findTemplatePresetByTemplate(getAllPresets(), template);
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
  templateEditorController.renderTemplateList();
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
}

async function persistCustomPresets() {
  await saveTemplates(state.customPresets);
}

function attachEvents() {
  const markdownEditor = elements.markdownFormat();
  if (markdownEditor) {
    markdownEditor.addEventListener("input", () => {
      // state.selectedPresetId = CURRENT_TEMPLATE_OPTION_ID; // Logic changed
      updateTemplatePreview();
      // refreshPresetPicker(); // Logic changed
      queueSave({ silent: true });
    });
    markdownEditor.addEventListener("blur", () => {
      queueSave();
    });
  }

  frontmatterController.bindEvents();
  generalController.bindEvents();
  resetController.bindEvents();

  elements.restrictedUrls().addEventListener("input", () => {
    queueSave({ silent: true });
  });
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

function renderExtensionVersion() {
  const versionElement = elements.extensionVersion();
  if (!versionElement || !browser?.runtime?.getManifest) {
    return;
  }
  const manifest = browser.runtime.getManifest();
  if (manifest?.version) {
    versionElement.textContent = `Version ${manifest.version}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrapController.start();
});
