import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRecords } from '../src/validate.mjs';

test('the model JSON example is a valid person record', () => {
  const model = readFileSync(new URL('../docs/MODELO.md', import.meta.url), 'utf8');
  const example = model.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(example, 'model must contain a JSON example');
  assert.deepEqual(validateRecords([JSON.parse(example[1])]), []);
});
