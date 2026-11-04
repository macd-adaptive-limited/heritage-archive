import { test } from "node:test";
import assert from "node:assert/strict";
import { recordPage, lineCropHtml, VIEWER_JS } from "../src/render.mjs";

const rec = { id: "x/1", nombre: "Sample", apellidos: "Person", fuente: "Synthetic source", confianza: "media", revisado: false, anio: 1900, pagina: 1, hogar: 1, imagen: "img/p.jpg", linea: { x: 0.1, y: 0.2, w: 0.4, h: 0.02, aspect: 0.76 } };

// The "Open the original page" link names the source, so it stays even when
// the image cannot load; a localized note next to it warns the link may not
// work. The note ships hidden and the image probe reveals it on error.
test("the record page carries a hidden localized note next to the source link", () => {
  const en = recordPage(rec, { lang: "en", title: "T" });
  assert.match(en, /<a class="doc"[^>]*>Open the original page/);
  assert.match(en, /id="image-link-note" hidden>The image did not load; this link may not work\.</);
  const es = recordPage(rec, { lang: "es", title: "T" });
  assert.match(es, /id="image-link-note" hidden>La imagen no se ha cargado; es posible que el enlace no funcione\./);
});

test("no note without an image (the unavailable-image message covers that case)", () => {
  assert.doesNotMatch(recordPage({ ...rec, imagen: "" }, { lang: "en", title: "T" }), /image-link-note/);
});

test("the image probe reveals the note on error, and removes the crop when present", () => {
  const probe = VIEWER_JS.match(/const probe = document\.createElement\("img"\);([\s\S]*?)probe\.src = el\.dataset\.src;/);
  assert.ok(probe, "probe preloads the viewer image URL");
  assert.match(probe[1], /probe\.onerror = \(\) => \{/);
  assert.match(probe[1], /if \(crop\) crop\.remove\(\)/);
  assert.match(probe[1], /getElementById\("image-link-note"\)/);
  assert.match(probe[1], /note\.hidden = false/);
});

test("the probe runs whenever the viewer has an image, with or without a crop", () => {
  assert.match(VIEWER_JS, /if \(el && el\.dataset\.src\) \{/);
  const html = recordPage({ ...rec, linea: undefined }, { lang: "en", title: "T" });
  assert.match(html, /id="image-link-note" hidden>/, "note present without a line crop");
  assert.equal(lineCropHtml({ ...rec, linea: undefined }), "");
});
