import polyfill from "webextension-polyfill";
import { API_NAMESPACE } from "./runtime.js";

function resolveNamespace() {
  if (polyfill && typeof polyfill === "object") {
    return polyfill;
  }

  if (typeof globalThis === "undefined") {
    return polyfill;
  }

  if (API_NAMESPACE && typeof globalThis[API_NAMESPACE] === "object") {
    return globalThis[API_NAMESPACE];
  }

  if (typeof globalThis.browser === "object") {
    return globalThis.browser;
  }

  if (typeof globalThis.chrome === "object") {
    return globalThis.chrome;
  }

  return polyfill;
}

const browser = resolveNamespace();

export default browser;

export function getBrowserNamespace() {
  return browser;
}
