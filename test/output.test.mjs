import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replaceOutput } from "../src/output.mjs";

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), "heritage-output-"));
  try { run(dir, join(dir, "site")); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
function writeOutput(path, content) {
  mkdirSync(path);
  writeFileSync(join(path, "index.html"), content);
}

test("generation failure preserves previous output and removes staged files", () => fixture((dir, target) => {
  writeOutput(target, "OLD");
  assert.throws(() => replaceOutput(target, (staged) => {
    writeOutput(staged, "PARTIAL");
    assert.equal(readFileSync(join(target, "index.html"), "utf8"), "OLD");
    throw new Error("generation failed");
  }), /generation failed/);
  assert.equal(readFileSync(join(target, "index.html"), "utf8"), "OLD");
  assert.deepEqual(readdirSync(dir), ["site"]);
}));

test("failed first build leaves no output or staging directories", () => fixture((dir, target) => {
  assert.throws(() => replaceOutput(target, () => { throw new Error("failed"); }), /failed/);
  assert.deepEqual(readdirSync(dir), []);
}));

test("successful build replaces old files rather than retaining stale output", () => fixture((dir, target) => {
  writeOutput(target, "OLD");
  writeFileSync(join(target, "stale.html"), "STALE");
  replaceOutput(target, (staged) => writeOutput(staged, "NEW"));
  assert.equal(readFileSync(join(target, "index.html"), "utf8"), "NEW");
  assert.equal(existsSync(join(target, "stale.html")), false);
  assert.deepEqual(readdirSync(dir), ["site"]);
}));

test("commit failure restores previous output", () => fixture((dir, target) => {
  writeOutput(target, "OLD");
  // A missing staged directory forces the second rename to fail after backup.
  assert.throws(() => replaceOutput(target, () => {}), /ENOENT/);
  assert.equal(readFileSync(join(target, "index.html"), "utf8"), "OLD");
  assert.deepEqual(readdirSync(dir), ["site"]);
}));

test("output symlinks are rejected without touching their target", () => fixture((dir, target) => {
  const outside = join(dir, "outside");
  writeOutput(outside, "OUTSIDE");
  symlinkSync(outside, target, "dir");
  assert.throws(() => replaceOutput(target, () => assert.fail("must not generate")), /regular directory/);
  assert.equal(readFileSync(join(outside, "index.html"), "utf8"), "OUTSIDE");
  assert.deepEqual(readdirSync(dir).sort(), ["outside", "site"]);
}));

test("regular output files are rejected without deleting them", () => fixture((dir, target) => {
  writeFileSync(target, "KEEP");
  assert.throws(() => replaceOutput(target, () => assert.fail("must not generate")), /regular directory/);
  assert.equal(readFileSync(target, "utf8"), "KEEP");
}));
