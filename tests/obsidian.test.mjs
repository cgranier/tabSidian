import test from "node:test";
import assert from "node:assert/strict";
import {
  buildObsidianUrl,
  OBSIDIAN_NEW_SCHEME,
  planObsidianExport,
  resolveMaxObsidianUriLength
} from "../src/platform/obsidian.js";

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

test("buildObsidianUrl percent-encodes content without plus signs", () => {
  const { url } = buildObsidianUrl({
    vault: "Tab Vault",
    filepath: "Tab Path.md",
    content: "Line 1\nLine 2"
  });

  assert.ok(url.includes("content=Line%201%0ALine%202"), "Content should be percent-encoded");
  assert.ok(!url.includes("clipboard="), "Content URIs must not request clipboard import");
  assert.ok(!url.includes("+"), "URL should not contain plus signs for spaces");
});

test("buildObsidianUrl emits clipboard flag when no content is supplied", () => {
  const { url } = buildObsidianUrl({ vault: "Tab Vault", filepath: "Tab Path.md", clipboard: true });
  assert.ok(url.includes("clipboard=true"), "Clipboard flag missing");
  assert.ok(!url.includes("content="), "Clipboard URIs must not carry content");
});

test("buildObsidianUrl refuses to combine clipboard=true with content (issue #33)", () => {
  assert.throws(
    () => buildObsidianUrl({ vault: "V", filepath: "a.md", clipboard: true, content: "tabs" }),
    /cannot combine clipboard=true with content/
  );
});

test("planObsidianExport sends content inline when the URI fits", () => {
  const markdown = "- [Example](https://example.com/)\n- [Second](https://example.org/a?b=c&d=e)";
  const plan = planObsidianExport({ vault: "Tab Vault", filepath: "Tabs/export.md", markdown, maxLength: 18000 });

  assert.equal(plan.mode, "inline");
  const params = new URL(plan.url).searchParams;
  assert.equal(params.get("content"), markdown, "content should round-trip exactly");
  assert.equal(params.get("clipboard"), null, "inline plans must not ask Obsidian to read the clipboard");
  assert.equal(params.get("vault"), "Tab Vault");
  assert.equal(params.get("file"), "Tabs/export.md");
  assert.ok(plan.totalLength <= 18000);
});

test("planObsidianExport switches to clipboard-only URI when content exceeds the limit", () => {
  const markdown = "- [Tab](https://example.com/)\n".repeat(2000);
  const plan = planObsidianExport({ vault: "V", filepath: "big.md", markdown, maxLength: 18000 });

  assert.equal(plan.mode, "clipboard");
  const params = new URL(plan.url).searchParams;
  assert.equal(params.get("clipboard"), "true");
  assert.equal(params.get("content"), null, "clipboard plans must not carry content");
  assert.ok(plan.inlineLength > 18000);
  assert.ok(plan.totalLength <= 18000);
});

test("resolveMaxObsidianUriLength keeps the Firefox ceiling higher", () => {
  assert.equal(resolveMaxObsidianUriLength({ isFirefox: true }), 60000);
  assert.equal(resolveMaxObsidianUriLength({ isFirefox: false }), 18000);
  assert.equal(resolveMaxObsidianUriLength(), 18000);
});
