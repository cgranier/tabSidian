import test from "node:test";
import assert from "node:assert/strict";
import { buildObsidianUrl, OBSIDIAN_NEW_SCHEME } from "../src/platform/obsidian.js";

test("buildObsidianUrl encodes spaces in vault and filepath", () => {
  const { url } = buildObsidianUrl({
    vault: "My Vault",
    filepath: "Research Notes/tab capture.md"
  });

  assert.ok(url.startsWith(`${OBSIDIAN_NEW_SCHEME}?`), "URL should start with obsidian scheme");
  assert.ok(url.includes("vault=My%20Vault"), "Vault name should encode spaces as %20");
  assert.ok(
    url.includes("file=Research%20Notes%2Ftab%20capture.md"),
    "File path should encode spaces and slashes"
  );
});

test("buildObsidianUrl avoids plus signs and preserves clipboard/content flags", () => {
  const { url } = buildObsidianUrl({
    vault: "Tab Vault",
    filepath: "Tab Path.md",
    clipboard: true,
    content: "Line 1\nLine 2"
  });

  assert.ok(url.includes("clipboard=true"), "Clipboard flag missing");
  assert.ok(url.includes("content=Line%201%0ALine%202"), "Content should be percent-encoded");
  assert.ok(!url.includes("+"), "URL should not contain plus signs for spaces");
});
