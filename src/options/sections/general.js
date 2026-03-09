import { DEFAULT_EXPORT_DATE_FORMAT, DEFAULT_EXPORT_TIME_FORMAT } from "../../platform/defaults.js";

export const DEFAULT_GLOBAL_TARGET_FOLDER = "tabSidian";
export const DEFAULT_GLOBAL_TARGET_FILENAME = "tab-export-{timestamp}.md";

function normalizeFormat(value, fallback) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function applyGeneralSettingsToInputs(
  {
    dateInput,
    timeInput,
    folderInput,
    filenameInput
  },
  {
    timestampFormats,
    saveTargetDefaults
  }
) {
  if (dateInput) {
    dateInput.value = normalizeFormat(timestampFormats?.dateFormat, DEFAULT_EXPORT_DATE_FORMAT);
  }
  if (timeInput) {
    timeInput.value = normalizeFormat(timestampFormats?.timeFormat, DEFAULT_EXPORT_TIME_FORMAT);
  }
  if (folderInput) {
    folderInput.value = (saveTargetDefaults?.folder ?? "").trim();
  }
  if (filenameInput) {
    filenameInput.value = normalizeFormat(
      saveTargetDefaults?.filenamePattern,
      DEFAULT_GLOBAL_TARGET_FILENAME
    );
  }
}

export function readGeneralSettingsFromInputs({
  dateInput,
  timeInput,
  folderInput,
  filenameInput
}) {
  return {
    timestampFormats: {
      dateFormat: normalizeFormat(dateInput?.value, DEFAULT_EXPORT_DATE_FORMAT),
      timeFormat: normalizeFormat(timeInput?.value, DEFAULT_EXPORT_TIME_FORMAT)
    },
    saveTargetDefaults: {
      folder: (folderInput?.value ?? "").trim(),
      filenamePattern: normalizeFormat(filenameInput?.value, DEFAULT_GLOBAL_TARGET_FILENAME)
    }
  };
}

export function resetGeneralSettingsInputs(elements) {
  const defaults = {
    timestampFormats: {
      dateFormat: DEFAULT_EXPORT_DATE_FORMAT,
      timeFormat: DEFAULT_EXPORT_TIME_FORMAT
    },
    saveTargetDefaults: {
      folder: DEFAULT_GLOBAL_TARGET_FOLDER,
      filenamePattern: DEFAULT_GLOBAL_TARGET_FILENAME
    }
  };
  applyGeneralSettingsToInputs(elements, defaults);
  return defaults;
}

