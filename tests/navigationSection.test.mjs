import test from "node:test";
import assert from "node:assert/strict";
import { setupSectionNavigation } from "../src/options/sections/navigation.js";

function createFakeClassList() {
  const values = new Set();
  return {
    toggle(name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    },
    has(name) {
      return values.has(name);
    }
  };
}

function createFakeTab(section) {
  const listeners = new Map();
  return {
    dataset: { section },
    classList: createFakeClassList(),
    attrs: {},
    focused: false,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    setAttribute(key, value) {
      this.attrs[key] = value;
    },
    focus() {
      this.focused = true;
    },
    trigger(type, event = {}) {
      const handler = listeners.get(type);
      if (handler) {
        handler(event);
      }
    }
  };
}

function createFakePanel(section) {
  return {
    dataset: { sectionPanel: section },
    classList: createFakeClassList(),
    hidden: false,
    attrs: {},
    setAttribute(key, value) {
      this.attrs[key] = value;
    }
  };
}

test("setupSectionNavigation restores stored section and persists changes", async () => {
  const tabs = [createFakeTab("general"), createFakeTab("templates")];
  const panels = [createFakePanel("general"), createFakePanel("templates")];
  const writes = [];
  let currentSection = "";

  await setupSectionNavigation({
    tabs,
    panels,
    readLastSection: async () => "templates",
    writeLastSection: (target) => writes.push(target),
    onSectionChange: (target) => {
      currentSection = target;
    }
  });

  assert.equal(currentSection, "templates");
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, false);

  tabs[0].trigger("click");
  assert.equal(currentSection, "general");
  assert.deepEqual(writes, ["general"]);
});

