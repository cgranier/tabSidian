import browser from "webextension-polyfill";
import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_OBSIDIAN_NOTE_PATH,
  DEFAULT_RESTRICTED_URLS
} from "../platform/defaults.js";
import { SAMPLE_TEMPLATE_CONTEXT } from "../platform/markdown.js";
import { renderTemplate, validateTemplate } from "../platform/templateEngine.js";
import { describePlatform, IS_SAFARI } from "../platform/runtime.js";
import { sanitizeRestrictedUrls } from "../platform/tabFilters.js";

const CURRENT_TEMPLATE_OPTION_ID = "custom:current";
const PRESET_STORAGE_KEY = "templatePresets";

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
  }
];

const elements = {
  restrictedUrls: () => document.getElementById("restrictedUrls"),
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
  templateStatus: () => document.querySelector("[data-template-status]"),
  templateDocs: () => document.querySelector("[data-template-docs]"),
  save: () => document.getElementById("save"),
  platformHint: () => document.querySelector("[data-platform-hint]"),
  obsidianVault: () => document.getElementById("obsidianVault"),
  obsidianNotePath: () => document.getElementById("obsidianNotePath")
};

const state = {
  customPresets: [],
  selectedPresetId: CURRENT_TEMPLATE_OPTION_ID,
  diagnostics: {
    errors: [],
    warnings: [],
    preview: "",
    previewError: null
  }
};

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

const OBSIDIAN_VAULT_PATTERN = /^[\w-](?:[\w\- ]+)?$/u;
const OBSIDIAN_NOTE_PATH_ALLOWED = /^[a-zA-Z0-9 _\-/\{\}\.\-]+$/;
const OBSIDIAN_NOTE_PATH_INVALID_SEGMENT = /(^|\/)(\.{1,2})(\/|$)/;

function sanitizeTextInput(value) {
  return (value ?? "").trim();
}

function sanitizeNotePathInput(value) {
  const normalized = (value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");

  return normalized;
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

  if (!OBSIDIAN_VAULT_PATTERN.test(rawVault)) {
    vaultInput.setCustomValidity("Vault name may include letters, numbers, spaces, underscores, and hyphens.");
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

  if (!OBSIDIAN_NOTE_PATH_ALLOWED.test(sanitizedPath)) {
    notePathInput.setCustomValidity(
      "Note paths may only include letters, numbers, spaces, hyphens, slashes, dots, and {timestamp}."
    );
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

function setTemplateStatus(message, type = "info") {
  const statusElement = elements.templateStatus();
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.classList.remove("is-success", "is-error");

  if (!message) {
    return;
  }

  if (type === "success") {
    statusElement.classList.add("is-success");
  } else if (type === "error") {
    statusElement.classList.add("is-error");
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

function computeTemplateDiagnostics(template) {
  const validation = validateTemplate(template);
  const errors = [...validation.errors];
  const warnings = [...validation.warnings];

  let preview = "";
  let previewError = null;

  if (errors.length === 0) {
    try {
      preview = renderTemplate(template, SAMPLE_TEMPLATE_CONTEXT);
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
  const saveButton = elements.save();

  const hasName = presetNameInput.value.trim().length > 0;
  const hasErrors = state.diagnostics.errors.length > 0;

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

  if (saveButton) {
    saveButton.disabled = hasErrors;
  }
}

function updateTemplatePreview() {
  const template = elements.markdownFormat().value ?? "";
  const diagnostics = computeTemplateDiagnostics(template);
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
  setTemplateStatus(`Loaded preset "${preset.name}".`);
  updateTemplatePreview();
  refreshPresetPicker(preset.id);

  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.value = preset.name;
  }
}

function resetTemplateToDefault() {
  elements.markdownFormat().value = DEFAULT_MARKDOWN_FORMAT;
  state.selectedPresetId = "builtin:default";
  setTemplateStatus("Template reset to the default layout.");
  updateTemplatePreview();
  refreshPresetPicker(state.selectedPresetId);

  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.value = "";
  }
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
    setTemplateStatus("Enter a preset name before saving.", "error");
    return;
  }

  if (state.diagnostics.errors.length > 0) {
    setTemplateStatus("Resolve template errors before saving the preset.", "error");
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
      setTemplateStatus("Preset updated.", "success");
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
    setTemplateStatus("Preset updated.", "success");
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
  setTemplateStatus("Preset saved.", "success");
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
  setTemplateStatus("Preset removed.", "success");
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
    setTemplateStatus(
      `${imported} preset${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} skipped.` : "."}`,
      "success"
    );
  } else {
    setTemplateStatus("No presets were imported. Check the file format and try again.", "error");
  }
}

function exportCustomPresets() {
  if (!state.customPresets.length) {
    setTemplateStatus("There are no custom presets to export yet.", "error");
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

  setTemplateStatus("Custom presets exported.", "success");
}

async function loadPreferences() {
  const stored = await browser.storage.sync.get([
    "restrictedUrls",
    "markdownFormat",
    "obsidianVault",
    "obsidianNotePath",
    PRESET_STORAGE_KEY
  ]);

  const restrictedUrls =
    Array.isArray(stored.restrictedUrls) && stored.restrictedUrls.length
      ? stored.restrictedUrls
      : DEFAULT_RESTRICTED_URLS;

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

  refreshPresetPicker(state.selectedPresetId);
  if (matchedPreset) {
    const presetNameInput = elements.presetName();
    if (presetNameInput) {
      presetNameInput.value = matchedPreset.name;
    }
  }

  updateTemplatePreview();
  setTemplateStatus("");
}

async function savePreferences() {
  const restrictedUrls = parseMultiline(elements.restrictedUrls().value);
  const markdownFormat = elements.markdownFormat().value || DEFAULT_MARKDOWN_FORMAT;
  const obsidianPreferences = validateObsidianPreferences();
  if (!obsidianPreferences) {
    return;
  }

  await browser.storage.sync.set({
    restrictedUrls,
    markdownFormat,
    obsidianVault: obsidianPreferences.vault,
    obsidianNotePath: obsidianPreferences.notePath,
    [PRESET_STORAGE_KEY]: state.customPresets
  });

  setTemplateStatus("Preferences saved.", "success");
}

function attachEvents() {
  elements.save().addEventListener("click", () => {
    savePreferences().catch((error) => {
      console.error("Failed to persist preferences", error);
      setTemplateStatus("Unable to save preferences. Check the console for details.", "error");
    });
  });

  elements.markdownFormat().addEventListener("input", () => {
    state.selectedPresetId = CURRENT_TEMPLATE_OPTION_ID;
    updateTemplatePreview();
    refreshPresetPicker();
  });

  const presetNameInput = elements.presetName();
  if (presetNameInput) {
    presetNameInput.addEventListener("input", () => {
      setTemplateStatus("");
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
      setTemplateStatus("Unable to save the preset. See console for details.", "error");
    });
  });

  elements.deletePreset().addEventListener("click", () => {
    deleteCurrentPreset().catch((error) => {
      console.error("Failed to remove preset", error);
      setTemplateStatus("Unable to remove the preset. See console for details.", "error");
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
        setTemplateStatus("Preset import failed. See console for details.", "error");
      });
    });
  }

  elements.exportPresets().addEventListener("click", () => {
    exportCustomPresets();
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

document.addEventListener("DOMContentLoaded", () => {
  attachEvents();
  renderPlatformHint();
  loadPreferences().catch((error) => {
    console.error("Unable to load stored preferences", error);
    setTemplateStatus("Unable to load stored preferences.", "error");
  });
});
