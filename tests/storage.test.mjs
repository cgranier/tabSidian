import test from "node:test";
import assert from "node:assert/strict";
import { resolveSaveTarget } from "../src/platform/saveTarget.js";

test("resolveSaveTarget prefers template routing values", () => {
  const result = resolveSaveTarget(
    {
      targetVault: "WorkVault",
      targetFolder: "Projects/Research",
      filenamePattern: "Work Tabs - {{date}}"
    },
    "DefaultVault",
    "Inbox"
  );

  assert.equal(result.vault, "WorkVault");
  assert.equal(result.folder, "Projects/Research");
  assert.equal(result.filename, "Work Tabs - {{date}}");
});

test("resolveSaveTarget falls back to global defaults when template omits routing", () => {
  const result = resolveSaveTarget(
    {
      targetVault: "",
      targetFolder: "",
      filenamePattern: ""
    },
    "PersonalVault",
    "Clippings"
  );

  assert.equal(result.vault, "PersonalVault");
  assert.equal(result.folder, "Clippings");
  assert.equal(result.filename, "Tabs - {{date}}");
});

test("resolveSaveTarget uses provided global default filename when present", () => {
  const result = resolveSaveTarget(
    {
      targetVault: "",
      targetFolder: "",
      filenamePattern: ""
    },
    "PersonalVault",
    "Clippings",
    "Session - {{date}}"
  );

  assert.equal(result.vault, "PersonalVault");
  assert.equal(result.folder, "Clippings");
  assert.equal(result.filename, "Session - {{date}}");
});
