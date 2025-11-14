/**
 * Minimal Mustache-compatible renderer that avoids dynamic code execution.
 * Supports variables, dotted paths, sections, and inverted sections.
 * HTML escaping follows the Mustache behaviour to keep templates sandboxed.
 */

const TAG_OPEN = "{{";
const TAG_CLOSE = "}}";
const UNESCAPED_TRIPLE = "{{{";
const UNESCAPED_TRIPLE_CLOSE = "}}}";

/**
 * @typedef {Object} TextToken
 * @property {"text"} type
 * @property {string} value
 *
 * @typedef {Object} VariableToken
 * @property {"variable" | "unescaped"} type
 * @property {string} name
 *
 * @typedef {Object} SectionToken
 * @property {"section" | "inverted"} type
 * @property {string} name
 * @property {Array<Token>} children
 *
 * @typedef {Object} CommentToken
 * @property {"comment"} type
 *
 * @typedef {TextToken | VariableToken | SectionToken | CommentToken} Token
 */

/**
 * @param {string} template
 * @returns {Array<Token>}
 */
function parseTemplate(template) {
  const state = { index: 0, template };
  const tokens = parseTokens(state);
  if (state.index < template.length) {
    tokens.push({ type: "text", value: template.slice(state.index) });
  }
  return tokens;
}

/**
 * @param {{ index: number, template: string }} state
 * @param {string} [stopName]
 * @returns {Array<Token>}
 */
function parseTokens(state, stopName) {
  const { template } = state;
  /** @type {Array<Token>} */
  const collected = [];

  while (state.index < template.length) {
    const openIndex = template.indexOf(TAG_OPEN, state.index);
    if (openIndex === -1) {
      collected.push({ type: "text", value: template.slice(state.index) });
      state.index = template.length;
      break;
    }

    if (openIndex > state.index) {
      collected.push({ type: "text", value: template.slice(state.index, openIndex) });
      state.index = openIndex;
    }

    if (template.startsWith(UNESCAPED_TRIPLE, state.index)) {
      const closeIndex = template.indexOf(UNESCAPED_TRIPLE_CLOSE, state.index + UNESCAPED_TRIPLE.length);
      if (closeIndex === -1) {
        throw new Error("Unterminated triple mustache.");
      }
      const raw = template.slice(state.index + UNESCAPED_TRIPLE.length, closeIndex).trim();
      collected.push({ type: "unescaped", name: raw });
      state.index = closeIndex + UNESCAPED_TRIPLE_CLOSE.length;
      continue;
    }

    const closeIndex = template.indexOf(TAG_CLOSE, state.index + TAG_OPEN.length);
    if (closeIndex === -1) {
      throw new Error("Unterminated mustache tag.");
    }

    const inner = template.slice(state.index + TAG_OPEN.length, closeIndex).trim();
    state.index = closeIndex + TAG_CLOSE.length;
    if (inner.length === 0) {
      continue;
    }

    const sigil = inner[0];
    const content = sigil === "#" || sigil === "^" || sigil === "/" || sigil === "!" || sigil === ">" || sigil === "&"
      ? inner.slice(1).trim()
      : inner;

    switch (sigil) {
      case "!":
        collected.push({ type: "comment" });
        break;
      case ">":
        throw new Error("Partials are not supported in tabSidian templates.");
      case "/":
        if (!stopName || content !== stopName) {
          throw new Error(`Unexpected closing tag for "${content}".`);
        }
        return collected;
      case "#": {
        const children = parseTokens(state, content);
        collected.push({ type: "section", name: content, children });
        break;
      }
      case "^": {
        const children = parseTokens(state, content);
        collected.push({ type: "inverted", name: content, children });
        break;
      }
      case "&":
        collected.push({ type: "unescaped", name: content });
        break;
      default:
        collected.push({ type: "variable", name: inner });
    }
  }

  if (stopName) {
    throw new Error(`Section "${stopName}" was not closed.`);
  }

  return collected;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function coerceContext(value) {
  if (isPlainObject(value)) {
    const contextView = Object.assign({ ".": value }, value);
    return /** @type {Record<string, unknown>} */ (contextView);
  }
  return { ".": value };
}

/**
 * @param {string} name
 * @param {Array<Record<string, unknown>>} stack
 * @returns {unknown}
 */
function resolveValue(name, stack) {
  if (name === ".") {
    return stack[stack.length - 1]["."];
  }

  const path = name.split(".");
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    let candidate = stack[i];
    let matched = true;
    for (const segment of path) {
      if (!Object.prototype.hasOwnProperty.call(candidate, segment)) {
        matched = false;
        break;
      }
      candidate = /** @type {Record<string, unknown>} */ (candidate)[segment];
    }

    if (matched) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isTruthy(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

/**
 * @param {Array<Token>} tokens
 * @param {Array<Record<string, unknown>>} stack
 * @returns {string}
 */
function renderTokens(tokens, stack) {
  let output = "";

  for (const token of tokens) {
    switch (token.type) {
      case "text":
        output += token.value;
        break;
      case "comment":
        break;
      case "variable": {
        const resolved = resolveValue(token.name, stack);
        if (resolved == null) {
          break;
        }
        const stringValue = String(resolved);
        output += escapeHtml(stringValue);
        break;
      }
      case "unescaped": {
        const resolved = resolveValue(token.name, stack);
        if (resolved == null) {
          break;
        }
        output += String(resolved);
        break;
      }
      case "section": {
        const value = resolveValue(token.name, stack);
        if (Array.isArray(value)) {
          for (const item of value) {
            const nextContext = coerceContext(item);
            output += renderTokens(token.children, stack.concat(nextContext));
          }
        } else if (isPlainObject(value)) {
          output += renderTokens(token.children, stack.concat(value));
        } else if (typeof value === "function") {
          throw new Error("Functions are not supported in tabSidian templates.");
        } else if (isTruthy(value)) {
          output += renderTokens(token.children, stack);
        }
        break;
      }
      case "inverted": {
        const value = resolveValue(token.name, stack);
        const shouldRender = Array.isArray(value) ? value.length === 0 : !isTruthy(value);
        if (shouldRender) {
          output += renderTokens(token.children, stack);
        }
        break;
      }
      default:
        throw new Error(`Unsupported token type: ${token.type}`);
    }
  }

  return output;
}

/**
 * Render a template with the provided context stack.
 *
 * @param {string} template
 * @param {Record<string, unknown>} context
 * @returns {string}
 */
export function renderTemplate(template, context) {
  const tokens = parseTemplate(template);
  const initialStack = [coerceContext(context)];
  return renderTokens(tokens, initialStack);
}

/**
 * Performs static safety checks on a template without rendering it.
 *
 * @param {string} template
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateTemplate(template) {
  const errors = [];
  try {
    parseTemplate(template);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown template parsing error.");
  }

  const warnings = [];
  const sanitized = template
    .replace(/\{\{\{\s*frontmatter\s*\}\}\}/g, "")
    .replace(/\{\{\&\s*frontmatter\s*\}\}/g, "");

  if (sanitized.includes("{{{")) {
    warnings.push("Triple mustaches ({{{ }}}) bypass HTML escaping. Prefer standard {{variable}} tags.");
  }
  if (sanitized.includes("{{&")) {
    warnings.push("Unescaped variables ({{& name}}) bypass HTML escaping. Prefer standard {{variable}} tags.");
  }
  if (template.includes("{{>")) {
    warnings.push("Partials are not supported and will cause rendering errors.");
  }

  return { errors, warnings };
}
