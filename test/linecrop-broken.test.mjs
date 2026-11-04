import { test } from "node:test";
import assert from "node:assert/strict";
import { VIEWER_JS, lineCropHtml } from "../src/render.mjs";

const rec = { id: "x/1", nombre: "Sample", apellidos: "Person", fuente: "Synthetic source", confianza: "media", revisado: false, anio: 1900, pagina: 1, hogar: 1, imagen: "img/p.jpg", linea: { x: 0.1, y: 0.2, w: 0.4, h: 0.02, aspect: 0.76 } };

// The static line crop is a CSS background-image, which fires no error event:
// when the page image 404s, the figure stays as a dark box with a floating
// name highlight and a caption claiming it shows the original line. The
// record page script must preload the same URL and drop the figure on error.
test("a page image that fails to load removes the line crop figure", () => {
  assert.match(VIEWER_JS, /const crop = document\.getElementById\("linecrop"\)/);
  const probe = VIEWER_JS.match(/const probe = document\.createElement\("img"\);([\s\S]*?)probe\.src = el\.dataset\.src;/);
  assert.ok(probe, "probe preloads the viewer image URL");
  assert.match(probe[1], /if \(crop\) crop\.remove\(\)/);
});

test("the probe only runs when the viewer has an image; the crop removal stays conditional", () => {
  assert.match(VIEWER_JS, /if \(el && el\.dataset\.src\) \{/);
});

test("the line crop figure carries the linecrop id the probe looks for", () => {
  const html = lineCropHtml(rec);
  assert.match(html, /<figure class="linecrop" id="linecrop"/);
});
