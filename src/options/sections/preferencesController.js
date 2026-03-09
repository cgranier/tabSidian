export function createPreferencesController({
  elements,
  state,
  constants,
  deps,
  setStatusMessage,
  queueSave,
  updateTemplatePreview
}) {
  async function loadPreferences() {
    await deps.ensureStorageMigration();
    const saveTargetDefaults = await deps.getSaveTargetDefaults();
    const stored = await deps.getStoredValues([
      "restrictedUrls",
      "markdownFormat",
      "frontmatterFieldNames",
      constants.storageKeys.TEMPLATES,
      constants.frontmatterTitleStorageKey,
      constants.frontmatterTagsStorageKey,
      constants.frontmatterCollectionsStorageKey,
      constants.frontmatterEnabledStorageKey,
      constants.timestampDateFormatStorageKey,
      constants.timestampTimeFormatStorageKey
    ]);

    const restrictedLoad = deps.resolveRestrictedUrlsOnLoad({
      storedRestrictedUrls: Array.isArray(stored.restrictedUrls)
        ? deps.sanitizeRestrictedUrls(stored.restrictedUrls)
        : stored.restrictedUrls,
      defaultRestrictedUrls: constants.defaultRestrictedUrls,
      legacyDefaultRestrictedUrls: constants.legacyDefaultRestrictedUrls
    });
    const restrictedUrls = restrictedLoad.restrictedUrls;

    const markdownFormat =
      typeof stored.markdownFormat === "string" && stored.markdownFormat.trim().length > 0
        ? stored.markdownFormat
        : constants.defaultMarkdownFormat;

    const rawPresets = Array.isArray(stored[constants.storageKeys.TEMPLATES]) ? stored[constants.storageKeys.TEMPLATES] : [];
    state.customPresets = rawPresets
      .map((candidate) => deps.normalizeCustomPreset(candidate))
      .filter((preset) => preset !== null);

    const matchedPreset = deps.findPresetMatchingTemplate(markdownFormat);
    state.selectedPresetId = matchedPreset ? matchedPreset.id : constants.currentTemplateOptionId;

    elements.restrictedUrls().value = deps.toMultilineValue(restrictedUrls);
    elements.markdownFormat().value = markdownFormat;
    const dateFormatInput = elements.timestampDateFormat();
    const timeFormatInput = elements.timestampTimeFormat();
    const storedDateFormatRaw =
      typeof stored[constants.timestampDateFormatStorageKey] === "string"
        ? stored[constants.timestampDateFormatStorageKey]
        : "";
    const storedTimeFormatRaw =
      typeof stored[constants.timestampTimeFormatStorageKey] === "string"
        ? stored[constants.timestampTimeFormatStorageKey]
        : "";
    const resolvedDateFormat = deps.sanitizeFormatInput(storedDateFormatRaw, constants.defaultExportDateFormat);
    const resolvedTimeFormat = deps.sanitizeFormatInput(storedTimeFormatRaw, constants.defaultExportTimeFormat);
    const globalDefaultFolderInput = elements.globalDefaultFolder();
    const globalDefaultFilenameInput = elements.globalDefaultFilename();
    state.saveTargetDefaults = {
      folder: (saveTargetDefaults.folder ?? "").trim(),
      filenamePattern:
        (saveTargetDefaults.filenamePattern ?? "").trim() || constants.defaultGlobalTargetFilename
    };
    state.timestampFormats = {
      dateFormat: resolvedDateFormat,
      timeFormat: resolvedTimeFormat
    };
    deps.applyGeneralSettingsToInputs(
      {
        dateInput: dateFormatInput,
        timeInput: timeFormatInput,
        folderInput: globalDefaultFolderInput,
        filenameInput: globalDefaultFilenameInput
      },
      {
        timestampFormats: state.timestampFormats,
        saveTargetDefaults: state.saveTargetDefaults
      }
    );

    deps.renderFrontmatterSettings();
    deps.renderFrontmatterToggles();
    deps.setFrontmatterInputs(stored.frontmatterFieldNames ?? constants.defaultFrontmatterFields);

    const storedTitleTemplate =
      typeof stored[constants.frontmatterTitleStorageKey] === "string"
        ? stored[constants.frontmatterTitleStorageKey]
        : constants.defaultFrontmatterTitleTemplate;
    const storedTagTemplates = Array.isArray(stored[constants.frontmatterTagsStorageKey])
      ? stored[constants.frontmatterTagsStorageKey].filter((entry) => typeof entry === "string")
      : constants.defaultFrontmatterTagTemplates;
    const storedCollectionTemplates = Array.isArray(stored[constants.frontmatterCollectionsStorageKey])
      ? stored[constants.frontmatterCollectionsStorageKey].filter((entry) => typeof entry === "string")
      : constants.defaultFrontmatterCollectionTemplates;
    const storedEnabledFields =
      stored && typeof stored[constants.frontmatterEnabledStorageKey] === "object"
        ? stored[constants.frontmatterEnabledStorageKey]
        : constants.defaultFrontmatterEnabledFields;

    deps.setFrontmatterTemplateInputs({
      titleTemplate: storedTitleTemplate,
      tagTemplates: storedTagTemplates,
      collectionTemplates: storedCollectionTemplates
    });
    deps.setFrontmatterToggles(storedEnabledFields);
    deps.validateFrontmatterTemplateLists();

    deps.refreshPresetPicker(state.selectedPresetId);
    if (matchedPreset) {
      const presetNameInput = elements.presetName();
      if (presetNameInput) {
        presetNameInput.value = matchedPreset.name;
      }
    }

    state.preferencesReady = true;
    updateTemplatePreview();
    setStatusMessage("");

    if (restrictedLoad.shouldPersistDefaults) {
      queueSave({ silent: true });
    }
  }

  async function savePreferences() {
    const restrictedUrls = deps.parseMultiline(elements.restrictedUrls().value);
    const markdownFormat = elements.markdownFormat().value || constants.defaultMarkdownFormat;

    const dateFormatInput = elements.timestampDateFormat();
    const timeFormatInput = elements.timestampTimeFormat();
    const globalDefaultFolderInput = elements.globalDefaultFolder();
    const globalDefaultFilenameInput = elements.globalDefaultFilename();
    const generalSettings = deps.readGeneralSettingsFromInputs({
      dateInput: dateFormatInput,
      timeInput: timeFormatInput,
      folderInput: globalDefaultFolderInput,
      filenameInput: globalDefaultFilenameInput
    });
    state.timestampFormats = generalSettings.timestampFormats;
    state.saveTargetDefaults = generalSettings.saveTargetDefaults;
    deps.applyGeneralSettingsToInputs(
      {
        dateInput: dateFormatInput,
        timeInput: timeFormatInput,
        folderInput: globalDefaultFolderInput,
        filenameInput: globalDefaultFilenameInput
      },
      generalSettings
    );

    await deps.setStoredValues({
      restrictedUrls,
      markdownFormat,
      frontmatterFieldNames: state.frontmatterFields,
      [constants.storageKeys.TEMPLATES]: state.customPresets,
      [constants.frontmatterTitleStorageKey]: state.frontmatterTitleTemplate,
      [constants.frontmatterTagsStorageKey]: state.frontmatterTagTemplates,
      [constants.frontmatterCollectionsStorageKey]: state.frontmatterCollectionTemplates,
      [constants.frontmatterEnabledStorageKey]: state.frontmatterEnabled,
      [constants.timestampDateFormatStorageKey]: state.timestampFormats.dateFormat,
      [constants.timestampTimeFormatStorageKey]: state.timestampFormats.timeFormat
    });
    await deps.saveSaveTargetDefaults(state.saveTargetDefaults);

    const wasSilent = state.pendingSilentSave;
    state.pendingSilentSave = false;
    if (!wasSilent) {
      setStatusMessage("Changes saved.", "success");
    }
  }

  return {
    loadPreferences,
    savePreferences
  };
}
