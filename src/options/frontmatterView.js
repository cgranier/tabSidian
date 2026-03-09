export function renderFrontmatterFields(container, fields, enabledMap = {}) {
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "frontmatter-table";

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Property Variable", "Frontmatter Field Name", "Enabled"].forEach((label) => {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.appendChild(cell);
  });
  header.appendChild(headerRow);
  table.appendChild(header);

  const body = document.createElement("tbody");

  Object.entries(fields).forEach(([key, value]) => {
    const row = document.createElement("tr");

    const variableCell = document.createElement("td");
    variableCell.textContent = key;

    const fieldCell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.dataset.frontmatterField = key;
    fieldCell.appendChild(input);

    const enabledCell = document.createElement("td");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = Boolean(enabledMap[key]);
    toggle.dataset.frontmatterToggle = key;
    toggle.id = `toggle-${key}`;
    enabledCell.appendChild(toggle);

    row.appendChild(variableCell);
    row.appendChild(fieldCell);
    row.appendChild(enabledCell);
    body.appendChild(row);
  });

  table.appendChild(body);
  container.appendChild(table);
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
