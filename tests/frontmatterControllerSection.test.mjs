import test from "node:test";
import assert from "node:assert/strict";
import { createFrontmatterController } from "../src/options/sections/frontmatterController.js";

function makeEventTarget() {
  const handlers = new Map();
  return {
    value: "",
    dataset: {},
    addEventListener(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      const handler = handlers.get(event);
      if (handler) {
        handler(payload);
      }
    }
  };
}

test("bindEvents wires field and list handlers", () => {
  const state = {
    frontmatterEnabled: { title: true },
    frontmatterTitleTemplate: "{{title}}"
  };
  let updateFrontmatterStateCalls = 0;
  let updatePreviewCalls = 0;
  const listSanitizeArgs = [];
  const queueSaveCalls = [];

  const fieldsContainer = makeEventTarget();
  const togglesContainer = makeEventTarget();
  const titleInput = makeEventTarget();
  const tagsInput = makeEventTarget();
  const collectionsInput = makeEventTarget();

  const controller = createFrontmatterController({
    elements: {
      frontmatterFieldsContainer: () => fieldsContainer,
      frontmatterTogglesContainer: () => togglesContainer,
      frontmatterTitleTemplate: () => titleInput,
      frontmatterTags: () => tagsInput,
      frontmatterCollections: () => collectionsInput
    },
    state,
    defaults: {
      frontmatterTitleTemplate: "{{title}}",
      sanitizeFrontmatterInput: (value) => value.trim()
    },
    setFrontmatterToggles: () => {},
    updateFrontmatterState: () => {
      updateFrontmatterStateCalls += 1;
    },
    handleFrontmatterToggleChange: () => {},
    updateFrontmatterListsState: (arg) => {
      listSanitizeArgs.push(arg);
    },
    queueSave: (arg) => {
      queueSaveCalls.push(arg);
    },
    updateTemplatePreview: () => {
      updatePreviewCalls += 1;
    }
  });

  controller.bindEvents();

  const fieldTarget = { dataset: { frontmatterField: "title" }, value: "  noteTitle  " };
  fieldsContainer.emit("input", { target: fieldTarget });
  fieldsContainer.emit("focusout", { target: fieldTarget });
  assert.equal(updateFrontmatterStateCalls, 2);
  assert.equal(fieldTarget.value, "noteTitle");

  titleInput.value = "  custom {{title}}  ";
  titleInput.emit("input");
  titleInput.emit("blur");
  assert.equal(state.frontmatterTitleTemplate, "custom {{title}}");
  assert.equal(updatePreviewCalls, 2);
  assert.equal(queueSaveCalls.length, 2);

  tagsInput.emit("input");
  tagsInput.emit("blur");
  collectionsInput.emit("input");
  collectionsInput.emit("blur");
  assert.deepEqual(listSanitizeArgs, [{ sanitize: false }, { sanitize: true }, { sanitize: false }, { sanitize: true }]);
});
