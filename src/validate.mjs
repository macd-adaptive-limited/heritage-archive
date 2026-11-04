// Validates data/records.json against the model in docs/MODELO.md.
// Usage: node src/validate.mjs [path]   (default data/records.json). Exit code 1 on any error.
import { readFileSync } from "node:fs";
import { safeImage, safeBox, safeId } from "./render.mjs";

const CONFIANZA = new Set(["alta", "media", "baja"]);
const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isInt = (v) => Number.isInteger(v);
const isOptionalImage = (value) => value == null || value === "" || (typeof value === "string" && Boolean(safeImage(value)));

// Keep image/crop validation together and independent of person-field checks.
function validateImage(r, err) {
  if (!isOptionalImage(r.imagen)) err("imagen must be a plain relative path (letters, digits, . _ - and /; no .., no scheme)");
  if (r.linea != null) {
    if (!safeBox(r.linea)) err("linea must be {x,y,w,h} fractions in 0..1 inside the page");
    else if (!r.imagen) err("linea needs imagen");
    else if (!(Number(r.linea.aspect) > 0.1 && Number(r.linea.aspect) < 10)) err("linea.aspect (page width / height, 0.1-10) is needed for the static crop");
  }
}

export function validateRecords(records) {
  const errors = [];
  if (!Array.isArray(records)) return ["records must be a JSON array"];
  const ids = new Map();
  const files = new Map();
  records.forEach((r, i) => {
    const where = `record #${i + 1}${r && r.id ? ` (${r.id})` : ""}`;
    const err = (msg) => errors.push(`${where}: ${msg}`);
    if (!r || typeof r !== "object" || Array.isArray(r)) return err("must be an object");
    if (!isStr(r.id)) err("id is required (non-empty string)");
    else {
      if (ids.has(r.id)) err(`duplicate id, also record #${ids.get(r.id)}`);
      else ids.set(r.id, i + 1);
      const f = safeId(r.id);
      if (files.has(f) && files.get(f) !== r.id) err(`id maps to the same page file as "${files.get(f)}" (${f}.html)`);
      files.set(f, r.id);
    }
    for (const k of ["nombre", "apellidos", "fuente"]) if (!isStr(r[k])) err(`${k} is required (non-empty string)`);
    for (const k of ["anio", "pagina", "hogar"]) if (!isInt(r[k]) || r[k] < 0) err(`${k} must be a non-negative integer`);
    if (isInt(r.anio) && (r.anio < 1000 || r.anio > 2100)) err("anio looks out of range (1000-2100)");
    if (r.edad != null && (!Number.isFinite(r.edad) || r.edad < 0 || r.edad > 125)) err("edad must be a number between 0 and 125, or omitted");
    if (!CONFIANZA.has(r.confianza)) err(`confianza must be one of ${[...CONFIANZA].join("|")}`);
    if (typeof r.revisado !== "boolean") err("revisado must be true or false");
    for (const k of ["relacion", "estado", "profesion", "residencia", "parroquia", "municipio"]) if (r[k] != null && typeof r[k] !== "string") err(`${k} must be a string`);
    validateImage(r, err);
    for (const k of ["lectura_original", "correccion"]) if (r[k] != null && !isStr(r[k])) err(`${k} must be a non-empty string`);
    if (r.correccion != null && !isStr(r.lectura_original)) err("correccion needs lectura_original; never replace the original reading");
    if (r.variantes != null && !(Array.isArray(r.variantes) && r.variantes.every(isStr))) err("variantes must be an array of non-empty strings");
  });
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2] || "data/records.json";
  let records;
  try { records = JSON.parse(readFileSync(path, "utf8")); } catch (e) { console.error(`${path}: cannot read or parse (${e.message})`); process.exit(1); }
  const errors = validateRecords(records);
  if (errors.length) { console.error(`${path}: ${errors.length} problem(s)\n- ${errors.join("\n- ")}`); process.exit(1); }
  console.log(`${path}: ${records.length} records OK`);
}
