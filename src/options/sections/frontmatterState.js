export function createFrontmatterStateApi({
  elements,
  state,
  frontmatterFieldKeys,
  defaults,
  resolveFrontmatterFields,
  resolveFrontmatterEnabled,
  renderFrontmatterFields,
  renderFrontmatterToggleInputs,
  sanitizeFrontmatterInput,
  validateFrontmatterFieldName,
  parseTemplateMultiline,
  normalizeTemplateEntries,
  toTemplateMultiline,
  maxFrontmatterListEntries,
  queueSave,
  updateTemplatePreview,
  cancelPendingSave
}) {
  function isInput(node) {
    return Boolean(node && typeof node.value === "string" && typeof node.setCustomValidity === "function");
  }

  function renderFrontmatterSettings() {
    const container = elements.frontmatterFieldsContainer();
    if (!container) {
      return;
    }
    renderFrontmatterFields(container, state.frontmatterFields, state.frontmatterEnabled);
  }

  function renderFrontmatterToggles() {
    const container = elements.frontmatterTogglesContainer();
    if (!container) {
      return;
    }
    renderFrontmatterToggleInputs(container, state.frontmatterEnabled);
  }

  function updateFrontmatterFeedback() {
    const feedbackElement = elements.frontmatterFeedback();
    if (!feedbackElement) {
      return;
    }

    const { hasErrors, messages } = state.frontmatterValidation;
    feedbackElement.textContent = "";
    feedbackElement.classList.remove("is-error", "is-ok", "is-warning");

    if (hasErrors) {
      const uniqueMessages = [...new Set(messages)];
      feedbackElement.textContent = uniqueMessages.join(" · ");
      feedbackElement.classList.add("is-error");
    }
  }

  function setFrontmatterInputs(fieldMap = defaults.frontmatterFields) {
    const resolved = resolveFrontmatterFields(fieldMap);
    frontmatterFieldKeys.forEach((key) => {
      const input = document.querySelector(`[data-frontmatter-field="${key}"]`);
      if (isInput(input)) {
        input.value = resolved[key];
        input.setCustomValidity("");
      }
    });
    state.frontmatterFields = resolved;
    state.frontmatterValidation = {
      hasErrors: false,
      messages: []
    };
    updateFrontmatterFeedback();
  }

  function validateFrontmatterInputs() {
    const collected = {};
    const messages = [];
    let hasErrors = false;
    const seen = new Map();

    frontmatterFieldKeys.forEach((key) => {
      const input = document.querySelector(`[data-frontmatter-field="${key}"]`);
      if (!isInput(input)) {
        return;
      }

      const trimmed = sanitizeFrontmatterInput(input.value);
      input.value = trimmed;
      let message = validateFrontmatterFieldName(trimmed);

      if (!message) {
        const lower = trimmed.toLowerCase();
        if (seen.has(lower)) {
          message = `Duplicate field name (“${trimmed}”).`;
          const other = seen.get(lower);
          if (isInput(other)) {
            other.setCustomValidity(message);
          }
        } else {
          seen.set(lower, input);
          collected[key] = trimmed;
        }
      }

      if (message) {
        hasErrors = true;
        input.setCustomValidity(message);
        messages.push(message);
      } else {
        input.setCustomValidity("");
      }
    });

    const normalized = resolveFrontmatterFields(collected);
    return {
      hasErrors,
      messages,
      normalized
    };
  }

  function setFrontmatterToggles(flags = defaults.frontmatterEnabledFields) {
    const normalized = resolveFrontmatterEnabled(flags);
    elements.frontmatterToggles().forEach((toggle) => {
      if (!(toggle && "dataset" in toggle && "checked" in toggle)) {
        return;
      }
      const key = toggle.dataset.frontmatterToggle;
      if (!key) {
        return;
      }
      const isEnabled = normalized[key] !== false;
      toggle.checked = isEnabled;
    });
    state.frontmatterEnabled = normalized;
  }

  function handleFrontmatterToggleChange(event) {
    const toggle = event?.target ?? event?.currentTarget ?? null;
    if (!(toggle && "dataset" in toggle && "checked" in toggle)) {
      return;
    }
    const key = toggle.dataset.frontmatterToggle;
    if (!key) {
      return;
    }
    state.frontmatterEnabled = resolveFrontmatterEnabled({
      ...state.frontmatterEnabled,
      [key]: toggle.checked
    });
    updateTemplatePreview();
    queueSave({ silent: true });
  }

  function updateFrontmatterListFeedback() {
    const feedbackElement = elements.frontmatterListFeedback();
    if (!feedbackElement) {
      return;
    }

    const { hasErrors, messages } = state.frontmatterListValidation;
    feedbackElement.textContent = "";
    feedbackElement.classList.remove("is-error", "is-warning", "is-ok");

    if (messages.length > 0) {
      feedbackElement.textContent = [...new Set(messages)].join(" · ");
    }

    if (hasErrors) {
      feedbackElement.classList.add("is-error");
    } else if (messages.length > 0) {
      feedbackElement.classList.add("is-warning");
    }
  }

  function setFrontmatterTemplateInputs({
    titleTemplate = defaults.frontmatterTitleTemplate,
    tagTemplates = defaults.frontmatterTagTemplates,
    collectionTemplates = defaults.frontmatterCollectionTemplates
  } = {}) {
    const normalizedTitle =
      typeof titleTemplate === "string" && titleTemplate.trim().length > 0
        ? titleTemplate.trim()
        : defaults.frontmatterTitleTemplate;
    const normalizedTags = Array.isArray(tagTemplates)
      ? tagTemplates
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
      : [...defaults.frontmatterTagTemplates];
    const normalizedCollections = Array.isArray(collectionTemplates)
      ? collectionTemplates
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
      : [...defaults.frontmatterCollectionTemplates];

    const titleInput = elements.frontmatterTitleTemplate();
    if (isInput(titleInput)) {
      titleInput.value = normalizedTitle;
      titleInput.setCustomValidity("");
    }

    const tagsInput = elements.frontmatterTags();
    if (isInput(tagsInput)) {
      tagsInput.value = toTemplateMultiline(normalizedTags);
      tagsInput.setCustomValidity("");
    }

    const collectionsInput = elements.frontmatterCollections();
    if (isInput(collectionsInput)) {
      collectionsInput.value = toTemplateMultiline(normalizedCollections);
      collectionsInput.setCustomValidity("");
    }

    state.frontmatterTitleTemplate = normalizedTitle;
    state.frontmatterTagTemplates = [...normalizedTags];
    state.frontmatterCollectionTemplates = [...normalizedCollections];
    state.frontmatterListValidation = { hasErrors: false, messages: [] };
    updateFrontmatterListFeedback();
  }

  function validateFrontmatterTemplateLists({ sanitize = true } = {}) {
    const tagsInput = elements.frontmatterTags();
    const collectionsInput = elements.frontmatterCollections();
    const messages = [];
    let hasErrors = false;

    const parseAndNormalize = (input) => {
      if (!isInput(input)) {
        return [];
      }

      const entries = parseTemplateMultiline(input.value);
      if (!sanitize) {
        input.setCustomValidity("");
        return entries;
      }

      if (entries.length !== 0 || input.value.trim().length === 0) {
        input.value = toTemplateMultiline(entries);
      }
      const normalized = normalizeTemplateEntries(entries, maxFrontmatterListEntries);

      if (normalized.tooMany) {
        const message = `Use ${maxFrontmatterListEntries} or fewer entries.`;
        input.setCustomValidity(message);
        messages.push(message);
        hasErrors = true;
        input.value = toTemplateMultiline(normalized.entries);
        return normalized.entries;
      }

      input.setCustomValidity("");

      if (normalized.duplicates.length > 0) {
        messages.push(`Duplicates removed: ${normalized.duplicates.join(", ")}`);
      }

      if (normalized.duplicates.length > 0 || entries.length !== normalized.entries.length) {
        input.value = toTemplateMultiline(normalized.entries);
      }

      return normalized.entries;
    };

    const tagTemplates = parseAndNormalize(tagsInput);
    const collectionTemplates = parseAndNormalize(collectionsInput);

    state.frontmatterTagTemplates = [...tagTemplates];
    state.frontmatterCollectionTemplates = [...collectionTemplates];
    state.frontmatterListValidation = sanitize ? { hasErrors, messages } : { hasErrors: false, messages: [] };
    updateFrontmatterListFeedback();

    return { hasErrors };
  }

  function updateFrontmatterListsState({ sanitize = true } = {}) {
    const result = validateFrontmatterTemplateLists({ sanitize });
    if (sanitize && result.hasErrors) {
      cancelPendingSave();
      return;
    }
    if (sanitize && state.preferencesReady) {
      queueSave({ silent: true });
    }
    updateTemplatePreview();
  }

  function updateFrontmatterState() {
    const result = validateFrontmatterInputs();
    state.frontmatterValidation = {
      hasErrors: result.hasErrors,
      messages: result.messages
    };
    if (!result.hasErrors) {
      state.frontmatterFields = result.normalized;
    }
    updateFrontmatterFeedback();
    if (state.frontmatterValidation.hasErrors) {
      cancelPendingSave();
    } else {
      queueSave({ silent: true });
    }
    updateTemplatePreview();
  }

  return {
    renderFrontmatterSettings,
    renderFrontmatterToggles,
    setFrontmatterInputs,
    validateFrontmatterInputs,
    updateFrontmatterFeedback,
    setFrontmatterToggles,
    handleFrontmatterToggleChange,
    updateFrontmatterListsState,
    updateFrontmatterListFeedback,
    setFrontmatterTemplateInputs,
    validateFrontmatterTemplateLists,
    updateFrontmatterState
  };
}
