export function createFrontmatterController({
  elements,
  state,
  defaults,
  setFrontmatterToggles,
  updateFrontmatterState,
  handleFrontmatterToggleChange,
  updateFrontmatterListsState,
  queueSave,
  updateTemplatePreview
}) {
  function bindEvents() {
    const frontmatterFieldsContainer = elements.frontmatterFieldsContainer();
    if (frontmatterFieldsContainer) {
      frontmatterFieldsContainer.addEventListener("input", (event) => {
        if (event.target?.dataset?.frontmatterField) {
          updateFrontmatterState();
        }
      });

      frontmatterFieldsContainer.addEventListener("focusout", (event) => {
        if (event.target?.dataset?.frontmatterField) {
          event.target.value = defaults.sanitizeFrontmatterInput(event.target.value);
          updateFrontmatterState();
        }
      });
    }

    const frontmatterTogglesContainer = elements.frontmatterTogglesContainer();
    if (frontmatterTogglesContainer) {
      frontmatterTogglesContainer.addEventListener("change", (event) => {
        if (event.target?.dataset?.frontmatterToggle) {
          handleFrontmatterToggleChange(event);
        }
      });
    }

    const titleTemplateInput = elements.frontmatterTitleTemplate();
    if (titleTemplateInput && typeof titleTemplateInput.addEventListener === "function") {
      titleTemplateInput.addEventListener("input", () => {
        state.frontmatterTitleTemplate = titleTemplateInput.value;
        queueSave({ silent: true });
        updateTemplatePreview();
      });
      titleTemplateInput.addEventListener("blur", () => {
        state.frontmatterTitleTemplate =
          titleTemplateInput.value.trim() || defaults.frontmatterTitleTemplate;
        titleTemplateInput.value = state.frontmatterTitleTemplate;
        queueSave({ silent: true });
        updateTemplatePreview();
      });
    }

    const tagsInput = elements.frontmatterTags();
    if (tagsInput && typeof tagsInput.addEventListener === "function") {
      tagsInput.addEventListener("input", () => {
        updateFrontmatterListsState({ sanitize: false });
      });
      tagsInput.addEventListener("blur", () => {
        updateFrontmatterListsState({ sanitize: true });
      });
    }

    const collectionsInput = elements.frontmatterCollections();
    if (collectionsInput && typeof collectionsInput.addEventListener === "function") {
      collectionsInput.addEventListener("input", () => {
        updateFrontmatterListsState({ sanitize: false });
      });
      collectionsInput.addEventListener("blur", () => {
        updateFrontmatterListsState({ sanitize: true });
      });
    }

    setFrontmatterToggles(state.frontmatterEnabled);
  }

  return {
    bindEvents
  };
}
