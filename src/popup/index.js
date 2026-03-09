import browser from "../platform/browser.js";
import { getVaults, getTemplates, getSaveTargetDefaults, getStoredValues, resolveSaveTarget } from "../platform/storage.js";
import { BUILT_IN_PRESETS, DEFAULT_RESTRICTED_URLS } from "../platform/defaults.js";
import { createSampleTemplateContext } from "../platform/markdown.js";
import { sanitizeRestrictedUrls, selectSavableTabs } from "../platform/tabFilters.js";
import { renderTemplate } from "../platform/templateEngine.js";

const elements = {
  templateSelect: () => document.getElementById("template-select"),
  vaultSelect: () => document.getElementById("vault-select"),
  filenameInput: () => document.getElementById("filename-input"),
  folderInput: () => document.getElementById("folder-input"),
  templatePreview: () => document.getElementById("template-preview"),
  saveStatus: () => document.getElementById("save-status"),
  saveBtn: () => document.getElementById("save-btn"),
  settingsBtn: () => document.getElementById("settings-btn"),
  tabCount: () => document.getElementById("tab-count")
};

let state = {
  templates: [],
  vaults: [],
  saveTargetDefaults: {
    folder: "",
    filenamePattern: "Tabs - {{date}}"
  },
  currentTemplate: null,
  manualOverrides: {
    vault: false,
    folder: false,
    filename: false
  }
};

async function initialize() {
  try {
    const [templates, vaults, saveTargetDefaults] = await Promise.all([
      getTemplates(),
      getVaults(),
      getSaveTargetDefaults()
    ]);
    state.templates = [...BUILT_IN_PRESETS, ...templates];
    state.vaults = vaults;
    state.saveTargetDefaults = saveTargetDefaults;

    populateTemplates();
    populateVaults();
    updateTabCount();

    // Select default template (first custom or builtin:default)
    // Ideally we should store the last used template or a specific default
    // For now, let's pick the first one
    if (state.templates.length > 0) {
      const defaultTemplate = state.templates.find((template) => template.id === "builtin:default");
      selectTemplate((defaultTemplate ?? state.templates[0]).id, { resetOverrides: true });
    }

    bindEvents();
  } catch (error) {
    console.error("Failed to initialize popup", error);
  }
}

function populateTemplates() {
  const select = elements.templateSelect();
  select.innerHTML = "";
  
  state.templates.forEach(template => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    select.appendChild(option);
  });
}

function populateVaults() {
  const select = elements.vaultSelect();
  select.innerHTML = "";

  if (state.vaults.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No vault (download fallback)";
    select.appendChild(option);
    updateActionLabel();
    return;
  }

  state.vaults.forEach(vault => {
    const option = document.createElement("option");
    option.value = vault.name;
    option.textContent = vault.name;
    select.appendChild(option);
  });

  updateActionLabel();
}

function selectTemplate(id, { resetOverrides = false } = {}) {
  const template = state.templates.find(t => t.id === id);
  if (!template) return;

  if (resetOverrides) {
    state.manualOverrides = {
      vault: false,
      folder: false,
      filename: false
    };
  }

  state.currentTemplate = template;
  elements.templateSelect().value = id;

  const globalDefaultVault = state.vaults.find((vault) => vault.isDefault)?.name || state.vaults[0]?.name || "";
  const target = resolveSaveTarget(
    template,
    globalDefaultVault,
    state.saveTargetDefaults.folder,
    state.saveTargetDefaults.filenamePattern
  );

  if (!state.manualOverrides.filename) {
    elements.filenameInput().value = target.filename;
  }
  if (!state.manualOverrides.folder) {
    elements.folderInput().value = target.folder || "";
  }
  if (!state.manualOverrides.vault) {
    elements.vaultSelect().value = target.vault || "";
  }
  updateActionLabel();
  updatePreview();
}

async function updateTabCount() {
  const [tabs, stored] = await Promise.all([
    browser.tabs.query({ currentWindow: true }),
    getStoredValues(["restrictedUrls"])
  ]);
  const restrictedUrls =
    Array.isArray(stored?.restrictedUrls) && stored.restrictedUrls.length > 0
      ? sanitizeRestrictedUrls(stored.restrictedUrls)
      : DEFAULT_RESTRICTED_URLS;
  const savableTabs = selectSavableTabs(tabs, restrictedUrls);
  elements.tabCount().textContent = `Saving ${savableTabs.length} tab${savableTabs.length === 1 ? "" : "s"}`;
}

function updatePreview() {
  const template = state.currentTemplate?.template || "";
  const previewElement = elements.templatePreview();
  if (!previewElement) {
    return;
  }

  if (!template) {
    previewElement.textContent = "No template selected.";
    return;
  }

  try {
    const sampleContext = createSampleTemplateContext();
    const rendered = renderTemplate(template, sampleContext).trim();
    previewElement.textContent = rendered.length > 0 ? rendered : "(Template rendered an empty result)";
  } catch (error) {
    previewElement.textContent = `Preview unavailable: ${error?.message ?? "Unknown template error"}`;
  }
}

function updateActionLabel() {
  const saveButton = elements.saveBtn();
  if (!saveButton) {
    return;
  }
  const selectedVault = elements.vaultSelect().value;
  saveButton.textContent = selectedVault ? "Save to Obsidian" : "Save to File";
}

function setSaveStatus(message, isError = false) {
  const status = elements.saveStatus();
  if (!status) {
    return;
  }
  status.textContent = message || "";
  status.classList.toggle("is-error", Boolean(isError));
}

function bindEvents() {
  elements.templateSelect().addEventListener("change", (e) => {
    selectTemplate(e.target.value);
  });

  elements.vaultSelect().addEventListener("change", () => {
    state.manualOverrides.vault = true;
    updateActionLabel();
  });
  elements.filenameInput().addEventListener("input", () => {
    state.manualOverrides.filename = true;
    updatePreview();
  });
  elements.folderInput().addEventListener("input", () => {
    state.manualOverrides.folder = true;
    updatePreview();
  });

  elements.settingsBtn().addEventListener("click", () => {
    browser.runtime.openOptionsPage();
  });

  elements.saveBtn().addEventListener("click", async () => {
    const saveButton = elements.saveBtn();
    saveButton.disabled = true;
    setSaveStatus("Saving...");

    const templateId = elements.templateSelect().value;
    const vaultName = elements.vaultSelect().value;
    const filename = elements.filenameInput().value;
    const folder = elements.folderInput().value;

    try {
      const response = await browser.runtime.sendMessage({
        type: "SAVE_TABS",
        payload: {
          templateId,
          vaultName,
          filename,
          folder
        }
      });

      if (response && response.ok === false) {
        setSaveStatus(response.error || "Unable to save tabs. Check extension logs.", true);
        saveButton.disabled = false;
        return;
      }

      window.close();
    } catch (error) {
      setSaveStatus(error?.message || "Unable to save tabs. Check extension logs.", true);
      saveButton.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", initialize);
