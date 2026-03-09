export function createVaultController({
  elements,
  state,
  buildVault,
  appendVault,
  removeVaultAtIndex,
  setDefaultVaultByIndex,
  getVaults,
  saveVaults,
  populateVaultSelect,
  setStatusMessage
}) {
  function renderVaultList() {
    const list = elements.vaultList();
    if (!list) return;

    list.innerHTML = "";

    state.vaults.forEach((vault, index) => {
      const item = document.createElement("div");
      item.className = "vault-item flex-row flex-between";
      item.style.padding = "10px";
      item.style.border = "1px solid #eee";
      item.style.marginBottom = "5px";
      item.style.borderRadius = "4px";
      item.style.backgroundColor = index === 0 ? "#f9fafb" : "white";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = vault.name;
      if (index === 0) {
        nameSpan.style.fontWeight = "bold";
        nameSpan.textContent += " (Default)";
      }

      const actions = document.createElement("div");
      actions.className = "flex-row";

      if (index > 0) {
        const makeDefaultBtn = document.createElement("button");
        makeDefaultBtn.textContent = "Make Default";
        makeDefaultBtn.className = "btn-secondary";
        makeDefaultBtn.onclick = () => setVaultAsDefault(index);
        actions.appendChild(makeDefaultBtn);
      }

      if (state.vaults.length > 0) {
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "btn-danger";
        removeBtn.onclick = () => removeVault(index);
        actions.appendChild(removeBtn);
      }

      item.appendChild(nameSpan);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  function refreshVaultDependentControls() {
    const templateVaultSelect = elements.templateVault();
    if (templateVaultSelect) {
      const previous = templateVaultSelect.value;
      populateVaultSelect(templateVaultSelect);
      const values = new Set(Array.from(templateVaultSelect.options).map((option) => option.value));
      templateVaultSelect.value = values.has(previous) ? previous : "";
    }
  }

  async function addVault() {
    const input = elements.newVaultInput();
    const name = input.value.trim();

    if (!name) return;

    const newVault = buildVault(name);
    if (!newVault) {
      return;
    }

    state.vaults = appendVault(state.vaults, newVault);
    input.value = "";

    await saveVaults(state.vaults);
    state.vaults = await getVaults();
    renderVaultList();
    refreshVaultDependentControls();
    setStatusMessage("Vault added.", "success");
  }

  async function removeVault(index) {
    const removal = removeVaultAtIndex(state.vaults, index);
    if (!removal.removed) {
      return;
    }

    state.vaults = removal.vaults;

    await saveVaults(state.vaults);
    state.vaults = await getVaults();
    renderVaultList();
    refreshVaultDependentControls();
    setStatusMessage("Vault removed.", "success");
  }

  async function setVaultAsDefault(index) {
    const promoted = setDefaultVaultByIndex(state.vaults, index);
    if (!promoted.changed) {
      return;
    }

    state.vaults = promoted.vaults;

    await saveVaults(state.vaults);
    state.vaults = await getVaults();
    renderVaultList();
    refreshVaultDependentControls();
    setStatusMessage("Default vault updated.", "success");
  }

  async function loadVaults() {
    try {
      const vaults = await getVaults();
      state.vaults = vaults;
      renderVaultList();
      refreshVaultDependentControls();
    } catch (error) {
      console.error("Failed to load vaults", error);
    }
  }

  function bindEvents() {
    const addBtn = elements.addVaultBtn();
    if (addBtn) {
      addBtn.addEventListener("click", addVault);
    }
  }

  return {
    bindEvents,
    loadVaults
  };
}
