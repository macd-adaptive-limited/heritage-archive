import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRecords } from "../src/validate.mjs";

const ok = () => ({ id: "a-1", nombre: "N", apellidos: "A B", edad: 30, anio: 1900, pagina: 1, hogar: 1, fuente: "SAMPLE", confianza: "alta", revisado: false });

test("the bundled sample data is valid", () => {
  assert.deepEqual(validateRecords(JSON.parse(readFileSync("data/records.sample.json", "utf8"))), []);
});

test("a minimal record is valid", () => assert.deepEqual(validateRecords([ok()]), []));

test("non-array input is rejected", () => assert.match(validateRecords({})[0], /array/));

test("missing and wrong-typed fields are reported with the record id", () => {
  const e = validateRecords([{ ...ok(), nombre: "", anio: "1900", confianza: "x", revisado: "no" }]).join("\n");
  assert.match(e, /\(a-1\): nombre is required/);
  assert.match(e, /anio must be a non-negative integer/);
  assert.match(e, /confianza must be one of/);
  assert.match(e, /revisado must be true or false/);
});

test("duplicate ids and ids that collide as file names are rejected", () => {
  assert.match(validateRecords([ok(), ok()]).join(), /duplicate id/);
  assert.match(validateRecords([ok(), { ...ok(), id: "a/1" }, { ...ok(), id: "a_1" }]).join(), /same page file/);
});

test("image paths must be plain relative paths", () => {
  for (const bad of ["../x.png", "/etc/x", "http://x/y.png", "a b.png"]) assert.match(validateRecords([{ ...ok(), imagen: bad }]).join(), /imagen must be a plain relative path/, bad);
  assert.deepEqual(validateRecords([{ ...ok(), imagen: "img/p1.jpg" }]), []);
});

test("linea needs an image, a box inside the page and an aspect", () => {
  const l = { x: 0.1, y: 0.1, w: 0.3, h: 0.05, aspect: 0.75 };
  assert.match(validateRecords([{ ...ok(), linea: l }]).join(), /needs imagen/);
  assert.deepEqual(validateRecords([{ ...ok(), imagen: "img/p.jpg", linea: l }]), []);
  assert.match(validateRecords([{ ...ok(), imagen: "img/p.jpg", linea: { ...l, x: 0.9 } }]).join(), /fractions/);
  assert.match(validateRecords([{ ...ok(), imagen: "img/p.jpg", linea: { ...l, aspect: undefined } }]).join(), /aspect/);
});

test("edad outside 0-125 is rejected, edad may be omitted", () => {
  assert.match(validateRecords([{ ...ok(), edad: 200 }]).join(), /edad/);
  const r = ok(); delete r.edad;
  assert.deepEqual(validateRecords([r]), []);
});

test("image paths reject non-string JSON values instead of coercing them", () => {
  for (const imagen of [123, true, false, ["page.jpg"], [], {}]) {
    assert.match(validateRecords([{ ...ok(), imagen }]).join(), /imagen must be a plain relative path/, JSON.stringify(imagen));
  }
  for (const imagen of [undefined, null, "", "img/page.jpg"]) {
    assert.deepEqual(validateRecords([{ ...ok(), imagen }]), [], String(imagen));
  }
});
