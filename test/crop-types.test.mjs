import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeBox, recordPage } from '../src/render.mjs';
import { validateRecords } from '../src/validate.mjs';

const box = { x: 0.1, y: 0.2, w: 0.3, h: 0.04, aspect: 0.75 };
const record = { id: 'fiction-crop', nombre: 'Fictional', apellidos: 'Example', anio: 1900, pagina: 1, hogar: 1, fuente: 'FICTIONAL ARCHIVE', confianza: 'media', revisado: false, imagen: 'img/sample.svg', linea: box };
const malformed = [null, true, false, '', '  ', [], [0.5], {}, { valueOf: () => 0.5 }];

test('crop coordinates reject nonnumeric JSON types rather than coercing them', () => {
  for (const key of ['x', 'y', 'w', 'h']) {
    for (const value of malformed) {
      const linea = { ...box, [key]: value };
      assert.equal(safeBox(linea), null, `${key}: ${JSON.stringify(value)}`);
      assert.match(validateRecords([{ ...record, linea }]).join(), /fractions/);
      assert.ok(!recordPage({ ...record, linea }, { lang: 'en' }).includes('data-line='));
    }
  }
});

test('crop aspect rejects coercible types and never generates a false static crop', () => {
  for (const value of malformed) {
    const linea = { ...box, aspect: value };
    assert.equal(safeBox(linea).aspect, null, JSON.stringify(value));
    assert.match(validateRecords([{ ...record, linea }]).join(), /aspect/);
    assert.ok(!recordPage({ ...record, linea }, { lang: 'en' }).includes('class="linecrop"'));
  }
});

test('finite numbers and nonempty numeric strings retain existing crop behavior', () => {
  const strings = Object.fromEntries(Object.entries(box).map(([key, value]) => [key, ` ${value} `]));
  assert.deepEqual(safeBox(strings), box);
  assert.deepEqual(validateRecords([{ ...record, linea: strings }]), []);
  assert.deepEqual(safeBox({ ...box, x: 0, y: 0 }), { ...box, x: 0, y: 0 });
  for (const value of [undefined, NaN, Infinity, -Infinity, 'NaN', 'Infinity']) {
    assert.equal(safeBox({ ...box, w: value }), null);
    assert.equal(safeBox({ ...box, aspect: value }).aspect, null);
  }
});
