import browser from "webextension-polyfill";
import { getShareStoragePrefix } from "../platform/download.js";

const statusElement = document.querySelector("[data-status]");
const markdownElement = document.querySelector("[data-markdown]");
const actionsElement = document.querySelector("[data-actions]");
const copyButton = document.querySelector("[data-copy]");
const downloadButton = document.querySelector("[data-download]");

function updateStatus(message) {
  statusElement.textContent = message;
}

function decodeStorageKey() {
  const hash = window.location.hash.replace(/^#/, "");
  return decodeURIComponent(hash);
}

async function loadPayload(storageKey) {
  const record = await browser.storage.local.get(storageKey);
  return record[storageKey];
}

function enableFallbackActions(payload) {
  markdownElement.value = payload.markdown;
  markdownElement.hidden = false;
  actionsElement.hidden = false;

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(payload.markdown);
      updateStatus("Copied to clipboard.");
    } catch (error) {
      console.error("Failed to copy to clipboard", error);
      updateStatus("Unable to access clipboard. Copy manually from the text area below.");
      markdownElement.focus();
      markdownElement.select();
    }
  });

  downloadButton.addEventListener("click", () => {
    const blob = new Blob([payload.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

async function attemptShare(payload) {
  if (!navigator.share) {
    updateStatus("Sharing is unavailable. Copy or download the Markdown below.");
    enableFallbackActions(payload);
    return;
  }

  try {
    await navigator.share({
      title: payload.filename.replace(/\.md$/i, ""),
      text: payload.markdown
    });
    updateStatus("Shared successfully. You can close this tab.");
  } catch (error) {
    console.warn("Share sheet not completed, falling back to manual actions.", error);
    updateStatus("Share cancelled. Copy or download the Markdown below.");
    enableFallbackActions(payload);
  }
}

async function init() {
  const storageKey = decodeStorageKey();
  if (!storageKey || !storageKey.startsWith(getShareStoragePrefix())) {
    updateStatus("Share data missing or expired.");
    return;
  }

  const payload = await loadPayload(storageKey);
  await browser.storage.local.remove(storageKey);

  if (!payload) {
    updateStatus("Share data missing or expired.");
    return;
  }

  await attemptShare(payload);
}

init().catch((error) => {
  console.error("Unable to start share handler", error);
  updateStatus("Something went wrong while preparing the share sheet.");
});
