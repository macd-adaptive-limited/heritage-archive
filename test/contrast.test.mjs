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

// Reads the declared value of a property inside the first block of a selector within a scope.
function declared(scope, selector, prop) {
  const escSel = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selRe = new RegExp(`(?:^|[}\{\n])\\s*${escSel}\\s*\\{([^}]*)\\}`);
  const block = scope.match(selRe);
  assert.ok(block, `selector ${selector} exists with a block`);
  const m = block[1].match(new RegExp(`(?:^|[;\\s{])${prop}:\\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|inherit)\\b`));
  // A missing color property inherits the body text color.
  return m ? m[1].toLowerCase() : "inherit";
}

// Splits the stylesheet into the base rules and the dark-scheme rules, wherever each is declared.
function splitSchemes(css) {
  const marker = "@media (prefers-color-scheme: dark)";
  let light = "", dark = "", rest = css;
  for (;;) {
    const i = rest.indexOf(marker);
    if (i === -1) return { light: light + rest, dark };
    const open = rest.indexOf("{", i);
    let depth = 0, j = open;
    for (; j < rest.length; j++) {
      if (rest[j] === "{") depth++;
      else if (rest[j] === "}") { depth--; if (depth === 0) break; }
    }
    light += rest.slice(0, i);
    dark += rest.slice(open + 1, j);
    rest = rest.slice(j + 1);
  }
}
const { light, dark } = splitSchemes(STYLE);

const AA_NORMAL = 4.5;

// Every text/background pair the portal renders, in both color schemes.
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
];

test("all text and background pairs meet WCAG AA contrast (4.5:1) in both color schemes", () => {
  for (const [name, scope, fgSel, fgProp, bgSel, bgProp] of pairs) {
    let fg = declared(scope, fgSel, fgProp);
    const bg = declared(scope, bgSel, bgProp);
    if (fg === "inherit") fg = declared(scope, "body", "color");
    assert.ok(contrast(fg, bg) >= AA_NORMAL, `${name}: ${fg} on ${bg} is ${contrast(fg, bg).toFixed(2)}:1, below ${AA_NORMAL}:1`);
  }
});
