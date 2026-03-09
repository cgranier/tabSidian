import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCustomTemplatePreset,
  upsertCustomTemplatePresets,
  removeCustomTemplatePresetById
} from "../src/options/sections/templates.js";

test("normalizeCustomTemplatePreset keeps routing fields", () => {
  const preset = normalizeCustomTemplatePreset(
    {
      id: "custom:1",
      name: "Work",
      template: "## {{title}}",
      filenamePattern: "Work - {{date}}",
      targetFolder: "Projects/Work",
      targetVault: "WorkVault"
    },
    () => "custom:generated"
  );

  assert.equal(preset.id, "custom:1");
  assert.equal(preset.targetVault, "WorkVault");
  assert.equal(preset.targetFolder, "Projects/Work");
  assert.equal(preset.filenamePattern, "Work - {{date}}");
});

test("upsertCustomTemplatePresets inserts and updates", () => {
  const first = { id: "custom:1", name: "A", template: "a" };
  const inserted = upsertCustomTemplatePresets([], first);
  assert.equal(inserted.created, true);
  assert.equal(inserted.presets.length, 1);

  const updated = upsertCustomTemplatePresets(inserted.presets, {
    id: "custom:1",
    name: "B",
    template: "b"
  });
  assert.equal(updated.created, false);
  assert.equal(updated.presets[0].name, "B");
});

test("removeCustomTemplatePresetById removes when present", () => {
  const result = removeCustomTemplatePresetById(
    [
      { id: "custom:1", name: "A", template: "a" },
      { id: "custom:2", name: "B", template: "b" }
    ],
    "custom:1"
  );

  assert.equal(result.removed, true);
  assert.deepEqual(result.presets.map((entry) => entry.id), ["custom:2"]);
});

