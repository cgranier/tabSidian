export function createRestrictedController({
  elements,
  parseMultiline,
  toMultilineValue,
  parseRestrictedUrlsImportText,
  createRestrictedUrlsBlob,
  sanitizeRestrictedUrls,
  queueSave,
  setStatusMessage
}) {
  async function importRestrictedUrlsFromFileList(fileList) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const [file] = fileList;
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const entries = parseRestrictedUrlsImportText(text);
      const sanitized = sanitizeRestrictedUrls(entries);
      elements.restrictedUrls().value = toMultilineValue(sanitized);
      setStatusMessage(`Imported ${sanitized.length} restricted entr${sanitized.length === 1 ? "y" : "ies"}.`, "success");
      queueSave();
    } catch (error) {
      console.error("Failed to import restricted URLs", error);
      setStatusMessage("Failed to import restricted URLs. See console for details.", "error");
    }
  }

  function exportRestrictedUrls() {
    const entries = parseMultiline(elements.restrictedUrls().value);
    if (entries.length === 0) {
      setStatusMessage("Restricted list is empty.", "error");
      return;
    }

    const blob = createRestrictedUrlsBlob(entries);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tabsidian-restricted-urls.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMessage("Restricted URLs exported.", "success");
  }

  function bindEvents() {
    const restrictedImportButton = elements.restrictedImport();
    if (restrictedImportButton) {
      restrictedImportButton.addEventListener("click", () => {
        const input = elements.restrictedImportInput();
        if (input) {
          input.value = "";
          input.click();
        }
      });
    }

    const restrictedImportInput = elements.restrictedImportInput();
    if (restrictedImportInput) {
      restrictedImportInput.addEventListener("change", (event) => {
        importRestrictedUrlsFromFileList(event.target.files).catch((error) => {
          console.error("Restricted URL import failed", error);
          setStatusMessage("Restricted URL import failed. See console for details.", "error");
        });
      });
    }

    const restrictedExportButton = elements.restrictedExport();
    if (restrictedExportButton) {
      restrictedExportButton.addEventListener("click", () => {
        exportRestrictedUrls();
      });
    }
  }

  return {
    bindEvents,
    importRestrictedUrlsFromFileList,
    exportRestrictedUrls
  };
}
