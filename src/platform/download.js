import browser from "./browser.js";
import { DOWNLOAD_STRATEGY } from "./runtime.js";

const MIME_TYPE = "text/markdown;charset=UTF-8";
const SHARE_PAYLOAD_PREFIX = "tabsidian-share-";

async function openShareSheet({ markdown, filename }) {
  const storageKey = `${SHARE_PAYLOAD_PREFIX}${Date.now()}`;
  await browser.storage.local.set({
    [storageKey]: {
      markdown,
      filename
    }
  });

  const shareUrl = `${browser.runtime.getURL("share.html")}#${encodeURIComponent(storageKey)}`;
  await browser.tabs.create({ url: shareUrl, active: true });
}

function resolveBlobUrlFactory() {
  const urlGlobal = globalThis.URL ?? globalThis.webkitURL;
  if (!urlGlobal?.createObjectURL || typeof urlGlobal.createObjectURL !== "function") {
    return null;
  }

  const revoke = typeof urlGlobal.revokeObjectURL === "function" ? urlGlobal.revokeObjectURL.bind(urlGlobal) : null;

  return {
    create: urlGlobal.createObjectURL.bind(urlGlobal),
    revoke
  };
}

function createBlobUrl(markdown) {
  const factory = resolveBlobUrlFactory();
  if (!factory) {
    return null;
  }

  const blob = new Blob([markdown], { type: MIME_TYPE });
  const url = factory.create(blob);
  return {
    url,
    revoke() {
      if (factory.revoke) {
        factory.revoke(url);
      }
    }
  };
}

function createDataUrl(markdown) {
  return `data:${MIME_TYPE},${encodeURIComponent(markdown)}`;
}

async function attemptDownload({ url, filename }) {
  if (!browser?.downloads?.download) {
    return false;
  }

  try {
    await browser.downloads.download({
      url,
      filename,
      saveAs: true
    });
    return true;
  } catch (error) {
    console.warn("tabSidian download failed, trying fallback", error);
    return false;
  }
}

export async function deliverMarkdownFile({ markdown, filename }) {
  if (DOWNLOAD_STRATEGY === "share") {
    await openShareSheet({ markdown, filename });
    return;
  }

  const blobUrl = createBlobUrl(markdown);
  if (blobUrl) {
    const blobDownloaded = await attemptDownload({ url: blobUrl.url, filename });
    blobUrl.revoke();

    if (blobDownloaded) {
      return;
    }
  } else {
    console.warn("tabSidian could not create an object URL in this environment, trying data URL download.");
  }

  const dataUrl = createDataUrl(markdown);
  const dataDownloaded = await attemptDownload({ url: dataUrl, filename });
  if (dataDownloaded) {
    return;
  }

  // Fallback: open a new tab with the markdown contents.
  await browser.tabs.create({
    url: dataUrl,
    active: true
  });
}

export function getShareStoragePrefix() {
  return SHARE_PAYLOAD_PREFIX;
}
