import { emitMetric } from "./metrics.js";

// Writes text to the clipboard from the calling extension context (popup or background page).
// The active web page is never involved, so page copy handlers cannot alter the export (#16).
export async function writeClipboardText(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) {
    return { success: false, reason: "clipboard_unavailable" };
  }

  try {
    await clipboard.writeText(text);
    return { success: true, method: "extension_clipboard" };
  } catch (error) {
    console.warn("tabSidian extension clipboard write failed", error);
    return { success: false, reason: "clipboard_write_failed", message: error?.message ?? String(error) };
  }
}

// Sends a prepared export to Obsidian using a plan from `planObsidianExport`.
// `launch` hands the URI to the browser; `writeClipboard` is only used for clipboard-mode plans.
export async function sendExportToObsidian({ markdown, plan, launch, writeClipboard = writeClipboardText }) {
  if (!plan?.url || typeof launch !== "function") {
    return { success: false, reason: "no_plan" };
  }

  if (plan.mode === "clipboard") {
    const clipboardResult = await writeClipboard(markdown);
    emitMetric("obsidian_clipboard_copy", {
      status: clipboardResult?.success ? "success" : "failed",
      method: clipboardResult?.method,
      reason: clipboardResult?.success ? undefined : clipboardResult?.reason
    });
    if (!clipboardResult?.success) {
      return { success: false, mode: plan.mode, reason: clipboardResult?.reason ?? "clipboard_write_failed" };
    }
  }

  const launchResult = await launch(plan.url);
  if (launchResult?.success) {
    emitMetric("obsidian_export_success", {
      notePath: plan.notePath,
      mode: plan.mode,
      transport: launchResult.transport
    });
    return { success: true, mode: plan.mode, transport: launchResult.transport };
  }

  emitMetric("obsidian_export_failed", {
    notePath: plan.notePath,
    mode: plan.mode,
    reason: launchResult?.reason ?? "navigation_failed"
  });
  return { success: false, mode: plan.mode, reason: launchResult?.reason ?? "navigation_failed" };
}
