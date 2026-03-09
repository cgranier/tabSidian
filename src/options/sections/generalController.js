export function createGeneralController({
  elements,
  state,
  defaults,
  resetGeneralSettingsInputs,
  resetValidity,
  sanitizeFormatInput,
  updateTemplatePreview,
  queueSave,
  setStatusMessage
}) {
  function resetGeneralPreferences(options = {}) {
    const { silent = false } = options;
    const dateFormatInput = elements.timestampDateFormat();
    const timeFormatInput = elements.timestampTimeFormat();
    const globalDefaultFolderInput = elements.globalDefaultFolder();
    const globalDefaultFilenameInput = elements.globalDefaultFilename();
    const nextDefaults = resetGeneralSettingsInputs({
      dateInput: dateFormatInput,
      timeInput: timeFormatInput,
      folderInput: globalDefaultFolderInput,
      filenameInput: globalDefaultFilenameInput
    });
    state.timestampFormats = nextDefaults.timestampFormats;
    state.saveTargetDefaults = nextDefaults.saveTargetDefaults;
    resetValidity(dateFormatInput, timeFormatInput, globalDefaultFolderInput, globalDefaultFilenameInput);
    if (!silent) {
      setStatusMessage("General settings reset.", "success");
    }
    queueSave({ silent });
  }

  function bindEvents() {
    const dateFormatInput = elements.timestampDateFormat();
    if (dateFormatInput) {
      dateFormatInput.addEventListener("input", () => {
        const value =
          dateFormatInput.value && dateFormatInput.value.trim().length > 0
            ? dateFormatInput.value.trim()
            : defaults.exportDateFormat;
        state.timestampFormats.dateFormat = value;
        updateTemplatePreview();
        queueSave({ silent: true });
      });
      dateFormatInput.addEventListener("blur", () => {
        const value = sanitizeFormatInput(dateFormatInput.value, defaults.exportDateFormat);
        dateFormatInput.value = value;
        state.timestampFormats.dateFormat = value;
        updateTemplatePreview();
        queueSave();
      });
    }

    const timeFormatInput = elements.timestampTimeFormat();
    if (timeFormatInput) {
      timeFormatInput.addEventListener("input", () => {
        const value =
          timeFormatInput.value && timeFormatInput.value.trim().length > 0
            ? timeFormatInput.value.trim()
            : defaults.exportTimeFormat;
        state.timestampFormats.timeFormat = value;
        updateTemplatePreview();
        queueSave({ silent: true });
      });
      timeFormatInput.addEventListener("blur", () => {
        const value = sanitizeFormatInput(timeFormatInput.value, defaults.exportTimeFormat);
        timeFormatInput.value = value;
        state.timestampFormats.timeFormat = value;
        updateTemplatePreview();
        queueSave();
      });
    }

    const globalDefaultFolderInput = elements.globalDefaultFolder();
    if (globalDefaultFolderInput) {
      globalDefaultFolderInput.addEventListener("input", () => {
        state.saveTargetDefaults.folder = globalDefaultFolderInput.value.trim();
        queueSave({ silent: true });
      });
      globalDefaultFolderInput.addEventListener("blur", () => {
        globalDefaultFolderInput.value = globalDefaultFolderInput.value.trim();
        state.saveTargetDefaults.folder = globalDefaultFolderInput.value;
        queueSave();
      });
    }

    const globalDefaultFilenameInput = elements.globalDefaultFilename();
    if (globalDefaultFilenameInput) {
      globalDefaultFilenameInput.addEventListener("input", () => {
        state.saveTargetDefaults.filenamePattern =
          globalDefaultFilenameInput.value.trim() || defaults.globalTargetFilename;
        queueSave({ silent: true });
      });
      globalDefaultFilenameInput.addEventListener("blur", () => {
        const value = globalDefaultFilenameInput.value.trim() || defaults.globalTargetFilename;
        globalDefaultFilenameInput.value = value;
        state.saveTargetDefaults.filenamePattern = value;
        queueSave();
      });
    }

    const generalReset = elements.resetGeneral();
    if (generalReset) {
      generalReset.addEventListener("click", () => {
        resetGeneralPreferences();
      });
    }
  }

  return {
    bindEvents,
    resetGeneralPreferences
  };
}
