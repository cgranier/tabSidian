const DEFAULT_TARGETS = ["chrome", "firefox", "edge", "safari"];

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))];
}

function ensureBackgroundModule(manifest) {
  const background = manifest.background ?? {};
  if (!background.service_worker) {
    return background;
  }
  return {
    ...background,
    type: background.type ?? "module"
  };
}

function flattenWebAccessibleResources(manifest) {
  const resources = manifest.web_accessible_resources ?? [];
  if (!Array.isArray(resources)) {
    return resources;
  }

  const list = resources.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }
    if (entry && Array.isArray(entry.resources)) {
      return entry.resources;
    }
    return [];
  });

  return uniqueArray(list);
}

function withFirefoxBackground(manifest) {
  return {
    ...manifest,
    background: {
      scripts: ["background.js"],
      persistent: false
    }
  };
}

function withDownloads(manifest) {
  return {
    ...manifest,
    permissions: uniqueArray([...(manifest.permissions ?? []), "downloads"])
  };
}

function withoutDownloads(manifest) {
  return {
    ...manifest,
    permissions: uniqueArray((manifest.permissions ?? []).filter((permission) => permission !== "downloads")),
    optional_permissions: uniqueArray([
      ...(manifest.optional_permissions ?? []),
      "downloads"
    ])
  };
}

function withPermissions(manifest, permissions) {
  return {
    ...manifest,
    permissions: uniqueArray([...(manifest.permissions ?? []), ...permissions])
  };
}

function withHostPermissions(manifest, hosts) {
  return {
    ...manifest,
    host_permissions: uniqueArray([...(manifest.host_permissions ?? []), ...hosts])
  };
}

function addBrowserSpecificSettings(manifest, overrides) {
  return {
    ...manifest,
    browser_specific_settings: {
      ...(manifest.browser_specific_settings ?? {}),
      ...overrides
    }
  };
}

function defineValues(values) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)])
  );
}

export const TARGETS = {
  chrome: {
    downloadStrategy: "download",
    manifest: (manifest) => ({
      ...withHostPermissions(
        withPermissions(withDownloads(manifest), ["scripting"]),
        ["<all_urls>"]
      ),
      background: ensureBackgroundModule(manifest)
    }),
    rollup: {
      replacements: defineValues({
        __API_NAMESPACE__: "chrome"
      })
    }
  },
  edge: {
    downloadStrategy: "download",
    manifest: (manifest) => addBrowserSpecificSettings(
      {
        ...withHostPermissions(
          withPermissions(withDownloads(manifest), ["scripting"]),
          ["<all_urls>"]
        ),
        background: ensureBackgroundModule(manifest)
      },
      {
        edge: {
          browser_action_next_to_addressbar: true
        }
      }
    ),
    rollup: {
      replacements: defineValues({
        __API_NAMESPACE__: "chrome"
      })
    }
  },
  firefox: {
    downloadStrategy: "download",
    manifest: (manifest) => {
      const sanitized = withoutPermissions(manifest, ["tabGroups"]);
      const base = {
        ...sanitized,
        manifest_version: 2,
        permissions: uniqueArray([...(sanitized.permissions ?? []), "downloads"]),
        optional_permissions: uniqueArray(manifest.optional_permissions ?? []),
        browser_action: {
          default_icon: manifest.action?.default_icon,
          default_title: manifest.action?.default_title
        },
        web_accessible_resources: flattenWebAccessibleResources(manifest)
      };

      delete base.action;
      delete base.background;
      delete base.safari_web_extension_info;

      return addBrowserSpecificSettings(
        withFirefoxBackground(base),
        {
          gecko: {
            id: "tabsidian@example.com",
            strict_min_version: "109.0"
          }
        }
      );
    },
    rollup: {
      replacements: defineValues({
        __API_NAMESPACE__: "browser"
      })
    }
  },
  safari: {
    downloadStrategy: "share",
    manifest: (manifest) => ({
      ...withHostPermissions(
        withPermissions(withoutDownloads(manifest), ["scripting"]),
        ["<all_urls>"]
      ),
      background: ensureBackgroundModule(manifest),
      safari_web_extension_info: {
        version: manifest.version,
        display_name: manifest.name,
        permissions: manifest.permissions
      }
    }),
    rollup: {
      replacements: defineValues({
        __API_NAMESPACE__: "browser"
      })
    }
  }
};

export function getTargetConfig(name) {
  const key = (name || "").toLowerCase();
  if (!TARGETS[key]) {
    throw new Error(`Unknown target "${name}". Available targets: ${DEFAULT_TARGETS.join(", ")}`);
  }
  return { name: key, ...TARGETS[key] };
}

export function listTargets() {
  return DEFAULT_TARGETS.slice();
}
function withoutPermissions(manifest, permissionsToRemove = []) {
  const permitted = (manifest.permissions ?? []).filter((permission) => !permissionsToRemove.includes(permission));
  return {
    ...manifest,
    permissions: uniqueArray(permitted)
  };
}
