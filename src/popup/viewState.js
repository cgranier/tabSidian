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
