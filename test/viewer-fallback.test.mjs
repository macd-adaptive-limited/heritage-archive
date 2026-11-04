import { test } from "node:test";
import assert from "node:assert/strict";
import { VIEWER_JS } from "../src/render.mjs";

// When the page image itself fails (404, corrupt file, blocked), the viewer
// must say so in the page language instead of leaving an empty dark box with
// zoom controls. The lazy script-load fallback already existed; the image
// open failure must reuse the same message.
test("a failed image open shows the localized fallback, reusing the script-load path", () => {
  assert.match(VIEWER_JS, /function showImageFallback\(\)/);
  assert.match(VIEWER_JS, /sc\.onerror = showImageFallback/);
  assert.match(VIEWER_JS, /viewer\.addHandler\("open-failed", showImageFallback\)/);
  // One shared message, both locales, announced politely.
  const fn = VIEWER_JS.match(/function showImageFallback\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /aria-live", "polite"/);
  assert.match(fn, /No se ha podido cargar la imagen/);
  assert.match(fn, /The page scan could not be loaded/);
});

test("the fallback replaces the unusable viewer controls with plain text", () => {
  const fn = VIEWER_JS.match(/function showImageFallback\(\) \{([\s\S]*?)\n\}/)[1];
  assert.match(fn, /el\.textContent = ""|el\.innerHTML = ""/, "clear the broken viewer surface first");
  assert.match(fn, /viewer-fallback/);
});
