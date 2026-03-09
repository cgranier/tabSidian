import test from "node:test";
import assert from "node:assert/strict";
import { createFrontmatterStateApi } from "../src/options/sections/frontmatterState.js";

function makeInput(value = "") {
  return {
    value,
    dataset: {},
    validationMessage: "",
    setCustomValidity(message) {
      this.validationMessage = message;
    }
  };
}

function makeClassList() {
  const set = new Set();
  return {
    add(name) {
      set.add(name);
    },
    remove(...names) {
      names.forEach((name) => set.delete(name));
    },
    has(name) {
      return set.has(name);
    }
  };
}

test("validateFrontmatterInputs reports duplicates", () => {
  const titleInput = makeInput("title");
  const sourceInput = makeInput("Title");
  const selectorMap = new Map([
    ['[data-frontmatter-field="title"]', titleInput],
    ['[data-frontmatter-field="source"]', sourceInput]
  ]);
  globalThis.document = {
    querySelector(selector) {
      return selectorMap.get(selector) ?? null;
    }
  };

  const feedback = { textContent: "", classList: makeClassList() };
  const state = {
    frontmatterFields: { title: "title", source: "source" },
    frontmatterEnabled: { title: true, source: true },
    frontmatterValidation: { hasErrors: false, messages: [] },
    frontmatterListValidation: { hasErrors: false, messages: [] },
    frontmatterTagTemplates: [],
    frontmatterCollectionTemplates: [],
    preferencesReady: true
  };

  const api = createFrontmatterStateApi({
    elements: {
      frontmatterFieldsContainer: () => ({}),
      frontmatterTogglesContainer: () => ({}),
      frontmatterFeedback: () => feedback,
      frontmatterListFeedback: () => ({ textContent: "", classList: makeClassList() }),
      frontmatterToggles: () => [],
      frontmatterTags: () => makeInput(""),
      frontmatterCollections: () => makeInput(""),
      frontmatterTitleTemplate: () => makeInput("")
    },
    state,
    frontmatterFieldKeys: ["title", "source"],
    defaults: {
      frontmatterFields: { title: "title", source: "source" },
      frontmatterEnabledFields: { title: true, source: true },
      frontmatterTitleTemplate: "{{title}}",
      frontmatterTagTemplates: [],
      frontmatterCollectionTemplates: []
    },
    resolveFrontmatterFields: (fields) => ({ title: fields.title ?? "title", source: fields.source ?? "source" }),
    resolveFrontmatterEnabled: (value) => value,
    renderFrontmatterFields: () => {},
    renderFrontmatterToggleInputs: () => {},
    sanitizeFrontmatterInput: (value) => value.trim(),
    validateFrontmatterFieldName: () => "",
    parseTemplateMultiline: () => [],
    normalizeTemplateEntries: (entries) => ({ entries, duplicates: [], tooMany: false }),
    toTemplateMultiline: (entries) => entries.join("\n"),
    maxFrontmatterListEntries: 5,
    queueSave: () => {},
    updateTemplatePreview: () => {},
    cancelPendingSave: () => {}
  });

  const result = api.validateFrontmatterInputs();
  assert.equal(result.hasErrors, true);
  assert.equal(result.messages.length, 1);
  assert.equal(sourceInput.validationMessage.includes("Duplicate field name"), true);
});

test("validateFrontmatterTemplateLists enforces max entries", () => {
  const tagsInput = makeInput("a\nb\nc");
  const collectionsInput = makeInput("");
  const state = {
    frontmatterFields: { title: "title" },
    frontmatterEnabled: { title: true },
    frontmatterValidation: { hasErrors: false, messages: [] },
    frontmatterListValidation: { hasErrors: false, messages: [] },
    frontmatterTagTemplates: [],
    frontmatterCollectionTemplates: [],
    preferencesReady: true
  };

  const api = createFrontmatterStateApi({
    elements: {
      frontmatterFieldsContainer: () => ({}),
      frontmatterTogglesContainer: () => ({}),
      frontmatterFeedback: () => ({ textContent: "", classList: makeClassList() }),
      frontmatterListFeedback: () => ({ textContent: "", classList: makeClassList() }),
      frontmatterToggles: () => [],
      frontmatterTags: () => tagsInput,
      frontmatterCollections: () => collectionsInput,
      frontmatterTitleTemplate: () => makeInput("")
    },
    state,
    frontmatterFieldKeys: ["title"],
    defaults: {
      frontmatterFields: { title: "title" },
      frontmatterEnabledFields: { title: true },
      frontmatterTitleTemplate: "{{title}}",
      frontmatterTagTemplates: [],
      frontmatterCollectionTemplates: []
    },
    resolveFrontmatterFields: (fields) => fields,
    resolveFrontmatterEnabled: (value) => value,
    renderFrontmatterFields: () => {},
    renderFrontmatterToggleInputs: () => {},
    sanitizeFrontmatterInput: (value) => value.trim(),
    validateFrontmatterFieldName: () => "",
    parseTemplateMultiline: (value) => value.split("\n").filter(Boolean),
    normalizeTemplateEntries: (entries, max) => ({
      entries: entries.slice(0, max),
      duplicates: [],
      tooMany: entries.length > max
    }),
    toTemplateMultiline: (entries) => entries.join("\n"),
    maxFrontmatterListEntries: 2,
    queueSave: () => {},
    updateTemplatePreview: () => {},
    cancelPendingSave: () => {}
  });

  const result = api.validateFrontmatterTemplateLists({ sanitize: true });
  assert.equal(result.hasErrors, true);
  assert.equal(tagsInput.validationMessage.includes("Use 2 or fewer entries."), true);
});
