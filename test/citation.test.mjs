import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { VIEWER_JS } from '../src/render.mjs';

function fixture(lang, clipboard) {
  const nodes = new Map();
  let handler;
  const make = (tag) => ({ tag, children: [], append(...children) { this.children.push(...children); for (const child of children) if (child.id) nodes.set(child.id, child); }, focus() { this.focused = true; }, select() { this.selected = true; } });
  const button = { dataset: { cite: 'Sample Person, 1900. Source: Synthetic example.' }, addEventListener(name, fn) { assert.equal(name, 'click'); handler = fn; }, parentElement: { after(node) { nodes.set('container', node); } } };
  const status = { textContent: '' };
  nodes.set('cite', button); nodes.set('cite-status', status);
  runInNewContext(VIEWER_JS, { document: { documentElement: { lang }, getElementById: id => nodes.get(id), createElement: make }, navigator: { clipboard }, location: { href: 'https://example.org/r/sample.html#source-region' }, window: {} });
  return { click: () => handler(), nodes, status };
}

test('successful citation copying keeps the accessible success status without a fallback', async () => {
  for (const lang of ['en', 'es']) {
    let copied;
    const f = fixture(lang, { async writeText(text) { copied = text; } });
    await f.click();
    assert.equal(copied, 'Sample Person, 1900. Source: Synthetic example. https://example.org/r/sample.html');
    assert.equal(f.status.textContent, lang === 'es' ? 'Cita copiada.' : 'Citation copied.');
    assert.equal(f.nodes.has('cite-fallback'), false);
  }
});
for (const lang of ['en', 'es']) {
  for (const [reason, clipboard] of [['missing', undefined], ['rejected', { async writeText() { throw new Error('Permission denied'); } }]]) {
    test(`${lang}: ${reason} clipboard exposes a labelled, selected read-only citation once`, async () => {
      const f = fixture(lang, clipboard);
      await f.click();
      const field = f.nodes.get('cite-fallback');
      assert.equal(field.tag, 'textarea');
      assert.equal(field.readOnly, true);
      assert.equal(field.focused, true); assert.equal(field.selected, true);
      assert.equal(field.value, 'Sample Person, 1900. Source: Synthetic example. https://example.org/r/sample.html');
      const container = f.nodes.get('container');
      assert.equal(container.className, 'citation-fallback noprint');
      assert.equal(container.children[0].htmlFor, field.id);
      assert.equal(container.children[0].textContent, lang === 'es' ? 'Cita para copiar' : 'Citation to copy');
      assert.match(f.status.textContent, lang === 'es' ? /Selecciona y copia/ : /Select and copy/);
      await f.click();
      assert.equal(f.nodes.get('container'), container);
      assert.equal(f.nodes.get('cite-fallback'), field);
    });
  }
}
