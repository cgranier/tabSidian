export function createVaultController({
  elements,
  state,
  buildVault,
  appendVault,
  removeVaultAtIndex,
  setDefaultVaultByIndex,
  moveVaultByIndex,
  getVaults,
  saveVaults,
  populateVaultSelect,
  setStatusMessage
}) {
  let dragSourceIndex = null;

  function updateVaultWarning() {
    if (state.vaults.length > 0) {
      return;
    }
    setStatusMessage("No vault configured. Saves will use download/share fallback instead of Obsidian URI.", "warning");
  }

  function renderVaultList() {
    const list = elements.vaultList();
    if (!list) return;

    list.innerHTML = "";

    state.vaults.forEach((vault, index) => {
      const item = document.createElement("div");
      item.className = "vault-item flex-row flex-between";
      item.dataset.index = String(index);
      item.draggable = state.vaults.length > 1;

      const nameSpan = document.createElement("span");
      nameSpan.className = "vault-name";
      nameSpan.textContent = vault.name;
      if (index === 0) {
        nameSpan.textContent += " (Default)";
        item.classList.add("is-default");
      }

      if (item.draggable) {
        item.classList.add("is-draggable");
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

      if (item.draggable) {
        item.addEventListener("dragstart", () => {
          dragSourceIndex = index;
          item.classList.add("is-dragging");
        });
        item.addEventListener("dragend", () => {
          dragSourceIndex = null;
          item.classList.remove("is-dragging");
        });
        item.addEventListener("dragover", (event) => {
          event.preventDefault();
          item.classList.add("is-drop-target");
        });
        item.addEventListener("dragleave", () => {
          item.classList.remove("is-drop-target");
        });
        item.addEventListener("drop", async (event) => {
          event.preventDefault();
          item.classList.remove("is-drop-target");
          const targetIndex = Number(item.dataset.index);
          await reorderVaults(dragSourceIndex, targetIndex);
        });
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
    updateVaultWarning();
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
    updateVaultWarning();
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
    updateVaultWarning();
    setStatusMessage("Default vault updated.", "success");
  }

  async function reorderVaults(fromIndex, toIndex) {
    const moved = moveVaultByIndex(state.vaults, fromIndex, toIndex);
    if (!moved.changed) {
      return;
    }

    state.vaults = moved.vaults;
    await saveVaults(state.vaults);
    state.vaults = await getVaults();
    renderVaultList();
    refreshVaultDependentControls();
    updateVaultWarning();
    setStatusMessage("Vault order updated. Top vault is now default.", "success");
  }

  async function loadVaults() {
    try {
      const vaults = await getVaults();
      state.vaults = vaults;
      renderVaultList();
      refreshVaultDependentControls();
      updateVaultWarning();
    } catch (error) {
      console.error("Failed to load vaults", error);
    }
  }

  function bindEvents() {
    const addBtn = elements.addVaultBtn();
    if (addBtn) {
      addBtn.addEventListener("click", addVault);
    }

    const input = elements.newVaultInput();
    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        void addVault();
      });
    }
  }

  return {
    bindEvents,
    loadVaults
  };
}
