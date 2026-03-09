export function createTemplateEditorController({
  elements,
  state,
  getAllPresets,
  getPresetById,
  createCustomTemplateId,
  createDraftCustomTemplate,
  upsertCustomTemplatePresets,
  removeCustomTemplatePresetById,
  applyTemplateToEditorForm,
  renderTemplateSidebarItems,
  persistCustomPresets,
  updateTemplatePreview,
  setStatusMessage,
  defaultMarkdownFormat
}) {
  function renderTemplateList() {
    const list = elements.templateList();
    if (!list) {
      return;
    }

    renderTemplateSidebarItems(list, getAllPresets(), state.selectedPresetId, loadTemplate);
  }

  function loadTemplate(id) {
    const preset = getPresetById(id);
    if (!preset) return;

    state.selectedPresetId = id;

    const nameInput = elements.templateName();
    const filenameInput = elements.templateFilename();
    const folderInput = elements.templateFolder();
    const vaultSelect = elements.templateVault();
    const contentInput = elements.templateContent();

    applyTemplateToEditorForm(
      { nameInput, filenameInput, folderInput, vaultSelect, contentInput },
      preset,
      state.vaults
    );

    renderTemplateList();
    updateTemplatePreview();
  }

  async function saveCurrentTemplate() {
    const name = elements.templateName().value.trim();
    const template = elements.templateContent().value;
    const filenamePattern = elements.templateFilename().value.trim();
    const targetFolder = elements.templateFolder().value.trim();
    const targetVault = elements.templateVault().value;

    if (!name) {
      setStatusMessage("Template name is required.", "error");
      return;
    }

    const newPreset = {
      id: state.selectedPresetId.startsWith("custom:") ? state.selectedPresetId : createCustomTemplateId(),
      name,
      template,
      filenamePattern,
      targetFolder,
      targetVault,
      description: "Custom template"
    };

    const upsert = upsertCustomTemplatePresets(state.customPresets, newPreset);
    state.customPresets = upsert.presets;
    state.selectedPresetId = upsert.selectedId;

    await persistCustomPresets();

    renderTemplateList();
    setStatusMessage("Template saved.", "success");
  }

  async function createNewTemplate() {
    const newTemplate = createDraftCustomTemplate(defaultMarkdownFormat, createCustomTemplateId);
    state.customPresets.push(newTemplate);
    await persistCustomPresets();
    loadTemplate(newTemplate.id);
  }

  async function deleteTemplate() {
    if (!state.selectedPresetId.startsWith("custom:")) {
      setStatusMessage("Cannot delete built-in templates.", "error");
      return;
    }

    const removal = removeCustomTemplatePresetById(state.customPresets, state.selectedPresetId);
    if (removal.removed) {
      state.customPresets = removal.presets;
      await persistCustomPresets();
      loadTemplate("builtin:default");
      setStatusMessage("Template deleted.", "success");
    }
  }

  function bindEvents() {
    const createBtn = elements.createTemplateBtn();
    if (createBtn) createBtn.addEventListener("click", createNewTemplate);

    const saveBtn = elements.saveTemplateBtn();
    if (saveBtn) saveBtn.addEventListener("click", saveCurrentTemplate);

    const deleteBtn = elements.deleteTemplateBtn();
    if (deleteBtn) deleteBtn.addEventListener("click", deleteTemplate);
  }

  return {
    bindEvents,
    renderTemplateList,
    loadTemplate,
    saveCurrentTemplate,
    createNewTemplate,
    deleteTemplate
  };
}
