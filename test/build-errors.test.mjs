import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, symlinkSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// The build is the documented entry point; a malformed data or settings file
// must fail with one clear line (the way src/validate.mjs does), not a raw
// stack trace, and before anything in site/ is touched.
function setupDir() {
  const dir = mkdtempSync(join(tmpdir(), "heritage-build-errors-"));
  cpSync("src", join(dir, "src"), { recursive: true });
  cpSync("data/sample-img", join(dir, "data/sample-img"), { recursive: true });
  cpSync("data/records.sample.json", join(dir, "data/records.json"));
  symlinkSync(resolve("node_modules"), join(dir, "node_modules"), "dir");
  return dir;
}
function build(dir) {
  return spawnSync(process.execPath, ["src/build.mjs"], { cwd: dir, encoding: "utf8" });
}
function assertCleanFailure(run, label) {
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, new RegExp(`^${label}: cannot read or parse \\(`), run.stderr);
  assert.doesNotMatch(run.stderr, /SyntaxError|^\s+at\s/m, "no raw stack trace");
}

test("a missing data/records.json fails with a clear message", () => {
  const dir = setupDir();
  try {
    rmSync(join(dir, "data/records.json"));
    assertCleanFailure(build(dir), "data/records.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("malformed JSON in data/records.json fails with a clear message", () => {
  const dir = setupDir();
  try {
    writeFileSync(join(dir, "data/records.json"), "{bad json");
    assertCleanFailure(build(dir), "data/records.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("malformed JSON in data/site.json fails with a clear message", () => {
  const dir = setupDir();
  try {
    writeFileSync(join(dir, "data/site.json"), "{nope");
    assertCleanFailure(build(dir), "data/site.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a site.json that is not a JSON object fails with a clear message", () => {
  const dir = setupDir();
  try {
    for (const bad of ["[1,2]", '"lang"', "42", "null"]) {
      writeFileSync(join(dir, "data/site.json"), bad);
      const run = build(dir);
      assert.equal(run.status, 1, `${bad}: ${run.stdout}${run.stderr}`);
      assert.match(run.stderr, /^data\/site\.json: must be a JSON object/m, run.stderr);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a failed build leaves any previous site/ output untouched", () => {
  const dir = setupDir();
  try {
    assert.equal(build(dir).status, 0);
    writeFileSync(join(dir, "data/records.json"), "{bad json");
    assert.equal(build(dir).status, 1);
    assert.equal(existsSync(join(dir, "site/index.html")), true, "previous build output untouched");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
