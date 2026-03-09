export function resolveSaveTarget(
  template,
  globalDefaultVault,
  globalDefaultFolder,
  globalDefaultFilename = "Tabs - {{date}}"
) {
  return {
    vault: template.targetVault || globalDefaultVault,
    folder: template.targetFolder || globalDefaultFolder,
    filename: template.filenamePattern || globalDefaultFilename
  };
}
