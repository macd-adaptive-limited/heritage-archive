import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLE } from "../src/render.mjs";

// WCAG 2.x relative luminance and contrast ratio (SC 1.4.3 needs 4.5:1 for normal text).
const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hexRaw) => {
  let hex = hexRaw.slice(1);
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 0xff) + 0.0722 * channel(n & 0xff);
};
const contrast = (fg, bg) => {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
};

// Reads the declared value of a property for a selector within a scope,
// falling back to the base rules per property, mirroring the cascade: a rule
// outside @media applies in every scheme unless the media block overrides
// that same property.
function declared(scope, selector, prop, base = scope) {
  const escSel = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selRe = new RegExp(`(?:^|[}\{\n])\\s*${escSel}\\s*\\{([^}]*)\\}`);
  const propRe = new RegExp(`(?:^|[;\\s{])${prop}:\\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|inherit|transparent)\\b`);
  const block = scope.match(selRe);
  const m = block && block[1].match(propRe);
  if (m) return m[1].toLowerCase();
  if (base !== scope) {
    const baseBlock = base.match(selRe);
    const bm = baseBlock && baseBlock[1].match(propRe);
    if (bm) return bm[1].toLowerCase();
  }
  assert.ok(block || (base !== scope && base.match(selRe)), `selector ${selector} exists with a block`);
  // A color property no rule declares inherits the body text color.
  return "inherit";
}

// Splits the stylesheet into base rules and the rules inside a given @media
// block, wherever each is declared.
function splitBlocks(css, marker) {
  let base = "", scoped = "", rest = css;
  for (;;) {
    const i = rest.indexOf(marker);
    if (i === -1) return { base: base + rest, scoped };
    const open = rest.indexOf("{", i);
    let depth = 0, j = open;
    for (; j < rest.length; j++) {
      if (rest[j] === "{") depth++;
      else if (rest[j] === "}") { depth--; if (depth === 0) break; }
    }
    base += rest.slice(0, i);
    scoped += rest.slice(open + 1, j);
    rest = rest.slice(j + 1);
  }
}
const withoutDark = splitBlocks(STYLE, "@media (prefers-color-scheme: dark)");
const dark = withoutDark.scoped;
const withoutPrint = splitBlocks(withoutDark.base, "@media print");
const light = withoutPrint.base;
const print = withoutPrint.scoped;

const AA_NORMAL = 4.5;

// Text/background pairs from the portal's own rules, in both color schemes
// and print. Third-party surfaces (the Pagefind component UI, OpenSeadragon
// internals) and decorative layers (highlight overlays, borders) are out of
// scope for this audit.
const pairs = [
  ["light body text", light, "body", "color", "body", "background"],
  ["light meta text", light, ".meta, header p", "color", "body", "background"],
  ["light fuente text", light, ".fuente", "color", "body", "background"],
  ["light link", light, "a", "color", "body", "background"],
  ["light tag alta", light, ".alta", "color", ".alta", "background"],
  ["light tag media", light, ".media", "color", ".media", "background"],
  ["light tag baja", light, ".baja", "color", ".baja", "background"],
  ["light notice text", light, "body", "color", ".notice", "background"],
  ["light skip link", light, ".skip", "color", ".skip", "background"],
  ["light button", light, "button", "color", "button", "background"],
  ["dark body text", dark, "body", "color", "body", "background"],
  ["dark meta text", dark, ".meta, header p, .fuente", "color", "body", "background"],
  ["dark link", dark, "a", "color", "body", "background"],
  ["dark tag alta", dark, ".alta", "color", ".alta", "background"],
  ["dark tag media", dark, ".media", "color", ".media", "background"],
  ["dark tag baja", dark, ".baja", "color", ".baja", "background"],
  ["dark notice text", dark, "body", "color", ".notice", "background"],
  ["dark button", dark, "button", "color", "button", "background"],
  // Scheme-independent rules, checked through the base-rule fallback in both
  // schemes: the viewer box and its fallback keep fixed colors, the citation
  // field inherits the scheme body color, the skip link keeps fixed colors.
  ["light viewer fallback", light, ".viewer-fallback", "color", "#viewer", "background"],
  ["dark viewer fallback", dark, ".viewer-fallback", "color", "#viewer", "background"],
  ["light citation field", light, ".citation-fallback textarea", "color", ".citation-fallback textarea", "background"],
  ["dark citation field", dark, ".citation-fallback textarea", "color", ".citation-fallback textarea", "background"],
  ["dark skip link", dark, ".skip", "color", ".skip", "background"],
  ["print body text", print, "body", "color", "body", "background"],
  ["print link", print, "a", "color", "body", "background"],
];

test("all text and background pairs meet WCAG AA contrast (4.5:1) in both color schemes and print", () => {
  for (const [name, scope, fgSel, fgProp, bgSel, bgProp] of pairs) {
    let fg = declared(scope, fgSel, fgProp, light);
    let bg = declared(scope, bgSel, bgProp, light);
    // color: inherit resolves to the scheme's body text color; a transparent
    // background shows the page background through it.
    if (fg === "inherit") fg = declared(scope, "body", "color", light);
    if (bg === "transparent" || bg === "inherit") bg = declared(scope, "body", "background", light);
    assert.ok(contrast(fg, bg) >= AA_NORMAL, `${name}: ${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}:1, below ${AA_NORMAL}:1`);
  }
});
