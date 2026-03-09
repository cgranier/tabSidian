export function setupSectionNavigation({
  tabs,
  panels,
  initialSection,
  readLastSection,
  writeLastSection,
  onSectionChange
}) {
  if (!Array.isArray(tabs) || !Array.isArray(panels) || tabs.length === 0 || panels.length === 0) {
    return Promise.resolve();
  }

  const fallback = tabs[0]?.dataset.section ?? null;
  const available = new Set(panels.map((panel) => panel.dataset.sectionPanel));

  const activateSection = (sectionId, { focusTab = true, storeSelection = false } = {}) => {
    const target = sectionId && available.has(sectionId) ? sectionId : fallback;

    tabs.forEach((tab) => {
      const isActive = tab.dataset.section === target;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
      if (isActive && focusTab) {
        tab.focus();
      }
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.sectionPanel === target;
      panel.hidden = !isActive;
      panel.classList.toggle("active", isActive);
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      panel.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    onSectionChange?.(target);

    if (storeSelection && target) {
      writeLastSection?.(target);
    }
  };

  const focusByIndex = (index, { storeSelection = false } = {}) => {
    const normalized = (index + tabs.length) % tabs.length;
    const targetTab = tabs[normalized];
    if (!targetTab) {
      return;
    }
    activateSection(targetTab.dataset.section, {
      focusTab: true,
      storeSelection
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateSection(tab.dataset.section, {
        focusTab: true,
        storeSelection: true
      });
    });

    tab.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          focusByIndex(index - 1, { storeSelection: true });
          break;
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          focusByIndex(index + 1, { storeSelection: true });
          break;
        case "Home":
          event.preventDefault();
          focusByIndex(0, { storeSelection: true });
          break;
        case "End":
          event.preventDefault();
          focusByIndex(tabs.length - 1, { storeSelection: true });
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          activateSection(tab.dataset.section, {
            focusTab: true,
            storeSelection: true
          });
          break;
        default:
          break;
      }
    });
  });

  const restore = () => activateSection(initialSection, { focusTab: false });
  if (!readLastSection) {
    restore();
    return Promise.resolve();
  }

  return readLastSection()
    .then((stored) => {
      activateSection(stored, { focusTab: false });
    })
    .catch(() => {
      restore();
    });
}

