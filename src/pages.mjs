// Extract PDF page images without mixing a failed run with a previous output.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, realpathSync } from "node:fs";
import { resolve, relative, sep, join, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { replaceOutput } from "./output.mjs";

export function extractPages(pdf, out, dpi = "200", run = execFileSync) {
  if (!pdf || !out) throw new Error("usage: node src/pages.mjs <pdf> <output-dir> [dpi=200]");
  const resolution = String(dpi);
  if (!/^\d+$/.test(resolution) || Number(resolution) < 36 || Number(resolution) > 1200) {
    throw new Error("dpi must be an integer between 36 and 1200");
  }
  const input = realpathSync(resolve(pdf));
  // The parent must exist. Canonicalize it before comparing or creating staging,
  // so parent aliases cannot hide that the source lives inside the destination.
  const requestedOutput = resolve(out);
  const output = join(realpathSync(dirname(requestedOutput)), basename(requestedOutput));
  if (!statSync(input).isFile()) throw new Error("PDF input must be a regular file");
  const inside = relative(output, input);
  if (inside === "" || (!inside.startsWith(`..${sep}`) && inside !== ".." && !inside.startsWith(sep))) {
    throw new Error("PDF input must not be inside the output directory");
  }
  let count = 0;
  replaceOutput(output, (staged) => {
    mkdirSync(staged);
    // Absolute input also prevents a filename beginning with '-' becoming an option.
    run("pdftoppm", ["-r", resolution, "-png", input, join(staged, "pagina")], { stdio: "inherit" });
    const pages = readdirSync(staged).filter((name) => /^pagina-\d+\.png$/.test(name));
    if (!pages.length) throw new Error("pdftoppm produced no page images");
    for (const page of pages) {
      const file = statSync(join(staged, page));
      if (!file.isFile() || file.size === 0) throw new Error(`Invalid or empty page image: ${page}`);
    }
    count = pages.length;
  });
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [pdf, out, dpi = "200"] = process.argv.slice(2);
  try {
    const count = extractPages(pdf, out, dpi);
    console.log(`${count} page(s) extracted to ${out}/`);
  } catch (error) {
    console.error(`Page extraction failed: ${error.message}`);
    process.exitCode = 1;
  }
}
