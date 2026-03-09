export function listTemplatePresets(builtInPresets, customPresets) {
  return [...builtInPresets, ...customPresets];
}

export function findTemplatePresetById(presets, id) {
  if (!id) {
    return null;
  }
  return presets.find((preset) => preset.id === id) ?? null;
}

export function findTemplatePresetByTemplate(presets, template) {
  return presets.find((preset) => preset.template === template) ?? null;
}

