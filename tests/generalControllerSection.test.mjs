import test from "node:test";
import assert from "node:assert/strict";
import { createGeneralController } from "../src/options/sections/generalController.js";

function createInput(initial = "") {
  const handlers = new Map();
  return {
    value: initial,
    addEventListener(event, handler) {
      handlers.set(event, handler);
    },
    emit(event) {
      const handler = handlers.get(event);
      if (handler) {
        handler();
      }
    }
  };
}

test("bindEvents updates timestamp/save-target state with fallbacks", () => {
  const dateInput = createInput("");
  const timeInput = createInput("");
  const folderInput = createInput(" Notes ");
  const filenameInput = createInput("   ");

  const state = {
    timestampFormats: { dateFormat: "", timeFormat: "" },
    saveTargetDefaults: { folder: "", filenamePattern: "" }
  };
  const queueCalls = [];
  let previewCalls = 0;

  const controller = createGeneralController({
    elements: {
      timestampDateFormat: () => dateInput,
      timestampTimeFormat: () => timeInput,
      globalDefaultFolder: () => folderInput,
      globalDefaultFilename: () => filenameInput,
      resetGeneral: () => null
    },
    state,
    defaults: {
      exportDateFormat: "YYYY-MM-DD",
      exportTimeFormat: "HH:mm",
      globalTargetFilename: "Tabs - {{date}}"
    },
    resetGeneralSettingsInputs: () => ({
      timestampFormats: { dateFormat: "YYYY-MM-DD", timeFormat: "HH:mm" },
      saveTargetDefaults: { folder: "tabSidian", filenamePattern: "Tabs - {{date}}" }
    }),
    resetValidity: () => {},
    sanitizeFormatInput: (value, fallback) => (value.trim().length > 0 ? value.trim() : fallback),
    updateTemplatePreview: () => {
      previewCalls += 1;
    },
    queueSave: (options) => queueCalls.push(options ?? {}),
    setStatusMessage: () => {}
  });

  controller.bindEvents();

  dateInput.emit("input");
  timeInput.emit("input");
  folderInput.emit("input");
  filenameInput.emit("input");
  dateInput.emit("blur");
  timeInput.emit("blur");
  folderInput.emit("blur");
  filenameInput.emit("blur");

  assert.equal(state.timestampFormats.dateFormat, "YYYY-MM-DD");
  assert.equal(state.timestampFormats.timeFormat, "HH:mm");
  assert.equal(state.saveTargetDefaults.folder, "Notes");
  assert.equal(state.saveTargetDefaults.filenamePattern, "Tabs - {{date}}");
  assert.equal(previewCalls >= 4, true);
  assert.equal(queueCalls.length >= 8, true);
});

test("resetGeneralPreferences applies defaults and status", () => {
  const dateInput = createInput("X");
  const timeInput = createInput("Y");
  const folderInput = createInput("A");
  const filenameInput = createInput("B");
  const state = {
    timestampFormats: { dateFormat: "", timeFormat: "" },
    saveTargetDefaults: { folder: "", filenamePattern: "" }
  };
  const statuses = [];

  const controller = createGeneralController({
    elements: {
      timestampDateFormat: () => dateInput,
      timestampTimeFormat: () => timeInput,
      globalDefaultFolder: () => folderInput,
      globalDefaultFilename: () => filenameInput,
      resetGeneral: () => null
    },
    state,
    defaults: {
      exportDateFormat: "YYYY-MM-DD",
      exportTimeFormat: "HH:mm",
      globalTargetFilename: "Tabs - {{date}}"
    },
    resetGeneralSettingsInputs: () => ({
      timestampFormats: { dateFormat: "YYYY-MM-DD", timeFormat: "HH:mm" },
      saveTargetDefaults: { folder: "tabSidian", filenamePattern: "Tabs - {{date}}" }
    }),
    resetValidity: () => {},
    sanitizeFormatInput: (value, fallback) => (value.trim().length > 0 ? value.trim() : fallback),
    updateTemplatePreview: () => {},
    queueSave: () => {},
    setStatusMessage: (message, type) => statuses.push({ message, type })
  });

  controller.resetGeneralPreferences();
  assert.equal(state.timestampFormats.dateFormat, "YYYY-MM-DD");
  assert.equal(state.saveTargetDefaults.folder, "tabSidian");
  assert.equal(statuses.at(-1)?.message, "General settings reset.");
});
