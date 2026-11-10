<p align="center">
  <img src="docs/images/banner.svg" alt="Heritage Archive: static portals for historical records" width="900">
</p>

# Heritage Archive

Static portals for historical records archives.

Person-level index of historical municipal record collections (census rolls, minute books) with an online search portal and the document image beside each entry.

This repository contains the **static portal generator**: it turns a JSON index of records into a plain HTML/CSS/JS portal with one page per record and in-browser, accent-insensitive name search powered by [Pagefind](https://pagefind.app) (MIT). No framework and no server: the output is static files.

The transcription pipeline that produces the index from page scans is private and not part of this repository.

## Quick start

```sh
npm ci
cp data/records.sample.json data/records.json   # marked synthetic sample data
npm run validate                                 # checks data/records.json against docs/MODELO.md
npm run build                                    # writes the portal to site/ and indexes it (validates first)
npm test
```

`data/records.json` and `data/img/` are git-ignored on purpose: real data and scans stay out of this repository. Optional `data/site.json` overrides `lang`, `title`, `subtitle` and `placeholder`, and sets two publishing options:

- `indexable` (default `false`): by default every page carries `noindex, nofollow` and `robots.txt` disallows everything, because the portal lists named people. Set `true` only when the collection and its audience call for search-engine indexing.
- `baseUrl` (e.g. `https://example.org/archive/`): where the portal is served. Its path prefixes Pagefind result links, so the portal can live in a subfolder. With `indexable: true` it also produces `sitemap.xml` and the `Sitemap:` line in `robots.txt`. Query strings and fragments are removed from this publishing URL, and its path is normalized with a trailing slash. URLs containing a username or password are ignored rather than copied into public files; use the public HTTP(S) location without credentials.

Serve `site/` with any static file server.

The full build (`npm run build`) prepares files and the Pagefind search index in
a temporary sibling folder and replaces `site/` only after both succeed. An
image-copy, missing-viewer, or indexing failure preserves the previous portal;
a failed replacement attempt restores it. Successful generation removes stale files. The destination
must be a regular directory, not a file or symlink. Do not run concurrent builds
against the same output. `node src/build.mjs` remains an HTML-only entry point;
use `npm run build` (or `node src/build.mjs --index`) for a searchable portal.
This is not a deployment transaction: abrupt process termination or disk failure
can still interrupt the directory swap. Keep release backups for deployments.

## Loading your own data

Write your index as `data/records.json`: an array of person records following the data model in `docs/MODELO.md` (`id`, `nombre`, `apellidos`, `relacion`, `edad`, `estado`, `profesion`, `residencia`, `parroquia`, `municipio`, `anio`, `pagina`, `hogar`, `imagen`, `fuente`, `confianza`, `revisado`). Then run `npm run build`.

## Page images

Record pages show the page image in an [OpenSeadragon](https://openseadragon.github.io) zoom viewer (BSD-3-Clause, copied into `site/vendor/` at build time).

Each record can point to the image of its source page (`imagen` field, files under `data/img/`). Images are **not redistributed with this repository**: they belong to the source archive (for the pilot, the Archivo Municipal de Colunga, which publishes the scans on colunga.es). Place your own images in `data/img/` before building; the portal works without them. The build copies `data/sample-img/` and then `data/img/` recursively into `site/img/`, so `data/img/pages/p003.jpg` uses `"imagen": "img/pages/p003.jpg"`. Custom files replace sample files with the same relative name. Symlinks are rejected. A valid image path does not guarantee that a file exists or loads.

## Privacy

Only record collections where every person is long deceased are indexed.

## Credits and license

Third-party components and their licenses are listed in `CREDITS.md`. This project is released under the GNU Affero General Public License v3.0 (see `LICENSE`).

## Images

`docs/images/` holds the README banner and the social preview (`social.png`, 1280x640). Own work, CC BY 4.0. Text is converted to paths from Playfair Display and Poppins (SIL OFL 1.1).
## Fictional Irish demo dataset

`data/records.ie.sample.json`, `data/site.ie.sample.json` and `data/sample-img/ie-sample-page.svg` are a fully fictional 1911-style census page (3 households, 11 people, townland "Ballyfictional") with an English interface. Use them to try the portal or as a public demo:

```sh
cp data/records.ie.sample.json data/records.json
cp data/site.ie.sample.json data/site.json
npm run build
```

Every name is invented; any resemblance to real people is accidental.

## PDF page extraction

With Poppler's `pdftoppm` installed, `node src/pages.mjs source.pdf output-pages 200`
extracts numbered PNG page images. DPI defaults to 200 and must be an integer
from 36 to 1200. The output's parent directory must already exist. The source
PDF must be outside the output directory so replacing pages cannot delete it.

Extraction stages a fresh set of files and replaces the output directory only
when the converter succeeds and produces non-empty numbered regular page files.
Numbered page symlinks, including dangling links, are rejected before replacement. Failed
conversion preserves an existing extraction; successful conversion removes old
pages rather than mixing documents or counting stale PNGs. Use a dedicated
output folder: successful extraction replaces **all** of its previous contents.
Do not run concurrent extractions to the same destination. This checks file
presence and size, not PNG decoding or transcription quality. No scans are
committed or published by the extraction command.
