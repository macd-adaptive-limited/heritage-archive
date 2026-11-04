import { test } from "node:test";
import assert from "node:assert/strict";
import { VIEWER_JS } from "../src/render.mjs";

// The default OpenSeadragon toolbar buttons are plain divs: no tabindex, no
// role, unreachable by keyboard. The canvas already pans/zooms with keys, but
// "go home" and "toggle full page" have no keyboard path at all. The fix
// makes each button a real tab stop that triggers the same viewport action
// on Enter/Space, calling the viewport API directly (synthetic clicks do not
// reach OpenSeadragon's own pointer tracking).
test("toolbar buttons become focusable buttons found by their stable image file, not by localized title", () => {
  assert.match(VIEWER_JS, /btn\.tabIndex = 0/);
  assert.match(VIEWER_JS, /btn\.setAttribute\("role", "button"\)/);
  assert.match(VIEWER_JS, /img\[src\$="/, "buttons located by image file name");
  assert.doesNotMatch(VIEWER_JS, /div\[title=/, "no lookup by (localizable) title text");
});

test("Enter and Space run the same viewport actions the click would", () => {
  assert.match(VIEWER_JS, /e\.key === "Enter" \|\| e\.key === " "/);
  for (const api of ["zoomBy", "applyConstraints", "goHome", "setFullPage"]) {
    assert.match(VIEWER_JS, new RegExp(`viewport\\.${api}|viewer\\.${api}`), api);
  }
  assert.doesNotMatch(VIEWER_JS, /btn\.click\(\)/, "no synthetic clicks into OpenSeadragon internals");
});

test("keydown on a toolbar button runs the action and returns focus to the button (vm harness)", async () => {
  const { runInNewContext } = await import("node:vm");
  // Entering full page reparents the viewer and the browser drops focus to
  // <body>; without the refocus, the same key cannot leave full page. This
  // drives the real VIEWER_JS: it fails if the refocus line is removed.
  const document = { activeElement: null, documentElement: { lang: "en" }, body: { tagName: "BODY" }, createElement: () => ({}), getElementById: (id) => (id === "viewer" ? el : null) };
  const calls = [];
  const btn = { tabIndex: -1, attrs: {}, isConnected: true, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.keydown = fn; }, focus() { document.activeElement = this; } };
  const img = { closest: () => btn };
  const canvas = { isConnected: true, setAttribute() {}, focus() { document.activeElement = this; } };
  const el = { dataset: { src: "img/p.svg" }, tabIndex: 0, getAttribute: () => "label", setAttribute() {}, addEventListener() {}, appendChild() {}, contains: () => true, focus() {}, querySelector: (sel) => (sel.includes("zoomin_rest.png") ? img : null) };
  function OpenSeadragon() {
    return { canvas, addHandler() {}, zoomPerClick: 2, isFullPage: () => false, viewport: { zoomBy: () => calls.push("zoomBy"), applyConstraints: () => calls.push("applyConstraints"), goHome: () => calls.push("goHome") }, setFullPage: () => calls.push("setFullPage") };
  }
  runInNewContext(VIEWER_JS, { document, window: { OpenSeadragon }, OpenSeadragon });
  assert.equal(btn.tabIndex, 0);
  assert.equal(btn.attrs.role, "button");
  document.activeElement = document.body; // what the browser does after the toggle
  btn.keydown({ key: "Enter", preventDefault: () => calls.push("preventDefault") });
  assert.deepEqual(calls, ["preventDefault", "zoomBy", "applyConstraints"]);
  assert.equal(document.activeElement, btn, "focus returns to the button after the action");
});

test("all four default controls are wired: zoom in, zoom out, home, full page", () => {
  for (const file of ["zoomin_", "zoomout_", "home_", "fullpage_"]) {
    assert.match(VIEWER_JS, new RegExp(`"${file}rest\\.png"|'${file}rest\\.png'`), file);
  }
});
