import browser from "webextension-polyfill";
import {
  DEFAULT_MARKDOWN_FORMAT,
  DEFAULT_OBSIDIAN_NOTE_PATH,
  DEFAULT_RESTRICTED_URLS
} from "../platform/defaults.js";
import { describePlatform, IS_SAFARI } from "../platform/runtime.js";
import { sanitizeRestrictedUrls } from "../platform/tabFilters.js";

const elements = {
  restrictedUrls: () => document.getElementById("restrictedUrls"),
  markdownFormat: () => document.getElementById("markdownFormat"),
  presetFormats: () => document.getElementById("presetFormats"),
  save: () => document.getElementById("save"),
  platformHint: () => document.querySelector("[data-platform-hint]"),
  obsidianVault: () => document.getElementById("obsidianVault"),
  obsidianNotePath: () => document.getElementById("obsidianNotePath")
};

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
    notePathInput.setCustomValidity("Note paths may only include letters, numbers, spaces, hyphens, slashes, dots, and {timestamp}.");
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

async function loadPreferences() {
  const stored = await browser.storage.sync.get([
    "restrictedUrls",
    "markdownFormat",
    "obsidianVault",
    "obsidianNotePath"
  ]);

  const restrictedUrls =
    Array.isArray(stored.restrictedUrls) && stored.restrictedUrls.length
      ? stored.restrictedUrls
      : DEFAULT_RESTRICTED_URLS;

  const markdownFormat =
    typeof stored.markdownFormat === "string" && stored.markdownFormat.trim().length > 0
      ? stored.markdownFormat
      : DEFAULT_MARKDOWN_FORMAT;

  elements.restrictedUrls().value = toMultilineValue(restrictedUrls);
  elements.markdownFormat().value = markdownFormat;

  const storedVault = typeof stored.obsidianVault === "string" ? stored.obsidianVault : "";
  const storedPath =
    typeof stored.obsidianNotePath === "string" && stored.obsidianNotePath.trim().length > 0
      ? sanitizeNotePathInput(stored.obsidianNotePath)
      : "";

  elements.obsidianVault().value = storedVault;
  elements.obsidianNotePath().value = storedPath;
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
    obsidianNotePath: obsidianPreferences.notePath
  });
}

function attachEvents() {
  elements.save().addEventListener("click", () => {
    savePreferences().catch((error) => {
      console.error("Failed to persist preferences", error);
    });
  });

  elements.presetFormats().addEventListener("change", (event) => {
    elements.markdownFormat().value = event.target.value;
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
  });
});
