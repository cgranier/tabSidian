export function createCustomTemplateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `custom:${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(16).slice(2);
  return `custom:${Date.now().toString(16)}-${random}`;
}

export function normalizeCustomTemplatePreset(rawPreset, createId = createCustomTemplateId) {
  if (!rawPreset || typeof rawPreset !== "object") {
    return null;
  }

  const template = typeof rawPreset.template === "string" ? rawPreset.template : "";
  const name = typeof rawPreset.name === "string" ? rawPreset.name.trim() : "";
  if (!template || !name) {
    return null;
  }

  const description = typeof rawPreset.description === "string" ? rawPreset.description.trim() : "";
  const id =
    typeof rawPreset.id === "string" && rawPreset.id.startsWith("custom:")
      ? rawPreset.id
      : createId();

  return {
    id,
    name,
    description,
    template,
    filenamePattern: typeof rawPreset.filenamePattern === "string" ? rawPreset.filenamePattern : "",
    targetFolder: typeof rawPreset.targetFolder === "string" ? rawPreset.targetFolder : "",
    targetVault: typeof rawPreset.targetVault === "string" ? rawPreset.targetVault : ""
  };
}

export function createDraftCustomTemplate(defaultTemplate, createId = createCustomTemplateId) {
  return {
    id: createId(),
    name: "New Template",
    template: defaultTemplate,
    description: "New custom template",
    filenamePattern: "",
    targetFolder: "",
    targetVault: ""
  };
}

export function upsertCustomTemplatePresets(presets, preset) {
  const list = Array.isArray(presets) ? [...presets] : [];
  const index = list.findIndex((entry) => entry.id === preset.id);
  if (index >= 0) {
    list[index] = preset;
    return { presets: list, selectedId: preset.id, created: false };
  }
  list.push(preset);
  return { presets: list, selectedId: preset.id, created: true };
}

export function removeCustomTemplatePresetById(presets, presetId) {
  const list = Array.isArray(presets) ? [...presets] : [];
  const index = list.findIndex((entry) => entry.id === presetId);
  if (index < 0) {
    return { presets: list, removed: false };
  }
  list.splice(index, 1);
  return { presets: list, removed: true };
}

