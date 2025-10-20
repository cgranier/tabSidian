export const TARGET_BROWSER = __TARGET_BROWSER__;
export const DOWNLOAD_STRATEGY = __DOWNLOAD_STRATEGY__;
export const PLATFORM_NAME = __PLATFORM_NAME__;
export const API_NAMESPACE = __API_NAMESPACE__;

export const IS_FIREFOX = TARGET_BROWSER === "firefox";
export const IS_SAFARI = TARGET_BROWSER === "safari";
export const IS_CHROMIUM = TARGET_BROWSER === "chrome" || TARGET_BROWSER === "edge";

export function describePlatform() {
  if (IS_SAFARI) {
    return "Safari";
  }
  if (IS_FIREFOX) {
    return "Firefox";
  }
  if (IS_CHROMIUM) {
    return TARGET_BROWSER === "edge" ? "Microsoft Edge" : "Google Chrome";
  }
  return TARGET_BROWSER;
}

export function resolveGlobalNamespace() {
  if (typeof globalThis === "undefined") {
    return undefined;
  }

  if (API_NAMESPACE && typeof globalThis[API_NAMESPACE] === "object") {
    return globalThis[API_NAMESPACE];
  }

  return globalThis.browser ?? globalThis.chrome;
}
