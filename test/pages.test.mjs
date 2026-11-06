import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import { extractPages } from "../src/pages.mjs";

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), "heritage-extract-"));
  const pdf = join(dir, "-fictional input.pdf");
  const out = join(dir, "pages");
  writeFileSync(pdf, "SYNTHETIC PDF PLACEHOLDER");
  mkdirSync(out);
  writeFileSync(join(out, "pagina-099.png"), "OLD IMAGE");
  try { run(dir, pdf, out); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function fakePages(command, args) {
  assert.equal(command, "pdftoppm");
  assert.deepEqual(args.slice(0, 3), ["-r", "200", "-png"]);
  assert.ok(isAbsolute(args[3]));
  writeFileSync(`${args[4]}-1.png`, "SYNTHETIC IMAGE");
}

test("successful extraction replaces stale pages and reports only new images", () => fixture((dir, pdf, out) => {
  assert.equal(extractPages(pdf, out, "200", fakePages), 1);
  assert.deepEqual(readdirSync(out), ["pagina-1.png"]);
  assert.deepEqual(readdirSync(dir).sort(), ["-fictional input.pdf", "pages"]);
}));
test("partial converter failure preserves the complete previous output", () => fixture((dir, pdf, out) => {
  assert.throws(() => extractPages(pdf, out, "200", (command, args) => {
    fakePages(command, args); throw new Error("synthetic conversion failure");
  }), /synthetic conversion failure/);
  assert.equal(readFileSync(join(out, "pagina-099.png"), "utf8"), "OLD IMAGE");
  assert.deepEqual(readdirSync(out), ["pagina-099.png"]);
  assert.deepEqual(readdirSync(dir).sort(), ["-fictional input.pdf", "pages"]);
}));
test("no generated pages cannot replace a previous extraction", () => fixture((dir, pdf, out) => {
  assert.throws(() => extractPages(pdf, out, "200", (command, args) => {
    writeFileSync(`${args[4]}-notes.png`, "NOT A NUMBERED PAGE");
  }), /no page images/);
  assert.ok(existsSync(join(out, "pagina-099.png")));
}));
test("empty images and image-named directories cannot replace previous pages", () => fixture((dir, pdf, out) => {
  for (const directory of [false, true]) {
    assert.throws(() => extractPages(pdf, out, "200", (command, args) => {
      if (directory) mkdirSync(`${args[4]}-1.png`);
      else writeFileSync(`${args[4]}-1.png`, "");
    }), /Invalid or empty page/);
    assert.ok(existsSync(join(out, "pagina-099.png")));
  }
}));
test("invalid resolutions fail before invoking the converter", () => fixture((dir, pdf, out) => {
  for (const dpi of ["0", "35", "1201", "NaN", "200.5", "-r", "", " 200 "]) {
    assert.throws(() => extractPages(pdf, out, dpi, () => assert.fail("must not run")), /dpi must be/);
  }
}));
test("source PDFs inside output are protected from replacement", () => fixture((dir, pdf, out) => {
  const inside = join(out, "source.pdf"); writeFileSync(inside, "KEEP PDF");
  assert.throws(() => extractPages(inside, out, "200", () => assert.fail("must not run")), /must not be inside/);
  assert.equal(readFileSync(inside, "utf8"), "KEEP PDF");
  assert.throws(() => extractPages(pdf, pdf, "200", () => assert.fail("must not run")), /must not be inside/);
}));
test("a first failed extraction leaves no partial output", () => fixture((dir, pdf, out) => {
  rmSync(out, { recursive: true });
  assert.throws(() => extractPages(pdf, out, "200", () => { throw new Error("failed"); }), /failed/);
  assert.equal(existsSync(out), false);
  assert.deepEqual(readdirSync(dir), ["-fictional input.pdf"]);
}));
test("CLI missing arguments returns one concise failure without a stack", () => {
  const result = spawnSync(process.execPath, ["src/pages.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 1); assert.match(result.stderr, /Page extraction failed: usage:/);
  assert.doesNotMatch(result.stderr, /^\s+at\s/m);
});
