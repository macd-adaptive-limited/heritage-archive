// Static portal generator: data/records.json -> site/ (index page + one page per record),
// with --index, Pagefind (MIT) indexes the staged pages before replacement.
// Run with `npm run build`. Output is plain HTML/CSS/JS.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, cpSync, lstatSync, readdirSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { replaceOutput } from "./output.mjs";
import { validateRecords } from "./validate.mjs";
import { recordPage, indexPage, safeId, robotsTxt, sitemapXml, notFoundPage, STYLE, VIEWER_JS } from "./render.mjs";

const DEFAULT_SITE = {
  lang: "en",
  title: "Heritage Archive",
  subtitle: "Person-level index of a historical records collection.",
  placeholder: "Search by name or surname",
};

// Read a JSON file or stop the build with one clear line (same style as
// src/validate.mjs), before anything in site/ is touched.
function readJsonOrExit(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { console.error(`${path}: cannot read or parse (${e.message})`); process.exit(1); }
}

const records = readJsonOrExit("data/records.json");
const problems = validateRecords(records);
if (problems.length) { console.error(`data/records.json: ${problems.length} problem(s)\n- ${problems.join("\n- ")}`); process.exit(1); }
const siteOverrides = existsSync("data/site.json") ? readJsonOrExit("data/site.json") : {};
if (!siteOverrides || typeof siteOverrides !== "object" || Array.isArray(siteOverrides)) {
  console.error("data/site.json: must be a JSON object (portal settings like lang, title, indexable, baseUrl)");
  process.exit(1);
}
const site = { ...DEFAULT_SITE, ...siteOverrides };

replaceOutput("site", (output) => {
  mkdirSync(join(output, "r"), { recursive: true });

  // Reject symlinks, including dangling ones, instead of following or publishing
  // them. The destination must remain a regular file/directory inside site/img.
  const imageRoot = resolve(output, "img");
  function copyImages(source, destination) {
    const rel = relative(imageRoot, resolve(destination));
    if (rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith(sep)) throw new Error("Image destination escapes site/img");
    const input = lstatSync(source);
    if (input.isSymbolicLink()) throw new Error(`Image symlinks are not allowed: ${source}`);
    let destinationStat = null;
    try { destinationStat = lstatSync(destination); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (destinationStat?.isSymbolicLink()) throw new Error(`Image destination symlink is not allowed: ${destination}`);
    if (input.isDirectory()) {
      if (destinationStat && !destinationStat.isDirectory()) throw new Error(`Image directory/file collision: ${destination}`);
      mkdirSync(destination, { recursive: true });
      for (const name of readdirSync(source)) copyImages(join(source, name), join(destination, name));
    } else if (input.isFile()) {
      if (destinationStat && !destinationStat.isFile()) throw new Error(`Image file/directory collision: ${destination}`);
      // The custom data/img copy intentionally overrides same-name sample files.
      copyFileSync(source, destination);
    } else throw new Error(`Unsupported image entry: ${source}`);
  }

  // Page images are optional: they belong to the source archive and are not
  // redistributed with this repository.
  // data/sample-img holds only the synthetic sample page; data/img is git-ignored.
  for (const dir of ["data/sample-img", "data/img"]) {
    try { lstatSync(dir); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    copyImages(dir, join(output, "img"));
  }

  // OpenSeadragon (BSD-3-Clause) viewer, copied from node_modules with its license.
  const OSD = "node_modules/openseadragon";
  mkdirSync(join(output, "vendor/openseadragon"), { recursive: true });
  copyFileSync(`${OSD}/build/openseadragon/openseadragon.min.js`, join(output, "vendor/openseadragon/openseadragon.min.js"));
  copyFileSync(`${OSD}/LICENSE.txt`, join(output, "vendor/openseadragon/LICENSE.txt"));
  cpSync(`${OSD}/build/openseadragon/images`, join(output, "vendor/openseadragon/images"), { recursive: true });

  writeFileSync(join(output, "style.css"), STYLE);
  writeFileSync(join(output, "viewer.js"), VIEWER_JS);
  for (const r of records) writeFileSync(join(output, "r", `${safeId(r.id)}.html`), recordPage(r, site));
  writeFileSync(join(output, "index.html"), indexPage(site, records.length));
  writeFileSync(join(output, "404.html"), notFoundPage(site));
  writeFileSync(join(output, "robots.txt"), robotsTxt(site));
  const sitemap = sitemapXml(site, records);
  if (sitemap) writeFileSync(join(output, "sitemap.xml"), sitemap);

  // The documented full build must not replace a working portal until search
  // indexing also succeeds. Keep the HTML-only entry point for tooling/tests.
  if (process.argv.includes("--index")) {
    execFileSync(process.execPath, [resolve("node_modules/pagefind/lib/runner/bin.cjs"), "--site", resolve(output)], { stdio: "inherit" });
  }
});
console.log(`site/ built: ${records.length} record pages`);
