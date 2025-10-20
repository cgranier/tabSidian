import test from "node:test";
import assert from "node:assert/strict";
import { generateManifest } from "../scripts/utils/manifest.js";

test("chromium targets request downloads permission", async () => {
  const { manifest: chromeManifest } = await generateManifest("chrome");
  const { manifest: edgeManifest } = await generateManifest("edge");

  assert.ok(chromeManifest.permissions.includes("downloads"), "Chrome manifest missing downloads");
  assert.ok(edgeManifest.permissions.includes("downloads"), "Edge manifest missing downloads");
  assert.ok(chromeManifest.permissions.includes("scripting"), "Chrome manifest missing scripting permission");
  assert.ok(edgeManifest.permissions.includes("scripting"), "Edge manifest missing scripting permission");
});

test("all targets request notifications permission", async () => {
  const targets = ["chrome", "edge", "firefox", "safari"];

  for (const target of targets) {
    const { manifest } = await generateManifest(target);
    assert.ok(
      manifest.permissions.includes("notifications"),
      `${target} manifest missing notifications permission`
    );
  }
});

test("firefox manifest downgrades to MV2 with browser action", async () => {
  const { manifest } = await generateManifest("firefox");
  assert.equal(manifest.manifest_version, 2, "Firefox manifest should use MV2");
  assert.ok(manifest.browser_action, "Firefox manifest missing browser_action");
  assert.deepEqual(manifest.background.scripts, ["background.js"], "Firefox manifest must use background scripts");
  assert.ok(manifest.browser_specific_settings?.gecko, "Firefox manifest missing Gecko settings");
});

test("safari manifest routes downloads through share mode", async () => {
  const { manifest } = await generateManifest("safari");
  assert.ok(!manifest.permissions.includes("downloads"), "Safari manifest should not list downloads permission");
  assert.ok(Array.isArray(manifest.optional_permissions), "Safari manifest expected optional_permissions array");
  assert.ok(manifest.safari_web_extension_info, "Safari manifest must define safari_web_extension_info");
  assert.ok(manifest.permissions.includes("scripting"), "Safari manifest missing scripting permission");
});

test("firefox manifest excludes scripting permission", async () => {
  const { manifest } = await generateManifest("firefox");
  assert.ok(!manifest.permissions.includes("scripting"), "Firefox manifest should not include scripting permission");
});

test("firefox manifest omits host permissions", async () => {
  const { manifest } = await generateManifest("firefox");
  assert.ok(!Object.prototype.hasOwnProperty.call(manifest, "host_permissions"), "Firefox manifest should not declare host_permissions");
});

test("chromium and safari manifests use service worker background", async () => {
  const targets = ["chrome", "edge", "safari"];

  for (const target of targets) {
    const { manifest } = await generateManifest(target);
    assert.equal(manifest.background.type, "module", `${target} manifest background not marked as module`);
    assert.equal(manifest.background.service_worker, "background.js");
  }
});
