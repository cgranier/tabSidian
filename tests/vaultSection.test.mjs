import test from "node:test";
import assert from "node:assert/strict";
import { appendVault, buildVault, removeVaultAtIndex, setDefaultVaultByIndex } from "../src/options/sections/vaults.js";

test("buildVault normalizes names and returns null for empty values", () => {
  const vault = buildVault("  Work Vault  ");
  assert.equal(vault.name, "Work Vault");
  assert.equal(typeof vault.id, "string");
  assert.equal(buildVault("   "), null);
});

test("removeVaultAtIndex promotes first vault to default when needed", () => {
  const result = removeVaultAtIndex(
    [
      { id: "1", name: "A", isDefault: true },
      { id: "2", name: "B", isDefault: false }
    ],
    0
  );

  assert.equal(result.removed, true);
  assert.equal(result.vaults.length, 1);
  assert.equal(result.vaults[0].name, "B");
  assert.equal(result.vaults[0].isDefault, true);
});

test("setDefaultVaultByIndex moves selected vault to first position", () => {
  const result = setDefaultVaultByIndex(
    [
      { id: "1", name: "A", isDefault: true },
      { id: "2", name: "B", isDefault: false },
      { id: "3", name: "C", isDefault: false }
    ],
    2
  );

  assert.equal(result.changed, true);
  assert.deepEqual(
    result.vaults.map((vault) => ({ name: vault.name, isDefault: vault.isDefault })),
    [
      { name: "C", isDefault: true },
      { name: "A", isDefault: false },
      { name: "B", isDefault: false }
    ]
  );
});

test("appendVault appends non-null entries", () => {
  const seed = [{ id: "1", name: "A", isDefault: true }];
  const appended = appendVault(seed, { id: "2", name: "B", isDefault: false });
  assert.equal(appended.length, 2);
  assert.equal(seed.length, 1);
});

