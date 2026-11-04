// Static portal generator: data/records.json -> site/ (index page + one page per record),
// then Pagefind (MIT) indexes the pages for in-browser, accent-insensitive search.
// Run with `npm run build`. Output is plain HTML/CSS/JS.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync, cpSync, lstatSync, readdirSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
import { validateRecords } from "./validate.mjs";
import { recordPage, indexPage, safeId, robotsTxt, sitemapXml, notFoundPage, STYLE, VIEWER_JS } from "./render.mjs";

const DEFAULT_SITE = {
  lang: "en",
  title: "Heritage Archive",
  subtitle: "Person-level index of a historical records collection.",
  placeholder: "Search by name or surname",
};

const records = JSON.parse(readFileSync("data/records.json", "utf8"));
const problems = validateRecords(records);
if (problems.length) { console.error(`data/records.json: ${problems.length} problem(s)\n- ${problems.join("\n- ")}`); process.exit(1); }
const site = { ...DEFAULT_SITE, ...(existsSync("data/site.json") ? JSON.parse(readFileSync("data/site.json", "utf8")) : {}) };

rmSync("site", { recursive: true, force: true });
mkdirSync("site/r", { recursive: true });

// Reject symlinks, including dangling ones, instead of following or publishing
// them. The destination must remain a regular file/directory inside site/img.
const imageRoot = resolve("site/img");
function copyImages(source, destination) {
  const rel = relative(imageRoot, resolve(destination));
  if (rel === ".." || rel.startsWith(".." + sep) || rel.startsWith(sep)) throw new Error("Image destination escapes site/img");
  const input = lstatSync(source);
  if (input.isSymbolicLink()) throw new Error(`Image symlinks are not allowed: ${source}`);
  let output;
  try { output = lstatSync(destination); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (output?.isSymbolicLink()) throw new Error(`Image destination symlink is not allowed: ${destination}`);
  if (input.isDirectory()) {
    if (output && !output.isDirectory()) throw new Error(`Image directory/file collision: ${destination}`);
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source)) copyImages(join(source, name), join(destination, name));
  } else if (input.isFile()) {
    if (output && !output.isFile()) throw new Error(`Image file/directory collision: ${destination}`);
    // The custom data/img copy intentionally overrides same-name sample files.
    copyFileSync(source, destination);
  } else throw new Error(`Unsupported image entry: ${source}`);
}

// Page images are optional: they belong to the source archive and are not
// redistributed with this repository.
// data/sample-img holds only the synthetic sample page; data/img is git-ignored.
for (const dir of ["data/sample-img", "data/img"]) {
  try { lstatSync(dir); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
  copyImages(dir, "site/img");
}

// OpenSeadragon (BSD-3-Clause) viewer, copied from node_modules with its license.
const OSD = "node_modules/openseadragon";
mkdirSync("site/vendor/openseadragon", { recursive: true });
copyFileSync(`${OSD}/build/openseadragon/openseadragon.min.js`, "site/vendor/openseadragon/openseadragon.min.js");
copyFileSync(`${OSD}/LICENSE.txt`, "site/vendor/openseadragon/LICENSE.txt");
cpSync(`${OSD}/build/openseadragon/images`, "site/vendor/openseadragon/images", { recursive: true });

writeFileSync("site/style.css", STYLE);
writeFileSync("site/viewer.js", VIEWER_JS);
for (const r of records) writeFileSync(`site/r/${safeId(r.id)}.html`, recordPage(r, site));
writeFileSync("site/index.html", indexPage(site, records.length));
writeFileSync("site/404.html", notFoundPage(site));
writeFileSync("site/robots.txt", robotsTxt(site));
if (site.indexable === true && site.baseUrl) writeFileSync("site/sitemap.xml", sitemapXml(site, records));
console.log(`site/ built: ${records.length} record pages`);
