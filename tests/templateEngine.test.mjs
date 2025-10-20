import test from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, validateTemplate } from "../src/platform/templateEngine.js";

test("renderTemplate escapes HTML entities by default", () => {
  const output = renderTemplate("Hello {{name}}", { name: "<script>alert(1)</script>" });
  assert.equal(output, "Hello &lt;script&gt;alert(1)&lt;/script&gt;");
});

test("renderTemplate leaves triple mustache unescaped", () => {
  const output = renderTemplate("{{{content}}}", { content: "<b>bold</b>" });
  assert.equal(output, "<b>bold</b>");
});

test("renderTemplate handles array sections and dotted paths", () => {
  const template = "{{#items}}- {{name}} ({{meta.category}})\n{{/items}}";
  const output = renderTemplate(template, {
    items: [
      { name: "First", meta: { category: "a" } },
      { name: "Second", meta: { category: "b" } }
    ]
  });

  assert.equal(output, "- First (a)\n- Second (b)\n");
});

test("renderTemplate treats non-empty strings as truthy sections", () => {
  const template = "{{#favicon}}![icon]({{favicon}}) {{/favicon}}{{title}}";
  const output = renderTemplate(template, {
    favicon: "https://example.com/favicon.ico",
    title: "Example"
  });

  assert.equal(output, "![icon](https://example.com/favicon.ico) Example");
});

test("validateTemplate reports unsupported partials and dangerous constructs", () => {
  const { errors, warnings } = validateTemplate("{{#section}}{{value}} {{> partial}} {{{raw}}}");
  assert.ok(errors.some((message) => message.includes("Partials")));
  assert.ok(warnings.some((message) => message.includes("Triple mustaches")));
  assert.ok(warnings.some((message) => message.includes("Partials")));
});

test("validateTemplate allows triple mustaches for frontmatter", () => {
  const { warnings, errors } = validateTemplate("{{{frontmatter}}}");
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});
