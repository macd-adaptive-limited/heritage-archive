import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), "heritage-index-"));
  try {
    cpSync("src", join(dir, "src"), { recursive: true });
    cpSync("package.json", join(dir, "package.json"));
    mkdirSync(join(dir, "data"));
    cpSync("data/records.sample.json", join(dir, "data/records.json"));
    mkdirSync(join(dir, "node_modules/pagefind/lib/runner"), { recursive: true });
    symlinkSync(resolve("node_modules/openseadragon"), join(dir, "node_modules/openseadragon"), "dir");
    run(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function stubIndexer(dir, code) {
  writeFileSync(join(dir, "node_modules/pagefind/lib/runner/bin.cjs"), `
    const fs = require("node:fs"), path = require("node:path");
    const site = process.argv[process.argv.indexOf("--site") + 1];
    if (!fs.existsSync(path.join(site, "index.html"))) throw new Error("HTML must exist before indexing");
    fs.mkdirSync(path.join(site, "pagefind"));
    fs.writeFileSync(path.join(site, "pagefind/index.js"), "SYNTHETIC INDEX");
    ${code}
  `);
}
function fullBuild(dir) {
  return spawnSync("npm", ["run", "build"], { cwd: dir, encoding: "utf8" });
}
function assertNoStaging(dir) {
  assert.deepEqual(readdirSync(dir).filter((name) => name.startsWith(".site-build-")), []);
}

test("full build commits HTML and search output together and removes stale files", () => fixture((dir) => {
  mkdirSync(join(dir, "site"));
  writeFileSync(join(dir, "site/stale.txt"), "OLD OUTPUT");
  stubIndexer(dir, "");
  const run = fullBuild(dir);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.ok(existsSync(join(dir, "site/index.html")));
  assert.equal(readFileSync(join(dir, "site/pagefind/index.js"), "utf8"), "SYNTHETIC INDEX");
  assert.equal(existsSync(join(dir, "site/stale.txt")), false);
  assertNoStaging(dir);
}));

test("indexer failure after partial output preserves the complete previous portal", () => fixture((dir) => {
  mkdirSync(join(dir, "site/pagefind"), { recursive: true });
  writeFileSync(join(dir, "site/index.html"), "PREVIOUS HTML");
  writeFileSync(join(dir, "site/pagefind/index.js"), "PREVIOUS INDEX");
  stubIndexer(dir, "process.exit(42);");
  const run = fullBuild(dir);
  assert.notEqual(run.status, 0, run.stdout + run.stderr);
  assert.equal(readFileSync(join(dir, "site/index.html"), "utf8"), "PREVIOUS HTML");
  assert.equal(readFileSync(join(dir, "site/pagefind/index.js"), "utf8"), "PREVIOUS INDEX");
  assertNoStaging(dir);
}));

test("a first failed indexed build leaves no partial portal", () => fixture((dir) => {
  stubIndexer(dir, "process.exit(42);");
  const run = fullBuild(dir);
  assert.notEqual(run.status, 0, run.stdout + run.stderr);
  assert.equal(existsSync(join(dir, "site")), false);
  assertNoStaging(dir);
}));

test("missing indexer cannot replace a previous portal", () => fixture((dir) => {
  mkdirSync(join(dir, "site"));
  writeFileSync(join(dir, "site/keep.txt"), "PREVIOUS");
  const run = fullBuild(dir);
  assert.notEqual(run.status, 0, run.stdout + run.stderr);
  assert.equal(readFileSync(join(dir, "site/keep.txt"), "utf8"), "PREVIOUS");
  assertNoStaging(dir);
}));
