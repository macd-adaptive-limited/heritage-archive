import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

// A file URL encodes spaces, #, %, and non-ASCII characters. Comparing it to
// a raw filesystem path used to skip validation silently and return success.
for (const label of ["plain", "space here", "hash#here", "percent%here", "café"]) {
  test(`validator CLI runs from a checkout path containing ${label}`, () => {
    const dir = mkdtempSync(join(tmpdir(), `heritage-${label}-`));
    try {
      cpSync("src", join(dir, "src"), { recursive: true });
      const run = (args) => spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8" });
      writeFileSync(join(dir, "valid.json"), "[]");
      const valid = run(["src/validate.mjs", "valid.json"]);
      assert.equal(valid.status, 0, valid.stderr);
      assert.match(valid.stdout, /valid\.json: 0 records OK/);

      writeFileSync(join(dir, "invalid.json"), "not JSON");
      const invalid = run(["src/validate.mjs", "invalid.json"]);
      assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
      assert.match(invalid.stderr, /invalid\.json: cannot read or parse/);

      writeFileSync(join(dir, "wrong-model.json"), "{}");
      const wrong = run(["src/validate.mjs", "wrong-model.json"]);
      assert.equal(wrong.status, 1, wrong.stdout + wrong.stderr);
      assert.match(wrong.stderr, /records must be a JSON array/);

      const missing = run(["src/validate.mjs"]);
      assert.equal(missing.status, 1, missing.stdout + missing.stderr);
      assert.match(missing.stderr, /data\/records\.json: cannot read or parse/);

      // Importing the pure validator must never run its CLI branch, even when
      // the host process has no entry-point argument (for example node -e).
      const imported = run(["--input-type=module", "-e", `
        import { validateRecords } from ${JSON.stringify(pathToFileURL(join(dir, "src/validate.mjs")).href)};
        console.log(JSON.stringify(validateRecords([])));
      `]);
      assert.equal(imported.status, 0, imported.stderr);
      assert.equal(imported.stdout.trim(), "[]");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
