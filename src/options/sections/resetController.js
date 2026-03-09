export function createResetController({
  elements,
  state,
  defaults,
  generalController,
  setFrontmatterInputs,
  setFrontmatterToggles,
  setFrontmatterTemplateInputs,
  updateTemplatePreview,
  persistCustomPresets,
  refreshPresetPicker,
  toMultilineValue,
  queueSave,
  setStatusMessage
}) {
  function resetPropertyPreferences(options = {}) {
    const { silent = false } = options;
    setFrontmatterInputs(defaults.frontmatterFields);
    setFrontmatterToggles(defaults.frontmatterEnabledFields);
    state.frontmatterFields = { ...defaults.frontmatterFields };
    state.frontmatterValidation = { hasErrors: false, messages: [] };
    setFrontmatterTemplateInputs({
      titleTemplate: defaults.frontmatterTitleTemplate,
      tagTemplates: defaults.frontmatterTagTemplates,
      collectionTemplates: defaults.frontmatterCollectionTemplates
    });
    state.frontmatterListValidation = { hasErrors: false, messages: [] };
    updateTemplatePreview();
    if (!silent) {
      setStatusMessage("Properties reset.", "success");
    }
    queueSave({ silent });
  }

  function resetTemplatePreferences(options = {}) {
    const { silent = false } = options;
    elements.markdownFormat().value = defaults.markdownFormat;
    state.customPresets = [];
    state.selectedPresetId = "builtin:default";
    persistCustomPresets().catch((error) => {
      console.error("Failed to clear presets during reset", error);
    });
    refreshPresetPicker(state.selectedPresetId);
    updateTemplatePreview();
    const presetNameInput = elements.presetName();
    if (presetNameInput) {
      presetNameInput.value = "";
    }
    if (!silent) {
      setStatusMessage("Templates reset.", "success");
    }
    queueSave({ silent });
  }

  function resetRestrictedPreferences(options = {}) {
    const { silent = false } = options;
    elements.restrictedUrls().value = toMultilineValue(defaults.restrictedUrls);
    if (!silent) {
      setStatusMessage("Restricted URLs reset.", "success");
    }
    queueSave({ silent });
  }

  function resetAllPreferences() {
    generalController.resetGeneralPreferences({ silent: true });
    resetPropertyPreferences({ silent: true });
    resetTemplatePreferences({ silent: true });
    resetRestrictedPreferences({ silent: true });
    queueSave();
    setStatusMessage("All settings restored to defaults.", "success");
  }

  function bindEvents() {
    const propertyReset = elements.resetProperties();
    if (propertyReset) {
      propertyReset.addEventListener("click", () => {
        resetPropertyPreferences();
      });
    }

    const templateReset = elements.resetTemplates();
    if (templateReset) {
      templateReset.addEventListener("click", () => {
        resetTemplatePreferences();
      });
    }

    const restrictedReset = elements.resetRestricted();
    if (restrictedReset) {
      restrictedReset.addEventListener("click", () => {
        resetRestrictedPreferences();
      });
    }

    const resetAllButton = elements.resetAll();
    if (resetAllButton) {
      resetAllButton.addEventListener("click", () => {
        resetAllPreferences();
      });
    }
  }

  return {
    bindEvents,
    resetAllPreferences,
    resetPropertyPreferences,
    resetTemplatePreferences,
    resetRestrictedPreferences
  };
}
