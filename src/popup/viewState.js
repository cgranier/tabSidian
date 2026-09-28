export function getSaveActionLabel(selectedVault) {
  return selectedVault ? "Add to Obsidian" : "Download Markdown";
}

export function applyResolvedTargetWithOverrides(currentValues, resolvedTarget, manualOverrides) {
  const values = {
    vault: currentValues?.vault ?? "",
    folder: currentValues?.folder ?? "",
    filename: currentValues?.filename ?? ""
  };

  if (!manualOverrides?.vault) {
    values.vault = resolvedTarget?.vault ?? "";
  }
  if (!manualOverrides?.folder) {
    values.folder = resolvedTarget?.folder ?? "";
  }
  if (!manualOverrides?.filename) {
    values.filename = resolvedTarget?.filename ?? "";
  }

  return values;
}

export function getPreviewToggleView(previewCollapsed) {
  return {
    buttonLabel: previewCollapsed ? "Show" : "Hide",
    ariaExpanded: previewCollapsed ? "false" : "true",
    previewCollapsedClass: Boolean(previewCollapsed)
  };
}

export function getKeyboardAction(event, isSaveDisabled = false) {
  if (!event || typeof event.key !== "string") {
    return null;
  }

  const isSubmitShortcut = (Boolean(event.ctrlKey) || Boolean(event.metaKey)) && event.key === "Enter";
  if (isSubmitShortcut) {
    return isSaveDisabled ? null : "save";
  }

  if (event.key === "Escape") {
    return "close";
  }

  return null;
}

export function getPrepareFailureMessage(prepared) {
  if (!prepared || prepared.ok === false) {
    return prepared?.error || "Unable to save tabs. Check extension logs.";
  }
  if (prepared.status === "no_tabs") {
    return prepared.restrictedActiveTab
      ? "Browser system pages can’t be captured. Switch to a website tab and try again."
      : "There are no savable tabs in this window.";
  }
  if (prepared.status === "invalid") {
    return "Export aborted: the selected template produced an empty note.";
  }
  if (prepared.status !== "ready" || typeof prepared.markdown !== "string") {
    return "Unable to save tabs. Check extension logs.";
  }
  return "";
}

export function getObsidianFallbackMessage(result) {
  if (result?.reason === "clipboard_unavailable" || result?.reason === "clipboard_write_failed") {
    return "Too many tabs to send to Obsidian directly and the clipboard was unavailable, so a Markdown download was offered instead.";
  }
  return "Couldn’t open Obsidian, so a Markdown download was offered instead.";
}
