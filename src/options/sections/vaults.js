function createVaultId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function buildVault(name, { isDefault = false } = {}) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!normalizedName) {
    return null;
  }
  return {
    id: createVaultId(),
    name: normalizedName,
    isDefault
  };
}

export function appendVault(vaults, vault) {
  const list = Array.isArray(vaults) ? [...vaults] : [];
  if (!vault) {
    return list;
  }
  list.push(vault);
  return list;
}

export function removeVaultAtIndex(vaults, index) {
  const list = Array.isArray(vaults) ? [...vaults] : [];
  if (index < 0 || index >= list.length) {
    return { vaults: list, removed: false };
  }

  list.splice(index, 1);
  if (list.length > 0 && !list.some((vault) => vault.isDefault)) {
    list[0] = {
      ...list[0],
      isDefault: true
    };
  }

  return { vaults: list, removed: true };
}

export function setDefaultVaultByIndex(vaults, index) {
  const list = Array.isArray(vaults) ? [...vaults] : [];
  if (index <= 0 || index >= list.length) {
    return { vaults: list, changed: false };
  }

  const [vault] = list.splice(index, 1);
  const reset = list.map((entry) => ({ ...entry, isDefault: false }));
  const promoted = { ...vault, isDefault: true };
  return { vaults: [promoted, ...reset], changed: true };
}

export function moveVaultByIndex(vaults, fromIndex, toIndex) {
  const list = Array.isArray(vaults) ? [...vaults] : [];
  if (
    fromIndex < 0 ||
    fromIndex >= list.length ||
    toIndex < 0 ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return { vaults: list, changed: false };
  }

  const [moved] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, moved);

  const normalized = list.map((vault, index) => ({
    ...vault,
    isDefault: index === 0
  }));

  return { vaults: normalized, changed: true };
}
