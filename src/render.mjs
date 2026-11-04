const ES_UI = {
  "OCR not reviewed": "OCR no revisado",
  "Original reading": "Lectura original",
  "Proposed correction": "Corrección propuesta",
  "Reviewed correction": "Corrección revisada",
  "View source page / region": "Ver página / región de la fuente",
  "Skip to content": "Saltar al contenido",
  "Breadcrumb": "Ruta de navegación",
  "years": "años",
  "year": "año",
  "The original image is not available for this record.": "La imagen original no está disponible para esta ficha.",
  "household": "hogar",
  "page": "página",
  "reviewed": "revisado",
  "not reviewed": "pendiente de revisión",
  "Source:": "Fuente:",
  "Copy citation": "Copiar cita",
  "Page not found": "Página no encontrada",
  "This page does not exist.": "Esta página no existe.",
  "Search the index": "Buscar en el índice",
  "to find a record by name.": "para encontrar una ficha por nombre.",
  "entries indexed.": "asientos indexados.",
  "Crop of the original line for": "Recorte de la línea original de",
  "Line of the original page, name highlighted. Machine-detected box, pending review.": "Línea de la página original con el nombre resaltado. Recuadro detectado por IA, pendiente de revisión.",
  "Index under review:": "Índice en revisión:",
  "machine-produced draft. Each entry shows how reliable the reading is and stays pending human review.": "borrador producido por IA a partir de las imágenes; cada ficha marca la confianza de la lectura y queda pendiente de revisión humana.",
  "Scroll or use the buttons to zoom, drag to move. With the keyboard: arrow keys to move, plus and minus to zoom.": "Desplázate o usa los botones para ampliar; arrastra para mover. Con el teclado: flechas para mover, más y menos para ampliar.",
  "Zoomable scan of the original page": "Imagen ampliable de la página original",
  "Use the arrow keys to move, plus and minus to zoom.": "Usa las flechas para mover, más y menos para ampliar.",
  "Open the original page": "Abrir la página original",
  "in a new tab": "en otra pestaña",
  "The image did not load; this link may not work.": "La imagen no se ha cargado; es posible que el enlace no funcione."
};
const isSpanish = (site = {}) => /^es(?:-|$)/i.test(String(site.lang ?? ""));
const ui = (site, text) => isSpanish(site) ? (ES_UI[text] ?? text) : text;

// Pure rendering helpers (no file I/O) so they can be unit tested.
export const fold = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Image paths must be plain relative paths inside the site (no scheme, no "..", no leading slash).
export const safeImage = (p) => (/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(String(p ?? "")) && !String(p).split("/").includes("..") ? String(p) : "");
// Portal visibility. The portal lists named people, so it is NOT indexable by search engines unless
// data/site.json sets "indexable": true.
export const robotsMeta = (site) => (site.indexable === true ? "" : '\n<meta name="robots" content="noindex, nofollow">');
// "baseUrl" (optional, e.g. "https://example.org/archive/") is where the portal is served. Its path prefixes search result links.
export function basePath(site) {
  const root = baseRoot(site);
  if (!root) return "";
  const p = new URL(root).pathname;
  return p.endsWith("/") ? p : p + "/";
}
// The configured baseUrl with a trailing slash, or "" when it is missing or
// not a valid absolute URL. Consumers treat invalid the same as absent, the
// way basePath does.
function baseRoot(site) {
  const raw = String(site.baseUrl ?? "");
  if (!raw) return "";
  let url;
  try { url = new URL(raw); } catch { return ""; }
  // Only web URLs can host the portal: mailto:/data: parse but cannot
  // resolve sitemap.xml against them, and other schemes cannot serve it.
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.host) return "";
  return raw.endsWith("/") ? raw : raw + "/";
}
export function robotsTxt(site) {
  if (site.indexable !== true) return "User-agent: *\nDisallow: /\n";
  const root = baseRoot(site);
  return `User-agent: *\nAllow: /\n${root ? `Sitemap: ${new URL("sitemap.xml", root).href}\n` : ""}`;
}
export function sitemapXml(site, records) {
  const root = baseRoot(site);
  if (site.indexable !== true || !root) return "";
  const urls = [root, ...records.map((r) => `${root}r/${safeId(r.id)}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
}
export const safeId = (id) => String(id).replace(/[^A-Za-z0-9._-]/g, "_");

// Optional line crop: r.linea = { x, y, w, h, aspect? }, all page-relative fractions in 0..1.
// "aspect" is page width / page height; it is only needed for the static crop.
// Returns a clean box or null when the data is missing or out of range.
export function safeBox(b) {
  if (!b || typeof b !== "object") return null;
  const [x, y, w, h] = ["x", "y", "w", "h"].map((k) => Number(b[k]));
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  const aspect = Number(b.aspect);
  return { x, y, w, h, aspect: Number.isFinite(aspect) && aspect > 0.1 && aspect < 10 ? aspect : null };
}

// The detected line starts with the order number and a "D." mark. The name
// begins after them: skip a fixed share of the line width (see docs/MODELO.md).
export const NAME_MARGIN = 0.14;
export function nameBox(box, margin = NAME_MARGIN) {
  const b = safeBox(box);
  if (!b) return null;
  return { ...b, x: b.x + b.w * margin, w: b.w * (1 - margin) };
}

const pct = (n) => `${Math.round(n * 10000) / 100}%`;

// Static, script-free crop: the page image as a CSS background, zoomed to the line,
// with the name highlighted on top. Needs the page aspect ratio.
export function lineCropHtml(r, site = {}) {
  const img = safeImage(r.imagen);
  const line = safeBox(r.linea);
  const name = nameBox(r.linea);
  if (!img || !line || !line.aspect) return "";
  const lineAspect = (line.w * line.aspect) / line.h;
  const posX = line.w >= 1 ? 0 : (line.x / (1 - line.w)) * 100;
  const posY = line.h >= 1 ? 0 : (line.y / (1 - line.h)) * 100;
  const hl = `left:${pct((name.x - line.x) / line.w)};width:${pct(name.w / line.w)}`;
  return `<figure class="linecrop" id="linecrop" data-pagefind-ignore>
    <div class="linecrop-box" role="img" aria-label="${ui(site, "Crop of the original line for")} ${esc(r.nombre)} ${esc(r.apellidos)}" style="aspect-ratio:${Math.round(lineAspect * 100) / 100};background-image:url('../${esc(img)}');background-size:${pct(1 / line.w)} auto;background-position:${Math.round(posX * 100) / 100}% ${Math.round(posY * 100) / 100}%">
      <span class="linecrop-hl" style="${hl}"></span>
    </div>
    <figcaption class="meta">${ui(site, "Line of the original page, name highlighted. Machine-detected box, pending review.")}</figcaption>
  </figure>`;
}

const CONF = { alta: "reliable reading", media: "check reading", baja: "doubtful reading" };
const CONF_ES = { alta: "lectura segura", media: "revisar lectura", baja: "lectura dudosa" };

function boxAttrs(r) {
  const line = safeBox(r.linea);
  const name = nameBox(r.linea);
  if (!line) return "";
  const f = (n) => Math.round(n * 1e5) / 1e5;
  return ` data-line="${[line.x, line.y, line.w, line.h].map(f).join(",")}" data-name="${[name.x, name.y, name.w, name.h].map(f).join(",")}"`;
}

export function recordPage(r, site) {
  const img = safeImage(r.imagen);
  const full = `${r.nombre} ${r.apellidos}`.trim();
  const meta = [r.relacion, r.edad != null ? `${r.edad} ${ui(site, Number(r.edad) === 1 ? "year" : "years")}` : "", r.estado, r.profesion].filter(Boolean).map(esc).join(" · ");
  return `<!doctype html>
<html lang="${esc(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)} - ${esc(site.title)}</title>${robotsMeta(site)}
<link rel="stylesheet" href="../style.css">
</head>
<body>
<a class="skip" href="#main">${ui(site, "Skip to content")}</a>
<nav data-pagefind-ignore aria-label="${ui(site, "Breadcrumb")}"><a href="../index.html">&larr; ${esc(site.title)}</a></nav>
<main id="main" data-pagefind-body>
  <h1 data-pagefind-meta="title">${esc(full)}</h1>
  <p class="meta">${meta}</p>
  <p class="meta">${esc(r.residencia ?? "")}${r.parroquia ? ", " + esc(r.parroquia) : ""}${r.municipio ? ", " + esc(r.municipio) : ""} · ${esc(r.anio)} · ${ui(site, "household")} ${esc(r.hogar)} · ${ui(site, "page")} ${esc(r.pagina)}</p>
  <p><span class="tag ${esc(r.confianza)}" data-pagefind-filter="reading">${esc((isSpanish(site) ? CONF_ES : CONF)[r.confianza] ?? r.confianza)}</span>${r.revisado ? ` <span class="tag alta">${ui(site, "reviewed")}</span>` : ` <span class="tag media">${ui(site, "not reviewed")}</span>`}</p>
  <p class="fuente">${ui(site, "Source:")} <span data-pagefind-meta="source">${esc(r.fuente)}</span> · ${ui(site, "page")} <span data-pagefind-meta="page">${esc(r.pagina)}</span></p>
  <p class="meta" data-pagefind-meta="review">${r.revisado ? ui(site, "reviewed") : ui(site, "OCR not reviewed")}</p>
  ${r.lectura_original ? `<section class="reading"><h2>${ui(site, "Original reading")}</h2><p>${esc(r.lectura_original)}</p>${r.correccion ? `<h2>${ui(site, r.revisado ? "Reviewed correction" : "Proposed correction")}</h2><p>${esc(r.correccion)}</p>` : ""}</section>` : ""}
  ${img ? '<span hidden data-pagefind-meta="source_anchor:#source-region"></span>' : ""}
  <p data-pagefind-ignore class="noprint"><button type="button" id="cite" data-cite="${esc(`${full}${r.anio ? ", " + r.anio : ""}${r.pagina ? ", " + ui(site, "page") + " " + r.pagina : ""}. ${ui(site, "Source:")} ${r.fuente}.`)}">${ui(site, "Copy citation")}</button> <span id="cite-status" role="status" class="meta"></span></p>
  <div data-pagefind-ignore>
    ${img ? `<div id="source-region" tabindex="-1"><p><a class="doc" href="../${esc(img)}" target="_blank" rel="noopener">${ui(site, "Open the original page")} (${esc(r.pagina)}) ${ui(site, "in a new tab")}</a> <span class="meta" id="image-link-note" hidden>${ui(site, "The image did not load; this link may not work.")}</span></p>
    ${lineCropHtml(r, site)}
    <div id="viewer" role="region" tabindex="0" aria-label="${ui(site, "Zoomable scan of the original page")} ${esc(r.pagina)}. ${ui(site, "Use the arrow keys to move, plus and minus to zoom.")}" data-src="../${esc(img)}"${boxAttrs(r)}></div>
    <p class="meta">${ui(site, "Scroll or use the buttons to zoom, drag to move. With the keyboard: arrow keys to move, plus and minus to zoom.")}</p></div>` : `<p class="meta image-unavailable">${ui(site, "The original image is not available for this record.")}</p>`}
  </div>
  <span hidden data-pagefind-filter="municipio">${esc(r.municipio)}</span>
  <span hidden data-pagefind-filter="year">${esc(r.anio)}</span>
</main>
<script src="../viewer.js"></script>
</body>
</html>
`;
}

// 404.html: static hosts (GitHub Pages, Cloudflare Pages, Netlify) serve it for unknown URLs.
// It can be served from any depth, so every link is absolute from the portal root.
export function notFoundPage(site) {
  const home = basePath(site) || "/";
  return `<!doctype html>
<html lang="${esc(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ui(site, "Page not found")} - ${esc(site.title)}</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${esc(home)}style.css">
</head>
<body>
<a class="skip" href="#main">${ui(site, "Skip to content")}</a>
<header><h1>${esc(site.title)}</h1></header>
<main id="main">
<h2>${ui(site, "Page not found")}</h2>
<p>${ui(site, "This page does not exist.")} <a href="${esc(home)}">${ui(site, "Search the index")}</a> ${ui(site, "to find a record by name.")}</p>
</main>
</body>
</html>
`;
}

export function indexPage(site, count) {
  return `<!doctype html>
<html lang="${esc(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.title)}</title>${robotsMeta(site)}
<link rel="stylesheet" href="style.css">
<link href="pagefind/pagefind-component-ui.css" rel="stylesheet">
<script src="pagefind/pagefind-component-ui.js" type="module"></script>
</head>
<body>
<a class="skip" href="#main">${ui(site, "Skip to content")}</a>
<header>
  <h1>${esc(site.title)}</h1>
  <p>${esc(site.subtitle)}</p>
  <p class="notice"><strong>${ui(site, "Index under review:")}</strong> ${ui(site, "machine-produced draft. Each entry shows how reliable the reading is and stays pending human review.")}</p>
</header>
<main id="main">
${basePath(site) ? `<pagefind-config base-url="${esc(basePath(site))}" bundle-path="${esc(basePath(site))}pagefind/"></pagefind-config>\n` : ""}<pagefind-input placeholder="${esc(site.placeholder)}"></pagefind-input>
<pagefind-summary></pagefind-summary>
<pagefind-results>
<script type="text/pagefind-template">
<li class="archive-result">
  <h2><a href="{{ url | safeUrl }}">{{ meta.title }}</a></h2>
  <p class="meta">${ui(site, "Source:")} {{ meta.source }} · ${ui(site, "page")} {{ meta.page }} · {{ meta.review }}</p>
  {{#if meta.source_anchor}}<p><a href="{{ url | safeUrl }}#source-region">${ui(site, "View source page / region")}</a></p>{{/if}}
  {{#if excerpt}}<p>{{+ excerpt +}}</p>{{/if}}
</li>
</script>
</pagefind-results>
<p class="meta">${count} ${ui(site, "entries indexed.")}</p>
</main>
</body>
</html>
`;
}

export const VIEWER_JS = `const es = /^es(?:-|$)/i.test(document.documentElement.lang);
const el = document.getElementById("viewer");
const citeBtn = document.getElementById("cite");
if (citeBtn) {
  citeBtn.addEventListener("click", async () => {
    const text = citeBtn.dataset.cite + " " + location.href.split("#")[0];
    const status = document.getElementById("cite-status");
    try { await navigator.clipboard.writeText(text); status.textContent = es ? "Cita copiada." : "Citation copied."; }
    catch {
      let field = document.getElementById("cite-fallback");
      if (!field) {
        const label = document.createElement("label");
        label.htmlFor = "cite-fallback";
        label.textContent = es ? "Cita para copiar" : "Citation to copy";
        field = document.createElement("textarea");
        field.id = "cite-fallback";
        field.readOnly = true;
        field.rows = 4;
        const fallback = document.createElement("div");
        fallback.className = "citation-fallback noprint";
        fallback.append(label, field);
        citeBtn.parentElement.after(fallback);
      }
      field.value = text;
      status.textContent = es ? "No se ha podido copiar automáticamente. Selecciona y copia la cita de abajo." : "Automatic copying is unavailable. Select and copy the citation below.";
      field.focus();
      field.select();
    }
  });
}
// Shared by a failed script load and a failed image open: replace the
// unusable viewer surface with the localized explanation, announced politely.
// The static line crop is a CSS background-image, which fires no error
// event: a missing page image would stay as a dark box with a floating
// highlight and a false caption. Preload the same URL and drop the figure.
const crop = document.getElementById("linecrop");
if (el && el.dataset.src) {
  const probe = document.createElement("img");
  probe.onerror = () => {
    if (crop) crop.remove();
    const note = document.getElementById("image-link-note");
    if (note) note.hidden = false;
  };
  probe.src = el.dataset.src;
}
function showImageFallback() {
  if (!el) return;
  const hadFocus = el.contains(document.activeElement);
  el.tabIndex = 0;
  el.setAttribute("aria-live", "polite");
  el.innerHTML = "";
  const p = document.createElement("p");
  p.className = "viewer-fallback";
  p.textContent = es ? "No se ha podido cargar la imagen. Los datos de la ficha siguen disponibles." : "The page scan could not be loaded. The transcript below is still available.";
  el.appendChild(p);
  if (hadFocus) el.focus();
}
function startViewer() {
if (el && window.OpenSeadragon) {
  if (es) {
    const strings = {
      "Errors.Dzc": "Las colecciones Deep Zoom no son compatibles.",
      "Errors.Dzi": "La imagen no es un documento Deep Zoom válido.",
      "Errors.Xml": "El documento XML no es válido.",
      "Errors.ImageFormat": "El formato de imagen no es compatible.",
      "Errors.Security": "El navegador ha bloqueado la imagen.",
      "Errors.Status": "La imagen no está disponible (estado {0}).",
      "Errors.OpenFailed": "No se ha podido abrir {0}: {1}",
      "Tooltips.FullPage": "Alternar pantalla completa",
      "Tooltips.Home": "Ver la página completa",
      "Tooltips.ZoomIn": "Ampliar",
      "Tooltips.ZoomOut": "Reducir",
      "Tooltips.NextPage": "Página siguiente",
      "Tooltips.PreviousPage": "Página anterior",
      "Tooltips.RotateLeft": "Girar a la izquierda",
      "Tooltips.RotateRight": "Girar a la derecha",
      "Tooltips.Flip": "Voltear la imagen",
      "GestureHints.Touch": "Usa dos dedos para mover la imagen",
      "GestureHints.Scroll": "Usa {0} y la rueda para ampliar la imagen"
    };
    for (const [key, value] of Object.entries(strings)) OpenSeadragon.setString(key, value);
  }
  const viewer = OpenSeadragon({
    element: el,
    prefixUrl: "../vendor/openseadragon/images/",
    tileSources: { type: "image", url: el.dataset.src },
    showNavigator: true,
    // Respect the reduced-motion preference: no animated zoom or pan.
    animationTime: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1.2,
    gestureSettingsMouse: { scrollToZoom: true },
  });
  // OpenSeadragon handles keyboard input on its canvas, not the wrapper.
  // Keep one named, operative tab stop and preserve focus during lazy loading.
  viewer.canvas.setAttribute("role", "region");
  viewer.canvas.setAttribute("aria-label", el.getAttribute("aria-label"));
  el.tabIndex = -1;
  el.addEventListener("focus", () => { if (viewer.canvas.isConnected) viewer.canvas.focus(); });
  if (document.activeElement === el) viewer.canvas.focus();
  // A missing or corrupt page image fires "open-failed": explain it instead
  // of leaving an empty dark box with working zoom controls.
  viewer.addHandler("open-failed", showImageFallback);
  const parse = (s) => (s ? s.split(",").map(Number) : null);
  const line = parse(el.dataset.line);
  const name = parse(el.dataset.name);
  if (line && line.length === 4 && line.every(Number.isFinite)) {
    viewer.addHandler("open", () => {
      const ratio = viewer.world.getItemAt(0).getContentSize().y / viewer.world.getItemAt(0).getContentSize().x;
      // OpenSeadragon viewport units: image width = 1, height = ratio.
      const rect = (b) => new OpenSeadragon.Rect(b[0], b[1] * ratio, b[2], b[3] * ratio);
      if (name && name.length === 4 && name.every(Number.isFinite)) {
        const hl = document.createElement("div");
        hl.className = "name-highlight";
        viewer.addOverlay(hl, rect(name));
      }
      const pad = 0.15;
      const r = rect(line);
      viewer.viewport.fitBounds(new OpenSeadragon.Rect(r.x - r.width * pad, r.y - r.height * 2, r.width * (1 + 2 * pad), r.height * 5), true);
    });
  }
}
}
// OpenSeadragon (about 190 KB) is loaded only when the viewer is near the screen.
if (el) {
  let started = false;
  const load = () => {
    if (started) return; started = true;
    if (window.OpenSeadragon) return startViewer();
    const sc = document.createElement("script");
    sc.src = "../vendor/openseadragon/openseadragon.min.js";
    sc.onload = startViewer;
    sc.onerror = showImageFallback;
    document.head.appendChild(sc);
  };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); load(); } }, { rootMargin: "300px" }).observe(el);
  } else load();
  el.addEventListener("focus", load, { once: true });
}
`;

export const STYLE = `.citation-fallback { margin: 1rem 0; } .citation-fallback label { display: block; margin-bottom: .4rem; } .citation-fallback textarea { box-sizing: border-box; width: 100%; padding: .6rem; font: inherit; color: inherit; background: transparent; border: 1px solid #b7a582; border-radius: 6px; overflow-wrap: anywhere; }
.archive-result { list-style:none; border:1px solid #b7a582; border-radius:6px; padding:.8rem; margin:.5rem 0; overflow-wrap:anywhere; } .archive-result h2 { font-size:1.1rem; margin:0; } .archive-result p { margin:.5rem 0; } .reading p { white-space:pre-wrap; overflow-wrap:anywhere; } #source-region { scroll-margin-top:1rem; }
.linecrop { margin: 1rem 0; } .linecrop-box { position: relative; width: 100%; max-width: 40rem; background-repeat: no-repeat; border: 1px solid #b7a582; border-radius: 4px; background-color: #1f1a14; }
.linecrop-hl, .name-highlight { position: absolute; top: 8%; bottom: 8%; background: rgba(255, 213, 0, .28); outline: 2px solid rgba(214, 160, 0, .9); border-radius: 3px; }
.name-highlight { position: static; }
#viewer { width: 100%; height: 32rem; background: #1f1a14; border: 1px solid #b7a582; border-radius: 6px; }
.viewer-fallback { color: #f3e9d2; padding: 1rem; margin: 0; }
:root { color-scheme: light dark; }
.skip { position: absolute; left: .5rem; top: -4rem; background: #1d4f7a; color: #fff; padding: .5rem .8rem; border-radius: 4px; z-index: 10; }
.skip:focus { top: .5rem; }
:focus-visible { outline: 3px solid #1d4f7a; outline-offset: 2px; }
#viewer:focus-visible, #viewer .openseadragon-canvas:focus-visible { outline-offset: -3px; }
body { font-family: Georgia, 'Times New Roman', serif; max-width: 62rem; margin: 0 auto; padding: 1.5rem 1rem; color: #2b2118; background: #f7f2e9; }
h1 { font-size: 1.6rem; margin: 0 0 .2rem; }
.meta, header p { color: #6d5c44; font-size: .95rem; }
.notice { background: #fdf0d0; border: 1px solid #d8c9a8; border-radius: 6px; padding: .5rem .7rem; font-size: .85rem; }
.tag { display: inline-block; font-size: .72rem; padding: .1rem .45rem; border-radius: 999px; }
.alta { background: #dcefd9; color: #2c5d2c; } .media { background: #fdf0d0; color: #7a5f16; } .baja { background: #f8ddda; color: #96372e; }
.fuente { font-size: .8rem; color: #6d5c44; }
a { color: #1d4f7a; }
:root { --pagefind-ui-scale: 1; --pagefind-ui-primary: #5E8298; --pagefind-ui-background: #fffdf7; --pagefind-ui-border: #b7a582; --pagefind-ui-text: #2b2118; --pagefind-ui-font: Georgia, serif; }
@media (prefers-color-scheme: dark) {
  body { color: #efe6d6; background: #1b1712; }
  .meta, header p, .fuente { color: #c4b698; }
  a { color: #8fc0ea; }
  .notice { background: #3a2f17; border-color: #6b5a33; }
  .alta { background: #25402a; color: #bfe3bb; } .media { background: #3a2f17; color: #e8cd85; } .baja { background: #4a2420; color: #f3b9b2; }
  :focus-visible { outline-color: #8fc0ea; }
  :root { --pagefind-ui-primary: #8fb5c9; --pagefind-ui-background: #26201a; --pagefind-ui-border: #6b5a33; --pagefind-ui-text: #efe6d6; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
@media (max-width: 40rem) {
  body { padding: 1rem .75rem; }
  #viewer { height: 70vh; min-height: 18rem; }
  .linecrop-box { max-width: 100%; }
  a, button { min-height: 44px; display: inline-flex; align-items: center; }
  p a, .meta a { display: inline; min-height: 0; padding: .35rem 0; }
}
button { font: inherit; padding: .4rem .8rem; border: 1px solid #b7a582; border-radius: 6px; background: #fffdf7; color: inherit; cursor: pointer; }
@media (prefers-color-scheme: dark) { button { background: #26201a; border-color: #6b5a33; } }
@media print {
  body { background: #fff; color: #000; max-width: none; }
  .noprint, #viewer, .skip, nav, pagefind-input { display: none !important; }
  a { color: #000; text-decoration: none; }
  .linecrop-box { background-color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
