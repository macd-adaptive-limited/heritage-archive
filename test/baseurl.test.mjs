import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, symlinkSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { robotsTxt, sitemapXml, basePath } from "../src/render.mjs";

const rec = { id: "x/1" };

test("an invalid or non-resolvable baseUrl degrades like no baseUrl instead of crashing the build", () => {
  // basePath already treats an invalid baseUrl as absent; robots.txt and the
  // sitemap must do the same. "not a url" fails to parse; mailto: and data:
  // parse as absolute URLs but cannot resolve sitemap.xml (they threw
  // "Invalid URL" from robotsTxt before this fix).
  for (const baseUrl of ["not a url", "mailto:someone@example.org", "data:text/plain,hello"]) {
    assert.equal(basePath({ baseUrl }), "");
    assert.equal(robotsTxt({ indexable: true, baseUrl }), "User-agent: *\nAllow: /\n", baseUrl);
    assert.equal(sitemapXml({ indexable: true, baseUrl }, [rec]), "", baseUrl);
  }
});

test("non-web schemes are rejected even when they parse and resolve", () => {
  // ftp:// is hierarchical and could technically resolve sitemap.xml, but the
  // portal is served over http(s); treat every other scheme as absent.
  for (const baseUrl of ["ftp://example.org/a", "file:///srv/archive/"]) {
    assert.equal(robotsTxt({ indexable: true, baseUrl }), "User-agent: *\nAllow: /\n", baseUrl);
    assert.equal(sitemapXml({ indexable: true, baseUrl }, [rec]), "", baseUrl);
  }
});

test("a valid http(s) baseUrl keeps the Sitemap line and sitemap locations, with or without trailing slash", () => {
  for (const baseUrl of ["https://example.org/a", "http://example.org/a", "https://example.org/a/"]) {
    assert.equal(
      robotsTxt({ indexable: true, baseUrl }),
      "User-agent: *\nAllow: /\nSitemap: https://example.org/a/sitemap.xml\n".replace("https:", baseUrl.startsWith("http:") ? "http:" : "https:"),
      baseUrl,
    );
    const xml = sitemapXml({ indexable: true, baseUrl }, [rec]);
    assert.match(xml, /<loc>https?:\/\/example\.org\/a\/r\/x_1\.html<\/loc>/, baseUrl);
  }
});

test("the build writes robots.txt without a Sitemap line and no sitemap.xml for an invalid baseUrl", () => {
  // Isolated in a temp dir: other test files build site/ in parallel.
  const dir = mkdtempSync(join(tmpdir(), "heritage-baseurl-"));
  try {
    cpSync("src", join(dir, "src"), { recursive: true });
    cpSync("data/sample-img", join(dir, "data/sample-img"), { recursive: true });
    cpSync("data/records.sample.json", join(dir, "data/records.json"));
    writeFileSync(join(dir, "data/site.json"), JSON.stringify({ indexable: true, baseUrl: "not a url" }));
    symlinkSync(resolve("node_modules"), join(dir, "node_modules"), "dir");
    const run = spawnSync(process.execPath, ["src/build.mjs"], { cwd: dir, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(dir, "site/robots.txt"), "utf8"), "User-agent: *\nAllow: /\n");
    assert.equal(existsSync(join(dir, "site/sitemap.xml")), false, "no sitemap.xml without a valid baseUrl");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
