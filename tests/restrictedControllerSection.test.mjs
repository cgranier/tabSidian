import test from "node:test";
import assert from "node:assert/strict";
import { createRestrictedController } from "../src/options/sections/restrictedController.js";

function createHarness() {
  const status = [];
  const urlsField = { value: "" };
  let saveCalls = 0;

  const elements = {
    restrictedUrls: () => urlsField,
    restrictedImport: () => null,
    restrictedExport: () => null,
    restrictedImportInput: () => null
  };

  const controller = createRestrictedController({
    elements,
    parseMultiline: (value) =>
      value
        .split("\n")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    toMultilineValue: (values) => values.join("\n"),
    parseRestrictedUrlsImportText: (text) =>
      text
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    createRestrictedUrlsBlob: (entries) => new Blob([entries.join("\n")], { type: "text/plain" }),
    sanitizeRestrictedUrls: (entries) => entries.filter((entry) => !entry.startsWith(" ")),
    queueSave: () => {
      saveCalls += 1;
    },
    setStatusMessage: (message, type) => status.push({ message, type })
  });

  return { controller, urlsField, status, getSaveCalls: () => saveCalls };
}

test("importRestrictedUrlsFromFileList updates textarea and queues save", async () => {
  const { controller, urlsField, status, getSaveCalls } = createHarness();
  const file = {
    text: async () => "mail.google.com\noutlook.live.com\n"
  };

  await controller.importRestrictedUrlsFromFileList([file]);

  assert.equal(urlsField.value, "mail.google.com\noutlook.live.com");
  assert.equal(getSaveCalls(), 1);
  assert.equal(status.at(-1)?.type, "success");
});

test("exportRestrictedUrls shows error when list is empty", () => {
  const { controller, status } = createHarness();
  controller.exportRestrictedUrls();
  assert.equal(status.at(-1)?.message, "Restricted list is empty.");
  assert.equal(status.at(-1)?.type, "error");
});
