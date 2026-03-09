export function renderTemplateSidebarItems(container, presets, selectedId, onSelect) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  presets.forEach((preset) => {
    const item = document.createElement("div");
    item.className = "nav-item";
    if (preset.id === selectedId) {
      item.classList.add("active");
    }
    item.textContent = preset.name;
    item.onclick = () => onSelect(preset.id);
    container.appendChild(item);
  });
}

export function populateTemplateVaultSelect(select, vaults) {
  if (!select) {
    return;
  }

  select.innerHTML = '<option value="">Use Global Default</option>';
  vaults.forEach((vault) => {
    const option = document.createElement("option");
    option.value = vault.name;
    option.textContent = vault.name;
    select.appendChild(option);
  });
}

export function applyTemplateToEditorForm(
  {
    nameInput,
    filenameInput,
    folderInput,
    vaultSelect,
    contentInput
  },
  preset,
  vaults
) {
  if (nameInput) nameInput.value = preset.name;
  if (filenameInput) filenameInput.value = preset.filenamePattern || "";
  if (folderInput) folderInput.value = preset.targetFolder || "";
  if (vaultSelect) {
    populateTemplateVaultSelect(vaultSelect, vaults);
    vaultSelect.value = preset.targetVault || "";
  }
  if (contentInput) contentInput.value = preset.template;
}

