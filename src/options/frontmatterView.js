export function renderFrontmatterFields(container, fields) {
  container.innerHTML = "";

  Object.entries(fields).forEach(([key, value]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-group";

    const label = document.createElement("label");
    label.textContent = key;

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.dataset.frontmatterField = key;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  });
}

export function renderFrontmatterToggleInputs(container, enabledMap) {
  container.innerHTML = "";

  Object.entries(enabledMap).forEach(([key, enabled]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex-row mb-2";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = enabled;
    input.dataset.frontmatterToggle = key;
    input.id = `toggle-${key}`;

    const label = document.createElement("label");
    label.htmlFor = `toggle-${key}`;
    label.textContent = key;
    label.style.marginBottom = "0";
    label.style.marginLeft = "8px";

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  });
}

