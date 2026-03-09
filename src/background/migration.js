import browser from "../platform/browser.js";
import { ensureStorageMigration } from "../platform/storage.js";

export async function migrateStorage() {
  await ensureStorageMigration();
}

export function setupMigration() {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "update" || details.reason === "install") {
      migrateStorage().catch((error) => {
        console.error("tabSidian: Migration failed", error);
      });
    }
  });
}
