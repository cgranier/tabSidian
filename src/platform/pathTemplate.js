function replaceTokenVariants(value, tokenName, tokenValue) {
  return value
    .replace(new RegExp(`\\{\\{${tokenName}\\}\\}`, "g"), tokenValue)
    .replace(new RegExp(`\\{${tokenName}\\}`, "g"), tokenValue);
}

export function applyPathTemplate(notePath, formattedTimestamp, dateSegment, timeSegment) {
  let resolved = replaceTokenVariants(notePath, "timestamp", formattedTimestamp);
  resolved = replaceTokenVariants(resolved, "date", dateSegment);
  resolved = replaceTokenVariants(resolved, "time", timeSegment);
  return resolved;
}
