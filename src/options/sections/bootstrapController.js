export function createBootstrapController({
  initializeSectionNavigation,
  attachEvents,
  renderPlatformHint,
  renderExtensionVersion,
  preferencesController,
  vaultController,
  templateEditorController,
  restrictedController,
  presetsController,
  state,
  setStatusMessage
}) {
  async function start() {
    initializeSectionNavigation().catch((error) => {
      console.error("Unable to set up section navigation", error);
    });
    attachEvents();
    renderPlatformHint();
    renderExtensionVersion();

    Promise.all([preferencesController.loadPreferences(), vaultController.loadVaults()])
      .then(() => {
        state.preferencesReady = true;

        vaultController.bindEvents();
        templateEditorController.bindEvents();
        restrictedController.bindEvents();
        presetsController.bindEvents();

        templateEditorController.renderTemplateList();
        templateEditorController.loadTemplate(state.selectedPresetId);
      })
      .catch((error) => {
        console.error("Unable to load stored preferences", error);
        setStatusMessage("Unable to load stored preferences.", "error");
      });
  }

  return {
    start
  };
}
