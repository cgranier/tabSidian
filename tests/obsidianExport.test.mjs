import test from "node:test";
import assert from "node:assert/strict";
import { sendExportToObsidian, writeClipboardText } from "../src/platform/obsidianExport.js";

const quiet = () => {
  const original = console.info;
  console.info = () => {};
  return () => {
    console.info = original;
  };
};

test("inline plans launch without touching the clipboard", async (t) => {
  t.after(quiet());
  const launched = [];
  let clipboardCalls = 0;
  const result = await sendExportToObsidian({
    markdown: "tabs",
    plan: { mode: "inline", url: "obsidian://new?content=tabs" },
    launch: async (url) => {
      launched.push(url);
      return { success: true, transport: "tab_update" };
    },
    writeClipboard: async () => {
      clipboardCalls += 1;
      return { success: true };
    }
  });

  assert.equal(result.success, true);
  assert.equal(clipboardCalls, 0);
  assert.deepEqual(launched, ["obsidian://new?content=tabs"]);
});

test("clipboard plans write the markdown before launching", async (t) => {
  t.after(quiet());
  const order = [];
  const result = await sendExportToObsidian({
    markdown: "big export",
    plan: { mode: "clipboard", url: "obsidian://new?clipboard=true" },
    launch: async () => {
      order.push("launch");
      return { success: true, transport: "new_tab" };
    },
    writeClipboard: async (text) => {
      order.push(`clipboard:${text}`);
      return { success: true, method: "extension_clipboard" };
    }
  });

  assert.equal(result.success, true);
  assert.deepEqual(order, ["clipboard:big export", "launch"]);
});

test("clipboard failures abort before Obsidian reads a stale clipboard", async (t) => {
  t.after(quiet());
  let launched = false;
  const result = await sendExportToObsidian({
    markdown: "big export",
    plan: { mode: "clipboard", url: "obsidian://new?clipboard=true" },
    launch: async () => {
      launched = true;
      return { success: true };
    },
    writeClipboard: async () => ({ success: false, reason: "clipboard_write_failed" })
  });

  assert.equal(launched, false);
  assert.equal(result.success, false);
  assert.equal(result.reason, "clipboard_write_failed");
});

test("launch failures are reported for the download fallback", async (t) => {
  t.after(quiet());
  const result = await sendExportToObsidian({
    markdown: "tabs",
    plan: { mode: "inline", url: "obsidian://new?content=tabs" },
    launch: async () => ({ success: false, reason: "tab_update_suppressed" })
  });

  assert.equal(result.success, false);
  assert.equal(result.reason, "tab_update_suppressed");
});

test("writeClipboardText reports unavailable and failing clipboards", async (t) => {
  const originalWarn = console.warn;
  console.warn = () => {};
  t.after(() => {
    console.warn = originalWarn;
  });

  assert.equal((await writeClipboardText("x", undefined)).reason, "clipboard_unavailable");
  const failing = { writeText: async () => { throw new Error("denied"); } };
  assert.equal((await writeClipboardText("x", failing)).reason, "clipboard_write_failed");
  const written = [];
  const ok = { writeText: async (text) => { written.push(text); } };
  assert.equal((await writeClipboardText("hello", ok)).success, true);
  assert.deepEqual(written, ["hello"]);
});
