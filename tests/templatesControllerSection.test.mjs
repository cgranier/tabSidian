import test from "node:test";
import assert from "node:assert/strict";
import {
  findTemplatePresetById,
  findTemplatePresetByTemplate,
  listTemplatePresets
} from "../src/options/sections/templatesController.js";

test("listTemplatePresets concatenates built-in and custom presets", () => {
  const builtIns = [{ id: "builtin:default", name: "Default", template: "a" }];
  const customs = [{ id: "custom:1", name: "Work", template: "b" }];
  const all = listTemplatePresets(builtIns, customs);
  assert.deepEqual(all.map((preset) => preset.id), ["builtin:default", "custom:1"]);
});

test("findTemplatePresetById returns matching preset or null", () => {
  const presets = [
    { id: "builtin:default", template: "a" },
    { id: "custom:1", template: "b" }
  ];
  assert.equal(findTemplatePresetById(presets, "custom:1")?.id, "custom:1");
  assert.equal(findTemplatePresetById(presets, "missing"), null);
});

test("findTemplatePresetByTemplate matches by template content", () => {
  const presets = [
    { id: "builtin:default", template: "a" },
    { id: "custom:1", template: "b" }
  ];
  assert.equal(findTemplatePresetByTemplate(presets, "b")?.id, "custom:1");
  assert.equal(findTemplatePresetByTemplate(presets, "missing"), null);
});

