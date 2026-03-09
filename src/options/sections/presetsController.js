export function createPresetsController({
  elements,
  state,
  normalizeCustomPreset,
  persistCustomPresets,
  refreshPresetPicker,
  queueSave,
  setStatusMessage
}) {
  async function importCustomPresetsFromFileList(fileList) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    let imported = 0;
    let skipped = 0;

    for (const file of fileList) {
      try {
        const contents = await file.text();
        const parsed = JSON.parse(contents);
        const presets = Array.isArray(parsed) ? parsed : parsed?.presets;
        if (!Array.isArray(presets)) {
          skipped += 1;
          continue;
        }

        presets.forEach((candidate) => {
          const preset = normalizeCustomPreset(candidate);
          if (!preset) {
            skipped += 1;
            return;
          }

          const existingIndex = state.customPresets.findIndex(
            (entry) => entry.id === preset.id || entry.name.toLowerCase() === preset.name.toLowerCase()
          );

          if (existingIndex !== -1) {
            state.customPresets[existingIndex] = {
              ...state.customPresets[existingIndex],
              ...preset
            };
          } else {
            state.customPresets.push(preset);
          }

          imported += 1;
        });
      } catch (error) {
        console.error("Failed to import presets", error);
        skipped += 1;
      }
    }

    if (imported > 0) {
      await persistCustomPresets();
      refreshPresetPicker();
      setStatusMessage(
        `${imported} preset${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} skipped.` : "."}`,
        "success"
      );
      queueSave();
    } else {
      setStatusMessage("No presets were imported. Check the file format and try again.", "error");
    }
  }

  function exportCustomPresets() {
    if (!state.customPresets.length) {
      setStatusMessage("There are no custom presets to export yet.", "error");
      return;
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      presets: state.customPresets
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tabsidian-presets.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMessage("Custom presets exported.", "success");
  }

  function bindEvents() {
    const importButton = elements.importPresets();
    const importInput = elements.presetImportInput();
    const exportButton = elements.exportPresets();

    if (importButton && importInput) {
      importButton.addEventListener("click", () => {
        importInput.value = "";
        importInput.click();
      });
    }

    if (importInput) {
      importInput.addEventListener("change", (event) => {
        importCustomPresetsFromFileList(event.target.files).catch((error) => {
          console.error("Preset import failed", error);
          setStatusMessage("Preset import failed. See console for details.", "error");
        });
      });
    }

    if (exportButton) {
      exportButton.addEventListener("click", () => {
        exportCustomPresets();
      });
    }
  }

  return {
    bindEvents,
    importCustomPresetsFromFileList,
    exportCustomPresets
  };
}
