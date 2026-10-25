// Static portal generator: data/records.json -> site/ (index page + one page per record),
// then Pagefind (MIT) indexes the pages for in-browser, accent-insensitive search.
// Run with `npm run build`. Output is plain HTML/CSS/JS.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync, cpSync } from "node:fs";
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

// Page images are optional: they belong to the source archive and are not
// redistributed with this repository.
// data/sample-img holds only the synthetic sample page; data/img is git-ignored.
for (const dir of ["data/sample-img", "data/img"]) {
  if (!existsSync(dir)) continue;
  mkdirSync("site/img", { recursive: true });
  for (const f of readdirSync(dir)) copyFileSync(`${dir}/${f}`, `site/img/${f}`);
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
