import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { VIEWER_JS } from '../src/render.mjs';

function fixture(focused = false) {
  const handlers = {};
  const listeners = {};
  const attrs = { 'aria-label': 'Synthetic original page, arrow keys to move' };
  const canvasAttrs = {};
  const document = { activeElement: null, documentElement: { lang: 'en' }, createElement: () => ({}), getElementById: id => id === 'viewer' ? el : null };
  const canvas = { isConnected: true, setAttribute(k,v) { canvasAttrs[k] = v; }, focus() { document.activeElement = canvas; } };
  const el = { dataset: {}, tabIndex: 0, getAttribute: k => attrs[k], setAttribute(k,v) { attrs[k] = v; }, addEventListener(k,fn) { (listeners[k] ??= []).push(fn); }, contains(node) { return node === this || node === canvas; }, appendChild(node) { this.child = node; }, focus() { document.activeElement = this; }, querySelector() { return null; } };
  function OpenSeadragon() { return { canvas, addHandler(k,fn) { handlers[k] = fn; } }; }
  if (focused) document.activeElement = el;
  runInNewContext(VIEWER_JS, { document, window: { OpenSeadragon }, OpenSeadragon });
  return { el, canvas, canvasAttrs, document, handlers, listeners };
}
test('the operative canvas is named and replaces the inert wrapper in tab order', () => {
  const f = fixture();
  assert.equal(f.el.tabIndex, -1);
  assert.equal(f.canvasAttrs.role, 'region');
  assert.equal(f.canvasAttrs['aria-label'], 'Synthetic original page, arrow keys to move');
  assert.equal(f.document.activeElement, null, 'background loading must not steal focus');
});
test('lazy loading transfers existing wrapper focus and later wrapper focus to the canvas', () => {
  const f = fixture(true);
  assert.equal(f.document.activeElement, f.canvas);
  f.document.activeElement = f.el;
  for (const listener of f.listeners.focus) listener();
  assert.equal(f.document.activeElement, f.canvas);
});
test('an image failure restores a tab stop and retains focus on the explanation', () => {
  const f = fixture(true);
  f.handlers['open-failed']();
  assert.equal(f.el.tabIndex, 0);
  assert.equal(f.document.activeElement, f.el);
  assert.match(f.el.child.textContent, /could not be loaded/);
});
test('an image failure does not steal focus from another control', () => {
  const f = fixture();
  const other = {};
  f.document.activeElement = other;
  f.handlers['open-failed']();
  assert.equal(f.document.activeElement, other);
});
