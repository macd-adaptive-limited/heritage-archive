import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, copyFileSync } from "node:fs";

test("sample data builds into an indexed site", () => {
  const had = existsSync("data/records.json");
  if (!had) copyFileSync("data/records.sample.json", "data/records.json");
  execFileSync("node", ["src/build.mjs"], { stdio: "pipe" });
  execFileSync("npx", ["pagefind", "--site", "site"], { stdio: "pipe" });
  assert.ok(existsSync("site/index.html"));
  assert.ok(existsSync("site/pagefind/pagefind.js"));
  assert.equal(readdirSync("site/r").length, 4);
  assert.ok(existsSync("site/vendor/openseadragon/openseadragon.min.js"));
  assert.ok(existsSync("site/vendor/openseadragon/LICENSE.txt"));
  assert.ok(existsSync("site/img/sample-page.svg"));
});

test("404.html is built, noindex and links back to the portal root", () => {
  const html = readFileSync("site/404.html", "utf8");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /href="\/style\.css"/);
  assert.match(html, /<a href="\/">Search the index<\/a>/);
});

// ---- Checks on the built sample portal (runs after the build above, same process) ----
import { readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const htmlFiles = () => walk("site").filter((f) => f.endsWith(".html") && !f.startsWith("site/pagefind") && !f.startsWith("site/vendor") && f !== "site/404.html"); // 404.html uses root-absolute links, checked in its own test

test("every local link, script, stylesheet and image in the built pages resolves to a file", () => {
  const missing = [];
  for (const f of htmlFiles()) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/\b(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
      const u = m[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|mailto:)/i.test(u)) continue;
      const target = u.startsWith("/") ? join("site", u) : resolve(dirname(f), u);
      let ok = false; try { ok = statSync(target).isFile(); } catch { /* missing */ }
      if (!ok) missing.push(`${f} -> ${u}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("built pages load nothing from other hosts (no external scripts, styles, images or fonts)", () => {
  const external = [];
  for (const f of htmlFiles()) {
    const html = readFileSync(f, "utf8");
    for (const m of html.matchAll(/<(?:script|link|img|iframe|source)\b[^>]*\b(?:src|href)="((?:https?:)?\/\/[^"]+)"/g)) external.push(`${f}: ${m[1]}`);
    for (const m of html.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^)"']+)/g)) external.push(`${f}: css ${m[1]}`);
  }
  assert.deepEqual(external, []);
});

test("element ids are unique within each built page", () => {
  const dup = [];
  for (const f of htmlFiles()) {
    const seen = new Set();
    for (const m of readFileSync(f, "utf8").matchAll(/\sid="([^"]+)"/g)) { if (seen.has(m[1])) dup.push(`${f}: ${m[1]}`); seen.add(m[1]); }
  }
  assert.deepEqual(dup, []);
});

test("every record page has a title, a lang attribute and one h1", () => {
  for (const f of walk("site/r")) {
    const html = readFileSync(f, "utf8");
    assert.match(html, /<html lang="[a-z-]+"/, f);
    assert.match(html, /<title>[^<]+<\/title>/, f);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, f);
  }
});

test("the built sample portal is noindex with a blocking robots.txt and no sitemap", () => {
  assert.equal(readFileSync("site/robots.txt", "utf8"), "User-agent: *\nDisallow: /\n");
  assert.equal(existsSync("site/sitemap.xml"), false);
  for (const f of ["site/index.html", ...readdirSync("site/r").map((n) => `site/r/${n}`)]) assert.match(readFileSync(f, "utf8"), /<meta name="robots" content="noindex, nofollow">/, f);
});


test("Irish demo dataset: fictional, unique ids, line boxes inside the page, image exists", () => {
  const recs = JSON.parse(readFileSync("data/records.ie.sample.json", "utf8"));
  assert.equal(new Set(recs.map((r) => r.id)).size, recs.length);
  for (const r of recs) {
    assert.match(r.fuente, /^DEMO DATA - fictional/);
    assert.ok(existsSync(`data/sample-img/${r.imagen.replace(/^img\//, "")}`), r.imagen);
    const l = r.linea;
    assert.ok(l.x >= 0 && l.y >= 0 && l.x + l.w <= 1 && l.y + l.h <= 1, r.id);
  }
});
